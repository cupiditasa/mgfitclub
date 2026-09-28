$ErrorActionPreference='Stop'
$base=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $base 'DeviceVerification.psm1') -Force
$root=Join-Path (Split-Path (Split-Path $base -Parent) -Parent) ('.test\i'+[Guid]::NewGuid().ToString('N').Substring(0,7))
Add-Type -TypeDefinition @'
using System;
public class IdentityFake {
 public string Serial="FAKE6602",Member="007";public bool Ok=true,Disconnected=false,ReadCalled=false;public int Count=0;
 public DateTime Time=DateTime.UtcNow.AddMinutes(210).AddSeconds(-5);
 public bool Connect_Net(string ip,int port){return true;}
 public void Disconnect(){Disconnected=true;}
 public bool GetSerialNumber(int n,ref string s){s=Serial;return true;}
 public bool ReadGeneralLogData(int n){ReadCalled=true;return Ok;}
 public void GetLastError(ref int code){code=-1;}
 public bool SSR_GetGeneralLogData(int n,ref string id,ref int v,ref int p,ref int y,ref int mo,ref int d,ref int h,ref int mi,ref int s,ref int w){
  if(Count++>0)return false;id=Member;v=15;p=0;y=Time.Year;mo=Time.Month;d=Time.Day;h=Time.Hour;mi=Time.Minute;s=Time.Second;w=0;return true;
 }
}
'@
$config=[pscustomobject]@{bridgeId='bridge_test';clubId='club_test';deviceSerial='FAKE6602'}
$claim=[pscustomobject]@{requestId='device_test';deviceSerial='FAKE6602';challenge=('a'*64);startedAt=[DateTime]::UtcNow.AddSeconds(-30).ToString('o');expiresAt=[DateTime]::UtcNow.AddMinutes(14).ToString('o')}
$script:tests=0
function Assert($value,$message){if(-not $value){throw $message}}
function Test($name,[scriptblock]$body){& $body;$script:tests++;Write-Output ('PASS '+$name)}
function Reject([scriptblock]$body){$failed=$false;try{& $body|Out-Null}catch{$failed=$true};Assert $failed 'Must reject'}
Test 'all identity scripts parse; no template or remote-enrollment calls' {
 foreach($name in @('Device-Verification.ps1','DeviceVerification.psm1','Capture-Identity.ps1','Start.ps1')) {
  $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $base $name),[ref]$tokens,[ref]$errors)
  Assert ($errors.Count -eq 0) ('Syntax '+$name)
  Assert ($ast.Extent.Text -notmatch 'SSR_SetUser|StartEnroll|GetUserFace|GetUserTmp|ClearGLog|DeleteEnroll|ServerCertificateValidationCallback') 'No device writes or template download'
 }
}
Test 'fresh real-shaped event remains unconfirmed until human confirmation' {
 $sdk=New-Object IdentityFake
 $body=Get-DeviceIdentityEvidence $sdk (Join-Path $root 'fresh') $config $claim '007'
 Assert ($body.memberId -ceq '007' -and $body.identityConfirmed -eq $false -and $body.observedBiometric -eq $false) 'Human confirmation not fabricated'
 Assert $sdk.Disconnected 'Disconnect on completion'
 Assert (($body|ConvertTo-Json) -notmatch 'photo|template|avatar|password') 'No biometric payload'
}
Test 'wrong device fails before reading events' {
 $sdk=New-Object IdentityFake;$sdk.Serial='OTHER'
 Reject {Get-DeviceIdentityEvidence $sdk (Join-Path $root 'wrong-device') $config $claim '007'}
 Assert (-not $sdk.ReadCalled -and $sdk.Disconnected) 'Serial guard'
}
Test 'wrong member and old records cannot establish identity' {
 $sdk=New-Object IdentityFake;$sdk.Member='008'
 Reject {Get-DeviceIdentityEvidence $sdk (Join-Path $root 'wrong-member') $config $claim '007'}
 $sdk=New-Object IdentityFake;$sdk.Time=$sdk.Time.AddDays(-1)
 Reject {Get-DeviceIdentityEvidence $sdk (Join-Path $root 'old') $config $claim '007'}
}
Test 'failed fresh read cannot use previously cached proof' {
 $dir=Join-Path $root 'replay';$sdk=New-Object IdentityFake
 $null=Get-DeviceIdentityEvidence $sdk $dir $config $claim '007'
 $sdk=New-Object IdentityFake;$sdk.Ok=$false
 Reject {Get-DeviceIdentityEvidence $sdk $dir $config $claim '007'}
}
Test 'expired challenge and bad binding never touch SDK' {
 $copy=$claim|ConvertTo-Json|ConvertFrom-Json;$copy.expiresAt=[DateTime]::UtcNow.AddMinutes(-1).ToString('o');$sdk=New-Object IdentityFake
 Reject {Get-DeviceIdentityEvidence $sdk (Join-Path $root 'expired') $config $copy '007'}
 Assert (-not $sdk.ReadCalled) 'No stale claim I/O'
 $copy=$claim|ConvertTo-Json|ConvertFrom-Json;$copy.deviceSerial='OTHER'
 Reject {Get-DeviceIdentityEvidence $sdk (Join-Path $root 'bad') $config $copy '007'}
}
Write-Output "$script:tests device identity tests passed; fake SDK only, no network."

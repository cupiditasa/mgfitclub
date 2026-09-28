$ErrorActionPreference='Stop'
$base=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $base 'Shadow.psm1') -Force
$root=Join-Path (Split-Path (Split-Path $base -Parent) -Parent) ('.test\s'+[Guid]::NewGuid().ToString('N').Substring(0,7))
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
public class ShadowFake {
 public string Serial="FAKE-6602"; public bool ReadOk=true,ConnectOk=true,ThrowRead=false;
 public int Cursor=0,Records=3; public List<string> Calls=new List<string>();
 public bool Connect_Net(string ip,int port){Calls.Add("connect");return ConnectOk;}
 public void Disconnect(){Calls.Add("disconnect");}
 public bool GetSerialNumber(int m,ref string s){s=Serial;return true;}
 public void GetLastError(ref int e){e=-7;}
 public bool ReadGeneralLogData(int m){Calls.Add("read"); if(ThrowRead) throw new Exception("private text"); return ReadOk;}
 public bool SSR_GetGeneralLogData(int m,ref string member,ref int v,ref int p,ref int y,ref int mo,ref int d,ref int h,ref int mi,ref int s,ref int w){
  if(Cursor>=Records)return false; member="PRIVATE-MEMBER-0001";v=Cursor==2?15:1;p=0;y=2026;mo=9;d=28;h=14;mi=0;s=Cursor;w=0;Cursor++;return true;
 }
}
'@
$script:count=0
function Assert($v,$m){if(-not $v){throw $m}}
function Test($name,[scriptblock]$action){& $action;$script:count++;Write-Output ('PASS '+$name)}
function Event($second=0){ConvertTo-ShadowEvent 'FAKE-6602' 'PRIVATE-MEMBER-0001' @(2026,9,28,14,0,$second) 15 0 0}
Test 'event fields are raw, no guessed timezone, direction or member mapping' {
 $e=Event
 Assert ($e.raw.verificationCode -eq 15 -and $e.raw.punchCode -eq 0) 'Raw codes'
 Assert ($null -eq $e.utcTime -and -not $e.billingEnabled) 'No UTC/billing'
 Assert ($e.review -eq 'member_and_punch_mapping_required') 'Review required'
}
Test 'encrypted durable store, idempotency after reload and no plaintext identifiers' {
 $dir=Join-Path $root 'store';$e=Event
 Assert ((Add-ShadowEvent $dir $e) -eq 'stored') 'Store'
 $file=Get-ChildItem $dir -Filter '*.mgenc' | Select-Object -First 1
 Assert ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($file.FullName)) -notmatch 'PRIVATE-MEMBER|FAKE-6602') 'Encrypted at rest'
 Remove-Module Shadow;Import-Module (Join-Path $base 'Shadow.psm1') -Force
 Assert ((Add-ShadowEvent $dir $e) -eq 'duplicate') 'Retry after reload'
 Assert ((Get-ShadowSummary $dir).inspectedEvents -eq 1) 'One record'
}
Test 'distinct code or timestamp is not collapsed' {
 $dir=Join-Path $root 'store'
 $null=Add-ShadowEvent $dir (Event 1)
 $null=Add-ShadowEvent $dir (ConvertTo-ShadowEvent 'FAKE-6602' 'PRIVATE-MEMBER-0001' @(2026,9,28,14,0,0) 1 0 0)
 Assert ((Get-ShadowSummary $dir).inspectedEvents -eq 3) 'Three records'
}
Test 'invalid clock is retained for review, not repaired' {
 $dir=Join-Path $root 'badtime'
 $e=ConvertTo-ShadowEvent 'FAKE-6602' 'PRIVATE-MEMBER-0001' @(2026,99,28,14,0,0) 1 0 0
 $null=Add-ShadowEvent $dir $e
 Assert ((Get-ShadowSummary $dir).invalidTimeEvents -eq 1) 'Review invalid clock'
}
Test 'corrupt encrypted file stops reads instead of silently skipping' {
 $dir=Join-Path $root 'corrupt';$e=Event;$null=Add-ShadowEvent $dir $e
 [IO.File]::WriteAllBytes((Join-Path $dir ($e.id+'.mgenc')),[byte[]]@(1,2,3))
 $failed=$false;try{Get-ShadowSummary $dir | Out-Null}catch{$failed=$true}
 Assert $failed 'Fail closed'
}
Test 'sequential capture replay stores only new records' {
 $dir=Join-Path $root 'capture';$sdk=New-Object ShadowFake
 $r=Receive-ShadowBatch -Sdk $sdk -Directory $dir -ExpectedSerial $sdk.Serial
 Assert ($r.stored -eq 3 -and $r.status -eq 'captured_pending_review') 'Captured'
 Assert ($sdk.Calls[-1] -eq 'disconnect') 'Disconnect'
 $sdk=New-Object ShadowFake
 $r=Receive-ShadowBatch -Sdk $sdk -Directory $dir -ExpectedSerial $sdk.Serial
 Assert ($r.stored -eq 0 -and $r.duplicates -eq 3) 'Replay duplicate'
 Assert (($r|ConvertTo-Json -Depth 5) -notmatch 'PRIVATE-MEMBER|FAKE-6602') 'No raw identifiers in report'
}
Test 'wrong serial never reads attendance' {
 $sdk=New-Object ShadowFake
 $r=Receive-ShadowBatch $sdk (Join-Path $root 'wrong') 'WRONG'
 Assert ($r.status -eq 'serial_mismatch_or_unavailable' -and $sdk.Calls -notcontains 'read') 'Serial gate'
 Assert ($sdk.Calls[-1] -eq 'disconnect') 'Disconnect'
}
Test 'SDK exception stops and disconnects without raw error leakage' {
 $sdk=New-Object ShadowFake;$sdk.ThrowRead=$true
 $r=Receive-ShadowBatch $sdk (Join-Path $root 'error') $sdk.Serial
 Assert ($r.status -eq 'capture_failed_partial_possible') 'Failure'
 Assert ($sdk.Calls[-1] -eq 'disconnect') 'Disconnect on error'
 Assert (($r|ConvertTo-Json -Depth 5) -notmatch 'private text') 'Error privacy'
}
Test 'scan cap never implies full history' {
 $sdk=New-Object ShadowFake
 $r=Receive-ShadowBatch $sdk (Join-Path $root 'cap') $sdk.Serial -MaxRecords 1
 Assert ($r.limitReached -and -not $r.historyComplete -and $r.scanned -eq 1) 'Cap explicit'
}
Test 'read failure vs empty is not fabricated success' {
 $sdk=New-Object ShadowFake;$sdk.ReadOk=$false
 $r=Receive-ShadowBatch $sdk (Join-Path $root 'empty') $sdk.Serial
 Assert ($r.status -eq 'read_failed_or_empty' -and $r.sdkError -eq -7) 'Read false'
}
Test 'network target and real record flags validated' {
 $sdk=New-Object ShadowFake;$failed=$false
 try{Receive-ShadowBatch $sdk (Join-Path $root 'public') $sdk.Serial -Address '8.8.8.8'|Out-Null}catch{$failed=$true}
 Assert ($failed -and $sdk.Calls.Count -eq 0) 'No public target connection'
 $e=Event;$e.billingEnabled=$true;$failed=$false
 try{Add-ShadowEvent (Join-Path $root 'forged') $e|Out-Null}catch{$failed=$true}
 Assert $failed 'No billable event accepted'
}
Test 'SDK call allowlist and syntax' {
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $base 'Shadow.psm1'),[ref]$tokens,[ref]$errors)
 Assert ($errors.Count -eq 0) 'Syntax'
 $calls=$ast.FindAll({param($n)$n -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -ieq '$Sdk'},$true)
 foreach($call in $calls){Assert ($call.Member.Value -in @('Connect_Net','Disconnect','GetSerialNumber','ReadGeneralLogData','SSR_GetGeneralLogData','GetLastError')) 'Only read calls'}
}
Test 'pilot member filter never persists other device members' {
 $sdk=New-Object ShadowFake
 $dir=Join-Path $root 'filter'
 $r=Receive-ShadowBatch $sdk $dir $sdk.Serial -OnlyMemberId 'DIFFERENT-MEMBER'
 Assert ($r.filtered -eq 3 -and $r.stored -eq 0) 'Other members filtered'
 Assert ((Get-ShadowSummary $dir).inspectedEvents -eq 0) 'No other member data stored'
}
Test 'candidate reader returns only requested member and serial' {
 $dir=Join-Path $root 'capture'
 Assert (@(Get-ShadowCandidates $dir 'FAKE-6602' 'PRIVATE-MEMBER-0001').Count -eq 3) 'Own candidates'
 Assert (@(Get-ShadowCandidates $dir 'FAKE-6602' 'OTHER').Count -eq 0) 'No cross member candidates'
}
Write-Output "$script:count tests passed; local synthetic data and fake SDK only."

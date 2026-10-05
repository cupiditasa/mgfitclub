$ErrorActionPreference='Stop'
$base=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $base 'Bridge.psm1') -Force
$repo=Split-Path (Split-Path $base -Parent) -Parent
$root=Join-Path $repo ('.test\w'+[Guid]::NewGuid().ToString('N').Substring(0,6))
$script:count=0
function Assert($value,$message){if(-not $value){throw $message}}
function Test($name,[scriptblock]$body){& $body;$script:count++;'PASS '+$name}
Add-Type -TypeDefinition @'
using System;
public class MgWebFake {
 public string Serial="TEST1"; public int Cursor=0; public bool Read=false,Closed=false,Connect=true;
 public bool Connect_Net(string ip,int port){return Connect;}
 public void Disconnect(){Closed=true;}
 public bool GetSerialNumber(int n,ref string s){s=Serial;return true;}
 public bool ReadGeneralLogData(int n){Read=true;return true;}
 public bool SSR_GetGeneralLogData(int n,ref string member,ref int v,ref int p,ref int y,ref int mo,ref int d,ref int h,ref int mi,ref int s,ref int w){
 if(Cursor>=2)return false; member="00439";v=15;p=0;y=2026;mo=10;d=5;h=12;mi=0;s=Cursor++;w=0;return true; }
}
'@
Test 'random installation secret and deterministic human pairing code' {
 $a=New-MgSecret;$b=New-MgSecret;Assert ($a -match '^[a-f0-9]{64}$' -and $a -ne $b) 'Random secret'
 Assert ((Get-MgPairCode $a) -match '^[A-F0-9]{4}(-[A-F0-9]{4}){3}$') 'Code format'
}
Test 'device serial mismatch is explicit and never reads records' {
 $sdk=New-Object MgWebFake;$r=Read-MgDevice $sdk @{serial='OTHER';address='192.168.1.201';captureSince='2026-10-05T00:00:00Z'} $root
 Assert ($r.status -eq 'serial_mismatch' -and -not $sdk.Read -and $sdk.Closed) 'Mismatch handling'
}
Test 'capture is durable, replay deduplicates and preserves leading zero member IDs' {
 $cfg=@{serial='TEST1';address='192.168.1.201';captureSince='2026-10-05T00:00:00Z'}
 1..2|ForEach-Object {$r=Read-MgDevice (New-Object MgWebFake) $cfg $root;Assert ($r.status -eq 'connected') 'Read'}
 $files=@(Get-ChildItem (Join-Path $root 'events') -Filter '*.mgp');Assert ($files.Count -eq 2) 'Two unique events'
 $e=Read-PilotPrivate $files[0].FullName;Assert ($e.memberId -ceq '00439') 'Member preserved'
 Assert (-not ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($files[0].FullName))).Contains('00439')) 'Encrypted'
}
Test 'old records are not imported as new attendance' {
 $dir=Join-Path $root 'old';$r=Read-MgDevice (New-Object MgWebFake) @{serial='TEST1';address='192.168.1.201';captureSince='2026-10-06T00:00:00Z'} $dir
 Assert (-not (Test-Path (Join-Path $dir 'events'))) 'No history stored'
}
$now=[DateTimeOffset]::Parse('2026-10-05T10:00:00Z')
$snapshot=@{serverTime='2026-10-05T09:00:00Z';cacheExpiresAt='2026-10-06T09:00:00Z';days=@();members=@(@{member_id='439';user_id='u';active=$true;role='athlete';trial_id='t';starts_at='2026-10-01T00:00:00Z';expires_at='2026-11-01T00:00:00Z';sessions=30;used=0})}
$event=@{clientId='a';memberId='439';wallTime='2026-10-05T12:00:00'}
Test 'offline status is advisory and never a final charge' {Assert ((Get-MgOfflineDecision $snapshot $event @() $now) -eq 'pending_review') 'Advisory'}
Test 'stale cache and clock rollback fail closed' {
 Assert ((Get-MgOfflineDecision $snapshot $event @() $now.AddDays(2)) -eq 'cache_stale') 'Stale'
 Assert ((Get-MgOfflineDecision $snapshot $event @() $now.AddDays(-1)) -eq 'cache_stale') 'Clock rollback'
}
Test 'unknown, blocked, exhausted and same-day states' {
 $event.memberId='999';Assert ((Get-MgOfflineDecision $snapshot $event @() $now) -eq 'unregistered') 'Unknown';$event.memberId='439'
 $snapshot.members[0].active=$false;Assert ((Get-MgOfflineDecision $snapshot $event @() $now) -eq 'blocked') 'Blocked';$snapshot.members[0].active=$true
 $snapshot.members[0].used=30;Assert ((Get-MgOfflineDecision $snapshot $event @() $now) -eq 'exhausted_estimate') 'Exhausted';$snapshot.members[0].used=0
 $snapshot.days=@(@{user_id='u';business_day='2026-10-05'});Assert ((Get-MgOfflineDecision $snapshot $event @() $now) -eq 'same_day') 'Duplicate day'
}
Write-Output ('Passed '+$script:count+' offline tests. No hardware, internet or installation used.')

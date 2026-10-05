Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
Import-Module (Join-Path $PSScriptRoot 'lib\Pilot.psm1') -Force
function Get-MgDigest([string]$Value) {
 $sha=[Security.Cryptography.SHA256]::Create()
 try {([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
}
function New-MgSecret {
 $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try {$rng.GetBytes($bytes);([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()} finally {$rng.Dispose()}
}
function Get-MgPairCode([string]$Secret) {(Get-MgDigest $Secret).Substring(0,16).ToUpperInvariant() -replace '(.{4})(?=.)','$1-'}
function Invoke-MgSync([string]$Secret,$Events,[string]$DeviceStatus) {
 if($Secret -notmatch '^[a-f0-9]{64}$'){throw 'invalid_secret'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $handler=New-Object Net.Http.HttpClientHandler;$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false
 $client=New-Object Net.Http.HttpClient($handler);$client.Timeout=[TimeSpan]::FromSeconds(12)
 $request=$null;$response=$null
 try {
  $request=New-Object Net.Http.HttpRequestMessage([Net.Http.HttpMethod]::Post,'https://mg-fitclub-api.cupiditasa.workers.dev/api/mg-bridge/agent/sync')
  $request.Headers.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$Secret)
  $request.Content=New-Object Net.Http.StringContent((@{events=@($Events);deviceStatus=$DeviceStatus}|ConvertTo-Json -Depth 9 -Compress),[Text.Encoding]::UTF8,'application/json')
  $response=$client.SendAsync($request).GetAwaiter().GetResult()
  if(-not $response.IsSuccessStatusCode){throw ('server_http_'+[int]$response.StatusCode)}
  $text=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult();if($text.Length -gt 2000000){throw 'snapshot_too_large'}
  $data=$text|ConvertFrom-Json
  if(-not $data.snapshot -or $data.snapshot.mode -ne 'operator_review'){throw 'invalid_snapshot'}
  return $data
 } finally {if($response){$response.Dispose()};if($request){$request.Dispose()};$client.Dispose();$handler.Dispose()}
}
function Get-MgOfflineDecision($Snapshot,$Event,$LocalEvents,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow) {
 if(-not $Snapshot -or $Now -gt [DateTimeOffset]::Parse($Snapshot.cacheExpiresAt) -or $Now -lt [DateTimeOffset]::Parse($Snapshot.serverTime).AddMinutes(-1)){return 'cache_stale'}
 $m=@($Snapshot.members|Where-Object {$_.member_id -ceq $Event.memberId})
 if($m.Count -ne 1){return 'unregistered'}
 if(-not $m[0].active){return 'blocked'}
 if($m[0].role -ne 'athlete'){return 'staff_pending_review'}
 if(-not $m[0].trial_id){return 'no_plan'}
 $at=[DateTimeOffset]::Parse($Event.wallTime+'+03:30')
 if($at -lt [DateTimeOffset]::Parse($m[0].starts_at) -or $at -ge [DateTimeOffset]::Parse($m[0].expires_at)){return 'expired'}
 $day=$Event.wallTime.Substring(0,10)
 $known=@($Snapshot.days|Where-Object {$_.user_id -eq $m[0].user_id}|ForEach-Object {$_.business_day})
 if($known -contains $day){return 'same_day'}
 $pending=@($LocalEvents|Where-Object {$_.memberId -ceq $Event.memberId -and $_.clientId -ne $Event.clientId -and $_.wallTime -lt $Event.wallTime -and $_.wallTime -ge ([DateTimeOffset]::Parse($m[0].starts_at).ToOffset([TimeSpan]::FromMinutes(210)).ToString('yyyy-MM-ddTHH:mm:ss'))}|ForEach-Object {$_.wallTime.Substring(0,10)}|Where-Object {$known -notcontains $_}|Sort-Object -Unique)
 if($pending -contains $day){return 'same_day_pending'}
 if(($m[0].sessions-$m[0].used-$pending.Count) -le 0){return 'exhausted_estimate'}
 return 'pending_review'
}
function Read-MgDevice($Sdk,$Config,[string]$Root) {
 $connected=$false;$events=@();$status='starting'
 try {
  $connected=[bool]$Sdk.Connect_Net($Config.address,4370);if(-not $connected){return @{status='connection_failed';events=@()}}
  [string]$serial='';if(-not $Sdk.GetSerialNumber(1,[ref]$serial) -or $serial.Trim() -cne $Config.serial){return @{status='serial_mismatch';events=@()}}
  if(-not $Sdk.ReadGeneralLogData(1)){return @{status='read_failed';events=@()}}
  $status='connected';$count=0
  while($count -lt 100000){
   [string]$member='';[int]$v=0;[int]$p=0;[int]$y=0;[int]$mo=0;[int]$d=0;[int]$h=0;[int]$mi=0;[int]$s=0;[int]$w=0
   if(-not $Sdk.SSR_GetGeneralLogData(1,[ref]$member,[ref]$v,[ref]$p,[ref]$y,[ref]$mo,[ref]$d,[ref]$h,[ref]$mi,[ref]$s,[ref]$w)){break};$count++
   try {$wall=(New-Object DateTime($y,$mo,$d,$h,$mi,$s)).ToString('yyyy-MM-ddTHH:mm:ss');$at=[DateTimeOffset]::Parse($wall+'+03:30')}catch{$status='capture_partial';continue}
   if($at -lt [DateTimeOffset]::Parse($Config.captureSince)){continue}
   if($member -notmatch '^[A-Za-z0-9_-]{1,80}$'){$status='capture_partial';continue}
   $id=Get-MgDigest (@($Config.serial,$member,$wall,$v,$p,$w)|ConvertTo-Json -Compress)
   $event=@{clientId=$id;memberId=$member;wallTime=$wall;verify=$v;punch=$p;work=$w}
   $file=Join-Path $Root ('events\'+$id+'.mgp');if(-not [IO.File]::Exists($file)){Save-PilotPrivate $file $event}
  }
  if($count -ge 100000){$status='capture_partial'}
  return @{status=$status;events=$events}
 } finally {if($connected){$null=$Sdk.Disconnect()}}
}
Export-ModuleMember -Function Get-MgDigest,New-MgSecret,Get-MgPairCode,Invoke-MgSync,Get-MgOfflineDecision,Read-MgDevice,Save-PilotPrivate,Read-PilotPrivate

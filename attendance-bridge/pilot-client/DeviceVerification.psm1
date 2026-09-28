Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Pilot.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Shadow.psm1') -Force
function Invoke-DeviceVerificationApi {
 param([string]$Path,[string]$Token,$Body=$null)
 if ($Token -notmatch '^[a-f0-9]{64}$' -or $Path -notmatch '^(config|pending|device_[A-Za-z0-9_-]+/(claim|complete))$') {throw 'invalid_device_request'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $handler=New-Object Net.Http.HttpClientHandler;$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false
 $client=New-Object Net.Http.HttpClient($handler);$client.Timeout=[TimeSpan]::FromSeconds(15)
 $request=$null;$response=$null
 try {
  $method=if ($null -eq $Body) {[Net.Http.HttpMethod]::Get} else {[Net.Http.HttpMethod]::Post}
  $request=New-Object Net.Http.HttpRequestMessage($method,('https://mg-fitclub-api.cupiditasa.workers.dev/api/device-verification/bridge/'+$Path))
  $request.Headers.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$Token)
  if ($null -ne $Body) {$request.Content=New-Object Net.Http.StringContent(($Body|ConvertTo-Json -Depth 8 -Compress),[Text.Encoding]::UTF8,'application/json')}
  $response=$client.SendAsync($request).GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {throw ('device_server_http_'+[int]$response.StatusCode)}
  $text=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult();if ($text.Length -gt 160000) {throw 'response_too_large'}
  return ($text|ConvertFrom-Json)
 } finally {if ($null -ne $response) {$response.Dispose()};if ($null -ne $request) {$request.Dispose()};$client.Dispose();$handler.Dispose()}
}
function Assert-DeviceConfig($Config) {
 if ($Config.bridgeId -notmatch '^bridge_[A-Za-z0-9_-]+$' -or $Config.deviceSerial -notmatch '^[A-Za-z0-9_-]{1,80}$' -or $Config.clubId -notmatch '^[A-Za-z0-9_-]{1,80}$') {throw 'invalid_device_config'}
}
function Get-DeviceIdentityEvidence {
 param($Sdk,[string]$Root,$Config,$Claim,[string]$MemberId)
 Assert-DeviceConfig $Config
 if ($MemberId -notmatch '^[A-Za-z0-9_-]{1,80}$' -or $Claim.deviceSerial -cne $Config.deviceSerial -or $Claim.requestId -notmatch '^device_[A-Za-z0-9_-]+$' -or $Claim.challenge -notmatch '^[a-f0-9]{64}$') {throw 'invalid_device_claim'}
 $start=[DateTimeOffset]::Parse($Claim.startedAt);$end=[DateTimeOffset]::Parse($Claim.expiresAt)
 if ($start -gt [DateTimeOffset]::UtcNow.AddMinutes(1) -or $end -le [DateTimeOffset]::UtcNow -or ($end-$start).TotalMinutes -gt 16) {throw 'claim_expired_or_bad_clock'}
 $directory=Join-Path $Root 'identity-events'
 $r=Receive-ShadowBatch -Sdk $Sdk -Directory $directory -ExpectedSerial $Config.deviceSerial -OnlyMemberId $MemberId -Address '192.168.1.201' -MaxRecords 100000
 if ($r.status -ne 'captured_pending_review') {throw 'device_read_not_successful'}
 $found=@(Get-ShadowCandidates -Directory $directory -Serial $Config.deviceSerial -MemberId $MemberId | Where-Object {
  if (-not $_.deviceWallTime) {return $false}
  $when=[DateTimeOffset]::ParseExact(($_.deviceWallTime+'+03:30'),"yyyy-MM-dd'T'HH:mm:sszzz",[Globalization.CultureInfo]::InvariantCulture)
  return ($when -ge $start -and $when -le $end -and $when -le [DateTimeOffset]::UtcNow.AddMinutes(1))
 } | Sort-Object deviceWallTime -Descending)
 if ($found.Count -eq 0) {throw 'fresh_device_observation_required'}
 $e=$found[0]
 [pscustomobject]@{challenge=$Claim.challenge;deviceSerial=$Config.deviceSerial;memberId=$MemberId;deviceWallTime=$e.deviceWallTime;verificationCode=$e.raw.verificationCode;punchCode=$e.raw.punchCode;workCode=$e.raw.workCode;identityConfirmed=$false;observedBiometric=$false}
}
Export-ModuleMember -Function Invoke-DeviceVerificationApi,Assert-DeviceConfig,Get-DeviceIdentityEvidence

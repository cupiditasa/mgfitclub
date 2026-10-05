Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Net.Http
$script:Origin='https://mg-fitclub-api.cupiditasa.workers.dev'
$script:Entropy=[Text.Encoding]::UTF8.GetBytes('MG.pilot-client.v1')
function Save-PilotPrivate {
    param([string]$Path,$Value,[switch]$Replace)
    if ([IO.File]::Exists($Path) -and ([IO.File]::GetAttributes($Path) -band [IO.FileAttributes]::ReparsePoint)) {throw 'Linked file forbidden.'}
    $directory=[IO.Path]::GetDirectoryName($Path);[void][IO.Directory]::CreateDirectory($directory)
    $temp=Join-Path $directory ([Guid]::NewGuid().ToString('N')+'.tmp')
    $bytes=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 14 -Compress)),$script:Entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $file=New-Object IO.FileStream($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$file.Write($bytes,0,$bytes.Length);$file.Flush($true)} finally {$file.Dispose()}
    if ([IO.File]::Exists($Path)) {
        if (-not $Replace) {throw 'File already exists.'}
        [IO.File]::Replace($temp,$Path,[NullString]::Value)
    } else {[IO.File]::Move($temp,$Path)}
}
function Read-PilotPrivate([string]$Path) {
    if ([IO.File]::GetAttributes($Path) -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked file forbidden.'}
    $bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path),$script:Entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json
}
function Invoke-PilotApi {
    param([ValidateSet('config','consume','observe')][string]$Endpoint,[string]$Token,$Body=$null)
    if ($Token -notmatch '^[a-f0-9]{64}$') {throw 'invalid_bridge_token'}
    # Exact fixed HTTPS host; never follow redirects or send token to another server.
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    $handler=New-Object Net.Http.HttpClientHandler; $handler.AllowAutoRedirect=$false; $handler.UseCookies=$false
    $client=New-Object Net.Http.HttpClient($handler);$client.Timeout=[TimeSpan]::FromSeconds(15)
    $request=$null;$response=$null
    try {
        $method=if ($Endpoint -ne 'config') {[Net.Http.HttpMethod]::Post} else {[Net.Http.HttpMethod]::Get}
        $request=New-Object Net.Http.HttpRequestMessage($method,($script:Origin+'/api/attendance-pilot/bridge/'+$Endpoint))
        $request.Headers.Authorization=New-Object Net.Http.Headers.AuthenticationHeaderValue('Bearer',$Token)
        if ($null -ne $Body) {$request.Content=New-Object Net.Http.StringContent(($Body|ConvertTo-Json -Depth 8 -Compress),[Text.Encoding]::UTF8,'application/json')}
        $response=$client.SendAsync($request).GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {throw ('server_http_'+[int]$response.StatusCode)}
        $text=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ($text.Length -gt 65536) {throw 'response_too_large'}
        return ($text|ConvertFrom-Json)
    } finally {
        if ($null -ne $response) {$response.Dispose()};if ($null -ne $request) {$request.Dispose()};$client.Dispose();$handler.Dispose()
    }
}
function Assert-PilotConfig($Config) {
    if ($Config.trial.isTrial -ne $true -or $Config.trial.totalSessions -ne 30 -or $Config.trial.confirmationMode -ne 'operator' -or $Config.deviceSerial -notmatch '^[A-Za-z0-9_-]{3,80}$' -or $Config.deviceMemberId -notmatch '^[A-Za-z0-9_-]{1,40}$' -or $Config.trial.id -notmatch '^trial_[A-Za-z0-9_-]+$') {throw 'invalid_trial_config'}
}
function ConvertTo-PilotRequest {
    param($Event,$Config)
    Assert-PilotConfig $Config
    if ($Event.raw.deviceSerial -cne $Config.deviceSerial -or $Event.raw.deviceMemberId -cne $Config.deviceMemberId -or $Event.billingEnabled -ne $false -or -not $Event.deviceWallTime) {throw 'wrong_or_invalid_event'}
    $wall=[DateTimeOffset]::ParseExact(($Event.deviceWallTime+'+03:30'),"yyyy-MM-dd'T'HH:mm:sszzz",[Globalization.CultureInfo]::InvariantCulture)
    if ($wall -lt [DateTimeOffset]::Parse($Config.trial.startsAt) -or $wall -ge [DateTimeOffset]::Parse($Config.trial.expiresAt) -or $wall -gt [DateTimeOffset]::UtcNow.AddMinutes(5)) {throw 'event_outside_trial_or_future'}
    [pscustomobject]@{confirmedAdmission=$true;deviceSerial=$Config.deviceSerial;deviceMemberId=$Config.deviceMemberId;deviceWallTime=$Event.deviceWallTime;verificationCode=$Event.raw.verificationCode;punchCode=$Event.raw.punchCode;workCode=$Event.raw.workCode}
}
function Add-PilotConfirmation {
    param([string]$Root,$Event,$Config)
    $body=ConvertTo-PilotRequest $Event $Config
    if ($Event.id -notmatch '^[a-f0-9]{64}$') {throw 'invalid_event_id'}
    $path=Join-Path $Root ('outbox\'+$Config.trial.id+'-'+$Event.id+'.mgp')
    if ([IO.File]::Exists($path)) {return 'already_queued'}
    Save-PilotPrivate $path @{trialId=$Config.trial.id;eventId=$Event.id;body=$body;confirmedLocallyAt=[DateTime]::UtcNow.ToString('o')}
    return 'queued'
}
function Sync-PilotConfirmations {
    param([string]$Root,$Config,[string]$Token,[scriptblock]$Transport={param($endpoint,$token,$body) Invoke-PilotApi $endpoint $token $body})
    Assert-PilotConfig $Config
    $out=Join-Path $Root 'outbox';[void][IO.Directory]::CreateDirectory($out)
    $receiptDir=Join-Path $Root 'receipts';[void][IO.Directory]::CreateDirectory($receiptDir)
    $accepted=0;$pending=0;$lastTrial=$null
    foreach ($path in [IO.Directory]::EnumerateFiles($out,'*.mgp')) {
        $name=[IO.Path]::GetFileName($path);$receipt=Join-Path $receiptDir $name
        $item=Read-PilotPrivate $path
        if ($item.trialId -cne $Config.trial.id) {continue}
        if ($item.body.deviceSerial -cne $Config.deviceSerial -or $item.body.deviceMemberId -cne $Config.deviceMemberId -or $item.body.confirmedAdmission -ne $true) {throw 'invalid_outbox_binding'}
        if ([IO.File]::Exists($receipt)) {
            $saved=Read-PilotPrivate $receipt
            if ($saved.trial.id -cne $item.trialId -or $saved.ok -ne $true) {throw 'invalid_receipt'}
            continue
        }
        $pending++
        $response=& $Transport 'consume' $Token $item.body
        if ($response.ok -ne $true -or $response.trial.id -cne $Config.trial.id -or -not $response.receiptId -or $response.trial.remainingSessions -lt 0 -or $response.trial.remainingSessions -gt 30) {throw 'invalid_server_receipt'}
        Save-PilotPrivate $receipt $response
        $accepted++;$pending--;$lastTrial=$response.trial
    }
    [pscustomobject]@{accepted=$accepted;pendingSeen=$pending;lastTrial=$lastTrial}
}
function Send-PilotObservation {
    param($Event,$Config,[string]$Token,[scriptblock]$Transport={param($endpoint,$token,$body) Invoke-PilotApi $endpoint $token $body})
    $body=ConvertTo-PilotRequest $Event $Config
    $body.confirmedAdmission=$false
    $result=& $Transport 'observe' $Token $body
    if ($result.ok -ne $true -or $result.trialId -cne $Config.trial.id -or -not $result.observationId -or $result.charged -ne $false) {throw 'invalid_observation_ack'}
    return $result
}
Export-ModuleMember -Function Save-PilotPrivate,Read-PilotPrivate,Invoke-PilotApi,Assert-PilotConfig,ConvertTo-PilotRequest,Add-PilotConfirmation,Sync-PilotConfirmations,Send-PilotObservation

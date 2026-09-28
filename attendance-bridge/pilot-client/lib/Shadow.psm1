Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$script:Entropy=[Text.Encoding]::UTF8.GetBytes('MG.shadow.v1')
function Get-ShadowHash([string]$Value) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try {([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
}
function Open-ShadowStore([string]$Directory) {
    if ($Directory -notmatch '^[A-Za-z]:\\' -or $Directory.Substring(2).Contains(':')) {throw 'Local absolute storage required.'}
    $full=[IO.Path]::GetFullPath($Directory); $root=[IO.Path]::GetPathRoot($full)
    if ($full.TrimEnd('\') -eq $root.TrimEnd('\') -or (New-Object IO.DriveInfo($root)).DriveType -ne 'Fixed') {throw 'Local folder required.'}
    $walk=$root
    foreach ($part in $full.Substring($root.Length).Split('\',[StringSplitOptions]::RemoveEmptyEntries)) {
        $walk=Join-Path $walk $part
        if ([IO.Directory]::Exists($walk) -and ([IO.File]::GetAttributes($walk) -band [IO.FileAttributes]::ReparsePoint)) {throw 'Linked storage forbidden.'}
    }
    [void][IO.Directory]::CreateDirectory($full)
    $lockPath=Join-Path $full 'store.lock'
    if ([IO.File]::Exists($lockPath) -and ([IO.File]::GetAttributes($lockPath) -band [IO.FileAttributes]::ReparsePoint)) {throw 'Linked lock forbidden.'}
    $lock=New-Object IO.FileStream($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    [pscustomobject]@{directory=$full;handle=$lock}
}
function Read-ShadowFile([string]$Path) {
    if ([IO.File]::GetAttributes($Path) -band [IO.FileAttributes]::ReparsePoint) {throw 'Linked event forbidden.'}
    $plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path),$script:Entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
}
function Write-ShadowFile([string]$Path,$Data) {
    $plain=[Text.Encoding]::UTF8.GetBytes(($Data | ConvertTo-Json -Depth 10 -Compress))
    $cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$script:Entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $temp=Join-Path ([IO.Path]::GetDirectoryName($Path)) ([Guid]::NewGuid().ToString('N')+'.tmp')
    $stream=New-Object IO.FileStream($temp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$stream.Write($cipher,0,$cipher.Length); $stream.Flush($true)} finally {$stream.Dispose()}
    [IO.File]::Move($temp,$Path)
}
function ConvertTo-ShadowEvent {
    param([string]$Serial,[string]$MemberId,[int[]]$Parts,[int]$Verify,[int]$Punch,[int]$Work)
    if ([string]::IsNullOrWhiteSpace($Serial) -or $Serial.Length -gt 80 -or [string]::IsNullOrWhiteSpace($MemberId) -or $MemberId.Length -gt 80 -or $Parts.Count -ne 6) {throw 'Invalid identity or clock parts.'}
    $raw=[ordered]@{deviceSerial=$Serial;deviceMemberId=$MemberId;clockParts=@($Parts);verificationCode=$Verify;punchCode=$Punch;workCode=$Work}
    $canonical=$raw | ConvertTo-Json -Depth 5 -Compress
    $stamp=$null; $review='member_and_punch_mapping_required'
    try {$stamp=(New-Object DateTime($Parts[0],$Parts[1],$Parts[2],$Parts[3],$Parts[4],$Parts[5])).ToString('yyyy-MM-ddTHH:mm:ss')} catch {$review='invalid_device_time'}
    [pscustomobject]@{version=1;id=(Get-ShadowHash $canonical);raw=$raw;deviceWallTime=$stamp;utcTime=$null;review=$review;billingEnabled=$false;sourceIdentity='fingerprint_not_device_event_id'}
}
function Add-ShadowEvent {
    param([string]$Directory,$Event)
    # Rebuild from raw fields, rejecting supplied identity or forged business flags.
    $verified=ConvertTo-ShadowEvent -Serial $Event.raw.deviceSerial -MemberId $Event.raw.deviceMemberId -Parts $Event.raw.clockParts -Verify $Event.raw.verificationCode -Punch $Event.raw.punchCode -Work $Event.raw.workCode
    if ($Event.id -cne $verified.id -or $Event.billingEnabled -ne $false) {throw 'Invalid event.'}
    $store=Open-ShadowStore $Directory
    try {
        $path=Join-Path $store.directory ($verified.id+'.mgenc')
        if ([IO.File]::Exists($path)) {
            $old=Read-ShadowFile $path
            $check=ConvertTo-ShadowEvent -Serial $old.raw.deviceSerial -MemberId $old.raw.deviceMemberId -Parts $old.raw.clockParts -Verify $old.raw.verificationCode -Punch $old.raw.punchCode -Work $old.raw.workCode
            if ($old.id -cne $verified.id -or $check.id -cne $old.id -or $old.billingEnabled -ne $false) {throw 'Existing event damaged.'}
            return 'duplicate'
        }
        Write-ShadowFile $path $verified
        return 'stored'
    } finally {$store.handle.Dispose()}
}
function Get-ShadowSummary {
    param([string]$Directory,[ValidateRange(1,100000)][int]$MaxFiles=20000)
    $store=Open-ShadowStore $Directory
    try {
        $count=0; $invalid=0; $limited=$false
        foreach ($path in [IO.Directory]::EnumerateFiles($store.directory,'*.mgenc')) {
            if ($count -ge $MaxFiles) {$limited=$true;break}
            $event=Read-ShadowFile $path
            $checked=ConvertTo-ShadowEvent -Serial $event.raw.deviceSerial -MemberId $event.raw.deviceMemberId -Parts $event.raw.clockParts -Verify $event.raw.verificationCode -Punch $event.raw.punchCode -Work $event.raw.workCode
            if ($event.id -cne $checked.id -or [IO.Path]::GetFileName($path) -cne ($event.id+'.mgenc') -or $event.billingEnabled -ne $false) {throw 'Invalid stored event.'}
            $count++; if ($checked.review -eq 'invalid_device_time') {$invalid++}
        }
        [pscustomobject]@{inspectedEvents=$count;invalidTimeEvents=$invalid;limited=$limited;billingEnabled=$false;uploaded=$false;productionReady=$false}
    } finally {$store.handle.Dispose()}
}
function Receive-ShadowBatch {
    param([Parameter(Mandatory)]$Sdk,[Parameter(Mandatory)][string]$Directory,[Parameter(Mandatory)][string]$ExpectedSerial,[string]$Address='192.168.1.201',[ValidateRange(1,100000)][int]$MaxRecords=10000,[string]$OnlyMemberId='')
    if ([string]::IsNullOrWhiteSpace($ExpectedSerial)) {throw 'Expected device serial required.'}
    $ip=$null
    if (-not [Net.IPAddress]::TryParse($Address,[ref]$ip) -or $ip.AddressFamily -ne 'InterNetwork') {throw 'Private IPv4 required.'}
    $b=$ip.GetAddressBytes()
    if (-not ($b[0] -eq 10 -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or ($b[0] -eq 192 -and $b[1] -eq 168))) {throw 'Private IPv4 required.'}
    # Validate store and current user's decryption before touching device.
    $null=Get-ShadowSummary $Directory
    $result=[ordered]@{status='not_connected';scanned=0;stored=0;duplicates=0;rejected=0;filtered=0;limitReached=$false;historyComplete=$false;billingEnabled=$false;uploaded=$false;sdkError=$null;errors=@()}
    $connected=$false
    try {
        $connected=[bool]$Sdk.Connect_Net($Address,4370)
        if (-not $connected) {$result.status='connection_failed'; return [pscustomobject]$result}
        [string]$serial=''
        if (-not $Sdk.GetSerialNumber(1,[ref]$serial) -or $serial.Trim() -cne $ExpectedSerial.Trim()) {$result.status='serial_mismatch_or_unavailable';return [pscustomobject]$result}
        if (-not $Sdk.ReadGeneralLogData(1)) {
            [int]$code=0; $null=$Sdk.GetLastError([ref]$code)
            $result.status='read_failed_or_empty'; $result.sdkError=$code; return [pscustomobject]$result
        }
        while ($result.scanned -lt $MaxRecords) {
            [string]$member='';[int]$v=0;[int]$p=0;[int]$y=0;[int]$mo=0;[int]$d=0;[int]$h=0;[int]$mi=0;[int]$s=0;[int]$w=0
            if (-not $Sdk.SSR_GetGeneralLogData(1,[ref]$member,[ref]$v,[ref]$p,[ref]$y,[ref]$mo,[ref]$d,[ref]$h,[ref]$mi,[ref]$s,[ref]$w)) {break}
            $result.scanned++
            if ($OnlyMemberId -and $member -cne $OnlyMemberId) {$result.filtered++;continue}
            try {$event=ConvertTo-ShadowEvent -Serial $serial.Trim() -MemberId $member -Parts @($y,$mo,$d,$h,$mi,$s) -Verify $v -Punch $p -Work $w}
            catch {$result.rejected++;continue}
            $status=Add-ShadowEvent $Directory $event
            if ($status -eq 'stored') {$result.stored++} else {$result.duplicates++}
        }
        $result.limitReached=($result.scanned -ge $MaxRecords)
        $result.status='captured_pending_review'
    } catch {
        $result.status='capture_failed_partial_possible'
        $result.errors=@(@{type=$_.Exception.GetType().FullName;hresult=('0x'+$_.Exception.HResult.ToString('X8'))})
    } finally {
        if ($connected) {try {$null=$Sdk.Disconnect()} catch {$result.status='disconnect_failed'; $result.errors+=@{type=$_.Exception.GetType().FullName}}}
    }
    [pscustomobject]$result
}
function Get-ShadowCandidates {
    param([string]$Directory,[string]$Serial,[string]$MemberId,[ValidateRange(1,100000)][int]$MaxFiles=20000)
    $store=Open-ShadowStore $Directory
    try {
        $count=0
        foreach ($path in [IO.Directory]::EnumerateFiles($store.directory,'*.mgenc')) {
            if (++$count -gt $MaxFiles) {throw 'Candidate scan limit exceeded; do not assume list complete.'}
            $event=Read-ShadowFile $path
            $checked=ConvertTo-ShadowEvent -Serial $event.raw.deviceSerial -MemberId $event.raw.deviceMemberId -Parts $event.raw.clockParts -Verify $event.raw.verificationCode -Punch $event.raw.punchCode -Work $event.raw.workCode
            if ($checked.id -cne $event.id -or [IO.Path]::GetFileName($path) -cne ($event.id+'.mgenc') -or $event.billingEnabled -ne $false) {throw 'Invalid stored event.'}
            if ($event.raw.deviceSerial -ceq $Serial -and $event.raw.deviceMemberId -ceq $MemberId) {$checked}
        }
    } finally {$store.handle.Dispose()}
}
Export-ModuleMember -Function ConvertTo-ShadowEvent,Add-ShadowEvent,Get-ShadowSummary,Receive-ShadowBatch,Get-ShadowCandidates

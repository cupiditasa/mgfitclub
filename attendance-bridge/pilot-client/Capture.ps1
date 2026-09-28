param([string]$Root,[string]$Output)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Pilot.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Shadow.psm1') -Force
$sdk=$null;$deviceLock=$null;$ownsLock=$false
try {
    if (-not [Environment]::Is64BitProcess) {throw '64bit_required'}
    $deviceLock=New-Object Threading.Mutex($false,'Local\MGFitClub-Pilot-DeviceRead')
    try {$ownsLock=$deviceLock.WaitOne(0)} catch [Threading.AbandonedMutexException] {$ownsLock=$true}
    if (-not $ownsLock) {throw 'another_pilot_capture_running'}
    $settings=Read-PilotPrivate (Join-Path $Root 'settings.mgp')
    Assert-PilotConfig $settings.config
    $sdk=New-Object -ComObject 'zkemkeeper.ZKEM.1'
    $result=Receive-ShadowBatch -Sdk $sdk -Directory (Join-Path $Root 'events') -ExpectedSerial $settings.config.deviceSerial -OnlyMemberId $settings.config.deviceMemberId -Address '192.168.1.201' -MaxRecords 100000
} catch {$result=@{status='capture_failed';errorType=$_.Exception.GetType().FullName;hresult=('0x'+$_.Exception.HResult.ToString('X8'))}}
finally {
 if ($null -ne $sdk -and [Runtime.InteropServices.Marshal]::IsComObject($sdk)) {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sdk)}
 if ($ownsLock) {$deviceLock.ReleaseMutex()};if ($null -ne $deviceLock) {$deviceLock.Dispose()}
}
[IO.File]::WriteAllText($Output,($result|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))

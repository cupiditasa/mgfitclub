param([string]$Root,[string]$Output)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Pilot.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'DeviceVerification.psm1') -Force
$sdk=$null;$mutex=$null;$owned=$false
try {
 if (-not [Environment]::Is64BitProcess) {throw '64bit_required'}
 $mutex=New-Object Threading.Mutex($false,'Local\MGFitClub-Pilot-DeviceRead')
 try {$owned=$mutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$owned=$true}
 if (-not $owned) {throw 'device_busy'}
 $job=Read-PilotPrivate (Join-Path $Root 'identity-job.mgp')
 $sdk=New-Object -ComObject 'zkemkeeper.ZKEM.1'
 $body=Get-DeviceIdentityEvidence -Sdk $sdk -Root $Root -Config $job.config -Claim $job.claim -MemberId $job.memberId
 Save-PilotPrivate $Output @{ok=$true;body=$body}
} catch {
 Save-PilotPrivate $Output @{ok=$false;errorType=$_.Exception.GetType().Name;code='identity_read_failed_check_clock_member_and_connection'}
} finally {
 if ($null -ne $sdk -and [Runtime.InteropServices.Marshal]::IsComObject($sdk)) {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sdk)}
 if ($owned) {$mutex.ReleaseMutex()};if ($null -ne $mutex) {$mutex.Dispose()}
}

param([Parameter(Mandatory)][string]$Root)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Bridge.psm1') -Force
$sdk=$null;$owned=$false;$mutex=New-Object Threading.Mutex($false,'Local\MGFitClub-Pilot-DeviceRead')
$state=@{updatedAt=[DateTime]::UtcNow.ToString('o');network='offline';device='starting';recent=@();pending=0;error=''}
try {
 $secret=Read-PilotPrivate (Join-Path $Root 'secret.mgp');$config=$null;$cache=Join-Path $Root 'snapshot.mgp'
 if(Test-Path -LiteralPath $cache){$config=Read-PilotPrivate $cache}
 try {$r=Invoke-MgSync $secret @() 'starting';$config=$r.snapshot;Save-PilotPrivate $cache $config -Replace;$state.network='online'}catch{$state.error=$_.Exception.Message}
 if($config){
  try {$owned=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$owned=$true}
  try {
   if(-not $owned){$state.device='device_busy'}else{
    try {$sdk=New-Object -ComObject 'zkemkeeper.ZKEM.1'}catch{$state.device='sdk_missing'}
    if($sdk){$capture=Read-MgDevice $sdk $config $Root;$state.device=$capture.status}
   }
  }catch{$state.device='capture_partial';$state.error='device_read_failed'}finally{if($owned){$mutex.ReleaseMutex();$owned=$false}}
  $events=@(Get-ChildItem -LiteralPath (Join-Path $Root 'events') -Filter '*.mgp' -ErrorAction SilentlyContinue|ForEach-Object {Read-PilotPrivate $_.FullName})
  $pending=@($events|Where-Object {-not (Test-Path -LiteralPath (Join-Path $Root ('receipts\'+$_.clientId+'.mgp')))})
  $batch=@($pending|Sort-Object wallTime|Select-Object -First 100)
  try {
   $r=Invoke-MgSync $secret $batch $state.device
   foreach($receipt in $r.receipts){if($receipt.clientId -notmatch '^[a-f0-9]{64}$' -or -not ($batch.clientId -contains $receipt.clientId)){throw 'invalid_receipt'};Save-PilotPrivate (Join-Path $Root ('receipts\'+$receipt.clientId+'.mgp')) $receipt -Replace}
   $config=$r.snapshot;Save-PilotPrivate $cache $config -Replace;$state.network='online';$state.error=''
  }catch{$state.network='offline';$state.error=$_.Exception.Message}
  $state.pending=@($events|Where-Object {-not (Test-Path -LiteralPath (Join-Path $Root ('receipts\'+$_.clientId+'.mgp')))}).Count
  $state.recent=@($events|Sort-Object wallTime -Descending|Select-Object -First 12|ForEach-Object {
   $decision=Get-MgOfflineDecision $config $_ $events
   $receiptPath=Join-Path $Root ('receipts\'+$_.clientId+'.mgp')
   if(Test-Path -LiteralPath $receiptPath){$receipt=Read-PilotPrivate $receiptPath;if($receipt.status -eq 'rejected'){$decision='rejected_clock'}}
   @{memberId=$_.memberId;wallTime=$_.wallTime;decision=$decision}
  })
 }
}catch{$state.error=$_.Exception.Message}finally{
 if($sdk -and [Runtime.InteropServices.Marshal]::IsComObject($sdk)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sdk)}
 if($owned){$mutex.ReleaseMutex()};$mutex.Dispose()
 $state.updatedAt=[DateTime]::UtcNow.ToString('o');Save-PilotPrivate (Join-Path $Root 'status.mgp') $state -Replace
}

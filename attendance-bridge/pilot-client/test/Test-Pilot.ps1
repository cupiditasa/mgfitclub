$ErrorActionPreference='Stop'
$base=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $base 'Pilot.psm1') -Force
Import-Module (Join-Path $base 'lib\Shadow.psm1') -Force
$root=Join-Path (Split-Path (Split-Path $base -Parent) -Parent) ('.test\p'+[Guid]::NewGuid().ToString('N').Substring(0,7))
$script:n=0
function Assert($x,$message) {if(-not $x){throw $message}}
function Test($name,[scriptblock]$action) {& $action;$script:n++;Write-Output ('PASS '+$name)}
$config=[pscustomobject]@{deviceSerial='FAKE6602';deviceMemberId='007';trial=[pscustomobject]@{id='trial_test';startsAt=[DateTime]::UtcNow.AddDays(-1).ToString('o');expiresAt=[DateTime]::UtcNow.AddDays(29).ToString('o');isTrial=$true;totalSessions=30;remainingSessions=30;confirmationMode='operator'}}
$now=[DateTime]::UtcNow.AddHours(3.5).AddMinutes(-1)
$event=ConvertTo-ShadowEvent 'FAKE6602' '007' @($now.Year,$now.Month,$now.Day,$now.Hour,$now.Minute,$now.Second) 15 0 0
Test 'scripts parse, endpoint fixed, redirects forbidden' {
 foreach($file in @('Start.ps1','Pilot.psm1','Capture.ps1')) {
  $t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $base $file),[ref]$t,[ref]$e)
  Assert ($e.Count -eq 0) ('Syntax '+$file)
  Assert ($ast.Extent.Text -notmatch 'ServerCertificateValidationCallback|TrustServerCertificate|Stop-Service|regsvr32') 'No bypass or system mutation'
 }
 $source=[IO.File]::ReadAllText((Join-Path $base 'Pilot.psm1'))
 Assert ($source.Contains("`$handler.AllowAutoRedirect=`$false")) 'No redirected credentials'
}
Test 'private settings encrypted and replace roundtrip' {
 $path=Join-Path $root 'settings.mgp';Save-PilotPrivate $path @{token='SECRET_TEST_TOKEN';config=$config}
 Assert ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($path)) -notmatch 'SECRET_TEST_TOKEN') 'No plaintext token'
 Assert ((Read-PilotPrivate $path).token -eq 'SECRET_TEST_TOKEN') 'Roundtrip'
 Save-PilotPrivate $path @{token='UPDATED';config=$config} -Replace
 Assert ((Read-PilotPrivate $path).token -eq 'UPDATED') 'Atomic replacement'
}
Test 'wrong target and stale event never enter outbox' {
 $wrong=ConvertTo-ShadowEvent 'FAKE6602' '7' @($now.Year,$now.Month,$now.Day,$now.Hour,$now.Minute,$now.Second) 15 0 0
 $failed=$false;try{Add-PilotConfirmation $root $wrong $config|Out-Null}catch{$failed=$true};Assert $failed 'Preserve leading zeros'
 $old=ConvertTo-ShadowEvent 'FAKE6602' '007' @(2020,1,1,12,0,0) 15 0 0
 $failed=$false;try{Add-PilotConfirmation $root $old $config|Out-Null}catch{$failed=$true};Assert $failed 'Exclude historical record'
}
Test 'confirmation persisted once and offline retry does not remove it' {
 Assert ((Add-PilotConfirmation $root $event $config) -eq 'queued') 'Queued'
 Assert ((Add-PilotConfirmation $root $event $config) -eq 'already_queued') 'Local dedup'
 $failed=$false;try{Sync-PilotConfirmations $root $config ('a'*64) {throw 'offline'}|Out-Null}catch{$failed=$true};Assert $failed 'Offline surfaced'
 Assert (@(Get-ChildItem (Join-Path $root 'outbox') -Filter '*.mgp').Count -eq 1) 'Queue retained'
 Assert (@(Get-ChildItem (Join-Path $root 'receipts') -Filter '*.mgp').Count -eq 0) 'No false receipt'
}
Test 'server receipt is required and retry uses durable receipt' {
 $transport={param($endpoint,$token,$body) [pscustomobject]@{ok=$true;receiptId='receipt-test';trial=[pscustomobject]@{id='trial_test';remainingSessions=29}}}
 $result=Sync-PilotConfirmations $root $config ('a'*64) $transport
 Assert ($result.accepted -eq 1 -and $result.lastTrial.remainingSessions -eq 29) 'Receipt accepted'
 $result=Sync-PilotConfirmations $root $config ('a'*64) {throw 'must not retry acknowledged receipt'}
 Assert ($result.accepted -eq 0) 'No repeat send after acknowledgement'
 Assert (@(Get-ChildItem (Join-Path $root 'outbox') -Filter '*.mgp').Count -eq 1) 'Audit queue retained'
}
Test 'wrong-trial server receipt is rejected without acknowledgement' {
 $dir=Join-Path $root 'other';$null=Add-PilotConfirmation $dir $event $config
 $failed=$false
 try{Sync-PilotConfirmations $dir $config ('a'*64) { [pscustomobject]@{ok=$true;receiptId='wrong';trial=[pscustomobject]@{id='trial_other';remainingSessions=29}} }|Out-Null}catch{$failed=$true}
 Assert $failed 'Reject wrong trial'
 Assert (@(Get-ChildItem (Join-Path $dir 'receipts') -Filter '*.mgp').Count -eq 0) 'No receipt saved'
}
Test 'remote review submission is not a consumption or local confirmation' {
 $result=Send-PilotObservation $event $config ('a'*64) {
  param($endpoint,$token,$body)
  Assert ($endpoint -eq 'observe' -and $body.confirmedAdmission -eq $false) 'Raw only'
  [pscustomobject]@{ok=$true;trialId='trial_test';observationId='observation_test';charged=$false}
 }
 Assert ($result.charged -eq $false) 'No charge'
 $failed=$false;try {Send-PilotObservation $event $config ('a'*64) {throw 'offline'}|Out-Null}catch{$failed=$true};Assert $failed 'No fake remote success'
}
Test 'two launchers isolate settings while captures share one mutex' {
 $start=[IO.File]::ReadAllText((Join-Path $base 'Start.ps1'))
 Assert ($start.Contains("[ValidateSet('1','2')]")) 'Only two explicit slots'
 Assert ($start.Contains("'profile-2'")) 'Second independent store'
 $capture=[IO.File]::ReadAllText((Join-Path $base 'Capture.ps1'))
 Assert ($capture.Contains('MGFitClub-Pilot-DeviceRead') -and $capture.Contains('WaitOne(0)')) 'No concurrent pilot device reads'
}
Write-Output "$script:n client tests passed. Mock API; no device or network access."

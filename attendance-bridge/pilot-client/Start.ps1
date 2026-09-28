param([switch]$ValidateOnly,[ValidateSet('1','2')][string]$Profile='1')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Import-Module (Join-Path $PSScriptRoot 'Pilot.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'lib\Shadow.psm1') -Force
if ($ValidateOnly) {Write-Output 'Pilot UI dependencies loaded. No files, server or device accessed.';exit 0}
if (-not [Environment]::Is64BitProcess) {[void][Windows.Forms.MessageBox]::Show('این برنامه فقط در حالت ۶۴بیتی اجرا می‌شود.');exit 1}
# A persistent location independent of the downloaded version folder. Do not copy this directory to another Windows account.
$script:dataRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MGFitClub-Pilot'
if ($Profile -eq '2') {$script:dataRoot=Join-Path $script:dataRoot 'profile-2'}
[void][IO.Directory]::CreateDirectory($script:dataRoot)
$script:settingsPath=Join-Path $script:dataRoot 'settings.mgp'
$script:settings=$null;$script:events=@()
$instanceLock=$null
try {$instanceLock=New-Object IO.FileStream((Join-Path $script:dataRoot 'app.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
catch {[void][Windows.Forms.MessageBox]::Show('نسخهٔ دیگری از نرم‌افزار باز است یا پوشهٔ محلی قابل‌دسترسی نیست.');exit 1}
$form=New-Object Windows.Forms.Form
$form.Text='MG — پایلوت حضور ورزشکار';$form.Size=New-Object Drawing.Size(1000,740);$form.MinimumSize=New-Object Drawing.Size(940,700);$form.StartPosition='CenterScreen';$form.RightToLeft='Yes';$form.RightToLeftLayout=$true
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$form.BackColor=[Drawing.Color]::FromArgb(27,32,29);$form.ForeColor=[Drawing.Color]::White
$title=New-Object Windows.Forms.Label;$title.Text='MG | اشتراک آزمایشی — مصرف جلسه فقط با تأیید مسئول';$title.SetBounds(20,14,930,35);$form.Controls.Add($title)
$title.Text+=' | حساب تست '+$Profile
$balance=New-Object Windows.Forms.Label;$balance.SetBounds(20,52,930,48);$balance.Text='حسابی متصل نشده؛ کلید مخصوص همین اشتراک را پس از فعال‌سازی دریافت کنید.';$form.Controls.Add($balance)
$tokenBox=New-Object Windows.Forms.TextBox;$tokenBox.SetBounds(220,111,560,28);$tokenBox.UseSystemPasswordChar=$true;$tokenBox.RightToLeft='No';$form.Controls.Add($tokenBox)
function Button([string]$text,[int]$left,[int]$top,[int]$width=180) {
 $b=New-Object Windows.Forms.Button;$b.Text=$text;$b.SetBounds($left,$top,$width,36);$b.BackColor=[Drawing.Color]::FromArgb(170,222,70);$b.ForeColor=[Drawing.Color]::Black;$form.Controls.Add($b);return $b
}
$pair=Button 'اتصال کلید آزمایشی' 20 106
$identityButton=Button 'تأیید دستگاه تردد' 695 637 265
$identityButton.Anchor='Bottom,Left'
$identityButton.Add_Click({Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'Device-Verification.ps1')+'"')) -WindowStyle Hidden})
$refresh=Button 'به‌روزرسانی از سایت' 790 106 170
$notice=New-Object Windows.Forms.Label;$notice.Text='بدون پرداخت واقعی • هر روز حداکثر یک جلسه • آفلاین: فقط صف تأییدها؛ ماندهٔ قطعی از سرور';$notice.SetBounds(20,152,930,34);$form.Controls.Add($notice)
$capture=Button 'دریافت از دستگاه' 20 191 210
$reload=Button 'نمایش حضورهای محلی' 250 191 210
$confirm=Button 'تأیید ورود انتخاب‌شده' 480 191 235
$sync=Button 'ارسال تأییدهای صف' 735 191 225
$grid=New-Object Windows.Forms.DataGridView;$grid.SetBounds(20,240,940,315);$grid.Anchor='Top,Bottom,Left,Right';$grid.ReadOnly=$true;$grid.AllowUserToAddRows=$false;$grid.AllowUserToDeleteRows=$false;$grid.MultiSelect=$false;$grid.SelectionMode='FullRowSelect';$grid.AutoSizeColumnsMode='Fill';$grid.BackgroundColor=[Drawing.Color]::FromArgb(38,44,40);$grid.ForeColor=[Drawing.Color]::Black
foreach ($col in @(@('time','زمان ثبت دستگاه'),@('verify','کد شناسایی خام'),@('punch','کد تردد خام'),@('state','وضعیت آزمایش'))) {[void]$grid.Columns.Add($col[0],$col[1])}
$form.Controls.Add($grid)
$status=New-Object Windows.Forms.Label;$status.SetBounds(20,565,940,65);$status.Anchor='Bottom,Left,Right';$status.Text='هنوز عملیاتی انجام نشده. جیم پالس یا گواهی SQL توسط این برنامه تغییر نمی‌کند.';$form.Controls.Add($status)
$reportButton=Button 'ذخیرهٔ گزارش بدون کلید' 20 637 240;$reportButton.Anchor='Bottom,Left'
$sendReview=Button 'ارسال رکورد برای بررسی در سایت' 300 637 350;$sendReview.Anchor='Bottom,Left'
$sendReview.Add_Click({$sendReview.Enabled=$false;try {
 if ($null -eq $script:settings -or $grid.SelectedRows.Count -ne 1) {$status.Text='ابتدا حساب و یک حضور را انتخاب کنید.';return}
 $event=$grid.SelectedRows[0].Tag
 $ok=[Windows.Forms.MessageBox]::Show('این رکورد خام برای پشتیبان فنی و مدیر همان باشگاه ارسال شود؟ ارسال رکورد جلسه کم نمی‌کند؛ آن‌ها باید ورود واقعی را تأیید کنند.','ارسال برای بررسی',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question,[Windows.Forms.MessageBoxDefaultButton]::Button2)
 if ($ok -ne 'Yes') {return}
 $result=Send-PilotObservation $event $script:settings.config $script:settings.token
 $status.Text='رکورد به سایت رسید؛ وضعیت بررسی: '+$result.reviewStatus+'؛ این ارسال جلسه کم نکرد. مدیر یا پشتیبان تب تأیید حضور آزمایشی را باز کند.'
} catch {Explain-Error $_;$status.Text+=' رکورد محلی محفوظ است؛ پس از اتصال دوباره ارسال کنید.'} finally {$sendReview.Enabled=$true}})
function Paint-Balance {
 if ($null -eq $script:settings) {return}
 $t=$script:settings.config.trial
 $balance.Text='شناسهٔ عضو دستگاه: '+$script:settings.config.deviceMemberId+' | ماندهٔ آخرین پاسخ سایت: '+$t.remainingSessions+' از ۳۰'+"`r`n"+'اعتبار تا: '+$t.expiresAt+' | وضعیت: '+$t.status+' | آزمایشی و رایگان'
}
function Refresh-Pilot {
 if ($null -eq $script:settings) {throw 'setup_required'}
 $fresh=Invoke-PilotApi config $script:settings.token
 Assert-PilotConfig $fresh
 if ($fresh.trial.id -cne $script:settings.config.trial.id -or $fresh.deviceSerial -cne $script:settings.config.deviceSerial -or $fresh.deviceMemberId -cne $script:settings.config.deviceMemberId) {throw 'trial_binding_changed'}
 $script:settings.config=$fresh
 Save-PilotPrivate $script:settingsPath $script:settings -Replace
 Paint-Balance
}
function Load-LocalEvents {
 if ($null -eq $script:settings) {throw 'setup_required'}
 $c=$script:settings.config
 $items=@(Get-ShadowCandidates -Directory (Join-Path $script:dataRoot 'events') -Serial $c.deviceSerial -MemberId $c.deviceMemberId)
 $script:events=@($items | Where-Object {
   if (-not $_.deviceWallTime) {return $false}
   try {$when=[DateTimeOffset]::ParseExact(($_.deviceWallTime+'+03:30'),"yyyy-MM-dd'T'HH:mm:sszzz",[Globalization.CultureInfo]::InvariantCulture);return ($when -ge [DateTimeOffset]::Parse($c.trial.startsAt) -and $when -lt [DateTimeOffset]::Parse($c.trial.expiresAt))} catch {return $false}
 } | Sort-Object deviceWallTime -Descending | Select-Object -First 200)
 $grid.Rows.Clear()
 foreach ($e in $script:events) {
  $name=$c.trial.id+'-'+$e.id+'.mgp';$label='ثبت خام — هنوز تأیید نشده'
  if ([IO.File]::Exists((Join-Path $script:dataRoot ('outbox\'+$name)))) {$label='در صف تأیید؛ مانده قطعی نیست'}
  if ([IO.File]::Exists((Join-Path $script:dataRoot ('receipts\'+$name)))) {$label='رسید سرور ثبت شده'}
  $row=$grid.Rows.Add(@($e.deviceWallTime,[string]$e.raw.verificationCode,[string]$e.raw.punchCode,$label));$grid.Rows[$row].Tag=$e
 }
}
function Explain-Error($ErrorRecord) {
 $message=[string]$ErrorRecord.Exception.Message
 if ($message -match 'server_http_(\d+)') {
  $status.Text='پاسخ سایت: '+$Matches[1]+'؛ مانده را تغییر ندادیم و صف حذف نشده است. 503: سرویس فعال نیست؛ 401: کلید معتبر نیست؛ 403: اعتبار/دسترسی؛ 409: نیاز به بررسی.'
 } else {$status.Text='عملیات کامل نشد؛ صف تأییدها حفظ شده است. کد: '+$ErrorRecord.Exception.GetType().Name+'. گزارش را بفرستید؛ رمز یا کلید را نفرستید.'}
}
$pair.Add_Click({try {
 $key=$tokenBox.Text.Trim();$fresh=Invoke-PilotApi config $key;Assert-PilotConfig $fresh
 $choice=[Windows.Forms.MessageBox]::Show(('اتصال به عضو دستگاه '+$fresh.deviceMemberId+' با '+$fresh.trial.remainingSessions+' جلسهٔ آزمایشی؟ فقط اگر این همان حساب آزمایشی موردنظر است ادامه دهید.'),'MG',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question,[Windows.Forms.MessageBoxDefaultButton]::Button2)
 if ($choice -ne 'Yes') {return}
 $script:settings=[pscustomobject]@{token=$key;config=$fresh};Save-PilotPrivate $script:settingsPath $script:settings -Replace;$tokenBox.Clear();Paint-Balance;Load-LocalEvents;$status.Text='حساب متصل شد. کلید فقط رمز‌شده در همین حساب ویندوز ذخیره شده است.'
} catch {Explain-Error $_}})
$refresh.Add_Click({try {Refresh-Pilot;$status.Text='مانده از سرور دریافت شد. برای مشاهدهٔ مانده در سایت، صفحهٔ اشتراک آزمایشی را باز کنید.'} catch {Explain-Error $_}})
$reload.Add_Click({try {Load-LocalEvents;$status.Text='حداکثر ۲۰۰ حضور اخیر این عضو در دورهٔ آزمایش نمایش داده شد؛ کدها خام هستند.'} catch {Explain-Error $_}})
$capture.Add_Click({
 if ($null -eq $script:settings) {$status.Text='ابتدا کلید آزمایشی را متصل کنید.';return}
 $ok=[Windows.Forms.MessageBox]::Show('تست کنترل‌شده: جیم پالس را موقتاً ببندید؛ اتصال پس‌زمینه فعال نباشد. فقط ورزشکار آزمایشی یک بار روی دستگاه شناسایی شود، سپس دریافت را انجام دهید. فقط رکوردهای همین شناسه ذخیره می‌شوند. بعد از تست حسابداری را باز کنید. آماده‌اید؟','MG',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Question,[Windows.Forms.MessageBoxDefaultButton]::Button2)
 if ($ok -ne 'Yes') {return}
 $child=$null;$capture.Enabled=$false
 try {
  $out=Join-Path $script:dataRoot ('capture-'+[Guid]::NewGuid().ToString('N')+'.json')
  $child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'Capture.ps1')+'"'),'-Root',('"'+$script:dataRoot+'"'),'-Output',('"'+$out+'"')) -PassThru -WindowStyle Hidden
  if (-not $child.WaitForExit(60000)) {$child.Kill();$child.WaitForExit();throw 'capture_timeout'}
  if (-not [IO.File]::Exists($out)) {throw 'capture_report_missing'}
  $r=[IO.File]::ReadAllText($out)|ConvertFrom-Json
  Load-LocalEvents;$status.Text='نتیجهٔ دریافت: '+$r.status+'؛ تاریخچهٔ کامل تضمین نشده است. حسابداری را دوباره باز کنید. هنوز هیچ جلسه‌ای کم نشده است.'
 } catch {Explain-Error $_;$status.Text+=' حسابداری را دوباره باز کنید.'}
 finally {if ($null -ne $child) {$child.Dispose()};$capture.Enabled=$true}
})
$confirm.Add_Click({try {
 if ($grid.SelectedRows.Count -ne 1) {$status.Text='یک حضور را انتخاب کنید.';return}
 $event=$grid.SelectedRows[0].Tag
 $null=ConvertTo-PilotRequest $event $script:settings.config
 $ok=[Windows.Forms.MessageBox]::Show(('آیا شخصاً ورود همین ورزشکار را در زمان '+$event.deviceWallTime+' مشاهده و تأیید کرده‌اید؟ این دکمه درخواست کسر یک جلسهٔ آزمایشی را در صف می‌گذارد؛ صرف شناسایی دستگاه یا خروج را تأیید نکنید. هر روز حداکثر یک جلسه.'),'تأیید مصرف آزمایشی',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Warning,[Windows.Forms.MessageBoxDefaultButton]::Button2)
 if ($ok -ne 'Yes') {return}
 $null=Add-PilotConfirmation $script:dataRoot $event $script:settings.config;Load-LocalEvents;$status.Text='تأیید در صف محلی رمز‌شده ذخیره شد. برای ثبت قطعی در سایت، اینترنت و دکمهٔ «ارسال تأییدهای صف» لازم است.'
} catch {Explain-Error $_}})
$sync.Add_Click({$sync.Enabled=$false;try {
 Refresh-Pilot
 $r=Sync-PilotConfirmations $script:dataRoot $script:settings.config $script:settings.token
 Refresh-Pilot;Load-LocalEvents;$status.Text='همگام‌سازی انجام شد؛ '+$r.accepted+' رسید دریافت شد. پاسخ تکراری سرور، مصرف دوباره ایجاد نمی‌کند.'
} catch {Explain-Error $_} finally {$sync.Enabled=$true}})
$reportButton.Add_Click({try {
 $out=Join-Path $PSScriptRoot ('mg-pilot-status-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.json')
 $r=@{mode='operator_confirmed_pilot';createdUtc=[DateTime]::UtcNow.ToString('o');configured=($null -ne $script:settings);siteActivatedByThisApp=$false;lastServerTrial=$null;pendingFiles=0;receiptFiles=0}
 if ($null -ne $script:settings) {$r.lastServerTrial=$script:settings.config.trial}
 $d=Join-Path $script:dataRoot 'outbox'
 if ([IO.Directory]::Exists($d)) {foreach ($p in [IO.Directory]::EnumerateFiles($d,'*.mgp')) {if (-not [IO.File]::Exists((Join-Path $script:dataRoot ('receipts\'+[IO.Path]::GetFileName($p))))) {$r.pendingFiles++}}}
 $d=Join-Path $script:dataRoot 'receipts';if ([IO.Directory]::Exists($d)) {$r.receiptFiles=@([IO.Directory]::EnumerateFiles($d,'*.mgp')).Count}
 [IO.File]::WriteAllText($out,($r|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
 Start-Process -FilePath 'explorer.exe' -ArgumentList ('/select,"'+$out+'"')
} catch {Explain-Error $_}})
try {
 if ([IO.File]::Exists($script:settingsPath)) {try {$script:settings=Read-PilotPrivate $script:settingsPath;Assert-PilotConfig $script:settings.config;Paint-Balance;Load-LocalEvents} catch {$script:settings=$null;$status.Text='تنظیمات قبلی قابل‌خواندن نیست. فایل‌های داده را حذف نکنید؛ برای بررسی اطلاع دهید.'}}
 [void]$form.ShowDialog()
} finally {$form.Dispose();$instanceLock.Dispose()}

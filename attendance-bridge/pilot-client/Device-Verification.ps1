param([switch]$ValidateOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Import-Module (Join-Path $PSScriptRoot 'Pilot.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'DeviceVerification.psm1') -Force
if ($ValidateOnly) {'Device verification UI dependencies loaded; no network/device/files accessed.';exit 0}
if (-not [Environment]::Is64BitProcess) {throw '64bit_required'}
$root=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MGFitClub-DeviceVerification'
[void][IO.Directory]::CreateDirectory($root)
$lock=$null
try {$lock=New-Object IO.FileStream((Join-Path $root 'app.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)} catch {[void][Windows.Forms.MessageBox]::Show('رابط تأیید دستگاه از قبل باز است.');exit 1}
$script:settings=$null;$script:job=$null;$script:payload=$null
$settingsPath=Join-Path $root 'settings.mgp';$jobPath=Join-Path $root 'identity-job.mgp'
$form=New-Object Windows.Forms.Form;$form.Text='MG — تأیید هویت دستگاه تردد';$form.Size=New-Object Drawing.Size(1000,760);$form.MinimumSize=New-Object Drawing.Size(980,750);$form.StartPosition='CenterScreen';$form.RightToLeft='Yes';$form.RightToLeftLayout=$true;$form.Font=New-Object Drawing.Font('Segoe UI',10);$form.BackColor=[Drawing.Color]::FromArgb(25,33,28);$form.ForeColor=[Drawing.Color]::White
function Label($text,$x,$y,$w,$h) {$n=New-Object Windows.Forms.Label;$n.Text=$text;$n.SetBounds($x,$y,$w,$h);$form.Controls.Add($n);return $n}
function Button($text,$x,$y,$w) {$n=New-Object Windows.Forms.Button;$n.Text=$text;$n.SetBounds($x,$y,$w,36);$n.BackColor=[Drawing.Color]::FromArgb(192,240,84);$n.ForeColor=[Drawing.Color]::Black;$form.Controls.Add($n);return $n}
$title=Label 'تأیید دستگاه تردد — ثبت چهره کنار دستگاه؛ تطبیق شخص با حضور مسئول' 20 15 940 35
$club=Label 'ابتدا کلید رابط همین باشگاه را از پنل پشتیبانی فنی دریافت کنید.' 20 55 940 30
$key=New-Object Windows.Forms.TextBox;$key.SetBounds(240,100,710,28);$key.UseSystemPasswordChar=$true;$form.Controls.Add($key)
$pair=Button 'اتصال کلید باشگاه' 20 95 205
$refresh=Button 'دریافت درخواست‌های سایت' 20 145 300
$notice=Label 'این برنامه چهره، اثر انگشت یا عضویت را ایجاد نمی‌کند و جلسه کم نمی‌کند. از کلید اشتراک آزمایشی استفاده نکنید.' 345 145 610 58
$grid=New-Object Windows.Forms.DataGridView;$grid.SetBounds(20,210,935,225);$grid.ReadOnly=$true;$grid.AllowUserToAddRows=$false;$grid.AllowUserToDeleteRows=$false;$grid.MultiSelect=$false;$grid.SelectionMode='FullRowSelect';$grid.AutoSizeColumnsMode='Fill';$grid.ForeColor=[Drawing.Color]::Black
foreach($col in @(@('name','نام شخص'),@('phone','شمارهٔ حساب سایت'),@('date','زمان درخواست'))) {[void]$grid.Columns.Add($col[0],$col[1])};$form.Controls.Add($grid)
$memberLabel=Label 'شناسهٔ دقیق همین شخص در دستگاه (نه صرفاً شمارهٔ عضویت حسابداری):' 330 446 625 28
$member=New-Object Windows.Forms.TextBox;$member.SetBounds(20,446,290,28);$member.RightToLeft='No';$member.MaxLength=80;$form.Controls.Add($member)
$claim=Button '۱. شروع تطبیق حضوری' 20 490 280
$capture=Button '۲. خواندن شناسایی تازهٔ دستگاه' 325 490 310
$submit=Button '۳. تأیید هویت و ارسال به سایت' 655 490 300
$status=Label 'شخص را از فهرست انتخاب کنید. اگر چهره/اثر انگشت ندارد، مسئول مجاز ابتدا روی خود دستگاه ثبت کند.' 20 543 935 140
function Fail($e) {$status.Text='عملیات تأیید نشد. اطلاعات رمز‌شده حفظ شده است. اینترنت، زمان دستگاه، شناسهٔ عضو و کلید را بررسی کنید.';if ($e.Exception.Message -match 'device_server_http_(\d+)') {$status.Text+=' پاسخ سایت: '+$Matches[1]+'. 401: کلید؛ 403: دسترسی؛ 409: تداخل شناسه یا درخواست؛ 503: سرویس فعال نشده.'}}
function Refresh-Requests {
 if ($null -eq $script:settings) {throw 'setup_required'}
 $config=Invoke-DeviceVerificationApi 'config' $script:settings.token;Assert-DeviceConfig $config
 if ($config.bridgeId -cne $script:settings.config.bridgeId -or $config.deviceSerial -cne $script:settings.config.deviceSerial) {throw 'bridge_changed'}
 $data=Invoke-DeviceVerificationApi 'pending' $script:settings.token
 $grid.Rows.Clear();foreach($item in $data.requests){$i=$grid.Rows.Add(@([string]$item.full_name,[string]$item.phone,[string]$item.requested_at));$grid.Rows[$i].Tag=$item}
 $club.Text=$config.clubName+' | سریال دستگاه: '+$config.deviceSerial
}
$pair.Add_Click({try {
 $token=$key.Text.Trim();$config=Invoke-DeviceVerificationApi 'config' $token;Assert-DeviceConfig $config
 if ([Windows.Forms.MessageBox]::Show(('اتصال به باشگاه '+$config.clubName+' و دستگاه '+$config.deviceSerial+'؟'),'تطبیق باشگاه','YesNo','Question','Button2') -ne 'Yes') {return}
 $script:settings=[pscustomobject]@{token=$token;config=$config};Save-PilotPrivate $settingsPath $script:settings -Replace;$key.Clear();$script:job=$null;$script:payload=$null;Refresh-Requests
}catch{Fail $_}})
$refresh.Add_Click({try{Refresh-Requests;$status.Text='درخواست‌ها از سایت دریافت شدند؛ دریافت فهرست هیچ تأییدی ثبت نمی‌کند.'}catch{Fail $_}})
$claim.Add_Click({try {
 if ($null -eq $script:settings -or $grid.SelectedRows.Count -ne 1 -or $member.Text.Trim() -notmatch '^[A-Za-z0-9_-]{1,80}$') {throw 'select_request_and_member'}
 $item=$grid.SelectedRows[0].Tag
 $message='شخص '+$item.full_name+' با شمارهٔ '+$item.phone+' حاضر است و شناسهٔ او در دستگاه '+$member.Text.Trim()+' است؟ بعد از شروع، از او بخواهید یک بار با چهره یا اثر انگشت روی دستگاه شناسایی شود. این مرحله جلسه کم نمی‌کند.'
 if ([Windows.Forms.MessageBox]::Show($message,'شروع تطبیق','YesNo','Question','Button2') -ne 'Yes') {return}
 $c=Invoke-DeviceVerificationApi ($item.id+'/claim') $script:settings.token @{}
 $script:job=[pscustomobject]@{claim=$c;config=$script:settings.config;memberId=$member.Text.Trim();name=$item.full_name;phone=$item.phone};$script:payload=$null;Save-PilotPrivate $jobPath $script:job -Replace
 $status.Text='مهلت ۱۵ دقیقه‌ای شروع شد. اکنون '+$item.full_name+' روی دستگاه شناسایی شود؛ سپس دکمهٔ ۲ را بزنید. خروج از این نرم‌افزار درخواست را تأیید نمی‌کند.'
}catch{Fail $_}})
$capture.Add_Click({$capture.Enabled=$false;$child=$null;try {
 if ($null -eq $script:job) {throw 'claim_required'}
 $script:payload=$null
 if ([Windows.Forms.MessageBox]::Show('فقط در زمان خلوت و پس از شناسایی شخص حاضر ادامه دهید. اتصال جیم پالس به دستگاه موقتاً بسته باشد؛ سرویس‌ها را خودسرانه متوقف نکنید. دریافت صرفاً خواندنی است. آماده‌اید؟','خواندن دستگاه','YesNo','Question','Button2') -ne 'Yes') {return}
 $out=Join-Path $root ('identity-result-'+[Guid]::NewGuid().ToString('N')+'.mgp')
 $child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'Capture-Identity.ps1')+'"'),'-Root',('"'+$root+'"'),'-Output',('"'+$out+'"')) -PassThru -WindowStyle Hidden
 if (-not $child.WaitForExit(60000)) {$child.Kill();$child.WaitForExit();throw 'capture_timeout'}
 $result=Read-PilotPrivate $out;if ($result.ok -ne $true) {throw 'fresh_identity_read_failed'}
 $script:payload=$result.body
 $status.Text='ثبت تازه پیدا شد: '+$script:job.name+' | عضو '+$script:payload.memberId+' | '+$script:payload.deviceWallTime+'. فقط اگر شخصاً شناسایی همین فرد با چهره/اثر انگشت را دیده‌اید، دکمهٔ ۳ را بزنید. اتصال حسابداری را به حالت قبل برگردانید.'
}catch{Fail $_;$status.Text+=' اتصال حسابداری را به حالت قبل برگردانید.'}finally{if ($null -ne $child){$child.Dispose()};$capture.Enabled=$true}})
$submit.Add_Click({$submit.Enabled=$false;try {
 if ($null -eq $script:payload -or $null -eq $script:job) {throw 'evidence_required'}
 if ([Windows.Forms.MessageBox]::Show(('تأیید می‌کنید شخص '+$script:job.name+' با شمارهٔ '+$script:job.phone+' را حضوری تطبیق داده‌اید و شناسایی موفق او با چهره یا اثر انگشت برای شناسهٔ '+$script:payload.memberId+' را مشاهده کرده‌اید؟ صرف کارت، رمز یا نام مشابه کافی نیست.'),'تأیید نهایی هویت','YesNo','Warning','Button2') -ne 'Yes') {return}
 $script:payload.identityConfirmed=$true;$script:payload.observedBiometric=$true
 $r=Invoke-DeviceVerificationApi ($script:job.claim.requestId+'/complete') $script:settings.token $script:payload
 if ($r.ok -ne $true -or $r.registration.state -ne 'verified' -or $r.registration.id -cne $script:job.claim.requestId -or $r.registration.memberId -cne $script:payload.memberId) {throw 'invalid_server_ack'}
 $script:payload=$null;$script:job=$null;$status.Text='سایت تأیید را ثبت کرد. کاربر و مسئول باشگاه صفحهٔ وضعیت را تازه کنند. هیچ جلسه یا هزینه‌ای کم نشد.';Refresh-Requests
}catch{Fail $_}finally{$submit.Enabled=$true}})
try {
 if ([IO.File]::Exists($settingsPath)) {try {$script:settings=Read-PilotPrivate $settingsPath;Assert-DeviceConfig $script:settings.config;$club.Text=$script:settings.config.clubName+' | تنظیمات محلی؛ دکمهٔ دریافت درخواست‌ها را بزنید.'}catch{Fail $_;$script:settings=$null}}
 # Never silently resume an old identity challenge or submit on startup.
 [void]$form.ShowDialog()
}finally{$form.Dispose();$lock.Dispose()}

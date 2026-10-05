param([switch]$Background,[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Import-Module (Join-Path $PSScriptRoot 'Bridge.psm1') -Force
if($ValidateOnly){'Agent loaded; no connection or installation performed.';exit 0}
if(-not [Environment]::Is64BitProcess){throw '64-bit Windows PowerShell is required.'}
$single=New-Object Threading.Mutex($false,'Local\MGFitClub-WebBridge');if(-not $single.WaitOne(0)){[void][Windows.Forms.MessageBox]::Show('رابط MG در حال اجراست؛ آیکن کنار ساعت را باز کنید.');exit 0}
$root=Join-Path $env:LOCALAPPDATA 'MGFitClub-WebBridge\data';[void][IO.Directory]::CreateDirectory($root)
$secretPath=Join-Path $root 'secret.mgp';if(-not (Test-Path -LiteralPath $secretPath)){Save-PilotPrivate $secretPath (New-MgSecret)}
$secret=Read-PilotPrivate $secretPath
$form=New-Object Windows.Forms.Form;$form.Text='MG — رابط واحد باشگاه';$form.Size=New-Object Drawing.Size(740,570);$form.StartPosition='CenterScreen';$form.RightToLeft='Yes';$form.RightToLeftLayout=$true;$form.BackColor=[Drawing.Color]::FromArgb(20,29,22);$form.ForeColor=[Drawing.Color]::White;$form.Font=New-Object Drawing.Font('Tahoma',10)
$title=New-Object Windows.Forms.Label;$title.Text='کد اتصال اولیه — فقط برای پشتیبان فنی';$title.SetBounds(20,15,680,30);$form.Controls.Add($title)
$code=New-Object Windows.Forms.TextBox;$code.ReadOnly=$true;$code.Text=Get-MgPairCode $secret;$code.RightToLeft='No';$code.SetBounds(20,50,680,32);$form.Controls.Add($code)
$open=New-Object Windows.Forms.Button;$open.Text='باز کردن صفحهٔ مدیریت تردد';$open.SetBounds(20,93,330,42);$open.BackColor=[Drawing.Color]::YellowGreen;$form.Controls.Add($open);$open.Add_Click({Start-Process 'https://mgfitclub.ir/club-attendance.html'})
$copy=New-Object Windows.Forms.Button;$copy.Text='کپی کد اتصال';$copy.SetBounds(370,93,330,42);$copy.BackColor=[Drawing.Color]::YellowGreen;$form.Controls.Add($copy);$copy.Add_Click({[Windows.Forms.Clipboard]::SetText($code.Text)})
$status=New-Object Windows.Forms.Label;$status.SetBounds(20,145,680,95);$form.Controls.Add($status)
$list=New-Object Windows.Forms.TextBox;$list.Multiline=$true;$list.ReadOnly=$true;$list.ScrollBars='Vertical';$list.SetBounds(20,245,680,200);$list.Anchor='Top,Bottom,Left,Right';$form.Controls.Add($list)
$note=New-Object Windows.Forms.Label;$note.Text='پاسخ محلی قطعی نیست؛ کسر جلسه در وب با تأیید مسئول انجام می‌شود. بستن پنجره رابط را متوقف نمی‌کند.';$note.SetBounds(20,460,680,60);$note.Anchor='Bottom,Left,Right';$form.Controls.Add($note)
$tray=New-Object Windows.Forms.NotifyIcon;$tray.Icon=[Drawing.SystemIcons]::Application;$tray.Text='MG Club Bridge';$tray.Visible=$true
$menu=New-Object Windows.Forms.ContextMenuStrip;$show=$menu.Items.Add('نمایش وضعیت MG');$show.Add_Click({$form.Show();$form.Activate()});$quit=$menu.Items.Add('توقف رابط');$script:quitting=$false;$quit.Add_Click({$script:quitting=$true;$form.Close()});$tray.ContextMenuStrip=$menu;$tray.Add_DoubleClick({$form.Show();$form.Activate()})
$form.Add_FormClosing({param($sender,$e)if(-not $script:quitting){$e.Cancel=$true;$form.Hide()}})
$script:child=$null;$script:next=[DateTime]::MinValue;$script:childStart=[DateTime]::MinValue
$timer=New-Object Windows.Forms.Timer;$timer.Interval=1000
$rotate=$menu.Items.Add('ایجاد کد جدید برای اتصال مجدد')
$rotate.Add_Click({
 if([Windows.Forms.MessageBox]::Show('کلید محلی عوض شود؟ پشتیبان باید کد جدید را برای همین دستگاه تأیید کند. صف رکوردها حذف نمی‌شود.','MG','YesNo') -ne 'Yes'){return}
 $timer.Stop()
 try {
  if($script:child -and -not $script:child.HasExited){$script:child.Kill();$script:child.WaitForExit()}
  $newSecret=New-MgSecret;Save-PilotPrivate $secretPath $newSecret -Replace;$code.Text=Get-MgPairCode $newSecret
  $cache=Join-Path $root 'snapshot.mgp';if(Test-Path -LiteralPath $cache){Move-Item -LiteralPath $cache -Destination (Join-Path $root ('snapshot-before-repair-'+[Guid]::NewGuid().ToString('N')+'.mgp'))}
  $script:next=[DateTime]::MinValue;$form.Show()
 }finally{$timer.Start()}
})
$timer.Add_Tick({
 try {
  if($script:child -and -not $script:child.HasExited -and ([DateTime]::UtcNow-$script:childStart).TotalSeconds -gt 90){$script:child.Kill();$status.Text='خواندن دستگاه بیش از حد طول کشید؛ تلاش بعدی خودکار است.'}
  if(( -not $script:child -or $script:child.HasExited) -and [DateTime]::UtcNow -ge $script:next){
   $script:child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $PSScriptRoot 'Cycle.ps1')+'" -Root "'+$root+'"') -WindowStyle Hidden -PassThru
   $script:childStart=[DateTime]::UtcNow;$script:next=[DateTime]::UtcNow.AddSeconds(15)
  }
  $file=Join-Path $root 'status.mgp';if(Test-Path -LiteralPath $file){
   $r=Read-PilotPrivate $file;$age=([DateTimeOffset]::UtcNow-[DateTimeOffset]::Parse($r.updatedAt)).TotalSeconds
   $net=if($r.network -eq 'online'){'متصل به سایت'}else{'آفلاین / منتظر تأیید پشتیبان'}
   $device=@{connected='خواندن موفق';starting='منتظر اتصال';connection_failed='دستگاه در شبکه پیدا نشد';serial_mismatch='سریال دستگاه متفاوت است';sdk_missing='SDK دستگاه نصب یا ثبت نشده';read_failed='خواندن رکورد ناموفق یا خالی';capture_partial='خواندن ناقص — نیازمند بررسی'}[$r.device]
   $hint=if($r.error -eq 'server_http_401'){'کد بالا را در پنل پشتیبان تأیید کنید؛ اگر قبلاً وصل بود، اتصال مجدد را بزنید.'}elseif($r.error -eq 'server_http_503'){'نسخهٔ وب هنوز روی سرور فعال نشده است.'}elseif($r.error){'خطا: '+$r.error}else{''}
   $status.Text=$net+' | '+$device+"`r`n"+'صف ارسال: '+$r.pending+' | قدمت وضعیت: '+[int]$age+' ثانیه'+"`r`n"+$hint
   $labels=@{cache_stale='اطلاعات قدیمی — بررسی مسئول';unregistered='حساب متصل نشده';blocked='حساب غیرفعال';staff_pending_review='حضور کارکنان — بررسی در وب';no_plan='اشتراک ندارد';expired='خارج از اعتبار';same_day='جلسهٔ امروز قبلاً ثبت شده';same_day_pending='تردد مجدد امروز — هنوز قطعی نیست';exhausted_estimate='اعتبار ذخیره‌شده تمام شده — بررسی مسئول';pending_review='ثبت محلی — منتظر تأیید حضور در وب';rejected_clock='رد سرور — ساعت دستگاه بررسی شود'}
   $list.Lines=@($r.recent|ForEach-Object {'کد '+$_.memberId+' | '+$_.wallTime+' | '+$labels[$_.decision]})
  }else{$status.Text='در حال راه‌اندازی؛ اتصال اولیه نیاز به اینترنت و تأیید پشتیبان دارد.'}
 }catch{$status.Text='خطای رابط؛ برنامه را متوقف و دوباره اجرا کنید: '+$_.Exception.GetType().Name}
})
$form.Add_Shown({if($Background){$form.Hide()};$timer.Start()})
try{[void]$form.ShowDialog()}finally{$timer.Stop();$timer.Dispose();if($script:child -and -not $script:child.HasExited){$script:child.Kill()};$tray.Dispose();$form.Dispose();$single.ReleaseMutex();$single.Dispose()}

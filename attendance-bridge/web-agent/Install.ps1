param([switch]$ValidateOnly)
$ErrorActionPreference='Stop'
if(-not [Environment]::Is64BitOperatingSystem){throw '64-bit Windows required'}
$files=@('Agent.ps1','Bridge.psm1','Cycle.ps1','lib\Pilot.psm1','Launch.ps1','Update.psm1','update-public.xml','version.json')
foreach($file in $files){if(-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $file))){throw ('Missing package file: '+$file)}}
if($ValidateOnly){'Installer inputs valid; nothing installed.';exit 0}
Add-Type -AssemblyName System.Windows.Forms
if([Windows.Forms.MessageBox]::Show('رابط MG برای همین کاربر ویندوز نصب و هنگام ورود به ویندوز اجرا شود؟ برنامهٔ قبلی را ابتدا متوقف کنید.','MG','YesNo') -ne 'Yes'){exit 0}
$dest=Join-Path $env:LOCALAPPDATA 'MGFitClub-WebBridge\app';[void][IO.Directory]::CreateDirectory((Join-Path $dest 'lib'))
foreach($file in $files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $dest $file) -Force}
$shell=New-Object -ComObject WScript.Shell;$exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach($folder in @([Environment]::GetFolderPath('Startup'),[Environment]::GetFolderPath('Desktop'))){
 $link=$shell.CreateShortcut((Join-Path $folder 'MG Club Bridge.lnk'));$link.TargetPath=$exe;$link.Arguments='-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $dest 'Launch.ps1')+'"'+$(if($folder -eq [Environment]::GetFolderPath('Startup')){' -Background'}else{''});$link.WorkingDirectory=$dest;$link.Save()
}
Start-Process -FilePath $exe -ArgumentList ('-NoProfile -STA -ExecutionPolicy Bypass -File "'+(Join-Path $dest 'Launch.ps1')+'"') -WindowStyle Hidden

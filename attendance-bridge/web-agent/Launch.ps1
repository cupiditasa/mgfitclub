param([switch]$Background)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'Update.psm1') -Force
$selected=Select-MgAgent $PSScriptRoot
# Launch only locally verified signed files. No remote commands or dynamic script evaluation.
$argsList='-NoProfile -STA -ExecutionPolicy Bypass -File "'+(Join-Path $selected 'Agent.ps1')+'"'
if($Background){$argsList+=' -Background'}
Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $argsList -WindowStyle Hidden

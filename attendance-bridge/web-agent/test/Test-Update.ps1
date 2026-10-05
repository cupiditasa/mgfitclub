$ErrorActionPreference='Stop'
$base=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $base 'Update.psm1') -Force
$public=[IO.File]::ReadAllText((Join-Path $base 'update-public.xml'))
$text=[IO.File]::ReadAllText((Join-Path $base 'version.json'))
$manifest=Read-MgSignedManifest $text $public
if(-not (Test-MgVersionFiles $base $manifest)){throw 'Signed source hashes failed'}
'PASS RSA signature and all packaged file hashes'
$envelope=$text|ConvertFrom-Json;$envelope.payload=$envelope.payload.Replace('20261005','20271005')
$rejected=$false;try{Read-MgSignedManifest ($envelope|ConvertTo-Json -Compress) $public|Out-Null}catch{$rejected=$true}
if(-not $rejected){throw 'Tampered signature accepted'}
'PASS altered manifest rejected'
$manifest.files[0].sha256='0'*64
if(Test-MgVersionFiles $base $manifest){throw 'Altered file digest accepted'}
'PASS altered file digest rejected'
'Passed 3 signed-update checks; no download or installation performed.'

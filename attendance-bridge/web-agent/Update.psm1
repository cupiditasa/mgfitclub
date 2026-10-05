Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
$script:Allowed=@('Agent.ps1','Bridge.psm1','Cycle.ps1','lib/Pilot.psm1')
function Read-MgSignedManifest([string]$Text,[string]$PublicKey) {
 if($Text.Length -gt 32000){throw 'manifest_too_large'}
 $envelope=$Text|ConvertFrom-Json;$rsa=New-Object Security.Cryptography.RSACryptoServiceProvider
 try {$rsa.FromXmlString($PublicKey);$ok=$rsa.VerifyData([Text.Encoding]::UTF8.GetBytes([string]$envelope.payload),[Security.Cryptography.CryptoConfig]::MapNameToOID('SHA256'),[Convert]::FromBase64String($envelope.signature));if(-not $ok){throw 'signature_invalid'}}finally{$rsa.Dispose()}
 $m=$envelope.payload|ConvertFrom-Json
 if($m.version -notmatch '^\d{8}\.\d{1,4}$' -or $m.files.Count -ne $script:Allowed.Count){throw 'manifest_invalid'}
 $seen=@();foreach($f in $m.files){if($f.path -cnotin $script:Allowed -or $f.path -cin $seen -or $f.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'manifest_path_invalid'};$seen+=,$f.path}
 return $m
}
function Test-MgVersionFiles([string]$Directory,$Manifest) {
 foreach($f in $Manifest.files){$p=Join-Path $Directory $f.path;if(-not [IO.File]::Exists($p) -or ([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint)){return $false};if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256){return $false}}
 return $true
}
function Get-MgUpdateBytes([string]$Relative) {
 if($Relative -notmatch '^(mg-bridge-update\.json|mg-bridge/\d{8}\.\d{1,4}/(Agent\.ps1|Bridge\.psm1|Cycle\.ps1|lib/Pilot\.psm1))$'){throw 'update_path_invalid'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $handler=New-Object Net.Http.HttpClientHandler;$handler.AllowAutoRedirect=$false;$handler.UseCookies=$false;$client=New-Object Net.Http.HttpClient($handler);$client.Timeout=[TimeSpan]::FromSeconds(5);$client.MaxResponseContentBufferSize=1048576
 try{
  $r=$client.GetAsync(('https://mgfitclub.ir/downloads/'+$Relative)).GetAwaiter().GetResult()
  try{if(-not $r.IsSuccessStatusCode){throw 'update_unavailable'}
   $stream=$r.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$ms=New-Object IO.MemoryStream
   try{$buf=New-Object byte[] 8192;while(($n=$stream.Read($buf,0,$buf.Length)) -gt 0){if($ms.Length+$n -gt 1048576){throw 'update_too_large'};$ms.Write($buf,0,$n)};return ,$ms.ToArray()}finally{$stream.Dispose();$ms.Dispose()}
  }finally{$r.Dispose()}
 }finally{$client.Dispose();$handler.Dispose()}
}
function Select-MgAgent([string]$InstalledRoot) {
 $public=[IO.File]::ReadAllText((Join-Path $InstalledRoot 'update-public.xml'))
 $bundled=Read-MgSignedManifest ([IO.File]::ReadAllText((Join-Path $InstalledRoot 'version.json'))) $public
 if(-not (Test-MgVersionFiles $InstalledRoot $bundled)){throw 'installed_files_invalid'}
 $selected=$InstalledRoot;$best=[version]$bundled.version
 $versions=Join-Path (Split-Path $InstalledRoot -Parent) 'versions';[void][IO.Directory]::CreateDirectory($versions)
 foreach($dir in Get-ChildItem -LiteralPath $versions -Directory){
  try{if($dir.Attributes -band [IO.FileAttributes]::ReparsePoint){continue};$m=Read-MgSignedManifest ([IO.File]::ReadAllText((Join-Path $dir.FullName 'version.json'))) $public
   if([version]$m.version -gt $best -and (Test-MgVersionFiles $dir.FullName $m)){$selected=$dir.FullName;$best=[version]$m.version}
  }catch{continue}
 }
 try{
  $text=[Text.Encoding]::UTF8.GetString((Get-MgUpdateBytes 'mg-bridge-update.json'));$m=Read-MgSignedManifest $text $public
  if([version]$m.version -gt $best){
   $stage=Join-Path $versions ([Guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory((Join-Path $stage 'lib'))
   foreach($f in $m.files){[IO.File]::WriteAllBytes((Join-Path $stage $f.path),(Get-MgUpdateBytes ('mg-bridge/'+$m.version+'/'+$f.path)))}
   if(-not (Test-MgVersionFiles $stage $m)){throw 'update_hash_invalid'}
   # Validate parsing in the local runtime before making this version eligible.
   foreach($f in $m.files){$errors=$null;$tokens=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $stage $f.path),[ref]$tokens,[ref]$errors);if($errors){throw 'update_parse_invalid'}}
   [IO.File]::WriteAllText((Join-Path $stage 'version.json'),$text,(New-Object Text.UTF8Encoding($false)));$selected=$stage
  }
 }catch{# Invalid/unavailable update never replaces the last verified local version.
 }
 return $selected
}
Export-ModuleMember -Function Read-MgSignedManifest,Test-MgVersionFiles,Select-MgAgent

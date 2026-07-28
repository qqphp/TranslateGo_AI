[CmdletBinding()]
param(
  [string]$OutputDirectory = "release",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$distPath = [IO.Path]::GetFullPath((Join-Path $projectRoot "dist"))
$outputPath = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
  [IO.Path]::GetFullPath($OutputDirectory)
} else {
  [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
}

$distPrefix = $distPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if ($outputPath -eq $distPath -or $outputPath.StartsWith($distPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "The release output directory must not be dist or a directory inside dist."
}

$manifestPath = Join-Path $distPath "manifest.json"
$packagePath = Join-Path $projectRoot "package.json"
$requiredFiles = @("manifest.json", "background.js", "content.js", "options.html", "options.js")

foreach ($relativePath in $requiredFiles) {
  $requiredPath = Join-Path $distPath $relativePath
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Missing release file: $requiredPath. Run npm run build first."
  }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$version = [string]$manifest.version

if ($version -notmatch '^\d+(?:\.\d+){0,3}$') {
  throw "Invalid browser extension version '$version' in public/manifest.json."
}
if ([string]$package.version -ne $version) {
  throw "Version mismatch: package.json is $($package.version), but manifest.json is $version."
}

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$archiveName = "$($package.name)-$version.zip"
$archivePath = Join-Path $outputPath $archiveName

if (Test-Path -LiteralPath $archivePath) {
  if (-not $Force) {
    throw "Release package already exists: $archivePath. Increment the version or rerun with -Force."
  }
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $archivePath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName })
  if ($entries -notcontains "manifest.json") {
    throw "Release package is invalid: manifest.json is not at the ZIP root."
  }
  if ($entries | Where-Object { $_ -match '^(?:dist[\\/])' }) {
    throw "Release package is invalid: files are nested under a dist directory."
  }
} finally {
  $archive.Dispose()
}

$sha256 = [Security.Cryptography.SHA256]::Create()
$stream = [IO.File]::OpenRead($archivePath)
try {
  $hashBytes = $sha256.ComputeHash($stream)
  $hash = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
} finally {
  $stream.Dispose()
  $sha256.Dispose()
}
$size = (Get-Item -LiteralPath $archivePath).Length

Write-Host "Release package created successfully."
Write-Host "Path: $archivePath"
Write-Host "Size: $size bytes"
Write-Host "SHA256: $hash"

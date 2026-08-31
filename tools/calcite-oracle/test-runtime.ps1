param(
  [string] $SidecarRoot
)

$ErrorActionPreference = "Stop"
$sidecarFolderName = ([char]0x80A1).ToString() + ([char]0x884D).ToString() + ([char]0x6570).ToString() + ([char]0x636E).ToString() + "-" + ([char]0x6570).ToString() + ([char]0x636E).ToString() + "cookbook"
if ([string]::IsNullOrWhiteSpace($SidecarRoot)) {
  $SidecarRoot = Join-Path "E:\02_area" (Join-Path $sidecarFolderName "scripts\Calcite")
}
$resolvedSidecar = Resolve-Path -LiteralPath $SidecarRoot -ErrorAction Stop
$legacyScript = Join-Path $resolvedSidecar.Path "legacy-test-runtime.ps1"
if (-not (Test-Path -LiteralPath $legacyScript -PathType Leaf)) {
  throw "Calcite sidecar legacy test script is missing: $legacyScript"
}
$powershell = (Get-Command powershell -ErrorAction Stop).Source
& $powershell -NoProfile -ExecutionPolicy Bypass -File $legacyScript
if ($LASTEXITCODE -ne 0) {
  throw "Calcite sidecar legacy compatibility test failed with exit code $LASTEXITCODE"
}

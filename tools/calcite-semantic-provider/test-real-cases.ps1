param(
  [string] $DataRoot,
  [string] $TaskIds = "93338,155015,176827,181058,209119"
)
$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $toolRoot "../..")).Path
$source = Join-Path $toolRoot "src/main/java/com/gf/sqlstaticlineage/calcitesemanticprovider/CalciteSemanticProvider.java"
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"
$stagingRoot = Join-Path $repoRoot "staging/calcite-semantic-provider-poc"
$classpathPath = Join-Path $stagingRoot "real-cases-classpath.txt"

if (-not $DataRoot) {
  $roots = @(Get-ChildItem -LiteralPath "E:\02_area" -Directory | ForEach-Object {
    Join-Path $_.FullName "sql-static-lineage-data"
  } | Where-Object {
    (Test-Path -LiteralPath (Join-Path $_ "tasks")) -and
    (Test-Path -LiteralPath (Join-Path $_ "tables"))
  })
  if ($roots.Count -ne 1) { throw "cannot uniquely locate the frozen sql-static-lineage-data root" }
  $DataRoot = $roots[0]
}

New-Item -ItemType Directory -Force -Path $classes | Out-Null
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File | Select-Object -ExpandProperty FullName)
$compileClasspath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $compileClasspath -d $classes $source
if ($LASTEXITCODE -ne 0) { throw "javac failed" }
[IO.File]::WriteAllText($classpathPath, $compileClasspath, (New-Object Text.UTF8Encoding($false)))

& node --import tsx scripts/calcite-semantic-provider/run-real-cases.ts `
  --data-root $DataRoot `
  --task-ids $TaskIds `
  --classpath-file $classpathPath
if ($LASTEXITCODE -ne 0) { throw "real case batch failed" }

& node --import tsx scripts/calcite-semantic-provider/three-way-impact-differential.ts `
  --data-root $DataRoot `
  --task-ids $TaskIds `
  --output "three-way-impact-differential/report.json"
if ($LASTEXITCODE -ne 0) { throw "three-way impact differential failed" }

param(
  [string] $DataRoot,
  [string] $SqlPath,
  [string] $SchemaSnapshotPath
)
$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $toolRoot "../..")).Path
$source = Join-Path $toolRoot "src/main/java/com/gf/sqlstaticlineage/calcitesemanticprovider/CalciteSemanticProvider.java"
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"
$stagingRoot = Join-Path $repoRoot "staging/calcite-semantic-provider-poc/real-209119"
$requestPath = Join-Path $stagingRoot "request.json"
$responsePath = Join-Path $stagingRoot "response.json"
$metricsPath = Join-Path $stagingRoot "runtime-metrics.json"

if (-not $DataRoot) {
  $roots = @(Get-ChildItem -LiteralPath "E:\02_area" -Directory | ForEach-Object {
    Join-Path $_.FullName "sql-static-lineage-data"
  } | Where-Object {
    Test-Path -LiteralPath (Join-Path $_ "field-facts\input-pack-sources\209119")
  })
  if ($roots.Count -ne 1) { throw "cannot uniquely locate the frozen sql-static-lineage-data root" }
  $DataRoot = $roots[0]
}
if (-not $SqlPath) {
  $sqlFiles = @(Get-ChildItem -LiteralPath (Join-Path $DataRoot "field-facts\input-pack-sources\209119") -Filter *.sql -File)
  if ($sqlFiles.Count -ne 1) { throw "expected exactly one frozen SQL source for 209119" }
  $SqlPath = $sqlFiles[0].FullName
}
if (-not $SchemaSnapshotPath) {
  $SchemaSnapshotPath = Join-Path $DataRoot "field-facts\snapshots\schema\571afcc79864cdc8c34bcb2797415be9b6b2356515e1a719f43ed6f612332766.json"
}
if (-not (Test-Path -LiteralPath $SqlPath)) { throw "frozen real SQL is missing" }
if (-not (Test-Path -LiteralPath $SchemaSnapshotPath)) { throw "frozen schema snapshot is missing" }
New-Item -ItemType Directory -Force -Path $classes | Out-Null

& node --import tsx scripts/calcite-semantic-provider/prepare-real-probe.ts `
  --data-root $DataRoot `
  --sql $SqlPath `
  --schema-snapshot $SchemaSnapshotPath `
  --task-id 209119 `
  --sql-source-id real:209119:sql-slot:0 `
  --output-prefix real-209119 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "real request preparation failed" }

$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File | Select-Object -ExpandProperty FullName)
$compileClasspath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $compileClasspath -d $classes $source
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = (Get-Command java).Source
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$runtimeClasspath = $compileClasspath
$startInfo.Arguments = '-Xmx1024m -cp "' + $runtimeClasspath + '" com.gf.sqlstaticlineage.calcitesemanticprovider.CalciteSemanticProvider'
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
[void]$process.Start()
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
$requestBytes = [Text.Encoding]::UTF8.GetBytes(([IO.File]::ReadAllText($requestPath, [Text.Encoding]::UTF8)).Trim() + "`n")
$process.StandardInput.BaseStream.Write($requestBytes, 0, $requestBytes.Length)
$process.StandardInput.BaseStream.Close()
$peakBytes = 0L
$deadline = [DateTime]::UtcNow.AddSeconds(15)
while (-not $process.HasExited) {
  $process.Refresh()
  if ($process.WorkingSet64 -gt $peakBytes) { $peakBytes = $process.WorkingSet64 }
  if ([DateTime]::UtcNow -ge $deadline) {
    $process.Kill()
    throw "real provider process deadline exceeded"
  }
  [Threading.Thread]::Sleep(25)
}
$process.WaitForExit()
$process.Refresh()
$peakBytes = [Math]::Max($peakBytes, $process.PeakWorkingSet64)
$stdout = $stdoutTask.Result
$stderr = $stderrTask.Result
$stopwatch.Stop()
if ($process.ExitCode -ne 0) { throw "real provider failed: $stderr" }
$lines = @($stdout -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith("{") })
if ($lines.Count -ne 1) { throw "expected one real provider response" }
[IO.File]::WriteAllText($responsePath, $lines[0] + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))

& node --import tsx scripts/calcite-semantic-provider/validate-provider-response.ts --input $responsePath
if ($LASTEXITCODE -ne 0) { throw "real provider response failed canonical contract validation" }

$metrics = [ordered]@{
  reportVersion = 1
  safety = [ordered]@{
    reportKind = "CALCITE_SEMANTIC_PROVIDER_REAL_POC"
    canonicalArtifactsWritten = $false
    nativeSemanticFallback = $false
  }
  elapsedMs = $stopwatch.Elapsed.TotalMilliseconds
  peakWorkingSetBytes = $peakBytes
  requestBytes = (Get-Item -LiteralPath $requestPath).Length
  responseBytes = (Get-Item -LiteralPath $responsePath).Length
}
[IO.File]::WriteAllText($metricsPath, ($metrics | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))
$metrics | ConvertTo-Json -Depth 10

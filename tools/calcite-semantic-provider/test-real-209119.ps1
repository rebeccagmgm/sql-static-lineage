param(
  [string] $DataRoot
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
$assembledResponsePath = Join-Path $stagingRoot "assembled-response.json"
$assemblyMetricsPath = Join-Path $stagingRoot "evidence-assembly-metrics.json"
$impactValueReportPath = Join-Path $stagingRoot "impact-value-report.json"

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

& node --import tsx scripts/calcite-semantic-provider/prepare-real-probe.ts `
  --data-root $DataRoot `
  --task-id 209119 `
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

& node --import tsx scripts/calcite-semantic-provider/assemble-real-evidence.ts `
  --response $responsePath `
  --manifest (Join-Path $stagingRoot "input-manifest.json") `
  --output $assembledResponsePath `
  --metrics-output $assemblyMetricsPath
if ($LASTEXITCODE -ne 0) { throw "real Native evidence assembly failed" }
& node --import tsx scripts/calcite-semantic-provider/validate-provider-response.ts --input $assembledResponsePath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "assembled real response failed canonical contract validation" }

& node --import tsx scripts/calcite-semantic-provider/impact-value-report.ts `
  --input $assembledResponsePath `
  --manifest (Join-Path $stagingRoot "input-manifest.json") `
  --output $impactValueReportPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "real Calcite indirect-impact value gate failed" }
$impactValueReport = Get-Content -Raw -LiteralPath $impactValueReportPath | ConvertFrom-Json
if ($impactValueReport.valueGate.decision -ne "CALCITE_INDIRECT_IMPACT_VALUE_PROVEN") {
  throw "real Calcite indirect-impact value was not demonstrated"
}
if ($impactValueReport.productionProviderDecision -ne "VALIDATION_ONLY") {
  throw "impact value report must not promote the production Provider decision"
}
if ($impactValueReport.safety.canonicalArtifactsWritten -ne $false -or
    $impactValueReport.safety.productionIntegrationPerformed -ne $false -or
    $impactValueReport.safety.provenUnrelatedEnabled -ne $false) {
  throw "impact value report violated POC isolation"
}

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
  calciteIndirectImpactValueDecision = $impactValueReport.valueGate.decision
  directFieldValueReadCount = $impactValueReport.summary.directFieldValueReadCount
  indirectOnlyReadCount = $impactValueReport.summary.indirectOnlyReadCount
  notReachedReadCount = $impactValueReport.summary.notReachedReadCount
}
[IO.File]::WriteAllText($metricsPath, ($metrics | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding($false)))
$metrics | ConvertTo-Json -Depth 10

$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $toolRoot "../..")).Path
$source = Join-Path $toolRoot "src/main/java/com/gf/sqlstaticlineage/calcitesemanticprovider/CalciteSemanticProvider.java"
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"
$corpusPath = Join-Path $repoRoot "tests/fixtures/calcite-semantic-provider/corpus.json"
$stagingRoot = Join-Path $repoRoot "staging/calcite-semantic-provider-poc/corpus"
$canonicalRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot "artifacts/tasks"))
$resolvedStaging = [IO.Path]::GetFullPath($stagingRoot)
if ($resolvedStaging.StartsWith($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "POC staging resolved under canonical artifacts"
}

New-Item -ItemType Directory -Force -Path $classes | Out-Null
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File | Select-Object -ExpandProperty FullName)
$classpath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $classpath -d $classes $source
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$corpus = Get-Content $corpusPath -Raw | ConvertFrom-Json
$requests = @()
foreach ($sample in $corpus.samples) {
  $requests += [ordered]@{
    protocolVersion = 1
    requestId = "corpus:$($sample.id)"
    sqlSourceId = "fixture:$($sample.id)"
    statementOrdinal = 0
    dialect = "ANSI"
    sql = $sample.sql
    schema = $corpus.schema
    requestedMetadata = @("expressionLineage", "predicates", "uniqueKeys", "functionalDependencies", "tableOccurrences", "rowCountCardinality")
    limits = [ordered]@{ maxOutputBytes = 1048576; maxOutputItems = 4096 }
  }
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = (Get-Command java).Source
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.Arguments = '-Xmx1024m -cp "' + $classpath + '" com.gf.sqlstaticlineage.calcitesemanticprovider.CalciteSemanticProvider'
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $startInfo
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
[void]$process.Start()
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
foreach ($request in $requests) {
  $process.StandardInput.WriteLine(($request | ConvertTo-Json -Compress -Depth 30))
}
$process.StandardInput.Close()
$peakBytes = 0L
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while (-not $process.HasExited) {
  $process.Refresh()
  if ($process.WorkingSet64 -gt $peakBytes) { $peakBytes = $process.WorkingSet64 }
  if ([DateTime]::UtcNow -ge $deadline) { $process.Kill(); throw "corpus process deadline exceeded" }
  [Threading.Thread]::Sleep(25)
}
$process.WaitForExit()
$stdout = $stdoutTask.Result
$stderr = $stderrTask.Result
$stopwatch.Stop()
if ($process.ExitCode -ne 0) { throw "provider failed: $stderr" }
$process.Refresh()
$peakBytes = [Math]::Max($peakBytes, $process.PeakWorkingSet64)
$responses = @($stdout -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith("{") } | ForEach-Object { $_ | ConvertFrom-Json })
if ($responses.Count -ne $requests.Count) { throw "response count mismatch" }

$support = @()
for ($index = 0; $index -lt $responses.Count; $index++) {
  $response = $responses[$index]
  $sample = $corpus.samples[$index]
  $actualKinds = @($response.facts.dependencies | Select-Object -ExpandProperty dependencyKind -Unique | Sort-Object)
  $missingKinds = @($sample.expectedDependencyKinds | Where-Object { $actualKinds -notcontains $_ })
  $support += [ordered]@{
    id = $sample.id
    responseStatus = $response.status
    errorCode = $response.error.code
    errorMessage = $response.error.message
    statementStatus = $response.facts.statementStatus
    relationCount = @($response.facts.relations).Count
    dependencyCount = @($response.facts.dependencies).Count
    actualDependencyKinds = $actualKinds
    expectedDependencyKinds = @($sample.expectedDependencyKinds)
    missingDependencyKinds = $missingKinds
  }
  $factsPath = Join-Path $stagingRoot "$($sample.id).candidate-facts.json"
  [IO.File]::WriteAllText($factsPath, ($response.facts | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding($false)))
}
$report = [ordered]@{
  reportVersion = 1
  safety = [ordered]@{ reportKind = "CALCITE_SEMANTIC_PROVIDER_POC"; canonicalArtifactsWritten = $false; nativeSemanticFallback = $false }
  requestCount = $requests.Count
  responseCount = $responses.Count
  elapsedMs = $stopwatch.Elapsed.TotalMilliseconds
  peakWorkingSetBytes = $peakBytes
  unsupportedCount = @($responses | Where-Object { $_.status -eq "UNSUPPORTED" }).Count
  errorCount = @($responses | Where-Object { $_.status -eq "ERROR" }).Count
  samplesWithMissingExpectedKinds = @($support | Where-Object { $_.missingDependencyKinds.Count -gt 0 }).Count
  samples = $support
}
[IO.File]::WriteAllText((Join-Path $stagingRoot "support-matrix.json"), ($report | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding($false)))
if ($report.errorCount -gt 0) { throw "corpus contains provider errors" }

$goldenPath = Join-Path $repoRoot "tests/fixtures/calcite-semantic-provider/semantic-golden.json"
& node --import tsx scripts/calcite-semantic-provider/validate-corpus-golden.ts `
  --facts-dir $stagingRoot `
  --golden $goldenPath `
  --support-matrix (Join-Path $stagingRoot "support-matrix.json")
if ($LASTEXITCODE -ne 0) { throw "corpus semantic-edge golden mismatch" }
$report = Get-Content (Join-Path $stagingRoot "support-matrix.json") -Raw | ConvertFrom-Json

$report | ConvertTo-Json -Depth 20

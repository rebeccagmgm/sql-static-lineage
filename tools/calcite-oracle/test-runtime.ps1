$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $toolRoot "../..")).Path
$source = Join-Path $toolRoot "src/main/java/com/gf/sqlstaticlineage/calciteoracle/CalciteOracle.java"
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"

if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
  throw "javac is required for the Calcite runtime check"
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "java is required for the Calcite runtime check"
}
$calciteJar = Join-Path $m2Root "org/apache/calcite/calcite-core/1.42.0/calcite-core-1.42.0.jar"
if (-not (Test-Path $calciteJar)) {
  throw "locked Calcite 1.42.0 dependency is not present in the local Maven cache"
}

New-Item -ItemType Directory -Force -Path $classes | Out-Null
$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File |
  Select-Object -ExpandProperty FullName)
$classpath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $classpath -d $classes $source
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

function Invoke-Oracle([string] $json) {
  $singleLine = $json.TrimEnd("`r", "`n")
  $javaPath = (Get-Command java).Source
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $javaPath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.Arguments = '-cp "' + $classpath + '" '
  $startInfo.Arguments += 'com.gf.sqlstaticlineage.calciteoracle.CalciteOracle'
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $process.StandardInput.WriteLine($singleLine)
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  [void]$process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Calcite oracle process failed" }
  $lines = @($stdout -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith("{") })
  if ($lines.Count -ne 1) { throw "expected exactly one JSONL response" }
  return [pscustomobject]@{ Raw = $lines[0]; Value = ($lines[0] | ConvertFrom-Json) }
}

$basicPath = Join-Path $repoRoot "tests/fixtures/calcite-oracle/basic-request.json"
$basic = Get-Content $basicPath -Raw
$first = Invoke-Oracle $basic
if ($first.Value.status -ne "SUCCESS") { throw "basic request did not succeed" }
$second = Invoke-Oracle $basic
if ($first.Raw -cne $second.Raw) { throw "basic response is not deterministic" }
$fds = @($first.Value.observations.functionalDependencies)
if (-not ($fds | Where-Object { $_.source -eq "SCHEMA_STATISTICS" })) {
  throw "schema FD provenance was not preserved"
}
if (-not ($fds | Where-Object { $_.source -eq "CALCITE_METADATA" })) {
  throw "Calcite FD metadata was not observed"
}
$sameFdSources = @($fds | Where-Object {
  $_.determinant -join "," -eq "order_id" -and $_.dependent -join "," -eq "amount"
} | Select-Object -ExpandProperty source -Unique)
if ($sameFdSources.Count -ne 2) { throw "FD provenance deduplication collapsed sources" }

$malformed = Invoke-Oracle '{"protocolVersion":1'
if ($malformed.Value.status -ne "FAILED" -or $malformed.Value.error.code -ne "JSON_INVALID") {
  throw "malformed JSON was not classified as JSON_INVALID"
}
$badNumber = Invoke-Oracle '{"protocolVersion":01}'
if ($badNumber.Value.error.code -ne "JSON_INVALID") {
  throw "invalid JSON number was not classified as JSON_INVALID"
}
$badUnicode = Invoke-Oracle '{"protocolVersion":1,"requestId":"\uD800"}'
if ($badUnicode.Value.error.code -ne "JSON_INVALID") {
  throw "invalid JSON Unicode was not classified as JSON_INVALID"
}
$oversized = '{"' + ('x' * 262144) + '"}'
$oversizedResult = Invoke-Oracle $oversized
if ($oversizedResult.Value.error.code -ne "INPUT_TOO_LARGE") {
  throw "oversized physical line was not bounded before parsing"
}
$outputLimited = $basic | ConvertFrom-Json
$outputLimited | Add-Member -NotePropertyName limits -NotePropertyValue ([pscustomobject]@{
  maxOutputBytes = 512
})
$outputLimitedResult = Invoke-Oracle ($outputLimited | ConvertTo-Json -Compress -Depth 20)
if ($outputLimitedResult.Value.status -ne "UNSUPPORTED" -or
    $outputLimitedResult.Value.error.code -ne "OUTPUT_LIMIT") {
  throw "total response-byte limit was not enforced"
}
if ([Text.Encoding]::UTF8.GetByteCount($outputLimitedResult.Raw) -gt 512) {
  throw "OUTPUT_LIMIT response exceeded its configured byte limit"
}

$largeRequestId = $basic | ConvertFrom-Json
$largeRequestId.requestId = 'r' * 4096
$largeRequestId | Add-Member -NotePropertyName limits -NotePropertyValue ([pscustomobject]@{
  maxOutputBytes = 512
})
$largeRequestIdResult = Invoke-Oracle ($largeRequestId | ConvertTo-Json -Compress -Depth 20)
if ($largeRequestIdResult.Value.status -ne "FAILED" -or
    $largeRequestIdResult.Value.error.code -ne "OUTPUT_LIMIT") {
  throw "large requestId did not produce a bounded OUTPUT_LIMIT response"
}
if ([Text.Encoding]::UTF8.GetByteCount($largeRequestIdResult.Raw) -gt 512) {
  throw "fallback OUTPUT_LIMIT response exceeded its configured byte limit"
}
if ($null -ne $largeRequestIdResult.Value.requestId) {
  throw "bounded OUTPUT_LIMIT fallback retained an oversized requestId"
}

$catalog = $basic | ConvertFrom-Json
$catalog.schema.tables[0] | Add-Member -NotePropertyName catalog -NotePropertyValue "CATALOG_A"
$catalogRequest = $catalog | ConvertTo-Json -Compress -Depth 20
$catalogResult = Invoke-Oracle $catalogRequest
if ($catalogResult.Value.status -ne "UNSUPPORTED" -or
    $catalogResult.Value.error.code -ne "CATALOG_UNSUPPORTED") {
  throw "catalog handling is not explicit"
}

$unsupported = $basic | ConvertFrom-Json
$unsupported.sql = "UPDATE APP.orders SET amount = 1"
$unsupportedResult = Invoke-Oracle ($unsupported | ConvertTo-Json -Compress -Depth 20)
if ($unsupportedResult.Value.status -ne "UNSUPPORTED") {
  throw "deliberately unsupported SQL was not classified as UNSUPPORTED"
}
$planner = $basic | ConvertFrom-Json
$planner.sql = "SELECT missing_column FROM APP.orders"
$plannerResult = Invoke-Oracle ($planner | ConvertTo-Json -Compress -Depth 20)
if ($plannerResult.Value.status -ne "FAILED" -or
    $plannerResult.Value.error.code -ne "PLANNER_FAILURE") {
  throw "planner failure was not distinguished from unsupported capability"
}

"Calcite oracle runtime checks passed"

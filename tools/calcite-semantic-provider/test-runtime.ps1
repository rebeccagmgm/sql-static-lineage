$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$repoRoot = (Resolve-Path (Join-Path $toolRoot "../..")).Path
$source = Join-Path $toolRoot "src/main/java/com/gf/sqlstaticlineage/calcitesemanticprovider/CalciteSemanticProvider.java"
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"

if (-not (Get-Command javac -ErrorAction SilentlyContinue)) { throw "javac is required" }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw "java is required" }
$calciteJar = Join-Path $m2Root "org/apache/calcite/calcite-core/1.42.0/calcite-core-1.42.0.jar"
if (-not (Test-Path $calciteJar)) { throw "locked Calcite 1.42.0 is missing" }

New-Item -ItemType Directory -Force -Path $classes | Out-Null
$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File | Select-Object -ExpandProperty FullName)
$classpath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $classpath -d $classes $source
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

function Invoke-Provider([string] $json) {
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
  [void]$process.Start()
  $process.StandardInput.WriteLine($json.TrimEnd("`r", "`n"))
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Provider failed: $stderr" }
  $lines = @($stdout -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith("{") })
  if ($lines.Count -ne 1) { throw "expected exactly one JSON response" }
  return [pscustomobject]@{ Raw = $lines[0]; Value = ($lines[0] | ConvertFrom-Json) }
}

$basic = Get-Content (Join-Path $repoRoot "tests/fixtures/calcite-semantic-provider/basic-request.json") -Raw
$first = Invoke-Provider $basic
$second = Invoke-Provider $basic
if ($first.Value.status -ne "SUCCESS") { throw "basic request failed" }
if ($first.Raw -cne $second.Raw) { throw "response is not deterministic" }
if ($first.Value.facts.schemaVersion -ne "0.1.0-poc") { throw "candidate facts missing" }
$dependencyKinds = @($first.Value.facts.dependencies | Select-Object -ExpandProperty dependencyKind -Unique)
if ($dependencyKinds -notcontains "EXPRESSION_SELECTOR") { throw "CASE selector dependency missing" }
if (@($first.Value.facts.evidenceMappings | Where-Object { $_.mappingStatus -ne "UNMAPPABLE" }).Count -ne 0) {
  throw "provider must not guess Native evidence mapping"
}
$rowCountMetadata = @($first.Value.facts.metadata | Where-Object { $_.kind -eq "ROW_COUNT" })
if ($rowCountMetadata.Count -eq 0 -or
    @($rowCountMetadata | Where-Object { $_.evaluationStatus -eq "EVALUATED" -and $_.knowledgeStatus -ne "ESTIMATED" }).Count -ne 0) {
  throw "row count metadata must remain estimated"
}
if (@($first.Value.facts.metadata | Where-Object { $_.absenceProven -eq $true }).Count -ne 0) {
  throw "Calcite metadata must not manufacture closed-world negative proof"
}
$filter = $basic | ConvertFrom-Json
$filter.sql = "SELECT o.amount FROM APP.orders o WHERE o.amount > 0"
$filterResult = Invoke-Provider ($filter | ConvertTo-Json -Compress -Depth 20)
$filterKinds = @($filterResult.Value.facts.dependencies | Select-Object -ExpandProperty dependencyKind -Unique)
if ($filterKinds -notcontains "FILTER_PREDICATE") { throw "filter dependency missing" }
$malformed = Invoke-Provider '{"protocolVersion":1'
if ($malformed.Value.status -ne "ERROR" -or $malformed.Value.error.code -ne "JSON_INVALID") { throw "malformed JSON boundary failed" }
$unsupported = $basic | ConvertFrom-Json
$unsupported.sql = "UPDATE APP.orders SET amount = 1"
$unsupportedResult = Invoke-Provider ($unsupported | ConvertTo-Json -Compress -Depth 20)
if ($unsupportedResult.Value.status -ne "UNSUPPORTED") { throw "unsupported SQL boundary failed" }

$unsupportedFunction = $basic | ConvertFrom-Json
$unsupportedFunction.sql = "SELECT missing_hive_udf(o.amount) FROM APP.orders o"
$unsupportedFunctionResult = Invoke-Provider ($unsupportedFunction | ConvertTo-Json -Compress -Depth 20)
if ($unsupportedFunctionResult.Value.status -ne "UNSUPPORTED" -or
    $unsupportedFunctionResult.Value.error.code -ne "FUNCTION_UNSUPPORTED") {
  throw "unsupported function must fail closed"
}

$missingType = $basic | ConvertFrom-Json
$missingType.schema.tables[0].columns[0].PSObject.Properties.Remove("type")
$missingTypeResult = Invoke-Provider ($missingType | ConvertTo-Json -Compress -Depth 20)
if ($missingTypeResult.Value.status -ne "ERROR" -or
    $missingTypeResult.Value.error.code -ne "INPUT_STRING_REQUIRED") {
  throw "missing schema type boundary failed"
}

$selfJoin = $basic | ConvertFrom-Json
$selfJoin.sql = "SELECT a.amount FROM APP.orders a JOIN APP.orders b ON a.order_id = b.order_id"
$selfJoinResult = Invoke-Provider ($selfJoin | ConvertTo-Json -Compress -Depth 20)
$selfJoinScans = @($selfJoinResult.Value.facts.relations | Where-Object {
  $_.kind -eq "TABLE_SCAN" -and $_.qualifiedTableName.ToLowerInvariant() -eq "app.orders"
})
if ($selfJoinScans.Count -ne 2 -or $selfJoinScans[0].relationId -eq $selfJoinScans[1].relationId) {
  throw "self join occurrences were not isolated"
}

$smallOutput = $basic | ConvertFrom-Json
$smallOutput.limits.maxOutputBytes = 512
$smallOutputResult = Invoke-Provider ($smallOutput | ConvertTo-Json -Compress -Depth 20)
if ($smallOutputResult.Value.status -ne "UNSUPPORTED" -or
    $smallOutputResult.Value.error.code -ne "OUTPUT_LIMIT") {
  throw "configured output limit boundary failed"
}

$smallPlan = $basic | ConvertFrom-Json
$smallPlan.limits | Add-Member -NotePropertyName maxRelNodes -NotePropertyValue 1
$smallPlanResult = Invoke-Provider ($smallPlan | ConvertTo-Json -Compress -Depth 20)
if ($smallPlanResult.Value.status -ne "UNSUPPORTED" -or
    $smallPlanResult.Value.error.code -ne "RELNODE_LIMIT") {
  throw "configured RelNode limit boundary failed"
}

$limitedMetadata = $basic | ConvertFrom-Json
$limitedMetadata.requestedMetadata = @("tableOccurrences")
$limitedMetadataResult = Invoke-Provider ($limitedMetadata | ConvertTo-Json -Compress -Depth 20)
$uniqueCapability = @($limitedMetadataResult.Value.facts.capabilities | Where-Object {
  $_.capability -eq "UNIQUE_KEYS"
})[0]
if ($uniqueCapability.evaluationStatus -ne "NOT_EVALUATED" -or
    @($limitedMetadataResult.Value.facts.metadata | Where-Object { $_.kind -eq "UNIQUE_KEYS" }).Count -ne 0) {
  throw "unrequested metadata must remain explicitly not evaluated"
}

"Calcite semantic provider runtime checks passed"

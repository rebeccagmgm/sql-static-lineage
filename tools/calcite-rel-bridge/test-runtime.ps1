$ErrorActionPreference = "Stop"

$toolRoot = (Resolve-Path $PSScriptRoot).Path
$sources = @(Get-ChildItem (Join-Path $toolRoot "src/main/java") -Recurse -Filter *.java -File |
  Select-Object -ExpandProperty FullName)
$classes = Join-Path $toolRoot "target/classes"
$m2Root = Join-Path $env:USERPROFILE ".m2/repository"

if (-not (Get-Command javac -ErrorAction SilentlyContinue)) { throw "javac is required" }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw "java is required" }
if (-not (Test-Path (Join-Path $m2Root "org/apache/calcite/calcite-core/1.42.0/calcite-core-1.42.0.jar"))) {
  throw "locked Calcite 1.42.0 dependency is not present in the local Maven cache"
}

New-Item -ItemType Directory -Force -Path $classes | Out-Null
$dependencyJars = @(Get-ChildItem $m2Root -Recurse -Filter *.jar -File | Select-Object -ExpandProperty FullName)
$classpath = [string]::Join([IO.Path]::PathSeparator, @($classes) + $dependencyJars)
& javac -encoding UTF-8 -source 8 -target 8 -cp $classpath -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

function Invoke-Bridge([string] $json) {
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = (Get-Command java).Source
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.Arguments = '-cp "' + $classpath + '" com.gf.sqlstaticlineage.calciterelbridge.CalciteRelBridge'
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $process.StandardInput.WriteLine($json.TrimEnd("`r", "`n"))
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "bridge exited $($process.ExitCode): $stderr" }
  $unexpectedStderr = @($stderr -split "`r?`n" | Where-Object {
    $_.Trim() -and -not $_.StartsWith("SLF4J:")
  })
  if ($unexpectedStderr.Count -gt 0) {
    throw "bridge wrote unexpected diagnostics to stderr: $($unexpectedStderr -join '; ')"
  }
  $lines = @($stdout -split "`r?`n" | Where-Object { $_.Trim() })
  if ($lines.Count -ne 1) { throw "expected exactly one JSONL response" }
  $value = $lines[0] | ConvertFrom-Json
  if ($value.requestKind -notin @("RAW_SQL_V1", "PLAN_FACTS_REL_V1")) {
    throw "response requestKind is not protocol-valid"
  }
  if ($null -eq $value.fingerprint -or [string]::IsNullOrEmpty($value.fingerprint.inputFingerprint)) {
    throw "response fingerprint.inputFingerprint is missing"
  }
  foreach ($issue in @($value.issues)) {
    if ($issue.severity -notin @("ERROR", "WARNING")) {
      throw "response issue severity is missing or invalid"
    }
  }
  return [pscustomobject]@{ Raw = $lines[0]; Value = $value }
}

function Get-RequestFingerprint([string] $json) {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $nodeScript = @'
const crypto = require('node:crypto');
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
delete input.fingerprint;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}
process.stdout.write(crypto.createHash('sha256')
  .update(JSON.stringify(stable(input)), 'utf8').digest('hex'));
'@
  $fingerprint = $json | & $nodeCommand.Source -e $nodeScript
  if ($LASTEXITCODE -ne 0) { throw "failed to calculate request fingerprint" }
  $result = ($fingerprint -join "").Trim()
  if (-not $result) { throw "request fingerprint calculation returned empty output" }
  return $result
}

function Convert-ToFingerprintedJson([object] $request) {
  $requestJson = $request | ConvertTo-Json -Compress -Depth 40
  $fingerprint = Get-RequestFingerprint $requestJson
  if ($request.PSObject.Properties.Name -contains "fingerprint") {
    $request.fingerprint = $fingerprint
  } else {
    $request | Add-Member -Force -NotePropertyName fingerprint -NotePropertyValue $fingerprint
  }
  return ($request | ConvertTo-Json -Compress -Depth 40)
}

$valid = '{"protocolVersion":1,"requestKind":"PLAN_FACTS_REL_V1","fingerprint":"fixture-hash","graphVersion":1,"taskId":"task-1","statementId":"statement-1","schema":{"tables":[]},"relations":[],"roots":[],"mappings":[]}'
$valid = Convert-ToFingerprintedJson ($valid | ConvertFrom-Json)
$first = Invoke-Bridge $valid
$second = Invoke-Bridge $valid
if ($first.Value.status -ne "SUCCESS" -or $first.Value.issues.Count -ne 0) {
  throw "valid empty Plan Facts graph did not succeed"
}
if ($first.Raw -cne $second.Raw) { throw "response is not deterministic" }
if ($first.Value.fingerprint.calciteVersion -ne "1.42.0") { throw "Calcite version fingerprint is missing" }

$staleRequest = $valid | ConvertFrom-Json
$staleRequest.taskId = "stale-task"
$stale = Invoke-Bridge ($staleRequest | ConvertTo-Json -Compress -Depth 40)
if ($stale.Value.status -ne "FAILED" -or $stale.Value.issues[0].code -ne "REQUEST_FINGERPRINT_MISMATCH") {
  throw "stale Plan Facts fingerprint was not rejected"
}

$missingFingerprintRequest = $valid | ConvertFrom-Json
$missingFingerprintRequest.PSObject.Properties.Remove("fingerprint")
$missingFingerprint = Invoke-Bridge ($missingFingerprintRequest | ConvertTo-Json -Compress -Depth 40)
if ($missingFingerprint.Value.status -ne "FAILED" -or $missingFingerprint.Value.issues[0].code -ne "REQUEST_FINGERPRINT_MISSING") {
  throw "missing Plan Facts fingerprint was not rejected"
}

$unsupportedKind = Invoke-Bridge '{"protocolVersion":1,"requestKind":"NOT_SUPPORTED","fingerprint":"stale"}'
if ($unsupportedKind.Value.status -ne "UNSUPPORTED" -or $unsupportedKind.Value.requestKind -ne "PLAN_FACTS_REL_V1" -or $unsupportedKind.Value.issues[0].severity -ne "WARNING") {
  throw "unsupported request did not return a protocol-valid bounded response"
}

$core = @'
{"protocolVersion":1,"requestKind":"PLAN_FACTS_REL_V1","fingerprint":"core-hash","graphVersion":1,"taskId":"task-1","statementId":"statement-1","schema":{"tables":[{"schema":"APP","name":"orders","columns":[{"name":"order_id","type":"BIGINT","nullable":false},{"name":"amount","type":"DECIMAL(18,2)","nullable":true}]}]},"relations":[{"kind":"READ","nodeId":"read-1","nativeRelationId":"native-read-1","nativeRelationOccurrenceId":"occurrence-1","mappingId":"map-read","evidenceRefs":["ev-read"],"table":{"schema":"APP","name":"orders"},"outputFields":[{"ordinal":0,"name":"order_id","type":{"status":"CONCRETE","name":"BIGINT","nullable":false},"mappingId":"map-read-id","evidenceRefs":["ev-read-id"]},{"ordinal":1,"name":"amount","type":{"status":"CONCRETE","name":"DECIMAL","nullable":true,"precision":18,"scale":2},"mappingId":"map-read-amount","evidenceRefs":["ev-read-amount"]}]},{"kind":"FILTER","nodeId":"filter-1","nativeRelationId":"native-filter-1","mappingId":"map-filter","evidenceRefs":["ev-filter"],"inputNodeId":"read-1","clause":"WHERE","predicate":{"kind":"CALL","expressionId":"predicate-1","type":{"status":"CONCRETE","name":"BOOLEAN","nullable":true},"operator":">","operands":[{"kind":"FIELD_REF","expressionId":"amount-ref","type":{"status":"CONCRETE","name":"DECIMAL","nullable":true,"precision":18,"scale":2},"inputNodeId":"read-1","inputOrdinal":1,"mappingId":"map-amount-ref","evidenceRefs":["ev-amount-ref"]},{"kind":"LITERAL","expressionId":"zero","type":{"status":"CONCRETE","name":"DECIMAL","nullable":false,"precision":18,"scale":2},"value":0,"mappingId":"map-zero","evidenceRefs":["ev-zero"]}],"mappingId":"map-predicate","evidenceRefs":["ev-predicate"]},"outputFields":[{"ordinal":0,"name":"order_id","type":{"status":"CONCRETE","name":"BIGINT","nullable":false},"mappingId":"map-filter-id","evidenceRefs":["ev-filter-id"]},{"ordinal":1,"name":"amount","type":{"status":"CONCRETE","name":"DECIMAL","nullable":true,"precision":18,"scale":2},"mappingId":"map-filter-amount","evidenceRefs":["ev-filter-amount"]}]},{"kind":"PROJECT","nodeId":"project-1","nativeRelationId":"native-project-1","mappingId":"map-project","evidenceRefs":["ev-project"],"inputNodeId":"filter-1","expressions":[{"kind":"FIELD_REF","expressionId":"project-order-id","type":{"status":"CONCRETE","name":"BIGINT","nullable":false},"inputNodeId":"filter-1","inputOrdinal":0,"mappingId":"map-project-id-expr","evidenceRefs":["ev-project-id-expr"]},{"kind":"FIELD_REF","expressionId":"project-amount","type":{"status":"CONCRETE","name":"DECIMAL","nullable":true,"precision":18,"scale":2},"inputNodeId":"filter-1","inputOrdinal":1,"mappingId":"map-project-amount-expr","evidenceRefs":["ev-project-amount-expr"]}],"outputFields":[{"ordinal":0,"name":"order_id","type":{"status":"CONCRETE","name":"BIGINT","nullable":false},"mappingId":"map-project-id","evidenceRefs":["ev-project-id"]},{"ordinal":1,"name":"amount","type":{"status":"CONCRETE","name":"DECIMAL","nullable":true,"precision":18,"scale":2},"mappingId":"map-project-amount","evidenceRefs":["ev-project-amount"]}]}],"roots":["project-1"],"mappings":[{"mappingId":"map-read","nativeRelationId":"native-read-1","nativeRelationOccurrenceId":"occurrence-1","evidenceRefs":["ev-read"]},{"mappingId":"map-read-id","nativeRelationId":"native-read-1","nativeRelationOccurrenceId":"occurrence-1","nativeOutputOrdinal":0,"evidenceRefs":["ev-read-id"]},{"mappingId":"map-read-amount","nativeRelationId":"native-read-1","nativeRelationOccurrenceId":"occurrence-1","nativeOutputOrdinal":1,"evidenceRefs":["ev-read-amount"]},{"mappingId":"map-filter","nativeRelationId":"native-filter-1","nativeRelationOccurrenceId":"occurrence-1","evidenceRefs":["ev-filter"]},{"mappingId":"map-filter-id","nativeRelationId":"native-filter-1","nativeOutputOrdinal":0,"evidenceRefs":["ev-filter-id"]},{"mappingId":"map-filter-amount","nativeRelationId":"native-filter-1","nativeOutputOrdinal":1,"evidenceRefs":["ev-filter-amount"]},{"mappingId":"map-predicate","nativeRelationId":"native-filter-1","evidenceRefs":["ev-predicate"]},{"mappingId":"map-amount-ref","nativeRelationId":"native-filter-1","evidenceRefs":["ev-amount-ref"]},{"mappingId":"map-zero","nativeRelationId":"native-filter-1","evidenceRefs":["ev-zero"]},{"mappingId":"map-project","nativeRelationId":"native-project-1","nativeRelationOccurrenceId":"occurrence-1","evidenceRefs":["ev-project"]},{"mappingId":"map-project-id-expr","nativeRelationId":"native-project-1","evidenceRefs":["ev-project-id-expr"]},{"mappingId":"map-project-amount-expr","nativeRelationId":"native-project-1","evidenceRefs":["ev-project-amount-expr"]},{"mappingId":"map-project-id","nativeRelationId":"native-project-1","nativeRelationOccurrenceId":"occurrence-1","nativeOutputOrdinal":0,"evidenceRefs":["ev-project-id"]},{"mappingId":"map-project-amount","nativeRelationId":"native-project-1","nativeRelationOccurrenceId":"occurrence-1","nativeOutputOrdinal":1,"evidenceRefs":["ev-project-amount"]}]}
'@
$core = Convert-ToFingerprintedJson ($core | ConvertFrom-Json)
$coreResult = Invoke-Bridge $core
if ($coreResult.Value.status -ne "SUCCESS") { throw "core RelNode graph did not succeed: $($coreResult.Raw)" }
$coreKinds = @($coreResult.Value.observations | Select-Object -ExpandProperty kind -Unique)
foreach ($kind in @("tableOccurrences", "expressionLineage", "predicates")) {
  if ($coreKinds -notcontains $kind) { throw "core metadata observation missing: $kind" }
}
if ($coreResult.Value.mappingRefs.Count -ne 14) { throw "mapping round trip changed the request mappings" }

$missingTypeRequest = $core | ConvertFrom-Json
$missingTypeRequest.schema.tables[0].columns[0].type = ""
$missingType = Invoke-Bridge (Convert-ToFingerprintedJson $missingTypeRequest)
if ($missingType.Value.status -ne "FAILED" -or $missingType.Value.issues[0].code -ne "SCHEMA_COLUMN_INVALID") {
  throw "missing schema type was not rejected"
}

$malformedTypeRequest = $core | ConvertFrom-Json
$malformedTypeRequest.schema.tables[0].columns[1].type = "DECIMAL(foo)"
$malformedType = Invoke-Bridge (Convert-ToFingerprintedJson $malformedTypeRequest)
if ($malformedType.Value.status -ne "FAILED" -or $malformedType.Value.issues[0].code -ne "TYPE_UNSUPPORTED") {
  throw "malformed schema type parameters were not rejected"
}

$badOrdinalRequest = $core | ConvertFrom-Json
$badOrdinalRequest.relations[2].expressions[0].inputOrdinal = 99
$badOrdinal = Invoke-Bridge (Convert-ToFingerprintedJson $badOrdinalRequest)
if ($badOrdinal.Value.status -ne "FAILED" -or $badOrdinal.Value.issues[0].code -ne "FIELD_REF_ORDINAL_INVALID") {
  throw "out-of-range field reference ordinal was not rejected"
}

$badOutputOrdinalRequest = $core | ConvertFrom-Json
$badOutputOrdinalRequest.relations[2].outputFields[0].ordinal = 1
$badOutputOrdinal = Invoke-Bridge (Convert-ToFingerprintedJson $badOutputOrdinalRequest)
if ($badOutputOrdinal.Value.status -ne "FAILED" -or $badOutputOrdinal.Value.issues[0].code -ne "OUTPUT_FIELD_ORDINAL_INVALID") {
  throw "non-contiguous output field ordinal was not rejected"
}

$badEvidenceRequest = $core | ConvertFrom-Json
$badEvidenceRequest.relations[2].outputFields[0].evidenceRefs = @("ev-project-id", "")
$badEvidence = Invoke-Bridge (Convert-ToFingerprintedJson $badEvidenceRequest)
if ($badEvidence.Value.status -ne "FAILED" -or $badEvidence.Value.issues[0].code -ne "EVIDENCE_REFS_INVALID") {
  throw "malformed evidence refs were not rejected"
}

$unsupportedFunctionRequest = $core | ConvertFrom-Json
$unsupportedExpression = $unsupportedFunctionRequest.relations[2].expressions[0]
$unsupportedExpression.kind = "CALL"
$unsupportedExpression | Add-Member -Force -NotePropertyName operator -NotePropertyValue "HIVE_UDF"
$unsupportedExpression | Add-Member -Force -NotePropertyName operands -NotePropertyValue @()
$unsupportedFunction = Invoke-Bridge (Convert-ToFingerprintedJson $unsupportedFunctionRequest)
if ($unsupportedFunction.Value.status -ne "UNSUPPORTED" -or $unsupportedFunction.Value.issues[0].code -ne "OPERATOR_UNSUPPORTED") {
  throw "unsupported function was not rejected"
}

$malformedGraphRequest = $core | ConvertFrom-Json
$malformedGraphRequest.relations[2].inputNodeId = "missing-node"
$malformedGraph = Invoke-Bridge (Convert-ToFingerprintedJson $malformedGraphRequest)
if ($malformedGraph.Value.status -ne "FAILED" -or $malformedGraph.Value.issues[0].code -ne "RELATION_INPUT_DANGLING") {
  throw "malformed relation graph was not rejected"
}

$unreachableInvalidRequest = $core | ConvertFrom-Json
$unreachableInvalidRequest.relations += [pscustomobject]@{
  kind = "PROJECT"
  nodeId = "unreachable-invalid"
  nativeRelationId = "native-unreachable"
  mappingId = "map-unreachable"
  evidenceRefs = @("ev-unreachable")
  inputNodeId = "missing-unreachable-input"
  expressions = @()
  outputFields = @()
}
$unreachableInvalidRequest.mappings += [pscustomobject]@{
  mappingId = "map-unreachable"
  nativeRelationId = "native-unreachable"
  evidenceRefs = @("ev-unreachable")
}
$unreachableInvalid = Invoke-Bridge (Convert-ToFingerprintedJson $unreachableInvalidRequest)
if ($unreachableInvalid.Value.status -ne "FAILED" -or $unreachableInvalid.Value.issues[0].code -ne "RELATION_INPUT_DANGLING") {
  throw "invalid unreachable relation node was silently ignored"
}

$malformed = Invoke-Bridge '{"protocolVersion":1'
if ($malformed.Value.status -ne "FAILED" -or $malformed.Value.issues[0].code -ne "MALFORMED_JSON") {
  throw "malformed JSON was not rejected"
}

$wrongVersion = Invoke-Bridge '{"protocolVersion":2,"requestKind":"PLAN_FACTS_REL_V1","fingerprint":"x"}'
if ($wrongVersion.Value.issues[0].code -ne "PROTOCOL_VERSION_MISMATCH") { throw "version mismatch was not rejected" }

$oversized = Invoke-Bridge ('{"x":"' + ('x' * (4 * 1048576)) + '"}')
if ($oversized.Value.issues[0].code -ne "INPUT_TOO_LARGE") { throw "input byte limit was not enforced" }

$crPadded = ("`r" * 600) + '{"protocolVersion":1,"requestKind":"PLAN_FACTS_REL_V1","fingerprint":"fixture-hash","graphVersion":1,"taskId":"task-1","statementId":"statement-1","schema":{"tables":[]},"relations":[],"roots":[],"mappings":[],"limits":{"maxInputBytes":512}}'
$crLimited = Invoke-Bridge $crPadded
if ($crLimited.Value.issues[0].code -ne "INPUT_TOO_LARGE") { throw "carriage-return bytes bypassed the input limit" }

$outputLimitedRequest = $valid | ConvertFrom-Json
$outputLimitedRequest | Add-Member -Force -NotePropertyName limits -NotePropertyValue ([pscustomobject]@{ maxOutputBytes = 512 })
$outputLimited = Invoke-Bridge (Convert-ToFingerprintedJson $outputLimitedRequest)
if (([Text.Encoding]::UTF8.GetByteCount($outputLimited.Raw) + 1) -gt 512) { throw "output byte limit did not count the JSONL newline" }

$coreOutputLimitedRequest = $core | ConvertFrom-Json
$coreOutputLimitedRequest | Add-Member -Force -NotePropertyName limits -NotePropertyValue ([pscustomobject]@{ maxOutputBytes = 512 })
$coreOutputLimited = Invoke-Bridge (Convert-ToFingerprintedJson $coreOutputLimitedRequest)
if ($coreOutputLimited.Value.status -ne "FAILED" -or $coreOutputLimited.Value.issues[0].code -ne "OUTPUT_LIMIT") {
  throw "oversized response did not produce the bounded protocol fallback"
}
foreach ($required in @("protocolVersion", "status", "fingerprint", "issues", "mappingRefs", "observations")) {
  if ($null -eq $coreOutputLimited.Value.$required) { throw "bounded fallback omitted protocol field $required" }
}

# Structured expression smoke tests.  These exercise the same typed graph
# shape emitted by Plan Facts projection; no SQL text is reconstructed here.
$amountRef = [pscustomobject]@{
  kind = "FIELD_REF"
  expressionId = "case-amount-ref"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }
  inputNodeId = "filter-1"
  inputOrdinal = 1
  mappingId = "map-project-amount-expr"
  evidenceRefs = @("ev-project-amount-expr")
}
$zeroLiteral = [pscustomobject]@{
  kind = "LITERAL"
  expressionId = "case-zero"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $false }
  value = 0
  mappingId = "map-zero"
  evidenceRefs = @("ev-zero")
}
$positiveCondition = [pscustomobject]@{
  kind = "CALL"
  expressionId = "case-positive"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "BOOLEAN"; nullable = $true }
  operator = ">"
  operands = @($amountRef, $zeroLiteral)
  mappingId = "map-predicate"
  evidenceRefs = @("ev-predicate")
}
$caseRequest = $core | ConvertFrom-Json
$caseExpression = [pscustomobject]@{
  kind = "CASE"
  expressionId = "case-amount"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }
  branches = @([pscustomobject]@{ ordinal = 0; selector = $positiveCondition; result = $amountRef })
  elseResult = $zeroLiteral
  mappingId = "map-project-amount-expr"
  evidenceRefs = @("ev-project-amount-expr")
}
$caseRequest.relations[2].expressions = @($caseExpression)
$caseResult = Invoke-Bridge (Convert-ToFingerprintedJson $caseRequest)
if ($caseResult.Value.status -ne "SUCCESS") { throw "typed CASE graph did not succeed: $($caseResult.Raw)" }

$ifRequest = $core | ConvertFrom-Json
$ifExpression = [pscustomobject]@{
  kind = "CALL"
  expressionId = "if-amount"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }
  operator = "IF"
  operands = @($positiveCondition, $amountRef, $zeroLiteral)
  mappingId = "map-project-amount-expr"
  evidenceRefs = @("ev-project-amount-expr")
}
$ifRequest.relations[2].expressions = @($ifExpression)
$ifResult = Invoke-Bridge (Convert-ToFingerprintedJson $ifRequest)
if ($ifResult.Value.status -ne "SUCCESS") { throw "typed IF graph did not succeed: $($ifResult.Raw)" }

$coalesceRequest = $core | ConvertFrom-Json
$coalesceExpression = [pscustomobject]@{
  kind = "CALL"
  expressionId = "coalesce-amount"
  type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }
  operator = "COALESCE"
  operands = @($amountRef, $zeroLiteral)
  mappingId = "map-project-amount-expr"
  evidenceRefs = @("ev-project-amount-expr")
}
$coalesceRequest.relations[2].expressions = @($coalesceExpression)
$coalesceResult = Invoke-Bridge (Convert-ToFingerprintedJson $coalesceRequest)
if ($coalesceResult.Value.status -ne "SUCCESS") { throw "typed COALESCE graph did not succeed: $($coalesceResult.Raw)" }

# JOIN + aggregate smoke test.  The mapping/ordinal identities are explicit;
# the bridge must not infer them from field names or SQL text.
$joinRequest = $core | ConvertFrom-Json
$joinRead = [pscustomobject]@{
  kind = "READ"; nodeId = "read-2"; nativeRelationId = "native-read-2"; nativeRelationOccurrenceId = "occurrence-2"; mappingId = "map-read-2"; evidenceRefs = @("ev-read-2");
  table = [pscustomobject]@{ schema = "APP"; name = "orders" };
  outputFields = @(
    [pscustomobject]@{ ordinal = 0; name = "order_id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; mappingId = "map-read-2-id"; evidenceRefs = @("ev-read-2-id") },
    [pscustomobject]@{ ordinal = 1; name = "amount"; type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }; mappingId = "map-read-2-amount"; evidenceRefs = @("ev-read-2-amount") }
  )
}
$joinFieldLeft = [pscustomobject]@{ kind = "FIELD_REF"; expressionId = "join-left-id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; inputNodeId = "read-1"; inputOrdinal = 0; mappingId = "map-join-left-id"; evidenceRefs = @("ev-join-left-id") }
$joinFieldRight = [pscustomobject]@{ kind = "FIELD_REF"; expressionId = "join-right-id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; inputNodeId = "read-2"; inputOrdinal = 0; mappingId = "map-join-right-id"; evidenceRefs = @("ev-join-right-id") }
$joinCondition = [pscustomobject]@{ kind = "CALL"; expressionId = "join-condition"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BOOLEAN"; nullable = $true }; operator = "="; operands = @($joinFieldLeft, $joinFieldRight); mappingId = "map-join-condition"; evidenceRefs = @("ev-join-condition") }
$joinOutputs = @(
  [pscustomobject]@{ ordinal = 0; name = "order_id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; mappingId = "map-join-0"; evidenceRefs = @("ev-join-0") },
  [pscustomobject]@{ ordinal = 1; name = "amount"; type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }; mappingId = "map-join-1"; evidenceRefs = @("ev-join-1") },
  [pscustomobject]@{ ordinal = 2; name = "order_id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; mappingId = "map-join-2"; evidenceRefs = @("ev-join-2") },
  [pscustomobject]@{ ordinal = 3; name = "amount"; type = [pscustomobject]@{ status = "CONCRETE"; name = "DECIMAL"; precision = 18; scale = 2; nullable = $true }; mappingId = "map-join-3"; evidenceRefs = @("ev-join-3") }
)
$joinNode = [pscustomobject]@{ kind = "JOIN"; nodeId = "join-1"; nativeRelationId = "native-join-1"; mappingId = "map-join"; evidenceRefs = @("ev-join"); leftNodeId = "read-1"; rightNodeId = "read-2"; joinType = "LEFT"; condition = $joinCondition; outputFields = $joinOutputs }
$aggregateGroup = [pscustomobject]@{ kind = "FIELD_REF"; expressionId = "aggregate-group"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; inputNodeId = "read-1"; inputOrdinal = 0; mappingId = "map-aggregate-group"; evidenceRefs = @("ev-aggregate-group") }
$aggregateCount = [pscustomobject]@{ kind = "CALL"; expressionId = "aggregate-count"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; operator = "COUNT"; operands = @(); mappingId = "map-aggregate-count"; evidenceRefs = @("ev-aggregate-count") }
$aggregateNode = [pscustomobject]@{ kind = "AGGREGATE"; nodeId = "aggregate-1"; nativeRelationId = "native-aggregate-1"; mappingId = "map-aggregate"; evidenceRefs = @("ev-aggregate"); inputNodeId = "read-1"; groupKeys = @($aggregateGroup); measures = @($aggregateCount); outputFields = @(
  [pscustomobject]@{ ordinal = 0; name = "order_id"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; mappingId = "map-aggregate-0"; evidenceRefs = @("ev-aggregate-0") },
  [pscustomobject]@{ ordinal = 1; name = "row_count"; type = [pscustomobject]@{ status = "CONCRETE"; name = "BIGINT"; nullable = $false }; mappingId = "map-aggregate-1"; evidenceRefs = @("ev-aggregate-1") }
) }
$joinRequest.relations += $joinRead
$joinRequest.relations += $joinNode
$joinRequest.relations += $aggregateNode
$joinRequest.roots = @("join-1", "aggregate-1")
$joinResult = Invoke-Bridge (Convert-ToFingerprintedJson $joinRequest)
if ($joinResult.Value.status -ne "SUCCESS") { throw "JOIN/aggregate graph did not succeed: $($joinResult.Raw)" }
$joinKinds = @($joinResult.Value.observations | Select-Object -ExpandProperty kind -Unique)
foreach ($requiredKind in @("predicates", "uniqueKeys", "functionalDependencies", "rowCountCardinality")) {
  if ($joinKinds -notcontains $requiredKind) { throw "JOIN/aggregate metadata observation missing: $requiredKind" }
}

"Calcite Rel bridge boundary checks passed"

package com.gf.sqlstaticlineage.calciterelbridge;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Bounded, JSONL-only process boundary for the optional Calcite RelNode lane. */
public final class CalciteRelBridge {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final int PROTOCOL_VERSION = 1;
  private static final int HARD_MAX_INPUT_BYTES = 4 * 1048576;
  private static final int HARD_MAX_OUTPUT_BYTES = 4 * 1048576;
  private static final int MIN_OUTPUT_BYTES = 512;
  private static final String DEFAULT_REQUEST_KIND = "PLAN_FACTS_REL_V1";
  private static final String UNAVAILABLE_INPUT_FINGERPRINT = "UNAVAILABLE";
  private static final int HARD_MAX_TABLES = 128;
  private static final int HARD_MAX_COLUMNS = 256;
  private static final int HARD_MAX_PLAN_NODES = 1024;
  private static final int HARD_MAX_MAPPINGS = 8192;
  private static final String CALCITE_VERSION = "1.42.0";
  private static final String BUILD_FINGERPRINT =
      "calcite-rel-bridge/0.1.0;calcite/1.42.0;protocol/1";
  private static final Pattern CONCRETE_TYPE = Pattern.compile(
      "^(TINYINT|SMALLINT|INTEGER|BIGINT|FLOAT|REAL|DOUBLE|BOOLEAN|VARCHAR|CHAR|VARBINARY|DATE|TIME|TIMESTAMP|DECIMAL)(?:\\((\\d+)(?:,(\\d+))?\\))?$");

  private CalciteRelBridge() {
  }

  public static void main(String[] args) throws IOException {
    BoundedLineReader reader = new BoundedLineReader(System.in, HARD_MAX_INPUT_BYTES);
    OutputStream output = System.out;
    BoundedLine line;
    while ((line = reader.nextLine()) != null) {
      ProcessResult result = process(line);
      byte[] encoded = serializeBounded(result.response, result.maxOutputBytes)
          .getBytes(StandardCharsets.UTF_8);
      output.write(encoded);
      output.write('\n');
      output.flush();
    }
  }

  static ProcessResult process(BoundedLine line) {
    if (line.tooLarge) {
      return failed(null, null, null, "INPUT_TOO_LARGE",
          "JSONL physical line exceeds the 4 MiB hard limit", HARD_MAX_OUTPUT_BYTES);
    }
    if (line.decodeError) {
      return failed(null, null, null, "INVALID_UTF8",
          "JSONL input must be valid UTF-8", HARD_MAX_OUTPUT_BYTES);
    }
    if (line.text.trim().isEmpty()) {
      return failed(null, null, null, "INPUT_EMPTY",
          "JSONL input line is empty", HARD_MAX_OUTPUT_BYTES);
    }

    JsonNode parsed;
    try {
      parsed = JSON.readTree(line.text);
    } catch (JsonProcessingException error) {
      return failed(null, null, null, "MALFORMED_JSON",
          "JSONL input is not valid JSON", HARD_MAX_OUTPUT_BYTES);
    }
    if (parsed == null || !parsed.isObject()) {
      return failed(null, null, null, "REQUEST_NOT_OBJECT",
          "Differential request must be a JSON object", HARD_MAX_OUTPUT_BYTES);
    }

    ObjectNode request = (ObjectNode) parsed;
    String requestId = optionalText(request, "requestId");
    String requestKind = optionalText(request, "requestKind");
    String inputFingerprint = optionalText(request, "fingerprint");
    int maxOutputBytes;
    try {
      maxOutputBytes = boundedLimit(request.path("limits"), "maxOutputBytes",
          HARD_MAX_OUTPUT_BYTES, MIN_OUTPUT_BYTES);
      int maxInputBytes = boundedLimit(request.path("limits"), "maxInputBytes",
          HARD_MAX_INPUT_BYTES, 1);
      if (line.byteLength > maxInputBytes) {
        return failed(requestId, requestKind, inputFingerprint, "INPUT_TOO_LARGE",
            "JSONL line exceeds the configured input limit", maxOutputBytes);
      }
    } catch (ValidationError error) {
      return failed(requestId, requestKind, inputFingerprint, error.code,
          error.getMessage(), HARD_MAX_OUTPUT_BYTES);
    }

    if (!request.path("protocolVersion").canConvertToInt()
        || request.path("protocolVersion").asInt() != PROTOCOL_VERSION) {
      return failed(requestId, requestKind, inputFingerprint,
          "PROTOCOL_VERSION_MISMATCH", "protocolVersion must be 1", maxOutputBytes);
    }
    if (!"RAW_SQL_V1".equals(requestKind) && !"PLAN_FACTS_REL_V1".equals(requestKind)) {
      return unsupported(requestId, requestKind, inputFingerprint,
          "UNSUPPORTED_REQUEST_KIND", "requestKind is outside protocol v1", maxOutputBytes);
    }
    if (inputFingerprint == null || inputFingerprint.isEmpty()) {
      return failed(requestId, requestKind, inputFingerprint,
          "REQUEST_FINGERPRINT_MISSING", "request fingerprint is required", maxOutputBytes);
    }

    try {
      if ("PLAN_FACTS_REL_V1".equals(requestKind)) {
        validateCanonicalPlanFactsFingerprint(request, inputFingerprint);
      }
      validateSchema(request.path("schema"), request.path("limits"));
      if ("PLAN_FACTS_REL_V1".equals(requestKind)) {
        validatePlanFactsEnvelope(request);
        PlanFactsRelExecutor.ExecutionResult execution =
            PlanFactsRelExecutor.execute(JSON, request);
        return successful(requestId, requestKind, inputFingerprint,
            request.path("mappings"), execution.observations, maxOutputBytes);
      }
      if (!request.path("sql").isTextual() || request.path("sql").asText().isEmpty()) {
        throw new ValidationError("RAW_SQL_MISSING", "RAW_SQL_V1 requires sql");
      }
      return unsupported(requestId, requestKind, inputFingerprint,
          "RAW_SQL_LANE_NOT_IMPLEMENTED",
          "The RelNode bridge does not parse raw SQL", maxOutputBytes);
    } catch (ValidationError error) {
      return failed(requestId, requestKind, inputFingerprint, error.code,
          error.getMessage(), maxOutputBytes);
    } catch (UnsupportedError error) {
      return unsupported(requestId, requestKind, inputFingerprint, error.code,
          error.getMessage(), maxOutputBytes);
    } catch (RuntimeException error) {
      return failed(requestId, requestKind, inputFingerprint,
          "CALCITE_EXECUTION_FAILED", "Calcite execution failed safely", maxOutputBytes);
    }
  }

  /**
   * PLAN_FACTS_REL_V1 fingerprints are the SHA-256 of the stable JSON request
   * with the top-level fingerprint field removed.  This check is deliberately
   * before RelNode construction so stale or tampered Plan Facts cannot be
   * attributed to a Calcite response.
   */
  private static void validateCanonicalPlanFactsFingerprint(ObjectNode request,
      String inputFingerprint) {
    String expected = canonicalRequestFingerprint(request);
    if (!expected.equals(inputFingerprint)) {
      throw new ValidationError("REQUEST_FINGERPRINT_MISMATCH",
          "fingerprint must equal SHA-256 of the canonical request with fingerprint removed");
    }
  }

  private static String canonicalRequestFingerprint(ObjectNode request) {
    ObjectNode withoutFingerprint = request.deepCopy();
    withoutFingerprint.remove("fingerprint");
    try {
      String canonical = JSON.writeValueAsString(canonicalize(withoutFingerprint));
      return sha256Hex(canonical.getBytes(StandardCharsets.UTF_8));
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("cannot serialize canonical request", error);
    }
  }

  private static JsonNode canonicalize(JsonNode value) {
    if (value == null || value.isValueNode()) return value;
    if (value.isArray()) {
      ArrayNode result = JSON.createArrayNode();
      for (JsonNode item : value) result.add(canonicalize(item));
      return result;
    }
    ObjectNode result = JSON.createObjectNode();
    ArrayList<String> names = new ArrayList<String>();
    java.util.Iterator<String> fields = value.fieldNames();
    while (fields.hasNext()) names.add(fields.next());
    Collections.sort(names);
    for (String name : names) result.set(name, canonicalize(value.get(name)));
    return result;
  }

  private static String sha256Hex(byte[] value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
      StringBuilder hex = new StringBuilder(digest.length * 2);
      for (byte item : digest) hex.append(String.format(Locale.ROOT, "%02x", item & 0xff));
      return hex.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 is unavailable", error);
    }
  }

  private static void validatePlanFactsEnvelope(ObjectNode request) {
    if (request.path("graphVersion").asInt(-1) != 1) {
      throw new ValidationError("GRAPH_VERSION_MISMATCH", "graphVersion must be 1");
    }
    requiredText(request, "taskId");
    requiredText(request, "statementId");
    ArrayNode relations = requiredArray(request, "relations");
    ArrayNode roots = requiredArray(request, "roots");
    ArrayNode mappings = requiredArray(request, "mappings");
    JsonNode limits = request.path("limits");
    int maxNodes = boundedLimit(limits, "maxPlanNodes", HARD_MAX_PLAN_NODES, 1);
    int maxMappings = boundedLimit(limits, "maxMappingRefs", HARD_MAX_MAPPINGS, 1);
    if (relations.size() > maxNodes) {
      throw new ValidationError("PLAN_NODE_LIMIT_EXCEEDED", "relations exceeds maxPlanNodes");
    }
    if (mappings.size() > maxMappings) {
      throw new ValidationError("MAPPING_LIMIT_EXCEEDED", "mappings exceeds maxMappingRefs");
    }
    Map<String, JsonNode> mappingById = new LinkedHashMap<String, JsonNode>();
    for (JsonNode mapping : mappings) {
      if (!mapping.isObject())
        throw new ValidationError("MAPPING_INVALID", "mapping must be an object");
      String mappingId = requiredText((ObjectNode) mapping, "mappingId");
      requiredText((ObjectNode) mapping, "nativeRelationId");
      validateEvidenceArray(mapping.path("evidenceRefs"));
      if (mappingById.put(mappingId, mapping) != null)
        throw new ValidationError("MAPPING_ID_DUPLICATE", "duplicate mappingId " + mappingId);
    }
    for (JsonNode relation : relations) {
      if (!relation.isObject()) {
        throw new ValidationError("RELATION_NODE_INVALID", "relation node must be an object");
      }
      requiredText((ObjectNode) relation, "nodeId");
      requiredText((ObjectNode) relation, "nativeRelationId");
      requiredText((ObjectNode) relation, "mappingId");
      requiredArray((ObjectNode) relation, "evidenceRefs");
      requiredArray((ObjectNode) relation, "outputFields");
      validateMappedObjects(relation, requiredText((ObjectNode) relation, "nativeRelationId"),
          mappingById, null);
    }
    for (JsonNode root : roots) {
      if (!root.isTextual() || root.asText().isEmpty()) {
        throw new ValidationError("RELATION_ROOTS_INVALID", "roots must contain non-empty ids");
      }
    }
  }

  private static void validateMappedObjects(JsonNode value, String nativeRelationId,
      Map<String, JsonNode> mappings, Integer expectedOutputOrdinal) {
    if (value.isArray()) {
      for (JsonNode item : value)
        validateMappedObjects(item, nativeRelationId, mappings, null);
      return;
    }
    if (!value.isObject()) return;
    if (value.path("mappingId").isTextual()) {
      String mappingId = value.path("mappingId").asText();
      JsonNode mapping = mappings.get(mappingId);
      if (mapping == null)
        throw new ValidationError("MAPPING_REF_DANGLING", "missing mapping " + mappingId);
      if (!nativeRelationId.equals(mapping.path("nativeRelationId").asText()))
        throw new ValidationError("MAPPING_RELATION_ID_MISMATCH",
            "mapping nativeRelationId does not match its graph object");
      validateEvidenceArray(value.path("evidenceRefs"));
      if (!value.path("evidenceRefs").equals(mapping.path("evidenceRefs")))
        throw new ValidationError("MAPPING_EVIDENCE_MISMATCH",
            "mapping evidenceRefs must exactly match its graph object");
      if (expectedOutputOrdinal != null
          && (!mapping.path("nativeOutputOrdinal").canConvertToInt()
              || mapping.path("nativeOutputOrdinal").asInt() != expectedOutputOrdinal.intValue()))
        throw new ValidationError("MAPPING_OUTPUT_ORDINAL_MISMATCH",
            "mapping nativeOutputOrdinal does not match its output field");
      if (value.path("nativeFieldId").isTextual()
          && !value.path("nativeFieldId").asText().equals(mapping.path("nativeFieldId").asText()))
        throw new ValidationError("MAPPING_FIELD_ID_MISMATCH",
            "mapping nativeFieldId does not match its graph object");
      if (value.path("nativeRelationOccurrenceId").isTextual()
          && !value.path("nativeRelationOccurrenceId").asText()
              .equals(mapping.path("nativeRelationOccurrenceId").asText()))
        throw new ValidationError("MAPPING_OCCURRENCE_ID_MISMATCH",
            "mapping nativeRelationOccurrenceId does not match its graph object");
    }
    java.util.Iterator<Map.Entry<String, JsonNode>> fields = value.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      if ("outputFields".equals(field.getKey()) && field.getValue().isArray()) {
        int index = 0;
        for (JsonNode outputField : field.getValue()) {
          validateMappedObjects(outputField, nativeRelationId, mappings, Integer.valueOf(index));
          index += 1;
        }
      } else if (!"mappingId".equals(field.getKey())
          && !"evidenceRefs".equals(field.getKey())) {
        validateMappedObjects(field.getValue(), nativeRelationId, mappings, null);
      }
    }
  }

  private static void validateEvidenceArray(JsonNode evidenceRefs) {
    if (!evidenceRefs.isArray())
      throw new ValidationError("EVIDENCE_REFS_INVALID", "evidenceRefs must be an array");
    for (JsonNode ref : evidenceRefs)
      if (!ref.isTextual() || ref.asText().isEmpty())
        throw new ValidationError("EVIDENCE_REFS_INVALID",
            "evidenceRefs must contain only non-empty strings");
  }

  private static void validateSchema(JsonNode schema, JsonNode limits) {
    if (!schema.isObject() || !schema.path("tables").isArray()) {
      throw new ValidationError("SCHEMA_INVALID", "schema.tables must be an array");
    }
    int maxTables = boundedLimit(limits, "maxTables", HARD_MAX_TABLES, 1);
    int maxColumns = boundedLimit(limits, "maxColumnsPerTable", HARD_MAX_COLUMNS, 1);
    if (schema.path("tables").size() > maxTables) {
      throw new ValidationError("TABLE_LIMIT_EXCEEDED", "schema.tables exceeds maxTables");
    }
    for (JsonNode table : schema.path("tables")) {
      if (!table.isObject() || !table.path("name").isTextual()
          || table.path("name").asText().isEmpty() || !table.path("columns").isArray()) {
        throw new ValidationError("SCHEMA_TABLE_INVALID", "schema table requires name and columns");
      }
      if (table.path("columns").size() > maxColumns) {
        throw new ValidationError("COLUMN_LIMIT_EXCEEDED", "table columns exceeds maxColumnsPerTable");
      }
      for (JsonNode column : table.path("columns")) {
        if (!column.isObject() || !column.path("name").isTextual()
            || column.path("name").asText().isEmpty() || !column.path("type").isTextual()
            || column.path("type").asText().isEmpty() || !column.path("nullable").isBoolean()) {
          throw new ValidationError("SCHEMA_COLUMN_INVALID",
              "schema column requires name, concrete type and nullable");
        }
        String type = column.path("type").asText().trim().toUpperCase();
        if ("ANY".equals(type) || "UNKNOWN".equals(type)) {
          throw new ValidationError("TYPE_NOT_CONCRETE", "ANY/UNKNOWN types are forbidden");
        }
        validateConcreteType(type);
      }
    }
  }

  private static void validateConcreteType(String type) {
    Matcher matcher = CONCRETE_TYPE.matcher(type.replace(" ", "").toUpperCase(Locale.ROOT));
    if (!matcher.matches()) {
      throw new ValidationError("TYPE_UNSUPPORTED",
          "schema type is outside the bounded concrete type matrix: " + type);
    }
    String precisionText = matcher.group(2);
    String scaleText = matcher.group(3);
    String name = matcher.group(1);
    boolean parameterAllowed = "VARCHAR".equals(name) || "CHAR".equals(name)
        || "VARBINARY".equals(name) || "TIMESTAMP".equals(name)
        || "DECIMAL".equals(name);
    if (precisionText != null && !parameterAllowed) {
      throw new ValidationError("TYPE_PARAMETERS_INVALID",
          "type parameters are not allowed for " + name);
    }
    if (scaleText != null && !"DECIMAL".equals(name)) {
      throw new ValidationError("TYPE_PARAMETERS_INVALID",
          "scale is only allowed for DECIMAL");
    }
    if (precisionText == null) return;
    try {
      int precision = Integer.parseInt(precisionText);
      int scale = scaleText == null ? 0 : Integer.parseInt(scaleText);
      if (precision <= 0 || scale < 0 || scale > precision) {
        throw new ValidationError("TYPE_PARAMETERS_INVALID",
            "type precision/scale is outside the concrete range");
      }
    } catch (NumberFormatException error) {
      throw new ValidationError("TYPE_PARAMETERS_INVALID",
          "type precision/scale exceeds the supported integer range");
    }
  }

  private static int boundedLimit(JsonNode limits, String name, int hard, int minimum) {
    if (limits == null || limits.isMissingNode() || limits.isNull() || !limits.has(name)) return hard;
    JsonNode value = limits.path(name);
    if (!value.canConvertToInt() || value.asInt() < minimum) {
      throw new ValidationError("LIMIT_INVALID", name + " must be at least " + minimum);
    }
    if (value.asInt() > hard) {
      throw new ValidationError("LIMIT_EXCEEDS_HARD_CAP", name + " exceeds the hard cap");
    }
    return value.asInt();
  }

  private static String requiredText(ObjectNode object, String name) {
    JsonNode value = object.path(name);
    if (!value.isTextual() || value.asText().isEmpty()) {
      throw new ValidationError("FIELD_REQUIRED", name + " is required");
    }
    return value.asText();
  }

  private static ArrayNode requiredArray(ObjectNode object, String name) {
    JsonNode value = object.path(name);
    if (!value.isArray()) {
      throw new ValidationError("FIELD_REQUIRED", name + " must be an array");
    }
    return (ArrayNode) value;
  }

  private static String optionalText(ObjectNode object, String name) {
    JsonNode value = object.path(name);
    return value.isTextual() ? value.asText() : null;
  }

  private static ProcessResult failed(String requestId, String requestKind,
      String inputFingerprint, String code, String message, int maxOutputBytes) {
    return result("FAILED", requestId, requestKind, inputFingerprint, code, message,
        maxOutputBytes);
  }

  private static ProcessResult unsupported(String requestId, String requestKind,
      String inputFingerprint, String code, String message, int maxOutputBytes) {
    return result("UNSUPPORTED", requestId, requestKind, inputFingerprint, code, message,
        maxOutputBytes);
  }

  private static ProcessResult successful(String requestId, String requestKind,
      String inputFingerprint, JsonNode mappings, ArrayNode observations,
      int maxOutputBytes) {
    ObjectNode response = baseResponse("SUCCESS", requestId, requestKind, inputFingerprint);
    response.putArray("issues");
    response.set("mappingRefs", mappings.deepCopy());
    response.set("observations", observations);
    return new ProcessResult(response, maxOutputBytes);
  }

  private static ProcessResult result(String status, String requestId, String requestKind,
      String inputFingerprint, String code, String message, int maxOutputBytes) {
    ObjectNode response = baseResponse(status, requestId, requestKind, inputFingerprint);
    ArrayNode issues = response.putArray("issues");
    ObjectNode issue = issues.addObject();
    issue.put("code", code);
    issue.put("message", message);
    issue.put("severity", "UNSUPPORTED".equals(status) ? "WARNING" : "ERROR");
    response.putArray("mappingRefs");
    response.putArray("observations");
    return new ProcessResult(response, maxOutputBytes);
  }

  private static ObjectNode baseResponse(String status, String requestId, String requestKind,
      String inputFingerprint) {
    ObjectNode response = JSON.createObjectNode();
    response.put("protocolVersion", PROTOCOL_VERSION);
    response.put("requestKind", normalizeRequestKind(requestKind));
    if (requestId != null) response.put("requestId", requestId);
    response.put("status", status);
    ObjectNode fingerprint = response.putObject("fingerprint");
    fingerprint.put("tool", "calcite-differential");
    fingerprint.put("calciteVersion", CALCITE_VERSION);
    fingerprint.put("protocolVersion", PROTOCOL_VERSION);
    fingerprint.put("buildFingerprint", BUILD_FINGERPRINT);
    fingerprint.put("inputFingerprint", normalizeInputFingerprint(inputFingerprint));
    return response;
  }

  private static String normalizeRequestKind(String requestKind) {
    if ("RAW_SQL_V1".equals(requestKind) || "PLAN_FACTS_REL_V1".equals(requestKind)) {
      return requestKind;
    }
    return DEFAULT_REQUEST_KIND;
  }

  private static String normalizeInputFingerprint(String inputFingerprint) {
    return inputFingerprint == null || inputFingerprint.isEmpty()
        ? UNAVAILABLE_INPUT_FINGERPRINT : inputFingerprint;
  }

  private static String serializeBounded(ObjectNode response, int maxOutputBytes) {
    try {
      String output = JSON.writeValueAsString(response);
      if (output.getBytes(StandardCharsets.UTF_8).length + 1 <= maxOutputBytes) return output;
      ObjectNode fallback = result("FAILED", optionalText(response, "requestId"),
          optionalText(response, "requestKind"), responseInputFingerprint(response), "OUTPUT_LIMIT",
          "response exceeds the configured output limit", maxOutputBytes).response;
      String bounded = JSON.writeValueAsString(fallback);
      if (bounded.getBytes(StandardCharsets.UTF_8).length + 1 <= maxOutputBytes) return bounded;
      throw new IllegalStateException("minimum output limit cannot contain protocol response");
    } catch (JsonProcessingException error) {
      ObjectNode fallback = result("FAILED", optionalText(response, "requestId"),
          optionalText(response, "requestKind"), responseInputFingerprint(response), "SERIALIZATION_FAILED",
          "response serialization failed", HARD_MAX_OUTPUT_BYTES).response;
      try {
        return JSON.writeValueAsString(fallback);
      } catch (JsonProcessingException impossible) {
        throw new IllegalStateException("cannot serialize protocol failure", impossible);
      }
    }
  }

  private static String responseInputFingerprint(ObjectNode response) {
    JsonNode fingerprint = response.path("fingerprint");
    return fingerprint.isObject() ? optionalText((ObjectNode) fingerprint, "inputFingerprint") : null;
  }

  static final class ProcessResult {
    final ObjectNode response;
    final int maxOutputBytes;

    ProcessResult(ObjectNode response, int maxOutputBytes) {
      this.response = response;
      this.maxOutputBytes = maxOutputBytes;
    }
  }

  static final class ValidationError extends RuntimeException {
    final String code;

    ValidationError(String code, String message) {
      super(message);
      this.code = code;
    }
  }

  static final class UnsupportedError extends RuntimeException {
    final String code;

    UnsupportedError(String code, String message) {
      super(message);
      this.code = code;
    }
  }

  static final class BoundedLine {
    final String text;
    final int byteLength;
    final boolean tooLarge;
    final boolean decodeError;

    BoundedLine(String text, int byteLength, boolean tooLarge, boolean decodeError) {
      this.text = text;
      this.byteLength = byteLength;
      this.tooLarge = tooLarge;
      this.decodeError = decodeError;
    }
  }

  static final class BoundedLineReader {
    private final InputStream input;
    private final int hardLimit;

    BoundedLineReader(InputStream input, int hardLimit) {
      this.input = input;
      this.hardLimit = hardLimit;
    }

    BoundedLine nextLine() throws IOException {
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      boolean seen = false;
      boolean tooLarge = false;
      int length = 0;
      int current;
      while ((current = input.read()) >= 0) {
        seen = true;
        if (current == '\n') break;
        length += 1;
        if (length <= hardLimit) bytes.write(current);
        else tooLarge = true;
      }
      if (!seen && length == 0) return null;
      if (tooLarge) return new BoundedLine("", length, true, false);
      try {
        byte[] encoded = bytes.toByteArray();
        int decodeLength = encoded.length;
        if (decodeLength > 0 && encoded[decodeLength - 1] == '\r') decodeLength -= 1;
        String text = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(encoded, 0, decodeLength)).toString();
        return new BoundedLine(text, length, false, false);
      } catch (CharacterCodingException error) {
        return new BoundedLine("", length, false, true);
      }
    }
  }
}

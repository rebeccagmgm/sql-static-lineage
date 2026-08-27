package com.gf.sqlstaticlineage.calciteoracle;

import org.apache.calcite.config.Lex;
import org.apache.calcite.rel.RelNode;
import org.apache.calcite.rel.RelRoot;
import org.apache.calcite.rel.core.Filter;
import org.apache.calcite.rel.core.Project;
import org.apache.calcite.rel.core.TableScan;
import org.apache.calcite.rel.metadata.RelMetadataQuery;
import org.apache.calcite.util.Arrow;
import org.apache.calcite.util.ArrowSet;
import org.apache.calcite.schema.Statistics;
import org.apache.calcite.schema.Table;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.apache.calcite.schema.impl.AbstractTable;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.rel.type.RelDataType;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.sql.type.SqlTypeName;
import org.apache.calcite.tools.FrameworkConfig;
import org.apache.calcite.tools.Frameworks;
import org.apache.calcite.tools.Planner;
import org.apache.calcite.util.ImmutableBitSet;
import org.apache.calcite.rex.RexNode;
import org.apache.calcite.rel.RelVisitor;
import org.apache.calcite.plan.RelOptTable;
import org.apache.calcite.plan.RelOptPredicateList;

import java.io.InputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Main class for the bounded JSONL Calcite oracle. */
public final class CalciteOracle {
  private static final int PROTOCOL_VERSION = 1;
  private static final String CALCITE_VERSION = "1.42.0";
  private static final int HARD_MAX_INPUT_BYTES = 262144;
  private static final int HARD_MAX_SQL_BYTES = 65536;
  private static final int HARD_MAX_TABLES = 128;
  private static final int HARD_MAX_COLUMNS = 256;
  private static final int DEFAULT_MAX_OUTPUT_ITEMS = 4096;
  private static final int HARD_MAX_OUTPUT_BYTES = 1048576;
  private static final int MIN_OUTPUT_BYTES = 512;
  private static final String BUILD_FINGERPRINT =
      "calcite-offline-oracle/0.1.0;calcite/1.42.0;protocol/1";
  private static final String[] METADATA_KINDS = {
      "expressionLineage", "predicates", "uniqueKeys",
      "functionalDependencies", "tableOccurrences", "rowCountCardinality"
  };

  private CalciteOracle() {
  }

  public static void main(String[] args) throws Exception {
    BoundedLineReader reader = new BoundedLineReader(System.in, HARD_MAX_INPUT_BYTES);
    BoundedLine line;
    while ((line = reader.nextLine()) != null) {
      ProcessResult result = line.tooLarge
          ? new ProcessResult(response("FAILED", null, "INPUT_TOO_LARGE",
              "JSONL physical line exceeds the 262144 byte hard limit"), HARD_MAX_OUTPUT_BYTES)
          : line.errorCode != null
              ? new ProcessResult(response("FAILED", null, line.errorCode, line.errorMessage),
                  HARD_MAX_OUTPUT_BYTES)
              : process(line.text);
      try {
        System.out.println(Json.write(result.output, result.maxOutputBytes));
      } catch (OutputLimitException error) {
        System.out.println(Json.write(response("FAILED", null, "OUTPUT_LIMIT",
            "response exceeds the configured byte limit"), result.maxOutputBytes));
      }
    }
  }

  private static ProcessResult process(String line) {
    String requestId = null;
    int maxOutputBytes = HARD_MAX_OUTPUT_BYTES;
    try {
      if (line.trim().isEmpty()) {
        return new ProcessResult(response("FAILED", null, "INPUT_EMPTY", "JSONL line is empty"),
            maxOutputBytes);
      }
      if (line.getBytes(StandardCharsets.UTF_8).length > HARD_MAX_INPUT_BYTES) {
        return new ProcessResult(response("FAILED", null, "INPUT_TOO_LARGE",
            "JSONL line exceeds the 262144 byte hard limit"), maxOutputBytes);
      }
      Object parsed = Json.parse(line);
      Map<String, Object> request = object(parsed, "request");
      requestId = optionalString(request.get("requestId"));
      Map<String, Object> rawLimits = optionalObject(request.get("limits"));
      maxOutputBytes = boundedLimit(rawLimits, "maxOutputBytes",
          HARD_MAX_OUTPUT_BYTES, MIN_OUTPUT_BYTES);
      int protocolVersion = integer(request.get("protocolVersion"), "protocolVersion");
      if (protocolVersion != PROTOCOL_VERSION) {
        return new ProcessResult(response("FAILED", requestId, "PROTOCOL_VERSION_UNSUPPORTED",
            "expected protocolVersion 1"), maxOutputBytes);
      }
      int maxInputBytes = boundedLimit(rawLimits,
          "maxInputBytes", HARD_MAX_INPUT_BYTES);
      if (line.getBytes(StandardCharsets.UTF_8).length > maxInputBytes) {
        throw new InputError("INPUT_TOO_LARGE", "JSONL line exceeds the configured byte limit");
      }
      return new ProcessResult(execute(request, requestId, maxOutputBytes), maxOutputBytes);
    } catch (InputError error) {
      return new ProcessResult(response("FAILED", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (UnsupportedError error) {
      return new ProcessResult(response("UNSUPPORTED", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (PlannerError error) {
      return new ProcessResult(response("FAILED", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (Exception error) {
      String message = error.getMessage() == null ? error.getClass().getSimpleName()
          : error.getMessage().replace('\n', ' ').replace('\r', ' ');
      return new ProcessResult(response("FAILED", requestId, "CALCITE_FAILURE", message),
          maxOutputBytes);
    }
  }

  private static Map<String, Object> execute(Map<String, Object> request, String requestId,
      int maxOutputBytes) {
    String sql = requiredString(request.get("sql"), "sql");
    byte[] sqlBytes = sql.getBytes(StandardCharsets.UTF_8);
    Map<String, Object> rawLimits = optionalObject(request.get("limits"));
    int maxSqlBytes = boundedLimit(rawLimits, "maxSqlBytes", HARD_MAX_SQL_BYTES);
    if (sqlBytes.length > maxSqlBytes) {
      throw new InputError("SQL_TOO_LARGE", "SQL exceeds the configured byte limit");
    }
    Map<String, Object> rawSchema = object(request.get("schema"), "schema");
    List<Object> rawTables = array(rawSchema.get("tables"), "schema.tables");
    int maxTables = boundedLimit(rawLimits, "maxTables", HARD_MAX_TABLES);
    int maxColumns = boundedLimit(rawLimits, "maxColumnsPerTable", HARD_MAX_COLUMNS);
    if (rawTables.size() > maxTables) {
      throw new InputError("TABLE_LIMIT", "schema.tables exceeds the configured limit");
    }
    List<TableDefinition> definitions = new ArrayList<TableDefinition>();
    for (Object rawTable : rawTables) {
      definitions.add(parseTable(object(rawTable, "schema.tables[]"), maxColumns));
    }

    Set<String> requested = requestedMetadata(request.get("requestedMetadata"));
    String upperSql = sql.trim().toUpperCase(Locale.ROOT);
    if (!(upperSql.startsWith("SELECT") || upperSql.startsWith("WITH"))) {
      throw new UnsupportedError("UNSUPPORTED_SQL", "only SELECT and WITH queries are supported");
    }
    if (upperSql.contains("MATCH_RECOGNIZE") || upperSql.contains("MODEL")) {
      throw new UnsupportedError("UNSUPPORTED_SQL", "SQL operator is outside the fixture subset");
    }

    Map<String, CatalogSchema> schemas = new TreeMap<String, CatalogSchema>(
        String.CASE_INSENSITIVE_ORDER);
    for (TableDefinition definition : definitions) {
      CatalogSchema schema = schemas.get(definition.schema);
      if (schema == null) {
        schema = new CatalogSchema();
        schemas.put(definition.schema, schema);
      }
      schema.add(definition);
    }
    if (schemas.isEmpty()) {
      schemas.put("APP", new CatalogSchema());
    }
    org.apache.calcite.schema.SchemaPlus root = Frameworks.createRootSchema(true);
    org.apache.calcite.schema.SchemaPlus defaultSchema = null;
    for (Map.Entry<String, CatalogSchema> entry : schemas.entrySet()) {
      org.apache.calcite.schema.SchemaPlus added = root.add(entry.getKey(), entry.getValue());
      if (defaultSchema == null || entry.getKey().equalsIgnoreCase("APP")) {
        defaultSchema = added;
      }
    }
    FrameworkConfig config = Frameworks.newConfigBuilder()
        .defaultSchema(defaultSchema)
        // Calcite has no Hive Lex profile. The fixture subset uses ANSI syntax;
        // the dialect hint remains part of the request contract for future rules.
        .parserConfig(SqlParser.config().withLex(Lex.JAVA).withCaseSensitive(false))
        .build();
    Planner planner = Frameworks.getPlanner(config);
    try {
      SqlNode parsed = planner.parse(sql);
      if (parsed.getKind() != SqlKind.SELECT && parsed.getKind() != SqlKind.WITH) {
        throw new UnsupportedError("UNSUPPORTED_SQL", "parsed statement is not a query");
      }
      SqlNode validated = planner.validate(parsed);
      RelRoot relRoot = planner.rel(validated);
      return success(requestId, relRoot.rel, definitions, requested,
          boundedLimit(rawLimits, "maxOutputItems", DEFAULT_MAX_OUTPUT_ITEMS), maxOutputBytes);
    } catch (OracleError error) {
      throw error;
    } catch (Exception error) {
      String message = error.getMessage() == null ? "Calcite could not validate the query"
          : error.getMessage().replace('\n', ' ').replace('\r', ' ');
      throw new PlannerError("PLANNER_FAILURE", message);
    } finally {
      planner.close();
    }
  }

  private static Map<String, Object> success(String requestId, RelNode root,
      List<TableDefinition> definitions, Set<String> requested, int maxOutputItems,
      int maxOutputBytes) {
    RelMetadataQuery metadata = root.getCluster().getMetadataQuery();
    final List<RelNode> nodes = new ArrayList<RelNode>();
    RelVisitor visitor = new RelVisitor() {
      @Override public void visit(RelNode node, int ordinal, RelNode parent) {
        nodes.add(node);
        super.visit(node, ordinal, parent);
      }
    };
    visitor.go(root);
    Map<RelNode, String> nodeIds = new HashMap<RelNode, String>();
    for (int i = 0; i < nodes.size(); i++) {
      nodeIds.put(nodes.get(i), String.format(Locale.ROOT, "rel-%03d", i + 1));
    }
    Map<String, Object> observations = new LinkedHashMap<String, Object>();
    if (requested.contains("expressionLineage")) {
      observations.put("expressionLineage",
          expressionLineage(nodes, nodeIds, metadata, maxOutputItems));
    }
    if (requested.contains("predicates")) {
      observations.put("predicates", predicates(nodes, nodeIds, metadata, maxOutputItems));
    }
    if (requested.contains("uniqueKeys")) {
      observations.put("uniqueKeys", uniqueKeys(nodes, nodeIds, metadata, maxOutputItems));
    }
    if (requested.contains("functionalDependencies")) {
      observations.put("functionalDependencies", functionalDependencies(
          nodes, nodeIds, metadata, maxOutputItems));
    }
    if (requested.contains("tableOccurrences")) {
      observations.put("tableOccurrences", tableOccurrences(nodes, nodeIds, maxOutputItems));
    }
    if (requested.contains("rowCountCardinality")) {
      observations.put("rowCountCardinality", rowCounts(nodes, nodeIds, metadata,
          maxOutputItems));
    }
    Map<String, Object> output = response("SUCCESS", requestId, null, null);
    output.put("observations", observations);
    try {
      Json.write(output, maxOutputBytes);
    } catch (OutputLimitException error) {
      throw new UnsupportedError("OUTPUT_LIMIT", "response exceeds the configured byte limit");
    }
    return output;
  }

  private static List<Object> expressionLineage(List<RelNode> nodes, Map<RelNode, String> nodeIds,
      RelMetadataQuery metadata, int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    for (RelNode node : nodes) {
      if (!(node instanceof Project)) {
        continue;
      }
      Project project = (Project) node;
      List<String> fieldNames = project.getRowType().getFieldNames();
      for (int i = 0; i < project.getProjects().size(); i++) {
        RexNode expression = project.getProjects().get(i);
        Set<RexNode> lineages = safeExpressionLineage(metadata, node, expression);
        List<String> rendered = new ArrayList<String>();
        if (lineages != null) {
          for (RexNode lineage : lineages) {
            rendered.add(lineage.toString());
          }
          Collections.sort(rendered);
        }
        Map<String, Object> item = new LinkedHashMap<String, Object>();
        item.put("nodeId", nodeIds.get(node));
        item.put("outputOrdinal", i);
        item.put("outputName", fieldNames.get(i));
        item.put("expression", expression.toString());
        item.put("lineage", lineages == null ? null : rendered);
        output.add(item);
        enforceOutputLimit(output, maxOutputItems);
      }
    }
    return output;
  }

  private static Set<RexNode> safeExpressionLineage(RelMetadataQuery metadata, RelNode node,
      RexNode expression) {
    try {
      return metadata.getExpressionLineage(node, expression);
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  private static List<Object> predicates(List<RelNode> nodes, Map<RelNode, String> nodeIds,
      RelMetadataQuery metadata, int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    Set<String> seen = new LinkedHashSet<String>();
    for (RelNode node : nodes) {
      if (node instanceof Filter) {
        addPredicate(output, seen, nodeIds.get(node), "FILTER",
            ((Filter) node).getCondition().toString(), maxOutputItems);
      }
      try {
        RelOptPredicateList pulled = metadata.getPulledUpPredicates(node);
        for (RexNode predicate : pulled.pulledUpPredicates) {
          addPredicate(output, seen, nodeIds.get(node), "PULLED_UP",
              predicate.toString(), maxOutputItems);
        }
      } catch (RuntimeException ignored) {
        // Missing predicate metadata is an observation gap, not a negative result.
      }
    }
    return output;
  }

  private static void addPredicate(List<Object> output, Set<String> seen, String nodeId,
      String source, String predicate, int maxOutputItems) {
    String key = nodeId + "\u0000" + source + "\u0000" + predicate;
    if (!seen.add(key)) {
      return;
    }
    Map<String, Object> item = new LinkedHashMap<String, Object>();
    item.put("nodeId", nodeId);
    item.put("source", source);
    item.put("predicate", predicate);
    output.add(item);
    enforceOutputLimit(output, maxOutputItems);
  }

  private static List<Object> uniqueKeys(List<RelNode> nodes, Map<RelNode, String> nodeIds,
      RelMetadataQuery metadata, int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    for (RelNode node : nodes) {
      Set<ImmutableBitSet> keys;
      try {
        keys = metadata.getUniqueKeys(node);
      } catch (RuntimeException ignored) {
        keys = null;
      }
      if (keys == null) {
        continue;
      }
      for (ImmutableBitSet key : keys) {
        Map<String, Object> item = new LinkedHashMap<String, Object>();
        item.put("nodeId", nodeIds.get(node));
        item.put("columns", bitNames(key, node.getRowType().getFieldNames()));
        output.add(item);
        enforceOutputLimit(output, maxOutputItems);
      }
    }
    return output;
  }

  private static List<Object> functionalDependencies(List<RelNode> nodes,
      Map<RelNode, String> nodeIds, RelMetadataQuery metadata, int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    Set<String> seen = new HashSet<String>();
    for (RelNode node : nodes) {
      List<String> fields = node.getRowType().getFieldNames();
      ArrowSet fds;
      try {
        fds = metadata.getFDs(node);
      } catch (RuntimeException ignored) {
        fds = null;
      }
      if (fds != null) {
        for (Arrow arrow : fds.getArrows()) {
          addFunctionalDependency(output, seen, nodeIds.get(node),
              bitNames(arrow.getDeterminants(), fields),
              bitNames(arrow.getDependents(), fields), "CALCITE_METADATA", maxOutputItems);
        }
      }
      if (node instanceof TableScan) {
        RelOptTable optTable = ((TableScan) node).getTable();
        OracleTable table = optTable.unwrap(OracleTable.class);
        if (table != null) {
          for (FunctionalDependency fd : table.definition.functionalDependencies) {
            addFunctionalDependency(output, seen, nodeIds.get(node), fd.determinant,
                fd.dependent, "SCHEMA_STATISTICS", maxOutputItems);
          }
        }
      }
    }
    return output;
  }

  private static void addFunctionalDependency(List<Object> output, Set<String> seen,
      String nodeId, List<String> determinant, List<String> dependent, String source,
      int maxOutputItems) {
    List<String> left = new ArrayList<String>(determinant);
    List<String> right = new ArrayList<String>(dependent);
    Collections.sort(left);
    Collections.sort(right);
    String key = nodeId + "\u0000" + source + "\u0000" + left + "\u0000" + right;
    if (!seen.add(key)) {
      return;
    }
    Map<String, Object> item = new LinkedHashMap<String, Object>();
    item.put("nodeId", nodeId);
    item.put("determinant", left);
    item.put("dependent", right);
    item.put("source", source);
    output.add(item);
    enforceOutputLimit(output, maxOutputItems);
  }

  private static List<Object> tableOccurrences(List<RelNode> nodes, Map<RelNode, String> nodeIds,
      int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    int occurrence = 1;
    for (RelNode node : nodes) {
      if (!(node instanceof TableScan)) {
        continue;
      }
      List<String> qualifiedName = ((TableScan) node).getTable().getQualifiedName();
      Map<String, Object> item = new LinkedHashMap<String, Object>();
      item.put("occurrenceId", String.format(Locale.ROOT, "table-occurrence-%03d", occurrence++));
      item.put("qualifiedName", new ArrayList<String>(qualifiedName));
      item.put("nodeId", nodeIds.get(node));
      output.add(item);
      enforceOutputLimit(output, maxOutputItems);
    }
    return output;
  }

  private static List<Object> rowCounts(List<RelNode> nodes, Map<RelNode, String> nodeIds,
      RelMetadataQuery metadata, int maxOutputItems) {
    List<Object> output = new ArrayList<Object>();
    for (RelNode node : nodes) {
      Double rowCount = null;
      try {
        rowCount = metadata.getRowCount(node);
      } catch (RuntimeException ignored) {
        // Preserve null when Calcite has no estimate.
      }
      Map<String, Object> cardinality = new TreeMap<String, Object>();
      List<String> fields = node.getRowType().getFieldNames();
      for (int i = 0; i < fields.size(); i++) {
        Double distinct = null;
        try {
          distinct = metadata.getDistinctRowCount(node, ImmutableBitSet.of(i), null);
        } catch (RuntimeException ignored) {
          // Preserve null when Calcite cannot estimate this cardinality.
        }
        cardinality.put(fields.get(i), distinct);
      }
      Map<String, Object> item = new LinkedHashMap<String, Object>();
      item.put("nodeId", nodeIds.get(node));
      item.put("rowCount", rowCount);
      item.put("cardinality", cardinality);
      output.add(item);
      enforceOutputLimit(output, maxOutputItems);
    }
    return output;
  }

  private static List<String> bitNames(ImmutableBitSet bitSet, List<String> fieldNames) {
    List<String> names = new ArrayList<String>();
    for (Integer index : bitSet) {
      if (index >= 0 && index < fieldNames.size()) {
        names.add(fieldNames.get(index));
      }
    }
    return names;
  }

  private static TableDefinition parseTable(Map<String, Object> raw, int maxColumns) {
    String name = requiredString(raw.get("name"), "table.name");
    Object rawCatalog = raw.get("catalog");
    if (rawCatalog != null && !(rawCatalog instanceof String)) {
      throw new InputError("INPUT_STRING_EXPECTED", "table.catalog must be a string");
    }
    if (rawCatalog != null && !((String) rawCatalog).trim().isEmpty()) {
      throw new UnsupportedError("CATALOG_UNSUPPORTED",
          "table.catalog is not supported; omit catalog and use schema.name");
    }
    String schema = optionalString(raw.get("schema"));
    if (schema == null || schema.trim().isEmpty()) {
      schema = "APP";
    }
    List<Object> rawColumns = array(raw.get("columns"), "table.columns");
    if (rawColumns.size() > maxColumns) {
      throw new InputError("COLUMN_LIMIT", "table.columns exceeds the configured limit");
    }
    List<ColumnDefinition> columns = new ArrayList<ColumnDefinition>();
    for (Object rawColumn : rawColumns) {
      Map<String, Object> column = object(rawColumn, "table.columns[]");
      columns.add(new ColumnDefinition(requiredString(column.get("name"), "column.name"),
          optionalString(column.get("type")), optionalBoolean(column.get("nullable"), true)));
    }
    List<List<String>> uniqueKeys = stringLists(raw.get("uniqueKeys"), "uniqueKeys");
    List<FunctionalDependency> functionalDependencies = new ArrayList<FunctionalDependency>();
    for (Object rawFd : optionalArray(raw.get("functionalDependencies"))) {
      Map<String, Object> fd = object(rawFd, "functionalDependencies[]");
      functionalDependencies.add(new FunctionalDependency(
          strings(fd.get("determinant"), "functionalDependencies.determinant"),
          strings(fd.get("dependent"), "functionalDependencies.dependent")));
    }
    Double rowCount = optionalNumber(raw.get("rowCount"));
    if (rowCount != null && (rowCount < 0 || rowCount.isInfinite() || rowCount.isNaN())) {
      throw new InputError("ROW_COUNT_INVALID", "rowCount must be finite and non-negative");
    }
    return new TableDefinition(schema, name, columns, rowCount, uniqueKeys,
        functionalDependencies);
  }

  private static Set<String> requestedMetadata(Object raw) {
    if (raw == null) {
      Set<String> all = new LinkedHashSet<String>();
      Collections.addAll(all, METADATA_KINDS);
      return all;
    }
    Set<String> requested = new LinkedHashSet<String>();
    for (String kind : strings(raw, "requestedMetadata")) {
      boolean supported = false;
      for (String known : METADATA_KINDS) {
        if (known.equals(kind)) {
          supported = true;
          break;
        }
      }
      if (!supported) {
        throw new UnsupportedError("UNSUPPORTED_METADATA_KIND", kind);
      }
      requested.add(kind);
    }
    return requested;
  }

  private static int boundedLimit(Map<String, Object> limits, String name, int hardMaximum) {
    return boundedLimit(limits, name, hardMaximum, 1);
  }

  private static int boundedLimit(Map<String, Object> limits, String name, int hardMaximum,
      int minimum) {
    if (limits == null || limits.get(name) == null) {
      return hardMaximum;
    }
    int requested = integer(limits.get(name), "limits." + name);
    if (requested < minimum || requested > hardMaximum) {
      throw new InputError("LIMIT_INVALID", "limits." + name + " must be between " + minimum
          + " and "
          + hardMaximum);
    }
    return requested;
  }

  private static void enforceOutputLimit(List<Object> output, int maxOutputItems) {
    if (output.size() > maxOutputItems) {
      throw new UnsupportedError("OUTPUT_LIMIT", "observation output exceeds maxOutputItems");
    }
  }

  private static Map<String, Object> response(String status, String requestId, String code,
      String message) {
    Map<String, Object> output = new TreeMap<String, Object>();
    output.put("fingerprint", fingerprint());
    output.put("protocolVersion", PROTOCOL_VERSION);
    if (requestId != null) {
      output.put("requestId", requestId);
    }
    output.put("status", status);
    if (code != null) {
      Map<String, Object> error = new TreeMap<String, Object>();
      error.put("code", code);
      error.put("message", message);
      output.put("error", error);
    }
    return output;
  }

  private static Map<String, Object> fingerprint() {
    Map<String, Object> fingerprint = new TreeMap<String, Object>();
    fingerprint.put("buildFingerprint", BUILD_FINGERPRINT);
    fingerprint.put("calciteVersion", CALCITE_VERSION);
    fingerprint.put("protocolVersion", PROTOCOL_VERSION);
    fingerprint.put("tool", "calcite-offline-oracle");
    return fingerprint;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> object(Object value, String path) {
    if (!(value instanceof Map)) {
      throw new InputError("INPUT_OBJECT_EXPECTED", path + " must be an object");
    }
    return (Map<String, Object>) value;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> array(Object value, String path) {
    if (!(value instanceof List)) {
      throw new InputError("INPUT_ARRAY_EXPECTED", path + " must be an array");
    }
    return (List<Object>) value;
  }

  private static List<Object> optionalArray(Object value) {
    return value == null ? Collections.<Object>emptyList() : array(value, "array");
  }

  private static Map<String, Object> optionalObject(Object value) {
    return value == null ? null : object(value, "object");
  }

  private static String requiredString(Object value, String path) {
    String string = optionalString(value);
    if (string == null || string.trim().isEmpty()) {
      throw new InputError("INPUT_STRING_REQUIRED", path + " must be a non-empty string");
    }
    return string;
  }

  private static String optionalString(Object value) {
    return value instanceof String ? (String) value : null;
  }

  private static boolean optionalBoolean(Object value, boolean fallback) {
    return value == null ? fallback : (value instanceof Boolean
        ? ((Boolean) value).booleanValue()
        : throwBoolean("boolean expected"));
  }

  private static boolean throwBoolean(String message) {
    throw new InputError("INPUT_BOOLEAN_EXPECTED", message);
  }

  private static int integer(Object value, String path) {
    if (!(value instanceof Number)) {
      throw new InputError("INPUT_INTEGER_EXPECTED", path + " must be an integer");
    }
    try {
      return new BigDecimal(value.toString()).intValueExact();
    } catch (ArithmeticException error) {
      throw new InputError("INPUT_INTEGER_EXPECTED", path + " must be an integer");
    }
  }

  private static Double optionalNumber(Object value) {
    if (value == null) {
      return null;
    }
    if (!(value instanceof Number)) {
      throw new InputError("INPUT_NUMBER_EXPECTED", "number expected");
    }
    double number = ((Number) value).doubleValue();
    if (Double.isNaN(number) || Double.isInfinite(number)) {
      throw new InputError("INPUT_NUMBER_EXPECTED", "number must be finite");
    }
    return number;
  }

  private static List<String> strings(Object value, String path) {
    List<Object> raw = array(value, path);
    List<String> output = new ArrayList<String>();
    for (Object item : raw) {
      if (!(item instanceof String) || ((String) item).trim().isEmpty()) {
        throw new InputError("INPUT_STRING_EXPECTED", path + " must contain strings");
      }
      output.add((String) item);
    }
    return output;
  }

  private static List<List<String>> stringLists(Object value, String path) {
    List<List<String>> output = new ArrayList<List<String>>();
    for (Object item : optionalArray(value)) {
      output.add(strings(item, path + "[]"));
    }
    return output;
  }

  private static final class BoundedLine {
    private final String text;
    private final boolean tooLarge;

    private final String errorCode;
    private final String errorMessage;

    BoundedLine(String text, boolean tooLarge) {
      this(text, tooLarge, null, null);
    }

    BoundedLine(String text, boolean tooLarge, String errorCode, String errorMessage) {
      this.text = text;
      this.tooLarge = tooLarge;
      this.errorCode = errorCode;
      this.errorMessage = errorMessage;
    }
  }

  /** Reads one physical line with a fixed upper bound before creating a String. */
  private static final class BoundedLineReader {
    private final InputStream input;
    private final byte[] buffer;

    BoundedLineReader(InputStream input, int maxBytes) {
      this.input = input;
      this.buffer = new byte[maxBytes];
    }

    BoundedLine nextLine() throws IOException {
      int length = 0;
      boolean tooLarge = false;
      int current;
      while ((current = input.read()) != -1) {
        if (current == '\n') {
          break;
        }
        if (length < buffer.length) {
          buffer[length++] = (byte) current;
        } else {
          tooLarge = true;
        }
      }
      if (current == -1 && length == 0 && !tooLarge) {
        return null;
      }
      if (tooLarge) {
        return new BoundedLine(null, true);
      }
      if (length > 0 && buffer[length - 1] == '\r') {
        length--;
      }
      try {
        String text = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(buffer, 0, length)).toString();
        return new BoundedLine(text, false);
      } catch (CharacterCodingException error) {
        return new BoundedLine(null, false, "JSON_INVALID", "input is not valid UTF-8");
      }
    }
  }

  private static final class ProcessResult {
    private final Map<String, Object> output;
    private final int maxOutputBytes;

    ProcessResult(Map<String, Object> output, int maxOutputBytes) {
      this.output = output;
      this.maxOutputBytes = maxOutputBytes;
    }
  }

  private static final class PlannerError extends OracleError {
    PlannerError(String code, String message) {
      super(code, message);
    }
  }

  private static final class OutputLimitException extends RuntimeException {
    OutputLimitException() {
      super("JSON output exceeds byte limit");
    }
  }

  private static final class CatalogSchema extends AbstractSchema {
    private final Map<String, Table> tables = new TreeMap<String, Table>(
        String.CASE_INSENSITIVE_ORDER);

    void add(TableDefinition definition) {
      tables.put(definition.name, new OracleTable(definition));
    }

    @Override protected Map<String, Table> getTableMap() {
      return tables;
    }
  }

  private static final class OracleTable extends AbstractTable {
    private final TableDefinition definition;

    OracleTable(TableDefinition definition) {
      this.definition = definition;
    }

    @Override public RelDataType getRowType(RelDataTypeFactory factory) {
      RelDataTypeFactory.Builder builder = factory.builder();
      for (ColumnDefinition column : definition.columns) {
        SqlTypeName typeName = typeName(column.type);
        RelDataType type = factory.createSqlType(typeName);
        builder.add(column.name, type).nullable(column.nullable);
      }
      return builder.build();
    }

    @Override public org.apache.calcite.schema.Statistic getStatistic() {
      List<ImmutableBitSet> keys = new ArrayList<ImmutableBitSet>();
      for (List<String> names : definition.uniqueKeys) {
        ImmutableBitSet.Builder builder = ImmutableBitSet.builder();
        for (String name : names) {
          for (int i = 0; i < definition.columns.size(); i++) {
            if (definition.columns.get(i).name.equalsIgnoreCase(name)) {
              builder.set(i);
            }
          }
        }
        keys.add(builder.build());
      }
      return definition.rowCount == null ? Statistics.of((Double) null, keys, null, null)
          : Statistics.of(definition.rowCount, keys);
    }

    private static SqlTypeName typeName(String raw) {
      if (raw == null || raw.trim().isEmpty()) {
        return SqlTypeName.VARCHAR;
      }
      String normalized = raw.toUpperCase(Locale.ROOT).replace(" ", "");
      if ("INT".equals(normalized)) {
        normalized = "INTEGER";
      }
      try {
        return SqlTypeName.valueOf(normalized);
      } catch (IllegalArgumentException error) {
        throw new InputError("TYPE_UNSUPPORTED", "unsupported column type: " + raw);
      }
    }
  }

  private static final class TableDefinition {
    private final String schema;
    private final String name;
    private final List<ColumnDefinition> columns;
    private final Double rowCount;
    private final List<List<String>> uniqueKeys;
    private final List<FunctionalDependency> functionalDependencies;

    TableDefinition(String schema, String name, List<ColumnDefinition> columns, Double rowCount,
        List<List<String>> uniqueKeys, List<FunctionalDependency> functionalDependencies) {
      this.schema = schema;
      this.name = name;
      this.columns = columns;
      this.rowCount = rowCount;
      this.uniqueKeys = uniqueKeys;
      this.functionalDependencies = functionalDependencies;
    }
  }

  private static final class ColumnDefinition {
    private final String name;
    private final String type;
    private final boolean nullable;

    ColumnDefinition(String name, String type, boolean nullable) {
      this.name = name;
      this.type = type;
      this.nullable = nullable;
    }
  }

  private static final class FunctionalDependency {
    private final List<String> determinant;
    private final List<String> dependent;

    FunctionalDependency(List<String> determinant, List<String> dependent) {
      this.determinant = determinant;
      this.dependent = dependent;
    }
  }

  private static class OracleError extends RuntimeException {
    protected final String code;

    OracleError(String code, String message) {
      super(message);
      this.code = code;
    }
  }

  private static final class InputError extends OracleError {
    InputError(String code, String message) {
      super(code, message);
    }
  }

  private static final class UnsupportedError extends OracleError {
    UnsupportedError(String code, String message) {
      super(code, message);
    }
  }

  /*
   * The JSON parser below intentionally uses BigDecimal for all JSON numbers:
   * this avoids accepting Java-only forms and preserves strict token checks.
   */
  /** Small JSON parser/writer keeps the sidecar protocol independent of another runtime. */
  private static final class Json {
    private final String text;
    private int position;

    private Json(String text) {
      this.text = text;
    }

    static Object parse(String text) {
      Json parser = new Json(text);
      Object value = parser.value();
      parser.space();
      if (parser.position != text.length()) {
        throw new InputError("JSON_INVALID", "trailing characters after JSON value");
      }
      return value;
    }

    static String write(Object value, int maxBytes) {
      Writer output = new Writer(maxBytes);
      writeValue(output, value);
      return output.toString();
    }

    private Object value() {
      space();
      if (position >= text.length()) {
        throw new InputError("JSON_INVALID", "unexpected end of input");
      }
      char current = text.charAt(position);
      if (current == '{') return object();
      if (current == '[') return arrayValue();
      if (current == '"') return stringValue();
      if (text.startsWith("true", position)) { position += 4; return Boolean.TRUE; }
      if (text.startsWith("false", position)) { position += 5; return Boolean.FALSE; }
      if (text.startsWith("null", position)) { position += 4; return null; }
      return number();
    }

    private Map<String, Object> object() {
      Map<String, Object> output = new LinkedHashMap<String, Object>();
      position++;
      space();
      if (take('}')) return output;
      while (true) {
        space();
        if (position >= text.length() || text.charAt(position) != '"') {
          throw new InputError("JSON_INVALID", "object key must be a string");
        }
        String key = stringValue();
        space();
        expect(':');
        output.put(key, value());
        space();
        if (take('}')) return output;
        expect(',');
      }
    }

    private List<Object> arrayValue() {
      List<Object> output = new ArrayList<Object>();
      position++;
      space();
      if (take(']')) return output;
      while (true) {
        output.add(value());
        space();
        if (take(']')) return output;
        expect(',');
      }
    }

    private String stringValue() {
      expect('"');
      StringBuilder output = new StringBuilder();
      while (position < text.length()) {
        char current = text.charAt(position++);
        if (current == '"') return output.toString();
        if (current == '\\') {
          if (position >= text.length()) break;
          char escaped = text.charAt(position++);
          switch (escaped) {
            case '"': output.append('"'); break;
            case '\\': output.append('\\'); break;
            case '/': output.append('/'); break;
            case 'b': output.append('\b'); break;
            case 'f': output.append('\f'); break;
            case 'n': output.append('\n'); break;
            case 'r': output.append('\r'); break;
            case 't': output.append('\t'); break;
            case 'u':
              if (position + 4 > text.length()) {
                throw new InputError("JSON_INVALID", "incomplete unicode escape");
              }
              int codeUnit = hex4(text.substring(position, position + 4));
              position += 4;
              if (Character.isHighSurrogate((char) codeUnit)) {
                if (position + 6 > text.length() || text.charAt(position) != '\\'
                    || text.charAt(position + 1) != 'u') {
                  throw new InputError("JSON_INVALID", "unpaired high surrogate");
                }
                int low = hex4(text.substring(position + 2, position + 6));
                if (!Character.isLowSurrogate((char) low)) {
                  throw new InputError("JSON_INVALID", "invalid unicode surrogate pair");
                }
                output.appendCodePoint(Character.toCodePoint((char) codeUnit, (char) low));
                position += 6;
              } else if (Character.isLowSurrogate((char) codeUnit)) {
                throw new InputError("JSON_INVALID", "unpaired low surrogate");
              } else {
                output.append((char) codeUnit);
              }
              break;
            default: throw new InputError("JSON_INVALID", "invalid string escape");
          }
        } else {
          if (current < 0x20) {
            throw new InputError("JSON_INVALID", "control character in string");
          }
          if (Character.isHighSurrogate(current)) {
            if (position >= text.length() || !Character.isLowSurrogate(text.charAt(position))) {
              throw new InputError("JSON_INVALID", "unpaired high surrogate");
            }
            output.append(current).append(text.charAt(position++));
          } else if (Character.isLowSurrogate(current)) {
            throw new InputError("JSON_INVALID", "unpaired low surrogate");
          } else {
            output.append(current);
          }
        }
      }
      throw new InputError("JSON_INVALID", "unterminated string");
    }

    private Number number() {
      int start = position;
      if (take('-')) {
        if (position >= text.length()) {
          throw new InputError("JSON_INVALID", "invalid number");
        }
      }
      if (take('0')) {
        if (position < text.length() && isDigit(text.charAt(position))) {
          throw new InputError("JSON_INVALID", "leading zero in number");
        }
      } else {
        if (position >= text.length() || text.charAt(position) < '1'
            || text.charAt(position) > '9') {
          throw new InputError("JSON_INVALID", "invalid number");
        }
        while (position < text.length() && isDigit(text.charAt(position))) {
          position++;
        }
      }
      if (take('.')) {
        int fractionStart = position;
        while (position < text.length() && isDigit(text.charAt(position))) {
          position++;
        }
        if (fractionStart == position) {
          throw new InputError("JSON_INVALID", "fraction requires digits");
        }
      }
      if (position < text.length() && (text.charAt(position) == 'e'
          || text.charAt(position) == 'E')) {
        position++;
        if (position < text.length() && (text.charAt(position) == '+'
            || text.charAt(position) == '-')) {
          position++;
        }
        int exponentStart = position;
        while (position < text.length() && isDigit(text.charAt(position))) {
          position++;
        }
        if (exponentStart == position) {
          throw new InputError("JSON_INVALID", "exponent requires digits");
        }
      }
      String raw = text.substring(start, position);
      try {
        return new BigDecimal(raw);
      } catch (NumberFormatException error) {
        throw new InputError("JSON_INVALID", "invalid number");
      }
    }

    private static int hex4(String value) {
      try {
        return Integer.parseInt(value, 16);
      } catch (NumberFormatException error) {
        throw new InputError("JSON_INVALID", "invalid unicode escape");
      }
    }

    private static boolean isDigit(char value) {
      return value >= '0' && value <= '9';
    }

    private void space() {
      while (position < text.length() && isJsonWhitespace(text.charAt(position))) {
        position++;
      }
    }

    private static boolean isJsonWhitespace(char value) {
      return value == ' ' || value == '\t' || value == '\r' || value == '\n';
    }

    private void expect(char expected) {
      if (position >= text.length() || text.charAt(position) != expected) {
        throw new InputError("JSON_INVALID", "expected '" + expected + "'");
      }
      position++;
    }

    private boolean take(char expected) {
      if (position < text.length() && text.charAt(position) == expected) {
        position++;
        return true;
      }
      return false;
    }

    @SuppressWarnings("unchecked")
    private static void writeValue(Writer output, Object value) {
      if (value == null) { output.append("null"); return; }
      if (value instanceof String) { writeString(output, (String) value); return; }
      if (value instanceof Boolean) { output.append(value.toString()); return; }
      if (value instanceof Number) {
        if (value instanceof Double && !Double.isFinite((Double) value)
            || value instanceof Float && !Float.isFinite((Float) value)) {
          throw new IllegalArgumentException("non-finite JSON number");
        }
        output.append(value.toString());
        return;
      }
      if (value instanceof Map) {
        output.append('{');
        boolean first = true;
        Map<String, Object> map = (Map<String, Object>) value;
        List<String> keys = new ArrayList<String>(map.keySet());
        Collections.sort(keys);
        for (String key : keys) {
          if (!first) output.append(',');
          first = false;
          writeString(output, key);
          output.append(':');
          writeValue(output, map.get(key));
        }
        output.append('}');
        return;
      }
      if (value instanceof Iterable) {
        output.append('[');
        boolean first = true;
        for (Object item : (Iterable<Object>) value) {
          if (!first) output.append(',');
          first = false;
          writeValue(output, item);
        }
        output.append(']');
        return;
      }
      throw new IllegalArgumentException("unsupported JSON value: " + value.getClass());
    }

    private static void writeString(Writer output, String value) {
      output.append('"');
      for (int i = 0; i < value.length();) {
        int codePoint = value.codePointAt(i);
        int width = Character.charCount(codePoint);
        String current = new String(Character.toChars(codePoint));
        i += width;
        switch (codePoint) {
          case '"': output.append("\\\""); break;
          case '\\': output.append("\\\\"); break;
          case '\b': output.append("\\b"); break;
          case '\f': output.append("\\f"); break;
          case '\n': output.append("\\n"); break;
          case '\r': output.append("\\r"); break;
          case '\t': output.append("\\t"); break;
          default:
            if (codePoint < 0x20) {
              output.append(String.format(Locale.ROOT, "\\u%04x", codePoint));
            } else {
              output.append(current);
            }
        }
      }
      output.append('"');
    }

    private static final class Writer {
      private final StringBuilder text = new StringBuilder();
      private final int maxBytes;
      private int bytes;

      Writer(int maxBytes) {
        this.maxBytes = maxBytes;
      }

      void append(char value) {
        append(String.valueOf(value));
      }

      void append(String value) {
        int added = value.getBytes(StandardCharsets.UTF_8).length;
        if (added > maxBytes - bytes) {
          throw new OutputLimitException();
        }
        text.append(value);
        bytes += added;
      }

      @Override public String toString() {
        return text.toString();
      }
    }
  }
}

package com.gf.sqlstaticlineage.calcitesemanticprovider;

import org.apache.calcite.config.Lex;
import org.apache.calcite.rel.RelNode;
import org.apache.calcite.rel.RelRoot;
import org.apache.calcite.rel.core.Filter;
import org.apache.calcite.rel.core.Project;
import org.apache.calcite.rel.core.TableScan;
import org.apache.calcite.rel.core.Aggregate;
import org.apache.calcite.rel.core.AggregateCall;
import org.apache.calcite.rel.core.Correlate;
import org.apache.calcite.rel.core.Intersect;
import org.apache.calcite.rel.core.Join;
import org.apache.calcite.rel.core.Minus;
import org.apache.calcite.rel.core.Sort;
import org.apache.calcite.rel.core.Union;
import org.apache.calcite.rel.core.Window;
import org.apache.calcite.rel.RelFieldCollation;
import org.apache.calcite.rel.metadata.RelMetadataQuery;
import org.apache.calcite.util.Arrow;
import org.apache.calcite.util.ArrowSet;
import org.apache.calcite.schema.Statistics;
import org.apache.calcite.schema.Table;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.apache.calcite.schema.impl.AbstractTable;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlCall;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.SqlJoin;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlTableRef;
import org.apache.calcite.sql.SqlHint;
import org.apache.calcite.sql.SqlWith;
import org.apache.calcite.sql.SqlWithItem;
import org.apache.calcite.sql.SqlLiteral;
import org.apache.calcite.sql.SqlOrderBy;
import org.apache.calcite.sql.SqlBasicFunction;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.apache.calcite.sql.validate.SqlConformanceEnum;
import org.apache.calcite.sql.fun.SqlLibrary;
import org.apache.calcite.sql.fun.SqlLibraryOperatorTableFactory;
import org.apache.calcite.sql.fun.SqlLibraryOperators;
import org.apache.calcite.sql.util.SqlOperatorTables;
import org.apache.calcite.sql.type.OperandTypes;
import org.apache.calcite.sql.type.ReturnTypes;
import org.apache.calcite.rel.type.RelDataType;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.sql.type.SqlTypeName;
import org.apache.calcite.tools.FrameworkConfig;
import org.apache.calcite.tools.Frameworks;
import org.apache.calcite.tools.Planner;
import org.apache.calcite.sql2rel.SqlToRelConverter;
import org.apache.calcite.rel.hint.HintPredicates;
import org.apache.calcite.rel.hint.HintStrategyTable;
import org.apache.calcite.rel.hint.RelHint;
import org.apache.calcite.util.ImmutableBitSet;
import org.apache.calcite.rex.RexNode;
import org.apache.calcite.rex.RexCall;
import org.apache.calcite.rex.RexInputRef;
import org.apache.calcite.rex.RexFieldAccess;
import org.apache.calcite.rex.RexCorrelVariable;
import org.apache.calcite.rex.RexVisitorImpl;
import org.apache.calcite.rex.RexFieldCollation;
import org.apache.calcite.rex.RexOver;
import org.apache.calcite.rex.RexSubQuery;
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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Main class for the bounded JSONL Calcite semantic provider. */
public final class CalciteSemanticProvider {
  static {
    // Calcite defaults character literals to ISO-8859-1. Horae/Hive SQL uses
    // UTF-8 literals, so set the process-local Calcite defaults before any
    // operator or type-system singleton is initialized.
    System.setProperty("calcite.default.charset", "UTF-8");
    System.setProperty("calcite.default.nationalcharset", "UTF-8");
    System.setProperty("calcite.default.collation.name", "UTF-8$en_US");
  }
  private static final int PROTOCOL_VERSION = 1;
  private static final String CALCITE_VERSION = "1.42.0";
  private static final int HARD_MAX_INPUT_BYTES = 262144;
  private static final int HARD_MAX_SQL_BYTES = 65536;
  private static final int HARD_MAX_TABLES = 128;
  private static final int HARD_MAX_COLUMNS = 256;
  private static final int HARD_MAX_REL_NODES = 4096;
  private static final int DEFAULT_MAX_OUTPUT_ITEMS = 4096;
  private static final int HARD_MAX_OUTPUT_BYTES = 4194304;
  private static final SqlBasicFunction HIVE_UNIX_TIMESTAMP = SqlBasicFunction.create(
      "UNIX_TIMESTAMP", ReturnTypes.BIGINT, OperandTypes.NILADIC)
      .withDeterministic(false)
      .withDynamic(true);
  private static final SqlBasicFunction HIVE_FROM_UNIXTIME = SqlBasicFunction.create(
      "FROM_UNIXTIME", ReturnTypes.VARCHAR_NULLABLE,
      OperandTypes.sequence("FROM_UNIXTIME(<NUMERIC>, <CHARACTER>)",
          OperandTypes.NUMERIC, OperandTypes.STRING));
  private static final SqlBasicFunction HIVE_DATEDIFF = SqlBasicFunction.create(
      "DATEDIFF", ReturnTypes.INTEGER,
      OperandTypes.sequence("DATEDIFF(<CHARACTER>, <CHARACTER>)",
          OperandTypes.STRING, OperandTypes.STRING));
  private static final int MIN_OUTPUT_BYTES = 512;
  private static final int HARD_MAX_PROCESSING_MS = 5000;
  private static final String BUILD_FINGERPRINT =
      "calcite-semantic-provider/0.1.1-poc;calcite/1.42.0;protocol/1";
  private static final String[] METADATA_KINDS = {
      "expressionLineage", "predicates", "uniqueKeys",
      "functionalDependencies", "tableOccurrences", "rowCountCardinality"
  };

  private CalciteSemanticProvider() {
  }

  public static void main(String[] args) throws Exception {
    BoundedLineReader reader = new BoundedLineReader(System.in, HARD_MAX_INPUT_BYTES);
    BoundedLine line;
    while ((line = reader.nextLine()) != null) {
      ProcessResult result = line.tooLarge
          ? new ProcessResult(response("ERROR", null, "INPUT_TOO_LARGE",
              "JSONL physical line exceeds the 262144 byte hard limit"), HARD_MAX_OUTPUT_BYTES)
          : line.errorCode != null
              ? new ProcessResult(response("ERROR", null, line.errorCode, line.errorMessage),
                  HARD_MAX_OUTPUT_BYTES)
              : processWithinDeadline(line.text);
      try {
        System.out.println(Json.write(result.output, result.maxOutputBytes));
      } catch (OutputLimitException error) {
        System.out.println(Json.write(response("ERROR", null, "OUTPUT_LIMIT",
            "response exceeds the configured byte limit"), result.maxOutputBytes));
      }
    }
  }

  private static ProcessResult process(String line) {
    String requestId = null;
    int maxOutputBytes = HARD_MAX_OUTPUT_BYTES;
    try {
      if (line.trim().isEmpty()) {
        return new ProcessResult(response("ERROR", null, "INPUT_EMPTY", "JSONL line is empty"),
            maxOutputBytes);
      }
      if (line.getBytes(StandardCharsets.UTF_8).length > HARD_MAX_INPUT_BYTES) {
        return new ProcessResult(response("ERROR", null, "INPUT_TOO_LARGE",
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
        return new ProcessResult(response("ERROR", requestId, "PROTOCOL_VERSION_UNSUPPORTED",
            "expected protocolVersion 1"), maxOutputBytes);
      }
      int maxInputBytes = boundedLimit(rawLimits,
          "maxInputBytes", HARD_MAX_INPUT_BYTES);
      if (line.getBytes(StandardCharsets.UTF_8).length > maxInputBytes) {
        throw new InputError("INPUT_TOO_LARGE", "JSONL line exceeds the configured byte limit");
      }
      return new ProcessResult(execute(request, requestId, maxOutputBytes), maxOutputBytes);
    } catch (InputError error) {
      return new ProcessResult(response("ERROR", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (UnsupportedError error) {
      return new ProcessResult(response("UNSUPPORTED", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (PlannerError error) {
      return new ProcessResult(response("ERROR", requestId, error.code, error.getMessage()),
          maxOutputBytes);
    } catch (Exception error) {
      String message = error.getMessage() == null ? error.getClass().getSimpleName()
          : error.getMessage().replace('\n', ' ').replace('\r', ' ');
      return new ProcessResult(response("ERROR", requestId, "CALCITE_FAILURE", message),
          maxOutputBytes);
    }
  }

  private static Map<String, Object> execute(Map<String, Object> request, String requestId,
      int maxOutputBytes) {
    String sql = requiredString(request.get("sql"), "sql");
    String dialect = requiredString(request.get("dialect"), "dialect").toUpperCase(Locale.ROOT);
    if (!("ANSI".equals(dialect) || "HIVE_COMPAT".equals(dialect))) {
      throw new UnsupportedError("DIALECT_UNSUPPORTED", "dialect must be ANSI or HIVE_COMPAT");
    }
    List<Object> dynamicParameters = optionalArray(request.get("dynamicParameters"));
    for (int index = 0; index < dynamicParameters.size(); index++) {
      Map<String, Object> parameter = object(dynamicParameters.get(index), "dynamicParameters[]");
      if (integer(parameter.get("ordinal"), "dynamicParameters.ordinal") != index) {
        throw new InputError("PARAMETER_ORDINAL_INVALID", "dynamic parameter ordinals must be contiguous");
      }
      String parameterType = requiredString(parameter.get("type"), "dynamicParameters.type");
      if ("ANY".equalsIgnoreCase(parameterType)) {
        throw new InputError("PARAMETER_TYPE_ANY_FORBIDDEN", "dynamic parameter type cannot be ANY");
      }
      requiredBoolean(parameter.get("nullable"), "dynamicParameters.nullable");
    }
    if (!dynamicParameters.isEmpty()) {
      throw new UnsupportedError("TYPED_DYNAMIC_PARAMETERS_UNSUPPORTED",
          "typed dynamic parameter injection is not implemented in this POC build");
    }
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
    SqlParser.Config parserConfig = SqlParser.config()
        .withLex(Lex.JAVA)
        .withCaseSensitive(false);
    if ("HIVE_COMPAT".equals(dialect)) {
      parserConfig = parserConfig.withConformance(SqlConformanceEnum.BABEL);
    }
    FrameworkConfig config = Frameworks.newConfigBuilder()
        .defaultSchema(defaultSchema)
        // Calcite has no Hive Lex profile. BABEL admits the bounded Hive syntax
        // accepted by this POC while validation still uses exact typed schemas.
        .parserConfig(parserConfig)
        .operatorTable("HIVE_COMPAT".equals(dialect)
            ? SqlOperatorTables.chain(
                SqlLibraryOperatorTableFactory.INSTANCE.getOperatorTable(
                    SqlLibrary.STANDARD, SqlLibrary.HIVE),
                // Hive's two-argument SUBSTR has the same operand/return
                // semantics as Calcite's MySQL library declaration. Register
                // only that operator instead of enabling the whole MySQL dialect.
                SqlOperatorTables.of(
                    SqlLibraryOperators.SUBSTR_MYSQL,
                    SqlLibraryOperators.NVL,
                    SqlLibraryOperators.IF,
                    SqlLibraryOperators.REGEXP_REPLACE_3,
                    SqlLibraryOperators.CONCAT_FUNCTION,
                    HIVE_UNIX_TIMESTAMP,
                    HIVE_FROM_UNIXTIME,
                    HIVE_DATEDIFF))
            : SqlLibraryOperatorTableFactory.INSTANCE.getOperatorTable(
                SqlLibrary.STANDARD))
        .sqlToRelConverterConfig(SqlToRelConverter.config().withHintStrategyTable(
            HintStrategyTable.builder()
                .hintStrategy("SOURCE_OCCURRENCE", HintPredicates.TABLE_SCAN)
                .build()))
        .build();
    Planner planner = Frameworks.getPlanner(config);
    try {
      SqlNode parsed = planner.parse(sql);
      if (!parsed.isA(SqlKind.QUERY)) {
        throw new UnsupportedError("UNSUPPORTED_SQL", "parsed statement is not a query");
      }
      parsed = new SourceOccurrenceAnnotator().annotateQuery(
          parsed, Collections.<String>emptySet());
      SqlNode validated = planner.validate(parsed);
      RelRoot relRoot = planner.rel(validated);
      return success(request, requestId, relRoot.rel, definitions, requested,
          boundedLimit(rawLimits, "maxRelNodes", HARD_MAX_REL_NODES),
          boundedLimit(rawLimits, "maxOutputItems", DEFAULT_MAX_OUTPUT_ITEMS), maxOutputBytes);
    } catch (OracleError error) {
      throw error;
    } catch (Exception error) {
      String message = boundedCauseMessage(error);
      if (message.contains("No match found for function signature")) {
        throw new UnsupportedError("FUNCTION_UNSUPPORTED", message);
      }
      if (message.contains("not found") &&
          (message.contains("Column") || message.contains("Object") || message.contains("Table"))) {
        throw new UnsupportedError("SCHEMA_BINDING_UNSUPPORTED", message);
      }
      throw new PlannerError("PLANNER_FAILURE", message);
    } finally {
      planner.close();
    }
  }

  private static Map<String, Object> success(Map<String, Object> request, String requestId, RelNode root,
      List<TableDefinition> definitions, Set<String> requested, int maxRelNodes, int maxOutputItems,
      int maxOutputBytes) {
    RelMetadataQuery metadata = root.getCluster().getMetadataQuery();
    final List<RelNode> nodes = new ArrayList<RelNode>();
    collectRelNodes(root, nodes, new HashSet<RelNode>());
    if (nodes.size() > maxRelNodes) {
      throw new UnsupportedError("RELNODE_LIMIT",
          "relational plan exceeds the configured node limit");
    }
    Map<String, Object> output = response("SUCCESS", requestId, null, null);
    output.put("facts", candidateFacts(request, requestId, nodes, metadata, requested));
    try {
      Json.write(output, maxOutputBytes);
    } catch (OutputLimitException error) {
      throw new UnsupportedError("OUTPUT_LIMIT", "response exceeds the configured byte limit");
    }
    return output;
  }

  private static String boundedCauseMessage(Throwable error) {
    StringBuilder output = new StringBuilder();
    Throwable current = error;
    int depth = 0;
    while (current != null && depth < 6 && output.length() < 1800) {
      if (depth > 0) output.append(" <- ");
      output.append(current.getClass().getSimpleName());
      if (current.getMessage() != null && !current.getMessage().isEmpty()) {
        output.append(": ").append(current.getMessage().replace('\n', ' ').replace('\r', ' '));
      }
      current = current.getCause();
      depth++;
    }
    if (output.length() == 0) return "Calcite could not validate the query";
    return output.length() <= 2000 ? output.toString() : output.substring(0, 2000);
  }

  private static ProcessResult processWithinDeadline(final String text) {
    final String requestId = bestEffortRequestId(text);
    FutureTask<ProcessResult> work = new FutureTask<ProcessResult>(
        new java.util.concurrent.Callable<ProcessResult>() {
          @Override public ProcessResult call() { return process(text); }
        });
    Thread worker = new Thread(work, "calcite-semantic-provider-request");
    worker.setDaemon(true);
    worker.start();
    try {
      return work.get(HARD_MAX_PROCESSING_MS, TimeUnit.MILLISECONDS);
    } catch (TimeoutException error) {
      work.cancel(true);
      return new ProcessResult(response("ERROR", requestId, "DEADLINE_EXCEEDED",
          "Calcite Provider request exceeded the 5000 ms hard deadline"),
          HARD_MAX_OUTPUT_BYTES);
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      return new ProcessResult(response("ERROR", requestId, "PROVIDER_INTERRUPTED",
          "Calcite Provider request was interrupted"), HARD_MAX_OUTPUT_BYTES);
    } catch (java.util.concurrent.ExecutionException error) {
      Throwable cause = error.getCause();
      return new ProcessResult(response("ERROR", requestId, "CALCITE_FAILURE",
          cause == null ? error.getMessage() : String.valueOf(cause.getMessage())),
          HARD_MAX_OUTPUT_BYTES);
    }
  }

  private static String bestEffortRequestId(String text) {
    try {
      Object parsed = Json.parse(text);
      if (!(parsed instanceof Map)) return null;
      Object value = ((Map<?, ?>) parsed).get("requestId");
      return value instanceof String ? (String) value : null;
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  private static Map<String, Object> candidateFacts(Map<String, Object> request, String requestId,
      List<RelNode> nodes, RelMetadataQuery metadata,
      Set<String> requested) {
    Map<RelNode, String> relationIds = new HashMap<RelNode, String>();
    for (int index = 0; index < nodes.size(); index++) {
      relationIds.put(nodes.get(index), String.format(Locale.ROOT, "rel:%04d", index));
    }
    List<Object> relations = new ArrayList<Object>();
    List<Object> fields = new ArrayList<Object>();
    List<Object> operators = new ArrayList<Object>();
    List<Object> dependencies = new ArrayList<Object>();
    List<Object> semanticMetadata = new ArrayList<Object>();
    List<Object> mappings = new ArrayList<Object>();
    List<Object> issues = new ArrayList<Object>();
    Set<String> dependencyKeys = new HashSet<String>();
    int[] dependencyOrdinal = new int[] { 0 };

    for (int index = 0; index < nodes.size(); index++) {
      RelNode node = nodes.get(index);
      String relationId = relationIds.get(node);
      String operatorId = String.format(Locale.ROOT, "op:%04d", index);
      String kind = operatorKind(node);
      if ("UNKNOWN".equals(kind)) {
        Map<String, Object> issue = new TreeMap<String, Object>();
        issue.put("code", "RELNODE_KIND_UNSUPPORTED");
        issue.put("issueId", "issue:operator:" + operatorId);
        issue.put("message", "RelNode kind is not modeled: " + node.getRelTypeName());
        issue.put("severity", "WARNING");
        issue.put("subjectRefs", singletonString(operatorId));
        issues.add(issue);
      }
      List<String> inputRelationIds = new ArrayList<String>();
      for (RelNode input : node.getInputs()) inputRelationIds.add(relationIds.get(input));
      List<String> outputFieldIds = new ArrayList<String>();
      for (int slot = 0; slot < node.getRowType().getFieldCount(); slot++) {
        String fieldId = fieldId(relationId, slot);
        outputFieldIds.add(fieldId);
        Map<String, Object> field = new TreeMap<String, Object>();
        field.put("fieldId", fieldId);
        field.put("name", node.getRowType().getFieldList().get(slot).getName());
        field.put("nullable", node.getRowType().getFieldList().get(slot).getType().isNullable());
        field.put("relationId", relationId);
        field.put("role", "OUTPUT");
        field.put("slot", slot);
        field.put("typeName", node.getRowType().getFieldList().get(slot).getType()
            .getSqlTypeName().getName());
        fields.add(field);
      }
      Map<String, Object> relation = new TreeMap<String, Object>();
      relation.put("inputRelationIds", inputRelationIds);
      relation.put("kind", kind);
      relation.put("outputFieldIds", outputFieldIds);
      relation.put("providerOrdinal", index);
      if (node instanceof TableScan) {
        relation.put("qualifiedTableName",
            joinQualified(((TableScan) node).getTable().getQualifiedName()));
        List<Object> sourceOccurrences = tableSourceOccurrences((TableScan) node);
        if (!sourceOccurrences.isEmpty()) relation.put("sourceOccurrences", sourceOccurrences);
      }
      relation.put("relationId", relationId);
      relations.add(relation);
      Map<String, Object> operator = new TreeMap<String, Object>();
      operator.put("inputRelationIds", inputRelationIds);
      List<String> inputRoles = operatorInputRoles(node);
      if (inputRoles != null) operator.put("inputRoles", inputRoles);
      if (node instanceof Join) operator.put("joinType", joinTypeName((Join) node));
      operator.put("kind", kind);
      operator.put("operatorId", operatorId);
      operator.put("relationId", relationId);
      operators.add(operator);
      int dependencyStart = dependencies.size();
      extractDependencies(node, relationId, operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, dependencyOrdinal);
      if (requested.contains("expressionLineage") &&
          (node instanceof Project || node instanceof Aggregate || node instanceof Window)) {
        List<String> expressionDependencyIds = new ArrayList<String>();
        for (int dependencyIndex = dependencyStart;
            dependencyIndex < dependencies.size(); dependencyIndex++) {
          @SuppressWarnings("unchecked")
          Map<String, Object> dependency = (Map<String, Object>) dependencies.get(dependencyIndex);
          expressionDependencyIds.add(String.valueOf(dependency.get("dependencyId")));
        }
        addMetadata(semanticMetadata, relationId, "EXPRESSION_LINEAGE",
            expressionDependencyIds);
      }
      appendMetadata(node, relationId, metadata, semanticMetadata, requested);
    }
    if (!dependencies.isEmpty()) addNativeEvidencePendingIssue(issues);
    List<Object> capabilityFacts = capabilities(dependencies, semanticMetadata, issues, requested);
    sortBy(relations, "relationId");
    sortBy(fields, "fieldId");
    sortBy(operators, "operatorId");
    sortBy(dependencies, "dependencyId");
    sortBy(semanticMetadata, "metadataId");
    sortBy(mappings, "mappingId");
    sortBy(issues, "issueId");
    Map<String, Object> facts = new TreeMap<String, Object>();
    facts.put("capabilities", capabilityFacts);
    facts.put("dependencies", dependencies);
    facts.put("evidenceMappings", mappings);
    facts.put("fields", fields);
    facts.put("input", inputIdentity(request, requestId));
    facts.put("issues", issues);
    facts.put("metadata", semanticMetadata);
    facts.put("operators", operators);
    Map<String, Object> provider = new TreeMap<String, Object>();
    provider.put("adapterVersion", "0.1.1-poc");
    provider.put("buildFingerprint", sha256(BUILD_FINGERPRINT));
    provider.put("calciteVersion", CALCITE_VERSION);
    provider.put("name", "calcite-semantic-provider");
    facts.put("provider", provider);
    facts.put("relations", relations);
    facts.put("schemaVersion", "0.1.0-poc");
    facts.put("statementStatus", issues.isEmpty() ? "SUCCESS" : "PARTIAL");
    return facts;
  }

  private static List<Object> capabilities(List<Object> dependencies,
      List<Object> metadata, List<Object> issues, Set<String> requested) {
    String[] names = { "EXPRESSION_LINEAGE", "FUNCTIONAL_DEPENDENCIES", "PREDICATES",
        "RELATIONAL_SEMANTICS", "ROW_COUNT", "UNIQUE_KEYS" };
    List<Object> output = new ArrayList<Object>();
    for (String name : names) {
      boolean evaluated;
      if ("RELATIONAL_SEMANTICS".equals(name)) {
        evaluated = true;
      } else if ("EXPRESSION_LINEAGE".equals(name)) {
        evaluated = requested.contains("expressionLineage") && hasEvaluatedDependency(dependencies);
      } else {
        String metadataKind = "PREDICATES".equals(name) ? "PREDICATE" : name;
        String requestName = "PREDICATES".equals(name) ? "predicates"
            : "FUNCTIONAL_DEPENDENCIES".equals(name) ? "functionalDependencies"
            : "ROW_COUNT".equals(name) ? "rowCountCardinality"
            : "UNIQUE_KEYS".equals(name) ? "uniqueKeys" : "";
        evaluated = requested.contains(requestName) && allMetadataEvaluated(metadata, metadataKind);
      }
      Map<String, Object> item = new TreeMap<String, Object>();
      item.put("capability", name);
      item.put("evaluationStatus", evaluated ? "EVALUATED" : "NOT_EVALUATED");
      if (!evaluated) {
        String issueId = "issue:capability:" + name.toLowerCase(Locale.ROOT);
        item.put("issueRefs", singletonString(issueId));
        Map<String, Object> issue = new TreeMap<String, Object>();
        issue.put("code", "CAPABILITY_PARTIAL");
        issue.put("issueId", issueId);
        issue.put("message", name + " was not evaluated for every applicable relation.");
        issue.put("severity", "INFO");
        issues.add(issue);
      }
      output.add(item);
    }
    return output;
  }

  private static boolean hasEvaluatedDependency(List<Object> dependencies) {
    for (Object raw : dependencies) {
      @SuppressWarnings("unchecked")
      Map<String, Object> dependency = (Map<String, Object>) raw;
      if ("EVALUATED".equals(dependency.get("evaluationStatus"))) return true;
    }
    return false;
  }

  private static boolean allMetadataEvaluated(List<Object> metadata, String kind) {
    boolean found = false;
    for (Object raw : metadata) {
      @SuppressWarnings("unchecked")
      Map<String, Object> item = (Map<String, Object>) raw;
      if (!kind.equals(item.get("kind"))) continue;
      found = true;
      if (!"EVALUATED".equals(item.get("evaluationStatus"))) return false;
    }
    return found;
  }

  private static Map<String, Object> inputIdentity(Map<String, Object> request, String requestId) {
    String sql = requiredString(request.get("sql"), "sql");
    Map<String, Object> identity = new TreeMap<String, Object>();
    String dialect = optionalString(request.get("dialect"));
    identity.put("dialectDigest", sha256(dialect == null ? "ANSI" : dialect));
    identity.put("schemaSha256", sha256(Json.write(request.get("schema"), HARD_MAX_OUTPUT_BYTES)));
    identity.put("sqlSha256", sha256(sql));
    String sourceId = optionalString(request.get("sqlSourceId"));
    identity.put("sqlSourceId", stableId(sourceId == null
        ? (requestId == null ? "sql:anonymous" : "sql:" + requestId) : sourceId));
    Object ordinal = request.get("statementOrdinal");
    identity.put("statementOrdinal", ordinal == null ? 0 : integer(ordinal, "statementOrdinal"));
    return identity;
  }

  private static void extractDependencies(RelNode node, String relationId, String operatorId,
      Map<RelNode, String> relationIds, List<Object> dependencies, List<Object> mappings,
      List<Object> issues, Set<String> dependencyKeys, int[] ordinal) {
    if (node instanceof Project) {
      Project project = (Project) node;
      addDependency("RELATION_EXISTENCE", "RELATION_EXISTENCE",
          singletonString(relationIds.get(project.getInput())), singletonString(relationId),
          operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
      for (int output = 0; output < project.getProjects().size(); output++) {
        RexNode expression = project.getProjects().get(output);
        List<RexOver> overs = rexOvers(expression);
        if (!overs.isEmpty()) {
          addRexOverDependencies(overs, project.getInput(), fieldId(relationId, output),
              operatorId, relationIds, dependencies, mappings, issues, dependencyKeys, ordinal);
        } else if (isConditional(expression)) {
          addConditionalDependencies(expression, project.getInput(), fieldId(relationId, output),
              operatorId, relationIds, dependencies, mappings, issues, dependencyKeys, ordinal);
        } else {
          List<String> refs = inputFieldRefs(project.getInput(), inputRefs(expression), relationIds);
          addDependency(refs.isEmpty() ? "RELATION_EXISTENCE" : "VALUE_INPUT",
              refs.isEmpty() ? "RELATION_EXISTENCE" : "FIELD_VALUE",
              refs.isEmpty() ? singletonString(relationIds.get(project.getInput())) : refs,
              singletonString(fieldId(relationId, output)), operatorId,
              dependencies, mappings, issues, dependencyKeys, ordinal);
        }
      }
      return;
    }
    if (node instanceof Filter) {
      Filter filter = (Filter) node;
      addFieldPassThrough(filter.getInput(), relationId, 0, filter.getRowType().getFieldCount(),
          operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      addDependency("RELATION_EXISTENCE", "RELATION_EXISTENCE",
          singletonString(relationIds.get(filter.getInput())), singletonString(relationId),
          operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
      addDependency("FILTER_PREDICATE", "ROW_MEMBERSHIP",
          inputFieldRefs(filter.getInput(), inputRefs(filter.getCondition()), relationIds),
          singletonString(relationId), operatorId, dependencies, mappings, issues,
          dependencyKeys, ordinal);
      for (RexSubQuery subQuery : rexSubQueries(filter.getCondition())) {
        addDependency("RELATION_EXISTENCE", "ROW_MEMBERSHIP",
            singletonString(relationIds.get(subQuery.rel)), singletonString(relationId), operatorId,
            dependencies, mappings, issues, dependencyKeys, ordinal);
        addDependency("FILTER_PREDICATE", "ROW_MEMBERSHIP",
            subQueryPredicateRefs(subQuery, filter.getInput(), relationIds),
            singletonString(relationId), operatorId, dependencies, mappings, issues,
            dependencyKeys, ordinal);
      }
      return;
    }
    if (node instanceof Join) {
      Join join = (Join) node;
      addFieldPassThrough(join.getLeft(), relationId, 0, join.getRowType().getFieldCount(),
          operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      addFieldPassThrough(join.getRight(), relationId,
          join.getLeft().getRowType().getFieldCount(), join.getRowType().getFieldCount(),
          operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      List<String> refs = joinInputFieldRefs(join, inputRefs(join.getCondition()), relationIds);
      List<String> inputRelations = new ArrayList<String>();
      for (RelNode input : join.getInputs()) inputRelations.add(relationIds.get(input));
      String joinType = joinTypeName(join);
      List<String> existenceInputs = new ArrayList<String>();
      if ("LEFT".equals(joinType) || "SEMI".equals(joinType) || "ANTI".equals(joinType)) {
        existenceInputs.add(relationIds.get(join.getLeft()));
      } else if ("RIGHT".equals(joinType)) {
        existenceInputs.add(relationIds.get(join.getRight()));
      } else {
        existenceInputs.addAll(inputRelations);
      }
      addDependency("RELATION_EXISTENCE", "RELATION_EXISTENCE", existenceInputs,
          singletonString(relationId), operatorId, dependencies, mappings, issues,
          dependencyKeys, ordinal);
      if (refs.isEmpty()) {
        addDependency("JOIN_CARDINALITY", "MULTIPLICITY", inputRelations,
            singletonString(relationId), operatorId, dependencies, mappings, issues,
            dependencyKeys, ordinal);
      } else {
        addDependency(isOuterJoin(joinType) ? "JOIN_NULL_EXTENSION" : "JOIN_MATCH",
            isOuterJoin(joinType) ? "NULL_EXTENSION" : "ROW_MEMBERSHIP", refs,
            singletonString(relationId), operatorId, dependencies, mappings, issues,
            dependencyKeys, ordinal);
        addDependency("JOIN_CARDINALITY", "MULTIPLICITY", refs, singletonString(relationId),
            operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
      }
      return;
    }
    if (node instanceof Aggregate) {
      Aggregate aggregate = (Aggregate) node;
      RelNode input = aggregate.getInput();
      List<Integer> groupRefs = new ArrayList<Integer>();
      for (Integer bit : aggregate.getGroupSet()) groupRefs.add(bit);
      List<String> groupFieldRefs = inputFieldRefs(input, groupRefs, relationIds);
      addDependency(operatorKind(aggregate).equals("DISTINCT") ? "SET_MEMBERSHIP" : "GROUP_KEY",
          operatorKind(aggregate).equals("DISTINCT") ? "SET_MEMBERSHIP" : "GROUPING",
          groupFieldRefs, singletonString(relationId), operatorId,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      for (int groupOutput = 0; groupOutput < groupRefs.size(); groupOutput++) {
        addDependency("VALUE_INPUT", "FIELD_VALUE",
            singletonString(fieldId(relationIds.get(input), groupRefs.get(groupOutput))),
            singletonString(fieldId(relationId, groupOutput)), operatorId,
            dependencies, mappings, issues, dependencyKeys, ordinal);
      }
      int output = aggregate.getGroupCount();
      for (AggregateCall call : aggregate.getAggCallList()) {
        if (call.getArgList().isEmpty()) {
          addDependency("RELATION_EXISTENCE", "RELATION_EXISTENCE",
              singletonString(relationIds.get(input)), singletonString(fieldId(relationId, output)),
              operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
        } else {
          addDependency("AGGREGATE_INPUT", "FIELD_VALUE",
              inputFieldRefs(input, new ArrayList<Integer>(call.getArgList()), relationIds),
              singletonString(fieldId(relationId, output)), operatorId,
              dependencies, mappings, issues, dependencyKeys, ordinal);
        }
        output++;
      }
      return;
    }
    if (node instanceof Union || node instanceof Intersect || node instanceof Minus) {
      for (RelNode input : node.getInputs()) {
        String inputRelationId = relationIds.get(input);
        addDependency("SET_MEMBERSHIP", "SET_MEMBERSHIP", singletonString(inputRelationId),
            singletonString(relationId), operatorId, dependencies, mappings, issues,
            dependencyKeys, ordinal);
        int count = Math.min(input.getRowType().getFieldCount(), node.getRowType().getFieldCount());
        for (int slot = 0; slot < count; slot++) addDependency("VALUE_INPUT", "FIELD_VALUE",
            singletonString(fieldId(inputRelationId, slot)), singletonString(fieldId(relationId, slot)),
            operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
      }
      return;
    }
    if (node instanceof Window) {
      Window window = (Window) node;
      RelNode input = window.getInput();
      addFieldPassThrough(input, relationId, 0, window.getRowType().getFieldCount(),
          operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      int outputSlot = input.getRowType().getFieldCount();
      for (Window.Group group : window.groups) {
        List<Integer> partition = new ArrayList<Integer>();
        for (Integer bit : group.keys) partition.add(bit);
        addDependency("WINDOW_PARTITION", "WINDOW_EFFECT",
            inputFieldRefs(input, partition, relationIds), singletonString(relationId), operatorId,
            dependencies, mappings, issues, dependencyKeys, ordinal);
        List<Integer> order = new ArrayList<Integer>();
        for (RelFieldCollation field : group.orderKeys.getFieldCollations()) order.add(field.getFieldIndex());
        addDependency("WINDOW_ORDER", "WINDOW_EFFECT", inputFieldRefs(input, order, relationIds),
            singletonString(relationId), operatorId, dependencies, mappings, issues,
            dependencyKeys, ordinal);
        addDependency("WINDOW_FRAME", "WINDOW_EFFECT",
            singletonString(relationIds.get(input)), singletonString(relationId), operatorId,
            dependencies, mappings, issues, dependencyKeys, ordinal);
        for (Window.RexWinAggCall call : group.aggCalls) {
          addDependency("WINDOW_VALUE", "WINDOW_EFFECT",
              inputFieldRefs(input, inputRefs(call), relationIds),
              singletonString(fieldId(relationId, outputSlot++)), operatorId,
              dependencies, mappings, issues, dependencyKeys, ordinal);
        }
      }
      return;
    }
    if (node instanceof Sort) {
      Sort sort = (Sort) node;
      addFieldPassThrough(sort.getInput(), relationId, 0, sort.getRowType().getFieldCount(),
          operatorId, relationIds,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      addDependency("RELATION_EXISTENCE", "RELATION_EXISTENCE",
          singletonString(relationIds.get(sort.getInput())), singletonString(relationId),
          operatorId, dependencies, mappings, issues, dependencyKeys, ordinal);
      List<Integer> refs = new ArrayList<Integer>();
      for (RelFieldCollation field : sort.getCollation().getFieldCollations()) refs.add(field.getFieldIndex());
      boolean selectsRows = sort.fetch != null || sort.offset != null;
      addDependency(selectsRows ? "ORDER_SELECTION" : "WINDOW_ORDER",
          selectsRows ? "ORDER_SELECTION" : "WINDOW_EFFECT",
          inputFieldRefs(sort.getInput(), refs, relationIds), singletonString(relationId), operatorId,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      return;
    }
    if (node instanceof Correlate) {
      int outputOffset = 0;
      for (RelNode input : node.getInputs()) {
        addFieldPassThrough(input, relationId, outputOffset, node.getRowType().getFieldCount(),
            operatorId, relationIds,
            dependencies, mappings, issues, dependencyKeys, ordinal);
        outputOffset += input.getRowType().getFieldCount();
      }
      for (RelNode input : node.getInputs()) addDependency("RELATION_EXISTENCE",
          "RELATION_EXISTENCE", singletonString(relationIds.get(input)),
          singletonString(relationId), operatorId, dependencies, mappings, issues,
          dependencyKeys, ordinal);
    }
  }

  private static void addConditionalDependencies(RexNode expression, RelNode input, String target,
      String operatorId, Map<RelNode, String> relationIds, List<Object> dependencies,
      List<Object> mappings, List<Object> issues, Set<String> dependencyKeys, int[] ordinal) {
    RexCall call = (RexCall) expression;
    List<Integer> selectors = new ArrayList<Integer>();
    List<Integer> values = new ArrayList<Integer>();
    if (call.getKind() == SqlKind.CASE) {
      for (int index = 0; index < call.getOperands().size(); index++) {
        List<Integer> refs = inputRefs(call.getOperands().get(index));
        if (index < call.getOperands().size() - 1 && index % 2 == 0) selectors.addAll(refs);
        else values.addAll(refs);
      }
    } else {
      for (RexNode operand : call.getOperands()) {
        selectors.addAll(inputRefs(operand));
        values.addAll(inputRefs(operand));
      }
    }
    addDependency("EXPRESSION_SELECTOR", "EXPRESSION_CONTROL",
        inputFieldRefs(input, selectors, relationIds), singletonString(target), operatorId,
        dependencies, mappings, issues, dependencyKeys, ordinal);
    addDependency("VALUE_INPUT", "FIELD_VALUE", inputFieldRefs(input, values, relationIds),
        singletonString(target), operatorId, dependencies, mappings, issues,
        dependencyKeys, ordinal);
  }

  private static void addRexOverDependencies(List<RexOver> overs, RelNode input, String target,
      String operatorId, Map<RelNode, String> relationIds, List<Object> dependencies,
      List<Object> mappings, List<Object> issues, Set<String> dependencyKeys, int[] ordinal) {
    for (RexOver over : overs) {
      List<Integer> values = new ArrayList<Integer>();
      for (RexNode operand : over.getOperands()) values.addAll(inputRefs(operand));
      addDependency("WINDOW_VALUE", "WINDOW_EFFECT", inputFieldRefs(input, values, relationIds),
          singletonString(target), operatorId, dependencies, mappings, issues,
          dependencyKeys, ordinal);
      List<Integer> partition = new ArrayList<Integer>();
      for (RexNode key : over.getWindow().partitionKeys) partition.addAll(inputRefs(key));
      addDependency("WINDOW_PARTITION", "WINDOW_EFFECT",
          inputFieldRefs(input, partition, relationIds), singletonString(target), operatorId,
          dependencies, mappings, issues, dependencyKeys, ordinal);
      List<Integer> order = new ArrayList<Integer>();
      for (RexFieldCollation key : over.getWindow().orderKeys) order.addAll(inputRefs(key.left));
      addDependency("WINDOW_ORDER", "WINDOW_EFFECT", inputFieldRefs(input, order, relationIds),
          singletonString(target), operatorId, dependencies, mappings, issues,
          dependencyKeys, ordinal);
      addDependency("WINDOW_FRAME", "WINDOW_EFFECT",
          singletonString(relationIds.get(input)), singletonString(target), operatorId,
          dependencies, mappings, issues, dependencyKeys, ordinal);
    }
  }

  private static void collectRelNodes(RelNode node, List<RelNode> output, Set<RelNode> seen) {
    if (!seen.add(node)) return;
    output.add(node);
    for (RelNode input : node.getInputs()) collectRelNodes(input, output, seen);
    for (RexNode expression : nodeExpressions(node)) {
      for (RexSubQuery subQuery : rexSubQueries(expression)) {
        collectRelNodes(subQuery.rel, output, seen);
      }
    }
  }

  private static List<RexNode> nodeExpressions(RelNode node) {
    List<RexNode> output = new ArrayList<RexNode>();
    if (node instanceof Project) output.addAll(((Project) node).getProjects());
    if (node instanceof Filter) output.add(((Filter) node).getCondition());
    if (node instanceof Join) output.add(((Join) node).getCondition());
    return output;
  }

  private static List<RexSubQuery> rexSubQueries(RexNode expression) {
    final List<RexSubQuery> output = new ArrayList<RexSubQuery>();
    expression.accept(new RexVisitorImpl<Void>(true) {
      @Override public Void visitSubQuery(RexSubQuery subQuery) {
        output.add(subQuery);
        return super.visitSubQuery(subQuery);
      }
    });
    return output;
  }

  private static List<String> subQueryPredicateRefs(RexSubQuery subQuery, RelNode outerInput,
      Map<RelNode, String> relationIds) {
    List<String> output = new ArrayList<String>();
    List<RelNode> subNodes = new ArrayList<RelNode>();
    collectRelNodes(subQuery.rel, subNodes, new HashSet<RelNode>());
    for (RelNode subNode : subNodes) {
      for (RexNode expression : nodeExpressions(subNode)) {
        if (subNode instanceof Filter) {
          output.addAll(inputFieldRefs(((Filter) subNode).getInput(), inputRefs(expression), relationIds));
        } else if (subNode instanceof Join) {
          output.addAll(joinInputFieldRefs((Join) subNode, inputRefs(expression), relationIds));
        }
        for (Integer correlated : correlatedInputRefs(expression)) {
          if (correlated >= 0 && correlated < outerInput.getRowType().getFieldCount()) {
            output.add(fieldId(relationIds.get(outerInput), correlated));
          }
        }
      }
    }
    return sortedUnique(output);
  }

  private static List<Integer> correlatedInputRefs(RexNode expression) {
    final Set<Integer> refs = new LinkedHashSet<Integer>();
    expression.accept(new RexVisitorImpl<Void>(true) {
      @Override public Void visitFieldAccess(RexFieldAccess fieldAccess) {
        if (fieldAccess.getReferenceExpr() instanceof RexCorrelVariable) {
          refs.add(fieldAccess.getField().getIndex());
        }
        return super.visitFieldAccess(fieldAccess);
      }
    });
    List<Integer> output = new ArrayList<Integer>(refs);
    Collections.sort(output);
    return output;
  }

  private static List<RexOver> rexOvers(RexNode expression) {
    final List<RexOver> output = new ArrayList<RexOver>();
    expression.accept(new RexVisitorImpl<Void>(true) {
      @Override public Void visitOver(RexOver over) {
        output.add(over);
        return super.visitOver(over);
      }
    });
    return output;
  }

  private static void addFieldPassThrough(RelNode input, String targetRelationId,
      int outputOffset, int targetFieldCount, String operatorId,
      Map<RelNode, String> relationIds, List<Object> dependencies, List<Object> mappings,
      List<Object> issues, Set<String> dependencyKeys, int[] ordinal) {
    String inputRelationId = relationIds.get(input);
    for (int slot = 0; slot < input.getRowType().getFieldCount(); slot++) {
      int outputSlot = outputOffset + slot;
      if (outputSlot >= targetFieldCount) break;
      addDependency("VALUE_INPUT", "FIELD_VALUE",
          singletonString(fieldId(inputRelationId, slot)),
          singletonString(fieldId(targetRelationId, outputSlot)), operatorId,
          dependencies, mappings, issues, dependencyKeys, ordinal);
    }
  }

  private static void addDependency(String dependencyKind, String impactKind,
      List<String> rawFromRefs, List<String> rawToRefs, String operatorId,
      List<Object> dependencies, List<Object> mappings, List<Object> issues,
      Set<String> dependencyKeys, int[] ordinal) {
    List<String> fromRefs = sortedUnique(rawFromRefs);
    List<String> toRefs = sortedUnique(rawToRefs);
    if (fromRefs.isEmpty() || toRefs.isEmpty()) return;
    String semanticKey = dependencyKind + "|" + impactKind + "|" + operatorId
        + "|" + fromRefs.toString() + "|" + toRefs.toString();
    if (!dependencyKeys.add(semanticKey)) return;
    String dependencyId = String.format(Locale.ROOT, "dep:%05d", ordinal[0]++);
    String mappingId = "mapping:" + dependencyId;
    String issueId = "issue:native-evidence:not-assembled";
    Map<String, Object> dependency = new TreeMap<String, Object>();
    dependency.put("dependencyId", dependencyId);
    dependency.put("dependencyKind", dependencyKind);
    dependency.put("evaluationStatus", "EVALUATED");
    dependency.put("evidenceMappingRefs", singletonString(mappingId));
    dependency.put("fromRefs", fromRefs);
    dependency.put("impactKind", impactKind);
    dependency.put("issueRefs", singletonString(issueId));
    dependency.put("operatorId", operatorId);
    dependency.put("toRefs", toRefs);
    dependencies.add(dependency);
    Map<String, Object> mapping = new TreeMap<String, Object>();
    mapping.put("evidenceRefs", Collections.emptyList());
    mapping.put("mappingId", mappingId);
    mapping.put("mappingStatus", "NOT_ASSEMBLED");
    mapping.put("providerRefId", dependencyId);
    mappings.add(mapping);
  }

  private static void addNativeEvidencePendingIssue(List<Object> issues) {
    Map<String, Object> issue = new TreeMap<String, Object>();
    issue.put("code", "NATIVE_EVIDENCE_NOT_ASSEMBLED");
    issue.put("issueId", "issue:native-evidence:not-assembled");
    issue.put("message", "Provider-local semantic fact requires Native evidence assembly.");
    issue.put("severity", "INFO");
    issues.add(issue);
  }

  private static void appendMetadata(RelNode node, String relationId, RelMetadataQuery metadata,
      List<Object> output, Set<String> requested) {
    if (requested.contains("rowCountCardinality")) {
      addMetadata(output, relationId, "ROW_COUNT", safeRowCount(metadata, node));
    }
    Set<ImmutableBitSet> keys = null;
    if (requested.contains("uniqueKeys")) {
      try { keys = metadata.getUniqueKeys(node); } catch (RuntimeException ignored) { }
      addMetadata(output, relationId, "UNIQUE_KEYS", keys == null ? null : bitSets(keys));
    }
    ArrowSet fds = null;
    if (requested.contains("functionalDependencies")) {
      try { fds = metadata.getFDs(node); } catch (RuntimeException ignored) { }
      addMetadata(output, relationId, "FUNCTIONAL_DEPENDENCIES",
          fds == null ? null : arrows(fds));
    }
    RelOptPredicateList predicates = null;
    if (requested.contains("predicates")) {
      try { predicates = metadata.getPulledUpPredicates(node); } catch (RuntimeException ignored) { }
      addMetadata(output, relationId, "PREDICATE", predicates == null ? null
          : renderRex(predicates.pulledUpPredicates));
    }
  }

  private static void addMetadata(List<Object> output, String relationId, String kind,
      Object value) {
    Map<String, Object> item = new TreeMap<String, Object>();
    // Calcite metadata rules can return an empty collection without proving a
    // closed-world negative fact for the source system. Keep absence conservative.
    item.put("absenceProven", false);
    item.put("basis", "CALCITE_METADATA");
    item.put("evaluationStatus", value == null ? "NOT_EVALUATED" : "EVALUATED");
    item.put("knowledgeStatus", value == null ? "UNKNOWN"
        : ("ROW_COUNT".equals(kind) ? "ESTIMATED" : "DERIVED"));
    item.put("kind", kind);
    item.put("metadataId", "metadata:" + relationId + ":" + kind.toLowerCase(Locale.ROOT));
    item.put("subjectRef", relationId);
    if (value != null) item.put("value", value);
    output.add(item);
  }

  private static Double safeRowCount(RelMetadataQuery metadata, RelNode node) {
    try { return metadata.getRowCount(node); } catch (RuntimeException ignored) { return null; }
  }

  private static List<Object> bitSets(Set<ImmutableBitSet> values) {
    List<Object> output = new ArrayList<Object>();
    for (ImmutableBitSet value : values) output.add(bitNumbersList(value));
    sortRendered(output);
    return output;
  }

  private static List<Object> arrows(ArrowSet values) {
    List<Object> output = new ArrayList<Object>();
    for (Arrow arrow : values.getArrows()) {
      Map<String, Object> value = new TreeMap<String, Object>();
      value.put("dependentOrdinals", bitNumbersList(arrow.getDependents()));
      value.put("determinantOrdinals", bitNumbersList(arrow.getDeterminants()));
      output.add(value);
    }
    sortRendered(output);
    return output;
  }

  private static List<Integer> bitNumbersList(ImmutableBitSet bits) {
    List<Integer> output = new ArrayList<Integer>();
    for (Integer bit : bits) output.add(bit);
    return output;
  }

  private static List<String> renderRex(Iterable<? extends RexNode> values) {
    List<String> output = new ArrayList<String>();
    for (RexNode value : values) output.add(value.toString());
    Collections.sort(output);
    return output;
  }

  private static List<Integer> inputRefs(RexNode expression) {
    final LinkedHashSet<Integer> refs = new LinkedHashSet<Integer>();
    expression.accept(new RexVisitorImpl<Void>(true) {
      @Override public Void visitInputRef(RexInputRef inputRef) {
        refs.add(inputRef.getIndex());
        return null;
      }
    });
    List<Integer> output = new ArrayList<Integer>(refs);
    Collections.sort(output);
    return output;
  }

  private static List<String> inputFieldRefs(RelNode input, List<Integer> refs,
      Map<RelNode, String> relationIds) {
    String relationId = relationIds.get(input);
    List<String> output = new ArrayList<String>();
    for (Integer ref : refs) {
      if (ref >= 0 && ref < input.getRowType().getFieldCount()) output.add(fieldId(relationId, ref));
    }
    return sortedUnique(output);
  }

  private static List<String> joinInputFieldRefs(Join join, List<Integer> refs,
      Map<RelNode, String> relationIds) {
    List<String> output = new ArrayList<String>();
    int leftCount = join.getLeft().getRowType().getFieldCount();
    for (Integer ref : refs) {
      if (ref < leftCount) output.add(fieldId(relationIds.get(join.getLeft()), ref));
      else if (ref - leftCount < join.getRight().getRowType().getFieldCount()) {
        output.add(fieldId(relationIds.get(join.getRight()), ref - leftCount));
      }
    }
    return sortedUnique(output);
  }

  private static boolean isConditional(RexNode expression) {
    if (!(expression instanceof RexCall)) return false;
    RexCall call = (RexCall) expression;
    return call.getKind() == SqlKind.CASE
        || "COALESCE".equalsIgnoreCase(call.getOperator().getName())
        || "IF".equalsIgnoreCase(call.getOperator().getName());
  }

  private static boolean isOuterJoin(String joinType) {
    return "LEFT".equals(joinType) || "RIGHT".equals(joinType) || "FULL".equals(joinType);
  }

  private static List<String> operatorInputRoles(RelNode node) {
    List<String> roles = new ArrayList<String>();
    if (node instanceof Join) {
      String joinType = joinTypeName((Join) node);
      if ("LEFT".equals(joinType)) {
        roles.add("PRESERVED"); roles.add("OPTIONAL");
      } else if ("RIGHT".equals(joinType)) {
        roles.add("OPTIONAL"); roles.add("PRESERVED");
      } else if ("FULL".equals(joinType)) {
        roles.add("PRESERVED"); roles.add("PRESERVED");
      } else if ("SEMI".equals(joinType)) {
        roles.add("PRESERVED"); roles.add("FILTERING");
      } else if ("ANTI".equals(joinType)) {
        roles.add("PRESERVED"); roles.add("EXCLUDING");
      } else if ("CROSS".equals(joinType)) {
        roles.add("CARTESIAN"); roles.add("CARTESIAN");
      } else {
        roles.add("MATCHED"); roles.add("MATCHED");
      }
      return roles;
    }
    if (node instanceof Union) {
      for (RelNode ignored : node.getInputs()) roles.add("CONTRIBUTING");
      return roles;
    }
    if (node instanceof Intersect) {
      for (RelNode ignored : node.getInputs()) roles.add("REQUIRED");
      return roles;
    }
    if (node instanceof Minus) {
      for (int index = 0; index < node.getInputs().size(); index++) {
        roles.add(index == 0 ? "CONTRIBUTING" : "EXCLUDING");
      }
      return roles;
    }
    return null;
  }

  private static String operatorKind(RelNode node) {
    if (node instanceof TableScan) return "TABLE_SCAN";
    if (node instanceof Project) return "PROJECT";
    if (node instanceof Filter) return "FILTER";
    if (node instanceof Join) return "JOIN";
    if (node instanceof Aggregate) {
      Aggregate aggregate = (Aggregate) node;
      return aggregate.getAggCallList().isEmpty()
          && aggregate.getGroupCount() == aggregate.getInput().getRowType().getFieldCount()
          ? "DISTINCT" : "AGGREGATE";
    }
    if (node instanceof Union) return "UNION";
    if (node instanceof Intersect) return "INTERSECT";
    if (node instanceof Minus) return "EXCEPT";
    if (node instanceof Window) return "WINDOW";
    if (node instanceof Sort) {
      Sort sort = (Sort) node;
      return sort.fetch == null && sort.offset == null ? "SORT" : "TOP_N";
    }
    if (node instanceof Correlate) return "CORRELATE";
    if (node.getRelTypeName().toUpperCase(Locale.ROOT).contains("VALUES")) return "VALUES";
    return "UNKNOWN";
  }

  private static String joinTypeName(Join join) {
    String value = join.getJoinType().name();
    return "INNER".equals(value) && inputRefs(join.getCondition()).isEmpty() ? "CROSS" : value;
  }

  private static String fieldId(String relationId, int slot) {
    return relationId + ":field:" + String.format(Locale.ROOT, "%04d", slot);
  }

  private static List<String> singletonString(String value) {
    List<String> output = new ArrayList<String>(); output.add(value); return output;
  }

  private static List<String> sortedUnique(List<String> values) {
    List<String> output = new ArrayList<String>(new LinkedHashSet<String>(values));
    Collections.sort(output); return output;
  }

  private static String joinQualified(List<String> names) {
    StringBuilder output = new StringBuilder();
    for (String name : names) { if (output.length() > 0) output.append('.'); output.append(name); }
    return output.toString();
  }

  private static List<Object> tableSourceOccurrences(TableScan scan) {
    List<Object> output = new ArrayList<Object>();
    for (RelHint hint : scan.getHints()) {
      if (!"SOURCE_OCCURRENCE".equalsIgnoreCase(hint.hintName)
          || hint.listOptions.size() != 1) continue;
      SqlParserPos pos = hint.pos;
      if (pos == null || pos.getLineNum() <= 0 || pos.getColumnNum() <= 0) continue;
      Map<String, Object> span = new TreeMap<String, Object>();
      span.put("endColumn", pos.getEndColumnNum());
      span.put("endLine", pos.getEndLineNum());
      span.put("startColumn", pos.getColumnNum());
      span.put("startLine", pos.getLineNum());
      Map<String, Object> occurrence = new TreeMap<String, Object>();
      occurrence.put("coordinateSystem", "DIALECT_TRANSFORMED_SQL");
      occurrence.put("occurrenceId", hint.listOptions.get(0));
      occurrence.put("sourceKind", "TABLE_REFERENCE");
      occurrence.put("sourceSpan", span);
      output.add(occurrence);
    }
    sortBy(output, "occurrenceId");
    return output;
  }

  /**
   * Adds an internal table hint to parsed table references before validation.
   * Calcite carries that hint to the exact TableScan created from the same
   * SqlNode occurrence, including repeated/self-join reads. CTE names are not
   * tagged as physical leaves; their defining queries are annotated instead.
   */
  private static final class SourceOccurrenceAnnotator {
    private int ordinal;

    SqlNode annotateQuery(SqlNode node, Set<String> visibleCtes) {
      if (node instanceof SqlWith) {
        SqlWith with = (SqlWith) node;
        Set<String> scoped = new HashSet<String>(visibleCtes);
        for (SqlNode rawItem : with.withList) {
          SqlWithItem item = (SqlWithItem) rawItem;
          item.query = annotateQuery(item.query, scoped);
          scoped.add(item.name.getSimple().toLowerCase(Locale.ROOT));
        }
        with.body = annotateQuery(with.body, scoped);
        return with;
      }
      if (node instanceof SqlSelect) {
        SqlSelect select = (SqlSelect) node;
        select.setFrom(annotateFrom(select.getFrom(), visibleCtes));
        annotateNested(select.getSelectList(), visibleCtes);
        annotateNested(select.getWhere(), visibleCtes);
        annotateNested(select.getGroup(), visibleCtes);
        annotateNested(select.getHaving(), visibleCtes);
        annotateNested(select.getWindowList(), visibleCtes);
        annotateNested(select.getQualify(), visibleCtes);
        annotateNested(select.getOrderList(), visibleCtes);
        return select;
      }
      if (node instanceof SqlOrderBy) {
        SqlOrderBy orderBy = (SqlOrderBy) node;
        annotateQuery(orderBy.query, visibleCtes);
        annotateNested(orderBy.orderList, visibleCtes);
        return orderBy;
      }
      if (node instanceof SqlCall) {
        SqlCall call = (SqlCall) node;
        for (int index = 0; index < call.operandCount(); index++) {
          SqlNode operand = call.operand(index);
          if (operand != null && operand.isA(SqlKind.QUERY)) {
            call.setOperand(index, annotateQuery(operand, visibleCtes));
          } else {
            annotateNested(operand, visibleCtes);
          }
        }
      }
      return node;
    }

    private SqlNode annotateFrom(SqlNode node, Set<String> visibleCtes) {
      if (node == null) return null;
      if (node instanceof SqlIdentifier) {
        SqlIdentifier identifier = (SqlIdentifier) node;
        if (identifier.isSimple()
            && visibleCtes.contains(identifier.getSimple().toLowerCase(Locale.ROOT))) {
          return identifier;
        }
        SqlParserPos pos = identifier.getParserPosition();
        String occurrenceId = String.format(Locale.ROOT,
            "sql-table-reference:%04d", ordinal++);
        SqlHint hint = new SqlHint(pos,
            new SqlIdentifier("SOURCE_OCCURRENCE", pos),
            new SqlNodeList(Collections.<SqlNode>singletonList(
                SqlLiteral.createCharString(occurrenceId, pos)), pos),
            SqlHint.HintOptionFormat.LITERAL_LIST);
        return new SqlTableRef(pos, identifier,
            new SqlNodeList(Collections.<SqlNode>singletonList(hint), pos));
      }
      if (node instanceof SqlJoin) {
        SqlJoin join = (SqlJoin) node;
        join.setLeft(annotateFrom(join.getLeft(), visibleCtes));
        join.setRight(annotateFrom(join.getRight(), visibleCtes));
        annotateNested(join.getCondition(), visibleCtes);
        return join;
      }
      if (node.isA(SqlKind.QUERY)) return annotateQuery(node, visibleCtes);
      if (node instanceof SqlCall) {
        SqlCall call = (SqlCall) node;
        if (call.getKind() == SqlKind.AS && call.operandCount() > 0) {
          call.setOperand(0, annotateFrom(call.operand(0), visibleCtes));
        } else {
          annotateNested(call, visibleCtes);
        }
      }
      return node;
    }

    private void annotateNested(SqlNode node, Set<String> visibleCtes) {
      if (node == null) return;
      if (node.isA(SqlKind.QUERY)) {
        annotateQuery(node, visibleCtes);
        return;
      }
      if (node instanceof SqlNodeList) {
        for (SqlNode item : (SqlNodeList) node) annotateNested(item, visibleCtes);
        return;
      }
      if (node instanceof SqlCall) {
        SqlCall call = (SqlCall) node;
        for (int index = 0; index < call.operandCount(); index++) {
          SqlNode operand = call.operand(index);
          if (operand != null && operand.isA(SqlKind.QUERY)) {
            call.setOperand(index, annotateQuery(operand, visibleCtes));
          } else {
            annotateNested(operand, visibleCtes);
          }
        }
      }
    }
  }

  private static String stableId(String value) {
    return value.replaceAll("[^A-Za-z0-9._:/#-]", "_");
  }

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder output = new StringBuilder();
      for (byte item : bytes) output.append(String.format(Locale.ROOT, "%02x", item & 0xff));
      return output.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

  @SuppressWarnings("unchecked")
  private static void sortBy(List<Object> values, final String key) {
    Collections.sort(values, new java.util.Comparator<Object>() {
      @Override public int compare(Object left, Object right) {
        return String.valueOf(((Map<String, Object>) left).get(key))
            .compareTo(String.valueOf(((Map<String, Object>) right).get(key)));
      }
    });
  }

  private static void sortRendered(List<Object> values) {
    Collections.sort(values, new java.util.Comparator<Object>() {
      @Override public int compare(Object left, Object right) {
        return left.toString().compareTo(right.toString());
      }
    });
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
    sortRendered(output);
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
    sortRendered(output);
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
    sortRendered(output);
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
    String schema = requiredString(raw.get("schema"), "table.schema");
    List<Object> rawColumns = array(raw.get("columns"), "table.columns");
    if (rawColumns.size() > maxColumns) {
      throw new InputError("COLUMN_LIMIT", "table.columns exceeds the configured limit");
    }
    List<ColumnDefinition> columns = new ArrayList<ColumnDefinition>();
    for (Object rawColumn : rawColumns) {
      Map<String, Object> column = object(rawColumn, "table.columns[]");
      columns.add(new ColumnDefinition(requiredString(column.get("name"), "column.name"),
          requiredString(column.get("type"), "column.type"),
          requiredBoolean(column.get("nullable"), "column.nullable")));
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
    fingerprint.put("tool", "calcite-semantic-provider");
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

  private static boolean requiredBoolean(Object value, String path) {
    if (!(value instanceof Boolean)) {
      throw new InputError("INPUT_BOOLEAN_EXPECTED", path + " must be a boolean");
    }
    return ((Boolean) value).booleanValue();
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

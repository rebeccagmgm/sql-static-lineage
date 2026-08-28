package com.gf.sqlstaticlineage.calciterelbridge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.calcite.plan.RelOptPredicateList;
import org.apache.calcite.rel.RelNode;
import org.apache.calcite.rel.core.JoinRelType;
import org.apache.calcite.rel.core.Join;
import org.apache.calcite.rel.metadata.RelMetadataQuery;
import org.apache.calcite.util.Arrow;
import org.apache.calcite.util.ArrowSet;
import org.apache.calcite.util.ImmutableBitSet;
import org.apache.calcite.rel.type.RelDataType;
import org.apache.calcite.rel.type.RelDataTypeFactory;
import org.apache.calcite.rex.RexNode;
import org.apache.calcite.schema.SchemaPlus;
import org.apache.calcite.schema.Table;
import org.apache.calcite.schema.impl.AbstractSchema;
import org.apache.calcite.schema.impl.AbstractTable;
import org.apache.calcite.sql.SqlOperator;
import org.apache.calcite.sql.SqlAggFunction;
import org.apache.calcite.sql.SqlCollation;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.type.SqlTypeName;
import org.apache.calcite.tools.FrameworkConfig;
import org.apache.calcite.tools.Frameworks;
import org.apache.calcite.tools.RelBuilder;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Direct, unoptimized relational construction for protocol PLAN_FACTS_REL_V1. */
final class PlanFactsRelExecutor {
  private PlanFactsRelExecutor() {
  }

  static ExecutionResult execute(ObjectMapper json, ObjectNode request) {
    SchemaPlus root = Frameworks.createRootSchema(true);
    registerTables(root, request.path("schema").path("tables"));
    FrameworkConfig config = Frameworks.newConfigBuilder().defaultSchema(root).build();
    Map<String, JsonNode> definitions = new LinkedHashMap<String, JsonNode>();
    for (JsonNode node : request.path("relations")) {
      String nodeId = requiredText(node, "nodeId");
      if (definitions.put(nodeId, node) != null) {
        throw validation("NODE_ID_DUPLICATE", "duplicate relation node " + nodeId);
      }
    }
    BuildContext context = new BuildContext(config, definitions);
    for (String nodeId : definitions.keySet()) context.build(nodeId);
    for (JsonNode rootId : request.path("roots")) context.build(rootId.asText());
    return new ExecutionResult(observations(json, request, context));
  }

  private static ArrayNode observations(ObjectMapper json, ObjectNode request,
      BuildContext context) {
    ArrayNode output = json.createArrayNode();
    for (JsonNode definition : request.path("relations")) {
      String nodeId = requiredText(definition, "nodeId");
      RelNode rel = context.built.get(nodeId);
      if (rel == null) continue;
      String kind = requiredText(definition, "kind");
      if ("READ".equals(kind)) {
        ObjectNode observation = observation(json, "table-occurrence:" + nodeId,
            "tableOccurrences", "EVALUATED", singleton(requiredText(definition, "mappingId")),
            evidence(definition));
        ObjectNode value = observation.putObject("value");
        value.put("nodeId", nodeId);
        value.set("table", definition.path("table").deepCopy());
        value.put("nativeRelationOccurrenceId",
            requiredText(definition, "nativeRelationOccurrenceId"));
        output.add(observation);
      }
      if ("FILTER".equals(kind) || "JOIN".equals(kind)) {
        RelOptPredicateList predicates = rel.getCluster().getMetadataQuery()
            .getAllPredicates(rel);
        if ("JOIN".equals(kind) && rel instanceof Join) {
          ObjectNode observation = observation(json, "predicates:" + nodeId,
              "predicates", "EVALUATED", singleton(requiredText(definition, "mappingId")),
              evidence(definition));
          ArrayNode values = observation.putArray("values");
          values.add(((Join) rel).getCondition().toString());
          output.add(observation);
        } else if (predicates == null) {
          output.add(observation(json, "predicates:" + nodeId, "predicates",
              "NOT_EVALUATED", singleton(requiredText(definition, "mappingId")),
              evidence(definition)));
        } else {
          ObjectNode observation = observation(json, "predicates:" + nodeId,
              "predicates", "EVALUATED", singleton(requiredText(definition, "mappingId")),
              evidence(definition));
          ArrayNode values = observation.putArray("values");
          List<String> rendered = new ArrayList<String>();
          for (RexNode predicate : predicates.pulledUpPredicates) {
            rendered.add(predicate.toString());
          }
          Collections.sort(rendered);
          for (String value : rendered) values.add(value);
          output.add(observation);
        }
      }
      RelMetadataQuery metadata = rel.getCluster().getMetadataQuery();
      if (requested(request, "uniqueKeys")) {
        output.add(uniqueKeysObservation(json, nodeId, definition, rel, metadata));
      }
      if (requested(request, "functionalDependencies")) {
        output.add(functionalDependenciesObservation(json, nodeId, definition, rel, metadata));
      }
      if (requested(request, "rowCountCardinality")) {
        output.add(rowCountObservation(json, nodeId, definition, rel, metadata));
      }
      JsonNode fields = definition.path("outputFields");
      for (int index = 0; index < fields.size(); index++) {
        JsonNode field = fields.get(index);
        int ordinal = requiredOrdinal(field, "ordinal");
        if (ordinal != index || ordinal >= rel.getRowType().getFieldCount()) {
          throw validation("OUTPUT_FIELD_ORDINAL_INVALID",
              "output field ordinals must be contiguous and match the RelNode row type");
        }
        RelDataType declaredOutput = sqlType(rel.getCluster().getTypeFactory(), field.path("type"));
        RelDataType actualOutput = rel.getRowType().getFieldList().get(ordinal).getType();
        if (!actualOutput.equals(declaredOutput)) {
          throw validation("OUTPUT_FIELD_TYPE_MISMATCH",
              "declared output field type does not match the RelNode row type");
        }
        String mappingId = requiredText(field, "mappingId");
        ObjectNode observation;
        RelMetadataQuery mq = rel.getCluster().getMetadataQuery();
        RexNode ref = rel.getCluster().getRexBuilder().makeInputRef(rel, ordinal);
        Set<RexNode> lineage = mq.getExpressionLineage(rel, ref);
        if (lineage == null) {
          observation = observation(json, "lineage:" + nodeId + ":" + ordinal,
              "expressionLineage", "NOT_EVALUATED", singleton(mappingId), evidence(field));
        } else {
          observation = observation(json, "lineage:" + nodeId + ":" + ordinal,
              "expressionLineage", "EVALUATED", singleton(mappingId), evidence(field));
          List<String> rendered = new ArrayList<String>();
          for (RexNode item : lineage) rendered.add(item.toString());
          Collections.sort(rendered);
          ArrayNode values = observation.putArray("values");
          for (String value : rendered) values.add(value);
        }
        output.add(observation);
      }
    }
    return output;
  }

  private static ObjectNode observation(ObjectMapper json, String id, String kind,
      String status, List<String> mappingRefs, List<String> evidenceRefs) {
    ObjectNode value = json.createObjectNode();
    value.put("observationId", id);
    value.put("kind", kind);
    value.put("status", status);
    ArrayNode mappings = value.putArray("mappingRefs");
    for (String mapping : mappingRefs) mappings.add(mapping);
    ArrayNode evidence = value.putArray("evidenceRefs");
    for (String ref : evidenceRefs) evidence.add(ref);
    return value;
  }

  private static List<String> singleton(String value) {
    List<String> output = new ArrayList<String>();
    output.add(value);
    return output;
  }

  private static boolean requested(ObjectNode request, String kind) {
    JsonNode values = request.path("requestedMetadata");
    if (!values.isArray() || values.size() == 0) return true;
    for (JsonNode value : values) if (kind.equals(value.asText())) return true;
    return false;
  }

  private static List<String> evidence(JsonNode value) {
    if (!value.path("evidenceRefs").isArray())
      throw validation("EVIDENCE_REFS_INVALID", "evidenceRefs must be an array");
    List<String> refs = new ArrayList<String>();
    for (JsonNode ref : value.path("evidenceRefs")) {
      if (!ref.isTextual() || ref.asText().isEmpty())
        throw validation("EVIDENCE_REFS_INVALID",
            "evidenceRefs must contain only non-empty strings");
      refs.add(ref.asText());
    }
    return refs;
  }

  private static void registerTables(SchemaPlus root, JsonNode tables) {
    for (JsonNode table : tables) {
      List<String> path = tablePath(table);
      SchemaPlus owner = root;
      for (int i = 0; i + 1 < path.size(); i++) {
        SchemaPlus next = owner.getSubSchema(path.get(i));
        if (next == null) next = owner.add(path.get(i), new MutableSchema());
        owner = next;
      }
      owner.add(path.get(path.size() - 1), new ProtocolTable(table));
    }
  }

  private static List<String> tablePath(JsonNode table) {
    List<String> path = new ArrayList<String>();
    if (table.path("catalog").isTextual()) path.add(table.path("catalog").asText());
    if (table.path("schema").isTextual()) path.add(table.path("schema").asText());
    path.add(requiredText(table, "name"));
    return path;
  }

  private static final class BuildContext {
    final FrameworkConfig config;
    final Map<String, JsonNode> definitions;
    final Map<String, RelNode> built = new HashMap<String, RelNode>();
    final Set<String> active = new LinkedHashSet<String>();

    BuildContext(FrameworkConfig config, Map<String, JsonNode> definitions) {
      this.config = config;
      this.definitions = definitions;
    }

    RelNode build(String nodeId) {
      RelNode cached = built.get(nodeId);
      if (cached != null) return cached;
      JsonNode definition = definitions.get(nodeId);
      if (definition == null) throw validation("RELATION_INPUT_DANGLING", "missing node " + nodeId);
      if (!active.add(nodeId)) throw validation("RELATION_GRAPH_CYCLE", "cycle at " + nodeId);
      try {
        RelBuilder builder = RelBuilder.create(config);
        String kind = requiredText(definition, "kind");
        RelNode rel;
        if ("READ".equals(kind)) {
          List<String> path = tablePath(definition.path("table"));
          rel = builder.scan(path.toArray(new String[path.size()])).build();
        } else if ("DERIVED".equals(kind)) {
          rel = build(requiredText(definition, "sourceNodeId"));
        } else if ("PROJECT".equals(kind)) {
          RelNode input = build(requiredText(definition, "inputNodeId"));
          builder.push(input);
          List<RexNode> expressions = expressions(builder, definition.path("expressions"));
          List<String> names = outputNames(definition.path("outputFields"));
          if (expressions.size() != names.size()) {
            throw validation("PROJECT_ARITY_MISMATCH", "project expression/output arity differs");
          }
          rel = builder.project(expressions, names, true).build();
        } else if ("FILTER".equals(kind)) {
          RelNode input = build(requiredText(definition, "inputNodeId"));
          builder.push(input);
          rel = builder.filter(expression(builder, definition.path("predicate"))).build();
        } else if ("JOIN".equals(kind)) {
          RelNode left = build(requiredText(definition, "leftNodeId"));
          RelNode right = build(requiredText(definition, "rightNodeId"));
          builder.push(left);
          builder.push(right);
          RexNode condition;
          if (definition.path("condition").isObject()) {
            condition = expression(builder, definition.path("condition"),
                new JoinInputContext(left, right,
                    requiredText(definition, "leftNodeId"),
                    requiredText(definition, "rightNodeId")));
          } else {
            condition = builder.literal(true);
          }
          rel = builder.join(joinType(requiredText(definition, "joinType")), condition).build();
        } else if ("AGGREGATE".equals(kind)) {
          RelNode input = build(requiredText(definition, "inputNodeId"));
          builder.push(input);
          List<RexNode> groupExpressions = new ArrayList<RexNode>();
          for (JsonNode groupKey : definition.path("groupKeys"))
            groupExpressions.add(expression(builder, groupKey));
          List<RelBuilder.AggCall> aggregateCalls = new ArrayList<RelBuilder.AggCall>();
          JsonNode outputFields = definition.path("outputFields");
          int groupCount = groupExpressions.size();
          int measureIndex = 0;
          for (JsonNode measure : definition.path("measures")) {
            String outputName = outputFields.path(groupCount + measureIndex).path("name").asText();
            aggregateCalls.add(aggregateCall(builder, measure, outputName));
            measureIndex += 1;
          }
          RelBuilder.GroupKey groupKey = groupExpressions.isEmpty()
              ? builder.groupKey()
              : builder.groupKey(groupExpressions);
          rel = builder.aggregate(groupKey, aggregateCalls).build();
        } else if ("SETOP".equals(kind)) {
          if (definition.path("byName").asBoolean(false))
            throw unsupported("SETOP_BY_NAME_UNSUPPORTED", "by-name set operation is outside the core bridge");
          int inputCount = definition.path("inputNodeIds").size();
          if (inputCount < 2)
            throw validation("SETOP_BRANCHES_INVALID", "set operation requires at least two inputs");
          for (JsonNode inputNodeId : definition.path("inputNodeIds")) {
            if (!inputNodeId.isTextual() || inputNodeId.asText().isEmpty())
              throw validation("SETOP_INPUT_INVALID", "set operation input node ids must be non-empty strings");
            builder.push(build(inputNodeId.asText()));
          }
          boolean all = definition.path("all").asBoolean(false);
          String operation = requiredText(definition, "operation").toUpperCase(Locale.ROOT);
          if ("UNION".equals(operation)) rel = builder.union(all, inputCount).build();
          else if ("INTERSECT".equals(operation)) rel = builder.intersect(all, inputCount).build();
          else if ("EXCEPT".equals(operation)) rel = builder.minus(all, inputCount).build();
          else throw unsupported("SETOP_OPERATOR_UNSUPPORTED", "set operation is outside the core bridge: " + operation);
        } else {
          throw unsupported("RELATION_KIND_UNSUPPORTED", "unsupported core relation " + kind);
        }
        built.put(nodeId, rel);
        return rel;
      } finally {
        active.remove(nodeId);
      }
    }
  }

  private static List<String> outputNames(JsonNode fields) {
    List<String> names = new ArrayList<String>();
    for (JsonNode field : fields) names.add(requiredText(field, "name"));
    return names;
  }

  private static List<RexNode> expressions(RelBuilder builder, JsonNode values) {
    List<RexNode> output = new ArrayList<RexNode>();
    for (JsonNode value : values) output.add(expression(builder, value));
    return output;
  }

  private static RelBuilder.AggCall aggregateCall(RelBuilder builder, JsonNode measure,
      String outputName) {
    if (!"CALL".equals(requiredText(measure, "kind")))
      throw unsupported("AGGREGATE_EXPRESSION_UNSUPPORTED", "aggregate measure must be a CALL");
    SqlAggFunction function = aggregateFunction(requiredText(measure, "operator"));
    List<RexNode> operands = new ArrayList<RexNode>();
    for (JsonNode operand : measure.path("operands"))
      operands.add(expression(builder, operand));
    RelBuilder.AggCall call = builder.aggregateCall(function, operands);
    return outputName == null || outputName.isEmpty() ? call : call.as(outputName);
  }

  private static SqlAggFunction aggregateFunction(String raw) {
    String value = raw.trim().toUpperCase(Locale.ROOT);
    if ("COUNT".equals(value)) return SqlStdOperatorTable.COUNT;
    if ("SUM".equals(value)) return SqlStdOperatorTable.SUM;
    if ("SUM0".equals(value)) return SqlStdOperatorTable.SUM0;
    if ("AVG".equals(value)) return SqlStdOperatorTable.AVG;
    if ("MIN".equals(value)) return SqlStdOperatorTable.MIN;
    if ("MAX".equals(value)) return SqlStdOperatorTable.MAX;
    throw unsupported("AGGREGATE_FUNCTION_UNSUPPORTED", "aggregate function is outside the core registry: " + raw);
  }

  private static RexNode expression(RelBuilder builder, JsonNode value) {
    return expression(builder, value, null);
  }

  private static RexNode expression(RelBuilder builder, JsonNode value,
      JoinInputContext joinContext) {
    String kind = requiredText(value, "kind");
    if ("FIELD_REF".equals(kind)) {
      int ordinal = requiredOrdinal(value, "inputOrdinal");
      RexNode field;
      RelNode input;
      if (joinContext != null) {
        String inputNodeId = requiredText(value, "inputNodeId");
        if (joinContext.leftNodeId.equals(inputNodeId)) {
          input = joinContext.left;
          field = builder.field(2, 0, ordinal);
        } else if (joinContext.rightNodeId.equals(inputNodeId)) {
          input = joinContext.right;
          field = builder.field(2, 1, ordinal);
        } else {
          throw validation("FIELD_REF_INPUT_INVALID", "join field reference does not identify a join input");
        }
        if (ordinal >= input.getRowType().getFieldCount())
            throw validation("FIELD_REF_ORDINAL_INVALID", "join field reference ordinal is out of range");
      } else {
        input = builder.peek();
        if (ordinal >= input.getRowType().getFieldCount())
          throw validation("FIELD_REF_ORDINAL_INVALID", "field reference ordinal is out of range");
        field = builder.field(ordinal);
      }
      RelDataType declared = sqlType(builder.getTypeFactory(), value.path("type"));
      if (!field.getType().equals(declared))
        throw validation("FIELD_REF_TYPE_MISMATCH",
            "field reference type does not match the input field type");
      return field;
    }
    if ("LITERAL".equals(kind)) {
      RelDataType declared = sqlType(builder.getTypeFactory(), value.path("type"));
      JsonNode literal = value.get("value");
      if (literal == null || literal.isNull()) {
        return builder.getRexBuilder().makeNullLiteral(declared);
      }
      RexNode inferred;
      if (literal.isBoolean()) inferred = builder.literal(literal.asBoolean());
      else if (literal.isIntegralNumber()) inferred = builder.literal(literal.asLong());
      else if (literal.isFloatingPointNumber()) inferred = builder.literal(literal.decimalValue());
      else if (literal.isTextual())
        inferred = builder.getRexBuilder().makeLiteral(literal.asText(), declared, true);
      else throw unsupported("LITERAL_UNSUPPORTED", "literal value is outside the core subset");
      return builder.getRexBuilder().makeCast(declared, inferred);
    }
    if ("CASE".equals(kind)) {
      List<RexNode> operands = new ArrayList<RexNode>();
      for (JsonNode branch : value.path("branches")) {
        operands.add(expression(builder, branch.path("selector"), joinContext));
        operands.add(expression(builder, branch.path("result"), joinContext));
      }
      JsonNode elseResult = value.get("elseResult");
      RelDataType declared = sqlType(builder.getTypeFactory(), value.path("type"));
      operands.add(elseResult == null || elseResult.isNull()
          ? builder.getRexBuilder().makeNullLiteral(declared)
          : expression(builder, elseResult, joinContext));
      if (operands.size() < 3 || (operands.size() % 2) == 0)
        throw validation("CASE_BRANCHES_INVALID", "CASE requires one or more selector/result pairs");
      RexNode call = builder.getRexBuilder().makeCall(SqlStdOperatorTable.CASE, operands);
      return builder.getRexBuilder().ensureType(declared, call, true);
    }
    if ("CALL".equals(kind)) {
      SqlOperator operator = operator(requiredText(value, "operator"));
      List<RexNode> operands = new ArrayList<RexNode>();
      for (JsonNode operand : value.path("operands"))
        operands.add(expression(builder, operand, joinContext));
      RelDataType declared = sqlType(builder.getTypeFactory(), value.path("type"));
      String operatorName = requiredText(value, "operator").trim().toUpperCase(Locale.ROOT);
      RexNode call;
      if ("IF".equals(operatorName) || "IIF".equals(operatorName)) {
        if (operands.size() != 3)
          throw validation("IF_ARITY_INVALID", "IF requires condition, then, and else operands");
        call = builder.getRexBuilder().makeCall(
            SqlStdOperatorTable.CASE,
            operands);
      } else {
        call = builder.call(operator, operands);
      }
      return builder.getRexBuilder().ensureType(declared, call, true);
    }
    if ("CAST".equals(kind)) {
      RexNode operand = expression(builder, value.path("operand"), joinContext);
      RelDataType declared = sqlType(builder.getTypeFactory(), value.path("type"));
      return builder.getRexBuilder().makeCast(declared, operand);
    }
    throw unsupported("EXPRESSION_KIND_UNSUPPORTED", "unsupported core expression " + kind);
  }

  private static SqlOperator operator(String raw) {
    String value = raw.trim().toUpperCase(Locale.ROOT);
    if ("AND".equals(value)) return SqlStdOperatorTable.AND;
    if ("OR".equals(value)) return SqlStdOperatorTable.OR;
    if ("NOT".equals(value)) return SqlStdOperatorTable.NOT;
    if ("=".equals(value) || "EQ".equals(value)) return SqlStdOperatorTable.EQUALS;
    if ("<>".equals(value) || "!=".equals(value) || "NE".equals(value)) return SqlStdOperatorTable.NOT_EQUALS;
    if (">".equals(value) || "GT".equals(value)) return SqlStdOperatorTable.GREATER_THAN;
    if (">=".equals(value) || "GTE".equals(value)) return SqlStdOperatorTable.GREATER_THAN_OR_EQUAL;
    if ("<".equals(value) || "LT".equals(value)) return SqlStdOperatorTable.LESS_THAN;
    if ("<=".equals(value) || "LTE".equals(value)) return SqlStdOperatorTable.LESS_THAN_OR_EQUAL;
    if ("+".equals(value) || "PLUS".equals(value)) return SqlStdOperatorTable.PLUS;
    if ("-".equals(value) || "MINUS".equals(value)) return SqlStdOperatorTable.MINUS;
    if ("*".equals(value) || "MULTIPLY".equals(value)) return SqlStdOperatorTable.MULTIPLY;
    if ("/".equals(value) || "DIVIDE".equals(value)) return SqlStdOperatorTable.DIVIDE;
    if ("CONCAT".equals(value) || "||".equals(value)) return SqlStdOperatorTable.CONCAT;
    if ("LIKE".equals(value)) return SqlStdOperatorTable.LIKE;
    if ("BETWEEN".equals(value)) return SqlStdOperatorTable.BETWEEN;
    if ("UNARY_PLUS".equals(value)) return SqlStdOperatorTable.UNARY_PLUS;
    if ("UNARY_MINUS".equals(value)) return SqlStdOperatorTable.UNARY_MINUS;
    if ("COALESCE".equals(value)) return SqlStdOperatorTable.COALESCE;
    if ("SUBSTRING".equals(value) || "SUBSTR".equals(value)) return SqlStdOperatorTable.SUBSTRING;
    if ("IS_NULL".equals(value)) return SqlStdOperatorTable.IS_NULL;
    if ("IS_NOT_NULL".equals(value)) return SqlStdOperatorTable.IS_NOT_NULL;
    if ("IN".equals(value)) return SqlStdOperatorTable.IN;
    throw unsupported("OPERATOR_UNSUPPORTED", "operator is outside the core registry: " + raw);
  }

  private static JoinRelType joinType(String raw) {
    String value = raw.trim().toUpperCase(Locale.ROOT);
    if ("INNER".equals(value)) return JoinRelType.INNER;
    if ("LEFT".equals(value)) return JoinRelType.LEFT;
    if ("RIGHT".equals(value)) return JoinRelType.RIGHT;
    if ("FULL".equals(value)) return JoinRelType.FULL;
    if ("SEMI".equals(value)) return JoinRelType.SEMI;
    if ("ANTI".equals(value)) return JoinRelType.ANTI;
    if ("CROSS".equals(value)) return JoinRelType.INNER;
    throw unsupported("JOIN_TYPE_UNSUPPORTED", "join type is outside the core registry: " + raw);
  }

  private static ObjectNode uniqueKeysObservation(ObjectMapper json, String nodeId,
      JsonNode definition, RelNode rel, RelMetadataQuery metadata) {
    ObjectNode observation = observation(json, "uniqueKeys:" + nodeId, "uniqueKeys",
        "NOT_EVALUATED", singleton(requiredText(definition, "mappingId")), evidence(definition));
    Set<ImmutableBitSet> keys = metadata.getUniqueKeys(rel);
    if (keys == null) return observation;
    observation.put("status", "EVALUATED");
    ArrayNode values = observation.putArray("values");
    List<String> names = rel.getRowType().getFieldNames();
    for (ImmutableBitSet key : keys) {
      ObjectNode value = values.addObject();
      value.put("nodeId", nodeId);
      ArrayNode columns = value.putArray("columns");
      ArrayNode ordinals = value.putArray("ordinals");
      for (Integer index : key) {
        if (index >= 0 && index < names.size()) {
          columns.add(names.get(index));
          ordinals.add(index);
        }
      }
    }
    return observation;
  }

  private static ObjectNode functionalDependenciesObservation(ObjectMapper json, String nodeId,
      JsonNode definition, RelNode rel, RelMetadataQuery metadata) {
    ObjectNode observation = observation(json, "functionalDependencies:" + nodeId,
        "functionalDependencies", "NOT_EVALUATED", singleton(requiredText(definition, "mappingId")), evidence(definition));
    ArrowSet fds = metadata.getFDs(rel);
    if (fds == null) return observation;
    observation.put("status", "EVALUATED");
    ArrayNode values = observation.putArray("values");
    List<String> names = rel.getRowType().getFieldNames();
    for (Arrow arrow : fds.getArrows()) {
      ObjectNode value = values.addObject();
      value.put("nodeId", nodeId);
      value.set("determinant", bitNames(json, arrow.getDeterminants(), names));
      value.set("dependent", bitNames(json, arrow.getDependents(), names));
      value.set("determinantOrdinals", bitNumbers(json, arrow.getDeterminants()));
      value.set("dependentOrdinals", bitNumbers(json, arrow.getDependents()));
    }
    return observation;
  }

  private static ObjectNode rowCountObservation(ObjectMapper json, String nodeId,
      JsonNode definition, RelNode rel, RelMetadataQuery metadata) {
    ObjectNode observation = observation(json, "rowCountCardinality:" + nodeId,
        "rowCountCardinality", "NOT_EVALUATED", singleton(requiredText(definition, "mappingId")), evidence(definition));
    Double rowCount = metadata.getRowCount(rel);
    if (rowCount == null) return observation;
    observation.put("status", "EVALUATED");
    ObjectNode value = observation.putObject("value");
    value.put("nodeId", nodeId);
    if (rowCount.isNaN() || rowCount.isInfinite()) value.putNull("rowCount"); else value.put("rowCount", rowCount);
    return observation;
  }

  private static ArrayNode bitNames(ObjectMapper json, ImmutableBitSet bits, List<String> names) {
    ArrayNode output = json.createArrayNode();
    for (Integer index : bits) if (index >= 0 && index < names.size()) output.add(names.get(index));
    return output;
  }

  private static ArrayNode bitNumbers(ObjectMapper json, ImmutableBitSet bits) {
    ArrayNode output = json.createArrayNode();
    for (Integer index : bits) output.add(index);
    return output;
  }

  private static final class JoinInputContext {
    final RelNode left;
    final RelNode right;
    final String leftNodeId;
    final String rightNodeId;

    JoinInputContext(RelNode left, RelNode right, String leftNodeId, String rightNodeId) {
      this.left = left;
      this.right = right;
      this.leftNodeId = leftNodeId;
      this.rightNodeId = rightNodeId;
    }
  }

  private static RelDataType sqlType(RelDataTypeFactory factory, JsonNode type) {
    SqlTypeName name = sqlTypeName(type);
    JsonNode precisionNode = type.path("precision");
    JsonNode scaleNode = type.path("scale");
    if (!type.path("nullable").isBoolean())
      throw validation("TYPE_NULLABILITY_INVALID", "type nullable must be boolean");
    if ((!precisionNode.isMissingNode() && !precisionNode.isIntegralNumber())
        || (!scaleNode.isMissingNode() && !scaleNode.isIntegralNumber()))
      throw validation("TYPE_PARAMETERS_INVALID", "type precision/scale must be integers");
    int precision = precisionNode.isIntegralNumber() ? precisionNode.asInt(-1) : -1;
    int scale = scaleNode.isIntegralNumber() ? scaleNode.asInt(-1) : -1;
    if (precisionNode.isIntegralNumber() && precision <= 0)
      throw validation("TYPE_PARAMETERS_INVALID", "type precision must be positive");
    if (scaleNode.isIntegralNumber()
        && (precision < 0 || scale < 0 || scale > precision))
      throw validation("TYPE_PARAMETERS_INVALID", "type scale requires a valid precision");
    RelDataType result;
    if (scaleNode.isIntegralNumber())
      result = factory.createSqlType(name, precision, scale);
    else if (precisionNode.isIntegralNumber())
      result = factory.createSqlType(name, precision);
    else result = factory.createSqlType(name);
    if (name == SqlTypeName.VARCHAR || name == SqlTypeName.CHAR)
      result = factory.createTypeWithCharsetAndCollation(
          result,
          StandardCharsets.UTF_8,
          new SqlCollation(
              SqlCollation.Coercibility.COERCIBLE,
              Locale.ROOT,
              StandardCharsets.UTF_8,
              "PRIMARY"));
    return factory.createTypeWithNullability(result, type.path("nullable").asBoolean());
  }

  private static SqlTypeName sqlTypeName(JsonNode type) {
    String raw = requiredText(type, "name").trim().toUpperCase(Locale.ROOT);
    if ("INT".equals(raw)) raw = "INTEGER";
    try {
      return SqlTypeName.valueOf(raw);
    } catch (IllegalArgumentException error) {
      throw unsupported("TYPE_UNSUPPORTED", "unsupported Calcite SQL type " + raw);
    }
  }

  private static String requiredText(JsonNode value, String name) {
    JsonNode field = value.path(name);
    if (!field.isTextual() || field.asText().isEmpty())
      throw validation("FIELD_REQUIRED", name + " is required");
    return field.asText();
  }

  private static int requiredOrdinal(JsonNode value, String name) {
    JsonNode field = value.path(name);
    if (!field.canConvertToInt() || field.asInt() < 0)
      throw validation("ORDINAL_INVALID", name + " must be a non-negative integer");
    return field.asInt();
  }

  private static CalciteRelBridge.ValidationError validation(String code, String message) {
    return new CalciteRelBridge.ValidationError(code, message);
  }

  private static CalciteRelBridge.UnsupportedError unsupported(String code, String message) {
    return new CalciteRelBridge.UnsupportedError(code, message);
  }

  static final class ExecutionResult {
    final ArrayNode observations;

    ExecutionResult(ArrayNode observations) {
      this.observations = observations;
    }
  }

  private static final class MutableSchema extends AbstractSchema {
  }

  private static final class ProtocolTable extends AbstractTable {
    final JsonNode definition;

    ProtocolTable(JsonNode definition) {
      this.definition = definition;
    }

    @Override public RelDataType getRowType(RelDataTypeFactory factory) {
      RelDataTypeFactory.Builder builder = factory.builder();
      for (JsonNode column : definition.path("columns")) {
        JsonNode typeNode = JSON_TYPE(column);
        builder.add(requiredText(column, "name"), sqlType(factory, typeNode));
      }
      return builder.build();
    }

    private static JsonNode JSON_TYPE(JsonNode column) {
      ObjectNode type = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
      String raw = requiredText(column, "type").trim().toUpperCase(Locale.ROOT);
      int open = raw.indexOf('(');
      if (open >= 0 && raw.endsWith(")")) {
        String name = raw.substring(0, open).trim();
        String[] parameters = raw.substring(open + 1, raw.length() - 1).split(",");
        type.put("name", name);
        type.put("precision", Integer.parseInt(parameters[0].trim()));
        if (parameters.length > 1) type.put("scale", Integer.parseInt(parameters[1].trim()));
      } else type.put("name", raw);
      type.put("nullable", column.path("nullable").asBoolean());
      return type;
    }
  }
}

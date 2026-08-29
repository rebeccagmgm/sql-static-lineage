import { canonicalJson, sha256 } from "../machine-facts/machine-facts-contract.ts";

export const CANDIDATE_TASK_SEMANTIC_FACTS_VERSION = "0.1.0-poc" as const;
export type StatementStatus = "SUCCESS" | "PARTIAL" | "UNSUPPORTED" | "ERROR";
export type EvaluationStatus = "EVALUATED" | "NOT_EVALUATED" | "UNSUPPORTED" | "ERROR";
export type KnowledgeStatus = "EXACT" | "DERIVED" | "ESTIMATED" | "UNKNOWN";
export type MappingStatus = "NOT_ATTEMPTED" | "NOT_ASSEMBLED" | "EXACT" | "AMBIGUOUS" | "UNMAPPABLE";
export type OperatorKind = "TABLE_SCAN" | "VALUES" | "PROJECT" | "FILTER" | "JOIN" | "AGGREGATE" | "DISTINCT" | "UNION" | "INTERSECT" | "EXCEPT" | "WINDOW" | "SORT" | "TOP_N" | "CORRELATE" | "UNKNOWN";
export type OperatorInputRole = "MATCHED" | "PRESERVED" | "OPTIONAL" | "FILTERING" | "EXCLUDING" | "CARTESIAN" | "CONTRIBUTING" | "REQUIRED";
export type DependencyKind = "VALUE_INPUT" | "EXPRESSION_SELECTOR" | "FILTER_PREDICATE" | "JOIN_MATCH" | "JOIN_NULL_EXTENSION" | "JOIN_CARDINALITY" | "GROUP_KEY" | "AGGREGATE_INPUT" | "SET_MEMBERSHIP" | "WINDOW_VALUE" | "WINDOW_PARTITION" | "WINDOW_ORDER" | "WINDOW_FRAME" | "ORDER_SELECTION" | "RELATION_EXISTENCE";
export type ImpactKind = "FIELD_VALUE" | "EXPRESSION_CONTROL" | "ROW_MEMBERSHIP" | "NULL_EXTENSION" | "MULTIPLICITY" | "GROUPING" | "SET_MEMBERSHIP" | "WINDOW_EFFECT" | "ORDER_SELECTION" | "RELATION_EXISTENCE";

export interface CandidateTaskSemanticFacts {
  readonly schemaVersion: typeof CANDIDATE_TASK_SEMANTIC_FACTS_VERSION;
  readonly provider: { readonly name: "calcite-semantic-provider"; readonly calciteVersion: "1.42.0"; readonly adapterVersion: string; readonly buildFingerprint: string };
  readonly input: { readonly sqlSourceId: string; readonly statementOrdinal: number; readonly sqlSha256: string; readonly schemaSha256: string; readonly dialectDigest: string };
  readonly statementStatus: StatementStatus;
  readonly capabilities: readonly { readonly capability: string; readonly evaluationStatus: EvaluationStatus; readonly issueRefs?: readonly string[] }[];
  readonly relations: readonly { readonly relationId: string; readonly kind: OperatorKind; readonly inputRelationIds: readonly string[]; readonly outputFieldIds: readonly string[]; readonly qualifiedTableName?: string; readonly providerOrdinal?: number; readonly sourceOccurrences?: readonly { readonly occurrenceId: string; readonly sourceKind: "TABLE_REFERENCE"; readonly coordinateSystem: "DIALECT_TRANSFORMED_SQL"; readonly sourceSpan: { readonly startLine: number; readonly startColumn: number; readonly endLine: number; readonly endColumn: number } }[] }[];
  readonly fields: readonly { readonly fieldId: string; readonly relationId: string; readonly role: "INPUT" | "OUTPUT"; readonly slot: number; readonly name: string; readonly typeName: string; readonly nullable: boolean; readonly physicalFieldId?: string }[];
  readonly operators: readonly { readonly operatorId: string; readonly kind: OperatorKind; readonly relationId: string; readonly inputRelationIds: readonly string[]; readonly inputRoles?: readonly OperatorInputRole[]; readonly joinType?: "INNER" | "LEFT" | "RIGHT" | "FULL" | "SEMI" | "ANTI" | "CROSS" }[];
  readonly dependencies: readonly { readonly dependencyId: string; readonly dependencyKind: DependencyKind; readonly impactKind: ImpactKind; readonly operatorId: string; readonly fromRefs: readonly string[]; readonly toRefs: readonly string[]; readonly evaluationStatus: EvaluationStatus; readonly evidenceMappingRefs: readonly string[]; readonly issueRefs: readonly string[] }[];
  readonly metadata: readonly { readonly metadataId: string; readonly kind: "PREDICATE" | "EXPRESSION_LINEAGE" | "UNIQUE_KEYS" | "FUNCTIONAL_DEPENDENCIES" | "ROW_COUNT" | "SELECTIVITY" | "CARDINALITY" | "MULTIPLICITY"; readonly subjectRef: string; readonly evaluationStatus: EvaluationStatus; readonly knowledgeStatus: KnowledgeStatus; readonly basis: string; readonly absenceProven: boolean; readonly value?: unknown }[];
  readonly evidenceMappings: readonly { readonly mappingId: string; readonly providerRefId: string; readonly nativeRefId?: string; readonly mappingStatus: MappingStatus; readonly evidenceRefs: readonly string[]; readonly sourceSpan?: { readonly start: number; readonly end: number } }[];
  readonly issues: readonly { readonly issueId: string; readonly code: string; readonly message: string; readonly severity: "INFO" | "WARNING" | "ERROR"; readonly subjectRefs?: readonly string[] }[];
}

const STATEMENT = new Set<StatementStatus>(["SUCCESS", "PARTIAL", "UNSUPPORTED", "ERROR"]);
const EVALUATION = new Set<EvaluationStatus>(["EVALUATED", "NOT_EVALUATED", "UNSUPPORTED", "ERROR"]);
const KNOWLEDGE = new Set<KnowledgeStatus>(["EXACT", "DERIVED", "ESTIMATED", "UNKNOWN"]);
const MAPPING = new Set<MappingStatus>(["NOT_ATTEMPTED", "NOT_ASSEMBLED", "EXACT", "AMBIGUOUS", "UNMAPPABLE"]);
const METADATA_KIND = new Set(["PREDICATE", "EXPRESSION_LINEAGE", "UNIQUE_KEYS", "FUNCTIONAL_DEPENDENCIES", "ROW_COUNT", "SELECTIVITY", "CARDINALITY", "MULTIPLICITY"]);
const SEVERITY = new Set(["INFO", "WARNING", "ERROR"]);
const OPERATOR = new Set<OperatorKind>(["TABLE_SCAN", "VALUES", "PROJECT", "FILTER", "JOIN", "AGGREGATE", "DISTINCT", "UNION", "INTERSECT", "EXCEPT", "WINDOW", "SORT", "TOP_N", "CORRELATE", "UNKNOWN"]);
const INPUT_ROLE = new Set<OperatorInputRole>(["MATCHED", "PRESERVED", "OPTIONAL", "FILTERING", "EXCLUDING", "CARTESIAN", "CONTRIBUTING", "REQUIRED"]);
const DEPENDENCY = new Set<DependencyKind>(["VALUE_INPUT", "EXPRESSION_SELECTOR", "FILTER_PREDICATE", "JOIN_MATCH", "JOIN_NULL_EXTENSION", "JOIN_CARDINALITY", "GROUP_KEY", "AGGREGATE_INPUT", "SET_MEMBERSHIP", "WINDOW_VALUE", "WINDOW_PARTITION", "WINDOW_ORDER", "WINDOW_FRAME", "ORDER_SELECTION", "RELATION_EXISTENCE"]);
const IMPACT = new Set<ImpactKind>(["FIELD_VALUE", "EXPRESSION_CONTROL", "ROW_MEMBERSHIP", "NULL_EXTENSION", "MULTIPLICITY", "GROUPING", "SET_MEMBERSHIP", "WINDOW_EFFECT", "ORDER_SELECTION", "RELATION_EXISTENCE"]);
const SHA256 = /^[a-f0-9]{64}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/#-]*$/;

export class SemanticFactsContractError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`CandidateTaskSemanticFacts invalid: ${issues.join("; ")}`);
    this.name = "SemanticFactsContractError";
  }
}

export function parseCandidateTaskSemanticFacts(value: unknown): CandidateTaskSemanticFacts {
  const issues: string[] = [];
  if (!isRecord(value)) throw new SemanticFactsContractError(["root must be an object"]);
  exactKeys(value, ["schemaVersion", "provider", "input", "statementStatus", "capabilities", "relations", "fields", "operators", "dependencies", "metadata", "evidenceMappings", "issues"], "$", issues);
  if (value.schemaVersion !== CANDIDATE_TASK_SEMANTIC_FACTS_VERSION) issues.push("schemaVersion unsupported");
  if (!STATEMENT.has(value.statementStatus as StatementStatus)) issues.push("statementStatus invalid");
  validateProvider(value.provider, issues);
  validateInput(value.input, issues);
  const capabilities = array(value.capabilities, "capabilities", issues);
  const relations = array(value.relations, "relations", issues);
  const fields = array(value.fields, "fields", issues);
  const operators = array(value.operators, "operators", issues);
  const dependencies = array(value.dependencies, "dependencies", issues);
  const metadata = array(value.metadata, "metadata", issues);
  const mappings = array(value.evidenceMappings, "evidenceMappings", issues);
  const semanticIssues = array(value.issues, "issues", issues);

  validateSorted(capabilities, "capability", "capabilities", issues);
  validateSorted(relations, "relationId", "relations", issues);
  validateSorted(fields, "fieldId", "fields", issues);
  validateSorted(operators, "operatorId", "operators", issues);
  validateSorted(dependencies, "dependencyId", "dependencies", issues);
  validateSorted(metadata, "metadataId", "metadata", issues);
  validateSorted(mappings, "mappingId", "evidenceMappings", issues);
  validateSorted(semanticIssues, "issueId", "issues", issues);

  for (const [index, item] of capabilities.entries()) validateCapability(item, index, issues);
  for (const [index, item] of relations.entries()) validateRelation(item, index, issues);
  for (const [index, item] of fields.entries()) validateField(item, index, issues);
  for (const [index, item] of operators.entries()) validateOperator(item, index, issues);
  for (const [index, item] of dependencies.entries()) validateDependency(item, index, issues);
  for (const [index, item] of metadata.entries()) validateMetadata(item, index, issues);
  for (const [index, item] of mappings.entries()) validateMapping(item, index, issues);
  for (const [index, item] of semanticIssues.entries()) validateIssue(item, index, issues);
  validateUniqueIds([relations, fields, operators, dependencies, metadata, mappings, semanticIssues], issues);
  validateContiguousFieldSlots(fields, issues);
  validateReferences(value as Record<string, unknown>, issues);
  if (issues.length > 0) throw new SemanticFactsContractError(issues);
  return value as unknown as CandidateTaskSemanticFacts;
}

export function semanticFactsCanonicalJson(facts: CandidateTaskSemanticFacts): string {
  parseCandidateTaskSemanticFacts(facts);
  return canonicalJson(facts);
}

export function semanticFactsHash(facts: CandidateTaskSemanticFacts): string {
  return sha256(semanticFactsCanonicalJson(facts));
}

function validateProvider(value: unknown, issues: string[]): void {
  if (!isRecord(value)) { issues.push("provider must be an object"); return; }
  exactKeys(value, ["name", "calciteVersion", "adapterVersion", "buildFingerprint"], "provider", issues);
  if (value.name !== "calcite-semantic-provider") issues.push("provider.name invalid");
  if (value.calciteVersion !== "1.42.0") issues.push("provider.calciteVersion invalid");
  nonEmpty(value.adapterVersion, "provider.adapterVersion", issues);
  digest(value.buildFingerprint, "provider.buildFingerprint", issues);
}
function validateInput(value: unknown, issues: string[]): void {
  if (!isRecord(value)) { issues.push("input must be an object"); return; }
  exactKeys(value, ["sqlSourceId", "statementOrdinal", "sqlSha256", "schemaSha256", "dialectDigest"], "input", issues);
  stableId(value.sqlSourceId, "input.sqlSourceId", issues);
  integer(value.statementOrdinal, "input.statementOrdinal", issues);
  digest(value.sqlSha256, "input.sqlSha256", issues); digest(value.schemaSha256, "input.schemaSha256", issues); digest(value.dialectDigest, "input.dialectDigest", issues);
}
function validateCapability(value: unknown, index: number, issues: string[]): void { if (!isRecord(value)) { issues.push(`capabilities[${index}] must be object`); return; } exactKeys(value,["capability","evaluationStatus","issueRefs"],`capabilities[${index}]`,issues,true); stableId(value.capability,`capabilities[${index}].capability`,issues); enumValue(value.evaluationStatus,EVALUATION,`capabilities[${index}].evaluationStatus`,issues); ids(value.issueRefs,`capabilities[${index}].issueRefs`,issues,true); }
function validateRelation(value: unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`relations[${index}] must be object`);return;} exactKeys(value,["relationId","kind","inputRelationIds","outputFieldIds","qualifiedTableName","providerOrdinal","sourceOccurrences"],`relations[${index}]`,issues,true); stableId(value.relationId,`relations[${index}].relationId`,issues); enumValue(value.kind,OPERATOR,`relations[${index}].kind`,issues); orderedIds(value.inputRelationIds,`relations[${index}].inputRelationIds`,issues); ids(value.outputFieldIds,`relations[${index}].outputFieldIds`,issues); if(value.providerOrdinal!==undefined)integer(value.providerOrdinal,`relations[${index}].providerOrdinal`,issues); if(value.sourceOccurrences!==undefined){if(!Array.isArray(value.sourceOccurrences)){issues.push(`relations[${index}].sourceOccurrences must be array`);}else{validateSorted(value.sourceOccurrences,`occurrenceId`,`relations[${index}].sourceOccurrences`,issues);for(const [sourceIndex,source] of value.sourceOccurrences.entries())validateSourceOccurrence(source,index,sourceIndex,issues);}} }
function validateSourceOccurrence(value:unknown,relationIndex:number,sourceIndex:number,issues:string[]):void { const label=`relations[${relationIndex}].sourceOccurrences[${sourceIndex}]`; if(!isRecord(value)){issues.push(`${label} must be object`);return;} exactKeys(value,["occurrenceId","sourceKind","coordinateSystem","sourceSpan"],label,issues); stableId(value.occurrenceId,`${label}.occurrenceId`,issues); if(value.sourceKind!=="TABLE_REFERENCE")issues.push(`${label}.sourceKind invalid`); if(value.coordinateSystem!=="DIALECT_TRANSFORMED_SQL")issues.push(`${label}.coordinateSystem invalid`); if(!isRecord(value.sourceSpan)){issues.push(`${label}.sourceSpan must be object`);return;} exactKeys(value.sourceSpan,["startLine","startColumn","endLine","endColumn"],`${label}.sourceSpan`,issues); for(const key of ["startLine","startColumn","endLine","endColumn"])positiveInteger(value.sourceSpan[key],`${label}.sourceSpan.${key}`,issues); if(Number(value.sourceSpan.endLine)<Number(value.sourceSpan.startLine)||(Number(value.sourceSpan.endLine)===Number(value.sourceSpan.startLine)&&Number(value.sourceSpan.endColumn)<Number(value.sourceSpan.startColumn)))issues.push(`${label}.sourceSpan end precedes start`); }
function validateField(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`fields[${index}] must be object`);return;} exactKeys(value,["fieldId","relationId","role","slot","name","typeName","nullable","physicalFieldId"],`fields[${index}]`,issues,true); stableId(value.fieldId,`fields[${index}].fieldId`,issues); stableId(value.relationId,`fields[${index}].relationId`,issues); if(value.role!=="INPUT"&&value.role!=="OUTPUT")issues.push(`fields[${index}].role invalid`); integer(value.slot,`fields[${index}].slot`,issues); if(typeof value.name!=="string")issues.push(`fields[${index}].name invalid`); nonEmpty(value.typeName,`fields[${index}].typeName`,issues); if(typeof value.nullable!=="boolean")issues.push(`fields[${index}].nullable invalid`); if(value.physicalFieldId!==undefined)stableId(value.physicalFieldId,`fields[${index}].physicalFieldId`,issues); }
function validateOperator(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`operators[${index}] must be object`);return;} exactKeys(value,["operatorId","kind","relationId","inputRelationIds","inputRoles","joinType"],`operators[${index}]`,issues,true); stableId(value.operatorId,`operators[${index}].operatorId`,issues); enumValue(value.kind,OPERATOR,`operators[${index}].kind`,issues); stableId(value.relationId,`operators[${index}].relationId`,issues); orderedIds(value.inputRelationIds,`operators[${index}].inputRelationIds`,issues); if(value.inputRoles!==undefined){if(!Array.isArray(value.inputRoles))issues.push(`operators[${index}].inputRoles must be array`);else{if(value.inputRoles.length!==(value.inputRelationIds as unknown[]).length)issues.push(`operators[${index}].inputRoles must align with inputRelationIds`);for(const [roleIndex,role] of value.inputRoles.entries())enumValue(role,INPUT_ROLE,`operators[${index}].inputRoles[${roleIndex}]`,issues);}} }
function validateDependency(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`dependencies[${index}] must be object`);return;} exactKeys(value,["dependencyId","dependencyKind","impactKind","operatorId","fromRefs","toRefs","evaluationStatus","evidenceMappingRefs","issueRefs"],`dependencies[${index}]`,issues); stableId(value.dependencyId,`dependencies[${index}].dependencyId`,issues); enumValue(value.dependencyKind,DEPENDENCY,`dependencies[${index}].dependencyKind`,issues); enumValue(value.impactKind,IMPACT,`dependencies[${index}].impactKind`,issues); stableId(value.operatorId,`dependencies[${index}].operatorId`,issues); ids(value.fromRefs,`dependencies[${index}].fromRefs`,issues); ids(value.toRefs,`dependencies[${index}].toRefs`,issues); enumValue(value.evaluationStatus,EVALUATION,`dependencies[${index}].evaluationStatus`,issues); ids(value.evidenceMappingRefs,`dependencies[${index}].evidenceMappingRefs`,issues); ids(value.issueRefs,`dependencies[${index}].issueRefs`,issues); if(value.evaluationStatus==="EVALUATED"&&(value.evidenceMappingRefs as unknown[]).length===0)issues.push(`dependencies[${index}] evaluated dependency requires evidence mapping`); }
function validateMetadata(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`metadata[${index}] must be object`);return;} exactKeys(value,["metadataId","kind","subjectRef","evaluationStatus","knowledgeStatus","basis","absenceProven","value"],`metadata[${index}]`,issues,true); stableId(value.metadataId,`metadata[${index}].metadataId`,issues); enumValue(value.kind,METADATA_KIND,`metadata[${index}].kind`,issues); stableId(value.subjectRef,`metadata[${index}].subjectRef`,issues); enumValue(value.evaluationStatus,EVALUATION,`metadata[${index}].evaluationStatus`,issues); enumValue(value.knowledgeStatus,KNOWLEDGE,`metadata[${index}].knowledgeStatus`,issues); nonEmpty(value.basis,`metadata[${index}].basis`,issues); if(typeof value.absenceProven!=="boolean")issues.push(`metadata[${index}].absenceProven invalid`); if(value.evaluationStatus!=="EVALUATED"&&value.knowledgeStatus!=="UNKNOWN")issues.push(`metadata[${index}] unevaluated metadata must have UNKNOWN knowledge`); if(value.absenceProven===true&&(value.evaluationStatus!=="EVALUATED"||value.knowledgeStatus==="UNKNOWN"))issues.push(`metadata[${index}] absenceProven requires evaluated known evidence`); if(value.value===null&&value.absenceProven===true)issues.push(`metadata[${index}] null cannot prove absence`); }
function validateMapping(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`evidenceMappings[${index}] must be object`);return;} exactKeys(value,["mappingId","providerRefId","nativeRefId","mappingStatus","evidenceRefs","sourceSpan"],`evidenceMappings[${index}]`,issues,true); stableId(value.mappingId,`evidenceMappings[${index}].mappingId`,issues); stableId(value.providerRefId,`evidenceMappings[${index}].providerRefId`,issues); enumValue(value.mappingStatus,MAPPING,`evidenceMappings[${index}].mappingStatus`,issues); ids(value.evidenceRefs,`evidenceMappings[${index}].evidenceRefs`,issues); if(value.mappingStatus==="EXACT"&&value.nativeRefId===undefined)issues.push(`evidenceMappings[${index}] EXACT requires nativeRefId`); if(value.nativeRefId!==undefined)stableId(value.nativeRefId,`evidenceMappings[${index}].nativeRefId`,issues); if(value.sourceSpan!==undefined){if(!isRecord(value.sourceSpan)||!Number.isInteger(value.sourceSpan.start)||!Number.isInteger(value.sourceSpan.end)||Number(value.sourceSpan.start)<0||Number(value.sourceSpan.end)<Number(value.sourceSpan.start))issues.push(`evidenceMappings[${index}].sourceSpan invalid`);} }
function validateIssue(value:unknown,index:number,issues:string[]):void { if(!isRecord(value)){issues.push(`issues[${index}] must be object`);return;} exactKeys(value,["issueId","code","message","severity","subjectRefs"],`issues[${index}]`,issues,true); stableId(value.issueId,`issues[${index}].issueId`,issues); stableId(value.code,`issues[${index}].code`,issues); nonEmpty(value.message,`issues[${index}].message`,issues); enumValue(value.severity,SEVERITY,`issues[${index}].severity`,issues); ids(value.subjectRefs,`issues[${index}].subjectRefs`,issues,true); }

function validateReferences(root:Record<string,unknown>,issues:string[]):void { const relations=new Set((root.relations as Record<string,unknown>[]).map(x=>x.relationId)); const fields=new Set((root.fields as Record<string,unknown>[]).map(x=>x.fieldId)); const operators=new Set((root.operators as Record<string,unknown>[]).map(x=>x.operatorId)); const mappings=new Set((root.evidenceMappings as Record<string,unknown>[]).map(x=>x.mappingId)); const issueIds=new Set((root.issues as Record<string,unknown>[]).map(x=>x.issueId)); for(const r of root.relations as Record<string,unknown>[]) { for(const id of r.inputRelationIds as string[])if(!relations.has(id))issues.push(`relation ${String(r.relationId)} input ${id} missing`); for(const id of r.outputFieldIds as string[])if(!fields.has(id))issues.push(`relation ${String(r.relationId)} output ${id} missing`); } for(const f of root.fields as Record<string,unknown>[])if(!relations.has(f.relationId))issues.push(`field ${String(f.fieldId)} relation missing`); for(const o of root.operators as Record<string,unknown>[])if(!relations.has(o.relationId))issues.push(`operator ${String(o.operatorId)} relation missing`); for(const d of root.dependencies as Record<string,unknown>[]) { if(!operators.has(d.operatorId))issues.push(`dependency ${String(d.dependencyId)} operator missing`); for(const id of d.evidenceMappingRefs as string[])if(!mappings.has(id))issues.push(`dependency ${String(d.dependencyId)} mapping ${id} missing`); for(const id of d.issueRefs as string[])if(!issueIds.has(id))issues.push(`dependency ${String(d.dependencyId)} issue ${id} missing`); } }
function validateContiguousFieldSlots(values:unknown[],issues:string[]):void { const groups=new Map<string,number[]>(); for(const value of values){if(!isRecord(value)||typeof value.relationId!=="string"||typeof value.role!=="string"||typeof value.slot!=="number")continue; const key=`${value.relationId}|${value.role}`; groups.set(key,[...(groups.get(key)??[]),value.slot]);} for(const [key,slots] of groups){const ordered=[...slots].sort((a,b)=>a-b); if(ordered.some((slot,index)=>slot!==index))issues.push(`fields for ${key} must use contiguous slots from zero`);} }
function validateUniqueIds(groups:unknown[][],issues:string[]):void { const seen=new Set<string>(); for(const group of groups)for(const value of group)if(isRecord(value)){const id=Object.entries(value).find(([key])=>key.endsWith("Id"))?.[1]; if(typeof id==="string"){if(seen.has(id))issues.push(`duplicate stable id ${id}`); seen.add(id);}} }
function validateSorted(values:unknown[],key:string,label:string,issues:string[]):void { const actual=values.map(v=>isRecord(v)&&typeof v[key]==="string"?v[key]:""); const expected=[...actual].sort(); if(actual.some((value,index)=>value!==expected[index]))issues.push(`${label} must be sorted by ${key}`); }
function exactKeys(value:Record<string,unknown>,allowed:string[],label:string,issues:string[],optional=false):void { const set=new Set(allowed); for(const key of Object.keys(value))if(!set.has(key))issues.push(`${label}.${key} is not allowed`); if(!optional)for(const key of allowed)if(!(key in value))issues.push(`${label}.${key} is required`); }
function array(value:unknown,label:string,issues:string[]):unknown[]{if(!Array.isArray(value)){issues.push(`${label} must be an array`);return [];}return value;}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
function stableId(value:unknown,label:string,issues:string[]):void{if(typeof value!=="string"||!STABLE_ID.test(value))issues.push(`${label} invalid stable id`);}
function digest(value:unknown,label:string,issues:string[]):void{if(typeof value!=="string"||!SHA256.test(value))issues.push(`${label} invalid sha256`);}
function nonEmpty(value:unknown,label:string,issues:string[]):void{if(typeof value!=="string"||value.length===0)issues.push(`${label} must be non-empty`);}
function integer(value:unknown,label:string,issues:string[]):void{if(!Number.isInteger(value)||Number(value)<0)issues.push(`${label} must be a non-negative integer`);}
function positiveInteger(value:unknown,label:string,issues:string[]):void{if(!Number.isInteger(value)||Number(value)<1)issues.push(`${label} must be a positive integer`);}
function enumValue<T extends string>(value:unknown,allowed:Set<T>,label:string,issues:string[]):void{if(!allowed.has(value as T))issues.push(`${label} invalid`);}
function ids(value:unknown,label:string,issues:string[],optional=false):void{if(value===undefined&&optional)return;if(!Array.isArray(value)){issues.push(`${label} must be array`);return;}const seen=new Set<string>();for(const id of value){stableId(id,label,issues);if(typeof id==="string"&&seen.has(id))issues.push(`${label} contains duplicate ${id}`);if(typeof id==="string")seen.add(id);}const sorted=[...seen].sort();if([...seen].some((id,index)=>id!==sorted[index]))issues.push(`${label} must be sorted`);}
function orderedIds(value:unknown,label:string,issues:string[]):void{if(!Array.isArray(value)){issues.push(`${label} must be array`);return;}const seen=new Set<string>();for(const id of value){stableId(id,label,issues);if(typeof id==="string"&&seen.has(id))issues.push(`${label} contains duplicate ${id}`);if(typeof id==="string")seen.add(id);}}

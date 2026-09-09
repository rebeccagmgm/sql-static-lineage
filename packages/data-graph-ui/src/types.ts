export type GraphLayer = "table" | "field";
export type Direction = "up" | "down";
export type MetadataStatus =
  | "AVAILABLE"
  | "ANNOTATION_NOT_RECORDED"
  | "METADATA_UNAVAILABLE"
  | "METADATA_READ_FAILED";
export interface MetadataValue {
  status: MetadataStatus;
  reason?: string;
  description?: string;
  comment?: string;
}
export interface TableMetadata {
  table: MetadataValue;
  field?: MetadataValue;
  source?: string;
  collectedAt?: string;
  contentHash?: string;
  versionRelation?: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION";
}
export interface GraphNode {
  id: string;
  kind: string;
  label?: string;
  table?: string;
  column?: string;
  taskId?: string;
  writeId?: string;
  depth?: number;
  detail?: Record<string, unknown>;
  metadata?: TableMetadata;
  [key: string]: unknown;
}
export interface GraphEdge {
  id?: string;
  key?: string;
  from: string;
  to: string;
  kind: string;
  status?: string;
  detail?: Record<string, unknown>;
}
export interface TerminalNode {
  nodeId: string;
  role: string;
  reason: string;
  ruleRef: string;
}
export interface TraceResult {
  version: string;
  layer: GraphLayer;
  direction: Direction;
  depthLimit: number;
  edgeLimit: number;
  truncated: boolean;
  stoppedBy: "EDGE_LIMIT" | "DEPTH_LIMIT" | null;
  frontierNodeIds: string[];
  terminalNodes: TerminalNode[];
  /** Local SQLite scheduler-catalog task names for task cards synthesized by the view. */
  taskLabels?: Record<string, string>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  elapsedMs: number;
}
export interface TaskDetail {
  version: string;
  taskId: string;
  taskName?: string;
  taskCategory?: string;
  coverage?: string;
  failureReason?: string;
  bindings: Array<{
    column: string;
    writeId?: string;
    expression?: string;
    inputFields?: Array<{ table: string; column: string }>;
  }>;
  controls: Array<{
    kind: string;
    joinType?: string;
    condition?: string;
    groupBy?: unknown;
    window?: unknown;
    sourceText?: string;
  }>;
  sqlSources?: Array<{ slot: string; content: string }>;
}
export interface Anchor {
  taskId?: string;
  table?: string;
  nodeId?: string;
  column?: string;
  writeId?: string;
  label: string;
}
export interface OverviewResult {
  version: string;
  stages: string[];
  regions: Array<{ schema: string; stage: string; datasetCount: number }>;
  flows: Array<{
    fromSchema: string;
    toSchema: string;
    fromStage: string;
    toStage: string;
    taskCount: number;
    evidenceKind: "TABLE_IO";
  }>;
  limits: { regions: number; flows: number };
  truncated: { regions: boolean; flows: boolean };
  excluded: { unqualifiedDatasets: number };
}
export interface RegionResult {
  version: string;
  schema: string;
  items: GraphNode[];
  pagination: { offset: number; limit: number; nextOffset: number | null };
  truncated: boolean;
}

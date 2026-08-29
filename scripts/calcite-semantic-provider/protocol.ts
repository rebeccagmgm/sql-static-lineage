import { canonicalJson, sha256 } from "../machine-facts/machine-facts-contract.ts";
import {
  parseCandidateTaskSemanticFacts,
  type CandidateTaskSemanticFacts,
} from "./contract.ts";

export interface ProviderColumn { readonly name: string; readonly type: string; readonly nullable: boolean }
export interface ProviderTable {
  readonly catalog?: string;
  readonly schema: string;
  readonly name: string;
  readonly columns: readonly ProviderColumn[];
  readonly uniqueKeys?: readonly (readonly string[])[];
  readonly rowCount?: number;
}
export interface CalciteSemanticProviderRequest {
  readonly protocolVersion: 1;
  readonly requestId: string;
  readonly sqlSourceId: string;
  readonly statementOrdinal: number;
  readonly dialect: "ANSI" | "HIVE_COMPAT";
  readonly sql: string;
  readonly schema: { readonly tables: readonly ProviderTable[] };
  readonly dynamicParameters?: readonly { readonly ordinal: number; readonly type: string; readonly nullable: boolean }[];
  readonly requestedMetadata?: readonly string[];
  readonly limits?: { readonly maxInputBytes?: number; readonly maxSqlBytes?: number; readonly maxTables?: number; readonly maxColumnsPerTable?: number; readonly maxRelNodes?: number; readonly maxOutputItems?: number; readonly maxOutputBytes?: number };
}
export interface CalciteSemanticProviderResponse {
  readonly protocolVersion: 1;
  readonly requestId?: string;
  readonly status: "SUCCESS" | "PARTIAL" | "UNSUPPORTED" | "ERROR";
  readonly facts?: CandidateTaskSemanticFacts;
  readonly error?: { readonly code: string; readonly message: string };
  readonly fingerprint: { readonly tool: "calcite-semantic-provider"; readonly calciteVersion: "1.42.0"; readonly protocolVersion: 1; readonly buildFingerprint: string };
}

export function providerRequestDigest(request: CalciteSemanticProviderRequest): string {
  return sha256(canonicalJson({
    protocolVersion: request.protocolVersion,
    providerVersion: "calcite-semantic-provider/0.1.1-poc;calcite/1.42.0",
    sql: request.sql,
    schema: request.schema,
    dialect: request.dialect,
    dynamicParameters: request.dynamicParameters ?? [],
    requestedMetadata: request.requestedMetadata ?? [],
  }));
}

export function parseProviderResponse(value: unknown): CalciteSemanticProviderResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("provider response must be an object");
  const record = value as Record<string, unknown>;
  const rawStatus = record.status;
  const status = rawStatus === "FAILED" ? "ERROR" : rawStatus;
  if (!["SUCCESS", "PARTIAL", "UNSUPPORTED", "ERROR"].includes(String(status))) throw new Error("provider response status invalid");
  if (typeof record.fingerprint !== "object" || record.fingerprint === null) throw new Error("provider fingerprint missing");
  const fingerprint = record.fingerprint as Record<string, unknown>;
  if (fingerprint.tool !== "calcite-semantic-provider" || fingerprint.calciteVersion !== "1.42.0" || fingerprint.protocolVersion !== 1) throw new Error("provider fingerprint incompatible");
  const facts = record.facts === undefined ? undefined : parseCandidateTaskSemanticFacts(record.facts);
  if ((status === "SUCCESS" || status === "PARTIAL") && facts === undefined) throw new Error("successful provider response requires facts");
  return { ...(record as unknown as CalciteSemanticProviderResponse), status: status as CalciteSemanticProviderResponse["status"], ...(facts ? { facts } : {}) };
}

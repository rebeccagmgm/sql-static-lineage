import { readFileSync } from "node:fs";
import { resolveWorkspacePaths } from "../../../../scripts/config/workspace-paths.ts";
import { openNeo4jQueryIndexDriver } from "../neo4j/connection.ts";

export function assetGraphConfig(configPath?: string) {
  const paths = resolveWorkspacePaths({ configPath });
  const config = JSON.parse(readFileSync(paths.configPath, "utf8")).neo4j;
  if (!config) throw new Error("WORKSPACE_NEO4J_CONFIG_MISSING");
  const passwordFile = process.env[String(config.passwordFileEnv)];
  if (!passwordFile) throw new Error("NEO4J_PASSWORD_FILE_ENV_MISSING");
  return {
    paths,
    graphId: String(config.graphId),
    connection: {
      uri: String(config.uri),
      username: String(config.username),
      database: String(config.database),
      passwordSource: { kind: "FILE" as const, path: passwordFile },
    },
  };
}
export async function openAssetGraph(configPath?: string) {
  const config = assetGraphConfig(configPath);
  return { ...config, ...(await openNeo4jQueryIndexDriver(config.connection)) };
}

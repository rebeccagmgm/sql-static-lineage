import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { parseCandidateTaskSemanticFacts } from "./contract.ts";
import { semanticEdges, type SemanticEdgeGolden } from "./semantic-golden.ts";

export function freezeSemanticGolden(factsDirectory: string): Record<string, readonly SemanticEdgeGolden[]> {
  const output: Record<string, readonly SemanticEdgeGolden[]> = {};
  for (const name of readdirSync(factsDirectory).filter((item) => item.endsWith(".candidate-facts.json")).sort()) {
    const id = basename(name, ".candidate-facts.json");
    const facts = parseCandidateTaskSemanticFacts(JSON.parse(readFileSync(join(factsDirectory, name), "utf8")));
    output[id] = semanticEdges(facts);
  }
  return output;
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return resolve(value);
}

function main(): void {
  const destination = argument("--output");
  const golden = freezeSemanticGolden(argument("--facts-dir"));
  writeFileSync(destination, canonicalJson(golden), "utf8");
  process.stdout.write(`frozenSemanticSamples=${Object.keys(golden).length}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();

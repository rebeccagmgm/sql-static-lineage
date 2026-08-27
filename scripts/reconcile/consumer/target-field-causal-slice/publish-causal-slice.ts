import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTargetFieldCausalSliceHtml } from "../../../visualize/target-field-causal-slice-visualize.ts";
import { canonicalJson } from "../../../machine-facts/machine-facts-contract.ts";
import {
  validateCausalSliceArtifact,
  type CausalSliceArtifact,
} from "./causal-slice-contract.ts";

const OUTPUT_NAMES = [
  "target-field-causal-slice.json",
  "target-field-causal-slice.txt",
  "target-field-causal-slice.html",
] as const;
const LOCK_NAME = ".target-field-causal-slice.lock";
const JOURNAL_NAME = ".target-field-causal-slice-publish.json";
const UNKNOWN_LOCK_STALE_MS = 60_000;

type OutputName = (typeof OUTPUT_NAMES)[number];
type ArtifactFormatter = (artifact: CausalSliceArtifact) => string;
type ArtifactRenderer = (artifact: CausalSliceArtifact) => string;

export interface TargetFieldCausalSlicePublishOptions {
  readonly outputDir: string;
  readonly artifact: CausalSliceArtifact;
  readonly formatText?: ArtifactFormatter;
  readonly renderHtml?: ArtifactRenderer;
  /** Aliases keep publication decoupled from the eventual formatter module name. */
  readonly formatter?: ArtifactFormatter;
  readonly renderer?: ArtifactRenderer;
  readonly format?: ArtifactFormatter;
  readonly render?: ArtifactRenderer;
  /** Test/failure-injection seam; it never changes the set of publication targets. */
  readonly replaceFile?: (stagedPath: string, targetPath: string) => void;
}

export interface TargetFieldCausalSlicePublishedFiles {
  readonly json: string;
  readonly text: string;
  readonly html: string;
}

function defaultText(artifact: CausalSliceArtifact): string {
  const statuses = new Map<string, number>();
  for (const assessment of artifact.assessments)
    statuses.set(assessment.status, (statuses.get(assessment.status) ?? 0) + 1);
  const statusLine =
    [...statuses.entries()]
      .map(([status, count]) => `${status}: ${count}`)
      .join("; ") || "none";
  return (
    [
      "Target Field Causal Slice",
      `Task: ${artifact.request.rootTaskId}`,
      `Table: ${artifact.request.rootTable}`,
      `Target fields: ${artifact.request.rootFields.join(", ")}`,
      `Candidate branches: ${artifact.candidateUniverse.branches.length}`,
      `Assessments: ${statusLine}`,
      `Minimum confirmed rerun tasks: ${artifact.rerunSets.minimumConfirmed.taskIds.join(", ") || "none"}`,
      `Conservative safety rerun tasks: ${artifact.rerunSets.conservativeSafety.taskIds.join(", ") || "none"}`,
      `Value limit truncated: ${artifact.limits.value.truncated}`,
      `Control limit truncated: ${artifact.limits.control.truncated}`,
      `Content hash: ${artifact.contentHash}`,
    ].join("\n") + "\n"
  );
}

function artifactJson(artifact: CausalSliceArtifact): string {
  return `${canonicalJson(artifact)}\n`;
}

function outputPaths(
  outputDir: string,
): Record<"json" | "text" | "html", string> {
  return {
    json: join(outputDir, OUTPUT_NAMES[0]),
    text: join(outputDir, OUTPUT_NAMES[1]),
    html: join(outputDir, OUTPUT_NAMES[2]),
  };
}

function makeToken(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureOutput(value: string, name: string): string {
  if (typeof value !== "string")
    throw new Error(`CAUSAL_SLICE_OUTPUT_INVALID:${name}`);
  return value;
}

function defaultReplace(stagedPath: string, targetPath: string): void {
  renameSync(stagedPath, targetPath);
}

interface PublishJournal {
  readonly pid: number;
  readonly stagingDir: string;
  readonly backupDir: string;
  readonly replaced: readonly OutputName[];
  readonly backedUp: readonly OutputName[];
  readonly status: "PREPARED" | "REPLACING" | "COMMITTED";
}

function targetPathFor(
  paths: ReturnType<typeof outputPaths>,
  name: OutputName,
): string {
  return paths[
    name === OUTPUT_NAMES[0]
      ? "json"
      : name === OUTPUT_NAMES[1]
        ? "text"
        : "html"
  ];
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readOwnerPid(lockPath: string): number | null {
  try {
    const value = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: unknown };
    return typeof value.pid === "number" ? value.pid : null;
  } catch {
    return null;
  }
}

function acquireLock(lockPath: string): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(lockPath, "wx");
      try {
        writeFileSync(
          descriptor,
          `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
          "utf8",
        );
      } finally {
        closeSync(descriptor);
      }
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const ownerPid = readOwnerPid(lockPath);
      if (
        (ownerPid === null && Date.now() - statSync(lockPath).mtimeMs < UNKNOWN_LOCK_STALE_MS) ||
        (ownerPid !== null && processIsAlive(ownerPid))
      )
        throw new Error(`CAUSAL_SLICE_PUBLICATION_LOCKED:${ownerPid ?? "UNKNOWN"}`);
      unlinkSync(lockPath);
    }
  }
  throw new Error("CAUSAL_SLICE_PUBLICATION_LOCK_UNAVAILABLE");
}

function writeJournal(path: string, journal: PublishJournal): void {
  writeFileSync(path, `${JSON.stringify(journal)}\n`, "utf8");
}

function rollbackJournal(
  journal: PublishJournal,
  paths: ReturnType<typeof outputPaths>,
): void {
  for (const name of [...journal.replaced].reverse()) {
    const targetPath = targetPathFor(paths, name);
    if (existsSync(targetPath)) unlinkSync(targetPath);
  }
  for (const name of [...journal.backedUp].reverse()) {
    const targetPath = targetPathFor(paths, name);
    const backupPath = join(journal.backupDir, name);
    if (existsSync(backupPath)) renameSync(backupPath, targetPath);
  }
}

function validatedJournal(
  value: unknown,
  outputDir: string,
): PublishJournal {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("CAUSAL_SLICE_PUBLICATION_JOURNAL_INVALID");
  const journal = value as Partial<PublishJournal>;
  const allowedNames = new Set<string>(OUTPUT_NAMES);
  const validNames = (names: unknown): names is readonly OutputName[] =>
    Array.isArray(names) && names.every((name) => typeof name === "string" && allowedNames.has(name));
  const resolvedOutput = resolve(outputDir);
  const safeOwnedDir = (path: unknown, prefix: string): path is string => {
    if (typeof path !== "string") return false;
    const resolvedPath = resolve(path);
    return resolvedPath.startsWith(`${resolvedOutput}${sep}`) && basename(resolvedPath).startsWith(prefix);
  };
  if (
    typeof journal.pid !== "number" ||
    !safeOwnedDir(journal.stagingDir, ".target-field-causal-slice-staging-") ||
    !safeOwnedDir(journal.backupDir, ".target-field-causal-slice-backup-") ||
    !validNames(journal.replaced) ||
    !validNames(journal.backedUp) ||
    !["PREPARED", "REPLACING", "COMMITTED"].includes(String(journal.status))
  ) throw new Error("CAUSAL_SLICE_PUBLICATION_JOURNAL_INVALID");
  return journal as PublishJournal;
}

function recoverInterruptedPublish(
  journalPath: string,
  paths: ReturnType<typeof outputPaths>,
  outputDir: string,
): void {
  if (!existsSync(journalPath)) return;
  const journal = validatedJournal(
    JSON.parse(readFileSync(journalPath, "utf8")) as unknown,
    outputDir,
  );
  if (journal.status !== "COMMITTED") rollbackJournal(journal, paths);
  rmSync(journal.stagingDir, { recursive: true, force: true });
  rmSync(journal.backupDir, { recursive: true, force: true });
  unlinkSync(journalPath);
}

/**
 * Publish only the causal-slice trio. The staging and backup directories are
 * siblings of the output files and are removed best-effort after the commit.
 * No directory is ever renamed or removed by this function.
 */
export function publishTargetFieldCausalSlice(
  options: TargetFieldCausalSlicePublishOptions,
): TargetFieldCausalSlicePublishedFiles {
  const validationErrors = validateCausalSliceArtifact(options.artifact);
  if (validationErrors.length > 0)
    throw new Error(`CAUSAL_SLICE_ARTIFACT_INVALID:${validationErrors.join(";")}`);
  const outputDir = resolve(options.outputDir);
  const paths = outputPaths(outputDir);
  const formatText =
    options.formatText ?? options.formatter ?? options.format ?? defaultText;
  const renderHtml =
    options.renderHtml ??
    options.renderer ??
    options.render ??
    renderTargetFieldCausalSliceHtml;

  const contents: Record<OutputName, string> = {
    [OUTPUT_NAMES[0]]: ensureOutput(
      artifactJson(options.artifact),
      OUTPUT_NAMES[0],
    ),
    [OUTPUT_NAMES[1]]: ensureOutput(
      formatText(options.artifact),
      OUTPUT_NAMES[1],
    ),
    [OUTPUT_NAMES[2]]: ensureOutput(
      renderHtml(options.artifact),
      OUTPUT_NAMES[2],
    ),
  };

  mkdirSync(outputDir, { recursive: true });
  const lockPath = join(outputDir, LOCK_NAME);
  const journalPath = join(outputDir, JOURNAL_NAME);
  acquireLock(lockPath);
  const token = makeToken();
  const stagingDir = join(
    outputDir,
    `.target-field-causal-slice-staging-${token}`,
  );
  const backupDir = join(
    outputDir,
    `.target-field-causal-slice-backup-${token}`,
  );
  const replaced: OutputName[] = [];
  const backedUp: OutputName[] = [];
  const replaceFile = options.replaceFile ?? defaultReplace;
  let cleanupBackup = true;

  try {
    recoverInterruptedPublish(journalPath, paths, outputDir);
    mkdirSync(stagingDir);
    for (const name of OUTPUT_NAMES)
      writeFileSync(join(stagingDir, name), contents[name], "utf8");
    mkdirSync(backupDir);
    writeJournal(journalPath, {
      pid: process.pid,
      stagingDir,
      backupDir,
      replaced,
      backedUp,
      status: "PREPARED",
    });

    for (const name of OUTPUT_NAMES) {
      const targetPath = targetPathFor(paths, name);
      const backupPath = join(backupDir, name);
      if (existsSync(targetPath)) {
        backedUp.push(name);
        writeJournal(journalPath, {
          pid: process.pid,
          stagingDir,
          backupDir,
          replaced,
          backedUp,
          status: "REPLACING",
        });
        renameSync(targetPath, backupPath);
      }
      replaced.push(name);
      writeJournal(journalPath, {
        pid: process.pid,
        stagingDir,
        backupDir,
        replaced,
        backedUp,
        status: "REPLACING",
      });
      replaceFile(join(stagingDir, name), targetPath);
    }
    writeJournal(journalPath, {
      pid: process.pid,
      stagingDir,
      backupDir,
      replaced,
      backedUp,
      status: "COMMITTED",
    });
  } catch (error) {
    try {
      rollbackJournal(
        { pid: process.pid, stagingDir, backupDir, replaced, backedUp, status: "REPLACING" },
        paths,
      );
      if (existsSync(journalPath)) unlinkSync(journalPath);
    } catch (rollbackError) {
      cleanupBackup = false;
      throw new AggregateError(
        [error, rollbackError],
        "CAUSAL_SLICE_PUBLICATION_ROLLBACK_FAILED",
      );
    }
    throw error;
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
    if (cleanupBackup) rmSync(backupDir, { recursive: true, force: true });
    if (existsSync(journalPath) && cleanupBackup) unlinkSync(journalPath);
    if (existsSync(lockPath)) unlinkSync(lockPath);
  }

  return paths;
}

export const publishCausalSlice = publishTargetFieldCausalSlice;

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function main(): void {
  const argv = process.argv.slice(2);
  const artifactPath = option(argv, "--artifact");
  const outputDir = option(argv, "--output-dir");
  if (!artifactPath || !outputDir)
    throw new Error(
      "usage: publish-causal-slice --artifact <target-field-causal-slice.json> --output-dir <task-artifact-dir>",
    );
  const artifact = JSON.parse(
    readFileSync(resolve(artifactPath), "utf8"),
  ) as CausalSliceArtifact;
  process.stdout.write(
    `${JSON.stringify(publishTargetFieldCausalSlice({ outputDir, artifact }))}\n`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();

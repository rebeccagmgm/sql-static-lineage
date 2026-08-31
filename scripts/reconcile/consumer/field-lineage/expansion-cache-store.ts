import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { canonicalJson } from "../../../machine-facts/machine-facts-contract.ts";
import {
  validateFieldExpansionCacheEntry,
  type FieldExpansionCacheEntry,
} from "./expansion-cache-contract.ts";

export type ExpansionCacheRead =
  | { readonly status: "MISSING" }
  | { readonly status: "VALID"; readonly entry: FieldExpansionCacheEntry }
  | { readonly status: "CORRUPT" };

export interface ExpansionCacheStore {
  readonly read: (key: string) => ExpansionCacheRead;
  readonly write: (entry: FieldExpansionCacheEntry) => void;
}

export interface FileExpansionCacheStoreOptions {
  readonly writeBytes?: (descriptor: number, bytes: Uint8Array) => number;
  readonly renameFile?: (source: string, destination: string) => void;
}

export function writeCacheBytes(
  bytes: Uint8Array,
  writer: (bytes: Uint8Array) => number,
): void {
  const written = writer(bytes);
  if (written !== bytes.byteLength) throw new Error("CACHE_WRITE_SHORT");
}

export class FileExpansionCacheStore implements ExpansionCacheStore {
  private readonly root: string;
  private readonly writeBytes: (descriptor: number, bytes: Uint8Array) => number;
  private readonly renameFile: (source: string, destination: string) => void;

  public constructor(
    rootInput: string,
    options: FileExpansionCacheStoreOptions = {},
  ) {
    this.root = resolve(rootInput);
    this.writeBytes =
      options.writeBytes ??
      ((descriptor, bytes) =>
        writeSync(descriptor, bytes, 0, bytes.byteLength, 0));
    this.renameFile = options.renameFile ?? renameSync;
  }

  public read(key: string): ExpansionCacheRead {
    const path = this.pathFor(key);
    if (!existsSync(path)) return { status: "MISSING" };
    try {
      const entry = JSON.parse(readFileSync(path, "utf8")) as unknown;
      validateFieldExpansionCacheEntry(entry, key);
      return { status: "VALID", entry };
    } catch {
      return { status: "CORRUPT" };
    }
  }

  public write(entry: FieldExpansionCacheEntry): void {
    validateFieldExpansionCacheEntry(entry);
    const path = this.pathFor(entry.key);
    mkdirSync(dirname(path), { recursive: true });
    const staged = `${path}.staged-${randomUUID()}`;
    const backup = `${path}.previous-${randomUUID()}`;
    const bytes = Buffer.from(canonicalJson(entry), "utf8");
    let descriptor: number | undefined;
    let backupOwned = false;
    try {
      descriptor = openSync(staged, "wx");
      writeCacheBytes(bytes, (chunk) =>
        this.writeBytes(descriptor as number, chunk),
      );
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;

      const hadTarget = existsSync(path);
      if (hadTarget) {
        this.renameFile(path, backup);
        backupOwned = true;
      }
      try {
        this.renameFile(staged, path);
      } catch (error) {
        if (existsSync(staged)) rmSync(staged, { force: true });
        if (backupOwned && existsSync(backup)) {
          if (!existsSync(path)) this.renameFile(backup, path);
          else rmSync(backup, { force: true });
          backupOwned = false;
        }
        throw error;
      }
      if (backupOwned) {
        rmSync(backup, { force: true });
        backupOwned = false;
      }
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(staged)) rmSync(staged, { force: true });
      if (backupOwned && existsSync(backup)) {
        if (!existsSync(path)) this.renameFile(backup, path);
        else rmSync(backup, { force: true });
      }
    }
  }

  private pathFor(key: string): string {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("CACHE_KEY_INVALID");
    return join(this.root, "field-expansion-v1", key.slice(0, 2), `${key}.json`);
  }
}

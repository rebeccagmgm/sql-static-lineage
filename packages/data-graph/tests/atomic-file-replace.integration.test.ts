import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it.skipIf(process.platform !== "win32")(
  "replaces real files via Windows PowerShell with special-character paths",
  () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-发布'&[1]-"));
    const source = join(directory, "current.json.tmp");
    const destination = join(directory, "current.json");
    try {
      writeFileSync(source, '{"version":"new-中文"}');
      writeFileSync(destination, '{"version":"old"}');
      const output = execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--input-type=module",
          "-e",
          `
          import fs from 'node:fs';
          import { syncBuiltinESMExports } from 'node:module';
          let renameAttempts = 0;
          fs.renameSync = () => {
            renameAttempts++;
            throw Object.assign(new Error('forced rename failure'), { code: 'EPERM' });
          };
          syncBuiltinESMExports();
          const { atomicReplaceFile } = await import(process.env.ATOMIC_REPLACE_TEST_HELPER_URL);
          try {
            atomicReplaceFile(process.env.ATOMIC_REPLACE_TEST_SOURCE, process.env.ATOMIC_REPLACE_TEST_DESTINATION);
            console.log(JSON.stringify({ ok: true, renameAttempts }));
          } catch (error) {
            console.log(JSON.stringify({
              ok: false,
              message: error.message,
              nativeError: new TextDecoder('gb18030').decode(error.errors?.[1]?.stderr),
            }));
          }
        `,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 15_000,
          env: {
            ...process.env,
            ATOMIC_REPLACE_TEST_HELPER_URL: new URL(
              "../src/asset-graph/atomic-file-replace.ts",
              import.meta.url,
            ).href,
            ATOMIC_REPLACE_TEST_SOURCE: source,
            ATOMIC_REPLACE_TEST_DESTINATION: destination,
          },
        },
      );
      expect(JSON.parse(output)).toEqual({ ok: true, renameAttempts: 1 });
      expect(readFileSync(destination, "utf8")).toBe('{"version":"new-中文"}');
      expect(existsSync(source)).toBe(false);
    } finally {
      rmSync(source, { force: true });
      rmSync(destination, { force: true });
      rmdirSync(directory);
    }
  },
);

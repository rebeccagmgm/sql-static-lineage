import { execFileSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { platform } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atomicReplaceFile } from "../src/asset-graph/atomic-file-replace.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn(), renameSync: vi.fn() }));
vi.mock("node:os", () => ({ platform: vi.fn() }));

const source = "C:\\graph\\current.json.tmp";
const destination = "C:\\graph\\current.json";
const renameError = () =>
  Object.assign(new Error("rename denied"), { code: "EPERM" });

describe("atomic file replacement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(platform).mockReturnValue("win32");
    vi.mocked(existsSync).mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses Node rename when it succeeds without checking or replacing the target", () => {
    atomicReplaceFile(source, destination);

    expect(renameSync).toHaveBeenCalledExactlyOnceWith(source, destination);
    expect(existsSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("uses a hidden noninteractive native replacement for Windows EPERM and an existing target", () => {
    vi.mocked(renameSync).mockImplementation(() => {
      throw renameError();
    });

    atomicReplaceFile(source, destination);

    expect(existsSync).toHaveBeenCalledExactlyOnceWith(destination);
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$ErrorActionPreference = 'Stop'; [System.IO.File]::Replace($env:SQL_STATIC_LINEAGE_ATOMIC_REPLACE_SOURCE, $env:SQL_STATIC_LINEAGE_ATOMIC_REPLACE_DESTINATION, [NullString]::Value)",
      ],
      expect.objectContaining({
        windowsHide: true,
        env: expect.objectContaining({
          SQL_STATIC_LINEAGE_ATOMIC_REPLACE_SOURCE: source,
          SQL_STATIC_LINEAGE_ATOMIC_REPLACE_DESTINATION: destination,
        }),
      }),
    );
  });

  it("passes special-character paths only through environment variables", () => {
    const unusualSource =
      "C:\\发布 📈\\a';&$(throw 'injected')`[1]\\current.json.tmp";
    const unusualDestination =
      "C:\\发布 📈\\a';&$(throw 'injected')`[1]\\current.json";
    vi.stubEnv("ATOMIC_REPLACE_TEST_SENTINEL", "preserved");
    vi.mocked(renameSync).mockImplementation(() => {
      throw renameError();
    });

    atomicReplaceFile(unusualSource, unusualDestination);

    const [, args, options] = vi.mocked(execFileSync).mock.calls[0]!;
    expect(args).not.toContain(unusualSource);
    expect(args).not.toContain(unusualDestination);
    expect(JSON.stringify(args)).not.toContain("injected");
    expect(options).toMatchObject({
      env: {
        SQL_STATIC_LINEAGE_ATOMIC_REPLACE_SOURCE: unusualSource,
        SQL_STATIC_LINEAGE_ATOMIC_REPLACE_DESTINATION: unusualDestination,
        ATOMIC_REPLACE_TEST_SENTINEL: "preserved",
      },
    });
    expect(options).not.toHaveProperty("shell", true);
  });

  it.each([
    { operatingSystem: "linux" as const, code: "EPERM", targetExists: true },
    { operatingSystem: "darwin" as const, code: "EPERM", targetExists: true },
    { operatingSystem: "win32" as const, code: "EACCES", targetExists: true },
    { operatingSystem: "win32" as const, code: "ENOENT", targetExists: true },
    { operatingSystem: "win32" as const, code: "EPERM", targetExists: false },
  ])(
    "preserves the original failure without fallback: $operatingSystem/$code/$targetExists",
    ({ operatingSystem, code, targetExists }) => {
      const original = Object.assign(new Error("rename failed"), { code });
      vi.mocked(platform).mockReturnValue(operatingSystem);
      vi.mocked(existsSync).mockReturnValue(targetExists);
      vi.mocked(renameSync).mockImplementation(() => {
        throw original;
      });

      let failure: unknown;
      try {
        atomicReplaceFile(source, destination);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBe(original);
      expect(execFileSync).not.toHaveBeenCalled();
    },
  );

  it("propagates native failure together with the original rename error", () => {
    const original = renameError();
    const nativeError = new Error("native replacement failed");
    vi.mocked(renameSync).mockImplementation(() => {
      throw original;
    });
    vi.mocked(execFileSync).mockImplementation(() => {
      throw nativeError;
    });

    let failure: unknown;
    try {
      atomicReplaceFile(source, destination);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toHaveLength(2);
    expect((failure as AggregateError).errors[0]).toBe(original);
    expect((failure as AggregateError).errors[1]).toBe(nativeError);
    expect(renameSync).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });
});

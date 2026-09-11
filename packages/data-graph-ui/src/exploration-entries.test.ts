import { describe, expect, it } from "vitest";
import {
  EXPLORATION_STORAGE_KEY,
  EXPLORATION_STORAGE_VERSION,
  assessExplorationAnchor,
  assessExplorationRestore,
  createExplorationEntry,
  deleteExplorationEntry,
  explorationMember,
  readExplorationEntries,
  updateExplorationEntry,
  withExplorationMember,
  withoutExplorationMember,
  writeExplorationEntries,
} from "./exploration-entries";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const table = explorationMember({
  nodeId: "dataset:core.t01",
  table: "core.t01",
  label: "core.t01",
});
const task = explorationMember({ taskId: "90210", label: "任务 90210" });
const state = {
  layer: "table" as const,
  direction: "up" as const,
  depth: 2,
  candidates: true,
  selectedFieldIds: ["field:core.t01.id"],
  expandedCandidateIds: ["dataset:core.t01"],
  viewport: { x: 24, y: 12, zoom: 0.8 },
};

describe("exploration entries", () => {
  it("persists a versioned entry and its independent canvas state", () => {
    const storage = new MemoryStorage();
    const entry = createExplorationEntry({
      id: "entry-1",
      name: "当事人 T01",
      description: "验证来源",
      graphVersion: "version-a",
      member: table,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    expect(writeExplorationEntries(storage, [entry]).warning).toBeUndefined();
    expect(readExplorationEntries(storage)).toEqual({ entries: [entry] });
    expect(JSON.parse(storage.getItem(EXPLORATION_STORAGE_KEY)!).formatVersion).toBe(
      EXPLORATION_STORAGE_VERSION,
    );
  });

  it("keeps exact identities when adding and removing members", () => {
    const entry = createExplorationEntry({
      id: "entry-1",
      name: "专题",
      description: "",
      graphVersion: "version-a",
      member: table,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    const added = withExplorationMember(
      entry,
      task,
      { ...state, activeMemberId: task.id },
      "2026-09-09T00:01:00.000Z",
    );
    expect(withExplorationMember(added, task, added.state, added.updatedAt).members).toHaveLength(2);
    expect(added.members.map((member) => member.id)).toEqual([
      "node:dataset:core.t01",
      "task:90210",
    ]);
    expect(withoutExplorationMember(added, table.id, added.updatedAt)?.state.activeMemberId).toBe(task.id);
    expect(withoutExplorationMember(entry, table.id, entry.updatedAt)).toBeUndefined();
  });

  it("ignores malformed or incompatible browser records without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(EXPLORATION_STORAGE_KEY, "not-json");
    expect(readExplorationEntries(storage)).toMatchObject({ entries: [], warning: expect.any(String) });
    storage.setItem(
      EXPLORATION_STORAGE_KEY,
      JSON.stringify({ formatVersion: 99, entries: [] }),
    );
    expect(readExplorationEntries(storage)).toMatchObject({ entries: [], warning: expect.any(String) });
  });

  it("updates names and graph version without changing members", () => {
    const entry = createExplorationEntry({
      id: "entry-1",
      name: "专题",
      description: "",
      graphVersion: "version-a",
      member: table,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    const updated = updateExplorationEntry(
      entry,
      { ...entry, name: "重命名", description: "新说明", graphVersion: "version-b" },
      "2026-09-09T00:01:00.000Z",
    );
    expect(updated).toMatchObject({ name: "重命名", graphVersion: "version-b", members: [table] });
  });

  it("makes graph replacement and missing saved fields explicit", () => {
    const entry = createExplorationEntry({
      id: "entry-1",
      name: "专题",
      description: "",
      graphVersion: "version-a",
      member: table,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    expect(
      assessExplorationRestore(entry, "version-b", ["field:still-present"]),
    ).toEqual({
      graphVersionChanged: true,
      selectedFieldIds: [],
      missingFieldIds: ["field:core.t01.id"],
    });
  });

  it("requires the saved raw anchor identity instead of a same-name replacement", () => {
    expect(
      assessExplorationAnchor(table.anchor, ["dataset:some-other-t01"]),
    ).toEqual({
      expectedNodeId: "dataset:core.t01",
      present: false,
    });
  });

  it("removes only the selected exploration entry", () => {
    const first = createExplorationEntry({
      id: "entry-1",
      name: "保留",
      description: "",
      graphVersion: "version-a",
      member: table,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    const second = createExplorationEntry({
      id: "entry-2",
      name: "删除",
      description: "",
      graphVersion: "version-a",
      member: task,
      state,
      now: "2026-09-09T00:00:00.000Z",
    });
    expect(deleteExplorationEntry([first, second], second.id)).toEqual([first]);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { historyState, historyReducer } from "../src/project-history.js";

test("a project replacement, deletion and undo/redo restore the whole snapshot together", () => {
  const first = {
    devices: ["cpu", "drive"],
    connections: ["link"],
    program: "a",
  };
  const next = { devices: ["cpu"], connections: [], program: "b" };
  let state = historyReducer(historyState(first), {
    type: "edit",
    value: next,
  });
  state = historyReducer(state, { type: "undo" });
  assert.equal(state.present, first);
  state = historyReducer(state, { type: "redo" });
  assert.equal(state.present, next);
  state = historyReducer(state, { type: "undo" });
  state = historyReducer(state, {
    type: "edit",
    value: { ...first, program: "c" },
  });
  assert.equal(state.future.length, 0);
  assert.equal(historyReducer(state, { type: "redo" }), state);
});

test("typing is grouped, separate actions retain boundaries and history stays bounded", () => {
  let state = historyState({ name: "a" });
  state = historyReducer(state, {
    type: "edit",
    value: { name: "ab" },
    group: "name",
    time: 1000,
  });
  state = historyReducer(state, {
    type: "edit",
    value: { name: "abc" },
    group: "name",
    time: 1200,
  });
  assert.equal(state.past.length, 1);
  assert.equal(historyReducer(state, { type: "undo" }).present.name, "a");
  state = historyReducer(state, {
    type: "edit",
    value: { name: "abc", notes: "x" },
    group: "notes",
    time: 1300,
  });
  assert.equal(state.past.length, 2);
  for (let i = 0; i < 60; i++)
    state = historyReducer(state, {
      type: "edit",
      value: { name: String(i) },
      time: 2000 + i * 1000,
    });
  assert.equal(state.past.length, 40);
  const same = historyReducer(state, {
    type: "edit",
    value: { ...state.present },
  });
  assert.equal(same, state);
});

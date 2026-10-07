import test from "node:test";
import assert from "node:assert/strict";
import { validateProject } from "../src/project.js";

const device = (uid = "plc", kind = "cpu", extra = {}) => ({
  uid,
  kind,
  name: uid,
  pos: [0, 0, 0],
  rot: [0, 0, 0],
  ...extra,
});
const project = (extra = {}) => ({
  version: 1,
  project: "Conveyor",
  code: '"Q0.0" := TRUE;',
  devices: [device()],
  connections: [],
  ...extra,
});

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("legacy projects round-trip, missing connections default, and program syntax remains editable", () => {
  const input = project({
    code: "an unfinished program",
    devices: [device("plc", "cpu", { ip: "", startup: "STOP", notes: "" })],
  });
  delete input.version;
  delete input.connections;
  const result = validateProject(input);
  assert.equal(result.version, 1);
  assert.deepEqual(result.connections, []);
  assert.equal(result.code, input.code);
  assert.deepEqual(result.programs, { plc: input.code });
  assert.equal(result.controllerUid, "plc");
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(result))), result);
});

test("validation returns independent values and strips unknown fields without mutating input", () => {
  const input = deepFreeze(
    project({
      unknown: { ignored: true },
      devices: [
        device("plc", "cpu", {
          ip: "192.168.0.10",
          startup: "RUN",
          notes: "Controller",
          unknown: { ignored: true },
        }),
        device("switch", "switch"),
      ],
      connections: [
        { from: "plc", to: "switch", type: "Ethernet", unknown: "ignored" },
      ],
    }),
  );
  const snapshot = JSON.stringify(input);
  const result = validateProject(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.notEqual(result.devices, input.devices);
  assert.notEqual(result.devices[0], input.devices[0]);
  assert.notEqual(result.devices[0].pos, input.devices[0].pos);
  assert.notEqual(result.connections[0], input.connections[0]);
  assert.equal("unknown" in result, false);
  assert.equal("unknown" in result.devices[0], false);
  assert.equal("unknown" in result.connections[0], false);
  result.devices[0].pos[0] = 100;
  assert.equal(input.devices[0].pos[0], 0);
});

test("invalid connection structures fail without changing previously valid state or source", () => {
  const previous = deepFreeze(validateProject(project()));
  const snapshot = JSON.stringify(previous);
  for (const connections of [
    {},
    null,
    "connections",
    [null],
    [{ from: "plc", to: "missing", type: "Ethernet" }],
  ]) {
    const input = project({ devices: [device("replacement")], connections });
    const inputSnapshot = JSON.stringify(input);
    assert.throws(() => validateProject(input), Error);
    assert.equal(JSON.stringify(previous), snapshot);
    assert.equal(JSON.stringify(input), inputSnapshot);
  }
});

test("rejects malformed root, names, code, versions, and collection sizes", () => {
  for (const value of [null, [], "project", 1, false])
    assert.throws(() => validateProject(value), Error);
  for (const extra of [
    { version: 2 },
    { version: null },
    { project: {} },
    { project: "  " },
    { project: "x".repeat(121) },
    { code: {} },
    { code: "x".repeat(100001) },
    { devices: {} },
    { devices: Array.from({ length: 101 }, (_, i) => device(String(i))) },
    { connections: Array(1001).fill({}) },
  ])
    assert.throws(() => validateProject(project(extra)), Error);
});

test("rejects malformed device identity, names, and optional metadata", () => {
  for (const extra of [
    { uid: undefined },
    { uid: {} },
    { uid: " " },
    { uid: "x".repeat(101) },
    { kind: "unknown" },
    { kind: {} },
    { name: {} },
    { name: "" },
    { name: "x".repeat(81) },
    { ip: {} },
    { ip: "x".repeat(16) },
    { notes: {} },
    { notes: "x".repeat(4001) },
    { startup: "UNKNOWN" },
  ])
    assert.throws(
      () =>
        validateProject(project({ devices: [device("plc", "cpu", extra)] })),
      Error,
    );
  assert.throws(
    () => validateProject(project({ devices: [device(), device()] })),
    /unique/,
  );
  assert.throws(() => validateProject(project({ devices: [null] })), Error);
  assert.throws(() => validateProject(project({ devices: Array(1) })), Error);
});

test("rejects malformed, nonfinite, sparse, and out-of-bounds transforms", () => {
  for (const value of [
    undefined,
    {},
    [0, 0],
    [0, 0, 0, 0],
    [0, NaN, 0],
    [0, Infinity, 0],
    [0, -Infinity, 0],
    [0, "1", 0],
    [0, 1001, 0],
    Array(3),
  ]) {
    for (const key of ["pos", "rot"]) {
      assert.throws(
        () =>
          validateProject(
            project({ devices: [device("plc", "cpu", { [key]: value })] }),
          ),
        Error,
      );
    }
  }
  assert.deepEqual(
    validateProject(
      project({ devices: [device("plc", "cpu", { pos: [-1000, 0, 1000] })] }),
    ).devices[0].pos,
    [-1000, 0, 1000],
  );
});

test("validates addressable IPv4 addresses and rejects conflicts", () => {
  for (const ip of [
    "256.1.1.1",
    "192.168.1",
    "192.168.1.1.1",
    "one.two.3.4",
    "192.168.1.-1",
    "192.168.01.1",
    "192.168.1.1 ",
  ]) {
    assert.throws(
      () =>
        validateProject(project({ devices: [device("plc", "cpu", { ip })] })),
      /IPv4/,
    );
  }
  assert.throws(
    () =>
      validateProject(
        project({
          devices: [
            device("plc", "cpu", { ip: "192.168.0.10" }),
            device("drive", "drive", { ip: "192.168.0.10" }),
          ],
        }),
      ),
    /already assigned/,
  );
  const result = validateProject(
    project({
      devices: [
        device("plc", "cpu", { ip: "" }),
        device("panel", "hmi", { ip: "" }),
        device("drive", "drive", { ip: "192.168.0.20" }),
      ],
    }),
  );
  assert.equal(result.devices[2].ip, "192.168.0.20");
});

test("strips passive device IPs and non-CPU startup metadata", () => {
  const input = project({
    devices: ["io", "power", "switch"].map((kind) =>
      device(kind, kind, {
        ip: "192.168.0.10",
        startup: "RUN",
        notes: "Reference",
      }),
    ),
  });
  const result = validateProject(input);
  for (const item of result.devices) {
    assert.equal("ip" in item, false);
    assert.equal("startup" in item, false);
    assert.equal(item.notes, "Reference");
  }
  assert.equal(
    "startup" in
      validateProject(
        project({ devices: [device("drive", "drive", { startup: "RUN" })] }),
      ).devices[0],
    false,
  );
});

test("rejects missing endpoints, self links, unknown types, and identical duplicate links", () => {
  const devices = [device("plc"), device("drive", "drive")];
  for (const connection of [
    { from: {}, to: "drive", type: "Ethernet" },
    { from: "missing", to: "drive", type: "Ethernet" },
    { from: "plc", to: "plc", type: "Ethernet" },
    { from: "plc", to: "drive", type: "Wireless" },
  ])
    assert.throws(
      () => validateProject(project({ devices, connections: [connection] })),
      Error,
    );
  const connection = { from: "plc", to: "drive", type: "PROFINET" };
  assert.throws(
    () =>
      validateProject(
        project({ devices, connections: [connection, { ...connection }] }),
      ),
    /duplicates/,
  );
});

test("Ethernet links allow network-capable endpoints, including unmanaged switches and HMIs", () => {
  for (const kind of ["io", "power"]) {
    assert.throws(
      () =>
        validateProject(
          project({
            devices: [device("plc"), device("other", kind)],
            connections: [{ from: "plc", to: "other", type: "Ethernet" }],
          }),
        ),
      /Ethernet interface/,
    );
  }
  const result = validateProject(
    project({
      devices: [device("switch", "switch"), device("panel", "hmi")],
      connections: [{ from: "switch", to: "panel", type: "Ethernet" }],
    }),
  );
  assert.equal(result.connections[0].type, "Ethernet");
  for (const type of ["24 V DC", "Digital signal", "Analog signal"]) {
    assert.equal(
      validateProject(
        project({
          devices: [device("power", "power"), device("io", "io")],
          connections: [{ from: "power", to: "io", type }],
        }),
      ).connections[0].type,
      type,
    );
  }
});

test("PROFINET IO relationships require a CPU source and CPU or drive destination", () => {
  for (const kind of ["io", "power", "hmi", "switch"]) {
    assert.throws(
      () =>
        validateProject(
          project({
            devices: [device("plc"), device("other", kind)],
            connections: [{ from: "plc", to: "other", type: "PROFINET" }],
          }),
        ),
      /PROFINET IO/,
    );
  }
  assert.throws(
    () =>
      validateProject(
        project({
          devices: [device("plc"), device("drive", "drive")],
          connections: [{ from: "drive", to: "plc", type: "PROFINET" }],
        }),
      ),
    /PROFINET IO/,
  );
  for (const kind of ["cpu", "drive"]) {
    assert.equal(
      validateProject(
        project({
          devices: [device("plc"), device("other", kind)],
          connections: [{ from: "plc", to: "other", type: "PROFINET" }],
        }),
      ).connections[0].type,
      "PROFINET",
    );
  }
});

test("multiple CPUs have separate programs, selected controller, and STOP startup defaults", () => {
  const input = project({
    devices: [device("first"), device("second"), device("third")],
    programs: {
      first: "First unfinished program",
      second: "Second unfinished program",
    },
    controllerUid: "second",
  });
  const result = validateProject(input);
  assert.deepEqual(result.programs, {
    first: "First unfinished program",
    second: "Second unfinished program",
    third: "",
  });
  assert.equal(result.controllerUid, "second");
  assert.equal(
    result.devices.every((device) => device.startup === "STOP"),
    true,
  );
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(result))), result);
  const legacy = validateProject(
    project({ devices: [device("first"), device("second")] }),
  );
  assert.deepEqual(legacy.programs, { first: legacy.code, second: "" });
  assert.equal(legacy.controllerUid, "first");
});

test("rejects malformed controller programs and selected controller references", () => {
  for (const programs of [
    null,
    [],
    "program",
    new Date(),
    { plc: {} },
    { plc: "x".repeat(100001) },
    { missing: "source" },
    { drive: "source" },
  ]) {
    assert.throws(
      () =>
        validateProject(
          project({
            devices: [device("plc"), device("drive", "drive")],
            programs,
          }),
        ),
      Error,
    );
  }
  for (const controllerUid of [null, {}, "missing", "drive", "x".repeat(101)]) {
    assert.throws(
      () =>
        validateProject(
          project({
            devices: [device("plc"), device("drive", "drive")],
            controllerUid,
          }),
        ),
      Error,
    );
  }
  assert.equal(
    validateProject(project({ controllerUid: "" })).controllerUid,
    "",
  );
  const withoutCpu = validateProject(
    project({ devices: [device("drive", "drive")] }),
  );
  assert.equal(withoutCpu.controllerUid, "");
  assert.deepEqual(withoutCpu.programs, {});
});

test("controller program maps stay independent and safely handle object-property IDs", () => {
  const programs = Object.fromEntries([["__proto__", "Unfinished program"]]);
  const input = deepFreeze(
    project({ devices: [device("__proto__")], programs }),
  );
  const result = validateProject(input);
  assert.equal(Object.hasOwn(result.programs, "__proto__"), true);
  assert.equal(result.programs.__proto__, "Unfinished program");
  assert.equal(Object.getPrototypeOf(result.programs), Object.prototype);
  assert.notEqual(result.programs, input.programs);
  result.programs.__proto__ = "changed";
  assert.equal(input.programs.__proto__, "Unfinished program");
});

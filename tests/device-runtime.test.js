import test from "node:test";
import assert from "node:assert/strict";
import { stepDeviceStates, channelLayout } from "../src/device-runtime.js";
import { compileProgram, executeScan } from "../src/simulation.js";
import { validateProject } from "../src/project.js";

const device = (uid, kind, simulation = {}) => ({
  uid,
  kind,
  name: uid,
  pos: [0, 0, 0],
  rot: [0, 0, 0],
  simulation,
});
const cpu = device("plc", "cpu");
const frame = (devices, extra = {}) => ({
  devices,
  connections: [],
  controllerUid: "plc",
  running: true,
  inputs: Array(14).fill(false),
  outputs: Array(10).fill(false),
  ...extra,
});

test("an assigned expansion module adds real interpreter channels and separate CPU maps", () => {
  const io = device("io", "io", { controllerUid: "plc" });
  const other = device("other", "cpu");
  const devices = [cpu, io, other];
  const layout = channelLayout(devices, "plc");
  assert.equal(layout.inputCount, 22);
  assert.equal(layout.outputCount, 18);
  assert.equal(channelLayout(devices, "other").inputCount, 14);
  assert.deepEqual(channelLayout([device("unassigned", "io")], "").modules, []);
  const compiled = compileProgram("%Q1.2 := %I1.6; %Q2.1 := %I2.5;", layout);
  assert.equal(compiled.valid, true);
  const inputs = Array(22).fill(false);
  inputs[14] = true;
  inputs[21] = true;
  const outputs = executeScan(compiled, inputs);
  const state = stepDeviceStates(frame(devices, { inputs, outputs }));
  assert.equal(state.io.inputs[0], true);
  assert.equal(state.io.inputs[7], true);
  assert.equal(state.io.outputs[0], true);
  assert.equal(state.io.outputs[7], true);
  assert.equal(state.plc.outputs.length, 10);
  assert.equal(state.other.running, false);
  const stopped = stepDeviceStates(frame(devices, { running: false, outputs }));
  assert.equal(stopped.io.outputs.some(Boolean), false);
});

test("drive ramps only for a powered, running controller with assigned IO and enable bit", () => {
  const drive = device("drive", "drive", {
    frequency: 40,
    ramp: 2,
    enableOutput: 1,
  });
  const outputs = [false, true];
  const input = frame([cpu, drive], {
    outputs,
    connections: [
      { from: "plc", to: "drive", type: "PROFINET" },
      { from: "plc", to: "drive", type: "Ethernet" },
    ],
  });
  let state = stepDeviceStates(input);
  assert.equal(state.drive.enabled, true);
  assert.equal(state.drive.frequency, 2.5);
  for (let i = 0; i < 30; i++) state = stepDeviceStates(input, state);
  assert.equal(state.drive.frequency, 40);
  const snapshot = JSON.stringify(state);
  const coast = stepDeviceStates({ ...input, running: false }, state);
  assert.equal(coast.drive.frequency, 37.5);
  assert.equal(JSON.stringify(state), snapshot);
  for (const extra of [
    { connections: [] },
    { outputs: [] },
    { devices: [device("plc", "cpu", { powered: false }), drive] },
  ]) {
    assert.equal(stepDeviceStates({ ...input, ...extra }).drive.enabled, false);
  }
  assert.equal(
    stepDeviceStates(
      {
        ...input,
        devices: [cpu, device("drive", "drive", { powered: false })],
      },
      state,
    ).drive.frequency,
    0,
  );
});

test("HMI follows Ethernet paths through powered switches and loses tags when disconnected", () => {
  const sw = device("switch", "switch"),
    hmi = device("panel", "hmi");
  const connections = [
    { from: "plc", to: "switch", type: "Ethernet" },
    { from: "switch", to: "panel", type: "Ethernet" },
  ];
  const input = frame([cpu, sw, hmi], { connections, outputs: [true] });
  const state = stepDeviceStates(input);
  assert.equal(state.panel.connected, true);
  assert.equal(state.panel.outputs[0], true);
  assert.deepEqual(state.switch.ports, [true, true]);
  const disconnected = stepDeviceStates({
    ...input,
    devices: [cpu, device("switch", "switch", { powered: false }), hmi],
  });
  assert.equal(disconnected.panel.connected, false);
  assert.deepEqual(disconnected.panel.outputs, []);
  assert.equal(disconnected.switch.ports.some(Boolean), false);
  assert.equal(
    stepDeviceStates({
      ...input,
      connections: [{ from: "plc", to: "panel", type: "PROFINET" }],
    }).panel.connected,
    false,
  );
});

test("supply load trip and reset are bounded teaching states", () => {
  const power = (config) =>
    stepDeviceStates(frame([device("psu", "power", config)])).psu;
  assert.equal(power({ voltage: 24, load: 2.5 }).watts, 60);
  assert.equal(power({ load: 2.6 }).overload, true);
  assert.equal(power({ load: 2.6 }).voltage, 0);
  assert.equal(power({ load: 2.4 }).status, "DC OK");
  assert.equal(power({ powered: false }).load, 0);
});

test("saved model settings round-trip and reject invalid ranges and missing module controllers", () => {
  const project = (devices) => ({
    project: "Model lab",
    version: 1,
    devices,
    code: "",
    connections: [],
  });
  const source = project([
    cpu,
    device("io", "io", { controllerUid: "plc" }),
    device("drive", "drive", { ramp: 4, frequency: 23 }),
  ]);
  const validated = validateProject(source);
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(validated))),
    validated,
  );
  for (const [kind, config] of [
    ["drive", { ramp: 0 }],
    ["drive", { frequency: NaN }],
    ["drive", { enableOutput: 1.5 }],
    ["power", { voltage: 99 }],
    ["cpu", { powered: "false" }],
    ["io", { controllerUid: "missing" }],
  ]) {
    assert.throws(() =>
      validateProject(project([cpu, device("bad", kind, config)])),
    );
  }
  assert.throws(
    () =>
      validateProject(
        project([
          cpu,
          ...Array.from({ length: 9 }, (_, i) =>
            device(`io${i}`, "io", { controllerUid: "plc" }),
          ),
        ]),
      ),
    /eight/,
  );
});

test("upstream supply loss and overload remove controller, backplane and HMI power", () => {
  const io = device("io", "io", { controllerUid: "plc" });
  const hmi = device("hmi", "hmi");
  const links = [
    { from: "psu", to: "plc", type: "24 V DC" },
    { from: "psu", to: "hmi", type: "24 V DC" },
    { from: "plc", to: "hmi", type: "Ethernet" },
  ];
  for (const config of [{ powered: false }, { load: 3 }]) {
    const state = stepDeviceStates(
      frame([device("psu", "power", config), cpu, io, hmi], {
        connections: links,
        outputs: [true],
      }),
    );
    assert.equal(state.plc.powered, false);
    assert.equal(state.plc.running, false);
    assert.equal(state.plc.outputs.some(Boolean), false);
    assert.equal(state.io.powered, false);
    assert.equal(state.hmi.connected, false);
  }
  const recovered = stepDeviceStates(
    frame([device("psu", "power", { load: 2 }), cpu, io, hmi], {
      connections: links,
      outputs: [true],
    }),
  );
  assert.equal(recovered.plc.running, true);
  assert.equal(recovered.io.powered, true);
  assert.equal(recovered.hmi.connected, true);
});

test("logical drive assignment requires a powered physical Ethernet path", () => {
  const sw = device("switch", "switch"),
    drive = device("drive", "drive");
  const assignment = { from: "plc", to: "drive", type: "PROFINET" };
  const links = [
    assignment,
    { from: "plc", to: "switch", type: "Ethernet" },
    { from: "switch", to: "drive", type: "Ethernet" },
  ];
  const input = frame([cpu, sw, drive], {
    connections: links,
    outputs: [true],
  });
  assert.equal(stepDeviceStates(input).drive.enabled, true);
  assert.equal(
    stepDeviceStates({ ...input, connections: [assignment] }).drive.status,
    "Network disconnected",
  );
  assert.equal(
    stepDeviceStates({
      ...input,
      devices: [cpu, device("switch", "switch", { powered: false }), drive],
    }).drive.enabled,
    false,
  );
});

test("single-port endpoints cannot act as transit switches and cyclic power links fail closed", () => {
  const other = device("other", "cpu"),
    hmi = device("panel", "hmi");
  const state = stepDeviceStates(
    frame([cpu, other, hmi], {
      connections: [
        { from: "plc", to: "other", type: "Ethernet" },
        { from: "other", to: "panel", type: "Ethernet" },
      ],
    }),
  );
  assert.equal(state.panel.connected, false);
  const cycle = stepDeviceStates(
    frame([cpu, other], {
      connections: [
        { from: "plc", to: "other", type: "24 V DC" },
        { from: "other", to: "plc", type: "24 V DC" },
      ],
    }),
  );
  assert.equal(cycle.plc.powered, false);
  assert.equal(cycle.other.powered, false);
});

test("CPU analog readings are bounded sensor settings and disappear on power loss", () => {
  const model = device("plc", "cpu", { analog0: 3.2, analog1: 10 });
  const source = {
    project: "Sensors",
    code: "",
    devices: [model],
    connections: [],
  };
  const project = validateProject(source);
  assert.deepEqual(
    stepDeviceStates(frame(project.devices)).plc.analog,
    [3.2, 10],
  );
  assert.deepEqual(
    stepDeviceStates(
      frame([device("plc", "cpu", { powered: false, analog0: 3.2 })]),
    ).plc.analog,
    [0, 0],
  );
  for (const value of [-1, 10.1, NaN])
    assert.throws(() =>
      validateProject({
        ...source,
        devices: [device("plc", "cpu", { analog0: value })],
      }),
    );
});

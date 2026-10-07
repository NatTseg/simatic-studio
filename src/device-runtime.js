// Educational device states. These rules do not execute device firmware or solve wiring.
export const simulationDefaults = {
  cpu: { powered: true },
  io: { powered: true, controllerUid: "" },
  power: { powered: true, voltage: 24, load: 0.8 },
  drive: { powered: true, frequency: 35, ramp: 3, enableOutput: 0 },
  hmi: { powered: true },
  switch: { powered: true },
};

export function settings(device) {
  return { ...simulationDefaults[device.kind], ...device.simulation };
}

export function channelLayout(devices, controllerUid) {
  const modules = devices
    .filter(
      (d) =>
        !!controllerUid &&
        d.kind === "io" &&
        settings(d).controllerUid === controllerUid,
    )
    .slice(0, 8);
  return {
    inputCount: controllerUid ? 14 + modules.length * 8 : 0,
    outputCount: controllerUid ? 10 + modules.length * 8 : 0,
    modules: modules.map((d, i) => ({
      uid: d.uid,
      inputStart: 14 + i * 8,
      outputStart: 10 + i * 8,
    })),
  };
}

export function stepDeviceStates(
  { devices, connections, controllerUid, running, inputs, outputs },
  previous = {},
  dt = 0.1,
) {
  const byId = new Map(devices.map((d) => [d.uid, d]));
  const layout = channelLayout(devices, controllerUid);
  const controllerActive =
    running && settings(byId.get(controllerUid) || { kind: "cpu" }).powered;
  const result = {};
  for (const d of devices) {
    const config = settings(d);
    const state = {
      powered: config.powered,
      status: config.powered ? "Ready" : "Power off",
    };
    if (d.kind === "cpu") {
      state.running = controllerActive && d.uid === controllerUid;
      state.status = !state.powered
        ? "Power off"
        : state.running
          ? "RUN"
          : "STOP";
      state.inputs =
        state.powered && d.uid === controllerUid
          ? inputs.slice(0, 14)
          : Array(14).fill(false);
      state.outputs = state.running
        ? outputs.slice(0, 10)
        : Array(10).fill(false);
    } else if (d.kind === "io") {
      const mapping = layout.modules.find((m) => m.uid === d.uid);
      state.attached = !!mapping;
      state.running = state.powered && !!mapping && controllerActive;
      state.inputs =
        mapping && state.powered
          ? inputs.slice(mapping.inputStart, mapping.inputStart + 8)
          : Array(8).fill(false);
      state.outputs = state.running
        ? outputs.slice(mapping.outputStart, mapping.outputStart + 8)
        : Array(8).fill(false);
      state.status = !state.powered
        ? "Power off"
        : mapping
          ? "Backplane assigned"
          : "Assign a controller";
    } else if (d.kind === "power") {
      state.overload = state.powered && config.load > 2.5;
      state.voltage = state.powered && !state.overload ? config.voltage : 0;
      state.load = state.powered ? config.load : 0;
      state.watts = state.voltage * state.load;
      state.status = !state.powered
        ? "Power off"
        : state.overload
          ? "Overload · demo trip"
          : "DC OK";
    } else if (d.kind === "drive") {
      const assigned = connections.some(
        (c) =>
          c.from === controllerUid && c.to === d.uid && c.type === "PROFINET",
      );
      state.enabled =
        state.powered &&
        controllerActive &&
        assigned &&
        !!outputs[config.enableOutput];
      const target = state.enabled ? config.frequency : 0;
      const before = previous[d.uid]?.frequency || 0;
      const delta = (50 * Math.max(0, Math.min(dt, 0.5))) / config.ramp;
      state.frequency = state.powered
        ? before +
          Math.sign(target - before) *
            Math.min(Math.abs(target - before), delta)
        : 0;
      state.target = target;
      state.status = !state.powered
        ? "Power off"
        : !assigned
          ? "Assign PROFINET IO"
          : state.enabled
            ? "Running"
            : state.frequency > 0
              ? "Ramping down"
              : "Ready";
    } else if (d.kind === "switch") {
      state.links = connections.filter(
        (c) => c.type === "Ethernet" && (c.from === d.uid || c.to === d.uid),
      );
      state.ports = state.links
        .slice(0, 5)
        .map(
          (c) =>
            state.powered &&
            settings(byId.get(c.from === d.uid ? c.to : c.from)).powered,
        );
      state.overflow = state.links.length > 5;
      state.status = !state.powered
        ? "Power off"
        : state.overflow
          ? "Port capacity exceeded"
          : `${state.ports.filter(Boolean).length} / 5 links`;
    } else if (d.kind === "hmi") {
      // Connectivity is computed from physical Ethernet links, including switches.
      const reached = new Set([d.uid]);
      for (let pass = 0; pass < devices.length; pass++) {
        let changed = false;
        for (const c of connections.filter((c) => c.type === "Ethernet")) {
          if (
            !settings(byId.get(c.from)).powered ||
            !settings(byId.get(c.to)).powered
          )
            continue;
          if (reached.has(c.from) && !reached.has(c.to)) {
            reached.add(c.to);
            changed = true;
          }
          if (reached.has(c.to) && !reached.has(c.from)) {
            reached.add(c.from);
            changed = true;
          }
        }
        if (!changed) break;
      }
      state.connected = state.powered && reached.has(controllerUid);
      state.running = state.connected && controllerActive;
      state.inputs = state.connected ? inputs.slice(0, 14) : [];
      state.outputs = state.running ? outputs.slice(0, 10) : [];
      state.status = !state.powered
        ? "Power off"
        : state.connected
          ? state.running
            ? "PLC RUN"
            : "PLC STOP"
          : "No PLC Ethernet path";
    }
    result[d.uid] = state;
  }
  return result;
}

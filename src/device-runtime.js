// Educational device states. These rules do not execute device firmware or solve wiring.
export const simulationDefaults = {
  cpu: { powered: true, analog0: 0, analog1: 0 },
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

// A connected supply owns the 24 V control power; unconnected devices use their
// local bench supply. These are project fault-injection rules, not circuit solving.
export function powerAvailable(devices, connections, uid, visited = new Set()) {
  const d = devices.find((item) => item.uid === uid);
  if (!d || !settings(d).powered || visited.has(uid)) return false;
  visited.add(uid);
  if (d.kind === "power") return settings(d).load <= 2.5;
  const feeders = connections.filter(
    (c) => c.type === "24 V DC" && c.to === uid,
  );
  if (feeders.length)
    return feeders.some((c) =>
      powerAvailable(devices, connections, c.from, new Set(visited)),
    );
  if (d.kind === "io" && settings(d).controllerUid)
    return powerAvailable(
      devices,
      connections,
      settings(d).controllerUid,
      visited,
    );
  return true;
}

export const portCapacity = { cpu: 1, drive: 2, hmi: 1, switch: 5 };

export function ethernetPath(devices, connections, from, to) {
  if (
    !from ||
    !to ||
    !powerAvailable(devices, connections, from) ||
    !powerAvailable(devices, connections, to)
  )
    return false;
  const byId = new Map(devices.map((d) => [d.uid, d]));
  const reached = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const uid = queue.shift();
    if (uid === to) return true;
    // Only switches and the drive's integrated two-port interface forward links.
    if (uid !== from && !["switch", "drive"].includes(byId.get(uid)?.kind))
      continue;
    for (const c of connections.filter(
      (c) => c.type === "Ethernet" && (c.from === uid || c.to === uid),
    )) {
      const peer = c.from === uid ? c.to : c.from;
      if (!reached.has(peer) && powerAvailable(devices, connections, peer)) {
        reached.add(peer);
        queue.push(peer);
      }
    }
  }
  return false;
}

export function stepDeviceStates(
  { devices, connections, controllerUid, running, inputs, outputs },
  previous = {},
  dt = 0.1,
) {
  const byId = new Map(devices.map((d) => [d.uid, d]));
  const layout = channelLayout(devices, controllerUid);
  const controllerActive =
    running && powerAvailable(devices, connections, controllerUid);
  const result = {};
  for (const d of devices) {
    const config = settings(d);
    const state = {
      powered:
        d.kind === "power"
          ? config.powered
          : powerAvailable(devices, connections, d.uid),
      status: config.powered ? "Ready" : "Power off",
    };
    if (d.kind === "cpu") {
      state.analog = state.powered ? [config.analog0, config.analog1] : [0, 0];
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
        ethernetPath(devices, connections, controllerUid, d.uid) &&
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
          : !ethernetPath(devices, connections, controllerUid, d.uid)
            ? "Network disconnected"
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
            powerAvailable(
              devices,
              connections,
              c.from === d.uid ? c.to : c.from,
            ),
        );
      state.overflow = state.links.length > 5;
      state.status = !state.powered
        ? "Power off"
        : state.overflow
          ? "Port capacity exceeded"
          : `${state.ports.filter(Boolean).length} / 5 links`;
    } else if (d.kind === "hmi") {
      state.connected = ethernetPath(
        devices,
        connections,
        d.uid,
        controllerUid,
      );
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
    result[d.uid] =
      JSON.stringify(state) === JSON.stringify(previous[d.uid])
        ? previous[d.uid]
        : state;
  }
  return result;
}

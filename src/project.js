const DEVICE_KINDS = new Set(["cpu", "io", "power", "drive", "hmi", "switch"]);
const ADDRESSABLE_KINDS = new Set(["cpu", "drive", "hmi"]);
const ETHERNET_KINDS = new Set(["cpu", "drive", "hmi", "switch"]);
const CONNECTION_TYPES = new Set([
  "PROFINET",
  "Ethernet",
  "24 V DC",
  "Digital signal",
  "Analog signal",
]);

function fail(path, reason) {
  throw new Error(`${path}: ${reason}`);
}

function record(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
}

function string(value, path, limit, nonempty = false) {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (nonempty && !value.trim())
  ) {
    fail(
      path,
      `must be ${nonempty ? "a nonempty" : "a"} string of at most ${limit} characters`,
    );
  }
  return value;
}

function vector(value, path) {
  if (!Array.isArray(value) || value.length !== 3) {
    fail(path, "must contain exactly three numbers");
  }
  const result = Array.from(value);
  if (
    !result.every(
      (number) =>
        typeof number === "number" &&
        Number.isFinite(number) &&
        Math.abs(number) <= 1000,
    )
  ) {
    fail(path, "must contain finite numbers between -1000 and 1000");
  }
  return result;
}

function ipv4(value, path) {
  if (!value) return value;
  const octets = value.split(".");
  if (
    octets.length !== 4 ||
    !octets.every(
      (octet) => /^(0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255,
    )
  ) {
    fail(path, "must be an IPv4 address or an empty string");
  }
  return value;
}

/** Validate an entire project before returning a fresh, normalized state object. */
export function validateProject(payload) {
  record(payload, "Project");
  if (payload.version !== undefined && payload.version !== 1) {
    fail("Project version", "only version 1 is supported");
  }
  const project = string(payload.project, "Project name", 120, true);
  const code = string(payload.code, "Program", 100000);
  if (!Array.isArray(payload.devices) || payload.devices.length > 100) {
    fail("Devices", "must be an array of at most 100 devices");
  }

  const ids = new Set();
  const addresses = new Set();
  const devices = Array.from(payload.devices, (device, index) => {
    const path = `Device ${index + 1}`;
    record(device, path);
    const uid = string(device.uid, `${path} ID`, 100, true);
    if (ids.has(uid)) fail(`${path} ID`, "must be unique");
    ids.add(uid);
    if (!DEVICE_KINDS.has(device.kind)) fail(`${path} kind`, "is unsupported");

    const result = {
      uid,
      kind: device.kind,
      name: string(device.name, `${path} name`, 80, true),
      pos: vector(device.pos, `${path} position`),
      rot: vector(device.rot, `${path} rotation`),
    };
    if (device.ip !== undefined) {
      const address = string(device.ip, `${path} IP address`, 15);
      if (ADDRESSABLE_KINDS.has(device.kind)) {
        result.ip = ipv4(address, `${path} IP address`);
        if (result.ip && addresses.has(result.ip))
          fail(`${path} IP address`, "is already assigned");
        if (result.ip) addresses.add(result.ip);
      }
    }
    if (device.kind === "cpu") {
      const startup = device.startup === undefined ? "STOP" : device.startup;
      if (startup !== "RUN" && startup !== "STOP") {
        fail(`${path} startup`, "must be RUN or STOP");
      }
      result.startup = startup;
    }
    if (device.notes !== undefined) {
      result.notes = string(device.notes, `${path} notes`, 4000);
    }
    return result;
  });

  const rawConnections =
    payload.connections === undefined ? [] : payload.connections;
  if (!Array.isArray(rawConnections) || rawConnections.length > 1000) {
    fail("Connections", "must be an array of at most 1000 connections");
  }
  const deviceById = new Map(devices.map((device) => [device.uid, device]));
  const links = new Set();
  const connections = Array.from(rawConnections, (connection, index) => {
    const path = `Connection ${index + 1}`;
    record(connection, path);
    const from = string(connection.from, `${path} source`, 100, true);
    const to = string(connection.to, `${path} destination`, 100, true);
    if (!ids.has(from) || !ids.has(to))
      fail(path, "must reference existing devices");
    if (from === to) fail(path, "cannot connect a device to itself");
    if (!CONNECTION_TYPES.has(connection.type))
      fail(`${path} type`, "is unsupported");
    if (connection.type === "PROFINET") {
      const sourceKind = deviceById.get(from).kind;
      const destinationKind = deviceById.get(to).kind;
      if (
        sourceKind !== "cpu" ||
        (destinationKind !== "cpu" && destinationKind !== "drive")
      ) {
        fail(
          path,
          "PROFINET IO must connect a CPU controller to a CPU or drive endpoint",
        );
      }
    } else if (connection.type === "Ethernet") {
      if (
        !ETHERNET_KINDS.has(deviceById.get(from).kind) ||
        !ETHERNET_KINDS.has(deviceById.get(to).kind)
      ) {
        fail(path, "both endpoints must have an Ethernet interface");
      }
    }
    const key = JSON.stringify([from, to, connection.type]);
    if (links.has(key)) fail(path, "duplicates an existing connection");
    links.add(key);
    return { from, to, type: connection.type };
  });

  const cpus = devices.filter((device) => device.kind === "cpu");
  const firstCpuUid = cpus[0]?.uid || "";
  let programs;
  if (payload.programs === undefined) {
    programs = Object.fromEntries(
      cpus.map((device, index) => [device.uid, index === 0 ? code : ""]),
    );
  } else {
    record(payload.programs, "Controller programs");
    const prototype = Object.getPrototypeOf(payload.programs);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("Controller programs", "must be a plain object");
    }
    const supplied = new Map(
      Object.entries(payload.programs).map(([uid, source]) => {
        if (deviceById.get(uid)?.kind !== "cpu") {
          fail("Controller programs", "must reference existing CPU IDs");
        }
        return [uid, string(source, `Controller ${uid} program`, 100000)];
      }),
    );
    programs = Object.fromEntries(
      cpus.map((device) => [device.uid, supplied.get(device.uid) ?? ""]),
    );
  }
  const controllerUid =
    payload.controllerUid === undefined
      ? firstCpuUid
      : string(payload.controllerUid, "Selected controller", 100);
  if (controllerUid && deviceById.get(controllerUid)?.kind !== "cpu") {
    fail(
      "Selected controller",
      "must reference an existing CPU ID or be empty",
    );
  }

  return {
    version: 1,
    project,
    devices,
    connections,
    code,
    programs,
    controllerUid,
  };
}

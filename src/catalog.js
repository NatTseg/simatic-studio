const specifications = [
  {
    id: "cpu",
    name: "CPU 1214C",
    family: "SIMATIC S7-1200",
    type: "Controller",
    order: "6ES7214-1AG40-0XB0",
    w: 1.15,
    color: "#8faaa9",
    io: "14 DI / 10 DO / 2 AI",
    power: "24 V DC",
    manual: "https://support.industry.siemens.com/cs/document/109478121",
    desc: "Compact controller for small to medium automation tasks.",
  },
  {
    id: "io",
    name: "SM 1223",
    family: "SIMATIC S7-1200",
    type: "I/O module",
    order: "6ES7223-1BH32-0XB0",
    w: 0.58,
    color: "#a2b1af",
    io: "8 DI / 8 DO",
    power: "24 V DC",
    manual: "https://support.industry.siemens.com/cs/document/109478121",
    desc: "Digital input and output expansion for the S7-1200.",
  },
  {
    id: "power",
    name: "SITOP PSU100C",
    family: "SITOP",
    type: "Power supply",
    order: "6EP1332-5BA00",
    w: 0.65,
    color: "#b4c1ba",
    io: "24 V / 2.5 A",
    power: "120–230 V AC",
    manual: "https://support.industry.siemens.com",
    desc: "Compact regulated DC power supply for industrial applications.",
  },
  {
    id: "drive",
    name: "SINAMICS G120C",
    family: "SINAMICS",
    type: "Drive",
    order: "6SL3210-1KE12-3UF2",
    w: 0.9,
    color: "#a9b0b3",
    io: "PROFINET",
    power: "3 AC 380–480 V",
    manual: "https://support.industry.siemens.com",
    desc: "Compact frequency converter for variable speed motor control.",
  },
  {
    id: "hmi",
    name: "KTP700 Basic",
    family: "SIMATIC HMI",
    type: "HMI panel",
    order: "6AV2123-2GB03-0AX0",
    w: 1.5,
    color: "#afb8b8",
    io: "7” touch display",
    power: "24 V DC",
    manual: "https://support.industry.siemens.com",
    desc: "Basic operator panel for visualization and machine operation.",
  },
  {
    id: "switch",
    name: "SCALANCE XB005",
    family: "SCALANCE",
    type: "Network",
    order: "6GK5005-0BA00-1AB2",
    w: 0.5,
    color: "#a0b2b6",
    io: "5 × RJ45",
    power: "24 V DC",
    manual: "https://support.industry.siemens.com",
    desc: "Unmanaged Industrial Ethernet switch.",
  },
];
export const initial = [
  {
    uid: "1",
    kind: "power",
    pos: [-1.8, 0, 0],
    rot: [0, 0, 0],
    name: "Power supply",
    ip: "",
  },
  {
    uid: "2",
    kind: "cpu",
    pos: [-0.7, 0, 0],
    rot: [0, 0, 0],
    name: "PLC_1",
    ip: "192.168.0.10",
  },
  {
    uid: "3",
    kind: "io",
    pos: [0.25, 0, 0],
    rot: [0, 0, 0],
    name: "Digital I/O",
    ip: "",
  },
  {
    uid: "4",
    kind: "drive",
    pos: [1.35, 0, 0],
    rot: [0, 0, 0],
    name: "Drive_1",
    ip: "192.168.0.20",
  },
];

const capabilities = {
  cpu: {
    dimensions: [110, 100, 75],
    interface: "PROFINET IO controller / device · 1 RJ45",
    reference:
      "24 V DC nominal; 20.4–28.8 V input. 14 DI, 10 transistor DO, 2 AI (0–10 V). Datasheet firmware reference V4.7; firmware is not emulated.",
    sourcePage: "1, 3–4, 7",
    sourceDate: "2026-09-28",
  },
  io: {
    dimensions: [45, 100, 75],
    interface: "S7-1200 backplane · no Ethernet",
    reference:
      "8 DI at 24 V DC and 8 transistor DO, 0.5 A per output. Process addresses are assigned in the controller project; this module has no IP address.",
    sourcePage: "1, 3",
    sourceDate: "2026-09-28",
  },
  power: {
    dimensions: [45, 80, 100],
    interface: "L / N / PE input; + / − DC output",
    reference:
      "24 V DC / 2.5 A / 60 W output; 22.2–26.4 V physical potentiometer adjustment. AC input table: 100–230 V nominal, 85–264 V permissible; product description lists 120–230 V AC.",
    sourcePage: "1–3",
    sourceDate: "2026-10-02",
  },
  drive: {
    dimensions: [73, 173, 160],
    interface: "PROFINET-PN · 6 DI / 2 DO / 1 AI / 1 AO",
    reference:
      "3 AC 380–480 V input. Rated 0.75 kW at low overload / 0.55 kW at high overload. Drive control, faults, motor dynamics and commissioning are not simulated.",
    sourcePage: "1",
    sourceDate: "2026-10-07",
  },
  hmi: {
    dimensions: [214, 158, 39],
    interface: "Industrial Ethernet · S7 communication",
    reference:
      "7-inch panel, 24 V DC. PROFINET network support; no PROFINET IO protocol endpoint. Front housing 214 × 158 mm; 39 mm is mounting depth, not verified full housing depth.",
    sourcePage: "1–2, 6–7",
    sourceDate: "2026-09-28",
  },
  switch: {
    dimensions: [45, 100, 87],
    interface: "5 × RJ45 · 10/100 Mbit/s · unmanaged",
    reference:
      "24 V AC/DC supply. Ethernet frame switching; no management IP, Web/SNMP/PROFINET diagnostics or cyclic PROFINET IO endpoint.",
    sourcePage: "1–2; operating manual p. 14",
    sourceDate: "2026-10-02",
  },
};
export const catalog = specifications.map((device) => ({
  ...device,
  ...capabilities[device.id],
  w: capabilities[device.id].dimensions[0] / 100,
  h: capabilities[device.id].dimensions[1] / 100,
  depth: capabilities[device.id].dimensions[2] / 100,
  addressable: ["cpu", "drive", "hmi"].includes(device.id),
  ethernet: ["cpu", "drive", "hmi", "switch"].includes(device.id),
  power: device.id === "switch" ? "24 V AC/DC" : device.power,
  datasheet:
    "https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=" +
    device.order +
    "&language=en&caller=SIOS",
  manual:
    device.id === "switch"
      ? "https://cache.industry.siemens.com/dl/files/806/32983806/att_1092422/v1/BA_SCALANCE-XB-000_76.pdf"
      : device.manual,
}));

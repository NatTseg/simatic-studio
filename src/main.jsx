import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Line,
  TransformControls,
  ContactShadows,
} from "@react-three/drei";
import {
  Box,
  Layers,
  Network,
  Code2,
  BookOpen,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings2,
  Play,
  Square,
  Save,
  Upload,
  Download,
  RotateCcw,
  Maximize,
  Move,
  Rotate3D,
  Trash2,
  Check,
  ArrowUpRight,
  Activity,
  FolderOpen,
  SlidersHorizontal,
  PanelLeftClose,
  Copy,
  X,
  Focus,
  Ruler,
  Tags,
  MousePointer2,
  Cable,
  ScanLine,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import { catalog, initial } from "./catalog.js";
import { validateProject } from "./project.js";
import { compileProgram, executeScan } from "./simulation.js";
import { Device, DeviceThumbnail } from "./device-models.jsx";
import { CameraRig, DinRail } from "./scene.jsx";
import { SimulationPanel } from "./simulation-panel.jsx";
import { channelLayout, settings, stepDeviceStates } from "./device-runtime.js";
const DEFAULT_PROGRAM =
  '// Boolean scan · CPU 1214C built-in channels\n// I0.0 start; I0.1 enable; I0.2 interlock\n"Q0.0" := "I0.0";\n"Q0.1" := "I0.1" AND NOT "I0.2";';
const channelAddress = (prefix, index) =>
  `${prefix}${Math.floor(index / 8)}.${index % 8}`;
function initialProject() {
  return validateProject({
    version: 1,
    project: "Conveyor control system",
    devices: initial,
    connections: [
      { from: "1", to: "2", type: "24 V DC" },
      { from: "2", to: "4", type: "PROFINET" },
      { from: "2", to: "5", type: "Ethernet" },
      { from: "5", to: "4", type: "Ethernet" },
      { from: "5", to: "6", type: "Ethernet" },
    ],
    code: DEFAULT_PROGRAM,
  });
}
function App() {
  const [saved] = useState(() => {
    try {
      const stored = localStorage.getItem("simatic-project");
      return {
        data: stored ? validateProject(JSON.parse(stored)) : initialProject(),
        error: null,
      };
    } catch (error) {
      return {
        data: initialProject(),
        error: "Saved project could not be loaded: " + error.message,
      };
    }
  });
  const [devices, setDevices] = useState(saved.data.devices),
    [selected, setSelected] = useState(
      saved.data.devices.find((x) => x.kind === "cpu")?.uid ||
        saved.data.devices[0]?.uid,
    ),
    [tab, setTab] = useState("Assembly"),
    [filter, setFilter] = useState("All devices"),
    [query, setQuery] = useState(""),
    [inspector, setInspector] = useState("Properties"),
    [running, setRunning] = useState(false),
    [mode, setMode] = useState("select"),
    [toast, setToast] = useState(saved.error || ""),
    [modal, setModal] = useState(null),
    [connections, setConnections] = useState(saved.data.connections),
    [programs, setPrograms] = useState(saved.data.programs),
    [controllerUid, setControllerUid] = useState(saved.data.controllerUid),
    [inputs, setInputs] = useState(Array(14).fill(false)),
    [outputs, setOutputs] = useState(Array(10).fill(false)),
    [cycles, setCycles] = useState(0),
    [project, setProject] = useState(saved.data.project),
    [grid, setGrid] = useState(true),
    [libraryOpen, setLibraryOpen] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [dimensions, setDimensions] = useState(false),
    [labels, setLabels] = useState(true),
    [expanded, setExpanded] = useState(false),
    [wires, setWires] = useState(true),
    [cameraCommand, setCameraCommand] = useState({ action: "fit", id: 0 }),
    [deviceStates, setDeviceStates] = useState({});
  const fileRef = useRef(),
    selectedObject = useRef(),
    toastTimer = useRef(),
    assemblyObject = useRef(),
    orbit = useRef();
  const view = (action) => setCameraCommand((c) => ({ action, id: c.id + 1 }));
  const controllers = devices.filter((x) => x.kind === "cpu");
  const code = programs[controllerUid] || "";
  const setCode = (value) =>
    setPrograms((p) => ({ ...p, [controllerUid]: value }));
  const layout = useMemo(
    () => channelLayout(devices, controllerUid),
    [devices, controllerUid],
  );
  const compiled = useMemo(
    () => compileProgram(code, layout),
    [code, layout.inputCount, layout.outputCount],
  );
  const valid = compiled.valid;
  const runtime = useRef();
  runtime.current = {
    compiled,
    inputs,
    outputs,
    devices,
    connections,
    controllerUid,
    running,
  };
  const d = devices.find((x) => x.uid === selected),
    c = catalog.find((x) => x.id === d?.kind);
  const notice = (t) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const update = (p) => {
    const next = devices.map((x) => (x.uid === selected ? { ...x, ...p } : x));
    if (p.simulation) {
      try {
        validateProject({
          version: 1,
          project,
          devices: next,
          connections,
          code,
          programs,
          controllerUid,
        });
      } catch (error) {
        notice(error.message);
        return;
      }
    }
    setDevices(next);
    if (d?.uid === controllerUid && p.simulation?.powered === false)
      setRunning(false);
  };
  const payload = () =>
    validateProject({
      version: 1,
      project,
      devices,
      connections,
      code,
      programs,
      controllerUid,
    });
  function selectController(uid) {
    setRunning(false);
    setControllerUid(uid);
    setInputs(Array(14).fill(false));
    setOutputs(Array(10).fill(false));
    setCycles(0);
  }
  useEffect(() => {
    if (!running) {
      setOutputs(Array(layout.outputCount).fill(false));
      return;
    }
    setCycles(0);
    const timer = setInterval(() => {
      const { compiled, inputs, devices, controllerUid } = runtime.current;
      if (!compiled.valid) return;
      const target = devices.find((d) => d.uid === controllerUid);
      const powered = target && settings(target).powered;
      const image = [...inputs];
      for (const m of channelLayout(devices, controllerUid).modules) {
        if (!settings(devices.find((d) => d.uid === m.uid)).powered)
          image.fill(false, m.inputStart, m.inputStart + 8);
      }
      setOutputs((previous) =>
        powered
          ? executeScan(compiled, image, previous)
          : Array(compiled.outputCount).fill(false),
      );
      setCycles((c) => c + 1);
    }, 100);
    return () => clearInterval(timer);
  }, [running, controllerUid, layout.outputCount]);
  const mappingKey = layout.modules.map((m) => m.uid).join(",");
  useEffect(() => {
    setRunning(false);
    setInputs(Array(layout.inputCount).fill(false));
    setOutputs(Array(layout.outputCount).fill(false));
    setCycles(0);
  }, [controllerUid, mappingKey, layout.inputCount, layout.outputCount]);
  useEffect(() => {
    const tick = () =>
      setDeviceStates((previous) => {
        const next = stepDeviceStates(runtime.current, previous);
        return JSON.stringify(next) === JSON.stringify(previous)
          ? previous
          : next;
      });
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, []);
  function nextIp() {
    const used = new Set(devices.map((x) => x.ip));
    for (let n = 10; n < 255; n++) {
      const candidate = "192.168.0." + n;
      if (!used.has(candidate)) return candidate;
    }
    return "";
  }
  function saveProject() {
    try {
      localStorage.setItem("simatic-project", JSON.stringify(payload()));
      notice("Project saved to this browser");
    } catch (error) {
      notice("Could not save project: " + error.message);
    }
  }
  function duplicateDevice() {
    if (devices.length >= 100) {
      notice("A project supports up to 100 devices");
      return;
    }
    const uid = crypto.randomUUID();
    setDevices((a) => [
      ...a,
      {
        ...d,
        uid,
        name: (d.name + "_copy").slice(0, 80),
        ...(d.kind === "io" &&
        channelLayout(devices, settings(d).controllerUid).modules.length >= 8
          ? { simulation: { ...settings(d), controllerUid: "" } }
          : {}),
        ip: c.addressable ? nextIp() : undefined,
        pos: [d.pos[0] + 0.8, d.pos[1], d.pos[2] + 1],
      },
    ]);
    if (d.kind === "cpu") setPrograms((p) => ({ ...p, [uid]: p[d.uid] || "" }));
    setSelected(uid);
  }
  function removeDevice() {
    setDevices((a) =>
      a
        .filter((x) => x.uid !== selected)
        .map((x) =>
          x.simulation?.controllerUid === selected
            ? { ...x, simulation: { ...x.simulation, controllerUid: "" } }
            : x,
        ),
    );
    setConnections((a) =>
      a.filter((x) => x.from !== selected && x.to !== selected),
    );
    setPrograms((p) => {
      const next = { ...p };
      delete next[selected];
      return next;
    });
    if (selected === controllerUid)
      selectController(controllers.find((x) => x.uid !== selected)?.uid || "");
    setSelected(null);
  }
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setMode("select");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  function add(item) {
    if (devices.length >= 100) {
      notice("A project supports up to 100 devices");
      return;
    }
    const uid = crypto.randomUUID();
    setDevices((a) => [
      ...a,
      {
        uid,
        kind: item.id,
        pos: [a.length * 0.8 - 1.5, 0, 1],
        rot: [0, 0, 0],
        name: item.name,
        ...(item.addressable ? { ip: nextIp() } : {}),
        ...(item.id === "cpu" ? { startup: "STOP" } : {}),
        ...(item.id === "io"
          ? {
              simulation: {
                powered: true,
                controllerUid:
                  controllerUid && layout.modules.length < 8
                    ? controllerUid
                    : "",
              },
            }
          : {}),
      },
    ]);
    if (item.id === "cpu") {
      setPrograms((p) => ({ ...p, [uid]: DEFAULT_PROGRAM }));
      if (!controllerUid) selectController(uid);
    }
    setSelected(uid);
    setLibraryOpen(false);
    notice(item.name + " added to assembly");
  }
  function download() {
    try {
      const snapshot = payload();
      const a = document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        }),
      );
      a.href = url;
      a.download = project.replaceAll(" ", "-") + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notice("Could not export project: " + error.message);
    }
  }
  useEffect(() => {
    view("fit");
  }, [devices.length]);
  function output(index) {
    return !!outputs[index];
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand-mark">
          s<span>■</span>
        </div>
        {[
          [Box, "Assembly"],
          [Network, "Connections"],
          [Code2, "Program"],
          [BookOpen, "Documentation"],
        ].map(([Icon, t]) => (
          <button
            title={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            <Icon size={21} />
          </button>
        ))}
        <div className="rail-bottom">
          <button
            onClick={() => setModal("settings")}
            title="Workspace settings"
          >
            <Settings2 size={21} />
          </button>
          <div className="avatar">AK</div>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="wordmark">
            SIMATIC <span>studio</span>
            <label>WORKSPACE</label>
          </div>
          <div className="header-right">
            <span className="local">
              <i /> Local workspace
            </span>
            <button
              className="icon-btn"
              onClick={() => fileRef.current.click()}
              title="Import project"
            >
              <Upload size={17} />
            </button>
            <button
              className="icon-btn"
              title="Export project"
              onClick={download}
            >
              <Download size={17} />
            </button>
            <button className="save" onClick={saveProject}>
              <Save size={15} />
              Save project
            </button>
            <div className="avatar small">AK</div>
          </div>
        </header>
        <div className="projectbar">
          <div>
            <div className="breadcrumb">
              Projects <ChevronRight size={12} /> {project}
            </div>
            <div
              className="project-title"
              onDoubleClick={() => setModal("rename")}
            >
              {project}
              <ChevronDown size={16} onClick={() => setModal("rename")} />
              <span className="tag">Draft</span>
            </div>
          </div>
          <div className="projectmeta">
            <span>
              <Box size={14} />
              {devices.length} devices
            </span>
            <span>
              <Network size={14} />
              {connections.length} connections
            </span>
            <span className="separator" />
            <button
              className={running ? "run running" : "run"}
              onClick={() => {
                if (!running && !controllerUid) {
                  notice("Add a CPU to simulate a program");
                  setTab("Program");
                  return;
                }
                if (!running && !valid) {
                  notice(
                    compiled.diagnostics[0]?.message ||
                      "Program contains unsupported syntax",
                  );
                  setTab("Program");
                  return;
                }
                if (
                  !running &&
                  !settings(devices.find((d) => d.uid === controllerUid))
                    .powered
                ) {
                  notice("Turn on the simulation CPU’s virtual supply first");
                  return;
                }
                setRunning(!running);
              }}
            >
              {running ? <Square size={15} /> : <Play size={15} />}{" "}
              {running ? "Stop simulation" : "Run simulation"}
            </button>
          </div>
        </div>
        <nav className="tabs">
          {["Assembly", "Connections", "Program", "Documentation"].map(
            (t, i) => (
              <button
                className={tab === t ? "selected" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {React.createElement([Layers, Network, Code2, BookOpen][i], {
                  size: 16,
                })}
                {t}
                {t === "Assembly" && <span>{devices.length}</span>}
              </button>
            ),
          )}
          <div className="tab-extra">
            <span className="dot" />
            {running ? "Simulation running" : "Local project · offline"}
          </div>
        </nav>
        <div className="workspace-controls">
          <button
            onClick={() => {
              setLibraryOpen(!libraryOpen);
              setInspectorOpen(false);
            }}
          >
            <Box size={16} />
            Device library
          </button>
          <button
            onClick={() => {
              setInspectorOpen(!inspectorOpen);
              setLibraryOpen(false);
            }}
          >
            <SlidersHorizontal size={16} />
            Inspector
          </button>
        </div>
        <div className="workspace">
          <section className={"catalog" + (libraryOpen ? " mobile-open" : "")}>
            <div className="panel-heading">
              <h3>Device library</h3>
              <button
                title="Close device library"
                onClick={() => setLibraryOpen(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="search">
              <Search size={15} />
              <input
                placeholder="Search devices…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {[
                "All devices",
                "Controller",
                "I/O module",
                "Power supply",
                "Drive",
                "HMI panel",
                "Network",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <div className="library-label">
              SIEMENS PORTFOLIO{" "}
              <span>
                {
                  catalog.filter(
                    (x) =>
                      (filter === "All devices" || x.type === filter) &&
                      (x.name + x.family)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  ).length
                }
              </span>
            </div>
            <div className="device-list">
              {catalog
                .filter(
                  (x) =>
                    (filter === "All devices" || x.type === filter) &&
                    (x.name + x.family)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((x) => (
                  <div className="device-card" key={x.id}>
                    <div className={"device-art " + x.id}>
                      <DeviceThumbnail kind={x.id} />
                    </div>
                    <div className="card-text">
                      <span>{x.family}</span>
                      <strong>{x.name}</strong>
                      <small>{x.io}</small>
                      <small className="device-size">
                        {x.dimensions[0]} × {x.dimensions[1]} ×{" "}
                        {x.dimensions[2]} mm
                      </small>
                    </div>
                    <button title={"Add " + x.name} onClick={() => add(x)}>
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
            </div>
            <div className="library-footer">
              <BookOpen size={17} />
              <div>
                Six devices. One workspace.
                <small>Assemble · inspect · bring to life.</small>
              </div>
              <ArrowUpRight size={15} />
            </div>
          </section>
          <section className="center">
            {tab === "Assembly" ? (
              <>
                <div className="viewport-header">
                  <div>
                    <span className="dot" />
                    3D assembly{" "}
                    <span className="view-tag">
                      {cameraCommand.action === "front"
                        ? "Front elevation"
                        : "Perspective"}
                    </span>
                  </div>
                  <select
                    className="assembly-picker"
                    aria-label="Inspect assembly device"
                    value={selected || ""}
                    onChange={(e) => setSelected(e.target.value || null)}
                  >
                    <option value="">Select a device</option>
                    {devices.map((device) => (
                      <option key={device.uid} value={device.uid}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setGrid(!grid);
                    }}
                  >
                    <Layers size={14} />
                    {grid ? "Hide grid" : "Show grid"}
                  </button>
                </div>
                <div className="canvas">
                  <Canvas
                    shadows
                    frameloop="demand"
                    dpr={[1, 1.5]}
                    camera={{
                      position: [3, 2.5, 8],
                      fov: 36,
                      near: 0.05,
                      far: 2500,
                    }}
                    onPointerMissed={() => setSelected(null)}
                  >
                    <color attach="background" args={["#142d3b"]} />
                    <ambientLight intensity={0.8} />
                    <hemisphereLight args={["#e6f7ff", "#456373", 1.3]} />
                    <directionalLight
                      position={[-3, 7, 8]}
                      intensity={3.5}
                      castShadow
                      shadow-mapSize={[2048, 2048]}
                      shadow-camera-left={-8}
                      shadow-camera-right={8}
                      shadow-camera-top={6}
                      shadow-camera-bottom={-6}
                      shadow-bias={-0.0005}
                    />
                    <directionalLight
                      position={[5, 2, -3]}
                      intensity={2.5}
                      color="#87d8e0"
                    />
                    <Grid
                      visible={grid}
                      position={[0, -1.17, 0]}
                      args={[50, 50]}
                      cellSize={0.5}
                      cellThickness={0.5}
                      cellColor="#2b4959"
                      sectionSize={2.5}
                      sectionColor="#3c6672"
                      fadeDistance={16}
                      fadeStrength={2}
                    />
                    <ContactShadows
                      position={[0, -1.18, 0]}
                      opacity={0.4}
                      scale={20}
                      blur={2.5}
                      far={3}
                      resolution={256}
                      color="#060f18"
                      frames={1}
                      key={devices.map((d) => d.pos.join()).join()}
                    />
                    <DinRail />
                    <group ref={assemblyObject}>
                      {devices.map((dev) => (
                        <Device
                          key={dev.uid}
                          d={dev}
                          selected={dev.uid === selected}
                          onSelect={setSelected}
                          state={deviceStates[dev.uid]}
                          objectRef={
                            dev.uid === selected ? selectedObject : undefined
                          }
                          expanded={expanded}
                          dimensions={dimensions}
                          labels={labels}
                        />
                      ))}
                    </group>
                    {wires &&
                      connections.map((n, i) => {
                        const from = devices.find((d) => d.uid === n.from),
                          to = devices.find((d) => d.uid === n.to);
                        if (!from || !to) return null;
                        const a = [
                          from.pos[0],
                          from.pos[1] -
                            catalog.find((c) => c.id === from.kind).h / 2,
                          from.pos[2] +
                            catalog.find((c) => c.id === from.kind).depth / 2,
                        ];
                        const b = [
                          to.pos[0],
                          to.pos[1] -
                            catalog.find((c) => c.id === to.kind).h / 2,
                          to.pos[2] +
                            catalog.find((c) => c.id === to.kind).depth / 2,
                        ];
                        const y = Math.min(a[1], b[1]) - 0.16 - i * 0.045;
                        return (
                          <Line
                            key={i}
                            points={[a, [a[0], y, a[2]], [b[0], y, b[2]], b]}
                            color={
                              n.type === "24 V DC"
                                ? "#eebf71"
                                : n.type === "Ethernet"
                                  ? "#75a5e6"
                                  : "#45d7b7"
                            }
                            lineWidth={1.8}
                            transparent
                            opacity={0.7}
                          />
                        );
                      })}
                    {d && mode !== "select" && (
                      <TransformControls
                        key={selected}
                        mode={mode}
                        object={selectedObject}
                        onMouseUp={(e) => {
                          const obj = e.target.object;
                          update({
                            pos: obj.position.toArray(),
                            rot: [
                              obj.rotation.x,
                              obj.rotation.y,
                              obj.rotation.z,
                            ],
                          });
                        }}
                      />
                    )}
                    <OrbitControls
                      ref={orbit}
                      makeDefault
                      minDistance={0.7}
                      maxDistance={2000}
                      maxPolarAngle={Math.PI * 0.86}
                    />
                    <CameraRig
                      command={cameraCommand}
                      assembly={assemblyObject}
                      selectedObject={selectedObject}
                      orbit={orbit}
                    />
                  </Canvas>
                  <div className="canvas-toolbar">
                    {[
                      [MousePointer2, "select", "Select"],
                      [Move, "translate", "Move"],
                      [Rotate3D, "rotate", "Rotate"],
                    ].map(([Icon, m, t]) => (
                      <button
                        className={mode === m ? "chosen" : ""}
                        title={t}
                        key={m}
                        onClick={() => setMode(m)}
                      >
                        <Icon size={18} />
                      </button>
                    ))}
                    <span />
                    <button
                      title="Reset device placement"
                      onClick={() => {
                        if (d) update({ pos: [0, 0, 0], rot: [0, 0, 0] });
                      }}
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      title="Expand viewport"
                      onClick={() =>
                        document.querySelector(".canvas").requestFullscreen?.()
                      }
                    >
                      <Maximize size={17} />
                    </button>
                  </div>
                  <div className="scene-options">
                    <button title="Fit all devices" onClick={() => view("fit")}>
                      <Maximize size={15} /> Fit
                    </button>
                    <button
                      title="Focus selected device"
                      disabled={!d}
                      onClick={() => view("focus")}
                    >
                      <Focus size={15} /> Focus
                    </button>
                    <button
                      title="Front elevation"
                      onClick={() => view("front")}
                    >
                      <ScanLine size={15} /> Front
                    </button>
                    <span />
                    <button
                      title="Show dimensions"
                      className={dimensions ? "chosen" : ""}
                      aria-pressed={dimensions}
                      onClick={() => setDimensions(!dimensions)}
                    >
                      <Ruler size={15} />
                    </button>
                    <button
                      title="Show device labels"
                      className={labels ? "chosen" : ""}
                      aria-pressed={labels}
                      onClick={() => setLabels(!labels)}
                    >
                      <Tags size={15} />
                    </button>
                    <button
                      title="Show connection paths"
                      className={wires ? "chosen" : ""}
                      aria-pressed={wires}
                      onClick={() => setWires(!wires)}
                    >
                      <Cable size={15} />
                    </button>
                  </div>
                  <button
                    className={"exploded-button " + (expanded ? "chosen" : "")}
                    aria-pressed={expanded}
                    onClick={() => setExpanded(!expanded)}
                  >
                    <Layers size={14} />
                    {expanded ? "Assembled view" : "Exploded details"}
                  </button>
                  {d && (
                    <div className="selected-caption">
                      <span>{c.family}</span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.dimensions.join(" × ")} mm
                        {c.id === "hmi" ? " · mounting depth" : ""}
                      </small>
                    </div>
                  )}
                  <div className="scene-label">
                    <span className="dot" />
                    VIRTUAL ASSEMBLY <span>DIN rail · 35 mm</span>
                  </div>
                  <div className="axis">
                    <b className="y">Y</b>
                    <b className="z">Z</b>
                    <b className="x">X</b>
                  </div>
                  <div className="view-help">
                    Drag to orbit <span>·</span> Scroll to zoom <span>·</span>{" "}
                    Right-click to pan
                  </div>
                </div>
                <div className="assembly-bottom">
                  <div className="panel-heading">
                    <h3>
                      Assembly devices <span>{devices.length}</span>
                    </h3>
                    <span className="text-muted">
                      Click a device to inspect
                    </span>
                  </div>
                  <div className="table">
                    <div className="table-row table-head">
                      <span>DEVICE / NAME</span>
                      <span>TYPE</span>
                      <span>IP ADDRESS</span>
                      <span>STATUS</span>
                    </div>
                    {devices.map((dev) => {
                      let info = catalog.find((x) => x.id === dev.kind);
                      return (
                        <div
                          onClick={() => setSelected(dev.uid)}
                          className={
                            "table-row " +
                            (selected === dev.uid ? "highlight" : "")
                          }
                          key={dev.uid}
                        >
                          <span>
                            <Box size={15} />
                            <b>{dev.name}</b>
                            <small>{info.name}</small>
                          </span>
                          <span>{info.type}</span>
                          <span className="mono">{dev.ip || "—"}</span>
                          <span>
                            <i className="status-dot" />
                            {deviceStates[dev.uid]?.status || "Ready"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : tab === "Connections" ? (
              <div className="content-page">
                <div className="page-title">
                  <div>
                    <h2>Network & wiring</h2>
                    <p>Connect devices in your virtual assembly.</p>
                  </div>
                  <button className="save" onClick={() => setModal("connect")}>
                    <Plus size={16} />
                    Add connection
                  </button>
                </div>
                <div className="network-visual">
                  {devices.map((dev) => (
                    <div key={dev.uid}>
                      <Network size={27} />
                      <strong>{dev.name}</strong>
                      <small>
                        {dev.ip ||
                          catalog.find((x) => x.id === dev.kind)?.interface}
                      </small>
                    </div>
                  ))}
                </div>
                <h3>Connections</h3>
                {connections.map((n, i) => (
                  <div className="connection-row" key={i}>
                    <span className="dot" />
                    <b>{devices.find((x) => x.uid === n.from)?.name}</b>
                    <span>→</span>
                    <b>{devices.find((x) => x.uid === n.to)?.name}</b>
                    <span className="tag">
                      {n.type === "PROFINET" ? "PROFINET IO" : n.type}
                    </span>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setConnections((a) => a.filter((_, j) => i !== j))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <div className="info-note">
                  Connections describe project topology. Electrical
                  compatibility and communication are not hardware validated.
                </div>
              </div>
            ) : tab === "Program" ? (
              <div className="content-page">
                <div className="page-title">
                  <div>
                    <h2>Program workspace</h2>
                    <p>Boolean scan program · separate source per CPU</p>
                  </div>
                  <span className="tag">
                    {valid ? "Syntax valid" : "Unsupported syntax"}
                  </span>
                </div>
                <label className="controller-picker">
                  Simulation target
                  <select
                    aria-label="Simulation target"
                    value={controllerUid}
                    onChange={(e) => selectController(e.target.value)}
                  >
                    {!controllers.length && (
                      <option value="">Add a CPU to the assembly</option>
                    )}
                    {controllers.map((cpu) => (
                      <option key={cpu.uid} value={cpu.uid}>
                        {cpu.name} · CPU 1214C
                      </option>
                    ))}
                  </select>
                </label>
                <div className="editor-title">
                  <Code2 size={16} />
                  Main.scl <span>Illustrative interpreter</span>
                </div>
                <textarea
                  className="code-editor"
                  aria-label="CPU program"
                  disabled={!controllerUid}
                  spellCheck={false}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setRunning(false);
                  }}
                />
                <div className="program-actions">
                  <button
                    className="save"
                    onClick={() =>
                      notice(
                        valid
                          ? "Program validated for the supported simulation subset"
                          : compiled.diagnostics[0]?.message ||
                              "Unsupported syntax",
                      )
                    }
                  >
                    <Check size={16} />
                    Validate program
                  </button>
                  <span>{cycles} simulated cycles · 100 ms interval</span>
                </div>
                {!valid && (
                  <div className="program-diagnostics" role="alert">
                    {compiled.diagnostics.map((diagnostic, index) => (
                      <div key={index}>
                        Line {diagnostic.line}, column {diagnostic.column}:{" "}
                        {diagnostic.message}
                      </div>
                    ))}
                  </div>
                )}
                <h3>Watch table</h3>
                <div className="watch-table">
                  {inputs.map((v, i) => (
                    <div key={i}>
                      <span className="mono">{channelAddress("I", i)}</span>
                      <span>Digital input</span>
                      <button
                        className={"toggle " + (v ? "on" : "")}
                        aria-label={
                          channelAddress("I", i) + " " + (v ? "TRUE" : "FALSE")
                        }
                        disabled={!controllerUid}
                        onClick={() =>
                          setInputs((a) => a.map((x, j) => (j === i ? !x : x)))
                        }
                      >
                        {v ? "TRUE" : "FALSE"}
                      </button>
                    </div>
                  ))}
                  {outputs.map((_, i) => (
                    <div key={i}>
                      <span className="mono">{channelAddress("Q", i)}</span>
                      <span>Digital output</span>
                      <span className={output(i) ? "green" : "text-muted"}>
                        {output(i) ? "TRUE" : "FALSE"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="info-note">
                  Supported: {layout.inputCount} inputs and {layout.outputCount}{" "}
                  outputs for the selected CPU, including assigned SM 1223
                  modules, TRUE/FALSE, NOT, AND, XOR, OR, parentheses and
                  sequential output assignments. Outputs update on a nominal 100
                  ms browser interval. These are this simulator’s project
                  addresses, not verified hardware defaults. Siemens firmware,
                  real PLC timing, safety logic and TIA Portal compilation are
                  not emulated. Programs are not downloadable to hardware.
                </div>
              </div>
            ) : (
              <div className="content-page">
                <div className="page-title">
                  <div>
                    <h2>Engineering reference</h2>
                    <p>Documentation and model coverage.</p>
                  </div>
                  <BookOpen size={25} />
                </div>
                <div className="doc-banner">
                  <BookOpen size={24} />
                  <div>
                    <h3>A clear view of model fidelity</h3>
                    <p>
                      Published dimensions, basic ratings and interface
                      capabilities were checked against exact-order Siemens
                      datasheets. Housing details, terminal placement and device
                      behavior remain representative. HMI depth uses its
                      published mounting depth, not a verified full envelope.
                    </p>
                  </div>
                </div>
                {catalog.map((item) => (
                  <a
                    className="doc-row"
                    href={item.datasheet}
                    target="_blank"
                    rel="noreferrer"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.family} · {item.name}
                      </strong>
                      <small>{item.order}</small>
                      <p className="documentation-copy">{item.reference}</p>
                      <small>
                        Datasheet {item.sourceDate} · pages {item.sourcePage} ·{" "}
                        {item.dimensions.join(" × ")} mm
                        {item.id === "hmi"
                          ? " (front W/H; mounting depth)"
                          : " (W/H/D)"}
                      </small>
                    </div>
                    <span>
                      Official datasheet <ArrowUpRight size={16} />
                    </span>
                  </a>
                ))}
                <h3>What this workspace supports</h3>
                <p className="documentation-copy">
                  3D placement and rotation, project topology, editable device
                  parameters, separate CPU program sources, a bounded Boolean
                  scan simulator, and validated local project import/export.
                  Live channel indicators, assigned expansion I/O, a teaching
                  model for drive frequency ramps, a virtual HMI screen,
                  power-supply test loads and Ethernet link states are included.
                  Electrical circuit solving, real protocols, exact CAD models
                  and Siemens firmware remain outside this model.
                </p>
                <a
                  className="doc-row"
                  href={catalog.find((item) => item.id === "switch").manual}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div>
                    <strong>SCALANCE XB-000 operating instructions</strong>
                    <small>
                      01/2022 · A2B00077300-11 · p. 14: XB005 management and
                      diagnostic limits
                    </small>
                  </div>
                  <span>
                    Official manual <ArrowUpRight size={16} />
                  </span>
                </a>
              </div>
            )}
          </section>
          <aside
            className={"inspector" + (inspectorOpen ? " mobile-open" : "")}
          >
            <div className="panel-heading">
              <h3>Device inspector</h3>
              <button
                title="Close inspector"
                onClick={() => setInspectorOpen(false)}
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>
            {d && c ? (
              <>
                <div className="selected-device">
                  <div className="mini-device">
                    <DeviceThumbnail kind={d.kind} />
                  </div>
                  <div>
                    <small>{c.family}</small>
                    <h3>{c.name}</h3>
                    <span>
                      <i className="status-dot" />{" "}
                      {deviceStates[d.uid]?.status || "Ready"}
                    </span>
                  </div>
                </div>
                <div className="inspector-tabs">
                  {["Properties", "Parameters", "Simulation"].map((t) => (
                    <button
                      className={inspector === t ? "active" : ""}
                      key={t}
                      onClick={() => setInspector(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {inspector === "Simulation" ? (
                  <SimulationPanel
                    device={d}
                    state={deviceStates[d.uid]}
                    controllers={controllers}
                    controllerUid={controllerUid}
                    layout={layout}
                    update={update}
                    setInputs={setInputs}
                    inputs={inputs}
                    outputs={outputs}
                    running={running}
                    cycles={cycles}
                  />
                ) : inspector === "Properties" ? (
                  <>
                    <div className="property-section">
                      <h4>GENERAL</h4>
                      <label>
                        Device name
                        <input
                          value={d.name}
                          onChange={(e) => update({ name: e.target.value })}
                        />
                      </label>
                      <label>
                        Order number
                        <div className="readonly mono">{c.order}</div>
                      </label>
                      <label>
                        Device type<div className="readonly">{c.type}</div>
                      </label>
                      <label>
                        Firmware <span className="tag">Reference</span>
                        <div className="readonly">Not emulated</div>
                      </label>
                    </div>
                    <div className="property-section">
                      <h4>NETWORK</h4>
                      {c.addressable && (
                        <>
                          <label>
                            Project IP address
                            <input
                              className="mono"
                              value={d.ip || ""}
                              maxLength={15}
                              onChange={(e) => update({ ip: e.target.value })}
                            />
                          </label>
                          <label>
                            Subnet mask
                            <div className="readonly mono">255.255.255.0</div>
                          </label>
                        </>
                      )}
                      <label>
                        Interface
                        <div className="readonly">{c.interface}</div>
                      </label>
                      {!c.addressable && (
                        <p className="documentation-copy">
                          {c.id === "switch"
                            ? "Unmanaged switch; no management IP or cyclic PROFINET IO endpoint."
                            : "This device has no configurable Ethernet IP address."}
                        </p>
                      )}
                    </div>
                    <div className="property-section">
                      <h4>
                        TRANSFORM <span>mm / degrees</span>
                      </h4>
                      <label>
                        Position
                        <div className="triple">
                          {["X", "Y", "Z"].map((axis, i) => (
                            <div key={axis}>
                              <span>{axis}</span>
                              <input
                                type="number"
                                step="1"
                                value={Number((d.pos[i] * 100).toFixed(1))}
                                onChange={(e) => {
                                  let p = [...d.pos];
                                  p[i] = +e.target.value / 100;
                                  update({ pos: p });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </label>
                      <label>
                        Rotation
                        <div className="triple">
                          {["X", "Y", "Z"].map((axis, i) => (
                            <div key={axis}>
                              <span>{axis}</span>
                              <input
                                type="number"
                                value={Math.round((d.rot[i] * 180) / Math.PI)}
                                onChange={(e) => {
                                  let r = [...d.rot];
                                  r[i] = (+e.target.value * Math.PI) / 180;
                                  update({ rot: r });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="property-section">
                      <h4>DEVICE REFERENCE</h4>
                      <label>
                        Power supply<div className="readonly">{c.power}</div>
                      </label>
                      <label>
                        Capacity / interface
                        <div className="readonly">{c.io}</div>
                      </label>
                      <label>
                        Published dimensions
                        <div className="readonly">
                          {c.dimensions.join(" × ")} mm
                          {c.id === "hmi"
                            ? " · front W/H + mounting depth"
                            : " · W/H/D"}
                        </div>
                      </label>
                      <p className="documentation-copy">{c.reference}</p>
                      <h4>PROJECT PARAMETERS</h4>
                      {c.id === "cpu" && (
                        <label>
                          Startup behavior
                          <select
                            value={d.startup || "STOP"}
                            onChange={(e) =>
                              update({ startup: e.target.value })
                            }
                          >
                            <option>STOP</option>
                            <option>RUN</option>
                          </select>
                        </label>
                      )}
                      <label>
                        Device notes
                        <textarea
                          value={d.notes || ""}
                          onChange={(e) => update({ notes: e.target.value })}
                          placeholder="Add engineering notes…"
                        />
                      </label>
                      <small className="text-muted">
                        Stored in this project; not sent to hardware.
                      </small>
                    </div>
                  </>
                )}
                <div className="inspector-bottom">
                  <a href={c.datasheet} target="_blank" rel="noreferrer">
                    <BookOpen size={16} />
                    Official device datasheet
                    <ArrowUpRight size={14} />
                  </a>
                  <div>
                    <button onClick={duplicateDevice}>
                      <Copy size={14} />
                      Duplicate
                    </button>
                    <button className="delete" onClick={removeDevice}>
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-inspector">
                <Box size={35} />
                <h3>Select a device</h3>
                <p>Choose a device in the assembly to configure it.</p>
              </div>
            )}
          </aside>
        </div>
        <footer>
          <span>
            <i className="status-dot" />
            Workspace ready <span className="footer-divider">|</span>{" "}
            {running ? "SIMULATION" : "OFFLINE ENGINEERING"}
          </span>
          <span>
            Representative models <span className="footer-divider">|</span>{" "}
            Units: mm <span className="footer-divider">|</span> v1.2.0
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".json"
        onChange={async (e) => {
          try {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024)
              throw Error("Project file exceeds 2 MB");
            const p = validateProject(JSON.parse(await file.text()));
            setDevices(p.devices);
            setConnections(p.connections);
            setPrograms(p.programs);
            setProject(p.project);
            setSelected(p.devices[0]?.uid);
            selectController(p.controllerUid);
            notice("Project imported");
          } catch (error) {
            notice("Invalid project file: " + error.message);
          }
          e.target.value = "";
        }}
      />
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close icon-btn"
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
            {modal === "connect" ? (
              <ConnectionForm
                devices={devices}
                submit={(n) => {
                  try {
                    const next = validateProject({
                      ...payload(),
                      connections: [...connections, n],
                    });
                    setConnections(next.connections);
                    setModal(null);
                  } catch (error) {
                    notice(error.message);
                  }
                }}
              />
            ) : modal === "rename" ? (
              <>
                <h2>Project name</h2>
                <input
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
                <button className="save" onClick={() => setModal(null)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h2>Workspace settings</h2>
                <p>
                  Projects are stored in your browser. Export a JSON file to
                  back up or transfer your workspace.
                </p>
                <button className="save" onClick={download}>
                  <Download size={16} />
                  Export current project
                </button>
                <button
                  className="save"
                  onClick={() => {
                    setModal(null);
                    fileRef.current.click();
                  }}
                >
                  <Upload size={16} />
                  Import project
                </button>
                <div className="info-note">
                  Independent engineering prototype. Not affiliated with
                  Siemens. No physical hardware connection.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function ConnectionForm({ devices, submit }) {
  const [type, S] = useState("PROFINET"),
    [from, F] = useState(""),
    [to, T] = useState("");
  const ethernet = (device) =>
    catalog.find((item) => item.id === device.kind)?.ethernet;
  const sources = devices.filter((device) =>
    type === "PROFINET"
      ? device.kind === "cpu"
      : type === "Ethernet"
        ? ethernet(device)
        : true,
  );
  const source =
    sources.find((device) => device.uid === from)?.uid || sources[0]?.uid || "";
  const destinations = devices.filter(
    (device) =>
      device.uid !== source &&
      (type === "PROFINET"
        ? ["cpu", "drive"].includes(device.kind)
        : type === "Ethernet"
          ? ethernet(device)
          : true),
  );
  const destination =
    destinations.find((device) => device.uid === to)?.uid ||
    destinations[0]?.uid ||
    "";
  return (
    <>
      <h2>Add a connection</h2>
      <p>
        Topology metadata. PROFINET IO requires a CPU controller and compatible
        endpoint; Ethernet connects network interfaces.
      </p>
      <label>
        Connection type
        <select
          aria-label="Connection type"
          value={type}
          onChange={(e) => S(e.target.value)}
        >
          <option value="PROFINET">PROFINET IO · controller → device</option>
          <option>Ethernet</option>
          <option>24 V DC</option>
          <option>Digital signal</option>
          <option>Analog signal</option>
        </select>
      </label>
      <label>
        From
        <select
          aria-label="Connection source"
          value={source}
          onChange={(e) => F(e.target.value)}
        >
          {sources.map((device) => (
            <option key={device.uid} value={device.uid}>
              {device.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        To
        <select
          aria-label="Connection destination"
          value={destination}
          onChange={(e) => T(e.target.value)}
        >
          {destinations.map((device) => (
            <option key={device.uid} value={device.uid}>
              {device.name}
            </option>
          ))}
        </select>
      </label>
      {(!source || !destination) && (
        <p>No compatible device pair exists in this assembly.</p>
      )}
      <button
        className="save"
        disabled={!source || !destination}
        onClick={() => submit({ from: source, to: destination, type })}
      >
        Add connection
      </button>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);

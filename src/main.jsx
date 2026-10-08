import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useReducer,
  Suspense,
  lazy,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Box,
  Network,
  Code2,
  BookOpen,
  Search,
  Plus,
  Play,
  Square,
  Upload,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  X,
  Check,
  ChevronDown,
  ArrowUpRight,
  Activity,
  PanelLeft,
  SlidersHorizontal,
  StepForward,
  RotateCcw,
  FolderOpen,
  Gauge,
  Power,
  CircleHelp,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import { catalog, initial } from "./catalog.js";
import { validateProject } from "./project.js";
import { compileProgram, executeScan } from "./simulation.js";
import {
  channelLayout,
  settings,
  stepDeviceStates,
  powerAvailable,
  ethernetPath,
  portCapacity,
} from "./device-runtime.js";
import { historyReducer, historyState } from "./project-history.js";
import { SimulationPanel } from "./simulation-panel.jsx";
const Workspace = lazy(() => import("./workspace.jsx"));
const address = (prefix, i) => `${prefix}${Math.floor(i / 8)}.${i % 8}`;
const examples = [
  {
    name: "Motor with interlock",
    desc: "Start signal enables the drive. An interlock stops it.",
    code: '// I0.0 = start signal\n// I0.2 = interlock active\n// Q0.0 = drive enable\n"Q0.0" := "I0.0" AND NOT "I0.2";\n"Q0.1" := "I0.2";',
  },
  {
    name: "Start / stop latch",
    desc: "Pulse Start to latch the output. Stop resets it.",
    code: '// I0.0 = start, I0.1 = stop, I0.2 = interlock\n// The previous output supplies the seal-in contact.\n"Q0.0" := ("I0.0" OR "Q0.0") AND NOT "I0.1" AND NOT "I0.2";\n"Q0.1" := "I0.2";',
  },
  {
    name: "Input / output test",
    desc: "Map the first four inputs to outputs.",
    code: '// Direct channel test\n"Q0.0" := "I0.0";\n"Q0.1" := "I0.1";\n"Q0.2" := "I0.2";\n"Q0.3" := "I0.3";',
  },
];
function demoProject() {
  return validateProject({
    version: 1,
    project: "Conveyor workbench",
    devices: initial,
    connections: [
      { from: "1", to: "2", type: "24 V DC" },
      { from: "1", to: "5", type: "24 V DC" },
      { from: "1", to: "6", type: "24 V DC" },
      { from: "1", to: "4", type: "24 V DC" },
      { from: "2", to: "5", type: "Ethernet" },
      { from: "5", to: "4", type: "Ethernet" },
      { from: "5", to: "6", type: "Ethernet" },
      { from: "2", to: "4", type: "PROFINET" },
    ],
    code: examples[0].code,
  });
}
const photo = (kind) => `${import.meta.env.BASE_URL}products/${kind}.png`;
function ProductImage({ kind }) {
  return (
    <img src={photo(kind)} alt="" className="product-image" loading="lazy" />
  );
}
function IconButton({ title, children, ...props }) {
  return (
    <button className="icon-button" title={title} aria-label={title} {...props}>
      {children}
    </button>
  );
}
function Modal({ title, close, children }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    const first = ref.current.querySelector("button,input,select,textarea");
    first?.focus();
    const handle = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const items = [
          ...ref.current.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),select,textarea,a[href]",
          ),
        ];
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <IconButton title="Close dialog" onClick={close}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
function App() {
  const [loaded] = useState(() => {
    try {
      const raw = localStorage.getItem("simatic-project");
      return {
        project: raw ? validateProject(JSON.parse(raw)) : demoProject(),
        error: "",
      };
    } catch (e) {
      return {
        project: demoProject(),
        error: `Saved project could not load: ${e.message}`,
      };
    }
  });
  const [history, dispatch] = useReducer(
    historyReducer,
    loaded.project,
    historyState,
  );
  const p = history.present;
  const { devices, connections, programs, controllerUid } = p;
  const [selected, select] = useState(
    devices.find((d) => d.kind === "cpu")?.uid || devices[0]?.uid || null,
  );
  const [tab, setTab] = useState("Workbench"),
    [inspector, setInspector] = useState("Live"),
    [isolated, setIsolated] = useState(false),
    [drawer, setDrawer] = useState(null),
    [modal, setModal] = useState(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [toast, setToast] = useState(loaded.error),
    [saveStatus, setSaveStatus] = useState("Saved locally"),
    [running, setRunning] = useState(false),
    [inputs, setInputs] = useState([]),
    [outputs, setOutputs] = useState([]),
    [cycles, setCycles] = useState(0),
    [states, setStates] = useState({}),
    [paused, setPaused] = useState(false),
    [watchQuery, setWatchQuery] = useState(""),
    [log, setLog] = useState([]);
  const fileRef = useRef(),
    toastTimer = useRef(),
    runtime = useRef(),
    storageError = useRef(false);
  const controllers = devices.filter((d) => d.kind === "cpu");
  const d = devices.find((d) => d.uid === selected),
    c = catalog.find((c) => c.id === d?.kind);
  const layout = useMemo(
    () => channelLayout(devices, controllerUid),
    [devices, controllerUid],
  );
  const code = programs[controllerUid] || "";
  const compiled = useMemo(
    () => compileProgram(code, layout),
    [code, layout.inputCount, layout.outputCount],
  );
  runtime.current = {
    devices,
    connections,
    controllerUid,
    running: running || paused,
    inputs,
    outputs,
    compiled,
  };
  function notice(text) {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  function edit(value, group) {
    dispatch({ type: "edit", value, time: Date.now(), group });
  }
  function update(patch) {
    if (!d) return;
    if (patch.simulation) {
      try {
        validateProject({
          ...p,
          devices: devices.map((item) =>
            item.uid === d.uid ? { ...item, ...patch } : item,
          ),
        });
      } catch (e) {
        notice(e.message);
        return;
      }
    }
    edit(
      (p) => ({
        ...p,
        devices: p.devices.map((item) =>
          item.uid === d.uid ? { ...item, ...patch } : item,
        ),
      }),
      `${d.uid}-${Object.keys(patch).join()}`,
    );
  }
  function patchProgram(value) {
    setRunning(false);
    setPaused(false);
    setOutputs(Array(layout.outputCount).fill(false));
    setCycles(0);
    edit(
      (p) => ({
        ...p,
        code: value,
        programs: { ...p.programs, [controllerUid]: value },
      }),
      "program",
    );
  }
  function undo() {
    setRunning(false);
    setPaused(false);
    setOutputs(Array(layout.outputCount).fill(false));
    dispatch({ type: "undo" });
  }
  function redo() {
    setRunning(false);
    setPaused(false);
    setOutputs(Array(layout.outputCount).fill(false));
    dispatch({ type: "redo" });
  }
  function replace(next) {
    setRunning(false);
    setPaused(false);
    edit(next);
    select(
      next.devices.find((d) => d.kind === "cpu")?.uid ||
        next.devices[0]?.uid ||
        null,
    );
    setModal(null);
    setTab("Workbench");
    setIsolated(false);
    notice("Workspace loaded · Undo restores your previous project");
  }
  function exportProject() {
    try {
      const value = validateProject(p);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = p.project.replace(/[^\w-]+/g, "-") + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notice(e.message);
    }
  }
  useEffect(() => {
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      try {
        const normalized = validateProject(p);
        localStorage.setItem("simatic-project", JSON.stringify(normalized));
        setSaveStatus("Saved locally");
        storageError.current = false;
      } catch (e) {
        setSaveStatus("Unsaved edits");
        if (!storageError.current) {
          notice(`Autosave needs attention: ${e.message}`);
          storageError.current = true;
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [p]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const mappingKey = layout.modules.map((m) => m.uid).join(",");
  useEffect(() => {
    setRunning(false);
    setPaused(false);
    setInputs(Array(layout.inputCount).fill(false));
    setOutputs(Array(layout.outputCount).fill(false));
    setCycles(0);
  }, [controllerUid, mappingKey, layout.inputCount, layout.outputCount]);
  useEffect(() => {
    if (selected && !devices.some((d) => d.uid === selected)) {
      select(devices[0]?.uid || null);
      setIsolated(false);
    }
  }, [devices, selected]);
  function scan() {
    const r = runtime.current;
    if (
      !r.compiled.valid ||
      !powerAvailable(r.devices, r.connections, r.controllerUid)
    )
      return false;
    const image = [...r.inputs];
    for (const m of channelLayout(r.devices, r.controllerUid).modules) {
      if (!powerAvailable(r.devices, r.connections, m.uid))
        image.fill(false, m.inputStart, m.inputStart + 8);
    }
    setOutputs((previous) => executeScan(r.compiled, image, previous));
    setCycles((n) => n + 1);
    return true;
  }
  function canRun() {
    if (!controllerUid) {
      notice("Add a controller first");
      return false;
    }
    if (!compiled.valid) {
      notice(compiled.diagnostics[0]?.message || "Fix the program first");
      setTab("Program");
      return false;
    }
    if (!powerAvailable(devices, connections, controllerUid)) {
      notice("The controller has no power. Check its supply.");
      return false;
    }
    return true;
  }
  function toggleRun() {
    if (running) {
      setRunning(false);
      setPaused(false);
      setOutputs(Array(layout.outputCount).fill(false));
    } else if (canRun()) {
      setPaused(false);
      setRunning(true);
    }
  }
  function singleScan() {
    if (running || !canRun()) return;
    setPaused(true);
    scan();
  }
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!scan()) {
        setRunning(false);
        setPaused(false);
        setOutputs(Array(runtime.current.compiled.outputCount).fill(false));
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      setStates((previous) => {
        const next = stepDeviceStates(
          runtime.current,
          previous,
          Math.min(0.5, (now - last) / 1000),
        );
        last = now;
        return Object.keys(next).length === Object.keys(previous).length &&
          Object.keys(next).every((k) => next[k] === previous[k])
          ? previous
          : next;
      });
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (controllerUid && !powerAvailable(devices, connections, controllerUid)) {
      setRunning(false);
      setPaused(false);
      setOutputs(Array(layout.outputCount).fill(false));
    }
  }, [devices, connections, controllerUid]);
  const previousStatuses = useRef({});
  useEffect(() => {
    const events = [];
    for (const [uid, state] of Object.entries(states)) {
      if (
        previousStatuses.current[uid] &&
        previousStatuses.current[uid] !== state.status
      )
        events.push({
          id: crypto.randomUUID(),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          text: `${devices.find((d) => d.uid === uid)?.name}: ${state.status}`,
        });
    }
    previousStatuses.current = Object.fromEntries(
      Object.entries(states).map(([uid, s]) => [uid, s.status]),
    );
    if (events.length) setLog((a) => [...events, ...a].slice(0, 50));
  }, [states]);
  useEffect(() => {
    const handle = (e) => {
      const typing = e.target.matches("input,textarea,select");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        exportProject();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal("library");
      }
      if (e.key === "Escape") {
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [p]);
  function nextIp() {
    const used = new Set(devices.map((d) => d.ip));
    for (let i = 10; i < 255; i++)
      if (!used.has(`192.168.0.${i}`)) return `192.168.0.${i}`;
    return "";
  }
  function add(item) {
    if (devices.length >= 100) {
      notice("The workspace supports 100 devices");
      return;
    }
    const uid = crypto.randomUUID();
    const device = {
      uid,
      kind: item.id,
      name: item.name,
      pos: [
        (devices.length % 8) * 0.9 - 2,
        0,
        1.6 + Math.floor(devices.length / 8) * 1.8,
      ],
      rot: [0, 0, 0],
      ...(item.addressable ? { ip: nextIp() } : {}),
      ...(item.id === "io"
        ? {
            simulation: {
              ...settings({ kind: "io" }),
              controllerUid: layout.modules.length < 8 ? controllerUid : "",
            },
          }
        : {}),
    };
    edit((p) => ({
      ...p,
      devices: [...p.devices, device],
      programs:
        item.id === "cpu"
          ? { ...p.programs, [uid]: examples[0].code }
          : p.programs,
      controllerUid: p.controllerUid || (item.id === "cpu" ? uid : ""),
    }));
    select(uid);
    setModal(null);
    setDrawer(null);
    notice(`${item.name} added`);
  }
  function duplicate() {
    if (!d || devices.length >= 100) return;
    const uid = crypto.randomUUID();
    edit((p) => ({
      ...p,
      devices: [
        ...p.devices,
        {
          ...d,
          uid,
          name: `${d.name} copy`.slice(0, 80),
          ip: c.addressable ? nextIp() : undefined,
          pos: [d.pos[0] + 0.8, d.pos[1], d.pos[2] + 1],
          ...(d.kind === "io" &&
          channelLayout(devices, settings(d).controllerUid).modules.length >= 8
            ? { simulation: { ...settings(d), controllerUid: "" } }
            : {}),
        },
      ],
      programs:
        d.kind === "cpu"
          ? { ...p.programs, [uid]: p.programs[d.uid] }
          : p.programs,
    }));
    select(uid);
  }
  function remove() {
    if (!d) return;
    edit((p) => {
      const remaining = p.devices
        .filter((x) => x.uid !== d.uid)
        .map((x) =>
          settings(x).controllerUid === d.uid
            ? { ...x, simulation: { ...settings(x), controllerUid: "" } }
            : x,
        );
      const programs = { ...p.programs };
      delete programs[d.uid];
      return {
        ...p,
        devices: remaining,
        connections: p.connections.filter(
          (x) => x.from !== d.uid && x.to !== d.uid,
        ),
        programs,
        controllerUid:
          p.controllerUid === d.uid
            ? remaining.find((d) => d.kind === "cpu")?.uid || ""
            : p.controllerUid,
      };
    });
    setRunning(false);
    setPaused(false);
    select(null);
  }
  function connect(n) {
    try {
      if (n.type === "Ethernet") {
        for (const uid of [n.from, n.to]) {
          const dev = devices.find((d) => d.uid === uid);
          const used = connections.filter(
            (c) => c.type === "Ethernet" && (c.from === uid || c.to === uid),
          ).length;
          if (used >= portCapacity[dev.kind])
            throw Error(`${dev.name} has no free Ethernet ports`);
        }
      }
      if (
        n.type === "24 V DC" &&
        (devices.find((d) => d.uid === n.from)?.kind !== "power" ||
          devices.find((d) => d.uid === n.to)?.kind === "power")
      )
        throw Error("Connect a power supply to a device’s 24 V control supply");
      const next = validateProject({ ...p, connections: [...connections, n] });
      edit(next);
      setModal(null);
      notice("Connection added");
    } catch (e) {
      notice(e.message);
    }
  }
  const drive = devices.find((d) => d.kind === "drive");
  const driveState = states[drive?.uid] || {};
  const selectedState = states[d?.uid] || {};
  const filtered = catalog.filter(
    (x) =>
      (filter === "All" || x.type === filter) &&
      (x.name + " " + x.family + " " + x.order)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="app">
      <header className="app-header">
        <a
          className="brand"
          href="./"
          onClick={(e) => {
            e.preventDefault();
            setTab("Workbench");
          }}
        >
          <span className="brand-symbol">
            <Box size={24} />
          </span>
          <span>
            SIMATIC<span className="brand-sub"> Studio</span>
            <small>INDUSTRIAL PLAYGROUND</small>
          </span>
        </a>
        <button className="project-picker" onClick={() => setModal("project")}>
          <FolderOpen size={16} />
          <span>{p.project}</span>
          <ChevronDown size={14} />
        </button>
        <div className="header-actions">
          <span className="save-status">
            <i className={saveStatus === "Saved locally" ? "good" : ""} />
            {saveStatus}
          </span>
          <IconButton
            title="Undo (⌘Z)"
            onClick={undo}
            disabled={!history.past.length}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            title="Redo (⇧⌘Z)"
            onClick={redo}
            disabled={!history.future.length}
          >
            <Redo2 size={18} />
          </IconButton>
          <IconButton
            title="Import project"
            onClick={() => fileRef.current.click()}
          >
            <Upload size={18} />
          </IconButton>
          <IconButton title="Export project" onClick={exportProject}>
            <Download size={18} />
          </IconButton>
        </div>
      </header>
      <div className="workspace-bar">
        <nav aria-label="Workspace">
          {[
            ["Workbench", Box],
            ["Connections", Network],
            ["Program", Code2],
            ["Reference", BookOpen],
          ].map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setDrawer(null);
              }}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <div className="run-controls">
          <span className={`run-status ${running ? "active" : ""}`}>
            <i />
            {running ? "RUN" : paused ? "STEPPED" : "STOP"}
          </span>
          <IconButton
            title="Execute one scan"
            onClick={singleScan}
            disabled={running || !controllerUid}
          >
            <StepForward size={18} />
          </IconButton>
          <button
            className={`primary run-button ${running ? "stop" : ""}`}
            onClick={toggleRun}
          >
            {running ? <Square size={15} /> : <Play size={15} />}
            <span>{running ? "Stop" : "Run"}</span>
          </button>
        </div>
      </div>
      <div className="mobile-controls">
        <button
          onClick={() => setDrawer(drawer === "devices" ? null : "devices")}
        >
          <PanelLeft size={17} />
          Devices ({devices.length})
        </button>
        <button
          onClick={() => setDrawer(drawer === "inspector" ? null : "inspector")}
        >
          <SlidersHorizontal size={17} />
          {d ? c.name : "Inspector"}
        </button>
      </div>
      <main className={`workspace ${tab !== "Workbench" ? "page-mode" : ""}`}>
        {drawer && (
          <button
            className="drawer-scrim"
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
          />
        )}
        <aside
          className={`device-sidebar ${drawer === "devices" ? "open" : ""}`}
        >
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">YOUR ASSEMBLY</span>
              <h3>
                Devices <span>{devices.length}</span>
              </h3>
            </div>
            <IconButton
              title="Add device (⌘K)"
              onClick={() => setModal("library")}
            >
              <Plus size={19} />
            </IconButton>
          </div>
          <div className="installed-devices">
            {devices.map((dev) => {
              const item = catalog.find((c) => c.id === dev.kind);
              return (
                <button
                  className={`installed-device ${selected === dev.uid ? "selected" : ""}`}
                  key={dev.uid}
                  onClick={() => {
                    select(dev.uid);
                    setDrawer(null);
                  }}
                  onDoubleClick={() => {
                    select(dev.uid);
                    setTab("Workbench");
                    setIsolated(true);
                  }}
                >
                  <ProductImage kind={dev.kind} />
                  <span>
                    <strong>{dev.name}</strong>
                    <small>{item.name}</small>
                    <em className={!states[dev.uid]?.powered ? "offline" : ""}>
                      <i />
                      {states[dev.uid]?.status || "Ready"}
                    </em>
                  </span>
                </button>
              );
            })}
            {!devices.length && (
              <p className="empty-copy">
                Add a controller, power supply or panel to begin.
              </p>
            )}
          </div>
          <button className="add-device" onClick={() => setModal("library")}>
            <Plus size={17} />
            Add device
          </button>
          <div className="sidebar-tip">
            <span>Explore the details</span>
            <p>Double-click a device for a closer look at the product.</p>
            <button onClick={() => setModal("help")}>
              <CircleHelp size={14} />
              Controls & shortcuts
            </button>
          </div>
        </aside>
        <div className="center">
          {tab === "Workbench" ? (
            <>
              <Suspense
                fallback={
                  <div className="scene-loading">
                    <Box size={30} />
                    <span>Preparing the workbench…</span>
                  </div>
                }
              >
                <Workspace
                  devices={devices}
                  selected={selected}
                  select={select}
                  states={states}
                  connections={connections}
                  update={update}
                  isolated={isolated}
                  setIsolated={setIsolated}
                />
              </Suspense>
              <div className="live-dock">
                <div className="dock-heading">
                  <div>
                    <Activity size={16} />
                    <h3>Live process</h3>
                    <span>{cycles} scans</span>
                  </div>
                  <button
                    onClick={() => {
                      select(controllerUid);
                      setInspector("Live");
                      setDrawer("inspector");
                    }}
                  >
                    All I/O <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="process-body">
                  <div className="process-controls">
                    <span className="eyebrow">CONTROLLER INPUTS</span>
                    <div className="quick-inputs">
                      {inputs.slice(0, 6).map((on, i) => (
                        <button
                          key={i}
                          className={on ? "on" : ""}
                          disabled={
                            !controllerUid || !states[controllerUid]?.powered
                          }
                          aria-pressed={on}
                          aria-label={`${address("I", i)} ${on ? "TRUE" : "FALSE"}`}
                          onClick={() =>
                            setInputs((a) =>
                              a.map((v, j) => (j === i ? !v : v)),
                            )
                          }
                        >
                          <i />
                          <strong>{address("I", i)}</strong>
                          <small>
                            {
                              [
                                "Start",
                                "Stop",
                                "Interlock",
                                "Sensor 1",
                                "Sensor 2",
                                "Spare",
                              ][i]
                            }
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="process-machine">
                    <div
                      className={`conveyor-demo ${driveState.frequency > 0 ? "moving" : ""}`}
                      style={{
                        "--belt-duration": `${Math.max(0.25, 5 / (driveState.frequency || 1))}s`,
                      }}
                    >
                      <div className="conveyor-package" />
                      <div className="belt">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <div className="process-reading">
                      <b>
                        {(driveState.frequency || 0).toFixed(1)}
                        <small>Hz</small>
                      </b>
                      <span>
                        {drive ? driveState.status || "Ready" : "Add a drive"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : tab === "Connections" ? (
            <Connections
              devices={devices}
              connections={connections}
              states={states}
              select={select}
              add={() => setModal("connect")}
              remove={(i) =>
                edit((p) => ({
                  ...p,
                  connections: p.connections.filter((_, j) => i !== j),
                }))
              }
            />
          ) : tab === "Program" ? (
            <div className="content-page">
              <div className="page-title">
                <div>
                  <span className="eyebrow">LOGIC WORKSPACE</span>
                  <h1>Make the machine move.</h1>
                  <p>Edit, test and inspect your controller’s process image.</p>
                </div>
                <span className={`pill ${compiled.valid ? "good" : "warning"}`}>
                  {compiled.valid ? "Program valid" : "Check syntax"}
                </span>
              </div>
              <div className="program-toolbar">
                <label>
                  Controller
                  <select
                    aria-label="Simulation target"
                    value={controllerUid}
                    onChange={(e) => {
                      setRunning(false);
                      setPaused(false);
                      edit((p) => ({ ...p, controllerUid: e.target.value }));
                    }}
                  >
                    {!controllers.length && (
                      <option value="">Add a controller</option>
                    )}
                    {controllers.map((d) => (
                      <option key={d.uid} value={d.uid}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button onClick={() => setModal("examples")}>
                  <BookOpen size={16} />
                  Load example
                </button>
              </div>
              <div className="code-card">
                <div className="code-heading">
                  <span>
                    <Code2 size={16} />
                    Main.scl
                  </span>
                  <small>Boolean scan · 100 ms</small>
                </div>
                <div className="code-area">
                  <div className="line-numbers" aria-hidden="true">
                    {code.split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    aria-label="CPU program"
                    spellCheck="false"
                    disabled={!controllerUid}
                    value={code}
                    onChange={(e) => patchProgram(e.target.value)}
                    onScroll={(e) => {
                      e.currentTarget.previousSibling.scrollTop =
                        e.currentTarget.scrollTop;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const el = e.target,
                          start = el.selectionStart,
                          end = el.selectionEnd;
                        patchProgram(
                          code.slice(0, start) + "  " + code.slice(end),
                        );
                        requestAnimationFrame(() =>
                          el.setSelectionRange(start + 2, start + 2),
                        );
                      }
                    }}
                  />
                </div>
                {!compiled.valid && (
                  <div className="program-diagnostics" role="alert">
                    {compiled.diagnostics.map((e, i) => (
                      <p key={i}>
                        Line {e.line}:{e.column} — {e.message}
                      </p>
                    ))}
                  </div>
                )}
                <div className="code-footer">
                  <span>
                    {layout.inputCount} inputs · {layout.outputCount} outputs
                  </span>
                  <button
                    onClick={singleScan}
                    disabled={running || !controllerUid}
                  >
                    <StepForward size={15} />
                    Single scan
                  </button>
                </div>
              </div>
              <div className="watch-heading">
                <h3>
                  Process image <span>{cycles} scans</span>
                </h3>
                <div className="search">
                  <Search size={15} />
                  <input
                    aria-label="Filter I/O"
                    placeholder="Filter I0, Q0…"
                    value={watchQuery}
                    onChange={(e) => setWatchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    setInputs(Array(layout.inputCount).fill(false));
                    notice("All input switches reset");
                  }}
                >
                  <RotateCcw size={15} />
                  Reset inputs
                </button>
              </div>
              <div className="watch-grid">
                {[
                  ["I", inputs],
                  ["Q", outputs],
                ].map(([prefix, values]) => (
                  <section key={prefix}>
                    <h4>
                      {prefix === "I"
                        ? "Inputs · click to toggle"
                        : "Outputs · read only"}
                    </h4>
                    <div className="watch-bits">
                      {values.map(
                        (value, i) =>
                          address(prefix, i)
                            .toLowerCase()
                            .includes(watchQuery.toLowerCase()) && (
                            <button
                              key={i}
                              className={value ? "active" : ""}
                              disabled={prefix === "Q" || !controllerUid}
                              aria-label={`${address(prefix, i)} ${value ? "TRUE" : "FALSE"}`}
                              aria-pressed={value}
                              onClick={() =>
                                setInputs((a) =>
                                  a.map((v, j) => (j === i ? !v : v)),
                                )
                              }
                            >
                              <i />
                              <span>{address(prefix, i)}</span>
                              <strong>{value ? "1" : "0"}</strong>
                            </button>
                          ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <p className="panel-hint">
                Supported: TRUE / FALSE, NOT, AND, XOR, OR, parentheses and
                sequential output assignments. Expansion bits follow the
                project’s packed address map. Programs run in this browser.
              </p>
            </div>
          ) : (
            <Reference />
          )}
        </div>
        <aside className={`inspector ${drawer === "inspector" ? "open" : ""}`}>
          <div className="sidebar-heading">
            <h3>Inspector</h3>
            <IconButton title="Close inspector" onClick={() => setDrawer(null)}>
              <X size={17} />
            </IconButton>
          </div>
          {d && c ? (
            <>
              <div className="selected-product">
                <ProductImage kind={d.kind} />
                <div>
                  <span className="eyebrow">{c.family}</span>
                  <h2>{c.name}</h2>
                  <span
                    className={`pill ${selectedState.powered ? "good" : ""}`}
                  >
                    {selectedState.status || "Ready"}
                  </span>
                </div>
              </div>
              <div className="inspector-tabs">
                {["Live", "Properties", "Details"].map((name) => (
                  <button
                    key={name}
                    className={inspector === name ? "active" : ""}
                    onClick={() => setInspector(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="inspector-scroll">
                {inspector === "Live" ? (
                  <SimulationPanel
                    device={d}
                    state={selectedState}
                    controllers={controllers}
                    controllerUid={controllerUid}
                    layout={layout}
                    update={update}
                    setInputs={setInputs}
                    inputs={inputs}
                    outputs={outputs}
                    running={running || paused}
                    cycles={cycles}
                  />
                ) : inspector === "Properties" ? (
                  <>
                    <section className="property-section">
                      <h4>DEVICE SETTINGS</h4>
                      <label>
                        Name
                        <input
                          aria-label="Device name"
                          value={d.name}
                          maxLength={80}
                          onChange={(e) => update({ name: e.target.value })}
                        />
                      </label>
                      {c.addressable && (
                        <label>
                          IP address
                          <input
                            aria-label="Device IP address"
                            className="mono"
                            value={d.ip || ""}
                            maxLength={15}
                            onChange={(e) => update({ ip: e.target.value })}
                          />
                        </label>
                      )}
                      <label>
                        Notes
                        <textarea
                          aria-label="Device notes"
                          value={d.notes || ""}
                          maxLength={4000}
                          onChange={(e) => update({ notes: e.target.value })}
                          placeholder="Commissioning notes…"
                        />
                      </label>
                    </section>
                    <section className="property-section">
                      <h4>
                        PLACEMENT <span>mm / degrees</span>
                      </h4>
                      {[
                        ["Position", "pos"],
                        ["Rotation", "rot"],
                      ].map(([label, key]) => (
                        <label key={key}>
                          {label}
                          <div className="triple">
                            {["X", "Y", "Z"].map((axis, i) => (
                              <div key={axis}>
                                <span>{axis}</span>
                                <input
                                  aria-label={`${label} ${axis}`}
                                  type="number"
                                  step={key === "pos" ? 5 : 15}
                                  value={Number(
                                    (key === "pos"
                                      ? d[key][i] * 100
                                      : (d[key][i] * 180) / Math.PI
                                    ).toFixed(1),
                                  )}
                                  onChange={(e) => {
                                    const values = [...d[key]];
                                    values[i] =
                                      key === "pos"
                                        ? +e.target.value / 100
                                        : (+e.target.value * Math.PI) / 180;
                                    update({ [key]: values });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </label>
                      ))}
                      <button
                        onClick={() =>
                          update({ pos: [0, 0, 0], rot: [0, 0, 0] })
                        }
                      >
                        <RotateCcw size={15} />
                        Reset placement
                      </button>
                    </section>
                  </>
                ) : (
                  <section className="property-section">
                    <h4>PRODUCT REFERENCE</h4>
                    <dl className="specs">
                      <dt>Order number</dt>
                      <dd className="mono">{c.order}</dd>
                      <dt>Dimensions W × H × D</dt>
                      <dd>
                        {c.dimensions.join(" × ")} mm
                        {c.id === "hmi" && (
                          <small>
                            39 mm mounting + 6.2 mm front projection
                          </small>
                        )}
                      </dd>
                      <dt>Supply</dt>
                      <dd>{c.power}</dd>
                      <dt>I/O / capacity</dt>
                      <dd>{c.io}</dd>
                      <dt>Interface</dt>
                      <dd>{c.interface}</dd>
                    </dl>
                    <p className="panel-hint">{c.reference}</p>
                    <button
                      className="wide"
                      onClick={() => {
                        setIsolated(true);
                        setTab("Workbench");
                        setDrawer(null);
                      }}
                    >
                      Inspect 3D product <ArrowUpRight size={16} />
                    </button>
                    <a
                      className="reference-link"
                      href={c.datasheet}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Siemens datasheet <ArrowUpRight size={15} />
                    </a>
                  </section>
                )}
              </div>
              <div className="inspector-actions">
                <button onClick={duplicate}>
                  <Copy size={15} />
                  Duplicate
                </button>
                <IconButton title="Remove device" onClick={remove}>
                  <Trash2 size={17} />
                </IconButton>
              </div>
            </>
          ) : (
            <div className="empty-inspector">
              <Box size={35} />
              <h3>Select a device</h3>
              <p>Choose a product in the assembly to inspect or control it.</p>
            </div>
          )}
        </aside>
      </main>
      <footer>
        <span>
          <i className="status-dot" />
          {running ? "Simulation running" : "Local workspace"}
          <span className="footer-dim">
            {" "}
            · Your project stays in this browser
          </span>
        </span>
        <button onClick={() => setModal("events")}>
          <Activity size={13} />
          Activity {log.length > 0 && `(${log.length})`}
        </button>
        <span className="footer-dim">v2.0 · Independent simulator</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={fileRef}
        onChange={async (e) => {
          try {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024)
              throw Error("Project exceeds 2 MB");
            replace(validateProject(JSON.parse(await file.text())));
          } catch (e) {
            notice(`Import failed: ${e.message}`);
          }
          e.target.value = "";
        }}
      />
      {modal && (
        <Modal
          title={
            {
              library: "Device library",
              project: "Your workspace",
              connect: "Add a connection",
              examples: "Program examples",
              help: "Workbench controls",
              events: "Simulation activity",
            }[modal]
          }
          close={() => setModal(null)}
        >
          {modal === "library" ? (
            <>
              <p className="modal-copy">
                Choose a Siemens product for your assembly.
              </p>
              <div className="library-search">
                <div className="search">
                  <Search size={17} />
                  <input
                    autoFocus
                    aria-label="Search devices"
                    placeholder="Product name or order number…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Device category"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["All", ...new Set(catalog.map((c) => c.type))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="library-grid">
                {filtered.map((item) => (
                  <button
                    className="library-card"
                    key={item.id}
                    onClick={() => add(item)}
                  >
                    <div className="library-photo">
                      <ProductImage kind={item.id} />
                    </div>
                    <span className="eyebrow">{item.family}</span>
                    <strong>{item.name}</strong>
                    <small>{item.io}</small>
                    <div>
                      <span>{item.dimensions.join(" × ")} mm</span>
                      <Plus size={18} />
                    </div>
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <p className="empty-copy">No devices match your search.</p>
              )}
            </>
          ) : modal === "project" ? (
            <>
              <label>
                Project name
                <input
                  aria-label="Project name"
                  value={p.project}
                  maxLength={120}
                  onChange={(e) =>
                    edit(
                      (p) => ({ ...p, project: e.target.value }),
                      "project-name",
                    )
                  }
                />
              </label>
              <p className="modal-copy">
                Edits save automatically. Export a project file to keep a
                separate backup or move between devices.
              </p>
              <div className="project-actions">
                <button onClick={exportProject}>
                  <Download size={17} />
                  Export project
                </button>
                <button
                  onClick={() => {
                    setModal(null);
                    fileRef.current.click();
                  }}
                >
                  <Upload size={17} />
                  Import project
                </button>
              </div>
              <h3>Start a workspace</h3>
              <button
                className="starter-card"
                onClick={() => replace(demoProject())}
              >
                <Box size={26} />
                <span>
                  <strong>Conveyor workbench</strong>
                  <small>
                    Six products, connected power and network, a motor interlock
                    program.
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </button>
              <button
                className="starter-card"
                onClick={() =>
                  replace(
                    validateProject({
                      version: 1,
                      project: "Untitled workbench",
                      devices: [],
                      connections: [],
                      code: "",
                    }),
                  )
                }
              >
                <Plus size={26} />
                <span>
                  <strong>Empty workbench</strong>
                  <small>
                    Build your own assembly from the device library.
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </button>
              <p className="panel-hint">
                Loading a workspace replaces the current one. Undo restores it.
              </p>
            </>
          ) : modal === "connect" ? (
            <ConnectionForm
              devices={devices}
              connections={connections}
              submit={connect}
            />
          ) : modal === "examples" ? (
            <>
              <p className="modal-copy">
                Load an example into the selected controller. Undo restores your
                previous source.
              </p>
              {examples.map((example) => (
                <button
                  key={example.name}
                  className="starter-card"
                  disabled={!controllerUid}
                  onClick={() => {
                    patchProgram(example.code);
                    setModal(null);
                    setInputs(Array(layout.inputCount).fill(false));
                    setOutputs(Array(layout.outputCount).fill(false));
                    setCycles(0);
                  }}
                >
                  <Code2 size={22} />
                  <span>
                    <strong>{example.name}</strong>
                    <small>{example.desc}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </>
          ) : modal === "events" ? (
            <>
              <p className="modal-copy">
                Device state changes from this session. Latest first.
              </p>
              <div className="event-log">
                {log.length ? (
                  log.map((e) => (
                    <div key={e.id}>
                      <time>{e.time}</time>
                      <span>{e.text}</span>
                    </div>
                  ))
                ) : (
                  <p>
                    Run the simulation or change a device’s supply to see events
                    here.
                  </p>
                )}
              </div>
              <button onClick={() => setLog([])}>Clear activity</button>
            </>
          ) : (
            <>
              <dl className="shortcut-list">
                <dt>Orbit</dt>
                <dd>Drag the view</dd>
                <dt>Zoom</dt>
                <dd>Scroll / pinch</dd>
                <dt>Pan</dt>
                <dd>Right-drag / two-finger drag</dd>
                <dt>Fit assembly</dt>
                <dd>F</dd>
                <dt>Add device</dt>
                <dd>⌘ / Ctrl + K</dd>
                <dt>Undo / redo</dt>
                <dd>⌘ / Ctrl + Z / Shift + Z</dd>
                <dt>Export project</dt>
                <dd>⌘ / Ctrl + S</dd>
                <dt>Product detail</dt>
                <dd>Double-click a device in the list</dd>
              </dl>
              <p className="modal-copy">
                Run executes a scan every 100 ms. Single scan evaluates once and
                holds the resulting outputs. Input switches represent field
                signals; the drive responds to the mapped enable output.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Connections({ devices, connections, states, select, add, remove }) {
  const [layer, setLayer] = useState("Ethernet");
  const shown = connections.filter((c) => layer === "All" || c.type === layer);
  const sorted = [...devices].sort(
    (a, b) =>
      ["power", "cpu", "io", "switch", "drive", "hmi"].indexOf(a.kind) -
      ["power", "cpu", "io", "switch", "drive", "hmi"].indexOf(b.kind),
  );
  const points = Object.fromEntries(
    sorted.map((d, i) => [
      d.uid,
      { x: 110 + (i % 3) * 270, y: 100 + Math.floor(i / 3) * 210 },
    ]),
  );
  const colors = {
    Ethernet: "#138c82",
    PROFINET: "#6282cc",
    "24 V DC": "#bb873a",
    "Digital signal": "#bd648d",
    "Analog signal": "#9a70bd",
  };
  const height = Math.max(280, Math.ceil(devices.length / 3) * 210);
  return (
    <div className="content-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">CONNECTIONS</span>
          <h1>See the whole system.</h1>
          <p>Physical links, control power and logical I/O relationships.</p>
        </div>
        <button className="primary" onClick={add}>
          <Plus size={17} />
          Connect devices
        </button>
      </div>
      <div className="topology-card">
        <div className="topology-toolbar">
          <div className="segmented">
            {["Ethernet", "24 V DC", "PROFINET", "All"].map((type) => (
              <button
                key={type}
                className={layer === type ? "active" : ""}
                onClick={() => setLayer(type)}
              >
                {type === "PROFINET" ? "PROFINET IO" : type}
              </button>
            ))}
          </div>
          <span>{shown.length} links</span>
        </div>
        <div className="topology-scroll">
          <svg
            className="topology"
            viewBox={`0 0 760 ${height}`}
            role="group"
            aria-label={`${layer} topology with ${devices.length} devices and ${shown.length} connections`}
          >
            {shown.map((c, i) => {
              const a = points[c.from],
                b = points[c.to];
              if (!a || !b) return null;
              const active = states[c.from]?.powered && states[c.to]?.powered;
              return (
                <g key={i}>
                  <path
                    d={`M${a.x} ${a.y} C${a.x + 110} ${a.y + (a.y === b.y ? 90 : 0)},${b.x - 110} ${b.y + (a.y === b.y ? 90 : 0)},${b.x} ${b.y}`}
                    fill="none"
                    stroke={colors[c.type]}
                    strokeWidth={2}
                    strokeDasharray={active ? "" : "6 5"}
                    opacity={active ? 0.8 : 0.3}
                  />
                </g>
              );
            })}
            {sorted.map((d) => {
              const point = points[d.uid];
              const c = catalog.find((c) => c.id === d.kind);
              const powered = states[d.uid]?.powered;
              const used = connections.filter(
                (n) =>
                  n.type === "Ethernet" && (n.from === d.uid || n.to === d.uid),
              ).length;
              return (
                <g
                  className="topology-node"
                  key={d.uid}
                  transform={`translate(${point.x - 94},${point.y - 58})`}
                  tabIndex="0"
                  role="button"
                  aria-label={`Inspect ${d.name}`}
                  onClick={() => select(d.uid)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(d.uid);
                    }
                  }}
                >
                  <rect
                    width="188"
                    height="124"
                    rx="12"
                    fill="#fff"
                    stroke="#d8e2e5"
                  />
                  <image
                    href={photo(d.kind)}
                    x="12"
                    y="17"
                    width="40"
                    height="54"
                  />
                  <text x="61" y="29" className="node-name">
                    {d.name.length > 17 ? d.name.slice(0, 16) + "…" : d.name}
                  </text>
                  <text x="61" y="49" className="node-type">
                    {c.name}
                  </text>
                  <circle
                    cx="66"
                    cy="68"
                    r="3"
                    fill={powered ? "#159b81" : "#a3adb5"}
                  />
                  <text x="75" y="72" className="node-status">
                    {states[d.uid]?.status?.slice(0, 19) || "Ready"}
                  </text>
                  <line x1="12" y1="87" x2="176" y2="87" stroke="#ecf0f1" />
                  <text x="12" y="108" className="node-ip">
                    {d.ip ||
                      (d.kind === "io"
                        ? "S7 backplane"
                        : d.kind === "power"
                          ? "24 V DC / 2.5 A"
                          : "Unmanaged")}
                  </text>
                  {portCapacity[d.kind] && (
                    <text x="176" y="108" textAnchor="end" className="node-ip">
                      {used}/{portCapacity[d.kind]} ports
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="topology-legend">
          {Object.entries(colors)
            .filter(([type]) => layer === "All" || type === layer)
            .map(([type, color]) => (
              <span key={type}>
                <i style={{ background: color }} />
                {type === "PROFINET" ? "Logical I/O assignment" : type}
              </span>
            ))}
          <span className="muted">Dashed = endpoint has no power</span>
        </div>
      </div>
      <div className="section-heading">
        <h3>
          Connection list <span>{shown.length}</span>
        </h3>
      </div>
      <div className="connection-list">
        {shown.map((n) => {
          const i = connections.indexOf(n);
          return (
            <div className="connection-row" key={i}>
              <i style={{ background: colors[n.type] }} />
              <div>
                <strong>{devices.find((d) => d.uid === n.from)?.name}</strong>
                <span>→</span>
                <strong>{devices.find((d) => d.uid === n.to)?.name}</strong>
              </div>
              <span className="pill">{n.type}</span>
              <IconButton
                title={`Remove connection ${i + 1}`}
                onClick={() => remove(i)}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          );
        })}
        {!shown.length && (
          <div className="empty-copy">
            No {layer === "All" ? "" : layer} links yet. Connect devices to
            build this topology.
          </div>
        )}
      </div>
      <p className="panel-hint">
        Ethernet cables occupy physical ports. PROFINET IO assigns the drive to
        a controller and also requires an Ethernet path. A connected 24 V supply
        controls device power; devices without a power link use an independent
        bench supply.
      </p>
    </div>
  );
}
function ConnectionForm({ devices, connections, submit }) {
  const [type, setType] = useState("Ethernet"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const sources = devices.filter((d) =>
    type === "PROFINET"
      ? d.kind === "cpu"
      : type === "Ethernet"
        ? !!portCapacity[d.kind]
        : type === "24 V DC"
          ? d.kind === "power"
          : true,
  );
  const source =
    sources.find((d) => d.uid === from)?.uid || sources[0]?.uid || "";
  const destinations = devices.filter(
    (d) =>
      d.uid !== source &&
      (type === "PROFINET"
        ? ["cpu", "drive"].includes(d.kind)
        : type === "Ethernet"
          ? !!portCapacity[d.kind]
          : type === "24 V DC"
            ? d.kind !== "power"
            : true),
  );
  const destination =
    destinations.find((d) => d.uid === to)?.uid || destinations[0]?.uid || "";
  const label = (d) => {
    const used = connections.filter(
      (c) => c.type === "Ethernet" && (c.from === d.uid || c.to === d.uid),
    ).length;
    return (
      d.name +
      (type === "Ethernet"
        ? ` · ${Math.max(0, portCapacity[d.kind] - used)} free ports`
        : "")
    );
  };
  return (
    <>
      <p className="modal-copy">
        {type === "Ethernet"
          ? "Add a physical network cable between devices."
          : type === "24 V DC"
            ? "Connect a supply’s DC output to a device’s control power."
            : type === "PROFINET"
              ? "Assign a compatible I/O endpoint to a controller. Add Ethernet cabling separately."
              : "Signal links are recorded as project annotations."}
      </p>
      <label>
        Connection type
        <select
          aria-label="Connection type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setFrom("");
            setTo("");
          }}
        >
          {[
            "Ethernet",
            "24 V DC",
            "PROFINET",
            "Digital signal",
            "Analog signal",
          ].map((t) => (
            <option value={t} key={t}>
              {t === "PROFINET" ? "PROFINET IO assignment" : t}
            </option>
          ))}
        </select>
      </label>
      <label>
        From
        <select
          aria-label="Connection source"
          value={source}
          onChange={(e) => setFrom(e.target.value)}
        >
          {sources.map((d) => (
            <option key={d.uid} value={d.uid}>
              {label(d)}
            </option>
          ))}
        </select>
      </label>
      <label>
        To
        <select
          aria-label="Connection destination"
          value={destination}
          onChange={(e) => setTo(e.target.value)}
        >
          {destinations.map((d) => (
            <option key={d.uid} value={d.uid}>
              {label(d)}
            </option>
          ))}
        </select>
      </label>
      {(!source || !destination) && (
        <p className="panel-hint">
          Add a compatible device pair to your assembly first.
        </p>
      )}
      <button
        className="primary wide"
        disabled={!source || !destination}
        onClick={() => submit({ from: source, to: destination, type })}
      >
        <Plus size={17} />
        Add connection
      </button>
    </>
  );
}
function Reference() {
  return (
    <div className="content-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">PRODUCT REFERENCE</span>
          <h1>Grounded in the hardware.</h1>
          <p>
            Exact order numbers, manufacturer photographs and published
            dimensions.
          </p>
        </div>
        <BookOpen size={25} />
      </div>
      <div className="reference-banner">
        <Box size={25} />
        <div>
          <h3>Reconstructed product models</h3>
          <p>
            Device housings, covers, connector groups, vents and labels are
            rebuilt from Siemens photographs and drawings. These are detailed
            procedural models, not manufacturer CAD. Photos below are the
            manufacturer’s reference images, which may show similar variants.
          </p>
        </div>
      </div>
      <div className="reference-products">
        {catalog.map((c) => (
          <a
            key={c.id}
            href={c.datasheet}
            target="_blank"
            rel="noreferrer"
            className="reference-product"
          >
            <ProductImage kind={c.id} />
            <div>
              <span className="eyebrow">{c.family}</span>
              <h3>{c.name}</h3>
              <small className="mono">{c.order}</small>
              <p>
                {c.dimensions.join(" × ")} mm · {c.io}
              </p>
              <p className="reference-description">{c.reference}</p>
              <span className="reference-link">
                Siemens datasheet <ArrowUpRight size={15} />
              </span>
            </div>
          </a>
        ))}
      </div>
      <h3>Simulation coverage</h3>
      <div className="coverage-grid">
        <div>
          <h4>What responds</h4>
          <p>
            CPU scans and live I/O; expansion modules; drive enable and
            acceleration / deceleration; powered Ethernet paths; HMI output
            tags; supply load trip and downstream power loss.
          </p>
        </div>
        <div>
          <h4>What is simplified</h4>
          <p>
            Boolean logic subset, packed project addresses, linear frequency
            ramps and a configurable demo supply trip. No Siemens firmware, real
            network packets, electrical solver, motor mechanics or safety
            certification. HMI screen content is a simulator example.
          </p>
        </div>
      </div>
      <h3>Mechanical drawing sources</h3>
      <div className="manual-links">
        <a
          href="https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/technical-specifications/cpu-1214c/cpu-1214c-wiring-diagrams"
          target="_blank"
          rel="noreferrer"
        >
          CPU 1214C connector pin locations <ArrowUpRight size={15} />
        </a>
        <a
          href="https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/technical-specifications/digital-signal-modules-sms/sm-1223-digital-input/output-v-dc-wiring-diagrams"
          target="_blank"
          rel="noreferrer"
        >
          SM 1223 connector pin locations <ArrowUpRight size={15} />
        </a>
        <a
          href="https://cache.industry.siemens.com/dl/files/808/65647808/att_77988/v1/PSU100C_Handbuch_englisch_en-US.pdf"
          target="_blank"
          rel="noreferrer"
        >
          SITOP PSU100C dimension drawing · p. 15 <ArrowUpRight size={15} />
        </a>
        <a
          href="https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf"
          target="_blank"
          rel="noreferrer"
        >
          SINAMICS G120C housing and interfaces <ArrowUpRight size={15} />
        </a>
        <a
          href={catalog.find((c) => c.id === "switch").manual}
          target="_blank"
          rel="noreferrer"
        >
          SCALANCE XB-000 operating instructions <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);

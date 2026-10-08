import React, { useRef, useState, useEffect, useMemo } from "react";
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
  Move,
  Rotate3D,
  MousePointer2,
  Maximize,
  Focus,
  ScanLine,
  Ruler,
  Cable,
  Layers,
  RotateCcw,
  ArrowLeft,
  RotateCw,
} from "lucide-react";
import { Vector3, Euler } from "three";
import { Device } from "./device-models.jsx";
import { catalog } from "./catalog.js";
import { CameraRig, DinRail } from "./scene.jsx";

class SceneBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-fallback">
        <Box size={40} />
        <h3>3D view unavailable</h3>
        <p>
          Your browser could not start WebGL. The device controls, wiring and
          program still work.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Workspace({
  devices,
  selected,
  select,
  states,
  connections,
  update,
  isolated,
  setIsolated,
}) {
  const selectedObject = useRef(),
    assembly = useRef(),
    orbit = useRef();
  const [command, setCommand] = useState({ action: "fit", id: 0 });
  const [mode, setMode] = useState("select"),
    [grid, setGrid] = useState(false),
    [wires, setWires] = useState(false),
    [dimensions, setDimensions] = useState(false),
    [expanded, setExpanded] = useState(false);
  const d = devices.find((d) => d.uid === selected),
    c = catalog.find((c) => c.id === d?.kind);
  const view = (action) =>
    setCommand((v) => ({
      action,
      id: v.id + 1,
      padding: isolated ? 1.4 : 1.12,
    }));
  useEffect(() => {
    view("fit");
    setMode("select");
  }, [
    isolated,
    devices.length,
    isolated ? selected : null,
    expanded,
    dimensions,
  ]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches("input,textarea,select")) return;
      if (e.key.toLowerCase() === "f") view("fit");
      if (e.key === "Escape") {
        setMode("select");
        setIsolated(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const shown = useMemo(
    () =>
      isolated && d ? [{ ...d, pos: [0, 0, 0], rot: [0, 0, 0] }] : devices,
    [isolated, d, devices],
  );
  return (
    <section className="stage">
      <div className="stage-heading">
        <div className="segmented">
          <button
            className={!isolated ? "active" : ""}
            onClick={() => setIsolated(false)}
          >
            Assembly
          </button>
          <button
            className={isolated ? "active" : ""}
            disabled={!d}
            onClick={() => setIsolated(true)}
          >
            Product detail
          </button>
        </div>
        <span>
          {isolated && c
            ? c.name
            : `${devices.length} devices · physical scale`}
        </span>
      </div>
      <div className="canvas">
        <SceneBoundary>
          <Canvas
            shadows
            frameloop="demand"
            dpr={[1, 1.75]}
            camera={{ position: [3, 2, 8], fov: 35, near: 0.03, far: 2500 }}
            onPointerMissed={() => {
              if (!isolated) select(null);
            }}
          >
            <color attach="background" args={["#e9eeef"]} />
            <ambientLight intensity={0.4} />
            <hemisphereLight args={["#ffffff", "#82909a", 0.9]} />
            <directionalLight
              position={[-3, 6, 8]}
              intensity={2.3}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-9}
              shadow-camera-right={9}
              shadow-camera-top={6}
              shadow-camera-bottom={-6}
              shadow-bias={-0.0003}
            />
            <directionalLight
              position={[6, 2, -4]}
              intensity={1.2}
              color="#d1e3ec"
            />
            <Grid
              visible={grid}
              position={[0, -1.18, 0]}
              args={[50, 50]}
              cellSize={0.5}
              cellThickness={0.45}
              cellColor="#c5ced2"
              sectionSize={2.5}
              sectionColor="#aab7be"
              fadeDistance={15}
              fadeStrength={2}
            />
            <ContactShadows
              position={[0, isolated && c ? -c.h / 2 - 0.14 : -1.18, 0]}
              opacity={0.32}
              scale={isolated ? 8 : 18}
              blur={2.5}
              far={3}
              resolution={256}
              color="#344c5d"
              frames={1}
              key={`${isolated}-${selected}-${devices.map((d) => d.pos.join()).join()}`}
            />
            {!isolated && <DinRail />}
            <group ref={assembly}>
              {shown.map((dev) => (
                <Device
                  key={dev.uid}
                  d={dev}
                  selected={!isolated && selected === dev.uid}
                  onSelect={select}
                  objectRef={selected === dev.uid ? selectedObject : undefined}
                  state={states[dev.uid]}
                  expanded={expanded}
                  dimensions={dimensions && (isolated || selected === dev.uid)}
                  labels={false}
                />
              ))}
            </group>
            {!isolated &&
              wires &&
              connections
                .filter((c) => c.type !== "PROFINET")
                .map((n, i) => {
                  const from = devices.find((d) => d.uid === n.from),
                    to = devices.find((d) => d.uid === n.to);
                  if (!from || !to) return null;
                  const anchor = (dev) => {
                    const c = catalog.find((c) => c.id === dev.kind);
                    return new Vector3(0, -c.h / 2, c.depth / 2)
                      .applyEuler(new Euler(...dev.rot))
                      .add(new Vector3(...dev.pos))
                      .toArray();
                  };
                  const a = anchor(from),
                    b = anchor(to),
                    y = Math.min(a[1], b[1]) - 0.13 - i * 0.03;
                  return (
                    <Line
                      key={i}
                      points={[a, [a[0], y, a[2]], [b[0], y, b[2]], b]}
                      color={n.type === "24 V DC" ? "#c99548" : "#189786"}
                      lineWidth={1.8}
                      transparent
                      opacity={0.8}
                    />
                  );
                })}
            {!isolated && d && mode !== "select" && (
              <TransformControls
                key={selected}
                object={selectedObject}
                mode={mode}
                translationSnap={0.05}
                rotationSnap={Math.PI / 12}
                onMouseUp={(e) => {
                  const obj = e.target.object;
                  update({
                    pos: obj.position.toArray(),
                    rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
                  });
                }}
              />
            )}
            <OrbitControls
              ref={orbit}
              makeDefault
              minDistance={0.5}
              maxDistance={2000}
              maxPolarAngle={Math.PI * 0.85}
            />
            <CameraRig
              command={command}
              assembly={assembly}
              selectedObject={selectedObject}
              orbit={orbit}
            />
          </Canvas>
        </SceneBoundary>
        <div className="stage-caption">
          <span className="eyebrow">
            {isolated ? c?.family : "ENGINEERING WORKBENCH"}
          </span>
          <h2>{isolated ? c?.name : "Built to explore."}</h2>
          <p>
            {isolated
              ? c?.order
              : "Select a device. Inspect the details. Bring it to life."}
          </p>
        </div>
        <div className="scene-tools">
          <button title="Fit view (F)" onClick={() => view("fit")}>
            <Maximize size={17} />
          </button>
          <button title="Front view" onClick={() => view("front")}>
            <ScanLine size={17} />
          </button>
          <button title="Rear view" onClick={() => view("rear")}>
            <RotateCw size={17} />
          </button>
          <button
            title="Focus selected device"
            disabled={!d}
            onClick={() => view("focus")}
          >
            <Focus size={17} />
          </button>
          <span />
          <button
            title="Dimensions"
            aria-pressed={dimensions}
            className={dimensions ? "active" : ""}
            onClick={() => {
              setDimensions(!dimensions);
              if (d) setIsolated(true);
            }}
          >
            <Ruler size={17} />
          </button>
          <button
            title="Open covers"
            aria-pressed={expanded}
            className={expanded ? "active" : ""}
            onClick={() => setExpanded(!expanded)}
          >
            <Layers size={17} />
          </button>
          <button
            title="Grid"
            aria-pressed={grid}
            className={grid ? "active" : ""}
            onClick={() => setGrid(!grid)}
          >
            <Box size={17} />
          </button>
          {!isolated && (
            <button
              title="Wiring overlay"
              aria-pressed={wires}
              className={wires ? "active" : ""}
              onClick={() => setWires(!wires)}
            >
              <Cable size={17} />
            </button>
          )}
        </div>
        {!isolated && (
          <div className="transform-tools">
            {[
              [MousePointer2, "select", "Select"],
              [Move, "translate", "Move device"],
              [Rotate3D, "rotate", "Rotate device"],
            ].map(([Icon, m, title]) => (
              <button
                key={m}
                title={title}
                disabled={m !== "select" && !d}
                className={mode === m ? "active" : ""}
                onClick={() => setMode(m)}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        )}
        <div className="stage-bottom">
          <span>
            {isolated && c
              ? `${c.dimensions.join(" × ")} mm`
              : "1 unit = 100 mm · 35 mm DIN rail"}
          </span>
          <span>Drag to orbit · Scroll or pinch to zoom</span>
        </div>
        {!devices.length && (
          <div className="empty-stage">
            <Box size={44} />
            <h3>Your workbench is empty</h3>
            <p>Add your first device from the library.</p>
          </div>
        )}
      </div>
    </section>
  );
}

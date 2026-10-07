import React, { useEffect, useMemo } from "react";
import { RoundedBox, Line } from "@react-three/drei";
import { BoxGeometry, CanvasTexture, SRGBColorSpace } from "three";
import { catalog } from "./catalog.js";

const graphite = "#303b40",
  shell = "#c2c9c9",
  dark = "#162328";
function Part({
  at = [0, 0, 0],
  size,
  color = shell,
  metal = 0,
  radius = 0,
  ...props
}) {
  const material = (
    <meshStandardMaterial
      color={color}
      metalness={metal}
      roughness={metal ? 0.35 : 0.62}
    />
  );
  return radius ? (
    <RoundedBox
      position={at}
      args={size}
      radius={radius}
      smoothness={2}
      castShadow
      receiveShadow
      {...props}
    >
      {material}
    </RoundedBox>
  ) : (
    <mesh position={at} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      {material}
    </mesh>
  );
}
function Label({
  children,
  at,
  width,
  height = 0.07,
  color = "#dce6e7",
  background,
  align = "center",
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round((1024 * height) / width);
    const ctx = canvas.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = color;
    ctx.font = `600 ${canvas.height * 0.62}px Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(
      String(children),
      align === "left" ? 12 : 512,
      canvas.height / 2,
      1000,
    );
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [children, width, height, color, background, align]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
function Led({ at, on, color = "#7bf2a3", radius = 0.012 }) {
  return (
    <mesh position={at} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, 0.006, 10]} />
      <meshStandardMaterial
        color={on ? color : "#283b35"}
        emissive={on ? color : "#000000"}
        emissiveIntensity={on ? 0.65 : 0}
      />
    </mesh>
  );
}
function Screw({ at, radius = 0.018 }) {
  return (
    <group position={at}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.008, 10]} />
        <meshStandardMaterial
          color="#aab4b7"
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <Part
        at={[0, 0, 0.006]}
        size={[radius * 1.4, 0.004, 0.002]}
        color="#3a4144"
      />
    </group>
  );
}
function Terminals({ count, width, at, color = graphite, lift = 0 }) {
  const pitch = width / count;
  return (
    <group position={[at[0], at[1] + lift, at[2]]}>
      <Part size={[width, 0.125, 0.095]} color={color} />
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[(i - (count - 1) / 2) * pitch, 0, 0]}>
          <Part
            at={[0, -0.031, 0.05]}
            size={[pitch * 0.65, 0.028, 0.007]}
            color="#11191d"
          />
          <Screw at={[0, 0.025, 0.05]} radius={Math.min(0.015, pitch * 0.22)} />
          {i > 0 && (
            <Part
              at={[-pitch / 2, 0, 0.055]}
              size={[0.003, 0.115, 0.006]}
              color="#5c686b"
            />
          )}
        </group>
      ))}
    </group>
  );
}
function Port({ at, active = false, label, width = 0.135 }) {
  return (
    <group position={at}>
      <Part size={[width + 0.028, 0.13, 0.018]} color="#99a4a6" metal={0.8} />
      <Part at={[0, 0, 0.013]} size={[width, 0.099, 0.012]} color="#071317" />
      <Part
        at={[0, -0.048, 0.025]}
        size={[width * 0.46, 0.023, 0.005]}
        color="#081519"
      />
      {Array.from({ length: 8 }, (_, i) => (
        <Part
          key={i}
          at={[((i - 3.5) * width) / 10, 0.027, 0.022]}
          size={[0.005, 0.026, 0.003]}
          color="#c4a164"
          metal={0.75}
        />
      ))}
      <Led at={[-width / 2, 0.064, 0.025]} on={active} radius={0.008} />
      <Led
        at={[width / 2, 0.064, 0.025]}
        on={active}
        color="#ffcf5e"
        radius={0.008}
      />
      {label && (
        <Label at={[width / 2 + 0.044, 0, 0.025]} width={0.06} height={0.04}>
          {label}
        </Label>
      )}
    </group>
  );
}
function Vents({ at, width, count = 8, pitch = 0.035, vertical = false }) {
  return (
    <group position={at}>
      {Array.from({ length: count }, (_, i) => (
        <Part
          key={i}
          at={
            vertical
              ? [(i - (count - 1) / 2) * pitch, 0, 0]
              : [0, (i - (count - 1) / 2) * pitch, 0]
          }
          size={vertical ? [0.012, width, 0.01] : [width, 0.01, 0.01]}
          color="#37454b"
        />
      ))}
    </group>
  );
}
function Plc({ c, state, expanded, io = false }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part size={[w, h, depth]} color="#7b8588" radius={0.025} />
      <Part
        at={[0, 0, z - 0.015]}
        size={[w - 0.025, h * 0.59, 0.055]}
        color="#c5cccb"
        radius={0.018}
      />
      <Part
        at={[0, h * 0.22, z + 0.02]}
        size={[w * 0.94, 0.14, 0.045]}
        color={graphite}
      />
      <Label
        at={[-w * 0.12, h * 0.245, z + 0.048]}
        width={w * 0.55}
        height={0.064}
      >
        SIEMENS
      </Label>
      <Label
        at={[0, h * 0.17, z + 0.048]}
        width={w * 0.91}
        height={0.041}
        color="#aac0c5"
      >
        {io ? "SM 1223 · DI / DQ" : "SIMATIC S7-1200"}
      </Label>
      <Terminals
        count={io ? 10 : 16}
        width={w * 0.94}
        at={[0, h * 0.41, z - 0.018]}
        lift={expanded ? 0.18 : 0}
      />
      <Terminals
        count={io ? 10 : 14}
        width={w * 0.94}
        at={[0, -h * 0.41, z - 0.018]}
        lift={expanded ? -0.18 : 0}
      />
      {[0, 1].map((row) => (
        <group key={row}>
          <Label
            at={[0, row ? -0.185 : 0.055, z + 0.044]}
            width={w * 0.78}
            height={0.035}
            color="#34494b"
          >
            {row ? "DQ · 24 V DC" : "DI · 24 V DC"}
          </Label>
          {(row ? state.outputs : state.inputs)?.map((v, i, a) => (
            <Led
              key={i}
              at={[
                ((i - (a.length - 1) / 2) * w * 0.8) / a.length,
                row ? -0.22 : 0.09,
                z + 0.044,
              ]}
              on={v && state.powered}
              radius={io ? 0.008 : 0.012}
            />
          ))}
        </group>
      ))}
      <Label
        at={[w * 0.13, -0.065, z + 0.044]}
        width={w * 0.56}
        height={0.055}
        color="#263a3c"
      >
        {io ? "8 DI / 8 DQ" : "CPU 1214C"}
      </Label>
      <Led
        at={[-w * 0.36, -0.033, z + 0.044]}
        on={state.powered}
        color={state.running ? "#77e89b" : "#ffcf69"}
      />
      <Label
        at={[-w * 0.21, -0.032, z + 0.044]}
        width={w * 0.2}
        height={0.029}
        color="#354c4f"
      >
        {io ? "DIAG" : "RUN/STOP"}
      </Label>
      {!io && (
        <>
          <Port at={[-w * 0.24, -0.3, z + 0.03]} active={state.running} />
          <Part
            at={[w * 0.2, -0.31, z + 0.028]}
            size={[0.26, 0.028, 0.01]}
            color="#475257"
          />
          <Label
            at={[w * 0.2, -0.27, z + 0.044]}
            width={0.31}
            height={0.032}
            color="#4c6263"
          >
            SIMATIC MEMORY
          </Label>
        </>
      )}
      {io && (
        <Part
          at={[w / 2 + 0.012, 0, -depth * 0.28]}
          size={[0.03, 0.21, 0.25]}
          color={graphite}
        />
      )}
      <Vents at={[0, -0.04, -depth / 2 - 0.006]} width={w * 0.82} count={9} />
      <Part
        at={[0, -0.44, -depth / 2 - 0.035]}
        size={[w * 0.44, 0.09, 0.09]}
        color="#4f595c"
      />
    </>
  );
}
function Supply({ c, state, expanded }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part size={[w, h, depth]} color="#c9ccc5" radius={0.015} />
      <Part
        at={[0, 0.015, z + 0.003]}
        size={[w * 0.88, h * 0.64, 0.018]}
        color="#e0e1d8"
      />
      <Label
        at={[0, 0.225, z + 0.017]}
        width={w * 0.83}
        height={0.066}
        color="#007b78"
      >
        SIEMENS
      </Label>
      <Label
        at={[0, 0.14, z + 0.017]}
        width={w * 0.83}
        height={0.053}
        color="#3c5150"
      >
        SITOP
      </Label>
      <Label
        at={[0, 0.081, z + 0.017]}
        width={w * 0.8}
        height={0.033}
        color="#425552"
      >
        PSU100C
      </Label>
      <Label
        at={[0, -0.03, z + 0.017]}
        width={w * 0.8}
        height={0.046}
        color="#374a44"
      >
        24 V / 2.5 A
      </Label>
      <Led
        at={[-0.1, -0.115, z + 0.023]}
        on={state.powered}
        color={state.overload ? "#ff8971" : "#7bf2a3"}
      />
      <Label
        at={[-0.007, -0.114, z + 0.023]}
        width={0.13}
        height={0.032}
        color="#4f6257"
      >
        DC OK
      </Label>
      <Screw at={[0.115, -0.11, z + 0.024]} radius={0.025} />
      <Terminals
        count={4}
        width={w * 0.91}
        at={[0, 0.32, z - 0.027]}
        lift={expanded ? 0.16 : 0}
        color="#b5b8a9"
      />
      <Terminals
        count={3}
        width={w * 0.91}
        at={[0, -0.32, z - 0.027]}
        lift={expanded ? -0.16 : 0}
        color="#b5b8a9"
      />
      <Label
        at={[0, -0.248, z + 0.035]}
        width={w * 0.85}
        height={0.035}
        color="#44564d"
      >
        L N PE
      </Label>
      <group position={[w / 2 + 0.007, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Vents at={[0, 0, 0]} width={depth * 0.72} count={13} pitch={0.04} />
      </group>
      <group position={[0, h / 2 + 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Vents at={[0, 0, 0]} width={w * 0.82} count={13} pitch={0.06} />
      </group>
    </>
  );
}
function Drive({ c, state, expanded }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part
        at={[0, 0, -depth * 0.34]}
        size={[w, h, depth * 0.32]}
        color="#7c888d"
        metal={0.75}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <Part
          key={i}
          at={[((i - 4) * w) / 10, 0, -depth * 0.45]}
          size={[0.032, h * 0.94, depth * 0.27]}
          color="#a2adb0"
          metal={0.7}
        />
      ))}
      <Part
        at={[0, 0, depth * 0.135]}
        size={[w * 0.96, h * 0.97, depth * 0.73]}
        color="#424c50"
        radius={0.025}
      />
      <Part
        at={[0, 0.3, z + 0.008]}
        size={[w * 0.9, h * 0.42, 0.03]}
        color="#bdc4c2"
        radius={0.015}
      />
      <Label
        at={[0, 0.585, z + 0.031]}
        width={w * 0.84}
        height={0.072}
        color="#008b84"
      >
        SIEMENS
      </Label>
      <Label
        at={[0, 0.48, z + 0.031]}
        width={w * 0.84}
        height={0.048}
        color="#31494c"
      >
        SINAMICS G120C
      </Label>
      <Part
        at={[0, 0.29, z + 0.035]}
        size={[w * 0.71, 0.18, 0.02]}
        color="#172c31"
      />
      <Label
        at={[0, 0.3, z + 0.049]}
        width={w * 0.64}
        height={0.096}
        color="#94e5dd"
      >{`${(state.frequency || 0).toFixed(1)} Hz`}</Label>
      <Label
        at={[0, 0.175, z + 0.03]}
        width={w * 0.72}
        height={0.032}
        color="#54676a"
      >
        VIRTUAL READOUT
      </Label>
      <Led at={[-0.2, 0.07, z + 0.031]} on={state.powered} />
      <Led at={[-0.1, 0.07, z + 0.031]} on={state.enabled} />
      <Vents
        at={[0, -0.17, z + 0.025]}
        width={w * 0.76}
        count={9}
        pitch={0.033}
      />
      <Port at={[-0.16, -0.46, z + 0.018]} active={state.enabled} />
      <Port at={[0.12, -0.46, z + 0.018]} active={state.enabled} />
      <Terminals
        count={3}
        width={w * 0.83}
        at={[0, 0.77, z - 0.12]}
        lift={expanded ? 0.16 : 0}
      />
      <Terminals
        count={3}
        width={w * 0.83}
        at={[0, -0.76, z - 0.12]}
        lift={expanded ? -0.16 : 0}
      />
      <Label at={[0, -0.65, z + 0.012]} width={w * 0.8} height={0.047}>
        U V W
      </Label>
      <group
        position={[w * 0.49 + 0.004, -0.03, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Vents at={[0, 0, 0]} width={depth * 0.6} count={17} pitch={0.071} />
      </group>
    </>
  );
}
function HmiScreen({ state, at, size }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b1f2a";
    ctx.fillRect(0, 0, 800, 480);
    if (state.powered) {
      ctx.fillStyle = "#16434c";
      ctx.fillRect(0, 0, 800, 64);
      ctx.fillStyle = "#83e5de";
      ctx.font = "bold 23px Arial";
      ctx.fillText("MACHINE OVERVIEW", 28, 41);
      ctx.fillStyle = state.connected ? "#85efae" : "#e6ba6d";
      ctx.font = "18px Arial";
      ctx.fillText(state.status || "PLC STOP", 565, 40);
      ctx.fillStyle = "#d3e2e6";
      ctx.font = "18px Arial";
      ctx.fillText("Conveyor · virtual process", 30, 112);
      ctx.strokeStyle = "#54717e";
      ctx.lineWidth = 12;
      ctx.strokeRect(78, 160, 630, 106);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = state.outputs?.[0] ? "#00c4b1" : "#4e6875";
        ctx.fillRect(94 + i * 61, 175, 44, 77);
      }
      ctx.font = "16px Arial";
      ctx.fillStyle = "#93b3be";
      ctx.fillText("DIGITAL OUTPUTS", 30, 325);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = state.outputs?.[i] ? "#60e5a2" : "#264453";
        ctx.fillRect(30 + i * 73, 343, 57, 45);
        ctx.fillStyle = "#d9f0ef";
        ctx.font = "14px Arial";
        ctx.fillText(`Q${Math.floor(i / 8)}.${i % 8}`, 40 + i * 73, 371);
      }
      ctx.fillStyle = "#183340";
      ctx.fillRect(0, 421, 800, 59);
      ctx.fillStyle = "#90b6c1";
      ctx.font = "16px Arial";
      ctx.fillText(
        state.connected
          ? "Ethernet path connected · live PLC bits"
          : "Connect panel to the PLC through Ethernet",
        28,
        457,
      );
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [state.powered, state.connected, state.status, state.outputs?.join()]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
function Hmi({ c, state, expanded }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part
        at={[0, 0, -0.05 - (expanded ? 0.2 : 0)]}
        size={[1.98, 1.42, depth * 0.77]}
        color="#344247"
        radius={0.04}
      />
      <Part
        at={[0, 0, z - 0.045]}
        size={[w, h, 0.09]}
        color="#bcc3c5"
        radius={0.04}
      />
      <Part
        at={[0, 0.09, z + 0.007]}
        size={[1.621, 0.939, 0.025]}
        color="#18272d"
        radius={0.018}
      />
      <HmiScreen
        at={[0, 0.09, z + 0.023]}
        size={[1.541, 0.859]}
        state={state}
      />
      <Label
        at={[-0.63, h * 0.442, z + 0.004]}
        width={0.53}
        height={0.065}
        color="#007f80"
      >
        SIEMENS
      </Label>
      <Label
        at={[0.66, h * 0.445, z + 0.004]}
        width={0.49}
        height={0.039}
        color="#415963"
      >
        SIMATIC HMI
      </Label>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[(i - 3.5) * 0.225, -h * 0.373, z + 0.012]}>
          <Part size={[0.17, 0.16, 0.02]} color="#586775" radius={0.012} />
          <Label
            at={[0, 0, 0.015]}
            width={0.12}
            height={0.055}
          >{`F${i + 1}`}</Label>
        </group>
      ))}
      <group
        position={[0, -0.5, -depth / 2 - 0.009]}
        rotation={[0, Math.PI, 0]}
      >
        <Port at={[0.45, 0, 0]} active={state.connected} />
        <Terminals count={3} width={0.3} at={[-0.35, 0, 0]} />
      </group>
    </>
  );
}
function Switch({ c, state, expanded }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part size={[w, h, depth]} color="#3b515f" radius={0.015} />
      <Part
        at={[0, 0, z + 0.006]}
        size={[w * 0.93, h * 0.94, 0.02]}
        color="#304959"
      />
      <Label at={[0, 0.422, z + 0.02]} width={w * 0.86} height={0.052}>
        SIEMENS
      </Label>
      <Label
        at={[0, 0.359, z + 0.02]}
        width={w * 0.89}
        height={0.033}
        color="#bbd0d8"
      >
        SCALANCE XB005
      </Label>
      {Array.from({ length: 5 }, (_, i) => (
        <Port
          key={i}
          at={[-0.018, 0.24 - i * 0.154, z + 0.025 + (expanded ? 0.1 : 0)]}
          active={state.ports?.[i]}
          label={i + 1}
          width={0.16}
        />
      ))}
      <Led at={[-0.13, -0.447, z + 0.03]} on={state.powered} />
      <Label at={[0.015, -0.447, z + 0.03]} width={0.22} height={0.033}>
        24 V AC/DC
      </Label>
      <group
        position={[0, h / 2 + 0.01, depth * 0.27]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <Terminals count={3} width={0.34} at={[0, 0, 0]} color="#4c9c75" />
      </group>
      <group position={[w / 2 + 0.006, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Vents at={[0, 0, 0]} width={depth * 0.63} count={14} pitch={0.048} />
      </group>
    </>
  );
}
function Dimensions({ c }) {
  const { w, h, depth } = c,
    z = depth / 2 + 0.13,
    color = "#6acfc5";
  return (
    <>
      <Line
        points={[
          [-w / 2, -h / 2 - 0.1, z],
          [-w / 2, -h / 2 - 0.22, z],
          [w / 2, -h / 2 - 0.22, z],
          [w / 2, -h / 2 - 0.1, z],
        ]}
        color={color}
        lineWidth={1}
      />
      <Label
        at={[0, -h / 2 - 0.3, z]}
        width={Math.max(w, 0.65)}
        height={0.08}
        color={color}
      >{`${c.dimensions[0]} mm`}</Label>
      <Line
        points={[
          [w / 2 + 0.1, -h / 2, z],
          [w / 2 + 0.2, -h / 2, z],
          [w / 2 + 0.2, h / 2, z],
          [w / 2 + 0.1, h / 2, z],
        ]}
        color={color}
        lineWidth={1}
      />
      <Label
        at={[w / 2 + 0.53, 0, z]}
        width={0.58}
        height={0.08}
        color={color}
      >{`${c.dimensions[1]} mm`}</Label>
    </>
  );
}

export function Device({
  d,
  selected,
  onSelect,
  state = {},
  objectRef,
  expanded,
  dimensions,
  labels,
}) {
  const c = catalog.find((x) => x.id === d.kind);
  const outline = useMemo(
    () => new BoxGeometry(c.w + 0.05, c.h + 0.05, c.depth + 0.05),
    [c],
  );
  useEffect(() => () => outline.dispose(), [outline]);
  return (
    <group
      ref={objectRef}
      position={d.pos}
      rotation={d.rot}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(d.uid);
      }}
    >
      {d.kind === "cpu" && <Plc c={c} state={state} expanded={expanded} />}
      {d.kind === "io" && <Plc c={c} state={state} expanded={expanded} io />}
      {d.kind === "power" && <Supply c={c} state={state} expanded={expanded} />}
      {d.kind === "drive" && <Drive c={c} state={state} expanded={expanded} />}
      {d.kind === "hmi" && <Hmi c={c} state={state} expanded={expanded} />}
      {d.kind === "switch" && (
        <Switch c={c} state={state} expanded={expanded} />
      )}
      {selected && (
        <lineSegments>
          <edgesGeometry args={[outline]} />
          <lineBasicMaterial color="#39d8c4" transparent opacity={0.75} />
        </lineSegments>
      )}
      {selected && dimensions && <Dimensions c={c} />}
      {labels && (
        <Label
          at={[0, c.h / 2 + 0.19, c.depth / 2]}
          width={Math.max(0.72, c.w)}
          height={0.09}
          color={selected ? "#91ede1" : "#d8e8ed"}
        >
          {d.name}
        </Label>
      )}
    </group>
  );
}

// Crisp, code-native thumbnails share the same recognizable silhouettes as the 3D models.
export function DeviceThumbnail({ kind }) {
  return (
    <svg className="device-thumbnail" viewBox="0 0 72 84" aria-hidden="true">
      <defs>
        <linearGradient id={`body-${kind}`} x2="1" y2="1">
          <stop stopColor="#dae1e0" />
          <stop offset="1" stopColor="#83979b" />
        </linearGradient>
      </defs>
      {kind === "hmi" ? (
        <>
          <path d="M5 18h59v48H5z" fill="#b8c6cd" />
          <path d="M11 24h47v31H11z" fill="#153947" />
          <path
            d="M16 29h37v3H16zm0 7h16v12H16zm20 0h17v12H36z"
            fill="#36b6a7"
          />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={12 + i * 6}
              y="59"
              width="4"
              height="3"
              fill="#516878"
            />
          ))}
        </>
      ) : kind === "drive" ? (
        <>
          <path d="M23 7h30v65H23z" fill="#839399" />
          <path d="M18 10h31v64H18z" fill="#3b4e54" />
          <path d="M20 12h27v29H20z" fill="#c4cecd" />
          <path d="M25 25h17v9H25z" fill="#173b42" />
          <path d="M27 28h12v2H27z" fill="#8cdbbc" />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M24 ${46 + i * 3}h19v1H24z`} fill="#182e36" />
          ))}
        </>
      ) : (
        <>
          <path
            d={kind === "cpu" ? "M12 15h48v55H12z" : "M23 12h28v59H23z"}
            fill={`url(#body-${kind})`}
          />
          <path
            d={
              kind === "cpu"
                ? "M12 15h48v10H12zm0 44h48v11H12z"
                : "M23 12h28v9H23zm0 41h28v30H23z"
            }
            fill={kind === "power" ? "#aab7ac" : "#344b55"}
          />
          {kind === "switch" ? (
            Array.from({ length: 5 }, (_, i) => (
              <g key={i}>
                <rect
                  x="31"
                  y={23 + i * 9}
                  width="12"
                  height="7"
                  fill="#8aa2a9"
                />
                <rect
                  x="33"
                  y={25 + i * 9}
                  width="8"
                  height="4"
                  fill="#15333e"
                />
                <circle cx="28" cy={26 + i * 9} r="1" fill="#87e6aa" />
              </g>
            ))
          ) : (
            <>
              <path
                d={kind === "cpu" ? "M15 28h41v11H15z" : "M25 24h24v10H25z"}
                fill={kind === "power" ? "#d9e0d3" : "#2f4650"}
              />
              <text
                x={kind === "cpu" ? 18 : 26}
                y="33"
                fontSize="5"
                fill={kind === "power" ? "#007d72" : "#d8e8e4"}
                fontWeight="bold"
              >
                SIEMENS
              </text>
              <circle
                cx={kind === "cpu" ? 18 : 27}
                cy="43"
                r="1.5"
                fill="#55d299"
              />
              {Array.from({ length: 4 }, (_, i) => (
                <path
                  key={i}
                  d={`M${kind === "cpu" ? 23 : 30} ${43 + i * 3}h${kind === "cpu" ? 26 : 14}v1h-${kind === "cpu" ? 26 : 14}z`}
                  fill="#70868b"
                />
              ))}
            </>
          )}
        </>
      )}
      <path d="M15 77h44" stroke="#a7c4c4" strokeWidth="2" opacity=".4" />
    </svg>
  );
}

import React, { useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { RoundedBox, Line } from "@react-three/drei";
import { BoxGeometry, CanvasTexture, SRGBColorSpace, Matrix4 } from "three";
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
      <Part size={[width + 0.028, 0.13, 0.018]} color="#b7c2c7" metal={0.45} />
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
// Geometry is reconstructed from Siemens product photographs and connector drawings.
// Connector covers are closed in the normal product view and opened for inspection.
function VentGrid({ width, height, columns, rows }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const matrix = new Matrix4();
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        matrix.makeTranslation(
          ((col - (columns - 1) / 2) * width) / columns,
          ((row - (rows - 1) / 2) * height) / rows,
          0,
        );
        ref.current.setMatrixAt(row * columns + col, matrix);
      }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [width, height, columns, rows]);
  return (
    <instancedMesh ref={ref} args={[null, null, columns * rows]}>
      <boxGeometry
        args={[(width / columns) * 0.65, (height / rows) * 0.65, 0.008]}
      />
      <meshStandardMaterial color="#28353e" roughness={0.8} />
    </instancedMesh>
  );
}
function RatingPlate({ at, width, height, lines, rotation = [0, 0, 0] }) {
  return (
    <group position={at} rotation={rotation}>
      <Part size={[width, height, 0.004]} color="#b7bcb9" />
      {lines.map((line, i) => (
        <Label
          key={i}
          at={[0, height / 2 - ((i + 0.7) * height) / lines.length, 0.003]}
          width={width * 0.93}
          height={(height / lines.length) * 0.77}
          color="#303b41"
          align="left"
        >
          {line}
        </Label>
      ))}
    </group>
  );
}
function Clip({ c }) {
  return (
    <group position={[0, 0, -c.depth / 2]}>
      <Part
        at={[0, 0.28, -0.025]}
        size={[c.w * 0.7, 0.045, 0.07]}
        color="#606970"
      />
      <Part
        at={[0, -0.28, -0.025]}
        size={[c.w * 0.7, 0.045, 0.07]}
        color="#606970"
      />
      <Part
        at={[0, -c.h / 2 + 0.05, -0.032]}
        size={[0.13, 0.12, 0.035]}
        color="#b0babd"
      />
      <Part
        at={[0, -c.h / 2 + 0.025, -0.054]}
        size={[0.055, 0.014, 0.016]}
        color="#242b30"
      />
    </group>
  );
}
function Plc({ c, state, expanded, io = false }) {
  const { w, h, depth } = c,
    z = depth / 2;
  const cover = "#4b5866",
    body = "#44515e",
    print = "#d0d5d6";
  const inputCount = io ? 8 : 14,
    outputCount = io ? 8 : 10;
  return (
    <>
      <Part
        at={[0, 0, -0.025]}
        size={[w - 0.012, h - 0.02, depth - 0.05]}
        color={body}
        radius={0.014}
      />
      <Part
        at={[0, 0, z - 0.045]}
        size={[w - 0.016, 0.27, 0.07]}
        color="#566471"
      />
      {/* Hinged upper and lower terminal shields. */}
      <group
        position={[0, 0.14, z - 0.03]}
        rotation={[expanded ? 1.5 : 0, 0, 0]}
      >
        <Part
          at={[0, 0.17, 0.01]}
          size={[w - 0.022, 0.337, 0.035]}
          color={cover}
          radius={0.008}
        />
        {!io && (
          <>
            <Label
              at={[-w * 0.32, 0.273, 0.03]}
              width={0.25}
              height={0.042}
              background="#009b99"
            >
              SIEMENS
            </Label>
            <Label
              at={[w * 0.34, 0.25, 0.03]}
              width={0.22}
              height={0.052}
              color={print}
            >
              SIMATIC
            </Label>
            <Label
              at={[w * 0.34, 0.206, 0.03]}
              width={0.22}
              height={0.038}
              color={print}
            >
              S7-1200
            </Label>
          </>
        )}
      </group>
      <group
        position={[0, -0.14, z - 0.03]}
        rotation={[expanded ? -1.5 : 0, 0, 0]}
      >
        <Part
          at={[0, -0.167, 0.009]}
          size={[w - 0.022, 0.327, 0.035]}
          color={cover}
          radius={0.008}
        />
        <Part
          at={[0, -0.318, 0.025]}
          size={[w * 0.5, 0.022, 0.009]}
          color={cover}
        />
      </group>
      {[0.141, -0.141].map((y) => (
        <group key={y}>
          <Part
            at={[0, y, z - 0.004]}
            size={[w - 0.018, 0.012, 0.022]}
            color="#434f57"
          />
          {Array.from({ length: io ? 7 : 16 }, (_, i) => (
            <Part
              key={i}
              at={[
                ((i - ((io ? 7 : 16) - 1) / 2) * w) / (io ? 8 : 17),
                y,
                z + 0.006,
              ]}
              size={[0.021, 0.018, 0.008]}
              color="#63717b"
            />
          ))}
        </group>
      ))}
      {/* Recessed terminal groups; exact CPU X10=20, X11=3, X12=12. */}
      {io ? (
        <>
          <Terminals count={7} width={w * 0.86} at={[0, 0.38, z - 0.075]} />
          <Terminals count={7} width={w * 0.86} at={[0, 0.245, z - 0.1]} />
          <Terminals count={7} width={w * 0.86} at={[0, -0.38, z - 0.075]} />
          <Terminals count={7} width={w * 0.86} at={[0, -0.245, z - 0.1]} />
        </>
      ) : (
        <>
          <Terminals
            count={20}
            width={w * 0.72}
            at={[-w * 0.115, 0.39, z - 0.07]}
          />
          <Terminals
            count={3}
            width={w * 0.15}
            at={[w * 0.38, 0.39, z - 0.07]}
          />
          <Terminals
            count={12}
            width={w * 0.53}
            at={[w * 0.2, -0.39, z - 0.07]}
          />
          <group position={[-w * 0.34, -0.35, z - 0.05]}>
            <Port at={[0, 0, 0]} active={state.powered} />
          </group>
          <Label
            at={[-w * 0.34, -0.246, z - 0.03]}
            width={0.23}
            height={0.027}
            color={print}
          >
            X1 P1 · PN
          </Label>
          <Label
            at={[0, 0.282, z - 0.04]}
            width={w * 0.88}
            height={0.028}
            color={print}
          >
            L+ M ⏚ L+ M 1M .0 .1 .2 .3 .4 .5 .6 .7 .0 .1 .2 .3 .4 .5 2M 0 1
          </Label>
          <Label
            at={[w * 0.2, -0.28, z - 0.04]}
            width={w * 0.53}
            height={0.028}
            color={print}
          >
            3L+ 3M .0 .1 .2 .3 .4 .5 .6 .7 .0 .1
          </Label>
        </>
      )}
      <Part
        at={[io ? -0.09 : -0.19, 0, z + 0.006]}
        size={[io ? 0.14 : 0.31, 0.224, 0.026]}
        color={cover}
        radius={0.005}
      />
      {!io && (
        <>
          {["RUN / STOP", "ERROR", "MAINT"].map((text, i) => (
            <group key={text}>
              <Led
                at={[-w * 0.455, 0.064 - i * 0.05, z + 0.025]}
                on={i === 0 && state.powered}
                color={state.running ? "#72e784" : "#e4b044"}
                radius={0.008}
              />
              <Label
                at={[-w * 0.365, 0.064 - i * 0.05, z + 0.026]}
                width={0.15}
                height={0.024}
                color={print}
                align="left"
              >
                {text}
              </Label>
            </group>
          ))}
          <Part
            at={[-0.02, 0, z + 0.022]}
            size={[0.015, 0.22, 0.004]}
            color="#5e6b73"
          />
        </>
      )}
      {io && (
        <Led
          at={[-w * 0.34, 0.008, z + 0.012]}
          on={state.attached && state.powered}
          radius={0.009}
        />
      )}
      {[0, 1].map((row) => (
        <group key={row}>
          {Array.from({ length: row ? outputCount : inputCount }, (_, i) => {
            const n = row ? outputCount : inputCount;
            const left = io ? 0 : w * 0.255;
            return (
              <group
                key={i}
                position={[
                  left + (i - (n - 1) / 2) * (io ? 0.033 : 0.036),
                  row ? -0.099 : 0.099,
                  z + 0.028,
                ]}
              >
                <Led
                  at={[0, 0, 0.005]}
                  on={
                    (row ? state.outputs : state.inputs)?.[i] && state.powered
                  }
                  radius={0.006}
                />
                <Label
                  at={[0, row ? 0.026 : -0.026, 0.005]}
                  width={0.026}
                  height={0.016}
                  color={print}
                >
                  {i % 8}
                </Label>
              </group>
            );
          })}
        </group>
      ))}
      <Label
        at={[w * 0.22, 0.025, z + 0.012]}
        width={w * (io ? 0.58 : 0.36)}
        height={0.03}
        color={print}
      >
        {io ? "SM 1223" : "CPU 1214C"}
      </Label>
      <Label
        at={[w * 0.22, -0.018, z + 0.012]}
        width={w * (io ? 0.6 : 0.36)}
        height={0.025}
        color={print}
      >
        {io ? "DC / DC" : "DC / DC / DC"}
      </Label>
      <Label
        at={[w * 0.2, -0.055, z + 0.012]}
        width={w * (io ? 0.65 : 0.45)}
        height={0.018}
        color={print}
      >
        {c.order.replace("6ES7", "")}
      </Label>
      <group position={[w / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <RatingPlate
          at={[0, 0.08, 0]}
          width={depth * 0.65}
          height={0.31}
          lines={[
            "SIEMENS",
            c.order,
            c.name,
            "24 V DC",
            c.io,
            "CE   UKCA   EAC",
            "SIMATIC S7-1200",
          ]}
        />
        <Vents
          at={[0, -0.31, 0]}
          width={depth * 0.65}
          count={5}
          pitch={0.025}
        />
      </group>
      <group
        position={[0, h / 2 - 0.006, -0.11]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <VentGrid
          width={w * 0.87}
          height={0.39}
          columns={io ? 8 : 20}
          rows={5}
        />
      </group>
      <Part
        at={[w / 2 - 0.008, 0, -0.2]}
        size={[0.016, 0.24, 0.21]}
        color="#4c5962"
      />
      <Clip c={c} />
    </>
  );
}
function Supply({ c, state }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part size={[w, h, depth]} color="#404b56" radius={0.006} />
      <Part
        at={[-w / 2 + 0.028, 0, z + 0.005]}
        size={[0.056, h - 0.02, 0.012]}
        color="#62a3a0"
      />
      <group
        position={[-w / 2 + 0.028, 0, z + 0.013]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <Label at={[0, 0, 0]} width={0.54} height={0.038} color="#edf4ee">
          SITOP PSU100C
        </Label>
      </group>
      <Part
        at={[0.025, 0, z + 0.004]}
        size={[w - 0.105, 0.44, 0.013]}
        color="#46525e"
      />
      <Label
        at={[w * 0.29, 0.188, z + 0.019]}
        width={0.16}
        height={0.027}
        color="#dbe2e1"
      >
        SIEMENS
      </Label>
      <Led
        at={[-0.096, 0.087, z + 0.02]}
        on={state.powered && !state.overload}
        radius={0.009}
      />
      <Label
        at={[-0.02, 0.086, z + 0.02]}
        width={0.11}
        height={0.024}
        color="#dde3df"
      >
        DC OK
      </Label>
      <Screw at={[-0.096, 0.008, z + 0.022]} radius={0.025} />
      <Label
        at={[-0.01, 0.005, z + 0.02]}
        width={0.14}
        height={0.023}
        color="#d1d6d4"
      >
        ADJUST
      </Label>
      <Label
        at={[0.002, -0.029, z + 0.02]}
        width={0.16}
        height={0.021}
        color="#d1d6d4"
      >
        22.2–26.4 V
      </Label>
      <RatingPlate
        at={[0.08, -0.148, z + 0.018]}
        width={0.22}
        height={0.1}
        lines={["24 V DC / 2.5 A", c.order, "CE  UKCA"]}
      />
      <Terminals
        count={3}
        width={0.155}
        at={[-0.093, 0.316, z - 0.024]}
        color="#28323b"
      />
      <Terminals
        count={3}
        width={0.155}
        at={[-0.093, -0.316, z - 0.024]}
        color="#28323b"
      />
      <Label
        at={[-0.093, 0.23, z + 0.02]}
        width={0.15}
        height={0.028}
        color="#dce3e2"
      >
        + − −
      </Label>
      <Label
        at={[-0.093, -0.224, z + 0.02]}
        width={0.15}
        height={0.025}
        color="#dce3e2"
      >
        L1 N PE
      </Label>
      {[0.31, -0.31].map((y) => (
        <Vents
          key={y}
          at={[0.106, y, z + 0.018]}
          width={0.15}
          count={6}
          pitch={0.032}
          vertical
        />
      ))}
      <group position={[0, h / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <VentGrid
          width={w * 0.83}
          height={depth * 0.88}
          columns={6}
          rows={10}
        />
      </group>
      <group position={[w / 2 + 0.004, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <RatingPlate
          at={[0, 0.03, 0]}
          width={0.57}
          height={0.4}
          lines={[
            "SIEMENS",
            c.order,
            "SITOP PSU100C",
            "INPUT 120–230 V AC",
            "OUTPUT 24 V DC / 2.5 A",
            "CE  UKCA  EAC",
            "60 W",
          ]}
        />
      </group>
      <Clip c={c} />
    </>
  );
}
function Drive({ c, state, expanded }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part
        at={[0, 0, -depth * 0.35]}
        size={[w - 0.02, h - 0.04, depth * 0.3]}
        color="#6e7479"
        metal={0.65}
      />
      {Array.from({ length: 11 }, (_, i) => (
        <Part
          key={i}
          at={[(i - 5) * 0.061, 0, -depth * 0.39]}
          size={[0.017, h - 0.08, depth * 0.23]}
          color="#a2aaac"
          metal={0.75}
        />
      ))}
      <Part
        at={[0, 0, 0.18]}
        size={[w - 0.006, h - 0.01, depth - 0.36]}
        color="#5d666e"
        radius={0.012}
      />
      <Part
        at={[0, 0.16, z - 0.025]}
        size={[w * 0.89, h * 0.69, 0.044]}
        color="#727b83"
        radius={0.009}
      />
      <group
        position={[0, 0.73, z - 0.008]}
        rotation={[expanded ? -1.2 : 0, 0, 0]}
      >
        <Part
          at={[0, -0.54, 0.026]}
          size={[w * 0.86, 1.09, 0.028]}
          color="#46525f"
          radius={0.008}
        />
        <Label
          at={[-0.2, -0.06, 0.043]}
          width={0.25}
          height={0.038}
          color="#edf5f3"
          background="#009b99"
        >
          SIEMENS
        </Label>
      </group>
      <Part
        at={[0, 0.35, z - 0.01]}
        size={[0.48, 0.31, 0.022]}
        color="#333e47"
      />
      <Part
        at={[0, 0.37, z + 0.006]}
        size={[0.14, 0.025, 0.01]}
        color="#b5bdbe"
        metal={0.65}
      />
      <Label at={[0, 0.17, z + 0.01]} width={0.47} height={0.03}>
        OPERATOR PANEL INTERFACE
      </Label>
      <RatingPlate
        at={[0, -0.61, z + 0.006]}
        width={w * 0.82}
        height={0.29}
        lines={[
          "SINAMICS G120C",
          c.order,
          "3 AC 380–480 V  0.75 kW",
          "WARNING  ⚠  ATTENTION",
          "Read operating instructions",
          "CE  UKCA   EAC",
        ]}
      />
      {[-1, 1].map((side) => (
        <Vents
          key={side}
          at={[side * w * 0.457, 0.14, z + 0.018]}
          width={0.92}
          count={4}
          pitch={0.017}
          vertical
        />
      ))}
      {["RDY", "BF", "SAFE"].map((name, i) => (
        <group key={name}>
          <Led
            at={[-0.23 + i * 0.155, -0.402, z + 0.025]}
            on={
              i === 0
                ? state.powered
                : i === 1 && state.status === "Network disconnected"
            }
            color={i === 1 ? "#ed684b" : "#8ee37b"}
            radius={0.009}
          />
          <Label
            at={[-0.19 + i * 0.155, -0.402, z + 0.028]}
            width={0.07}
            height={0.022}
          >
            {name}
          </Label>
        </group>
      ))}
      <group
        position={[0, -h / 2 + 0.02, depth * 0.19]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <Port at={[-0.14, 0, 0]} active={state.enabled} />
        <Port at={[0.14, 0, 0]} active={state.enabled} />
        <Terminals count={6} width={w * 0.86} at={[0, 0.32, 0]} />
      </group>
      <group position={[0, h / 2 + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Terminals count={3} width={0.52} at={[0, -0.49, 0]} />
        <Vents at={[0, 0.57, 0]} width={0.6} count={8} pitch={0.036} />
        <mesh position={[0, 0.04, 0.006]}>
          <circleGeometry args={[0.165, 32]} />
          <meshStandardMaterial color="#2d373e" />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <Part
            key={i}
            at={[0, 0.04, 0.013]}
            size={[0.32, 0.014, 0.012]}
            color="#8a959a"
            rotation={[0, 0, (i * Math.PI) / 5]}
          />
        ))}
      </group>
      <group
        position={[w / 2 + 0.004, 0.37, -0.34]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <RatingPlate
          at={[0, 0, 0]}
          width={0.57}
          height={0.38}
          lines={[
            "SIEMENS",
            c.order,
            "SINAMICS G120C PN",
            "0.75 kW / 0.55 kW",
            "3 AC 380–480 V",
            "CE   UKCA",
          ]}
        />
      </group>
      <Part
        at={[0, h / 2 + 0.035, -depth / 2 + 0.07]}
        size={[0.36, 0.08, 0.055]}
        color="#a0aaae"
        metal={0.7}
      />
      <Screw at={[0, h / 2 + 0.037, -depth / 2 + 0.103]} radius={0.026} />
      <Part
        at={[0, -h / 2 - 0.035, -depth / 2 + 0.07]}
        size={[0.36, 0.08, 0.055]}
        color="#a0aaae"
        metal={0.7}
      />
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
        at={[0, 0, -0.031 - (expanded ? 0.2 : 0)]}
        size={[1.96, 1.4, 0.39]}
        color="#344247"
        radius={0.04}
      />
      <Part
        at={[0, 0, z - 0.031]}
        size={[w, h, 0.062]}
        color="#293840"
        radius={0.04}
      />
      <Part
        at={[0, 0, z + 0.002]}
        size={[w - 0.06, h - 0.06, 0.009]}
        color="#526979"
        radius={0.022}
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
        at={[-0.63, h * 0.442, z + 0.012]}
        width={0.53}
        height={0.065}
        color="#e0eded"
      >
        SIEMENS
      </Label>
      <Label
        at={[0.66, h * 0.445, z + 0.012]}
        width={0.49}
        height={0.039}
        color="#e1e6e7"
      >
        SIMATIC HMI
      </Label>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[(i - 3.5) * 0.225, -h * 0.373, z + 0.012]}>
          <Part size={[0.17, 0.16, 0.02]} color="#6b7e8e" radius={0.012} />
          <Label
            at={[0, 0, 0.015]}
            width={0.12}
            height={0.055}
          >{`F${i + 1}`}</Label>
        </group>
      ))}
      <group
        position={[0, -0.7, -0.01 - (expanded ? 0.2 : 0)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <Port at={[-0.4, 0, 0]} active={state.connected} />
        <Terminals count={2} width={0.15} at={[0.44, 0, 0]} />
        <Part
          at={[-0.12, 0, 0]}
          size={[0.16, 0.065, 0.015]}
          color="#aab7bc"
          metal={0.7}
        />
        <Part
          at={[-0.12, 0, 0.012]}
          size={[0.135, 0.045, 0.008]}
          color="#101d25"
        />
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.984, 0, -0.08]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        >
          <Vents at={[0, 0, 0]} width={0.21} count={12} pitch={0.072} />
        </group>
      ))}
      <group
        position={[0, 0, -0.233 - (expanded ? 0.2 : 0)]}
        rotation={[0, Math.PI, 0]}
      >
        <RatingPlate
          at={[0, 0.12, 0]}
          width={0.75}
          height={0.47}
          lines={[
            "SIEMENS",
            c.order,
            "SIMATIC HMI",
            "KTP700 BASIC PN",
            "24 V DC / 0.23 A",
            "CE  UKCA",
          ]}
        />
      </group>
    </>
  );
}
function Switch({ c, state }) {
  const { w, h, depth } = c,
    z = depth / 2;
  return (
    <>
      <Part size={[w, h, depth]} color="#4c5a65" radius={0.007} />
      <Part
        at={[0, 0, z + 0.002]}
        size={[w - 0.027, h - 0.025, 0.012]}
        color="#54636f"
      />
      <Label
        at={[-0.07, 0.433, z + 0.012]}
        width={0.24}
        height={0.032}
        color="#e4e9e8"
      >
        SIEMENS
      </Label>
      <Label
        at={[0, 0.38, z + 0.012]}
        width={0.36}
        height={0.025}
        color="#d5dcdd"
      >
        SCALANCE XB005
      </Label>
      {[
        [0.1, 0.17],
        [-0.105, -0.025],
        [0.1, -0.025],
        [-0.105, -0.22],
        [0.1, -0.22],
      ].map(([x, y], i) => (
        <group key={i}>
          <Port at={[x, y, z + 0.01]} width={0.147} active={state.ports?.[i]} />
          <Label
            at={[x, y - 0.092, z + 0.02]}
            width={0.1}
            height={0.024}
            color="#d8dfe0"
          >
            {i + 1}
          </Label>
        </group>
      ))}
      <Led at={[-0.15, -0.405, z + 0.02]} on={state.powered} radius={0.009} />
      <Label
        at={[-0.082, -0.405, z + 0.02]}
        width={0.09}
        height={0.025}
        color="#d7dedd"
      >
        L1
      </Label>
      <group
        position={[0, -h / 2 - 0.015, 0.15]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <Terminals count={3} width={0.3} at={[0, 0, 0]} color="#4a535b" />
      </group>
      <group position={[0, h / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <VentGrid width={w * 0.8} height={depth * 0.8} columns={4} rows={7} />
      </group>
      <group position={[w / 2 + 0.004, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <RatingPlate
          at={[0, 0.03, 0]}
          width={0.52}
          height={0.47}
          lines={[
            "SCALANCE XB005",
            c.order,
            "24 V AC/DC",
            "5 × 10/100 Mbit/s",
            "CE  UKCA  EAC",
            "SIEMENS",
          ]}
        />
      </group>
      <Clip c={c} />
    </>
  );
}
function Dimensions({ c }) {
  const { w, h, depth } = c,
    z = depth / 2 + 0.13,
    color = "#087c7a";
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
      <group
        position={[w / 2 + 0.28, -h / 2 - 0.2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Line
          points={[
            [-depth / 2, 0, 0],
            [-depth / 2, -0.08, 0],
            [depth / 2, -0.08, 0],
            [depth / 2, 0, 0],
          ]}
          color={color}
          lineWidth={1}
        />
        <Label
          at={[0, -0.17, 0]}
          width={Math.max(0.45, depth * 0.7)}
          height={0.06}
          color={color}
        >{`${c.dimensions[2]} mm`}</Label>
      </group>
    </>
  );
}

function DeviceModel({
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
          <lineBasicMaterial color="#149a92" transparent opacity={0.32} />
        </lineSegments>
      )}
      {dimensions && <Dimensions c={c} />}
      {labels && (
        <Label
          at={[0, c.h / 2 + 0.19, c.depth / 2]}
          width={Math.max(0.72, c.w)}
          height={0.09}
          color={selected ? "#087c7a" : "#475967"}
        >
          {d.name}
        </Label>
      )}
    </group>
  );
}

export const Device = React.memo(DeviceModel);

// Manufacturer photographs are extracted from the exact-order datasheets.
export function DeviceThumbnail({ kind }) {
  return (
    <img
      className="device-thumbnail"
      src={`${import.meta.env.BASE_URL}products/${kind}.png`}
      alt=""
      loading="lazy"
    />
  );
}

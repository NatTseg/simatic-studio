import React from "react";
import { Power, Activity, Gauge, Network, Monitor, Cpu } from "lucide-react";
import { settings } from "./device-runtime.js";

const address = (prefix, i) => `${prefix}${Math.floor(i / 8)}.${i % 8}`;
export function SimulationPanel({
  device,
  state = {},
  controllers,
  controllerUid,
  layout,
  update,
  setInputs,
  inputs,
  outputs,
  running,
  cycles,
}) {
  const config = settings(device);
  const patch = (p) => update({ simulation: { ...config, ...p } });
  const mapping = layout.modules.find((m) => m.uid === device.uid);
  const activeCpu = device.kind === "cpu" && device.uid === controllerUid;
  const inputStart = mapping?.inputStart || 0;
  const outputStart = mapping?.outputStart || 0;
  const bits = (values, prefix, offset, editable = false) => (
    <div className="bit-grid">
      {values.map((v, i) => (
        <button
          key={i}
          className={v ? "bit active" : "bit"}
          aria-label={`${address(prefix, offset + i)} ${v ? "TRUE" : "FALSE"}`}
          disabled={!editable || !state.powered}
          onClick={() =>
            setInputs((a) => a.map((x, j) => (j === offset + i ? !x : x)))
          }
        >
          <i />
          {address(prefix, offset + i)}
        </button>
      ))}
    </div>
  );
  return (
    <div className="simulation-panel">
      <div className={`runtime-status ${!config.powered ? "offline" : ""}`}>
        <Activity size={16} />
        <strong>{state.status || "Ready"}</strong>
        <span>VIRTUAL</span>
      </div>
      <button
        className={`supply-toggle ${config.powered ? "on" : ""}`}
        aria-label={`Virtual supply ${config.powered ? "ON" : "OFF"}`}
        onClick={() => patch({ powered: !config.powered })}
      >
        <Power size={15} />
        Virtual supply<span>{config.powered ? "ON" : "OFF"}</span>
      </button>
      {device.kind === "cpu" && (
        <>
          <div className="runtime-metrics">
            <div>
              <Cpu size={15} />
              <b>{activeCpu && running ? "RUN" : "STOP"}</b>
              <small>Controller</small>
            </div>
            <div>
              <b>{activeCpu ? cycles : 0}</b>
              <small>Scans · 100 ms</small>
            </div>
          </div>
          {!activeCpu && (
            <p className="panel-hint">
              Select this CPU as the simulation target in Program.
            </p>
          )}
          <h4>
            DIGITAL INPUTS <span>click to toggle</span>
          </h4>
          {bits(state.inputs || Array(14).fill(false), "I", 0, activeCpu)}
          <h4>DIGITAL OUTPUTS</h4>
          {bits(state.outputs || Array(10).fill(false), "Q", 0)}
          <h4>
            ANALOG INPUTS <span>0–10 V</span>
          </h4>
          {[0, 1].map((i) => (
            <label key={i}>
              AI {i}
              <b>{(state.analog?.[i] || 0).toFixed(1)} V</b>
              <input
                aria-label={`Analog input ${i}`}
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={config[`analog${i}`]}
                disabled={!state.powered}
                onChange={(e) => patch({ [`analog${i}`]: +e.target.value })}
              />
            </label>
          ))}
          <p className="panel-hint">
            Analog sensor readings are modeled separately from the Boolean
            program.
          </p>
        </>
      )}
      {device.kind === "io" && (
        <>
          <label>
            Backplane controller
            <select
              aria-label="Backplane controller"
              value={config.controllerUid}
              onChange={(e) => patch({ controllerUid: e.target.value })}
            >
              <option value="">Unassigned</option>
              {controllers.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {mapping ? (
            <>
              <p className="panel-hint">
                Eight inputs and eight outputs are mapped into this CPU’s
                virtual process image.
              </p>
              <h4>
                EXPANSION INPUTS <span>click to toggle</span>
              </h4>
              {bits(
                state.inputs || Array(8).fill(false),
                "I",
                inputStart,
                true,
              )}
              <h4>EXPANSION OUTPUTS</h4>
              {bits(state.outputs || Array(8).fill(false), "Q", outputStart)}
            </>
          ) : (
            <p className="panel-hint">
              Assign this module to the selected simulation CPU to use its
              channels. Maximum eight modules per CPU.
            </p>
          )}
        </>
      )}
      {device.kind === "power" && (
        <>
          <div className="runtime-metrics">
            <div>
              <b>
                {(state.voltage || 0).toFixed(1)}
                <em>V</em>
              </b>
              <small>DC output</small>
            </div>
            <div>
              <b>
                {(state.watts || 0).toFixed(1)}
                <em>W</em>
              </b>
              <small>Virtual load</small>
            </div>
          </div>
          <label>
            Voltage adjustment <b>{config.voltage.toFixed(1)} V</b>
            <input
              aria-label="Supply voltage"
              type="range"
              min="22.2"
              max="26.4"
              step="0.1"
              value={config.voltage}
              onChange={(e) => patch({ voltage: +e.target.value })}
            />
          </label>
          <label>
            Test load <b>{config.load.toFixed(2)} A</b>
            <input
              aria-label="Supply test load"
              type="range"
              min="0"
              max="3.5"
              step="0.05"
              value={config.load}
              onChange={(e) => patch({ load: +e.target.value })}
            />
          </label>
          <div className={`load-bar ${state.overload ? "overload" : ""}`}>
            <i
              style={{ width: `${Math.min(100, (config.load / 2.5) * 100)}%` }}
            />
          </div>
          <p className="panel-hint">
            2.5 A rated. The demo trips above this test load and recovers when
            reduced. Devices connected to this supply lose power when it trips.
          </p>
        </>
      )}
      {device.kind === "drive" && (
        <>
          <div className="drive-gauge">
            <Gauge size={27} />
            <b>
              {(state.frequency || 0).toFixed(1)}
              <small>Hz</small>
            </b>
            <span>Virtual output frequency</span>
          </div>
          <label>
            Frequency target <b>{config.frequency} Hz</b>
            <input
              aria-label="Drive frequency target"
              type="range"
              min="0"
              max="50"
              value={config.frequency}
              onChange={(e) => patch({ frequency: +e.target.value })}
            />
          </label>
          <label>
            Ramp time for 0–50 Hz <b>{config.ramp} s</b>
            <input
              aria-label="Drive ramp time"
              type="range"
              min="0.2"
              max="20"
              step="0.1"
              value={config.ramp}
              onChange={(e) => patch({ ramp: +e.target.value })}
            />
          </label>
          <label>
            Enable from PLC output
            <select
              aria-label="Drive enable output"
              value={config.enableOutput}
              onChange={(e) => patch({ enableOutput: +e.target.value })}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {address("Q", i)}
                </option>
              ))}
            </select>
          </label>
          <p className="panel-hint">
            Connect an Ethernet path and CPU → drive PROFINET IO assignment, run
            the controller and turn on the enable bit.
          </p>
        </>
      )}
      {device.kind === "switch" && (
        <>
          <h4>
            <Network size={14} /> ETHERNET PORTS
          </h4>
          <div className="port-grid">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={state.ports?.[i] ? "linked" : ""}>
                <i />
                <b>{i + 1}</b>
                <small>{state.ports?.[i] ? "LINK" : "OPEN"}</small>
              </div>
            ))}
          </div>
          <p className="panel-hint">
            Ethernet links occupy ports in connection-list order. A peer’s
            virtual supply must be on. This unmanaged switch has no IP setting.
          </p>
        </>
      )}
      {device.kind === "hmi" && (
        <>
          <div className="hmi-preview">
            <div>
              <Monitor size={15} />
              MACHINE OVERVIEW
            </div>
            <strong>{state.status || "PLC STOP"}</strong>
            <div className={`conveyor ${state.outputs?.[0] ? "moving" : ""}`}>
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <small>Q0.0 · conveyor enable</small>
          </div>
          <h4>PLC OUTPUT TAGS</h4>
          {bits(
            state.outputs?.length ? state.outputs : Array(10).fill(false),
            "Q",
            0,
          )}
          <p className="panel-hint">
            The panel reads the selected CPU through an Ethernet path, directly
            or through a powered switch. Its machine screen is a virtual
            example.
          </p>
        </>
      )}
    </div>
  );
}

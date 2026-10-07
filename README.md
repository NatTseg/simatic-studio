# SIMATIC Studio

Independent browser-based industrial device workspace built with React and Three.js.

Live app: https://nattseg.github.io/simatic-studio/

The workspace uses Siemens teal (`#009999`), dark navy (`#000028`), cyan accents and cool gray surfaces. Theme tokens are in `src/style.css`.

## Run and verify

```sh
npm install --cache /tmp/simatic-npm-cache
npm run dev
npm test
npm run build
```

## Supported workflows

- Six exact-order Siemens reference devices, searchable by name and device type.
- Six distinct procedural 3D models with connector banks, screw heads, live channel LEDs, RJ45 sockets, ventilation, drive heatsink fins and an HMI screen with eight function keys. Fit, focus, front view, dimension overlays, labels, connection paths and exploded detail controls. Surface details and terminal placement remain representative. KTP700 depth uses mounting depth, not verified full housing depth.
- Device-specific project configuration. IP settings exist for CPU, drive and HMI; the SM1223, PSU100C and unmanaged XB005 have no editable IP.
- Separate physical Ethernet topology and directed PROFINET IO controller/device relationships. Connection records do not communicate or solve electrical behavior.
- Separate editable program sources for each CPU. One selected CPU runs the bounded Boolean simulator at a nominal 100 ms browser interval.
- Fourteen base input bits and ten output bits for CPU1214C, plus eight inputs and eight outputs per assigned SM1223 (maximum eight modules per CPU). Expansion channels are packed consecutively in this virtual process image; these addresses are not firmware defaults. Changing assignments stops the scan and resets the process image.
- All-or-nothing project validation for import and saved projects, unique device identities and IPv4 assignments, browser-local save, and JSON import/export. Each browser stores its own projects.
- Mobile device-library and inspector drawers.

## Program simulator

Supported instructions are Boolean output assignments using quoted addresses (`"I0.0"`, `"Q0.0"`) or absolute address syntax (`%I0.0`, `%Q0.0`), TRUE/FALSE, NOT, AND, XOR, OR, parentheses and `//` comments. Assignments execute in source order; reads of Q see previous outputs and any earlier writes in the current scan. Unassigned outputs retain their value across running scans. Stop clears this simulator's outputs; selecting a different CPU clears its input/output runtime state.

```scl
// Demonstrate scan-state feedback, start I0.0 and stop I0.1.
%Q0.0 := (%I0.0 OR %Q0.0) AND NOT %I0.1;
```

Built-in CPU channels are I0.0–I1.5 and Q0.0–Q1.1. The first assigned SM1223 adds I1.6–I2.5 and Q1.2–Q2.1. These contiguous bit mappings are an explicit simulator convention, not a Siemens module-address assignment. Additional modules append eight bits to each area. Unsupported addresses, instructions and malformed expressions produce line/column diagnostics. No user code is evaluated as JavaScript. Tests cover sequential writes, feedback/retention, precedence, parsing limits, precise diagnostics, immutable scans, malformed project rejection, configuration capabilities and separate CPU program storage.

## Live device models (v1.2)

Select an assembly device and open **Simulation** in its inspector:

- **CPU1214C:** toggle built-in input bits; live output LEDs follow its Boolean program. Switching virtual supply off stops the selected CPU.
- **SM1223:** assign a CPU, toggle its eight input bits, and program its eight output bits in that CPU's process image. An unpowered module supplies false inputs and displays inactive outputs.
- **SITOP PSU100C:** adjust the virtual output in the reference 22.2–26.4 V range and apply a 0–3.5 A test load. Loads above 2.5 A cause a demo trip; reducing the load recovers the output. This trip is not a verified PSU protection characteristic. Load is user supplied, not calculated from wiring. The 60 W rating applies at nominal 24 V / 2.5 A.
- **SINAMICS G120C:** an assigned CPU → drive PROFINET IO relationship and a selectable built-in PLC output enable a linear 0–50 Hz teaching ramp. Ramp time specifies 0–50 Hz travel, with symmetric deceleration. The front readout is a virtual display, not a claim that this exact order includes an operator panel. Frequency is not motor speed or a firmware parameter implementation.
- **KTP700:** a sample machine overview reads the selected CPU's output bits through a powered Ethernet path. Q0.0 controls the sample conveyor indicator. The screen is illustrative and the eight physical key representations do not execute an HMI project.
- **XB005:** five link indicators follow physical Ethernet connections and peer supply state, in connection-list order. Excess links are flagged. No frame traffic, IP management or protocol diagnostics are emulated.

The default example includes all six devices, an assigned expansion module, and a CPU/drive/HMI Ethernet topology through XB005. All devices have independent virtual supplies; connection drawings do not distribute or solve electrical power. Existing saved projects still load with their original devices. Simulation settings are preserved by local save and JSON export; live I/O and ramp states reset on reload.

## Reference evidence and fidelity

Basic dimensions, ratings and network capabilities were checked against six exact-order Siemens datasheets. The SCALANCE XB-000 operating manual was checked for XB005 management/diagnostic limits. Original document URLs, pages, dates and caveats are in [REFERENCES.md](REFERENCES.md).

The app is not a Siemens firmware emulator, TIA Portal replacement or hardware programming tool. It does not implement analog conversion, PLC blocks/interrupts/timers/counters/data memory, actual scan timing, expansion-bus communication, electrical circuit solving, real PROFINET communication, motor physics, device firmware faults/protection or commissioning. The virtual HMI screen, frequency ramp and supply trip are teaching models described below. No physical hardware is accessed or programmed. Published datasheets do not establish complete firmware behavior or manufacturer validation of this application. Full device fidelity remains unimplemented.

## Hosting

The static production site is hosted by GitHub Pages. `vite.config.js` uses relative asset paths; `public/.nojekyll` disables Jekyll. Hosting is independent of this workspace's processes.

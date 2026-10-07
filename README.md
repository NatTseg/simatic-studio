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
- Dimensioned 3D housing envelopes, selection, movement/rotation gizmos, millimeter position controls, duplication and removal. Surface details and terminal placement are illustrative. KTP700 depth uses mounting depth, not verified full housing depth.
- Device-specific project configuration. IP settings exist for CPU, drive and HMI; the SM1223, PSU100C and unmanaged XB005 have no editable IP.
- Separate physical Ethernet topology and directed PROFINET IO controller/device relationships. Connection records do not communicate or solve electrical behavior.
- Separate editable program sources for each CPU. One selected CPU runs the bounded Boolean simulator at a nominal 100 ms browser interval.
- Fourteen simulated digital input bits and ten output bits for the CPU1214C reference profile; these simulator addresses are not claimed to be firmware defaults.
- All-or-nothing project validation for import and saved projects, unique device identities and IPv4 assignments, browser-local save, and JSON import/export. Each browser stores its own projects.
- Mobile device-library and inspector drawers.

## Program simulator

Supported instructions are Boolean output assignments using quoted addresses (`"I0.0"`, `"Q0.0"`) or absolute address syntax (`%I0.0`, `%Q0.0`), TRUE/FALSE, NOT, AND, XOR, OR, parentheses and `//` comments. Assignments execute in source order; reads of Q see previous outputs and any earlier writes in the current scan. Unassigned outputs retain their value across running scans. Stop clears this simulator's outputs; selecting a different CPU clears its input/output runtime state.

```scl
// Demonstrate scan-state feedback, start I0.0 and stop I0.1.
%Q0.0 := (%I0.0 OR %Q0.0) AND NOT %I0.1;
```

CPU channels are I0.0–I1.5 and Q0.0–Q1.1. Unsupported addresses, instructions and malformed expressions produce line/column diagnostics. No user code is evaluated as JavaScript. Tests cover sequential writes, feedback/retention, precedence, parsing limits, precise diagnostics, immutable scans, malformed project rejection, configuration capabilities and separate CPU program storage.

## Reference evidence and fidelity

Basic dimensions, ratings and network capabilities were checked against six exact-order Siemens datasheets. The SCALANCE XB-000 operating manual was checked for XB005 management/diagnostic limits. Original document URLs, pages, dates and caveats are in [REFERENCES.md](REFERENCES.md).

The app is not a Siemens firmware emulator, TIA Portal replacement or hardware programming tool. It does not implement analog conversion, PLC blocks/interrupts/timers/counters/data memory, actual scan timing, expansion-bus communication, electrical wiring, PROFINET communication, motor/drive dynamics, faults/protection, HMI screens/tags or commissioning. No physical hardware is accessed or programmed. Published datasheets do not establish complete firmware behavior or manufacturer validation of this application. Full device fidelity remains unimplemented.

## Hosting

The static production site is hosted by GitHub Pages. `vite.config.js` uses relative asset paths; `public/.nojekyll` disables Jekyll. Hosting is independent of this workspace's processes.

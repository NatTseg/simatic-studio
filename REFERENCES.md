# Product references and model coverage — v2.0

Checked against official Siemens publications on 2026-10-07. All dimensions below are W × H × D, in mm. Product photos in `public/products/` are extracted from the exact-order Siemens datasheets linked below. Siemens retains the image copyright; the sheets mark these photographs as figures similar to the product. They are displayed as manufacturer references, not photographs of the simulator's geometry.

| Product | Order number and official datasheet | Model dimensions |
| --- | --- | --- |
| CPU 1214C DC/DC/DC | [6ES7214-1AG40-0XB0](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6ES7214-1AG40-0XB0&language=en&caller=SIOS) | 110 × 100 × 75 |
| SM 1223 8DI / 8DO | [6ES7223-1BH32-0XB0](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6ES7223-1BH32-0XB0&language=en&caller=SIOS) | 45 × 100 × 75 |
| SITOP PSU100C | [6EP1332-5BA00](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6EP1332-5BA00&language=en&caller=SIOS) | 45 × 80 × 100 |
| SINAMICS G120C PN | [6SL3210-1KE12-3UF2](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6SL3210-1KE12-3UF2&language=en&caller=SIOS) | 73 × 173 × 160 |
| KTP700 Basic PN | [6AV2123-2GB03-0AX0](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6AV2123-2GB03-0AX0&language=en&caller=SIOS) | 214 × 158 × 45.2 overall; 39 mounting |
| SCALANCE XB005 | [6GK5005-0BA00-1AB2](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6GK5005-0BA00-1AB2&language=en&caller=SIOS) | 45 × 100 × 87 |

## Mechanical references

- [CPU 1214C connector drawing and pin locations](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/technical-specifications/cpu-1214c/cpu-1214c-wiring-diagrams), S7-1200 manual V20, November 2024: DC/DC/DC X10 has 20 terminals, X11 has three analog-input terminals, X12 has 12 output terminals. One RJ45 port. Closed gray covers and center status/channel strip follow the datasheet photograph.
- [SM 1223 DC input/output drawings](https://docs.tia.siemens.cloud/r/simatic_s7_1200_manual_collection_enus_20/technical-specifications/digital-signal-modules-sms/sm-1223-digital-input/output-v-dc-wiring-diagrams), same manual: four seven-position connector groups for the 8DI/8DO model; no Ethernet interface.
- [SITOP PSU100C operating instructions](https://cache.industry.siemens.com/dl/files/808/65647808/att_77988/v1/PSU100C_Handbuch_englisch_en-US.pdf), June 2013, p. 15, figure 2-8: narrow left terminal groups, front adjustment and vertical product strip, top ventilation. The reference photo shows charcoal plastic and a teal strip. Envelope dimensions use the current datasheet; the drawing also shows 106.5 mm including protruding mounting features.
- [SINAMICS G120C operating instructions](https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf), November 2016, pp. 48–50: housing, removable operator-panel cover, top fan/vents and mounting features. Historical frame dimensions differ from the current exact-order datasheet; the current datasheet provides the model envelope. No optional BOP/IOP display is modeled. The drive's frequency appears in the simulator UI, not as an invented hardware LCD.
- [Basic Panels 2nd Generation operating instructions](https://cache.industry.siemens.com/dl/files/350/90114350/att_904652/v2/HWBasicPanels2GenUS_en-US.pdf), October 2024, p. 111, §8.6.2: KTP700 PN front 214 × 158, rear 196 × 140, mounting depth 39 plus front projection 6.2. Rear Ethernet, USB Type A and 2-pin supply. Datasheet p. 1 gives 154.1 × 85.9 active display and eight function keys without LEDs.
- [SCALANCE XB-000 operating instructions](https://cache.industry.siemens.com/dl/files/806/32983806/att_1092422/v1/BA_SCALANCE-XB-000_76.pdf), January 2022: unmanaged XB005, no management IP or Web/SNMP/PROFINET diagnostics. The datasheet photo establishes the one + two + two socket arrangement, gray housing and bottom power connector.

## What fidelity means here

The models are procedural reconstructions, not manufacturer CAD. They reproduce the product silhouette, principal proportions, recognizable cover divisions, connector groups, ventilation, labels and mounting features. Small shapes, screw spacing, inscriptions and material appearance remain approximations. Opening covers is an inspection visualization, not a disassembly procedure. HMI screen content is an authored demo. Printed marks are visual approximations, not evidence of certification.

Electrical reference facts include the CPU's 14DI/10DO/2AI, SM's 8DI/8DO, PSU's 24V/2.5A/60W, drive's 0.75kW low-overload / 0.55kW high-overload rating and 3AC 380–480V supply, HMI's 24V/0.23A supply and Ethernet/S7 communication, and switch's five 10/100Mbit/s ports and 24VAC/DC input. The panel is not a cyclic PROFINET IO endpoint. The SM and PSU have no Ethernet IP setting.

## Runtime conventions

- A bounded Boolean interpreter evaluates sequential assignments every nominal 100 ms. TRUE/FALSE, NOT, AND, XOR, OR and parentheses are supported. Source and process images are separate for each selected controller. Browser scheduling is not PLC scan timing.
- Each assigned expansion module contributes eight inputs/outputs in a consecutively packed project address map, after the CPU's 14 inputs and ten outputs. This is a simulator address convention, not a verified TIA Portal default. Two CPU analog sensor settings span 0–10 V and are displayed independently of the Boolean interpreter.
- A logical PROFINET IO assignment and a powered physical Ethernet path are both required to enable a drive. Only switches and the drive's integrated network interface forward paths; the single-port CPU and HMI are endpoints. New Ethernet cables respect physical port counts. No Ethernet frames, IP routing, PROFINET telegrams or firmware are executed.
- The drive ramps linearly to its target at 50 Hz per configured ramp time. It decelerates when the command or network disappears and resets to zero on loss of control power. This does not model a physical motor, inertia, STO or actual drive protection.
- A connected 24 V supply owns downstream control power. Without a power cable a device uses a local bench supply; an assigned SM also depends on its controller. The adjustable PSU test load trips above 2.5 A and recovers when reduced. This authored fault-injection rule is not the real supply's overload curve and does not calculate connected-device current demand. Drive mains power is assumed when its virtual supply is enabled.
- The sample HMI reads outputs through the powered Ethernet topology. Its screen and the conveyor animation are illustrative process feedback.

The project never connects to, commissions or downloads programs to physical hardware. Autosave stores validated project data in this browser; JSON files provide transfer and backup. Runtime input switches, scan count and activity history are session state. Forty snapshots support whole-project undo/redo, including replacement and deletion.

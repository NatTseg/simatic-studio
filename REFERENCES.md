# Verified device references

Source checks completed on 2026-10-07 for the exact order numbers below. All six official Siemens datasheet URLs returned PDFs, and the cited pages were read. Dates are the dates printed in the sheet footers; they are not firmware versions or separate revision identifiers. Source PDFs remain on Siemens's servers and are not bundled with this app.

## Datasheets and dimensions

Dimensions are width × height × depth in millimeters unless noted. These are reference dimensions, not a claim that the app reproduces every housing detail, terminal, mounting feature or clearance.

| Device and exact order | Official datasheet | Footer date | Dimensions and page |
| --- | --- | --- | --- |
| CPU 1214C DC/DC/DC — `6ES7214-1AG40-0XB0` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6ES7214-1AG40-0XB0&language=en&caller=SIOS) | 2026-09-28 | 110 × 100 × 75; p. 7/8 |
| SM 1223 — `6ES7223-1BH32-0XB0` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6ES7223-1BH32-0XB0&language=en&caller=SIOS) | 2026-09-28 | 45 × 100 × 75; p. 3/4 |
| SITOP PSU100C — `6EP1332-5BA00` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6EP1332-5BA00&language=en&caller=SIOS) | 2026-10-02 | 45 × 80 × 100; p. 3/5 |
| SINAMICS G120C — `6SL3210-1KE12-3UF2` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6SL3210-1KE12-3UF2&language=en&caller=SIOS) | 2026-10-07 | 73 × 173 × 160; p. 1/1, reordered from the sheet's H × W × D |
| KTP700 Basic — `6AV2123-2GB03-0AX0` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6AV2123-2GB03-0AX0&language=en&caller=SIOS) | 2026-09-28 | Front housing 214 × 158; mounting depth 39; p. 7/7 |
| SCALANCE XB005 — `6GK5005-0BA00-1AB2` | [Siemens PDF](https://apim.industry.siemens.cloud/ted/datasheet?format=pdf&mlfbs=6GK5005-0BA00-1AB2&language=en&caller=SIOS) | 2026-10-02 | 45 × 100 × 87; width p. 1/3, height/depth p. 2/3 |

**KTP700 depth distinction:** 39 mm is explicitly the *mounting depth*. The datasheet does not identify that value as the total exterior housing depth. Its mounting cutout is 198 × 142 mm. Any simplified 3D depth derived from 39 mm remains approximate.

## Electrical and interface facts

### CPU 1214C

Datasheet pp. 1–4:

- Integrated I/O: 14 digital inputs at 24 V DC, 10 digital outputs at 24 V DC, and two analog inputs at 0–10 V DC. No analog outputs.
- Supply: 24 V DC nominal, permissible 20.4–28.8 V DC. Rated consumption is 500 mA for the CPU alone; maximum is 1,500 mA with all expansion modules.
- One PROFINET interface and one RJ45 port; no integrated switch. PROFINET IO controller, PROFINET IO device and TCP/IP are listed as supported.
- This sheet describes firmware V4.7 and engineering with STEP 7 V20 or higher. The app does not implement that firmware.

### SM 1223

Datasheet pp. 1–2:

- Eight 24 V DC sink/source digital inputs and eight transistor digital outputs, rated 0.5 A per output.
- Supply: 24 V DC nominal, permissible 20.4–28.8 V DC. Maximum current from the 5 V backplane bus is 145 mA.
- This is local S7-1200 I/O expansion through the backplane, not an Ethernet endpoint. Its sheet lists no Ethernet interface.
- CPU process-I/O addresses belong to the engineering project; this sheet does not establish fixed default byte addresses. An IP address field is not an SM 1223 device parameter.

### SITOP PSU100C

Datasheet pp. 1–3:

- Output: 24 V DC, 2.5 A, 60 W. Output adjustment is by physical potentiometer, 22.2–26.4 V.
- The product description says input **120–230 V AC**, with **110–300 V DC** also supported. The detailed AC input table instead gives **100–230 V nominal** and **85–264 V allowable**. These are distinct source labels and are not silently treated as the same range. Frequency range is 47–63 Hz.
- Input current: 1.21 A at 100 V and 0.67 A at 230 V.
- Listed connections are L/N/PE input and +/− output screw terminals; auxiliary contacts are absent. No network interface is listed. Project notes are not remote voltage control or a digital startup command.

### SINAMICS G120C

Datasheet p. 1/1:

- Supply: three-phase AC 380–480 V, +10%/−20%, 47–63 Hz.
- Rated power: 0.75 kW with low-overload rating or 0.55 kW with high-overload rating.
- External 24 V; six digital inputs, two digital outputs, one analog input and one analog output.
- The exact order number is labeled **PROFINET-PN**. This one-page sheet does not verify telegram configuration, parameter behavior, motion simulation or firmware execution.

### KTP700 Basic

Datasheet pp. 1–2 and 6:

- Supply: 24 V DC nominal, permissible 19.2–28.8 V DC; 230 mA rated current and 5.5 W typical active input power.
- One Industrial Ethernet interface. TCP/IP, DHCP, DCP and LLDP are listed as supported.
- **PROFINET is listed as supported, but PROFINET IO protocol is explicitly listed as unsupported.** Ethernet/HMI communication must not be represented as a cyclic PROFINET IO device relationship.
- S7-1200 process coupling is supported. Actual screens, tags and HMI runtime behavior require separate implementation and validation.

### SCALANCE XB005

Datasheet pp. 1–2:

- Unmanaged Industrial Ethernet switch; five RJ45 ports at 10/100 Mbit/s. Managed-switch capability is explicitly absent.
- Supply supports **24 V AC/DC**, with 19.2–28.8 V ranges. Maximum DC consumption is 70 mA; rated power loss is 1.68 W.
- PROFINET conformity class A describes network compatibility; it does not establish a configurable management IP or a PROFINET IO endpoint.

The official [SCALANCE XB-000 operating instructions](https://cache.industry.siemens.com/dl/files/806/32983806/att_1092422/v1/BA_SCALANCE-XB-000_76.pdf), **01/2022, A2B00077300-11**, printed p. 14, list Web/SNMP/PROFINET diagnostics as absent for XB005. The same table lists IRT and ring-redundancy capabilities as absent. Printed p. 13 describes Industrial Ethernet switching. The app should treat it as an unmanaged network connection point without a management IP.

## Model coverage

These checks cover selected exact-order datasheet facts and the cited SCALANCE manual pages. They do not establish complete manual coverage, firmware fidelity, exact mechanical geometry, electrical compatibility, PLC scan timing, protocol emulation, drive behavior, protection functions or safety behavior.

App address fields and connections describe a virtual project. They do not configure, program or commission hardware. The Boolean interpreter implements only its stated syntax subset; it is not a Siemens compiler or firmware emulator. Source-backed dimensions provide reference proportions while visual housing detail remains approximate.

Direct Industry Mall, SiePortal and Siemens support-page requests were inaccessible during these checks (HTTP 403). The official datasheet PDF endpoint and linked SCALANCE manual PDF were accessible. The S7-1200 system manual was not successfully retrieved and read in this verification pass; no process-address defaults or complete firmware behavior are claimed from it.

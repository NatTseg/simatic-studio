# SIMATIC Studio

Live app: https://nattseg.github.io/simatic-studio/

This branch hosts the production build. Editable React/Three.js code and regression tests are in the [source branch](https://github.com/NatTseg/simatic-studio/tree/source).

Version 1.2 adds six distinct, detailed device models, an illuminated 3D workspace, close-up and front views, dimensions, connection paths and exploded details. The default assembly includes the CPU, SM1223, SITOP supply, G120C drive, KTP700 panel and XB005 switch. Mobile drawers and an assembly selector make every device accessible on a phone.

The Simulation inspector provides live PLC LEDs and expansion channels, a virtual drive frequency ramp, a live HMI overview, power-supply test loads and Ethernet link states. Device settings save in your browser and export as JSON. Existing saved projects continue to load.

This is an independent engineering prototype. Housing details and terminal placement are representative; device behavior follows authored teaching rules. It does not execute Siemens firmware, communicate with or program hardware, solve wiring, reproduce drive physics or emulate device protection curves. The drive readout is virtual and HMI depth is based on mounting depth. See [REFERENCES.md](REFERENCES.md) for evidence and model limits.

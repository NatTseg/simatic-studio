# SIMATIC Studio

An independent browser workbench for exploring Siemens automation products in 3D and testing small controller programs.

**Live app:** https://nattseg.github.io/simatic-studio/

The `source` branch contains the editable React / Three.js / Vite app. `main` contains the generated GitHub Pages site.

## v2.0

- A larger assembly workspace and isolated product inspection, front/rear views, three-axis dimensions and opening covers.
- Six product-specific models rebuilt from Siemens reference photographs and drawings; manufacturer photos in the library and reference page.
- Live digital and analog inputs, controller outputs, scan stepping, drive ramps, sample HMI and supply fault injection.
- Physical Ethernet topology and port limits, logical PROFINET IO assignment and downstream control-power behavior.
- Program examples, line-numbered editor, filtered process image and device activity log.
- Validated local autosave, JSON import/export, forty-step undo/redo and responsive phone controls.
- On-demand 3D rendering and a separately loaded 3D workspace bundle.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Use `dist/` as the static deployment output. Vite uses a relative base so the build works under the repository's GitHub Pages path.

See [REFERENCES.md](REFERENCES.md) for exact order numbers, primary sources, photo attribution and model limits. The housings are procedural reconstructions, not Siemens CAD; the runtime is an educational simulation, not firmware or a physical electrical/motor model.

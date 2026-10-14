# Offline geometry renders

These scripts render the production scene geometry for cover assets without a browser.

Requirements: Node 22+, `@napi-rs/canvas` available through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; Python 3 with NumPy and Pillow; Linux Mesa with surfaceless EGL/OpenGL 3.3 or newer.

```sh
node mik-atlas/tools/export-gallery.mjs
python mik-atlas/tools/render-gallery.py
```

Intermediate files are written under `mik-atlas/gallery-render/`. Two cover WebP files are written to `mik-atlas/assets/`. The helper files are not part of the runtime import graph.

The native PBR shader, environment approximation and shadow implementation differ from Three.js. These are renders of the actual geometry and camera, not browser screenshots or WebXR tests. Do not use their frame rate or appearance as proof of hardware performance or exact browser lighting. Attribution for the Lenin scan also applies to the cover renders.

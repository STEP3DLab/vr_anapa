# 3D models — Technopark VR

The following downloaded assets are used in the drone range and exhibition hall.
Their geometry is distributed locally with the application. Attribution is also
linked from the in-app menu.

| Asset | Author and source | License | Project adaptation |
|---|---|---|---|
| Mossberg 590A1 | [J-Toastie via Poly Pizza](https://poly.pizza/m/eAh1oHY32T) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Scale/orientation, rigid separation of pump and trigger, material tuning, recoil and pump animation. A virtual game prop; no claim of manufacturer endorsement. |
| Drone | [NateGazzard via Poly Pizza](https://poly.pizza/m/DNbUoMtG3H) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Palette baked to vertex colours, scale, merged rigid body and camera, shared instanced rotors, game variants. |

Retrieved 2026-09-22. Source GLBs are kept in `source/`. To regenerate the compact
runtime meshes, run `node scripts/prepare-models.mjs`. The application imports
`showcase.json`, shares GPU geometry/materials between copies, and requires no
third-party model downloads at runtime. The files remain under their stated
licenses; no additional restrictions are applied to the adapted model assets.

The six-wheel Losinka rover and Disintegrator arena robot retain their project-specific
geometry and identity. They are stylised interpretations, not downloaded CAD replicas.

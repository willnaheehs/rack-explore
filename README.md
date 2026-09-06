# Rack Explore

An interactive HPC hardware explorer built with React, Vinext, Three.js, and the installed shadcn/Base UI components.

## Use

- Orbit, zoom, select a chassis, then **Explore components**.
- Remove bezels and switch between assembled and exploded internal views.
- Browse **Hardware catalog** for 19 documented or preliminary platform entries, including Dell, HPE, Lenovo, Supermicro, NVIDIA, AMD and DDN.
- Use **Build a rack** for 42U/48U layouts, equipment placement, planned connections, local saves, and JSON import/export.
- The H100 reference cluster includes compute, front-end and storage topologies. Standalone hardware presets and NVL72 templates do not imply external fabric connections.

## Run locally

Requires Node 22.13+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by the dev server. The existing desktop preview uses port 3000.

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Data and fidelity

The catalog was reviewed on 6 September 2026. Every platform links to official manufacturer references in the inspector. `Documented` means a manufacturer reference exists, not a stock or shipping guarantee. Vera Rubin NVL72 and AMD Helios are preliminary references and cannot populate a rack.

Published U heights, selected dimensions, device populations, and port arrangements inform the models. Exact OEM depth is labeled illustrative when unavailable. Board geometry, package layouts, traces, heatsinks, cabinets, LEDs, and cable paths are explanatory geometry, not certified service CAD or live telemetry. DDN controller details and media population are explicitly representative because the public data sheet does not identify the exact boards or drive configuration. The DDN cluster uses a 250 TB usable option; representative drive glyphs must not be interpreted as its actual drive count.

GB200/GB300 NVL72 templates use documented 48U tray positions, including 18 compute trays, 9 NVLink switch trays, 8 power shelves, and 2 management switches. Their proprietary compute trays cannot be placed in ordinary custom 19-inch racks. Memory quantities in the overview sum nominal per-GPU capacities and use decimal TB. OEM-specific values are retained—for example, the referenced Dell XE9780 manual's B300 variant differs from DGX B300.

Custom rack validation checks U bounds, collisions, mounting family, unique device IDs and aggregate logical port / adapter-slot allocation. Planned connection rates are user choices, not protocol, adapter, breakout, cable, or optical compatibility certification. Rail fit, service clearances, load distribution, weight, rack electrical budgets, liquid loops and thermal simulation require separate engineering. Power and cooling system design remains v2.

## Structure

- `lib/catalog.ts`: source-linked chassis profiles and internal component definitions.
- `lib/hardware.ts`: reference cluster, IDs, inspection data and links.
- `lib/rack-builder.ts`: pure placement, connection and import/export validation.
- `components/cluster-scene.tsx`: scaled enclosure geometry, component assemblies, picking and camera controls. Static geometry is merged per device/material to reduce draw calls.
- `components/topology.tsx`: accessible selectable SVG network diagrams.
- `components/explorer.tsx`, `catalog-panel.tsx`, `rack-builder.tsx`: workstation and workflows.
- `lib/webmcp.ts`: optional page-scoped read, inspect and show-fabric tools with input validation and abort cleanup.
- `tests/hardware.test.mjs`: populations, OEM differences, NVL72 locations, placement rules, import safety, link budgets and tool actions.

Custom saves use browser localStorage only when **Save locally** is selected. They are device- and origin-local; no cloud database or shared custom data is implied. JSON files provide portability between local and hosted previews.

The site is configured for private Sites hosting in `.openai/hosting.json`. The production package is built from the same committed source pushed to the source repository. No credentials belong in source files.

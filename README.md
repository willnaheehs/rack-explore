# Physical Compute

An interactive HPC hardware explorer built with React, Vinext, Three.js, and the installed shadcn/Base UI components.

## Use

- Orbit, zoom, select a chassis, then **Explore components**.
- Remove bezels and switch between assembled and exploded internal views. Selecting an internal module isolates it for inspection; **Full assembly** restores all modules and **Nearby parts** shows its context. Fan, PSU, memory, drive and I/O groups have separate service-view positions; the camera fits their bounds on narrow and wide screens.
- The original eight-node H100 cluster retains all four racks, inspectable hardware interiors and physical fabric layers. **Topology → Rack connections** shows every device in that layout; **Vendor reference** opens the separately sourced SuperPOD plan. Copying the cluster into the custom builder preserves its connections.
- Browse **Hardware catalog** for 19 documented or preliminary platform entries, including Dell, HPE, Lenovo, Supermicro, NVIDIA, AMD and DDN.
- Open **Configuration checks** in the cluster overview or builder to see placement, component coverage, manufacturer references, network limits, and remaining engineering decisions. Component groups identify documented populations, available positions, selected reference options and representative blocks.
- Use **Build a rack** for 42U/48U layouts, equipment placement, planned connections, local saves, and JSON import/export.
- On phones, drag to orbit, pinch to zoom, and tap hardware to select it. Use **Inspect** to open details in a bottom sheet. Inventory opens in a drawer, view options sit beside the camera controls, and the catalog and rack builder use full-screen layouts with vertical scrolling. Touch gestures that pan or zoom never select hardware.
- Select **Power** to trace utility / generator sources through UPS, distribution, rack PSUs or NVL72 power shelves, and component regulators. Try battery operation or A/B feed failures, change the load, and inspect every stage.
- **Sourced fabric plans:** NVIDIA SuperPOD (H100/H200, B200, B300 XDR, GB200, GB300), Dell XE9780 AI Factory, Lenovo Hybrid AI 289-800 dual-plane, and Supermicro AMD/Pollara designs. Select a path to inspect protocol, rates, ports, cable details and source sections. Front-end/storage shared underlays are explicitly identified. HPE XD685, Supermicro B300, standalone switches and DDN appliances expose published interfaces without invented external wiring. Reference diagrams are separate from rack placement and custom cable schedules.

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

Configuration checks cover all 17 loadable presets and the original H100 cluster: U bounds, collisions, mounting family, device IDs, chassis heights, internal inspection, GPU counts, source metadata, NVL72 generation and tray positions, and reference-graph integrity. Custom connections check shared protocol support, rate ceilings, logical port counts and nominal aggregate interface capacity. Choose Ethernet, InfiniBand, or infer the protocol from endpoints. Unknown adapter slots remain review items. These necessary capacity checks do not allocate numbered ports or qualify adapter SKUs, breakout modes, cables, firmware, or optics. Invalid connections and imports are rejected before changing the layout. See [the configuration audit](docs/configuration-audit.md) for source checkpoints and known gaps. Rail fit, service clearances, load distribution, weight, rack electrical budgets, liquid loops and thermal simulation require separate engineering. The power explorer explains architecture and demand; it does not validate an electrical installation. Cooling and thermal simulation remain future work.

## Power model

Power opens in a physical rear rack view. Orbit, zoom, focus a selected part, or switch to the schematic. Select equipment directly in 3D or use the named stage buttons. Physical facility equipment, rear PDUs / shelves, and a board cutaway share the same source/failure state. Only the selected stage’s upstream routes are shown; unavailable paths are dimmed and animation respects reduced motion. If WebGL is unavailable, the schematic remains usable.

The three scales share one scenario: source and facility, rack distribution, and inside hardware. A/B flow, balanced three-phase current, conversion losses, battery runtime and board allocations respond to the load budget. Component groups link back to the physical inspector, including storage drives and controllers. An empty custom rack remains explorable without inventing devices.

DGX H100/H200, B200 and B300 input budgets use NVIDIA references. NVL72 shelf topology uses the DGX rack guide, including its nominal 50–51 V DC bus. GB200 tray power is allocated from an approximate 120 kW rack budget; GB300 uses an explicit 142 kW planning scenario. Other chassis use labeled editable allowances. Shelf nameplates are never counted again as IT loads.

Facility voltages, equal feed sharing, usable feed current, efficiencies, battery capacity and component shares are examples, not measured site data. The model separately accounts for transformer, UPS, wiring, PSU and board conversion losses. It excludes cooling, other racks, battery aging, recharge, protection coordination and circuit-level wiring. Overloaded paths show requested demand rather than promising delivery. Vendor-documented performance reductions are shown separately from the requested load.

## Structure

- `lib/catalog.ts`: source-linked chassis profiles and internal component definitions.
- `lib/hardware.ts`: reference cluster, IDs, inspection data and links.
- `lib/rack-builder.ts`: pure placement, connection and import/export validation.
- `lib/config-validation.ts`, `lib/network-validation.ts`: configuration reports and protocol/rate/capacity limits; `components/configuration-checks.tsx` displays the same report in both workspaces.
- `components/cluster-scene.tsx`: scaled enclosure geometry, component assemblies, picking and camera controls. Static geometry is merged per device/material to reduce draw calls.
- `components/topology.tsx`: accessible selectable SVG network diagrams.
- `components/explorer.tsx`, `catalog-panel.tsx`, `rack-builder.tsx`: workstation and workflows.
- `lib/power-physical.ts`, `components/power-scene.tsx`: physical equipment layouts, U placement, selectable 3D parts, cable routes, focus controls and resource cleanup.
- `lib/power.ts`, `components/power-view.tsx`, `app/power.css`: power calculations, stage graphs, scenarios and stage inspection.
- `lib/webmcp.ts`, `lib/power-tools.ts`: optional page-scoped hardware and power tools with input validation and abort cleanup.
- `tests/*.test.mjs`: hardware populations, placement/import safety, link budgets, power conservation, source/failure routing, empty/zero-load cases and structured tool actions.

Custom saves use browser localStorage only when **Save locally** is selected. They are device- and origin-local; no cloud database or shared custom data is implied. JSON files provide portability between local and hosted previews.

The site is configured for Sites hosting in `.openai/hosting.json`. The production package is built from the same committed source pushed to the source repository. No credentials belong in source files.

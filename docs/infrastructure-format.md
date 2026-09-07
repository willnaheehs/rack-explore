# Portable infrastructure format

The Infrastructure workspace reads self-contained JSON documents with `format: "physical-compute"` and `version: 2`. The model, validation and file handling have no database or rendering dependency. The executable contract is `lib/infrastructure.ts`; `readInfrastructure` validates external files before any workspace state changes.

## Model

| Collection    | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `types`       | Versioned equipment definitions, default facts and port definitions, embedded in the file.         |
| `assets`      | Identified equipment, places or assemblies. Each pins a definition by `typeId` and `typeRevision`. |
| `interfaces`  | Instantiated ports owned by assets. A port is individual or explicitly aggregated.                 |
| `connections` | Typed relationships between interfaces, independently of physical containment.                     |
| `groups`      | Logical memberships, such as a compute cluster spanning multiple rooms.                            |
| `sources`     | Evidence references with URL, retrieval date and optional license.                                 |

Every asset has a stable ID. Moving an asset changes `parentId` or placement, never its identity. IDs are opaque even when an example uses a readable path. A physical assembly has at most one parent; children can themselves contain children. This supports a site → room → rack → server → storage drive → controller hierarchy without fixing which levels must exist. Standalone equipment is valid. Logical groups can cross physical boundaries.

Definitions and interface snapshots travel with the file. Changing the catalog later does not rewrite old records. To revise a definition, add a new revision and explicitly migrate the assets that should use it. New categories, media and namespaced `extensions` remain readable even when no dedicated renderer or engineering rules exist. Unknown core fields are rejected so typos cannot silently disappear. Breaking changes require a new file version and an explicit migration; unsupported versions fail before changing the current model.

## Evidence and populations

Document purpose is `reference`, `plan` or `inventory`; this label alone does not verify any fact. Asset and field evidence separately records `reported`, `derived`, `estimated` or `unknown`, source IDs, an optional `asOf` date and notes. `reported` requires a source. Retrieval dates describe when a reference was consulted; `asOf` describes the historical observation. Neither means a live feed.

Facts use stable keys, display labels and string, number, boolean or null values. Numeric quantities carry explicit units; a missing fact value is `null` with unknown evidence. Instance facts replace the matching definition key for display. Conflicting observations within one record are retained and flagged for review; the app does not guess which is correct. When updating a public record, retain historical observations or the previous file instead of silently overwriting them.

An asset's representation is explicit:

- `individual`: one modeled place, assembly or item; evidence states whether it is verified.
- `aggregate`: a reported or planned population, with an explicit quantity.
- `representative`: explanatory architecture, not an additional installed item.
- `slot`: an available position whose population is unconfirmed.

Aggregate children must describe representative architecture or other non-individual records. Do not expand a public node count into invented serial-numbered machines or positions. Record counts include places and assemblies and are not installed-device totals. The LUMI example demonstrates this distinction.

## Placement and connections

Rack placement specifies one-based bottom U, height and mounting system. Rack definitions use `rack.units` and `rack.mount` facts; an explicitly documented exception can use `rack.accepts.<mount>`. Positions, when supplied, are local `[x, y, z]` metres relative to the physical parent; rotation is radians about the vertical axis. Visual assets are optional metadata, never the source of physical truth.

Connections use `data`, `power`, `cooling`, `mechanical` or a custom medium. Physical cables require individual endpoints and quantity one. Aggregated links use grouped endpoint counts. Logical relationships record dependencies without claiming physical routing or allocating ports. Capacities are per link, not totals for a bundle. Directions and matching protocols are checked.

Unit-aware comparisons currently support `b/s`, `Mb/s`, `Gb/s`, `Tb/s`; `W`, `kW`, `MW`; `L/min`, `m3/h`; `A`; and `V`. Unknown units and missing capacity evidence produce review items instead of a fabricated conversion. These checks cover structural consistency and declared limits. They do not certify optics, cable reach, firmware, electrical protection, redundant-feed loading or hydraulic behavior. Add such rules as separate domain modules as real use cases require them.

## Compatibility and rendering

Existing version 1 `rack-explore` JSON files still work in the rack builder and can also open in Infrastructure. Migration preserves equipment IDs, components, specification values, placements, link records and sourced fabric plans. The existing catalog snapshot and legacy fields live in the `rack-explore` extension namespace.

An unchanged migrated model can open in the existing 3D rack inspector. Projection back to that renderer is allowed only when the complete document can be preserved exactly. A changed definition, deeper hierarchy, custom fact or different catalog revision stays in the generic infrastructure inspector rather than being discarded. Familiar 3D geometry is optional; unfamiliar equipment can still expose all records and evidence.

The current UI explores, imports and exports infrastructure files. The rack builder remains the editor for supported rack layouts. There is no general facility drawing editor, live connector or shared database in this version. Imported infrastructure lives in memory until exported; closing the panel preserves it, but refreshing the page does not. Existing local rack saves remain untouched.

## Reproduce and validate

Requires the same Node 22.13+ environment as the app; no extra dependencies or accounts.

```sh
npm ci
npm test
npm run models:check
npm run models:check -- /path/to/model.json
npm run models:examples
```

`models:check` accepts old rack files and new infrastructure files. Errors return a nonzero exit status. Review items explain incomplete evidence and engineering limits but do not prevent reading a structurally valid record. With no filenames, it checks the committed public examples. `models:examples` regenerates those files deterministically from fixed source records. Tests assert the committed fixtures match their generators and that all current loadable racks round-trip.

- [Small CPU cluster planning file](../public/models/small-cpu-plan.physical-compute.json): hypothetical equipment, nested storage components and individually planned network/power links.
- [LUMI public record](../public/models/lumi-public-record.physical-compute.json): sourced node populations, representative internals and facility dependencies; exact placements and routing are unknown.

JSON export sorts object keys with a fixed lexical comparison, preserves array order, writes a trailing newline and adds no current timestamps. Limits are 10 MB UTF-8, 20,000 assets, 100,000 interfaces, 100,000 connections and 128 containment levels. The parser rejects unsafe URLs, prototype keys, malformed dates and excessive JSON nesting. Unknown extension values are preserved as JSON data, never executed.

Future connectors should convert source records into this format, retain external identifiers in a namespaced extension, attach evidence and validate before merging. Introduce a database for shared inventories only when needed, with tenant ownership, history and explicit conflict handling. The portable document remains the exchange format regardless of storage technology.

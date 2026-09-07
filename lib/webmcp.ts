import { modelForProfile } from './rack-builder.ts';
import { VISIBLE_CATALOG } from './catalog.ts';
import { withReferenceFabrics } from './fabric-references.ts';
import { validateConfiguration } from './config-validation.ts';
import {
  FABRICS,
  fabricInfo,
  resolveHardware,
  specsFor,
  linksFor,
  childrenOf,
  type ClusterModel,
} from './hardware.ts';
export type ExplorerState = {
  selected: string | null;
  node: string | null;
  view: string;
  fabric: string;
  model: ClusterModel;
  topologyPresentation?: 'rack' | 'reference';
  powerRackId?: string;
  componentPresentation?: 'isolated' | 'assembly';
};
export type ExplorerActions = {
  read: () => ExplorerState;
  inspect: (id: string) => void;
  showPower?: (rackId: string) => void;
  showFabric: (
    fabric: 'compute' | 'frontend' | 'storage',
    platform?: ClusterModel,
    presentation?: 'rack' | 'reference',
  ) => void;
};
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected an object.');
  return input as Record<string, unknown>;
}
export function explorerTools(actions: ExplorerActions): Tool[] {
  const snapshot = () => {
    const { model, ...state } = actions.read();
    return { ...state, model: { id: model.id, title: model.title } };
  };
  const referenceSummary = () =>
    Object.fromEntries(
      Object.entries(actions.read().model.fabricReferences ?? {}).map(
        ([fabric, p]) => [
          fabric,
          {
            id: p.id,
            title: p.title,
            status: p.status,
            scope: p.scope,
            speed: p.speed,
            sharedWith: p.sharedWith,
            sources: p.sources,
            documentedLinkGroups: p.connections.filter((c) => c.kind === 'link')
              .length,
          },
        ],
      ),
    );
  return [
    {
      name: 'get_cluster_model',
      title: 'Read cluster hardware',
      description:
        'Read the selected platform, component coverage, configuration checks and current visible selection. Checks report modeling errors and unresolved engineering details. No production inventory or live telemetry is provided.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        const values = objectInput(input);
        if (Object.keys(values).length)
          throw new Error('No arguments expected.');
        return {
          state: snapshot(),
          configurationChecks: validateConfiguration(actions.read().model),
          fabricReferences: referenceSummary(),
          availablePlatforms: VISIBLE_CATALOG.filter(
            (p) => p.status === 'Documented',
          ).map((p) => ({ id: p.id, name: `${p.maker} ${p.name}` })),
          fabricConnections: Object.keys(FABRICS).map((fabric) => ({
            fabric,
            links: actions.read().model.links.filter((l) => l.fabric === fabric)
              .length,
            referenceStatus:
              actions.read().model.fabricReferences?.[
                fabric as keyof typeof FABRICS
              ]?.status ?? null,
          })),
          hardware: actions
            .read()
            .model.hardware.map(({ id, name, model, rack, u, height }) => ({
              id,
              name,
              model,
              rack,
              u,
              height,
            })),
          componentIdFormat:
            'Inspect a chassis to read its exact component IDs.',
        };
      },
    },
    {
      name: 'inspect_cluster_hardware',
      title: 'Inspect cluster hardware',
      description:
        'Select a device or internal component in the visualizer and show its documented specifications. Internal components open isolated for inspection; use Full assembly or Nearby parts in the interface to restore context.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const values = objectInput(input);
        if (
          Object.keys(values).some((k) => k !== 'id') ||
          typeof values.id !== 'string'
        )
          throw new Error('Provide one hardware id.');
        const h = resolveHardware(values.id, actions.read().model);
        if (!h)
          throw new Error(
            'Unknown hardware id. Read get_cluster_model for available devices.',
          );
        actions.inspect(h.id);
        return {
          state: snapshot(),
          fabricReferences: referenceSummary(),
          availablePlatforms: VISIBLE_CATALOG.filter(
            (p) => p.status === 'Documented',
          ).map((p) => ({ id: p.id, name: `${p.maker} ${p.name}` })),
          fabricConnections: Object.keys(FABRICS).map((fabric) => ({
            fabric,
            links: actions.read().model.links.filter((l) => l.fabric === fabric)
              .length,
            referenceStatus:
              actions.read().model.fabricReferences?.[
                fabric as keyof typeof FABRICS
              ]?.status ?? null,
          })),
          hardware: h,
          specifications: specsFor(h),
          connections: linksFor(h, actions.read().model),
          components: childrenOf(h),
        };
      },
    },
    {
      name: 'show_cluster_fabric',
      title: 'Show network fabric',
      description:
        'Open the compute, front-end Ethernet, or storage topology. Choose rack for the existing device connections or reference for the vendor plan. Optionally load a documented platform from get_cluster_model.availablePlatforms. Interface-only plans explicitly report missing wiring details.',
      inputSchema: {
        type: 'object',
        properties: {
          fabric: { type: 'string', enum: ['compute', 'frontend', 'storage'] },
          platformId: { type: 'string' },
          presentation: { type: 'string', enum: ['rack', 'reference'] },
        },
        required: ['fabric'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const values = objectInput(input);
        if (
          Object.keys(values).some(
            (k) => !['fabric', 'platformId', 'presentation'].includes(k),
          ) ||
          !['compute', 'frontend', 'storage'].includes(String(values.fabric))
        )
          throw new Error('Fabric must be compute, frontend, or storage.');
        const fabric = values.fabric as keyof typeof FABRICS;
        if (
          values.platformId !== undefined &&
          !VISIBLE_CATALOG.some(
            (p) => p.id === values.platformId && p.status === 'Documented',
          )
        )
          throw new Error(
            'Choose a documented platform ID from get_cluster_model.',
          );
        const platform =
          typeof values.platformId === 'string'
            ? withReferenceFabrics(modelForProfile(values.platformId))
            : undefined;
        const target = platform ?? actions.read().model;
        const presentation = values.presentation;
        if (
          presentation !== undefined &&
          presentation !== 'rack' &&
          presentation !== 'reference'
        )
          throw new Error('Presentation must be rack or reference.');
        if (presentation === 'reference' && !target.fabricReferences)
          throw new Error('This layout has no vendor reference plan.');
        if (
          presentation === 'rack' &&
          target.fabricReferences &&
          !target.links.length
        )
          throw new Error('This platform has no configured rack connections.');
        actions.showFabric(fabric, platform, presentation);
        return {
          state: snapshot(),
          fabric:
            actions.read().topologyPresentation === 'rack'
              ? FABRICS[fabric]
              : fabricInfo(actions.read().model, fabric),
          connections: actions
            .read()
            .model.links.filter((l) => l.fabric === fabric),
          reference: actions.read().model.fabricReferences?.[fabric] ?? null,
        };
      },
    },
    ...(actions.showPower
      ? [
          {
            name: 'show_cluster_power',
            title: 'Open the power explorer',
            description:
              'Open the source-to-component power explorer for a rack. This shows an educational scenario and never controls real equipment.',
            inputSchema: {
              type: 'object',
              properties: { rackId: { type: 'string' } },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute(input: unknown) {
              const v = objectInput(input);
              if (Object.keys(v).some((k) => k !== 'rackId'))
                throw new Error('Only rackId is accepted.');
              const rackId = v.rackId ?? actions.read().model.racks[0].id;
              if (
                typeof rackId !== 'string' ||
                !actions.read().model.racks.some((r) => r.id === rackId)
              )
                throw new Error('Unknown rack.');
              actions.showPower!(rackId);
              return { state: snapshot(), rackId };
            },
          },
        ]
      : []),
  ];
}

import {
  FABRICS,
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
};
export type ExplorerActions = {
  read: () => ExplorerState;
  inspect: (id: string) => void;
  showFabric: (fabric: 'compute' | 'frontend' | 'storage') => void;
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
  return [
    {
      name: 'get_cluster_model',
      title: 'Read cluster hardware',
      description:
        'Read the selected platform or custom hardware inventory and current visible selection. No live telemetry is provided.',
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
        'Select a device or internal component in the visualizer and show its documented specifications. Opens the logical node assembly for internal components.',
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
        'Open the compute, front-end Ethernet, or storage topology in the visible workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          fabric: { type: 'string', enum: ['compute', 'frontend', 'storage'] },
        },
        required: ['fabric'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const values = objectInput(input);
        if (
          Object.keys(values).some((k) => k !== 'fabric') ||
          !['compute', 'frontend', 'storage'].includes(String(values.fabric))
        )
          throw new Error('Fabric must be compute, frontend, or storage.');
        const fabric = values.fabric as keyof typeof FABRICS;
        actions.showFabric(fabric);
        return { state: snapshot(), fabric: FABRICS[fabric] };
      },
    },
  ];
}

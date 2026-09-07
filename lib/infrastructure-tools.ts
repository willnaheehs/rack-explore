import {
  assetFacts,
  ancestors,
  validateInfrastructure,
  type Infrastructure,
} from './infrastructure.ts';

export type InfrastructureActions = {
  read: () => { document: Infrastructure; selected: string | null };
  select: (id: string | null) => void;
  load: (example: 'current' | 'cpu' | 'nvl72' | 'lumi') => void;
};
export function infrastructureTools(actions: InfrastructureActions) {
  const snapshot = () => {
    const { document: d, selected } = actions.read();
    const a = d.assets.find((a) => a.id === selected);
    const issues = validateInfrastructure(d);
    return {
      document: {
        id: d.id,
        title: d.title,
        purpose: d.purpose,
        formatVersion: d.version,
      },
      selected,
      path: a ? ancestors(d, a.id).map(({ id, name }) => ({ id, name })) : [],
      asset: a ?? null,
      facts: a ? assetFacts(d, a) : [],
      children: d.assets
        .filter((a) => a.parentId === selected || (!selected && !a.parentId))
        .map(({ id, name, typeId, representation, quantity }) => ({
          id,
          name,
          typeId,
          representation,
          quantity,
        })),
      counts: {
        records: d.assets.length,
        interfaces: d.interfaces.length,
        connections: d.connections.length,
      },
      checks: {
        errors: issues.filter((i) => i.level === 'error').length,
        review: issues.filter((i) => i.level === 'review').length,
        issues: issues.slice(0, 50),
      },
      sources: d.sources,
      examples: ['current', 'cpu', 'nvl72', 'lumi'],
    };
  };
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v))
      throw new Error('Expected an object.');
    return v as Record<string, unknown>;
  };
  return [
    {
      name: 'get_infrastructure_model',
      title: 'Read infrastructure',
      description:
        'Read the current infrastructure record, selected assembly, children, evidence and model checks. Aggregate records are not individual assets; this is not live telemetry.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (Object.keys(object(input)).length)
          throw new Error('No arguments expected.');
        return snapshot();
      },
    },
    {
      name: 'inspect_infrastructure_asset',
      title: 'Inspect infrastructure asset',
      description:
        'Navigate to an asset or nested assembly using an ID returned by get_infrastructure_model. Use null to return to the model overview.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: ['string', 'null'] } },
        required: ['id'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const v = object(input);
        if (
          Object.keys(v).length !== 1 ||
          !('id' in v) ||
          (v.id !== null &&
            (typeof v.id !== 'string' ||
              !actions.read().document.assets.some((a) => a.id === v.id)))
        )
          throw new Error(
            'Choose an existing asset ID, or null for the overview.',
          );
        actions.select(v.id as string | null);
        return snapshot();
      },
    },
    {
      name: 'load_infrastructure_example',
      title: 'Load infrastructure example',
      description:
        'Open current racks, a small CPU cluster plan, a GB300 NVL72 reference, or a partial LUMI public record. This replaces the open infrastructure workspace; export imported files first.',
      inputSchema: {
        type: 'object',
        properties: {
          example: {
            type: 'string',
            enum: ['current', 'cpu', 'nvl72', 'lumi'],
          },
        },
        required: ['example'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const v = object(input);
        if (
          Object.keys(v).length !== 1 ||
          !['current', 'cpu', 'nvl72', 'lumi'].includes(String(v.example))
        )
          throw new Error('Choose current, cpu, nvl72, or lumi.');
        actions.load(v.example as 'current' | 'cpu' | 'nvl72' | 'lumi');
        return snapshot();
      },
    },
  ];
}

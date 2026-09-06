import {
  calculatePower,
  powerGraph,
  validatePowerPatch,
  type PowerSettings,
} from './power.ts';
import type { ClusterModel } from './hardware.ts';
export function powerTools(actions: {
  model: () => ClusterModel;
  read: () => PowerSettings;
  configure: (next: PowerSettings) => void;
}) {
  const snapshot = () => {
    const settings = actions.read(),
      model = actions.model(),
      c = calculatePower(model, settings),
      g = powerGraph(model, settings);
    return {
      settings,
      rack: { id: c.rack.id, name: c.rack.name },
      hardwareId: c.h?.id ?? null,
      requestedRackKW: c.requestedKW,
      scenarioRackKW: c.acKW,
      sourceKW: c.sourceKW,
      feedAKW: c.aKW,
      feedBKW: c.bKW,
      overloaded: c.overloaded,
      resilience: c.resilience,
      stages: g.nodes.map(({ id, title, active }) => ({ id, title, active })),
      notice:
        'Educational scenario, not telemetry. Facility design, efficiencies and component load allocation are assumptions.',
    };
  };
  return [
    {
      name: 'get_power_model',
      title: 'Read power path',
      description:
        'Read the active power scenario, selected rack and device, load calculations, and available stage IDs. This is an illustrative model, not live electrical telemetry.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw new Error('No arguments expected.');
        return snapshot();
      },
    },
    {
      name: 'configure_power_path',
      title: 'Explore power scenario',
      description:
        'Change the visible physical or schematic power presentation, scenario, load budget, scope, rack, device, or selected stage. All changes are local educational scenarios; this never controls real equipment.',
      inputSchema: {
        type: 'object',
        properties: {
          presentation: { type: 'string', enum: ['physical', 'schematic'] },
          scenario: {
            type: 'string',
            enum: [
              'normal',
              'battery',
              'generator',
              'feed-a-loss',
              'feed-b-loss',
              'both-feeds-loss',
            ],
          },
          loadPercent: { type: 'number', minimum: 0, maximum: 100 },
          scope: { type: 'string', enum: ['facility', 'rack', 'board'] },
          stageId: { type: 'string' },
          rackId: { type: 'string' },
          hardwareId: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input: unknown) {
        const next = validatePowerPatch(input, actions.model(), actions.read());
        actions.configure(next);
        return snapshot();
      },
    },
  ];
}

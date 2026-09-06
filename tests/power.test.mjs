import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL, resolveHardware } from '../lib/hardware.ts';
import { VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import { blankModel, modelForProfile } from '../lib/rack-builder.ts';
import {
  initialPowerSettings,
  calculatePower,
  powerGraph,
  traceAncestors,
  devicePowerBudget,
  validatePowerPatch,
  SCENARIOS,
  threePhaseAmps,
} from '../lib/power.ts';
import { powerTools } from '../lib/power-tools.ts';
import { explorerTools } from '../lib/webmcp.ts';
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const model = modelForProfile('dgx-h100');
const defaults = initialPowerSettings(model);

test('source input equals downstream DC plus all conversion losses in every scenario', () => {
  for (const { value: scenario } of SCENARIOS) {
    for (const loadPercent of [0, 35, 100]) {
      const c = calculatePower(model, { ...defaults, scenario, loadPercent });
      near(
        c.sourceKW,
        c.dcKW + Object.values(c.losses).reduce((a, b) => a + b, 0),
      );
      near(c.aKW + c.bKW, c.acKW);
      near(c.deviceDC, c.endpointsKW + c.boardLossKW);
      near(
        c.allocation.reduce((n, g) => n + g.kw, 0),
        c.endpointsKW,
      );
      assert.ok(
        Object.values(c.losses).every((n) => Number.isFinite(n) && n >= 0),
      );
      if (scenario === 'both-feeds-loss') {
        assert.equal(c.sourceKW, 0);
        assert.equal(c.acKW, 0);
      } else near(c.acKW, (10.2 * loadPercent) / 100);
    }
  }
});

test('feed failure doubles surviving path current and checks capacity independently of PSU redundancy', () => {
  const s = { ...defaults, loadPercent: 100, lineVoltage: 208, feedAmps: 20 };
  const normal = calculatePower(model, s);
  const failure = calculatePower(model, { ...s, scenario: 'feed-a-loss' });
  near(normal.aAmps, threePhaseAmps(5.1, 208));
  near(failure.bAmps, normal.bAmps * 2);
  assert.equal(failure.aKW, 0);
  assert.equal(normal.overloaded, false);
  assert.equal(failure.overloaded, true);
  assert.equal(failure.surviving, 3);
  assert.match(failure.resilience, /reduced performance/);
  for (const [id, message] of [
    ['dgx-b200', /800 W/],
    ['dgx-b300', /6 of 12.*N\+N/],
  ]) {
    const m = modelForProfile(id);
    assert.match(
      calculatePower(m, { ...initialPowerSettings(m), scenario: 'feed-b-loss' })
        .resilience,
      message,
    );
  }
});

test('battery runtime uses total DC energy and no utility transformer loss', () => {
  const s = {
    ...defaults,
    scenario: 'battery',
    scope: 'facility',
    loadPercent: 100,
    batteryKWh: 10,
  };
  const c = calculatePower(model, s);
  near(c.batteryMinutes, (10 / (10.2 / 0.99 / 0.96)) * 60);
  near(c.sourceKW, 10.2 / 0.99 / 0.96);
  assert.equal(c.losses.transformer, 0);
  const depleted = calculatePower(model, { ...s, batteryKWh: 0 });
  assert.equal(depleted.acKW, 0);
  assert.equal(depleted.batteryMinutes, 0);
  assert.equal(depleted.on, false);
  assert.equal(
    calculatePower(model, { ...s, loadPercent: 0 }).batteryMinutes,
    null,
  );
  const graph = powerGraph(model, s);
  assert.equal(graph.nodes.find((n) => n.id === 'utility').active, false);
  assert.equal(graph.nodes.find((n) => n.id === 'battery-a').active, true);
  assert.equal(
    graph.edges.find((e) => e.from === 'ats' && e.to === 'ups-a').active,
    false,
  );
  assert.equal(
    graph.edges.find((e) => e.from === 'battery-a' && e.to === 'ups-a').active,
    true,
  );
  const generator = powerGraph(model, { ...s, scenario: 'generator' });
  assert.equal(
    generator.edges.find((e) => e.from === 'generator').active,
    true,
  );
  assert.equal(generator.nodes.find((n) => n.id === 'battery-a').active, false);
});

test('NVL72 shelves are conversion equipment and do not double-count power', () => {
  for (const [id, kw] of [
    ['gb200-nvl72', 120],
    ['gb300-nvl72', 142],
  ]) {
    const m = modelForProfile(id),
      s = { ...initialPowerSettings(m), loadPercent: 100, scope: 'board' };
    const c = calculatePower(m, s);
    near(c.rackBaseKW, kw);
    assert.equal(c.devices.length, 29);
    assert.ok(
      c.devices.every((h) => profileFor(h).category !== 'infrastructure'),
    );
    near(c.dcKW, kw * 0.95);
    const graph = powerGraph(m, s);
    assert.equal(
      graph.nodes.find((n) => n.id === 'board-input').title,
      'Tray DC input',
    );
    assert.match(
      graph.nodes.find((n) => n.id === 'conversion').description,
      /DC-to-DC/,
    );
    near(
      c.allocation.reduce((n, g) => n + g.kw, 0) + c.boardLossKW,
      c.deviceAC * 0.95,
    );
    const management = m.hardware.find((h) => profileFor(h).id === 'sn2201');
    const auxiliary = powerGraph(m, {
      ...s,
      scope: 'rack',
      hardwareId: management.id,
    });
    assert.ok(
      auxiliary.edges.some((e) => e.from === 'pdu-a' && e.to === 'device'),
    );
    assert.ok(
      !auxiliary.edges.some((e) => e.from === 'dc-bus' && e.to === 'device'),
    );
    assert.equal(
      powerGraph(m, { ...s, hardwareId: management.id }).nodes[0].title,
      'Chassis AC input',
    );
  }
});

test('every documented platform has connected, inspectable power stages and load endpoints', () => {
  for (const profile of VISIBLE_CATALOG.filter(
    (p) => p.status === 'Documented',
  )) {
    const m = modelForProfile(profile.id),
      s = initialPowerSettings(m);
    for (const scope of ['facility', 'rack', 'board']) {
      const g = powerGraph(m, { ...s, scope });
      const ids = new Set(g.nodes.map((n) => n.id));
      assert.equal(ids.size, g.nodes.length);
      for (const e of g.edges) assert.ok(ids.has(e.from) && ids.has(e.to));
      for (const n of g.nodes)
        if (n.hardwareId) assert.ok(resolveHardware(n.hardwareId, m));
      if (scope === 'board') {
        const loads = g.nodes.filter((n) => n.id.startsWith('load-'));
        assert.ok(loads.length > 0, profile.id);
        for (const load of loads) {
          const ancestors = traceAncestors(g.nodes, g.edges, load.id);
          assert.ok(ancestors.has('board-input'));
          assert.ok(ancestors.has('vrm'));
        }
      }
    }
  }
  const storage = modelForProfile('ai400x2');
  const g = powerGraph(storage, {
    ...initialPowerSettings(storage),
    scope: 'board',
  });
  assert.ok(g.nodes.some((n) => n.id === 'load-storage' && n.hardwareId));
});

test('empty racks, zero budgets and user overrides retain honest finite results', () => {
  const empty = blankModel(),
    s = initialPowerSettings(empty),
    c = calculatePower(empty, s);
  assert.equal(c.requestedKW, 0);
  assert.equal(c.sourceKW, 0);
  assert.equal(c.batteryMinutes, null);
  assert.equal(powerGraph(empty, { ...s, scope: 'board' }).nodes.length, 0);
  const overridden = calculatePower(model, { ...defaults, deviceBudgetKW: 0 });
  assert.equal(overridden.sourceKW, 0);
  assert.equal(overridden.budgets[0].documented, false);
  assert.match(overridden.budgets[0].basis, /User-supplied/);
  assert.equal(devicePowerBudget(model, model.hardware[0]).documented, true);
  const oem = modelForProfile('dell-xe9780');
  assert.equal(devicePowerBudget(oem, oem.hardware[0]).documented, false);
});

test('power tools apply valid state transitions atomically and reject malformed settings', () => {
  let state = initialPowerSettings(DEFAULT_MODEL);
  const tools = powerTools({
    model: () => DEFAULT_MODEL,
    read: () => state,
    configure: (next) => {
      state = next;
    },
  });
  const read = tools.find((t) => t.name === 'get_power_model'),
    configure = tools.find((t) => t.name === 'configure_power_path');
  const result = configure.execute({
    scope: 'board',
    stageId: 'load-gpu',
    scenario: 'feed-a-loss',
    loadPercent: 80,
  });
  assert.equal(result.settings.stageId, 'load-gpu');
  assert.equal(result.feedAKW, 0);
  assert.equal(read.execute({}).settings.loadPercent, 80);
  const before = structuredClone(state);
  for (const input of [
    { loadPercent: 101 },
    { loadPercent: NaN },
    { scope: ['board'] },
    { scenario: 'invalid' },
    { scope: 'facility', stageId: 'load-gpu' },
    { rackId: 'missing' },
    { hardwareId: 'missing' },
    { batteryKWh: 50 },
    null,
    [],
  ]) {
    assert.throws(() => configure.execute(input));
    assert.deepEqual(state, before);
  }
  assert.throws(() => read.execute({ unexpected: true }));
  const storageRack = DEFAULT_MODEL.hardware.find(
    (h) => h.id === 'ddn-01',
  ).rack;
  const changed = configure.execute({
    rackId: storageRack,
    scope: 'board',
    hardwareId: 'ddn-01',
  });
  assert.equal(changed.settings.stageId, 'board-input');
  assert.ok(changed.stages.some((n) => n.id === 'load-storage'));
  assert.equal(
    validatePowerPatch({ scope: 'rack' }, DEFAULT_MODEL, state).stageId,
    'feed-a',
  );
});

test('opening the power view uses the explorer state and rejects unknown racks before mutation', () => {
  let state = {
    model: DEFAULT_MODEL,
    selected: null,
    node: null,
    view: 'physical',
    fabric: 'compute',
  };
  const open = explorerTools({
    read: () => state,
    inspect: () => {},
    showFabric: () => {},
    showPower: (rackId) => {
      state = { ...state, view: 'power', powerRackId: rackId };
    },
  }).find((t) => t.name === 'show_cluster_power');
  assert.equal(
    open.execute({ rackId: DEFAULT_MODEL.racks[1].id }).state.view,
    'power',
  );
  assert.equal(state.powerRackId, DEFAULT_MODEL.racks[1].id);
  const before = structuredClone(state);
  assert.throws(() => open.execute({ rackId: 'invalid' }));
  assert.throws(() => open.execute({ unexpected: true }));
  assert.deepEqual(state, before);
});

test('physical and schematic presentations share one scenario and validate presentation changes', () => {
  const start = initialPowerSettings(model);
  assert.equal(start.presentation, 'physical');
  assert.equal(start.scope, 'rack');
  const changed = validatePowerPatch(
    { presentation: 'schematic', scenario: 'feed-b-loss', stageId: 'dc-bus' },
    model,
    start,
  );
  assert.equal(changed.presentation, 'schematic');
  assert.equal(changed.scenario, 'feed-b-loss');
  assert.throws(
    () => validatePowerPatch({ presentation: 'unknown' }, model, changed),
    /Presentation/,
  );
  assert.deepEqual(
    calculatePower(model, changed),
    calculatePower(model, { ...changed, presentation: 'physical' }),
  );
});

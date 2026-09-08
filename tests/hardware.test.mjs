import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  VISIBLE_CATALOG,
  profileFor,
  partFor,
} from '../lib/catalog.ts';
import {
  DEFAULT_MODEL,
  childrenOf,
  resolveHardware,
  specsFor,
} from '../lib/hardware.ts';
import {
  blankModel,
  placementError,
  placeHardware,
  moveHardware,
  removeHardware,
  firstFreeU,
  modelForProfile,
  totals,
  exportModel,
  importModel,
  cloneForBuilder,
  addConnection,
  portBudget,
} from '../lib/rack-builder.ts';
import { explorerTools } from '../lib/webmcp.ts';
const profile = (id) => CATALOG.find((p) => p.id === id);
test('reference model has the expected populations and no overbooked fabric ports', () => {
  assert.equal(totals(DEFAULT_MODEL).gpus, 64);
  assert.equal(totals(DEFAULT_MODEL).memoryGB, 5120);
  for (const h of DEFAULT_MODEL.hardware) {
    assert.equal(
      placementError(DEFAULT_MODEL, profileFor(h), h.rack, h.u, h.id),
      null,
    );
    const used = DEFAULT_MODEL.links
      .filter((l) => l.from === h.id || l.to === h.id)
      .reduce((n, l) => n + l.count, 0);
    assert.ok(
      used <= portBudget(h),
      `${h.id}: ${used} exceeds ${portBudget(h)}`,
    );
  }
});
test('catalog includes OEMs and every buildable device supports internal inspection', () => {
  for (const maker of [
    'NVIDIA',
    'AMD',
    'Dell',
    'HPE',
    'Lenovo',
    'Supermicro',
    'DDN',
  ])
    assert.ok(VISIBLE_CATALOG.some((p) => p.maker === maker));
  for (const p of VISIBLE_CATALOG.filter((p) => p.status === 'Documented')) {
    const m = modelForProfile(p.id);
    for (const h of m.hardware) {
      const children = childrenOf(h);
      assert.ok(children.length > 0, h.id);
      for (const c of children) {
        assert.deepEqual(resolveHardware(c.id, m), c);
        assert.ok(specsFor(c).length);
        assert.ok(partFor(c));
      }
      assert.equal(new Set(children.map((c) => c.id)).size, children.length);
    }
  }
});
test('GPU memory and slot counts follow each OEM, not inherited H100 values', () => {
  for (const [id, count, gb, dimms] of [
    ['dgx-b300', 8, 288, 32],
    ['dell-xe9780', 8, 270, 32],
    ['hpe-xd685', 8, 288, 24],
    ['lenovo-sr680a-v4', 8, 288, 32],
    ['sm-mi355x', 8, 288, 24],
  ]) {
    const m = modelForProfile(id),
      h = m.hardware[0],
      kids = childrenOf(h);
    assert.equal(totals(m).memoryGB, count * gb);
    assert.equal(kids.filter((c) => c.kind === 'memory').length, dimms);
    assert.ok(
      specsFor(kids.find((c) => c.kind === 'gpu')).some((s) =>
        s.value.includes(`${gb} GB`),
      ),
    );
    assert.ok(!JSON.stringify(specsFor(h)).includes('H100'));
  }
});
test('NVL72 templates use documented 48U locations and generation-specific DPUs', () => {
  for (const [id, dpu] of [
    ['gb200-nvl72', 2],
    ['gb300-nvl72', 1],
  ]) {
    const m = modelForProfile(id);
    assert.equal(m.racks[0].units, 48);
    assert.equal(totals(m).gpus, 72);
    assert.equal(m.hardware.length, 37);
    assert.deepEqual(
      m.hardware.filter((h) => h.id.startsWith('compute')).map((h) => h.u),
      [11, 12, 13, 14, 15, 16, 17, 18, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37],
    );
    assert.equal(
      childrenOf(m.hardware[0]).filter((c) => c.part === 'dpu').length,
      dpu,
    );
    const used = new Set();
    for (const h of m.hardware) {
      for (let u = h.u; u < h.u + h.height; u++) {
        assert.ok(!used.has(u));
        used.add(u);
      }
    }
  }
  assert.throws(() => modelForProfile('vera-rubin-nvl72'), /Preliminary/);
  assert.throws(
    () => cloneForBuilder(modelForProfile('gb300-nvl72')),
    /integrated rack/,
  );
});
test('custom placement checks boundaries, overlap, unique IDs and mounting families', () => {
  let m = blankModel();
  m = placeHardware(m, 'dgx-b300', 'R01', 1, 'a');
  assert.equal(firstFreeU(m, profile('dgx-b300'), 'R01'), 11);
  assert.throws(() => placeHardware(m, 'dgx-b300', 'R01', 10, 'b'), /occupied/);
  assert.throws(
    () => placeHardware(m, 'dgx-b300', 'R01', 34, 'b'),
    /starting U/,
  );
  assert.throws(
    () => placeHardware(m, 'gb300-tray', 'R01', 11, 'b'),
    /mounting/,
  );
  assert.throws(() => placeHardware(m, 'dgx-b300', 'R01', 11, 'a'), /unique/);
  assert.throws(
    () => placeHardware(m, 'dgx-b300', 'R01', NaN, 'b'),
    /starting U/,
  );
  m = moveHardware(m, 'a', 'R01', 33);
  assert.equal(m.hardware[0].u, 33);
  assert.equal(m.hardware[0].u + m.hardware[0].height - 1, 42);
});
test('saved layouts round-trip and reject malformed or incompatible imports atomically', () => {
  const custom = cloneForBuilder(DEFAULT_MODEL),
    serialized = exportModel(custom),
    restored = importModel(serialized);
  assert.equal(totals(restored).gpus, 64);
  assert.equal(restored.links.length, custom.links.length);
  assert.equal(exportModel(restored), serialized);
  const bad = JSON.parse(serialized);
  bad.equipment[1].u = 1;
  assert.throws(() => importModel(JSON.stringify(bad)), /occupied/);
  bad.equipment[1].u = 10;
  bad.equipment[0].profile = 'not-real';
  assert.throws(() => importModel(JSON.stringify(bad)), /Unknown/);
  assert.throws(() => importModel('{bad json'));
  assert.throws(() => importModel(' '.repeat(250001)), /too large/);
});
test('connection limits and device removal maintain a consistent graph', () => {
  let m = placeHardware(blankModel(), 'dgx-b300', 'R01', 1, 'a');
  m = placeHardware(m, 'sn5600', 'R01', 11, 'b');
  m = addConnection(m, {
    id: 'link-1',
    from: 'a',
    to: 'b',
    fabric: 'compute',
    rate: 800,
    count: 8,
  });
  assert.equal(m.links.length, 1);
  assert.throws(
    () =>
      addConnection(m, {
        id: 'link-2',
        from: 'a',
        to: 'b',
        fabric: 'compute',
        rate: 800,
        count: 99,
      }),
    /unassigned/,
  );
  assert.throws(
    () =>
      addConnection(m, {
        id: 'link-2',
        from: 'a',
        to: 'a',
        fabric: 'compute',
        rate: 800,
        count: 1,
      }),
    /different/,
  );
  assert.equal(removeHardware(m, 'a').links.length, 0);
});
test('storage describes unpublished drive population and board details honestly', () => {
  const m = modelForProfile('ai400x2'),
    kids = childrenOf(m.hardware[0]);
  assert.ok(kids.some((c) => c.kind === 'controller'));
  assert.ok(kids.some((c) => c.kind === 'backplane'));
  assert.ok(kids.some((c) => c.kind === 'psu'));
  const disk = kids.find((c) => c.kind === 'nvme');
  assert.equal(partFor(disk).schematic, true);
  assert.ok(
    specsFor(disk).some(
      (s) => s.value === 'Not specified in referenced data sheet',
    ),
  );
});
test('structured tools validate input and update the same supplied state actions', () => {
  let state = {
    model: DEFAULT_MODEL,
    selected: null,
    node: null,
    view: 'physical',
    fabric: 'compute',
  };
  const tools = explorerTools({
    read: () => state,
    inspect: (id) => {
      state = {
        ...state,
        selected: id,
        node: id.includes('/') ? id.split('/')[0] : null,
      };
    },
    showFabric: (fabric) => {
      state = { ...state, fabric, view: 'topology' };
    },
  });
  assert.deepEqual(
    tools.map((t) => t.name),
    ['get_cluster_model', 'inspect_cluster_hardware', 'show_cluster_fabric'],
  );
  assert.equal(tools[0].execute({}).hardware.length, 28);
  tools[1].execute({ id: 'ddn-01/controller-0' });
  assert.equal(state.selected, 'ddn-01/controller-0');
  tools[2].execute({ fabric: 'storage' });
  assert.equal(state.view, 'topology');
  const before = structuredClone(state);
  assert.throws(() => tools[1].execute({ id: 'bad' }), /Unknown/);
  assert.throws(() => tools[2].execute({ fabric: 'invalid' }), /Network/);
  assert.throws(() => tools[0].execute({ x: 1 }), /No arguments/);
  assert.deepEqual(state, before);
});

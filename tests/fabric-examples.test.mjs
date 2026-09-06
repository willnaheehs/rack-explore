import test from 'node:test';
import assert from 'node:assert/strict';
import { VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import { DEFAULT_MODEL, fabricInfo } from '../lib/hardware.ts';
import {
  modelForProfile,
  portBudget,
  placementError,
  cloneForBuilder,
  exportModel,
  importModel,
} from '../lib/rack-builder.ts';
import { withFabricExample } from '../lib/fabric-examples.ts';
import { explorerTools } from '../lib/webmcp.ts';
test('each documented preset has all three external example fabrics within catalog port and U budgets', () => {
  for (const p of VISIBLE_CATALOG.filter((p) => p.status === 'Documented')) {
    const base = modelForProfile(p.id),
      before = JSON.stringify(base),
      m = withFabricExample(base);
    assert.equal(JSON.stringify(base), before);
    assert.ok(m.fabricExample, p.id);
    assert.equal(m.racks.length, base.racks.length + 1);
    for (const fabric of ['compute', 'frontend', 'storage'])
      assert.ok(
        m.links.some((l) => l.fabric === fabric),
        `${p.id}/${fabric}`,
      );
    for (const h of m.hardware) {
      if (h.rack === 'EXAMPLE')
        assert.equal(
          placementError(m, profileFor(h), h.rack, h.u, h.id),
          null,
          `${p.id}/${h.id}`,
        );
      const rack = m.racks.find((r) => r.id === h.rack);
      assert.ok(h.u >= 1 && h.u + h.height - 1 <= rack.units);
      const used = m.links
        .filter((l) => l.from === h.id || l.to === h.id)
        .reduce((n, l) => n + l.count, 0);
      assert.ok(
        used <= portBudget(h),
        `${p.id}/${h.id}: ${used} > ${portBudget(h)}`,
      );
    }
    for (const rack of m.racks) {
      const used = new Set();
      for (const h of m.hardware.filter((h) => h.rack === rack.id))
        for (let u = h.u; u < h.u + h.height; u++) {
          assert.ok(!used.has(u), `${p.id}/${rack.id}/U${u}`);
          used.add(u);
        }
    }
    for (const l of m.links) {
      assert.ok(m.hardware.some((h) => h.id === l.from));
      assert.ok(m.hardware.some((h) => h.id === l.to));
      assert.match(l.label, /example/);
    }
    for (const h of base.hardware)
      assert.deepEqual(
        m.hardware.find((item) => item.id === h.id),
        h,
      );
    assert.equal(withFabricExample(m), m);
  }
});
test('examples distinguish Ethernet and InfiniBand and leave custom and reference links untouched', () => {
  for (const id of ['sm-mi350x', 'sm-mi355x', 'sn5600'])
    assert.equal(
      withFabricExample(modelForProfile(id)).fabricExample.computeTransport,
      'Ethernet',
    );
  for (const id of ['gb200-nvl72', 'gb300-nvl72', 'dgx-h200', 'q3400'])
    assert.equal(
      withFabricExample(modelForProfile(id)).fabricExample.computeTransport,
      'InfiniBand',
    );
  const fast = withFabricExample(modelForProfile('q3400'));
  assert.equal(
    profileFor(fast.hardware.find((h) => h.id === 'example-client')).id,
    'dgx-b300',
  );
  assert.equal(withFabricExample(DEFAULT_MODEL), DEFAULT_MODEL);
  const custom = cloneForBuilder(
    withFabricExample(modelForProfile('dgx-b300')),
  );
  assert.equal(custom.fabricExample, undefined);
  assert.equal(withFabricExample(custom), custom);
  assert.equal(
    importModel(exportModel(custom)).links.length,
    custom.links.length,
  );
});
test('fabric navigation can load a documented platform and rejects invalid IDs atomically', () => {
  let state = {
    model: DEFAULT_MODEL,
    selected: null,
    node: null,
    view: 'physical',
    fabric: 'compute',
  };
  const tools = explorerTools({
    read: () => state,
    inspect: () => {},
    showFabric: (fabric, platform) => {
      state = {
        ...state,
        fabric,
        view: 'topology',
        model: platform ? withFabricExample(platform) : state.model,
      };
    },
  });
  const show = tools.find((t) => t.name === 'show_cluster_fabric'),
    read = tools.find((t) => t.name === 'get_cluster_model');
  show.execute({ fabric: 'storage', platformId: 'gb300-nvl72' });
  assert.equal(state.model.id, 'gb300-nvl72');
  assert.equal(fabricInfo(state.model, 'compute').speed, '800 Gb/s InfiniBand');
  assert.ok(read.execute({}).fabricConnections.every((f) => f.links > 0));
  assert.ok(
    read.execute({}).availablePlatforms.some((p) => p.id === 'hpe-xd685'),
  );
  const before = structuredClone(state);
  for (const platformId of ['invalid', 'vera-rubin-nvl72', {}, null])
    assert.throws(() => show.execute({ fabric: 'compute', platformId }));
  assert.deepEqual(state, before);
});

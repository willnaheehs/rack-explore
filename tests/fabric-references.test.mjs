import test from 'node:test';
import assert from 'node:assert/strict';
import { VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import { DEFAULT_MODEL, fabricInfo, resolveHardware } from '../lib/hardware.ts';
import { withReferenceFabrics } from '../lib/fabric-references.ts';
import {
  modelForProfile,
  cloneForBuilder,
  exportModel,
  importModel,
} from '../lib/rack-builder.ts';
import { explorerTools } from '../lib/webmcp.ts';
const load = (id) => withReferenceFabrics(modelForProfile(id));

test('all presets have source-backed coverage without manufactured hardware or physical cable schedules', () => {
  for (const p of VISIBLE_CATALOG.filter((p) => p.status === 'Documented')) {
    const base = modelForProfile(p.id),
      before = structuredClone(base),
      model = withReferenceFabrics(base);
    assert.deepEqual(base, before);
    assert.deepEqual(model.hardware, base.hardware);
    assert.deepEqual(model.racks, base.racks);
    assert.deepEqual(model.links, []);
    assert.equal(withReferenceFabrics(model), model);
    for (const fabric of ['compute', 'frontend', 'storage']) {
      const plan = model.fabricReferences[fabric];
      assert.ok(plan, p.id);
      const ids = new Set(plan.nodes.map((n) => n.id));
      assert.equal(ids.size, plan.nodes.length);
      assert.ok(plan.sources.length);
      assert.ok(plan.limitations.length);
      for (const n of plan.nodes) {
        assert.ok(n.sources.length, n.id);
        if (n.hardwareId) assert.ok(resolveHardware(n.hardwareId, model));
      }
      for (const c of plan.connections) {
        assert.ok(ids.has(c.from) && ids.has(c.to), c.id);
        assert.notEqual(c.from, c.to);
        assert.ok(c.sources.length, c.id);
        for (const source of c.sources) {
          assert.equal(new URL(source.url).protocol, 'https:');
          assert.ok(source.section.length > 5);
        }
        if (c.kind === 'link') {
          assert.ok(Number.isInteger(c.count) && c.count > 0, c.id);
          assert.ok(c.rateGbps > 0, c.id);
        }
        if (c.kind === 'relationship') {
          assert.equal(c.count, undefined, c.id);
          assert.equal(c.rateGbps, undefined, c.id);
        }
      }
    }
  }
});
test('NVIDIA generations retain distinct rails, protocols and shared I/O counts', () => {
  for (const [id, rails, rate] of [
    ['dgx-h100', 8, 400],
    ['dgx-h200', 8, 400],
    ['dgx-b200', 8, 400],
    ['dgx-b300', 8, 800],
    ['gb200-nvl72', 4, 400],
    ['gb300-nvl72', 4, 800],
  ]) {
    const m = load(id),
      p = m.fabricReferences.compute;
    const hostLinks = p.connections.filter(
      (c) => c.kind === 'link' && c.from.startsWith('nic-'),
    );
    assert.equal(hostLinks.length, rails, id);
    assert.ok(
      hostLinks.every(
        (c) =>
          c.count === 1 &&
          c.rateGbps === rate &&
          c.protocol.startsWith('InfiniBand'),
      ),
    );
    assert.match(fabricInfo(m, 'compute').speed, new RegExp(`${rate}`));
  }
  for (const [id, count, rate] of [
    ['gb200-nvl72', 4, 200],
    ['gb300-nvl72', 2, 400],
  ]) {
    const { storage, frontend } = load(id).fabricReferences;
    const a = storage.connections.find((c) => c.sharedPhysicalId),
      b = frontend.connections.find((c) => c.sharedPhysicalId);
    assert.equal(a.sharedPhysicalId, b.sharedPhysicalId);
    assert.equal(a.count, count);
    assert.equal(a.rateGbps, rate);
    assert.equal(a.protocol, 'Ethernet');
    assert.deepEqual(storage.sharedWith, ['frontend']);
  }
});
test('Lenovo dual planes use sixteen 400G paths without consuming sixteen adapters', () => {
  const { compute, frontend, storage } =
    load('lenovo-sr680a-v4').fabricReferences;
  const cables = compute.connections.filter((c) => c.kind === 'link');
  assert.equal(cables.length, 16);
  for (let i = 0; i < 8; i++) {
    const two = cables.filter((c) => c.from === `nic-${i}`);
    assert.equal(two.length, 2);
    assert.ok(two.every((c) => c.rateGbps === 400));
    assert.equal(two[0].to, `leaf-${i % 2}`);
    assert.equal(two[1].to, `leaf-${2 + (i % 2)}`);
    assert.match(two[0].fromPort, /port 1/);
    assert.match(two[1].fromPort, /port 2/);
  }
  assert.deepEqual(
    frontend.connections
      .filter((c) => c.sharedPhysicalId)
      .map((c) => c.sharedPhysicalId),
    storage.connections
      .filter((c) => c.sharedPhysicalId)
      .map((c) => c.sharedPhysicalId),
  );
});
test('OEM designs do not inherit NVIDIA InfiniBand or arbitrary two-leaf allocations', () => {
  const dell = load('dell-xe9780');
  assert.equal(
    profileFor(dell.hardware[0]).parts.find((p) => p.key === 'nic').count,
    8,
  );
  assert.ok(
    dell.fabricReferences.compute.connections
      .filter((c) => c.kind === 'link')
      .every((c) => c.rateGbps === 400 && c.protocol === 'Ethernet / RoCEv2'),
  );
  for (const id of ['sm-mi350x', 'sm-mi355x']) {
    const p = load(id).fabricReferences.compute;
    const hostLinks = p.connections.filter((c) => c.from.startsWith('nic-'));
    assert.equal(hostLinks.length, 8);
    assert.ok(hostLinks.every((c) => c.to === 'leaf' && c.rateGbps === 400));
    assert.deepEqual(
      p.connections
        .filter((c) => c.from === 'leaf')
        .map((c) => [c.count, c.rateGbps]),
      [
        [16, 800],
        [16, 800],
      ],
    );
  }
});
test('unknown wiring is never upgraded to a verified link, and custom layouts round-trip', () => {
  for (const id of [
    'hpe-xd685',
    'sm-b300',
    'sn5600',
    'q3400',
    'qm9700',
    'sn4600c',
    'ai400x2',
  ]) {
    const m = load(id);
    for (const plan of Object.values(m.fabricReferences)) {
      assert.notEqual(plan.status, 'Reference design');
      assert.ok(plan.connections.every((c) => c.kind !== 'link'));
    }
  }
  assert.equal(
    load('ai400x2').fabricReferences.compute.status,
    'Not applicable',
  );
  const c = cloneForBuilder(DEFAULT_MODEL),
    serialized = exportModel(c);
  assert.equal(withReferenceFabrics(c), c);
  assert.equal(c.fabricReferences, undefined);
  assert.equal(exportModel(importModel(serialized)), serialized);
});
test('structured navigation returns the visible sourced plan and rejects unsupported IDs atomically', () => {
  let state = {
    model: withReferenceFabrics(DEFAULT_MODEL),
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
        model: platform ? withReferenceFabrics(platform) : state.model,
      };
    },
  });
  const show = tools.find((t) => t.name === 'show_cluster_fabric');
  const result = show.execute({ fabric: 'storage', platformId: 'gb300-nvl72' });
  assert.equal(result.reference.id, 'gb300-storage');
  assert.deepEqual(result.reference.sharedWith, ['frontend']);
  const before = structuredClone(state);
  for (const platformId of ['invalid', 'vera-rubin-nvl72', {}, null])
    assert.throws(() => show.execute({ fabric: 'compute', platformId }));
  assert.deepEqual(state, before);
});

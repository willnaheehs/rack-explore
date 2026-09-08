import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, profileFor } from '../lib/catalog.ts';
import { childrenOf, resolveHardware, specsFor } from '../lib/hardware.ts';
import {
  modelForProfile,
  totals,
  exportModel,
  importModel,
  blankModel,
  placeHardware,
  addConnection,
} from '../lib/rack-builder.ts';
import { withReferenceFabrics } from '../lib/fabric-references.ts';
import { validateConfiguration } from '../lib/config-validation.ts';
import {
  infrastructureFromCluster,
  clusterFromInfrastructure,
  importInfrastructure,
} from '../lib/infrastructure-adapter.ts';
import { exportInfrastructure, assetFacts } from '../lib/infrastructure.ts';
import {
  calculatePower,
  initialPowerSettings,
  devicePowerBudget,
} from '../lib/power.ts';
import {
  visibleComponentIds,
  componentPosition,
} from '../lib/component-layout.ts';
import { explorerTools } from '../lib/webmcp.ts';

const make = () => withReferenceFabrics(modelForProfile('washington-b300'));
const json = (v) => JSON.parse(JSON.stringify(v));

test('Washington preserves the supplied 32-node population and inspectable per-node components', () => {
  const model = make();
  assert.equal(model.hardware.length, 32);
  assert.equal(totals(model).gpus, 256);
  assert.equal(new Set(model.hardware.map((h) => h.id)).size, 32);
  for (const h of model.hardware) {
    const kids = childrenOf(h),
      p = profileFor(h);
    assert.equal(kids.filter((c) => c.part === 'gpu').length, 8);
    assert.equal(kids.filter((c) => c.part === 'cpu').length, 2);
    assert.ok(
      kids
        .filter((c) => c.part === 'cpu')
        .every((c) => c.model === 'AMD EPYC 9555'),
    );
    assert.equal(kids.filter((c) => c.part === 'boot').length, 2);
    assert.equal(kids.filter((c) => c.part === 'nvme').length, 8);
    assert.ok(!kids.some((c) => ['fan', 'psu'].includes(c.kind)));
    assert.ok(
      p.parts
        .filter((c) =>
          ['motherboard', 'baseboard', 'backplane'].includes(c.key),
        )
        .every((c) => c.population === 'representative'),
    );
    for (const c of [h, ...kids]) {
      assert.ok(resolveHardware(c.id, model));
      const specs = specsFor(c);
      assert.equal(new Set(specs.map((s) => s.label)).size, specs.length);
      if (c.parent) {
        assert.deepEqual(visibleComponentIds(kids, c.id, true), [c.id]);
        if (['cpu', 'memory', 'nic', 'nvme'].includes(c.kind))
          assert.ok(componentPosition(p, c, true).every(Number.isFinite));
      }
    }
  }
  const boot = childrenOf(model.hardware[0]).find((c) => c.part === 'boot');
  assert.match(
    specsFor(boot).find((s) => s.label === 'Pair capacity').value,
    /3.84 TB raw · 1.92 TB usable/,
  );
  assert.match(
    model.description,
    /actual rack count, placement and chassis depth remain unknown/,
  );
  const report = validateConfiguration(model);
  assert.deepEqual(
    report.issues.filter((i) => i.level === 'error'),
    [],
  );
  for (const text of [
    'rack count',
    '24 × 96 GB',
    'ConnectX-8',
    '150 TB WEKA',
  ])
    assert.ok(
      report.issues.some((i) => i.message.includes(text)),
      text,
    );
});

test('RoCE and WEKA remain supplied capacities, without fabricated physical ports or storage appliances', () => {
  const m = make(),
    refs = m.fabricReferences;
  assert.deepEqual(m.links, []);
  assert.equal(refs.compute.status, 'Supplied configuration');
  assert.match(refs.compute.speed, /8 × 800 Gb\/s/);
  assert.equal(
    refs.storage.nodes.find((n) => n.id === 'weka').subtitle,
    '150 TB · cluster total',
  );
  for (const p of Object.values(refs))
    for (const c of p.connections) {
      assert.notEqual(c.kind, 'link');
      assert.equal(c.count, undefined);
      if (c.kind === 'capability') assert.ok([400, 800].includes(c.rateGbps));
    }
  assert.equal(refs.frontend.connections.length, 0);
  assert.ok(!m.hardware.some((h) => profileFor(h).category === 'storage'));
  let custom = placeHardware(blankModel(), 'washington-b300', 'R01', 1, 'node');
  custom = placeHardware(custom, 'sn5600', 'R01', 10, 'switch');
  assert.equal(
    addConnection(custom, {
      from: 'node',
      to: 'switch',
      id: 'wire',
      fabric: 'compute',
      count: 8,
      rate: 800,
      protocol: 'ethernet',
    }).links.length,
    1,
  );
  assert.throws(
    () =>
      addConnection(custom, {
        from: 'node',
        to: 'switch',
        id: 'bad-storage',
        fabric: 'storage',
        count: 3,
        rate: 400,
        protocol: 'ethernet',
      }),
    /storage network exceeds/,
  );
  const p = profileFor(m.hardware[0]);
  assert.equal(p.parts.find((p) => p.key === 'memory').count, 24);
  assert.equal(p.parts.find((p) => p.key === 'nic').count, 8);
  assert.equal(p.parts.find((p) => p.key === 'io').count, 2);
  assert.equal(p.cooling, 'Air');
});

test('cluster and logical WEKA service survive portable export and reopen without silent loss', () => {
  const m = make(),
    doc = infrastructureFromCluster(m);
  const weka = doc.assets.find((a) => a.id === 'washington-b300/weka');
  assert.ok(weka);
  assert.equal(weka.placement, undefined);
  assert.equal(weka.evidence.basis, 'reported');
  assert.equal(
    assetFacts(doc, weka).find((f) => f.key === 'storage.capacity').value,
    150,
  );
  const file = exportInfrastructure(doc),
    reopened = importInfrastructure(file);
  assert.equal(exportInfrastructure(reopened), file);
  assert.deepEqual(json(clusterFromInfrastructure(reopened)), json(m));
  const altered = structuredClone(doc);
  altered.types.find((t) => t.id === weka.typeId).facts[0].value = 200;
  assert.throws(
    () => clusterFromInfrastructure(altered),
    /Infrastructure|snapshot|changed|differ|preserve/i,
  );
  assert.equal(importModel(exportModel(m)).hardware.length, 32);
});

test('the catalog exposes the supplied cluster and keeps power estimates explicitly unverified', () => {
  const m = make();
  assert.equal(CATALOG.find((p) => p.id === m.id).status, 'Supplied');
  const read = explorerTools({
    read: () => ({
      model: m,
      selected: null,
      node: null,
      view: 'physical',
      fabric: 'compute',
    }),
    inspect: () => {},
    showFabric: () => {},
  })
    .find((t) => t.name === 'get_cluster_model')
    .execute({});
  assert.ok(read.availablePlatforms.some((p) => p.id === m.id));
  const budget = devicePowerBudget(m, m.hardware[0]);
  assert.equal(budget.kw, 15);
  assert.equal(budget.documented, false);
  assert.equal(calculatePower(m, initialPowerSettings(m)).count, null);
});

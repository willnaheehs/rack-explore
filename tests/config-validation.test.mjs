import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import {
  DEFAULT_MODEL,
  childrenOf,
  specsFor,
  resolveHardware,
} from '../lib/hardware.ts';
import {
  blankModel,
  modelForProfile,
  placeHardware,
  addConnection,
  exportModel,
  importModel,
} from '../lib/rack-builder.ts';
import { validateConfiguration } from '../lib/config-validation.ts';
import { networkErrors } from '../lib/network-validation.ts';
import { withReferenceFabrics } from '../lib/fabric-references.ts';
import { calculatePower, initialPowerSettings } from '../lib/power.ts';
import { explorerTools } from '../lib/webmcp.ts';

const profile = (id) => CATALOG.find((p) => p.id === id);
const errors = (model) =>
  validateConfiguration(model).issues.filter((i) => i.level === 'error');
const pair = (a, b) =>
  placeHardware(
    placeHardware(blankModel(), a, 'R01', 1, 'a'),
    b,
    'R01',
    20,
    'b',
  );
const link = (extra = {}) => ({
  id: 'test',
  from: 'a',
  to: 'b',
  fabric: 'compute',
  count: 1,
  rate: 400,
  ...extra,
});

test('every documented preset and original H100 cluster passes modeled checks with remaining engineering work visible', () => {
  const documented = VISIBLE_CATALOG.filter((p) => p.status === 'Documented');
  assert.equal(documented.length, 17);
  for (const raw of [
    DEFAULT_MODEL,
    ...documented.map((p) => modelForProfile(p.id)),
  ]) {
    const model = withReferenceFabrics(raw),
      report = validateConfiguration(model);
    assert.equal(
      report.status,
      'checks-pass',
      `${model.id}: ${JSON.stringify(errors(model))}`,
    );
    assert.ok(report.componentCount > 0);
    assert.ok(report.sourceCount > 0);
    assert.ok(
      report.issues.some(
        (i) => i.area === 'Power and cooling' && i.level === 'review',
      ),
    );
    for (const h of model.hardware) {
      const children = childrenOf(h);
      for (const item of [h, ...children]) {
        assert.ok(resolveHardware(item.id, model));
        assert.equal(
          new Set(specsFor(item).map((s) => s.label)).size,
          specsFor(item).length,
          item.id,
        );
      }
    }
  }
});

test('source-audited chassis populations remain generation and OEM specific', () => {
  // Independent checkpoints from the manuals linked in docs/configuration-audit.md.
  for (const [id, units, gpus, gb, dimms, psus, fans] of [
    ['dgx-h100', 8, 8, 80, 32, 6, 12],
    ['dgx-h200', 8, 8, 141, 32, 6, 12],
    ['dgx-b200', 10, 8, 180, 32, 6, 20],
    ['dgx-b300', 10, 8, 288, 32, 12, 20],
    ['dell-xe9780', 10, 8, 270, 32, 12, 20],
    ['hpe-xd685', 5, 8, 288, 24, 12, 0],
    ['lenovo-sr680a-v4', 8, 8, 288, 32, 8, 21],
    ['sm-mi350x', 8, 8, 288, 24, 6, 14],
    ['sm-mi355x', 4, 8, 288, 24, 4, 5],
    ['sm-b300', 4, 8, 288, 24, 4, 4],
  ]) {
    const p = profile(id),
      count = (key) => p.parts.find((x) => x.key === key)?.count ?? 0;
    assert.deepEqual(
      [
        p.units,
        p.gpuCount,
        p.gpuMemoryGB,
        count('memory'),
        count('psu'),
        count('fan'),
      ],
      [units, gpus, gb, dimms, psus, fans],
      id,
    );
  }
  assert.match(
    profile('lenovo-sr680a-v4')
      .parts.find((p) => p.key === 'gpu')
      .specs.find((s) => s.label === 'Memory bandwidth').value,
    /7\.7/,
  );
  for (const [id, depth, psus, fans] of [
    ['sn4600c', 0.5664, 2, 3],
    ['qm9700', 0.66, 2, 7],
    ['sn2201', 0.432, 2, 4],
    ['sn5600', 0.72, 2, 4],
    ['q3400', 0.85, 8, 10],
  ]) {
    const p = profile(id);
    assert.equal(p.depth, depth);
    assert.equal(p.parts.find((p) => p.key === 'psu').count, psus);
    assert.equal(p.parts.find((p) => p.key === 'fan').count, fans);
  }
});

test('slots, selected options and unpublished storage blocks cannot masquerade as installed hardware', () => {
  assert.equal(
    profile('hpe-xd685').parts.find((p) => p.key === 'nic').population,
    'slots',
  );
  assert.equal(
    profile('sm-mi350x').parts.find((p) => p.key === 'nic').population,
    'option',
  );
  assert.equal(
    profile('sm-mi355x').parts.find((p) => p.key === 'fan').population,
    'slots',
  );
  assert.equal(
    profile('ai400x2').parts.find((p) => p.key === 'psu').population,
    'representative',
  );
  assert.equal(
    profile('q3400').parts.find((p) => p.key === 'asic').population,
    'representative',
  );
  const m = modelForProfile('ai400x2');
  const report = validateConfiguration(m);
  assert.ok(
    report.issues.some(
      (i) =>
        i.hardwareId === 'device-01' &&
        /counts are not an installed/.test(i.message),
    ),
  );
  assert.equal(calculatePower(m, initialPowerSettings(m)).count, null);
  assert.ok(
    validateConfiguration(modelForProfile('sm-b300')).issues.some((i) =>
      /conflicting inch/.test(i.message),
    ),
  );
});

test('validation catches malformed hardware, collisions and incomplete or mixed NVL72 racks', () => {
  let m = modelForProfile('dgx-b300');
  assert.ok(
    errors({ ...m, hardware: [{ ...m.hardware[0], profile: 'unknown' }] }).some(
      (i) => /unknown hardware/.test(i.message),
    ),
  );
  assert.ok(
    errors({ ...m, hardware: [{ ...m.hardware[0], height: 8 }] }).some((i) =>
      /chassis height/.test(i.message),
    ),
  );
  assert.ok(
    errors({
      ...m,
      hardware: [...m.hardware, { ...m.hardware[0], id: 'collision' }],
    }).some((i) => /occupied/.test(i.message)),
  );
  m = modelForProfile('gb300-nvl72');
  assert.ok(
    errors({ ...m, hardware: m.hardware.slice(1) }).some((i) =>
      /integrated NVL72/.test(i.message),
    ),
  );
  assert.ok(
    errors({
      ...m,
      hardware: m.hardware.map((h, i) =>
        i === 0 ? { ...h, profile: 'gb200-tray' } : h,
      ),
    }).some((i) => /one generation/.test(i.message)),
  );
  assert.ok(
    errors({
      ...m,
      hardware: m.hardware.map((h, i) => (i === 0 ? { ...h, u: 10 } : h)),
    }).some((i) => /positions disagree/.test(i.message)),
  );
});

test('network validation rejects incompatible protocols and unsupported rates at either endpoint', () => {
  for (const [a, b, rate, protocol] of [
    ['qm9700', 'sn5600', 400, undefined],
    ['dgx-b300', 'sn4600c', 400, undefined],
    ['dgx-b300', 'qm9700', 800, undefined],
    ['dgx-b300', 'q3400', 200, undefined],
    ['dgx-b300', 'sn5600', 800, 'infiniband'],
    ['sm-mi350x', 'qm9700', 400, undefined],
    ['dgx-b300', 'sn5600', 400, 'invalid'],
  ]) {
    const m = pair(a, b),
      before = structuredClone(m);
    assert.throws(
      () => addConnection(m, link({ rate, protocol })),
      /compatible|Ethernet or InfiniBand/,
    );
    assert.deepEqual(m, before);
  }
});

test('slower front-end ports cannot satisfy an overbooked 800G compute fabric', () => {
  for (const a of ['dgx-b300', 'dell-xe9780', 'lenovo-sr680a-v4']) {
    const m = pair(a, 'sn5600');
    assert.equal(
      addConnection(m, link({ rate: 800, count: 8 })).links.length,
      1,
    );
    assert.throws(
      () => addConnection(m, link({ rate: 800, count: 9 })),
      /rate budget|interface capacity/,
    );
  }
  const m = pair('lenovo-sr680a-v4', 'sn5600');
  assert.equal(
    addConnection(m, link({ rate: 400, count: 16, protocol: 'ethernet' }))
      .links[0].count,
    16,
  );
});

test('unknown HPE adapter slots remain review items when provisional links are added', () => {
  const m = addConnection(
    pair('hpe-xd685', 'sn5600'),
    link({ count: 8, rate: 800, protocol: 'ethernet' }),
  );
  const report = validateConfiguration(m);
  assert.equal(report.status, 'checks-pass');
  assert.ok(
    report.issues.some(
      (i) => i.area === 'Networking' && /adapter selection/.test(i.message),
    ),
  );
});

test('protocol selections survive export and incompatible imports fail atomically', () => {
  const m = addConnection(
    pair('dgx-b300', 'sn5600'),
    link({ rate: 800, count: 8, protocol: 'ethernet' }),
  );
  const serialized = exportModel(m);
  assert.equal(importModel(serialized).links[0].protocol, 'ethernet');
  const bad = JSON.parse(serialized);
  bad.connections[0].protocol = 'infiniband';
  assert.throws(() => importModel(JSON.stringify(bad)), /compatible/);
  assert.equal(exportModel(m), serialized);
  assert.ok(
    networkErrors({ ...m, links: [...m.links, m.links[0]] }).some((s) =>
      /Duplicate/.test(s),
    ),
  );
});

test('structured model readback includes the same validation report and preserves state on invalid input', () => {
  const state = {
    model: withReferenceFabrics(DEFAULT_MODEL),
    selected: null,
    node: null,
    view: 'physical',
    fabric: 'compute',
  };
  const tool = explorerTools({
    read: () => state,
    inspect: () => {},
    showFabric: () => {},
  })[0];
  assert.deepEqual(
    tool.execute({}).configurationChecks,
    validateConfiguration(state.model),
  );
  const before = structuredClone(state);
  assert.throws(() => tool.execute({ validate: 'production' }), /No arguments/);
  assert.deepEqual(state, before);
});

test('H100 separates its 100GbE management adapter from the shared 400G I/O adapter budget', () => {
  const p = profile('dgx-h100');
  assert.equal(p.parts.find((part) => part.key === 'management').count, 1);
  const m = pair('dgx-h100', 'qm9700');
  assert.equal(
    addConnection(m, link({ count: 10, rate: 400 })).links.length,
    1,
  );
  assert.throws(
    () => addConnection(m, link({ count: 11, rate: 400 })),
    /rate budget|interface capacity/,
  );
  assert.deepEqual(networkErrors(DEFAULT_MODEL), []);
});

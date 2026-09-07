import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATALOG, VISIBLE_CATALOG, CATALOG_REVISION } from '../lib/catalog.ts';
import { DEFAULT_MODEL, childrenOf, specsFor } from '../lib/hardware.ts';
import {
  modelForProfile,
  exportModel,
  placeHardware,
  blankModel,
} from '../lib/rack-builder.ts';
import { withReferenceFabrics } from '../lib/fabric-references.ts';
import {
  infrastructureFromCluster,
  clusterFromInfrastructure,
  importInfrastructure,
} from '../lib/infrastructure-adapter.ts';
import {
  smallCpuExample,
  lumiExample,
} from '../lib/infrastructure-examples.ts';
import {
  ancestors,
  assetFacts,
  instantiateAsset,
  readInfrastructure,
  exportInfrastructure,
  validateInfrastructure,
  compareQuantities,
} from '../lib/infrastructure.ts';
import { infrastructureTools } from '../lib/infrastructure-tools.ts';

const parse = (d) => readInfrastructure(JSON.stringify(d));
const mutation = (change) => {
  const d = smallCpuExample();
  change(d);
  return d;
};

test('all current rack models migrate losslessly, including integrated mounting and reference fabrics', () => {
  for (const source of [
    DEFAULT_MODEL,
    ...VISIBLE_CATALOG.filter((p) => p.status === 'Documented').map((p) =>
      modelForProfile(p.id),
    ),
  ]) {
    const model = withReferenceFabrics(source);
    const doc = infrastructureFromCluster(model);
    const file = exportInfrastructure(doc);
    const reopened = importInfrastructure(file);
    // JSON omits optional properties whose value is undefined.
    assert.deepEqual(
      JSON.parse(JSON.stringify(clusterFromInfrastructure(reopened))),
      JSON.parse(JSON.stringify(model)),
      model.id,
    );
    assert.equal(exportInfrastructure(reopened), file, model.id);
    assert.equal(
      doc.assets.length,
      model.racks.length +
        model.hardware.length +
        model.hardware.reduce((n, h) => n + childrenOf(h).length, 0) +
        1,
    );
    for (const h of model.hardware) {
      const a = doc.assets.find((a) => a.id === h.id);
      assert.deepEqual(
        assetFacts(doc, a).map((f) => [f.label, f.value]),
        specsFor(h).map((s) => [s.label, s.value]),
      );
      for (const child of childrenOf(h))
        assert.ok(
          doc.assets.some((a) => a.id === child.id && a.parentId === h.id),
        );
    }
  }
});

test('old v1 rack files open without rewriting the original file or manufacturing observed assets', () => {
  const model = placeHardware(
    blankModel(),
    'dgx-b300',
    'R01',
    1,
    'server-preserved',
  );
  const oldFile = exportModel(model);
  const doc = importInfrastructure(oldFile);
  assert.equal(doc.version, 2);
  assert.equal(doc.purpose, 'plan');
  assert.ok(doc.assets.some((a) => a.id === 'server-preserved'));
  assert.equal(exportModel(model), oldFile);
  assert.equal(
    doc.assets.some((a) => a.evidence.basis === 'reported'),
    false,
  );
  assert.equal(
    clusterFromInfrastructure(doc).hardware[0].id,
    'server-preserved',
  );
});

test('unfamiliar definitions, deeper components and extension data remain readable without catalog renderer support', () => {
  const d = smallCpuExample();
  d.types.push({
    id: 'acme.optical-compute',
    revision: 7,
    name: 'Unfamiliar accelerator',
    category: 'acme.photonic',
    facts: [],
    ports: [],
    extensions: {
      'acme.v1': { calibration: { label: 'preserve me', readings: [1, 2, 3] } },
    },
  });
  const instance = instantiateAsset(
    d.types.at(-1),
    'new-module',
    'Optical module',
    { basis: 'unknown', sources: [] },
    'server-1/ssd/controller',
  );
  d.assets.push(instance.asset);
  const reopened = parse(d);
  assert.equal(ancestors(reopened, 'new-module').length, 7);
  assert.deepEqual(reopened.types.at(-1).extensions, d.types.at(-1).extensions);
  assert.ok(
    validateInfrastructure(reopened).some(
      (i) => i.level === 'review' && /custom category/.test(i.message),
    ),
  );
  assert.throws(
    () => clusterFromInfrastructure(reopened),
    /general infrastructure/,
  );
  assert.equal(exportInfrastructure(reopened), exportInfrastructure(d));
});

test('asset definitions are pinned and instantiated interfaces do not follow later template edits', () => {
  const d = smallCpuExample(),
    t = d.types.find((t) => t.id === 'example.server');
  const a = instantiateAsset(t, 'independent', 'Independent', {
    basis: 'unknown',
    sources: [],
  });
  t.ports[0].capacity.value = 800;
  t.revision = 2;
  assert.equal(a.asset.typeRevision, 1);
  assert.equal(a.interfaces[0].capacity.value, 10);
  assert.throws(() => parse(d), /no matching type revision/);
});

test('reparenting preserves asset and port identity while containment cycles and orphan references fail', () => {
  const d = mutation((d) => {
    d.assets.find((a) => a.id === 'server-1/ssd').parentId = 'server-2';
  });
  const reopened = parse(d);
  assert.equal(
    ancestors(reopened, 'server-1/ssd/controller').at(-3).id,
    'server-2',
  );
  assert.equal(reopened.connections[0].to, 'server-1/port/network-1');
  for (const [change, pattern] of [
    [
      (d) => {
        d.assets.find((a) => a.id === 'site').parentId =
          'server-1/ssd/controller';
      },
      /acyclic/,
    ],
    [
      (d) => {
        d.assets.find((a) => a.id === 'server-1').parentId = 'missing';
      },
      /missing physical parent/,
    ],
    [
      (d) => {
        d.connections[0].to = 'missing';
      },
      /two existing/,
    ],
    [
      (d) => {
        d.interfaces[0].assetId = 'missing';
      },
      /owner does not exist/,
    ],
    [
      (d) => {
        d.groups[0].assetIds.push('missing');
      },
      /missing asset/,
    ],
    [
      (d) => {
        d.assets.push(structuredClone(d.assets[0]));
      },
      /Duplicate asset/,
    ],
  ])
    assert.throws(() => parse(mutation(change)), pattern);
});

test('connections check medium, direction, protocol, individual port allocation and unit-aware capacities', () => {
  assert.equal(
    compareQuantities({ value: 1, unit: 'kW' }, { value: 1000, unit: 'W' }),
    0,
  );
  assert.equal(
    compareQuantities(
      { value: 1, unit: 'Tb/s' },
      { value: 1000, unit: 'Gb/s' },
    ),
    0,
  );
  assert.equal(
    compareQuantities({ value: 1, unit: 'kW' }, { value: 1, unit: 'Gb/s' }),
    null,
  );
  assert.equal(
    compareQuantities(
      { value: 1, unit: 'toString' },
      { value: 1, unit: 'toString' },
    ),
    null,
  );
  assert.equal(
    compareQuantities(
      { value: 1e308, unit: 'Tb/s' },
      { value: 1e308, unit: 'Tb/s' },
    ),
    null,
  );
  for (const [change, pattern] of [
    [
      (d) => {
        d.connections[0].to = 'server-1/port/power-in';
      },
      /media do not match/,
    ],
    [
      (d) => {
        d.interfaces.find((p) => p.id === 'switch/port/port-1').direction =
          'in';
      },
      /direction contradicts/,
    ],
    [
      (d) => {
        d.interfaces.find((p) => p.id === 'server-1/port/network-1').protocol =
          'infiniband';
      },
      /protocols do not match/,
    ],
    [
      (d) => {
        d.connections[0].capacity = { value: 0.1, unit: 'Tb/s' };
      },
      /exceeds/,
    ],
    [
      (d) => {
        d.connections.push({ ...d.connections[0], id: 'double-booked' });
      },
      /allocated 2 times/,
    ],
    [
      (d) => {
        d.connections[0].quantity = 2;
      },
      /individual ports|allocated 2 times/,
    ],
  ])
    assert.throws(() => parse(mutation(change)), pattern);
  const unknownUnits = mutation((d) => {
    d.connections[0].capacity.unit = 'future-rate-unit';
  });
  assert.ok(
    validateInfrastructure(parse(unknownUnits)).some((i) =>
      /units cannot be compared/.test(i.message),
    ),
  );
  const incomplete = mutation((d) => {
    delete d.interfaces.find((p) => p.id === 'server-1/port/network-1')
      .capacity;
  });
  assert.ok(
    validateInfrastructure(parse(incomplete)).some((i) =>
      /not fully specified/.test(i.message),
    ),
  );
});

test('rack placement validates containment, occupied U positions, height and mounting while equipment can exist outside racks', () => {
  assert.doesNotThrow(() => parse(smallCpuExample()));
  for (const [change, pattern] of [
    [
      (d) => {
        d.assets.find((a) => a.id === 'server-2').placement.rack.u = 3;
      },
      /overlaps/,
    ],
    [
      (d) => {
        d.assets.find((a) => a.id === 'server-2').placement.rack.u = 42;
      },
      /extends past/,
    ],
    [
      (d) => {
        d.assets.find((a) => a.id === 'server-2').placement.rack.mount =
          'NVL72';
      },
      /incompatible/,
    ],
    [
      (d) => {
        d.assets.find((a) => a.id === 'server-2').parentId = 'room';
      },
      /rack parent/,
    ],
  ])
    assert.throws(() => parse(mutation(change)), pattern);
});

test('LUMI keeps reported aggregate populations, representative architecture and unknown facility routing distinct', () => {
  const d = parse(lumiExample());
  assert.equal(d.purpose, 'reference');
  assert.equal(d.assets.find((a) => a.id === 'lumi-g').quantity, 2978);
  assert.equal(d.assets.find((a) => a.id === 'lumi-c').quantity, 2048);
  assert.equal(
    d.assets.find((a) => a.id === 'lumi-g/example').representation,
    'representative',
  );
  assert.ok(d.assets.every((a) => a.placement === undefined));
  assert.ok(
    d.connections.every(
      (c) => c.kind === 'logical' && c.capacity === undefined,
    ),
  );
  assert.equal(
    d.sources.find((s) => s.id === 'lumi-facility').retrievedAt,
    '2026-09-07',
  );
  assert.equal(
    d.assets.find((a) => a.id === 'lumi-power').evidence.asOf,
    '2024-11-19',
  );
  const bad = structuredClone(d);
  bad.assets.find((a) => a.id === 'lumi-g/example').representation =
    'individual';
  assert.throws(() => parse(bad), /representative component/);
});

test('strict file validation rejects unsupported versions, unsafe URLs and malformed evidence', () => {
  for (const [change, pattern] of [
    [
      (d) => {
        d.version = 99;
      },
      /Unsupported file version/,
    ],
    [
      (d) => {
        d.assets[0].extraField = true;
      },
      /unsupported field/,
    ],
    [
      (d) => {
        d.assets[0].quantity = 1e30;
      },
      /invalid number/,
    ],
    [
      (d) => {
        d.types[0].facts = [
          {
            key: 'test',
            label: 'Test',
            value: null,
            evidence: { basis: 'reported', sources: [] },
          },
        ];
      },
      /missing value/,
    ],
    [
      (d) => {
        d.assets[0].evidence = { basis: 'reported', sources: [] };
      },
      /needs a source/,
    ],
    [
      (d) => {
        d.assets[0].evidence.asOf = '2026-02-30';
      },
      /valid YYYY-MM-DD/,
    ],
    [
      (d) => {
        d.assets[0].evidence.sources = ['missing'];
      },
      /missing source/,
    ],
    [
      (d) => {
        d.sources = [
          {
            id: 'bad',
            title: 'Bad source',
            url: 'javascript:alert(1)',
            retrievedAt: '2026-09-07',
          },
        ];
      },
      /HTTP or HTTPS/,
    ],
  ])
    assert.throws(() => parse(mutation(change)), pattern);
  assert.throws(
    () => readInfrastructure('{"__proto__": {"x": true}}'),
    /Unsafe property/,
  );
  assert.throws(
    () => readInfrastructure(' '.repeat(10_000_001)),
    /exceeds 10 MB/,
  );
});

test('fact conflicts are preserved and reviewed, and unknown models are never forced through the legacy renderer', () => {
  const d = infrastructureFromCluster(DEFAULT_MODEL);
  const a = d.assets.find((a) => a.id === 'dgx-01');
  a.facts.push(
    {
      key: 'power.draw',
      label: 'Observed power',
      value: 5,
      unit: 'kW',
      evidence: { basis: 'estimated', sources: [], asOf: '2026-09-01' },
    },
    {
      key: 'power.draw',
      label: 'Observed power',
      value: 6,
      unit: 'kW',
      evidence: { basis: 'estimated', sources: [], asOf: '2026-09-02' },
    },
  );
  assert.ok(
    validateInfrastructure(parse(d)).some((i) =>
      /differing observations/.test(i.message),
    ),
  );
  assert.equal(
    assetFacts(d, a).filter((f) => f.key === 'power.draw').length,
    2,
  );
  assert.throws(() => clusterFromInfrastructure(d), /edits beyond/);
  const old = infrastructureFromCluster(DEFAULT_MODEL);
  old.extensions['rack-explore'].catalogRevision = 'older';
  assert.throws(() => clusterFromInfrastructure(old), /catalog revision/);
  assert.equal(
    old.types.find((t) => t.id === 'catalog.dgx-h100').extensions[
      'rack-explore'
    ].catalogRevision,
    CATALOG_REVISION,
  );
  assert.equal(
    CATALOG.some((p) => p.id === 'dgx-h100'),
    true,
  );
});

test('structured navigation reaches deeply nested equipment and invalid actions preserve the selected model', () => {
  let state = { document: smallCpuExample(), selected: null };
  const tools = infrastructureTools({
    read: () => state,
    select: (id) => {
      state = { ...state, selected: id };
    },
    load: (example) => {
      state = {
        document: example === 'lumi' ? lumiExample() : smallCpuExample(),
        selected: null,
      };
    },
  });
  tools[1].execute({ id: 'server-1/ssd/controller' });
  assert.equal(tools[0].execute({}).path.length, 6);
  tools[2].execute({ example: 'lumi' });
  assert.equal(state.document.id, 'lumi-public-record');
  const before = structuredClone(state);
  assert.throws(() => tools[0].execute({ extra: true }), /No arguments/);
  assert.throws(() => tools[1].execute({ id: 'missing' }), /existing asset/);
  assert.throws(() => tools[2].execute({ example: 'unrecognized' }), /Choose/);
  assert.deepEqual(state, before);
  tools[1].execute({ id: null });
  assert.equal(tools[0].execute({}).children[0].id, 'csc-kajaani');
});

test('committed public files exactly reproduce their documented generators', async () => {
  for (const doc of [smallCpuExample(), lumiExample()]) {
    const file = await readFile(
      new URL(
        `../public/models/${doc.id}.physical-compute.json`,
        import.meta.url,
      ),
      'utf8',
    );
    assert.equal(file, exportInfrastructure(doc));
    assert.deepEqual(readInfrastructure(file), doc);
  }
});

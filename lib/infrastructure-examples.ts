import {
  instantiateAsset,
  type Infrastructure,
  type Evidence,
  type Fact,
  type Asset,
  type AssetType,
  type PortDefinition,
} from './infrastructure.ts';

const planned: Evidence = {
  basis: 'estimated',
  sources: [],
  note: 'Example configuration for learning and planning. This is not the owner’s mini data center.',
};
const unknown: Evidence = {
  basis: 'unknown',
  sources: [],
  note: 'Not established by this record.',
};
const reported = (source: string, asOf = '2026-09-07'): Evidence => ({
  basis: 'reported',
  sources: [source],
  asOf,
});
const fact = (
  key: string,
  label: string,
  value: Fact['value'],
  evidence: Evidence,
  unit?: string,
): Fact => ({ key, label, value, evidence, ...(unit ? { unit } : {}) });
const port = (
  key: string,
  medium: string,
  direction: PortDefinition['direction'],
  value?: number,
  unit?: string,
): PortDefinition => ({
  key,
  name: key,
  medium,
  direction,
  ...(value !== undefined && unit ? { capacity: { value, unit } } : {}),
});
const empty = (
  id: string,
  title: string,
  description: string,
  purpose: Infrastructure['purpose'],
): Infrastructure => ({
  format: 'physical-compute',
  version: 2,
  id,
  title,
  description,
  purpose,
  types: [],
  assets: [],
  interfaces: [],
  connections: [],
  groups: [],
  sources: [],
});
function addType(
  doc: Infrastructure,
  id: string,
  name: string,
  category: string,
  facts: Fact[] = [],
  ports: PortDefinition[] = [],
): AssetType {
  const t = { id, revision: 1, name, category, facts, ports };
  doc.types.push(t);
  return t;
}
function add(
  doc: Infrastructure,
  t: AssetType,
  id: string,
  name: string,
  parentId?: string,
  evidence = planned,
  extra: Partial<Asset> = {},
): Asset {
  const created = instantiateAsset(t, id, name, evidence, parentId);
  const a = { ...created.asset, ...extra };
  doc.assets.push(a);
  doc.interfaces.push(...created.interfaces);
  return a;
}

export function smallCpuExample(): Infrastructure {
  const d = empty(
    'small-cpu-plan',
    'Small CPU cluster',
    'A two-server example with nested components and individual network and power connections. Replace its assumptions with your own inventory.',
    'plan',
  );
  const site = addType(d, 'example.site', 'Small compute site', 'site');
  const room = addType(d, 'example.room', 'Equipment room', 'hall');
  const rack = addType(d, 'example.rack', '42U rack', 'rack', [
    fact('rack.units', 'Height', 42, planned, 'U'),
    fact('rack.mount', 'Mounting', '19-inch', planned),
  ]);
  const server = addType(
    d,
    'example.server',
    'Generic CPU server',
    'compute',
    [
      fact('equipment.sku', 'Exact model', null, unknown),
      fact('compute.socketCount', 'CPU sockets', 1, planned),
    ],
    [
      {
        ...port('network-1', 'data', 'bidirectional', 10, 'Gb/s'),
        protocol: 'ethernet',
      },
      port('power-in', 'power', 'in', 500, 'W'),
    ],
  );
  const board = addType(d, 'example.board', 'System board', 'component');
  const cpu = addType(d, 'example.cpu', 'Host processor', 'component', [
    fact('compute.cores', 'Cores', null, unknown),
  ]);
  const memory = addType(d, 'example.memory', 'Memory module', 'component', [
    fact('memory.capacity', 'Capacity', 32, planned, 'GiB'),
  ]);
  const ssd = addType(d, 'example.ssd', 'Boot SSD', 'storage', [
    fact('storage.capacity', 'Capacity', 1, planned, 'TB'),
  ]);
  const controller = addType(
    d,
    'example.ssd-controller',
    'SSD controller',
    'component',
  );
  const flash = addType(d, 'example.nand', 'NAND package', 'component', [
    fact('storage.packageCount', 'Package count', null, unknown),
  ]);
  const sw = addType(
    d,
    'example.switch',
    'Ethernet switch',
    'network',
    [],
    [1, 2].map((i) => ({
      ...port(`port-${i}`, 'data', 'bidirectional', 10, 'Gb/s'),
      protocol: 'ethernet',
    })),
  );
  const pdu = addType(
    d,
    'example.pdu',
    'Power distribution unit',
    'power',
    [],
    [
      port('outlet-1', 'power', 'out', 1, 'kW'),
      port('outlet-2', 'power', 'out', 1, 'kW'),
    ],
  );
  add(d, site, 'site', 'Example site');
  add(d, room, 'room', 'Equipment room', 'site');
  add(d, rack, 'rack', 'Rack 01', 'room', planned, {
    placement: { position: [0, 0, 0] },
  });
  add(d, sw, 'switch', 'Network switch', 'rack', planned, {
    placement: { rack: { u: 40, height: 1, mount: '19-inch' } },
  });
  add(d, pdu, 'pdu', 'Rack PDU', 'rack');
  for (const i of [1, 2]) {
    const id = `server-${i}`;
    add(d, server, id, `CPU server ${i}`, 'rack', planned, {
      placement: { rack: { u: i * 3, height: 2, mount: '19-inch' } },
    });
    add(d, board, `${id}/board`, 'System board', id);
    add(d, cpu, `${id}/cpu`, 'Processor', `${id}/board`);
    add(d, memory, `${id}/memory`, 'Memory', `${id}/board`);
    add(d, ssd, `${id}/ssd`, 'Boot drive', id);
    add(d, controller, `${id}/ssd/controller`, 'Controller', `${id}/ssd`);
    add(
      d,
      flash,
      `${id}/ssd/nand`,
      'Flash package · representative',
      `${id}/ssd`,
      planned,
      { representation: 'representative' },
    );
    d.connections.push({
      id: `network-${i}`,
      name: `Switch to server ${i}`,
      from: `switch/port/port-${i}`,
      to: `${id}/port/network-1`,
      medium: 'data',
      kind: 'physical',
      quantity: 1,
      capacity: { value: 10, unit: 'Gb/s' },
      evidence: planned,
    });
    d.connections.push({
      id: `power-${i}`,
      name: `PDU to server ${i}`,
      from: `pdu/port/outlet-${i}`,
      to: `${id}/port/power-in`,
      medium: 'power',
      kind: 'physical',
      quantity: 1,
      capacity: { value: 500, unit: 'W' },
      evidence: planned,
    });
  }
  d.groups.push({
    id: 'cluster',
    name: 'CPU cluster',
    assetIds: ['server-1', 'server-2', 'switch'],
  });
  return d;
}

export function lumiExample(): Infrastructure {
  const d = empty(
    'lumi-public-record',
    'LUMI · public record',
    'Documented compute partitions and shared services at CSC Kajaani. This record is partial: cabinet positions, individual serial numbers, power distribution and pipe routing are unknown. It does not describe every system at the CSC site.',
    'reference',
  );
  d.sources = [
    {
      id: 'lumi-g',
      title: 'LUMI-G hardware documentation',
      url: 'https://docs.lumi-supercomputer.eu/hardware/lumig/',
      retrievedAt: '2026-09-07',
      license: 'CC BY 4.0 — LUMI documentation',
    },
    {
      id: 'lumi-c',
      title: 'LUMI-C hardware documentation',
      url: 'https://docs.lumi-supercomputer.eu/hardware/lumic/',
      retrievedAt: '2026-09-07',
      license: 'CC BY 4.0 — LUMI documentation',
    },
    {
      id: 'lumi-network',
      title: 'LUMI network and interconnect',
      url: 'https://docs.lumi-supercomputer.eu/hardware/network/',
      retrievedAt: '2026-09-07',
      license: 'CC BY 4.0 — LUMI documentation',
    },
    {
      id: 'lumi-overview',
      title: 'LUMI hardware overview',
      url: 'https://docs.lumi-supercomputer.eu/hardware/',
      retrievedAt: '2026-09-07',
      license: 'CC BY 4.0 — LUMI documentation',
    },
    {
      id: 'lumi-facility',
      title: 'LUMI: location, electricity and heat reuse (19 November 2024)',
      url: 'https://lumi-supercomputer.eu/honors-in-2024-hpcwire-readers-and-editors-choice-awards/',
      retrievedAt: '2026-09-07',
    },
  ];
  const facilityEvidence = reported('lumi-facility', '2024-11-19');
  const site = addType(d, 'lumi.site', 'CSC Kajaani site', 'site', [
    fact('location.city', 'Location', 'Kajaani, Finland', facilityEvidence),
    fact(
      'coverage.scope',
      'Coverage',
      'LUMI only; other CSC installations are outside this record.',
      facilityEvidence,
    ),
  ]);
  const system = addType(
    d,
    'lumi.system',
    'HPE Cray EX system',
    'generic',
    [fact('layout.positions', 'Cabinet positions', null, unknown)],
    [port('electricity', 'power', 'in'), port('heat', 'cooling', 'out')],
  );
  const gpuPartition = addType(
    d,
    'lumi.gpu-nodes',
    'LUMI-G GPU nodes',
    'compute',
    [
      fact(
        'compute.gpusPerNode',
        'MI250X modules per node',
        4,
        reported('lumi-g'),
      ),
      fact(
        'compute.gcdsPerNode',
        'GPU dies visible to software per node',
        8,
        reported('lumi-g'),
      ),
      fact(
        'compute.cpu',
        'CPU per node',
        'AMD EPYC 7A53, 64 cores',
        reported('lumi-g'),
      ),
      fact(
        'memory.host',
        'Host memory per node',
        512,
        reported('lumi-g'),
        'GiB',
      ),
    ],
  );
  const cpuPartition = addType(
    d,
    'lumi.cpu-nodes',
    'LUMI-C CPU nodes',
    'compute',
    [
      fact(
        'compute.cpu',
        'CPUs per node',
        '2 × AMD EPYC 7763',
        reported('lumi-c'),
      ),
      fact('compute.coresPerNode', 'Cores per node', 128, reported('lumi-c')),
      fact(
        'memory.population',
        'Host memory populations',
        '1,888 × 256 GiB; 128 × 512 GiB; 32 × 1,024 GiB',
        reported('lumi-c'),
      ),
    ],
  );
  const exampleNode = addType(
    d,
    'lumi.node',
    'LUMI-G node architecture',
    'compute',
  );
  const board = addType(d, 'lumi.board', 'Compute assembly', 'component', [
    fact('geometry.board', 'Exact board geometry', null, unknown),
  ]);
  const gpu = addType(d, 'amd.mi250x', 'AMD Instinct MI250X', 'component', [
    fact(
      'memory.hbm',
      'HBM per physical module',
      128,
      reported('lumi-g'),
      'GB',
    ),
    fact(
      'compute.dies',
      'Graphics Compute Dies per module',
      2,
      reported('lumi-g'),
    ),
  ]);
  const die = addType(
    d,
    'amd.mi250x-gcd',
    'Graphics Compute Die',
    'component',
    [fact('memory.hbm', 'HBM per die', 64, reported('lumi-g'), 'GB')],
  );
  const storage = addType(
    d,
    'lumi.storage',
    'Shared storage services',
    'storage',
    [
      fact(
        'storage.services',
        'Services',
        'Lustre disk, Lustre flash and object storage',
        {
          basis: 'derived',
          sources: ['lumi-network', 'lumi-overview'],
          asOf: '2026-09-07',
        },
      ),
      fact('storage.inventory', 'Drive and enclosure inventory', null, unknown),
    ],
  );
  const network = addType(d, 'lumi.network', 'HPE Slingshot 11', 'network', [
    fact('network.topology', 'Topology', 'Dragonfly', reported('lumi-network')),
    fact(
      'network.rate',
      'Endpoint line rate',
      200,
      reported('lumi-network'),
      'Gb/s',
    ),
    fact('network.cables', 'Numbered cable schedule', null, unknown),
  ]);
  const power = addType(
    d,
    'lumi.power',
    'Electricity supply',
    'power',
    [
      fact(
        'power.source',
        'Reported energy source',
        'Hydropower',
        facilityEvidence,
      ),
      fact(
        'power.distribution',
        'Feeder and switchgear inventory',
        null,
        unknown,
      ),
    ],
    [port('supply', 'power', 'out')],
  );
  const heat = addType(
    d,
    'lumi.heat',
    'Heat reuse',
    'cooling',
    [
      fact(
        'cooling.destination',
        'Reported heat destination',
        'City of Kajaani',
        facilityEvidence,
      ),
      fact('cooling.routing', 'Cooling loop and pipe routing', null, unknown),
    ],
    [port('recovered-heat', 'cooling', 'in')],
  );
  add(
    d,
    site,
    'csc-kajaani',
    'CSC Kajaani · LUMI coverage',
    undefined,
    facilityEvidence,
  );
  add(
    d,
    system,
    'lumi',
    'LUMI installation',
    'csc-kajaani',
    reported('lumi-overview'),
  );
  add(
    d,
    gpuPartition,
    'lumi-g',
    'LUMI-G · GPU partition',
    'lumi',
    reported('lumi-g'),
    { representation: 'aggregate', quantity: 2978 },
  );
  add(
    d,
    cpuPartition,
    'lumi-c',
    'LUMI-C · CPU partition',
    'lumi',
    reported('lumi-c'),
    { representation: 'aggregate', quantity: 2048 },
  );
  add(
    d,
    exampleNode,
    'lumi-g/example',
    'Representative GPU node',
    'lumi-g',
    {
      basis: 'derived',
      sources: ['lumi-g'],
      asOf: '2026-09-07',
      note: 'Architecture example, not an additional installed node.',
    },
    { representation: 'representative' },
  );
  add(
    d,
    board,
    'lumi-g/example/board',
    'Compute assembly',
    'lumi-g/example',
    {
      basis: 'derived',
      sources: ['lumi-g'],
      asOf: '2026-09-07',
      note: 'Logical assembly boundary; no physical board placement is claimed.',
    },
    { representation: 'representative' },
  );
  for (let i = 0; i < 4; i++) {
    const id = `lumi-g/example/gpu-${i}`;
    add(
      d,
      gpu,
      id,
      `MI250X module ${i + 1}`,
      'lumi-g/example/board',
      reported('lumi-g'),
      { representation: 'representative' },
    );
    for (let j = 0; j < 2; j++)
      add(
        d,
        die,
        `${id}/gcd-${j}`,
        `Graphics Compute Die ${j + 1}`,
        id,
        reported('lumi-g'),
        { representation: 'representative' },
      );
  }
  add(
    d,
    storage,
    'lumi-storage',
    'Shared storage',
    'lumi',
    reported('lumi-overview'),
  );
  add(
    d,
    network,
    'lumi-network',
    'Shared compute and storage fabric',
    'lumi',
    reported('lumi-network'),
  );
  add(
    d,
    power,
    'lumi-power',
    'Electricity supply',
    'csc-kajaani',
    facilityEvidence,
  );
  add(d, heat, 'lumi-heat', 'Heat recovery', 'csc-kajaani', facilityEvidence);
  d.connections.push(
    {
      id: 'lumi-electricity',
      name: 'Reported electricity supply relationship',
      from: 'lumi-power/port/supply',
      to: 'lumi/port/electricity',
      medium: 'power',
      kind: 'logical',
      quantity: 1,
      evidence: facilityEvidence,
    },
    {
      id: 'lumi-heat-reuse',
      name: 'Reported heat reuse relationship',
      from: 'lumi/port/heat',
      to: 'lumi-heat/port/recovered-heat',
      medium: 'cooling',
      kind: 'logical',
      quantity: 1,
      evidence: facilityEvidence,
    },
  );
  d.groups.push({
    id: 'lumi-compute-services',
    name: 'LUMI shared services',
    assetIds: ['lumi-g', 'lumi-c', 'lumi-storage', 'lumi-network'],
  });
  return d;
}

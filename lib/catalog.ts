import type { Hardware, HardwareKind, Spec } from './hardware.ts';
export type Reference = { title: string; url: string };
export type Part = {
  key: string;
  kind: HardwareKind;
  title: string;
  count: number;
  model: string;
  description: string;
  specs: Spec[];
  schematic?: boolean;
};
export type Profile = {
  id: string;
  maker: string;
  name: string;
  family: string;
  category: 'compute' | 'network' | 'storage' | 'rack' | 'infrastructure';
  status: 'Documented' | 'Preliminary';
  units: number;
  depth: number;
  width?: number;
  mount: '19-inch' | 'NVL72' | 'rack';
  cooling: string;
  gpuCount: number;
  gpuMemoryGB: number;
  color: string;
  description: string;
  specs: Spec[];
  parts: Part[];
  sources: Reference[];
  face: string;
  ports?: { rows: number; cols: number };
  hidden?: boolean;
};
const spec = (label: string, value: string, note?: string): Spec => ({
  label,
  value,
  note,
});
const part = (
  key: string,
  kind: HardwareKind,
  title: string,
  count: number,
  model: string,
  description: string,
  specs: Spec[] = [],
  schematic = false,
): Part => ({ key, kind, title, count, model, description, specs, schematic });
const reference = (title: string, url: string): Reference => ({ title, url });
const urls = {
  h100: 'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  b200: 'https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html',
  b300: 'https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html',
  nvl: 'https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html',
  nvlPositions:
    'https://docs.nvidia.com/mission-control/docs/rack-bring-up-install/2.3.0/config-for-provisioning/manual-addition-gb200-rack-entries.html',
  dell: 'https://www.dell.com/support/manuals/en-au/poweredge-xe9780/xe9780_ism_pub/system-overview?guid=guid-fdc34953-0830-47b0-856a-8d2cb0bd51e4&lang=en-us',
  hpe: 'https://www.hpe.com/us/en/collaterals/collateral.a00073553enw.html',
  lenovo: 'https://lenovopress.lenovo.com/lp2264-thinksystem-sr680a-v4-server',
  sm350: 'https://www.supermicro.com/en/products/system/gpu/8u/as-8126gs-tnmr',
  sm355:
    'https://www.supermicro.com/en/products/system/gpu/4u/as-4126gs-nmr-lcc',
  sm300:
    'https://www.supermicro.com/en/products/system/gpu/4u/as-4126gs-nb3rt-lcc',
  amd: 'https://www.amd.com/en/products/specifications/accelerators.html',
  ddn: 'https://www.ddn.com/wp-content/uploads/2024/09/ddn-a3i-data-sheet-2024-rebrand-v4-1.pdf',
};
const boardDescription =
  'Functional board layout. Package placement and trace routing are illustrative; this is not manufacturer CAD.';
const gpuPart = (
  model: string,
  count: number,
  gb: number,
  technology: string,
  bandwidth: string,
  interconnect: string,
) =>
  part(
    'gpu',
    'gpu',
    'Accelerators',
    count,
    model,
    'GPU module with adjacent high-bandwidth memory. The exposed package view is a schematic of the module, not a die floorplan.',
    [
      spec('Memory per GPU', `${gb} GB ${technology}`),
      spec('Memory bandwidth', bandwidth),
      spec('GPU interconnect', interconnect),
      spec('Population', `${count} accelerators / chassis`),
    ],
  );
const cpuPart = (model: string, cores?: string) =>
  part(
    'cpu',
    'cpu',
    'Host processors',
    2,
    model,
    'Host processors connect system memory, PCIe devices, local storage, and the operating system.',
    [
      spec('Sockets', '2'),
      spec('Core count', cores ?? 'Depends on configured processor'),
      spec(
        'Exact SKU',
        model.includes('series') || model.includes('family')
          ? 'Configurable; not selected'
          : model,
      ),
    ],
  );
const memoryPart = (count: number, capacity: string) =>
  part(
    'memory',
    'memory',
    'System memory',
    count,
    'DDR5 RDIMM',
    'CPU-attached system memory, separate from accelerator HBM.',
    [
      spec('DIMM positions', String(count)),
      spec('System memory', capacity),
      spec(
        'Population',
        'Slots shown; module capacity depends on configuration',
      ),
    ],
  );
const drivePart = (
  count: number,
  form: string,
  capacity = 'Configuration dependent',
) =>
  part(
    'nvme',
    'nvme',
    'Data drives',
    count,
    `${form} NVMe SSD`,
    'Removable solid-state storage. Inspect the drive controller, flash packages, and edge connector in the module view.',
    [
      spec('Drive form factor', form),
      spec('Capacity per drive', capacity),
      spec('Drive positions', String(count)),
    ],
  );
const bootPart = (capacity = '1.92 TB') =>
  part(
    'boot',
    'nvme',
    'Boot storage',
    2,
    'M.2 NVMe boot SSD',
    'Boot storage is separate from the high-throughput data drive pool.',
    [
      spec('Capacity per drive', capacity),
      spec('Form factor', 'M.2'),
      spec('Typical role', 'Mirrored boot pair; check OEM configuration'),
    ],
  );
const nicPart = (count: number, model: string, speed: string) =>
  part(
    'nic',
    'nic',
    'Network adapters',
    count,
    model,
    'PCIe network adapter with an RDMA-capable ASIC and an external transceiver connection.',
    [
      spec('Adapter', model),
      spec('Maximum port rate', speed),
      spec('Adapter positions', String(count)),
      spec(
        'Population',
        'Configured adapters or documented slots; see system specification',
      ),
    ],
  );
const psuPart = (count: number, rating: string, redundancy: string) =>
  part(
    'psu',
    'psu',
    'Power supplies',
    count,
    'Hot-swap power supply',
    'AC-to-DC conversion module. Ratings describe the supplies; they are not live draw or a rack power budget.',
    [spec('Module rating', rating), spec('Redundancy', redundancy)],
  );
const fanPart = (count: number) =>
  part(
    'fan',
    'fan',
    'Fan modules',
    count,
    'Hot-swap fan module',
    'Replaceable fan module moves air through the chassis. Blades are static; no live fan speed is simulated.',
    [spec('Module population', String(count))],
  );
const motherboard = part(
  'board',
  'board',
  'Host motherboard',
  1,
  'Host motherboard',
  boardDescription,
  [
    spec('Role', 'CPU, memory and PCIe interconnect'),
    spec('Layout fidelity', 'Functional schematic'),
  ],
);
const baseboard = part(
  'baseboard',
  'board',
  'Accelerator baseboard',
  1,
  'GPU baseboard',
  boardDescription,
  [
    spec('Role', 'GPU power, PCIe and scale-up links'),
    spec('Layout fidelity', 'Functional schematic'),
  ],
);
const backplane = part(
  'backplane',
  'backplane',
  'Drive backplane',
  1,
  'NVMe drive backplane',
  'Routes power and PCIe or dual-port storage links to the removable drive carriers.',
  [spec('Layout fidelity', 'Functional schematic')],
);
const nvs = (count: number, generation: string) =>
  part(
    'nvlink',
    'nvlink',
    'NVLink switches',
    count,
    'NVIDIA NVSwitch',
    'Dedicated scale-up switching silicon joins the GPUs in a shared NVLink domain.',
    [spec('Population', String(count)), spec('Link generation', generation)],
  );
function compute(
  p: Partial<Profile> &
    Pick<
      Profile,
      'id' | 'maker' | 'name' | 'units' | 'description' | 'parts' | 'sources'
    >,
): Profile {
  return {
    family: 'GPU server',
    category: 'compute',
    status: 'Documented',
    depth: 0.9,
    mount: '19-inch',
    cooling: 'Air',
    gpuCount: 8,
    gpuMemoryGB: 288,
    color: '#c3f16b',
    specs: [],
    face: p.id,
    ...p,
  };
}
const h100 = compute({
  id: 'dgx-h100',
  maker: 'NVIDIA',
  name: 'DGX H100',
  family: 'Hopper',
  units: 8,
  depth: 0.8971,
  gpuMemoryGB: 80,
  description:
    'An eight-GPU Hopper system with a shared NVSwitch domain, dual Xeon hosts and eight dedicated compute adapters.',
  specs: [
    spec('GPU memory', '640 GB HBM3'),
    spec('System memory', '2 TB DDR5 · 32 × 64 GB'),
    spec('Dimensions', '356 × 482.3 × 897.1 mm', 'Height × width × depth'),
    spec('Maximum system power', '10.2 kW'),
  ],
  parts: [
    gpuPart(
      'H100 SXM',
      8,
      80,
      'HBM3',
      '3.35 TB/s',
      'NVLink 4 · 900 GB/s bidirectional',
    ),
    cpuPart('Intel Xeon Platinum 8480C', '56 / socket'),
    memoryPart(32, '2 TB installed'),
    nvs(4, 'NVLink 4'),
    nicPart(8, 'ConnectX-7', '400 Gb/s NDR'),
    part(
      'io',
      'nic',
      'Storage / front-end adapters',
      2,
      'Dual-port ConnectX-7',
      'Separate I/O adapters carry storage and front-end traffic.',
      [spec('Ports', '2 per adapter')],
    ),
    drivePart(8, 'U.2', '3.84 TB'),
    bootPart(),
    motherboard,
    baseboard,
    backplane,
    psuPart(6, '3.3 kW', '4 + 2'),
  ],
  sources: [reference('DGX H100 / H200 user guide', urls.h100)],
});
const h200 = compute({
  ...h100,
  id: 'dgx-h200',
  name: 'DGX H200',
  family: 'Hopper · HBM3e',
  gpuMemoryGB: 141,
  description:
    'The H200 version of the DGX platform retains the 8U enclosure and increases the GPU memory tier to 1,128 GB.',
  specs: [spec('GPU memory', '1,128 GB HBM3e'), ...h100.specs.slice(1)],
  parts: h100.parts.map((p) =>
    p.key === 'gpu'
      ? gpuPart(
          'H200 SXM',
          8,
          141,
          'HBM3e',
          '4.8 TB/s',
          'NVLink 4 · 900 GB/s bidirectional',
        )
      : p,
  ),
});
const b200 = compute({
  id: 'dgx-b200',
  maker: 'NVIDIA',
  name: 'DGX B200',
  family: 'Blackwell',
  units: 10,
  depth: 0.8971,
  gpuMemoryGB: 180,
  description:
    'A 10U Blackwell system with eight B200 GPUs, two NVSwitches and dual Xeon hosts. Front fan modules and rear I/O distinguish it from B300.',
  specs: [
    spec('GPU memory', '1,440 GB HBM3e'),
    spec('System memory', '2 TB standard · up to 4 TB'),
    spec('Dimensions', '444 × 482.3 × 897.1 mm'),
    spec('Maximum system power', '14.3 kW'),
  ],
  parts: [
    gpuPart(
      'B200 SXM',
      8,
      180,
      'HBM3e',
      '8 TB/s',
      'NVLink 5 · 1.8 TB/s bidirectional',
    ),
    cpuPart('Intel Xeon Platinum 8570', '56 / socket'),
    memoryPart(32, '2 TB standard · 4 TB maximum'),
    nvs(2, 'NVLink 5'),
    nicPart(8, 'ConnectX-7', '400 Gb/s'),
    part(
      'dpu',
      'nic',
      'I/O DPUs',
      2,
      'BlueField-3 DPU',
      'Dual-port infrastructure adapter for storage and front-end services.',
      [spec('Population', '2 dual-port DPUs')],
    ),
    drivePart(8, 'U.2', '3.84 TB'),
    bootPart(),
    motherboard,
    baseboard,
    backplane,
    fanPart(20),
    psuPart(6, '3.3 kW', '5 + 1'),
  ],
  sources: [reference('DGX B200 user guide', urls.b200)],
});
const b300 = compute({
  id: 'dgx-b300',
  maker: 'NVIDIA',
  name: 'DGX B300',
  family: 'Blackwell Ultra',
  units: 10,
  depth: 0.9042,
  description:
    'Eight Blackwell Ultra GPUs with front-accessible I/O and power supplies. The AC version has twelve supplies and twenty rear fan modules.',
  specs: [
    spec(
      'GPU memory',
      '2,304 GB HBM3e',
      '288 GB per GPU in the current DGX user guide',
    ),
    spec('System memory', '2 TB standard · up to 4 TB'),
    spec('Dimensions', '442 × 482.6 × 904.2 mm', 'AC chassis'),
    spec('Maximum system power', '14.5 kW'),
  ],
  parts: [
    gpuPart(
      'B300 SXM',
      8,
      288,
      'HBM3e',
      '8 TB/s',
      'NVLink 5 · 1.8 TB/s bidirectional',
    ),
    cpuPart('Intel Xeon Platinum 6776P'),
    memoryPart(32, '2 TB standard · 4 TB maximum'),
    nvs(2, 'NVLink 5'),
    nicPart(8, 'ConnectX-8', '800 Gb/s'),
    ...b200.parts.filter((p) =>
      ['dpu', 'boot', 'board', 'baseboard', 'backplane'].includes(p.key),
    ),
    drivePart(8, 'E1.S', '3.84 TB'),
    fanPart(20),
    psuPart(12, '3.2 kW', 'N + N'),
  ],
  sources: [reference('DGX B300 user guide', urls.b300)],
});
const dell = compute({
  id: 'dell-xe9780',
  maker: 'Dell',
  name: 'PowerEdge XE9780',
  family: 'HGX B300',
  units: 10,
  gpuMemoryGB: 270,
  color: '#83b9ed',
  description:
    'Dell’s 10U air-cooled HGX platform combines dual Xeon 6 hosts with eight SXM6 GPUs. This entry follows the B300 variant in Dell’s system manual.',
  specs: [
    spec(
      'Accelerators',
      '8 × B300 · 270 GB each',
      'Dell manual specifies 270 GB for this variant; not DGX’s 288 GB',
    ),
    spec('CPU options', 'Dual Intel Xeon 6 · up to 86 cores / socket'),
    spec(
      'Drive options',
      'Up to 16 E3.S or 10 U.2',
      'E3.S arrangement shown; capacities configurable',
    ),
    spec('Cooling', '5 mid CPU fans + 15 rear GPU fans'),
    spec(
      'Chassis depth',
      'Illustrative 900 mm',
      'Exact depth not modeled from this source',
    ),
  ],
  parts: [
    gpuPart(
      'B300 SXM6 · Dell variant',
      8,
      270,
      'HBM3e',
      'Variant dependent',
      'NVLink 5',
    ),
    cpuPart('Intel Xeon 6 series', 'Up to 86 / socket'),
    memoryPart(32, 'Configuration dependent'),
    nvs(2, 'NVLink 5'),
    nicPart(4, 'PCIe Gen 5 expansion slot', 'Adapter dependent'),
    drivePart(16, 'E3.S'),
    motherboard,
    baseboard,
    backplane,
    fanPart(20),
  ],
  sources: [reference('Dell XE9780 system overview', urls.dell)],
});
const hpe = compute({
  id: 'hpe-xd685',
  maker: 'HPE',
  name: 'ProLiant Compute XD685',
  family: 'Instinct MI355X',
  units: 5,
  depth: 1.049,
  width: 0.448,
  cooling: 'Direct liquid',
  color: '#65d1b8',
  description:
    'A 5U direct-liquid-cooled AMD platform with dual EPYC hosts and eight MI355X modules. The 6U air-cooled variant is a different enclosure.',
  specs: [
    spec('GPU memory', '2,304 GB HBM3e'),
    spec('System memory', '24 DIMM slots · up to 3 TB'),
    spec(
      'Drive positions',
      '8 standard EDSFF · 12 with controller',
      'Eight-drive arrangement shown',
    ),
    spec('Dimensions', '217.7 × 448 × 1,049 mm'),
    spec(
      'PSU configuration',
      '3,000 W CRPS modules',
      'Population depends on GPU and redundancy options',
    ),
  ],
  parts: [
    gpuPart(
      'AMD Instinct MI355X',
      8,
      288,
      'HBM3e',
      '8 TB/s',
      'Infinity Fabric',
    ),
    cpuPart('AMD EPYC 9005 family'),
    memoryPart(24, 'Up to 3 TB'),
    nicPart(8, 'GPU-attached PCIe Gen 5 slot', 'Adapter dependent'),
    drivePart(8, 'EDSFF'),
    bootPart('480 or 960 GB'),
    motherboard,
    baseboard,
    backplane,
    part(
      'bmc',
      'controller',
      'Management controller',
      1,
      'HPE iLO 6',
      'Out-of-band platform management.',
      [spec('Controller', 'iLO 6 ASIC')],
    ),
  ],
  sources: [
    reference('XD685 QuickSpecs · August 2026', urls.hpe),
    reference('AMD accelerator specifications', urls.amd),
  ],
});
const lenovo = compute({
  id: 'lenovo-sr680a-v4',
  maker: 'Lenovo',
  name: 'ThinkSystem SR680a V4',
  family: 'HGX B300',
  units: 8,
  color: '#ef9696',
  description:
    'Lenovo’s air-cooled 8U B300 platform integrates eight ConnectX-8 adapters and dual Xeon 6700-series hosts. Drive trays are front accessible.',
  specs: [
    spec('GPU memory', '2,304 GB HBM3e'),
    spec('Network', '8 × integrated ConnectX-8 · 800 Gb/s'),
    spec('System memory', '32 DIMM slots · up to 4 TB'),
    spec('Chassis', '8U air cooled'),
    spec(
      'Mechanical depth',
      'Illustrative 900 mm',
      'Height follows the product guide',
    ),
  ],
  parts: [
    gpuPart('B300 SXM6', 8, 288, 'HBM3e', '8 TB/s', 'NVLink 5'),
    cpuPart('Intel Xeon 6700P series', 'Up to 86 / socket'),
    memoryPart(32, 'Up to 4 TB'),
    nvs(2, 'NVLink 5'),
    nicPart(8, 'ConnectX-8', '800 Gb/s'),
    drivePart(8, '2.5-inch Gen 5'),
    bootPart('Configuration dependent'),
    motherboard,
    baseboard,
    backplane,
  ],
  sources: [reference('SR680a V4 product guide · August 2026', urls.lenovo)],
});
const sm350 = compute({
  id: 'sm-mi350x',
  maker: 'Supermicro',
  name: 'AS-8126GS-TNMR',
  family: 'Instinct MI350X',
  units: 8,
  depth: 0.843,
  width: 0.447,
  color: '#e8a374',
  description:
    'An air-cooled 8U system with eight MI350X OAM modules and the dual-socket H14DSG-OD motherboard. MI325X is a separate supported accelerator option.',
  specs: [
    spec('Motherboard', 'H14DSG-OD'),
    spec('GPU memory', '2,304 GB HBM3e'),
    spec('Dimensions', '356 × 447 × 843 mm'),
    spec('System memory', '24 DIMM slots · up to 6 TB'),
    spec('Drive bays', '8 NVMe + 2 SATA'),
  ],
  parts: [
    gpuPart(
      'AMD Instinct MI350X OAM',
      8,
      288,
      'HBM3e',
      '8 TB/s',
      'Infinity Fabric',
    ),
    cpuPart('AMD EPYC 9004 / 9005 family'),
    memoryPart(24, 'Up to 6 TB'),
    nicPart(8, 'Low-profile PCIe Gen 5 slot', 'Adapter dependent'),
    drivePart(8, '2.5-inch'),
    part(
      'sata',
      'nvme',
      'SATA bays',
      2,
      '2.5-inch SATA drive bay',
      'Additional SATA drive positions.',
      [spec('Interface', 'SATA · not NVMe')],
    ),
    { ...motherboard, model: 'Supermicro H14DSG-OD' },
    baseboard,
    backplane,
    fanPart(10),
    psuPart(6, '5,250 W', '3 + 3'),
  ],
  sources: [
    reference('AS-8126GS-TNMR specification', urls.sm350),
    reference('AMD accelerator specifications', urls.amd),
  ],
});
const sm355 = compute({
  ...sm350,
  id: 'sm-mi355x',
  name: 'AS-4126GS-NMR-LCC',
  family: 'Instinct MI355X',
  units: 4,
  depth: 0.9,
  cooling: 'Direct liquid',
  description:
    'A 4U direct-liquid-cooled MI355X system using the H14DSG-OD host board. Eight OAM accelerators carry 2,304 GB of HBM3e.',
  specs: [
    spec('Motherboard', 'H14DSG-OD'),
    spec('GPU memory', '2,304 GB HBM3e'),
    spec('System memory', '24 DIMM slots · up to 6 TB'),
    spec('Chassis', '4U · depth shown illustratively'),
  ],
  parts: [
    gpuPart(
      'AMD Instinct MI355X OAM',
      8,
      288,
      'HBM3e',
      '8 TB/s',
      'Infinity Fabric',
    ),
    ...sm350.parts.filter(
      (p) => !['gpu', 'fan', 'psu', 'sata'].includes(p.key),
    ),
    psuPart(4, '6,600 W', '2 + 2'),
  ],
  sources: [
    reference('AS-4126GS-NMR-LCC specification', urls.sm355),
    reference('AMD accelerator specifications', urls.amd),
  ],
});
const sm300 = compute({
  ...sm355,
  id: 'sm-b300',
  name: 'AS-4126GS-NB3RT-LCC',
  family: 'HGX B300',
  description:
    'A compact 4U liquid-cooled HGX B300 configuration with dual AMD hosts, eight E1.S data drives and four power supplies.',
  specs: [
    spec('GPU memory', '2,304 GB HBM3e'),
    spec('Motherboard', 'H14DSG-OM'),
    spec('System memory', '24 DIMM slots · up to 6 TB'),
    spec('Chassis', '4U · depth shown illustratively'),
  ],
  parts: [
    b300.parts[0],
    ...sm355.parts.filter(
      (p) => !['gpu', 'nvme', 'board', 'backplane'].includes(p.key),
    ),
    nvs(2, 'NVLink 5'),
    drivePart(8, 'E1.S'),
    { ...motherboard, model: 'Supermicro H14DSG-OM' },
    backplane,
    bootPart('Configuration dependent'),
  ],
  sources: [reference('AS-4126GS-NB3RT-LCC specification', urls.sm300)],
});
function network(
  id: string,
  name: string,
  units: number,
  rows: number,
  cols: number,
  rate: string,
  logical: number,
  asic: string,
  url: string,
): Profile {
  return {
    id,
    maker: 'NVIDIA',
    name,
    family: asic,
    category: 'network',
    status: 'Documented',
    units,
    depth: 0.566,
    mount: '19-inch',
    cooling: 'Air',
    gpuCount: 0,
    gpuMemoryGB: 0,
    color: '#8cafff',
    face: 'network',
    ports: { rows, cols },
    description: `A ${units}U ${asic} switch. Connector cages and logical ports are listed separately; breakout modes depend on the adapter and cable.`,
    specs: [
      spec('Physical connector cages', String(rows * cols)),
      spec('Logical high-speed ports', `${logical} × ${rate}`),
      spec('Rack space', `${units}U`),
    ],
    parts: [
      part(
        'asic',
        'asic',
        'Switch ASIC',
        1,
        asic,
        'Packet switching silicon connects the external high-speed ports.',
        [spec('High-speed port capacity', `${logical} × ${rate}`)],
      ),
      part(
        'port',
        'port',
        'Transceiver cages',
        rows * cols,
        name === 'SN4600C' ? 'QSFP28 cage' : 'OSFP cage',
        'A physical transceiver cage. One cage may expose multiple logical links depending on the switch.',
        [
          spec('Logical ports per cage', String(logical / (rows * cols))),
          spec('Nominal rate per logical port', rate),
        ],
      ),
      part(
        'controller',
        'controller',
        'Management board',
        1,
        'Management subsystem',
        'Control-plane processor and management interfaces. Exact CPU package and board traces are not published here.',
        [spec('Board geometry', 'Functional schematic')],
        true,
      ),
      motherboard,
      psuPart(2, 'See hardware manual', 'Redundant'),
    ],
    sources: [reference(`${name} hardware manual`, url)],
  };
}
const qm = network(
  'qm9700',
  'Quantum-2 QM9700',
  1,
  2,
  16,
  '400 Gb/s NDR',
  64,
  'Quantum-2',
  'https://networking-docs.nvidia.com/qm97x0hw/introduction',
);
qm.parts.push(fanPart(7));
const sn = network(
  'sn4600c',
  'SN4600C',
  2,
  4,
  16,
  '100 GbE',
  64,
  'Spectrum-3',
  'https://docs.nvidia.com/networking/display/nvidia-spectrum-3-sn4000-1u-and-2u-switch-systems-hardware-user-manual.pdf',
);
const sn5 = network(
  'sn5600',
  'SN5600',
  2,
  4,
  16,
  '800 GbE',
  64,
  'Spectrum-4',
  'https://docs.nvidia.com/nvidia-spectrum-4-sn5000-2u-switch-systems-hardware-user-manual.pdf',
);
sn5.parts.push(fanPart(4));
const q34 = network(
  'q3400',
  'Quantum-X800 Q3400-RA',
  4,
  4,
  18,
  '800 Gb/s XDR',
  144,
  'Quantum-X800',
  'https://docs.nvidia.com/nvidia-q32xx-and-q34xx-xdr-800gb-s-infiniband-switch-systems-user-manual.pdf',
);
q34.parts = q34.parts.map((p) =>
  p.key === 'psu'
    ? psuPart(8, 'See hardware manual', 'Configuration dependent')
    : p,
);
const ddn: Profile = {
  id: 'ai400x2',
  maker: 'DDN',
  name: 'AI400X2',
  family: 'Parallel flash storage',
  category: 'storage',
  status: 'Documented',
  units: 2,
  depth: 0.85,
  mount: '19-inch',
  cooling: 'Air',
  gpuCount: 0,
  gpuMemoryGB: 0,
  color: '#de9be9',
  face: 'storage',
  description:
    'A 2U all-flash storage appliance with eight 200 Gb/s host links. The reference cluster uses the 250 TB usable capacity option. Internal blocks are representative where DDN does not publish the board layout.',
  specs: [
    spec('Capacity in reference cluster', '250 TB usable'),
    spec('Capacity options', '30 / 60 / 120 / 250 / 500 TB usable'),
    spec('Host ports', '8 × 200 Gb/s HDR or Ethernet'),
    spec(
      'Sequential read / write',
      'Up to 90 / 65 GB/s',
      'Manufacturer maxima; not a workload guarantee',
    ),
    spec('Dimensions', '89 × 482.6 × 850 mm', 'Depth excludes bezel'),
  ],
  parts: [
    part(
      'nvme',
      'nvme',
      'NVMe media · representative',
      4,
      'Dual-port 2.5-inch NVMe',
      'Four representative modules explain the flash tier. DDN’s public data sheet does not identify the exact installed drive count or SSD SKU for the selected capacity.',
      [
        spec('Media', 'Dual-port NVMe'),
        spec(
          'Exact population / drive capacity',
          'Not specified in referenced data sheet',
        ),
      ],
      true,
    ),
    part(
      'controller',
      'controller',
      'Storage controller subsystem',
      1,
      'Storage controllers · functional block',
      'Represents the redundant storage-control function. ASIC identity, board population and exact geometry are not published in the cited data sheet.',
      [
        spec('Role', 'Storage services, redundancy and host I/O'),
        spec('Controller board count / CPU SKU', 'Not specified'),
      ],
      true,
    ),
    backplane,
    part(
      'port',
      'port',
      'Host port cages',
      8,
      '200 Gb/s host port',
      'Shared-storage network connection. The reference uses HDR InfiniBand.',
      [spec('Port rate', '200 Gb/s'), spec('Population', '8')],
    ),
    psuPart(2, 'See appliance configuration', 'Redundant hot-swap'),
  ],
  sources: [reference('DDN A³I data sheet', urls.ddn)],
};
function nvlTray(gen: 'gb200' | 'gb300'): Profile {
  const ultra = gen === 'gb300';
  return compute({
    id: `${gen}-tray`,
    maker: 'NVIDIA',
    name: `${gen.toUpperCase()} compute tray`,
    family: ultra ? 'Blackwell Ultra + Grace' : 'Blackwell + Grace',
    units: 1,
    depth: 0.9,
    mount: 'NVL72',
    gpuCount: 4,
    gpuMemoryGB: ultra ? 288 : 186,
    cooling: 'Direct liquid',
    hidden: true,
    face: 'tray',
    description:
      'One compute tray holds two Grace Blackwell Superchips: four GPUs and two Grace CPUs. Scale-up connections run through the rack’s passive copper cartridge.',
    specs: [
      spec('Accelerators', '4 per tray'),
      spec('Host processors', '2 × 72-core Grace'),
      spec('GPU memory', ultra ? '1,152 GB HBM3e' : '744 GB HBM3e'),
      spec(
        'Scale-out adapters',
        ultra ? '4 × ConnectX-8 · 800 Gb/s' : '4 × ConnectX-7 · 400 Gb/s',
      ),
      spec('I/O DPUs', ultra ? '1 × dual-port BlueField-3' : '2 × BlueField-3'),
    ],
    parts: [
      gpuPart(
        ultra ? 'GB300 Blackwell Ultra GPU' : 'GB200 Blackwell GPU',
        4,
        ultra ? 288 : 186,
        'HBM3e',
        '8 TB/s',
        'NVLink 5 · 1.8 TB/s bidirectional',
      ),
      cpuPart('NVIDIA Grace', '72 Arm cores / socket'),
      part(
        'memory',
        'memory',
        'CPU memory banks',
        2,
        'LPDDR5X',
        'Soldered memory attached to Grace, not socketed server DIMMs.',
        [
          spec('Technology', 'LPDDR5X ECC'),
          spec('Placement', 'Illustrative bank grouping'),
        ],
        true,
      ),
      nicPart(
        4,
        ultra ? 'ConnectX-8' : 'ConnectX-7',
        ultra ? '800 Gb/s' : '400 Gb/s',
      ),
      part(
        'dpu',
        'nic',
        'I/O DPUs',
        ultra ? 1 : 2,
        'BlueField-3',
        'Infrastructure processing for storage and front-end traffic.',
        [spec('Model', 'BlueField-3')],
      ),
      drivePart(4, 'E1.S', '3.84 TB'),
      { ...bootPart(), count: 1 },
      baseboard,
    ],
    sources: [
      reference('DGX NVL72 hardware guide', urls.nvl),
      reference('NVL72 tray population and rack locations', urls.nvlPositions),
      reference(
        'GB200 platform capacities',
        'https://www.nvidia.com/en-us/data-center/gb200-nvl72/',
      ),
    ],
  });
}
const nvlSwitch: Profile = {
  ...network(
    'nvl-switch',
    'NVLink switch tray',
    1,
    2,
    9,
    'NVLink 5',
    18,
    'NVSwitch',
    urls.nvl,
  ),
  mount: 'NVL72',
  hidden: true,
  face: 'nvl-switch',
  parts: [nvs(2, 'NVLink 5'), motherboard],
  description:
    'One of nine switch trays. Each contains two NVSwitch ASICs. Rack NVLink connections use the rear passive copper cartridge; the front face is a service panel.',
  specs: [
    spec('ASICs per tray', '2 × NVSwitch'),
    spec('Ports per ASIC', '72 NVLink ports'),
    spec('Population', '9 trays / NVL72 rack'),
  ],
};
const power: Profile = {
  ...nvlSwitch,
  id: 'nvl-power',
  name: 'NVL72 power shelf',
  category: 'infrastructure',
  face: 'power',
  parts: [psuPart(6, '5.5 kW', 'Rack-level redundancy')],
  description:
    'A rack power shelf contains six supply modules feeding the DC busbar. Rack electrical and thermal engineering remains a v2 feature.',
  specs: [
    spec('Supplies per shelf', '6 × 5.5 kW'),
    spec('Shelves per rack', '8'),
  ],
  ports: undefined,
};
const tor: Profile = {
  ...network(
    'sn2201',
    'SN2201 management switch',
    1,
    2,
    24,
    '1 GbE',
    48,
    'Spectrum',
    urls.nvl,
  ),
  hidden: true,
  parts: [
    part(
      'port',
      'port',
      'Management ports',
      48,
      'RJ45 management port',
      'Out-of-band Ethernet management connection.',
      [spec('Rate', '1 GbE')],
    ),
    motherboard,
  ],
  description:
    'Top-of-rack out-of-band management switch, distinct from the high-speed scale-out fabric.',
};
const nvlProfiles: Profile[] = (['gb200', 'gb300'] as const).map((gen) => ({
  ...nvlTray(gen),
  id: `${gen}-nvl72`,
  name: `${gen.toUpperCase()} NVL72`,
  hidden: false,
  category: 'rack',
  units: 48,
  mount: 'rack',
  gpuCount: 72,
  description:
    'An integrated 48U liquid-cooled rack with 18 compute trays, 9 NVLink switch trays, 8 power shelves, and 2 management switches. U positions follow NVIDIA’s provisioning guide.',
  parts: [],
  specs: [
    spec('Accelerators', '72'),
    spec('Grace CPUs', '36 · 2,592 total Arm cores'),
    spec(
      'GPU memory',
      gen === 'gb300' ? '20.736 TB HBM3e' : '13.392 TB HBM3e',
      'Sum of documented per-GPU capacities; marketing uses rounded rack totals',
    ),
    spec('Scale-up fabric', '18 NVSwitch ASICs across 9 trays'),
    spec('Rack population', '18 compute · 9 switch · 8 power · 2 management'),
  ],
}));
const future: Profile[] = [
  {
    ...nvlProfiles[1],
    id: 'vera-rubin-nvl72',
    name: 'Vera Rubin NVL72',
    family: 'Rubin + Vera',
    status: 'Preliminary',
    description:
      'NVIDIA’s next rack-scale platform: 72 Rubin GPUs and 36 Vera CPUs. Public specifications are preliminary. A verified service layout is not available in this catalog, so this entry cannot populate a rack.',
    specs: [
      spec('GPU memory', '288 GB HBM4 per GPU · 20.7 TB per rack'),
      spec('NVLink generation', '6 · up to 3.6 TB/s per GPU'),
      spec('Vera CPU', '88 cores per CPU · 36 CPUs'),
      spec('Status', 'Preliminary specifications · subject to change'),
    ],
    sources: [
      reference(
        'NVIDIA Vera Rubin NVL72',
        'https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/',
      ),
    ],
  },
  {
    ...nvlProfiles[1],
    id: 'amd-helios',
    maker: 'AMD',
    name: 'Helios',
    family: 'Instinct MI455X',
    status: 'Preliminary',
    gpuMemoryGB: 432,
    color: '#e8a374',
    description:
      'AMD’s rack-scale design brings 72 MI455X accelerators together with EPYC Venice and Pensando networking. This is a roadmap reference; detailed service geometry is not modeled.',
    specs: [
      spec('Accelerators', '72 × MI455X'),
      spec('GPU memory', '432 GB HBM4 per GPU · about 31 TB per rack'),
      spec('Scale-up fabric', 'UALink over Ethernet'),
      spec('Mechanical format', 'Open Rack Wide · double-width design'),
      spec('Status', 'Roadmap / preliminary; availability not asserted'),
    ],
    sources: [
      reference(
        'AMD Helios platform',
        'https://www.amd.com/en/products/rackscale-solutions/helios.html',
      ),
    ],
  },
];
export const CATALOG: Profile[] = [
  ...nvlProfiles,
  b300,
  b200,
  h200,
  h100,
  dell,
  hpe,
  lenovo,
  sm350,
  sm355,
  sm300,
  sn5,
  q34,
  qm,
  sn,
  ddn,
  ...future,
  nvlTray('gb200'),
  nvlTray('gb300'),
  nvlSwitch,
  power,
  tor,
];
export const VISIBLE_CATALOG = CATALOG.filter((p) => !p.hidden);
export function profileFor(h: Hardware): Profile {
  const id =
    h.profile ??
    (
      {
        dgx: 'dgx-h100',
        qm9700: 'qm9700',
        sn4600c: 'sn4600c',
        ai400x2: 'ai400x2',
      } as Record<string, string>
    )[h.kind];
  return CATALOG.find((p) => p.id === id) ?? h100;
}
export function partFor(h: Hardware): Part | undefined {
  return h.part ? profileFor(h).parts.find((p) => p.key === h.part) : undefined;
}
export const CATALOG_DATE = '6 September 2026';

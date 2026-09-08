import type { Profile, Part } from './catalog.ts';

const source = {
  title: 'Supplied Washington cluster configuration · 8 September 2026',
  url: 'https://github.com/willnaheehs/rack-explore/blob/main/docs/washington-b300.md',
};
const block = (
  key: string,
  kind: Part['kind'],
  title: string,
  description: string,
): Part => ({
  key,
  kind,
  title,
  count: 1,
  model: title,
  description,
  population: 'representative',
  schematic: true,
  specs: [
    {
      label: 'Board details',
      value:
        'Functional block; board SKU, count and physical layout not supplied',
    },
  ],
});

export const WASHINGTON_B300: Profile = {
  id: 'washington-b300',
  maker: 'Unspecified OEM',
  name: 'Washington B300 cluster',
  family: '32 nodes · AMD EPYC 9555 · 150 TB WEKA',
  category: 'compute',
  status: 'Supplied',
  units: 8,
  depth: 0.9,
  mount: '19-inch',
  cooling: 'Not supplied',
  gpuCount: 8,
  gpuMemoryGB: 288,
  color: '#80d4c9',
  face: 'washington-b300',
  clusterNodes: 32,
  recordedAt: '2026-09-08',
  description:
    '32 servers in Washington, US: 256 B300 GPUs, 4,096 CPU cores and 150 TB of shared WEKA storage. Each node has 8 B300 GPUs, two AMD EPYC 9555 CPUs and 30.72 TB of raw local NVMe. Eight display racks with four 8U envelopes each illustrate the cluster; actual chassis dimensions, rack count and placement are not supplied.',
  specs: [
    {
      label: 'Configuration basis',
      value: 'User-supplied profile + cluster count; recorded 8 September 2026',
    },
    {
      label: 'Cluster population',
      value: '32 nodes · 256 B300 GPUs · 64 CPUs · 4,096 CPU cores',
    },
    {
      label: 'Location',
      value: 'Washington, US',
      note: 'Facility, operator and exact location not supplied.',
    },
    {
      label: 'Per-node accelerators',
      value: '8 × NVIDIA B300',
      note: '288 GB HBM3e per GPU is a platform reference specification; installed variant needs confirmation.',
    },
    { label: 'Per-node CPU', value: '2 × AMD EPYC 9555 · 128 cores total' },
    {
      label: 'System memory as supplied',
      value: '2.3 TB per node',
      note: 'Host DDR5 capacity and DIMM population need confirmation: 2.3 TB also matches nominal aggregate B300 GPU memory. These are separate memory pools.',
    },
    {
      label: 'Boot storage',
      value: '2 × 1.92 TB · RAID-1',
      note: '3.84 TB raw; 1.92 TB usable per node before overhead. Drive interface and form factor not supplied.',
    },
    {
      label: 'Local data storage',
      value: '8 × 3.84 TB NVMe / node · 30.72 TB raw',
      note: '983.04 TB raw across 32 nodes. Data protection and usable capacity not supplied; do not add this to WEKA capacity.',
    },
    {
      label: 'Shared storage',
      value: '150 TB WEKA · cluster total',
      note: 'Raw versus usable capacity, dedicated versus converged deployment, backend servers and storage fabric not supplied. Inspect the service in Storage fabric.',
    },
    {
      label: 'Interconnect',
      value: '6.4 Tb/s RoCE v2 per node',
      note: 'Aggregate endpoint rate; NIC count, port rates and switch topology not supplied. This is not measured throughput or bisection bandwidth.',
    },
    {
      label: 'Physical layout',
      value: 'Illustrative · 8 display racks × 4 nodes',
      note: '8U / 0.9 m server envelopes and 42U racks are visualization assumptions, not validated installed dimensions.',
    },
    {
      label: 'Power and cooling',
      value: 'Not supplied',
      note: 'PSU and fan populations, electrical limits and cooling design are unknown. Power view uses an editable 15 kW per-node planning allowance.',
    },
  ],
  parts: [
    {
      key: 'gpu',
      kind: 'gpu',
      title: 'Accelerators',
      count: 8,
      model: 'NVIDIA B300',
      population: 'fixed',
      description:
        'One of eight supplied B300 GPUs per node. Package geometry is schematic; HBM values are platform reference specifications.',
      specs: [
        { label: 'Memory per GPU', value: '288 GB HBM3e (platform reference)' },
        {
          label: 'GPU interconnect',
          value: 'NVLink (B300 platform reference; baseboard SKU unconfirmed)',
        },
      ],
    },
    {
      key: 'cpu',
      kind: 'cpu',
      title: 'Host processors',
      count: 2,
      model: 'AMD EPYC 9555',
      population: 'fixed',
      description:
        'One of two specified AMD host processors; 64 physical cores each, 128 per node.',
      specs: [
        { label: 'Physical cores per CPU', value: '64' },
        { label: 'CPU cores per node', value: '128' },
        { label: 'CPU sockets', value: '2' },
      ],
    },
    {
      ...block(
        'memory',
        'memory',
        'System memory',
        'A single block represents the supplied 2.3 TB memory figure, not one DIMM. Confirm host DDR5 capacity separately from GPU HBM.',
      ),
      specs: [
        {
          label: 'Supplied capacity',
          value: '2.3 TB per node; memory pool needs confirmation',
        },
        {
          label: 'DIMM population',
          value: 'Not supplied; one aggregate block shown',
        },
      ],
    },
    {
      key: 'boot',
      kind: 'nvme',
      title: 'Boot drives',
      count: 2,
      model: '1.92 TB boot drive',
      population: 'fixed',
      description:
        'One drive in the mirrored boot pair. The module illustration does not establish M.2, SATA or NVMe interface or form factor.',
      specs: [
        { label: 'Capacity per drive', value: '1.92 TB' },
        { label: 'Protection', value: 'RAID-1 mirror' },
        {
          label: 'Pair capacity',
          value: '3.84 TB raw · 1.92 TB usable before overhead',
        },
        { label: 'Interface / form factor', value: 'Not supplied' },
      ],
    },
    {
      key: 'nvme',
      kind: 'nvme',
      title: 'Local data drives',
      count: 8,
      model: '3.84 TB NVMe SSD',
      population: 'fixed',
      description:
        'One of eight local data SSDs. Controller and flash geometry is explanatory; manufacturer, form factor, flash type and drive protection are unspecified.',
      specs: [
        { label: 'Capacity per drive', value: '3.84 TB' },
        { label: 'Node raw capacity', value: '30.72 TB' },
        { label: 'Data protection / usable capacity', value: 'Not supplied' },
        {
          label: 'Relationship to WEKA',
          value:
            'Unknown; local drives may or may not back the shared storage service',
        },
      ],
    },
    {
      ...block(
        'nic',
        'nic',
        'RoCE v2 interfaces',
        'One aggregate network block represents the reported interconnect. It does not assert one NIC, eight NICs or a particular ConnectX SKU.',
      ),
      specs: [
        { label: 'Node aggregate rate', value: '6.4 Tb/s RoCE v2' },
        { label: 'NIC / port population', value: 'Not supplied' },
        { label: 'Switches / optics / cabling', value: 'Not supplied' },
      ],
    },
    block(
      'motherboard',
      'board',
      'Host motherboard',
      'Functional CPU, memory and I/O board. Manufacturer, board revision and placement need the actual chassis specification.',
    ),
    block(
      'baseboard',
      'board',
      'GPU baseboard',
      'Functional placement of the eight GPUs. Baseboard SKU and installed NVSwitch population are not supplied.',
    ),
    block(
      'backplane',
      'backplane',
      'Storage connectivity',
      'Functional route from the local SSDs to host I/O. Backplane, cabling and controller topology are not supplied.',
    ),
  ],
  sources: [
    source,
    {
      title: 'AMD EPYC 9555 · 64 cores per processor',
      url: 'https://www.amd.com/en/products/processors/server/epyc/9005-series/amd-epyc-9555.html',
    },
    {
      title:
        'NVIDIA HGX B300 · component reference, not this cluster’s bill of materials',
      url: 'https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory/latest/components.html',
    },
    {
      title: 'WEKA · dedicated and converged deployment architecture',
      url: 'https://www.weka.io/resources/white-paper/wekaio-architectural-whitepaper',
    },
  ],
};

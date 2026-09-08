import type { Profile } from './catalog.ts';

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
  cooling: 'Air',
  gpuCount: 8,
  gpuMemoryGB: 288,
  color: '#80d4c9',
  face: 'washington-b300',
  clusterNodes: 32,
  recordedAt: '2026-09-08',
  description:
    '32 servers in Washington, US: 256 B300 SXM GPUs, 4,096 CPU cores and 150 TB of shared WEKA storage. Each air-cooled 8U node has 2.304 TB DDR5 system RAM, 2.304 TB GPU HBM and 30.72 TB raw local NVMe. Eight display racks illustrate the cluster; actual rack count, placement and chassis depth remain unknown.',
  specs: [
    {
      label: 'Configuration basis',
      value: 'Expanded user-supplied HGX specification · 8 September 2026',
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
      value: '8 × NVIDIA B300 SXM (Blackwell Ultra)',
      note: '288 GB HBM3e per GPU · 2.304 TB GPU memory per node.',
    },
    {
      label: 'Per-node CPU',
      value: '2 × AMD EPYC 9555 · 128 cores total',
    },
    {
      label: 'NVLink',
      value: '5th generation · 1.8 TB/s per GPU (bidirectional)',
      note: 'Internal GPU communication. This is separate from the 6.4 Tb/s external RoCE network.',
    },
    {
      label: 'System RAM',
      value: '24 × 96 GB DDR5-6400 ECC RDIMM · 2.304 TB',
      note: 'Host RAM is separate from the 2.304 TB of GPU HBM. Module placement is schematic.',
    },
    {
      label: 'Boot storage',
      value: '2 × 1.92 TB · RAID-1',
      note: 'Earlier profile specifies this pair: 3.84 TB raw / 1.92 TB usable before overhead. The expanded sheet says “3.84 TB boot RAID-1” without a capacity basis; confirm if the intended usable capacity changed.',
    },
    {
      label: 'Local data storage',
      value: '8 × 3.84 TB U.2 NVMe Gen5 / node · 30.72 TB raw',
      note: '983.04 TB raw across 32 nodes. Data protection and usable capacity remain unspecified.',
    },
    {
      label: 'Shared storage',
      value: '150 TB WEKA · cluster total',
      note: 'Backend hardware, raw versus usable capacity and connection to the storage switches remain unspecified. Inspect the Storage network view.',
    },
    {
      label: 'Storage network adapters',
      value: '2 × ConnectX-7 · single-port 400 GbE / node',
      note: '800 Gb/s summed endpoint capacity per node; storage service throughput and transport configuration are unconfirmed.',
    },
    {
      label: 'Interconnect',
      value: '8 × ConnectX-8 · 800 GbE RoCE v2 / adapter',
      note: '6.4 Tb/s aggregate per node. Configured port/breakout mode, switch inventory and cabling are still needed.',
    },
    {
      label: 'Physical layout',
      value: '8U air-cooled chassis · rack placement illustrative',
      note: 'Eight display racks × four nodes. Chassis depth (drawn as 0.9 m), OEM SKU, rack count and U positions remain unconfirmed.',
    },
    {
      label: 'Power and cooling',
      value: 'Air-cooled · electrical specification not supplied',
      note: 'PSU and fan counts, power limits and airflow ratings remain unknown. Power view uses an editable 15 kW/node allowance.',
    },
  ],
  parts: [
    {
      key: 'gpu',
      kind: 'gpu',
      title: 'Accelerators',
      count: 8,
      model: 'NVIDIA B300 SXM',
      population: 'fixed',
      description:
        'One of eight supplied Blackwell Ultra SXM GPU modules per node. The 288 GB HBM3e capacity is supplied; package placement remains schematic.',
      specs: [
        {
          label: 'Memory per GPU',
          value: '288 GB HBM3e',
        },
        {
          label: 'GPU memory per node',
          value: '2.304 TB HBM3e',
        },
        {
          label: 'GPU interconnect',
          value: '5th-generation NVLink · 1.8 TB/s per GPU (bidirectional)',
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
        {
          label: 'Physical cores per CPU',
          value: '64',
        },
        {
          label: 'CPU cores per node',
          value: '128',
        },
        {
          label: 'CPU sockets',
          value: '2',
        },
      ],
    },
    {
      key: 'memory',
      kind: 'memory',
      title: 'System memory',
      count: 24,
      model: '96 GB DDR5-6400 ECC RDIMM',
      description:
        'One of 24 supplied host memory modules. Total host RAM is 2.304 TB, separate from GPU HBM; exact slots and channel population require the OEM board map.',
      population: 'fixed',
      schematic: false,
      specs: [
        {
          label: 'Capacity per module',
          value: '96 GB',
        },
        {
          label: 'Technology',
          value: 'DDR5-6400 ECC RDIMM',
        },
        {
          label: 'DIMMs per node',
          value: '24',
        },
        {
          label: 'Host RAM per node',
          value: '2.304 TB',
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
        {
          label: 'Capacity per drive',
          value: '1.92 TB',
        },
        {
          label: 'Protection',
          value: 'RAID-1 mirror',
        },
        {
          label: 'Pair capacity',
          value: '3.84 TB raw · 1.92 TB usable before overhead',
        },
        {
          label: 'Interface / form factor',
          value: 'Not supplied',
        },
      ],
    },
    {
      key: 'nvme',
      kind: 'nvme',
      title: 'Local data drives',
      count: 8,
      model: '3.84 TB U.2 NVMe Gen5 SSD',
      population: 'fixed',
      description:
        'One of eight supplied U.2 PCIe Gen5 NVMe SSDs. Controller and flash geometry is illustrative; manufacturer and protection policy remain unspecified.',
      specs: [
        {
          label: 'Capacity per drive',
          value: '3.84 TB',
        },
        {
          label: 'Node raw capacity',
          value: '30.72 TB',
        },
        {
          label: 'Data protection / usable capacity',
          value: 'Not supplied',
        },
        {
          label: 'Relationship to WEKA',
          value:
            'Unknown; local drives may or may not back the shared storage service',
        },
        {
          label: 'Interface / form factor',
          value: 'PCIe Gen5 NVMe · U.2',
        },
      ],
    },
    {
      key: 'nic',
      kind: 'nic',
      title: 'RoCE compute adapters',
      count: 8,
      model: 'NVIDIA ConnectX-8 SuperNIC',
      description:
        'One of eight supplied ConnectX-8 adapters for the compute network. Each provides 800 Gb/s aggregate RoCE v2 capability. Port/breakout mode and GPU affinity need the installed configuration.',
      population: 'fixed',
      schematic: false,
      specs: [
        {
          label: 'Adapter aggregate rate',
          value: '800 Gb/s Ethernet · RoCE v2',
        },
        {
          label: 'Compute adapters per node',
          value: '8',
        },
        {
          label: 'Node aggregate rate',
          value: '6.4 Tb/s',
        },
        {
          label: 'Physical ports / breakout',
          value:
            'Configured mode not supplied; adapter bandwidth does not identify cage count',
        },
        {
          label: 'GPU affinity / switch port',
          value: 'Installed mapping not supplied',
        },
      ],
    },
    {
      key: 'io',
      kind: 'nic',
      title: 'Storage network adapters',
      count: 2,
      model: 'NVIDIA ConnectX-7',
      population: 'fixed',
      description:
        'One of two supplied single-port 400 GbE storage adapters. This is a separate endpoint pool from the eight RoCE compute adapters. Backend switches and storage transport remain unconfirmed.',
      specs: [
        {
          label: 'Port configuration',
          value: 'Single-port 400 GbE',
        },
        {
          label: 'Storage adapters per node',
          value: '2',
        },
        {
          label: 'Node summed endpoint rate',
          value: '800 Gb/s',
        },
        {
          label: 'Storage protocol / switch port',
          value:
            'Not supplied; Ethernet alone does not establish RoCE or the WEKA transport',
        },
      ],
    },
    {
      key: 'motherboard',
      kind: 'board',
      title: 'Host motherboard',
      count: 1,
      model: 'Host motherboard',
      description:
        'Functional CPU, memory and I/O board. Manufacturer, board revision and placement need the actual chassis specification.',
      population: 'representative',
      schematic: true,
      specs: [
        {
          label: 'Board details',
          value:
            'Functional block; board SKU, count and physical layout not supplied',
        },
      ],
    },
    {
      key: 'baseboard',
      kind: 'board',
      title: 'GPU baseboard',
      count: 1,
      model: 'GPU baseboard',
      description:
        'HGX B300 GPU assembly with eight SXM GPUs and fifth-generation NVLink. Exact board revision, NVSwitch population and package positions require the OEM bill of materials.',
      population: 'representative',
      schematic: true,
      specs: [
        {
          label: 'Board details',
          value:
            'Functional block; board SKU, count and physical layout not supplied',
        },
      ],
    },
    {
      key: 'backplane',
      kind: 'backplane',
      title: 'Storage connectivity',
      count: 1,
      model: 'Storage connectivity',
      description:
        'Functional route from the local SSDs to host I/O. Backplane, cabling and controller topology are not supplied.',
      population: 'representative',
      schematic: true,
      specs: [
        {
          label: 'Board details',
          value:
            'Functional block; board SKU, count and physical layout not supplied',
        },
      ],
    },
  ],
  sources: [
    {
      title: 'Supplied Washington cluster configuration · 8 September 2026',
      url: 'https://github.com/willnaheehs/rack-explore/blob/main/docs/washington-b300.md',
    },
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
  rackUnitsBasis: 'supplied',
};

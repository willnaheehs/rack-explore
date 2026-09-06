import { profileFor, partFor, type Reference } from './catalog.ts';
export type Fabric = 'compute' | 'frontend' | 'storage';
export type HardwareKind =
  | 'dgx'
  | 'qm9700'
  | 'sn4600c'
  | 'ai400x2'
  | 'gpu'
  | 'cpu'
  | 'nvlink'
  | 'nic'
  | 'nvme'
  | 'memory'
  | 'board'
  | 'backplane'
  | 'controller'
  | 'asic'
  | 'port'
  | 'psu'
  | 'fan';
export type Spec = { label: string; value: string; note?: string };
export type Hardware = {
  id: string;
  name: string;
  model: string;
  kind: HardwareKind;
  rack: string;
  u: number;
  height: number;
  fabric?: Fabric;
  parent?: string;
  index?: number;
  profile?: string;
  part?: string;
};
export type Rack = {
  id: string;
  name: string;
  role: string;
  x: number;
  color: string;
  units: number;
  mount?: '19-inch' | 'NVL72';
  depth?: number;
};
export const SOURCES = {
  dgx: {
    title: 'NVIDIA DGX H100 system user guide',
    url: 'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
  gpu: {
    title: 'NVIDIA H100 specifications',
    url: 'https://www.nvidia.com/en-us/data-center/h100/',
  },
  hopper: {
    title: 'NVIDIA Hopper architecture',
    url: 'https://developer.nvidia.com/blog/nvidia-hopper-architecture-in-depth/',
  },
  fabric: {
    title: 'NVIDIA SuperPOD network architecture',
    url: 'https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-h100/latest/network-fabrics.html',
  },
  rack: {
    title: 'NVIDIA data center design guide',
    url: 'https://docs.nvidia.com/dgx-superpod/design-guides/dgx-superpod-data-center-design-h100/latest/planning.html',
  },
  qm9700: {
    title: 'NVIDIA Quantum-2 hardware manual',
    url: 'https://networking-docs.nvidia.com/qm97x0hw/introduction',
  },
  sn4600c: {
    title: 'NVIDIA Spectrum-3 hardware manual',
    url: 'https://docs.nvidia.com/networking/display/nvidia-spectrum-3-sn4000-1u-and-2u-switch-systems-hardware-user-manual.pdf',
  },
  storage: {
    title: 'DDN A³I platform data sheet',
    url: 'https://www.ddn.com/wp-content/uploads/2024/09/ddn-a3i-data-sheet-2024-rebrand-v4-1.pdf',
  },
} as const;
export const FABRICS: Record<
  Fabric,
  { name: string; color: string; speed: string; description: string }
> = {
  compute: {
    name: 'Compute fabric',
    color: '#c3f16b',
    speed: '400 Gb/s NDR',
    description: 'Eight GPU rails into a leaf–spine InfiniBand fabric.',
  },
  frontend: {
    name: 'Front-end fabric',
    color: '#8cafff',
    speed: '100 GbE',
    description:
      'Redundant Ethernet for user access, provisioning, and cluster services.',
  },
  storage: {
    name: 'Storage fabric',
    color: '#de9be9',
    speed: '400 / 200 Gb/s',
    description: 'Dedicated InfiniBand paths to shared flash storage.',
  },
};
export const RACKS: Rack[] = [
  {
    id: 'A01',
    name: 'Compute 01',
    role: '4 × DGX H100',
    x: -1.23,
    color: '#c3f16b',
    units: 42,
  },
  {
    id: 'A02',
    name: 'Compute 02',
    role: '4 × DGX H100',
    x: -0.41,
    color: '#c3f16b',
    units: 42,
  },
  {
    id: 'N01',
    name: 'Network',
    role: 'Compute + front-end',
    x: 0.41,
    color: '#8cafff',
    units: 42,
  },
  {
    id: 'S01',
    name: 'Storage',
    role: '4 × DDN AI400X2',
    x: 1.23,
    color: '#de9be9',
    units: 42,
  },
];
const pad = (n: number) => String(n).padStart(2, '0');
export const NODES: Hardware[] = Array.from({ length: 8 }, (_, i) => ({
  id: `dgx-${pad(i + 1)}`,
  name: `DGX-${pad(i + 1)}`,
  model: 'NVIDIA DGX H100',
  kind: 'dgx',
  rack: i < 4 ? 'A01' : 'A02',
  u: 1 + (i % 4) * 9,
  height: 8,
}));
export const LEAVES: Hardware[] = Array.from({ length: 8 }, (_, i) => ({
  id: `leaf-${pad(i + 1)}`,
  name: `LEAF-${pad(i + 1)}`,
  model: 'NVIDIA Quantum-2 QM9700',
  kind: 'qm9700',
  rack: 'N01',
  u: 18 + i,
  height: 1,
  fabric: 'compute',
  index: i,
}));
export const SPINES: Hardware[] = Array.from({ length: 4 }, (_, i) => ({
  id: `spine-${pad(i + 1)}`,
  name: `SPINE-${pad(i + 1)}`,
  model: 'NVIDIA Quantum-2 QM9700',
  kind: 'qm9700',
  rack: 'N01',
  u: 30 + i,
  height: 1,
  fabric: 'compute',
  index: i,
}));
export const FRONTEND: Hardware[] = Array.from({ length: 2 }, (_, i) => ({
  id: `ethernet-${i + 1}`,
  name: `ETH-${i ? 'B' : 'A'}`,
  model: 'NVIDIA Spectrum-3 SN4600C',
  kind: 'sn4600c',
  rack: 'N01',
  u: 9 + i * 3,
  height: 2,
  fabric: 'frontend',
  index: i,
}));
export const STORAGE_SWITCHES: Hardware[] = Array.from(
  { length: 2 },
  (_, i) => ({
    id: `storage-sw-${i + 1}`,
    name: `STORAGE-${i ? 'B' : 'A'}`,
    model: 'NVIDIA Quantum-2 QM9700',
    kind: 'qm9700',
    rack: 'S01',
    u: 30 + i * 2,
    height: 1,
    fabric: 'storage',
    index: i,
  }),
);
export const ARRAYS: Hardware[] = Array.from({ length: 4 }, (_, i) => ({
  id: `ddn-${pad(i + 1)}`,
  name: `FLASH-${pad(i + 1)}`,
  model: 'DDN AI400X2',
  kind: 'ai400x2',
  rack: 'S01',
  u: 4 + i * 4,
  height: 2,
  fabric: 'storage',
  index: i,
}));
export const HARDWARE: Hardware[] = [
  ...NODES,
  ...LEAVES,
  ...SPINES,
  ...FRONTEND,
  ...STORAGE_SWITCHES,
  ...ARRAYS,
];
export const U_METERS = 0.04445;
export const yForHardware = (h: Hardware) =>
  0.12 + (h.u - 1 + h.height / 2) * U_METERS;
export type ClusterModel = {
  id: string;
  title: string;
  description: string;
  racks: Rack[];
  hardware: Hardware[];
  links: Link[];
  custom?: boolean;
};
export function childrenOf(node: Hardware): Hardware[] {
  if (node.parent) return [];
  return profileFor(node).parts.flatMap((p) =>
    Array.from({ length: p.count }, (_, index) => ({
      ...node,
      id: `${node.id}/${p.key}-${index}`,
      parent: node.id,
      name: `${p.key.toUpperCase()} ${index + 1}`,
      kind: p.kind,
      model: p.model,
      profile: profileFor(node).id,
      part: p.key,
      index,
    })),
  );
}
export function resolveHardware(
  id: string | null,
  model?: ClusterModel,
): Hardware | undefined {
  if (!id) return;
  const root = (model?.hardware ?? HARDWARE).find(
    (h) => h.id === id.split('/')[0],
  );
  return id.includes('/') && root
    ? childrenOf(root).find((h) => h.id === id)
    : root;
}
export function specsFor(h: Hardware): Spec[] {
  const p = profileFor(h),
    part = partFor(h);
  return part
    ? [
        ...part.specs,
        {
          label: 'Representation',
          value: part.schematic
            ? 'Representative functional block'
            : 'Documented module type; schematic placement',
        },
      ]
    : [
        { label: 'Platform', value: `${p.maker} ${p.name}` },
        { label: 'Rack space', value: `${p.units}U` },
        { label: 'Cooling design', value: p.cooling },
        ...p.specs,
      ];
}
export function descriptionFor(h: Hardware) {
  return partFor(h)?.description ?? profileFor(h).description;
}
export function referencesFor(h: Hardware): Reference[] {
  return profileFor(h).sources;
}
export type Link = {
  id: string;
  from: string;
  to: string;
  fabric: Fabric;
  count: number;
  rate: number;
  label: string;
};
export const LINKS: Link[] = [
  ...NODES.flatMap((n) =>
    LEAVES.map((l, i) => ({
      id: `${n.id}-${l.id}`,
      from: n.id,
      to: l.id,
      fabric: 'compute' as const,
      count: 1,
      rate: 400,
      label: `GPU rail ${i + 1} · 1 × NDR400`,
    })),
  ),
  ...LEAVES.flatMap((l) =>
    SPINES.map((s) => ({
      id: `${l.id}-${s.id}`,
      from: l.id,
      to: s.id,
      fabric: 'compute' as const,
      count: 8,
      rate: 400,
      label: '8 × NDR400 · grouped link',
    })),
  ),
  ...NODES.flatMap((n) =>
    FRONTEND.map((s) => ({
      id: `${n.id}-${s.id}`,
      from: n.id,
      to: s.id,
      fabric: 'frontend' as const,
      count: 1,
      rate: 100,
      label: '1 × 100 GbE · in-band',
    })),
  ),
  {
    id: 'ethernet-peer',
    from: 'ethernet-1',
    to: 'ethernet-2',
    fabric: 'frontend',
    count: 2,
    rate: 100,
    label: '2 × 100 GbE · peer link',
  },
  ...NODES.flatMap((n) =>
    STORAGE_SWITCHES.map((s) => ({
      id: `${n.id}-${s.id}`,
      from: n.id,
      to: s.id,
      fabric: 'storage' as const,
      count: 1,
      rate: 400,
      label: '1 × NDR400 · storage NIC',
    })),
  ),
  ...ARRAYS.flatMap((a) =>
    STORAGE_SWITCHES.map((s) => ({
      id: `${a.id}-${s.id}`,
      from: a.id,
      to: s.id,
      fabric: 'storage' as const,
      count: 4,
      rate: 200,
      label: '4 × HDR200 · grouped link',
    })),
  ),
];
export function linksFor(h: Hardware, model?: ClusterModel) {
  return (model?.links ?? LINKS).filter(
    (l) => l.from === (h.parent ?? h.id) || l.to === (h.parent ?? h.id),
  );
}
export const MODEL_NOTE =
  'An illustrative eight-node configuration using documented hardware. Rack placement and cable paths are designed for exploration; this is not an as-built survey or a certified SuperPOD deployment. Specifications are nominal, not live telemetry.';

export const DEFAULT_MODEL: ClusterModel = {
  id: 'h100-cluster',
  title: 'DGX H100 reference cluster',
  description: MODEL_NOTE,
  racks: RACKS,
  hardware: HARDWARE,
  links: LINKS,
};

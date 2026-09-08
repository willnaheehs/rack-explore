import { profileFor, type Reference } from './catalog.ts';
import { type ClusterModel, type Fabric } from './hardware.ts';

export type FabricSource = Reference & { section: string };
export type FabricNode = {
  id: string;
  title: string;
  subtitle: string;
  row: number;
  detail: string;
  sources: FabricSource[];
  hardwareId?: string;
};
export type FabricConnection = {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: 'link' | 'relationship' | 'capability';
  protocol: string;
  count?: number;
  rateGbps?: number;
  fromPort: string;
  toPort: string;
  medium: string;
  detail: string;
  sources: FabricSource[];
  sharedPhysicalId?: string;
};
export type FabricReference = {
  id: string;
  title: string;
  status:
    | 'Reference design'
    | 'Interface specifications'
    | 'Supplied configuration'
    | 'Not applicable';
  scope: string;
  speed: string;
  summary: string;
  limitations: string[];
  sources: FabricSource[];
  nodes: FabricNode[];
  connections: FabricConnection[];
  sharedWith?: Fabric[];
};
export type FabricReferences = Record<Fabric, FabricReference>;
const source = (title: string, url: string, section: string): FabricSource => ({
  title,
  url,
  section,
});
const sources = {
  h100: source(
    'NVIDIA DGX H100 SuperPOD',
    'https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-h100/latest/network-fabrics.html',
    'Network fabrics · Figures 4–10; Table 4',
  ),
  h200: source(
    'NVIDIA DGX H100 / H200 ports',
    'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
    'Network ports',
  ),
  b200: source(
    'NVIDIA DGX B200 SuperPOD',
    'https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-b200/latest/network-fabrics.html',
    'Network fabrics · Figures 4–12; Table 4',
  ),
  b300: source(
    'NVIDIA DGX B300 SuperPOD · XDR / AC',
    'https://docs.nvidia.com/dgx-superpod/reference-architecture/scalable-infrastructure-b300-xdr/latest/network-fabrics.html',
    'Network fabrics · Figures 4–13',
  ),
  b300Ports: source(
    'NVIDIA DGX B300 system guide',
    'https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html',
    'Network adapters and front panel',
  ),
  gb200: source(
    'NVIDIA DGX GB200 SuperPOD',
    'https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/network-fabrics.html',
    'Compute; Storage and In-band Ethernet; Network segmentation',
  ),
  gb300: source(
    'NVIDIA DGX GB300 SuperPOD',
    'https://docs.nvidia.com/pdf/dgx-spod-gb300-ra.pdf',
    'PDF pages 20–22 · Compute and Ethernet fabrics',
  ),
  dell: source(
    'Dell AI Factory · XE9780 network',
    'https://infohub.delltechnologies.com/en-us/l/dell-ai-factory-with-nvdia-including-nvidia-gpus-openshift-ai-and-spectrum-x-networking-platforms/physical-network-architecture-21/3/',
    'Dedicated GPU network · Figure 4',
  ),
  dellPorts: source(
    'Dell XE9780 worker configuration',
    'https://infohub.delltechnologies.com/en-uk/l/dell-ai-factory-with-nvidia-including-nvidia-gpus-and-spectrum-4-switches-with-dell-sonic/gpu-worker-node-configuration-27/2/',
    'Table 4 · B300 worker interfaces',
  ),
  lenovo: source(
    'Lenovo Hybrid AI 289',
    'https://lenovopress.lenovo.com/lp2286-lenovo-hybrid-ai-289-platform-guide',
    '289-800 · Tables 2, 4; Figure 9; dual-plane cabling',
  ),
  sm: source(
    'Supermicro AMD / Pollara validated design',
    'https://www.supermicro.com/solutions/validated-design/AMD-Instinct-MI325X-Pensando-Pollara-GPU-Cluster.pdf',
    'PDF pages 11–22 · Scale unit and storage design',
  ),
  smSystems: source(
    'Supermicro MI350 / MI355 system mapping',
    'https://www.supermicro.com/solutions/Solution_Brief_SMCI_AMD_Architecting_Scalable_Inference.pdf',
    'Architecture snapshot · system and NIC options',
  ),
  smB300: source(
    'Supermicro AS-4126GS-NB3RT-LCC',
    'https://www.supermicro.com/en/products/system/datasheet/as-4126gs-nb3rt-lcc',
    'Networking and onboard devices',
  ),
  hpe: source(
    'HPE XD685 QuickSpecs · August 2026',
    'https://www.hpe.com/us/en/collaterals/collateral.a00073553enw.html',
    'HPE Networking; platform PCIe expansion',
  ),
  ddn: source(
    'DDN A³I data sheet',
    'https://www.ddn.com/wp-content/uploads/2024/09/ddn-a3i-data-sheet-2024-rebrand-v4-1.pdf',
    'AI400X2 host interfaces',
  ),
};
const geometryNote =
  'Diagram positions represent topology roles. Rack U locations, cable lengths and numbered switch sockets are not asserted unless listed in a connection.';
function plan(
  id: string,
  title: string,
  speed: string,
  scope: string,
  summary: string,
  refs: FabricSource[],
  status: FabricReference['status'] = 'Reference design',
): FabricReference {
  return {
    id,
    title,
    speed,
    scope,
    summary,
    status,
    sources: refs,
    limitations: [geometryNote],
    nodes: [],
    connections: [],
  };
}
function node(
  p: FabricReference,
  id: string,
  title: string,
  subtitle: string,
  row: number,
  detail: string,
  hardwareId?: string,
) {
  p.nodes.push({
    id,
    title,
    subtitle,
    row,
    detail,
    sources: p.sources,
    hardwareId,
  });
  return id;
}
function edge(
  p: FabricReference,
  from: string,
  to: string,
  label: string,
  options: Partial<Omit<FabricConnection, 'id' | 'from' | 'to' | 'label'>> = {},
) {
  p.connections.push({
    id: `${p.id}:${from}:${to}`,
    from,
    to,
    label,
    kind: 'relationship',
    protocol: 'See reference',
    fromPort: 'Port mapping not specified',
    toPort: 'Port mapping not specified',
    medium: 'Cable / optic SKU not specified',
    detail: '',
    sources: p.sources,
    ...options,
  });
}
function endpoint(p: FabricReference, h: ClusterModel['hardware'][number]) {
  return node(
    p,
    'host',
    profileFor(h).name,
    h.name,
    0,
    'The selected physical chassis. The connection plan describes the reference configuration named above.',
    h.id,
  );
}
function nvidia(
  model: ClusterModel,
  key: 'h100' | 'b200' | 'b300' | 'gb200' | 'gb300',
): FabricReferences {
  const h = model.hardware.find((h) => profileFor(h).category === 'compute')!;
  const isNvl = key.startsWith('gb'),
    latest = key === 'gb300' || key === 'b300';
  const refs = [
    sources[key],
    ...(key === 'h100'
      ? [sources.h200]
      : key === 'b300'
        ? [sources.b300Ports]
        : []),
  ];
  const rails = isNvl ? 4 : 8,
    rate = latest ? 800 : 400;
  const switchName = latest ? 'Quantum-X800 Q3400' : 'Quantum-2 QM9700';
  const scope =
    key === 'gb200'
      ? 'One tray in an 8-rack / 576-GPU scalable unit'
      : key === 'gb300'
        ? 'One tray · 8-rack scalable unit; scale-out spine layer'
        : key === 'b300'
          ? 'One server in a 72-server scalable unit · XDR option'
          : 'One server · 31 DGX systems + UFM capacity per scalable unit';
  const compute = plan(
    `${key}-compute`,
    `${key.toUpperCase()} SuperPOD · compute`,
    `${rails} × ${rate} Gb/s InfiniBand`,
    scope,
    'Dedicated GPU adapters connect to rail-aligned leaf switches; the spine layer carries traffic across leaf groups.',
    refs,
  );
  endpoint(compute, h);
  for (let i = 0; i < rails; i++) {
    const nic = node(
      compute,
      `nic-${i}`,
      `GPU rail ${i + 1}`,
      latest ? 'ConnectX-8' : 'ConnectX-7',
      1,
      `${rate} Gb/s per adapter. Rail numbers are logical identities, not chassis socket labels.`,
    );
    const leaf = node(
      compute,
      `leaf-${i}`,
      `Rail ${i + 1} leaf`,
      switchName,
      2,
      key === 'gb300'
        ? 'Two Q3400 leaves per rail per SU; this block represents the rail group.'
        : key === 'gb200'
          ? 'Eight leaves and six spines per rail group per SU in the scale-out design.'
          : 'Leaf membership follows the reference rail topology.',
    );
    edge(compute, 'host', nic, 'GPU-adjacent adapter', {
      protocol: 'PCIe',
      detail: 'Internal adapter relationship; not an external network cable.',
    });
    edge(compute, nic, leaf, `${rate} Gb/s IB`, {
      kind: 'link',
      protocol: latest ? 'InfiniBand XDR' : 'InfiniBand NDR',
      count: 1,
      rateGbps: rate,
      fromPort:
        key === 'h100'
          ? `OSFP${Math.floor(i / 2) + 1}P${(i % 2) + 1}`
          : `Compute adapter ${i + 1}`,
      toPort: 'Matching rail leaf · socket not specified',
      medium: latest
        ? 'XDR-qualified link · cable SKU not selected'
        : 'NDR-qualified link · cable SKU not selected',
    });
  }
  node(
    compute,
    'spines',
    'Spine layer',
    switchName,
    3,
    key === 'h100' || key === 'b200'
      ? 'One SU uses four spines and eight leaves, with 256 leaf–spine cables in total.'
      : 'Switch quantity and uplink population depend on the reference cluster size. This block groups that layer.',
  );
  for (let i = 0; i < rails; i++)
    edge(
      compute,
      `leaf-${i}`,
      'spines',
      key === 'h100' || key === 'b200'
        ? '32 × 400 Gb/s per leaf'
        : 'Reference uplinks',
      {
        ...(key === 'h100' || key === 'b200'
          ? { kind: 'link' as const, count: 32, rateGbps: 400 }
          : {}),
        protocol: 'InfiniBand',
        detail:
          key === 'h100' || key === 'b200'
            ? '256 leaf–spine cables / 8 symmetric rail leaves = 32 uplinks per leaf in the one-SU design. This endpoint groups the four spines.'
            : 'Layer relationship, not a claim of one cable or a complete cable schedule.',
      },
    );
  const ethernetSwitch =
    key === 'h100'
      ? 'Spectrum-3 SN4600C'
      : key === 'b300'
        ? 'Spectrum-4 SN5610'
        : key === 'gb300'
          ? 'Spectrum-4 SN5600D'
          : 'Spectrum-4 SN5600';
  const ioRate = key === 'gb200' ? 200 : key === 'h100' ? 100 : 400;
  const ioCount = key === 'gb200' ? 4 : 2;
  const makeIO = (fabric: 'frontend' | 'storage') => {
    const storage = fabric === 'storage';
    const useIB = storage && !isNvl;
    const p = plan(
      `${key}-${fabric}`,
      `${key.toUpperCase()} SuperPOD · ${storage ? 'storage' : 'front-end'}`,
      isNvl
        ? `${ioCount} × ${ioRate} GbE shared underlay`
        : useIB
          ? 'Dedicated NDR InfiniBand'
          : key === 'h100'
            ? '100 GbE'
            : 'Spectrum-4 Ethernet',
      scope,
      isNvl
        ? 'Storage and in-band services use the same physical Ethernet switching infrastructure with logical separation.'
        : storage
          ? 'Storage has its own fabric. Storage-facing uplinks are non-blocking; DGX-facing oversubscription is defined in the reference.'
          : 'In-band Ethernet connects cluster services, user access and home storage. BMC management remains a separate network.',
      refs,
    );
    endpoint(p, h);
    node(
      p,
      'io',
      isNvl || key !== 'h100' ? 'BlueField-3 I/O' : 'ConnectX-7 I/O',
      isNvl ? `${ioCount} Ethernet links / tray` : 'Separate from GPU rails',
      1,
      isNvl
        ? 'The shared port group appears in both traffic views; it is counted once physically.'
        : 'Dedicated I/O adapters; these do not consume the eight GPU compute rails.',
    );
    edge(p, 'host', 'io', 'Host I/O', { protocol: 'PCIe' });
    node(
      p,
      'io-leaves',
      isNvl
        ? 'Shared Ethernet leaves'
        : storage
          ? 'Storage leaf layer'
          : 'In-band leaf layer',
      useIB ? 'Quantum-2 QM9700' : ethernetSwitch,
      2,
      isNvl
        ? 'The same leaves carry storage and in-band traffic.'
        : 'Switch model follows the selected SuperPOD reference option.',
    );
    edge(
      p,
      'io',
      'io-leaves',
      isNvl
        ? `${ioCount} × ${ioRate} GbE · shared`
        : key === 'h100'
          ? storage
            ? '2 × 400 Gb/s IB'
            : '2 × 100 GbE'
          : 'Documented I/O path',
      {
        kind: isNvl || key === 'h100' ? 'link' : 'relationship',
        protocol: useIB ? 'InfiniBand NDR' : 'Ethernet',
        ...(isNvl
          ? {
              count: ioCount,
              rateGbps: ioRate,
              sharedPhysicalId: `${key}-bluefield-underlay`,
            }
          : key === 'h100'
            ? { count: 2, rateGbps: storage ? 400 : 100 }
            : {}),
        detail:
          key === 'gb200'
            ? 'Four 200 GbE links in total per tray; storage and in-band traffic share the switching infrastructure.'
            : isNvl
              ? 'Dual-port BF3240 connection group, shared across storage and in-band views.'
              : 'See the source port figure for the platform-specific adapter mode.',
      },
    );
    const hasSpines = key !== 'h100' || storage;
    if (hasSpines)
      node(
        p,
        'io-spines',
        'Ethernet / storage spines',
        useIB ? 'Quantum-2' : ethernetSwitch,
        3,
        'Aggregated switching tier; quantity depends on deployment size.',
      );
    if (hasSpines)
      edge(p, 'io-leaves', 'io-spines', 'Reference uplinks', {
        protocol: useIB ? 'InfiniBand' : 'Ethernet',
      });
    node(
      p,
      'target',
      storage ? 'Storage-facing leaves' : 'Services / customer edge',
      storage
        ? 'Certified storage integration'
        : 'User access · NFS · provisioning',
      hasSpines ? 4 : 3,
      storage
        ? 'The reference does not prescribe the DDN AI400X2 for every platform. Array model and its port schedule must come from the selected storage integration.'
        : 'External customer connectivity is deployment-specific.',
    );
    edge(
      p,
      hasSpines ? 'io-spines' : 'io-leaves',
      'target',
      storage ? 'Storage integration' : 'In-band access',
      {
        protocol: useIB
          ? 'InfiniBand'
          : storage
            ? 'Ethernet / RoCE'
            : 'Ethernet',
      },
    );
    if (storage) {
      node(
        p,
        'appliance',
        'Storage appliance / service',
        'Selected qualified storage solution',
        5,
        'The vendor storage integration defines the appliance model, host interfaces, redundancy and cable population.',
      );
      edge(p, 'target', 'appliance', 'Qualified storage attachment', {
        protocol: useIB ? 'InfiniBand' : 'Ethernet / RoCE',
        detail:
          'Storage integration boundary; no arbitrary array model or link count is substituted.',
      });
    }
    if (isNvl) p.sharedWith = [storage ? 'frontend' : 'storage'];
    if (key === 'b200' || key === 'b300')
      p.limitations.push(
        'The InfiniBand storage option is shown. The cited reference also supports an Ethernet storage option.',
      );
    p.limitations.push(
      'Storage appliance model and appliance-side cable count require a selected, qualified storage solution.',
    );
    return p;
  };
  return { compute, frontend: makeIO('frontend'), storage: makeIO('storage') };
}
function enterprise(
  model: ClusterModel,
  maker: 'dell' | 'lenovo',
): FabricReferences {
  const h = model.hardware[0],
    lenovo = maker === 'lenovo';
  const refs = [sources[maker], ...(!lenovo ? [sources.dellPorts] : [])];
  const scope = lenovo
    ? 'Hybrid AI 289-800 · dual-plane cabling for up to 4 SUs / 16 servers'
    : 'XE9780 dedicated GPU network · Figure 4 configuration';
  const compute = plan(
    `${maker}-compute`,
    lenovo ? 'Lenovo 289-800 · two planes' : 'Dell AI Factory · GPU backend',
    lenovo ? '2 × 400 GbE per GPU' : '400 GbE backend links',
    scope,
    lenovo
      ? 'Each ConnectX-8 uses both planes. Twin-transceiver port 1 goes to plane 1, port 2 to plane 2.'
      : 'GPU traffic uses a dedicated pair of SN5610 switches. Adapter capability is 800 Gb/s; the cited network design labels the backend links at 400 GbE.',
    refs,
  );
  endpoint(compute, h);
  for (let i = 0; i < 8; i++) {
    node(
      compute,
      `nic-${i}`,
      `GPU / NIC ${i + 1}`,
      'ConnectX-8',
      1,
      'Integrated GPU networking. The diagram uses the reference link mode, not just the adapter maximum.',
    );
    edge(compute, 'host', `nic-${i}`, 'GPU / NIC', { protocol: 'PCIe' });
  }
  const leafCount = lenovo ? 4 : 2;
  for (let i = 0; i < leafCount; i++)
    node(
      compute,
      `leaf-${i}`,
      lenovo
        ? `Plane ${Math.floor(i / 2) + 1} · ${i % 2 ? 'even' : 'odd'}`
        : `GPU leaf ${i + 1}`,
      'Spectrum-4 SN5610',
      2,
      lenovo
        ? 'Every other NIC connects to the same switch within each plane.'
        : 'Dedicated GPU switch pair. The text does not enumerate the NIC-to-switch socket schedule.',
    );
  for (let i = 0; i < 8; i++) {
    if (lenovo)
      for (let plane = 0; plane < 2; plane++)
        edge(compute, `nic-${i}`, `leaf-${plane * 2 + (i % 2)}`, '400 GbE', {
          kind: 'link',
          protocol: 'Ethernet / RoCEv2',
          count: 1,
          rateGbps: 400,
          fromPort: `NIC ${i + 1}, twin-transceiver port ${plane + 1}`,
          toPort: `Plane ${plane + 1} · ${i % 2 ? 'even' : 'odd'} NIC leaf`,
          medium: 'BQMJ host / CB2U switch optics; BQJP, BQJQ or BQJR fiber',
          detail:
            'Figure 9 and the dual-plane cabling rule. Switch socket numbers are not invented.',
        });
    else
      edge(compute, `nic-${i}`, 'backend-pair', '400 GbE', {
        kind: 'link',
        protocol: 'Ethernet / RoCEv2',
        count: 1,
        rateGbps: 400,
        fromPort: `ConnectX-8 ${i + 1}`,
        toPort: 'Dedicated SN5610 pair · member assignment not specified',
      });
  }
  if (!lenovo) {
    node(
      compute,
      'backend-pair',
      'Dedicated GPU fabric',
      '2 × SN5610',
      2,
      'Pair is grouped to avoid inventing a per-NIC switch assignment.',
    );
    compute.nodes = compute.nodes.filter((n) => !n.id.startsWith('leaf-'));
  }
  const makeIO = (fabric: 'frontend' | 'storage') => {
    const storage = fabric === 'storage';
    const p = plan(
      `${maker}-${fabric}`,
      `${lenovo ? 'Lenovo 289-800' : 'Dell AI Factory'} · ${storage ? 'storage' : 'front-end'}`,
      '2 × 400 GbE · shared',
      scope,
      'Storage and front-end traffic share the north–south Ethernet fabric, separate from GPU traffic.',
      refs,
    );
    p.sharedWith = [storage ? 'frontend' : 'storage'];
    endpoint(p, h);
    node(
      p,
      'dpu',
      'BlueField-3 B3240',
      'Dual-port 400 GbE',
      1,
      lenovo
        ? 'B3240 is in slot 2 in this configuration.'
        : 'The worker configuration selects one B3240 DPU.',
    );
    edge(p, 'host', 'dpu', 'Host I/O', { protocol: 'PCIe' });
    for (let i = 0; i < 2; i++) {
      node(
        p,
        `front-${i}`,
        `North–south leaf ${i + 1}`,
        'Spectrum-4 SN5610',
        2,
        'Both logical traffic views refer to these same physical switches.',
      );
      edge(p, 'dpu', `front-${i}`, '400 GbE · shared', {
        kind: 'link',
        protocol: 'Ethernet',
        count: 1,
        rateGbps: 400,
        sharedPhysicalId: `${maker}-b3240-${i}`,
        fromPort: `B3240 port ${i + 1}`,
        toPort: 'Redundant front-end pair · socket not specified',
        medium: lenovo
          ? 'BQJZ host optics · Table 4'
          : 'See Dell cables and optics guidance',
      });
    }
    node(
      p,
      'target',
      storage
        ? lenovo
          ? 'Selected storage solution'
          : 'Dell PowerScale'
        : 'Services / enterprise edge',
      storage
        ? lenovo
          ? 'Not included in base BoM'
          : '200 GbE storage attachment'
        : lenovo
          ? 'SR655 V3 service nodes'
          : '100 GbE control-plane nodes',
      3,
      storage && lenovo
        ? 'Lenovo leaves storage optional and does not specify an array or its cable population in this BoM.'
        : 'External endpoint described by the reference; not an additional chassis in the physical inventory.',
    );
    for (let i = 0; i < 2; i++)
      edge(
        p,
        `front-${i}`,
        'target',
        storage && !lenovo ? '200 GbE attachment' : 'Service connectivity',
        {
          protocol: 'Ethernet',
          detail:
            'Logical attachment to the switch pair; cable quantity is not specified.',
        },
      );
    p.limitations.push(
      lenovo
        ? 'Array selection is outside the base Lenovo BoM.'
        : 'Array model, ISL population and exact socket assignments are not specified here.',
    );
    return p;
  };
  return { compute, frontend: makeIO('frontend'), storage: makeIO('storage') };
}
function supermicro(model: ClusterModel): FabricReferences {
  const h = model.hardware[0],
    refs = [sources.sm, sources.smSystems];
  const scope =
    'Supermicro MI300X–MI355X family design · 32 servers / 256 GPUs; one server shown';
  const compute = plan(
    'sm-compute',
    'Supermicro · Pollara / SONiC',
    '8 × 400 GbE per server',
    scope,
    'Eight Pollara GPU NICs connect to one SU leaf. Four SU leaves connect to two spines using 800 GbE uplinks.',
    refs,
  );
  endpoint(compute, h);
  for (let i = 0; i < 8; i++) {
    node(
      compute,
      `nic-${i}`,
      `GPU NIC ${i + 1}`,
      'Pensando Pollara 400',
      1,
      'Selected adapter in the vendor reference configuration, not an empty PCIe slot.',
    );
    edge(compute, 'host', `nic-${i}`, 'GPU-local PCIe', {
      protocol: 'PCIe Gen 5',
    });
    edge(compute, `nic-${i}`, 'leaf', '400 GbE', {
      kind: 'link',
      protocol: 'Ethernet / RoCEv2',
      count: 1,
      rateGbps: 400,
      fromPort: `Pollara NIC ${i + 1}`,
      toPort: 'SU leaf · socket schedule depends on node position',
      medium: '800G OSFP → 2 × 400G QSFP112 breakout; copper within reach',
    });
  }
  node(
    compute,
    'leaf',
    'SU leaf',
    'Supermicro SSE-T8196',
    2,
    'One leaf serves eight GPU servers. The guide also uses SSE-T8164 naming in figures and configuration examples; confirm the ordered switch SKU.',
  );
  for (let i = 0; i < 2; i++) {
    node(
      compute,
      `spine-${i}`,
      `Spine ${i + 1}`,
      '800 GbE uplinks',
      3,
      'Spine member in the four-SU design.',
    );
    edge(compute, 'leaf', `spine-${i}`, '16 × 800 GbE', {
      kind: 'link',
      protocol: 'Ethernet',
      count: 16,
      rateGbps: 800,
      fromPort: i ? 'Eth 1/17–1/32' : 'Eth 1/1–1/16',
      toPort: `Spine ${i + 1} · sockets not specified`,
      medium: 'OSFP 800G optical uplinks',
      detail: 'Configuration section for the 4-leaf / 2-spine design.',
    });
  }
  compute.limitations.push(
    'The vendor guide mixes SSE-T8196 and SSE-T8164 identifiers. Switch SKU and socket labels require the final vendor BoM.',
  );
  const makeIO = (fabric: 'frontend' | 'storage') => {
    const storage = fabric === 'storage';
    const p = plan(
      `sm-${fabric}`,
      `Supermicro · ${storage ? 'storage' : 'in-band'}`,
      storage
        ? '200 GbE per CPU · selected design'
        : 'Redundant 10 / 25 GbE option',
      scope,
      storage
        ? 'A separate storage switch pair connects CPU-side I/O to the chosen storage stack.'
        : 'The guide permits a dedicated in-band pair or convergence onto storage. The dedicated option is shown.',
      refs,
    );
    endpoint(p, h);
    node(
      p,
      'io',
      storage ? 'CPU-side storage I/O' : 'In-band Ethernet pair',
      storage ? '200 GbE / CPU' : '10 / 25 GbE',
      1,
      storage
        ? 'This guide specifies 200 GbE storage access per CPU; adapter capability may be higher.'
        : 'Dedicated front-end interface option in the storage-network chapter.',
    );
    node(
      p,
      'switches',
      storage ? 'Storage switch pair' : 'Front-end switch pair',
      'SKU chosen by integrator',
      2,
      'The reference specifies the role, not a universal switch or array model.',
    );
    node(
      p,
      'target',
      storage ? 'Storage services' : 'Tenant / admin access',
      storage ? 'WEKA / DDN / VAST integration' : 'Firewalled customer network',
      3,
      'Choose the supported storage stack or customer edge for the deployment.',
    );
    edge(p, 'host', 'io', 'Host I/O', { protocol: 'PCIe' });
    edge(p, 'io', 'switches', storage ? '2 × 200 GbE' : 'Redundant Ethernet', {
      kind: storage ? 'link' : 'relationship',
      protocol: 'Ethernet',
      ...(storage ? { count: 2, rateGbps: 200 } : {}),
    });
    edge(p, 'switches', 'target', 'Selected integration', {
      protocol: 'Ethernet',
    });
    p.limitations.push(
      'Storage/server-side SKU and cable population are selected by the integrator.',
    );
    return p;
  };
  return { compute, frontend: makeIO('frontend'), storage: makeIO('storage') };
}
function interfaces(model: ClusterModel): FabricReferences {
  const h = model.hardware[0],
    profile = profileFor(h),
    hpe = profile.id === 'hpe-xd685',
    smB300 = profile.id === 'sm-b300';
  const refs = hpe
    ? [sources.hpe]
    : smB300
      ? [sources.smB300]
      : profile.sources.map((s) => ({ ...s, section: 'Hardware interfaces' }));
  const make = (fabric: Fabric): FabricReference => {
    const storage = profile.category === 'storage',
      network = profile.category === 'network';
    const na = storage && fabric !== 'storage';
    const p = plan(
      `${profile.id}-${fabric}`,
      `${profile.maker} ${profile.name} · ${fabric} interfaces`,
      'Hardware capability',
      'Published interface boundary · no verified cluster cable schedule',
      na
        ? 'This storage appliance is not a GPU compute or cluster front-end fabric.'
        : 'Only documented interfaces are shown. A standalone hardware specification does not prescribe the surrounding cluster.',
      refs,
      na ? 'Not applicable' : 'Interface specifications',
    );
    endpoint(p, h);
    if (na) return p;
    let title = 'Network interfaces',
      label = 'Configuration-dependent',
      detail = '',
      count: number | undefined,
      rateGbps: number | undefined;
    if (hpe) {
      title =
        fabric === 'compute'
          ? 'GPU-attached PCIe slots'
          : 'Host fabric / NIC / DPU slots';
      label =
        fabric === 'compute'
          ? '8 × PCIe Gen 5 x16 slots'
          : '4 host expansion slots · shared budget';
      detail =
        fabric === 'compute'
          ? 'Supported 400 GbE options include AMD Pollara S6U37A and Broadcom P74287-H21. NDR/XDR adapters are also listed. No card is assumed installed.'
          : 'QuickSpecs lists Ethernet and BlueField options. A populated adapter BoM, switch design and cable schedule have not been verified for this preset.';
    } else if (smB300) {
      title =
        fabric === 'compute' ? 'ConnectX-8 SuperNICs' : 'Host I/O options';
      label =
        fabric === 'compute'
          ? '8 × up to 800 Gb/s'
          : '2 × 10 GbE; optional BlueField-3';
      detail =
        fabric === 'compute'
          ? 'Eight integrated 800 Gb/s adapters are documented; protocol and cable mode need a selected network design.'
          : 'Up to two dual-port BlueField-3 DPUs are optional. Storage assignments and network equipment are not prescribed by this system sheet.';
      if (fabric === 'compute') {
        count = 8;
        rateGbps = 800;
      }
    } else if (storage) {
      title = 'AI400X2 host interfaces';
      label = '8 × 200 Gb/s';
      count = 8;
      rateGbps = 200;
      detail =
        'Choose the HDR InfiniBand or Ethernet appliance option. Eight ports is the appliance total, not eight ports per fabric.';
    } else if (network) {
      const port = profile.parts.find((part) => part.key === 'port');
      title = 'External switch ports';
      label =
        profile.specs.find((s) => s.label === 'Logical high-speed ports')
          ?.value ?? 'See hardware manual';
      detail = `${port?.count ?? 0} physical cages. ${label}. This is capacity, not connected cable population. The standalone switch is not assigned a cluster role.`;
    }
    node(p, 'ports', title, label, 1, detail);
    edge(p, 'host', 'ports', label, {
      kind: 'capability',
      protocol: 'Hardware capability; mode unselected',
      count,
      rateGbps,
      detail,
    });
    p.limitations.push(
      'No verified switch BoM, endpoint assignments or cable schedule for this standalone preset. No external wires are generated.',
    );
    return p;
  };
  return {
    compute: make('compute'),
    frontend: make('frontend'),
    storage: make('storage'),
  };
}
function washington(model: ClusterModel): FabricReferences {
  const profile = profileFor(model.hardware[0]);
  const refs = profile.sources.map((s) => ({
    ...s,
    section: 'Supplied cluster profile and component context',
  }));
  const make = (fabric: Fabric): FabricReference => {
    const p = plan(
      `washington-b300-${fabric}`,
      `Washington B300 · ${fabric === 'storage' ? 'WEKA storage' : fabric === 'compute' ? 'RoCE v2 interconnect' : 'front end'}`,
      fabric === 'compute'
        ? '6.4 Tb/s per node'
        : fabric === 'storage'
          ? '150 TB shared'
          : 'Not supplied',
      '32-node supplied configuration · physical cabling unknown',
      fabric === 'compute'
        ? '32 nodes, each reporting 6.4 Tb/s aggregate RoCE v2. Adapter models, port counts, switching and oversubscription are not specified.'
        : fabric === 'storage'
          ? '150 TB of shared WEKA storage serves the cluster. This service view does not assume dedicated storage appliances or reuse of the nodes’ local NVMe.'
          : 'The cluster front-end and management network were not included in the supplied configuration.',
      refs,
      'Supplied configuration',
    );
    node(
      p,
      'nodes',
      '32 B300 nodes',
      '256 GPUs · 4,096 CPU cores',
      0,
      'Each node: 8 B300 GPUs, 2 AMD EPYC 9555 CPUs, a mirrored boot pair and 8 local 3.84 TB NVMe drives. Select any node in the Physical view to inspect its components.',
    );
    if (fabric === 'compute') {
      node(
        p,
        'roce',
        'RoCE v2 interconnect',
        '6.4 Tb/s aggregate / node',
        1,
        'Ethernet RDMA is supplied. NIC model/count, per-port speed, switch inventory, rails, optics and cable schedule are unknown. 32 × 6.4 = 204.8 Tb/s summed endpoint rates, not fabric bisection bandwidth or achieved throughput.',
      );
      edge(p, 'nodes', 'roce', '6.4 Tb/s per node', {
        kind: 'capability',
        protocol: 'Ethernet / RoCE v2',
        detail:
          'Aggregate capability only; no physical port count or cable rate is inferred.',
      });
    } else if (fabric === 'storage') {
      node(
        p,
        'weka',
        'WEKA shared storage',
        '150 TB · cluster total',
        1,
        '150 TB is user supplied; raw versus usable capacity and data protection are unconfirmed. Backend server count, CPU/RAM, NVMe population and network interfaces are not supplied. Dedicated and converged WEKA deployments are both possible. The nodes contain 983.04 TB of raw local data NVMe in total; whether any of it backs WEKA is unknown, so these capacities are not added together.',
      );
      edge(p, 'nodes', 'weka', 'Shared storage service', {
        kind: 'relationship',
        protocol: 'Storage transport not supplied',
        detail:
          'Logical service association. Storage bandwidth and physical network separation from RoCE compute traffic are unconfirmed.',
      });
    }
    p.limitations.push(
      'Supplied configuration, not an independently observed installation. No switch bill of materials, numbered ports or external cables are asserted.',
    );
    return p;
  };
  return {
    compute: make('compute'),
    storage: make('storage'),
    frontend: make('frontend'),
  };
}
export function referenceFabricsFor(
  model: ClusterModel,
): FabricReferences | undefined {
  if (model.custom || !model.hardware.length) return;
  const id = model.id;
  if (id === 'washington-b300') return washington(model);
  if (id === 'h100-cluster' || id === 'dgx-h100' || id === 'dgx-h200') {
    const result = nvidia(model, 'h100');
    if (id === 'dgx-h200')
      for (const p of Object.values(result)) {
        p.title = p.title.replace('H100', 'H100 / H200');
        p.limitations.push(
          'Uses the H100 SuperPOD topology with the shared H100/H200 interface guide; no separate H200 cable schedule is asserted.',
        );
      }
    return result;
  }
  if (id === 'dgx-b200') return nvidia(model, 'b200');
  if (id === 'dgx-b300') return nvidia(model, 'b300');
  if (id === 'gb200-nvl72') return nvidia(model, 'gb200');
  if (id === 'gb300-nvl72') return nvidia(model, 'gb300');
  if (id === 'dell-xe9780') return enterprise(model, 'dell');
  if (id === 'lenovo-sr680a-v4') return enterprise(model, 'lenovo');
  if (id === 'sm-mi350x' || id === 'sm-mi355x') return supermicro(model);
  return interfaces(model);
}
export function withReferenceFabrics(model: ClusterModel): ClusterModel {
  if (model.custom || model.fabricReferences) return model;
  // Attach documentation without erasing the rack layout's authored connections.
  return { ...model, fabricReferences: referenceFabricsFor(model) };
}

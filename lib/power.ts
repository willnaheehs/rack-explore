import { profileFor, type Reference } from './catalog.ts';
import {
  childrenOf,
  type ClusterModel,
  type Hardware,
  type HardwareKind,
} from './hardware.ts';
export type PowerScope = 'facility' | 'rack' | 'board';
export type PowerScenario =
  | 'normal'
  | 'battery'
  | 'generator'
  | 'feed-a-loss'
  | 'feed-b-loss'
  | 'both-feeds-loss';
export type PowerSettings = {
  presentation: 'physical' | 'schematic';
  rackId: string;
  hardwareId: string;
  scope: PowerScope;
  stageId: string;
  scenario: PowerScenario;
  loadPercent: number;
  lineVoltage: 208 | 400 | 415;
  feedAmps: number;
  upsEfficiency: number;
  psuEfficiency: number;
  batteryKWh: number;
  deviceBudgetKW: number | null;
};
export type PowerNode = {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  x: number;
  y: number;
  feed: 'a' | 'b' | 'dc' | 'shared';
  active: boolean;
  description: string;
  facts: { label: string; value: string; note?: string }[];
  sources: Reference[];
  hardwareId?: string;
  nextScope?: PowerScope;
  kw?: number;
};
export type PowerEdge = {
  from: string;
  to: string;
  feed: PowerNode['feed'];
  active: boolean;
  label?: string;
};
export const POWER_SOURCES = {
  distribution: {
    title: 'Eaton · Power distribution fundamentals',
    url: 'https://www.eaton.com/explore/c/rack-pdu-handbook-01?x=hd8v5p',
  },
  ups: {
    title: 'Eaton · Double-conversion UPS and generators',
    url: 'https://www.eaton.com/content/dam/eaton/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/eaton-ups-fundamentals-handbook-en-us-2025.pdf',
  },
  ats: {
    title: 'Eaton · Automatic transfer switches',
    url: 'https://www.eaton.com/us/en-us/catalog/low-voltage-power-distribution-controls-systems/contactor-type-automatic-transfer-switch.html',
  },
  board: {
    title: 'Texas Instruments · Data center power stages',
    url: 'https://www.ti.com/applications/data-center/compute/overview.html',
  },
  vrm: {
    title: 'Texas Instruments · Multiphase core power',
    url: 'https://www.ti.com/product-category/power-management/multiphase.html',
  },
  nvl: {
    title: 'NVIDIA · NVL72 power shelves and DC busbar',
    url: 'https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html',
  },
  h100: {
    title: 'NVIDIA · H100/H200 power and redundancy',
    url: 'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html',
  },
  b200: {
    title: 'NVIDIA · B200 power and failure behavior',
    url: 'https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html',
  },
  b300: {
    title: 'NVIDIA · B300 AC and DC power variants',
    url: 'https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html',
  },
};
export const SCENARIOS: {
  value: PowerScenario;
  label: string;
  description: string;
}[] = [
  {
    value: 'normal',
    label: 'Utility · normal',
    description:
      'Utility supplies both UPS paths. The rack load is shared equally between A and B.',
  },
  {
    value: 'battery',
    label: 'Utility lost · on battery',
    description:
      'Utility input is absent and the generator is not yet ready. Batteries feed the UPS DC links; the inverters maintain AC output.',
  },
  {
    value: 'generator',
    label: 'Generator online',
    description:
      'The generator has stabilized and the transfer switch selects it. UPS rectifiers supply their inverters again; batteries are held in reserve.',
  },
  {
    value: 'feed-a-loss',
    label: 'Feed A lost',
    description:
      'The downstream A path is unavailable. B must carry the entire requested rack load. Device PSU redundancy may impose a lower performance limit.',
  },
  {
    value: 'feed-b-loss',
    label: 'Feed B lost',
    description:
      'The downstream B path is unavailable. A must carry the entire requested rack load. Device PSU redundancy may impose a lower performance limit.',
  },
  {
    value: 'both-feeds-loss',
    label: 'Both rack feeds lost',
    description:
      'Both downstream rack feeds are unavailable. The rack is de-energized even though upstream utility and UPS sources may remain available.',
  },
];
export function powerDevices(model: ClusterModel, rackId: string) {
  return model.hardware.filter(
    (h) => h.rack === rackId && profileFor(h).category !== 'infrastructure',
  );
}
export function initialPowerSettings(
  model: ClusterModel,
  rackId?: string,
  hardwareId?: string,
): PowerSettings {
  const rack = model.racks.find((r) => r.id === rackId) ?? model.racks[0];
  const devices = powerDevices(model, rack.id);
  const h =
    devices.find((h) => h.id === hardwareId) ??
    devices.find((h) => profileFor(h).category === 'compute') ??
    devices[0];
  return {
    rackId: rack.id,
    hardwareId: h?.id ?? '',
    presentation: 'physical',
    scope: 'rack',
    stageId: 'device',
    scenario: 'normal',
    loadPercent: 65,
    lineVoltage: 415,
    feedAmps: rack.mount === 'NVL72' ? 200 : 63,
    upsEfficiency: 96,
    psuEfficiency: 95,
    batteryKWh: 10,
    deviceBudgetKW: null,
  };
}
export function devicePowerBudget(
  model: ClusterModel,
  h: Hardware,
): { kw: number; basis: string; documented: boolean } {
  const id = profileFor(h).id;
  const max: Record<string, number> = {
    'dgx-h100': 10.2,
    'dgx-h200': 10.2,
    'dgx-b200': 14.3,
    'dgx-b300': 14.5,
  };
  if (max[id])
    return {
      kw: max[id],
      basis:
        id === 'dgx-b300'
          ? '14.5 kW consumption in the physical specification; the power table separately lists 15 kW maximum.'
          : 'Manufacturer maximum AC system input.',
      documented: true,
    };
  if (profileFor(h).category === 'infrastructure')
    return {
      kw: 0,
      basis: 'Power conversion equipment; not counted again as an IT load.',
      documented: true,
    };
  const rack = model.racks.find((r) => r.id === h.rack);
  if (rack?.mount === 'NVL72') {
    const peers = powerDevices(model, h.rack);
    const weight = (item: Hardware) =>
      profileFor(item).category === 'compute'
        ? 6
        : profileFor(item).id === 'sn2201'
          ? 0.15
          : 0.8;
    const total = model.id === 'gb200-nvl72' ? 120 : 142;
    return {
      kw: (total * weight(h)) / peers.reduce((n, h) => n + weight(h), 0),
      basis: `Illustrative allocation of a ${total} kW rack budget. ${model.id === 'gb200-nvl72' ? 'GB200 rack guide gives approximately 120 kW.' : '142 kW is a planning scenario, not a validated GB300 capacity limit.'} Tray shares are not vendor measurements.`,
      documented: false,
    };
  }
  const examples: Record<string, number> = {
    'dell-xe9780': 14.5,
    'hpe-xd685': 15,
    'lenovo-sr680a-v4': 14.5,
    'sm-mi350x': 12,
    'sm-mi355x': 15,
    'sm-b300': 15,
    ai400x2: 2,
    qm9700: 0.85,
    sn4600c: 0.5,
    sn5600: 1.5,
    q3400: 3.5,
  };
  return {
    kw: examples[id] ?? 1,
    basis:
      'Editable planning allowance. No chassis input-power measurement or validated maximum is recorded for this configuration.',
    documented: false,
  };
}
export const watts = (kw: number) =>
  Math.abs(kw) >= 1 ? `${kw.toFixed(2)} kW` : `${Math.round(kw * 1000)} W`;
export function threePhaseAmps(kw: number, volts: number, pf = 0.99) {
  return (kw * 1000) / (Math.sqrt(3) * volts * pf);
}
export function powerAllocation(h: Hardware, dcKW: number) {
  const keys: {
    key: string;
    label: string;
    kinds: HardwareKind[];
    weight: number;
    voltage: string;
  }[] = [
    {
      key: 'gpu',
      label: 'GPU modules',
      kinds: ['gpu'],
      weight: 62,
      voltage: 'Core rail example: 0.8 V',
    },
    {
      key: 'cpu',
      label: 'Host processors',
      kinds: ['cpu'],
      weight: 10,
      voltage: 'Dynamic low-voltage core rails',
    },
    {
      key: 'memory',
      label: 'System memory',
      kinds: ['memory'],
      weight: 7,
      voltage: 'Technology-specific memory rails',
    },
    {
      key: 'network',
      label: 'Fabric & adapters',
      kinds: ['nic', 'nvlink', 'asic', 'port'],
      weight: 8,
      voltage: 'ASIC core and transceiver rails',
    },
    {
      key: 'storage',
      label: 'Storage & controllers',
      kinds: ['nvme', 'controller'],
      weight: 5,
      voltage: 'Drive input and local regulated rails',
    },
    {
      key: 'aux',
      label: 'Fans & board services',
      kinds: ['fan', 'board', 'backplane'],
      weight: 8,
      voltage: 'Auxiliary and standby rails',
    },
  ];
  const children = childrenOf(h);
  const groups = keys
    .map((g) => ({
      ...g,
      items: children.filter((c) => g.kinds.includes(c.kind)),
    }))
    .filter((g) => g.items.length);
  const denominator = groups.reduce((n, g) => n + g.weight, 0) || 1;
  return groups.map((g) => ({ ...g, kw: (dcKW * g.weight) / denominator }));
}
export function calculatePower(model: ClusterModel, s: PowerSettings) {
  const devices = powerDevices(model, s.rackId),
    h = devices.find((h) => h.id === s.hardwareId) ?? devices[0];
  const rack = model.racks.find((r) => r.id === s.rackId) ?? model.racks[0];
  const budgets = devices.map((device) => {
    const base = devicePowerBudget(model, device);
    const override = device.id === h?.id && s.deviceBudgetKW !== null;
    return {
      hardware: device,
      ...base,
      kw: override ? s.deviceBudgetKW! : base.kw,
      documented: override ? false : base.documented,
      basis: override ? 'User-supplied device AC input allowance.' : base.basis,
      override,
    };
  });
  const rackBaseKW = budgets.reduce((n, p) => n + p.kw, 0),
    requestedKW = (rackBaseKW * s.loadPercent) / 100;
  const batteryEmpty = s.scenario === 'battery' && s.batteryKWh === 0;
  const a =
      s.scenario !== 'feed-a-loss' &&
      s.scenario !== 'both-feeds-loss' &&
      !batteryEmpty,
    b =
      s.scenario !== 'feed-b-loss' &&
      s.scenario !== 'both-feeds-loss' &&
      !batteryEmpty,
    on = a || b;
  const acKW = on ? requestedKW : 0,
    deviceAC = on
      ? ((budgets.find((p) => p.hardware.id === h?.id)?.kw ?? 0) *
          s.loadPercent) /
        100
      : 0;
  const aKW = a ? acKW / (b ? 2 : 1) : 0,
    bKW = b ? acKW / (a ? 2 : 1) : 0;
  const distributionInputKW = acKW / 0.99,
    upsInputKW = distributionInputKW / (s.upsEfficiency / 100),
    sourceKW =
      s.scenario === 'generator' || s.scenario === 'battery'
        ? upsInputKW
        : upsInputKW / 0.985;
  const dcKW = (acKW * s.psuEfficiency) / 100,
    deviceDC = (deviceAC * s.psuEfficiency) / 100;
  const endpointsKW = deviceDC * 0.9,
    boardLossKW = deviceDC - endpointsKW;
  const feedCapacityKW =
    (Math.sqrt(3) * s.lineVoltage * s.feedAmps * 0.99) / 1000;
  const losses = {
    transformer:
      s.scenario === 'generator' || s.scenario === 'battery'
        ? 0
        : sourceKW - upsInputKW,
    ups: upsInputKW - distributionInputKW,
    distribution: distributionInputKW - acKW,
    psu: acKW - dcKW,
  };
  const pr = h ? profileFor(h) : null,
    psu = pr?.parts.find((p) => p.kind === 'psu');
  const count = psu?.schematic ? null : (psu?.count ?? null);
  const surviving =
    count === null ? null : on ? (a && b ? count : Math.ceil(count / 2)) : 0;
  const redundancy =
    psu?.specs.find((x) => x.label === 'Redundancy')?.value ??
    'Configuration not specified';
  const nvl = rack.mount === 'NVL72';
  let resilience = on
    ? 'Both paths available. A/B allocation is illustrative.'
    : batteryEmpty
      ? 'No battery energy is available to sustain UPS output. The requested rack load cannot be supplied.'
      : 'Both rack feeds are lost. No rack load is delivered.';
  let caution = false;
  if (on && (!a || !b)) {
    if (pr?.id === 'dgx-h100' || pr?.id === 'dgx-h200') {
      resilience =
        '3 of 6 PSUs remain with the illustrated 3+3 cord split. NVIDIA documents reduced performance after three PSU inputs are lost. 4+2 PSU redundancy is not the same as full A/B redundancy.';
      caution = true;
    } else if (pr?.id === 'dgx-b200') {
      resilience =
        '3 of 6 PSUs remain. NVIDIA documents an 800 W maximum GPU power setting with three AC cables removed; performance is reduced. This is not a full-load 2N feed design.';
      caution = true;
    } else if (pr?.id === 'dgx-b300') {
      resilience =
        '6 of 12 PSUs remain with the illustrated 6+6 split. NVIDIA specifies N+N redundancy; the surviving feed and upstream equipment must still support the complete load.';
    } else if (nvl) {
      resilience =
        'The example splits 8 shelves into 4 on A and 4 on B. The rack guide specifies redundant shelves. Total PSU nameplate capacity alone does not verify the real whip mapping, power brakes, or feed capacity.';
    } else {
      resilience = `Only one feed remains. ${surviving === null ? 'PSU population is not recorded.' : `${surviving} of ${count} PSUs remain in the example split.`} OEM failure behavior and circuit mapping need verification.`;
      caution = true;
    }
  }
  return {
    rack,
    h,
    devices,
    budgets,
    rackBaseKW,
    requestedKW,
    acKW,
    deviceAC,
    a,
    b,
    on,
    aKW,
    bKW,
    dcKW,
    deviceDC,
    endpointsKW,
    boardLossKW,
    sourceKW,
    distributionInputKW,
    upsInputKW,
    losses,
    aAmps: threePhaseAmps(aKW, s.lineVoltage),
    bAmps: threePhaseAmps(bKW, s.lineVoltage),
    feedCapacityKW,
    overloaded: aKW > feedCapacityKW || bKW > feedCapacityKW,
    batteryMinutes:
      requestedKW > 0
        ? ((s.batteryKWh *
            (batteryEmpty ? 1 : ((a ? 1 : 0) + (b ? 1 : 0)) / 2)) /
            (requestedKW / 0.99 / (s.upsEfficiency / 100))) *
          60
        : null,
    allocation: h ? powerAllocation(h, endpointsKW) : [],
    count,
    surviving,
    redundancy,
    resilience,
    caution,
    nvl,
  };
}
export function powerGraph(
  model: ClusterModel,
  s: PowerSettings,
): {
  nodes: PowerNode[];
  edges: PowerEdge[];
  width: number;
  height: number;
  title: string;
  description: string;
} {
  const c = calculatePower(model, s),
    nodes: PowerNode[] = [],
    edges: PowerEdge[] = [];
  const h = c.h,
    pr = h ? profileFor(h) : null;
  const ac =
    s.lineVoltage === 208
      ? '208 V L–L'
      : `${s.lineVoltage} / ${Math.round(s.lineVoltage / Math.sqrt(3))} V`;
  const volts =
    s.lineVoltage === 208
      ? '208 V line-to-line; 120 V line-to-neutral is not used for these DGX inputs.'
      : `${s.lineVoltage} V phase-to-phase and ${Math.round(s.lineVoltage / Math.sqrt(3))} V phase-to-neutral. Server outlets use phase-to-neutral in this example.`;
  const put = (
    id: string,
    title: string,
    subtitle: string,
    kind: string,
    x: number,
    y: number,
    feed: PowerNode['feed'],
    active: boolean,
    description: string,
    facts: PowerNode['facts'] = [],
    sources: Reference[] = [POWER_SOURCES.distribution],
    extra: Partial<PowerNode> = {},
  ) =>
    nodes.push({
      id,
      title,
      subtitle,
      kind,
      x,
      y,
      feed,
      active,
      description,
      facts,
      sources,
      ...extra,
    });
  const link = (
    from: string,
    to: string,
    feed: PowerNode['feed'],
    active = true,
    label?: string,
  ) => edges.push({ from, to, feed, active, label });
  const fact = (label: string, value: string, note?: string) => ({
    label,
    value,
    note,
  });
  if (s.scope === 'facility') {
    const utility = !['battery', 'generator'].includes(s.scenario),
      gen = s.scenario === 'generator',
      battery = s.scenario === 'battery';
    put(
      'utility',
      'Utility grid',
      'Generation → transmission → local grid',
      'utility',
      40,
      105,
      'shared',
      utility,
      'Generators and other grid-connected sources supply the transmission network. A utility substation steps voltage down for local distribution. This diagram begins at the site’s example 13.8 kV service, not at a specific power plant.',
      [
        fact('Example site service', '13.8 kV AC · three phase'),
        fact(
          'Power allocated to this rack',
          utility ? watts(c.sourceKW) : '0 W',
        ),
        fact('Boundary', 'Other racks, cooling and site loads are excluded'),
      ],
    );
    put(
      'transformer',
      'Site transformer',
      `13.8 kV → ${s.lineVoltage} V AC`,
      'transformer',
      280,
      105,
      'shared',
      utility,
      'A transformer changes the AC voltage through magnetic coupling. It does not convert AC to DC. The low-voltage switchboard feeds the protected IT power train.',
      [
        fact('Example secondary', volts),
        fact('Assumed efficiency', '98.5%'),
        fact('Attributable loss', watts(c.losses.transformer)),
      ],
    );
    put(
      'generator',
      'Backup generator',
      gen ? 'Stable · carrying load' : 'Standby / starting',
      'generator',
      280,
      405,
      'shared',
      gen,
      'An engine-driven generator supplies AC during a utility outage. It needs time to start and stabilize; UPS batteries bridge that interval. The example generator connects at the low-voltage level.',
      [
        fact(
          'State',
          gen
            ? 'Online'
            : battery
              ? 'Starting; not supplying AC yet'
              : 'Standby',
        ),
        fact('Generator input path', `${s.lineVoltage} V AC · example`),
        fact('Excluded', 'Fuel consumption, start time and recharge load'),
      ],
      [POWER_SOURCES.ats, POWER_SOURCES.ups],
    );
    put(
      'ats',
      'Transfer & switchgear',
      gen ? 'Generator selected' : battery ? 'No AC input' : 'Utility selected',
      'ats',
      525,
      245,
      'shared',
      utility || gen,
      'Interlocked transfer gear selects utility or generator. The shared source and transfer stage are common points in this example: two downstream paths do not make the complete facility 2N.',
      [
        fact(
          'Input selected',
          gen ? 'Generator' : utility ? 'Utility' : 'Neither; UPS on battery',
        ),
        fact(
          'Isolation',
          'Utility and generator are not paralleled in this model',
        ),
      ],
      [POWER_SOURCES.ats],
    );
    for (const [feed, y, active] of [
      ['a', 105, c.a],
      ['b', 405, c.b],
    ] as const) {
      const letter = feed.toUpperCase();
      put(
        `ups-${feed}`,
        `UPS ${letter}`,
        battery ? 'Battery → inverter → AC' : 'Rectifier → DC link → inverter',
        'ups',
        770,
        y,
        feed,
        active,
        'An online double-conversion UPS rectifies AC to a DC link and inverts DC back to conditioned AC. The battery connects to that DC link. In battery mode the inverter continues supplying the protected path.',
        [
          fact(
            'Mode',
            battery ? 'Battery discharge' : 'Online double conversion',
          ),
          fact('Assumed conversion efficiency', `${s.upsEfficiency}%`),
          fact(
            'Example stored energy',
            `${s.batteryKWh} kWh total usable DC energy across both UPS paths`,
          ),
          fact(
            'Battery runtime estimate',
            c.batteryMinutes === null
              ? 'No load'
              : `${c.batteryMinutes.toFixed(1)} min if battery-backed at this load`,
            'Constant load; excludes aging, temperature, recharge, other racks and reserve requirements',
          ),
        ],
        [POWER_SOURCES.ups],
      );
      put(
        `distribution-${feed}`,
        `Distribution ${letter}`,
        'LV board → busway / RPP',
        'distribution',
        1015,
        y,
        feed,
        active,
        'Protected low-voltage distribution routes power through branch protection, busway tap-offs or remote power panels, and whips toward the rack. A rack PDU typically distributes voltage; it does not inherently step it down.',
        [
          fact('Output', ac),
          fact('Path', `Dedicated ${letter} distribution`),
          fact(
            'Assumed wiring efficiency',
            '99% across the rack distribution segment',
          ),
        ],
      );
      link('ats', `ups-${feed}`, feed, (utility || gen) && active);
      link(`ups-${feed}`, `distribution-${feed}`, feed, active);
      link(`distribution-${feed}`, 'rack', feed, active);
    }
    put(
      'battery-a',
      'Battery A',
      battery ? 'Discharging into UPS DC link' : 'Charged / reserve',
      'battery',
      770,
      250,
      'a',
      battery && c.a,
      'Electrochemical storage supplies DC. Its energy in kWh determines how long it can support a given kW load. It is not an AC source until the UPS inverter converts the DC.',
      [
        fact(
          'Energy allocation',
          `${(s.batteryKWh / 2).toFixed(1)} kWh per path in this symmetric example`,
        ),
      ],
      [POWER_SOURCES.ups],
    );
    put(
      'battery-b',
      'Battery B',
      battery ? 'Discharging into UPS DC link' : 'Charged / reserve',
      'battery',
      1015,
      555,
      'b',
      battery && c.b,
      'The B-path battery feeds the B UPS DC link. A path may remain energized while its upstream AC source is absent.',
      [
        fact(
          'Energy allocation',
          `${(s.batteryKWh / 2).toFixed(1)} kWh per path in this symmetric example`,
        ),
      ],
      [POWER_SOURCES.ups],
    );
    put(
      'rack',
      `Rack ${c.rack.id}`,
      c.nvl ? 'AC whips → power shelves' : 'A / B rack PDUs',
      'rack',
      1260,
      245,
      'dc',
      c.on,
      'Follow both protected paths into this selected rack. The next view shows how the feeds reach server power supplies or rack-scale power shelves.',
      [
        fact('Requested IT input', watts(c.requestedKW)),
        fact('Scenario input', watts(c.acKW)),
        fact('Devices', String(c.devices.length)),
        fact('Scope', 'Only this rack’s attributable power is shown'),
      ],
      [],
      { nextScope: 'rack', kw: c.acKW },
    );
    link('utility', 'transformer', 'shared', utility);
    link('transformer', 'ats', 'shared', utility);
    link('generator', 'ats', 'shared', gen);
    link('battery-a', 'ups-a', 'a', battery && c.a);
    link('battery-b', 'ups-b', 'b', battery && c.b);
    return {
      nodes,
      edges,
      width: 1500,
      height: 700,
      title: 'From the grid to the rack.',
      description:
        'Follow the energized path. Select a stage to inspect what it changes, protects, or stores.',
    };
  }
  if (s.scope === 'rack') {
    for (const [feed, y, active, kw, amps] of [
      ['a', 110, c.a, c.aKW, c.aAmps],
      ['b', 455, c.b, c.bKW, c.bAmps],
    ] as const) {
      const letter = feed.toUpperCase();
      put(
        `feed-${feed}`,
        `Protected feed ${letter}`,
        `${ac} · three phase`,
        'distribution',
        45,
        y,
        feed,
        active,
        'A protected branch from the upstream UPS distribution. Multiple physical whips can contribute to this aggregate path; the diagram does not specify circuit quantities or conductor sizes.',
        [
          fact('Requested path load', watts(kw)),
          fact('Balanced line current', `${amps.toFixed(1)} A per phase`),
          fact('Usable path current assumption', `${s.feedAmps} A per phase`),
          fact('Formula', 'I = P / (√3 × VLL × power factor)'),
          fact('Power factor assumption', '0.99'),
        ],
      );
      put(
        `pdu-${feed}`,
        c.nvl ? `RPP / whips ${letter}` : `Rack PDU ${letter}`,
        c.nvl
          ? 'Dedicated AC feeds to shelves'
          : 'Branch protection · metering · outlets',
        'pdu',
        300,
        y,
        feed,
        active,
        c.nvl
          ? 'Whips feed the rack’s AC-to-DC shelves. The rack guide describes a remote power panel upstream of those shelves.'
          : 'Rack PDUs distribute AC to the chassis cords. Metering observes load, while branch and upstream protective devices limit fault exposure. There is no battery or AC-to-DC conversion in an ordinary rack PDU.',
        [
          fact('Output', volts),
          fact('Feed headroom', watts(c.feedCapacityKW - kw)),
          fact(
            'Outlet phase assignment',
            'Balanced aggregate model; individual L1/L2/L3 circuits are not specified',
          ),
        ],
      );
      put(
        `converter-${feed}`,
        c.nvl ? `Power shelves ${letter}` : `Chassis PSU groups ${letter}`,
        c.nvl
          ? '4 shelves × 6 supplies · example split'
          : c.count
            ? `${c.devices.length} chassis · selected device: ${Math.ceil(c.count / 2)}/${c.count} cords`
            : 'Example redundant PSU group',
        'psu',
        555,
        y,
        feed,
        active,
        c.nvl
          ? 'The published NVL72 design has eight shelves, each with six 5.5 kW modules. This illustration places four shelves on each feed; real installations must follow the vendor whip map. The shelves convert AC into rack DC.'
          : 'Each chassis PSU rectifies AC, performs power-factor correction and isolated conversion, and provides regulated DC. This example divides the chassis cords evenly across A and B.',
        [
          fact(
            'Architecture',
            c.nvl
              ? '8 × 6 × 5.5 kW nameplate total; not IT load'
              : c.redundancy,
          ),
          fact('Assumed conversion efficiency', `${s.psuEfficiency}%`),
          fact('Failure behavior', c.resilience),
        ],
        c.nvl ? [POWER_SOURCES.nvl] : (pr?.sources ?? [POWER_SOURCES.board]),
      );
      link(`feed-${feed}`, `pdu-${feed}`, feed, active);
      link(`pdu-${feed}`, `converter-${feed}`, feed, active);
      link(`converter-${feed}`, 'dc-bus', feed, active);
    }
    put(
      'dc-bus',
      c.nvl ? 'Rack DC busbar' : 'Chassis DC distribution',
      c.nvl ? 'Nominal 50–51 V DC' : 'ORing / sharing → internal DC rails',
      'busbar',
      810,
      275,
      'dc',
      c.on,
      c.nvl
        ? 'Conductive busbars carry regulated DC from the power shelves to compute and NVLink trays. Blind-mate connections replace individual AC PSUs in those trays. Management switches can have a separate AC path.'
        : 'Redundant PSU outputs feed protected DC distribution inside each chassis. ORing or equivalent isolation prevents a failed supply from pulling down the shared rail. Separate servers do not share this DC bus in the standard rack model.',
      [
        fact(
          c.nvl ? 'Busbar DC allocation' : 'Rack DC after conversion',
          watts(
            c.nvl
              ? ((((c.budgets
                  .filter((b) => profileFor(b.hardware).id !== 'sn2201')
                  .reduce((n, b) => n + b.kw, 0) *
                  s.loadPercent) /
                  100) *
                  s.psuEfficiency) /
                  100) *
                  (c.on ? 1 : 0)
              : c.dcKW,
          ),
          'Illustrative shared efficiency, not a measured bus reading',
        ),
        fact(
          'Architecture boundary',
          c.nvl
            ? 'Rack-level busbar; management AC is a separate auxiliary path'
            : 'One independent internal DC system per chassis',
        ),
        fact(
          'DC voltage',
          c.nvl
            ? '50–51 V nominal in the DGX rack guide'
            : 'OEM-specific; board view uses a labeled 12 V example',
        ),
      ],
      c.nvl ? [POWER_SOURCES.nvl] : [POWER_SOURCES.board],
    );
    put(
      'device',
      h?.name ?? 'No device',
      h?.model ?? 'Add hardware in the rack builder',
      'server',
      1065,
      275,
      'dc',
      c.on && !!h,
      'Continue through the selected device’s DC conversion stages to its GPU, CPU, memory, storage and network loads. Select a different device above to trace its power path.',
      [
        fact('Device AC-equivalent allocation', watts(c.deviceAC)),
        fact('Device DC allocation', watts(c.deviceDC)),
        fact(
          'Budget basis',
          c.budgets.find((b) => b.hardware.id === h?.id)?.basis ??
            'No hardware',
        ),
      ],
      pr?.sources ?? [],
      { nextScope: 'board', hardwareId: h?.id, kw: c.deviceAC },
    );
    if (c.nvl && pr?.id === 'sn2201') {
      link('pdu-a', 'device', 'a', c.a);
      link('pdu-b', 'device', 'b', c.b);
    } else link('dc-bus', 'device', 'dc', c.on);
    return {
      nodes,
      edges,
      width: 1310,
      height: 650,
      title: c.nvl
        ? 'AC shelves. A shared DC backbone.'
        : 'Two feeds. One protected load.',
      description: c.nvl
        ? 'Rack-scale systems move AC-to-DC conversion out of the compute tray.'
        : 'A and B remain separate AC paths. Their supplies converge on protected DC distribution inside each device.',
    };
  }
  if (!h)
    return {
      nodes,
      edges,
      width: 1000,
      height: 600,
      title: 'Add hardware to trace its power.',
      description:
        'This rack has no devices. Open the custom builder to populate it.',
    };
  const busInput = c.nvl && pr?.id !== 'sn2201';
  put(
    'board-input',
    busInput ? 'Tray DC input' : 'Chassis AC input',
    busInput
      ? '50–51 V DC · rack busbar'
      : `${s.lineVoltage === 208 ? 208 : Math.round(s.lineVoltage / Math.sqrt(3))} V AC · per PSU cord`,
    'connector',
    45,
    260,
    'shared',
    c.on,
    busInput
      ? 'The tray receives DC from the rack busbar. There is no second AC-to-DC PSU stage inside this tray.'
      : 'Separate A/B power cords reach the chassis. The PSU group converts their AC input into an internal DC distribution rail.',
    [
      fact('Input allocation', watts(busInput ? c.deviceDC : c.deviceAC)),
      fact('Domain', busInput ? 'DC' : 'AC'),
    ],
    busInput ? [POWER_SOURCES.nvl] : (pr?.sources ?? []),
  );
  put(
    'conversion',
    busInput ? 'Intermediate converter' : 'PSU conversion',
    busInput ? '50–51 V → intermediate rail' : 'AC → PFC / isolation → DC',
    'psu',
    290,
    260,
    'dc',
    c.on,
    busInput
      ? 'An intermediate DC-to-DC stage can step the rack bus down before point-of-load regulation. A 12 V intermediate rail is illustrated; the actual OEM rail topology is not published here.'
      : 'The PSU rectifies and conditions AC, isolates the output and regulates DC. The illustrated 12 V bulk rail explains a common architecture; it is not asserted as the exact internal rail of every OEM chassis.',
    [
      fact('Illustrated intermediate rail', '12 V DC · architecture example'),
      fact(
        'AC-to-DC efficiency assumption',
        `${s.psuEfficiency}%`,
        busInput
          ? 'Applied once at the upstream rack shelves, not again here'
          : 'Used to estimate conversion loss',
      ),
      fact('Device DC budget', watts(c.deviceDC)),
    ],
    [POWER_SOURCES.board, ...(pr?.sources ?? [])],
  );
  put(
    'protection',
    'Distribution & protection',
    'ORing · hot-swap / eFuse · copper planes',
    'board',
    535,
    260,
    'dc',
    c.on,
    'Protection and current-sharing circuits manage how DC reaches each board section. Power planes and conductors distribute current to local converters. Fast load changes are supported by local capacitors as well as the regulators.',
    [
      fact('Functions', 'Fault isolation, inrush control, distribution'),
      fact('Power path', 'Bulk DC → branch rails'),
      fact(
        'Signal path',
        'Power wiring is separate from NVLink, PCIe and network data links',
      ),
    ],
    [POWER_SOURCES.board],
  );
  put(
    'vrm',
    'Point-of-load regulators',
    'Multiphase buck stages · local rails',
    'vrm',
    780,
    260,
    'dc',
    c.on,
    'Local voltage regulators step down the bulk supply to the much lower voltages required by processor cores, memory and other devices. Multiphase designs share very high current between switching stages. Voltage is dynamically controlled and differs between rails.',
    [
      fact(
        'Combined board conversion assumption',
        '90% efficiency across intermediate / point-of-load stages',
      ),
      fact('Device regulation loss', watts(c.boardLossKW)),
      fact(
        'Example GPU core rail',
        '0.8 V · illustrative, not a measured or settable device voltage',
      ),
      fact(
        'Why high current?',
        'I = P / V. 700 W at 0.8 V would be 875 A on that one idealized core rail.',
      ),
      fact(
        'Important distinction',
        'GPU module power includes HBM and other rails; module watts are not all core watts.',
      ),
    ],
    [POWER_SOURCES.vrm, POWER_SOURCES.board],
  );
  link('board-input', 'conversion', busInput ? 'dc' : 'shared', c.on);
  link('conversion', 'protection', 'dc', c.on);
  link('protection', 'vrm', 'dc', c.on);
  c.allocation.forEach((g, i) => {
    const id = `load-${g.key}`;
    put(
      id,
      g.label,
      `${g.items.length} modeled modules · ${watts(g.kw)}`,
      g.key,
      1040,
      35 + i * 103,
      'dc',
      c.on,
      'These endpoints consume regulated power and ultimately release almost all of it as heat. This is a normalized explanatory allocation of the device budget, not an OEM per-component measurement.',
      [
        fact('Illustrative group power', watts(g.kw)),
        fact(
          'Allocation',
          `${g.weight} relative weight; normalized across present groups`,
        ),
        fact('Voltage', g.voltage),
        fact(
          'Modules',
          g.items
            .map((h) => h.name)
            .slice(0, 8)
            .join(', ') + (g.items.length > 8 ? '…' : ''),
        ),
        fact(
          'Measurement boundary',
          'Do not treat this group split as component TDP or live telemetry',
        ),
      ],
      pr?.sources ?? [POWER_SOURCES.board],
      { hardwareId: g.items[0]?.id, kw: g.kw },
    );
    link('vrm', id, 'dc', c.on);
  });
  return {
    nodes,
    edges,
    width: 1310,
    height: 710,
    title: 'From the inlet to the silicon.',
    description:
      'Trace conversion and regulation, then inspect a load group or jump to its physical hardware.',
  };
}
export function traceAncestors(
  nodes: PowerNode[],
  edges: PowerEdge[],
  id: string,
): Set<string> {
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    edges.filter((e) => e.to === key).forEach((e) => visit(e.from));
  };
  if (nodes.some((n) => n.id === id)) visit(id);
  return seen;
}
export function validatePowerPatch(
  input: unknown,
  model: ClusterModel,
  current: PowerSettings,
): PowerSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected a power settings object.');
  const v = input as Record<string, unknown>;
  const allowed = [
    'presentation',
    'scenario',
    'loadPercent',
    'scope',
    'stageId',
    'rackId',
    'hardwareId',
  ];
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    throw new Error('Unknown power setting.');
  if (
    v.presentation !== undefined &&
    !['physical', 'schematic'].includes(v.presentation as string)
  )
    throw new Error('Presentation must be physical or schematic.');
  if (
    v.scenario !== undefined &&
    !SCENARIOS.some((s) => s.value === v.scenario)
  )
    throw new Error('Unknown power scenario.');
  if (
    v.loadPercent !== undefined &&
    (typeof v.loadPercent !== 'number' ||
      !Number.isFinite(v.loadPercent) ||
      v.loadPercent < 0 ||
      v.loadPercent > 100)
  )
    throw new Error('Load percent must be 0–100.');
  if (
    v.scope !== undefined &&
    (typeof v.scope !== 'string' ||
      !['facility', 'rack', 'board'].includes(v.scope))
  )
    throw new Error('Scope must be facility, rack, or board.');
  if (
    v.rackId !== undefined &&
    (typeof v.rackId !== 'string' ||
      !model.racks.some((r) => r.id === v.rackId))
  )
    throw new Error('Unknown rack.');
  let next = { ...current, ...v } as PowerSettings;
  if (v.rackId !== undefined && v.rackId !== current.rackId)
    next = {
      ...initialPowerSettings(model, v.rackId as string),
      ...v,
    } as PowerSettings;
  if (
    v.hardwareId !== undefined &&
    !powerDevices(model, next.rackId).some((h) => h.id === v.hardwareId)
  )
    throw new Error('Hardware must belong to the selected rack.');
  if (v.hardwareId !== undefined && v.hardwareId !== current.hardwareId)
    next.deviceBudgetKW = null;
  const stages = powerGraph(model, next).nodes;
  if (v.stageId !== undefined && !stages.some((n) => n.id === v.stageId))
    throw new Error('Unknown stage in the selected power scope.');
  if (!stages.some((n) => n.id === next.stageId))
    next.stageId = stages[0]?.id ?? '';
  return next;
}

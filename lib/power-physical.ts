import { profileFor } from './catalog.ts';
import { U_METERS, type ClusterModel } from './hardware.ts';
import {
  calculatePower,
  powerGraph,
  type PowerSettings,
  type PowerNode,
} from './power.ts';
export type Point3 = [number, number, number];
export type PowerForm =
  | 'cabinet'
  | 'transformer'
  | 'generator'
  | 'utility'
  | 'battery'
  | 'rack'
  | 'chassis'
  | 'pdu'
  | 'psu'
  | 'shelf'
  | 'busbar'
  | 'board'
  | 'gpu'
  | 'cpu'
  | 'memory'
  | 'storage'
  | 'network'
  | 'vrm'
  | 'connector'
  | 'aux';
export type PhysicalPowerPart = {
  id: string;
  stageId: string;
  form: PowerForm;
  position: Point3;
  size: Point3;
  count?: number;
  hardwareId?: string;
  muted?: boolean;
  label?: string;
};
export type PhysicalPowerRoute = {
  id: string;
  from: string;
  to: string;
  feed: PowerNode['feed'];
  points: Point3[];
};
export type PhysicalPowerLayout = {
  parts: PhysicalPowerPart[];
  routes: PhysicalPowerRoute[];
  target: Point3;
  span: number;
  title: string;
  note: string;
};
export function physicalPowerLayout(
  model: ClusterModel,
  s: PowerSettings,
): PhysicalPowerLayout {
  const c = calculatePower(model, s),
    g = powerGraph(model, s),
    parts: PhysicalPowerPart[] = [],
    routes: PhysicalPowerRoute[] = [];
  const put = (
    id: string,
    stageId: string,
    form: PowerForm,
    position: Point3,
    size: Point3,
    extra: Partial<PhysicalPowerPart> = {},
  ) => parts.push({ id, stageId, form, position, size, ...extra });
  const route = (
    from: string,
    to: string,
    feed: PowerNode['feed'],
    points: Point3[],
  ) =>
    routes.push({
      id: `${from}-${to}-${routes.length}`,
      from,
      to,
      feed,
      points,
    });
  if (s.scope === 'facility') {
    const positions: Record<string, Point3> = {
      utility: [-4.5, 0, -0.6],
      transformer: [-3, 0, -0.6],
      generator: [-3.1, 0, 1.8],
      ats: [-1.45, 0, 0.1],
      'ups-a': [0.2, 0, -1.1],
      'ups-b': [0.2, 0, 1.1],
      'battery-a': [-0.1, 0, -2.15],
      'battery-b': [-0.1, 0, 2.15],
      'distribution-a': [1.7, 0, -1.1],
      'distribution-b': [1.7, 0, 1.1],
      rack: [3.8, 0, 0],
    };
    for (const n of g.nodes) {
      const form: PowerForm =
        n.kind === 'ups' || n.kind === 'ats' || n.kind === 'distribution'
          ? 'cabinet'
          : (n.kind as PowerForm);
      const size: Point3 =
        n.id === 'rack'
          ? [0.7, 2.2, 1.1]
          : n.id === 'generator'
            ? [1.2, 0.75, 0.7]
            : n.id === 'utility'
              ? [0.6, 1.9, 0.45]
              : n.kind === 'battery'
                ? [0.65, 0.85, 0.55]
                : [0.64, n.id === 'transformer' ? 1.1 : 1.45, 0.65];
      put(n.id, n.id, form, positions[n.id], size, { label: n.title });
    }
    for (const e of g.edges) {
      const a = positions[e.from],
        b = positions[e.to];
      const battery = e.from.startsWith('battery');
      const y = battery ? 0.13 : 2.35;
      route(e.from, e.to, e.feed, [
        [a[0], battery ? 0.3 : 1, a[2]],
        [a[0], y, a[2]],
        [b[0], y, a[2]],
        [b[0], y, b[2]],
        [b[0], e.to === 'rack' ? 2.1 : 1, b[2]],
      ]);
    }
    return {
      parts,
      routes,
      target: [-0.2, 1, 0],
      span: 10.7,
      title: 'Power equipment, in context.',
      note: 'Representative facility equipment and spacing. Colored routes follow the electrical model; they are not installation drawings.',
    };
  }
  if (s.scope === 'rack') {
    const height = c.rack.units * U_METERS + 0.24,
      selected = c.h;
    put('rack-frame', 'device', 'rack', [0, 0, 0], [0.76, height, 1.15], {
      muted: true,
    });
    const hardware = model.hardware.filter((h) => h.rack === s.rackId);
    for (const h of hardware) {
      const p = profileFor(h),
        y = 0.12 + (h.u - 1) * U_METERS;
      const shelf = p.category === 'infrastructure';
      if (shelf) {
        const shelves = hardware.filter(
          (h) => profileFor(h).category === 'infrastructure',
        );
        const feed = shelves.indexOf(h) < shelves.length / 2 ? 'a' : 'b';
        put(
          h.id,
          `converter-${feed}`,
          'shelf',
          [0, y, 0],
          [0.48, h.height * U_METERS - 0.004, 1.03],
          { count: 6 },
        );
      } else
        put(
          h.id,
          'device',
          'chassis',
          [0, y, -0.03],
          [0.482, h.height * U_METERS - 0.004, Math.min(p.depth || 1, 1.1)],
          { hardwareId: h.id, muted: h.id !== selected?.id },
        );
    }
    const y = selected?.u
      ? 0.12 + (selected.u - 1 + selected.height / 2) * U_METERS
      : height / 2;
    for (const [feed, x] of [
      ['a', -0.44],
      ['b', 0.44],
    ] as const) {
      put(
        `feed-${feed}`,
        `feed-${feed}`,
        'connector',
        [x, height + 0.2, 0.5],
        [0.12, 0.13, 0.15],
        { label: `Feed ${feed.toUpperCase()}` },
      );
      put(
        `pdu-${feed}`,
        `pdu-${feed}`,
        c.nvl ? 'cabinet' : 'pdu',
        [x, c.nvl ? height + 0.45 : 0.12, 0.53],
        c.nvl ? [0.23, 0.28, 0.25] : [0.07, height - 0.2, 0.085],
        {
          label: c.nvl
            ? `Whips ${feed.toUpperCase()}`
            : `PDU ${feed.toUpperCase()}`,
        },
      );
      route(`feed-${feed}`, `pdu-${feed}`, feed, [
        [x, height + 0.22, 0.56],
        [x, height + 0.12, 0.65],
        [x, c.nvl ? height + 0.45 : height - 0.04, 0.65],
      ]);
      if (c.nvl) {
        const shelves = parts.filter((p) => p.stageId === `converter-${feed}`);
        for (const shelf of shelves) {
          const yy = shelf.position[1] + shelf.size[1] / 2;
          route(`pdu-${feed}`, `converter-${feed}`, feed, [
            [x, height + 0.5, 0.65],
            [x, yy, 0.65],
            [x * 0.48, yy, 0.65],
            [x * 0.48, yy, 0.53],
          ]);
          route(`converter-${feed}`, 'dc-bus', 'dc', [
            [x * 0.48, yy, -0.48],
            [0, yy, -0.59],
          ]);
        }
      } else if (selected) {
        const count = c.count ?? 2,
          groupCount =
            feed === 'a' ? Math.ceil(count / 2) : Math.floor(count / 2);
        put(
          `converter-${feed}`,
          `converter-${feed}`,
          'psu',
          [x * 0.27, y - 0.026, 0.53],
          [0.21, Math.min(selected.height * U_METERS * 0.56, 0.125), 0.08],
          {
            count: Math.max(1, groupCount),
            label: `PSU group ${feed.toUpperCase()}`,
          },
        );
        route(`pdu-${feed}`, `converter-${feed}`, feed, [
          [x, y + 0.1, 0.58],
          [x, y + 0.06, 0.68],
          [x * 0.27, y + 0.06, 0.68],
          [x * 0.27, y + 0.01, 0.58],
        ]);
        route(`converter-${feed}`, 'dc-bus', 'dc', [
          [x * 0.27, y, 0.49],
          [x * 0.27, y, -0.45],
          [0, y, -0.45],
        ]);
      }
    }
    if (selected || c.nvl)
      put(
        'dc-bus',
        'dc-bus',
        'busbar',
        [0, c.nvl ? 0.13 : y - 0.014, c.nvl ? -0.59 : -0.45],
        c.nvl ? [0.035, height - 0.22, 0.03] : [0.37, 0.024, 0.03],
        { label: c.nvl ? 'DC busbar' : 'Internal DC rail' },
      );
    if (selected) {
      const management = c.nvl && profileFor(selected).id === 'sn2201';
      if (management) {
        for (const [feed, x] of [
          ['a', -0.44],
          ['b', 0.44],
        ] as const)
          route(`pdu-${feed}`, 'device', feed, [
            [x, height + 0.5, 0.65],
            [x, y, 0.65],
            [x * 0.2, y, 0.54],
          ]);
      } else
        route('dc-bus', 'device', 'dc', [
          [0, y, c.nvl ? -0.59 : -0.45],
          [0, y + 0.04, -0.27],
          [0.14, y + 0.04, -0.27],
        ]);
    }
    return {
      parts,
      routes,
      target: [0, height * 0.53, 0],
      span: height * 1.55,
      title: 'The rack, with power exposed.',
      note: `${c.rack.units}U equipment positions follow this rack. Colored routes bundle the selected device’s connections; ${c.nvl ? 'shelf feed assignments' : 'PSU locations and cord assignments'} are illustrative. Front panels are dimmed to reveal the route.`,
    };
  }
  if (!c.h)
    return {
      parts,
      routes,
      target: [0, 0, 0],
      span: 5,
      title: 'Add hardware to see its power path.',
      note: 'This rack is empty.',
    };
  put('board-tray', 'protection', 'board', [0, 0, 0], [4.45, 0.06, 2.75], {
    muted: true,
  });
  put(
    'board-input',
    'board-input',
    'connector',
    [-2.13, 0.1, 0],
    [0.15, 0.3, 0.42],
    {
      label:
        c.nvl && profileFor(c.h).id !== 'sn2201' ? 'DC inlet' : 'A/B inlets',
    },
  );
  put('conversion', 'conversion', 'psu', [-1.68, 0.09, 0], [0.58, 0.25, 0.75], {
    count: 2,
    label:
      c.nvl && profileFor(c.h).id !== 'sn2201'
        ? 'DC conversion'
        : 'PSU conversion',
  });
  put(
    'protection',
    'protection',
    'busbar',
    [-1.14, 0.07, 0],
    [0.22, 0.045, 1.35],
    { label: 'DC distribution' },
  );
  put('vrm', 'vrm', 'vrm', [-0.75, 0.08, 0], [0.48, 0.18, 1.2], {
    count: 8,
    label: 'Local regulators',
  });
  route(
    'board-input',
    'conversion',
    c.nvl && profileFor(c.h).id !== 'sn2201' ? 'dc' : 'shared',
    [
      [-2.05, 0.2, 0],
      [-1.97, 0.2, 0],
    ],
  );
  route('conversion', 'protection', 'dc', [
    [-1.4, 0.12, 0],
    [-1.14, 0.12, 0],
  ]);
  route('protection', 'vrm', 'dc', [
    [-1.03, 0.12, 0],
    [-0.94, 0.12, 0],
  ]);
  c.allocation.forEach((g, i) => {
    const x = 0.04 + (i % 3) * 0.84,
      z = i < 3 ? -0.7 : 0.7;
    put(
      `load-${g.key}`,
      `load-${g.key}`,
      g.key as PowerForm,
      [x, 0.075, z],
      [0.69, 0.22, 0.81],
      { count: g.items.length, label: g.label },
    );
    route('vrm', `load-${g.key}`, 'dc', [
      [-0.5, 0.09, 0],
      [-0.35, 0.09, 0],
      [-0.35, 0.09, z],
      [x - 0.35, 0.09, z],
    ]);
  });
  return {
    parts,
    routes,
    target: [0, 0.18, 0],
    span: 5.9,
    title: 'Power across the board.',
    note: 'Functional cutaway, not an OEM board layout. Module counts match the selected model; rails and placement explain the power path.',
  };
}

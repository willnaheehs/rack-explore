import { CATALOG, profileFor, type Profile } from './catalog.ts';
import {
  portBudget,
  networkErrors,
  type Transport,
} from './network-validation.ts';
export { portBudget } from './network-validation.ts';
import {
  DEFAULT_MODEL,
  type ClusterModel,
  type Fabric,
  type Hardware,
  type Rack,
  type Link,
} from './hardware.ts';
export const STORAGE_KEY = 'rack-explore.custom.v1';
const p = (id: string) => {
  const value = CATALOG.find((x) => x.id === id);
  if (!value) throw new Error('Unknown catalog hardware.');
  return value;
};
export function equipment(
  profileId: string,
  rack: string,
  u: number,
  id: string,
): Hardware {
  const profile = p(profileId);
  return {
    id,
    name: profile.name,
    model: `${profile.maker} ${profile.name}`,
    profile: profile.id,
    kind:
      profile.category === 'storage'
        ? 'ai400x2'
        : profile.category === 'network'
          ? 'qm9700'
          : profile.category === 'infrastructure'
            ? 'psu'
            : 'dgx',
    rack,
    u,
    height: profile.units,
    fabric: profile.category === 'storage' ? 'storage' : undefined,
  };
}
export function blankModel(): ClusterModel {
  return {
    id: 'custom',
    title: 'My cluster',
    description:
      'A custom arrangement. Rack-unit fit is checked; rail kits, electrical load, airflow, liquid loops, weight and procurement compatibility require separate engineering.',
    custom: true,
    racks: [
      {
        id: 'R01',
        name: 'Custom rack',
        role: '19-inch mounting',
        x: 0,
        color: '#c3f16b',
        units: 42,
        mount: '19-inch',
        depth: 1.2,
      },
    ],
    hardware: [],
    links: [],
  };
}
export function placementError(
  model: ClusterModel,
  profile: Profile,
  rackId: string,
  u: number,
  ignoreId?: string,
): string | null {
  const rack = model.racks.find((r) => r.id === rackId);
  if (!rack) return 'Select a rack.';
  if (profile.status === 'Preliminary' || profile.category === 'rack')
    return 'This platform requires its complete rack template.';
  if (
    profile.mount !== (rack.mount ?? '19-inch') &&
    !(rack.mount === 'NVL72' && profile.id === 'sn2201')
  )
    return `${profile.name} requires ${profile.mount} mounting.`;
  if (!Number.isInteger(u) || u < 1 || u + profile.units - 1 > rack.units)
    return `Choose a starting U between 1 and ${rack.units - profile.units + 1}.`;
  const collision = model.hardware.find(
    (h) =>
      h.id !== ignoreId &&
      h.rack === rackId &&
      u < h.u + h.height &&
      u + profile.units > h.u,
  );
  if (collision)
    return `U${collision.u}–${collision.u + collision.height - 1} is occupied by ${collision.name}.`;
  return null;
}
export function firstFreeU(
  model: ClusterModel,
  profile: Profile,
  rack: string,
) {
  for (let u = 1; u <= 48; u++)
    if (!placementError(model, profile, rack, u)) return u;
  return null;
}
export function placeHardware(
  model: ClusterModel,
  profileId: string,
  rack: string,
  u: number,
  id: string,
): ClusterModel {
  const profile = p(profileId);
  const error = placementError(model, profile, rack, u);
  if (error) throw new Error(error);
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
    model.hardware.some((h) => h.id === id)
  )
    throw new Error('Equipment identifier must be unique.');
  return {
    ...model,
    hardware: [...model.hardware, equipment(profileId, rack, u, id)],
  };
}
export function moveHardware(
  model: ClusterModel,
  id: string,
  rack: string,
  u: number,
): ClusterModel {
  const h = model.hardware.find((h) => h.id === id);
  if (!h) throw new Error('Unknown equipment.');
  const error = placementError(model, profileFor(h), rack, u, id);
  if (error) throw new Error(error);
  return {
    ...model,
    hardware: model.hardware.map((item) =>
      item.id === id ? { ...item, rack, u } : item,
    ),
  };
}
export function removeHardware(model: ClusterModel, id: string): ClusterModel {
  return {
    ...model,
    hardware: model.hardware.filter((h) => h.id !== id),
    links: model.links.filter((l) => l.from !== id && l.to !== id),
  };
}
export function modelForProfile(id: string): ClusterModel {
  const profile = p(id);
  if (profile.status === 'Preliminary')
    throw new Error('Preliminary platform has no verified rack layout.');
  if (id === 'washington-b300') {
    const racks: Rack[] = Array.from({ length: 8 }, (_, i) => ({
      id: `W${i + 1}`,
      name: `Display rack ${i + 1}`,
      role: 'Illustrative placement · 4 nodes',
      units: 42,
      x: (i - 3.5) * 0.8,
      color: profile.color,
      mount: '19-inch',
      depth: 1.2,
    }));
    return {
      id,
      title: profile.name,
      description: profile.description,
      racks,
      hardware: Array.from({ length: 32 }, (_, i) => ({
        ...equipment(
          id,
          racks[Math.floor(i / 4)].id,
          1 + (i % 4) * 8,
          `b300-${String(i + 1).padStart(2, '0')}`,
        ),
        name: `B300 node ${String(i + 1).padStart(2, '0')}`,
      })),
      links: [],
    };
  }
  if (id === 'gb200-nvl72' || id === 'gb300-nvl72') {
    const gen = id.startsWith('gb300') ? 'gb300' : 'gb200';
    const rack: Rack = {
      id: 'NVL01',
      name: profile.name,
      role: '72-GPU NVLink domain',
      units: 48,
      x: 0,
      color: profile.color,
      mount: 'NVL72',
      depth: 1.2,
    };
    const make = (ids: number[], pr: string, prefix: string) =>
      ids.map((u, i) => equipment(pr, rack.id, u, `${prefix}-${i + 1}`));
    return {
      id,
      title: profile.name,
      description: profile.description,
      racks: [rack],
      hardware: [
        ...make(
          [
            11, 12, 13, 14, 15, 16, 17, 18, 28, 29, 30, 31, 32, 33, 34, 35, 36,
            37,
          ],
          `${gen}-tray`,
          'compute',
        ),
        ...make([19, 20, 21, 22, 23, 24, 25, 26, 27], 'nvl-switch', 'nvlink'),
        ...make([6, 7, 8, 9, 39, 40, 41, 42], 'nvl-power', 'power'),
        ...make([44, 45], 'sn2201', 'management'),
      ],
      links: [],
    };
  }
  return {
    id,
    title: `${profile.maker} ${profile.name}`,
    description: profile.description,
    racks: [
      {
        id: 'R01',
        name: profile.name,
        role: profile.family,
        x: 0,
        color: profile.color,
        units: 42,
        mount: '19-inch',
        depth: 1.2,
      },
    ],
    hardware: [equipment(id, 'R01', 1, 'device-01')],
    links: [],
  };
}
export function cloneForBuilder(model: ClusterModel): ClusterModel {
  if (model.racks.some((r) => r.mount === 'NVL72'))
    throw new Error(
      'NVL72 uses an integrated rack. Start a standard custom rack to combine catalog equipment.',
    );
  return {
    ...structuredClone(model),
    fabricReferences: undefined,
    id: 'custom',
    custom: true,
    title: `${model.title} · custom`,
    description: blankModel().description,
  };
}
export function totals(model: ClusterModel) {
  return model.hardware.reduce(
    (t, h) => {
      const pr = profileFor(h);
      return {
        gpus: t.gpus + pr.gpuCount,
        memoryGB: t.memoryGB + pr.gpuCount * pr.gpuMemoryGB,
        compute: t.compute + (pr.category === 'compute' ? 1 : 0),
        usedU: t.usedU + h.height,
      };
    },
    { gpus: 0, memoryGB: 0, compute: 0, usedU: 0 },
  );
}
export function addConnection(
  model: ClusterModel,
  input: {
    from: string;
    to: string;
    fabric: Fabric;
    count: number;
    rate: number;
    id: string;
    protocol?: Transport;
  },
): ClusterModel {
  const a = model.hardware.find((h) => h.id === input.from),
    b = model.hardware.find((h) => h.id === input.to);
  if (!a || !b || a.id === b.id)
    throw new Error('Choose two different devices.');
  if ([a, b].some((h) => profileFor(h).status === 'Supplied'))
    throw new Error(
      'NIC and port populations were not supplied. Confirm them before adding physical cables; aggregate RoCE capacity does not specify a cable mode.',
    );
  if (
    !['compute', 'storage', 'frontend'].includes(input.fabric) ||
    ![100, 200, 400, 800].includes(input.rate)
  )
    throw new Error('Choose a supported fabric and nominal rate.');
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 144)
    throw new Error('Link count must be between 1 and 144.');
  if (model.links.some((l) => l.id === input.id))
    throw new Error('Connection identifier must be unique.');
  for (const h of [a, b]) {
    const used = model.links
      .filter((l) => l.from === h.id || l.to === h.id)
      .reduce((sum, l) => sum + l.count, 0);
    if (used + input.count > portBudget(h))
      throw new Error(
        `${h.name} has ${Math.max(0, portBudget(h) - used)} unassigned logical ports / adapter slots.`,
      );
  }
  const link: Link = {
    ...input,
    label: `${input.count} × ${input.rate} Gb/s · planned`,
  };
  const next = { ...model, links: [...model.links, link] };
  const errors = networkErrors(next);
  if (errors.length) throw new Error(errors[0]);
  return next;
}
export function exportModel(model: ClusterModel): string {
  return JSON.stringify(
    {
      format: 'rack-explore',
      version: 1,
      title: model.title.trim() || 'My cluster',
      racks: model.racks.map(({ id, name, units }) => ({ id, name, units })),
      equipment: model.hardware.map((h) => ({
        id: h.id,
        profile: profileFor(h).id,
        rack: h.rack,
        u: h.u,
      })),
      connections: model.links.map(
        ({ id, from, to, fabric, count, rate, protocol }) => ({
          id,
          from,
          to,
          fabric,
          count,
          rate,
          protocol,
        }),
      ),
    },
    null,
    2,
  );
}
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a rack configuration object.');
  return value as Record<string, unknown>;
}
function short(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100)
    throw new Error(`Invalid ${label}.`);
  return value.trim();
}
function identifier(value: unknown): string {
  const id = short(value, 'identifier');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    throw new Error(
      'Identifiers must use letters, numbers, dashes or underscores.',
    );
  return id;
}
export function importModel(text: string): ClusterModel {
  if (text.length > 250000) throw new Error('Configuration file is too large.');
  const data = obj(JSON.parse(text));
  if (data.format !== 'rack-explore' || data.version !== 1)
    throw new Error('Choose a Physical Compute v1 JSON file.');
  if (
    !Array.isArray(data.racks) ||
    data.racks.length < 1 ||
    data.racks.length > 8
  )
    throw new Error('A configuration must contain 1–8 racks.');
  const racks: Rack[] = data.racks.map((raw, i) => {
    const r = obj(raw);
    if (r.units !== 42 && r.units !== 48)
      throw new Error('Rack height must be 42U or 48U.');
    return {
      id: identifier(r.id),
      name: short(r.name, 'rack name'),
      role: 'Custom rack',
      units: r.units,
      x: (i - (data.racks as unknown[]).length / 2 + 0.5) * 0.82,
      color: '#c3f16b',
      mount: '19-inch',
      depth: 1.2,
    };
  });
  if (new Set(racks.map((r) => r.id)).size !== racks.length)
    throw new Error('Rack identifiers must be unique.');
  if (!Array.isArray(data.equipment) || data.equipment.length > 384)
    throw new Error('Invalid equipment list.');
  let model: ClusterModel = {
    ...blankModel(),
    title: short(data.title, 'cluster name'),
    racks,
  };
  for (const raw of data.equipment) {
    const e = obj(raw);
    model = placeHardware(
      model,
      short(e.profile, 'catalog ID'),
      identifier(e.rack),
      Number(e.u),
      identifier(e.id),
    );
  }
  if (!Array.isArray(data.connections) || data.connections.length > 1000)
    throw new Error('Invalid connection list.');
  for (const raw of data.connections) {
    const e = obj(raw);
    model = addConnection(model, {
      id: identifier(e.id),
      from: identifier(e.from),
      to: identifier(e.to),
      fabric: e.fabric as Fabric,
      count: Number(e.count),
      rate: Number(e.rate),
      ...(e.protocol !== undefined
        ? { protocol: e.protocol as Transport }
        : {}),
    });
  }
  return model;
}
export function defaultModel() {
  return DEFAULT_MODEL;
}

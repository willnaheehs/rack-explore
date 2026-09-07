// Portable infrastructure records. No browser, renderer, database or vendor dependencies.
export type Evidence = {
  basis: 'reported' | 'derived' | 'estimated' | 'unknown';
  sources: string[];
  asOf?: string;
  note?: string;
};
export type Quantity = { value: number; unit: string };
export type Fact = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit?: string;
  evidence: Evidence;
};
export type Extensions = Record<string, unknown>;
export type PortDefinition = {
  key: string;
  name: string;
  medium: string;
  direction: 'in' | 'out' | 'bidirectional';
  protocol?: string;
  capacity?: Quantity;
};
export type AssetType = {
  id: string;
  revision: number;
  name: string;
  category: string;
  facts: Fact[];
  ports: PortDefinition[];
  extensions?: Extensions;
};
export type Asset = {
  id: string;
  name: string;
  typeId: string;
  typeRevision: number;
  parentId?: string;
  representation: 'individual' | 'aggregate' | 'representative' | 'slot';
  quantity: number;
  placement?: {
    rack?: { u: number; height: number; mount: string };
    // Local metres relative to the physical parent; radians about the vertical axis.
    position?: [number, number, number];
    rotation?: number;
  };
  facts: Fact[];
  evidence: Evidence;
  extensions?: Extensions;
};
export type Interface = PortDefinition & {
  id: string;
  assetId: string;
  kind: 'physical' | 'aggregate';
  count: number;
  evidence: Evidence;
};
export type Connection = {
  id: string;
  name: string;
  from: string;
  to: string;
  medium: string;
  kind: 'physical' | 'aggregate' | 'logical';
  quantity: number;
  capacity?: Quantity;
  evidence: Evidence;
  extensions?: Extensions;
};
export type Infrastructure = {
  format: 'physical-compute';
  version: 2;
  id: string;
  title: string;
  description: string;
  purpose: 'reference' | 'plan' | 'inventory';
  types: AssetType[];
  assets: Asset[];
  interfaces: Interface[];
  connections: Connection[];
  groups: { id: string; name: string; assetIds: string[] }[];
  sources: {
    id: string;
    title: string;
    url: string;
    retrievedAt: string;
    license?: string;
  }[];
  extensions?: Extensions;
};
export type InfrastructureIssue = {
  level: 'error' | 'review';
  area: 'Structure' | 'Placement' | 'Connections' | 'Evidence';
  message: string;
  assetId?: string;
};
export const INFRASTRUCTURE_LIMITS = {
  bytes: 10_000_000,
  assets: 20_000,
  interfaces: 100_000,
  connections: 100_000,
  depth: 128,
};
const knownCategories = new Set([
  'site',
  'building',
  'hall',
  'row',
  'rack',
  'compute',
  'network',
  'storage',
  'power',
  'cooling',
  'component',
  'generic',
]);
const knownMedia = new Set(['data', 'power', 'cooling', 'mechanical']);
const units: Record<string, [string, number]> = {
  'b/s': ['rate', 1],
  'Mb/s': ['rate', 1e6],
  'Gb/s': ['rate', 1e9],
  'Tb/s': ['rate', 1e12],
  W: ['power', 1],
  kW: ['power', 1000],
  MW: ['power', 1e6],
  'L/min': ['flow', 1],
  'm3/h': ['flow', 1000 / 60],
  A: ['current', 1],
  V: ['voltage', 1],
};
export function compareQuantities(a: Quantity, b: Quantity): number | null {
  if (!Object.hasOwn(units, a.unit) || !Object.hasOwn(units, b.unit))
    return null;
  const x = units[a.unit],
    y = units[b.unit];
  if (!x || !y || x[0] !== y[0]) return null;
  const av = a.value * x[1],
    bv = b.value * y[1];
  if (!Number.isFinite(av) || !Number.isFinite(bv)) return null;
  return av < bv ? -1 : av > bv ? 1 : 0;
}
export function assetType(doc: Infrastructure, asset: Asset): AssetType {
  const found = doc.types.find(
    (t) => t.id === asset.typeId && t.revision === asset.typeRevision,
  );
  if (!found)
    throw new Error(`Missing equipment definition for ${asset.name}.`);
  return found;
}
export function assetFacts(doc: Infrastructure, asset: Asset): Fact[] {
  // An instance's observations replace only the corresponding template fields.
  // Multiple observations of one key remain visible; no guessed conflict resolution.
  const keys = new Set(asset.facts.map((f) => f.key));
  return [
    ...assetType(doc, asset).facts.filter((f) => !keys.has(f.key)),
    ...asset.facts,
  ];
}
export function ancestors(doc: Infrastructure, id: string): Asset[] {
  const byId = new Map(doc.assets.map((a) => [a.id, a]));
  const chain: Asset[] = [],
    seen = new Set<string>();
  let asset = byId.get(id);
  while (asset) {
    if (seen.has(asset.id) || chain.length >= INFRASTRUCTURE_LIMITS.depth)
      throw new Error('Invalid containment hierarchy.');
    seen.add(asset.id);
    chain.unshift(asset);
    asset = asset.parentId ? byId.get(asset.parentId) : undefined;
  }
  return chain;
}
export function instantiateAsset(
  type: AssetType,
  id: string,
  name: string,
  evidence: Evidence,
  parentId?: string,
): { asset: Asset; interfaces: Interface[] } {
  return {
    asset: {
      id,
      name,
      typeId: type.id,
      typeRevision: type.revision,
      ...(parentId ? { parentId } : {}),
      representation: 'individual',
      quantity: 1,
      facts: [],
      evidence: structuredClone(evidence),
    },
    interfaces: type.ports.map((port) => ({
      ...structuredClone(port),
      id: `${id}/port/${port.key}`,
      assetId: id,
      kind: 'physical',
      count: 1,
      evidence: structuredClone(evidence),
    })),
  };
}

// Validate file shape before any domain traversal. Unknown fields require an explicit
// extension namespace, so a misspelled core field cannot silently disappear on export.
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path}: expected an object.`);
  return value as Record<string, unknown>;
}
function fields(
  value: unknown,
  path: string,
  required: string[],
  optional: string[] = [],
) {
  const o = object(value, path);
  for (const k of required)
    if (!(k in o)) throw new Error(`${path}: missing ${k}.`);
  for (const k of Object.keys(o))
    if (![...required, ...optional].includes(k))
      throw new Error(
        `${path}: unsupported field ${k}. Put custom data in extensions.`,
      );
  if (o.extensions !== undefined) object(o.extensions, `${path}.extensions`);
  return o;
}
function text(
  value: unknown,
  path: string,
  max = 2000,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`${path}: expected text (up to ${max} characters).`);
}
function id(value: unknown, path: string) {
  text(value, path, 240);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:@-]*$/.test(value))
    throw new Error(`${path}: invalid identifier.`);
}
function number(value: unknown, path: string, integer = false, minimum = 0) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    (integer && !Number.isSafeInteger(value))
  )
    throw new Error(`${path}: invalid number.`);
}
function choice(value: unknown, choices: string[], path: string) {
  if (typeof value !== 'string' || !choices.includes(value))
    throw new Error(`${path}: expected ${choices.join(', ')}.`);
}
function list(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(`${path}: expected a list of at most ${max} entries.`);
  return value;
}
function date(value: unknown, path: string) {
  text(value, path, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${path}: expected a valid YYYY-MM-DD date.`);
}
function evidence(value: unknown, path: string) {
  const e = fields(value, path, ['basis', 'sources'], ['asOf', 'note']);
  choice(
    e.basis,
    ['reported', 'derived', 'estimated', 'unknown'],
    `${path}.basis`,
  );
  list(e.sources, `${path}.sources`, 100).forEach((s) =>
    id(s, `${path}.sources`),
  );
  if (e.asOf !== undefined) date(e.asOf, `${path}.asOf`);
  if (e.note !== undefined) text(e.note, `${path}.note`);
}
function quantity(value: unknown, path: string) {
  const q = fields(value, path, ['value', 'unit']);
  number(q.value, `${path}.value`);
  text(q.unit, `${path}.unit`, 40);
}
function facts(value: unknown, path: string) {
  for (const [i, raw] of list(value, path, 1000).entries()) {
    const p = `${path}[${i}]`,
      f = fields(raw, p, ['key', 'label', 'value', 'evidence'], ['unit']);
    id(f.key, `${p}.key`);
    text(f.label, `${p}.label`, 160);
    evidence(f.evidence, `${p}.evidence`);
    if (
      f.value !== null &&
      !['string', 'number', 'boolean'].includes(typeof f.value)
    )
      throw new Error(`${p}: invalid fact value.`);
    if (typeof f.value === 'number' && !Number.isFinite(f.value))
      throw new Error(`${p}: non-finite fact value.`);
    if (typeof f.value === 'string' && f.value.length > 4000)
      throw new Error(`${p}: fact text is too long.`);
    if (f.unit !== undefined) text(f.unit, `${p}.unit`, 40);
    if (f.value === null && (f.evidence as Evidence).basis !== 'unknown')
      throw new Error(`${p}: a missing value must be marked unknown.`);
    if (f.value !== null && (f.evidence as Evidence).basis === 'unknown')
      throw new Error(`${p}: unknown facts must use a null value.`);
  }
}
function port(value: unknown, path: string, instance: boolean) {
  const p = fields(
    value,
    path,
    [
      'key',
      'name',
      'medium',
      'direction',
      ...(instance ? ['id', 'assetId', 'kind', 'count', 'evidence'] : []),
    ],
    ['protocol', 'capacity'],
  );
  id(p.key, `${path}.key`);
  text(p.name, `${path}.name`, 240);
  id(p.medium, `${path}.medium`);
  choice(p.direction, ['in', 'out', 'bidirectional'], `${path}.direction`);
  if (p.protocol !== undefined) text(p.protocol, `${path}.protocol`, 120);
  if (p.capacity !== undefined) quantity(p.capacity, `${path}.capacity`);
  if (instance) {
    id(p.id, `${path}.id`);
    id(p.assetId, `${path}.assetId`);
    choice(p.kind, ['physical', 'aggregate'], `${path}.kind`);
    number(p.count, `${path}.count`, true, 1);
    evidence(p.evidence, `${path}.evidence`);
  }
}
function safeJson(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error('File nesting exceeds the supported limit.');
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k))
        throw new Error('Unsafe property in configuration file.');
      safeJson(v, depth + 1);
    }
  }
}
export function readInfrastructure(textValue: string): Infrastructure {
  if (new TextEncoder().encode(textValue).length > INFRASTRUCTURE_LIMITS.bytes)
    throw new Error('Infrastructure file exceeds 10 MB.');
  const raw: unknown = JSON.parse(textValue);
  safeJson(raw);
  const d = fields(
    raw,
    'File',
    [
      'format',
      'version',
      'id',
      'title',
      'description',
      'purpose',
      'types',
      'assets',
      'interfaces',
      'connections',
      'groups',
      'sources',
    ],
    ['extensions'],
  );
  if (d.format !== 'physical-compute' || d.version !== 2)
    throw new Error(
      'Unsupported file version. Use a Physical Compute v2 file.',
    );
  id(d.id, 'File.id');
  text(d.title, 'Title', 240);
  if (typeof d.description !== 'string' || d.description.length > 8000)
    throw new Error('Invalid description.');
  choice(d.purpose, ['reference', 'plan', 'inventory'], 'Purpose');
  for (const rawType of list(d.types, 'Types', 5000)) {
    const t = fields(
      rawType,
      'Type',
      ['id', 'revision', 'name', 'category', 'facts', 'ports'],
      ['extensions'],
    );
    id(t.id, 'Type.id');
    number(t.revision, 'Type.revision', true, 1);
    text(t.name, 'Type.name', 240);
    id(t.category, 'Type.category');
    facts(t.facts, 'Type.facts');
    list(t.ports, 'Type.ports', 2000).forEach((p) =>
      port(p, 'Type.port', false),
    );
  }
  for (const rawAsset of list(
    d.assets,
    'Assets',
    INFRASTRUCTURE_LIMITS.assets,
  )) {
    const a = fields(
      rawAsset,
      'Asset',
      [
        'id',
        'name',
        'typeId',
        'typeRevision',
        'representation',
        'quantity',
        'facts',
        'evidence',
      ],
      ['parentId', 'placement', 'extensions'],
    );
    id(a.id, 'Asset.id');
    text(a.name, 'Asset.name', 240);
    id(a.typeId, 'Asset.typeId');
    number(a.typeRevision, 'Asset.typeRevision', true, 1);
    if (a.parentId !== undefined) id(a.parentId, 'Asset.parentId');
    choice(
      a.representation,
      ['individual', 'aggregate', 'representative', 'slot'],
      'Asset.representation',
    );
    number(a.quantity, 'Asset.quantity', true, 1);
    facts(a.facts, 'Asset.facts');
    evidence(a.evidence, 'Asset.evidence');
    if (a.placement !== undefined) {
      const p = fields(
        a.placement,
        'Placement',
        [],
        ['rack', 'position', 'rotation'],
      );
      if (p.rack !== undefined) {
        const r = fields(p.rack, 'Rack placement', ['u', 'height', 'mount']);
        number(r.u, 'Rack U', true, 1);
        number(r.height, 'Rack height', true, 1);
        text(r.mount, 'Rack mounting', 120);
      }
      if (p.position !== undefined) {
        if (!Array.isArray(p.position) || p.position.length !== 3)
          throw new Error('Position must contain three coordinates in metres.');
        p.position.forEach((v) => number(v, 'Position', false, -1e9));
      }
      if (p.rotation !== undefined) number(p.rotation, 'Rotation', false, -1e9);
    }
  }
  list(d.interfaces, 'Interfaces', INFRASTRUCTURE_LIMITS.interfaces).forEach(
    (p) => port(p, 'Interface', true),
  );
  for (const rawConnection of list(
    d.connections,
    'Connections',
    INFRASTRUCTURE_LIMITS.connections,
  )) {
    const c = fields(
      rawConnection,
      'Connection',
      ['id', 'name', 'from', 'to', 'medium', 'kind', 'quantity', 'evidence'],
      ['capacity', 'extensions'],
    );
    for (const k of ['id', 'from', 'to', 'medium']) id(c[k], `Connection.${k}`);
    text(c.name, 'Connection.name', 240);
    choice(c.kind, ['physical', 'aggregate', 'logical'], 'Connection.kind');
    number(c.quantity, 'Connection.quantity', true, 1);
    evidence(c.evidence, 'Connection.evidence');
    if (c.capacity !== undefined) quantity(c.capacity, 'Connection.capacity');
  }
  for (const rawGroup of list(d.groups, 'Groups', 5000)) {
    const g = fields(rawGroup, 'Group', ['id', 'name', 'assetIds']);
    id(g.id, 'Group.id');
    text(g.name, 'Group.name', 240);
    list(g.assetIds, 'Group.assetIds', INFRASTRUCTURE_LIMITS.assets).forEach(
      (v) => id(v, 'Group member'),
    );
  }
  for (const rawSource of list(d.sources, 'Sources', 5000)) {
    const s = fields(
      rawSource,
      'Source',
      ['id', 'title', 'url', 'retrievedAt'],
      ['license'],
    );
    id(s.id, 'Source.id');
    text(s.title, 'Source.title', 500);
    text(s.url, 'Source.url', 2000);
    date(s.retrievedAt, 'Source.retrievedAt');
    const url = new URL(s.url as string);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error(
        'Sources must use HTTP or HTTPS URLs without credentials.',
      );
    if (s.license !== undefined) text(s.license, 'Source.license', 500);
  }
  const doc = raw as Infrastructure;
  const errors = validateInfrastructure(doc).filter((i) => i.level === 'error');
  if (errors.length)
    throw new Error(
      errors
        .slice(0, 4)
        .map((i) => i.message)
        .join(' '),
    );
  return doc;
}

export function validateInfrastructure(
  doc: Infrastructure,
): InfrastructureIssue[] {
  const issues: InfrastructureIssue[] = [];
  const add = (
    level: InfrastructureIssue['level'],
    area: InfrastructureIssue['area'],
    message: string,
    assetId?: string,
  ) => {
    issues.push({ level, area, message, ...(assetId ? { assetId } : {}) });
  };
  const unique = (ids: string[], label: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) add('error', 'Structure', `Duplicate ${label}: ${id}.`);
      seen.add(id);
    }
  };
  unique(
    doc.assets.map((a) => a.id),
    'asset',
  );
  unique(
    doc.types.map((t) => `${t.id}@${t.revision}`),
    'type revision',
  );
  unique(
    doc.interfaces.map((p) => p.id),
    'interface',
  );
  unique(
    doc.connections.map((c) => c.id),
    'connection',
  );
  unique(
    doc.groups.map((g) => g.id),
    'group',
  );
  unique(
    doc.sources.map((s) => s.id),
    'source',
  );
  const assets = new Map(doc.assets.map((a) => [a.id, a])),
    types = new Map(doc.types.map((t) => [`${t.id}@${t.revision}`, t]));
  const ports = new Map(doc.interfaces.map((p) => [p.id, p])),
    sources = new Set(doc.sources.map((s) => s.id));
  const checkEvidence = (e: Evidence, name: string, assetId?: string) => {
    for (const source of e.sources)
      if (!sources.has(source))
        add(
          'error',
          'Evidence',
          `${name} refers to missing source ${source}.`,
          assetId,
        );
    if (e.basis === 'reported' && !e.sources.length)
      add(
        'error',
        'Evidence',
        `${name}: reported information needs a source.`,
        assetId,
      );
    if (e.basis === 'reported' && !e.asOf)
      add(
        'review',
        'Evidence',
        `${name}: observation date is unknown.`,
        assetId,
      );
  };
  for (const t of doc.types) {
    if (!knownCategories.has(t.category))
      add(
        'review',
        'Structure',
        `${t.name} uses a custom category; shown with a generic inspector.`,
      );
    unique(
      t.ports.map((p) => p.key),
      `${t.name} port key`,
    );
    t.facts.forEach((f) => checkEvidence(f.evidence, `${t.name}: ${f.label}`));
  }
  const occupied = new Map<string, Asset[]>();
  let uncertain = 0;
  for (const a of doc.assets) {
    const t = types.get(`${a.typeId}@${a.typeRevision}`);
    if (!t) {
      add(
        'error',
        'Structure',
        `${a.name} has no matching type revision.`,
        a.id,
      );
      continue;
    }
    if (a.parentId && !assets.has(a.parentId))
      add(
        'error',
        'Structure',
        `${a.name} has a missing physical parent.`,
        a.id,
      );
    const seen = new Set<string>();
    let cursor: Asset | undefined = a;
    while (cursor) {
      if (seen.has(cursor.id) || seen.size >= INFRASTRUCTURE_LIMITS.depth) {
        add(
          'error',
          'Structure',
          `${a.name}: containment must be acyclic and at most ${INFRASTRUCTURE_LIMITS.depth} levels deep.`,
          a.id,
        );
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parentId ? assets.get(cursor.parentId) : undefined;
    }
    if (a.representation !== 'aggregate' && a.quantity !== 1)
      add(
        'error',
        'Structure',
        `${a.name}: only aggregate records can have a quantity greater than one.`,
        a.id,
      );
    const parent = a.parentId ? assets.get(a.parentId) : undefined;
    if (
      parent?.representation === 'aggregate' &&
      a.representation === 'individual'
    )
      add(
        'error',
        'Structure',
        `${a.name}: use a representative component inside an aggregate record.`,
        a.id,
      );
    checkEvidence(a.evidence, a.name, a.id);
    a.facts.forEach((f) =>
      checkEvidence(f.evidence, `${a.name}: ${f.label}`, a.id),
    );
    if (a.evidence.basis !== 'reported' || a.representation !== 'individual')
      uncertain++;
    const conflicts = new Map<string, Set<string>>();
    for (const f of a.facts) {
      const values = conflicts.get(f.key) ?? new Set<string>();
      values.add(JSON.stringify([f.value, f.unit ?? null]));
      conflicts.set(f.key, values);
    }
    if ([...conflicts.values()].some((v) => v.size > 1))
      add(
        'review',
        'Evidence',
        `${a.name} has differing observations; review their sources and dates.`,
        a.id,
      );
    if (a.placement?.rack) {
      if (!parent || !types.has(`${parent.typeId}@${parent.typeRevision}`)) {
        add(
          'error',
          'Placement',
          `${a.name}: rack placement needs a parent rack.`,
          a.id,
        );
        continue;
      }
      const pt = types.get(`${parent.typeId}@${parent.typeRevision}`)!;
      if (pt.category !== 'rack')
        add(
          'error',
          'Placement',
          `${a.name}: U placement requires a rack parent.`,
          a.id,
        );
      const pf = [...pt.facts, ...parent.facts],
        height = pf.findLast((f) => f.key === 'rack.units'),
        mount = pf.findLast((f) => f.key === 'rack.mount');
      if (
        typeof height?.value === 'number' &&
        a.placement.rack.u + a.placement.rack.height - 1 > height.value
      )
        add('error', 'Placement', `${a.name} extends past its rack.`, a.id);
      if (!height)
        add(
          'review',
          'Placement',
          `${parent.name}: rack height is unknown.`,
          parent.id,
        );
      const accepted =
        pf.findLast((f) => f.key === `rack.accepts.${a.placement!.rack!.mount}`)
          ?.value === true;
      if (
        typeof mount?.value === 'string' &&
        mount.value !== a.placement.rack.mount &&
        !accepted
      )
        add(
          'error',
          'Placement',
          `${a.name} is incompatible with its rack mounting system.`,
          a.id,
        );
      const peers = occupied.get(parent.id) ?? [];
      for (const peer of peers) {
        const p = peer.placement!.rack!;
        if (
          a.placement.rack.u < p.u + p.height &&
          p.u < a.placement.rack.u + a.placement.rack.height
        )
          add('error', 'Placement', `${a.name} overlaps ${peer.name}.`, a.id);
      }
      peers.push(a);
      occupied.set(parent.id, peers);
    }
  }
  const used = new Map<string, number>();
  for (const p of doc.interfaces) {
    if (!assets.has(p.assetId))
      add('error', 'Structure', `${p.name}: interface owner does not exist.`);
    if (p.kind === 'physical' && p.count !== 1)
      add(
        'error',
        'Connections',
        `${p.name}: a physical interface must have count 1.`,
        p.assetId,
      );
    checkEvidence(p.evidence, p.name, p.assetId);
  }
  for (const c of doc.connections) {
    const a = ports.get(c.from),
      b = ports.get(c.to);
    checkEvidence(c.evidence, c.name);
    if (!a || !b || c.from === c.to) {
      add(
        'error',
        'Connections',
        `${c.name}: choose two existing, different interfaces.`,
      );
      continue;
    }
    if (a.medium !== c.medium || b.medium !== c.medium)
      add(
        'error',
        'Connections',
        `${c.name}: interface media do not match.`,
        a.assetId,
      );
    if (!knownMedia.has(c.medium))
      add(
        'review',
        'Connections',
        `${c.name}: this medium has no engineering rules yet.`,
        a.assetId,
      );
    if (a.direction === 'in' || b.direction === 'out')
      add(
        'error',
        'Connections',
        `${c.name}: connection direction contradicts its interfaces.`,
        a.assetId,
      );
    if (a.protocol && b.protocol && a.protocol !== b.protocol)
      add(
        'error',
        'Connections',
        `${c.name}: interface protocols do not match.`,
        a.assetId,
      );
    if (
      c.kind === 'physical' &&
      (a.kind !== 'physical' || b.kind !== 'physical' || c.quantity !== 1)
    )
      add(
        'error',
        'Connections',
        `${c.name}: physical cables require individual ports and quantity 1.`,
        a.assetId,
      );
    if (c.kind !== 'logical')
      for (const p of [a, b]) {
        used.set(p.id, (used.get(p.id) ?? 0) + c.quantity);
        if (c.capacity && p.capacity) {
          const comparison = compareQuantities(c.capacity, p.capacity);
          if (comparison === null)
            add(
              'review',
              'Connections',
              `${c.name}: capacity units cannot be compared.`,
              p.assetId,
            );
          else if (comparison > 0)
            add(
              'error',
              'Connections',
              `${c.name} exceeds ${p.name}'s per-link capacity.`,
              p.assetId,
            );
        } else
          add(
            'review',
            'Connections',
            `${c.name}: capacity is not fully specified.`,
            p.assetId,
          );
      }
  }
  for (const [id, count] of used) {
    const p = ports.get(id)!;
    if (count > p.count)
      add(
        'error',
        'Connections',
        `${p.name} is allocated ${count} times but has capacity for ${p.count} connections.`,
        p.assetId,
      );
  }
  for (const g of doc.groups) {
    unique(g.assetIds, `${g.name} member`);
    for (const id of g.assetIds)
      if (!assets.has(id))
        add('error', 'Structure', `${g.name} refers to missing asset ${id}.`);
  }
  if (uncertain)
    add(
      'review',
      'Evidence',
      `${uncertain} records are references, estimates, aggregates or unverified positions; they are not individually verified installed assets.`,
    );
  if (doc.connections.length)
    add(
      'review',
      'Connections',
      'Checks cover references, directions, protocols and stated per-link limits. Cable qualification, electrical protection and hydraulic behavior require domain engineering.',
    );
  return issues;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function exportInfrastructure(doc: Infrastructure): string {
  const serialized = JSON.stringify(stable(doc), null, 2) + '\n';
  readInfrastructure(serialized);
  return serialized;
}

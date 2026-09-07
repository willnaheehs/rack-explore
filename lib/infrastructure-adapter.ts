import { CATALOG, CATALOG_REVISION, profileFor, partFor } from './catalog.ts';
import {
  childrenOf,
  specsFor,
  type ClusterModel,
  type Hardware,
  type Rack,
  type Link,
} from './hardware.ts';
import { importModel } from './rack-builder.ts';
import { connectionProtocol } from './network-validation.ts';
import { validateConfiguration } from './config-validation.ts';
import { withReferenceFabrics } from './fabric-references.ts';
import {
  readInfrastructure,
  exportInfrastructure,
  assetType,
  type Infrastructure,
  type AssetType,
  type Asset,
  type Fact,
  type Evidence,
  type Interface,
} from './infrastructure.ts';

const ns = 'rack-explore';
const reference: Evidence = {
  basis: 'estimated',
  sources: [],
  note: 'Reference layout or custom plan; not an observed installation.',
};
const keyFor = (label: string, index: number) =>
  `spec.${index}.${
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'value'
  }`;
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

// Deterministic migration. Snapshot every type and component instead of linking a
// saved deployment to mutable catalog defaults. Existing IDs remain unchanged.
export function infrastructureFromCluster(model: ClusterModel): Infrastructure {
  const sourceMap = new Map<string, string>();
  const doc: Infrastructure = {
    format: 'physical-compute',
    version: 2,
    id: model.id,
    title: model.title,
    description: model.description,
    purpose: model.custom ? 'plan' : 'reference',
    types: [],
    assets: [],
    interfaces: [],
    connections: [],
    groups: [],
    sources: [],
    extensions: {
      [ns]: {
        catalogRevision: CATALOG_REVISION,
        ...(model.custom !== undefined ? { custom: model.custom } : {}),
        ...(model.fabricReferences
          ? { fabricReferences: structuredClone(model.fabricReferences) }
          : {}),
      },
    },
  };
  const sourcesFor = (sources: { title: string; url: string }[]) =>
    sources.map((s) => {
      if (!sourceMap.has(s.url)) {
        const id = `source-${sourceMap.size + 1}`;
        sourceMap.set(s.url, id);
        doc.sources.push({ id, ...s, retrievedAt: CATALOG_REVISION });
      }
      return sourceMap.get(s.url)!;
    });
  const types = new Map<string, AssetType>();
  const addType = (t: AssetType) => {
    if (!types.has(t.id)) {
      types.set(t.id, t);
      doc.types.push(t);
    }
    return t.id;
  };
  const rootId = `${model.id}/infrastructure`;
  addType({
    id: 'core.workspace',
    revision: 1,
    name: 'Equipment collection',
    category: 'generic',
    facts: [],
    ports: [],
  });
  doc.assets.push({
    id: rootId,
    name: model.title,
    typeId: 'core.workspace',
    typeRevision: 1,
    representation: 'individual',
    quantity: 1,
    evidence: reference,
    facts: [],
    extensions: { [ns]: { role: 'root' } },
  });
  for (const r of model.racks) {
    const mounting = r.mount ?? '19-inch';
    const tid = `rack.${r.units}.${mounting}`;
    addType({
      id: tid,
      revision: 1,
      name: `${r.units}U ${mounting} rack`,
      category: 'rack',
      ports: [],
      facts: [
        {
          key: 'rack.units',
          label: 'Rack height',
          value: r.units,
          unit: 'U',
          evidence: reference,
        },
        {
          key: 'rack.mount',
          label: 'Mounting',
          value: mounting,
          evidence: reference,
        },
        ...(mounting === 'NVL72'
          ? [
              {
                key: 'rack.accepts.19-inch',
                label: 'Standard management equipment',
                value: true,
                evidence: {
                  ...reference,
                  note: 'The integrated template includes standard SN2201 management switches in reserved positions. This is not general permission to substitute compute trays.',
                },
              },
            ]
          : []),
      ],
    });
    doc.assets.push({
      id: r.id,
      name: r.name,
      typeId: tid,
      typeRevision: 1,
      parentId: rootId,
      representation: 'individual',
      quantity: 1,
      evidence: reference,
      facts: [],
      placement: { position: [r.x, 0, 0] },
      extensions: {
        [ns]: {
          role: 'rack',
          rackRole: r.role,
          color: r.color,
          ...(r.mount ? { mount: r.mount } : {}),
          ...(r.depth !== undefined ? { depth: r.depth } : {}),
        },
      },
    });
  }
  for (const h of model.hardware) {
    const p = profileFor(h),
      sourceIds = sourcesFor(p.sources);
    const facts = (hardware: Hardware): Fact[] =>
      specsFor(hardware).map((s, index) => ({
        key: keyFor(s.label, index),
        label: s.label,
        value: s.value,
        evidence: {
          basis: 'derived',
          sources: sourceIds,
          asOf: CATALOG_REVISION,
          note:
            s.note ??
            'Catalog snapshot. Published capabilities, options and illustrative details retain their original qualifications.',
        },
      }));
    const tid = addType({
      id: `catalog.${p.id}`,
      revision: 1,
      name: `${p.maker} ${p.name}`,
      category: p.category === 'infrastructure' ? 'power' : p.category,
      ports: [],
      facts: facts(h),
      extensions: {
        [ns]: { profileId: p.id, catalogRevision: CATALOG_REVISION },
      },
    });
    doc.assets.push({
      id: h.id,
      name: h.name,
      typeId: tid,
      typeRevision: 1,
      parentId: h.rack,
      quantity: 1,
      representation: 'individual',
      facts: [],
      evidence: reference,
      placement: {
        rack: {
          u: h.u,
          height: h.height,
          mount: p.mount === 'NVL72' ? 'NVL72' : '19-inch',
        },
      },
      extensions: {
        [ns]: {
          role: 'hardware',
          kind: h.kind,
          model: h.model,
          ...(h.profile ? { profile: h.profile } : {}),
          ...(h.fabric ? { fabric: h.fabric } : {}),
          ...(h.index !== undefined ? { index: h.index } : {}),
        },
      },
    });
    for (const c of childrenOf(h)) {
      const part = partFor(c)!;
      const ctid = addType({
        id: `catalog.${p.id}.${c.part}`,
        revision: 1,
        name: c.model,
        category: 'component',
        ports: [],
        facts: facts(c),
        extensions: {
          [ns]: {
            profileId: p.id,
            part: c.part,
            catalogRevision: CATALOG_REVISION,
          },
        },
      });
      doc.assets.push({
        id: c.id,
        name: c.name,
        typeId: ctid,
        typeRevision: 1,
        parentId: h.id,
        representation:
          part.population === 'slots'
            ? 'slot'
            : part.population === 'representative'
              ? 'representative'
              : 'individual',
        quantity: 1,
        facts: [
          {
            key: 'component.population',
            label: 'Population basis',
            value: part.population ?? 'fixed',
            evidence: {
              basis: 'derived',
              sources: sourceIds,
              asOf: CATALOG_REVISION,
              note: 'A catalog component position, not an inventoried asset.',
            },
          },
        ],
        evidence: reference,
        extensions: {
          [ns]: {
            role: 'component',
            part: c.part,
            index: c.index,
            kind: c.kind,
          },
        },
      });
    }
  }
  const ports = new Map<string, Interface>();
  for (const link of model.links) {
    const protocol = connectionProtocol(model, link) ?? undefined;
    const endpoints = [link.from, link.to].map((assetId) => {
      const id = `${assetId}/fabric/${link.fabric}/${protocol ?? 'unspecified'}/${link.rate}`;
      if (!ports.has(id))
        ports.set(id, {
          id,
          assetId,
          key: `${link.fabric}-${protocol ?? 'unspecified'}-${link.rate}`,
          name: `${link.fabric} · grouped endpoint`,
          medium: 'data',
          direction: 'bidirectional',
          kind: 'aggregate',
          count: 0,
          ...(protocol ? { protocol } : {}),
          capacity: { value: link.rate, unit: 'Gb/s' },
          evidence: {
            basis: 'derived',
            sources: [],
            note: 'Logical endpoint grouping from the existing cable schedule; count is allocated links, not independently verified physical port inventory.',
          },
        });
      ports.get(id)!.count += link.count;
      return id;
    });
    doc.connections.push({
      id: link.id,
      name: link.label,
      from: endpoints[0],
      to: endpoints[1],
      medium: 'data',
      kind: 'aggregate',
      quantity: link.count,
      capacity: { value: link.rate, unit: 'Gb/s' },
      evidence: reference,
      extensions: {
        [ns]: {
          fabric: link.fabric,
          ...(link.protocol ? { protocol: link.protocol } : {}),
        },
      },
    });
  }
  doc.interfaces = [...ports.values()];
  doc.groups.push({
    id: 'cluster',
    name: model.title,
    assetIds: model.hardware.map((h) => h.id),
  });
  return doc;
}

// The legacy renderer is a projection of supported records, never the file format.
// Fail explicitly rather than discarding unfamiliar assets, geometry or connections.
export function clusterFromInfrastructure(doc: Infrastructure): ClusterModel {
  const legacy = record(doc.extensions?.[ns]);
  if (!legacy || legacy.catalogRevision !== CATALOG_REVISION)
    throw new Error(
      'This model uses the general infrastructure inspector. Its equipment definitions do not match this 3D catalog revision.',
    );
  const racks: Rack[] = [],
    hardware: Hardware[] = [],
    links: Link[] = [];
  const root = doc.assets.find(
    (a) => record(a.extensions?.[ns])?.role === 'root',
  );
  if (!root || doc.assets.filter((a) => !a.parentId).length !== 1)
    throw new Error(
      'This model has a general facility hierarchy. Explore it in Infrastructure.',
    );
  for (const a of doc.assets) {
    const meta = record(a.extensions?.[ns]);
    if (!meta)
      throw new Error(
        `${a.name} has no catalog rendering; explore it in Infrastructure.`,
      );
    if (meta.role === 'root') continue;
    if (meta.role === 'component') {
      if (
        !doc.assets.some(
          (parent) =>
            parent.id === a.parentId &&
            record(parent.extensions?.[ns])?.role === 'hardware',
        )
      )
        throw new Error(
          'Nested equipment uses the general infrastructure inspector.',
        );
      continue;
    }
    if (meta.role === 'rack') {
      if (
        a.parentId !== root.id ||
        a.placement?.rotation ||
        a.placement?.position?.[1] ||
        a.placement?.position?.[2]
      )
        throw new Error(
          'This spatial layout uses the general infrastructure inspector.',
        );
      const t = assetType(doc, a),
        height = [...t.facts, ...a.facts].findLast(
          (f) => f.key === 'rack.units',
        );
      if (
        typeof height?.value !== 'number' ||
        typeof meta.rackRole !== 'string' ||
        typeof meta.color !== 'string'
      )
        throw new Error('Rack details are incomplete for the 3D view.');
      racks.push({
        id: a.id,
        name: a.name,
        role: meta.rackRole,
        units: height.value,
        x: a.placement?.position?.[0] ?? 0,
        color: meta.color,
        ...(typeof meta.depth === 'number' ? { depth: meta.depth } : {}),
        ...(meta.mount === '19-inch' || meta.mount === 'NVL72'
          ? { mount: meta.mount }
          : {}),
      });
    } else if (meta.role === 'hardware') {
      const t = assetType(doc, a),
        tm = record(t.extensions?.[ns]);
      const profile = CATALOG.find((p) => p.id === tm?.profileId);
      if (
        !profile ||
        !a.parentId ||
        !a.placement?.rack ||
        typeof meta.kind !== 'string' ||
        typeof meta.model !== 'string' ||
        a.representation !== 'individual'
      )
        throw new Error(`${a.name} uses the general infrastructure inspector.`);
      hardware.push({
        id: a.id,
        name: a.name,
        model: meta.model,
        kind: meta.kind as Hardware['kind'],
        rack: a.parentId,
        u: a.placement.rack.u,
        height: a.placement.rack.height,
        ...(typeof meta.profile === 'string' ? { profile: meta.profile } : {}),
        ...(typeof meta.index === 'number' ? { index: meta.index } : {}),
        ...(typeof meta.fabric === 'string'
          ? { fabric: meta.fabric as Hardware['fabric'] }
          : {}),
      });
    } else
      throw new Error(`${a.name} uses the general infrastructure inspector.`);
  }
  const interfaces = new Map(doc.interfaces.map((p) => [p.id, p]));
  for (const c of doc.connections) {
    const meta = record(c.extensions?.[ns]),
      from = interfaces.get(c.from),
      to = interfaces.get(c.to);
    if (
      !meta ||
      c.medium !== 'data' ||
      !from ||
      !to ||
      c.capacity?.unit !== 'Gb/s' ||
      !['compute', 'frontend', 'storage'].includes(String(meta.fabric))
    )
      throw new Error(
        'This connection uses the general infrastructure inspector.',
      );
    links.push({
      id: c.id,
      from: from.assetId,
      to: to.assetId,
      fabric: meta.fabric as Link['fabric'],
      count: c.quantity,
      rate: c.capacity.value,
      label: c.name,
      ...(meta.protocol === 'ethernet' || meta.protocol === 'infiniband'
        ? { protocol: meta.protocol }
        : {}),
    });
  }
  const model: ClusterModel = {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    racks,
    hardware,
    links,
    ...(typeof legacy.custom === 'boolean' ? { custom: legacy.custom } : {}),
  };
  // Only trusted, current vendor reference plans can enter the legacy renderer.
  // Arbitrary extension payloads remain readable data in Infrastructure.
  if (legacy.fabricReferences !== undefined) {
    const expectedReferences = withReferenceFabrics(model).fabricReferences;
    const a = exportInfrastructure({
      ...doc,
      extensions: { references: legacy.fabricReferences },
    });
    const b = exportInfrastructure({
      ...doc,
      extensions: { references: expectedReferences ?? null },
    });
    if (a !== b)
      throw new Error(
        'This file includes a different reference fabric revision. Explore its records in Infrastructure.',
      );
    model.fabricReferences = expectedReferences;
  }
  const errors = validateConfiguration(model).issues.filter(
    (i) => i.level === 'error',
  );
  if (errors.length) throw new Error(errors[0].message);
  // Catalog-specific 3D must never silently override changed type/instance facts.
  const expected = infrastructureFromCluster(model);
  if (
    exportInfrastructure({ ...doc, title: model.title }) !==
    exportInfrastructure(expected)
  )
    throw new Error(
      'This model includes edits beyond the current 3D catalog. All details remain available in Infrastructure.',
    );
  return model;
}

export function importInfrastructure(text: string): Infrastructure {
  if (new TextEncoder().encode(text).length > 10_000_000)
    throw new Error('Infrastructure file exceeds 10 MB.');
  const header = record(JSON.parse(text));
  if (header?.format === 'rack-explore' && header.version === 1)
    return infrastructureFromCluster(importModel(text));
  return readInfrastructure(text);
}

export function rackHardwareId(asset: Asset): string | null {
  const role = record(asset.extensions?.[ns])?.role;
  return role === 'hardware' || role === 'component' ? asset.id : null;
}

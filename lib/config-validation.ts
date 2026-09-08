import { CATALOG, profileFor, CATALOG_DATE } from './catalog.ts';
import { childrenOf, resolveHardware, type ClusterModel } from './hardware.ts';
import { placementError } from './rack-builder.ts';
import {
  networkErrors,
  networkCapability,
  connectionProtocol,
} from './network-validation.ts';

export type ConfigIssue = {
  level: 'error' | 'review';
  area: string;
  message: string;
  hardwareId?: string;
};
export type ConfigCheck = {
  area: string;
  status: 'pass' | 'review' | 'error';
  detail: string;
};
export type ConfigReport = {
  status: 'errors' | 'checks-pass';
  checkedOn: string;
  checks: ConfigCheck[];
  issues: ConfigIssue[];
  deviceCount: number;
  componentCount: number;
  sourceCount: number;
};

export function validateConfiguration(model: ClusterModel): ConfigReport {
  const issues: ConfigIssue[] = [];
  const issue = (
    level: ConfigIssue['level'],
    area: string,
    message: string,
    hardwareId?: string,
  ) => issues.push({ level, area, message, hardwareId });
  let componentCount = 0;
  const sources = new Set<string>();
  const rackIds = model.racks.map((r) => r.id),
    hardwareIds = model.hardware.map((h) => h.id);
  if (
    new Set(rackIds).size !== rackIds.length ||
    new Set(hardwareIds).size !== hardwareIds.length
  )
    issue('error', 'Placement', 'Rack and device identifiers must be unique.');
  if (!model.racks.length)
    issue('error', 'Placement', 'At least one rack is required.');
  for (const r of model.racks)
    if (![42, 48].includes(r.units) || !Number.isFinite(r.x))
      issue(
        'error',
        'Placement',
        `${r.name}: invalid rack height or position.`,
      );
  const safeHardware = model.hardware.filter((h) => {
    if (
      (h.profile && !CATALOG.some((p) => p.id === h.profile)) ||
      (!h.profile && !['dgx', 'qm9700', 'sn4600c', 'ai400x2'].includes(h.kind))
    ) {
      issue(
        'error',
        'Components',
        `${h.name}: unknown hardware profile.`,
        h.id,
      );
      return false;
    }
    return true;
  });
  for (const h of safeHardware) {
    const p = profileFor(h),
      kids = childrenOf(h);
    const placement = placementError(model, p, h.rack, h.u, h.id);
    if (placement) issue('error', 'Placement', `${h.name}: ${placement}`, h.id);
    if (h.height !== p.units)
      issue(
        'error',
        'Placement',
        `${h.name}: chassis height does not match its ${p.units}U profile.`,
        h.id,
      );
    if (!(p.depth > 0) || (p.width !== undefined && !(p.width > 0)))
      issue(
        'error',
        'Placement',
        `${h.name}: invalid chassis dimensions.`,
        h.id,
      );
    if (
      !p.parts.length ||
      p.parts.some(
        (part) =>
          !Number.isInteger(part.count) ||
          part.count < 1 ||
          !part.specs.length ||
          !part.description ||
          !part.population,
      )
    )
      issue(
        'error',
        'Components',
        `${h.name}: incomplete component definitions.`,
        h.id,
      );
    if (new Set(p.parts.map((part) => part.key)).size !== p.parts.length)
      issue(
        'error',
        'Components',
        `${h.name}: duplicate component keys.`,
        h.id,
      );
    if (kids.some((c) => !resolveHardware(c.id, model)))
      issue(
        'error',
        'Components',
        `${h.name}: an internal component cannot be inspected.`,
        h.id,
      );
    if (kids.filter((c) => c.kind === 'gpu').length !== p.gpuCount)
      issue(
        'error',
        'Components',
        `${h.name}: accelerator count disagrees with its profile.`,
        h.id,
      );
    componentCount += kids.length;
    for (const s of p.sources) {
      if (!s.title || !s.url.startsWith('https://'))
        issue(
          'error',
          'Sources',
          `${h.name}: missing manufacturer source.`,
          h.id,
        );
      else sources.add(s.url);
    }
    if (!p.sources.length)
      issue('error', 'Sources', `${h.name}: no manufacturer source.`, h.id);
    const configurable = p.parts
      .filter((part) => part.population === 'slots')
      .map((part) => part.title);
    if (configurable.length)
      issue(
        'review',
        'Components',
        `${h.name}: select the actual population and SKUs for ${configurable.join(', ')}.`,
        h.id,
      );
    const representative = p.parts
      .filter((part) => part.population === 'representative')
      .map((part) => part.title);
    if (
      representative.length &&
      (p.status !== 'Supplied' ||
        safeHardware.find((item) => profileFor(item).id === p.id)?.id === h.id)
    )
      issue(
        'review',
        'Components',
        `${h.name}: explanatory blocks include ${representative.join(', ')}; their counts are not an installed bill of materials.`,
        h.id,
      );
    if (networkCapability(h).unselectedSlots)
      issue(
        'review',
        'Networking',
        `${h.name}: adapters are unpopulated slots; protocol and port capacity require an adapter selection.`,
        h.id,
      );
    const options = p.parts
      .filter((part) => part.population === 'option')
      .map((part) => part.title);
    if (options.length)
      issue(
        'review',
        'Components',
        `${h.name}: ${options.join(', ')} use the selected reference option; confirm the ordered SKU and population.`,
        h.id,
      );
    if (p.id === 'sm-b300')
      issue(
        'review',
        'Placement',
        `${h.name}: the manufacturer lists conflicting inch and millimeter depths. 896.8 mm is shown provisionally; confirm chassis and rail dimensions.`,
        h.id,
      );
  }
  for (const rack of model.racks.filter((r) => r.mount === 'NVL72')) {
    const hardware = safeHardware.filter((h) => h.rack === rack.id);
    const trays = hardware.filter((h) =>
      ['gb200-tray', 'gb300-tray'].includes(profileFor(h).id),
    );
    const population = (id: string) =>
      hardware.filter((h) => profileFor(h).id === id).length;
    if (
      rack.units !== 48 ||
      hardware.length !== 37 ||
      trays.length !== 18 ||
      new Set(trays.map((h) => profileFor(h).id)).size !== 1 ||
      population('nvl-switch') !== 9 ||
      population('nvl-power') !== 8 ||
      population('sn2201') !== 2
    )
      issue(
        'error',
        'Placement',
        `${rack.name}: the integrated NVL72 template requires one generation of 18 compute trays, 9 NVLink trays, 8 power shelves and 2 management switches in 48U.`,
      );
    const expected: Record<string, number[]> = {
      compute: [
        11, 12, 13, 14, 15, 16, 17, 18, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
      ],
      'nvl-switch': [19, 20, 21, 22, 23, 24, 25, 26, 27],
      'nvl-power': [6, 7, 8, 9, 39, 40, 41, 42],
      sn2201: [44, 45],
    };
    for (const [id, positions] of Object.entries(expected)) {
      const actual = (
        id === 'compute'
          ? trays
          : hardware.filter((h) => profileFor(h).id === id)
      )
        .map((h) => h.u)
        .sort((a, b) => a - b);
      if (JSON.stringify(actual) !== JSON.stringify(positions))
        issue(
          'error',
          'Placement',
          `${rack.name}: ${id} positions disagree with the documented NVL72 rack template.`,
        );
    }
  }
  if (safeHardware.length === model.hardware.length)
    for (const error of networkErrors(model))
      issue('error', 'Networking', error);
  if (!model.hardware.length)
    issue(
      'review',
      'Components',
      'Empty rack: add hardware before reviewing a configuration.',
    );
  if (model.links.length) {
    issue(
      'review',
      'Networking',
      'Port counts, rate ceilings and protocol compatibility are checked. Numbered endpoint ports, breakout modes, optics, cables and firmware still require qualification.',
    );
    if (
      safeHardware.length === model.hardware.length &&
      model.links.some((l) => !connectionProtocol(model, l))
    )
      issue(
        'review',
        'Networking',
        'Some links support both Ethernet and InfiniBand. Select a protocol before treating the fabric as a specific configuration.',
      );
  } else
    issue(
      'review',
      'Networking',
      'No rack cable schedule is configured. A vendor reference diagram does not imply installed rack connections.',
    );
  if (model.fabricReferences)
    for (const [fabric, ref] of Object.entries(model.fabricReferences)) {
      const ids = new Set(ref.nodes.map((n) => n.id));
      if (
        !ref.sources.length ||
        ids.size !== ref.nodes.length ||
        ref.connections.some(
          (c) =>
            !ids.has(c.from) ||
            !ids.has(c.to) ||
            !c.sources.length ||
            (c.kind === 'link' && (!c.count || !c.rateGbps)),
        )
      )
        issue(
          'error',
          'Fabric references',
          `${fabric}: incomplete reference topology or evidence.`,
        );
      if (ref.status === 'Interface specifications')
        issue(
          'review',
          'Fabric references',
          `${fabric}: only interfaces are verified; a complete deployment design is not recorded.`,
        );
    }
  issue(
    'review',
    'Power and cooling',
    'Power paths are planning scenarios. Facility feed capacity, redundancy, cooling flow, heat rejection, weight and service clearances need a site-specific design.',
  );
  issue(
    'review',
    'Components',
    'Internal board geometry and routing are functional illustrations. Service CAD, revision-specific board layouts and unlisted auxiliary parts remain unverified.',
  );
  const supplied = safeHardware.some(
    (h) => profileFor(h).status === 'Supplied',
  );
  if (supplied) {
    issue(
      'review',
      'Placement',
      'Supplied configuration: 8U height and air cooling are supplied; rack count, depth, mounting details and positions remain illustrative. Passing geometric checks only validates the display arrangement.',
    );
    issue(
      'review',
      'Components',
      'Supplied configuration: 24 × 96 GB DDR5-6400 DIMMs are specified. Confirm the chassis / board SKUs and PSU / fan inventory. RAID-1 boot capacity is 1.92 TB usable per node before overhead.',
    );
    issue(
      'review',
      'Networking',
      'Eight ConnectX-8 compute and two single-port ConnectX-7 storage adapters are supplied per node. Confirm ConnectX-8 port/breakout mode, GPU affinity, switch models, cable endpoints and RoCE configuration.',
    );
    issue(
      'review',
      'Components',
      '150 TB WEKA is a shared service capacity. Raw versus usable, backend hardware, data protection and overlap with local NVMe remain unconfirmed.',
    );
  }
  const details: Record<string, string> = {
    Placement: `${model.racks.length} racks · U bounds, overlap, mounting family and chassis heights checked`,
    Components: `${model.hardware.length} devices · ${componentCount} inspectable modules or positions`,
    Sources: supplied
      ? `${sources.size} source references · supplied configuration recorded 8 September 2026`
      : `${sources.size} manufacturer references · catalog reviewed ${CATALOG_DATE}`,
    Networking: `${model.links.length} configured link groups · endpoint and capacity checks`,
    'Fabric references': model.fabricReferences
      ? Object.entries(model.fabricReferences)
          .map(([f, r]) => `${f}: ${r.status.toLowerCase()}`)
          .join(' · ')
      : 'User-authored layout; no vendor deployment certification',
    'Power and cooling':
      'Source-to-component model available; installation qualification remains open',
  };
  const checks = Object.entries(details).map(
    ([area, detail]): ConfigCheck => ({
      area,
      detail,
      status: issues.some((i) => i.area === area && i.level === 'error')
        ? 'error'
        : issues.some((i) => i.area === area)
          ? 'review'
          : 'pass',
    }),
  );
  return {
    status: issues.some((i) => i.level === 'error') ? 'errors' : 'checks-pass',
    checkedOn: CATALOG_DATE,
    checks,
    issues,
    deviceCount: model.hardware.length,
    componentCount,
    sourceCount: sources.size,
  };
}

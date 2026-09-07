import { profileFor } from './catalog.ts';
import type { ClusterModel, Hardware, Link } from './hardware.ts';

export type Transport = 'ethernet' | 'infiniband';
type PortPool = {
  ports: number;
  maxGbps: number;
  protocols: Transport[];
  aggregateGbps?: number;
  minGbps?: number;
};
export type NetworkCapability = { pools: PortPool[]; unselectedSlots?: number };
const both: Transport[] = ['ethernet', 'infiniband'];
const pool = (
  ports: number,
  maxGbps: number,
  protocols = both,
  aggregateGbps?: number,
): PortPool => ({ ports, maxGbps, protocols, aggregateGbps });

// High-speed endpoint capacity only. These are ceilings, not qualified cable modes.
export function networkCapability(h: Hardware): NetworkCapability {
  const id = profileFor(h).id;
  switch (id) {
    case 'dgx-h100':
    case 'dgx-h200':
      return {
        pools: [
          pool(8, 400),
          pool(4, 400, both, 800),
          pool(2, 100, ['ethernet']),
        ],
      };
    case 'dgx-b200':
      return { pools: [pool(8, 400), pool(4, 400, both, 800)] };
    case 'dgx-b300':
      return { pools: [pool(8, 800), pool(4, 400, both, 800)] };
    case 'dell-xe9780':
      return { pools: [pool(8, 800), pool(2, 400, ['ethernet'])] };
    case 'lenovo-sr680a-v4':
      return {
        pools: [pool(16, 800, ['ethernet'], 6400), pool(2, 400, ['ethernet'])],
      };
    case 'hpe-xd685':
      return { pools: [], unselectedSlots: 12 };
    case 'sm-mi350x':
    case 'sm-mi355x':
      return { pools: [pool(8, 400, ['ethernet'])] };
    case 'sm-b300':
      return { pools: [pool(8, 800)] };
    case 'gb200-tray':
      return { pools: [pool(4, 400), pool(4, 400, both, 800)] };
    case 'gb300-tray':
      return { pools: [pool(4, 800), pool(2, 400, ['ethernet'])] };
    case 'qm9700':
      return { pools: [pool(64, 400, ['infiniband'])] };
    case 'q3400':
      return { pools: [{ ...pool(144, 800, ['infiniband']), minGbps: 400 }] };
    case 'sn4600c':
      return { pools: [pool(64, 100, ['ethernet'])] };
    case 'sn5600':
      return { pools: [pool(64, 800, ['ethernet'])] };
    case 'sn2201':
      return { pools: [pool(48, 1, ['ethernet']), pool(4, 100, ['ethernet'])] };
    case 'ai400x2':
      return { pools: [pool(8, 200)] };
    default:
      return { pools: [] };
  }
}
export function portBudget(h: Hardware) {
  const c = networkCapability(h);
  return c.pools.reduce((n, p) => n + p.ports, 0) + (c.unselectedSlots ?? 0);
}
export function compatibleTransports(
  a: Hardware,
  b: Hardware,
  rate: number,
): Transport[] {
  const supports = (h: Hardware, t: Transport) => {
    const c = networkCapability(h);
    return (
      !!c.unselectedSlots ||
      c.pools.some(
        (p) =>
          p.maxGbps >= rate &&
          (p.minGbps ?? 0) <= rate &&
          p.protocols.includes(t),
      )
    );
  };
  return both.filter((t) => supports(a, t) && supports(b, t));
}
export function networkErrors(model: ClusterModel): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const link of model.links) {
    if (link.protocol !== undefined && !both.includes(link.protocol))
      errors.push(`${link.id}: choose Ethernet or InfiniBand.`);
    if (ids.has(link.id)) errors.push(`Duplicate connection ID: ${link.id}.`);
    ids.add(link.id);
    const a = model.hardware.find((h) => h.id === link.from),
      b = model.hardware.find((h) => h.id === link.to);
    if (!a || !b || a.id === b.id) {
      errors.push(`${link.id}: choose two existing, different devices.`);
      continue;
    }
    if (
      !['compute', 'frontend', 'storage'].includes(link.fabric) ||
      ![100, 200, 400, 800].includes(link.rate) ||
      !Number.isInteger(link.count) ||
      link.count < 1 ||
      link.count > 144
    ) {
      errors.push(`${link.id}: invalid fabric, rate or link count.`);
      continue;
    }
    const transports = compatibleTransports(a, b, link.rate);
    if (
      !transports.length ||
      (link.protocol && !transports.includes(link.protocol))
    )
      errors.push(
        `${a.name} → ${b.name}: no compatible ${link.protocol ?? 'Ethernet / InfiniBand'} interface at ${link.rate} Gb/s within the catalog limits.`,
      );
  }
  for (const h of model.hardware) {
    const c = networkCapability(h),
      links = model.links.filter((l) => l.from === h.id || l.to === h.id);
    const used = links.reduce((n, l) => n + l.count, 0);
    if (used > portBudget(h))
      errors.push(
        `${h.name}: ${used} links exceed ${portBudget(h)} available logical ports / adapter slots.`,
      );
    if (c.unselectedSlots) continue;
    // Check each rate threshold so slower I/O ports cannot satisfy fast GPU links.
    for (const rate of [100, 200, 400, 800]) {
      const demand = links
        .filter((l) => l.rate >= rate)
        .reduce((n, l) => n + l.count, 0);
      const capacity = c.pools
        .filter((p) => p.maxGbps >= rate)
        .reduce(
          (n, p) =>
            n +
            Math.min(
              p.ports,
              Math.floor((p.aggregateGbps ?? p.ports * p.maxGbps) / rate),
            ),
          0,
        );
      if (demand > capacity)
        errors.push(
          `${h.name}: ${demand} links at ${rate} Gb/s or above exceed the ${capacity}-port rate budget.`,
        );
    }
    const demand = links.reduce((n, l) => n + l.count * l.rate, 0),
      capacity = c.pools.reduce(
        (n, p) => n + (p.aggregateGbps ?? p.ports * p.maxGbps),
        0,
      );
    if (demand > capacity)
      errors.push(
        `${h.name}: ${demand} Gb/s of nominal links exceed ${capacity} Gb/s of interface capacity.`,
      );
    for (const t of both) {
      const relevant = links.filter((l) => {
        const other = model.hardware.find(
          (x) => x.id === (l.from === h.id ? l.to : l.from),
        );
        const inferred = other ? compatibleTransports(h, other, l.rate) : [];
        return (
          l.protocol === t ||
          (!l.protocol && inferred.length === 1 && inferred[0] === t)
        );
      });
      const available = c.pools
        .filter((p) => p.protocols.includes(t))
        .reduce((n, p) => n + p.ports, 0);
      if (relevant.reduce((n, l) => n + l.count, 0) > available)
        errors.push(`${h.name}: ${t} links exceed the protocol's port budget.`);
    }
  }
  return [...new Set(errors)];
}

export function connectionProtocol(model: ClusterModel, link: Link) {
  if (link.protocol) return link.protocol;
  const a = model.hardware.find((h) => h.id === link.from),
    b = model.hardware.find((h) => h.id === link.to);
  const choices = a && b ? compatibleTransports(a, b, link.rate) : [];
  return choices.length === 1 ? choices[0] : undefined;
}

import type { Profile } from './catalog.ts';
import type { Hardware } from './hardware.ts';

export type Point3 = [number, number, number];

// Service-view separation, not OEM board coordinates. Populations stay in the catalog.
export function componentPosition(
  profile: Profile,
  item: Hardware,
  exploded: boolean,
): Point3 | null {
  const part = profile.parts.find((p) => p.key === item.part);
  if (!part) return null;
  const i = item.index ?? 0,
    count = part.count;
  const hostX = exploded ? 0.52 : 0;
  switch (item.kind) {
    case 'cpu':
      return [
        hostX + (i - (count - 1) / 2) * 0.14,
        exploded ? 0.57 : 0.28,
        0.19,
      ];
    case 'memory': {
      const banks = count > 8 ? 4 : 2,
        columns = Math.ceil(count / banks);
      const bank = Math.floor(i / columns),
        column = i % columns;
      const offsets = banks === 4 ? [-0.19, -0.15, 0.15, 0.19] : [-0.15, 0.15];
      return [
        hostX + offsets[bank],
        exploded ? 0.56 : 0.28,
        0.19 + (column - (columns - 1) / 2) * 0.034,
      ];
    }
    case 'controller':
      if (item.part === 'bmc') return [hostX, exploded ? 0.54 : 0.29, 0.32];
      return [
        exploded ? 0.5 : 0,
        exploded ? 0.35 : 0.29,
        exploded ? 0.02 : 0.06,
      ];
    case 'nic': {
      const host = item.part !== 'nic';
      return [
        item.part === 'management' ? 0.16 : (i - (count - 1) / 2) * 0.055,
        exploded ? 0.33 : 0.31,
        exploded ? (host ? 0.88 : -0.57) : host ? 0.35 : -profile.depth * 0.42,
      ];
    }
    case 'nvme': {
      const boot = item.part === 'boot',
        columns = Math.min(8, count),
        row = Math.floor(i / columns);
      return [
        ((i % columns) - (columns - 1) / 2) * 0.057 +
          (boot && exploded ? 0.52 : 0),
        exploded ? 0.28 : 0.24 + row * 0.05,
        exploded
          ? boot
            ? 0.57
            : 0.5 + row * 0.15 + (item.part === 'sata' ? 0.15 : 0)
          : profile.depth * 0.39 +
            (boot ? -0.12 : item.part === 'sata' ? -0.25 : 0),
      ];
    }
    case 'psu': {
      const columns = Math.min(6, count),
        row = Math.floor(i / columns);
      return [
        ((i % columns) - (columns - 1) / 2) * (exploded ? 0.09 : 0.074) +
          (exploded ? 0.99 : 0),
        exploded ? 0.29 : 0.27 + row * 0.04,
        exploded ? -0.3 + row * 0.2 : -profile.depth * 0.28,
      ];
    }
    case 'fan':
      if (exploded)
        return [
          -0.74 + ((i % 5) - 2) * 0.095,
          0.28 + Math.floor(i / 5) * 0.095,
          0.06,
        ];
      return null; // Assembled front/middle/rear positions remain chassis-specific.
    default:
      return null;
  }
}

export function visibleComponentIds(
  children: Hardware[],
  selected: string | null,
  isolated: boolean,
): string[] {
  return isolated && children.some((c) => c.id === selected)
    ? [selected!]
    : children
        .filter((c) => c.kind !== 'fan' || c.id === selected)
        .map((c) => c.id);
}

// Fit the bounding sphere to the narrower field of view, leaving room for controls.
export function componentFitDistance(
  size: Point3,
  aspect: number,
  verticalFovDegrees = 34,
): number {
  const vertical = (verticalFovDegrees * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  const halfFov = Math.min(vertical, horizontal);
  return Math.max(0.24, (Math.hypot(...size) / 2 / Math.sin(halfFov)) * 1.18);
}

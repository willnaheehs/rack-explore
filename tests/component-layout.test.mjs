import test from 'node:test';
import assert from 'node:assert/strict';
import { VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import { childrenOf } from '../lib/hardware.ts';
import { modelForProfile } from '../lib/rack-builder.ts';
import {
  componentPosition,
  componentFitDistance,
  visibleComponentIds,
} from '../lib/component-layout.ts';

const profiles = VISIBLE_CATALOG.filter((p) => p.status === 'Documented');
const overlap = (a, b, size) =>
  a.every((n, axis) => Math.abs(n - b[axis]) < size[axis] - 1e-6);

test('all catalog modules can be isolated and the full assembly restored without losing inventory', () => {
  for (const p of profiles)
    for (const h of modelForProfile(p.id).hardware) {
      const kids = childrenOf(h),
        ids = kids.map((c) => c.id);
      for (const child of kids) {
        assert.deepEqual(visibleComponentIds(kids, child.id, true), [child.id]);
        assert.deepEqual(visibleComponentIds(kids, child.id, false), ids);
      }
      assert.deepEqual(visibleComponentIds(kids, h.id, true), ids);
      assert.deepEqual(
        childrenOf(h).map((c) => c.id),
        ids,
      );
    }
});

test('DIMMs, fan modules, PSUs and data bays have room for their rendered bodies', () => {
  // Rendered body envelopes; the old DIMM rows overlapped and 16-drive layouts used too little pitch.
  const dimensions = {
    memory: [0.009, 0.049, 0.022],
    fan: [0.073, 0.073, 0.02],
    psu: [0.062, 0.04, 0.17],
    nvme: [0.047, 0.04, 0.12],
  };
  for (const p of profiles)
    for (const h of modelForProfile(p.id).hardware) {
      const profile = profileFor(h),
        kids = childrenOf(h);
      for (const [kind, size] of Object.entries(dimensions)) {
        const group = kids.filter((c) => c.kind === kind);
        for (const exploded of [true, false]) {
          if (kind === 'fan' && !exploded) continue;
          const positions = group.map((c) =>
            componentPosition(profile, c, exploded),
          );
          for (let i = 0; i < positions.length; i++) {
            assert.ok(
              positions[i].every(Number.isFinite),
              `${profile.id}: ${group[i].id}`,
            );
            for (let j = i + 1; j < positions.length; j++)
              assert.ok(
                !overlap(positions[i], positions[j], size),
                `${profile.id} ${exploded ? 'exploded' : 'assembled'}: ${group[i].id} overlaps ${group[j].id}`,
              );
          }
        }
      }
    }
});

test('BMC and fan banks no longer occupy the accelerator tray in the exploded view', () => {
  for (const id of ['dgx-h100', 'hpe-xd685']) {
    const h = modelForProfile(id).hardware[0],
      profile = profileFor(h),
      kids = childrenOf(h);
    const bmc = componentPosition(
      profile,
      kids.find((c) => c.part === 'bmc'),
      true,
    );
    // GPU tray spans x=-0.22..0.22; BMC is now a small controller on the host board.
    assert.ok(bmc[0] - 0.075 / 2 > 0.22);
    for (const fan of kids.filter((c) => c.kind === 'fan'))
      assert.ok(componentPosition(profile, fan, true)[0] + 0.073 / 2 < -0.22);
  }
});

test('camera fitting reserves space in both narrow and wide component viewports', () => {
  const size = [2.3, 0.65, 1.6],
    radius = Math.hypot(...size) / 2;
  let wide;
  for (const aspect of [2, 1, 0.5, 0.3]) {
    const distance = componentFitDistance(size, aspect);
    const vertical = (34 * Math.PI) / 360,
      horizontal = Math.atan(Math.tan(vertical) * aspect);
    assert.ok(distance * Math.sin(Math.min(vertical, horizontal)) > radius);
    if (aspect === 2) wide = distance;
    else assert.ok(distance >= wide);
  }
  assert.ok(componentFitDistance([0.005, 0.01, 0.05], 1) >= 0.24);
});

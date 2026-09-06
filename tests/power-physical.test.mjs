import test from 'node:test';
import assert from 'node:assert/strict';
import { VISIBLE_CATALOG, profileFor } from '../lib/catalog.ts';
import { U_METERS } from '../lib/hardware.ts';
import { modelForProfile, blankModel } from '../lib/rack-builder.ts';
import {
  initialPowerSettings,
  powerGraph,
  calculatePower,
} from '../lib/power.ts';
import { physicalPowerLayout } from '../lib/power-physical.ts';
test('physical parts and routes correspond to real stages at every power scale', () => {
  for (const profile of VISIBLE_CATALOG.filter(
    (p) => p.status === 'Documented',
  )) {
    const model = modelForProfile(profile.id),
      settings = initialPowerSettings(model);
    for (const scope of ['facility', 'rack', 'board']) {
      const s = { ...settings, scope },
        layout = physicalPowerLayout(model, s),
        graph = powerGraph(model, s);
      const ids = new Set(graph.nodes.map((n) => n.id));
      assert.equal(
        new Set(layout.parts.map((p) => p.id)).size,
        layout.parts.length,
      );
      for (const p of layout.parts) {
        assert.ok(ids.has(p.stageId), `${profile.id}/${p.id}`);
        assert.ok(p.size.every((n) => Number.isFinite(n) && n > 0));
        assert.ok(p.position.every(Number.isFinite));
      }
      for (const e of layout.routes) {
        assert.ok(
          graph.edges.some((g) => g.from === e.from && g.to === e.to),
          `${profile.id}/${e.id}`,
        );
        assert.ok(e.points.length >= 2);
        assert.ok(e.points.flat().every(Number.isFinite));
      }
    }
  }
});
test('physical rack elevations preserve U positions and PSU or shelf populations', () => {
  for (const id of ['dgx-h100', 'dgx-b300', 'gb200-nvl72', 'gb300-nvl72']) {
    const model = modelForProfile(id),
      s = initialPowerSettings(model),
      layout = physicalPowerLayout(model, s),
      c = calculatePower(model, s);
    for (const h of model.hardware) {
      const part = layout.parts.find((p) => p.id === h.id);
      assert.ok(part);
      assert.ok(
        Math.abs(part.position[1] - (0.12 + (h.u - 1) * U_METERS)) < 1e-9,
      );
      assert.ok(part.size[1] < h.height * U_METERS);
    }
    if (c.nvl) {
      assert.equal(layout.parts.filter((p) => p.form === 'shelf').length, 8);
      assert.equal(
        layout.parts
          .filter((p) => p.form === 'shelf')
          .reduce((n, p) => n + p.count, 0),
        48,
      );
    } else
      assert.equal(
        layout.parts
          .filter((p) => p.form === 'psu')
          .reduce((n, p) => n + p.count, 0),
        c.count,
      );
  }
});
test('physical board load populations and management AC bypass preserve the power model', () => {
  for (const id of ['dgx-h100', 'ai400x2', 'gb300-nvl72']) {
    const model = modelForProfile(id),
      s = { ...initialPowerSettings(model), scope: 'board' },
      c = calculatePower(model, s),
      layout = physicalPowerLayout(model, s);
    for (const g of c.allocation)
      assert.equal(
        layout.parts.find((p) => p.stageId === `load-${g.key}`).count,
        g.items.length,
      );
  }
  const model = modelForProfile('gb300-nvl72'),
    mgmt = model.hardware.find((h) => profileFor(h).id === 'sn2201');
  const layout = physicalPowerLayout(model, {
    ...initialPowerSettings(model, mgmt.rack, mgmt.id),
    scope: 'rack',
  });
  assert.ok(layout.routes.some((r) => r.from === 'pdu-a' && r.to === 'device'));
  assert.ok(
    !layout.routes.some((r) => r.from === 'dc-bus' && r.to === 'device'),
  );
  const empty = blankModel(),
    s = initialPowerSettings(empty);
  assert.equal(
    physicalPowerLayout(empty, { ...s, scope: 'board' }).parts.length,
    0,
  );
  assert.ok(
    !physicalPowerLayout(empty, s).parts.some(
      (p) => p.form === 'psu' || p.form === 'chassis' || p.form === 'busbar',
    ),
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { updateComponentVisibility } from '../lib/component-visibility.ts';

test('fan meshes leave rendering, picking and camera bounds unless individually selected', () => {
  const geometry = new BoxGeometry(1, 1, 1),
    material = new MeshBasicMaterial();
  const assembly = new Group(),
    context = new Group(),
    objects = new Map();
  assembly.add(context);
  context.add(new Mesh(geometry, material));
  const children = [
    { id: 'server/gpu/0', kind: 'gpu' },
    { id: 'server/fan/0', kind: 'fan' },
  ];
  for (const [index, child] of children.entries()) {
    const group = new Group(),
      nested = new Group(),
      mesh = new Mesh(geometry, material);
    mesh.userData.hardwareId = child.id;
    nested.add(mesh);
    group.add(nested);
    group.position.x = index ? 10 : 0;
    objects.set(child.id, group);
    assembly.add(group);
  }
  const renderedIds = () => {
    const ids = [];
    assembly.traverseVisible((object) => {
      if (object.isMesh && object.userData.hardwareId)
        ids.push(object.userData.hardwareId);
    });
    return ids;
  };
  const update = (selected, isolated) =>
    updateComponentVisibility(objects, context, children, selected, isolated);
  const gpu = children[0].id,
    fan = children[1].id;
  for (let rebuild = 0; rebuild < 2; rebuild++) {
    // Rebuilt scene groups start visible; selection may still be the chassis.
    for (const object of objects.values()) object.visible = true;
    const bounds = update('server', false);
    assert.deepEqual(renderedIds(), [gpu]);
    assert.equal(objects.get(fan).visible, false); // Raycast eligibility uses this flag.
    assert.equal(context.visible, true);
    assert.equal(bounds.max.x, 0.5);
  }
  assert.equal(update(fan, false).max.x, 10.5);
  assert.deepEqual(renderedIds(), [gpu, fan]);
  assert.equal(update(gpu, true).max.x, 0.5);
  assert.deepEqual(renderedIds(), [gpu]);
  assert.equal(context.visible, false);
  assert.equal(update(fan, true).getCenter(new Vector3()).x, 10);
  assert.deepEqual(renderedIds(), [fan]);
  update('server', false);
  assert.deepEqual(renderedIds(), [gpu]);
  assert.equal(context.visible, true);
  geometry.dispose();
  material.dispose();
});

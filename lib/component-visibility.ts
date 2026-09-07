import { Box3, type Object3D } from 'three';
import type { Hardware } from './hardware.ts';
import { visibleComponentIds } from './component-layout.ts';

// Apply the same visibility to rendering, picking and camera framing.
export function updateComponentVisibility(
  objects: Map<string, Object3D>,
  context: Object3D,
  children: Hardware[],
  selected: string | null,
  isolated: boolean,
): Box3 {
  const visible = new Set(visibleComponentIds(children, selected, isolated));
  context.visible = !(isolated && selected !== null && visible.has(selected));
  const bounds = new Box3();
  if (context.visible) bounds.expandByObject(context);
  for (const [id, object] of objects) {
    object.visible = visible.has(id);
    if (object.visible) bounds.expandByObject(object);
  }
  return bounds;
}

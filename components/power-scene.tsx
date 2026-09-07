'use client';
import { createTapGesture } from '@/lib/tap-gesture';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Focus, RotateCcw, Plus, Minus, Box, ArrowUpRight } from 'lucide-react';
import {
  physicalPowerLayout,
  type PhysicalPowerPart,
  type Point3,
} from '@/lib/power-physical';
import {
  initialPowerSettings,
  powerGraph,
  traceAncestors,
  type PowerSettings,
} from '@/lib/power';
import type { ClusterModel } from '@/lib/hardware';
const COLORS = { a: '#8cbfff', b: '#f4b66b', dc: '#c3f16b', shared: '#b7c9d7' };
type Props = {
  model: ClusterModel;
  settings: PowerSettings;
  selected: string;
  motion: boolean;
  onSelect: (stageId: string, hardwareId?: string) => void;
  onUnavailable: () => void;
};
type SceneAPI = {
  sync: () => void;
  focus: () => void;
  fit: () => void;
  view: () => void;
  zoom: (factor: number) => void;
};
export default function PowerScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    current = useRef(props),
    api = useRef<SceneAPI | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Geometry changes only with the physical target. Load and source changes update materials in place.
  const { model, settings } = props;
  const rackId = settings.rackId,
    hardwareId = settings.hardwareId,
    scope = settings.scope;
  const layout = useMemo(
    () =>
      physicalPowerLayout(model, {
        ...initialPowerSettings(model, rackId, hardwareId),
        scope,
      }),
    [model, rackId, hardwareId, scope],
  );
  useEffect(() => {
    current.current = props;
    api.current?.sync();
  }, [props]);
  useEffect(() => {
    const element = host.current,
      labelLayer = labels.current;
    if (!element || !labelLayer) return;
    let renderer: THREE.WebGLRenderer;
    const fail = () => {
      setUnavailable(true);
      current.current.onUnavailable();
    };
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(fail);
      return;
    }
    const touchDevice = window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, touchDevice ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Physical power equipment. Drag to orbit and scroll to zoom. Use the named stage buttons below for keyboard inspection.',
    );
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.01, 100);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.1;
    orbit.maxPolarAngle = Math.PI * 0.49;
    orbit.minZoom = 0.4;
    orbit.maxZoom = 8;
    const target = new THREE.Vector3(...layout.target);
    orbit.target.copy(target);
    camera.position
      .copy(target)
      .add(
        new THREE.Vector3(
          scope === 'board' ? 2.6 : 4.7,
          scope === 'board' ? 7 : 3.5,
          scope === 'board' ? 4.5 : 6.3,
        ),
      );
    scene.add(new THREE.HemisphereLight('#e0edff', '#27312f', 2.5));
    const key = new THREE.DirectionalLight('#fff5e7', 4);
    key.position.set(-4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(touchDevice ? 1024 : 2048);
    const area = layout.span;
    Object.assign(key.shadow.camera, {
      left: -area,
      right: area,
      top: area,
      bottom: -area,
      near: 0.1,
      far: 30,
    });
    key.shadow.normalBias = 0.015;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#9abbdc', 3);
    rim.position.set(6, 5, -5);
    scene.add(rim);
    const mats = new Set<THREE.Material>();
    const geometrySet = new Set<THREE.BufferGeometry>();
    const mat = (
      color: string,
      metalness = 0.55,
      roughness = 0.42,
      opacity = 1,
    ) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      });
      mats.add(m);
      return m;
    };
    const steel = mat('#788b94', 0.8, 0.3),
      dark = mat('#283942'),
      black = mat('#111d25'),
      pcb = mat('#1e5749', 0.2, 0.72),
      copper = mat('#bd8d54', 0.75, 0.3),
      silver = mat('#a9b9bd', 0.8, 0.26);
    const body = mat('#526975', 0.68, 0.4),
      ghost = mat('#49616b', 0.7, 0.45, 0.32),
      cutaway = mat('#6a8490', 0.6, 0.35, 0.15);
    const box = (
      parent: THREE.Object3D,
      size: Point3,
      pos: Point3,
      m: THREE.Material,
    ) => {
      const geo = new THREE.BoxGeometry(...size);
      geometrySet.add(geo);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...pos);
      mesh.castShadow = !m.transparent;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (
      parent: THREE.Object3D,
      r: number,
      h: number,
      pos: Point3,
      m: THREE.Material,
      axis: 'y' | 'z' = 'y',
    ) => {
      const geo = new THREE.CylinderGeometry(r, r, h, 12);
      geometrySet.add(geo);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...pos);
      if (axis === 'z') mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const objects = new Map<string, THREE.Group>(),
      picks: THREE.Object3D[] = [],
      accents: { m: THREE.MeshStandardMaterial; stageId: string }[] = [],
      outlines: { box: THREE.BoxHelper; part: PhysicalPowerPart }[] = [],
      nameplates: {
        el: HTMLButtonElement;
        position: THREE.Vector3;
        part: PhysicalPowerPart;
      }[] = [];
    const stageGraph = powerGraph(model, {
      ...initialPowerSettings(model, rackId, hardwareId),
      scope,
    });
    const register = (group: THREE.Group, part: PhysicalPowerPart) => {
      // Batch metal details into a small number of draw calls per selectable part.
      group.updateWorldMatrix(true, true);
      const inv = group.matrixWorld.clone().invert(),
        batches = new Map<THREE.Material, THREE.BufferGeometry[]>(),
        originals: THREE.Mesh[] = [];
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
          const geo = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
          geo.applyMatrix4(
            new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld),
          );
          const batch = batches.get(o.material) ?? [];
          batch.push(geo);
          batches.set(o.material, batch);
          originals.push(o);
        }
      });
      originals.forEach((o) => {
        o.removeFromParent();
        o.geometry.dispose();
        geometrySet.delete(o.geometry);
      });
      for (const [m, geos] of batches) {
        const geo = mergeGeometries(geos);
        geos.forEach((g) => g.dispose());
        if (geo) {
          geometrySet.add(geo);
          const mesh = new THREE.Mesh(geo, m);
          mesh.castShadow = !m.transparent;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
      objects.set(part.id, group);
      if (part.id === 'rack-frame' || part.id === 'board-tray') return;
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.userData.part = part;
          picks.push(o);
        }
      });
      if (!part.muted) {
        const helper = new THREE.BoxHelper(group, COLORS.dc);
        helper.visible = false;
        (helper.material as THREE.LineBasicMaterial).transparent = true;
        (helper.material as THREE.LineBasicMaterial).opacity = 0.6;
        mats.add(helper.material as THREE.Material);
        geometrySet.add(helper.geometry);
        scene.add(helper);
        outlines.push({ box: helper, part });
      }
      if (part.label) {
        const button = document.createElement('button');
        button.className = 'physical-power-label';
        button.textContent = part.label;
        button.setAttribute('aria-label', `Inspect ${part.label}`);
        button.onclick = () =>
          current.current.onSelect(part.stageId, part.hardwareId);
        labelLayer.appendChild(button);
        nameplates.push({
          el: button,
          part,
          position: new THREE.Vector3(
            part.position[0],
            part.position[1] + part.size[1] + 0.08,
            part.position[2],
          ),
        });
      }
    };
    for (const part of layout.parts) {
      const group = new THREE.Group();
      group.position.set(...part.position);
      scene.add(group);
      const [w, h, d] = part.size;
      const node = stageGraph.nodes.find((n) => n.id === part.stageId),
        accent = mat(COLORS[node?.feed ?? 'shared'], 0.3, 0.4);
      accents.push({ m: accent, stageId: part.stageId });
      const b = (size: Point3, pos: Point3, m: THREE.Material = body) =>
        box(group, size, pos, m);
      const grille = (
        ww: number,
        hh: number,
        x: number,
        y: number,
        z: number,
      ) => {
        b([ww, hh, 0.008], [x, y, z], black);
        for (let row = 0; row < 7; row++)
          b(
            [ww * 0.9, hh * 0.035, 0.012],
            [x, y - hh * 0.4 + row * hh * 0.13, z + 0.007],
            steel,
          );
      };
      const chassis = (m: THREE.Material) => {
        b([w, h, d], [0, h / 2, 0], m);
        b([w, 0.012, 0.025], [0, h - 0.01, d / 2 + 0.012], steel);
        for (const x of [-w * 0.44, w * 0.44])
          b(
            [0.012, Math.min(h * 0.6, 0.16), 0.03],
            [x, h * 0.5, d / 2 + 0.026],
            steel,
          );
      };
      switch (part.form) {
        case 'utility':
          b([w, 0.08, d], [0, 0.04, 0], dark);
          for (const x of [-w * 0.3, w * 0.3]) {
            b([0.04, h, 0.04], [x, h / 2, 0], steel);
            b([w * 0.95, 0.035, 0.04], [0, h * 0.76, 0], steel);
          }
          for (const x of [-w * 0.3, 0, w * 0.3]) {
            cylinder(group, 0.04, 0.16, [x, h * 0.8, 0], silver);
            b([0.06, 0.07, 0.1], [x, h * 0.95, 0], accent);
          }
          break;
        case 'transformer':
          chassis(body);
          for (let i = 0; i < 9; i++)
            b(
              [0.025, h * 0.7, d * 0.8],
              [-w * 0.48 + i * w * 0.12, h * 0.5, d * 0.12],
              steel,
            );
          for (const x of [-w * 0.3, 0, w * 0.3])
            cylinder(group, 0.037, 0.18, [x, h + 0.08, 0], black);
          break;
        case 'generator':
          chassis(body);
          grille(w * 0.35, h * 0.65, -w * 0.24, h * 0.53, d / 2 + 0.01);
          b(
            [w * 0.37, h * 0.7, 0.013],
            [w * 0.22, h * 0.48, d / 2 + 0.01],
            dark,
          );
          cylinder(group, 0.032, 0.33, [w * 0.22, h + 0.13, 0], steel);
          b([w * 0.9, 0.08, d * 1.02], [0, 0.04, 0], black);
          break;
        case 'cabinet':
        case 'battery':
          chassis(body);
          b([w * 0.92, h * 0.91, 0.018], [0, h * 0.51, d / 2 + 0.012], dark);
          b(
            [w * 0.05, h * 0.91, 0.022],
            [-w * 0.43, h * 0.51, d / 2 + 0.029],
            accent,
          );
          if (part.form === 'battery') {
            for (let i = 0; i < 5; i++) {
              b(
                [w * 0.76, h * 0.13, 0.025],
                [0, h * 0.13 + i * h * 0.17, d / 2 + 0.025],
                body,
              );
              b(
                [w * 0.3, 0.008, 0.017],
                [0, h * 0.13 + i * h * 0.17, d / 2 + 0.05],
                steel,
              );
            }
          } else {
            b([w * 0.29, h * 0.09, 0.02], [0, h * 0.79, d / 2 + 0.034], black);
            b(
              [w * 0.22, h * 0.045, 0.021],
              [0, h * 0.8, d / 2 + 0.046],
              accent,
            );
            grille(w * 0.73, h * 0.25, 0, h * 0.22, d / 2 + 0.03);
            b(
              [0.025, h * 0.18, 0.025],
              [w * 0.32, h * 0.56, d / 2 + 0.04],
              silver,
            );
          }
          break;
        case 'rack':
          for (const x of [-w / 2, w / 2])
            for (const z of [-d / 2, d / 2])
              b([0.035, h, 0.035], [x, h / 2, z], dark);
          for (const y of [0.055, h - 0.035]) {
            b([w + 0.07, 0.055, d + 0.035], [0, y, 0], dark);
          }
          for (let u = 0; u < Math.round((h - 0.24) / 0.04445); u++)
            for (const x of [-w * 0.4, w * 0.4])
              b(
                [0.016, 0.009, 0.012],
                [x, 0.14 + u * 0.04445, d / 2 + 0.004],
                steel,
              );
          if (scope === 'facility') {
            for (let i = 0; i < 8; i++) {
              b([w * 0.86, 0.2, d * 0.84], [0, 0.16 + i * 0.23, 0], body);
              grille(w * 0.65, 0.13, 0, 0.16 + i * 0.23, d * 0.43);
            }
          }
          break;
        case 'chassis':
          chassis(part.muted ? ghost : cutaway);
          for (let i = 0; i < 3; i++)
            grille(
              w * 0.2,
              Math.min(h * 0.48, 0.15),
              -w * 0.29 + i * w * 0.29,
              h * 0.65,
              d / 2 + 0.012,
            );
          break;
        case 'pdu':
          chassis(dark);
          b(
            [w * 0.28, h * 0.94, 0.009],
            [-w * 0.31, h / 2, d / 2 + 0.014],
            accent,
          );
          for (let i = 0; i < 18; i++) {
            b(
              [w * 0.51, 0.026, 0.01],
              [w * 0.08, 0.055 + (i * (h - 0.12)) / 18, d / 2 + 0.008],
              black,
            );
            b(
              [w * 0.16, 0.012, 0.012],
              [w * 0.08, 0.055 + (i * (h - 0.12)) / 18, d / 2 + 0.02],
              silver,
            );
          }
          b([w * 0.67, 0.045, 0.014], [0, h - 0.057, d / 2 + 0.01], accent);
          break;
        case 'psu':
        case 'shelf': {
          const n = part.count ?? 2;
          for (let i = 0; i < n; i++) {
            const ww = (w / n) * 0.91,
              x = -w / 2 + ((i + 0.5) * w) / n;
            b([ww, h, d], [x, h / 2, 0], body);
            b(
              [ww * 0.34, h * 0.46, 0.012],
              [x - ww * 0.2, h * 0.5, d / 2 + 0.006],
              black,
            );
            b(
              [ww * 0.7, h * 0.055, 0.017],
              [x, h * 0.17, d / 2 + 0.017],
              steel,
            );
            b(
              [ww * 0.09, h * 0.13, 0.015],
              [x + ww * 0.31, h * 0.76, d / 2 + 0.01],
              accent,
            );
          }
          break;
        }
        case 'busbar':
          b([w, h, d], [0, h / 2, 0], copper);
          if (scope === 'rack' && h > w) {
            b([w * 0.4, h, 0.01], [0, h / 2, d / 2 + 0.006], accent);
            for (let i = 0; i < 10; i++)
              b([w * 1.4, 0.013, d * 1.5], [0, (h * (i + 0.5)) / 10, 0], dark);
          }
          break;
        case 'board':
          b([w, 0.04, d], [0, 0.02, 0], dark);
          b([w * 0.96, 0.014, d * 0.94], [0, 0.05, 0], pcb);
          for (const x of [-w * 0.47, w * 0.47])
            for (const z of [-d * 0.45, d * 0.45])
              cylinder(group, 0.025, 0.018, [x, 0.065, z], silver);
          break;
        case 'connector':
          b([w, h, d], [0, h / 2, 0], black);
          b([w * 0.73, h * 0.25, d * 1.01], [0, h * 0.74, 0], accent);
          for (let i = 0; i < 3; i++)
            b(
              [w * 0.08, h * 0.14, 0.02],
              [-w * 0.22 + i * w * 0.22, h * 0.4, d / 2],
              copper,
            );
          break;
        default: {
          const n = part.count ?? 1,
            cols =
              part.form === 'memory'
                ? Math.min(8, n)
                : Math.min(4, Math.ceil(Math.sqrt(n))),
            rows = Math.ceil(n / cols);
          const cw = w / cols,
            ch = d / rows;
          for (let i = 0; i < n; i++) {
            const x = -w / 2 + ((i % cols) + 0.5) * cw,
              z = -d / 2 + (Math.floor(i / cols) + 0.5) * ch;
            if (part.form === 'memory') {
              b([cw * 0.38, h, ch * 0.86], [x, h / 2, z], pcb);
              for (let j = 0; j < 3; j++)
                b(
                  [cw * 0.42, h * 0.36, ch * 0.19],
                  [x, h * 0.58, z + (j - 1) * ch * 0.26],
                  black,
                );
              b([cw * 0.6, 0.023, ch * 0.9], [x, 0.014, z], black);
            } else if (part.form === 'vrm') {
              b([cw * 0.78, h * 0.55, ch * 0.76], [x, h * 0.3, z], steel);
              b([cw * 0.48, h * 0.09, ch * 0.44], [x, h * 0.61, z], dark);
            } else {
              b([cw * 0.91, 0.022, ch * 0.92], [x, 0.015, z], pcb);
              b(
                [cw * 0.69, h * 0.36, ch * 0.66],
                [x, h * 0.23, z],
                part.form === 'storage' ? body : silver,
              );
              if (part.form === 'gpu' || part.form === 'cpu')
                for (let f = 0; f < 5; f++)
                  b(
                    [cw * 0.6, h * 0.12, ch * 0.055],
                    [x, h * 0.48, z + (f - 2) * ch * 0.1],
                    steel,
                  );
              b(
                [cw * 0.11, 0.013, ch * 0.13],
                [x - cw * 0.33, 0.039, z + ch * 0.33],
                accent,
              );
            }
          }
          break;
        }
      }
      register(group, part);
    }
    const floorY = scope === 'board' ? -0.04 : -0.03;
    box(
      scene,
      [layout.span * 1.7, 0.03, layout.span * 1.25],
      [0, floorY, 0],
      mat('#14212a', 0.15, 0.92),
    );
    const grid = new THREE.GridHelper(
      layout.span * 1.5,
      30,
      '#415563',
      '#253946',
    );
    grid.position.y = floorY + 0.017;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    mats.add(grid.material as THREE.Material);
    geometrySet.add(grid.geometry);
    scene.add(grid);
    const wires = layout.routes
      .map((r) => {
        const points = r.points
          .map((p) => new THREE.Vector3(...p))
          .filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.0001);
        if (points.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(
            points,
            false,
            'centripetal',
            0.1,
          ),
          m = mat(COLORS[r.feed], 0.2, 0.45);
        m.emissive.set(COLORS[r.feed]);
        m.emissiveIntensity = 0.27;
        const geo = new THREE.TubeGeometry(
          curve,
          32,
          scope === 'facility' ? 0.026 : scope === 'board' ? 0.013 : 0.008,
          6,
          false,
        );
        geometrySet.add(geo);
        const mesh = new THREE.Mesh(geo, m);
        scene.add(mesh);
        const dotMat = new THREE.MeshBasicMaterial({ color: COLORS[r.feed] });
        mats.add(dotMat);
        const dotGeo = new THREE.SphereGeometry(
          scope === 'facility' ? 0.042 : scope === 'board' ? 0.023 : 0.014,
          8,
          6,
        );
        geometrySet.add(dotGeo);
        const dot = new THREE.Mesh(dotGeo, dotMat);
        scene.add(dot);
        return { r, curve, mesh, dot, m, energized: false };
      })
      .filter((v) => v !== null);
    let front = false,
      zoomTarget = 1;
    const desiredTarget = target.clone(),
      desiredPosition = camera.position.clone();
    let moving = false;
    const fit = () => {
      desiredTarget.copy(target);
      desiredPosition
        .copy(target)
        .add(
          new THREE.Vector3(
            scope === 'board' ? 2.6 : 4.7,
            scope === 'board' ? 7 : 3.5,
            scope === 'board' ? 4.5 : 6.3,
          ),
        );
      zoomTarget = 1;
      moving = true;
      front = false;
    };
    const focus = () => {
      const selected = current.current.selected;
      const chosen = layout.parts.filter(
        (p) => p.stageId === selected && !p.muted,
      );
      if (!chosen.length) return;
      const bounds = new THREE.Box3();
      for (const p of chosen) {
        const o = objects.get(p.id);
        if (o) bounds.expandByObject(o);
      }
      if (bounds.isEmpty()) return;
      const center = bounds.getCenter(new THREE.Vector3()),
        delta = camera.position.clone().sub(orbit.target);
      desiredTarget.copy(center);
      desiredPosition.copy(center).add(delta);
      zoomTarget = Math.min(
        3,
        Math.max(
          1,
          layout.span / (bounds.getSize(new THREE.Vector3()).length() * 2.3),
        ),
      );
      moving = true;
    };
    const sync = () => {
      const p = current.current,
        g = powerGraph(p.model, p.settings),
        ancestors = traceAncestors(g.nodes, g.edges, p.selected),
        nodes = new Map(g.nodes.map((n) => [n.id, n]));
      for (const { m, stageId } of accents) {
        const node = nodes.get(stageId);
        m.emissive.set(node?.active ? COLORS[node.feed] : '#000000');
        m.emissiveIntensity = node?.active ? 0.15 : 0;
        m.color.set(node?.active ? COLORS[node.feed] : '#53626a');
      }
      for (const { box, part } of outlines)
        box.visible = part.stageId === p.selected;
      for (const wire of wires) {
        const edge = g.edges.find(
            (e) => e.from === wire.r.from && e.to === wire.r.to,
          ),
          selected = ancestors.has(wire.r.from) && ancestors.has(wire.r.to);
        wire.energized = !!edge?.active && p.settings.loadPercent > 0;
        wire.mesh.visible = selected;
        wire.m.color.set(edge?.active ? COLORS[wire.r.feed] : '#52616b');
        wire.m.emissiveIntensity = edge?.active ? 0.3 : 0;
        wire.dot.visible = selected && wire.energized && p.motion;
      }
      for (const l of nameplates) {
        const active = nodes.get(l.part.stageId)?.active;
        l.el.classList.toggle('selected', l.part.stageId === p.selected);
        l.el.classList.toggle('unavailable', !active);
        l.el.style.setProperty(
          '--label-color',
          COLORS[nodes.get(l.part.stageId)?.feed ?? 'shared'],
        );
      }
    };
    api.current = {
      sync,
      fit,
      focus,
      zoom: (f) => {
        zoomTarget = THREE.MathUtils.clamp(camera.zoom * f, 0.4, 8);
        moving = true;
        desiredTarget.copy(orbit.target);
        desiredPosition.copy(camera.position);
      },
      view: () => {
        front = !front;
        desiredTarget.copy(target);
        desiredPosition
          .copy(target)
          .add(new THREE.Vector3(front ? 0 : 4.7, front ? 0.6 : 3.5, 8));
        moving = true;
        zoomTarget = 1;
      },
    };
    sync();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const tapGesture = createTapGesture();
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      return ray.intersectObjects(picks, false)[0]?.object.userData.part as
        | PhysicalPowerPart
        | undefined;
    };
    const cancelMotion = () => {
      moving = false;
    };
    orbit.addEventListener('start', cancelMotion);
    const onDown = (e: PointerEvent) => {
      tapGesture.start(e, performance.now());
      moving = false;
    };
    const onUp = (e: PointerEvent) => {
      if (!tapGesture.end(e, performance.now())) return;
      const part = pick(e);
      if (part) current.current.onSelect(part.stageId, part.hardwareId);
    };
    const onMove = (e: PointerEvent) => {
      tapGesture.move(e);
      if (e.pointerType !== 'mouse') return;
      renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      fail();
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointercancel', tapGesture.cancel);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const aspect = w / h,
        half = layout.span / 2;
      camera.left = -half;
      camera.right = half;
      camera.top = half / aspect;
      camera.bottom = -half / aspect;
      if (scope === 'rack' && aspect > 1.2) {
        camera.top = layout.span * 0.45;
        camera.bottom = -layout.span * 0.45;
        camera.left = camera.bottom * aspect;
        camera.right = camera.top * aspect;
      }
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      alive = true;
    const projected = new THREE.Vector3();
    const draw = () => {
      if (!alive) return;
      frame = requestAnimationFrame(draw);
      if (moving) {
        const speed = reduced.matches ? 1 : 0.12;
        camera.position.lerp(desiredPosition, speed);
        orbit.target.lerp(desiredTarget, speed);
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoomTarget, speed);
        camera.updateProjectionMatrix();
        if (
          camera.position.distanceTo(desiredPosition) < 0.003 &&
          Math.abs(camera.zoom - zoomTarget) < 0.003
        )
          moving = false;
      }
      orbit.update();
      const t = performance.now() / 1000;
      for (const wire of wires) {
        wire.dot.visible =
          wire.mesh.visible &&
          wire.energized &&
          current.current.motion &&
          !reduced.matches;
        if (wire.dot.visible)
          wire.dot.position.copy(wire.curve.getPointAt((t * 0.17) % 1));
      }
      renderer.render(scene, camera);
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      const ordered = [...nameplates].sort(
        (a, b) =>
          Number(b.part.stageId === current.current.selected) -
          Number(a.part.stageId === current.current.selected),
      );
      for (const l of ordered) {
        projected.copy(l.position).project(camera);
        const x = (projected.x * 0.5 + 0.5) * element.clientWidth,
          y = (-projected.y * 0.5 + 0.5) * element.clientHeight;
        l.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        const w = l.el.offsetWidth,
          h = l.el.offsetHeight,
          rect = { x: x - w / 2, y: y - h, w, h };
        const offscreen =
          projected.z > 1 ||
          projected.z < -1 ||
          rect.x < 0 ||
          rect.x + w > element.clientWidth ||
          rect.y < 0 ||
          y > element.clientHeight;
        const overlaps = occupied.some(
          (other) =>
            rect.x < other.x + other.w + 6 &&
            rect.x + w + 6 > other.x &&
            rect.y < other.y + other.h + 5 &&
            rect.y + h + 5 > other.y,
        );
        l.el.style.visibility = offscreen || overlaps ? 'hidden' : 'visible';
        if (!offscreen && !overlaps) occupied.push(rect);
      }
    };
    draw();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.removeEventListener('start', cancelMotion);
      orbit.dispose();
      api.current = null;
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener(
        'pointercancel',
        tapGesture.cancel,
      );
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      nameplates.forEach((l) => l.el.remove());
      geometrySet.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [layout, model, scope, rackId, hardwareId]);
  return (
    <div className="physical-power-view">
      <div className="physical-power-legend">
        <span>
          <i style={{ background: COLORS.a }} /> A feed
        </span>
        <span>
          <i style={{ background: COLORS.b }} /> B feed
        </span>
        <span>
          <i style={{ background: COLORS.dc }} /> DC path
        </span>
        <small>
          {scope === 'rack'
            ? 'Rear service view'
            : scope === 'board'
              ? 'Cover removed'
              : 'Equipment layout'}
        </small>
      </div>
      <div className="physical-power-canvas">
        <div ref={host} className="physical-power-renderer" />
        <div ref={labels} className="physical-power-labels" />
        {unavailable && (
          <div className="physical-power-unavailable">
            3D is unavailable in this browser. The schematic still supports
            every power stage.
          </div>
        )}
        <div className="physical-power-tools">
          <button
            aria-label="Fit physical power equipment"
            title="Fit equipment"
            onClick={() => api.current?.fit()}
          >
            <RotateCcw size={16} />
          </button>
          <button
            aria-label="Focus selected power equipment"
            title="Focus selected part"
            onClick={() => api.current?.focus()}
          >
            <Focus size={17} />
          </button>
          <button
            aria-label="Change physical power camera angle"
            title="Change camera angle"
            onClick={() => api.current?.view()}
          >
            <Box size={16} />
          </button>
          <button
            aria-label="Zoom physical power in"
            onClick={() => api.current?.zoom(1.3)}
          >
            <Plus size={17} />
          </button>
          <button
            aria-label="Zoom physical power out"
            onClick={() => api.current?.zoom(1 / 1.3)}
          >
            <Minus size={17} />
          </button>
        </div>
        <div className="physical-power-hint">
          Drag to orbit · Scroll to zoom · Click equipment{' '}
          <ArrowUpRight size={12} />
        </div>
      </div>
      <p className="physical-power-caption">{layout.note}</p>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { profileFor, partFor } from '@/lib/catalog';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  FABRICS,
  U_METERS,
  yForHardware,
  childrenOf,
  resolveHardware as lookupHardware,
  type ClusterModel,
  type Fabric,
  type Hardware,
} from '@/lib/hardware';

export type CameraCommand = {
  type: 'iso' | 'front' | 'rear' | 'fit' | 'in' | 'out';
  sequence: number;
};
type Props = {
  model: ClusterModel;
  service: boolean;
  exploded: boolean;
  selected: string | null;
  node: string | null;
  layers: Record<Fabric, boolean>;
  labels: boolean;
  command: CameraCommand;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onUnavailable: () => void;
};
type SceneAPI = {
  select: (id: string | null) => void;
  command: (command: CameraCommand) => void;
  layers: (layers: Record<Fabric, boolean>) => void;
  labels: (show: boolean) => void;
};
const GREEN = '#c3f16b';

export default function ClusterScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  useEffect(() => {
    current.current = props;
  });
  const api = useRef<SceneAPI | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const { hardware: HARDWARE, racks: RACKS, links: LINKS } = props.model;
    const resolveHardware = (id: string | null) =>
      lookupHardware(id, props.model);
    const rackHeight = Math.max(...RACKS.map((r) => r.units)) * U_METERS + 0.24;
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => {
        setError(true);
        current.current.onUnavailable();
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(element.clientWidth, element.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D hardware model. Drag to orbit, scroll to zoom. All hardware can also be selected in the inventory.',
    );
    renderer.domElement.setAttribute('role', 'img');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#101215', 0.032);
    const camera = new THREE.PerspectiveCamera(
      34,
      element.clientWidth / element.clientHeight,
      0.015,
      60,
    );
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.085;
    orbit.minDistance = 0.22;
    orbit.maxDistance = 24;
    orbit.maxPolarAngle = Math.PI * 0.49;
    orbit.target.set(0, 1, 0);
    camera.position.set(3.6, 2.8, 5.6);
    const hemi = new THREE.HemisphereLight('#e1e8f5', '#282d32', 2.4);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff1d5', 5.5);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.normalBias = 0.015;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#a9bfe8', 4);
    rim.position.set(3, 3, -4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight('#e6eced', 2);
    fill.position.set(0, 2, 5);
    scene.add(fill);
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    const material = (color: string, metalness = 0.45, roughness = 0.42) => {
      const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      mats.add(m);
      return m;
    };
    const black = material('#191d20', 0.7, 0.37),
      steel = material('#747a7b', 0.82, 0.3),
      darkSteel = material('#343b3e', 0.8, 0.37),
      gold = material('#91866a', 0.68, 0.45),
      silicon = material('#b0b5b7', 0.8, 0.25),
      pcb = material('#183c30', 0.4, 0.64),
      slot = material('#080b0c', 0.3, 0.7);
    const led = material(GREEN, 0, 0.35);
    led.emissive.set(GREEN);
    led.emissiveIntensity = 1.8;
    function box(
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
      parent: THREE.Object3D = scene,
      round = false,
    ) {
      const m = new THREE.Mesh(
        round
          ? new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.07)
          : new THREE.BoxGeometry(w, h, d),
        mat,
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    function line(points: THREE.Vector3[], color: string, opacity = 1) {
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      });
      mats.add(m);
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        m,
      );
    }
    function caption(
      text: string,
      width: number,
      height: number,
      color = '#d6dcdc',
      bg = 'transparent',
    ) {
      const c = document.createElement('canvas');
      c.width = 768;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      if (bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.fillStyle = color;
      ctx.font = '500 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 384, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      texs.add(t);
      const m = new THREE.SpriteMaterial({
        map: t,
        transparent: true,
        depthTest: false,
      });
      mats.add(m);
      const sprite = new THREE.Sprite(m);
      sprite.scale.set(width, height, 1);
      return sprite;
    }
    function grille(
      w: number,
      h: number,
      color: string,
      parent: THREE.Object3D,
      x: number,
      y: number,
      z: number,
    ) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      for (let j = 0; j < 32; j++)
        for (let i = 0; i < 32; i++) {
          ctx.beginPath();
          ctx.fillStyle = '#151818';
          ctx.arc(i * 8 + (j % 2) * 4, j * 8, 2.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(235,231,202,.2)';
          ctx.arc(i * 8 + (j % 2) * 4, j * 8, 3.1, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w * 5, h * 5);
      texs.add(t);
      const m = new THREE.MeshStandardMaterial({
        map: t,
        metalness: 0.58,
        roughness: 0.62,
      });
      mats.add(m);
      box(w, h, 0.002, m, x, y, z, parent);
    }
    const objects = new Map<string, THREE.Object3D>();
    const picks: THREE.Object3D[] = [];
    const labels: THREE.Object3D[] = [];
    const wires: Record<Fabric, THREE.Group> = {
      compute: new THREE.Group(),
      frontend: new THREE.Group(),
      storage: new THREE.Group(),
    };
    Object.values(wires).forEach((g) => scene.add(g));
    function register(id: string, g: THREE.Object3D) {
      // Merge static geometry per device/material to keep large rack layouts responsive.
      g.updateWorldMatrix(true, true);
      const inverse = g.matrixWorld.clone().invert();
      const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
      const originals: THREE.Mesh[] = [];
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
          const geometry = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
          geometry.applyMatrix4(
            new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld),
          );
          const batch = batches.get(o.material) ?? [];
          batch.push(geometry);
          batches.set(o.material, batch);
          originals.push(o);
        }
      });
      for (const o of originals) {
        o.removeFromParent();
        o.geometry.dispose();
      }
      for (const [mat, geometries] of batches) {
        const geometry = mergeGeometries(geometries);
        geometries.forEach((geo) => geo.dispose());
        if (geometry) {
          const mesh = new THREE.Mesh(geometry, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          g.add(mesh);
        }
      }
      g.userData.hardwareId = id;
      objects.set(id, g);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.userData.hardwareId = id;
          picks.push(o);
        }
      });
    }
    const floor = box(
      100,
      0.035,
      100,
      material('#14181b', 0.3, 0.85),
      0,
      -0.04,
      0,
    );
    floor.castShadow = false;
    const grid = new THREE.GridHelper(18, 36, '#3a4146', '#242b2f');
    grid.position.y = -0.019;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.48;
    scene.add(grid);
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    function ports(
      group: THREE.Group,
      rows: number,
      cols: number,
      width: number,
      height: number,
      z: number,
      y = 0,
    ) {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = -width / 2 + ((c + 0.5) * width) / cols;
          const yy = y + height / 2 - ((r + 0.5) * height) / rows;
          box(
            (width / cols) * 0.81,
            (height / rows) * 0.76,
            0.008,
            steel,
            x,
            yy,
            z,
            group,
          );
          box(
            (width / cols) * 0.68,
            (height / rows) * 0.59,
            0.009,
            slot,
            x,
            yy,
            z + 0.005,
            group,
          );
          box(
            0.0018,
            0.0014,
            0.001,
            led,
            x + (width / cols) * 0.33,
            yy - (height / rows) * 0.4,
            z + 0.011,
            group,
          );
        }
    }
    function cylinder(
      radius: number,
      height: number,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 20),
        mat,
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }
    function fan(
      g: THREE.Object3D,
      x: number,
      y: number,
      z: number,
      size: number,
    ) {
      box(size, size, 0.015, black, x, y, z, g, true);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.4, size * 0.035, 5, 24),
        steel,
      );
      ring.position.set(x, y, z + 0.011);
      g.add(ring);
      const hub = cylinder(size * 0.13, 0.006, darkSteel, x, y, z + 0.013, g);
      hub.rotation.x = Math.PI / 2;
      for (let k = 0; k < 7; k++) {
        const blade = box(size * 0.1, size * 0.3, 0.002, darkSteel, 0, 0, 0, g);
        const angle = (k * Math.PI * 2) / 7;
        blade.position.set(
          x + Math.sin(angle) * size * 0.23,
          y + Math.cos(angle) * size * 0.23,
          z + 0.009,
        );
        blade.rotation.z = -angle + 0.4;
      }
      for (const dx of [-1, 1])
        for (const dy of [-1, 1]) {
          const screw = cylinder(
            size * 0.025,
            0.002,
            steel,
            x + dx * size * 0.43,
            y + dy * size * 0.43,
            z + 0.012,
            g,
          );
          screw.rotation.x = Math.PI / 2;
        }
    }
    function fanGrid(
      g: THREE.Group,
      rows: number,
      cols: number,
      w: number,
      h: number,
      y: number,
      z: number,
    ) {
      const size = Math.min(w / cols, h / rows) * 0.88;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          fan(
            g,
            ((c - (cols - 1) / 2) * w) / cols,
            y + ((r - (rows - 1) / 2) * h) / rows,
            z,
            size,
          );
    }
    function psuGrid(
      g: THREE.Group,
      count: number,
      rows: number,
      w: number,
      h: number,
      y: number,
      z: number,
    ) {
      const cols = Math.ceil(count / rows);
      for (let i = 0; i < count; i++) {
        const x = (((i % cols) - (cols - 1) / 2) * w) / cols,
          yy = y + ((Math.floor(i / cols) - (rows - 1) / 2) * h) / rows;
        box(
          (w / cols) * 0.9,
          (h / rows) * 0.87,
          0.027,
          darkSteel,
          x,
          yy,
          z,
          g,
          true,
        );
        box(
          (w / cols) * 0.25,
          (h / rows) * 0.5,
          0.006,
          slot,
          x - 0.009,
          yy,
          z + 0.018,
          g,
        );
        box(
          0.012,
          0.002,
          0.011,
          steel,
          x + 0.018,
          yy - (h / rows) * 0.27,
          z + 0.028,
          g,
        );
        box(0.002, 0.002, 0.004, led, x + (w / cols) * 0.36, yy, z + 0.019, g);
      }
    }
    function drives(
      g: THREE.Group,
      count: number,
      w: number,
      h: number,
      y: number,
      z: number,
    ) {
      for (let i = 0; i < count; i++) {
        const x = ((i - (count - 1) / 2) * w) / count;
        box((w / count) * 0.89, h, 0.018, steel, x, y, z, g, true);
        box((w / count) * 0.72, h * 0.67, 0.005, black, x, y, z + 0.012, g);
        box(
          (w / count) * 0.68,
          0.003,
          0.009,
          steel,
          x,
          y - h * 0.32,
          z + 0.02,
          g,
        );
        box(
          0.002,
          0.002,
          0.003,
          led,
          x + (w / count) * 0.27,
          y + h * 0.24,
          z + 0.016,
          g,
        );
      }
    }
    function chassis(h: Hardware, x: number) {
      const g = new THREE.Group();
      g.position.set(x, yForHardware(h), 0.1);
      scene.add(g);
      const pr = profileFor(h),
        H = h.height * U_METERS - 0.003,
        W = pr.width ?? 0.4823,
        D = pr.depth;
      box(W, H, D, darkSteel, 0, 0, -D / 2 + 0.45, g, true);
      box(W - 0.018, 0.002, D - 0.022, steel, 0, H / 2, -D / 2 + 0.45, g);
      box(W, H, 0.012, black, 0, 0, 0.452, g);
      const rear = new THREE.Group();
      rear.position.set(0, 0, -D + 0.446);
      rear.rotation.y = Math.PI;
      g.add(rear);
      const accent = material(pr.color, 0.4, 0.45);
      for (const xx of [-W / 2 + 0.006, W / 2 - 0.006]) {
        box(0.018, H, 0.009, steel, xx, 0, 0.452, g);
        for (const yy of [-H * 0.38, H * 0.38]) {
          const screw = cylinder(0.003, 0.002, slot, xx, yy, 0.46, g);
          screw.rotation.x = Math.PI / 2;
        }
        if (H > 0.08) {
          box(0.007, H * 0.42, 0.025, black, xx, 0, 0.472, g, true);
          box(0.007, H * 0.03, 0.039, steel, xx, H * 0.21, 0.464, g);
          box(0.007, H * 0.03, 0.039, steel, xx, -H * 0.21, 0.464, g);
        }
      }
      if (pr.face === 'power') {
        psuGrid(g, 6, 1, 0.43, H * 0.8, 0, 0.466);
        box(0.42, H * 0.5, 0.01, steel, 0, 0, 0.016, rear);
      } else if (pr.face === 'nvl-switch') {
        grille(0.34, H * 0.6, '#6d7474', g, 0, 0, 0.464);
        box(0.035, H * 0.6, 0.014, black, -0.2, 0, 0.473, g);
        box(0.035, H * 0.6, 0.014, black, 0.2, 0, 0.473, g);
        ports(rear, 2, 9, 0.4, H * 0.8, 0.015);
      } else if (pr.face === 'tray') {
        grille(0.44, H * 0.75, '#787e7d', g, 0, 0, 0.464);
        ports(g, 1, 4, 0.23, H * 0.63, 0.47);
        drives(g, 4, 0.16, H * 0.65, 0, 0.49);
        box(0.43, 0.011, 0.02, steel, 0, 0, 0.023, rear);
        for (const xx of [-0.2, 0.2])
          cylinder(0.009, 0.018, accent, xx, 0, 0.49, g).rotation.x =
            Math.PI / 2;
      } else if (pr.category === 'network') {
        ports(
          g,
          pr.ports?.rows ?? 2,
          pr.ports?.cols ?? 16,
          0.424,
          H * 0.78,
          0.465,
        );
        const fc = pr.parts.find((p) => p.kind === 'fan')?.count;
        const psus = pr.parts.find((p) => p.kind === 'psu')?.count ?? 2;
        if (fc)
          fanGrid(
            rear,
            psus > 2 ? 2 : 1,
            psus > 2 ? Math.ceil(fc / 2) : fc,
            0.32,
            H * (psus > 2 ? 0.52 : 0.82),
            psus > 2 ? H * 0.18 : 0,
            0.018,
          );
        else grille(0.32, H * 0.75, '#444c4f', rear, 0, 0, 0.019);
        if (psus > 2) psuGrid(rear, psus, 2, 0.42, H * 0.32, -H * 0.3, 0.018);
        else
          for (const xx of [-0.2, 0.2]) {
            box(0.055, H * 0.85, 0.03, steel, xx, 0, 0.01, rear);
            box(0.025, 0.02, 0.01, slot, xx, 0, 0.032, rear);
          }
      } else if (pr.category === 'storage') {
        if (props.service) {
          drives(g, 4, 0.42, H * 0.75, 0, 0.466);
        } else {
          grille(0.423, H * 0.73, '#383b3d', g, 0, 0, 0.464);
          box(0.4, 0.009, 0.008, material('#a43838'), 0, -H * 0.3, 0.47, g);
        }
        ports(rear, 2, 4, 0.28, H * 0.68, 0.02);
        for (const xx of [-0.2, 0.2]) {
          box(0.048, H * 0.85, 0.03, steel, xx, 0, 0.01, rear);
          box(0.02, 0.02, 0.006, slot, xx, 0, 0.032, rear);
        }
      } else {
        const nvidia = pr.maker === 'NVIDIA';
        const isB300 = pr.id === 'dgx-b300';
        const old = pr.id === 'dgx-h100' || pr.id === 'dgx-h200';
        if (nvidia && !props.service) {
          grille(0.433, H - 0.02, '#8b8062', g, 0, 0, 0.463);
          box(0.06, H - 0.025, 0.01, gold, -0.18, 0, 0.47, g, true);
        } else if (old) {
          fanGrid(g, 3, 4, 0.422, H * 0.77, H * 0.065, 0.466);
          drives(g, 8, 0.422, H * 0.11, -H * 0.4, 0.474);
        } else if (pr.id === 'dgx-b200') {
          fanGrid(g, 4, 5, 0.42, H * 0.89, 0, 0.466);
        } else if (isB300) {
          psuGrid(g, 12, 2, 0.42, H * 0.26, H * 0.34, 0.466);
          grille(0.425, H * 0.4, '#525a59', g, 0, -H * 0.015, 0.466);
          ports(g, 1, 8, 0.39, H * 0.07, 0.472, -H * 0.14);
          drives(g, 8, 0.22, H * 0.1, -H * 0.38, 0.475);
        } else if (pr.id === 'lenovo-sr680a-v4') {
          fanGrid(g, 1, 6, 0.42, H * 0.22, H * 0.35, 0.466);
          grille(0.42, H * 0.35, '#575e60', g, 0, 0.005, 0.465);
          drives(g, 8, 0.34, H * 0.12, -H * 0.14, 0.471);
          ports(g, 1, 8, 0.39, H * 0.1, 0.472, -H * 0.34);
          box(0.025, H * 0.15, 0.01, accent, -0.205, -H * 0.3, 0.482, g);
        } else if (pr.cooling === 'Direct liquid') {
          grille(0.43, H * 0.55, '#717674', g, 0, H * 0.17, 0.465);
          drives(g, 8, 0.36, H * 0.19, -H * 0.28, 0.478);
          for (const xx of [-0.17, 0, 0.17]) {
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(xx, H * 0.13, 0.48),
              new THREE.Vector3(xx + 0.014, H * 0.08, 0.53),
              new THREE.Vector3(xx + 0.012, -H * 0.15, 0.51),
            ]);
            const hose = new THREE.Mesh(
              new THREE.TubeGeometry(curve, 10, 0.005, 6, false),
              black,
            );
            g.add(hose);
          }
        } else {
          grille(0.425, H * 0.63, '#555d61', g, 0, H * 0.12, 0.465);
          drives(
            g,
            pr.id === 'dell-xe9780' ? 16 : 8,
            0.42,
            H * 0.15,
            -H * 0.34,
            0.476,
          );
          box(0.32, 0.013, 0.007, accent, 0, -H * 0.16, 0.478, g);
        }
        if (isB300) {
          psuGrid(rear, 12, 2, 0.42, H * 0.24, H * 0.36, 0.016);
          fanGrid(rear, 4, 5, 0.42, H * 0.68, -H * 0.13, 0.02);
        } else if (pr.id === 'lenovo-sr680a-v4') {
          psuGrid(rear, 8, 1, 0.42, H * 0.18, H * 0.38, 0.016);
          fanGrid(rear, 3, 5, 0.42, H * 0.67, -H * 0.08, 0.02);
        } else if (pr.id === 'dell-xe9780') {
          fanGrid(rear, 3, 5, 0.42, H * 0.48, H * 0.18, 0.02);
          ports(rear, 1, 4, 0.33, H * 0.07, 0.025, -H * 0.13);
          psuGrid(rear, 12, 2, 0.42, H * 0.25, -H * 0.32, 0.02);
        } else {
          grille(0.43, H * 0.46, '#424b4b', rear, 0, H * 0.23, 0.016);
          ports(
            rear,
            1,
            old || pr.id === 'dgx-b200' ? 4 : 8,
            0.32,
            Math.min(0.03, H * 0.16),
            0.022,
            -H * 0.09,
          );
          const pc = pr.parts.find((p) => p.kind === 'psu')?.count;
          if (pc)
            psuGrid(rear, pc, pc > 8 ? 2 : 1, 0.43, H * 0.25, -H * 0.32, 0.02);
        }
      }
      if (H > 0.075) {
        const brand = caption(
          `${pr.maker.toUpperCase()}  /  ${pr.name}`,
          0.33,
          0.016,
          '#e0e4df',
        );
        brand.position.set(0, -H * 0.445, 0.492);
        brand.material.depthTest = true;
        g.add(brand);
      }
      for (const y of [H * 0.35, H * 0.26])
        box(0.0025, 0.0025, 0.003, led, W / 2 - 0.012, y, 0.48, g);
      // Exposed case seams and fasteners remain visible when orbiting the enclosure.
      for (const xx of [-W * 0.43, W * 0.43])
        for (let i = 0; i < 4; i++)
          cylinder(
            0.0025,
            0.0015,
            slot,
            xx,
            H / 2 + 0.001,
            0.4 - (i * D) / 4,
            g,
          );
      register(h.id, g);
      return g;
    }
    if (!props.node) {
      for (const rack of RACKS) {
        const g = new THREE.Group();
        g.position.x = rack.x;
        scene.add(g);
        for (const xx of [-0.288, 0.288]) {
          box(
            0.025,
            rack.units * U_METERS + 0.16,
            1.16,
            black,
            xx,
            (rack.units * U_METERS + 0.16) / 2 + 0.04,
            0,
            g,
            true,
          );
          box(
            0.035,
            rack.units * U_METERS,
            0.028,
            darkSteel,
            xx * 0.88,
            0.12 + (rack.units * U_METERS) / 2,
            0.56,
            g,
          );
        }
        box(
          0.6,
          0.065,
          1.19,
          black,
          0,
          rack.units * U_METERS + 0.21,
          0,
          g,
          true,
        );
        box(0.6, 0.09, 1.2, black, 0, 0.03, 0, g, true);
        // Rear posts remain visible so the actual chassis depth can be read.
        for (const xx of [-0.26, 0.26])
          box(
            0.034,
            rack.units * U_METERS,
            0.034,
            darkSteel,
            xx,
            0.12 + (rack.units * U_METERS) / 2,
            -0.51,
            g,
          );
        for (let u = 1; u <= rack.units; u++) {
          const yy = 0.12 + (u - 0.5) * U_METERS;
          for (const xx of [-0.255, 0.255]) {
            box(0.006, 0.009, 0.002, slot, xx, yy, 0.577, g);
          }
          if (u === 1 || u % 5 === 0) {
            const l = caption(
              String(u).padStart(2, '0'),
              0.044,
              0.014,
              '#7b898d',
            );
            l.position.set(-0.28, yy, 0.6);
            l.material.depthTest = true;
            g.add(l);
          }
        }
        const parts = HARDWARE.filter((h) => h.rack === rack.id);
        for (let u = 1; u <= rack.units; u++)
          if (!parts.some((h) => u >= h.u && u < h.u + h.height))
            box(
              0.481,
              U_METERS - 0.002,
              0.014,
              black,
              0,
              0.12 + (u - 0.5) * U_METERS,
              0.55,
              g,
            );
        const l = caption(
          `${rack.id}  /  ${rack.name.toUpperCase()}`,
          0.64,
          0.072,
          '#c9d2d5',
        );
        l.position.set(rack.x, rack.units * U_METERS + 0.4, 0.06);
        labelGroup.add(l);
        labels.push(l);
        box(
          0.25,
          0.009,
          0.007,
          material(rack.color, 0.2, 0.6),
          rack.x,
          rack.units * U_METERS + 0.245,
          0.575,
        );
        for (const h of parts) chassis(h, rack.x);
        const marker = line(
          [
            new THREE.Vector3(rack.x - 0.31, 0.001, 0.72),
            new THREE.Vector3(rack.x - 0.31, 0.001, 0.86),
            new THREE.Vector3(rack.x - 0.15, 0.001, 0.86),
          ],
          '#626e75',
          0.6,
        );
        scene.add(marker);
      }
      for (const link of LINKS) {
        const from = resolveHardware(link.from),
          to = resolveHardware(link.to);
        if (!from || !to) continue;
        const a = RACKS.find((r) => r.id === from.rack)!,
          b = RACKS.find((r) => r.id === to.rack)!;
        const offset =
          link.fabric === 'compute'
            ? 0
            : link.fabric === 'frontend'
              ? 0.05
              : 0.1;
        const points = [
          new THREE.Vector3(a.x + 0.15, yForHardware(from), -0.5),
          new THREE.Vector3(
            a.x + 0.3,
            yForHardware(from) + 0.08,
            -0.65 - offset,
          ),
          new THREE.Vector3(
            a.x + 0.3,
            rackHeight + 0.18 + offset,
            -0.65 - offset,
          ),
          new THREE.Vector3(
            b.x + 0.3,
            rackHeight + 0.18 + offset,
            -0.65 - offset,
          ),
          new THREE.Vector3(b.x + 0.3, yForHardware(to) + 0.08, -0.65 - offset),
          new THREE.Vector3(b.x + 0.15, yForHardware(to), -0.5),
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const m = new THREE.MeshStandardMaterial({
          color: FABRICS[link.fabric].color,
          emissive: FABRICS[link.fabric].color,
          emissiveIntensity: 0.42,
          transparent: true,
          opacity: 0.58,
          roughness: 0.5,
        });
        mats.add(m);
        const cable = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 30, 0.0017, 4, false),
          m,
        );
        cable.userData.link = link;
        wires[link.fabric].add(cable);
      }
    } else {
      const node = resolveHardware(props.node)!;
      if (!node) return;
      const pr = profileFor(node),
        assembly = new THREE.Group();
      scene.add(assembly);
      const spread = props.exploded ? 1 : 0;
      box(0.49, 0.018, pr.depth, darkSteel, 0, 0.17, 0, assembly, true);
      for (const xx of [-0.24, 0.24])
        box(0.008, 0.06, pr.depth, darkSteel, xx, 0.19, 0, assembly);
      const kids = childrenOf(node),
        isCompute = pr.category === 'compute';
      function chipBoard(g: THREE.Object3D, w: number, d: number) {
        box(w, 0.006, d, pcb, 0, 0, 0, g);
        for (let k = 0; k < 6; k++) {
          const x = -w * 0.43 + k * w * 0.17;
          const path = line(
            [
              new THREE.Vector3(x, 0.004, -d * 0.4),
              new THREE.Vector3(x, 0.004, d * 0.2),
              new THREE.Vector3(x + w * 0.06, 0.004, d * 0.27),
            ],
            '#739167',
            0.55,
          );
          g.add(path);
        }
        for (const x of [-w * 0.42, w * 0.42])
          for (const z of [-d * 0.42, d * 0.42])
            cylinder(0.002, 0.001, steel, x, 0.005, z, g);
      }
      function heatSink(g: THREE.Object3D, w: number, d: number, y: number) {
        box(w, 0.008, d, silicon, 0, y, 0, g);
        if (pr.cooling === 'Direct liquid') {
          box(
            w * 0.86,
            0.01,
            d * 0.87,
            material('#a58f68', 0.8, 0.27),
            0,
            y + 0.009,
            0,
            g,
            true,
          );
          for (const x of [-w * 0.28, w * 0.28])
            cylinder(0.006, 0.015, steel, x, y + 0.022, 0, g);
        } else
          for (let f = 0; f < 12; f++)
            box(
              w,
              0.023,
              0.0017,
              silicon,
              0,
              y + 0.014,
              -d / 2 + ((f + 0.5) * d) / 12,
              g,
            );
      }
      for (const item of kids) {
        const i = item.index!,
          part = partFor(item)!,
          same = kids.filter((k) => k.part === item.part),
          g = new THREE.Group();
        assembly.add(g);
        if (item.kind === 'board' || item.kind === 'backplane') {
          if (item.part === 'baseboard') {
            g.position.set(0, 0.22, -0.1);
            chipBoard(g, 0.44, 0.55);
          } else if (item.kind === 'backplane') {
            g.position.set(0, 0.24 + spread * 0.05, pr.depth * 0.39);
            chipBoard(g, 0.43, 0.035);
            for (let n = 0; n < 8; n++)
              box(0.028, 0.018, 0.012, black, -0.18 + n * 0.052, 0.012, 0, g);
          } else {
            g.position.set(
              isCompute ? 0.32 * spread : 0,
              0.245 + spread * (isCompute ? 0.25 : 0),
              isCompute ? 0.19 : 0.04,
            );
            chipBoard(
              g,
              isCompute ? 0.29 : 0.42,
              isCompute ? 0.29 : pr.depth * 0.61,
            );
          }
        } else if (item.kind === 'gpu') {
          g.position.set(
            ((i % 2) - 0.5) * 0.22,
            0.26 + spread * 0.07,
            -0.31 + Math.floor(i / 2) * 0.137,
          );
          chipBoard(g, 0.17, 0.115);
          box(0.056, 0.01, 0.05, silicon, 0, 0.01, 0, g, true);
          for (let k = 0; k < 6; k++)
            box(
              0.017,
              0.008,
              0.02,
              black,
              ((k % 2) - 0.5) * 0.09,
              0.011,
              -0.032 + Math.floor(k / 2) * 0.032,
              g,
            );
          for (let k = 0; k < 8; k++)
            box(
              0.006,
              0.007,
              0.015,
              steel,
              -0.069 + k * 0.019,
              0.009,
              0.045,
              g,
            );
          if (!props.exploded) heatSink(g, 0.135, 0.095, 0.026);
          else {
            const lid = new THREE.Group();
            lid.position.set(0, 0.082, 0);
            g.add(lid);
            heatSink(lid, 0.14, 0.1, 0);
          }
        } else if (item.kind === 'cpu') {
          g.position.set(
            (i - 0.5) * 0.14 + 0.32 * spread,
            0.28 + spread * 0.29,
            0.21,
          );
          chipBoard(g, 0.11, 0.1);
          box(0.077, 0.009, 0.064, black, 0, 0.007, 0, g);
          box(0.061, 0.013, 0.054, silicon, 0, 0.02, 0, g, true);
          if (!props.exploded) heatSink(g, 0.08, 0.07, 0.03);
        } else if (item.kind === 'memory') {
          const cols = Math.min(8, part.count),
            r = Math.floor(i / cols),
            col = i % cols;
          g.position.set(
            0.32 * spread + (r % 2 === 0 ? -0.115 : 0.115),
            0.28 + spread * 0.28,
            0.085 + col * 0.028 + (r > 1 ? 0.014 : 0),
          );
          box(0.003, 0.042, 0.021, pcb, 0, 0, 0, g);
          for (let k = 0; k < 3; k++)
            box(
              0.002,
              0.017,
              0.005,
              black,
              0.003,
              0.008,
              -0.007 + k * 0.007,
              g,
            );
          box(0.004, 0.007, 0.022, gold, 0, -0.02, 0, g);
        } else if (item.kind === 'nvlink') {
          g.position.set(
            isCompute ? 0 : (i - 0.5) * 0.19,
            0.28 + spread * 0.08,
            isCompute ? -0.25 + i * 0.15 : 0,
          );
          chipBoard(g, 0.052, 0.064);
          box(0.034, 0.011, 0.042, silicon, 0, 0.012, 0, g, true);
          if (!props.exploded) heatSink(g, 0.045, 0.05, 0.022);
        } else if (item.kind === 'nic') {
          const isIO = item.part !== 'nic';
          g.position.set(
            item.part === 'management'
              ? 0.12
              : (i - (same.length - 1) / 2) * 0.052,
            0.31 + spread * (isIO ? 0.28 : 0.17),
            isIO ? 0.35 : -pr.depth * 0.42,
          );
          chipBoard(g, 0.043, 0.14);
          box(0.018, 0.009, 0.025, silicon, 0, 0.01, 0, g);
          box(0.035, 0.02, 0.03, steel, 0, 0.013, -0.069, g);
          box(0.023, 0.013, 0.031, slot, 0, 0.013, -0.073, g);
          box(0.031, 0.003, 0.025, gold, 0, 0.002, 0.065, g);
        } else if (item.kind === 'nvme') {
          const boot = item.part === 'boot',
            wide = boot ? 0.025 : 0.044,
            depth = boot ? 0.075 : 0.1;
          g.position.set(
            (i - (same.length - 1) / 2) * (same.length > 10 ? 0.025 : 0.054),
            0.24 + spread * (boot ? 0.43 : 0.08),
            pr.depth * 0.39 + (boot ? -0.12 : 0),
          );
          box(wide + 0.003, 0.008, depth + 0.002, steel, 0, -0.006, 0, g, true);
          chipBoard(g, wide, depth);
          for (let k = 0; k < 4; k++)
            box(
              wide * 0.31,
              0.006,
              depth * 0.22,
              black,
              ((k % 2) - 0.5) * wide * 0.5,
              0.007,
              -depth * 0.16 + Math.floor(k / 2) * depth * 0.3,
              g,
            );
          box(
            wide * 0.31,
            0.007,
            depth * 0.18,
            silicon,
            0,
            0.008,
            -depth * 0.38,
            g,
          );
          box(wide * 0.76, 0.002, 0.006, gold, 0, 0.001, -depth / 2, g);
          if (!boot) {
            box(wide + 0.005, 0.029, 0.005, black, 0, 0.008, depth / 2, g);
            box(
              wide * 0.8,
              0.003,
              0.013,
              steel,
              0,
              -0.002,
              depth / 2 + 0.009,
              g,
            );
          }
        } else if (item.kind === 'controller' || item.kind === 'asic') {
          g.position.set(
            0,
            0.29 + spread * 0.08,
            item.kind === 'asic' ? -0.07 : 0.06,
          );
          chipBoard(
            g,
            item.kind === 'asic' ? 0.12 : 0.29,
            item.kind === 'asic' ? 0.12 : 0.26,
          );
          box(0.059, 0.015, 0.058, silicon, 0, 0.014, 0, g, true);
          for (let k = 0; k < 4; k++)
            box(0.019, 0.009, 0.035, black, -0.094 + k * 0.063, 0.01, 0.084, g);
          if (!props.exploded) heatSink(g, 0.075, 0.075, 0.03);
        } else if (item.kind === 'port') {
          const cols = pr.ports?.cols ?? 8,
            r = Math.floor(i / cols) + (item.part === 'uplink' ? 2 : 0);
          g.position.set(
            (((i % cols) - (cols - 1) / 2) * 0.42) / cols,
            0.25 + r * 0.023 + spread * 0.05,
            pr.depth * 0.43,
          );
          box((0.42 / cols) * 0.83, 0.018, 0.07, steel, 0, 0, 0, g);
          box((0.42 / cols) * 0.65, 0.012, 0.008, slot, 0, 0, 0.036, g);
          box((0.42 / cols) * 0.7, 0.002, 0.05, pcb, 0, -0.01, -0.044, g);
        } else if (item.kind === 'psu') {
          const cols = Math.min(6, part.count);
          g.position.set(
            ((i % cols) - (cols - 1) / 2) * 0.074,
            0.27 + Math.floor(i / cols) * 0.04 + spread * 0.32,
            -pr.depth * 0.28,
          );
          box(0.062, 0.032, 0.14, steel, 0, 0, 0, g, true);
          box(0.04, 0.025, 0.006, slot, 0, 0, -0.072, g);
          box(0.004, 0.028, 0.014, black, 0.025, 0, -0.08, g);
        } else if (item.kind === 'fan') {
          const frontCount = ['dgx-h100', 'dgx-h200', 'dgx-b200'].includes(
            pr.id,
          )
            ? part.count
            : pr.id === 'lenovo-sr680a-v4'
              ? 6
              : 0;
          const middleCount = pr.id === 'dell-xe9780' ? 5 : 0;
          const front = i < frontCount,
            middle = i < middleCount;
          const index = front || middle ? i : i - frontCount - middleCount;
          const groupCount = front
            ? frontCount
            : middle
              ? middleCount
              : part.count - frontCount - middleCount;
          const cols = Math.min(
            pr.id === 'lenovo-sr680a-v4' && front ? 6 : 5,
            groupCount,
          );
          g.position.set(
            ((index % cols) - (cols - 1) / 2) * (0.415 / cols),
            0.27 + Math.floor(index / cols) * 0.081 + spread * 0.38,
            pr.depth * (front ? 0.3 : middle ? -0.05 : -0.48),
          );
          fan(g, 0, 0, 0, Math.min(0.073, 0.38 / cols));
        }
        if (['gpu', 'cpu', 'controller', 'asic'].includes(item.kind)) {
          const t = caption(item.name, 0.075, 0.015, '#e4efdf');
          t.position.set(
            0,
            item.kind === 'gpu' && props.exploded ? 0.123 : 0.047,
            0.045,
          );
          t.material.depthTest = true;
          g.add(t);
        }
        register(item.id, g);
      }
      // Guides indicate assembly separation, not signal routes.
      if (props.exploded)
        for (const x of [-0.23, 0.23])
          scene.add(
            line(
              [
                new THREE.Vector3(x, 0.19, -0.3),
                new THREE.Vector3(x, 0.6, -0.3),
              ],
              '#788c91',
              0.3,
            ),
          );
      floor.visible = false;
      grid.visible = false;
      orbit.target.set(0.1 * spread, 0.36, 0);
      camera.position.set(1.04, 1.27, 1.45);
      orbit.maxPolarAngle = Math.PI * 0.49;
    }
    const highlight = new THREE.BoxHelper(new THREE.Object3D(), GREEN);
    highlight.visible = false;
    scene.add(highlight);
    (highlight.material as THREE.LineBasicMaterial).transparent = true;
    (highlight.material as THREE.LineBasicMaterial).opacity = 0.95;
    let selectedId = current.current.selected;
    let moving = false;
    let active = true;
    const desiredPosition = new THREE.Vector3().copy(camera.position),
      desiredTarget = new THREE.Vector3().copy(orbit.target);
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    function go(position: THREE.Vector3, target: THREE.Vector3) {
      desiredPosition.copy(position);
      desiredTarget.copy(target);
      moving = true;
      if (reduced) {
        camera.position.copy(position);
        orbit.target.copy(target);
        moving = false;
      }
    }
    function focus(id: string | null) {
      selectedId = id;
      const obj = id ? objects.get(id) : undefined;
      highlight.visible = Boolean(obj);
      if (obj) highlight.setFromObject(obj);
      if (obj) {
        const bounds = new THREE.Box3().setFromObject(obj);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const aspect = Math.min(1, camera.aspect);
        const distance = props.node
          ? Math.max(0.2, (size.length() * 1.65) / aspect)
          : Math.max(1.0, (size.length() * 1.65) / aspect);
        const dir = new THREE.Vector3()
          .subVectors(camera.position, orbit.target)
          .normalize();
        go(center.clone().add(dir.multiplyScalar(distance)), center);
      }
    }
    const command = (cmd: CameraCommand) => {
      const obj = selectedId ? objects.get(selectedId) : undefined;
      const center = obj
        ? new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())
        : new THREE.Vector3(0, props.node ? 0.35 : 1, 0);
      const fit = !obj;
      const fullDistance =
        Math.max(
          rackHeight * 1.4,
          (RACKS.length * 0.82 + 0.7) / Math.max(0.35, camera.aspect),
        ) * 1.6;
      if (cmd.type === 'in' || cmd.type === 'out') {
        const offset = camera.position
          .clone()
          .sub(orbit.target)
          .multiplyScalar(cmd.type === 'in' ? 0.78 : 1.28);
        offset.clampLength(orbit.minDistance, orbit.maxDistance);
        go(orbit.target.clone().add(offset), orbit.target);
        return;
      }
      if (cmd.type === 'fit') {
        go(
          props.node
            ? new THREE.Vector3(1.04, 1.27, 1.45)
            : new THREE.Vector3(0.42, 0.25, 1)
                .normalize()
                .multiplyScalar(fullDistance)
                .add(new THREE.Vector3(0, rackHeight / 2, 0)),
          new THREE.Vector3(0, props.node ? 0.35 : 1, 0),
        );
        return;
      }
      const distance = props.node ? 1.5 : fit ? fullDistance : 1.8;
      const dir =
        cmd.type === 'front'
          ? new THREE.Vector3(0, 0, 1)
          : cmd.type === 'rear'
            ? new THREE.Vector3(0, 0.08, -1)
            : new THREE.Vector3(0.55, 0.28, 1).normalize();
      go(center.clone().add(dir.multiplyScalar(distance)), center);
    };
    api.current = {
      select: focus,
      command,
      layers: (ls) => {
        Object.entries(ls).forEach(([key, value]) => {
          wires[key as Fabric].visible = value;
        });
      },
      labels: (show) => {
        labelGroup.visible = show;
      },
    };
    command({ type: 'fit', sequence: 0 });
    api.current.layers(current.current.layers);
    api.current.labels(current.current.labels);
    if (props.node && selectedId?.includes('/')) focus(selectedId);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    let hovered: string | null = null;
    function pick(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      return ray.intersectObjects(picks, false)[0]?.object.userData
        .hardwareId as string | undefined;
    }
    function onDown(e: PointerEvent) {
      downX = e.clientX;
      downY = e.clientY;
      moving = false;
    }
    function onUp(e: PointerEvent) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const id = pick(e);
      if (id) {
        current.current.onSelect(id);
        focus(id);
      }
    }
    function onMove(e: PointerEvent) {
      const id = pick(e) ?? null;
      if (id !== hovered) {
        hovered = id;
        current.current.onHover(id);
        renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      }
    }
    function onLeave() {
      hovered = null;
      current.current.onHover(null);
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setError(true);
      current.current.onUnavailable();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return;
      renderer.setSize(element.clientWidth, element.clientHeight);
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
    });
    observer.observe(element);
    let frame = 0;
    let lastTime = performance.now();
    const animate = () => {
      if (!active) return;
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (moving) {
        const a = 1 - Math.exp(-dt * 7);
        camera.position.lerp(desiredPosition, a);
        orbit.target.lerp(desiredTarget, a);
        if (camera.position.distanceTo(desiredPosition) < 0.002) {
          moving = false;
        }
      }
      orbit.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      api.current = null;
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost,
      );
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line)
          o.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.node, props.model, props.service, props.exploded]);
  useEffect(() => {
    api.current?.select(props.selected);
  }, [props.selected]);
  useEffect(() => {
    api.current?.command(props.command);
  }, [props.command]);
  useEffect(() => {
    api.current?.layers(props.layers);
  }, [props.layers]);
  useEffect(() => {
    api.current?.labels(props.labels);
  }, [props.labels]);
  return (
    <div ref={host} className="three-host">
      {error && (
        <div className="canvas-error">
          <strong>3D rendering is unavailable</strong>
          <p>Use the inventory and topology to explore every component.</p>
        </div>
      )}
    </div>
  );
}

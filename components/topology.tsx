/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-tabindex -- SVG nodes need explicit interactive roles; the scrollable graph must be keyboard reachable. */
'use client';
import { useMemo, useState } from 'react';
import ReferenceTopology from './reference-topology';
import { MousePointer2, Network, Minus, Plus } from 'lucide-react';
import {
  fabricInfo,
  FABRICS,
  NODES,
  LEAVES,
  SPINES,
  FRONTEND,
  STORAGE_SWITCHES,
  ARRAYS,
  type ClusterModel,
  type Fabric,
  type Hardware,
} from '@/lib/hardware';
type Placed = { item: Hardware; x: number; y: number; subtitle: string };
function RackTopology({
  model,
  fabric,
  selected,
  onSelect,
}: {
  model: ClusterModel;
  fabric: Fabric;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const LINKS = model.links;
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const f = FABRICS[fabric];
  const focus = hovered ?? selected?.split('/')[0] ?? null;
  const { placed, headings } = useMemo(() => {
    const placed: Placed[] = [];
    const headings: { y: number; label: string; note: string }[] = [];
    const row = (items: Hardware[], y: number, subtitle: string) =>
      items.forEach((item, i) =>
        placed.push({
          item,
          x:
            items.length === 1
              ? 500
              : 70 + i * (860 / Math.max(items.length - 1, 1)),
          y,
          subtitle,
        }),
      );
    if (model.id !== 'h100-cluster') {
      const edges = model.links.filter((l) => l.fabric === fabric),
        connected = new Set(edges.flatMap((l) => [l.from, l.to]));
      const devices = model.hardware.filter((h) => connected.has(h.id));
      const switches = devices.filter(
          (h) => h.kind === 'qm9700' || h.kind === 'sn4600c',
        ),
        others = devices.filter((h) => !switches.includes(h));
      const put = (items: Hardware[], start: number) => {
        for (let offset = 0; offset < items.length; offset += 8)
          row(
            items.slice(offset, offset + 8),
            start + Math.floor(offset / 8) * 95,
            'Planned endpoint',
          );
      };
      put(switches, 130);
      put(
        others,
        Math.max(330, 130 + Math.ceil(switches.length / 8) * 95 + 90),
      );
      headings.push({
        y: 48,
        label: 'PLANNED TOPOLOGY',
        note: 'User-defined logical connections',
      });
    } else if (fabric === 'compute') {
      SPINES.forEach((item, i) =>
        placed.push({
          item,
          x: 205 + i * 196,
          y: 113,
          subtitle: '64 × NDR400',
        }),
      );
      row(LEAVES, 303, 'GPU rail');
      row(NODES, 518, '8 × H100');
      headings.push(
        {
          y: 48,
          label: 'SPINE LAYER',
          note: '4 switches · 64 populated ports each',
        },
        {
          y: 238,
          label: 'RAIL-ALIGNED LEAVES',
          note: '8 leaves · 8 node links + 32 spine links each',
        },
        {
          y: 453,
          label: 'COMPUTE NODES',
          note: '8 dedicated 400 Gb/s rails per node',
        },
      );
    } else if (fabric === 'frontend') {
      FRONTEND.forEach((item, i) =>
        placed.push({
          item,
          x: 300 + i * 400,
          y: 204,
          subtitle: '64 × 100 GbE',
        }),
      );
      row(NODES, 500, '2 × 100 GbE');
      headings.push(
        {
          y: 127,
          label: 'REDUNDANT FRONT-END SWITCHES',
          note: 'User access · cluster services · provisioning',
        },
        {
          y: 435,
          label: 'COMPUTE NODES',
          note: 'One 100 GbE link to each switch',
        },
      );
    } else {
      row(NODES, 120, '2 × NDR400');
      STORAGE_SWITCHES.forEach((item, i) =>
        placed.push({ item, x: 300 + i * 400, y: 320, subtitle: 'NDR / HDR' }),
      );
      ARRAYS.forEach((item, i) =>
        placed.push({
          item,
          x: 205 + i * 196,
          y: 530,
          subtitle: '250 TB usable',
        }),
      );
      headings.push(
        {
          y: 54,
          label: 'COMPUTE NODES',
          note: 'Two separate storage paths per node',
        },
        {
          y: 254,
          label: 'DEDICATED STORAGE FABRIC',
          note: '2 × QM9700 · mixed 400G / 200G ports',
        },
        {
          y: 464,
          label: 'SHARED FLASH',
          note: '4 × AI400X2 · eight HDR200 ports per appliance',
        },
      );
    }
    return { placed, headings };
  }, [fabric, model]);
  const graphHeight = Math.max(615, ...placed.map((p) => p.y + 70));
  const edges = LINKS.filter((l) => l.fabric === fabric);
  const linked = new Set(
    edges
      .filter((l) => l.from === focus || l.to === focus)
      .flatMap((l) => [l.from, l.to]),
  );
  const connectionCount = edges.reduce((s, l) => s + l.count, 0);
  return (
    <div className="topology-view">
      <div className="topology-heading">
        <div>
          <h1>{f.name}</h1>
          <p>
            {model.id === 'h100-cluster'
              ? `The eight-node rack layout. ${f.description} Select any device to inspect its hardware.`
              : model.racks.some((r) => r.mount === 'NVL72')
                ? 'The rack’s internal NVLink domain is separate from external compute, front-end and storage fabrics. No external fabric has been configured.'
                : 'Connections reflect your planned layout. No links are inferred from placement.'}
          </p>
        </div>
        <span className="topology-link-count">
          <strong>{connectionCount}</strong> logical links
        </span>
      </div>
      <div
        className="graph-scroll"
        tabIndex={0}
        aria-label={`${f.name} connection diagram. Scroll horizontally to inspect the full graph.`}
      >
        <svg
          className="fabric-graph"
          viewBox={`0 0 1000 ${graphHeight}`}
          style={{
            width: `${100 * zoom}%`,
            minWidth: 760 * zoom,
            aspectRatio: `1000/${graphHeight}`,
          }}
          role="img"
          aria-label={`${f.name} topology; each hardware box is selectable`}
        >
          <defs>
            <pattern
              id="topology-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="12" r=".7" fill="#52616a" opacity=".25" />
            </pattern>
          </defs>
          <rect width="1000" height={graphHeight} fill="url(#topology-grid)" />
          {edges.length === 0 && (
            <g>
              <text
                x="500"
                y="260"
                fill="#c0d2d9"
                fontSize="23"
                textAnchor="middle"
              >
                No external connections defined
              </text>
              <text
                x="500"
                y="298"
                fill="#849eac"
                fontSize="16"
                textAnchor="middle"
              >
                Use Build a rack → Plan connections to design this fabric.
              </text>
            </g>
          )}
          {headings.map((h) => (
            <g key={h.label}>
              <text
                x="20"
                y={h.y}
                fill="#8ba2ac"
                fontSize="13"
                fontFamily="monospace"
                letterSpacing="1.1"
              >
                {h.label}
              </text>
              <text
                x="980"
                y={h.y}
                textAnchor="end"
                fill="#6c858f"
                fontSize="12"
              >
                {h.note}
              </text>
            </g>
          ))}
          {edges.map((l) => {
            const a = placed.find((n) => n.item.id === l.from)!,
              b = placed.find((n) => n.item.id === l.to)!;
            if (!a || !b) return null;
            const up = a.y > b.y;
            const ay = a.y + (up ? -27 : 27),
              by = b.y + (up ? 27 : -27),
              mid = (ay + by) / 2;
            const same = a.y === b.y;
            const path = same
              ? `M${a.x + 53},${a.y} C${a.x + 110},${a.y - 60} ${b.x - 110},${b.y - 60} ${b.x - 53},${b.y}`
              : `M${a.x},${ay} C${a.x},${mid} ${b.x},${mid} ${b.x},${by}`;
            const active = l.from === focus || l.to === focus;
            return (
              <g key={l.id}>
                <title>{l.label}</title>
                <path
                  d={path}
                  fill="none"
                  stroke={f.color}
                  strokeWidth={active ? 2.2 : l.count > 1 ? 1.3 : 0.8}
                  opacity={focus ? (active ? 0.8 : 0.055) : 0.21}
                />
              </g>
            );
          })}
          {placed.map(({ item, x, y, subtitle }) => {
            const isSelected = item.id === selected?.split('/')[0];
            const active = !focus || linked.has(item.id) || focus === item.id;
            return (
              <g
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${item.name}, ${item.model}`}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(item.id);
                  }
                }}
                onClick={() => onSelect(item.id)}
                onPointerEnter={() => setHovered(item.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.id)}
                onBlur={() => setHovered(null)}
                className="graph-node"
                opacity={active ? 1 : 0.35}
              >
                <rect
                  x={x - 53}
                  y={y - 27}
                  width="106"
                  height="58"
                  rx="5"
                  fill={isSelected ? '#354332' : '#202b31'}
                  stroke={isSelected || focus === item.id ? f.color : '#40505a'}
                  strokeWidth={isSelected ? 1.6 : 1}
                />
                <rect
                  x={x - 53}
                  y={y - 27}
                  width="3"
                  height="58"
                  rx="1"
                  fill={f.color}
                  opacity={active ? 0.8 : 0.25}
                />
                <text
                  x={x}
                  y={y - 3}
                  textAnchor="middle"
                  fill={isSelected ? '#edffde' : '#d1dfe5'}
                  fontSize="14"
                  fontFamily="monospace"
                >
                  {item.name.length > 13
                    ? `${item.name.slice(0, 11)}…`
                    : item.name}
                </text>
                <text
                  x={x}
                  y={y + 17}
                  textAnchor="middle"
                  fill="#89a1ad"
                  fontSize="12"
                >
                  {item.id.startsWith('leaf')
                    ? `${subtitle} ${(item.index ?? 0) + 1}`
                    : subtitle}
                </text>
                <circle
                  cx={x}
                  cy={y - 29}
                  r="2.5"
                  fill={f.color}
                  opacity=".8"
                />
                <circle
                  cx={x}
                  cy={y + 33}
                  r="2.5"
                  fill={f.color}
                  opacity=".8"
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="topology-bottom">
        <div>
          <MousePointer2 size={14} />
          <span>Hover to trace · Select to inspect · Scroll to pan</span>
        </div>
        <div className="graph-zoom">
          <button
            aria-label="Zoom topology out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom topology in"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="topology-note">
        <Network size={15} />
        <span>
          {model.id !== 'h100-cluster'
            ? 'Planned nominal rates. Protocol, adapter, transceiver and cable compatibility are not validated here.'
            : fabric === 'compute'
              ? 'Each leaf–spine line groups 8 × 400 Gb/s links. Node–leaf lines are 1 × 400 Gb/s.'
              : fabric === 'storage'
                ? 'Each appliance–switch line groups 4 × 200 Gb/s links. Node links are 1 × 400 Gb/s.'
                : 'Each node has one 100 GbE link per switch. The peer link groups 2 × 100 GbE.'}
        </span>
      </div>
    </div>
  );
}

export default function Topology({
  presentation,
  ...props
}: Parameters<typeof RackTopology>[0] & {
  presentation: 'rack' | 'reference';
}) {
  const reference = props.model.fabricReferences?.[props.fabric];
  return reference && presentation === 'reference' ? (
    <ReferenceTopology
      key={`${props.model.id}-${props.fabric}`}
      plan={reference}
      color={fabricInfo(props.model, props.fabric).color}
      onInspect={props.onSelect}
    />
  ) : (
    <RackTopology {...props} />
  );
}

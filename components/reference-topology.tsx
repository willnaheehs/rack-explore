/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-tabindex -- SVG connection paths expose keyboard selection. */
'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Cable,
  Check,
  ExternalLink,
  Network,
  Plus,
  Minus,
} from 'lucide-react';
import type { FabricReference } from '@/lib/fabric-references';

export default function ReferenceTopology({
  plan,
  color,
  onInspect,
}: {
  plan: FabricReference;
  color: string;
  onInspect: (id: string) => void;
}) {
  const [selected, setSelected] = useState(
    plan.connections.find((c) => c.kind === 'link')?.id ?? plan.nodes[0]?.id,
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroll.current;
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, [plan.id]);
  const rows = [...new Set(plan.nodes.map((n) => n.row))].sort((a, b) => a - b);
  const width = Math.max(
    820,
    ...rows.map(
      (row) => plan.nodes.filter((n) => n.row === row).length * 170 + 40,
    ),
  );
  const height = Math.max(350, rows.length * 170 + 20);
  const placed = plan.nodes.map((n) => {
    const siblings = plan.nodes.filter((s) => s.row === n.row);
    return {
      ...n,
      x: ((siblings.indexOf(n) + 0.5) * width) / siblings.length,
      y: rows.indexOf(n.row) * 170 + 65,
    };
  });
  const link = plan.connections.find((c) => c.id === selected);
  const item = plan.nodes.find((n) => n.id === selected);
  const focus = hovered ?? selected;
  const focusEdge = plan.connections.find((c) => c.id === focus);
  const related = new Set(
    focusEdge
      ? [focusEdge.from, focusEdge.to]
      : [
          focus,
          ...plan.connections
            .filter((c) => c.from === focus || c.to === focus)
            .flatMap((c) => [c.from, c.to]),
        ],
  );
  const activeSources = link?.sources ?? item?.sources ?? plan.sources;
  const name = (id: string) => plan.nodes.find((n) => n.id === id)?.title ?? id;
  return (
    <div
      className="reference-topology"
      style={{ '--reference-color': color } as CSSProperties}
    >
      <div className="reference-heading">
        <div>
          <div className="reference-status">
            <Check size={13} />
            {plan.status}
            <span>Checked 6 Sep 2026</span>
          </div>
          <h1>{plan.title}</h1>
          <p>{plan.scope}</p>
        </div>
        <strong className="reference-speed">{plan.speed}</strong>
      </div>
      <p className="reference-summary">{plan.summary}</p>
      {plan.sharedWith && (
        <div className="reference-shared">
          <Network size={15} />
          <span>
            Shared physical network with{' '}
            {plan.sharedWith.includes('storage') ? 'storage' : 'front-end'}.
            These views do not add duplicate cables or ports.
          </span>
        </div>
      )}
      <div className="reference-workspace">
        <div
          ref={scroll}
          className="reference-diagram-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${plan.title} connection diagram`}
        >
          <div
            className="reference-diagram"
            style={{ width: `${width * zoom}px`, height: `${height * zoom}px` }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height="100%"
              aria-label="Sourced fabric connections"
            >
              {plan.connections.map((c) => {
                const a = placed.find((n) => n.id === c.from)!,
                  b = placed.find((n) => n.id === c.to)!;
                const y1 = a.y + 34,
                  y2 = b.y - 34,
                  mid = (y1 + y2) / 2;
                const d = `M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`;
                const active =
                  focus === c.id || focus === c.from || focus === c.to;
                return (
                  <g key={c.id}>
                    <path
                      d={d}
                      stroke={color}
                      strokeWidth={active ? 2.8 : 1.3}
                      strokeDasharray={c.kind === 'link' ? undefined : '5 5'}
                      opacity={active ? 1 : 0.3}
                      fill="none"
                    />
                    <path
                      d={d}
                      stroke="transparent"
                      strokeWidth={18}
                      fill="none"
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect connection: ${name(c.from)} to ${name(c.to)}, ${c.label}`}
                      aria-pressed={selected === c.id}
                      className="reference-edge-hit"
                      onClick={() => setSelected(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelected(c.id);
                        }
                      }}
                      onPointerEnter={() => setHovered(c.id)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={() => setHovered(c.id)}
                      onBlur={() => setHovered(null)}
                    >
                      <title>{c.label}</title>
                    </path>
                    {active && (
                      <g pointerEvents="none">
                        <rect
                          x={(a.x + b.x) / 2 - 85}
                          y={mid - 12}
                          width={170}
                          height={24}
                          rx={5}
                          fill="#152128"
                        />
                        <text
                          x={(a.x + b.x) / 2}
                          y={mid + 4}
                          textAnchor="middle"
                          fill={color}
                          fontSize={12}
                        >
                          {c.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            {placed.map((n) => (
              <button
                key={n.id}
                className={`reference-node ${selected === n.id ? 'selected' : ''} ${related.has(n.id) ? 'related' : ''}`}
                style={{
                  left: `${(n.x / width) * 100}%`,
                  top: `${(n.y / height) * 100}%`,
                  width: `${150 * zoom}px`,
                }}
                onClick={() => setSelected(n.id)}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(n.id)}
                onBlur={() => setHovered(null)}
                aria-pressed={selected === n.id}
              >
                <span>{n.title}</span>
                <small>{n.subtitle}</small>
              </button>
            ))}
          </div>
        </div>
        <aside
          className="reference-inspector"
          aria-label="Fabric connection details"
          aria-live="polite"
        >
          <div className="reference-detail-label">
            <Cable size={15} />
            {link
              ? link.kind === 'link'
                ? 'DOCUMENTED LINK GROUP'
                : link.kind === 'capability'
                  ? 'INTERFACE CAPABILITY'
                  : 'TOPOLOGY RELATIONSHIP'
              : 'COMPONENT / ROLE'}
          </div>
          <h2>
            {link
              ? `${name(link.from)} → ${name(link.to)}`
              : (item?.title ?? 'Connection details')}
          </h2>
          <p>
            {link?.detail ||
              item?.detail ||
              'Select a connection or component to inspect its evidence.'}
          </p>
          {link && (
            <dl>
              <dt>Protocol</dt>
              <dd>{link.protocol}</dd>
              <dt>
                {link.kind === 'capability'
                  ? 'Maximum capability'
                  : 'Link mode'}
              </dt>
              <dd>
                {link.count !== undefined && link.rateGbps !== undefined
                  ? `${link.count} × ${link.rateGbps} Gb/s`
                  : 'Cable population not specified'}
              </dd>
              <dt>From</dt>
              <dd>{link.fromPort}</dd>
              <dt>To</dt>
              <dd>{link.toPort}</dd>
              <dt>Cable / optics</dt>
              <dd>{link.medium}</dd>
              {link.sharedPhysicalId && (
                <>
                  <dt>Physical group</dt>
                  <dd>Shared between storage and front-end</dd>
                </>
              )}
            </dl>
          )}
          {item?.hardwareId && (
            <button
              className="reference-inspect-hardware"
              onClick={() => onInspect(item.hardwareId!)}
            >
              Inspect physical chassis <ArrowUpRight size={14} />
            </button>
          )}
          {item &&
            plan.connections
              .filter((c) => c.from === item.id || c.to === item.id)
              .map((c) => (
                <button
                  key={c.id}
                  className="reference-connection-button"
                  onClick={() => setSelected(c.id)}
                >
                  {c.label}
                  <small>{name(c.from === item.id ? c.to : c.from)}</small>
                </button>
              ))}
          <h3>Source evidence</h3>
          {activeSources.map((s) => (
            <a
              className="reference-source"
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {s.title}
                <small>{s.section}</small>
              </span>
              <ExternalLink size={13} />
            </a>
          ))}
        </aside>
      </div>
      <div className="reference-footer">
        <span>
          <i />
          Documented link <i className="dashed" />
          Relationship / capability
        </span>
        <div className="graph-zoom">
          <button
            aria-label="Zoom reference out"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom reference in"
            disabled={zoom >= 1.5}
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <details className="reference-limits">
        <summary>Scope and remaining configuration details</summary>
        {plan.limitations.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </details>
    </div>
  );
}

'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Zap,
  Factory,
  UtilityPole,
  BatteryCharging,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Info,
  Minus,
  Plus,
  Maximize,
  Server,
  Plug,
  Workflow,
  ShieldCheck,
  Cpu,
  HardDrive,
  CircuitBoard,
  Network,
  Wind,
  RotateCcw,
  Settings2,
  Activity,
  BookOpen,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Choice } from './catalog-panel';
import { type ClusterModel } from '@/lib/hardware';
import { type ModelContext } from '@/lib/webmcp';
import { powerTools } from '@/lib/power-tools';
import {
  initialPowerSettings,
  calculatePower,
  powerDevices,
  powerGraph,
  traceAncestors,
  SCENARIOS,
  POWER_SOURCES,
  watts,
  type PowerSettings,
  type PowerScope,
  type PowerScenario,
  type PowerNode,
  type PowerEdge,
} from '@/lib/power';
const COLORS = { a: '#8cbfff', b: '#f4b66b', dc: '#c3f16b', shared: '#bbc9d1' };
const ICONS = {
  utility: UtilityPole,
  transformer: Workflow,
  generator: Factory,
  ats: ShieldCheck,
  ups: Activity,
  battery: BatteryCharging,
  distribution: Workflow,
  pdu: Plug,
  psu: Zap,
  busbar: Zap,
  rack: Server,
  server: Server,
  connector: Plug,
  board: CircuitBoard,
  vrm: Cpu,
  gpu: Cpu,
  cpu: Cpu,
  memory: CircuitBoard,
  storage: HardDrive,
  network: Network,
  aux: Wind,
};
function PowerIcon({ kind, size = 20 }: { kind: string; size?: number }) {
  const Icon = ICONS[kind as keyof typeof ICONS] ?? Zap;
  return <Icon size={size} />;
}
const scopeFirst: Record<PowerScope, string> = {
  facility: 'utility',
  rack: 'feed-a',
  board: 'board-input',
};
function NodeSchematic({ kind }: { kind: string }) {
  return (
    <div className={`power-symbol symbol-${kind}`} aria-hidden="true">
      {kind === 'battery' ? (
        <>
          <i />
          <i />
          <i />
          <i />
        </>
      ) : kind === 'ups' ? (
        <>
          <span>~</span>
          <b />
          <span>⎓</span>
          <b />
          <span>~</span>
        </>
      ) : kind === 'psu' ? (
        <>
          <span>~</span>
          <b />
          <span>⎓</span>
        </>
      ) : kind === 'vrm' ? (
        <>
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </>
      ) : kind === 'rack' || kind === 'server' ? (
        <>
          <i />
          <i />
          <i />
        </>
      ) : kind === 'transformer' ? (
        <>
          <i />
          <i />
        </>
      ) : (
        <>
          <PowerIcon kind={kind} size={30} />
        </>
      )}
    </div>
  );
}
function Diagram({
  nodes,
  edges,
  width,
  height,
  selected,
  onSelect,
  motion,
}: {
  nodes: PowerNode[];
  edges: PowerEdge[];
  width: number;
  height: number;
  selected: string;
  onSelect: (id: string) => void;
  motion: boolean;
}) {
  const scroll = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 900, height: 500 }),
    [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    const host = scroll.current;
    if (!host) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: host.clientWidth, height: host.clientHeight }),
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  const scale =
    zoom ??
    Math.max(
      0.48,
      Math.min(1, size.width / width, (size.height - 15) / height),
    );
  const traced = traceAncestors(nodes, edges, selected);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const path = (e: PowerEdge) => {
    const a = nodes.find((n) => n.id === e.from)!,
      b = nodes.find((n) => n.id === e.to)!;
    const vertical = Math.abs(a.x - b.x) < 25;
    const ax = vertical ? a.x + 104 : a.x + 208,
      ay = vertical ? a.y + (a.y > b.y ? 0 : 96) : a.y + 48,
      bx = vertical ? b.x + 104 : b.x,
      by = vertical ? b.y + (a.y > b.y ? 96 : 0) : b.y + 48;
    const middle = (ax + bx) / 2;
    return vertical
      ? `M${ax} ${ay} L${bx} ${by}`
      : `M${ax} ${ay} C${middle} ${ay} ${middle} ${by} ${bx} ${by}`;
  };
  return (
    <div className="power-diagram-shell">
      <div className="power-diagram-legend">
        <span>
          <i style={{ background: COLORS.a }} /> Feed A
        </span>
        <span>
          <i style={{ background: COLORS.b }} /> Feed B
        </span>
        <span>
          <i style={{ background: COLORS.dc }} /> DC / load
        </span>
        <span className="power-reserve-key">··· Reserve / unavailable</span>
      </div>
      <div
        ref={scroll}
        className="power-diagram-scroll"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          const el = scroll.current!;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: el.scrollLeft,
            top: el.scrollTop,
          };
          el.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          scroll.current!.scrollLeft =
            drag.current.left - (e.clientX - drag.current.x);
          scroll.current!.scrollTop =
            drag.current.top - (e.clientY - drag.current.y);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="power-diagram-size"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            className="power-diagram-canvas"
            style={{ width, height, transform: `scale(${scale})` }}
          >
            <svg
              width={width}
              height={height}
              className="power-wires"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="power-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r=".7" fill="#77909b" opacity=".2" />
                </pattern>
              </defs>
              <rect width={width} height={height} fill="url(#power-grid)" />
              {edges.map((e) => {
                const strong = traced.has(e.from) && traced.has(e.to),
                  d = path(e);
                return (
                  <g key={`${e.from}-${e.to}`} opacity={strong ? 1 : 0.27}>
                    <path
                      d={d}
                      stroke={COLORS[e.feed]}
                      strokeWidth={e.active ? 3 : 1.5}
                      strokeDasharray={e.active ? undefined : '4 6'}
                      opacity={e.active ? 0.42 : 0.5}
                      fill="none"
                    />
                    {e.active && (
                      <path
                        className={motion ? 'power-flow' : ''}
                        d={d}
                        stroke={COLORS[e.feed]}
                        strokeWidth={2.5}
                        strokeDasharray="5 16"
                        fill="none"
                        opacity={0.9}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            {nodes.map((n) => (
              <button
                key={n.id}
                className={`power-node ${selected === n.id ? 'selected' : ''} ${n.active ? 'energized' : 'offline'} ${traced.has(n.id) ? 'traced' : 'muted-node'}`}
                style={
                  {
                    left: n.x,
                    top: n.y,
                    '--power-color': COLORS[n.feed],
                  } as CSSProperties
                }
                aria-pressed={selected === n.id}
                onClick={() => onSelect(n.id)}
              >
                <div className="power-node-icon">
                  <PowerIcon kind={n.kind} size={18} />
                </div>
                <div className="power-node-copy">
                  <strong>{n.title}</strong>
                  <span>{n.subtitle}</span>
                </div>
                <span className="power-node-status" />
                {n.nextScope && (
                  <span className="power-node-drill">
                    <ArrowRight size={13} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="power-diagram-footer">
        <span>Drag to pan · Select to trace upstream</span>
        <div className="power-zoom">
          <button
            aria-label="Zoom power diagram out"
            onClick={() => setZoom(Math.max(0.4, scale - 0.15))}
          >
            <Minus size={14} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            aria-label="Zoom power diagram in"
            onClick={() => setZoom(Math.min(1.6, scale + 0.15))}
          >
            <Plus size={14} />
          </button>
          <button
            aria-label="Fit power diagram"
            title="Fit power diagram"
            onClick={() => setZoom(null)}
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
export default function PowerView({
  model,
  initialRackId,
  initialHardwareId,
  onRackChange,
  onInspect,
}: {
  model: ClusterModel;
  initialRackId?: string;
  initialHardwareId?: string;
  onRackChange: (rackId: string) => void;
  onInspect: (id: string) => void;
}) {
  const [settings, setSettings] = useState<PowerSettings>(() =>
    initialPowerSettings(model, initialRackId, initialHardwareId),
  );
  const [motion, setMotion] = useState(true),
    [assumptions, setAssumptions] = useState(false);
  const s = settings,
    c = useMemo(() => calculatePower(model, s), [model, s]),
    graph = useMemo(() => powerGraph(model, s), [model, s]);
  const stage = graph.nodes.find((n) => n.id === s.stageId) ?? graph.nodes[0];
  const stageIndex = graph.nodes.findIndex((n) => n.id === stage?.id);
  useEffect(() => {
    onRackChange(s.rackId);
  }, [s.rackId, onRackChange]);
  const state = useRef(s);
  useEffect(() => {
    state.current = s;
  }, [s]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const abort = new AbortController();
    for (const tool of powerTools({
      model: () => model,
      read: () => state.current,
      configure: (next) => {
        flushSync(() => setSettings(next));
      },
    })) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: abort.signal }),
        ).catch(() => {});
      } catch {
        /* Optional page capability. */
      }
    }
    return () => abort.abort();
  }, [model]);
  const patch = (value: Partial<PowerSettings>) =>
    setSettings((prev) => ({ ...prev, ...value }));
  const changeScope = (scope: PowerScope) =>
    patch({ scope, stageId: scopeFirst[scope] });
  const available = powerDevices(model, s.rackId);
  const currentBudget = c.budgets.find((p) => p.hardware.id === s.hardwareId);
  const selectStage = (stageId: string) => patch({ stageId });
  const sourceName =
    s.scenario === 'battery'
      ? 'Battery DC'
      : s.scenario === 'generator'
        ? 'Generator AC'
        : 'Utility AC';
  const allKnown = c.budgets.every((b) => b.documented && !b.override);
  return (
    <section className="power-workspace" aria-label="Interactive power path">
      <div className="power-main">
        <header className="power-title">
          <div>
            <div className="eyebrow">
              <Zap size={13} /> POWER EXPLORER
            </div>
            <h1>Follow the energy.</h1>
            <p>From the source to the component. One path, at three scales.</p>
          </div>
          <span className="power-model-badge">EXPLANATORY MODEL</span>
        </header>
        <div className="power-targets">
          <label htmlFor="power-rack">
            Rack
            <Choice
              id="power-rack"
              label="Power target rack"
              value={s.rackId}
              onChange={(id) => setSettings(initialPowerSettings(model, id))}
              options={model.racks.map((r) => ({
                value: r.id,
                label: `${r.id} · ${r.name}`,
              }))}
            />
          </label>
          <label htmlFor="power-device">
            Device
            <Choice
              id="power-device"
              label="Power target hardware"
              value={s.hardwareId}
              onChange={(id) =>
                patch({
                  hardwareId: id,
                  deviceBudgetKW: null,
                  stageId: scopeFirst[s.scope],
                })
              }
              options={available.map((h) => ({
                value: h.id,
                label: `${h.name} · U${h.u}`,
              }))}
            />
          </label>
        </div>
        <Tabs
          value={s.scope}
          onValueChange={(v) => changeScope(v as PowerScope)}
          className="power-scope-tabs"
        >
          <TabsList variant="line">
            <TabsTrigger value="facility">
              <span>01</span> Source & facility
            </TabsTrigger>
            <TabsTrigger value="rack">
              <span>02</span> Rack distribution
            </TabsTrigger>
            <TabsTrigger value="board">
              <span>03</span> Inside hardware
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="power-scenario-row">
          <label htmlFor="power-supply">
            Supply scenario
            <Choice
              id="power-supply"
              label="Power supply scenario"
              value={s.scenario}
              onChange={(scenario) =>
                patch({ scenario: scenario as PowerScenario })
              }
              options={SCENARIOS.map(({ value, label }) => ({ value, label }))}
            />
          </label>
          <div className="power-load">
            <div>
              <span id="power-load-label">Load budget</span>
              <strong>{s.loadPercent}%</strong>
            </div>
            <Slider
              aria-labelledby="power-load-label"
              value={[s.loadPercent]}
              min={0}
              max={100}
              step={5}
              onValueChange={(value) =>
                patch({ loadPercent: Array.isArray(value) ? value[0] : value })
              }
            />
          </div>
          <button
            className={`icon-button power-settings ${assumptions ? 'active' : ''}`}
            onClick={() => setAssumptions(!assumptions)}
            aria-label="Show power assumptions"
            title="Power assumptions"
            aria-expanded={assumptions}
          >
            <Settings2 size={18} />
          </button>
        </div>
        {assumptions && (
          <div className="power-assumptions">
            <div className="power-assumption-heading">
              <strong>Adjust the example</strong>
              <span>
                These settings change the model, never real equipment.
              </span>
            </div>
            <div className="power-assumption-grid">
              <label htmlFor="power-voltage">
                Three-phase distribution
                <Choice
                  id="power-voltage"
                  label="Distribution line voltage"
                  value={String(s.lineVoltage)}
                  onChange={(v) =>
                    patch({ lineVoltage: Number(v) as 208 | 400 | 415 })
                  }
                  options={[
                    { value: '208', label: '208 V L–L / 120 V L–N' },
                    { value: '400', label: '400 V L–L / 231 V L–N' },
                    { value: '415', label: '415 V L–L / 240 V L–N' },
                  ]}
                />
              </label>
              <label>
                Usable current per feed / phase
                <input
                  aria-label="Usable feed amps"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={s.feedAmps}
                  onChange={(e) =>
                    patch({
                      feedAmps: Math.max(
                        1,
                        Math.min(1000, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
                <small>
                  Aggregate path capacity, not a breaker recommendation.
                </small>
              </label>
              <label>
                UPS conversion efficiency (%)
                <input
                  aria-label="UPS efficiency percent"
                  type="number"
                  min={80}
                  max={100}
                  value={s.upsEfficiency}
                  onChange={(e) =>
                    patch({
                      upsEfficiency: Math.max(
                        80,
                        Math.min(100, Number(e.target.value) || 80),
                      ),
                    })
                  }
                />
              </label>
              <label>
                PSU conversion efficiency (%)
                <input
                  aria-label="PSU efficiency percent"
                  type="number"
                  min={80}
                  max={100}
                  value={s.psuEfficiency}
                  onChange={(e) =>
                    patch({
                      psuEfficiency: Math.max(
                        80,
                        Math.min(100, Number(e.target.value) || 80),
                      ),
                    })
                  }
                />
              </label>
              <label>
                Total usable battery energy (kWh)
                <input
                  aria-label="Usable UPS battery energy"
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  value={s.batteryKWh}
                  onChange={(e) =>
                    patch({
                      batteryKWh: Math.max(
                        0,
                        Math.min(1000, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </label>
              <label>
                Selected device AC budget (kW)
                <input
                  aria-label="Selected device power budget"
                  disabled={!c.h}
                  type="number"
                  min={0}
                  max={1000}
                  step={0.1}
                  value={Number(
                    (s.deviceBudgetKW ?? currentBudget?.kw ?? 0).toFixed(3),
                  )}
                  onChange={(e) =>
                    patch({
                      deviceBudgetKW: Math.max(
                        0,
                        Math.min(1000, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
                <small>
                  {s.deviceBudgetKW === null
                    ? currentBudget?.documented
                      ? 'Manufacturer specification'
                      : 'Illustrative allocation / allowance'
                    : 'Your override'}{' '}
                  ·{' '}
                  {s.deviceBudgetKW !== null && (
                    <button onClick={() => patch({ deviceBudgetKW: null })}>
                      Reset to default
                    </button>
                  )}
                </small>
              </label>
            </div>
            <p>
              Other assumptions: 98.5% transformer efficiency, 99% distribution
              efficiency, 0.99 power factor, balanced phases, equal A/B sharing,
              and 90% combined board regulation efficiency. Component shares are
              normalized examples. Battery capacity is total usable DC energy;
              reserve, aging and other facility loads are excluded.
            </p>
          </div>
        )}
        <div className="power-metrics">
          <div>
            <span>{sourceName} required</span>
            <strong>
              {c.sourceKW.toFixed(2)}
              <small> kW</small>
            </strong>
            <small>Allocated to this rack</small>
          </div>
          <div>
            <span>Rack AC input</span>
            <strong>
              {c.acKW.toFixed(2)}
              <small> kW</small>
            </strong>
            <small>
              {s.loadPercent}% of {c.rackBaseKW.toFixed(2)} kW budget
            </small>
          </div>
          <div>
            <span>Conversion & distribution</span>
            <strong>
              {(c.sourceKW - c.dcKW).toFixed(2)}
              <small> kW</small>
            </strong>
            <small>Loss before board regulation</small>
          </div>
          <div>
            <span>
              {s.scenario === 'battery'
                ? 'Battery runtime'
                : 'DC to rack loads'}
            </span>
            <strong>
              {s.scenario === 'battery'
                ? c.batteryMinutes === null
                  ? '—'
                  : c.batteryMinutes.toFixed(1)
                : c.dcKW.toFixed(2)}
              <small>{s.scenario === 'battery' ? ' min' : ' kW'}</small>
            </strong>
            <small>
              {s.scenario === 'battery'
                ? 'Constant-load estimate'
                : 'After PSU conversion'}
            </small>
          </div>
        </div>
        <div
          className={`power-scenario-note ${c.overloaded || c.caution || !c.on ? 'attention' : ''}`}
        >
          <Activity size={17} />
          <div>
            <strong>
              {
                SCENARIOS.find((scenario) => scenario.value === s.scenario)
                  ?.label
              }
            </strong>
            <span>
              {
                SCENARIOS.find((scenario) => scenario.value === s.scenario)
                  ?.description
              }
            </span>
            {c.overloaded && (
              <b>
                Requested load exceeds a surviving feed’s assumed capacity.
                Power values show demand, not a guaranteed delivered load.
              </b>
            )}
            {s.scenario === 'battery' && s.batteryKWh === 0 && (
              <b>
                No battery energy is allocated. AC continuity cannot be
                sustained.
              </b>
            )}
          </div>
        </div>
        <div className="power-graph-heading">
          <h2>{graph.title}</h2>
          <p>{graph.description}</p>
        </div>
        <Diagram
          key={s.scope}
          {...graph}
          selected={stage?.id ?? ''}
          onSelect={selectStage}
          motion={motion && c.sourceKW > 0}
        />
        <div className="power-stage-strip" aria-label="Power stages">
          {graph.nodes.map((n, i) => (
            <button
              key={n.id}
              onClick={() => selectStage(n.id)}
              className={stage?.id === n.id ? 'active' : ''}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {n.title}
            </button>
          ))}
        </div>
        <footer className="power-bottom">
          <label htmlFor="power-motion">
            <Switch
              id="power-motion"
              checked={motion}
              onCheckedChange={setMotion}
            />
            <span>Animate energized paths</span>
          </label>
          <span>
            Not live telemetry ·{' '}
            {allKnown
              ? 'Source-based input budgets'
              : 'Includes planning allowances'}
          </span>
          <button
            className="text-button"
            onClick={() => {
              setSettings(initialPowerSettings(model, s.rackId, s.hardwareId));
              setAssumptions(false);
            }}
          >
            <RotateCcw size={13} /> Reset scenario
          </button>
        </footer>
      </div>
      <aside className="power-inspector" aria-label="Power stage inspector">
        {stage ? (
          <>
            <div className="power-inspector-top">
              <span className="eyebrow">
                POWER STAGE {String(stageIndex + 1).padStart(2, '0')}
              </span>
              <span
                className={stage.active ? 'power-state-on' : 'power-state-off'}
              >
                {stage.active ? 'Energized' : 'Reserve / unavailable'}
              </span>
            </div>
            <div
              className="power-stage-illustration"
              style={{ '--power-color': COLORS[stage.feed] } as CSSProperties}
            >
              <NodeSchematic kind={stage.kind} />
              <span>
                {stage.feed === 'a'
                  ? 'FEED A'
                  : stage.feed === 'b'
                    ? 'FEED B'
                    : stage.feed === 'dc'
                      ? 'DC / LOAD'
                      : 'UPSTREAM SUPPLY'}
              </span>
            </div>
            <h2>{stage.title}</h2>
            <p className="power-stage-description">{stage.description}</p>
            {stage.nextScope && (
              <button
                className="primary-button"
                onClick={() => changeScope(stage.nextScope!)}
              >
                Continue{' '}
                {stage.nextScope === 'rack'
                  ? 'into the rack'
                  : 'inside the hardware'}{' '}
                <ArrowRight size={17} />
              </button>
            )}
            {stage.hardwareId && (
              <button
                className="text-button"
                onClick={() => onInspect(stage.hardwareId!)}
              >
                <CircuitBoard size={15} /> Inspect physical hardware{' '}
                <ArrowUpRight size={14} />
              </button>
            )}
            <div className="power-facts">
              {stage.facts.map((f) => (
                <div key={f.label}>
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                  {f.note && <small>{f.note}</small>}
                </div>
              ))}
            </div>
            {s.scope === 'board' && stage.id.startsWith('load-') && (
              <div className="power-component-links">
                <h3>Inspect a module</h3>
                {c.allocation
                  .find((g) => `load-${g.key}` === stage.id)
                  ?.items.map((item) => (
                    <button key={item.id} onClick={() => onInspect(item.id)}>
                      <span>{item.name}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
              </div>
            )}
            <div className="power-feed-summary">
              <h3>A/B feed loading</h3>
              {(['a', 'b'] as const).map((feed) => {
                const kw = feed === 'a' ? c.aKW : c.bKW,
                  amps = feed === 'a' ? c.aAmps : c.bAmps,
                  active = feed === 'a' ? c.a : c.b;
                return (
                  <div
                    key={feed}
                    style={{ '--power-color': COLORS[feed] } as CSSProperties}
                  >
                    <div>
                      <span>Feed {feed.toUpperCase()}</span>
                      <strong>
                        {active ? `${amps.toFixed(1)} A` : 'Unavailable'}
                      </strong>
                    </div>
                    <div className="power-load-track">
                      <i
                        style={{
                          width: `${Math.min(100, (kw / c.feedCapacityKW) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>
                      {watts(kw)} / {watts(c.feedCapacityKW)} assumed capacity
                    </small>
                  </div>
                );
              })}
              <p>{c.resilience}</p>
            </div>
            <div className="power-loss-stack">
              <h3>Where energy goes</h3>
              {[
                { name: 'Transformer loss', kw: c.losses.transformer },
                { name: 'UPS conversion loss', kw: c.losses.ups },
                { name: 'Distribution loss', kw: c.losses.distribution },
                { name: 'PSU / shelf loss', kw: c.losses.psu },
                { name: 'DC delivered to IT boards', kw: c.dcKW },
              ].map((row) => (
                <div key={row.name}>
                  <span>{row.name}</span>
                  <strong>{watts(row.kw)}</strong>
                </div>
              ))}
              <p>
                Sum = {watts(c.sourceKW)} upstream input. Board regulation adds
                loss inside the IT load. Cooling plant consumption is not
                included.
              </p>
            </div>
            <div className="sources-block">
              <div className="eyebrow">
                <BookOpen size={13} /> TECHNICAL REFERENCES
              </div>
              {(stage.sources.length
                ? stage.sources
                : [POWER_SOURCES.distribution]
              ).map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.title}
                  <ArrowUpRight size={13} />
                </a>
              ))}
            </div>
            <div className="power-truth-note">
              <Info size={15} />
              <p>
                Illustrative one-line architecture. Site voltages, efficiencies,
                phase balance, feed assignments and board layouts are explicit
                examples. Electrical protection coordination and installation
                design are outside this explorer.
              </p>
            </div>
            <button
              className="secondary-button power-next-stage"
              onClick={() =>
                selectStage(
                  graph.nodes[(stageIndex + 1) % graph.nodes.length].id,
                )
              }
            >
              Next stage <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <div className="power-empty">
            <Server size={30} />
            <h2>This rack is empty</h2>
            <p>
              Add hardware in the custom rack builder to explore its component
              power path.
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}

'use client';
import {
  useCallback,
  useMemo,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import {
  Box,
  Network,
  Server,
  Cpu,
  CircuitBoard,
  HardDrive,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowLeft,
  X,
  Maximize,
  RotateCcw,
  Plus,
  Minus,
  MoveUpRight,
  Layers3,
  BookOpen,
  MousePointer2,
  PanelLeftClose,
  PanelLeft,
  SlidersHorizontal,
  Snowflake,
  Zap,
  MemoryStick,
  Cable,
  Check,
  Info,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { flushSync } from 'react-dom';
import {
  explorerTools,
  type ExplorerState,
  type ModelContext,
} from '@/lib/webmcp';
import Topology from './topology';
import { withReferenceFabrics } from '@/lib/fabric-references';
import PowerView from './power-view';
import CatalogPanel from './catalog-panel';
import RackBuilder from './rack-builder';
import {
  profileFor,
  populationLabel,
  CATALOG_DATE,
  type Profile,
} from '@/lib/catalog';
import { validateConfiguration } from '@/lib/config-validation';
import ConfigurationChecks from './configuration-checks';
import { blankModel, cloneForBuilder, totals } from '@/lib/rack-builder';
import ClusterScene, { type CameraCommand } from './cluster-scene';
import {
  DEFAULT_MODEL,
  FABRICS,
  MODEL_NOTE,
  childrenOf,
  resolveHardware as lookupHardware,
  specsFor,
  descriptionFor,
  referencesFor,
  linksFor,
  type ClusterModel,
  type Fabric,
  type Hardware,
  type HardwareKind,
} from '@/lib/hardware';
function subscribeScreen(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}
const ICONS = {
  dgx: Server,
  qm9700: Network,
  sn4600c: Network,
  ai400x2: HardDrive,
  gpu: CircuitBoard,
  cpu: Cpu,
  nvlink: Network,
  nic: Cable,
  nvme: HardDrive,
  memory: MemoryStick,
  board: CircuitBoard,
  backplane: CircuitBoard,
  controller: Cpu,
  asic: Cpu,
  port: Cable,
  psu: Zap,
  fan: Snowflake,
};
function ColorDot({ color }: { color: string }) {
  return <span className="color-dot" style={{ background: color }} />;
}
function HardwareIcon({
  kind,
  size = 16,
}: {
  kind: HardwareKind;
  size?: number;
}) {
  const Icon = ICONS[kind];
  return <Icon size={size} />;
}

export default function Explorer() {
  const [model, setModel] = useState<ClusterModel>(() =>
    withReferenceFabrics(DEFAULT_MODEL),
  );
  const [catalog, setCatalog] = useState(false),
    [builder, setBuilder] = useState(false);
  const [draft, setDraft] = useState<ClusterModel>(blankModel),
    [builderProfile, setBuilderProfile] = useState<Profile | null>(null);
  const [service, setService] = useState(false),
    [exploded, setExploded] = useState(true);
  const [isolated, setIsolated] = useState(false);
  const resolveHardware = (id: string | null) => lookupHardware(id, model);
  const metrics = totals(model);
  const validation = useMemo(() => validateConfiguration(model), [model]);
  const [selected, setSelected] = useState<string | null>(null);
  const [node, setNode] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState('physical');
  const [powerRackId, setPowerRackId] = useState<string | undefined>(undefined);
  const [powerRevision, setPowerRevision] = useState(0);
  const [layers, setLayers] = useState<Record<Fabric, boolean>>({
    compute: false,
    frontend: false,
    storage: false,
  });
  const [labels, setLabels] = useState(true);
  const [expanded, setExpanded] = useState<string[]>(['A01']);
  const smallScreen = useSyncExternalStore(
    subscribeScreen,
    () => window.innerWidth <= 650,
    () => false,
  );
  const [inventoryOverride, setInventory] = useState<boolean | null>(null);
  const inventory = inventoryOverride ?? !smallScreen;
  const [docs, setDocs] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [command, setCommand] = useState<CameraCommand>({
    type: 'iso',
    sequence: 0,
  });
  const [detailTab, setDetailTab] = useState('overview');
  const [topologyFabric, setTopologyFabric] = useState<Fabric>('compute');
  const [topologyPresentation, setTopologyPresentation] = useState<
    'rack' | 'reference'
  >('rack');

  const openPower = useCallback((rackId: string) => {
    setPowerRackId(rackId);
    setPowerRevision((value) => value + 1);
    setView('power');
    setMobileInspector(false);
  }, []);

  const h = resolveHardware(selected),
    hover = resolveHardware(hovered);
  const select = useCallback(
    (id: string) => {
      const item = lookupHardware(id, model);
      if (!item) return;
      setSelected(id);
      setIsolated(!!item.parent);
      setHovered(null);
      setPowerRackId(item.rack);
      setPowerRevision((value) => value + 1);
      setNode((prev) => item.parent ?? (prev === item.id ? prev : null));
      setExpanded((old) =>
        old.includes(item.rack) ? old : [...old, item.rack],
      );
      setDetailTab('overview');
      if (window.innerWidth < 1100) setMobileInspector(true);
    },
    [model],
  );
  const camera = (type: CameraCommand['type']) =>
    setCommand((c) => ({ type, sequence: c.sequence + 1 }));
  const reset = useCallback(() => {
    setSelected(null);
    setNode(null);
    setIsolated(false);
    setDetailTab('overview');
    setCommand((c) => ({ type: 'fit', sequence: c.sequence + 1 }));
  }, []);
  const loadModel = (next: ClusterModel) => {
    setIsolated(false);
    const displayed = withReferenceFabrics(next);
    setModel(displayed);
    setTopologyPresentation(
      displayed.links.length || !displayed.fabricReferences
        ? 'rack'
        : 'reference',
    );
    setPowerRackId(undefined);
    setSelected(null);
    setNode(null);
    setHovered(null);
    setExpanded(displayed.racks.map((r) => r.id));
    setLayers({
      compute: false,
      frontend: false,
      storage: false,
    });
    setView('physical');
    setService(false);
    camera('fit');
  };
  const openBuilder = () => {
    setBuilderProfile(null);
    if (model.custom) setDraft(model);
    setBuilder(true);
  };
  const exploreNode = (id: string) => {
    setIsolated(false);
    setNode(id);
    setSelected(id);
    setView('physical');
    setDetailTab('components');
    setMobileInspector(false);
  };
  const chooseChild = (id: string) => {
    const root = id.split('/')[0];
    setNode(root);
    select(id);
    setView('physical');
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.matches(
          'input,textarea,[contenteditable],button,[role=combobox]',
        )
      )
        return;
      if (
        e.key === 'Escape' &&
        !docs &&
        !mobileInspector &&
        !catalog &&
        !builder
      )
        reset();
      if (
        e.key.toLowerCase() === 'f' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !docs &&
        !mobileInspector &&
        !catalog &&
        !builder
      ) {
        e.preventDefault();
        camera('fit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset, docs, mobileInspector, catalog, builder]);
  const stateRef = useRef<ExplorerState>({
    selected,
    node,
    view,
    fabric: topologyFabric,
    topologyPresentation,
    model,
    powerRackId,
    componentPresentation: isolated ? 'isolated' : 'assembly',
  });
  useEffect(() => {
    stateRef.current = {
      selected,
      node,
      view,
      fabric: topologyFabric,
      topologyPresentation,
      model,
      powerRackId,
      componentPresentation: isolated ? 'isolated' : 'assembly',
    };
  }, [
    selected,
    node,
    view,
    topologyFabric,
    topologyPresentation,
    model,
    powerRackId,
    isolated,
  ]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const actions = {
      read: () => stateRef.current,
      inspect: (id: string) => {
        flushSync(() => {
          select(id);
          setView('physical');
        });
      },
      showPower: (rackId: string) => {
        flushSync(() => {
          openPower(rackId);
        });
      },
      showFabric: (
        fabric: Fabric,
        platform?: ClusterModel,
        presentation?: 'rack' | 'reference',
      ) => {
        flushSync(() => {
          if (platform) loadModel(platform);
          if (presentation) setTopologyPresentation(presentation);
          setTopologyFabric(fabric);
          setView('topology');
        });
      },
    };
    for (const tool of explorerTools(actions)) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifecycle.abort();
  }, [select, openPower]);
  const inspector = (mobile = false) => (
    <>
      <div className="inspector-heading">
        <span className="eyebrow">
          {h ? 'COMPONENT INSPECTOR' : 'CLUSTER OVERVIEW'}
        </span>
        {mobile ? (
          <SheetClose
            className="icon-button"
            aria-label="Close inspector"
            title="Close inspector"
          >
            <X size={16} />
          </SheetClose>
        ) : h ? (
          <button
            className="icon-button"
            title="Clear selection"
            aria-label="Clear selection"
            onClick={reset}
          >
            <X size={16} />
          </button>
        ) : (
          <Box size={16} />
        )}
      </div>
      {!h && <ConfigurationChecks report={validation} />}
      {h ? (
        <>
          <div className="component-title">
            <div
              className="component-icon"
              style={
                {
                  '--component-color': h.fabric
                    ? FABRICS[h.fabric].color
                    : '#c3f16b',
                } as CSSProperties
              }
            >
              <HardwareIcon kind={h.kind} size={26} />
            </div>
            <span className="model-maker">
              {h.parent
                ? resolveHardware(h.parent)?.name
                : `RACK ${h.rack} · U${h.u}${h.height > 1 ? `–${h.u + h.height - 1}` : ''}`}
            </span>
            <h2>{h.name}</h2>
            <p>{h.model}</p>
          </div>
          <Tabs
            value={detailTab}
            onValueChange={(v) => setDetailTab(String(v))}
            className="inspector-tabs"
          >
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {(childrenOf(h).length > 0 || h.parent) && (
                <TabsTrigger value="components">Components</TabsTrigger>
              )}
              <TabsTrigger value="connections">Connections</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="component-description">{descriptionFor(h)}</p>
              <button
                className="text-button"
                onClick={() => {
                  openPower(h.rack);
                }}
              >
                <Zap size={15} /> Trace power to this hardware{' '}
                <ArrowUpRight size={14} />
              </button>
              {!h.parent && childrenOf(h).length > 0 && (
                <button
                  className="primary-button explore-button"
                  onClick={() => exploreNode(h.id)}
                >
                  Explore components <MoveUpRight size={17} />
                </button>
              )}
              {h.parent && (
                <button
                  className="text-button"
                  onClick={() => exploreNode(h.parent!)}
                >
                  <ArrowLeft size={14} /> Back to{' '}
                  {resolveHardware(h.parent)?.name}
                </button>
              )}
              <div className="spec-list">
                {specsFor(h).map((s) => (
                  <div className="spec-row" key={s.label}>
                    <span>{s.label}</span>
                    <div>
                      <strong>{s.value}</strong>
                      {s.note && <small>{s.note}</small>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="sources-block">
                <div className="eyebrow">
                  <BookOpen size={13} /> MANUFACTURER REFERENCES
                </div>
                {referencesFor(h).map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="components">
              <p className="muted intro-small">
                Select a component to locate it and inspect its specifications.
              </p>
              {profileFor(h).parts.map((p) => (
                <ComponentGroup
                  key={p.key}
                  partKey={p.key}
                  title={p.title}
                  subtitle={`${p.count} × ${p.model} · ${populationLabel(p)}`}
                  kind={p.kind}
                  node={h.parent ? resolveHardware(h.parent)! : h}
                  selected={selected}
                  onSelect={chooseChild}
                />
              ))}
            </TabsContent>
            <TabsContent value="connections">
              <Connections
                model={model}
                hardware={h}
                onSelect={select}
                onView={(fabric) => {
                  setTopologyFabric(fabric);
                  setView('topology');
                }}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <>
          <div className="cluster-title">
            <div className="model-maker">
              {model.custom ? 'CUSTOM CONFIGURATION' : 'PLATFORM OVERVIEW'}
            </div>
            <h2>{model.title}</h2>
            <p>
              {model.hardware.length} devices across {model.racks.length}{' '}
              {model.racks.length === 1 ? 'rack' : 'racks'}
            </p>
            <span className="reference-chip">
              <Check size={12} />{' '}
              {model.custom ? 'Your layout' : 'Source-backed hardware'}
            </span>
          </div>
          <div className="overview-metrics">
            <div>
              <span>GPUs</span>
              <strong>{metrics.gpus}</strong>
            </div>
            <div>
              <span>Compute chassis</span>
              <strong>{metrics.compute}</strong>
            </div>
            <div>
              <span>GPU memory</span>
              <strong>
                {Number((metrics.memoryGB / 1000).toFixed(3))}
                <small> TB</small>
              </strong>
            </div>
            <div>
              <span>Occupied space</span>
              <strong>
                {metrics.usedU}
                <small> U</small>
              </strong>
            </div>
          </div>
          <div className="overview-section">
            <h3>System composition</h3>
            {model.racks.map((r) => (
              <div className="composition-row" key={r.id}>
                <Server size={16} />
                <span>{r.name}</span>
                <strong>{r.units}U</strong>
              </div>
            ))}
          </div>
          <div className="overview-section fabric-summary">
            <h3>Network fabrics</h3>
            {Object.entries(FABRICS).map(([key, f]) => (
              <button
                key={key}
                onClick={() => {
                  setTopologyFabric(key as Fabric);
                  setView('topology');
                }}
              >
                <ColorDot color={f.color} />
                <div>
                  <span>{f.name}</span>
                  <small>
                    {model.links.some((l) => l.fabric === key)
                      ? `${model.links.filter((l) => l.fabric === key).reduce((n, l) => n + l.count, 0)} rack links`
                      : (model.fabricReferences?.[key as Fabric]?.status ??
                        'No planned links')}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="inspect-hint">
            <MousePointer2 size={20} />
            <div>
              <strong>Open any chassis</strong>
              <p>
                Select a device, then Explore components to inspect the boards,
                modules and connectors.
              </p>
            </div>
          </div>
          {model.hardware[0] && (
            <button
              className="primary-button"
              onClick={() => select(model.hardware[0].id)}
            >
              Inspect first device <MoveUpRight size={16} />
            </button>
          )}
          {!model.racks.some((r) => r.mount === 'NVL72') && (
            <button
              className="text-button"
              onClick={() => {
                setDraft(cloneForBuilder(model));
                setBuilderProfile(null);
                setBuilder(true);
              }}
            >
              <Plus size={14} /> Customize this layout
            </button>
          )}
          <p className="model-footnote">{model.description}</p>
        </>
      )}
    </>
  );
  return (
    <main
      className={`explorer ${inventory ? '' : 'inventory-hidden'} ${view === 'power' ? 'power-mode' : ''} ${node && view === 'physical' ? 'component-view' : ''}`}
    >
      <header className="app-header">
        <button
          className="brand"
          onClick={reset}
          aria-label="Physical Compute cluster overview"
        >
          <span className="brand-mark">
            <Server size={22} />
          </span>
          <span>
            physical<span className="brand-light"> compute</span>
          </span>
          <span className="version">/ 02</span>
        </button>
        <div className="header-cluster">
          <span className="tiny-divider" />
          <span>{model.title}</span>
        </div>
        <div className="header-actions">
          <button
            className="quiet-button"
            aria-label="Open hardware catalog"
            title="Hardware catalog"
            onClick={() => setCatalog(true)}
          >
            <Layers3 size={16} />
            <span>Hardware catalog</span>
          </button>
          <button
            className="quiet-button build-header"
            aria-label="Build a custom rack"
            title="Build a rack"
            onClick={openBuilder}
          >
            <Plus size={16} />
            <span>Build a rack</span>
          </button>
          <button
            className="quiet-button"
            aria-label="Read model notes and sources"
            title="Model and sources"
            onClick={() => setDocs(true)}
          >
            <BookOpen size={15} />
            <span>Model & sources</span>
          </button>
        </div>
      </header>
      <aside className="inventory-panel">
        <div className="inventory-heading">
          <span className="eyebrow">EXPLORER</span>
          <button
            className="icon-button"
            title="Hide inventory"
            aria-label="Hide inventory"
            onClick={() => setInventory(false)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <button
          className={`cluster-root ${!selected ? 'active' : ''}`}
          onClick={reset}
        >
          <Box size={17} />
          <span>{model.custom ? 'Custom cluster' : 'Current platform'}</span>
          <span className="counter">{model.racks.length}</span>
        </button>
        <div className="inventory-tree">
          {model.racks.map((r) => (
            <div key={r.id} className="rack-tree">
              <button
                className="rack-tree-button"
                aria-expanded={expanded.includes(r.id)}
                onClick={() =>
                  setExpanded((old) =>
                    old.includes(r.id)
                      ? old.filter((x) => x !== r.id)
                      : [...old, r.id],
                  )
                }
              >
                {expanded.includes(r.id) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <Server size={15} />
                <span>
                  {r.id}
                  <small>{r.name}</small>
                </span>
                <span className="rack-units">{r.units}U</span>
              </button>
              {expanded.includes(r.id) && (
                <div className="rack-children">
                  {model.hardware
                    .filter((item) => item.rack === r.id)
                    .sort((a, b) => b.u - a.u)
                    .map((item) => (
                      <button
                        key={item.id}
                        className={`hardware-row ${selected?.split('/')[0] === item.id ? 'selected' : ''}`}
                        aria-pressed={selected?.split('/')[0] === item.id}
                        onClick={() => {
                          setNode(null);
                          select(item.id);
                        }}
                      >
                        <HardwareIcon kind={item.kind} size={14} />
                        <span>{item.name}</span>
                        <small>{item.height}U</small>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="layers-panel">
          {model.fabricReferences && (
            <div className="reference-sidebar-note">
              <strong>Sourced connection plans</strong>
              <p>
                {model.links.length
                  ? 'Trace rack connections in 3D. Topology also includes the vendor reference plans.'
                  : 'Open a fabric to inspect its documented ports, topology and sources.'}
              </p>
            </div>
          )}

          <div className="section-label">
            <Layers3 size={15} />
            <span>FABRIC LAYERS</span>
          </div>
          {model.fabricReferences && !model.links.length ? (
            Object.entries(FABRICS).map(([key, f]) => (
              <button
                className={`reference-fabric-button ${view === 'topology' && topologyFabric === key ? 'active' : ''}`}
                key={key}
                onClick={() => {
                  setTopologyFabric(key as Fabric);
                  setView('topology');
                }}
              >
                <ColorDot color={f.color} />
                <span>
                  {f.name}
                  <small>
                    {model.fabricReferences?.[key as Fabric].status}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <>
              {' '}
              {Object.entries(FABRICS).map(([key, f]) => (
                <label
                  key={key}
                  htmlFor={`layer-${key}`}
                  className="layer-control"
                >
                  <ColorDot color={f.color} />
                  <span>{f.name}</span>
                  <Switch
                    id={`layer-${key}`}
                    aria-label={`Show ${f.name}`}
                    checked={layers[key as Fabric]}
                    onCheckedChange={(checked) =>
                      setLayers((old) => ({ ...old, [key]: checked }))
                    }
                  />
                </label>
              ))}
            </>
          )}
          <div className="layer-note">
            {model.fabricReferences && !model.links.length
              ? 'Connection plans in Topology'
              : 'Physical view · planned cable paths'}
          </div>
          <label htmlFor="rack-labels" className="label-control">
            <span>Rack labels</span>
            <Switch
              id="rack-labels"
              aria-label="Show rack labels"
              checked={labels}
              onCheckedChange={setLabels}
            />
          </label>
        </div>
        <div className="v2-note">
          <button
            className="power-entry"
            onClick={() => {
              openPower(h?.rack ?? model.racks[0].id);
            }}
          >
            <Zap size={17} />
            <div>
              <strong>Power path</strong>
              <small>From source to silicon</small>
            </div>
            <ArrowUpRight size={15} />
          </button>
          <div>
            <Snowflake size={14} />
            <span>Next: cooling systems</span>
          </div>
        </div>
      </aside>
      <section className="workspace" aria-label="Cluster visualization">
        <div className="workspace-topbar">
          <div className="breadcrumbs">
            {!inventory && (
              <button
                className="icon-button"
                aria-label="Show inventory"
                onClick={() => setInventory(true)}
              >
                <PanelLeft size={17} />
              </button>
            )}
            <button onClick={reset}>Workspace</button>
            <ChevronRight size={13} />
            <span>
              {view === 'power'
                ? 'Power path'
                : node
                  ? resolveHardware(node)?.name
                  : view === 'physical'
                    ? 'Rack view'
                    : 'Fabric topology'}
            </span>
          </div>
          <button
            className={`mobile-inspect icon-button ${view === 'power' ? 'hidden-power-control' : ''}`}
            aria-label="Open inspector"
            onClick={() => setMobileInspector(true)}
          >
            <SlidersHorizontal size={17} />
          </button>
          <span className="reference-badge">
            <span />{' '}
            {model.custom
              ? 'Custom layout'
              : model.fabricReferences
                ? 'Sourced fabrics'
                : 'Reference model'}
          </span>
        </div>
        <div className="stage">
          <div className="stage-top">
            <Tabs
              value={view}
              onValueChange={(v) => {
                if (v === 'power') openPower(h?.rack ?? model.racks[0].id);
                else setView(String(v));
              }}
            >
              <TabsList className="view-tabs">
                <TabsTrigger value="physical">
                  <Box size={16} /> Physical
                </TabsTrigger>
                <TabsTrigger value="topology">
                  <Network size={16} /> Topology
                </TabsTrigger>
                <TabsTrigger value="power">
                  <Zap size={16} /> Power
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="scene-readout">
              {view === 'power'
                ? 'SOURCE → RACK → COMPONENT'
                : node
                  ? 'COMPONENT ARCHITECTURE'
                  : `${model.racks.length} RACKS / ${model.racks[0].units}U`}
              <span>
                {view === 'power'
                  ? 'Energy conversion · redundancy · load'
                  : node
                    ? 'Schematic board and module placement'
                    : '19-inch mounting · metric scale'}
              </span>
            </div>
          </div>
          {view === 'power' ? (
            <PowerView
              key={`${model.id}-${powerRevision}-${selected ?? ''}`}
              model={model}
              initialRackId={powerRackId ?? h?.rack}
              initialHardwareId={selected?.split('/')[0]}
              onRackChange={setPowerRackId}
              onInspect={(id) => {
                select(id);
                setView('physical');
              }}
            />
          ) : view === 'physical' ? (
            <ClusterScene
              model={model}
              service={service}
              exploded={exploded}
              isolated={isolated}
              selected={selected}
              node={node}
              layers={layers}
              labels={labels}
              command={command}
              onSelect={select}
              onHover={setHovered}
              onUnavailable={() => setView('topology')}
            />
          ) : (
            <div className="topology-surface">
              <div className="topology-fabric-tabs">
                {Object.entries(FABRICS).map(([key, f]) => (
                  <button
                    key={key}
                    className={topologyFabric === key ? 'active' : ''}
                    style={{ '--fabric-color': f.color } as CSSProperties}
                    onClick={() => setTopologyFabric(key as Fabric)}
                  >
                    <ColorDot color={f.color} />
                    {f.name}
                  </button>
                ))}
              </div>
              {model.links.length && model.fabricReferences ? (
                <Tabs
                  className="topology-presentation"
                  value={topologyPresentation}
                  onValueChange={(value) =>
                    setTopologyPresentation(value as 'rack' | 'reference')
                  }
                >
                  {!!model.links.length && model.fabricReferences && (
                    <TabsList
                      aria-label="Topology detail"
                      className="topology-presentation-tabs"
                    >
                      <TabsTrigger value="rack">Rack connections</TabsTrigger>
                      <TabsTrigger value="reference">
                        Vendor reference
                      </TabsTrigger>
                    </TabsList>
                  )}
                  {(['rack', 'reference'] as const).map((presentation) => (
                    <TabsContent
                      key={presentation}
                      value={presentation}
                      className="topology-presentation-content"
                    >
                      <Topology
                        model={model}
                        fabric={topologyFabric}
                        selected={selected}
                        onSelect={select}
                        presentation={presentation}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <Topology
                  model={model}
                  fabric={topologyFabric}
                  selected={selected}
                  onSelect={select}
                  presentation={model.fabricReferences ? 'reference' : 'rack'}
                />
              )}
            </div>
          )}
          {node && view === 'physical' && (
            <button
              className="back-to-cluster quiet-button"
              onClick={() => {
                setNode(null);
                setSelected(null);
                setIsolated(false);
                camera('fit');
              }}
            >
              <ArrowLeft size={14} /> Back to racks
            </button>
          )}
          {view === 'physical' && (
            <>
              <div className="scene-title">
                <span className="eyebrow">
                  {node
                    ? 'INSIDE THE HARDWARE'
                    : model.custom
                      ? 'CUSTOM CLUSTER'
                      : 'HARDWARE EXPLORER'}
                </span>
                <h1>
                  {node
                    ? isolated && h?.parent
                      ? h.name
                      : resolveHardware(node)?.model
                    : model.title}
                </h1>
                <p>
                  {node
                    ? isolated && h?.parent
                      ? 'Isolated for inspection · orbit to see every side.'
                      : 'Select a module to inspect it on its own.'
                    : model.links.length
                      ? 'Select a chassis to explore its components. Toggle fabric layers to trace the rack connections.'
                      : model.fabricReferences
                        ? 'Inspect a chassis, or open a fabric to follow its documented connection plan.'
                        : 'Select a chassis. Open it. Follow the hardware.'}
                </p>
              </div>
              <div className="assembly-controls">
                {node && h?.parent && (
                  <>
                    <button
                      className="quiet-button"
                      onClick={() => exploreNode(node)}
                    >
                      <ArrowLeft size={14} /> Full assembly
                    </button>
                    <label htmlFor="component-context">
                      <span>Nearby parts</span>
                      <Switch
                        id="component-context"
                        aria-label="Show nearby components"
                        checked={!isolated}
                        onCheckedChange={(checked) => {
                          setIsolated(!checked);
                          camera('fit');
                        }}
                      />
                    </label>
                  </>
                )}
                {node ? (
                  <label htmlFor="assembly-explode">
                    <span>Exploded assembly</span>
                    <Switch
                      id="assembly-explode"
                      aria-label="Explode component assembly"
                      checked={exploded}
                      onCheckedChange={setExploded}
                    />
                  </label>
                ) : (
                  <label htmlFor="remove-bezels">
                    <span>Remove bezels</span>
                    <Switch
                      id="remove-bezels"
                      aria-label="Remove chassis bezels"
                      checked={service}
                      onCheckedChange={setService}
                    />
                  </label>
                )}
              </div>
              <div className="camera-tools">
                <div className="camera-presets">
                  <button
                    onClick={() => camera('iso')}
                    title="Perspective view"
                  >
                    <Box size={15} /> 3D
                  </button>
                  <button onClick={() => camera('front')}>Front</button>
                  <button onClick={() => camera('rear')}>Rear</button>
                </div>
                <span />
                <button
                  className="icon-button"
                  onClick={() => camera('out')}
                  aria-label="Zoom out"
                >
                  <Minus size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => camera('in')}
                  aria-label="Zoom in"
                >
                  <Plus size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => camera('fit')}
                  aria-label="Fit current view"
                  title="Fit current view (F)"
                >
                  <Maximize size={16} />
                </button>
                <button
                  className="icon-button"
                  onClick={reset}
                  aria-label="Reset view"
                  title="Reset view"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <div className="scene-hint">
                {hover ? (
                  <>
                    <HardwareIcon kind={hover.kind} />
                    <strong>{hover.name}</strong>
                    <span>{hover.model}</span>
                    <span className="kbd">Click to inspect</span>
                  </>
                ) : (
                  <>
                    <MousePointer2 size={14} />
                    <span>Drag to orbit</span>
                    <i /> <span>Scroll to zoom</span>
                    <i />
                    <span>Click to inspect</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <footer className="workspace-status">
          <span>
            <span className="status-square" />{' '}
            {view === 'power'
              ? 'Power architecture · scenario model'
              : node
                ? 'Logical component layout'
                : 'Scaled enclosure geometry'}
          </span>
          <span>
            {model.hardware.length} devices · {metrics.gpus} GPUs
          </span>
          <button onClick={() => setDocs(true)}>
            About this model <Info size={12} />
          </button>
        </footer>
      </section>
      <aside className="inspector-panel" aria-label="Hardware inspector">
        {inspector()}
      </aside>
      <Sheet open={mobileInspector} onOpenChange={setMobileInspector}>
        <SheetContent
          className="mobile-inspector-sheet"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Hardware inspector</SheetTitle>
          <SheetDescription className="sr-only">
            Component specifications and connections.
          </SheetDescription>
          <div className="mobile-inspector-content">{inspector(true)}</div>
        </SheetContent>
      </Sheet>
      <Dialog open={docs} onOpenChange={setDocs}>
        <DialogContent className="model-dialog">
          <DialogHeader>
            <div className="eyebrow">PHYSICAL COMPUTE / MODEL NOTES</div>
            <DialogTitle>Real hardware. A transparent model.</DialogTitle>
            <DialogDescription>{MODEL_NOTE}</DialogDescription>
          </DialogHeader>
          <div className="model-notes">
            <h3>Documented hardware, explained visually</h3>
            <p>
              The library covers major current NVIDIA and AMD platforms, with
              Dell, HPE, Lenovo, Supermicro, and DDN systems. Catalog references
              were checked on {CATALOG_DATE}. Preliminary products are clearly
              marked and have no buildable chassis model.
            </p>
            <h3>Physical and internal fidelity</h3>
            <p>
              Rack-unit heights, published dimensions, connector arrangements
              and component populations follow the linked manuals where
              available. OEM enclosures differ from one another. Internal
              boards, heatsinks, traces and cable paths are schematic;
              unspecified drive populations and proprietary controller details
              are explicitly labeled representative. Small mechanical details
              and cabinet dimensions are illustrative. These are interactive
              explanatory models, not service CAD.
            </p>
            <h3>Fabric references</h3>
            <p>
              Topology views follow the named vendor reference design, with
              evidence on each connection. Solid lines describe documented link
              groups; dashed lines describe relationships or interface
              capabilities. Network role blocks do not add unverified equipment
              or cable routes to the physical inventory. Shared storage and
              front-end paths refer to the same physical network. Custom
              connections remain user-defined.
            </p>
            <p>
              The original eight-node H100 cluster retains its four-rack layout,
              physical cable layers and selectable rack topology. Its rack
              connections are an illustrative layout; the Vendor reference tab
              provides the separately sourced SuperPOD design.
            </p>
            <h3>Custom racks</h3>
            <p>
              The builder checks rack-unit boundaries, overlap, mounting family
              and logical port / slot counts. Planned links are user-defined;
              their nominal speed does not validate protocol, cable, breakout or
              adapter compatibility. Local saves stay in this browser on this
              device. Export JSON to keep a portable copy.
            </p>
            <h3>Power and cooling</h3>
            <p>
              The Power view traces utility and generator sources through
              transfer gear, UPS paths, rack distribution, PSU conversion and
              board regulators. Facility architecture, efficiencies, feed
              mapping, voltage examples and component allocations are
              educational assumptions. Known device power specifications are
              cited separately from planning allowances. Cooling loops, thermal
              simulation and operational telemetry remain future work.
            </p>
            <div className="sources-block">
              {[
                ...new Map(
                  model.hardware
                    .flatMap((h) => referencesFor(h))
                    .map((s) => [s.url, s]),
                ).values(),
              ].map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CatalogPanel
        open={catalog}
        onOpenChange={setCatalog}
        onLoad={loadModel}
        onBuild={(p) => {
          setBuilderProfile(p);
          setBuilder(true);
        }}
      />
      {builder && (
        <RackBuilder
          key={builderProfile?.id ?? 'builder'}
          open={builder}
          onOpenChange={setBuilder}
          draft={draft}
          onDraft={setDraft}
          onApply={loadModel}
          initialProfile={builderProfile}
        />
      )}
    </main>
  );
}
function ComponentGroup({
  kind,
  partKey,
  title,
  subtitle,
  node,
  selected,
  onSelect,
}: {
  partKey: string;
  kind: HardwareKind;
  title: string;
  subtitle: string;
  node: Hardware;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(kind === 'gpu');
  return (
    <div className="component-group">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        <HardwareIcon kind={kind} />
        <div>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && (
        <div className="component-chip-grid">
          {childrenOf(node)
            .filter((c) => c.part === partKey)
            .map((c) => (
              <button
                key={c.id}
                className={selected === c.id ? 'selected' : ''}
                onClick={() => onSelect(c.id)}
              >
                {c.name}
                <ArrowUpRight size={11} />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
function Connections({
  model,
  hardware: h,
  onSelect,
  onView,
}: {
  model: ClusterModel;
  hardware: Hardware;
  onSelect: (id: string) => void;
  onView: (f: Fabric) => void;
}) {
  const resolveHardware = (id: string | null) => lookupHardware(id, model);
  const links = linksFor(h, model);
  if (model.fabricReferences && !model.links.length)
    return (
      <div className="connections-panel">
        <p className="connection-note">
          Connection plans describe the named vendor configuration. Inspect a
          fabric for ports, network roles and source evidence.
        </p>
        {Object.entries(model.fabricReferences).map(([fabric, reference]) => (
          <button
            key={fabric}
            className="connection-row"
            onClick={() => onView(fabric as Fabric)}
          >
            <ColorDot color={FABRICS[fabric as Fabric].color} />
            <div>
              <strong>{FABRICS[fabric as Fabric].name}</strong>
              <small>
                {reference.speed} · {reference.status}
              </small>
            </div>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
    );
  return (
    <div className="connections-panel">
      {model.fabricReferences && (
        <p className="connection-note">
          Connections in this rack layout. Open a fabric, then Vendor reference
          for the documented design and port details.
        </p>
      )}
      {h.parent && (
        <div className="connection-note">
          External connections belong to {resolveHardware(h.parent)?.name}.{' '}
          {h.kind === 'gpu' || h.kind === 'nvlink'
            ? 'See the parent platform for its internal interconnect architecture.'
            : ''}
        </div>
      )}
      {Object.entries(FABRICS).map(([key, f]) => {
        const matching = links.filter((l) => l.fabric === key);
        if (!matching.length) return null;
        return (
          <div key={key} className="connection-group">
            <button
              className="connection-group-title"
              onClick={() => onView(key as Fabric)}
            >
              <ColorDot color={f.color} />
              {f.name}
              <ArrowUpRight size={14} />
            </button>
            {matching.map((l) => {
              const other = l.from === (h.parent ?? h.id) ? l.to : l.from;
              return (
                <button
                  className="connection-row"
                  key={l.id}
                  onClick={() => onSelect(other)}
                >
                  <Cable size={15} />
                  <div>
                    <strong>{resolveHardware(other)?.name}</strong>
                    <small>{l.label}</small>
                  </div>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
        );
      })}
      <p className="model-footnote">
        {!links.length
          ? 'No external links are defined for this platform. Add planned connections in the custom builder. '
          : ''}
        Rates are nominal per link. Bundles display their connection count;
        available throughput depends on the full path and workload.
      </p>
    </div>
  );
}

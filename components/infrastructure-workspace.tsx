'use client';
import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  createElement,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Building2,
  Box,
  Server,
  Network,
  HardDrive,
  Zap,
  Snowflake,
  CircuitBoard,
  ChevronRight,
  ArrowUpRight,
  ArrowLeft,
  Download,
  Upload,
  Search,
  X,
  Layers3,
  Check,
  CircleHelp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Choice } from './catalog-panel';
import {
  assetFacts,
  ancestors,
  exportInfrastructure,
  validateInfrastructure,
  type Infrastructure,
  type Asset,
  type Evidence,
  type Fact,
} from '@/lib/infrastructure';
import {
  infrastructureFromCluster,
  clusterFromInfrastructure,
  importInfrastructure,
  rackHardwareId,
} from '@/lib/infrastructure-adapter';
import { smallCpuExample, lumiExample } from '@/lib/infrastructure-examples';
import { infrastructureTools } from '@/lib/infrastructure-tools';
import type { ModelContext } from '@/lib/webmcp';
import { modelForProfile } from '@/lib/rack-builder';
import type { ClusterModel } from '@/lib/hardware';

type Example = 'current' | 'cpu' | 'nvl72' | 'lumi';
const exampleOptions = [
  { value: 'current', label: 'Current racks' },
  { value: 'cpu', label: 'Small CPU cluster · plan' },
  { value: 'nvl72', label: 'GB300 NVL72 · reference' },
  { value: 'lumi', label: 'LUMI · public record' },
];
const icons = {
  site: Building2,
  building: Building2,
  hall: Building2,
  row: Layers3,
  rack: Server,
  compute: Server,
  network: Network,
  storage: HardDrive,
  power: Zap,
  cooling: Snowflake,
  component: CircuitBoard,
  generic: Box,
};
function AssetIcon({ category, size }: { category?: string; size: number }) {
  const icon =
    category && Object.hasOwn(icons, category)
      ? icons[category as keyof typeof icons]
      : Box;
  return createElement(icon, { size });
}
const purposeLabels = {
  reference: 'Reference model',
  plan: 'Planning model',
  inventory: 'Inventory record',
};
const basisLabels = {
  reported: 'Reported',
  derived: 'Calculated / adapted',
  estimated: 'Assumption',
  unknown: 'Unknown',
};
function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  return (
    <span className={`infra-evidence ${evidence.basis}`}>
      {basisLabels[evidence.basis]}
    </span>
  );
}
function valueOf(f: Fact) {
  return f.value === null
    ? 'Unknown'
    : `${typeof f.value === 'number' ? f.value.toLocaleString('en-US') : String(f.value)}${f.unit ? ` ${f.unit}` : ''}`;
}
function Facts({ facts, doc }: { facts: Fact[]; doc: Infrastructure }) {
  const sources = new Map(doc.sources.map((s) => [s.id, s]));
  return (
    <div className="infra-facts">
      {facts.map((f, i) => (
        <details key={`${f.key}-${i}`} className="infra-fact">
          <summary>
            <span>
              <small>{f.label}</small>
              <strong>{valueOf(f)}</strong>
            </span>
            <EvidenceBadge evidence={f.evidence} />
          </summary>
          <div className="infra-evidence-detail">
            {f.evidence.asOf && <p>As of {f.evidence.asOf}</p>}
            {f.evidence.note && <p>{f.evidence.note}</p>}
            {f.evidence.sources.map((id) => {
              const s = sources.get(id);
              return (
                s && (
                  <a href={s.url} target="_blank" rel="noreferrer" key={id}>
                    {s.title}
                    <ArrowUpRight size={14} />
                  </a>
                )
              );
            })}
            {!f.evidence.sources.length && <p>No external source attached.</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function InfrastructureWorkspace({
  open,
  onOpenChange,
  currentModel,
  onInspect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: ClusterModel;
  onInspect: (model: ClusterModel, hardwareId?: string) => void;
}) {
  const [loadedDoc, setDoc] = useState<Infrastructure | null>(null);
  const [selection, setSelected] = useState<string | null>(null);
  const [example, setExample] = useState<string>('current');
  const doc = useMemo(
    () =>
      example === 'current' || !loadedDoc
        ? infrastructureFromCluster(currentModel)
        : loadedDoc,
    [currentModel, example, loadedDoc],
  );
  const [tab, setTab] = useState('contents');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const importSequence = useRef(0);
  const indexed = useMemo(() => {
    const assets = new Map(doc.assets.map((a) => [a.id, a]));
    const types = new Map(doc.types.map((t) => [`${t.id}@${t.revision}`, t]));
    const interfaces = new Map(doc.interfaces.map((p) => [p.id, p]));
    const children = new Map<string | null, Asset[]>();
    for (const a of doc.assets) {
      const key = a.parentId ?? null;
      const list = children.get(key) ?? [];
      list.push(a);
      children.set(key, list);
    }
    return { assets, types, interfaces, children };
  }, [doc]);
  const selected =
    selection && indexed.assets.has(selection) ? selection : null;
  const stateRef = useRef({ document: doc, selected });
  useLayoutEffect(() => {
    stateRef.current = { document: doc, selected };
  }, [doc, selected]);
  const issues = useMemo(() => validateInfrastructure(doc), [doc]);
  const rendering = useMemo(() => {
    try {
      return { model: clusterFromInfrastructure(doc), reason: '' };
    } catch (e) {
      return {
        model: null,
        reason:
          e instanceof Error
            ? e.message
            : 'Use the infrastructure inspector for this model.',
      };
    }
  }, [doc]);
  const asset = selected ? indexed.assets.get(selected) : undefined;
  const type = asset
    ? indexed.types.get(`${asset.typeId}@${asset.typeRevision}`)
    : undefined;
  const path = asset ? ancestors(doc, asset.id) : [];
  const children = indexed.children.get(selected) ?? [];
  const visible = query.trim()
    ? doc.assets
        .filter((a) =>
          `${a.name} ${indexed.types.get(`${a.typeId}@${a.typeRevision}`)?.name ?? ''}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 100)
    : children;
  const allMatches = query.trim()
    ? doc.assets.filter((a) =>
        `${a.name} ${indexed.types.get(`${a.typeId}@${a.typeRevision}`)?.name ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ).length
    : 0;
  const selectedConnections = doc.connections.filter(
    (c) =>
      !selected ||
      [c.from, c.to].some(
        (id) => indexed.interfaces.get(id)?.assetId === selected,
      ),
  );
  const selectedPorts = selected
    ? doc.interfaces.filter((p) => p.assetId === selected)
    : [];
  const selectedFacts = asset ? assetFacts(doc, asset) : [];
  const inspect = useCallback((id: string | null) => {
    setSelected(id);
    setQuery('');
    setTab('contents');
  }, []);
  const loadExample = useCallback(
    (value: Example) => {
      importSequence.current++;
      const next =
        value === 'cpu'
          ? smallCpuExample()
          : value === 'lumi'
            ? lumiExample()
            : infrastructureFromCluster(
                value === 'nvl72'
                  ? modelForProfile('gb300-nvl72')
                  : currentModel,
              );
      setDoc(next);
      setExample(value);
      inspect(null);
      setNotice('');
      setError('');
    },
    [currentModel, inspect],
  );
  useEffect(() => {
    if (!open) return;
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const tool of infrastructureTools({
      read: () => stateRef.current,
      select: (id) => flushSync(() => inspect(id)),
      load: (id) => flushSync(() => loadExample(id)),
    })) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifecycle.abort();
  }, [open, inspect, loadExample]);
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([exportInfrastructure(doc)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.physical-compute.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        'Portable model exported. Keep this file to reopen or share the record.',
      );
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export this model.');
    }
  };
  const importFile = async (f: File) => {
    const sequence = ++importSequence.current;
    try {
      if (f.size > 10_000_000)
        throw new Error('Choose a JSON file smaller than 10 MB.');
      const next = importInfrastructure(await f.text());
      if (sequence !== importSequence.current) return;
      setDoc(next);
      setExample('imported');
      inspect(null);
      setNotice(
        'File opened. Export keeps its definitions, evidence and connections together.',
      );
      setError('');
    } catch (e) {
      if (sequence === importSequence.current) {
        setError(e instanceof Error ? e.message : 'Could not open this file.');
        setNotice('');
      }
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="infra-workspace" showCloseButton={false}>
        <DialogHeader className="infra-header">
          <div>
            <Building2 size={21} />
            <DialogTitle>Infrastructure</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Explore equipment assemblies, connections and source evidence. Open
            existing rack files or portable infrastructure records.
          </DialogDescription>
          <div className="infra-actions">
            <button
              className="quiet-button"
              aria-label="Import infrastructure model"
              title="Import JSON model"
              onClick={() => file.current?.click()}
            >
              <Upload size={16} />
              <span>Import</span>
            </button>
            <button
              className="quiet-button"
              aria-label="Export infrastructure model"
              title="Export JSON model"
              onClick={exportFile}
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            <DialogClose
              className="icon-button"
              aria-label="Close infrastructure"
            >
              <X size={18} />
            </DialogClose>
          </div>
        </DialogHeader>
        <input
          type="file"
          accept="application/json,.json"
          hidden
          ref={file}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
        <div className="infra-toolbar">
          <Choice
            label="Infrastructure model"
            value={example}
            options={[
              ...exampleOptions,
              ...(example === 'imported'
                ? [{ value: 'imported', label: 'Imported model' }]
                : []),
            ]}
            onChange={(value) => {
              if (value !== 'imported') loadExample(value as Example);
            }}
          />
          <span className={`infra-purpose ${doc.purpose}`}>
            {purposeLabels[doc.purpose]}
          </span>
          <label className="infra-search">
            <Search size={16} />
            <input
              aria-label="Find infrastructure equipment"
              placeholder="Find equipment…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab('contents');
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
        </div>
        {(error || notice) && (
          <p
            className={`infra-notice ${error ? 'error' : ''}`}
            role={error ? 'alert' : 'status'}
          >
            {error || notice}
          </p>
        )}
        <div className="infra-body">
          <section className="infra-main" aria-label="Infrastructure browser">
            <nav className="infra-breadcrumbs" aria-label="Infrastructure path">
              <button
                onClick={() => inspect(null)}
                aria-current={!asset ? 'page' : undefined}
              >
                Overview
              </button>
              {path.map((a) => (
                <span key={a.id}>
                  <ChevronRight size={13} />
                  <button
                    onClick={() => inspect(a.id)}
                    aria-current={a.id === selected ? 'page' : undefined}
                  >
                    {a.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="infra-heading">
              {asset && (
                <button
                  className="icon-button"
                  aria-label="Go to containing assembly"
                  onClick={() => inspect(asset.parentId ?? null)}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="infra-heading-icon">
                <AssetIcon category={type?.category} size={26} />
              </div>
              <div>
                <span className="infra-kicker">
                  {type?.name ?? 'Infrastructure model'}
                </span>
                <h2>{asset?.name ?? doc.title}</h2>
              </div>
            </div>
            <p className="infra-description">
              {asset
                ? asset.representation === 'aggregate'
                  ? `${asset.quantity.toLocaleString('en-US')} units reported as a group. Children describe representative architecture and are not additional deployed units.`
                  : asset.representation === 'representative'
                    ? 'Representative component architecture. This record does not identify an individual installed asset.'
                    : asset.representation === 'slot'
                      ? 'Available component position. Installation and selected hardware need confirmation.'
                      : (asset.evidence.note ??
                        'Open an assembly or inspect its details and connections.')
                : doc.description}
            </p>
            {rendering.model && (
              <button
                className="infra-render-button"
                onClick={() => {
                  onInspect(
                    rendering.model!,
                    asset ? (rackHardwareId(asset) ?? undefined) : undefined,
                  );
                  onOpenChange(false);
                }}
              >
                <Box size={16} />
                {asset && rackHardwareId(asset)
                  ? 'Inspect in 3D'
                  : 'Open rack view'}
                <ArrowUpRight size={15} />
              </button>
            )}
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(String(value))}
              className="infra-tabs"
            >
              <TabsList>
                <TabsTrigger value="contents">
                  Contents <span>{children.length}</span>
                </TabsTrigger>
                <TabsTrigger value="connections">
                  Connections <span>{selectedConnections.length}</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="contents">
                {query && (
                  <p className="infra-count">
                    {allMatches > 100
                      ? `First 100 of ${allMatches}`
                      : allMatches}{' '}
                    matching records across this model
                  </p>
                )}
                <div className="infra-children">
                  {visible.map((a) => {
                    const t = indexed.types.get(
                      `${a.typeId}@${a.typeRevision}`,
                    )!;
                    const count = indexed.children.get(a.id)?.length ?? 0;
                    return (
                      <button
                        key={a.id}
                        className="infra-asset"
                        onClick={() => inspect(a.id)}
                      >
                        <span className={`infra-asset-icon ${t.category}`}>
                          <AssetIcon category={t.category} size={22} />
                        </span>
                        <span className="infra-asset-copy">
                          <strong>{a.name}</strong>
                          <small>{t.name}</small>
                          <span>
                            {a.representation === 'aggregate'
                              ? `${a.quantity.toLocaleString('en-US')} units · aggregate`
                              : a.representation === 'slot'
                                ? 'Unconfirmed slot'
                                : a.representation === 'representative'
                                  ? 'Representative component'
                                  : a.placement?.rack
                                    ? `U${a.placement.rack.u} · ${a.placement.rack.height}U`
                                    : count
                                      ? `${count} contained records`
                                      : 'Equipment record'}
                          </span>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    );
                  })}
                </div>
                {!visible.length && (
                  <div className="infra-empty">
                    <Box size={28} />
                    <strong>
                      {query
                        ? 'No matching equipment'
                        : 'No deeper component records'}
                    </strong>
                    <p>
                      {query
                        ? 'Try a name or equipment type.'
                        : 'The available specifications and source evidence are shown in Details.'}
                    </p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="connections">
                <div className="infra-connections">
                  {selectedConnections.slice(0, 100).map((c) => {
                    const from = indexed.interfaces.get(c.from)!,
                      to = indexed.interfaces.get(c.to)!;
                    return (
                      <article key={c.id} className="infra-connection">
                        <span className={`infra-medium ${c.medium}`}>
                          {c.medium}
                        </span>
                        <strong>{c.name}</strong>
                        <div>
                          <button onClick={() => inspect(from.assetId)}>
                            {indexed.assets.get(from.assetId)?.name}
                          </button>
                          <ChevronRight size={14} />
                          <button onClick={() => inspect(to.assetId)}>
                            {indexed.assets.get(to.assetId)?.name}
                          </button>
                        </div>
                        <p>
                          {c.kind === 'logical'
                            ? 'Logical relationship · physical routing unknown'
                            : `${c.quantity} ${c.kind === 'aggregate' ? 'grouped links · numbered ports unknown' : 'physical connection'}`}
                          {c.capacity
                            ? ` · ${c.capacity.value} ${c.capacity.unit} per link`
                            : ''}
                        </p>
                        <EvidenceBadge evidence={c.evidence} />
                      </article>
                    );
                  })}
                </div>
                {selectedConnections.length > 100 && (
                  <p className="infra-count">
                    First 100 connections shown. Select equipment to narrow the
                    list.
                  </p>
                )}
                {!selectedConnections.length && (
                  <div className="infra-empty">
                    <Network size={28} />
                    <strong>No connections recorded at this level</strong>
                    <p>
                      Connections belong to specific equipment interfaces.
                      Missing records do not imply equipment is disconnected.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
          <aside className="infra-details" aria-label="Infrastructure details">
            <h3>Details</h3>
            {asset ? (
              <>
                <div className="infra-record-status">
                  <EvidenceBadge evidence={asset.evidence} />
                  {asset.evidence.asOf && (
                    <span>As of {asset.evidence.asOf}</span>
                  )}
                </div>
                <dl className="infra-meta">
                  <div>
                    <dt>Record</dt>
                    <dd>{asset.representation}</dd>
                  </div>
                  <div>
                    <dt>Definition</dt>
                    <dd>
                      {type?.name} · revision {type?.revision}
                    </dd>
                  </div>
                  {asset.quantity > 1 && (
                    <div>
                      <dt>Quantity</dt>
                      <dd>{asset.quantity.toLocaleString('en-US')}</dd>
                    </div>
                  )}
                </dl>
                {selectedFacts.length ? (
                  <Facts facts={selectedFacts} doc={doc} />
                ) : (
                  <p className="infra-muted">
                    No specifications are attached to this record yet.
                  </p>
                )}
                {selectedPorts.length > 0 && (
                  <details className="infra-section">
                    <summary>
                      Interfaces <span>{selectedPorts.length}</span>
                    </summary>
                    {selectedPorts.map((p) => (
                      <div className="infra-interface" key={p.id}>
                        <strong>{p.name}</strong>
                        <p>
                          {p.medium} · {p.direction}
                          {p.protocol ? ` · ${p.protocol}` : ''}
                        </p>
                        <small>
                          {p.kind === 'aggregate'
                            ? `${p.count} allocated links · grouped endpoint`
                            : 'Individual port'}
                          {p.capacity
                            ? ` · ${p.capacity.value} ${p.capacity.unit}`
                            : ''}
                        </small>
                      </div>
                    ))}
                  </details>
                )}
                <details className="infra-section">
                  <summary>Source evidence</summary>
                  {asset.evidence.note && <p>{asset.evidence.note}</p>}
                  {asset.evidence.sources.map((id) => {
                    const s = doc.sources.find((s) => s.id === id);
                    return (
                      s && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          key={id}
                        >
                          {s.title}
                          <ArrowUpRight size={14} />
                        </a>
                      )
                    );
                  })}
                  {!asset.evidence.sources.length && (
                    <p>
                      No source verifies this individual placement.
                      Specification sources are attached to the relevant fields.
                    </p>
                  )}
                </details>
              </>
            ) : (
              <>
                <dl className="infra-meta">
                  <div>
                    <dt>Equipment records</dt>
                    <dd>{doc.assets.length.toLocaleString('en-US')}</dd>
                  </div>
                  <div>
                    <dt>Definitions</dt>
                    <dd>{doc.types.length}</dd>
                  </div>
                  <div>
                    <dt>Interfaces</dt>
                    <dd>{doc.interfaces.length}</dd>
                  </div>
                  <div>
                    <dt>Connections</dt>
                    <dd>{doc.connections.length}</dd>
                  </div>
                </dl>
                <p className="infra-muted">
                  Record counts include places, assemblies, components and
                  aggregates. They are not a total of installed devices.
                </p>
                <details className="infra-section">
                  <summary>
                    Model sources <span>{doc.sources.length}</span>
                  </summary>
                  {doc.sources.map((s) => (
                    <div key={s.id}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                        <ArrowUpRight size={14} />
                      </a>
                      <p>
                        Retrieved {s.retrievedAt}
                        {s.license ? ` · ${s.license}` : ''}
                      </p>
                    </div>
                  ))}
                  {!doc.sources.length && (
                    <p>This example contains planning assumptions.</p>
                  )}
                </details>
                <details className="infra-section">
                  <summary>
                    Logical groups <span>{doc.groups.length}</span>
                  </summary>
                  {doc.groups.map((g) => (
                    <div key={g.id}>
                      <strong>{g.name}</strong>
                      <p>
                        {g.assetIds.length} members. Group membership does not
                        set physical placement.
                      </p>
                    </div>
                  ))}
                </details>
              </>
            )}
            <details className="infra-section infra-checks">
              <summary>
                {issues.length ? <CircleHelp size={17} /> : <Check size={17} />}
                Model checks{' '}
                <span>
                  {issues.filter((i) => i.level === 'review').length} to review
                </span>
              </summary>
              <p>
                Checks cover model consistency. Unspecified engineering details
                remain unverified.
              </p>
              {issues.slice(0, 30).map((i, index) => (
                <p key={index} className={i.level}>
                  {i.assetId ? (
                    <button onClick={() => inspect(i.assetId!)}>
                      {i.message}
                    </button>
                  ) : (
                    i.message
                  )}
                </p>
              ))}
              {issues.length > 30 && (
                <p>
                  {issues.length - 30} more review items remain in the model.
                </p>
              )}
            </details>
            {!rendering.model && (
              <p className="infra-muted">
                This model is available as a structure and connection record.
                Detailed 3D geometry is not included.
              </p>
            )}
            <p className="infra-save-note">
              Files stay on your device. Export a copy to keep or share this
              model.
            </p>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

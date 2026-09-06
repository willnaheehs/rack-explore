'use client';
import { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Save,
  ArrowUpRight,
  GripVertical,
  Copy,
  Check,
  Cable,
  Box,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CATALOG, profileFor, type Profile } from '@/lib/catalog';
import { FABRICS, type ClusterModel, type Fabric } from '@/lib/hardware';
import {
  blankModel,
  placementError,
  firstFreeU,
  placeHardware,
  moveHardware,
  removeHardware,
  totals,
  exportModel,
  importModel,
  STORAGE_KEY,
  addConnection,
  portBudget,
} from '@/lib/rack-builder';
import { Choice } from './catalog-panel';
const options = CATALOG.filter(
  (p) => !p.hidden && p.status === 'Documented' && p.mount === '19-inch',
);
const uid = () => `device-${crypto.randomUUID().slice(0, 8)}`;
export default function RackBuilder({
  open,
  onOpenChange,
  draft,
  onDraft,
  onApply,
  initialProfile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: ClusterModel;
  onDraft: (m: ClusterModel) => void;
  onApply: (m: ClusterModel) => void;
  initialProfile?: Profile | null;
}) {
  const [rackId, setRackId] = useState(draft.racks[0]?.id ?? 'R01'),
    [profileId, setProfileId] = useState(initialProfile?.id ?? 'dgx-b300'),
    [startU, setStartU] = useState(1),
    [editing, setEditing] = useState<string | null>(null),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [fabric, setFabric] = useState<Fabric>('compute'),
    [rate, setRate] = useState('400'),
    [count, setCount] = useState(1),
    [tab, setTab] = useState('equipment');
  const file = useRef<HTMLInputElement>(null);
  const rack = draft.racks.find((r) => r.id === rackId) ?? draft.racks[0],
    profile = CATALOG.find((p) => p.id === profileId)!,
    summary = totals(draft);
  const attempt = (fn: () => ClusterModel, success: string) => {
    try {
      const next = fn();
      onDraft(next);
      setError('');
      setMessage(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the rack.');
      setMessage('');
      return false;
    }
  };
  const place = (u = startU, pr = profileId, move = editing) => {
    try {
      const next = move
        ? moveHardware(draft, move, rack.id, u)
        : placeHardware(draft, pr, rack.id, u, uid());
      onDraft(next);
      setError('');
      setMessage(move ? 'Equipment moved.' : 'Equipment added.');
      setEditing(null);
      const free = firstFreeU(
        next,
        CATALOG.find((p) => p.id === pr)!,
        rack.id,
      );
      if (free) setStartU(free);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place equipment.');
      setMessage('');
    }
  };
  const errorAtU = placementError(
    draft,
    profile,
    rack.id,
    startU,
    editing ?? undefined,
  );
  const choose = (id: string) => {
    setProfileId(id);
    setEditing(null);
    setError('');
    const free = firstFreeU(
      draft,
      CATALOG.find((p) => p.id === id)!,
      rack.id,
    );
    setStartU(free ?? 1);
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, exportModel(draft));
      setMessage('Saved on this device.');
      setError('');
    } catch {
      setError('Device storage is unavailable. Export your layout to keep it.');
    }
  };
  const restore = () => {
    attempt(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) throw new Error('No saved layout on this device yet.');
      return importModel(saved);
    }, 'Saved layout restored.');
    setEditing(null);
  };
  const exportFile = () => {
    const url = URL.createObjectURL(
      new Blob([exportModel(draft)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'physical-compute-layout.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Layout exported.');
  };
  const addRack = () => {
    if (draft.racks.length >= 8) {
      setError('This workspace supports up to 8 racks.');
      return;
    }
    const id = `R${String(draft.racks.length + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 4)}`;
    const racks = [
      ...draft.racks,
      {
        id,
        name: `Rack ${draft.racks.length + 1}`,
        role: 'Custom rack',
        x: 0,
        color: '#c3f16b',
        units: 42,
        mount: '19-inch' as const,
        depth: 1.2,
      },
    ].map((r, i, all) => ({ ...r, x: (i - (all.length - 1) / 2) * 0.82 }));
    onDraft({ ...draft, racks });
    setRackId(id);
    setEditing(null);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="builder-dialog">
        <DialogHeader>
          <div className="eyebrow">CUSTOM RACK WORKSPACE</div>
          <DialogTitle>Build your cluster.</DialogTitle>
          <DialogDescription>
            Choose equipment, then select its starting rack unit. Drag a catalog
            item onto the elevation, or use the placement controls.
          </DialogDescription>
        </DialogHeader>
        <div className="builder-toolbar">
          <label className="cluster-name">
            Cluster name
            <input
              aria-label="Custom cluster name"
              maxLength={100}
              value={draft.title}
              onChange={(e) => onDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <div className="builder-file-actions">
            <button className="secondary-button" onClick={restore}>
              Restore saved
            </button>
            <button className="secondary-button" onClick={save}>
              <Save size={14} /> Save locally
            </button>
            <button
              className="icon-button"
              title="Export JSON"
              aria-label="Export custom rack JSON"
              onClick={exportFile}
            >
              <Download size={17} />
            </button>
            <button
              className="icon-button"
              title="Import JSON"
              aria-label="Import custom rack JSON"
              onClick={() => file.current?.click()}
            >
              <Upload size={17} />
            </button>
            <input
              type="file"
              ref={file}
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 250000) {
                    setError('Configuration file is too large.');
                  } else {
                    const text = await f.text();
                    attempt(() => importModel(text), 'Layout imported.');
                    setEditing(null);
                  }
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(String(v))}
          className="builder-tabs"
        >
          <TabsList variant="line">
            <TabsTrigger value="equipment">
              <Box size={15} /> Equipment & placement
            </TabsTrigger>
            <TabsTrigger value="connections">
              <Cable size={15} /> Plan connections
            </TabsTrigger>
          </TabsList>
          <TabsContent value="equipment">
            <div className="builder-grid">
              <section className="builder-library">
                <h3>Equipment library</h3>
                <input
                  className="builder-search"
                  aria-label="Filter builder equipment"
                  placeholder="Search hardware…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="builder-library-scroll">
                  {options
                    .filter((p) =>
                      `${p.maker} ${p.name} ${p.family}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', p.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className={`builder-item ${profileId === p.id && !editing ? 'chosen' : ''}`}
                        onClick={() => choose(p.id)}
                      >
                        <GripVertical size={14} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.maker} · {p.family}
                          </small>
                        </div>
                        <span>{p.units}U</span>
                      </button>
                    ))}
                </div>
              </section>
              <section className="builder-elevation">
                <div className="rack-picker">
                  <Choice
                    label="Rack to edit"
                    value={rack.id}
                    onChange={(v) => {
                      setRackId(v);
                    }}
                    options={draft.racks.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                  />
                  <button
                    className="icon-button"
                    aria-label="Add rack"
                    onClick={addRack}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="rack-size">
                  <span>19-inch cabinet</span>
                  <Choice
                    label="Rack height"
                    value={String(rack.units)}
                    onChange={(v) => {
                      if (
                        draft.hardware.some(
                          (h) =>
                            h.rack === rack.id &&
                            h.u + h.height - 1 > Number(v),
                        )
                      ) {
                        setError('Remove or move equipment above U42 first.');
                        return;
                      }
                      onDraft({
                        ...draft,
                        racks: draft.racks.map((r) =>
                          r.id === rack.id ? { ...r, units: Number(v) } : r,
                        ),
                      });
                    }}
                    options={[
                      { value: '42', label: '42U' },
                      { value: '48', label: '48U' },
                    ]}
                  />
                </div>
                <div className="rack-elevation-scroll">
                  <div className="rack-slot-grid">
                    {Array.from(
                      { length: rack.units },
                      (_, i) => rack.units - i,
                    ).map((u) => {
                      const h = draft.hardware.find(
                        (h) =>
                          h.rack === rack.id && u >= h.u && u < h.u + h.height,
                      );
                      return (
                        <button
                          key={u}
                          className={`rack-slot ${h ? 'occupied' : ''} ${u === startU && !h ? 'target' : ''}`}
                          style={
                            {
                              '--slot-color': h
                                ? profileFor(h).color
                                : '#c3f16b',
                            } as React.CSSProperties
                          }
                          aria-label={
                            h
                              ? `U${u}, ${h.name}, select to move`
                              : `Place ${profile.name} starting at U${u}`
                          }
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain');
                            if (options.some((p) => p.id === id)) {
                              setProfileId(id);
                              place(u, id, null);
                            }
                          }}
                          onClick={() => {
                            if (h) {
                              setEditing(h.id);
                              setProfileId(profileFor(h).id);
                              setStartU(h.u);
                            } else {
                              setStartU(u);
                            }
                          }}
                        >
                          <span className="unit-number">
                            {String(u).padStart(2, '0')}
                          </span>
                          <span className="slot-body">
                            {h && (u === h.u + h.height - 1 || h.height === 1)
                              ? h.name
                              : !h && u === startU
                                ? `${profile.units}U placement starts here`
                                : ''}
                          </span>
                          <span className="mount-hole" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <span className="rack-axis-note">
                  U1 at bottom · select a unit to position
                </span>
                {draft.racks.length > 1 && (
                  <button
                    className="text-button"
                    disabled={draft.hardware.some((h) => h.rack === rack.id)}
                    onClick={() => {
                      const racks = draft.racks
                        .filter((r) => r.id !== rack.id)
                        .map((r, i, all) => ({
                          ...r,
                          x: (i - (all.length - 1) / 2) * 0.82,
                        }));
                      onDraft({ ...draft, racks });
                      setRackId(racks[0].id);
                    }}
                  >
                    Remove empty rack
                  </button>
                )}
              </section>
              <section className="builder-placement">
                <span className="eyebrow">
                  {editing ? 'MOVE EQUIPMENT' : 'PLACE EQUIPMENT'}
                </span>
                <h3>{profile.name}</h3>
                <p>
                  {profile.units}U · {profile.cooling} cooled
                  <br />
                  {profile.maker} · {profile.family}
                </p>
                <label className="field-label">
                  Starting rack unit
                  <input
                    type="number"
                    min={1}
                    max={rack.units - profile.units + 1}
                    value={startU}
                    onChange={(e) => setStartU(Number(e.target.value))}
                  />
                </label>
                <div
                  className={`fit-feedback ${errorAtU ? 'not-fit' : 'fits'}`}
                >
                  {errorAtU ?? `Fits U${startU}–${startU + profile.units - 1}`}
                </div>
                <button
                  className="primary-button"
                  disabled={!!errorAtU}
                  onClick={() => place()}
                >
                  {editing ? 'Move to selected U' : 'Add to rack'}
                  <Plus size={16} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    const u = firstFreeU(
                      {
                        ...draft,
                        hardware: draft.hardware.filter(
                          (h) => h.id !== editing,
                        ),
                      },
                      profile,
                      rack.id,
                    );
                    if (u) setStartU(u);
                    else setError('No contiguous space for this hardware.');
                  }}
                >
                  Find first available space
                </button>
                {editing && (
                  <button
                    className="text-button"
                    onClick={() => setEditing(null)}
                  >
                    Cancel move
                  </button>
                )}
                <div className="placed-list">
                  <h4>In this rack</h4>
                  {draft.hardware
                    .filter((h) => h.rack === rack.id)
                    .sort((a, b) => b.u - a.u)
                    .map((h) => (
                      <div key={h.id}>
                        <button
                          className="placed-select"
                          onClick={() => {
                            setEditing(h.id);
                            setProfileId(profileFor(h).id);
                            setStartU(h.u);
                          }}
                        >
                          <strong>{h.name}</strong>
                          <small>
                            U{h.u}–{h.u + h.height - 1}
                          </small>
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Duplicate ${h.name}`}
                          onClick={() => {
                            const u = firstFreeU(draft, profileFor(h), rack.id);
                            if (u)
                              attempt(
                                () =>
                                  placeHardware(
                                    draft,
                                    profileFor(h).id,
                                    rack.id,
                                    u,
                                    uid(),
                                  ),
                                'Equipment duplicated.',
                              );
                            else
                              setError('No contiguous space for another unit.');
                          }}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${h.name}`}
                          onClick={() => {
                            onDraft(removeHardware(draft, h.id));
                            if (editing === h.id) setEditing(null);
                            setMessage(
                              'Equipment removed; associated planned links removed.',
                            );
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  {!draft.hardware.some((h) => h.rack === rack.id) && (
                    <p>The rack is empty. Place your first device.</p>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>
          <TabsContent value="connections">
            <div className="connection-builder">
              <div>
                <h3>Connect two devices</h3>
                <p>
                  Plan grouped links between installed devices. Logical port /
                  adapter-slot counts are checked. Adapter SKUs, protocol modes,
                  transceivers, and cables still need qualification.
                </p>
                <label className="field-label" htmlFor="connection-from">
                  From
                  <Choice
                    id="connection-from"
                    label="Connection source"
                    value={from}
                    onChange={setFrom}
                    options={draft.hardware.map((h) => ({
                      value: h.id,
                      label: `${h.name} · ${h.rack} U${h.u}`,
                    }))}
                  />
                </label>
                <label className="field-label" htmlFor="connection-to">
                  To
                  <Choice
                    id="connection-to"
                    label="Connection destination"
                    value={to}
                    onChange={setTo}
                    options={draft.hardware
                      .filter((h) => h.id !== from)
                      .map((h) => ({
                        value: h.id,
                        label: `${h.name} · ${h.rack} U${h.u}`,
                      }))}
                  />
                </label>
                <label className="field-label" htmlFor="connection-fabric">
                  Fabric
                  <Choice
                    id="connection-fabric"
                    label="Connection fabric"
                    value={fabric}
                    onChange={(v) => setFabric(v as Fabric)}
                    options={Object.entries(FABRICS).map(([value, f]) => ({
                      value,
                      label: f.name,
                    }))}
                  />
                </label>
                <div className="connection-number-fields">
                  <label className="field-label" htmlFor="connection-rate">
                    Rate
                    <Choice
                      id="connection-rate"
                      label="Nominal link rate"
                      value={rate}
                      onChange={setRate}
                      options={['100', '200', '400', '800'].map((value) => ({
                        value,
                        label: `${value} Gb/s`,
                      }))}
                    />
                  </label>
                  <label className="field-label">
                    Links
                    <input
                      type="number"
                      min={1}
                      max={144}
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    />
                  </label>
                </div>
                <button
                  className="primary-button"
                  disabled={!from || !to}
                  onClick={() =>
                    attempt(
                      () =>
                        addConnection(draft, {
                          from,
                          to,
                          fabric,
                          rate: Number(rate),
                          count,
                          id: `link-${crypto.randomUUID().slice(0, 8)}`,
                        }),
                      'Planned connection added.',
                    )
                  }
                >
                  <Cable size={16} /> Add planned connection
                </button>
              </div>
              <div className="planned-connections">
                <h3>Planned connections</h3>
                {draft.links.map((l) => (
                  <div className="planned-link" key={l.id}>
                    <div>
                      <strong>
                        {draft.hardware.find((h) => h.id === l.from)?.name} →{' '}
                        {draft.hardware.find((h) => h.id === l.to)?.name}
                      </strong>
                      <span>
                        {FABRICS[l.fabric].name} · {l.count} × {l.rate} Gb/s
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Remove planned connection"
                      onClick={() =>
                        onDraft({
                          ...draft,
                          links: draft.links.filter((x) => x.id !== l.id),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!draft.links.length && (
                  <p>
                    No planned links. Equipment placement does not imply network
                    connectivity.
                  </p>
                )}
                <h4>Logical port / slot capacity</h4>
                {draft.hardware.map((h) => (
                  <p key={h.id}>
                    {h.name}:{' '}
                    {draft.links
                      .filter((l) => l.from === h.id || l.to === h.id)
                      .reduce((n, l) => n + l.count, 0)}{' '}
                    / {portBudget(h)}
                  </p>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <output className="builder-feedback" aria-live="polite">
          {error ? (
            <span className="error-text">{error}</span>
          ) : message ? (
            <span>
              <Check size={14} />
              {message}
            </span>
          ) : (
            <span>
              Rack fit checks cover U space and mounting family. Power, cooling,
              rail kits and weight are outside this version.
            </span>
          )}
        </output>
        <footer className="builder-footer">
          <div>
            <strong>
              {draft.racks.length} racks <i /> {draft.hardware.length} devices{' '}
              <i /> {summary.gpus} GPUs
            </strong>
            <span>
              {summary.usedU} /{' '}
              {draft.racks.reduce((sum, r) => sum + r.units, 0)}U occupied ·{' '}
              {Number((summary.memoryGB / 1000).toFixed(3))} TB GPU memory
            </span>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              onDraft(blankModel());
              setRackId('R01');
              setEditing(null);
              setError('');
              setMessage(
                'New empty layout. Your saved layout is still available with Restore saved.',
              );
            }}
          >
            New layout
          </button>
          <button
            className="primary-button"
            disabled={!draft.title.trim()}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Explore this layout <ArrowUpRight size={17} />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

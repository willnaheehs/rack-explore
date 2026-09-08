'use client';
import { useState } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Box,
  Snowflake,
  Wind,
  Plus,
  BookOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { VISIBLE_CATALOG, CATALOG_DATE, type Profile } from '@/lib/catalog';
import { DEFAULT_MODEL, type ClusterModel } from '@/lib/hardware';
import { modelForProfile } from '@/lib/rack-builder';
export function Choice({
  value,
  onChange,
  options,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(String(v));
      }}
      items={options}
    >
      <SelectTrigger id={id} aria-label={label} className="choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function DeviceElevation({ profile: p }: { profile: Profile }) {
  const isRack = p.category === 'rack';
  return (
    <div
      className={`device-elevation ${isRack ? 'rack-elevation' : ''} face-${p.face}`}
      style={{ '--device-accent': p.color } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="elevation-rail" />
      <div className="elevation-body">
        {isRack ? (
          Array.from({ length: 18 }, (_, i) => (
            <div
              className={i > 7 && i < 12 ? 'mini-switch' : 'mini-tray'}
              key={i}
            >
              <i />
              <span />
              <i />
            </div>
          ))
        ) : p.category === 'network' ? (
          Array.from({ length: p.ports?.rows ?? 2 }, (_, i) => (
            <div className="mini-port-row" key={i}>
              {Array.from({ length: p.ports?.cols ?? 16 }, (_, j) => (
                <i key={j} />
              ))}
            </div>
          ))
        ) : (
          <>
            <div className="mini-vent" />
            <div className="mini-drive-row">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <div className="mini-vent" />
            <span className="elevation-brand">{p.maker}</span>
          </>
        )}
      </div>
      <div className="elevation-rail" />
    </div>
  );
}
export default function CatalogPanel({
  open,
  onOpenChange,
  onLoad,
  onBuild,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (m: ClusterModel) => void;
  onBuild: (p: Profile) => void;
}) {
  const [query, setQuery] = useState(''),
    [maker, setMaker] = useState('All manufacturers'),
    [category, setCategory] = useState('All hardware'),
    [detail, setDetail] = useState<string | null>(null);
  const list = VISIBLE_CATALOG.filter(
    (p) =>
      (maker === 'All manufacturers' || p.maker === maker) &&
      (category === 'All hardware' || p.category === category) &&
      `${p.maker} ${p.name} ${p.family}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const load = (m: ClusterModel) => {
    onLoad(m);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="catalog-dialog">
        <DialogHeader>
          <div className="eyebrow">
            PLATFORM LIBRARY · {CATALOG_DATE.toUpperCase()}
          </div>
          <DialogTitle>Explore the hardware.</DialogTitle>
          <DialogDescription>
            Manufacturer references and supplied cluster configurations. Select
            a platform to explore its racks and inspect the components.
          </DialogDescription>
        </DialogHeader>
        <div className="catalog-controls">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search hardware catalog"
              placeholder="Search platforms, GPUs, manufacturers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <Choice
            label="Manufacturer"
            value={maker}
            onChange={setMaker}
            options={[
              'All manufacturers',
              'NVIDIA',
              'AMD',
              'Dell',
              'HPE',
              'Lenovo',
              'Supermicro',
              'DDN',
              'Unspecified OEM',
            ].map((value) => ({ value, label: value }))}
          />
          <Choice
            label="Hardware category"
            value={category}
            onChange={setCategory}
            options={[
              'All hardware',
              'rack',
              'compute',
              'network',
              'storage',
            ].map((value) => ({
              value,
              label:
                value === 'All hardware'
                  ? value
                  : value[0].toUpperCase() + value.slice(1),
            }))}
          />
        </div>
        <div className="catalog-scroll">
          <button
            className="reference-banner"
            onClick={() => load(DEFAULT_MODEL)}
          >
            <Box size={24} />
            <div>
              <strong>DGX H100 reference cluster</strong>
              <span>
                4 racks · 64 GPUs · three connected fabrics · 1 PB shared
                storage
              </span>
            </div>
            <ArrowRight size={20} />
          </button>
          <div className="catalog-grid">
            {list.map((p) => (
              <article key={p.id} className="platform-card">
                <div className="platform-meta">
                  <span>{p.maker.toUpperCase()}</span>
                  <span
                    className={
                      p.status === 'Preliminary' ? 'preliminary' : 'documented'
                    }
                  >
                    {p.status === 'Preliminary'
                      ? 'PRELIMINARY'
                      : p.status === 'Supplied'
                        ? 'SUPPLIED CONFIG'
                        : p.category === 'rack'
                          ? 'INTEGRATED RACK'
                          : `${p.units}U`}
                  </span>
                </div>
                <DeviceElevation profile={p} />
                <h3>{p.name}</h3>
                <p>{p.family}</p>
                <div className="platform-facts">
                  <span>
                    {p.gpuCount
                      ? `${p.gpuCount * (p.clusterNodes ?? 1)} GPUs${p.clusterNodes ? ' total' : ''}`
                      : p.category === 'storage'
                        ? 'NVMe flash'
                        : 'Network fabric'}
                  </span>
                  <span>
                    {p.cooling === 'Direct liquid' ? (
                      <Snowflake size={13} />
                    ) : (
                      <Wind size={13} />
                    )}{' '}
                    {p.cooling}
                  </span>
                </div>
                <div className="platform-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setDetail(detail === p.id ? null : p.id)}
                    aria-expanded={detail === p.id}
                  >
                    <BookOpen size={14} /> Details
                  </button>
                  {p.status !== 'Preliminary' && (
                    <button
                      className="primary-button"
                      onClick={() => load(modelForProfile(p.id))}
                    >
                      Explore <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
                {detail === p.id && (
                  <div className="catalog-detail">
                    <p>{p.description}</p>
                    {p.specs.map((s) => (
                      <div className="catalog-spec" key={s.label}>
                        <span>{s.label}</span>
                        <strong>{s.value}</strong>
                        {s.note && <small>{s.note}</small>}
                      </div>
                    ))}
                    {p.sources.map((s) => (
                      <a
                        href={s.url}
                        key={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.title}
                        <ArrowUpRight size={13} />
                      </a>
                    ))}
                    {p.status !== 'Preliminary' && p.mount === '19-inch' && (
                      <button
                        className="text-button"
                        onClick={() => {
                          onBuild(p);
                          onOpenChange(false);
                        }}
                      >
                        <Plus size={15} />{' '}
                        {p.clusterNodes
                          ? 'Add one node to a custom rack'
                          : 'Add to a custom rack'}
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          {!list.length && (
            <div className="catalog-empty">
              No platforms match your search. Try a manufacturer or GPU family.
            </div>
          )}
          <p className="catalog-coverage">
            A curated, dated catalog of major platform families, not every OEM
            configuration. Documented means a manufacturer reference is
            available; it does not assert stock availability. Supplied
            configurations preserve user-provided specifications and flag
            missing installation details. Preliminary platforms have no
            buildable chassis model. Cabinet and internal board geometry are
            explanatory models.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

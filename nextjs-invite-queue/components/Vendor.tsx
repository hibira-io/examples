'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLang, useT } from './I18n';
import { api, ApiError } from '@/lib/api';
import { API, iconUrl } from '@/lib/demo';
import { VENDOR_STRINGS } from '@/lib/vendor-strings';
import type { ErrorCode } from '@/lib/strings';

// The vendor page (/vendor): a company verifies its domain (work email or a
// DNS TXT record), lists its product or takes over the one already listed,
// puts official codes in by the batch, and sets up an API key and webhook.
// The rules live in lib/invite-queue.js ("Vendors").

type Stats = { open: number; offered: number; taken: number; ok: number; bad: number; waiting: number };
type VendorProduct = { id: string; name: string; icon: string; hosts: string[]; kind: 'invite' | 'referral'; claimed: boolean; stats: Stats };
type Domain = { domain: string; verified: boolean; via: 'email' | 'dns'; record?: { name: string; value: string } };
type Vendor = {
  id: string;
  email: string;
  disabled: boolean;
  domains: Domain[];
  verifiedDomains: string[];
  products: VendorProduct[];
  key: { hint: string; at: number } | null;
  webhook: { url: string } | null;
};
type Listed = { id: string; name: string; names?: Record<string, string>; icon?: string; hosts?: string[]; official?: boolean };

export default function VendorPanel({ token, listed }: { token: string; listed: Listed[] }) {
  const t = useT();
  const lang = useLang();
  const v = VENDOR_STRINGS[lang];
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [companyEmail, setCompanyEmail] = useState(true);
  const [emailDomain, setEmailDomain] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ label: string; value: string } | null>(null);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setError('');
      setNote('');
      setBusy(true);
      try {
        const res = await fn();
        const next = (res as { vendor?: Vendor } | undefined)?.vendor;
        if (next) setVendor(next);
        return res;
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'network';
        setError((v.errors as Record<string, string>)[code] ?? t.errors[code as ErrorCode] ?? t.errors.network);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [t, v],
  );
  const call = useCallback(<T,>(path: string, body: unknown = {}) => run(() => api<T & { vendor?: Vendor }>(path, token, body)), [run, token]);

  useEffect(() => {
    api<{ vendor: Vendor | null; companyEmail: boolean; emailDomain: string }>('/vendor', token).then(
      (r) => {
        setVendor(r.vendor);
        setCompanyEmail(r.companyEmail);
        setEmailDomain(r.emailDomain);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [token]);

  if (!loaded) return null;

  const alert = (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="note">{note}</p>}
      {shown && (
        <div className="secret-box" role="status">
          <p className="small">{shown.label}</p>
          <Copy value={shown.value} label={v.copy} done={v.copied} />
        </div>
      )}
    </>
  );

  if (!vendor) {
    return (
      <section className="card vendor">
        <h2>{v.title}</h2>
        <p>{v.lead}</p>
        <Perks items={v.perks} />
        {!companyEmail && <p className="muted small">{v.freeMail(emailDomain)}</p>}
        {alert}
        <p className="actions">
          <button className="primary" disabled={busy} onClick={() => call('/vendor/start')}>
            {v.start}
          </button>
        </p>
      </section>
    );
  }

  if (vendor.disabled) {
    return (
      <section className="card vendor">
        <h2>{v.title}</h2>
        <p className="error">{v.disabled}</p>
      </section>
    );
  }

  const verified = vendor.verifiedDomains;
  const covered = (h: string) => verified.some((d) => h === d || h.endsWith('.' + d));
  const mine = new Set(vendor.products.map((p) => p.id));
  const claimable = listed.filter((p) => !p.official && !mine.has(p.id) && (p.hosts ?? []).some(covered));

  return (
    <div className="vendor-panel">
      {alert}
      <section className="card vendor">
        <h2>{v.domainsTitle}</h2>
        <p className="muted small">{v.domainsHint}</p>
        <ul className="vendor-domains">
          {vendor.domains.map((d) => (
            <li key={d.domain}>
              <strong>{d.domain}</strong>{' '}
              <span className={'pill' + (d.verified ? ' pill-ok' : '')}>{d.verified ? (d.via === 'email' ? v.viaEmail : v.viaDns) : v.pending}</span>
              {!d.verified && d.record && (
                <div className="dns-record">
                  <p className="small">{v.dnsAdd}</p>
                  <dl>
                    <dt>{v.dnsName}</dt>
                    <dd>
                      <Copy value={d.record.name} label={v.copy} done={v.copied} />
                    </dd>
                    <dt>{v.dnsValue}</dt>
                    <dd>
                      <Copy value={d.record.value} label={v.copy} done={v.copied} />
                    </dd>
                  </dl>
                  <button className="secondary" disabled={busy} onClick={() => call('/vendor/dns', { domain: d.domain })}>
                    {v.check}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <DomainForm label={v.addDomain} field={v.domainLabel} submit={v.getRecord} busy={busy} onSubmit={(domain) => call('/vendor/dns', { domain })} />
      </section>

      <section className="card vendor">
        <h2>{v.productsTitle}</h2>
        {vendor.products.length === 0 && <p className="muted">{v.noProducts}</p>}
        <ul className="vendor-products">
          {vendor.products.map((p) => (
            <li key={p.id} className="vendor-product">
              <div className="vendor-product-head">
                {p.icon ? <img src={iconUrl(p.icon)} alt="" width={32} height={32} /> : <span className="product-icon-fallback">{p.name.slice(0, 1)}</span>}
                <span>
                  <strong>{p.name}</strong> <span className="pill pill-ok">{v.official}</span>
                  <span className="muted small block">
                    {p.hosts.join(', ')} · {p.kind === 'referral' ? v.kindReferral : v.kindInvite}
                    {p.claimed ? ` · ${v.takenOver}` : ''}
                  </span>
                </span>
              </div>
              <ul className="vendor-stats">
                {(Object.keys(v.stats) as (keyof Stats)[]).map((k) => (
                  <li key={k}>
                    <strong>{p.stats[k]}</strong> {v.stats[k]}
                  </li>
                ))}
              </ul>
              <CodesForm
                product={p}
                v={v}
                busy={busy}
                onSubmit={async (codes) => {
                  const res = await call<{ added: number; duplicates: number }>('/vendor/codes', { product: p.id, codes });
                  if (res) setNote(v.codesAdded(res.added, res.duplicates));
                  return Boolean(res);
                }}
              />
              <p className="actions">
                <button className="secondary" disabled={busy || p.stats.open === 0} onClick={() => call('/vendor/codes/withdraw', { product: p.id })}>
                  {v.withdraw}
                </button>
                <button className="secondary danger" disabled={busy} onClick={() => call('/vendor/products/remove', { id: p.id })}>
                  {v.remove}
                </button>
              </p>
            </li>
          ))}
        </ul>

        {claimable.length > 0 && (
          <>
            <h3>{v.claimTitle}</h3>
            <p className="muted small">{v.claimHint}</p>
            <p className="actions">
              {claimable.map((p) => (
                <button className="secondary" key={p.id} disabled={busy} onClick={() => call('/vendor/products', { id: p.id })}>
                  {v.claim}: {p.names?.[lang] || p.name}
                </button>
              ))}
            </p>
          </>
        )}

        {verified.length > 0 && <NewProduct v={v} busy={busy} suggest={verified[0]} onSubmit={(body) => call('/vendor/products', body).then(Boolean)} />}
      </section>

      <section className="card vendor">
        <h2>{v.apiTitle}</h2>
        <p className="muted small">{v.keyHint}</p>
        <p>{vendor.key ? v.keyHas(vendor.key.hint) : v.keyNone}</p>
        <p className="actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              const res = await call<{ key: string }>('/vendor/key');
              if (res) setShown({ label: v.keyShown, value: res.key });
            }}
          >
            {v.keyNew}
          </button>
        </p>
        <pre className="snippet">{`curl -X POST ${API.startsWith('http') ? API : 'https://<this site>' + API}/vendor/codes \\
  -H "Authorization: Bearer vk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"product":"${vendor.products[0]?.id ?? 'your-product'}","codes":["CODE-1","CODE-2"]}'`}</pre>
        <WebhookForm
          v={v}
          busy={busy}
          current={vendor.webhook?.url ?? ''}
          onSave={async (url) => {
            const res = await call<{ secret?: string }>('/vendor/webhook', { url });
            if (res?.secret) setShown({ label: v.webhookSecret, value: res.secret });
          }}
          onTest={async () => {
            const res = await call<{ status: number }>('/vendor/webhook/test');
            if (res) setNote(v.webhookTested(res.status));
          }}
        />
        <p className="muted small">{v.webhookEvents}</p>
      </section>
    </div>
  );
}

/** The vendor pitch, shown on the page before signing in too. */
export function VendorIntro() {
  const lang = useLang();
  const v = VENDOR_STRINGS[lang];
  return (
    <section className="card vendor">
      <h2>{v.title}</h2>
      <p>{v.lead}</p>
      <Perks items={v.perks} />
      <p className="muted small">{v.signIn}</p>
    </section>
  );
}

function Perks({ items }: { items: string[] }) {
  return (
    <ul className="vendor-perks">
      {items.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

function Copy({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy">
      <code>{value}</code>
      <button
        type="button"
        className="icon"
        title={copied ? done : label}
        aria-label={copied ? done : label}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
      >
        {copied ? (
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
    </span>
  );
}

function DomainForm({ label, field, submit, busy, onSubmit }: { label: string; field: string; submit: string; busy: boolean; onSubmit: (d: string) => void }) {
  const [domain, setDomain] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (domain.trim()) onSubmit(domain.trim());
      }}
    >
      <label>
        <span className="small">{label}</span>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" aria-label={field} autoComplete="off" />
      </label>
      <button className="secondary" disabled={busy || !domain.trim()}>
        {submit}
      </button>
    </form>
  );
}

type V = (typeof VENDOR_STRINGS)['en'];

function CodesForm({ product, v, busy, onSubmit }: { product: VendorProduct; v: V; busy: boolean; onSubmit: (codes: string) => Promise<boolean> }) {
  const [codes, setCodes] = useState('');
  return (
    <form
      className="codes-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(codes)) setCodes('');
      }}
    >
      <label>
        <span className="small">
          {v.codesTitle} · {v.codesHint}
        </span>
        <textarea
          rows={4}
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          placeholder={product.hosts[0] ? `https://${product.hosts[0]}/invite/…` : 'CODE-1234'}
        />
      </label>
      <button className="primary" disabled={busy || !codes.trim()}>
        {v.codesPut}
      </button>
    </form>
  );
}

function NewProduct({ v, busy, suggest, onSubmit }: { v: V; busy: boolean; suggest: string; onSubmit: (body: unknown) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [hosts, setHosts] = useState(suggest);
  const [icon, setIcon] = useState('');
  const [kind, setKind] = useState<'invite' | 'referral'>('invite');
  return (
    <form
      className="new-product"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit({ name, hosts: hosts.split(','), icon, kind })) {
          setName('');
          setIcon('');
        }
      }}
    >
      <h3>{v.newTitle}</h3>
      <label>
        <span className="small">{v.nameLabel}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      </label>
      <label>
        <span className="small">{v.hostsLabel}</span>
        <input value={hosts} onChange={(e) => setHosts(e.target.value)} required />
      </label>
      <label>
        <span className="small">{v.iconLabel}</span>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="https://" />
      </label>
      <div className="segmented" role="radiogroup" aria-label={v.kindLabel}>
        <span className="small">{v.kindLabel}</span>
        {(['invite', 'referral'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={'secondary' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
            {k === 'invite' ? v.kindInvite : v.kindReferral}
          </button>
        ))}
      </div>
      <button className="primary" disabled={busy || name.trim().length < 2}>
        {v.add}
      </button>
    </form>
  );
}

function WebhookForm({
  v,
  busy,
  current,
  onSave,
  onTest,
}: {
  v: V;
  busy: boolean;
  current: string;
  onSave: (url: string) => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const [url, setUrl] = useState(current);
  useEffect(() => setUrl(current), [current]);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(url.trim());
      }}
    >
      <label>
        <span className="small">{v.webhookLabel}</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
      </label>
      <button className="primary" disabled={busy || !url.trim() || url.trim() === current}>
        {v.webhookSave}
      </button>
      {current && (
        <>
          <button className="secondary" type="button" disabled={busy} onClick={() => void onTest()}>
            {v.webhookTest}
          </button>
          <button type="button" className="secondary danger" disabled={busy} onClick={() => void onSave('')}>
            {v.webhookOff}
          </button>
        </>
      )}
    </form>
  );
}

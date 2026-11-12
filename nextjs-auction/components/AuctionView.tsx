'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { AuctionHouse, type Listing } from '@hibira-io/auction';
import { ITEM, type ItemRef } from '@/lib/items';
import { endpoint } from '@/lib/demo';
import ItemIcon from './ItemIcon';
import { useT } from './I18n';

type State = 'connecting' | 'connected' | 'unavailable' | 'failed' | 'disconnected' | 'initialized';

interface Me {
  id: string;
  name: string;
  gold: number;
  held: number;
  bag: ItemRef[];
}

interface Props {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

const NAMES = ['Ash', 'Briar', 'Cinder', 'Dusk', 'Ember', 'Fable', 'Gale', 'Hollow', 'Ivy', 'Jinx', 'Kestrel', 'Lark'];

export default function AuctionView({ appKey, host, port, tls }: Props) {
  const t = useT();
  const [connection, setConnection] = useState<State>('connecting');
  const [house, setHouse] = useState<AuctionHouse | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [closed, setClosed] = useState<Listing[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: 'good' | 'bad' }[]>([]);
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [, setNow] = useState(0);
  const identity = useRef<{ player: string; name: string } | null>(null);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;
  const tRef = useRef(t);
  tRef.current = t;
  // Listings this player has bid on, to say when someone outbids them.
  const myBids = useRef(new Set<string>());

  const toast = useCallback((text: string, tone: 'good' | 'bad' = 'good') => {
    const id = Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  const call = useCallback(
    async (path: string, body: Record<string, unknown> = {}) => {
      const res = await fetch(endpoint(`/api/auction/${path}`, `/auction/${path}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...identity.current, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.me) setMe(data.me);
      if (!res.ok) {
        const msg = (tRef.current.errors as Record<string, string>)[data.error] ?? tRef.current.failed(res.status);
        toast(msg, 'bad');
        return null;
      }
      return data.result;
    },
    [toast],
  );

  // A made-up player per browser. A real game uses its own sign-in.
  useEffect(() => {
    let saved: { player: string; name: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem('auction-player') ?? 'null');
    } catch {}
    if (!saved?.player) {
      saved = { player: crypto.randomUUID(), name: `${NAMES[Math.floor(Math.random() * NAMES.length)]}-${Math.floor(10 + Math.random() * 90)}` };
      try {
        localStorage.setItem('auction-player', JSON.stringify(saved));
      } catch {}
    }
    identity.current = saved;
    call('me');
  }, [call]);

  useEffect(() => {
    const pusher = new Pusher(appKey, {
      cluster: 'hkg', // required by pusher-js, unused once wsHost is set
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: tls,
      enabledTransports: ['ws', 'wss'],
    });
    pusher.connection.bind('state_change', ({ current }: { current: State }) => setConnection(current));

    // Follows auction-main and loads the server's snapshot on every
    // (re)subscription, so nothing changed while offline is missed.
    const h = AuctionHouse.open(pusher, 'main', {
      load: () => fetch(endpoint('/api/auction', '/auction/snapshot')).then((r) => (r.ok ? r.json() : null)),
    });
    h.on('change', ({ listings, closed }) => {
      setListings(listings);
      setClosed(closed);
    });
    h.on('update', ({ kind, listing }) => {
      setFlash((f) => ({ ...f, [listing.id]: kind }));
      setTimeout(() => setFlash((f) => (f[listing.id] === kind ? { ...f, [listing.id]: '' } : f)), 1200);
      const mine = meRef.current?.id;
      if (!mine) return;
      const name = tRef.current.items[(listing.item as unknown as ItemRef).type];
      const wasMine = myBids.current.has(listing.id) && listing.bidderId !== mine;
      if ((kind === 'bid' || kind === 'extended' || kind === 'sold') && wasMine) {
        myBids.current.delete(listing.id);
        toast(tRef.current.toastOutbid(name), 'bad');
        call('me'); // the server has already given the held gold back
      }
      if (listing.bidderId === mine && listing.status !== 'open') myBids.current.delete(listing.id);
      if (kind === 'sold' && listing.bidderId === mine) {
        toast(tRef.current.toastWon(name));
        call('me');
      }
      if (kind === 'sold' && listing.sellerId === mine) {
        toast(tRef.current.toastSold(name, listing.price ?? 0));
        call('me');
      }
      if ((kind === 'unsold' || kind === 'cancelled') && listing.sellerId === mine) call('me');
    });
    setHouse(h);
    return () => {
      h.close();
      pusher.disconnect();
    };
  }, [appKey, host, port, tls, toast, call]);

  // Redraw the countdowns; they follow the server's clock (house.timeLeft).
  useEffect(() => {
    const timer = setInterval(() => setNow((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, []);

  const bid = async (l: Listing) => {
    myBids.current.add(l.id);
    const r = await call('bid', { listingId: l.id, amount: l.minBid });
    if (!r) myBids.current.delete(l.id);
  };
  const buyout = (l: Listing) => call('buyout', { listingId: l.id });
  const sell = (uid: string) => call('list', { uid });

  const sales = closed.filter((l) => l.status === 'sold').slice(0, 8);
  const chartType = selected ?? (sales[0]?.item as unknown as ItemRef | undefined)?.type ?? null;
  const prices = useMemo(() => (house && chartType ? house.prices(chartType) : []), [house, chartType, closed]);

  return (
    <main className="auction">
      <header className="head">
        <div>
          <h1>
            {t.title} <span className={`status status-${connection}`}>{t.states[connection]}</span>
          </h1>
          <p className="muted">{t.subtitle}</p>
        </div>
        {me && (
          <div className="wallet card">
            <span className="muted">{t.playingAs(me.name)}</span>
            <strong className="gold">
              <Coin /> {me.gold.toLocaleString()}
            </strong>
            {me.held > 0 && (
              <span className="muted small">
                {t.held}: {me.held.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </header>

      <p className="hint">{t.hint}</p>

      <div className="layout">
        <section>
          <h2>
            {t.forSale} <span className="count">{listings.length}</span>
          </h2>
          {listings.length === 0 ? (
            <p className="muted card">{t.noListings}</p>
          ) : (
            <ul className="listings">
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  me={me?.id ?? ''}
                  left={house?.timeLeft(l) ?? 0}
                  flash={flash[l.id] ?? ''}
                  onBid={() => bid(l)}
                  onBuyout={() => buyout(l)}
                  onSelect={() => setSelected((l.item as unknown as ItemRef).type)}
                  canAfford={(me?.gold ?? 0) >= l.minBid}
                />
              ))}
            </ul>
          )}
        </section>

        <aside>
          <div className="card">
            <h2>{t.bag}</h2>
            {!me || me.bag.length === 0 ? (
              <p className="muted small">{t.bagEmpty}</p>
            ) : (
              <ul className="bag">
                {me.bag.map((it) => {
                  const def = ITEM[it.type];
                  return (
                    <li key={it.uid}>
                      <ItemIcon icon={def.icon} rarity={def.rarity} size={32} />
                      <span>
                        {t.items[it.type]}
                        <span className="muted small block">{t.sellHint(Math.max(1, Math.round(def.value * 0.6)), Math.round(def.value * 1.5))}</span>
                      </span>
                      <button type="button" className="secondary small-btn" onClick={() => sell(it.uid)}>
                        {t.sell}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card">
            <h2>{t.priceHistory}</h2>
            {chartType && prices.length > 0 ? (
              <>
                <p className="small chart-title">
                  {t.items[chartType]} <span className="muted">· {prices.at(-1)!.price} </span>
                </p>
                <PriceChart values={prices.map((p) => p.price)} />
              </>
            ) : (
              <p className="muted small">{t.priceEmpty}</p>
            )}
          </div>

          <div className="card">
            <h2>{t.recentSales}</h2>
            {sales.length === 0 ? (
              <p className="muted small">{t.noSales}</p>
            ) : (
              <ul className="sales">
                {sales.map((l) => {
                  const it = l.item as unknown as ItemRef;
                  return (
                    <li key={l.id} onClick={() => setSelected(it.type)}>
                      <span>{t.items[it.type]}</span>
                      <span className="muted small">{t.soldTo(l.bidderId === me?.id ? t.you : String(l.bidder?.name ?? '?'))}</span>
                      <span className="amount">{l.price}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.tone}`}>
            {x.text}
          </div>
        ))}
      </div>
    </main>
  );
}

function ListingCard(props: {
  listing: Listing;
  me: string;
  left: number;
  flash: string;
  canAfford: boolean;
  onBid: () => void;
  onBuyout: () => void;
  onSelect: () => void;
}) {
  const t = useT();
  const { listing: l, me, left } = props;
  const it = l.item as unknown as ItemRef;
  const def = ITEM[it.type];
  if (!def) return null;
  const mine = l.sellerId === me;
  const leading = l.bidderId === me;
  const urgent = left < 15_000;
  return (
    <li className={`card listing rarity-border-${def.rarity}${leading ? ' leading' : ''}${props.flash ? ` flash-${props.flash}` : ''}`}>
      <button type="button" className="listing-head" onClick={props.onSelect}>
        <ItemIcon icon={def.icon} rarity={def.rarity} />
        <span>
          <strong>{t.items[it.type]}</strong>
          <span className={`small rarity-text-${def.rarity} block`}>{t.rarity[def.rarity]}</span>
        </span>
      </button>
      <div className="price-row">
        <span className="muted small">{l.price == null ? t.startingAt : t.topBid}</span>
        <strong className="gold">
          <Coin /> {(l.price ?? l.startPrice).toLocaleString()}
        </strong>
      </div>
      <div className="meta small muted">
        <span className={leading ? 'winning' : undefined}>{l.price == null ? t.soldBy(String(l.seller?.name ?? '?')) : leading ? t.winning : t.by(String(l.bidder?.name ?? '?'))}</span>
        <span>{t.bids(l.bids)}</span>
      </div>
      <div className={`timer${urgent ? ' urgent' : ''}`}>
        <span>{left > 0 ? `${t.endsIn} ${clock(left)}` : t.ended}</span>
        {props.flash === 'extended' && <span className="badge">{t.extended}</span>}
      </div>
      {mine ? (
        <p className="small muted own">{t.yourListing}</p>
      ) : (
        <div className="buttons">
          <button type="button" className="primary" disabled={leading || left <= 0 || !props.canAfford} onClick={props.onBid}>
            {t.bid} {l.minBid.toLocaleString()}
          </button>
          {l.buyout != null && (
            <button type="button" className="secondary" disabled={left <= 0} onClick={props.onBuyout}>
              {t.buyNow} {l.buyout.toLocaleString()}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function PriceChart({ values }: { values: number[] }) {
  const W = 300;
  const H = 90;
  if (values.length === 1) values = [values[0], values[0]];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = W / (values.length - 1);
  const y = (v: number) => (max === min ? H / 2 : H - ((v - min) / span) * (H - 12) - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart" role="img">
      <polyline points={values.map((v, i) => `${i * step},${y(v)}`).join(' ')} fill="none" strokeWidth={2.5} />
    </svg>
  );
}

function Coin() {
  return (
    <svg className="coin" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" fill="none" />
    </svg>
  );
}

function clock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

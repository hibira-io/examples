'use client';

import { useEffect, useRef, useState } from 'react';
import { createHandoff, deviceName, readPairing, type Handoff, type Peer, type Transport } from '@hibira-io/handoff';
import { connect, RELAY_CHUNK, type Config } from '@/lib/client';
import { fromFile, fromVideo, type Photo } from '@/lib/photo';
import { useT } from './I18n';

type Status = 'bad' | 'connecting' | 'ready' | 'gone' | 'inuse';

// The phone page, opened from the desktop page's QR code: a camera preview
// and a shutter. Each photo flies off the top of the screen and lands in the
// form on the computer.
export default function Phone(config: Config) {
  const t = useT();
  const [status, setStatus] = useState<Status>('connecting');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [transport, setTransport] = useState<Transport>('relay');
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [sent, setSent] = useState(0);
  const [sending, setSending] = useState(0);
  const [flying, setFlying] = useState<{ id: number; url: string }[]>([]);
  const [flash, setFlash] = useState(0);
  const video = useRef<HTMLVideoElement | null>(null);
  const takeInput = useRef<HTMLInputElement | null>(null);
  const pickInput = useRef<HTMLInputElement | null>(null);
  const handoff = useRef<Handoff | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const pairing = readPairing();
    if (!pairing) {
      setStatus('bad');
      return;
    }
    const me = crypto.randomUUID();
    const pusher = connect(config, me, 'phone', deviceName());
    handoff.current = createHandoff({
      pusher,
      ...pairing,
      role: 'phone',
      relayChunk: RELAY_CHUNK,
      onPeer: (p) => {
        setPeer(p);
        if (p) seen.current = true;
        setStatus(p ? 'ready' : seen.current ? 'gone' : 'connecting');
      },
      onTransport: setTransport,
      onRefused: () => setStatus('inuse'),
    });
    return () => {
      handoff.current?.close();
      handoff.current = null;
      pusher.disconnect();
    };
  }, [config]);

  // The rear camera's preview. Browsers allow it only on https pages (and
  // localhost); elsewhere, and when the user says no, the buttons open the
  // camera app instead.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('off');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setCamera('on');
      })
      .catch(() => setCamera('off'));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const send = async (photo: Photo) => {
    const id = Date.now() + Math.random();
    setFlying((f) => [...f, { id, url: photo.url }]);
    setTimeout(() => {
      setFlying((f) => f.filter((x) => x.id !== id));
      URL.revokeObjectURL(photo.url);
    }, 900);
    const h = handoff.current;
    if (!h) return;
    setSending((n) => n + 1);
    try {
      await h.send(photo.blob, { name: `receipt-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, preview: photo.thumb });
      setSent((n) => n + 1);
    } finally {
      setSending((n) => n - 1);
    }
  };

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlash((n) => n + 1);
    send(await fromVideo(v, transport === 'direct' ? 'full' : 'relay'));
  };

  const picked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) await send(await fromFile(file, transport === 'direct' ? 'full' : 'relay'));
  };

  if (status === 'bad' || status === 'inuse') {
    return (
      <main className="page phone">
        <p className="notice">{status === 'bad' ? t.badLink : t.phoneInUse}</p>
      </main>
    );
  }

  const ready = status === 'ready';
  return (
    <main className="phone">
      <div className="status">
        <span className={`dot ${ready ? 'on' : ''}`} />
        <span>{ready && peer ? t.toDevice(peer.device ?? '') : status === 'gone' ? t.deskGone : t.waitingDesk}</span>
        {ready && (
          <span className={`badge ${transport}`} title={transport === 'direct' ? t.directTip : t.relayTip}>
            {transport === 'direct' ? t.direct : t.relay}
          </span>
        )}
      </div>

      <div className="viewfinder">
        <video ref={video} playsInline muted autoPlay className={camera === 'on' ? '' : 'hidden'} />
        {camera === 'off' && <p className="muted camera-off">{t.cameraOff}</p>}
        {flash > 0 && <div key={flash} className="flash" />}
        {flying.map((f) => (
          <img key={f.id} src={f.url} alt="" className="fly-away" />
        ))}
      </div>

      <div className="controls">
        <button
          className="icon round"
          title={t.choose}
          aria-label={t.choose}
          disabled={!ready}
          onClick={() => pickInput.current?.click()}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
        </button>
        <button
          className="shutter"
          title={t.shutter}
          aria-label={t.shutter}
          disabled={!ready}
          onClick={() => (camera === 'on' ? shoot() : takeInput.current?.click())}
        />
        <span className="sent small">{sending > 0 ? t.sending : sent > 0 ? t.sent(sent) : ''}</span>
      </div>

      <input ref={takeInput} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
      <input ref={pickInput} type="file" accept="image/*" multiple hidden onChange={picked} />
    </main>
  );
}

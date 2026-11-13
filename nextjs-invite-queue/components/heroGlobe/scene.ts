// The 3D hero, the same globe as hibira.io's home page
// (hibira-io/pusher-server web/portal/src/components/heroGlobe): a dotted
// globe turned to Asia-Pacific, in white on the red hero, with arcs between
// the cities and codes running along them from the people who give to the
// people in line. The ring art in the stylesheet stays underneath as the
// fallback.
//
// This module pulls in three.js, so it is only ever loaded through a dynamic
// import from ../HeroGlobe.tsx, after the page has painted and only on
// desktops that pass its checks. Decorative only: nothing here is content.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { LAND_BITS, LAND_H, LAND_W } from './landmask';

export interface Globe {
  dispose(): void;
}

export interface GlobeOptions {
  /** Called once, after the first frame is on screen. */
  onReady(): void;
  /**
   * Called when the globe has stopped for good, because the GPU took the
   * context away or the page could not keep a smooth frame rate with it;
   * the caller puts the picture back.
   */
  onLost(): void;
}

// [latitude, longitude] of the nodes: where the page's languages are read.
const CITIES: [number, number][] = [
  [25.0, 121.5], // Taipei
  [35.7, 139.7], // Tokyo
  [37.6, 127.0], // Seoul
  [22.3, 114.2], // Hong Kong
  [1.35, 103.8], // Singapore
  [-33.9, 151.2], // Sydney
  [19.1, 72.9], // Mumbai
  [10.8, 106.7], // Ho Chi Minh City
  [13.75, 100.5], // Bangkok
  [31.2, 121.5], // Shanghai
];
const ARCS: [number, number][] = [
  [0, 1], [0, 4], [0, 5], [0, 7], [1, 5], [6, 4], [6, 2], [4, 5], [2, 1], [3, 9], [8, 1], [3, 0],
];

// The point of the globe that faces the viewer, and how far it sways.
const FACE_LAT = 14;
const FACE_LON = 118;
const SWAY = 0.16; // radians each way
const SEGMENTS = 64; // points per arc
const TRAIL = 10; // points per event
const FPS = 30;
const MAX_DPR = 1.75;
// The page's own frame rate is watched while the globe runs: if the browser
// managed fewer than MIN_PAGE_FPS frames a second over a WINDOW_MS stretch
// (the whole page, scrolling included), the globe gives the machine back
// and the picture returns. The first stretch after (re)starting is skipped:
// it holds shader compiling and the page's own start-up work.
const WINDOW_MS = 3000;
const MIN_PAGE_FPS = 36;

const RAD = Math.PI / 180;

function onSphere(lat: number, lon: number, r = 1): Vector3 {
  const a = lat * RAD;
  const b = lon * RAD;
  return new Vector3(r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b));
}

function isLand(bits: Uint8Array, lat: number, lon: number): boolean {
  const r = Math.min(LAND_H - 1, Math.max(0, Math.floor(90 - lat)));
  const c = ((Math.floor(lon + 180) % LAND_W) + LAND_W) % LAND_W;
  const i = r * LAND_W + c;
  return (bits[i >> 3] & (1 << (i & 7))) !== 0;
}

// Land dots about one degree apart, only on the side of the world the globe
// ever shows (the rest would be drawn and never seen).
function landDots(): Float32Array {
  const bits = Uint8Array.from(atob(LAND_BITS), (ch) => ch.charCodeAt(0));
  const out: number[] = [];
  for (let lat = -70; lat <= 80; lat += 1.1) {
    const step = 1.1 / Math.max(0.2, Math.cos(lat * RAD));
    for (let lon = FACE_LON - 100; lon <= FACE_LON + 100; lon += step) {
      if (!isLand(bits, lat, lon)) continue;
      const v = onSphere(lat, lon);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

// A great-circle arc from a to b, lifted off the surface by its length.
function arcPoints(a: Vector3, b: Vector3): Vector3[] {
  const angle = a.angleTo(b);
  const lift = 0.1 + 0.45 * (angle / Math.PI);
  const pts: Vector3[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const s = Math.sin(angle);
    const p = a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / s)
      .add(b.clone().multiplyScalar(Math.sin(t * angle) / s));
    pts.push(p.multiplyScalar(1 + lift * Math.sin(Math.PI * t)));
  }
  return pts;
}

// Fades the globe toward the headline (left) and the hero's bottom edge. Done here rather than with a CSS mask:
// a masked full-width canvas made the browser re-composite the whole hero on
// every frame, which cost more than drawing the globe.
const EDGE_FADE = /* glsl */ `
  uniform vec2 uRes;
  float edgeFade() {
    vec2 p = gl_FragCoord.xy / uRes;
    float x = p.x < 0.55 ? 0.35 * smoothstep(0.3, 0.55, p.x) : mix(0.35, 1.0, smoothstep(0.55, 0.8, p.x));
    return x * smoothstep(0.0, 0.18, p.y);
  }
`;
// Round soft points that fade out on the far side of the globe.
const POINT_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aPhase;
  uniform float uScale;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    float facing = dot(n, normalize(-mv.xyz));
    vAlpha = aAlpha * smoothstep(0.0, 0.45, facing);
    vPhase = aPhase;
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  ${EDGE_FADE}
  varying float vAlpha;
  varying float vPhase;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.32, 0.5, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(uColor, a * vAlpha * edgeFade());
  }
`;
const ARC_VERTEX = /* glsl */ `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ARC_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  ${EDGE_FADE}
  void main() { gl_FragColor = vec4(uColor, uOpacity * edgeFade()); }
`;
// A city: a solid centre and a ring that keeps widening and fading.
const NODE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  ${EDGE_FADE}
  uniform float uTime;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.14, 0.2, d);
    float r = fract(uTime * 0.35 + vPhase);
    float ring = (1.0 - smoothstep(0.0, 0.06, abs(d - r))) * (1.0 - r) * 0.8;
    float a = max(core, ring);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(uColor, a * vAlpha * edgeFade());
  }
`;

function pointMaterial(fragmentShader: string, color: Color, res: Vector2): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color }, uScale: { value: 1 }, uTime: { value: 0 }, uRes: { value: res } },
    vertexShader: POINT_VERTEX,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

function pointGeometry(positions: Float32Array, size: number, alpha: number, phases?: Float32Array): BufferGeometry {
  const n = positions.length / 3;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('aSize', new BufferAttribute(new Float32Array(n).fill(size), 1));
  g.setAttribute('aAlpha', new BufferAttribute(new Float32Array(n).fill(alpha), 1));
  g.setAttribute('aPhase', new BufferAttribute(phases ?? new Float32Array(n), 1));
  return g;
}

// White on the red hero in both themes (the hero is red in both).
function palette(): { brand: Color; dot: Color; dotAlpha: number; arcAlpha: number } {
  return { brand: new Color('#ffffff'), dot: new Color('#ffffff'), dotAlpha: 0.38, arcAlpha: 0.55 };
}

/**
 * Starts the globe on canvas, sized to its box, and pauses it while host is
 * off screen or the tab is hidden. Returns null when WebGL is not there or
 * would run in software (the fallback picture is the better choice then).
 */
export function startGlobe(canvas: HTMLCanvasElement, host: Element, opts: GlobeOptions): Globe | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 6.2);

  // tilt (x) holds spin (y), so the sway turns around the globe's own axis.
  const tilt = new Group();
  const spin = new Group();
  tilt.rotation.x = FACE_LAT * RAD;
  tilt.add(spin);
  scene.add(tilt);

  // An invisible ball that only writes depth, so arcs and events behind the
  // globe are hidden by it.
  const occluderGeo = new SphereGeometry(0.995, 48, 32);
  const occluderMat = new MeshBasicMaterial({ colorWrite: false });
  spin.add(new Mesh(occluderGeo, occluderMat));

  let colors = palette();
  const res = new Vector2(1, 1);

  const dotsGeo = pointGeometry(landDots(), 2.2, colors.dotAlpha);
  const dotsMat = pointMaterial(DOT_FRAGMENT, colors.dot, res);
  spin.add(new Points(dotsGeo, dotsMat));

  const cityPos = CITIES.map(([lat, lon]) => onSphere(lat, lon, 1.004));
  const nodesGeo = pointGeometry(
    new Float32Array(cityPos.flatMap((v) => [v.x, v.y, v.z])),
    22,
    1,
    new Float32Array(CITIES.map((_, i) => (i * 0.37) % 1)),
  );
  const nodesMat = pointMaterial(NODE_FRAGMENT, colors.brand, res);
  spin.add(new Points(nodesGeo, nodesMat));

  const arcs = ARCS.map(([a, b]) => arcPoints(cityPos[a], cityPos[b]));
  const arcMat = new ShaderMaterial({
    uniforms: { uColor: { value: colors.brand }, uOpacity: { value: colors.arcAlpha }, uRes: { value: res } },
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const arcGeos = arcs.map((pts) => new BufferGeometry().setFromPoints(pts));
  for (const g of arcGeos) spin.add(new Line(g, arcMat));

  // Events: a short bright trail per arc, each on its own timing, with a
  // pause between trips so the arcs never all fire at once.
  const evPos = new Float32Array(arcs.length * TRAIL * 3);
  const evGeo = pointGeometry(evPos, 5, 0);
  const evSize = evGeo.getAttribute('aSize') as BufferAttribute;
  for (let i = 0; i < arcs.length * TRAIL; i++) evSize.setX(i, 5 * (1 - (i % TRAIL) / TRAIL) + 1.5);
  const evMat = pointMaterial(DOT_FRAGMENT, colors.brand, res);
  spin.add(new Points(evGeo, evMat));
  const timing = arcs.map((_, i) => ({ speed: 0.32 + ((i * 0.13) % 0.2), offset: (i * 0.61) % 1.7 }));

  const at = (pts: Vector3[], t: number, out: Vector3) => {
    const f = Math.min(Math.max(t, 0), 1) * SEGMENTS;
    const i = Math.min(Math.floor(f), SEGMENTS - 1);
    return out.copy(pts[i]).lerp(pts[i + 1], f - i);
  };

  const tmp = new Vector3();
  const updateEvents = (time: number) => {
    const alpha = evGeo.getAttribute('aAlpha') as BufferAttribute;
    arcs.forEach((pts, a) => {
      const cycle = (time * timing[a].speed + timing[a].offset) % 1.7; // 1 = arrived, then rest
      for (let k = 0; k < TRAIL; k++) {
        const t = cycle - k * 0.012;
        const idx = a * TRAIL + k;
        at(pts, t, tmp);
        evPos[idx * 3] = tmp.x;
        evPos[idx * 3 + 1] = tmp.y;
        evPos[idx * 3 + 2] = tmp.z;
        alpha.setX(idx, t > 0 && t < 1 ? 1 - k / TRAIL : 0);
      }
    });
    evGeo.getAttribute('position').needsUpdate = true;
    alpha.needsUpdate = true;
  };

  // The globe sits on the hero's right, a little larger than the hero is
  // tall so its edge runs off the top and bottom.
  const resize = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(res);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov / 2) * RAD) * camera.position.z;
    const scale = halfH * 1.12;
    tilt.scale.setScalar(scale);
    tilt.position.set(halfH * camera.aspect * 0.56, -halfH * 0.05, 0);
    // Point sizes are CSS pixels on a globe 300px in radius, scaled with it.
    const radiusPx = scale * (h / (2 * halfH));
    for (const m of [dotsMat, nodesMat, evMat]) m.uniforms.uScale.value = renderer.getPixelRatio() * camera.position.z * (radiusPx / 300);
  };

  const applyTheme = () => {
    colors = palette();
    dotsMat.uniforms.uColor.value = colors.dot;
    (dotsGeo.getAttribute('aAlpha') as BufferAttribute).array.fill(colors.dotAlpha);
    dotsGeo.getAttribute('aAlpha').needsUpdate = true;
    nodesMat.uniforms.uColor.value = colors.brand;
    evMat.uniforms.uColor.value = colors.brand;
    arcMat.uniforms.uColor.value = colors.brand;
    arcMat.uniforms.uOpacity.value = colors.arcAlpha;
    if (!running) draw(last);
  };

  let raf = 0;
  let last = 0;
  let lastDraw = -Infinity;
  let ready = false;
  let inView = true;
  let running = false;
  const start = performance.now();

  function draw(now: number) {
    const time = (now - start) / 1000;
    spin.rotation.y = -FACE_LON * RAD + SWAY * Math.sin(time * 0.09);
    nodesMat.uniforms.uTime.value = time;
    updateEvents(time);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      opts.onReady();
    }
  }

  let windowStart = 0;
  let frames = 0;
  let warm = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!windowStart) windowStart = now;
    frames++;
    if (now - windowStart >= WINDOW_MS) {
      const fps = ((frames - 1) * 1000) / (now - windowStart);
      windowStart = now;
      frames = 1;
      const judged = warm;
      warm = true;
      if (judged && fps < MIN_PAGE_FPS) {
        stop();
        return;
      }
    }
    last = now;
    if (now - lastDraw < 1000 / FPS - 2) return;
    lastDraw = now;
    draw(now);
  };

  const update = () => {
    const want = inView && !document.hidden;
    if (want && !running) {
      running = true;
      windowStart = 0;
      frames = 0;
      warm = false;
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const io = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    update();
  });
  io.observe(host);
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) draw(last || performance.now());
  });
  ro.observe(canvas);
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener('change', applyTheme);
  document.addEventListener('visibilitychange', update);

  let disposed = false;
  const stop = () => {
    dispose();
    opts.onLost();
  };
  const lost = (e: Event) => {
    e.preventDefault();
    stop();
  };
  canvas.addEventListener('webglcontextlost', lost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    running = false;
    io.disconnect();
    ro.disconnect();
    scheme.removeEventListener('change', applyTheme);
    document.removeEventListener('visibilitychange', update);
    canvas.removeEventListener('webglcontextlost', lost);
    for (const g of [occluderGeo, dotsGeo, nodesGeo, evGeo, ...arcGeos]) g.dispose();
    for (const m of [occluderMat, dotsMat, nodesMat, arcMat, evMat]) m.dispose();
    renderer.dispose();
    // Give the context back now: browsers cap live WebGL contexts per page,
    // and a visitor may come back to the homepage many times in one visit.
    renderer.forceContextLoss();
  }

  resize();
  update();
  return { dispose };
}

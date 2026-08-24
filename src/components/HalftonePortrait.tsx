/**
 * HalftonePortrait
 * ----------------
 * A scroll-driven character-halftone ("ASCII dot matrix") portrait.
 *
 * Characters fly in from a coherent noise-driven flow field and settle into a
 * halftone grid whose glyph density tracks the luminance of a source image.
 * Progress is bound to window scroll: 0px = nothing, `scrollDistance`px = complete.
 *
 * Zero dependencies. Canvas 2D, pre-baked glyph atlas, typed-array particles.
 *
 * Usage:
 *   <HalftonePortrait src="/portrait.jpg" scrollDistance={3000} />
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

export interface HalftonePortraitProps {
  /** Image URL. Pixels are read, so it must be same-origin or CORS-enabled. */
  src: string;
  /** Scroll distance in px over which the portrait assembles. Default 3000. */
  scrollDistance?: number;
  /** Drive progress manually (0..1) instead of by scroll. Overrides scrollDistance. */
  progress?: number;

  // ---- Grid / density -----------------------------------------------------
  /** Halftone cell size in CSS px on desktop. Smaller = finer, heavier. Default 5.5. */
  cellSize?: number;
  /** Halftone cell size in CSS px below `mobileBreakpoint`. Default 5. */
  mobileCellSize?: number;
  /** Viewport width under which mobile settings apply. Default 768. */
  mobileBreakpoint?: number;
  /** Hard ceiling on particle count (desktop). Default 10000. */
  maxParticles?: number;
  /** Hard ceiling on particle count (mobile). Default 3000. */
  mobileMaxParticles?: number;

  // ---- Look ---------------------------------------------------------------
  /** Glyph ramp, sparse -> dense. Default '.·,:;/|=+ox0O#%@'. */
  ramp?: string;
  /** Glyph colour. Default '#F5F5F5'. */
  color?: string;
  /** Canvas backdrop. `null` (default) keeps it transparent. */
  background?: string | null;
  /** Overall CSS opacity of the canvas. Default 0.72. */
  opacity?: number;
  /** Luminance below this is dropped entirely (kills the photo's black bg). Default 0.085. */
  blackPoint?: number;
  /** Luminance at/above this maps to the densest glyph. Default 0.8. */
  whitePoint?: number;
  /** Contrast curve applied after black/white point. <1 lifts mids. Default 0.8. */
  gamma?: number;
  /** Glyph size relative to its cell. >1 fills the cell more. Default 1.4. */
  glyphScale?: number;
  /** Monospace stack used for the glyphs. */
  fontFamily?: string;

  // ---- Layout -------------------------------------------------------------
  /** How the portrait fits the viewport. Default 'contain'. */
  fit?: 'contain' | 'cover';
  /** Multiplier on the fitted size. Default 0.92. */
  scale?: number;
  /** Horizontal offset as a fraction of viewport width. Default 0. */
  offsetX?: number;
  /** Vertical offset as a fraction of viewport height. Default 0. */
  offsetY?: number;

  // ---- Motion -------------------------------------------------------------
  /** How far (px) characters start from their target. Default 520. */
  travel?: number;
  /** Lateral arc amplitude (px) — what makes the paths curve into streaks. Default 220. */
  swirl?: number;
  /** Fraction of the timeline used to stagger arrivals (0..0.95). Default 0.55. */
  spread?: number;
  /** Opacity of characters mid-flight relative to settled. Default 0.5. */
  flightOpacity?: number;
  /** Per-character wander (px) while in flight. Default 26. */
  turbulence?: number;
  /** Scroll follow time constant in ms. Higher = more lag/glide. Default 110. */
  smoothing?: number;
  /** Keep a faint shimmer once assembled. Default true. */
  idle?: boolean;
  /** Redraw rate while idling. Default 24. */
  idleFps?: number;
  /** Changes the flow field / arrival waves. Default 1337. */
  seed?: number;
  /** Spatial frequency of the flow field. Higher = more, tighter streams. Default 1. */
  flowScale?: number;
  /** Render the finished portrait statically when the OS asks for reduced motion. Default true. */
  respectReducedMotion?: boolean;
  /** Device-pixel-ratio ceiling. Default 2. */
  maxDpr?: number;

  // ---- Plumbing -----------------------------------------------------------
  /** Expose `window.__halftoneDebug` for tuning/inspection. Default false. */
  debug?: boolean;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  onProgress?: (p: number) => void;
  onReady?: () => void;
}

const DEFAULT_RAMP = '.·,:;/|=+ox0O#%@';
const DEFAULT_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Number of pre-baked opacity steps in the glyph atlas. */
const ALPHA_LEVELS = 12;
const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/* Deterministic value noise                                                   */
/* -------------------------------------------------------------------------- */

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * ux;
  const bot = c + (d - c) * ux;
  return top + (bot - top) * uy;
}

/** 3-octave fbm, returns 0..1. */
function fbm(x: number, y: number, seed: number): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 3; o++) {
    v += noise2(x * f, y * f, seed + o * 101) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return v / 0.875;
}

/* -------------------------------------------------------------------------- */
/* Glyph atlas — every glyph pre-rendered at every opacity step                 */
/* -------------------------------------------------------------------------- */

interface Atlas {
  canvas: HTMLCanvasElement;
  tile: number; // device px
  cell: number; // css px
  glyphs: number;
}

function buildAtlas(
  ramp: string,
  cell: number,
  dpr: number,
  color: string,
  glyphScale: number,
  fontFamily: string,
): Atlas {
  const tile = Math.max(2, Math.ceil(cell * dpr));
  const canvas = document.createElement('canvas');
  canvas.width = tile * ramp.length;
  canvas.height = tile * ALPHA_LEVELS;
  const g = canvas.getContext('2d')!;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${(cell * dpr * glyphScale).toFixed(2)}px ${fontFamily}`;
  g.fillStyle = color;
  for (let l = 0; l < ALPHA_LEVELS; l++) {
    g.globalAlpha = (l + 1) / ALPHA_LEVELS;
    const cy = l * tile + tile / 2;
    for (let i = 0; i < ramp.length; i++) {
      g.fillText(ramp[i], i * tile + tile / 2, cy);
    }
  }
  return { canvas, tile, cell, glyphs: ramp.length };
}

/* -------------------------------------------------------------------------- */
/* Image -> luminance grid (progressive halving keeps the downscale clean)      */
/* -------------------------------------------------------------------------- */

function sampleLuminance(img: HTMLImageElement, cols: number, rows: number): Float32Array {
  let src: CanvasImageSource = img;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  while (w > cols * 2 && h > rows * 2) {
    const nw = Math.max(cols, w >> 1);
    const nh = Math.max(rows, h >> 1);
    const step = document.createElement('canvas');
    step.width = nw;
    step.height = nh;
    const sg = step.getContext('2d')!;
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(src, 0, 0, nw, nh);
    src = step;
    w = nw;
    h = nh;
  }

  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, cols, rows);

  const data = g.getImageData(0, 0, cols, rows).data;
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Particle field                                                              */
/* -------------------------------------------------------------------------- */

interface Field {
  n: number;
  tx: Float32Array; // target centre x, css px
  ty: Float32Array;
  ox: Float32Array; // origin x
  oy: Float32Array;
  px: Float32Array; // perpendicular offset at mid-flight (the arc)
  py: Float32Array;
  delay: Float32Array; // 0..1, scaled by `spread` at draw time
  gi: Uint8Array; // settled glyph index
  rnd: Float32Array; // per-particle phase
  cell: number;
}

interface BuildOpts {
  img: HTMLImageElement;
  vw: number;
  vh: number;
  cell: number;
  maxParticles: number;
  ramp: string;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  fit: 'contain' | 'cover';
  scale: number;
  offsetX: number;
  offsetY: number;
  travel: number;
  swirl: number;
  seed: number;
  flowScale: number;
}

function buildField(o: BuildOpts): Field {
  const ar = (o.img.naturalWidth || o.img.width) / (o.img.naturalHeight || o.img.height);
  let cell = o.cell;

  // Grow the cell until the culled particle count fits the budget.
  for (let attempt = 0; attempt < 8; attempt++) {
    let boxW: number;
    let boxH: number;
    if (o.fit === 'cover') {
      boxW = o.vw * o.scale;
      boxH = boxW / ar;
      if (boxH < o.vh * o.scale) {
        boxH = o.vh * o.scale;
        boxW = boxH * ar;
      }
    } else {
      boxH = o.vh * o.scale;
      boxW = boxH * ar;
      if (boxW > o.vw * o.scale) {
        boxW = o.vw * o.scale;
        boxH = boxW / ar;
      }
    }

    const cols = Math.max(1, Math.floor(boxW / cell));
    const rows = Math.max(1, Math.floor(boxH / cell));

    // Bail early on absurd grids before touching getImageData.
    if (cols * rows > o.maxParticles * 6) {
      cell *= 1.18;
      continue;
    }

    const lum = sampleLuminance(o.img, cols, rows);
    const span = Math.max(0.001, o.whitePoint - o.blackPoint);
    const last = o.ramp.length - 1;

    // Pass 1: which cells survive the black point?
    const keep: number[] = [];
    const gidx: number[] = [];
    for (let i = 0; i < lum.length; i++) {
      let v = (lum[i] - o.blackPoint) / span;
      if (v <= 0) continue;
      if (v > 1) v = 1;
      v = Math.pow(v, o.gamma);
      const g = Math.min(last, Math.floor(v * o.ramp.length));
      if (v < 0.02) continue;
      keep.push(i);
      gidx.push(g);
    }

    if (keep.length > o.maxParticles && attempt < 7) {
      cell *= Math.max(1.08, Math.sqrt(keep.length / o.maxParticles) * 0.96);
      continue;
    }

    // Shuffle so that drawing only a prefix still yields a spatially even subset
    // (this is what adaptive quality degradation leans on).
    const order = new Int32Array(keep.length);
    for (let i = 0; i < order.length; i++) order[i] = i;
    let rs = (o.seed | 0) || 1;
    for (let i = order.length - 1; i > 0; i--) {
      rs = (Math.imul(rs, 1664525) + 1013904223) | 0;
      const j = (rs >>> 8) % (i + 1);
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }

    const n = keep.length;
    const f: Field = {
      n,
      tx: new Float32Array(n),
      ty: new Float32Array(n),
      ox: new Float32Array(n),
      oy: new Float32Array(n),
      px: new Float32Array(n),
      py: new Float32Array(n),
      delay: new Float32Array(n),
      gi: new Uint8Array(n),
      rnd: new Float32Array(n),
      cell,
    };

    const left = (o.vw - boxW) / 2 + o.offsetX * o.vw;
    const top = (o.vh - boxH) / 2 + o.offsetY * o.vh;
    const stepX = boxW / cols;
    const stepY = boxH / rows;

    for (let k = 0; k < n; k++) {
      const srcIdx = order[k];
      const cellIdx = keep[srcIdx];
      const cx = cellIdx % cols;
      const cy = (cellIdx / cols) | 0;

      const tx = left + (cx + 0.5) * stepX;
      const ty = top + (cy + 0.5) * stepY;
      f.tx[k] = tx;
      f.ty[k] = ty;
      f.gi[k] = gidx[srcIdx];

      const r1 = hash2(cx, cy, o.seed + 11);
      const r2 = hash2(cx, cy, o.seed + 29);
      const r3 = hash2(cx, cy, o.seed + 47);
      f.rnd[k] = r3;

      // Coherent inbound direction: neighbours share a heading, so they arrive
      // as streams rather than as independent dots.
      const ff = 0.0042 * o.flowScale;
      const ang = fbm(tx * ff, ty * ff, o.seed) * TAU * 2.2 + r1 * 0.7;
      const dist = o.travel * (0.45 + 0.95 * r2);
      const ox = tx + Math.cos(ang) * dist;
      const oy = ty + Math.sin(ang) * dist;
      f.ox[k] = ox;
      f.oy[k] = oy;

      // Arc, signed by a second smooth field -> parallel fibre-like paths.
      const dx = tx - ox;
      const dy = ty - oy;
      const len = Math.hypot(dx, dy) || 1;
      const bf = 0.0038 * o.flowScale;
      const bend = fbm(tx * bf + 31.7, ty * bf + 11.3, o.seed + 7) * 2 - 1;
      const amp = o.swirl * bend;
      f.px[k] = (-dy / len) * amp;
      f.py[k] = (dx / len) * amp;

      // Arrival wave: dominated by the noise field so clusters land all over the
      // frame at once, with a light top-down bias for direction. Stored raw here
      // and normalised below.
      const wf = 0.0034 * o.flowScale;
      const wave =
        0.85 * fbm(tx * wf + 100, ty * wf + 50, o.seed + 3) +
        0.15 * ((ty - top) / Math.max(1, boxH)) +
        (r1 - 0.5) * 0.06;
      f.delay[k] = wave;
    }

    // Rank-normalise the wave into [0,1]. Simply rescaling min..max leaves a
    // bell-shaped arrival rate — sparse at both ends, frantic in the middle.
    // Ranking makes characters land at a constant rate across the whole scroll
    // while preserving the field's spatial ordering, so neighbours still travel
    // together.
    const byWave = new Int32Array(n);
    for (let k = 0; k < n; k++) byWave[k] = k;
    const waves = f.delay;
    const sorted = Array.prototype.slice.call(byWave) as number[];
    sorted.sort((a, b) => waves[a] - waves[b]);
    const denom = n > 1 ? n - 1 : 1;
    for (let r = 0; r < n; r++) f.delay[sorted[r]] = r / denom;

    return f;
  }

  // Unreachable in practice; keeps TypeScript happy.
  throw new Error('HalftonePortrait: could not fit particle budget');
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function HalftonePortrait(props: HalftonePortraitProps) {
  const {
    src,
    scrollDistance = 3000,
    progress,
    cellSize = 5.5,
    mobileCellSize = 5,
    mobileBreakpoint = 768,
    maxParticles = 10000,
    mobileMaxParticles = 3000,
    ramp = DEFAULT_RAMP,
    color = '#F5F5F5',
    background = null,
    opacity = 0.72,
    blackPoint = 0.085,
    whitePoint = 0.8,
    gamma = 0.8,
    glyphScale = 1.4,
    fontFamily = DEFAULT_FONT,
    fit = 'contain',
    scale = 0.92,
    offsetX = 0,
    offsetY = 0,
    travel = 520,
    swirl = 220,
    spread = 0.55,
    flightOpacity = 0.5,
    turbulence = 26,
    smoothing = 110,
    idle = true,
    idleFps = 24,
    seed = 1337,
    flowScale = 1,
    respectReducedMotion = true,
    maxDpr = 2,
    debug = false,
    zIndex = 0,
    className,
    style,
    onProgress,
    onReady,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation-only settings, read fresh each frame without rebuilding the field.
  const live = useRef({
    scrollDistance,
    progress,
    flightOpacity,
    turbulence,
    smoothing,
    idle,
    idleFps,
    spread,
    onProgress,
    onReady,
  });
  live.current = {
    scrollDistance,
    progress,
    flightOpacity,
    turbulence,
    smoothing,
    idle,
    idleFps,
    spread,
    onProgress,
    onReady,
  };

  // Anything that changes the geometry or the atlas forces a rebuild.
  const buildKey = [
    cellSize, mobileCellSize, mobileBreakpoint, maxParticles, mobileMaxParticles,
    ramp, color, background, blackPoint, whitePoint, gamma, glyphScale, fontFamily,
    fit, scale, offsetX, offsetY, travel, swirl, seed, flowScale, maxDpr, debug,
  ].join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: background === null });
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let field: Field | null = null;
    let atlas: Atlas | null = null;
    let image: HTMLImageElement | null = null;

    let vw = 0;
    let vh = 0;
    let dpr = 1;

    let p = 0; // smoothed progress
    let lastT = 0;
    let idleAcc = 0;
    let lastReported = -1;
    let dirty = true;

    // Adaptive quality: if frames run long, thin the (pre-shuffled) particle set.
    let frameEma = 16;
    let slowRun = 0;
    let quality = 1;
    let reductions = 0;

    const reduceMotion =
      respectReducedMotion &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isMobile = () => window.innerWidth < mobileBreakpoint;

    const layout = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = vw + 'px';
      canvas.style.height = vh + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };

    const rebuild = () => {
      if (!image || disposed) return;
      layout();
      const mob = isMobile();
      field = buildField({
        img: image,
        vw,
        vh,
        cell: mob ? mobileCellSize : cellSize,
        maxParticles: mob ? mobileMaxParticles : maxParticles,
        ramp,
        blackPoint,
        whitePoint,
        gamma,
        fit,
        scale,
        offsetX,
        offsetY,
        travel,
        swirl,
        seed,
        flowScale,
      });
      atlas = buildAtlas(ramp, field.cell, dpr, color, glyphScale, fontFamily);
      quality = 1;
      reductions = 0;
      dirty = true;
      if (debug) {
        // Opt-in inspection hook. `renderAt` draws one frame synchronously at an
        // arbitrary progress, which is how the animation gets verified without
        // having to scrub the real page.
        (window as unknown as Record<string, unknown>).__halftoneDebug = {
          particles: field.n,
          cell: field.cell,
          viewport: [vw, vh, dpr],
          get progress() {
            return p;
          },
          renderAt(v: number, timeMs = 0) {
            p = v;
            render(timeMs);
          },
        };
      }
    };

    const readTarget = (): number => {
      const l = live.current;
      if (typeof l.progress === 'number') return Math.min(1, Math.max(0, l.progress));
      const d = Math.max(1, l.scrollDistance);
      return Math.min(1, Math.max(0, window.scrollY / d));
    };

    const render = (now: number) => {
      const f = field;
      const at = atlas;
      if (!f || !at) return;
      const l = live.current;

      ctx.clearRect(0, 0, vw, vh);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, vw, vh);
      }

      const sp = Math.min(0.95, Math.max(0, l.spread));
      const inv = 1 - sp;
      const cell = at.cell;
      const tile = at.tile;
      const half = cell / 2;
      const fo = l.flightOpacity;
      const turb = reduceMotion ? 0 : l.turbulence;
      const shimmer = l.idle && !reduceMotion;
      const count = quality >= 1 ? f.n : Math.floor(f.n * quality);
      const atlasCanvas = at.canvas;

      for (let i = 0; i < count; i++) {
        let e = (p - f.delay[i] * sp) / inv;
        if (e <= 0) continue;
        if (e > 1) e = 1;

        // Smoothstep, not easeOut*: an ease-out front-loads the distance and the
        // characters snap onto their targets almost immediately, which kills the
        // sense of flight. Smoothstep keeps them genuinely in transit mid-flight.
        const k = e * e * (3 - 2 * e);

        let a = e < 0.15 ? e / 0.15 : 1;
        a *= fo + (1 - fo) * k;

        const ox = f.ox[i];
        const oy = f.oy[i];
        const sway = Math.sin(k * Math.PI);
        let x = ox + (f.tx[i] - ox) * k + f.px[i] * sway;
        let y = oy + (f.ty[i] - oy) * k + f.py[i] * sway;

        let g = f.gi[i];

        if (k < 1) {
          if (turb > 0) {
            const ph = f.rnd[i] * TAU;
            const w = (1 - k) * turb;
            x += Math.sin(now * 0.00042 + ph) * w;
            y += Math.cos(now * 0.00037 + ph * 1.7) * w;
          }
          // Glyphs condense from sparse marks into their final character.
          g = Math.round(g * (0.25 + 0.75 * k));
        } else if (shimmer) {
          const s = Math.sin(now * 0.0013 + f.rnd[i] * 19.7);
          a *= 0.86 + 0.14 * s;
          if (s > 0.997) g = g > 3 ? g - 3 : 0;
        }

        let al = (a * ALPHA_LEVELS) | 0;
        if (al <= 0) continue;
        if (al >= ALPHA_LEVELS) al = ALPHA_LEVELS - 1;

        // Snap to the device pixel grid so small glyphs stay crisp.
        const dx = Math.round((x - half) * dpr) / dpr;
        const dy = Math.round((y - half) * dpr) / dpr;

        ctx.drawImage(atlasCanvas, g * tile, al * tile, tile, tile, dx, dy, cell, cell);
      }
    };

    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);

      const l = live.current;
      const dt = lastT ? Math.min(64, now - lastT) : 16;
      lastT = now;

      const target = readTarget();

      if (reduceMotion) {
        p = target;
      } else {
        const tau = Math.max(1, l.smoothing);
        p += (target - p) * (1 - Math.exp(-dt / tau));
        if (Math.abs(target - p) < 0.0004) p = target;
      }

      if (l.onProgress && Math.abs(p - lastReported) > 0.004) {
        lastReported = p;
        l.onProgress(p);
      }

      const settled = Math.abs(target - p) < 0.0005;
      const complete = settled && p >= 0.9995;
      const empty = settled && p <= 0.0005;

      if (!dirty) {
        if (empty) return; // nothing on screen, nothing to do
        if (complete && (!l.idle || reduceMotion)) return; // frozen final frame
        if (complete) {
          // Idle shimmer runs at a reduced rate to stay cheap.
          idleAcc += dt;
          const step = 1000 / Math.max(1, l.idleFps);
          if (idleAcc < step) return;
          idleAcc = 0;
        }
      }
      dirty = false;

      const t0 = performance.now();
      render(now);

      // Adaptive quality (only while actually animating).
      if (!complete && !empty) {
        frameEma = frameEma * 0.9 + (performance.now() - t0) * 0.1;
        if (frameEma > 11 && reductions < 3) {
          if (++slowRun > 45) {
            quality = Math.max(0.45, quality * 0.78);
            reductions++;
            slowRun = 0;
            frameEma = 8;
          }
        } else {
          slowRun = 0;
        }
      }
    };

    // ---- resize (ignore mobile URL-bar height jitter) ----------------------
    let resizeTimer = 0;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastW && Math.abs(h - lastH) < 130) return;
      lastW = w;
      lastH = h;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) rebuild();
      }, 160);
    };

    const onScroll = () => {
      dirty = true;
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !disposed) {
        lastT = 0;
        dirty = true;
        raf = requestAnimationFrame(frame);
      }
    };

    // ---- load ---------------------------------------------------------------
    const img = new Image();
    img.decoding = 'async';
    try {
      const u = new URL(src, window.location.href);
      if (u.origin !== window.location.origin) img.crossOrigin = 'anonymous';
    } catch {
      /* relative path, same-origin */
    }
    img.onload = () => {
      if (disposed) return;
      image = img;
      try {
        rebuild();
      } catch {
        return;
      }
      canvas.dataset.ready = '1';
      canvas.style.opacity = String(opacity);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(frame);
      live.current.onReady?.();
    };
    img.src = src;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      img.onload = null;
      field = null;
      atlas = null;
      image = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, buildKey, respectReducedMotion]);

  // Opacity is cheap to change without a rebuild.
  useEffect(() => {
    const c = canvasRef.current;
    if (c && c.dataset.ready === '1') c.style.opacity = String(opacity);
  }, [opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 700ms ease',
        zIndex,
        ...style,
      }}
    />
  );
}

export default HalftonePortrait;

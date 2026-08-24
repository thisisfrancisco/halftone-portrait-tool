# Halftone Portrait

A scroll-driven character-halftone portrait. Characters fly in along a coherent
flow field and settle into a dot-matrix grid whose glyph density tracks the
luminance of a source photograph.

Built for [thisisfrancisco.com](https://thisisfrancisco.com) — a fixed, full-bleed
background that assembles across the first 3000px of scroll while the headline
and project grid scroll over it.

* **Zero dependencies.** No three.js, no GSAP, no ScrollTrigger. One `.tsx` file.
* **Canvas 2D**, with a pre-baked glyph atlas — the render loop makes zero state
  changes and issues one `drawImage` per character.
* **~1.4 ms/frame** for 5,100 characters at 1280×800 @2x; ~3.8 ms for 9,300 at
  2560×1440 @2x (5K canvas).
* Adaptive particle budget, DPR cap, visibility pausing, and
  `prefers-reduced-motion` support.

---

## Quick start

```tsx
import HalftonePortrait from './components/HalftonePortrait';

<HalftonePortrait src="/portrait.jpg" scrollDistance={3000} />
```

That's the whole integration. The component renders a single `position: fixed`
canvas covering the viewport, with `pointer-events: none` and `aria-hidden`.

### ⚠️ One required change to your page

The canvas is `position: fixed` with `z-index: 0`. A fixed element paints **above**
ordinary (non-positioned) content, so your page content needs its own stacking
context to sit on top of it:

```tsx
<HalftonePortrait src="/portrait.jpg" />

{/* Tailwind — this is the bit that matters: relative z-10 */}
<main className="relative z-10">
  <h1>Creating Experiences That Matter</h1>
  <section>{/* image grid */}</section>
</main>
```

Without `relative z-10` (or `position: relative; z-index: 1`) on the content
wrapper, the portrait will render over your headline instead of behind it.

### Image requirements

The component reads pixel data from the image, so it must be **same-origin or
CORS-enabled**. Put the file in `/public` and reference it as `/portrait.jpg` —
that is same-origin and always works. A cross-origin URL without
`Access-Control-Allow-Origin` will fail silently (the canvas simply stays empty).

The photo should be **high contrast against a dark background**. Anything below
`blackPoint` luminance is discarded entirely, which is what carves the subject
out of the background — no manual masking needed.

---

## Props

Everything is optional except `src`.

### Timing

| Prop | Default | Notes |
|---|---|---|
| `src` | — | Image URL. Same-origin or CORS-enabled. |
| `scrollDistance` | `3000` | Pixels of scroll from 0 to fully assembled. |
| `progress` | — | Drive progress manually (`0..1`). Overrides scroll. |
| `smoothing` | `110` | Scroll follow time constant (ms). Higher = more glide. |

### Grid and density

| Prop | Default | Notes |
|---|---|---|
| `cellSize` | `5.5` | Halftone cell in CSS px (desktop). Smaller = finer. |
| `mobileCellSize` | `5` | Cell size below `mobileBreakpoint`. |
| `mobileBreakpoint` | `768` | Viewport width for the mobile branch. |
| `maxParticles` | `10000` | Desktop ceiling. Cell size grows automatically to respect it. |
| `mobileMaxParticles` | `3000` | Mobile ceiling. |

### Look

| Prop | Default | Notes |
|---|---|---|
| `ramp` | `.·,:;/\|=+ox0O#%@` | Glyph ramp, sparse → dense. |
| `color` | `#F5F5F5` | Glyph colour. |
| `background` | `null` | `null` keeps the canvas transparent. |
| `opacity` | `0.72` | CSS opacity of the whole canvas. |
| `blackPoint` | `0.085` | Luminance below this is dropped — this is what removes the photo's background. |
| `whitePoint` | `0.8` | Luminance at/above this maps to the densest glyph. |
| `gamma` | `0.8` | `<1` lifts midtones, `>1` deepens them. |
| `glyphScale` | `1.4` | Glyph size relative to its cell. |
| `fontFamily` | system mono stack | Any monospace stack. |

### Layout

| Prop | Default | Notes |
|---|---|---|
| `fit` | `'contain'` | `'contain'` or `'cover'`. |
| `scale` | `0.92` | Multiplier on the fitted size. |
| `offsetX` / `offsetY` | `0` | Offset as a fraction of viewport width/height. |

### Motion

| Prop | Default | Notes |
|---|---|---|
| `travel` | `520` | How far (px) characters start from their target. |
| `swirl` | `220` | Lateral arc amplitude — this is what makes paths curve into streaks. |
| `spread` | `0.55` | Fraction of the timeline used to stagger arrivals. |
| `flightOpacity` | `0.5` | Opacity in flight, relative to settled. |
| `turbulence` | `26` | Per-character wander (px) while in flight. |
| `flowScale` | `1` | Spatial frequency of the flow field. Higher = more, tighter streams. |
| `seed` | `1337` | Change for a different flow field and arrival pattern. |
| `idle` | `true` | Faint shimmer once assembled. |
| `idleFps` | `24` | Redraw rate while idling. |

### Plumbing

| Prop | Default | Notes |
|---|---|---|
| `respectReducedMotion` | `true` | Renders the finished portrait statically instead of animating. |
| `maxDpr` | `2` | Device-pixel-ratio ceiling. |
| `zIndex` | `0` | See the stacking-context note above. |
| `debug` | `false` | Exposes `window.__halftoneDebug`. |
| `className` / `style` | — | Merged onto the canvas. |
| `onProgress` | — | `(p: number) => void`, throttled to ~0.4% changes. |
| `onReady` | — | Fires once the image has loaded and the grid is built. |

---

## Tuning for a different photo

The defaults are calibrated to `public/portrait.jpg`, whose luminance histogram
is: background ≈ 0.023, subject median ≈ 0.23, highlights p97 ≈ 0.71.

For a different photo, `blackPoint` and `whitePoint` are the two that matter:

* **Background bleeding in as noise** → raise `blackPoint`.
* **Subject too eroded / shoulders missing** → lower `blackPoint`.
* **Highlights a flat mass of `@`** → raise `whitePoint`.
* **Image looks grey and flat, densest glyphs never appear** → lower `whitePoint`.

Run the dev harness and use the live panel rather than guessing — it writes the
values to `localStorage` and prints a JSON block you can paste straight into your
props.

```bash
npm install
npm run dev
```

Press `H` to toggle the panel.

---

## How it works

**Grid.** The image is downscaled by progressive halving (a one-shot big
downscale aliases badly) to exactly `cols × rows`, then reduced to per-cell
luminance. Cells below `blackPoint` are discarded, which both carves out the
subject and roughly halves the particle count. If the survivors exceed the
budget, the cell size grows and the whole thing is recomputed.

**Glyph atlas.** Every glyph is pre-rendered at every one of 12 opacity steps
into a single offscreen canvas. The render loop therefore never touches
`fillStyle`, `globalAlpha`, or `font` — it is one `drawImage` per character from
a single source texture, which the GPU batches. Destination coordinates are
snapped to the device pixel grid so small glyphs stay crisp.

**Flock.** Each character's inbound bearing comes from an fbm noise field
sampled at its target position, so neighbours share a heading and arrive as
streams rather than as independent dots. A second noise field signs the lateral
arc, which is what produces the parallel fibre-like streaks. Position uses
**smoothstep**, not an ease-out — an ease-out front-loads the distance and the
characters snap onto their targets almost immediately, which kills the sense of
flight entirely.

**Arrival order.** Delays are **rank-normalised**: particles are sorted by their
noise-field value and assigned `rank / n`. Simply rescaling the field's min..max
leaves a bell-shaped arrival rate — sparse at both ends, frantic in the middle,
with the portrait finishing around 80% of the scroll. Ranking gives a constant
arrival rate across the full distance while preserving the field's spatial
ordering, so neighbours still travel together.

**Glyph condensation.** In flight, a character draws a sparser glyph than its
final one (`round(gi * (0.25 + 0.75 * k))`), so marks visibly condense from dots
into their final characters as they land.

---

## Performance

| Guard | Behaviour |
|---|---|
| Particle budget | Cell size grows until the count fits `maxParticles`. |
| Adaptive quality | If render time exceeds 11 ms, the active set is thinned up to 3 times (max 45% reduction). Particles are stored pre-shuffled, so a prefix is a spatially uniform subset. |
| DPR cap | Capped at 2 — a 3x phone canvas is pure fill-rate cost. |
| Idle | Once assembled, redraws drop to `idleFps` (24). With `idle={false}` it stops drawing entirely. |
| Empty | At progress 0 with nothing on screen, the loop early-outs without clearing. |
| Hidden tab | `visibilitychange` cancels the rAF loop. |
| Resize | Debounced 160 ms, and ignores height changes under 130 px so mobile URL-bar jitter doesn't trigger a rebuild. |
| Reduced motion | Renders the finished portrait once, no animation. |

---

## Repo layout

```
src/components/HalftonePortrait.tsx   the component — this is the only file you need
src/demo/App.tsx                      dev harness with the live tuning panel
public/portrait.jpg                   source image (1100px, from DSC_1771)
vite.config.ts                        includes a dev-only snapshot endpoint
```

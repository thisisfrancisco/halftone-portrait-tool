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
| `initialProgress` | `0` | Progress the portrait rests at before scrolling. Scroll maps this → 1, so it still completes at `scrollDistance`. |
| `restOpacity` | `0.35` | Opacity of characters that haven't launched yet, drawn drifting at their origin. This is what stops the hero being blank. `0` disables. |
| `restDensity` | `0.035` | Fraction of those characters actually drawn. Deliberately low — drawing all of them reads as a static field rather than a scatter. |
| `smoothing` | `110` | Scroll follow time constant (ms). Higher = more glide. |

### Grid and density

| Prop | Default | Notes |
|---|---|---|
| `cellSize` | `5.5` | Halftone cell in CSS px (desktop). Smaller = finer. |
| `mobileCellSize` | `5` | Cell size below `mobileBreakpoint`. |
| `mobileBreakpoint` | `768` | Viewport width for the mobile branch. |
| `maxParticles` | `13000` | Desktop ceiling. Cell size grows automatically to respect it. |
| `mobileMaxParticles` | `4200` | Mobile ceiling. |

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
| `fillHoles` | `0.1` | Glyph density given to dark cells enclosed by lit ones — eye sockets, nostrils, the shadow side of the face. `0` disables. |
| `fillHoleSeal` | `2` | Cells of gap in the silhouette to seal before deciding what counts as interior. |
| `fillHoleFalloff` | `0.5` | How fast the hole fill thins with depth. `0` fills a socket evenly; higher keeps the rim and empties the middle. |
| `atmosphere` | `0.15` | Peak density of the ambient cloud field around the subject. `0` disables. |
| `atmosphereReach` | `45` | How far, in cells, the cloud reaches from the silhouette. |
| `atmosphereScale` | `1` | Cloud noise frequency. Higher = smaller, busier wisps. |
| `edgeFeather` | `14` | Cells over which the portrait dissolves at the edges of its own box, so a subject running to the edge of the photo fades out instead of ending on a straight cut. `0` disables. |
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
* **Eye sockets read as holes** → raise `fillHoles`, or `fillHoleSeal` if they stay empty.
* **A socket reads as a flat dotted patch** → raise `fillHoleFalloff`.
* **Faint marks appearing out in the background** → lower `fillHoleSeal`.
* **Silhouette ends on a hard edge (hair, shoulders)** → raise `atmosphere` or `atmosphereReach`.
* **Cloud reads as texture rather than banks** → lower `atmosphereScale`.
* **Straight cut where shoulders meet the frame** → raise `edgeFeather`.

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

**Interior holes.** Eye sockets and nostrils fall below `blackPoint` and get
culled, leaving voids in the middle of the face. Lowering the black point to
recover them drags the photo's background in as noise instead, so the real
problem is separating *interior shadow* from *background*. A fixed-window
enclosure test cannot do it — the shadow side of a face is so sparsely lit that
a large socket there looks no more enclosed than open background. Connectivity
can: this is a morphological close. The lit mask is dilated by `fillHoleSeal` to
seal gaps in the silhouette, the background is flooded inward from the frame
edge, and the result is eroded by the same amount to undo the dilation (without
that erosion the dilation ring draws as a halo around the head). Whatever the
flood cannot reach is a genuine hole, and gets a faint glyph scaled by the
luminance it did have, so shadows keep some modelling. If the flood fails to
reach a large enough area — a photo without a clean dark background — the fill is
skipped rather than flooding the frame with marks.

**Atmosphere.** The particle grid covers the whole viewport, not just the
portrait box, which gives the silhouette somewhere to dissolve into — without it
the hair simply stops at the box edge. A single chamfer distance transform from
the lit mask drives two things: the hole fill thins with depth (so a deep socket
keeps its rim and empties out rather than reading as a flat dotted patch), and
the cloud is densest where it meets the silhouette, fading to a faint mist
further out.

Cloud coverage is applied **stochastically**, not as a threshold. Thresholding
the noise produces hard-edged blobs; letting each cell survive with a probability
equal to its local coverage makes the field thin out grain by grain, which is
what reads as vapour. The atmosphere is capped at 30% of the particle budget,
keeping the highest-coverage cells — the ones doing the work against the
silhouette.

**Edge feather.** The photo is a crop: the jacket and shoulders run right to the
frame edge. Sampling stops at the portrait box, so without a feather the halftone
ends on a dead straight line along the bottom and sides of that box. The last
`edgeFeather` cells dissolve stochastically — same trick as the cloud coverage —
so the subject fades into the atmosphere rather than being sliced off. Only the
portrait is feathered; the cloud already extends past the box on its own.

**The resting state.** At scroll 0 no character has begun its flight, so the
canvas would be genuinely empty — a blank hero. Raising the progress floor
doesn't fix it: at 2% only ~3% of characters have launched and they're barely
faded in, which measured 26 lit pixels against ~25,000 for the finished
portrait. Instead, characters that haven't launched are drawn drifting faintly
at their **origins**, so the reveal timeline is untouched.

Only a small `restDensity` fraction of them is drawn. Showing all ~8,500 reads as
a dense static field rather than a scatter; at the default 3.5% the hero rests at
roughly what the original showed after a short scroll (~216 lit pixels vs 8,566
for the full set). The subset is chosen by its own hash rather than the
per-particle random that drives the drift phase — reusing that would make every
survivor drift in lockstep. Both the resting drift and the idle shimmer redraw at
`idleFps` rather than every frame.

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

## Live demo (GitHub Pages)

`.github/workflows/pages.yml` builds the demo and deploys it on every push to
`main`.

**This needs one setting changed once:** repo *Settings → Pages → Build and
deployment → Source* must be **GitHub Actions**, not "Deploy from a branch".
Serving the branch directly publishes the repo root, where `index.html` points
at `/src/demo/main.tsx` — TypeScript a browser cannot execute, at an absolute
path that does not exist under a project URL. Nothing renders.

Two details make the build work under `/<repo>/` rather than a domain root:

* `base: './'` in `vite.config.ts`, so assets resolve relative to the page.
* the demo loads the photo as `` `${import.meta.env.BASE_URL}portrait.jpg` ``
  rather than `/portrait.jpg`.

The tuning panel is hidden in the deployed build (`import.meta.env.DEV`); press
`H` to show it anyway.

## Repo layout

```
src/components/HalftonePortrait.tsx   the component — this is the only file you need
src/demo/App.tsx                      demo + live tuning panel (press H)
public/portrait.jpg                   source image (1100px, from DSC_1771)
vite.config.ts                        relative base, plus a dev-only snapshot endpoint
.github/workflows/pages.yml           builds and deploys the demo to GitHub Pages
```

/**
 * Dev harness. Approximates thisisfrancisco.com (#0D0D0D bg, #F5F5F5 type,
 * headline + image grid) so the portrait can be tuned in context.
 *
 * The live control panel is dev-only — none of it ships with the component.
 */
import { useEffect, useState } from 'react';
import HalftonePortrait from '../components/HalftonePortrait';

const PANEL_KEY = 'halftone-tuning';

interface Tuning {
  cellSize: number;
  opacity: number;
  scale: number;
  offsetY: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  fillHoles: number;
  fillHoleSeal: number;
  fillHoleFalloff: number;
  atmosphere: number;
  atmosphereReach: number;
  atmosphereScale: number;
  travel: number;
  swirl: number;
  spread: number;
  flightOpacity: number;
  turbulence: number;
  glyphScale: number;
  scrollDistance: number;
}

const DEFAULTS: Tuning = {
  cellSize: 5.5,
  opacity: 0.72,
  scale: 0.92,
  offsetY: 0,
  blackPoint: 0.085,
  whitePoint: 0.8,
  gamma: 0.8,
  fillHoles: 0.1,
  fillHoleSeal: 2,
  fillHoleFalloff: 0.5,
  atmosphere: 0.15,
  atmosphereReach: 45,
  atmosphereScale: 1,
  travel: 520,
  swirl: 220,
  spread: 0.55,
  flightOpacity: 0.5,
  turbulence: 26,
  glyphScale: 1.4,
  scrollDistance: 3000,
};

const RANGES: Record<keyof Tuning, [number, number, number]> = {
  cellSize: [3.5, 18, 0.5],
  opacity: [0, 1, 0.01],
  scale: [0.4, 1.6, 0.01],
  offsetY: [-0.4, 0.4, 0.01],
  blackPoint: [0, 0.5, 0.005],
  whitePoint: [0.4, 1, 0.01],
  gamma: [0.3, 2.5, 0.05],
  fillHoles: [0, 0.4, 0.01],
  fillHoleSeal: [0, 8, 1],
  fillHoleFalloff: [0, 2, 0.05],
  atmosphere: [0, 0.5, 0.01],
  atmosphereReach: [4, 90, 1],
  atmosphereScale: [0.3, 3, 0.05],
  travel: [100, 2000, 10],
  swirl: [0, 700, 10],
  spread: [0, 0.95, 0.01],
  flightOpacity: [0, 1, 0.02],
  turbulence: [0, 120, 1],
  glyphScale: [0.8, 2.2, 0.05],
  scrollDistance: [800, 6000, 100],
};

export default function App() {
  const [t, setT] = useState<Tuning>(() => {
    try {
      const raw = localStorage.getItem(PANEL_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULTS;
  });
  const [progress, setProgress] = useState(0);
  const [panel, setPanel] = useState(true);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    localStorage.setItem(PANEL_KEY, JSON.stringify(t));
  }, [t]);

  // Simple FPS meter so perf regressions are visible while tuning.
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h') setPanel((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const set = (k: keyof Tuning) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setT((prev) => ({ ...prev, [k]: parseFloat(e.target.value) }));

  return (
    <>
      <HalftonePortrait
        src="/portrait.jpg"
        scrollDistance={t.scrollDistance}
        cellSize={t.cellSize}
        mobileCellSize={t.cellSize - 0.5}
        opacity={t.opacity}
        scale={t.scale}
        offsetY={t.offsetY}
        blackPoint={t.blackPoint}
        whitePoint={t.whitePoint}
        gamma={t.gamma}
        fillHoles={t.fillHoles}
        fillHoleSeal={t.fillHoleSeal}
        fillHoleFalloff={t.fillHoleFalloff}
        atmosphere={t.atmosphere}
        atmosphereReach={t.atmosphereReach}
        atmosphereScale={t.atmosphereScale}
        travel={t.travel}
        swirl={t.swirl}
        spread={t.spread}
        flightOpacity={t.flightOpacity}
        turbulence={t.turbulence}
        glyphScale={t.glyphScale}
        onProgress={setProgress}
        debug
      />

      {/* ---- Page content, sitting on top of the fixed canvas ---- */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        <section
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            padding: '0 6vw',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(3rem, 9vw, 9rem)',
              lineHeight: 0.95,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              margin: 0,
              mixBlendMode: 'difference',
            }}
          >
            Creating
            <br />
            Experiences
            <br />
            That Matter
          </h1>
        </section>

        <section style={{ padding: '0 6vw 20vh' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: i % 3 === 0 ? '3 / 4' : '4 / 3',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.28)',
                  fontSize: 13,
                  letterSpacing: '0.08em',
                }}
              >
                PROJECT {String(i + 1).padStart(2, '0')}
              </div>
            ))}
          </div>
        </section>

        {/* Spacer so the page is always taller than the assembly timeline. */}
        <section style={{ height: t.scrollDistance }} />
      </main>

      {/* ---- Dev-only tuning panel ---- */}
      {panel && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            width: 250,
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
            padding: 12,
            background: 'rgba(18,18,18,0.94)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8,
            font: '11px ui-monospace, Menlo, monospace',
            zIndex: 50,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>tuning</strong>
            <span style={{ color: fps < 50 ? '#ff7a5c' : '#7ce0a4' }}>{fps} fps</span>
          </div>
          <div style={{ marginBottom: 10, color: 'rgba(255,255,255,0.55)' }}>
            progress {progress.toFixed(3)} · press H to hide
          </div>
          {(Object.keys(RANGES) as (keyof Tuning)[]).map((k) => {
            const [min, max, step] = RANGES[k];
            return (
              <label key={k} style={{ display: 'block', marginBottom: 7 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{k}</span>
                  <span>{t[k]}</span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={t[k]}
                  onChange={set(k)}
                  style={{ width: '100%' }}
                />
              </label>
            );
          })}
          <button
            onClick={() => setT(DEFAULTS)}
            style={{
              width: '100%',
              marginTop: 6,
              padding: 6,
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            reset
          </button>
          <pre
            style={{
              marginTop: 8,
              padding: 6,
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 4,
              fontSize: 10,
              whiteSpace: 'pre-wrap',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {JSON.stringify(t, null, 1)}
          </pre>
        </div>
      )}
    </>
  );
}

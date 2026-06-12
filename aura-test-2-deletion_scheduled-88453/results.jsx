// AURA results screen — animated reveal, dimension breakdown, share card, insights.

const { useState: useState2, useEffect: useEffect2, useMemo: useMemo2, useRef: useRef2 } = React;

// ── Phase: building -> reveal -> details ───────────────────────────
function ResultsScreen({ scores, onContinue, onRestart, archetypeOverride }) {
  const [phase, setPhase] = useState2('building'); // 'building' | 'reveal' | 'details'
  const [shareOpen, setShareOpen] = useState2(false);

  const archetype = useMemo2(() => {
    if (archetypeOverride) {
      return window.AURA_ARCHETYPES.find((a) => a.id === archetypeOverride);
    }
    return window.AURA_pickArchetype(scores);
  }, [scores, archetypeOverride]);

  // Auto-advance: building 2.4s -> reveal -> tap to continue (or auto after 4s)
  useEffect2(() => {
    if (phase === 'building') {
      const t = setTimeout(() => setPhase('reveal'), 2400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Re-run animation if archetype changes (preview tweak)
  useEffect2(() => {
    setPhase('building');
  }, [archetypeOverride]);

  if (phase === 'building') return <BuildingPhase archetype={archetype} />;
  if (phase === 'reveal') return <RevealPhase archetype={archetype} onTap={() => setPhase('details')} />;

  return (
    <>
      <DetailsPhase
        archetype={archetype}
        scores={scores}
        onContinue={onContinue}
        onRestart={onRestart}
        onShare={() => setShareOpen(true)} />
      
      {shareOpen &&
      <ShareModal archetype={archetype} scores={scores} onClose={() => setShareOpen(false)} />
      }
    </>);

}
window.ResultsScreen = ResultsScreen;

// ── Phase 1: building animation ─────────────────────────────────────
function BuildingPhase({ archetype }) {
  const [tick, setTick] = useState2(0);
  useEffect2(() => {
    const id = setInterval(() => setTick((t) => t + 1), 320);
    return () => clearInterval(id);
  }, []);
  const lines = [
  'reading your answers…',
  'crossing self · love · voice…',
  'matching your archetype…'];

  return (
    <Screen style={{ background: 'var(--aura-bg)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'relative', width: 180, height: 180,
        animation: 'aura-pulse 1.4s ease-in-out infinite'
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'var(--aura-grad)',
          filter: 'blur(2px) saturate(1.1)',
          animation: 'aura-morph 4s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', inset: '8%', borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.5), rgba(255,255,255,0) 60%)'
        }} />
      </div>

      <div style={{
        marginTop: 36,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
        letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        textAlign: 'center'
      }}>
        {lines[Math.min(tick, lines.length - 1)]}
      </div>
      <div style={{
        marginTop: 10,
        fontFamily: 'var(--aura-display)', fontSize: 22, fontWeight: 600,
        color: 'var(--aura-ink)', letterSpacing: '-0.02em',
        textAlign: 'center'
      }}>
        reading your aura<span className="aura-blink">_</span>
      </div>
    </Screen>);

}

// ── Phase 2: name reveal ────────────────────────────────────────────
function RevealPhase({ archetype, onTap }) {
  // ensure animations re-trigger each mount
  return (
    <div
      onClick={onTap}
      style={{
        width: '100%', height: '100%', position: 'relative',
        background: 'var(--aura-bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 24px 36px', boxSizing: 'border-box',
        cursor: 'pointer', overflow: 'hidden'
      }}>
      
      {/* burst */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%',
        width: 600, height: 600, transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, oklch(0.78 0.22 ${archetype.hue} / 0.7), transparent 60%)`,
        animation: 'aura-burst 1s cubic-bezier(.2,.7,.2,1) forwards',
        pointerEvents: 'none'
      }} />

      <div style={{ marginTop: 30, animation: 'aura-pop 0.7s cubic-bezier(.2,.9,.3,1.3) both' }}>
        <AuraSticker archetype={archetype} size={240} />
      </div>

      <div style={{
        marginTop: 30,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        animation: 'aura-rise 0.5s 0.5s both'
      }}>
        you are
      </div>

      <h1 style={{
        margin: '10px 0 0',
        fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 40,
        lineHeight: 1.0, letterSpacing: '-0.035em', color: 'var(--aura-ink)',
        textAlign: 'center',
        animation: 'aura-rise 0.7s 0.7s both',
        textWrap: 'balance'
      }}>{archetype.name}</h1>

      <div style={{
        marginTop: 12,
        fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        fontSize: 22, color: `oklch(0.55 0.22 ${archetype.hue})`,
        textAlign: 'center', lineHeight: 1.2,
        animation: 'aura-rise 0.7s 0.9s both',
        textWrap: 'balance'
      }}>{archetype.tagline}</div>

      <div style={{
        marginTop: 'auto', paddingTop: 24,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
        color: 'color-mix(in oklab, var(--aura-ink) 50%, transparent)',
        letterSpacing: '.12em', textTransform: 'uppercase',
        animation: 'aura-blink-slow 1.6s 1.2s infinite both'
      }}>
        tap to read more →
      </div>
    </div>);

}

// ── Phase 3: full results ───────────────────────────────────────────
function DetailsPhase({ archetype, scores, onContinue, onRestart, onShare }) {
  const insights = window.AURA_INSIGHTS[archetype.id] || [];
  const dims = window.AURA_DIMENSIONS;
  // normalise scores to 0..100 for display (range was ~-10..+10)
  const norm = (v) => Math.round((v + 10) / 20 * 100);

  return (
    <Screen style={{ background: 'var(--aura-bg)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ flexShrink: 0 }}>
          <AuraSticker archetype={archetype} size={88} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
            letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
            color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)'
          }}>your archetype</div>
          <h2 style={{
            margin: '2px 0 0',
            fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 26,
            lineHeight: 1.0, letterSpacing: '-0.03em', color: 'var(--aura-ink)',
            textWrap: 'balance'
          }}>{archetype.name}</h2>
          <div style={{
            marginTop: 4,
            fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
            fontSize: 15, color: `oklch(0.55 0.22 ${archetype.hue})`,
            lineHeight: 1.25, textWrap: 'balance'
          }}>{archetype.tagline}</div>
        </div>
      </div>

      <p style={{
        margin: '18px 0 0',
        fontSize: 15, lineHeight: 1.45, color: 'var(--aura-ink)',
        textWrap: 'pretty'
      }}>{archetype.description}</p>

      {/* Plain-English psychology summary */}
      {archetype.pattern && (
        <div style={{
          marginTop: 16,
          background: 'color-mix(in oklab, var(--aura-ink) 5%, transparent)',
          border: '1px solid color-mix(in oklab, var(--aura-ink) 10%, transparent)',
          borderRadius: 14, padding: '12px 14px',
        }}>
          <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9.5,
            letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
            color: `oklch(0.5 0.22 ${archetype.hue})`,
            marginBottom: 6,
          }}>pattern at a glance</div>
          <div style={{
            fontFamily: 'var(--aura-display)', fontWeight: 500, fontSize: 14.5,
            lineHeight: 1.4, color: 'var(--aura-ink)', textWrap: 'pretty',
          }}>{archetype.pattern}</div>
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px dashed color-mix(in oklab, var(--aura-ink) 14%, transparent)',
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10, lineHeight: 1.5,
            color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
          }}>
            <span style={{ fontWeight: 700, color: 'var(--aura-ink)' }}>why the food name? </span>
            it’s a memorable handle for your pattern — same flavour profile, easier to recall than the psychology terms.
          </div>
        </div>
      )}

      {/* dimension breakdown — radar chart */}
      <SectionHeader>your aura, broken down</SectionHeader>
      <AuraRadar scores={scores} dims={dims} archetype={archetype} />

      {/* insights */}
      <SectionHeader>what this means for you</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map((n, i) =>
        <div key={i} style={{
          background: 'var(--aura-chip, white)',
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 8%, transparent)',
          borderRadius: 16, padding: '14px 14px',
          position: 'relative'
        }}>
            <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9.5,
            letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
            color: `oklch(0.55 0.22 ${archetype.hue})`,
            marginBottom: 6
          }}>{n.tag}</div>
            <div style={{
            fontFamily: 'var(--aura-display)', fontWeight: 500, fontSize: 14.5,
            lineHeight: 1.4, color: 'var(--aura-ink)', textWrap: 'pretty'
          }}>{n.text}</div>
          </div>
        )}
      </div>

      {/* CTAs — Share promoted to a high-visibility action */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ShareProfileCTA archetype={archetype} onClick={onShare} />
        <AuraButton onClick={onContinue} variant="primary" iconRight="arrow-right">
          Continue to your plan
        </AuraButton>
        <button
          onClick={onRestart}
          style={{
            appearance: 'none', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '8px 0',
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
            fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
            textDecoration: 'underline', textUnderlineOffset: 3
          }}>
          retake the quiz</button>
      </div>
    </Screen>);

}

// ── Share Profile CTA: large gradient card, high-visibility ────────
function ShareProfileCTA({ archetype, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', padding: 0, width: '100%',
        position: 'relative', overflow: 'hidden',
        borderRadius: 22,
        background: `linear-gradient(135deg,
          oklch(0.7 0.22 ${archetype.hue}) 0%,
          oklch(0.55 0.26 ${(archetype.hue + 50) % 360}) 100%)`,
        color: 'white',
        boxShadow: `0 18px 40px -16px oklch(0.55 0.22 ${archetype.hue} / 0.6),
                    0 2px 0 oklch(0.4 0.18 ${archetype.hue}) inset`
      }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.985)'}
      onMouseUp={(e) => e.currentTarget.style.transform = ''}
      onMouseLeave={(e) => e.currentTarget.style.transform = ''}>
      
      {/* shimmer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(80% 60% at 90% 10%, rgba(255,255,255,0.35), transparent 60%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'relative',
        padding: '18px 18px 18px 18px',
        display: 'flex', alignItems: 'center', gap: 14
      }}>
        <div style={{
          flex: '0 0 auto',
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28
        }}>
          <AuraIcon name="share" size={26} color="white" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
            letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 700,
            opacity: 0.85, marginBottom: 3
          }}>share your profile</div>
          <div style={{
            fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 20,
            letterSpacing: '-0.02em', lineHeight: 1.05
          }}>Send it to a friend →</div>
          <div style={{
            marginTop: 4, fontSize: 12.5, lineHeight: 1.3, opacity: 0.85,
            textWrap: 'pretty'
          }}>
            See which archetype they get. Beautiful card, ready for stories.
          </div>
        </div>
      </div>
    </button>);

}

// ── Radar / spider chart over 3 dimensions ─────────────────────────
function AuraRadar({ scores, dims, archetype }) {
  // normalise to 0..1 (range -10..+10 in dataset)
  const vals = dims.map((d) => Math.max(0, Math.min(1, (scores[d.key] + 10) / 20)));
  const size = 320;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const radius = 96;
  const angles = [-90, 30, 150].map((a) => a * Math.PI / 180); // top, bottom-right, bottom-left

  const pt = (i, r) => [cx + Math.cos(angles[i]) * r, cy + Math.sin(angles[i]) * r];
  const rings = [0.33, 0.66, 1].map((f) =>
  [0, 1, 2].map((i) => pt(i, radius * f).join(',')).join(' ')
  );
  const shape = [0, 1, 2].map((i) => pt(i, radius * vals[i]).join(',')).join(' ');
  const hue = archetype.hue;

  return (
    <div style={{
      position: 'relative',
      background: 'var(--aura-chip, white)',
      border: '1.5px solid color-mix(in oklab, var(--aura-ink) 8%, transparent)',
      borderRadius: 22,
      padding: '8px 8px 16px'
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: 'block', width: "337px" }}>
        <defs>
          <radialGradient id="radarFill" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={`oklch(0.78 0.22 ${hue})`} stopOpacity="0.55" />
            <stop offset="100%" stopColor={`oklch(0.55 0.24 ${hue})`} stopOpacity="0.85" />
          </radialGradient>
        </defs>

        {/* grid rings */}
        {rings.map((pts, idx) =>
        <polygon key={idx} points={pts}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.10}
        strokeWidth={1}
        style={{ color: 'var(--aura-ink)' }} />

        )}
        {/* axes */}
        {[0, 1, 2].map((i) => {
          const [x, y] = pt(i, radius);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y}
            stroke="currentColor" strokeOpacity={0.10} strokeWidth={1}
            style={{ color: 'var(--aura-ink)' }} />);

        })}

        {/* shape */}
        <polygon
          points={shape}
          fill="url(#radarFill)"
          stroke={`oklch(0.45 0.22 ${hue})`}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: 'aura-pop 0.7s cubic-bezier(.2,.9,.3,1.3) both'
          }} />
        
        {/* value dots */}
        {[0, 1, 2].map((i) => {
          const [x, y] = pt(i, radius * vals[i]);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={5} fill="white" stroke={`oklch(0.45 0.22 ${hue})`} strokeWidth={2} />
            </g>);

        })}

        {/* axis labels (short label + pct, kept inside the container) */}
        {dims.map((d, i) => {
          const [lx, ly] = pt(i, radius + 30);
          const pct = Math.round(vals[i] * 100);
          // Top stays centered; right & left labels anchor inward so they don't clip.
          const align = i === 0 ? 'middle' : i === 1 ? 'end' : 'start';
          const labelX = i === 0 ? lx : i === 1 ? lx + 8 : lx - 8;
          return (
            <g key={d.key}>
              <text
                x={labelX} y={ly - 4}
                textAnchor={align}
                style={{
                  fontFamily: 'var(--aura-mono, "JetBrains Mono")',
                  fontSize: 9.5, fontWeight: 700,
                  letterSpacing: '.18em', textTransform: 'uppercase',
                  fill: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)'
                }}>
                {d.label || d.short || d.name}</text>
              <text
                x={labelX} y={ly + 16}
                textAnchor={align}
                style={{
                  fontFamily: 'var(--aura-display)',
                  fontSize: 22, fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fill: `oklch(0.5 0.22 ${d.hue})`
                }}>
                {pct}<tspan style={{ fontSize: 11, fontWeight: 600, fill: 'color-mix(in oklab, var(--aura-ink) 40%, transparent)' }}> /100</tspan></text>
            </g>);

        })}
      </svg>

      {/* legend — full dim names + spectrum, inside the container */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 6,
        padding: '0 6px',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        color: 'color-mix(in oklab, var(--aura-ink) 50%, transparent)'
      }}>
        {dims.map((d) => (
          <div key={d.key} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{
              fontWeight: 700, color: 'var(--aura-ink)', opacity: 0.75,
              marginBottom: 3, textWrap: 'balance',
            }}>
              {d.name}
            </div>
            <div style={{ opacity: 0.75, lineHeight: 1.3 }}>
              <span>{d.low}</span>
              <span style={{ margin: '0 4px', opacity: 0.5 }}>→</span>
              <span style={{ fontWeight: 700 }}>{d.high}</span>
            </div>
          </div>
        ))}
      </div>
    </div>);

}

function SectionHeader({ children }) {
  return (
    <div style={{
      marginTop: 28, marginBottom: 14,
      fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
      letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
      color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'color-mix(in oklab, var(--aura-ink) 12%, transparent)' }} />
    </div>);

}

// ── Share card modal ────────────────────────────────────────────────
function ShareModal({ archetype, scores, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(20,12,30,0.45)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100, padding: '60px 16px 30px',
        animation: 'aura-fade 0.25s both'
      }}>
      
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--aura-bg)', borderRadius: 28,
          width: '100%', maxWidth: 360,
          padding: '20px 20px 18px',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)',
          animation: 'aura-slide-up 0.35s cubic-bezier(.2,.7,.2,1) both'
        }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
            letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
            color: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)'
          }}>your share card</div>
          <button onClick={onClose} style={{
            appearance: 'none', border: 'none', background: 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
            width: 28, height: 28, borderRadius: 99, cursor: 'pointer',
            color: 'var(--aura-ink)', fontSize: 16, lineHeight: 1, fontWeight: 700
          }}>×</button>
        </div>

        {/* the share card itself — IG story-ish */}
        <ShareCard archetype={archetype} scores={scores} />

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <AuraButton onClick={onClose} variant="primary" icon="share" style={{ padding: '14px 16px', fontSize: 14 }}>
            Send to friends
          </AuraButton>
        </div>
        <div style={{
          marginTop: 8, textAlign: 'center',
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
          color: 'color-mix(in oklab, var(--aura-ink) 45%, transparent)'
        }}>

        </div>
      </div>
    </div>);

}

function ShareCard({ archetype, scores }) {
  const norm = (v) => Math.round((v + 10) / 20 * 100);
  return (
    <div style={{
      borderRadius: 22, overflow: 'hidden', position: 'relative',
      aspectRatio: '9 / 14',
      background: `oklch(0.18 0.06 ${archetype.hue})`,
      color: 'white',
      padding: '20px',
      display: 'flex', flexDirection: 'column',
      isolation: 'isolate'
    }}>
      {/* mesh background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(60% 50% at 80% 20%, oklch(0.7 0.28 ${archetype.hue}) 0%, transparent 70%),
          radial-gradient(70% 55% at 10% 90%, oklch(0.55 0.28 ${(archetype.hue + 40) % 360}) 0%, transparent 65%)`,
        zIndex: -1, opacity: 0.95
      }} />

      {/* top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 22,
          letterSpacing: '-0.04em'
        }}>aura.</div>
        <div style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
          letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
          opacity: .7
        }}></div>
      </div>

      {/* sticker */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
        <AuraSticker archetype={archetype} size={140} />
      </div>

      {/* name */}
      <div style={{
        fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 28,
        lineHeight: 1.0, letterSpacing: '-0.035em', textWrap: 'balance'
      }}>{archetype.name}</div>
      <div style={{
        marginTop: 6,
        fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        fontSize: 16, opacity: 0.9, lineHeight: 1.2, textWrap: 'balance'
      }}>{archetype.tagline}</div>

      {/* mini bars */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {window.AURA_DIMENSIONS.map((d) => {
          const pct = norm(scores[d.key]);
          return (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
                fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                width: 40, opacity: 0.7
              }}>{d.short}</div>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 99 }} />
              </div>
              <div style={{
                fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
                fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 22, textAlign: 'right'
              }}>{pct}</div>
            </div>);

        })}
      </div>

      <div style={{
        marginTop: 12,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.6, fontWeight: 700
      }}></div>
    </div>);

}

window.ShareCard = ShareCard;
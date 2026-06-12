// AURA screens — landing, quiz, results, lead capture.
// Reads window.{AURA_QUESTIONS, AURA_ARCHETYPES, AURA_INSIGHTS, AURA_DIMENSIONS, AURA_pickArchetype}

const { useState, useEffect, useMemo, useRef } = React;

// ── Screen wrapper: scrollable phone surface ────────────────────────
function Screen({ children, style = {} }) {
  return (
    <div style={{
      width: '100%', height: '100%', boxSizing: 'border-box',
      padding: '64px 24px 36px', overflowY: 'auto', overflowX: 'hidden',
      display: 'flex', flexDirection: 'column',
      WebkitOverflowScrolling: 'touch',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ═══ LANDING ════════════════════════════════════════════════════════
function LandingScreen({ onStart, lang }) {
  // Repositioned: psychology-based life coach for growth, mental health, and relationships.
  const tagline = [
    'Grow into who you want to be.',
    'Grow into who you want to be.',
    'Grow into who you want to be lah.',
    'Grow into who you want to be lah.',
  ][lang];
  const blurb = [
    "Navigate life's uncertainties and ups and downs. Become a confident, intentional communicator who builds meaningful and fulfilling relationships.",
    "Navigate life's uncertainties and ups and downs. Become a confident, intentional communicator who builds meaningful and fulfilling relationships.",
    "Navigate life's ups, downs and confusing parts. Become a confident, intentional communicator who builds meaningful, fulfilling relationships one.",
    "Navigate life's ups, downs and confusing parts sia. Become a confident, intentional communicator who build meaningful, fulfilling relationships one.",
  ][lang];
  return (
    <Screen style={{ background: 'var(--aura-bg)' }}>
      {/* gradient hero ball */}
      <div style={{ position: 'relative', flex: '0 0 auto', height: 280, margin: '8px -10px 0' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--aura-grad)',
          borderRadius: '50% 50% 48% 52% / 56% 52% 48% 44%',
          filter: 'saturate(1.1)',
          animation: 'aura-morph 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: '6%', borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.4), rgba(255,255,255,0) 55%)',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', top: '18%', left: '60%',
          color: 'white', fontFamily: 'var(--aura-display)', fontWeight: 700,
          fontSize: 28, transform: 'rotate(8deg)', opacity: .9,
        }}>✦</div>
        <div style={{
          position: 'absolute', bottom: '20%', left: '14%',
          color: 'white', fontFamily: 'var(--aura-display)', fontWeight: 700,
          fontSize: 18, transform: 'rotate(-6deg)', opacity: .8,
        }}>✦</div>
        {/* eye-balls floating */}
        <div style={{
          position: 'absolute', top: '38%', left: '24%', display: 'flex', gap: 14,
        }}>
          <div className="aura-eye" />
          <div className="aura-eye" />
        </div>
      </div>

      {/* wordmark */}
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h1 style={{
          fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 64, margin: 0,
          letterSpacing: '-0.04em', color: 'var(--aura-ink)', lineHeight: 0.92,
        }}>aura.</h1>
        <span style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
          color: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
          background: 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
          padding: '4px 8px', borderRadius: 99, fontWeight: 600,
        }}>v0.1 · SG</span>
      </div>

      <p style={{
        marginTop: 14, marginBottom: 0,
        fontFamily: 'var(--aura-display)', fontWeight: 600, fontSize: 26, lineHeight: 1.15,
        letterSpacing: '-0.02em', color: 'var(--aura-ink)',
        textWrap: 'pretty',
      }}>
        {tagline}
        <em style={{
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
          fontWeight: 400, fontSize: 32, color: 'var(--aura-accent)',
          marginLeft: 6,
        }}>show</em>
        <em style={{
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
          fontWeight: 400, fontSize: 32, color: 'var(--aura-ink)',
        }}> up.</em>
      </p>

      <p style={{
        marginTop: 14, marginBottom: 0, fontSize: 15, lineHeight: 1.45,
        color: 'color-mix(in oklab, var(--aura-ink) 70%, transparent)',
        textWrap: 'pretty',
      }}>{blurb}</p>

      {/* CTA */}
      <div style={{ marginTop: 28 }}>
        <AuraButton onClick={onStart} variant="primary" iconRight="arrow-right">
          Let’s get to know you
        </AuraButton>
      </div>

      {/* meta line */}
      <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'center',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        flexWrap: 'wrap',
      }}>
        <span>15 scenarios</span>
        <span style={{ opacity: .5 }}>·</span>
        <span>~7 min</span>
        <span style={{ opacity: .5 }}>·</span>
        <span>3 growth dimensions</span>
      </div>

      {/* psychology framework note */}
      <div style={{
        marginTop: 18,
        background: 'color-mix(in oklab, var(--aura-ink) 5%, transparent)',
        border: '1px solid color-mix(in oklab, var(--aura-ink) 10%, transparent)',
        borderRadius: 14, padding: '12px 14px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <div style={{
          flex: '0 0 auto', marginTop: 1,
          width: 22, height: 22, borderRadius: 99,
          background: 'var(--aura-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'white', fontWeight: 700,
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        }}>ψ</div>
        <div style={{
          fontSize: 12.5, lineHeight: 1.4,
          color: 'color-mix(in oklab, var(--aura-ink) 78%, transparent)',
          textWrap: 'pretty',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--aura-ink)' }}>Grounded in psychology. </span>
          Built on frameworks from attachment theory, self-compassion research, and
          communication science — developed in consultation with practising psychologists
          and therapists.
        </div>
      </div>

      {/* disclaimer */}
      <div style={{
        marginTop: 'auto', paddingTop: 22,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10.5, lineHeight: 1.45,
        color: 'color-mix(in oklab, var(--aura-ink) 50%, transparent)',
        borderTop: '1px dashed color-mix(in oklab, var(--aura-ink) 15%, transparent)',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--aura-ink)' }}>heads up </span>
        for self-awareness, not a clinical assessment. If you’re struggling, please reach out to a professional.
      </div>
    </Screen>
  );
}
window.LandingScreen = LandingScreen;

// ═══ QUIZ ═══════════════════════════════════════════════════════════
function QuizScreen({ onComplete, lang, progressStyle }) {
  const qs = window.AURA_QUESTIONS;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [transitioning, setTransitioning] = useState(false);
  const q = qs[idx];
  const dim = window.AURA_DIMENSIONS.find((d) => d.key === q.dim);

  function pick(opt, optIdx) {
    if (transitioning) return;
    const next = { ...answers, [q.id]: { score: opt.score, dim: q.dim, optIdx } };
    setAnswers(next);
    setTransitioning(true);
    setTimeout(() => {
      if (idx === qs.length - 1) {
        // tally
        const scores = { SR: 0, RB: 0, CS: 0 };
        for (const a of Object.values(next)) scores[a.dim] += a.score;
        onComplete(scores, next);
      } else {
        setIdx((i) => i + 1);
        setTransitioning(false);
      }
    }, 280);
  }

  function back() {
    if (idx === 0 || transitioning) return;
    setIdx((i) => i - 1);
  }

  return (
    <Screen style={{ background: 'var(--aura-bg)' }}>
      {/* top: progress + back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={back}
          disabled={idx === 0}
          style={{
            appearance: 'none', border: 'none', background: 'transparent',
            cursor: idx === 0 ? 'default' : 'pointer', padding: 0,
            color: 'var(--aura-ink)', opacity: idx === 0 ? 0.25 : 1,
            display: 'flex', alignItems: 'center',
          }}
        >
          <AuraIcon name="arrow-left" size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <AuraProgress current={idx + 1} total={qs.length} style={progressStyle} />
        </div>
      </div>

      {/* dimension tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 99,
          background: `oklch(0.65 0.22 ${dim.hue})`,
        }} />
        <span style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")',
          fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700,
          color: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
        }}>
          {q.scene[lang]} · q{idx + 1}
        </span>
      </div>

      <div
        key={q.id}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity .25s, transform .25s',
        }}
      >
        {/* per-question animated scene */}
        <div style={{ marginBottom: 18 }}>
          <AuraScene qid={q.id} sceneLabel={q.scene[lang]} />
        </div>

        <h2 style={{
          fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 26,
          lineHeight: 1.18, letterSpacing: '-0.02em',
          color: 'var(--aura-ink)', margin: 0, textWrap: 'pretty',
        }}>
          {q.prompt[lang]}
        </h2>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt, i) => {
            const letter = 'ABCD'[i];
            return (
              <button
                key={i}
                onClick={() => pick(opt, i)}
                style={{
                  appearance: 'none', cursor: 'pointer',
                  textAlign: 'left',
                  background: 'var(--aura-chip, white)',
                  border: '1.5px solid color-mix(in oklab, var(--aura-ink) 10%, transparent)',
                  borderRadius: 18, padding: '16px 16px 16px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontFamily: 'var(--aura-display)', fontWeight: 500, fontSize: 16,
                  lineHeight: 1.25, color: 'var(--aura-ink)',
                  transition: 'all .12s ease',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = '')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--aura-ink) 80%, transparent)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--aura-ink) 10%, transparent)';
                }}
              >
                <span style={{
                  flex: '0 0 auto',
                  width: 28, height: 28, borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
                  fontFamily: 'var(--aura-mono, "JetBrains Mono")',
                  fontSize: 11, fontWeight: 700,
                  color: 'color-mix(in oklab, var(--aura-ink) 70%, transparent)',
                }}>{letter}</span>
                <span style={{ flex: 1 }}>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Clarity feedback — user-testing hook */}
        <ClarityFeedback qid={q.id} />
      </div>
    </Screen>
  );
}
window.QuizScreen = QuizScreen;

// ── Tiny clarity-feedback row, flagged for user testing ──────────
function ClarityFeedback({ qid }) {
  const [state, setState] = useState(null); // null | 'clear' | 'unclear'
  React.useEffect(() => { setState(null); }, [qid]);
  if (state) {
    return (
      <div style={{
        marginTop: 18,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        textAlign: 'center',
      }}>
        {state === 'clear' ? 'thanks · noted' : 'flagged — we’ll rephrase this one'}
      </div>
    );
  }
  return (
    <div style={{
      marginTop: 18, paddingTop: 14,
      borderTop: '1px dashed color-mix(in oklab, var(--aura-ink) 14%, transparent)',
      display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
      fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
      letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700,
      color: 'color-mix(in oklab, var(--aura-ink) 45%, transparent)',
      flexWrap: 'wrap',
    }}>
      <span>was this clear?</span>
      <button
        onClick={() => setState('clear')}
        style={{
          appearance: 'none', border: '1px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
          background: 'transparent', borderRadius: 99, padding: '4px 10px',
          fontFamily: 'inherit', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
          fontWeight: 700, color: 'inherit', cursor: 'pointer',
        }}
      >yes</button>
      <button
        onClick={() => setState('unclear')}
        style={{
          appearance: 'none', border: '1px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
          background: 'transparent', borderRadius: 99, padding: '4px 10px',
          fontFamily: 'inherit', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
          fontWeight: 700, color: 'inherit', cursor: 'pointer',
        }}
      >had to reread</button>
    </div>
  );
}
window.ClarityFeedback = ClarityFeedback;

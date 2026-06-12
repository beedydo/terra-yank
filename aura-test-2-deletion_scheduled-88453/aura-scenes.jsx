// AURA scenes — per-question animated vignette.
// A small "aura" blob character drifts through a scene that hints at the question's context.
// Pure CSS / SVG animation (no GIFs, no external assets) — feels alive on every question.

const { useEffect: useEffectS } = React;

// ── Inject scene CSS once ───────────────────────────────────────────
(function injectAuraSceneCSS() {
  if (document.getElementById('aura-scene-css')) return;
  const css = `
    .aurascene {
      position: relative;
      width: 100%;
      height: 140px;
      border-radius: 22px;
      overflow: hidden;
      isolation: isolate;
      background:
        linear-gradient(180deg,
          color-mix(in oklab, var(--aura-ink) 4%, transparent) 0%,
          color-mix(in oklab, var(--aura-ink) 8%, transparent) 100%);
      border: 1px solid color-mix(in oklab, var(--aura-ink) 8%, transparent);
    }

    /* The aura blob */
    .aurascene .aura {
      position: absolute;
      width: 56px; height: 56px;
      border-radius: 50% 50% 48% 52% / 56% 52% 48% 44%;
      background: var(--aura-grad, radial-gradient(circle at 30% 25%, #ffd1a8, #f07b5b 60%, #a23b6b 110%));
      box-shadow:
        0 12px 30px -8px color-mix(in oklab, var(--aura-accent) 50%, transparent),
        inset -6px -8px 14px rgba(0,0,0,0.12),
        inset 6px 6px 14px rgba(255,255,255,0.25);
      animation: aurascene-morph 5s ease-in-out infinite;
      z-index: 3;
    }
    .aurascene .aura::before,
    .aurascene .aura::after {
      content: '';
      position: absolute;
      top: 36%; width: 7px; height: 9px;
      border-radius: 50%; background: #1B1410;
    }
    .aurascene .aura::before { left: 30%; animation: aurascene-blink 4.2s infinite; }
    .aurascene .aura::after  { right: 30%; animation: aurascene-blink 4.2s 0.15s infinite; }

    /* "Trail" puffs behind the aura */
    .aurascene .trail {
      position: absolute;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--aura-grad);
      filter: blur(6px);
      opacity: 0.45;
      z-index: 2;
      pointer-events: none;
    }

    /* ─── Generic morph + blink ─── */
    @keyframes aurascene-morph {
      0%, 100% { border-radius: 50% 50% 48% 52% / 56% 52% 48% 44%; transform: rotate(0deg) translateY(0); }
      33%      { border-radius: 56% 44% 60% 40% / 48% 60% 40% 52%; transform: rotate(2deg)  translateY(-2px); }
      66%      { border-radius: 44% 56% 40% 60% / 60% 40% 60% 40%; transform: rotate(-2deg) translateY(2px); }
    }
    @keyframes aurascene-blink {
      0%, 92%, 100% { transform: scaleY(1); }
      94%, 98%      { transform: scaleY(0.1); }
    }
    @keyframes aurascene-bob {
      0%, 100% { transform: translateY(0px); }
      50%      { transform: translateY(-6px); }
    }

    /* ─── Per-scene movements ─── */
    @keyframes aurascene-drift-rl {
      0%   { left: 88%; top: 30%; }
      50%  { left: 12%; top: 55%; }
      100% { left: 88%; top: 30%; }
    }
    @keyframes aurascene-drift-lr {
      0%   { left: 8%; top: 50%; }
      50%  { left: 78%; top: 18%; }
      100% { left: 8%; top: 50%; }
    }
    @keyframes aurascene-orbit {
      0%   { transform: translate(-50%, -50%) rotate(0deg) translateX(48px) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg) translateX(48px) rotate(-360deg); }
    }
    @keyframes aurascene-vert {
      0%, 100% { top: 18%; }
      50%      { top: 60%; }
    }
    @keyframes aurascene-shake {
      0%, 100% { transform: translate(0, 0) rotate(0); }
      20% { transform: translate(-4px, 2px) rotate(-3deg); }
      40% { transform: translate(5px, -1px) rotate(4deg); }
      60% { transform: translate(-3px, 3px) rotate(-2deg); }
      80% { transform: translate(4px, -2px) rotate(3deg); }
    }
    @keyframes aurascene-ping {
      0%   { transform: scale(1); opacity: 0.6; }
      80%  { transform: scale(2.4); opacity: 0; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    @keyframes aurascene-typing {
      0%, 100% { opacity: 0.3; transform: translateY(0); }
      50%      { opacity: 1;   transform: translateY(-3px); }
    }
    @keyframes aurascene-flicker {
      0%, 100% { opacity: 0.9; }
      50%      { opacity: 0.4; }
    }
    @keyframes aurascene-pop {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes aurascene-rise-fade {
      0%   { transform: translateY(0); opacity: 0; }
      30%  { opacity: 0.9; }
      100% { transform: translateY(-30px); opacity: 0; }
    }
    @keyframes aurascene-spin-slow {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes aurascene-glow {
      0%, 100% { filter: brightness(1); }
      50%      { filter: brightness(1.35) saturate(1.2); }
    }

    /* Tiny element helpers */
    .aurascene .stage-bg {
      position: absolute; inset: 0; z-index: 1;
    }
    .aurascene .lbl {
      position: absolute; bottom: 8px; left: 12px;
      font-family: var(--aura-mono, "JetBrains Mono");
      font-size: 9px; letter-spacing: .18em; text-transform: uppercase; font-weight: 700;
      color: color-mix(in oklab, var(--aura-ink) 50%, transparent);
      z-index: 4;
    }
  `;
  const el = document.createElement('style');
  el.id = 'aura-scene-css';
  el.textContent = css;
  document.head.appendChild(el);
})();

// ── Small primitive: dot/icon background helpers ────────────────────
const Dot = ({ left, top, size = 6, color = 'var(--aura-ink)', op = 0.18, anim, style = {} }) => (
  <span style={{
    position: 'absolute', left, top, width: size, height: size, borderRadius: 99,
    background: color, opacity: op, animation: anim, ...style,
  }} />
);

const Box = ({ left, top, w, h, r = 6, op = 0.12, anim, style = {} }) => (
  <span style={{
    position: 'absolute', left, top, width: w, height: h, borderRadius: r,
    background: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
    opacity: op, animation: anim, ...style,
  }} />
);

// ── The aura blob itself (positioned by parent via style/animation) ─
function AuraBlob({ style, size = 56 }) {
  return <div className="aura" style={{ width: size, height: size, ...style }} />;
}

// ── Per-question scenes ────────────────────────────────────────────
// Each function returns a JSX scene. Designed for 140px tall band.

function SceneCNYDinner() {
  // Round table with bowls; aura bobs above table, sometimes "shrinking" when auntie speaks
  return (
    <>
      {/* table */}
      <span style={{
        position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)',
        width: 220, height: 28, borderRadius: '50%',
        background: 'color-mix(in oklab, var(--aura-accent) 30%, transparent)',
        boxShadow: '0 8px 18px -6px color-mix(in oklab, var(--aura-accent) 50%, transparent)',
      }} />
      {/* bowls */}
      {[30, 90, 150].map((x, i) => (
        <Box key={i} left={`calc(50% - 110px + ${x}px)`} top="auto" w={28} h={10} r={99}
          style={{ bottom: 28, background: 'var(--aura-ink)', opacity: 0.25 }} />
      ))}
      {/* steam */}
      <Dot left="38%" top="60%" size={6} op={0.35} anim="aurascene-rise-fade 2.4s infinite" />
      <Dot left="55%" top="65%" size={5} op={0.35} anim="aurascene-rise-fade 2.4s 0.4s infinite" />
      <Dot left="68%" top="60%" size={6} op={0.35} anim="aurascene-rise-fade 2.4s 0.8s infinite" />
      {/* aura bobbing above */}
      <AuraBlob size={50} style={{
        left: 'calc(50% - 25px)', top: 22,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneMirror() {
  // Mirror frame + reflected aura
  return (
    <>
      {/* mirror frame */}
      <span style={{
        position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)',
        width: 110, height: 110, borderRadius: 99,
        border: '4px solid color-mix(in oklab, var(--aura-ink) 22%, transparent)',
        background: 'color-mix(in oklab, var(--aura-bg) 80%, white)',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.05)',
      }} />
      {/* shine */}
      <span style={{
        position: 'absolute', left: 'calc(50% - 36px)', top: 30, width: 24, height: 32,
        borderRadius: '50%', background: 'white', opacity: 0.45, filter: 'blur(2px)',
      }} />
      {/* aura inside */}
      <AuraBlob size={62} style={{
        left: 'calc(50% - 31px)', top: 42,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 4s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneIGScroll() {
  // Phone with a scrolling "feed" + aura peeking over top
  return (
    <>
      {/* phone */}
      <span style={{
        position: 'absolute', left: '50%', top: 20, transform: 'translateX(-50%)',
        width: 86, height: 110, borderRadius: 14,
        background: 'oklch(0.18 0.02 280)',
        boxShadow: '0 10px 24px -6px rgba(0,0,0,0.25)',
      }} />
      {/* screen */}
      <span style={{
        position: 'absolute', left: 'calc(50% - 36px)', top: 26, width: 72, height: 96,
        borderRadius: 8, background: 'oklch(0.96 0.01 90)', overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 200,
          animation: 'aurascene-vert 4s ease-in-out infinite',
        }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              position: 'absolute', left: 6, right: 6, top: 6 + i * 42, height: 36,
              borderRadius: 4,
              background: i % 2 ? 'color-mix(in oklab, var(--aura-accent) 35%, transparent)'
                                : 'color-mix(in oklab, var(--aura-ink) 14%, transparent)',
            }} />
          ))}
        </span>
      </span>
      {/* heart pings */}
      <span style={{
        position: 'absolute', left: 'calc(50% + 18px)', top: 36, width: 8, height: 8,
        borderRadius: 99, background: '#e84a6b',
        animation: 'aurascene-ping 1.8s infinite',
      }} />
      {/* aura peeking over phone */}
      <AuraBlob size={36} style={{
        left: 'calc(50% - 50px)', top: 6,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 2.6s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneStandup() {
  // Bar chart + slides + aura shrinking
  return (
    <>
      {/* screen */}
      <span style={{
        position: 'absolute', left: 18, top: 18, width: 130, height: 96, borderRadius: 10,
        background: 'oklch(0.96 0.01 90)',
        border: '2px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
      }}>
        {[28, 50, 36, 62, 44].map((h, i) => (
          <span key={i} style={{
            position: 'absolute', left: 10 + i * 22, bottom: 8, width: 14, height: h,
            background: i === 2 ? 'var(--aura-accent)' : 'color-mix(in oklab, var(--aura-ink) 28%, transparent)',
            borderRadius: 2, animation: i === 2 ? 'aurascene-flicker 1.4s infinite' : 'none',
          }} />
        ))}
      </span>
      {/* speech bubble */}
      <span style={{
        position: 'absolute', right: 30, top: 30, padding: '4px 8px',
        background: 'white', borderRadius: 10,
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        color: 'color-mix(in oklab, var(--aura-ink) 70%, transparent)', fontWeight: 700,
        animation: 'aurascene-flicker 1.6s infinite',
      }}>…</span>
      {/* aura small + nervy */}
      <AuraBlob size={36} style={{
        right: 36, bottom: 18,
        animation: 'aurascene-morph 3s ease-in-out infinite, aurascene-shake 2.4s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneDateCancel() {
  // Chat bubble appearing, aura recoiling
  return (
    <>
      {/* incoming bubble */}
      <span style={{
        position: 'absolute', left: 24, top: 30,
        padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
        background: 'white',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 14%, transparent)',
        boxShadow: '0 6px 14px -6px rgba(0,0,0,0.15)',
        animation: 'aurascene-pop 0.6s 0.3s both, aurascene-flicker 3s 1s infinite',
      }}>
        <span style={{
          fontFamily: 'var(--aura-display)', fontSize: 11, fontWeight: 600,
          color: 'color-mix(in oklab, var(--aura-ink) 80%, transparent)',
        }}>can't make it sorry 😞</span>
      </span>
      {/* timestamp */}
      <span style={{
        position: 'absolute', left: 26, top: 64,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 8,
        color: 'color-mix(in oklab, var(--aura-ink) 40%, transparent)', fontWeight: 700,
      }}>2 hrs before</span>
      {/* aura, slightly off-balance */}
      <AuraBlob size={50} style={{
        right: 28, top: 36,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-shake 6s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneBrunch() {
  // Coffee cup + friend bubble; aura tilts as if listening
  return (
    <>
      {/* cup */}
      <span style={{
        position: 'absolute', left: 30, bottom: 16,
        width: 44, height: 30, borderRadius: '0 0 14px 14px',
        background: 'white',
        border: '2px solid color-mix(in oklab, var(--aura-ink) 22%, transparent)',
      }} />
      <Dot left={50} top={48} size={6} op={0.35} anim="aurascene-rise-fade 2.4s infinite" />
      <Dot left={56} top={52} size={5} op={0.35} anim="aurascene-rise-fade 2.4s 0.4s infinite" />
      {/* friend speech */}
      <span style={{
        position: 'absolute', right: 24, top: 30,
        padding: '6px 10px', borderRadius: '12px 12px 4px 12px',
        background: 'color-mix(in oklab, var(--aura-accent) 30%, transparent)',
        fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        fontSize: 12, color: 'var(--aura-ink)',
      }}>"you'll find someone lah"</span>
      {/* aura, listening */}
      <AuraBlob size={44} style={{
        right: 38, bottom: 16,
        animation: 'aurascene-morph 6s ease-in-out infinite, aurascene-bob 3.5s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneHawker() {
  // Two old-couple silhouettes + low neon sign; aura drifts past behind
  return (
    <>
      {/* table */}
      <span style={{
        position: 'absolute', left: 30, right: 30, bottom: 14, height: 8,
        background: 'color-mix(in oklab, var(--aura-ink) 22%, transparent)', borderRadius: 4,
      }} />
      {/* two heads */}
      <span style={{
        position: 'absolute', left: 60, bottom: 22, width: 26, height: 30, borderRadius: '14px 14px 4px 4px',
        background: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
      }} />
      <span style={{
        position: 'absolute', right: 60, bottom: 22, width: 26, height: 30, borderRadius: '14px 14px 4px 4px',
        background: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
      }} />
      {/* neon "kopi" sign */}
      <span style={{
        position: 'absolute', left: 14, top: 14, padding: '4px 8px',
        border: '1.5px solid var(--aura-accent)', borderRadius: 6,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        color: 'var(--aura-accent)', fontWeight: 800, letterSpacing: '.16em',
        textShadow: '0 0 6px var(--aura-accent)',
        animation: 'aurascene-flicker 2.2s infinite',
      }}>KOPI</span>
      {/* aura drifting */}
      <AuraBlob size={40} style={{
        top: 30,
        animation: 'aurascene-drift-lr 8s ease-in-out infinite, aurascene-morph 5s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneTinderMatch() {
  // Two cards stacking with hearts; aura between
  return (
    <>
      <span style={{
        position: 'absolute', left: 30, top: 24, width: 56, height: 80, borderRadius: 10,
        background: 'color-mix(in oklab, var(--aura-accent) 35%, transparent)',
        transform: 'rotate(-8deg)', boxShadow: '0 6px 14px -6px rgba(0,0,0,0.15)',
      }} />
      <span style={{
        position: 'absolute', right: 30, top: 24, width: 56, height: 80, borderRadius: 10,
        background: 'color-mix(in oklab, var(--aura-ink) 22%, transparent)',
        transform: 'rotate(8deg)', boxShadow: '0 6px 14px -6px rgba(0,0,0,0.15)',
      }} />
      {/* heart */}
      <span style={{
        position: 'absolute', left: '50%', top: 36, transform: 'translateX(-50%)',
        width: 22, height: 22, color: '#e84a6b', fontSize: 18, lineHeight: 1,
        animation: 'aurascene-ping 1.6s infinite',
      }}>♥</span>
      {/* aura center */}
      <AuraBlob size={48} style={{
        left: 'calc(50% - 24px)', top: 60,
        animation: 'aurascene-morph 4s ease-in-out infinite, aurascene-bob 2.8s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneBirthday() {
  // Cake with candles + flames flickering; aura watches
  return (
    <>
      {/* cake */}
      <span style={{
        position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)',
        width: 110, height: 40, borderRadius: 8,
        background: 'color-mix(in oklab, var(--aura-accent) 40%, transparent)',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 22%, transparent)',
      }} />
      {/* candles */}
      {[0, 1, 2, 3].map((i) => (
        <React.Fragment key={i}>
          <span style={{
            position: 'absolute', left: `calc(50% - 40px + ${i * 26}px)`, bottom: 54,
            width: 3, height: 16, background: 'var(--aura-ink)', opacity: 0.6, borderRadius: 1,
          }} />
          <span style={{
            position: 'absolute', left: `calc(50% - 41px + ${i * 26}px)`, bottom: 70,
            width: 5, height: 8, borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
            background: 'radial-gradient(circle, #ffe66c, #ff8c3a 70%)',
            animation: `aurascene-flicker ${1 + i * 0.2}s infinite`,
          }} />
        </React.Fragment>
      ))}
      {/* aura watching */}
      <AuraBlob size={36} style={{
        right: 14, top: 14,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneNextStep() {
  // Two front doors / paths converging; aura at the fork
  return (
    <>
      {/* path 1 */}
      <span style={{
        position: 'absolute', left: 20, bottom: 14, width: 44, height: 70, borderRadius: '8px 8px 0 0',
        background: 'color-mix(in oklab, var(--aura-accent) 35%, transparent)',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 22%, transparent)',
      }} />
      <span style={{ position: 'absolute', left: 56, bottom: 40, width: 4, height: 4, borderRadius: 99, background: 'var(--aura-ink)', opacity: 0.6 }} />
      {/* path 2 */}
      <span style={{
        position: 'absolute', right: 20, bottom: 14, width: 44, height: 70, borderRadius: '8px 8px 0 0',
        background: 'color-mix(in oklab, var(--aura-ink) 20%, transparent)',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 22%, transparent)',
      }} />
      <span style={{ position: 'absolute', right: 56, bottom: 40, width: 4, height: 4, borderRadius: 99, background: 'var(--aura-ink)', opacity: 0.6 }} />
      {/* arrow showing forward */}
      <span style={{
        position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        fontSize: 14, color: 'var(--aura-accent)', fontWeight: 600,
      }}>next?</span>
      {/* aura between */}
      <AuraBlob size={44} style={{
        left: 'calc(50% - 22px)', top: 18,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneFriendFeedback() {
  // Two speech bubbles facing
  return (
    <>
      <span style={{
        position: 'absolute', left: 18, top: 24, padding: '8px 10px',
        borderRadius: '12px 12px 12px 4px',
        background: 'color-mix(in oklab, var(--aura-accent) 30%, transparent)',
        fontFamily: 'var(--aura-display)', fontSize: 11, fontWeight: 600,
        color: 'var(--aura-ink)', maxWidth: 130,
      }}>"you come across cold"</span>
      <span style={{
        position: 'absolute', right: 18, bottom: 18, padding: '8px 10px',
        borderRadius: '12px 12px 4px 12px',
        background: 'white',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 16%, transparent)',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10, fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
      }}>…</span>
      <AuraBlob size={36} style={{
        right: 28, top: 14,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneTextsDry() {
  // Phone with dots typing then... nothing
  return (
    <>
      <span style={{
        position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)',
        width: 86, height: 108, borderRadius: 14,
        background: 'oklch(0.18 0.02 280)',
        boxShadow: '0 10px 24px -6px rgba(0,0,0,0.25)',
      }} />
      <span style={{
        position: 'absolute', left: 'calc(50% - 36px)', top: 22, width: 72, height: 94,
        borderRadius: 8, background: 'oklch(0.96 0.01 90)',
      }} />
      {/* sent bubble */}
      <span style={{
        position: 'absolute', left: 'calc(50% + 4px)', top: 36, width: 28, height: 12, borderRadius: 8,
        background: 'var(--aura-accent)',
      }} />
      <span style={{
        position: 'absolute', left: 'calc(50% + 10px)', top: 54, width: 22, height: 10, borderRadius: 8,
        background: 'var(--aura-accent)', opacity: 0.6,
      }} />
      {/* typing dots */}
      <span style={{
        position: 'absolute', left: 'calc(50% - 30px)', top: 78, width: 28, height: 12, borderRadius: 8,
        background: 'color-mix(in oklab, var(--aura-ink) 14%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 3, height: 3, borderRadius: 99, background: 'var(--aura-ink)', opacity: 0.5,
            animation: `aurascene-typing 1.4s ${i * 0.2}s infinite`,
          }} />
        ))}
      </span>
      {/* aura waiting */}
      <AuraBlob size={38} style={{
        right: 18, bottom: 16,
        animation: 'aurascene-morph 6s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneGCFight() {
  // Three bubbles overlapping with sparks
  return (
    <>
      {[{ l: 18, t: 22, c: 'var(--aura-accent)' },
        { l: 56, t: 56, c: 'color-mix(in oklab, var(--aura-ink) 22%, transparent)' },
        { l: 100, t: 28, c: 'color-mix(in oklab, var(--aura-accent) 40%, transparent)' }].map((b, i) => (
        <span key={i} style={{
          position: 'absolute', left: b.l, top: b.t, padding: '6px 10px',
          borderRadius: 12, background: b.c,
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10, fontWeight: 700,
          color: 'var(--aura-ink)',
          animation: `aurascene-flicker ${1.2 + i * 0.2}s ${i * 0.15}s infinite`,
        }}>!!!</span>
      ))}
      {/* spark */}
      <span style={{
        position: 'absolute', right: 60, top: 50,
        fontSize: 22, color: 'var(--aura-accent)',
        animation: 'aurascene-ping 1.4s infinite',
      }}>✦</span>
      <AuraBlob size={36} style={{
        right: 18, bottom: 16,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-shake 4s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneYouOkay() {
  // Two auras facing each other; one says "you ok?"
  return (
    <>
      <span style={{
        position: 'absolute', left: '50%', top: 30, transform: 'translateX(-50%)',
        padding: '6px 12px', borderRadius: 14, background: 'white',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
        fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
        fontSize: 13, color: 'var(--aura-ink)',
      }}>"you ok anot?"</span>
      <AuraBlob size={44} style={{
        left: 30, bottom: 16,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3.2s ease-in-out infinite',
      }} />
      {/* second aura (muted) */}
      <span style={{
        position: 'absolute', right: 30, bottom: 16,
        width: 44, height: 44, borderRadius: '50%',
        background: 'color-mix(in oklab, var(--aura-ink) 35%, transparent)',
        animation: 'aurascene-morph 5s 1s ease-in-out infinite',
      }} />
    </>
  );
}

function SceneHardCall() {
  // Two paths diverging; aura at the fork
  return (
    <>
      <svg viewBox="0 0 240 120" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M 120 110 Q 120 60 60 20" fill="none" stroke="currentColor"
          strokeOpacity="0.25" strokeWidth="2" strokeDasharray="4 4"
          style={{ color: 'var(--aura-ink)' }} />
        <path d="M 120 110 Q 120 60 180 20" fill="none" stroke="currentColor"
          strokeOpacity="0.25" strokeWidth="2" strokeDasharray="4 4"
          style={{ color: 'var(--aura-ink)' }} />
      </svg>
      <span style={{
        position: 'absolute', left: 28, top: 8,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9, fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
      }}>say it</span>
      <span style={{
        position: 'absolute', right: 22, top: 8,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9, fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
      }}>stay quiet</span>
      <AuraBlob size={44} style={{
        left: 'calc(50% - 22px)', bottom: 14,
        animation: 'aurascene-morph 5s ease-in-out infinite, aurascene-bob 3s ease-in-out infinite',
      }} />
    </>
  );
}

// ── Scene registry, keyed by question id ────────────────────────────
const AURA_SCENE_MAP = {
  q1:  SceneCNYDinner,
  q2:  SceneMirror,
  q3:  SceneIGScroll,
  q4:  SceneStandup,
  q5:  SceneDateCancel,
  q6:  SceneBrunch,
  q7:  SceneHawker,
  q8:  SceneTinderMatch,
  q9:  SceneBirthday,
  q10: SceneNextStep,
  q11: SceneFriendFeedback,
  q12: SceneTextsDry,
  q13: SceneGCFight,
  q14: SceneYouOkay,
  q15: SceneHardCall,
};

function AuraScene({ qid, sceneLabel }) {
  const Scene = AURA_SCENE_MAP[qid] || SceneBrunch;
  return (
    <div className="aurascene" key={qid}>
      <div className="stage-bg" />
      <Scene />
      {sceneLabel ? <div className="lbl">{sceneLabel}</div> : null}
    </div>
  );
}

window.AuraScene = AuraScene;

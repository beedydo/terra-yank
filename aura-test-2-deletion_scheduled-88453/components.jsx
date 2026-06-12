// AURA shared UI: theme, sticker shapes (CSS-only), buttons, progress.
// All in vanilla CSS/HTML — no SVG illustrations.

const AURA_PALETTES = {
  sunset: {
    name: 'Sunset',
    bg: '#FFF1E7',
    fg: '#1B1410',
    ink: '#2A1B14',
    accent: '#FF5A3C',
    accent2: '#FF8A2B',
    soft: '#FFDAB9',
    chip: '#FFFFFF',
    gradient: 'radial-gradient(120% 80% at 20% 0%, #FFC6A8 0%, #FF8A6B 40%, #FF5A3C 70%, #B8267A 100%)',
  },
  matcha: {
    name: 'Matcha',
    bg: '#F4F6E8',
    fg: '#13261A',
    ink: '#1A2E20',
    accent: '#3FA66A',
    accent2: '#9BD93C',
    soft: '#D9EFC2',
    chip: '#FFFFFF',
    gradient: 'radial-gradient(120% 80% at 20% 0%, #DDF6A8 0%, #9BD93C 40%, #3FA66A 75%, #155E47 100%)',
  },
  lilac: {
    name: 'Lilac',
    bg: '#F2EDFB',
    fg: '#160E2A',
    ink: '#1F1438',
    accent: '#8B5CF6',
    accent2: '#EC4899',
    soft: '#DFD0FF',
    chip: '#FFFFFF',
    gradient: 'radial-gradient(120% 80% at 20% 0%, #E0CCFF 0%, #B47AFF 40%, #8B5CF6 70%, #4F1E9A 100%)',
  },
};
window.AURA_PALETTES = AURA_PALETTES;

// ─── tiny icon set (inline SVG, stroke-based, no fancy art) ────────
const AuraIcon = ({ name, size = 18, color = 'currentColor', strokeWidth = 2 }) => {
  const sw = strokeWidth;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'arrow-right': return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-left':  return <svg {...common}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>;
    case 'sparkle':     return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg>;
    case 'share':       return <svg {...common}><path d="M12 3v13M7 8l5-5 5 5M5 17v3a1 1 0 001 1h12a1 1 0 001-1v-3"/></svg>;
    case 'retry':       return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/></svg>;
    case 'check':       return <svg {...common}><path d="M5 12l5 5L20 7"/></svg>;
    case 'dots':        return <svg {...common}><circle cx="6"  cy="12" r="1.3" fill={color}/><circle cx="12" cy="12" r="1.3" fill={color}/><circle cx="18" cy="12" r="1.3" fill={color}/></svg>;
    case 'heart':       return <svg {...common}><path d="M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z"/></svg>;
    default: return null;
  }
};
window.AuraIcon = AuraIcon;

// ─── Big chunky button ──────────────────────────────────────────────
function AuraButton({ children, onClick, variant = 'primary', icon, iconRight, disabled, full = true, style = {} }) {
  const base = {
    appearance: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--aura-display, "Bricolage Grotesque")', fontWeight: 700,
    fontSize: 18, lineHeight: 1, letterSpacing: '-0.01em',
    padding: '20px 24px', borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: full ? '100%' : 'auto',
    transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
    opacity: disabled ? 0.4 : 1,
  };
  const variants = {
    primary: {
      background: 'var(--aura-ink)', color: 'var(--aura-bg)',
      boxShadow: '0 2px 0 0 rgba(0,0,0,0.0), 0 8px 24px -8px rgba(0,0,0,0.25)',
    },
    ghost: {
      background: 'transparent', color: 'var(--aura-ink)',
      border: '1.5px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
    },
    accent: {
      background: 'var(--aura-accent)', color: 'white',
      boxShadow: '0 12px 30px -10px var(--aura-accent)',
    },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      {icon && <AuraIcon name={icon} size={18} />}
      <span>{children}</span>
      {iconRight && <AuraIcon name={iconRight} size={18} />}
    </button>
  );
}
window.AuraButton = AuraButton;

// ─── Progress: 3 styles ─────────────────────────────────────────────
function AuraProgress({ current, total, style = 'meter' }) {
  const pct = Math.max(0, Math.min(100, ((current) / total) * 100));
  if (style === 'bar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          flex: 1, height: 8, borderRadius: 99, background: 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 99,
            background: 'var(--aura-grad)',
            transition: 'width .5s cubic-bezier(.2,.7,.2,1)',
          }} />
        </div>
        <div style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 11,
          color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
          fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right',
        }}>
          {current}/{total}
        </div>
      </div>
    );
  }
  if (style === 'dots') {
    return (
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < current;
          return (
            <div key={i} style={{
              width: filled ? 14 : 8, height: 8, borderRadius: 99,
              background: filled ? 'var(--aura-accent)' : 'color-mix(in oklab, var(--aura-ink) 14%, transparent)',
              transition: 'all .3s cubic-bezier(.2,.7,.2,1)',
            }} />
          );
        })}
      </div>
    );
  }
  // 'meter' — circular aura ring
  const r = 16, c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <defs>
            <linearGradient id="aura-grad-meter" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--aura-accent2)" />
              <stop offset="100%" stopColor="var(--aura-accent)" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r={r} fill="none" stroke="color-mix(in oklab, var(--aura-ink) 10%, transparent)" strokeWidth="4"/>
          <circle cx="20" cy="20" r={r} fill="none" stroke="url(#aura-grad-meter)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (pct/100)*c}
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.7,.2,1)' }}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10, fontWeight: 600,
          color: 'var(--aura-ink)', fontVariantNumeric: 'tabular-nums',
        }}>{current}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)' }}>aura</div>
        <div style={{ fontFamily: 'var(--aura-display)', fontSize: 14, fontWeight: 600, lineHeight: 1.1,
          color: 'var(--aura-ink)' }}>building…</div>
      </div>
    </div>
  );
}
window.AuraProgress = AuraProgress;

// ─── Sticker: aura halo + SG-food illustration ──────────────────────
function AuraSticker({ archetype, size = 220 }) {
  const a = archetype;
  const hue = a.hue;
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* soft aura halo */}
      <div style={{
        position: 'absolute', inset: '-6%', borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%,
          oklch(0.88 0.22 ${hue} / 0.75),
          oklch(0.62 0.26 ${hue} / 0.5) 50%,
          oklch(0.4 0.2 ${(hue + 40) % 360} / 0) 75%)`,
        filter: 'blur(10px)',
      }} />
      {/* coloured disc */}
      <div style={{
        position: 'absolute', inset: '8%', borderRadius: '50%',
        background: `radial-gradient(circle at 30% 25%,
          oklch(0.95 0.04 ${hue}),
          oklch(0.85 0.1 ${hue}) 55%,
          oklch(0.62 0.22 ${hue}) 100%)`,
        boxShadow: `0 24px 60px -14px oklch(0.5 0.24 ${hue} / 0.55),
          inset 0 -8px 18px oklch(0.4 0.18 ${hue} / 0.25),
          inset 0 4px 8px rgba(255,255,255,0.5)`,
      }} />
      {/* inner sticker face */}
      <div style={{
        position: 'absolute', inset: '14%', borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%,
          oklch(0.99 0.02 ${hue}),
          oklch(0.94 0.06 ${hue}) 80%)`,
        boxShadow: 'inset 2px 4px 10px rgba(0,0,0,0.05)',
      }} />
      {/* food illustration */}
      <div style={{
        position: 'relative', width: '78%', height: '78%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))',
      }}>
        <AuraFoodIcon id={a.id} size={size * 0.78} />
      </div>
      {/* sparkles */}
      <div style={{
        position: 'absolute', top: '4%', right: '10%', color: 'white',
        fontFamily: 'var(--aura-display)', fontWeight: 700,
        fontSize: Math.max(10, size * 0.09), opacity: 0.9,
        textShadow: `0 2px 8px oklch(0.55 0.22 ${hue} / 0.6)`,
      }}>✦</div>
      <div style={{
        position: 'absolute', bottom: '6%', left: '6%', color: 'white',
        fontFamily: 'var(--aura-display)', fontWeight: 700,
        fontSize: Math.max(8, size * 0.06), opacity: 0.8,
        textShadow: `0 2px 6px oklch(0.55 0.22 ${hue} / 0.5)`,
      }}>✦</div>
    </div>
  );
}
window.AuraSticker = AuraSticker;

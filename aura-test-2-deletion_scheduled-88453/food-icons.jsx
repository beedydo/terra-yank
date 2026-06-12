// AURA food icons — kawaii SG foods with little faces.
// Each takes size (rendered pixels); viewBox is 200×200.

function CuteFace({ cx, cy, size = 50, dark = false, blush = '#ff7a9a', mouth = 'smile' }) {
  // size = approx face diameter in viewBox units
  const r = size / 2;
  const ink = dark ? '#fff' : '#1c0a08';
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* blush */}
      <ellipse cx={-r * 0.58} cy={r * 0.18} rx={r * 0.3} ry={r * 0.18} fill={blush} opacity="0.6" />
      <ellipse cx={r * 0.58}  cy={r * 0.18} rx={r * 0.3} ry={r * 0.18} fill={blush} opacity="0.6" />
      {/* eyes */}
      <ellipse cx={-r * 0.34} cy={-r * 0.08} rx={r * 0.14} ry={r * 0.19} fill={ink} />
      <ellipse cx={r * 0.34}  cy={-r * 0.08} rx={r * 0.14} ry={r * 0.19} fill={ink} />
      {/* pupils on dark eyes (when surface is dark, eyes are white & we add dark pupil) */}
      {dark && (
        <>
          <circle cx={-r * 0.34} cy={-r * 0.04} r={r * 0.06} fill="#1c0a08" />
          <circle cx={r * 0.34}  cy={-r * 0.04} r={r * 0.06} fill="#1c0a08" />
        </>
      )}
      {/* shimmer highlight on light eyes */}
      {!dark && (
        <>
          <circle cx={-r * 0.3}  cy={-r * 0.14} r={r * 0.055} fill="white" />
          <circle cx={r * 0.38}  cy={-r * 0.14} r={r * 0.055} fill="white" />
        </>
      )}
      {/* mouth */}
      {mouth === 'smile' && (
        <path d={`M ${-r * 0.18} ${r * 0.22} Q 0 ${r * 0.4} ${r * 0.18} ${r * 0.22}`}
              stroke={ink} strokeWidth={Math.max(1.3, r * 0.07)} fill="none" strokeLinecap="round" />
      )}
      {mouth === 'o' && (
        <ellipse cx="0" cy={r * 0.28} rx={r * 0.09} ry={r * 0.12} fill={ink} />
      )}
      {mouth === 'flat' && (
        <path d={`M ${-r * 0.13} ${r * 0.26} L ${r * 0.13} ${r * 0.26}`}
              stroke={ink} strokeWidth={Math.max(1.3, r * 0.07)} strokeLinecap="round" />
      )}
    </g>
  );
}

function KopiIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="kopi-coffee" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#9a5a2a" />
          <stop offset="55%" stopColor="#4a2010" />
          <stop offset="100%" stopColor="#1a0a04" />
        </radialGradient>
      </defs>
      {/* saucer */}
      <circle cx="100" cy="100" r="92" fill="#fdf5e6" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#3fa66a" strokeWidth="3" opacity="0.85" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#d63a3a" strokeWidth="2" opacity="0.7" />
      {/* cup rim */}
      <circle cx="100" cy="100" r="72" fill="#fff" stroke="#cda970" strokeWidth="2" />
      {/* coffee */}
      <circle cx="100" cy="100" r="64" fill="url(#kopi-coffee)" />
      {/* crema ring */}
      <circle cx="100" cy="100" r="60" fill="none" stroke="#a85d2e" strokeWidth="2" opacity="0.45" />
      {/* steam wisps */}
      <path d="M 78 26 Q 73 18 78 10" stroke="#fff5e0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M 100 22 Q 95 14 100 6" stroke="#fff5e0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8"/>
      <path d="M 122 26 Q 117 18 122 10" stroke="#fff5e0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7"/>
      {/* face on coffee */}
      <CuteFace cx={100} cy={102} size={68} dark={true} blush="#ff9a78" />
    </svg>
  );
}

function BobaIcon({ size }) {
  // Pearls pushed to bottom; face in upper-middle of cup.
  const pearls = [
    [74, 158], [88, 162], [104, 160], [120, 162], [134, 158],
    [82, 150], [98, 152], [116, 151], [128, 148],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="boba-milk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3dfb6" />
          <stop offset="100%" stopColor="#dcb274" />
        </linearGradient>
      </defs>
      {/* straw */}
      <rect x="114" y="10" width="14" height="74" rx="3" fill="#ff5a8a" transform="rotate(10 121 47)" />
      <rect x="117" y="10" width="3" height="74" fill="rgba(255,255,255,0.45)" transform="rotate(10 118 47)" />
      {/* cup body (tapered) */}
      <path d="M 52 58 L 148 58 L 140 184 Q 140 188 136 188 L 64 188 Q 60 188 60 184 Z"
            fill="#ffffff" stroke="#c4b18d" strokeWidth="2" />
      {/* milk tea fill */}
      <path d="M 60 76 L 140 76 L 137 182 L 63 182 Z" fill="url(#boba-milk)" />
      {/* brown sugar streaks — only on sides, leaving room for face */}
      <path d="M 68 78 Q 65 130 64 178" stroke="#5a2a0e" strokeWidth="5" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M 78 78 Q 76 130 74 178" stroke="#5a2a0e" strokeWidth="4" fill="none" opacity="0.55" strokeLinecap="round" />
      <path d="M 124 78 Q 122 130 121 178" stroke="#5a2a0e" strokeWidth="4" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M 134 78 Q 132 130 130 178" stroke="#5a2a0e" strokeWidth="5" fill="none" opacity="0.55" strokeLinecap="round" />
      {/* face on cup */}
      <CuteFace cx={100} cy={114} size={52} blush="#ff7a9a" />
      {/* pearls */}
      {pearls.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6" fill="#1a0805" />
      ))}
      {pearls.map(([cx, cy], i) => (
        <circle key={"h" + i} cx={cx - 1.6} cy={cy - 1.6} r="1.5" fill="rgba(255,255,255,0.4)" />
      ))}
      {/* cup highlight */}
      <rect x="66" y="92" width="3.5" height="68" rx="2" fill="rgba(255,255,255,0.55)" />
      {/* lid */}
      <ellipse cx="100" cy="58" rx="50" ry="10" fill="#efe1c0" />
      <ellipse cx="100" cy="56" rx="50" ry="8" fill="#fff5e0" />
    </svg>
  );
}

function MalaIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="mala-soup" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#ff8a48" />
          <stop offset="55%" stopColor="#d22a18" />
          <stop offset="100%" stopColor="#6a0a08" />
        </radialGradient>
      </defs>
      {/* bowl */}
      <circle cx="100" cy="100" r="92" fill="#1a0506" />
      <circle cx="100" cy="100" r="84" fill="#3a0e0a" />
      {/* soup */}
      <circle cx="100" cy="100" r="78" fill="url(#mala-soup)" />
      {/* chili oil sheen */}
      <ellipse cx="78" cy="72" rx="32" ry="14" fill="rgba(255,200,140,0.3)" transform="rotate(-20 78 72)" />
      {/* ingredients hugging the rim, not the centre */}
      <circle cx="60"  cy="65"  r="11" fill="#f6dca0" stroke="#c7a560" strokeWidth="1.5" /> {/* lotus */}
      <circle cx="138" cy="62"  r="10" fill="#74a64a" stroke="#3e6a26" strokeWidth="1.5" /> {/* bok choy */}
      <circle cx="50"  cy="120" r="11" fill="#a25d2d" stroke="#5e2f12" strokeWidth="1.5" /> {/* beef */}
      <ellipse cx="148" cy="125" rx="13" ry="9" fill="#f4a8c4" stroke="#a85070" strokeWidth="1.5"
               transform="rotate(28 148 125)" /> {/* shrimp */}
      <circle cx="148" cy="92"  r="7"  fill="#3a1a08" /> {/* mushroom */}
      <circle cx="56"  cy="92"  r="8"  fill="#e4dca0" /> {/* fish ball */}
      <circle cx="70"  cy="158" r="7"  fill="#7a2a14" /> {/* spam */}
      <circle cx="135" cy="160" r="6"  fill="#e4dca0" /> {/* fishball 2 */}
      {/* chili pods */}
      <path d="M 28 100 Q 38 96 50 100 L 47 104 Q 38 100 28 102 Z" fill="#c8261a" />
      <path d="M 172 100 Q 162 96 150 100 L 153 104 Q 162 100 172 102 Z" fill="#c8261a" />
      {/* peppercorns */}
      <circle cx="100" cy="50" r="3" fill="#2a0606" />
      <circle cx="100" cy="150" r="3" fill="#2a0606" />
      {/* steam wisp */}
      <path d="M 90 18 Q 86 10 92 4" stroke="#fff5e0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 108 18 Q 112 10 106 4" stroke="#fff5e0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
      {/* face (slightly stressed: little 'o' mouth) */}
      <CuteFace cx={100} cy={108} size={62} dark={true} blush="#ffa8a8" mouth="o" />
    </svg>
  );
}

function DurianIcon({ size }) {
  const spikes = 16;
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 92 : 68;
    points.push(`${(100 + r * Math.cos(a)).toFixed(2)},${(100 + r * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <radialGradient id="durian-fill" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#dee878" />
          <stop offset="55%" stopColor="#86a83a" />
          <stop offset="100%" stopColor="#2a3614" />
        </radialGradient>
      </defs>
      {/* stem */}
      <rect x="93" y="6" width="14" height="22" rx="3" fill="#3a2814" />
      <ellipse cx="100" cy="28" rx="14" ry="4" fill="#5a3e18" />
      {/* small leaf */}
      <ellipse cx="116" cy="14" rx="8" ry="4" fill="#5a8a2a" transform="rotate(28 116 14)"/>
      {/* spiky body */}
      <polygon points={points.join(' ')} fill="url(#durian-fill)" stroke="#1a2208" strokeWidth="1.5" strokeLinejoin="round" />
      {/* highlight */}
      <ellipse cx="74" cy="68" rx="22" ry="12" fill="rgba(255,255,255,0.25)" transform="rotate(-25 74 68)" />
      {/* face — tsundere little frown? Keep cute smile but slightly closed eyes */}
      <CuteFace cx={100} cy={108} size={56} blush="#ff8a78" mouth="flat" />
    </svg>
  );
}

function MiloIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="milo-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a4a25" />
          <stop offset="100%" stopColor="#3a1d08" />
        </linearGradient>
      </defs>
      {/* straw */}
      <rect x="120" y="6" width="10" height="64" rx="2" fill="#3fa66a" transform="rotate(14 125 38)" />
      <rect x="123" y="6" width="2.4" height="64" fill="rgba(255,255,255,0.45)" transform="rotate(14 124 38)" />
      {/* glass */}
      <path d="M 52 64 L 148 64 L 140 186 Q 140 190 136 190 L 64 190 Q 60 190 60 186 Z"
            fill="rgba(255,255,255,0.92)" stroke="#bfb59f" strokeWidth="2" />
      {/* milo liquid */}
      <path d="M 60 88 L 140 88 L 137 184 L 63 184 Z" fill="url(#milo-liquid)" />
      {/* foam meniscus */}
      <ellipse cx="100" cy="88" rx="40" ry="4" fill="#d4a878" />
      {/* mound on top — generous scoop of milo powder */}
      <path d="M 50 64 Q 56 22 100 18 Q 144 22 150 64 Z" fill="#2a1408" />
      <path d="M 56 60 Q 64 30 100 26 Q 136 30 144 60 Z" fill="#3a1d0a" />
      {/* powder grains */}
      <circle cx="74" cy="48" r="3" fill="#7a4a25" />
      <circle cx="92" cy="36" r="3" fill="#7a4a25" />
      <circle cx="108" cy="32" r="2.5" fill="#7a4a25" />
      <circle cx="124" cy="44" r="3" fill="#7a4a25" />
      <circle cx="85" cy="56" r="2" fill="#9c5e2a" />
      <circle cx="115" cy="56" r="2" fill="#9c5e2a" />
      {/* glass highlight */}
      <rect x="66" y="100" width="4" height="76" rx="2" fill="rgba(255,255,255,0.55)" />
      {/* face on the liquid */}
      <CuteFace cx={100} cy={134} size={52} dark={true} blush="#ff9a78" />
    </svg>
  );
}

function ChendolIcon({ size }) {
  const jellies = [
    [70, 130, -22], [90, 136, 18], [110, 134, -8], [128, 130, 25],
    [76, 116, 12], [124, 118, 6],
  ];
  const beans = [
    [78, 156], [98, 168], [118, 158], [126, 172], [86, 172],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="chendol-gula" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a3a18" />
          <stop offset="100%" stopColor="#3a1808" />
        </linearGradient>
      </defs>
      {/* glass body */}
      <rect x="50" y="56" width="100" height="132" rx="6" fill="rgba(255,255,255,0.9)" stroke="#bfb59f" strokeWidth="2" />
      {/* gula melaka layer (bottom) */}
      <rect x="53" y="146" width="94" height="40" fill="url(#chendol-gula)" />
      {/* coconut milk layer */}
      <rect x="53" y="122" width="94" height="24" fill="#fff5e0" />
      {/* chendol jellies */}
      {jellies.map(([cx, cy, rot], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="9" ry="3.4" fill="#3fa66a" stroke="#226a3a" strokeWidth="1.2"
                 transform={`rotate(${rot} ${cx} ${cy})`} />
      ))}
      {/* red beans */}
      {beans.map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="4" ry="3" fill="#a8281a" stroke="#5c1208" strokeWidth="0.8" />
      ))}
      {/* shaved ice mound */}
      <path d="M 50 70 Q 50 38 80 34 Q 100 26 120 34 Q 150 38 150 70 Z" fill="#eaf6ec" stroke="#bfdcc6" strokeWidth="1.5" />
      <path d="M 64 56 Q 84 42 102 50 Q 122 42 138 56" fill="none" stroke="#3fa66a" strokeWidth="4" strokeLinecap="round" opacity="0.65" />
      <circle cx="76" cy="48" r="3" fill="#3fa66a" opacity="0.7" />
      <circle cx="128" cy="48" r="3" fill="#3fa66a" opacity="0.7" />
      {/* glass highlight */}
      <rect x="56" y="80" width="4" height="92" rx="2" fill="rgba(255,255,255,0.6)" />
      {/* face on the ice mound */}
      <CuteFace cx={100} cy={56} size={42} blush="#ff9ab8" />
    </svg>
  );
}

const AURA_FOOD_ICONS = {
  kopi: KopiIcon,
  boba: BobaIcon,
  mala: MalaIcon,
  durian: DurianIcon,
  milo: MiloIcon,
  chendol: ChendolIcon,
};

function AuraFoodIcon({ id, size = 160 }) {
  const Icon = AURA_FOOD_ICONS[id];
  if (!Icon) return null;
  return <Icon size={size} />;
}

window.AuraFoodIcon = AuraFoodIcon;

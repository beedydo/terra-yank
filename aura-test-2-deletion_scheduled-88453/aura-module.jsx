// AURA Module player — multi-page lesson flow.
// Pages: intro \u2192 read \u2192 practice \u2192 reflect \u2192 complete.
// Content keyed by module.id. Bottom-of-file: AURA_MODULE_CONTENT.

const { useState: useSM, useMemo: useMM, useRef: useRM } = React;

function ModuleScreen({ module, archetype, onClose, onOpenChat }) {
  const content = AURA_MODULE_CONTENT[module.id] || AURA_MODULE_CONTENT.__default(module);
  const pages = useMM(() => [
    { type: 'intro' },
    { type: 'read', ...content.read },
    { type: 'practice', ...content.practice },
    { type: 'reflect', ...content.reflect },
    { type: 'complete', takeaway: content.takeaway },
  ], [module.id]);

  const [idx, setIdx] = useSM(0);
  const [choice, setChoice] = useSM(null);    // index of practice option picked
  const [journal, setJournal] = useSM('');
  const scrollRef = useRM(null);

  const page = pages[idx];
  const isFirst = idx === 0;
  const isLast = idx === pages.length - 1;
  const hue = module.hue;

  function next() {
    if (isLast) return onClose();
    setIdx((i) => Math.min(pages.length - 1, i + 1));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }
  function prev() {
    if (isFirst) return onClose();
    setIdx((i) => Math.max(0, i - 1));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  // Page-specific gating: practice requires a choice before continuing
  const canContinue = page.type === 'practice' ? choice !== null : true;
  const nextLabel = isLast ? 'Done'
    : page.type === 'intro' ? 'Begin'
    : page.type === 'reflect' ? 'Finish'
    : 'Continue';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--aura-bg)', color: 'var(--aura-ink)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* status bar spacer */}
      <div style={{ height: 50, flex: '0 0 auto' }} />

      {/* Top bar: close + progress */}
      <div style={{
        flex: '0 0 auto', padding: '8px 14px 10px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onClose} aria-label="close" style={{
          border: 'none', cursor: 'pointer',
          width: 34, height: 34, borderRadius: 99,
          background: 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6l-12 12"/>
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {pages.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: i <= idx
                ? `oklch(0.65 0.22 ${hue})`
                : 'color-mix(in oklab, var(--aura-ink) 10%, transparent)',
              transition: 'background .25s ease',
            }} />
          ))}
        </div>
        <div style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
          letterSpacing: '.12em', fontWeight: 700,
          color: 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
          minWidth: 30, textAlign: 'right',
        }}>{idx + 1}/{pages.length}</div>
      </div>

      {/* Page body (scroll) */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px 24px',
      }}>
        {page.type === 'intro' && <IntroPage module={module} hue={hue} />}
        {page.type === 'read' && <ReadPage page={page} hue={hue} />}
        {page.type === 'practice' && (
          <PracticePage page={page} hue={hue} choice={choice} setChoice={setChoice} />
        )}
        {page.type === 'reflect' && (
          <ReflectPage page={page} hue={hue} value={journal} onChange={setJournal} />
        )}
        {page.type === 'complete' && (
          <CompletePage
            module={module} hue={hue} takeaway={page.takeaway}
            onOpenChat={() => onOpenChat?.(module)}
          />
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        flex: '0 0 auto', padding: '12px 16px 22px',
        display: 'flex', gap: 10, alignItems: 'center',
        borderTop: '1px solid color-mix(in oklab, var(--aura-ink) 8%, transparent)',
        background: 'var(--aura-bg)',
      }}>
        <button onClick={prev} style={{
          appearance: 'none', cursor: 'pointer',
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 14%, transparent)',
          background: 'transparent', color: 'var(--aura-ink)',
          padding: '14px 18px', borderRadius: 999,
          fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 14,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <AuraIcon name="arrow-left" size={14} color="currentColor" strokeWidth={2.4} />
          {isFirst ? 'Close' : 'Back'}
        </button>
        <button onClick={next} disabled={!canContinue} style={{
          flex: 1, appearance: 'none',
          cursor: canContinue ? 'pointer' : 'not-allowed',
          border: 'none', borderRadius: 999, padding: '14px 18px',
          background: canContinue
            ? `linear-gradient(135deg, oklch(0.72 0.2 ${hue}), oklch(0.55 0.24 ${hue}))`
            : 'color-mix(in oklab, var(--aura-ink) 12%, transparent)',
          color: canContinue ? 'white' : 'color-mix(in oklab, var(--aura-ink) 40%, transparent)',
          fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 15,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: canContinue
            ? `0 12px 26px -12px oklch(0.55 0.24 ${hue} / 0.7)`
            : 'none',
          transition: 'all .15s ease',
        }}>
          {nextLabel}
          {!isLast && <AuraIcon name="arrow-right" size={14} color="white" strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}

// ── PAGES ──────────────────────────────────────────────────────────

function IntroPage({ module, hue }) {
  return (
    <div style={{ animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: `linear-gradient(135deg, oklch(0.88 0.14 ${hue}), oklch(0.6 0.24 ${hue}))`,
          boxShadow: `0 12px 24px -10px oklch(0.55 0.22 ${hue} / 0.7)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--aura-display)', fontWeight: 800, color: 'white', fontSize: 22,
        }}>{String(AURA_MODULES.findIndex((m) => m.id === module.id) + 1).padStart(2, '0')}</div>
        <div style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
          letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
          color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        }}>
          {module.mins} min \u00b7 {module.level}<br/>{module.tag}
        </div>
      </div>

      <h1 style={{
        margin: 0, fontFamily: 'var(--aura-display)', fontWeight: 800,
        fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.03em',
        textWrap: 'balance', color: 'var(--aura-ink)',
      }}>{module.title}</h1>

      <p style={{
        marginTop: 14, fontSize: 15.5, lineHeight: 1.5,
        color: 'color-mix(in oklab, var(--aura-ink) 80%, transparent)',
        textWrap: 'pretty',
      }}>{module.blurb}</p>

      <div style={{
        marginTop: 26,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
      }}>what you\u2019ll learn</div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        {module.lessons.map((l, i) => (
          <li key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            fontSize: 14.5, lineHeight: 1.45,
          }}>
            <span style={{
              flex: '0 0 auto', marginTop: 4,
              width: 6, height: 6, borderRadius: 99,
              background: `oklch(0.6 0.24 ${hue})`,
            }} />
            <span style={{ textWrap: 'pretty' }}>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadPage({ page, hue }) {
  return (
    <div style={{ animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
        color: `oklch(0.55 0.22 ${hue})`,
      }}>read \u00b7 ~2 min</div>
      <h2 style={{
        margin: '6px 0 0', fontFamily: 'var(--aura-display)', fontWeight: 800,
        fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.025em',
        textWrap: 'balance',
      }}>{page.heading}</h2>

      <p style={{
        marginTop: 16, fontSize: 15.5, lineHeight: 1.6,
        color: 'color-mix(in oklab, var(--aura-ink) 85%, transparent)',
        textWrap: 'pretty',
      }}>{page.body}</p>

      <div style={{
        marginTop: 22, padding: '14px 16px', borderRadius: 14,
        background: `color-mix(in oklab, oklch(0.7 0.22 ${hue}) 12%, transparent)`,
        border: `1px solid color-mix(in oklab, oklch(0.7 0.22 ${hue}) 30%, transparent)`,
      }}>
        <div style={{
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
          letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
          color: `oklch(0.45 0.22 ${hue})`,
          marginBottom: 6,
        }}>key point</div>
        <div style={{
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
          fontSize: 19, lineHeight: 1.3, color: 'var(--aura-ink)',
          textWrap: 'balance',
        }}>"{page.keypoint}"</div>
      </div>
    </div>
  );
}

function PracticePage({ page, hue, choice, setChoice }) {
  const picked = choice !== null;
  return (
    <div style={{ animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
        color: `oklch(0.55 0.22 ${hue})`,
      }}>practice \u00b7 pick one</div>
      <h2 style={{
        margin: '6px 0 0', fontFamily: 'var(--aura-display)', fontWeight: 800,
        fontSize: 22, lineHeight: 1.18, letterSpacing: '-0.02em',
        textWrap: 'balance',
      }}>{page.prompt}</h2>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {page.options.map((opt, i) => {
          const sel = choice === i;
          const isCorrect = picked && i === page.answer;
          const isWrongPick = picked && sel && i !== page.answer;
          return (
            <button key={i} onClick={() => setChoice(i)} disabled={picked} style={{
              appearance: 'none', cursor: picked ? 'default' : 'pointer',
              textAlign: 'left', border: '1.5px solid',
              borderColor: isCorrect
                ? `oklch(0.6 0.18 145)`
                : isWrongPick
                  ? `oklch(0.65 0.2 25)`
                  : sel
                    ? `oklch(0.65 0.22 ${hue})`
                    : 'color-mix(in oklab, var(--aura-ink) 12%, transparent)',
              background: isCorrect
                ? 'color-mix(in oklab, oklch(0.7 0.18 145) 14%, var(--aura-chip, white))'
                : isWrongPick
                  ? 'color-mix(in oklab, oklch(0.7 0.2 25) 10%, var(--aura-chip, white))'
                  : 'var(--aura-chip, white)',
              color: 'var(--aura-ink)',
              padding: '14px 16px', borderRadius: 14,
              fontSize: 14.5, lineHeight: 1.4, fontFamily: 'inherit',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              transition: 'all .15s ease',
            }}>
              <span style={{
                flex: '0 0 auto', marginTop: 1,
                width: 20, height: 20, borderRadius: 99,
                background: isCorrect
                  ? 'oklch(0.6 0.18 145)'
                  : isWrongPick
                    ? 'oklch(0.65 0.2 25)'
                    : sel
                      ? `oklch(0.65 0.22 ${hue})`
                      : 'color-mix(in oklab, var(--aura-ink) 8%, transparent)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
              }}>
                {isCorrect ? '\u2713' : isWrongPick ? '\u2715' : String.fromCharCode(65 + i)}
              </span>
              <span style={{ textWrap: 'pretty', flex: 1 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {picked && page.explain && (
        <div style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 12,
          background: `color-mix(in oklab, oklch(0.7 0.22 ${hue}) 10%, transparent)`,
          border: `1px dashed color-mix(in oklab, oklch(0.7 0.22 ${hue}) 32%, transparent)`,
          animation: 'aura-rise .3s cubic-bezier(.2,.7,.2,1) both',
        }}>
          <div style={{
            fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
            letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
            color: `oklch(0.45 0.22 ${hue})`, marginBottom: 4,
          }}>{choice === page.answer ? 'spot on' : 'a step away'}</div>
          <div style={{
            fontSize: 13.5, lineHeight: 1.45, color: 'var(--aura-ink)',
            textWrap: 'pretty',
          }}>{page.explain}</div>
        </div>
      )}
    </div>
  );
}

function ReflectPage({ page, hue, value, onChange }) {
  return (
    <div style={{ animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
        letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
        color: `oklch(0.55 0.22 ${hue})`,
      }}>reflect \u00b7 just you</div>
      <h2 style={{
        margin: '6px 0 0', fontFamily: 'var(--aura-display)', fontWeight: 800,
        fontSize: 22, lineHeight: 1.18, letterSpacing: '-0.02em',
        textWrap: 'balance',
      }}>{page.prompt}</h2>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="type as messy as you need\u2026"
        style={{
          marginTop: 18, width: '100%', minHeight: 160, resize: 'none',
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 12%, transparent)',
          background: 'var(--aura-chip, white)', color: 'var(--aura-ink)',
          borderRadius: 14, padding: 14, boxSizing: 'border-box',
          fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5,
          outline: 'none',
        }}
      />

      <div style={{
        marginTop: 10,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 45%, transparent)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: 99,
          background: 'oklch(0.7 0.18 145)',
        }} />
        stays on your device \u00b7 nobody sees this
      </div>
    </div>
  );
}

function CompletePage({ module, hue, takeaway, onOpenChat }) {
  return (
    <div style={{ animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{
        position: 'relative', width: '100%', display: 'flex', justifyContent: 'center',
        marginTop: 6, marginBottom: 14,
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%,
            oklch(0.95 0.06 ${hue}) 0%,
            oklch(0.7 0.22 ${hue}) 55%,
            oklch(0.4 0.22 ${(hue + 40) % 360}) 100%)`,
          boxShadow: `0 24px 50px -16px oklch(0.55 0.24 ${hue} / 0.7),
            inset 0 -10px 16px oklch(0.4 0.2 ${hue})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'aura-pulse 3.4s ease-in-out infinite',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7"/>
          </svg>
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.22em', textTransform: 'uppercase', fontWeight: 700,
        color: `oklch(0.5 0.22 ${hue})`,
      }}>module complete</div>

      <h2 style={{
        margin: '8px 0 0', textAlign: 'center',
        fontFamily: 'var(--aura-display)', fontWeight: 800,
        fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.025em',
        textWrap: 'balance',
      }}>One thing to carry.</h2>

      <div style={{
        marginTop: 18, padding: '18px 18px', borderRadius: 18,
        background: `color-mix(in oklab, oklch(0.7 0.22 ${hue}) 12%, transparent)`,
        border: `1px solid color-mix(in oklab, oklch(0.7 0.22 ${hue}) 30%, transparent)`,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
          fontSize: 21, lineHeight: 1.3, color: 'var(--aura-ink)',
          textWrap: 'balance',
        }}>"{takeaway}"</div>
      </div>

      <button onClick={onOpenChat} style={{
        marginTop: 18, width: '100%',
        appearance: 'none', cursor: 'pointer',
        border: '1.5px solid color-mix(in oklab, var(--aura-ink) 14%, transparent)',
        background: 'var(--aura-chip, white)', color: 'var(--aura-ink)',
        padding: '14px 16px', borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%,
            oklch(0.9 0.15 ${hue}) 0%,
            oklch(0.6 0.22 ${hue}) 60%,
            oklch(0.35 0.18 ${(hue + 40) % 360}) 100%)`,
          flex: '0 0 auto',
        }} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 14,
            lineHeight: 1.2,
          }}>Talk it out with Aura</div>
          <div style={{
            fontSize: 12, opacity: 0.65, marginTop: 2,
          }}>walk through this in your own words</div>
        </div>
        <AuraIcon name="arrow-right" size={14}
          color="color-mix(in oklab, var(--aura-ink) 55%, transparent)" strokeWidth={2.4}/>
      </button>
    </div>
  );
}

// ── MODULE CONTENT ─────────────────────────────────────────────────

const AURA_MODULE_CONTENT = {
  'name-feelings': {
    read: {
      heading: 'The 6-second window',
      body: "Between a notification buzzing and your thumb hitting send, there\u2019s a tiny window \u2014 around 6 seconds \u2014 where the feeling is still warm. After that, your nervous system has already decided how to act for you. Catching it in the window isn\u2019t about control. It\u2019s about giving yourself one extra beat of choice.",
      keypoint: "Warm isn\u2019t worse than calm. It\u2019s just earlier.",
    },
    practice: {
      prompt: "A friend leaves you on read for 4 hours. Before you do anything, the first thing you notice in your body is\u2026",
      options: [
        'A heat behind my sternum',
        'A jaw / shoulder clench',
        'A loop of replaying our chat',
        'Nothing \u2014 already gone numb',
      ],
      answer: 0,
      explain: "There\u2019s no \u201Cright\u201D answer here \u2014 the point is the noticing itself. Heat in the chest is the most common early signal; numbness means it\u2019s already past the warm window. Either way, you just named it. That\u2019s the move.",
    },
    reflect: {
      prompt: "Think about the last text you sent and immediately regretted. What did your body feel like, 6 seconds before you hit send? One sentence is enough.",
    },
    takeaway: "You don\u2019t need to feel less. You just need to name it 6 seconds sooner.",
  },

  'honest-opener': {
    read: {
      heading: 'Curiosity beats cleverness',
      body: "Clever openers were a 2017 trend that ate everyone\u2019s dating life. The real ones are shorter than you think: read the bio, find one specific detail only they would have, ask a question only they could answer. The goal isn\u2019t to perform \u2014 it\u2019s to start a coffee that could actually happen.",
      keypoint: "If your opener could be sent to ten other people, send a different one.",
    },
    practice: {
      prompt: "Their bio says: \u201CEngineer. Two cats. Tries to surf, mostly falls.\u201D Which opener has the best chance?",
      options: [
        "hey, how\u2019s your week",
        "your cats look like they run the apartment \u2014 do they let you work?",
        "engineers don\u2019t usually surf. what got you started?",
        "you\u2019re cute lol",
      ],
      answer: 2,
      explain: "All three of B / C are fine \u2014 they pick a real detail. C edges it because surfing is the most surprising thing in the bio, which means the answer will tell you something real about them. \u201Chow\u2019s your week\u201D is what a survey sends.",
    },
    reflect: {
      prompt: "Open your last 3 sent DMs. Which one would you not be okay reading back to a friend at brunch? Rewrite it here.",
    },
    takeaway: "Specific beats smooth. Always.",
  },

  'hard-talks': {
    read: {
      heading: 'Freeze is information',
      body: "When your throat closes mid-conversation, that\u2019s not weakness. That\u2019s your body deciding the conversation isn\u2019t safe enough yet. Pushing through usually makes it worse \u2014 the fix is three small anchors: feet on the floor, eyes open, one sentence at a time. The room can wait one breath between your sentences. It almost always does.",
      keypoint: "You only owe the room one sentence at a time.",
    },
    practice: {
      prompt: "You feel the freeze starting mid-conversation. The first move is to\u2026",
      options: [
        'Push through and keep talking',
        'Quietly notice your feet on the floor',
        'Excuse yourself and leave the room',
        'Apologise pre-emptively for what you might say',
      ],
      answer: 1,
      explain: "Body before mouth. The reason freeze keeps escalating is that your attention stays on the spinning head. One second on a physical anchor \u2014 feet, breath, the cup in your hand \u2014 and the system gets a chance to reset. Then one sentence.",
    },
    reflect: {
      prompt: "There\u2019s a conversation you\u2019ve been avoiding. What\u2019s the first sentence \u2014 just the first one \u2014 you\u2019d need to say to start it?",
    },
    takeaway: "One sentence, then a breath. That\u2019s the whole technique.",
  },

  'repair': {
    read: {
      heading: 'Apology is a sequence',
      body: "Most apologies fail at part one. We jump to \u201CI didn\u2019t mean to\u201D before the other person knows we\u2019ve heard them. A real repair is four parts, in order: own it, name the impact, ask what they need, change something visible. Skip a step and the whole thing reads as defence dressed up as remorse.",
      keypoint: "Don\u2019t explain your intent until they\u2019ve felt their impact.",
    },
    practice: {
      prompt: "You snapped at a friend. Which opening line for the repair is strongest?",
      options: [
        "I\u2019m sorry but I was really stressed",
        "I shouldn\u2019t have said that \u2014 the way I said it landed hard, didn\u2019t it",
        "I didn\u2019t mean it that way",
        "Can we just move on",
      ],
      answer: 1,
      explain: "B leads with ownership and acknowledges impact in the same breath. A and C lead with intent (\u201Cstressed\u201D, \u201Cdidn\u2019t mean\u201D) \u2014 which is a defence even when it\u2019s true. \u201CMove on\u201D is a request, not a repair.",
    },
    reflect: {
      prompt: "Think of an apology that didn\u2019t land for someone in your life. Which of the four parts did you skip \u2014 own / impact / ask / change?",
    },
    takeaway: "Own \u2192 impact \u2192 ask \u2192 change. In that order, every time.",
  },

  'saying-no': {
    read: {
      heading: 'No is a full sentence',
      body: "Saying no with three paragraphs of justification doesn\u2019t make it kinder \u2014 it makes it negotiable. The strongest declines are short, warm, and don\u2019t apologise for the existence of the no itself. \u201CSorry\u201D belongs to things you did wrong, not things you don\u2019t want to do.",
      keypoint: "Reasons invite debate. A clean no doesn\u2019t.",
    },
    practice: {
      prompt: "A friend asks you to plus-one their work event. You don\u2019t want to go. Best response:",
      options: [
        "Sorry I\u2019m so swamped, work is crazy, maybe next time?",
        "I\u2019d rather not \u2014 but tell me how it goes",
        "I can\u2019t, I have plans",
        "Ya let me see and get back to you",
      ],
      answer: 1,
      explain: "B is honest, warm, and doesn\u2019t require maintenance. A is a soft yes wearing a no costume \u2014 it\u2019ll get you re-invited. C lies (small, but lies erode). D is a yes you haven\u2019t admitted yet.",
    },
    reflect: {
      prompt: "What\u2019s a small no you\u2019ve been padding for weeks? Write it the short way \u2014 12 words or fewer.",
    },
    takeaway: "A warm no in 12 words beats a soft yes you\u2019ll resent for a month.",
  },

  'listening': {
    read: {
      heading: "Reflect, don\u2019t fix",
      body: "When someone is venting, the urge to solve almost always arrives faster than the urge to hear. But fixing too early reads as \u201Cplease stop\u201D \u2014 even when you mean well. Reflect first: say back what you heard before you offer anything. If a solution is wanted, they\u2019ll ask. They almost always do, once they feel heard.",
      keypoint: "Repeat the feeling back before you reach for the answer.",
    },
    practice: {
      prompt: "Your partner says: \u201CI just feel invisible at work.\u201D Strongest reply:",
      options: [
        'Have you tried talking to your boss about it?',
        'That sounds awful \u2014 invisible how?',
        "You\u2019re not invisible at home, though",
        "It\u2019ll pass, work is always like this",
      ],
      answer: 1,
      explain: "B reflects the feeling and asks them to go deeper, with no fix attached. A jumps to action. C contradicts the feeling (kindly, but still). D dismisses it. The \u201Cinvisible how?\u201D is the part that does the work.",
    },
    reflect: {
      prompt: "Today, in one conversation, you\u2019ll only reflect. No fixing, no advising. Whose conversation will it be?",
    },
    takeaway: "The exhale you hear is the sign you actually listened.",
  },

  __default: (module) => ({
    read: {
      heading: 'A short read to start',
      body: `${module.blurb} This module unpacks it across three lessons, each with a tiny practice you can do today.`,
      keypoint: 'Small reps, said out loud, beat perfect plans you don\u2019t run.',
    },
    practice: {
      prompt: 'Which of these sounds most like you right now?',
      options: module.lessons,
      answer: 0,
      explain: 'No wrong answer \u2014 the noticing is the work.',
    },
    reflect: {
      prompt: module.practice,
    },
    takeaway: 'Pick the smallest version of this you can do today.',
  }),
};

window.ModuleScreen = ModuleScreen;
window.AURA_MODULE_CONTENT = AURA_MODULE_CONTENT;

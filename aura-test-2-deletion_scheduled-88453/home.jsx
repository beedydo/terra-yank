// AURA Home (post-survey) — recommended modules + AI life coach.
// Modules expand inline on tap; coach card opens the chat screen.

const { useState: useStateH } = React;

const AURA_MODULES = [
{
  id: 'name-feelings',
  title: 'Naming feelings before they spike',
  mins: 8, level: 'foundational', tag: 'self-regulation', hue: 18,
  blurb: 'Catch the heat at warm, not boil. A 4-step micro-script that fits between a notification and your reply.',
  lessons: [
  'The 6-second window between trigger and react',
  'Sensation \u2192 label \u2192 space (with audio)',
  'When to send the text, when to sit on it'],

  practice: 'Today: name the feeling out loud before you type the reply. Just once.'
},
{
  id: 'honest-opener',
  title: 'The honest opener: from script to real',
  mins: 12, level: 'starter', tag: 'communication', hue: 320,
  blurb: "Stop sending a sentence you wouldn\u2019t say out loud. Build openers that survive a coffee.",
  lessons: [
  'Curiosity beats cleverness (every time)',
  'The one-detail rule: read the bio, not the pose',
  'Re-write three of your last DMs in your own voice'],

  practice: 'Today: send one opener you\u2019d be okay reading back to a friend.'
},
{
  id: 'hard-talks',
  title: 'Hard talks without the freeze',
  mins: 15, level: 'core', tag: 'conflict', hue: 260,
  blurb: 'The freeze is a body event, not a character flaw. Three anchors that keep your voice in the room.',
  lessons: [
  'Feet on the floor, eyes open, jaw soft',
  'One sentence, then breathe \u2014 not a paragraph',
  'The repair that comes after a silence'],

  practice: 'Today: pick the conversation you\u2019re avoiding. Write the first line only.'
},
{
  id: 'repair',
  title: "Repair: what to say after you've snapped",
  mins: 10, level: 'core', tag: 'repair', hue: 12,
  blurb: "A real apology is a sequence, not a sentence. Practise the four parts, in order.",
  lessons: [
  'Own it without performing it',
  'Name the impact \u2014 not your intent',
  'Ask what they need next (and mean it)'],

  practice: 'Today: re-send one apology that didn\u2019t land the first time.'
},
{
  id: 'saying-no',
  title: 'Saying no without rehearsing for 6 hours',
  mins: 9, level: 'starter', tag: 'boundaries', hue: 38,
  blurb: "A no that doesn\u2019t sound like a no costs more than the favour. Eight short ways to mean it.",
  lessons: [
  'No is a full sentence',
  'Reasons are not required (and rarely help)',
  'The warm decline ladder \u2014 from soft to firm'],

  practice: 'Today: decline one thing in under 12 words. No padding.'
},
{
  id: 'listening',
  title: 'Listening like you actually mean it',
  mins: 11, level: 'foundational', tag: 'attunement', hue: 145,
  blurb: 'Most listening is just waiting to talk. Train the kind that makes the other person exhale.',
  lessons: [
  'What to do with your face when you don\u2019t know what to say',
  'Reflect, don\u2019t fix',
  'The follow-up that proves you actually heard'],

  practice: 'Today: in one conversation, ask twice before offering once.'
}];


function HomeScreen({ archetype, onContinue, onOpenChat }) {
  const [openId, setOpenId] = useStateH(null);

  return (
    <Screen style={{ background: 'var(--aura-bg)' }}>
      {/* Owner banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: 'color-mix(in oklab, var(--aura-accent) 14%, transparent)',
        border: '1px dashed color-mix(in oklab, var(--aura-accent) 50%, transparent)',
        borderRadius: 12,
        marginBottom: 18,
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 80%, transparent)'
      }}>
        <span style={{
          padding: '2px 6px', borderRadius: 4,
          background: 'var(--aura-ink)', color: 'var(--aura-bg)'
        }}></span>
        <span></span>
      </div>

      {/* Greeting */}
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)'
      }}>good evening</div>
      <h2 style={{
        margin: '4px 0 0',
        fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 30,
        letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--aura-ink)',
        textWrap: 'balance'
      }}>
        Your growth plan, made for the{' '}
        <em style={{
          fontFamily: 'var(--aura-italic, "Instrument Serif")', fontStyle: 'italic',
          fontWeight: 400, color: 'var(--aura-accent)'
        }}>{archetype ? archetype.name.split(' ')[0] : 'you'}</em>{' '}in you.
      </h2>

      {/* AI Coach feature card */}
      <SectionHeader>your AI life coach</SectionHeader>
      <button
        onClick={onOpenChat}
        style={{
          appearance: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          width: '100%', padding: 0, borderRadius: 22, overflow: 'hidden',
          background: 'linear-gradient(135deg, oklch(0.22 0.08 280) 0%, oklch(0.32 0.12 320) 100%)',
          color: 'white', position: 'relative',
          boxShadow: '0 14px 30px -16px oklch(0.32 0.12 320 / 0.7)'
        }}>
        <div style={{ position: 'relative', padding: '20px 18px' }}>
          <div style={{
            position: 'absolute', right: -30, top: -30,
            width: 160, height: 160, borderRadius: '50%',
            background: `radial-gradient(circle, oklch(0.85 0.18 ${archetype?.hue ?? 60} / 0.55), transparent 70%)`,
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9.5,
              letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
              background: 'rgba(255,255,255,0.16)', padding: '4px 8px', borderRadius: 99,
              marginBottom: 12
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 99,
                background: 'oklch(0.85 0.18 145)',
                boxShadow: '0 0 6px oklch(0.85 0.18 145)'
              }} />
              online \u00b7 anchored to your quiz
            </div>
            <div style={{
              fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 20,
              lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 6,
              textWrap: 'balance'
            }}>
              Talk to Aura, your private coach.
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.4, opacity: 0.85, textWrap: 'pretty', overflowWrap: 'break-word' }}>
              Rehearse hard talks, untangle a stuck feeling, plan what to say next. Type or speak \u2014 she listens.
            </div>
            <div style={{
              marginTop: 14, display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.95)', color: 'oklch(0.2 0.05 280)',
              padding: '10px 12px', borderRadius: 14
            }}>
              <div style={{
                flex: 1, minWidth: 0,
                fontSize: 13, opacity: 0.55, fontStyle: 'italic',
                overflowWrap: 'break-word'
              }}>
                "Walk me through what to say to\u2026"
              </div>
              <div style={{
                flex: '0 0 auto',
                width: 32, height: 32, borderRadius: 99,
                background: 'oklch(0.2 0.05 280)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AuraIcon name="arrow-right" size={16} color="white" strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Recommended modules */}
      <SectionHeader>recommended for you</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AURA_MODULES.map((m, i) => {
          const open = openId === m.id;
          return (
            <div key={m.id} style={{
              background: 'var(--aura-chip, white)',
              border: '1.5px solid color-mix(in oklab, var(--aura-ink) 8%, transparent)',
              borderRadius: 16, overflow: 'hidden',
              transition: 'border-color .2s ease, transform .2s ease',
              borderColor: open ?
              `color-mix(in oklab, oklch(0.7 0.2 ${m.hue}) 60%, transparent)` :
              'color-mix(in oklab, var(--aura-ink) 8%, transparent)'
            }}>
              <button
                onClick={() => setOpenId(open ? null : m.id)}
                aria-expanded={open}
                style={{
                  appearance: 'none', border: 'none', cursor: 'pointer',
                  background: 'transparent', width: '100%', textAlign: 'left',
                  padding: 14, display: 'flex', alignItems: 'center', gap: 12
                }}>
                <div style={{
                  flex: '0 0 auto',
                  width: 44, height: 44, borderRadius: 12,
                  background: `linear-gradient(135deg, oklch(0.88 0.14 ${m.hue}), oklch(0.62 0.22 ${m.hue}))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 18, color: 'white',
                  boxShadow: `0 6px 14px -6px oklch(0.55 0.2 ${m.hue} / 0.7)`
                }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 14.5,
                    lineHeight: 1.25, color: 'var(--aura-ink)', textWrap: 'pretty'
                  }}>{m.title}</div>
                  <div style={{
                    marginTop: 3,
                    fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    color: 'color-mix(in oklab, var(--aura-ink) 50%, transparent)', fontWeight: 700
                  }}>{m.mins} min \u00b7 {m.level} \u00b7 {m.tag}</div>
                </div>
                <div style={{
                  flex: '0 0 auto', width: 24, height: 24, borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: open ?
                  `color-mix(in oklab, oklch(0.7 0.2 ${m.hue}) 18%, transparent)` :
                  'transparent',
                  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform .2s ease, background .2s ease'
                }}>
                  <AuraIcon
                    name="arrow-right" size={14}
                    color={open ?
                    `oklch(0.55 0.22 ${m.hue})` :
                    'color-mix(in oklab, var(--aura-ink) 45%, transparent)'}
                    strokeWidth={2.4} />
                </div>
              </button>

              {open &&
              <div style={{
                padding: '4px 14px 14px', animation: 'aura-rise .3s cubic-bezier(.2,.7,.2,1) both'
              }}>
                  <div style={{
                  fontSize: 13.5, lineHeight: 1.5, color: 'var(--aura-ink)',
                  opacity: 0.85, marginBottom: 14, textWrap: 'pretty'
                }}>{m.blurb}</div>

                  <div style={{
                  fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
                  letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
                  color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
                  marginBottom: 8
                }}>inside this module</div>

                  <ol style={{
                  margin: 0, padding: 0, listStyle: 'none',
                  display: 'flex', flexDirection: 'column', gap: 8
                }}>
                    {m.lessons.map((lesson, li) =>
                  <li key={li} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    fontSize: 13, lineHeight: 1.4, color: 'var(--aura-ink)'
                  }}>
                        <span style={{
                      flex: '0 0 auto', marginTop: 2,
                      width: 18, height: 18, borderRadius: 99,
                      background: `color-mix(in oklab, oklch(0.7 0.2 ${m.hue}) 20%, transparent)`,
                      color: `oklch(0.45 0.22 ${m.hue})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9, fontWeight: 700
                    }}>{li + 1}</span>
                        <span style={{ textWrap: 'pretty' }}>{lesson}</span>
                      </li>
                  )}
                  </ol>

                  <div style={{
                  marginTop: 14, padding: '10px 12px', borderRadius: 12,
                  background: `color-mix(in oklab, oklch(0.7 0.2 ${m.hue}) 10%, transparent)`,
                  border: `1px dashed color-mix(in oklab, oklch(0.7 0.2 ${m.hue}) 35%, transparent)`,
                  fontSize: 12.5, lineHeight: 1.45, color: 'var(--aura-ink)',
                  textWrap: 'pretty'
                }}>
                    <span style={{
                    fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
                    letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
                    color: `oklch(0.45 0.22 ${m.hue})`,
                    marginRight: 6
                  }}>nudge</span>
                    {m.practice}
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button
                    onClick={(e) => {e.stopPropagation(); /* hook: start module */}}
                    style={{
                      flex: 1, appearance: 'none', cursor: 'pointer',
                      border: 'none', borderRadius: 999, padding: '12px 14px',
                      background: 'var(--aura-ink)', color: 'var(--aura-bg)',
                      fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 13.5,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}>
                      Start module
                      <AuraIcon name="arrow-right" size={14} color="var(--aura-bg)" strokeWidth={2.5} />
                    </button>
                    <button
                    onClick={(e) => {e.stopPropagation();onOpenChat?.(m);}}
                    style={{
                      appearance: 'none', cursor: 'pointer',
                      border: '1.5px solid color-mix(in oklab, var(--aura-ink) 18%, transparent)',
                      borderRadius: 999, padding: '12px 14px',
                      background: 'transparent', color: 'var(--aura-ink)',
                      fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 13.5
                    }}>
                      Ask Aura
                    </button>
                  </div>
                </div>
              }
            </div>);

        })}
      </div>

      <div style={{ marginTop: 22 }}>
        <AuraButton onClick={onContinue} variant="ghost" iconRight="arrow-right">
          Continue
        </AuraButton>
      </div>

      {/* Owner footnote */}
      <div style={{
        marginTop: 16, paddingTop: 14,
        borderTop: '1px dashed color-mix(in oklab, var(--aura-ink) 15%, transparent)',
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10, lineHeight: 1.5,
        color: 'color-mix(in oklab, var(--aura-ink) 50%, transparent)'
      }}>
        <span style={{ fontWeight: 700, color: 'var(--aura-ink)' }}></span>
        <br />
        
      </div>
    </Screen>);

}
window.HomeScreen = HomeScreen;

// Local SectionHeader copy (results.jsx defines its own scoped one)
function SectionHeader(props) {
  return (
    <div style={{
      marginTop: 28, marginBottom: 14,
      fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
      letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
      color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      <span>{props.children}</span>
      <span style={{ flex: 1, height: 1, background: 'color-mix(in oklab, var(--aura-ink) 12%, transparent)' }} />
    </div>);

}
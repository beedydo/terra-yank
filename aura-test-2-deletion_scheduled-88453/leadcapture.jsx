// AURA lead capture screen + thank-you.

const { useState: useStateLC } = React;

function LeadCaptureScreen({ onSubmit, onSkip }) {
  const [interests, setInterests] = useStateLC({ workshops: false, mixers: false, courses: false });
  const [qual, setQual] = useStateLC({ single: '', valuesMatter: '', wantKids: '' });
  const [contact, setContact] = useStateLC({ name: '', email: '' });
  const [optedIn, setOptedIn] = useStateLC(false);
  const [submitted, setSubmitted] = useStateLC(false);

  const anyInterest = interests.workshops || interests.mixers || interests.courses;
  const canSubmit = anyInterest && contact.email.trim() && optedIn;

  function toggle(k) { setInterests({ ...interests, [k]: !interests[k] }); }

  if (submitted) {
    return (
      <Screen style={{ background: 'var(--aura-bg)' }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'var(--aura-grad)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            animation: 'aura-pop 0.6s cubic-bezier(.2,.9,.3,1.3) both',
            boxShadow: '0 20px 40px -10px color-mix(in oklab, var(--aura-accent) 50%, transparent)',
          }}>
            <AuraIcon name="check" size={48} color="white" strokeWidth={2.5} />
          </div>
          <h2 style={{
            margin: '24px 0 6px',
            fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 30,
            letterSpacing: '-0.03em', color: 'var(--aura-ink)', textWrap: 'balance',
          }}>You\u2019re in.</h2>
          <p style={{
            margin: 0, maxWidth: 280,
            fontSize: 15, lineHeight: 1.45, color: 'color-mix(in oklab, var(--aura-ink) 65%, transparent)',
            textWrap: 'pretty',
          }}>We\u2019ll reach out when something matching your vibe pops up. No spam, no clinginess.</p>
        </div>
        <AuraButton onClick={onSkip} variant="ghost" icon="retry">Back to start</AuraButton>
      </Screen>
    );
  }

  return (
    <Screen style={{ background: 'var(--aura-bg)' }}>
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.2em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)',
        marginBottom: 6,
      }}>optional · skip anytime</div>

      <h2 style={{
        margin: 0,
        fontFamily: 'var(--aura-display)', fontWeight: 800, fontSize: 30,
        letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--aura-ink)',
        textWrap: 'balance',
      }}>
        Want us to invite you to good stuff?
      </h2>
      <p style={{
        margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.4,
        color: 'color-mix(in oklab, var(--aura-ink) 65%, transparent)',
      }}>
        We run workshops, mixers, and courses in Singapore. Tell us what you\u2019d show up to.
      </p>

      {/* Interests */}
      <SectionHeader>i\u2019d show up to</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { k: 'workshops', t: 'Communication & relationships workshops', sub: 'small group, 2 hours, with a facilitator' },
          { k: 'mixers', t: 'Singles mixers & dating events', sub: 'curated, low-pressure, themed' },
          { k: 'courses', t: 'General social-skills courses', sub: 'multi-week, structured' },
        ].map(({ k, t, sub }) => (
          <Checkbox key={k} checked={interests[k]} onChange={() => toggle(k)} title={t} sub={sub} />
        ))}
      </div>

      {/* Qualification */}
      <SectionHeader>a few quick ones</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SegQuestion
          q="Currently single and looking for something serious?"
          options={['Yes', 'Open', 'Not really']}
          value={qual.single}
          onChange={(v) => setQual({ ...qual, single: v })}
        />
        <SegQuestion
          q="How important is shared religion / values in a partner?"
          options={['A lot', 'Some', 'Not much']}
          value={qual.valuesMatter}
          onChange={(v) => setQual({ ...qual, valuesMatter: v })}
        />
        <SegQuestion
          q="Do you want kids in the future?"
          options={['Yes', 'Maybe', 'No']}
          value={qual.wantKids}
          onChange={(v) => setQual({ ...qual, wantKids: v })}
        />
      </div>

      {/* Contact */}
      <SectionHeader>how do we reach you?</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input label="Name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} placeholder="What we should call you" />
        <Input label="Email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} placeholder="you@example.com" type="email" />
      </div>

      {/* Consent */}
      <div
        onClick={() => setOptedIn(!optedIn)}
        style={{
          marginTop: 18, padding: '12px 14px',
          background: 'color-mix(in oklab, var(--aura-ink) 4%, transparent)',
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 8%, transparent)',
          borderRadius: 14, cursor: 'pointer',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}
      >
        <div style={{
          flexShrink: 0, marginTop: 2,
          width: 18, height: 18, borderRadius: 5,
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 30%, transparent)',
          background: optedIn ? 'var(--aura-ink)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}>
          {optedIn && <AuraIcon name="check" size={12} color="var(--aura-bg)" strokeWidth={3} />}
        </div>
        <div style={{
          fontSize: 12, lineHeight: 1.45,
          color: 'color-mix(in oklab, var(--aura-ink) 65%, transparent)',
          textWrap: 'pretty',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--aura-ink)' }}>[CONSENT TEXT PLACEHOLDER] </span>
          I agree to be contacted about events and content that match my interests. I can opt out anytime.
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AuraButton
          onClick={() => canSubmit && setSubmitted(true)}
          disabled={!canSubmit}
          variant="primary"
          iconRight="arrow-right"
        >
          Count me in
        </AuraButton>
        <AuraButton onClick={onSkip} variant="ghost">
          No thanks
        </AuraButton>
      </div>
    </Screen>
  );
}
window.LeadCaptureScreen = LeadCaptureScreen;

function Checkbox({ checked, onChange, title, sub }) {
  return (
    <div
      onClick={onChange}
      style={{
        background: 'var(--aura-chip, white)',
        border: `1.5px solid ${checked ? 'var(--aura-ink)' : 'color-mix(in oklab, var(--aura-ink) 10%, transparent)'}`,
        borderRadius: 16, padding: '12px 14px',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        cursor: 'pointer', transition: 'all .15s',
      }}
    >
      <div style={{
        flexShrink: 0, marginTop: 2,
        width: 20, height: 20, borderRadius: 6,
        border: `1.5px solid ${checked ? 'var(--aura-ink)' : 'color-mix(in oklab, var(--aura-ink) 25%, transparent)'}`,
        background: checked ? 'var(--aura-ink)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <AuraIcon name="check" size={14} color="var(--aura-bg)" strokeWidth={3} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--aura-display)', fontWeight: 600, fontSize: 14, color: 'var(--aura-ink)', lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function SegQuestion({ q, options, value, onChange }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--aura-display)', fontWeight: 600, fontSize: 14,
        color: 'var(--aura-ink)', marginBottom: 8, lineHeight: 1.25, textWrap: 'pretty',
      }}>{q}</div>
      <div style={{
        display: 'flex', gap: 6,
        background: 'color-mix(in oklab, var(--aura-ink) 6%, transparent)',
        borderRadius: 12, padding: 4,
      }}>
        {options.map((o) => {
          const active = value === o;
          return (
            <button key={o} onClick={() => onChange(o)} style={{
              flex: 1, appearance: 'none', border: 'none', cursor: 'pointer',
              borderRadius: 9, padding: '9px 8px',
              fontFamily: 'var(--aura-display)', fontSize: 13, fontWeight: 600,
              background: active ? 'var(--aura-ink)' : 'transparent',
              color: active ? 'var(--aura-bg)' : 'color-mix(in oklab, var(--aura-ink) 60%, transparent)',
              transition: 'all .15s',
            }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 10,
        letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700,
        color: 'color-mix(in oklab, var(--aura-ink) 55%, transparent)', marginBottom: 6,
      }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          appearance: 'none', width: '100%', boxSizing: 'border-box',
          background: 'var(--aura-chip, white)',
          border: '1.5px solid color-mix(in oklab, var(--aura-ink) 10%, transparent)',
          borderRadius: 14, padding: '14px 14px',
          fontFamily: 'var(--aura-display)', fontSize: 15, fontWeight: 500,
          color: 'var(--aura-ink)', outline: 'none',
        }}
      />
    </div>
  );
}

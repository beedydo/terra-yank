// AURA Chat — Talk to Aura, your private coach.
// Uses window.claude.complete with archetype-anchored system context.
// Supports voice input via Web Speech API (where available) and optional TTS playback.

const { useState: useSC, useEffect: useEC, useRef: useRC, useMemo: useMC } = React;

// Anchored conversation starters (shown only on the empty state)
const AURA_CHAT_STARTERS = [
  { label: 'Help me reply to a text I\u2019m dreading', seed: "Help me reply to a text I\u2019ve been avoiding. I\u2019ll paste it next." },
  { label: 'I\u2019m spiralling about a small thing', seed: "I\u2019m spiralling about something small. Talk me down before I do anything dumb." },
  { label: 'Rehearse a hard conversation', seed: "I need to rehearse a hard conversation. You play the other person." },
  { label: 'What\u2019s actually going on with me?', seed: "Something is off and I can\u2019t name it. Help me figure out what I\u2019m actually feeling." },
];

function buildAuraSystem(archetype) {
  const name = archetype?.name || 'Unsure (no archetype yet)';
  const tagline = archetype?.tagline || '';
  const pattern = archetype?.pattern || '';
  return `You are AURA — a warm, candid, psychology-informed private coach living inside a Singapore relationships + growth app. The user has just completed a quiz that placed them in the archetype "${name}" (${tagline}). Their pattern: ${pattern}

Voice rules:
- Speak like a wise, slightly Singaporean friend. Light Singlish ("lah", "sia", "leh") is fine when it lands; never forced. Never sound like a therapist or a self-help book.
- Keep replies SHORT — 2 to 4 sentences. Bullet lists only when the user asks for steps.
- One focused question back per turn, max. If you don't need to ask anything, don't.
- Anchor your reading of them in their archetype pattern when relevant. Don't repeat the archetype name back at them every turn.

What to do:
- When they're spiraling, slow it down: name the actual feeling underneath, then give them ONE tiny experiment (one sentence to send, one breath to take, one thing to notice).
- When they want to rehearse, play the other person crisply and stop in character to check in.
- When they ask for advice, give a real opinion. Don't fence-sit.
- Never moralize. Never diagnose. Never recommend professional help unless they describe self-harm or someone is in danger — then do so briefly and warmly.
- Don't pretend to remember past sessions you don't have access to.

Start the conversation by acknowledging where they are, not by re-introducing yourself.`;
}

function ChatWithAuraScreen({ archetype, onBack }) {
  const opening = useMC(() => {
    const first = (archetype?.name || 'friend').split(' ')[0];
    return `Hey. You just landed on ${archetype?.name || 'no archetype yet'} \u2014 ${archetype?.tagline || 'still figuring it out'}. What\u2019s loud in your head right now?`;
  }, [archetype]);

  const [messages, setMessages] = useSC([{ role: 'aura', text: opening }]);
  const [input, setInput] = useSC('');
  const [loading, setLoading] = useSC(false);
  const [listening, setListening] = useSC(false);
  const [speakOn, setSpeakOn] = useSC(false);
  const [voiceSupported, setVoiceSupported] = useSC(false);

  const scrollRef = useRC(null);
  const recogRef = useRC(null);
  const inputRef = useRC(null);

  // Autoscroll on new messages / loading dots
  useEC(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Set up SpeechRecognition (if available)
  useEC(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-SG';
    r.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.abort(); } catch (e) {} };
  }, []);

  function toggleMic() {
    const r = recogRef.current;
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch (e) {}
      setListening(false);
    } else {
      try { r.start(); setListening(true); } catch (e) {}
    }
  }

  function speak(text) {
    if (!speakOn || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02; u.pitch = 1.0; u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user', text }];
    setMessages(newMsgs);
    setLoading(true);

    // Build messages payload: system context as first user/assistant pair, then real history
    const systemContext = buildAuraSystem(archetype);
    const history = newMsgs.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
    const payload = {
      messages: [
        { role: 'user', content: `[SYSTEM — do not repeat this back to the user]\n\n${systemContext}\n\nWhen you understand, reply with exactly: ready` },
        { role: 'assistant', content: 'ready' },
        ...history,
      ],
    };

    try {
      const reply = (await window.claude.complete(payload)).trim();
      setMessages([...newMsgs, { role: 'aura', text: reply }]);
      speak(reply);
    } catch (err) {
      setMessages([...newMsgs, { role: 'aura', text: 'Lost the thread for a second \u2014 say that again?' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const hue = archetype?.hue ?? 280;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background:
        `radial-gradient(120% 60% at 20% 0%, oklch(0.32 0.14 ${hue} / 0.65) 0%, transparent 60%),
         radial-gradient(120% 60% at 90% 100%, oklch(0.3 0.14 ${(hue + 60) % 360} / 0.55) 0%, transparent 60%),
         linear-gradient(180deg, oklch(0.18 0.06 280) 0%, oklch(0.12 0.04 280) 100%)`,
      color: 'white', position: 'relative', overflow: 'hidden',
    }}>
      {/* status-bar safe area */}
      <div style={{ height: 50, flex: '0 0 auto' }} />

      {/* Header */}
      <div style={{
        padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(0,0,0,0.18)',
        flex: '0 0 auto',
      }}>
        <button onClick={onBack} aria-label="back" style={{
          border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white',
          width: 34, height: 34, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <AuraIcon name="arrow-left" size={16} color="white" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <AuraOrb hue={hue} animated />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--aura-display)', fontWeight: 700, fontSize: 15,
              letterSpacing: '-0.01em',
            }}>Aura</div>
            <div style={{
              fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
              letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.62,
              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 99,
                background: 'oklch(0.82 0.18 145)',
                boxShadow: '0 0 6px oklch(0.82 0.18 145)',
                flex: '0 0 auto',
              }} />
              <span>anchored \u00b7 {archetype?.name?.toLowerCase() || 'no archetype'}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (!speakOn) setSpeakOn(true);
            else { setSpeakOn(false); window.speechSynthesis?.cancel(); }
          }}
          title="Read replies aloud"
          aria-pressed={speakOn}
          style={{
            border: 'none',
            background: speakOn ? 'white' : 'rgba(255,255,255,0.1)',
            color: speakOn ? '#1a1410' : 'white',
            width: 34, height: 34, borderRadius: 99, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>
          {speakOn ? '🔊' : '🔈'}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '18px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} />
        ))}
        {loading && <TypingBubble />}

        {/* Starters (only show when conversation is fresh) */}
        {messages.length <= 1 && !loading && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
              letterSpacing: '.2em', textTransform: 'uppercase',
              opacity: 0.5, padding: '0 2px',
            }}>try opening with</div>
            {AURA_CHAT_STARTERS.map((s, i) => (
              <button key={i} onClick={() => send(s.seed)} style={{
                textAlign: 'left', border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)', color: 'white',
                borderRadius: 14, padding: '11px 14px',
                fontSize: 13.5, lineHeight: 1.3, cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 6 }} />
      </div>

      {/* Input bar */}
      <div style={{
        flex: '0 0 auto', padding: '10px 12px 16px',
        background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.08)', borderRadius: 999,
          padding: '5px 5px 5px 16px',
          border: listening
            ? `1.5px solid oklch(0.82 0.2 ${hue})`
            : '1.5px solid rgba(255,255,255,0.08)',
          transition: 'border-color .2s ease',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={listening ? 'listening\u2026' : 'tell aura what\u2019s on your mind'}
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              color: 'white', fontSize: 14, fontFamily: 'inherit',
              padding: '10px 0',
            }}
          />
          {voiceSupported && (
            <button onClick={toggleMic} aria-label="voice" style={{
              border: 'none', cursor: 'pointer',
              width: 36, height: 36, borderRadius: 99,
              background: listening
                ? `oklch(0.78 0.18 ${hue})`
                : 'rgba(255,255,255,0.1)',
              color: listening ? '#1a1410' : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
              boxShadow: listening
                ? `0 0 0 4px oklch(0.78 0.18 ${hue} / 0.25), 0 0 16px oklch(0.78 0.18 ${hue} / 0.4)`
                : 'none',
              transition: 'all .2s ease',
            }}>
              <MicGlyph />
            </button>
          )}
          <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="send" style={{
            border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
            width: 36, height: 36, borderRadius: 99,
            background: input.trim() && !loading ? 'white' : 'rgba(255,255,255,0.12)',
            color: input.trim() && !loading ? '#1a1410' : 'rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s ease',
          }}>
            <AuraIcon name="arrow-right" size={16}
              color={input.trim() && !loading ? '#1a1410' : 'rgba(255,255,255,0.4)'}
              strokeWidth={2.6} />
          </button>
        </div>
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--aura-mono, "JetBrains Mono")', fontSize: 9,
          letterSpacing: '.18em', textTransform: 'uppercase',
          opacity: 0.4, textAlign: 'center',
        }}>
          private \u00b7 ephemeral \u00b7 not therapy
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '84%', display: 'flex', flexDirection: 'column',
      animation: 'aura-rise .35s cubic-bezier(.2,.7,.2,1) both',
    }}>
      <div style={{
        padding: '10px 14px',
        borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
        background: isUser
          ? 'linear-gradient(135deg, oklch(0.82 0.18 60), oklch(0.78 0.2 30))'
          : 'rgba(255,255,255,0.07)',
        color: isUser ? '#1a1410' : 'white',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
        fontSize: 14, lineHeight: 1.45,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontWeight: isUser ? 600 : 400,
      }}>
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ alignSelf: 'flex-start' }}>
      <div style={{
        padding: '14px 16px', borderRadius: '18px 18px 18px 6px',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: 99, background: 'white', opacity: 0.7,
            animation: `aura-blink-slow 1.2s ${i * 0.15}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function AuraOrb({ hue = 280, animated = false }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', flex: '0 0 auto',
      background:
        `radial-gradient(circle at 30% 30%,
          oklch(0.95 0.06 ${hue}) 0%,
          oklch(0.78 0.18 ${hue}) 45%,
          oklch(0.42 0.2 ${(hue + 40) % 360}) 100%)`,
      boxShadow:
        `0 0 14px oklch(0.7 0.22 ${hue} / 0.55),
         inset 0 -4px 6px oklch(0.35 0.18 ${hue})`,
      animation: animated ? 'aura-pulse 3.2s ease-in-out infinite' : 'none',
    }} />
  );
}

function MicGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3"/>
      <path d="M5 11a7 7 0 0014 0M12 18v3"/>
    </svg>
  );
}

window.ChatWithAuraScreen = ChatWithAuraScreen;

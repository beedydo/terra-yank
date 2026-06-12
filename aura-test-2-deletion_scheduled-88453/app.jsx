// AURA root app — orchestrates screens + tweaks panel + iOS frame.

const { useState: useS, useEffect: useE, useMemo: useM } = React;

const AURA_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "sunset",
  "singlish": 2,
  "progress": "meter",
  "previewArchetype": "auto"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(AURA_TWEAK_DEFAULTS);
  // 'landing' -> 'quiz' -> 'results' -> 'lead' -> 'landing'
  const [route, setRoute] = useS('landing');
  const [scores, setScores] = useS({ SR: 0, RB: 0, CS: 0 });

  // Apply palette as CSS variables on the phone surface.
  const palette = window.AURA_PALETTES[t.palette] || window.AURA_PALETTES.sunset;
  const cssVars = {
    '--aura-bg': palette.bg,
    '--aura-ink': palette.ink,
    '--aura-accent': palette.accent,
    '--aura-accent2': palette.accent2,
    '--aura-soft': palette.soft,
    '--aura-chip': palette.chip,
    '--aura-grad': palette.gradient,
    '--aura-display': '"Bricolage Grotesque", "Inter", system-ui, sans-serif',
    '--aura-italic': '"Instrument Serif", Georgia, serif',
    '--aura-mono': '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    color: palette.ink,
  };

  // Archetype preview override: when set + we're on results, force that archetype.
  const archetypeOverride = t.previewArchetype && t.previewArchetype !== 'auto' ? t.previewArchetype : null;

  // Auto-jump to results when previewArchetype is set
  useE(() => {
    if (archetypeOverride && route === 'landing') {
      // pre-fill plausible scores for the preview
      const a = window.AURA_ARCHETYPES.find((x) => x.id === archetypeOverride);
      if (a) setScores(a.target);
      setRoute('results');
    }
  }, [archetypeOverride]);

  function startQuiz() {
    setTweak('previewArchetype', 'auto');
    setRoute('quiz');
  }
  function onQuizDone(s) {
    setScores(s);
    setRoute('results');
  }
  function continueToHome() {
    setRoute('home');
  }
  function continueToLead() {
    setRoute('lead');
  }
  function openChat() {
    setRoute('chat');
  }
  function backToHome() {
    setRoute('home');
  }
  function restart() {
    setTweak('previewArchetype', 'auto');
    setRoute('landing');
  }

  let screen;
  if (route === 'landing') {
    screen = <LandingScreen onStart={startQuiz} lang={t.singlish} />;
  } else if (route === 'quiz') {
    screen = (
      <QuizScreen
        onComplete={onQuizDone}
        lang={t.singlish}
        progressStyle={t.progress}
      />
    );
  } else if (route === 'results') {
    screen = (
      <ResultsScreen
        scores={scores}
        onContinue={continueToHome}
        onRestart={restart}
        archetypeOverride={archetypeOverride}
      />
    );
  } else if (route === 'home') {
    const a = archetypeOverride
      ? window.AURA_ARCHETYPES.find((x) => x.id === archetypeOverride)
      : window.AURA_pickArchetype(scores);
    screen = <HomeScreen archetype={a} onContinue={continueToLead} onOpenChat={openChat} />;
  } else if (route === 'chat') {
    const a = archetypeOverride
      ? window.AURA_ARCHETYPES.find((x) => x.id === archetypeOverride)
      : window.AURA_pickArchetype(scores);
    screen = <ChatWithAuraScreen archetype={a} onBack={backToHome} />;
  } else if (route === 'lead') {
    screen = <LeadCaptureScreen onSubmit={restart} onSkip={restart} />;
  }

  return (
    <>
      <div style={cssVars}>
        <IOSDevice width={402} height={874}>
          {/* phone surface with theme vars */}
          <div style={{
            ...cssVars,
            width: '100%', height: '100%', position: 'relative',
            background: palette.bg,
          }}>
            {screen}
          </div>
        </IOSDevice>
      </div>

      <TweaksPanel title="AURA tweaks">
        <TweakSection label="Look" />
        <TweakColor
          label="Palette"
          value={[palette.accent, palette.accent2, palette.bg]}
          options={Object.values(window.AURA_PALETTES).map((p) => [p.accent, p.accent2, p.bg])}
          onChange={(v) => {
            const found = Object.entries(window.AURA_PALETTES)
              .find(([_, p]) => p.accent.toLowerCase() === String(v[0]).toLowerCase());
            setTweak('palette', found ? found[0] : 'sunset');
          }}
        />

        <TweakSection label="Voice" />
        <TweakRadio
          label="Singlish"
          value={String(t.singlish)}
          options={[
            { value: '0', label: 'subtle' },
            { value: '1', label: 'light' },
            { value: '2', label: 'medium' },
            { value: '3', label: 'full lah' },
          ]}
          onChange={(v) => setTweak('singlish', Number(v))}
        />

        <TweakSection label="Quiz" />
        <TweakRadio
          label="Progress"
          value={t.progress}
          options={[
            { value: 'bar',   label: 'bar' },
            { value: 'meter', label: 'meter' },
            { value: 'dots',  label: 'dots' },
          ]}
          onChange={(v) => setTweak('progress', v)}
        />

        <TweakSection label="Preview" />
        <TweakSelect
          label="Archetype"
          value={t.previewArchetype}
          options={[
            { value: 'auto', label: 'from quiz' },
            ...window.AURA_ARCHETYPES.map((a) => ({ value: a.id, label: a.name })),
          ]}
          onChange={(v) => {
            setTweak('previewArchetype', v);
            if (v !== 'auto') {
              const a = window.AURA_ARCHETYPES.find((x) => x.id === v);
              if (a) setScores(a.target);
              setRoute('results');
            }
          }}
        />

        <TweakSection label="Flow" />
        <TweakButton label="Back to landing" onClick={restart} />
      </TweaksPanel>
    </>
  );
}

window.App = App;

// AURA data: dimensions, questions, archetypes (SG foods), scoring.
// Dimensions: SR = Self-Regard, RB = Relationship Beliefs, CS = Communication Style.

window.AURA_DIMENSIONS = [
  {
    key: 'SR', name: 'Self-Regard', label: 'Self', short: 'self',
    blurb: 'How grounded you feel in your own skin.',
    low: 'self-critical', high: 'self-accepting', hue: 18,
  },
  {
    key: 'RB', name: 'Relationship Beliefs', label: 'Love', short: 'love',
    blurb: 'What you quietly assume about love and commitment.',
    low: 'anxious / avoidant', high: 'secure & realistic', hue: 320,
  },
  {
    key: 'CS', name: 'Communication Style', label: 'Voice', short: 'voice',
    blurb: 'How you show up in the hard conversations.',
    low: 'withdrawing', high: 'direct & open', hue: 260,
  },
];

// Singlish levels: 0 subtle, 1 light, 2 medium, 3 full lah.
window.AURA_QUESTIONS = [
  // ── SELF-REGARD ──────────────────────────────────────────────
  { id: 'q1', dim: 'SR',
    scene: ['Family dinner', 'Family dinner', 'CNY dinner', 'CNY reunion dinner'],
    prompt: [
      "Your aunt corners you and asks why you're still single. You:",
      "Auntie corners you at dinner and asks why you're still single. You:",
      "Auntie corner you and ask why you still single. You:",
      "Auntie corner you, ask why you still single sia. You:",
    ],
    options: [
      { label: 'Laugh it off, pivot the topic', score: 0 },
      { label: 'Drop your rehearsed answer', score: -1 },
      { label: 'Feel a flash of shame but smile anyway', score: -2 },
      { label: "Honestly tell her you\u2019re figuring it out", score: 2 },
    ],
  },
  { id: 'q2', dim: 'SR',
    scene: ['Mirror moment', 'Mirror moment', 'Mirror check', 'Mirror check'],
    prompt: [
      "You catch your reflection in a shop window. First thought:",
      "You catch yourself in an Orchard shop window. First thought:",
      "You catch yourself in Orchard shop window. First thought is:",
      "You catch yourself in Orchard shop window leh. First thought is:",
    ],
    options: [
      { label: 'Lowkey, I look fine today', score: 2 },
      { label: 'Suck in stomach, walk past', score: -1 },
      { label: 'Mental list of things to fix', score: -2 },
      { label: "Don\u2019t really notice, keep going", score: 1 },
    ],
  },
  { id: 'q3', dim: 'SR',
    scene: ['Feed scroll', 'IG scroll', 'IG scroll', 'IG scroll'],
    prompt: [
      "A friend posts their engagement. Your honest reaction:",
      "A friend posts their proposal on IG. Honest reaction:",
      "Friend post proposal on IG. Honest reaction sia:",
      "Friend post proposal on IG sia. Honest reaction:",
    ],
    options: [
      { label: 'Genuinely happy, tap the heart', score: 2 },
      { label: 'Happy for them, sting for you', score: 0 },
      { label: '\u201CWhy not me\u201D spiral, 10min', score: -2 },
      { label: 'Mute the story, move on', score: -1 },
    ],
  },
  { id: 'q4', dim: 'SR',
    scene: ['Work meeting', 'Standup', 'Standup', 'Standup leh'],
    prompt: [
      "Your boss publicly picks apart your idea. After:",
      "Boss picks apart your idea in standup. After meeting:",
      "Boss tear your idea apart in standup. After, you:",
      "Boss whack your idea in standup. After meeting you:",
    ],
    options: [
      { label: 'Note the valid points, drop the sting', score: 2 },
      { label: 'Replay it in the shower tonight', score: -1 },
      { label: "Decide you\u2019re not cut out for this", score: -2 },
      { label: "Shrug \u2014 the boss is also wrong sometimes", score: 1 },
    ],
  },
  { id: 'q5', dim: 'SR',
    scene: ['Plans cancelled', 'Plans cancelled', 'Date cancel', 'Date cancel sia'],
    prompt: [
      "A date cancels two hours before. You:",
      "Date cancels on you 2hrs before. You:",
      "Date cancel on you 2hr before. You:",
      "Date cancel on you 2hr before sia. You:",
    ],
    options: [
      { label: 'Reroute the evening, treat yourself', score: 2 },
      { label: 'Bummed but text a friend to hang', score: 1 },
      { label: "Assume they\u2019re losing interest", score: -2 },
      { label: 'Reread the chat for clues', score: -1 },
    ],
  },

  // ── RELATIONSHIP BELIEFS ─────────────────────────────────────
  { id: 'q6', dim: 'RB',
    scene: ['Friend talk', 'Brunch chat', 'Brunch chat', 'Brunch chat'],
    prompt: [
      "A friend says \u201Cyou\u2019ll find someone eventually.\u201D You think:",
      "Friend tells you \u201Cyou\u2019ll find someone lah.\u201D You think:",
      "Friend say \u201Cyou\u2019ll find someone lah.\u201D Inside you think:",
      "Friend say \u201Cwill find one lah, relax.\u201D Inside you think:",
    ],
    options: [
      { label: "Maybe. Either way I\u2019m okay", score: 2 },
      { label: 'I hope so. Soon, please', score: 0 },
      { label: 'What if eventually never comes', score: -2 },
      { label: "I\u2019d rather just be alone, honestly", score: -1 },
    ],
  },
  { id: 'q7', dim: 'RB',
    scene: ['Hawker centre', 'Hawker centre', 'Hawker centre', 'Hawker centre'],
    prompt: [
      "You spot an older couple silently sharing a meal. You feel:",
      "Old couple at Maxwell, eating quiet quiet. You feel:",
      "Uncle auntie at Maxwell, eat quiet quiet. You feel:",
      "Uncle auntie at Maxwell, eat quiet quiet leh. You feel:",
    ],
    options: [
      { label: "Comfortable, that\u2019s the dream", score: 2 },
      { label: 'A pinch of envy', score: 0 },
      { label: 'Sad \u2014 will I ever get there?', score: -2 },
      { label: 'Bored just looking at them', score: -1 },
    ],
  },
  { id: 'q8', dim: 'RB',
    scene: ['New match', 'Tinder match', 'Tinder match', 'Tinder match'],
    prompt: [
      "Fresh match. Their bio is short but you like the vibe. You:",
      "New match. Bio short but vibe is there. You:",
      "New match leh. Bio short but vibe got. You:",
      "New match leh. Bio short but vibe got. You:",
    ],
    options: [
      { label: 'Send a real opener, no pressure', score: 2 },
      { label: 'Wait for them to text first', score: -1 },
      { label: 'Stalk all 412 IG posts before replying', score: -2 },
      { label: 'Send a one-liner, see what comes back', score: 1 },
    ],
  },
  { id: 'q9', dim: 'RB',
    scene: ['30th birthday', '30th birthday', '30th birthday', '30th birthday'],
    prompt: [
      "A close friend hits 30, still very single. You quietly think:",
      "Close friend turning 30, still single. You quietly think:",
      "Close friend hit 30 still single. Quietly you think:",
      "Close friend hit 30 still single sia. Quietly you think:",
    ],
    options: [
      { label: 'Their timeline is theirs, not mine', score: 2 },
      { label: 'Hope they meet someone soon', score: 1 },
      { label: "Gosh, that\u2019s scary \u2014 could be me", score: -2 },
      { label: 'Honestly, better than a bad partner', score: 0 },
    ],
  },
  { id: 'q10', dim: 'RB',
    scene: ['Next step', 'Next step', 'Next step', 'Next step'],
    prompt: [
      "Partner suggests the next relationship step. Your gut:",
      "Partner suggests the next relationship step. Your gut:",
      "Partner bring up the next relationship step. Your gut:",
      "Partner bring up the next relationship step leh. Your gut:",
    ],
    options: [
      { label: "Excited \u2014 let\u2019s plan it out", score: 2 },
      { label: 'Open, but want a few more months', score: 1 },
      { label: 'Panic \u2014 what if it ruins us', score: -2 },
      { label: 'Resist \u2014 I need my own space', score: -1 },
    ],
  },

  // ── COMMUNICATION STYLE ──────────────────────────────────────
  { id: 'q11', dim: 'CS',
    scene: ['Friend feedback', 'Friend feedback', 'Friend talk', 'Friend talk'],
    prompt: [
      "A friend says you come across cold when stressed. You:",
      "Friend tells you, you come across cold when stressed. You:",
      "Friend tell you, when stress you come across cold. You:",
      "Friend say when you stress you come across cold sia. You:",
    ],
    options: [
      { label: 'Thank them, sit with it later', score: 2 },
      { label: 'Ask for a specific example', score: 2 },
      { label: 'Defensive inside, polite outside', score: -1 },
      { label: 'Brush it off \u2014 you know yourself', score: -2 },
    ],
  },
  { id: 'q12', dim: 'CS',
    scene: ['Text gone quiet', 'Texts dry up', 'Text dry up', 'Text dry up'],
    prompt: [
      "Two weeks of texting. They go quiet. You:",
      "Two weeks texting them. They go quiet. You:",
      "Two weeks text them. Suddenly quiet. You:",
      "Two weeks text them, suddenly quiet sia. You:",
    ],
    options: [
      { label: 'Send one honest check-in', score: 2 },
      { label: 'Wait it out, no spiral', score: 1 },
      { label: 'Double-text \u2014 life is short', score: 0 },
      { label: 'Replay every message for mistakes', score: -2 },
    ],
  },
  { id: 'q13', dim: 'CS',
    scene: ['Group chat fight', 'Group chat fight', 'GC fight', 'GC drama'],
    prompt: [
      "Two friends start sniping at each other in the group chat. You:",
      "Two friends sniping at each other in the GC. You:",
      "Two friend start whack each other in GC. You:",
      "Two friend whack each other in GC sia. You:",
    ],
    options: [
      { label: "Surface what you\u2019re seeing, gently", score: 2 },
      { label: 'DM each one separately', score: 1 },
      { label: 'Mute the chat, deal with it later', score: -2 },
      { label: 'Pick a side, send a meme', score: -1 },
    ],
  },
  { id: 'q14', dim: 'CS',
    scene: ['\u201CYou okay?\u201D', '\u201CYou okay?\u201D', '\u201CYou ok anot?\u201D', '\u201CYou ok anot?\u201D'],
    prompt: [
      "Your partner asks \u201Care you okay?\u201D. You\u2019re not. You:",
      "Partner asks \u201Care you okay or not?\u201D. You\u2019re not. You:",
      "Partner ask \u201Cyou ok anot?\u201D. You\u2019re not. You:",
      "Partner ask \u201Cyou ok anot?\u201D. You\u2019re not sia. You:",
    ],
    options: [
      { label: "Say so. Even if it\u2019s messy", score: 2 },
      { label: "\u201CI\u2019m fine\u201D \u2014 talk later", score: -1 },
      { label: 'Ask for a hug instead of words', score: 1 },
      { label: 'Withdraw. Need a day alone first', score: -2 },
    ],
  },
  { id: 'q15', dim: 'CS',
    scene: ['Hard call', 'Hard call', 'Hard call', 'Hard call'],
    prompt: [
      "A friend keeps making a choice you think is wrecking them. You:",
      "Friend keeps making a choice you think is wrecking them. You:",
      "Friend keep making bad choice that wreck them. You:",
      "Friend keep make bad choice that wreck them sia. You:",
    ],
    options: [
      { label: 'Tell them straight, gently', score: 2 },
      { label: 'Hint a few times, hope they catch on', score: 0 },
      { label: "Stay quiet, it\u2019s their life", score: -1 },
      { label: 'Vent about it to other friends', score: -2 },
    ],
  },
];

// ─── SG FOOD ARCHETYPES ──────────────────────────────────────────
window.AURA_ARCHETYPES = [
  {
    id: 'kopi',
    name: 'Kopi-O Kosong',
    tagline: 'no sugar, no nonsense, deep brew',
    pattern: 'High self-acceptance, secure in relationships, direct in conversation. You stay clear about what you want without performing it.',
    description:
      "Black, bitter, honest. You don\u2019t dress yourself up for anyone \u2014 least of all someone you\u2019re trying to date. People trust you because you start with your own truth. Growth edge: letting someone water down the routine without losing the bean.",
    target: { SR: 7, RB: 6, CS: 6 },
    hue: 28,
  },
  {
    id: 'boba',
    name: 'Brown Sugar Boba',
    tagline: 'every sip a thought, every thought a question',
    pattern: 'Emotionally fluent and expressive, but anxious in relationships and quick to over-read small signals. You feel a lot, fast.',
    description:
      "Sweet, layered, never just one note. You feel everything in HD and reread every text three times \u2014 yours and theirs. The pearls at the bottom are 47 unspoken thoughts. The work isn\u2019t feeling less, it\u2019s saying more before the cup empties.",
    target: { SR: 3, RB: -2, CS: 5 },
    hue: 22,
  },
  {
    id: 'mala',
    name: 'Mala Xiang Guo',
    tagline: 'main-character heat, side-quest aftermath',
    pattern: 'High openness and intensity, but harder on yourself than on anyone else. You commit fully, then burn out.',
    description:
      "Custom-built, all-or-nothing, the spiciest tier by default. You go in hard \u2014 on hobbies, on people, on Sundays in bed \u2014 and burn out spectacularly. The gap between the version you order and the one you can actually finish is real. Less peppercorn, more long simmer.",
    target: { SR: -3, RB: 2, CS: 5 },
    hue: 12,
  },
  {
    id: 'durian',
    name: 'Durian Heart',
    tagline: 'thorns out, custard in',
    pattern: 'Strong sense of self, more guarded with others. You\u2019d rather be alone than misunderstood.',
    description:
      "King-of-fruits energy: polarising, self-contained, allergic to small talk. Once someone gets past the spikes, they get the real stuff \u2014 but you\u2019d rather they prove themselves first. Growth edge isn\u2019t softening up; it\u2019s not making every person sit a placement test on the way in.",
    target: { SR: 7, RB: -4, CS: -5 },
    hue: 90,
  },
  {
    id: 'milo',
    name: 'Milo Dinosaur',
    tagline: 'extra topping, extra everything',
    pattern: 'Warm, generous, communicative \u2014 you show up for others first. Quietly hard on yourself in private.',
    description:
      "Warm, generous, beloved \u2014 yes to one more round, yes to listening till 2am. You\u2019d rather be the dependable one than the honest one. The work isn\u2019t pouring less. It\u2019s noticing what you actually want before you scoop for someone else.",
    target: { SR: -4, RB: 5, CS: 4 },
    hue: 38,
  },
  {
    id: 'chendol',
    name: 'Chendol Daydreamer',
    tagline: 'looks simple, tastes complicated',
    pattern: 'Rich inner world, quieter outer one. You rehearse conversations more than you have them.',
    description:
      "Layers nobody asked you about. Soft shaved ice on top, jelly thoughts in the middle, a sugar-thick bottom of feelings you\u2019d rather not stir. You imagine the whole relationship before you say hi. What if the first move was just being seen mid-melt?",
    target: { SR: 2, RB: -3, CS: -3 },
    hue: 130,
  },
];

window.AURA_INSIGHTS = {
  kopi: [
    { tag: 'In dating', text: "You\u2019ll read a partner\u2019s clarity as relief, not pressure. Look for someone who can match the directness." },
    { tag: 'Try this', text: "For one week, share one thing you\u2019re unsure about \u2014 not just one you\u2019ve already decided." },
  ],
  boba: [
    { tag: 'In dating', text: "Your feelings move fast; your decisions don\u2019t need to. Build in 72 hours before defining the relationship in your head." },
    { tag: 'Try this', text: "Next time you draft a six-paragraph text, send the one-sentence version. See what comes back." },
  ],
  mala: [
    { tag: 'In dating', text: "Intensity reads as chemistry at the start, exhaustion by week six. Notice which feelings are heat and which are flavour." },
    { tag: 'Try this', text: "Pick one ongoing thing and dial it down a level on purpose. Watch what actually changes." },
  ],
  durian: [
    { tag: 'In dating', text: "Your independence is real, not a wall. Tell people early which parts of you are inside the husk, and which spikes are just decor." },
    { tag: 'Try this', text: "Ask for help with something you can do yourself. Practise it once a week." },
  ],
  milo: [
    { tag: 'In dating', text: "You confuse being chosen with being safe. Notice when you\u2019re saying yes from fear, not from want." },
    { tag: 'Try this', text: "For one week, pause five seconds before agreeing to any plan." },
  ],
  chendol: [
    { tag: 'In dating', text: "Your imagination is doing the work of a first conversation. The actual one is usually less scary." },
    { tag: 'Try this', text: "Send the message you\u2019ve drafted twice. Not a perfect one \u2014 the one you actually have." },
  ],
};

window.AURA_pickArchetype = function (scores) {
  let best = null, bestD = Infinity;
  for (const a of window.AURA_ARCHETYPES) {
    const d =
      Math.pow(a.target.SR - scores.SR, 2) +
      Math.pow(a.target.RB - scores.RB, 2) +
      Math.pow(a.target.CS - scores.CS, 2);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
};

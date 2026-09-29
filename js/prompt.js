// Prompt de contingut per a Claude.ai (en anglès). Defineix el format de cada kanji.
// {{KANJI}} se substitueix pels kanji triats a la pantalla Afegir.
const Prompt = (() => {
  const TEMPLATE = `You are a Japanese teacher. Create study cards for these kanji: {{KANJI}}

I'm a beginner: I know hiragana and katakana, but few kanji. Every explanatory text
must be written in both Catalan ("ca") and English ("en").

Reply ONLY with one \`\`\`json code block containing a list of objects with exactly
these fields:
[
  {
    "kanji": "日",
    "meanings": { "ca": ["sol", "dia"], "en": ["sun", "day"] },
    "onyomi": ["ニチ", "ジツ"],
    "kunyomi": ["ひ", "か"],
    "strokes": 4,
    "jlpt": 5,
    "emoji": "☀️",
    "origin": { "ca": "", "en": "" },
    "mnemonic": { "ca": "", "en": "" },
    "examples": [
      { "word": "日本", "reading": "にほん", "meaning": { "ca": "Japó", "en": "Japan" } }
    ],
    "sentence": { "jp": "", "reading": "", "meaning": { "ca": "", "en": "" } },
    "trivia": { "ca": "", "en": "" },
    "verified": false
  }
]

Rules:
- On'yomi in katakana; kun'yomi in hiragana, with okurigana separated by a dot (た.べる).
- 2-3 examples of very common words, JLPT N5-N4 level when possible.
- One short, simple example sentence; "reading" is the whole sentence in hiragana.
- "origin": the real origin of the character ONLY if you are sure; otherwise leave
  both texts empty (""). Never invent etymologies.
- "mnemonic": a short image or story to remember it (it may be invented).
- "trivia": only if it is genuinely interesting or useful; otherwise "".
- "emoji": the one that best represents it, or "" if none fits.
- Keep texts short: at most 25 words per text.
- "verified" is always false.`;
  return { build: list => TEMPLATE.replace('{{KANJI}}', list.join('、')) };
})();

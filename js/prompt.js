// Prompt de contingut per a Claude.ai (en anglès). Defineix el format de cada kanji.
// {{KANJI}} se substitueix pels kanji triats a la pantalla Afegir.
const Prompt = (() => {
  const TEMPLATE = `You are a Japanese teacher. Create study cards for these kanji: {{KANJI}}

I'm a beginner: I know hiragana and katakana, but few kanji. Every explanatory text
must be written in Catalan ("ca"), Spanish ("es") and English ("en").

Reply ONLY with one \`\`\`json code block containing a list of objects with exactly
these fields:
[
  {
    "kanji": "日",
    "meanings": { "ca": ["sol", "dia"], "es": ["sol", "día"], "en": ["sun", "day"] },
    "onyomi": ["ニチ", "ジツ"],
    "kunyomi": ["ひ", "か"],
    "strokes": 4,
    "jlpt": 5,
    "emoji": "☀️",
    "origin": { "ca": "", "es": "", "en": "" },
    "mnemonic": { "ca": "", "es": "", "en": "" },
    "examples": [
      { "word": "日本", "reading": "にほん", "meaning": { "ca": "Japó", "es": "Japón", "en": "Japan" } }
    ],
    "sentence": { "jp": "", "reading": "", "meaning": { "ca": "", "es": "", "en": "" } },
    "trivia": { "ca": "", "es": "", "en": "" },
    "verified": false
  }
]

Rules:
- On'yomi in katakana; kun'yomi in hiragana, with okurigana separated by a dot (た.べる).
- 2-3 examples of very common words, JLPT N5-N4 level when possible.
- One short, simple example sentence; "reading" is the whole sentence in hiragana.
- "origin": the real origin of the character ONLY if you are sure; otherwise leave
  all texts empty (""). Never invent etymologies.
- "mnemonic": a short image or story to remember it (it may be invented).
- "trivia": only if it is genuinely interesting or useful; otherwise "".
- "emoji": the one that best represents it, or "" if none fits.
- Keep texts short: at most 25 words per text.
- "verified" is always false.

Language style:
- Write each language the way people normally speak it today: clear, simple and
  natural. Not slang, but not literary or formal either. Don't translate word for
  word from English; write each version directly in its own language.
- Catalan: everyday standard Catalan, as spoken in Catalonia today. Use the
  periphrastic past ("va afegir", "es va convertir en"), never the literary simple
  past ("afegí", "esdevingué"). Prefer common words: "convertir-se en" rather than
  "esdevenir", "abans" rather than "antigament".
- Spanish: natural, everyday Spanish from Spain.`;
  return { build: list => TEMPLATE.replace('{{KANJI}}', list.join('、')) };
})();

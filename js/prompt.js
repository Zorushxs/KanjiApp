// Prompts per a Claude.ai (en anglès). Tots dos acaben amb el mateix format de fitxa (FORMAT):
// - cards(): fitxes dels kanji que has escrit tu.
// - more(): que Claude en triï de nous sense repetir els que ja tens (quants, temàtica i paraules opcionals).
const Prompt = (() => {
  const FORMAT = `Every explanatory text must be written in Catalan ("ca"), Spanish ("es") and English ("en").

Reply ONLY with one \`\`\`json code block containing a list of objects with exactly
these fields:
[
  {
    "kanji": "日",
    "meanings": { "ca": ["sol", "dia"], "es": ["sol", "día"], "en": ["sun", "day"] },
    "onyomi": ["ニチ", "ジツ"],
    "kunyomi": ["ひ", "か"],
    "reading": "にち",
    "strokes": 4,
    "jlpt": 5,
    "emoji": "☀️",
    "origin": { "ca": "", "es": "", "en": "" },
    "mnemonic": { "ca": "", "es": "", "en": "" },
    "examples": [
      { "word": "日本", "reading": "にほん", "meaning": { "ca": "Japó", "es": "Japón", "en": "Japan" } }
    ],
    "sentence": { "jp": "", "reading": "", "romaji": "", "meaning": { "ca": "", "es": "", "en": "" } },
    "trivia": { "ca": "", "es": "", "en": "" },
    "verified": false
  }
]

Rules:
- On'yomi in katakana; kun'yomi in hiragana, with okurigana separated by a dot (た.べる).
- "reading": the reading a beginner's textbook teaches first for this kanji (e.g. 一 → いち),
  written in hiragana even if it is an on'yomi. It must be one of the readings above
  (for a kun'yomi with okurigana, the whole word without the dot: たべる).
- 2-3 examples of very common words, JLPT N5-N4 level when possible. Only use words that
  are normally written with this kanji in everyday Japanese; skip words that are usually
  written in kana even though they have a kanji (e.g. ください, きれい, りんご).
- One short, simple example sentence; "reading" is the whole sentence in hiragana and
  "romaji" is the whole sentence in Hepburn romaji, with spaces between words and the
  particles written as they are pronounced (wa, o, e).
- "origin": the real origin of the character ONLY if you are sure; otherwise leave
  all texts empty (""). Never invent etymologies. When you write it, give some detail:
  about 35-45 words (2-3 sentences), e.g. what the original drawing showed and how it changed.
- "mnemonic": a short image or story to remember it (it may be invented).
- "trivia": only if it is genuinely interesting or useful; otherwise "". When you
  write it, about 35-45 words (2-3 sentences).
- "emoji": the one that best represents it, or "" if none fits.
- Keep the other texts short: at most 25 words per text.
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

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  function cards(list) {
    return `You are a Japanese teacher. Create study cards for these kanji: ${list.join('、')}

I'm a beginner: I know hiragana and katakana, but few kanji. ${FORMAT}`;
  }

  const LANG = { ca: 'Catalan', es: 'Spanish', en: 'English' };

  // "Els kanjis que tinc apresos són [llista] i en vull aprendre X d'aquesta temàtica i/o d'aquestes paraules."
  // have: tots els kanji de la col·lecció; n: quants en vols; theme i words: opcionals, tal com els escrius;
  // lang: idioma de la interfície, per a l'avís de paraules que s'escriuen en kana.
  function more({ have, n, theme, words, lang }) {
    const t = clean(theme), w = clean(words);
    const known = have.length
      ? `The kanji I have already learned are: ${have.join(', ')}`
      : `I haven't learned any kanji yet.`;
    const about = t && `about this theme: "${t}"`;
    const from = w && `the ones needed to write these specific words: ${w} (they may be written in Catalan, Spanish or English)`;
    const want = about && from ? `${about}, and/or ${from}`
      : about || from || 'the most useful ones for a beginner, in the usual learning order (JLPT N5 first, then N4)';
    return `You are a Japanese teacher. I'm a beginner: I know hiragana and katakana.
${known}

I want to learn ${n} new kanji: ${want}.
Don't include any of the kanji I have already learned. Only choose kanji that are normally
used in everyday writing (not ones usually replaced by kana).${w ? ` If the words need more than ${n} new kanji, pick the most useful ones.
If one of my words is normally written in kana even though it has a kanji (e.g. りんご rather
than 林檎), don't choose kanji for it. Instead, before the \`\`\`json block, write one short line in
${LANG[lang] || 'Catalan'} listing those words and how they are normally written. That line is the only
text allowed outside the code block.` : ''}

Create a study card for each new kanji. ${FORMAT}`;
  }

  return { cards, more };
})();

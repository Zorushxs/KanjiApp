// Prompts per a Claude.ai (en anglès). Tots dos acaben amb el mateix format de fitxa (FORMAT); una fitxa
// pot ser un kanji sol o una paraula (学校, 食べる, じゃがいも):
// - cards(): fitxes dels kanji i paraules que has escrit tu.
// - more(): que Claude en triï de nous sense repetir els que ja tens (temàtica + quants, i paraules a més a més).
const Prompt = (() => {
  const FORMAT = `Every explanatory text must be written in Catalan ("ca"), Spanish ("es") and English ("en").

Reply ONLY with one \`\`\`json code block containing a list of card objects with exactly
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

A card is usually one kanji, like the example above. A card can also be a WORD (a compound
of several kanji, kanji with hiragana, or only kana). For a word card use the same fields, with:
- "kanji": the whole word as it is normally written in Japan (学校, 食べる, じゃがいも);
- "onyomi": [], "kunyomi": [] and "strokes": null;
- "reading": the whole word in hiragana (in katakana if the word is written in katakana);
- "jlpt": the level of the word; "origin": the origin of the word, only if you are sure;
- "examples": 2-3 short, common phrases that use the word.
A word made of one single kanji (like 木) is a normal kanji card.

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

  const clean = text => String(text || '').replace(/\s+/g, ' ').trim();

  // list: kanji sols i paraules (les paraules les escrius entre 「」 a la pantalla Afegir).
  function cards(list) {
    const kanji = list.filter(x => !Card.isWord(x)), words = list.filter(Card.isWord);
    const what = [
      kanji.length && `these kanji: ${kanji.join('、')}`,
      words.length && `these words: ${words.join('、')}`,
    ].filter(Boolean).join(', and ');
    return `You are a Japanese teacher. Create study cards for ${what}.

I'm a beginner: I know hiragana and katakana, but few kanji. ${FORMAT}`;
  }

  // "Els kanjis que tinc apresos són [llista] i en vull aprendre X d'aquesta temàtica; i, a més, aquestes paraules."
  // - have / haveWords: els kanji sols i les paraules que ja tens;
  // - n: quants kanji de la temàtica (o, sense temàtica ni paraules, dels més útils);
  // - words: paraules concretes, que van a més a més i no compten per a n.
  function more({ have, haveWords = [], n, theme, words }) {
    const themeText = clean(theme), wordsText = clean(words);
    const known = [
      have.length ? `The kanji I have already learned are: ${have.join(', ')}` : `I haven't learned any kanji yet.`,
      haveWords.length && `The words I have already learned are: ${haveWords.join(', ')}`,
    ].filter(Boolean).join('\n');

    const which = themeText
      ? `about this theme: "${themeText}"`
      : 'the most useful ones for a beginner, in the usual learning order (JLPT N5 first, then N4)';
    // Sense temàtica però amb paraules, només es demanen les paraules.
    const kanjiPart = (themeText || !wordsText) && `I want to learn ${n} new kanji: ${which}.
Only choose kanji that are normally used in everyday writing (not ones usually replaced by kana).`;

    const wordPart = wordsText && `${themeText ? 'In addition to those kanji, I' : 'I'} want to learn these specific words: ${wordsText}
(they may be written in Catalan, Spanish or English). For each one, choose the word a Japanese
person would normally use in everyday life, at beginner level, written the way it is normally
written in Japan: it can be a compound of several kanji, kanji with hiragana, or only kana
(e.g. patata → じゃがいも, not 芋; escola → 学校). Make a word card for each of these words, and
also a kanji card for each kanji in them that I haven't learned yet.`;

    return `You are a Japanese teacher. I'm a beginner: I know hiragana and katakana.
${known}

${[kanjiPart, wordPart].filter(Boolean).join('\n\n')}
Never repeat a kanji or a word I have already learned.

${FORMAT}`;
  }

  return { cards, more };
})();

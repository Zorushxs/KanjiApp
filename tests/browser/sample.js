// Resposta de mostra com la que tornaria Claude.ai (més un element hostil per provar l'escapament).
window.SAMPLE = 'Aquí tens les fitxes:\n\n```json\n' + JSON.stringify([
  {
    kanji: '日', meanings: { ca: ['sol', 'dia'], en: ['sun', 'day'] }, onyomi: ['ニチ', 'ジツ'], kunyomi: ['ひ', '-び', '-か'], reading: 'にち',
    strokes: 4, jlpt: 5, emoji: '☀️',
    origin: { ca: 'Pictograma del sol: un cercle amb un punt al mig que es va fer quadrat.', en: 'Pictograph of the sun: a circle with a dot inside that became square.' },
    mnemonic: { ca: 'Una finestra quadrada per on entra el sol cada dia.', en: 'A square window where the sun comes in every day.' },
    examples: [
      { word: '日本', reading: 'にほん', meaning: { ca: 'Japó', en: 'Japan' } },
      { word: '毎日', reading: 'まいにち', meaning: { ca: 'cada dia', en: 'every day' } },
      { word: '日曜日', reading: 'にちようび', meaning: { ca: 'diumenge', en: 'Sunday' } },
    ],
    sentence: { jp: '毎日日本語を勉強します。', reading: 'まいにちにほんごをべんきょうします。', romaji: 'Mainichi nihongo o benkyou shimasu.', meaning: { ca: 'Estudio japonès cada dia.', en: 'I study Japanese every day.' } },
    trivia: { ca: '日本 vol dir literalment «l’origen del sol».', en: '日本 literally means “origin of the sun”.' }, verified: false,
  },
  {
    kanji: '月', meanings: { ca: ['lluna', 'mes'], en: ['moon', 'month'] }, onyomi: ['ゲツ', 'ガツ'], kunyomi: ['つき'], reading: 'つき',
    strokes: 4, jlpt: 5, emoji: '🌙', origin: { ca: 'Pictograma de la lluna creixent.', en: 'Pictograph of a crescent moon.' },
    mnemonic: { ca: 'Una lluna amb dues ratlles, com una escala per pujar-hi.', en: 'A moon with two lines, like a ladder to climb it.' },
    examples: [
      { word: '月曜日', reading: 'げつようび', meaning: { ca: 'dilluns', en: 'Monday' } },
      { word: '一月', reading: 'いちがつ', meaning: { ca: 'gener', en: 'January' } },
    ],
    sentence: { jp: '今日は月がきれいです。', reading: 'きょうはつきがきれいです。', meaning: { ca: 'Avui la lluna és bonica.', en: 'The moon is beautiful today.' } },
    trivia: { ca: '', en: '' }, verified: false,
  },
  {
    kanji: '火', meanings: { ca: ['foc'], en: ['fire'] }, onyomi: ['カ'], kunyomi: ['ひ', '-び', 'ほ-'],
    strokes: 4, jlpt: 5, emoji: '🔥', origin: { ca: '', en: '' },
    mnemonic: { ca: 'Una foguera amb dues guspires que salten.', en: 'A campfire with two sparks jumping out.' },
    examples: [
      { word: '火曜日', reading: 'かようび', meaning: { ca: 'dimarts', en: 'Tuesday' } },
      { word: '花火', reading: 'はなび', meaning: { ca: 'focs artificials', en: 'fireworks' } },
    ],
    sentence: { jp: '火を消してください。', reading: 'ひをけしてください。', meaning: { ca: 'Apaga el foc, si us plau.', en: 'Please put out the fire.' } },
    trivia: { ca: '', en: '' }, verified: false,
  },
  {
    kanji: '水', meanings: { ca: ['aigua'], en: ['water'] }, onyomi: ['スイ'], kunyomi: ['みず'],
    strokes: 4, jlpt: 5, emoji: '💧', origin: { ca: 'Pictograma d’un corrent d’aigua.', en: 'Pictograph of flowing water.' },
    mnemonic: { ca: 'Un riu amb esquitxos a banda i banda.', en: 'A river splashing on both sides.' },
    examples: [
      { word: '水曜日', reading: 'すいようび', meaning: { ca: 'dimecres', en: 'Wednesday' } },
      { word: '水', reading: 'みず', meaning: { ca: 'aigua', en: 'water' } },
    ],
    sentence: { jp: '水をください。', reading: 'みずをください。', meaning: { ca: 'Aigua, si us plau.', en: 'Water, please.' } },
    trivia: { ca: '', en: '' }, verified: false,
  },
  {
    kanji: '人', meanings: { ca: ['persona'], en: ['person'] }, onyomi: ['ジン', 'ニン'], kunyomi: ['ひと'], reading: 'ひと',
    strokes: 2, jlpt: 5, emoji: '🧍', origin: { ca: 'Pictograma d’una persona de perfil.', en: 'Pictograph of a person seen from the side.' },
    mnemonic: { ca: 'Dues cames que caminen.', en: 'Two legs walking.' },
    examples: [
      { word: '日本人', reading: 'にほんじん', meaning: { ca: 'japonès (persona)', en: 'Japanese person' } },
      { word: '三人', reading: 'さんにん', meaning: { ca: 'tres persones', en: 'three people' } },
    ],
    sentence: { jp: 'あの人は先生です。', reading: 'あのひとはせんせいです。', meaning: { ca: 'Aquella persona és professora.', en: 'That person is a teacher.' } },
    trivia: { ca: '', en: '' }, verified: false,
  },
  {
    kanji: '木', meanings: { ca: ['arbre <img src=x onerror="window.__xss=1">'], en: ['tree'] }, onyomi: ['モク', 'ボク'], kunyomi: ['き', 'こ'],
    strokes: 5, jlpt: 4, emoji: '<svg onload="window.__xss=1">',
    origin: { ca: '"><script>window.__xss=1</script>', en: '' },
    mnemonic: { ca: 'Un arbre amb branques i arrels.', en: 'A tree with branches and roots.' },
    examples: [{ word: '木曜日', reading: 'もくようび', meaning: { ca: 'dijous', en: 'Thursday' } }],
    sentence: { jp: '木の下で休みます。', reading: 'きのしたでやすみます。', meaning: { ca: 'Descanso sota l’arbre.', en: 'I rest under the tree.' } },
    trivia: { ca: '', en: '' }, verified: false,
  },
  { kanji: '金', meanings: { ca: ['or'], en: ['gold'] }, onyomi: ['きん'], kunyomi: ['かね'], strokes: 8, jlpt: 5 },
], null, 2) + '\n```\n\nSi vols, en puc fer més.';

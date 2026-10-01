// Prova del convertidor kana → rōmaji de util.js. Com s'executa: node tests/romaji.test.js
const vm = require('vm'), fs = require('fs');
const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, document: {}, navigator: {} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(['prefs', 'i18n', 'util'].map(f => fs.readFileSync(require('path').join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;\n') + '\n;globalThis.U = U;', ctx);
const cases = {
  'いち': 'ichi', 'ニチ': 'nichi', 'ジツ': 'jitsu', 'にほん': 'nihon', 'まいにち': 'mainichi', 'きょう': 'kyou',
  'がっこう': 'gakkou', 'まっちゃ': 'matcha', 'きんようび': "kin'youbi", 'せんせい': 'sensei', 'コーヒー': 'koohii',
  'ティー': 'tii', 'ファン': 'fan', 'しゃしん': 'shashin', 'じゃ': 'ja', 'ちゃ': 'cha', 'びょういん': 'byouin',
  'ぎゅうにゅう': 'gyuunyuu', 'ひゃく': 'hyaku', 'りょこう': 'ryokou', 'つき': 'tsuki', 'ふじさん': 'fujisan',
  '-び': '-bi', 'ほんや': "hon'ya", 'きっぷ': 'kippu', 'ヴァ': 'va', 'ウィ': 'wi', 'しぇ': 'she',
  'みずをください。': 'mizuokudasai.', 'あまのがわ': 'amanogawa', 'おがわ': 'ogawa', 'セン': 'sen',
};
let f = 0;
for (const [k, v] of Object.entries(cases)) { const r = ctx.U.romaji(k); if (r !== v) { f++; console.log('FAIL', k, '→', r, '(esperat', v + ')'); } }
console.log(f ? f + ' FAILS' : `TOT OK (${Object.keys(cases).length} casos)`);

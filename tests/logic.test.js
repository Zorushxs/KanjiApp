// Proves de lògica pura: carrega els scripts en un context amb stubs mínims. Com s'executa: node tests/logic.test.js
const vm = require('vm'), fs = require('fs');
const APP = require('path').join(__dirname, '..', 'js') + '/';
const store = {};
const ctx = {
  console, setTimeout, clearTimeout,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  document: { addEventListener() {}, visibilityState: 'visible' },
  navigator: { language: 'ca' },
};
ctx.window = ctx;
vm.createContext(ctx);
const src = ['prefs', 'i18n', 'util', 'card', 'peces', 'almacen', 'validar', 'store', 'prompt'].map(f => fs.readFileSync(APP + f + '.js', 'utf8')).join('\n;\n')
  + '\n;globalThis.__ = { Prefs, I18n, U, Card, Peces, Validar, Store, Prompt, t };';
vm.runInContext(src, ctx);
const { Prefs, I18n, U, Card, Peces, Validar, Store, Prompt, t } = ctx.__;
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

const good = {
  kanji: '日', meanings: { ca: ['sol', 'dia'], en: ['sun', 'day'] }, onyomi: ['ニチ', 'ジツ'], kunyomi: ['ひ', '-び', 'か'],
  strokes: 4, jlpt: 5, emoji: '☀️', origin: { ca: 'Pictograma del sol.', en: 'Pictograph of the sun.' },
  mnemonic: { ca: 'Una finestra amb el sol', en: 'A window with the sun' },
  examples: [{ word: '日本', reading: 'にほん', meaning: { ca: 'Japó', en: 'Japan' } }, { word: '毎日', reading: 'まいにち', meaning: { ca: 'cada dia', en: 'every day' } }],
  sentence: { jp: '今日はいい天気です。', reading: 'きょうはいいてんきです。', meaning: { ca: 'Avui fa bon temps.', en: 'The weather is nice today.' } },
  trivia: { ca: '', en: '' }, verified: true,
};
const text = 'Aquí tens:\n```json\n' + JSON.stringify([
  good,
  { ...good, kanji: '月', meanings: { ca: ['lluna'], en: ['moon'] }, onyomi: ['げつ'], kunyomi: ['つき'] },
  { ...good, kanji: '<img src=x onerror=alert(1)>' },
  { ...good, kanji: '火', meanings: { ca: ['foc <script>alert(1)</script>'], en: ['fire'] }, emoji: '<b>', jlpt: 'N5', strokes: '4',
    examples: [{ word: 'fire', reading: 'x' }, { word: '火曜日', reading: 'かようび', meaning: { en: 'Tuesday' } }] },
  { ...good, kanji: '水', meanings: { ca: ['aigua'], en: ['water'] }, kunyomi: ['みず'], onyomi: ['スイ'] },
  { ...good, kanji: '水', meanings: { ca: ['aigua2'], en: ['water2'] }, kunyomi: ['みず'], onyomi: ['スイ'] },
  'text solt',
], null, 2).replace(/\]$/, ',\n]') + '\n```\nEspero que t\'ajudi.';

const raws = Validar.extract(text);
ok(raws.length === 7, 'extract llegeix el bloc ```json (amb coma final) — ' + raws.length);
ok(Validar.extract(JSON.stringify(good)).length === 1, 'extract accepta un objecte sol sense bloc');
ok(Validar.extract('bla ' + JSON.stringify({ version: 1, kanji: [good] }) + ' bla').length === 1, 'extract accepta {kanji:[...]} amb text al voltant');
let threw = ''; try { Validar.extract('```json\n[{"kanji": "日", "meanings": {"ca": ["sol"'); } catch (e) { threw = e.message; }
ok(/tallat|cut off/.test(threw), 'resposta tallada → missatge clar: ' + threw);
threw = ''; try { Validar.extract('no hi ha res'); } catch (e) { threw = e.message; }
ok(threw === t('add.noJson'), 'sense JSON → ' + threw);

Store.load({ version: 1, kanji: [good], progress: { '日': { box: 3, due: '2026-10-02', seen: 5, fails: 1 } } });
Store.setVerified('日', true);
const rows = Validar.review(text, Store.get);
console.log('     ', rows.map(r => (r.kanji || '?') + ':' + r.status).join(' '));
ok(rows[0].status === 'same', '日 idèntic → sense canvis');
ok(rows[1].status === 'err' && rows[1].errors.some(e => e.k === 'val.on'), '月 amb on en hiragana → error');
ok(rows[2].status === 'err' && rows[2].errors[0].k === 'val.kanji', 'kanji amb HTML → error');
const fire = rows[3];
ok(fire.status === 'new', '火 → nou');
ok(fire.item.emoji === '' && fire.warnings.some(w => w.k === 'val.emoji'), 'emoji <b> → tret amb avís');
ok(fire.item.jlpt === 5 && fire.item.strokes === 4, '"N5" i "4" → números');
ok(fire.item.examples.length === 1 && fire.warnings.some(w => w.k === 'val.example'), 'exemple mal format descartat');
ok(fire.warnings.some(w => w.k === 'val.missing.ca'), 'falta català al significat de l\'exemple → avís');
ok(fire.item.meanings.ca[0] === 'foc <script>alert(1)</script>', 'el text es guarda tal qual (s\'escapa en pintar)');
ok(U.esc(fire.item.meanings.ca[0]).indexOf('<') < 0, 'esc() neutralitza l\'HTML');
ok(rows[4].status === 'err' && rows[4].errors.some(e => e.k === 'val.dup'), 'primer 水 repetit → descartat');
ok(rows[5].status === 'new' && rows[5].item.meanings.ca[0] === 'aigua2', 'últim 水 → el que es desa');
ok(rows[6].status === 'err' && rows[6].errors[0].k === 'val.notObject', 'element que no és objecte → error');
ok(rows.every(r => !r.item || r.item.verified === false), 'verified sempre false en entrar');

const changed = Validar.review(JSON.stringify([{ ...good, mnemonic: { ca: 'Nova', en: 'New' } }]), Store.get);
ok(changed[0].status === 'upd' && changed[0].warnings.some(w => w.k === 'add.loseVerified'), 'actualització d\'un verificat → avís');
const m = Store.merge(changed.map(r => r.item));
ok(m.updated === 1 && m.added === 0, 'merge actualitza per caràcter');
ok(Store.kanji.length === 1 && Store.prog('日').box === 3 && Store.prog('日').seen === 5, 'el progrés es conserva en regenerar');
ok(Store.get('日').verified === false, 'contingut nou → no verificat');
Store.merge(rows.filter(r => r.status === 'new').map(r => r.item));
ok(Store.kanji.map(k => k.kanji).join('') === '日火水', 'nous al final, sense duplicats: ' + Store.kanji.map(k => k.kanji).join(''));

const today = U.today();
ok(Store.nextDays('火', 'yes') === 3 && Store.nextDays('火', 'doubt') === 1 && Store.nextDays('火', 'no') === 1, 'nou: sí→3 dies, dubte→1, no→1');
Store.review('火', 'yes'); ok(Store.prog('火').box === 2 && Store.prog('火').due === U.addDays(3), 'nou + sí → caixa 2, d\'aquí a 3 dies');
Store.review('日', 'yes'); ok(Store.prog('日').box === 4 && Store.prog('日').due === U.addDays(14), 'caixa 3 + sí → caixa 4, 14 dies');
Store.review('日', 'doubt'); ok(Store.prog('日').box === 4, 'dubte → es queda a la caixa');
Store.review('日', 'no'); ok(Store.prog('日').box === 1 && Store.prog('日').fails === 2 && Store.prog('日').due === U.addDays(1), 'no → caixa 1, demà, +1 error');
for (let i = 0; i < 8; i++) { const q = Store.prog('水'); if (q) q.last = '2000-01-01'; Store.review('水', 'yes'); } // un encert per dia
ok(Store.prog('水').box === 5 && Store.prog('水').due === U.addDays(30), 'màxim caixa 5, 30 dies');
ok(!Store.isDue('水') && Store.isDue('水', U.addDays(30)), 'isDue segons la data');

Store.load({ kanji: [good, good, { kanji: 'xx' }, null], progress: { '日': { box: 9, due: 'ahir', seen: -3 }, 'abc': { box: 1 } } });
ok(Store.kanji.length === 1, 'norm: treu duplicats i invàlids');
const p = Store.prog('日');
ok(p.box === 5 && p.due === today && p.seen === 0 && Store.prog('abc') === null, 'norm: progrés netejat ' + JSON.stringify(p));

// Ordenar: amb filtre, només es mouen entre els llocs que ocupaven
Store.load({ kanji: ['日', '月', '火', '水', '木'].map(k => ({ ...good, kanji: k })), progress: { '月': { box: 2 } } });
const chars = () => Store.kanji.map(c => c.kanji).join('');
Store.reorder(['月', '日', '火', '水', '木']);
ok(chars() === '月日火水木' && Store.prog('月').box === 2, 'reorder: tota la llista, progrés intacte');
Store.reorder(['木', '日', '火']);
ok(chars() === '月木日水火', 'reorder amb filtre (日火木 → 木日火): ' + chars());
Store.reorder(['日', 'zz']);
ok(chars() === '月木日水火', 'reorder amb una fitxa que no hi és → no fa res');

const pr = Prompt.cards(['日', '月']);
ok(pr.includes('these kanji: 日、月') && pr.includes('```json') && !pr.includes('{{KANJI}}'), 'prompt amb els kanji i el bloc ```json');
ok(t('add.apply', { n: 3 }) === 'Desar 3 kanji', 'i18n ca amb variables');
I18n.set = I18n.set; // (set crida apply(), que necessita document.querySelectorAll)
ctx.document.querySelectorAll = () => [];
ctx.document.documentElement = {};
I18n.set('en'); ok(t('add.apply', { n: 3 }) === 'Save 3 kanji', 'i18n en');
ok(I18n.tr({ ca: 'hola', en: '' }) === 'hola', 'tr: si falta l\'idioma, fa servir l\'altre');
vm.runInContext('globalThis.__T = ' + fs.readFileSync(APP + 'i18n.js', 'utf8').match(/const TEXTS = (\{[\s\S]*?\n  \});/)[1], ctx);
const T = ctx.__T, ca = Object.keys(T.ca);
ok(['es', 'en'].every(l => Object.keys(T[l]).length === ca.length && ca.every(k => k in T[l])), `les ${ca.length} claus hi són en ca, es i en`);
const used = new Set();
for (const f of fs.readdirSync(APP)) for (const mm of fs.readFileSync(APP + f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9.]+)'/g)) used.add(mm[1]);
for (const mm of fs.readFileSync(APP + '../index.html', 'utf8').matchAll(/data-i18n(?:-\w+)?="([^"]+)"/g)) used.add(mm[1]);
const dyn = { 'add.grp.': ['new', 'upd', 'same', 'err'], 'pr.mode.': ['k2m', 'm2k'], 'pr.q.': ['k2m', 'm2k'], 'pr.': ['no', 'doubt', 'yes'], 'val.missing.': ['ca', 'es', 'en'] };
['ver.pending', 'ver.ok', 'ver.err', 'lang.name'].forEach(k => used.add(k));
Object.entries(dyn).forEach(([pre, xs]) => { used.delete(pre); xs.forEach(x => used.add(pre + x)); });
const trunc1 = Validar.extract('Aquí:\n```json\n[{"kanji": "日"}, {"kanji": "月", "mea');
ok(trunc1.length === 1 && trunc1[0].kanji === '日' && trunc1.partial === true, 'bloc sense tancar i JSON tallat → s’aprofita la fitxa sencera (日)');

// Respostes tallades: s'aprofiten les fitxes senceres, encara que els textos tinguin cometes o claus
const full = [{ kanji: '一', meanings: { en: ['one {x}'] }, onyomi: ['イチ'] }, { kanji: '二', meanings: { en: ['two "2"'] }, onyomi: ['ニ'] }, { kanji: '三', meanings: { en: ['three'] }, onyomi: ['サン'] }];
const fullTxt = JSON.stringify(full, null, 2), NL = String.fromCharCode(10);
const cutTxt = '```json' + NL + fullTxt.slice(0, fullTxt.lastIndexOf('"three"'));
const ex1 = Validar.extract(cutTxt);
ok(ex1.length === 2 && ex1.partial === true && ex1[1].meanings.en[0] === 'two "2"', 'resposta tallada: 2 fitxes senceres (amb cometes i claus dins dels textos)');
ok(Validar.review(cutTxt, () => null).partial === true, 'review marca la resposta com a parcial');
ok(!Validar.extract('```json' + NL + fullTxt + NL + '```').partial, 'resposta sencera: no és parcial');
const missing = [...used].filter(k => !(k in T.ca));
ok(!missing.length, `les ${used.size} claus fixes usades existeixen ` + (missing.length ? missing.join(',') : ''));
// Castellà i tres estats de verificació
const es3 = Validar.check({ ...good, meanings: { ca: ['sol'], es: ['sol'], en: ['sun'] }, mnemonic: { ca: 'a', es: 'b', en: 'c' },
  origin: { ca: '', es: '', en: '' }, trivia: { ca: '', es: '', en: '' },
  examples: [{ word: '日本', reading: 'にほん', meaning: { ca: 'Japó', es: 'Japón', en: 'Japan' } }],
  sentence: { jp: '日', reading: 'ひ', meaning: { ca: 'x', es: 'y', en: 'z' } } });
ok(es3.item && es3.item.meanings.es[0] === 'sol' && !es3.warnings.some(w => /missing/.test(w.k)), 'contingut en tres idiomes, sense avisos');
const noEs = Validar.check(good);
ok(noEs.warnings.some(w => w.k === 'val.missing.es') && !noEs.warnings.some(w => w.k === 'val.missing.ca'), 'sense castellà: avís només de castellà');
ok(Validar.coerce({ kanji: '日', verified: 'error' }).verified === 'error' && Validar.coerce({ verified: 'x' }).verified === false, 'verified: false | true | error');
ok(Validar.check({ ...good, verified: 'error' }).item.verified === false, 'de la IA sempre entra per verificar');
Store.load({ kanji: [good] }); Store.setVerified('日', 'error'); ok(Store.get('日').verified === 'error', 'setVerified error');
Store.setVerified('日', 'bla'); ok(Store.get('日').verified === false, 'setVerified amb valor estrany: per verificar');
const pr3 = Prompt.cards(['日']);
ok(pr3.includes('"es": ["sol", "día"]') && pr3.includes('va afegir') && pr3.includes('esdevingué'), 'prompt amb castellà i regla d estil del català');
const longTxt = 'a'.repeat(500);
const lg = Validar.coerce({ kanji: '日', origin: { ca: longTxt }, trivia: { ca: longTxt }, mnemonic: { ca: longTxt } });
ok(lg.origin.ca.length === 500 && lg.trivia.ca.length === 500 && lg.mnemonic.ca.length < 500, 'origen i curiositat admeten textos més llargs (mnemotècnia no)');
ok(Prompt.cards(['日']).includes('about 35-45 words (2-3 sentences)') && Prompt.cards(['日']).includes('Keep the other texts short'), 'prompt: origen i curiositat de 35-45 paraules');

// Lectura principal i rōmaji de la frase
const rd = r => Validar.check({ ...good, ...r });
let c1 = rd({ reading: 'ニチ' });
ok(c1.item.reading === 'にち' && !c1.warnings.some(w => /reading/i.test(w.k)), 'reading en katakana → es desa en hiragana, sense avisos');
c1 = rd({ onyomi: ['ショク'], kunyomi: ['た.べる'], reading: 'たべる' });
ok(!c1.warnings.some(w => w.k === 'val.readingNotListed'), 'reading = paraula sencera del kun (たべる) → acceptat');
c1 = rd({ reading: 'やま' });
ok(c1.warnings.some(w => w.k === 'val.readingNotListed'), 'reading que no és a les lectures → avís');
c1 = rd({ reading: 'nichi' });
ok(c1.item.reading === '' && c1.warnings.some(w => w.k === 'val.reading'), 'reading en lletres llatines → es treu amb avís');
c1 = rd({});
ok(c1.item && c1.warnings.some(w => w.k === 'val.noReading'), 'sense reading → avís, però es desa');
c1 = rd({ sentence: { ...good.sentence, romaji: 'Kyou wa ii tenki desu.' } });
ok(c1.item.sentence.romaji === 'Kyou wa ii tenki desu.', 'rōmaji de la frase desat');
c1 = rd({ sentence: { ...good.sentence, romaji: 'きょう <b>' } });
ok(c1.item.sentence.romaji === '' && c1.warnings.some(w => w.k === 'val.romaji'), 'rōmaji de la frase no vàlid → es treu');

// Prompt per demanar kanji nous
const m1 = Prompt.more({ have: ['日', '月'], n: 5, theme: '  menjar ', words: '' });
ok(m1.includes('The kanji I have already learned are: 日, 月') && m1.includes('I want to learn 5 new kanji: about this theme: "menjar".') && !m1.includes('usual learning order'), 'more: llista amb comes, quantitat i temàtica');
const m2 = Prompt.more({ have: [], n: 10, theme: '', words: 'gat,   escola' });
ok(m2.includes("I haven't learned any kanji yet.") && m2.includes('I want to learn these specific words: gat, escola') && !m2.includes('new kanji:') && m2.includes('"reading": "にち"'), 'more: només paraules → sense el número de kanji');
const m3 = Prompt.more({ have: ['日'], haveWords: ['学校'], n: 4, theme: 'cos', words: 'mà' });
ok(m3.includes('I want to learn 4 new kanji: about this theme: "cos"') && m3.includes('In addition to those kanji, I want to learn these specific words: mà'), 'more: el número és per a la temàtica i les paraules van a més a més');
ok(m3.includes('The words I have already learned are: 学校') && m3.includes('patata → じゃがいも, not 芋') && m3.includes('Make a word card for each'), 'more: paraules tal com s’escriuen al Japó, en fitxes de paraula');

// Paraules que s'escriuen en kana
ok(Prompt.cards(['下']).includes('skip words that are usually') && Prompt.cards(['下']).includes('ください, きれい, りんご'), 'fitxes: exemples només amb paraules que s’escriuen amb el kanji');
const k2 = Prompt.more({ have: ['日'], n: 3, theme: 'menjar' });
ok(k2.includes('used in everyday writing') && !k2.includes('specific words'), 'more amb temàtica: kanji d’ús habitual, sense paraules');
ok(Prompt.cards(['日', '学校', 'じゃがいも']).includes('Create study cards for these kanji: 日, and these words: 学校、じゃがいも.') && Prompt.cards(['学校']).includes('A card can also be a WORD'), 'cards: kanji i paraules, amb el format de fitxa de paraula');

// Fitxes de paraula
const wcard = { kanji: 'じゃがいも', meanings: { ca: ['patata'], es: ['patata'], en: ['potato'] }, onyomi: [], kunyomi: [], reading: 'じゃがいも', strokes: null, jlpt: 4 };
let wc = Validar.check(wcard);
ok(wc.item && !wc.errors.length && !wc.warnings.some(w => /Strokes|readingNot|noReading/.test(w.k)), 'paraula en kana: vàlida, sense avisos de traços ni lectures');
wc = Validar.check({ ...wcard, kanji: '学校', reading: 'がっこう', onyomi: ['ガク'], strokes: 18 });
ok(wc.item && wc.item.onyomi.length === 0 && wc.item.strokes === null, 'paraula amb kanji: on/kun i traços es buiden');
wc = Validar.check({ ...wcard, reading: '' });
ok(!wc.item && wc.errors.some(e => e.k === 'val.wordReading'), 'paraula sense lectura → error');
wc = Validar.check({ ...wcard, kanji: 'potato' });
ok(!wc.item && wc.errors.some(e => e.k === 'val.kanji'), 'paraula que no és japonès → error');
ok(Card.isWord('学校') && Card.isWord('じゃがいも') && !Card.isWord('日') && !Validar.isCard('a b'), 'isWord / isCard');
ok(Card.isWord('食べる') && !Card.isWord('日') && Card.sizeClass('日') === '' && Card.sizeClass('学校') === ' w2' && Card.sizeClass('じゃがいも') === ' w4', 'Card.isWord i Card.sizeClass');
Store.load({ kanji: [good, wcard], progress: { 'じゃがいも': { box: 2, due: '2026-10-05', seen: 1, fails: 0 } } });
ok(Store.kanji.length === 2 && Store.prog('じゃがいも').box === 2, 'Store: desa paraules i el seu progrés');
const noteTxt = `Normalment en kana: poma (りんご)
\`\`\`json
[{"kanji":"米"}]
\`\`\`
`;
ok(Validar.note(noteTxt) === 'Normalment en kana: poma (りんご)', 'note: text de fora del bloc → ' + Validar.note(noteTxt));
ok(Validar.note('[{"kanji":"米"}]') === '' && Validar.note('```json\n[]\n```') === '', 'note: res si no hi ha text fora');
ok(Prompt.more({ have: ['日'], n: 3 }).includes('usual learning order (JLPT N5 first'), 'more: sense temàtica ni paraules → els més útils');

// Repàs extra el mateix dia i historial
Store.load({ kanji: [good] });
ok(!Store.doneToday('日') && Store.nextDays('日', 'yes') === 3, 'nou: no practicat avui');
Store.review('日', 'yes');
const d1 = Store.prog('日');
ok(d1.box === 2 && d1.last === U.today() && Store.doneToday('日'), 'primer encert: caixa 2, last = avui, doneToday');
ok(Store.nextDays('日', 'yes') === null && Store.nextDays('日', 'doubt') === null && Store.nextDays('日', 'no') === 1, 'repàs extra: sí/dubte no canvien, no → demà');
Store.review('日', 'yes');
ok(Store.prog('日').box === 2 && Store.prog('日').due === d1.due && Store.prog('日').seen === 2, 'segon encert el mateix dia: no puja de caixa');
Store.review('日', 'no');
ok(Store.prog('日').box === 1 && Store.prog('日').due === U.addDays(1) && Store.prog('日').fails === 1, 'error el mateix dia: caixa 1, demà');
Store.tally(); Store.tally();
ok(Store.history[U.today()] === 2, 'tally compta les respostes d’avui');
Store.load({ kanji: [good], progress: { '日': { box: 2, due: '2026-10-01', last: 'ahir' } }, history: { '2026-09-01': 5, 'x': 3, '2026-09-02': -1, '2026-09-03': 'a' } });
ok(Store.prog('日').last === undefined && JSON.stringify(Store.history) === '{"2026-09-01":5}', 'norm: last i history netejats');

// Correccions i lectura principal triada per tu
const mine = Validar.coerce({ ...good, reading: 'ひ', edited: true, mainByUser: true });
ok(mine.edited === true && mine.mainByUser === true, 'coerce conserva «edited» i «mainByUser»');
ok(Validar.check({ ...good, edited: true, mainByUser: true }).item.edited === false, 'de Claude, «edited» i «mainByUser» sempre surten false');
Store.load({ kanji: [mine], progress: { '日': { box: 3, due: '2026-10-10', seen: 4, fails: 0 } } });
const regen = Validar.review(JSON.stringify([good]), Store.get)[0];
ok(regen.status === 'upd' && regen.warnings.some(w => w.k === 'add.loseEdits') && regen.warnings.some(w => w.k === 'add.keepsMain' && w.p.v === 'ひ'), 'previsualització: avisa de les correccions i que es manté ひ');
Store.merge([regen.item]);
ok(Store.get('日').reading === 'ひ' && Store.get('日').mainByUser === true && Store.get('日').edited === false && Store.prog('日').box === 3, 'regenerar: es manté la lectura ひ i el progrés; les correccions es substitueixen');
Store.load({ kanji: [{ ...mine, reading: 'じつ' }] });
Store.merge([Validar.check({ ...good, onyomi: ['ニチ'], reading: 'にち' }).item]);
ok(Store.get('日').reading === 'にち', 'si la teva lectura ja no hi és, es fa servir la nova');
const upd = Validar.check({ ...good, mnemonic: { ca: 'nova', es: 'nueva', en: 'new' } }).item;
Store.load({ kanji: [good] }); Store.update('日', { ...upd, edited: true });
ok(Store.get('日').mnemonic.ca === 'nova' && Store.get('日').edited, 'Store.update desa les correccions');
// Dues lectures principals (七: しち / なな): les tries tu; Claude no les toca.
const seven = { ...good, kanji: '七', meanings: { ca: ['set'], en: ['seven'] }, onyomi: ['シチ'], kunyomi: ['なな', 'なな.つ', 'なの'], reading: 'しち',
  examples: [{ word: '七月', reading: 'しちがつ', meaning: { ca: 'juliol', en: 'July' } }], sentence: { jp: '七時です。', reading: 'しちじです。', meaning: { ca: 'Són les set.', en: 'It is seven.' } } };
const mine7 = Validar.coerce({ ...seven, reading2: 'なな', mainByUser: true });
ok(mine7.reading2 === 'なな', 'coerce conserva la segona lectura');
ok(Validar.check({ ...seven, reading2: 'なな' }).item.reading2 === '', 'de Claude, la segona lectura sempre surt buida');
ok(Card.mains(mine7).join() === 'しち,なな' && Card.isMain(mine7, 'なな.つ') && !Card.isMain(mine7, 'なの'), 'Card.mains i Card.isMain tenen en compte les dues');
ok(/しち.*shichi.*\/.*なな.*nana/.test(Peces.mainHtml(mine7)), 'Peces.mainHtml: しち shichi / なな nana');
Store.load({ kanji: [mine7] });
let r7 = Validar.review(JSON.stringify([seven]), Store.get)[0];
ok(r7.status === 'same', 'regenerar igual (lectura しち) amb les teves dues lectures: «igual» — ' + r7.status);
r7 = Validar.review(JSON.stringify([{ ...seven, reading: 'なな', mnemonic: { ca: 'nova', en: 'new' } }]), Store.get)[0];
ok(r7.status === 'upd' && r7.warnings.some(w => w.k === 'add.keepsMains' && w.p.v === 'しち / なな'), 'previsualització: es mantenen しち / なな');
Store.merge([r7.item]);
ok(Store.get('七').reading === 'しち' && Store.get('七').reading2 === 'なな' && Store.get('七').mainByUser && Store.get('七').mnemonic.ca === 'nova', 'regenerar: les dues es mantenen, en el teu ordre');
Store.load({ kanji: [mine7] });
r7 = Validar.review(JSON.stringify([{ ...seven, kunyomi: ['なの'] }]), Store.get)[0];
ok(r7.warnings.some(w => w.k === 'add.keepsMain' && w.p.v === 'しち'), 'si なな ja no hi és, només es manté しち');
Store.merge([r7.item]);
ok(Store.get('七').reading === 'しち' && Store.get('七').reading2 === '', '... i la segona queda buida');
const kyo = { kanji: '今日', meanings: { ca: ['avui'], en: ['today'] }, onyomi: [], kunyomi: [], reading: 'きょう', jlpt: 5,
  examples: [], sentence: { jp: '今日は暑い。', reading: 'きょうはあつい。', meaning: { ca: 'Avui fa calor.', en: 'It is hot today.' } } };
const w0 = Validar.check(kyo);
ok(w0.item && !w0.errors.length, 'la paraula de prova és vàlida — ' + JSON.stringify(w0.errors));
Store.load({ kanji: [{ ...w0.item, reading2: 'こんにち', mainByUser: true }] });
ok(Validar.review(JSON.stringify([kyo]), Store.get)[0].status === 'same', 'paraula regenerada igual: «igual»');
const rw = Validar.review(JSON.stringify([{ ...kyo, jlpt: 4 }]), Store.get)[0];
ok(rw.warnings.some(w => w.k === 'add.keepsReading2' && w.p.v === 'こんにち'), 'paraula: es manté la teva segona lectura');
Store.merge([rw.item]);
ok(Store.get('今日').reading === 'きょう' && Store.get('今日').reading2 === 'こんにち', '... i es desa');
Store.merge([Validar.check({ ...kyo, reading: 'こんにち' }).item]);
ok(Store.get('今日').reading === 'こんにち' && Store.get('今日').reading2 === '', 'si la nova lectura és la teva segona, no es repeteix');

// Plantilla html`…`: escapa el text (també als atributs), deixa l'HTML niat i uneix les llistes
const evil = '<img src=x onerror=alert(1)>', evilEsc = '&lt;img src=x onerror=alert(1)&gt;';
ok(String(U.html`<p title="${evil}">${evil}</p>`) === `<p title="${evilEsc}">${evilEsc}</p>`, 'html escapa el text');
ok(String(U.html`<ul>${['a', U.html`<b>${'<'}</b>`]}</ul>`) === '<ul>a<b>&lt;</b></ul>', 'html: llistes i html niat');
ok(String(U.html`${null}${undefined}${0}`) === '0', 'html: null i undefined no pinten res; 0 sí');
ok(String(U.html`<b aria-pressed="${false}" hidden="${true}">`) === '<b aria-pressed="false" hidden="true">', 'html: true i false s’escriuen (atributs aria)');
ok(String(U.join(['a', '<'], U.html`<i>,</i>`)) === 'a<i>,</i>&lt;' && String(U.raw('<b>')) === '<b>', 'join i raw');
const actBtn = { dataset: { act: 'hola' } };
actBtn.closest = () => actBtn;
const fakeRoot = { contains: () => true };
let acted = null;
U.onActions(fakeRoot, { hola: el => { acted = el; } });
fakeRoot.onclick({ target: { closest: () => actBtn } });
ok(acted === actBtn, 'onActions crida l’acció del data-act');

// Peces: trossos d'HTML
ok(String(Peces.mark('<日>本日', '日')) === '&lt;<mark>日</mark>&gt;本<mark>日</mark>', 'Peces.mark ressalta i escapa');
ok(String(Peces.kun('た.べる')) === 'た<span class="oku">べる</span>', 'Peces.kun: okurigana a part');
ok(Peces.say('') === '' && /data-say="にち"/.test(String(Peces.say('にち'))), 'Peces.say');
ok(/class="is-main" title="principal">ニチ<\/b><span class="sep">、<\/span>ジツ/.test(String(Peces.readingList({ ...good, reading: 'にち' }, ['ニチ', 'ジツ'],
  { separator: U.html`<span class="sep">、</span>`, title: 'principal' }))), 'Peces.readingList destaca la principal');

// Card: regles d'una fitxa
ok(Card.plain('た.べる') === 'たべる' && Card.stem('た.べる') === 'た' && Card.stem('-び') === 'び', 'Card.plain i Card.stem');
ok(Card.readingsToSay(good) === 'ニチ、ジツ、ひ、び、か', 'Card.readingsToSay: ' + Card.readingsToSay(good));
ok(Card.mainCandidates({ onyomi: ['ニチ'], kunyomi: ['た.べる'] }).join() === 'にち,にち,たべる,た', 'Card.mainCandidates');
ok(Card.level({ jlpt: 5 }) === 'n5' && Card.level({ jlpt: null }) === 'none' && Card.kind({ kanji: '学校' }) === 'word', 'Card.level i Card.kind');
ok(Card.nextVerified(false) === true && Card.nextVerified(true) === 'error' && Card.nextVerified('error') === false
  && Card.verState('x').cls === 'pending', 'Card: estats de verificació');
ok(Card.href('日') === '#/k/%E6%97%A5' && Card.jisho('学校').endsWith('%E5%AD%A6%E6%A0%A1'), 'Card.href i Card.jisho');

// Etiquetes: arbre, fitxes, regenerar, moure, esborrar i netejar en carregar
Store.load({ kanji: ['一', '二', '月', '火'].map(k => ({ ...good, kanji: k })) });
const temps = Store.addTag('  Temps ').id, mesos = Store.addTag('Mesos', temps).id, nums = Store.addTag('Números').id;
ok(Store.tag(temps).name === 'Temps' && Store.tag(mesos).parent === temps, 'addTag: nom net i dins d’una altra');
ok(Store.addTag('numeros').error === 'tags.taken' && Store.addTag('   ').error === 'tags.empty', 'addTag: repetit (sense accents ni majúscules) i buit');
ok(!Store.addTag('Mesos').error, 'el mateix nom en un altre lloc sí que es pot');
ok(Store.tagTree().map(x => x.tag.name + x.depth).join() === 'Mesos0,Números0,Temps0,Mesos1', 'tagTree: alfabètic i en arbre');
ok(Store.tagLabel(mesos) === 'Temps › Mesos' && Store.tagBranch(temps).join() === [temps, mesos].join(), 'tagLabel i tagBranch');
Store.setCardTag('一', nums, true); Store.setCardTag('二', nums, true); Store.setCardTag('月', mesos, true);
Store.setCardTag('月', nums, true); Store.setCardTag('月', nums, false); Store.setCardTag('zz', nums, true);
ok(Store.cardTags('月').join() === mesos && Store.cardTags('zz').length === 0, 'setCardTag: posar, treure i fitxa que no existeix');
ok(Store.cardsInTag(temps).map(c => c.kanji).join() === '月' && Store.cardsInTag(nums).length === 2, 'cardsInTag compta les de dins');
Store.merge([{ ...Store.get('月'), mnemonic: { ca: 'Nova', es: '', en: '' } }]);
ok(Store.cardTags('月').join() === mesos, 'regenerar una fitxa no li treu les etiquetes');
ok(Store.moveTag(temps, mesos).error === 'tags.loop' && Store.moveTag(temps, temps).error === 'tags.loop', 'moveTag: mai dins de les seves');
ok(!Store.moveTag(nums, temps).error && Store.tagLabel(nums) === 'Temps › Números', 'moveTag: dins d’una altra');
ok(Store.renameTag(nums, 'Mesos').error === 'tags.taken' && !Store.renameTag(nums, 'Nombres').error, 'renameTag');
Store.remove('二');
ok(!('二' in Store.snapshot().cardTags), 'esborrar una fitxa li treu les etiquetes');
Store.removeTag(temps);
ok(Store.tags.length === 1 && !Object.keys(Store.snapshot().cardTags).length, 'removeTag: amb les de dins i fora de les fitxes');
Store.load({
  kanji: [good],
  tags: [{ id: 't1', name: 'A', parent: 't2' }, { id: 't2', name: 'B', parent: 't1' }, { id: 't3', name: ' ', parent: '' },
    { id: 'x', name: 'C' }, { id: 't4', name: 'D', parent: 't9' }, { id: 't1', name: 'E' }],
  cardTags: { '日': ['t1', 't1', 't7'], '月': ['t2'] },
});
ok(Store.tags.map(x => x.id).join() === 't1,t2,t4' && Store.tags.every(x => !x.parent || Store.tag(x.parent)), 'norm: ids i noms vàlids, sense pares que no hi són');
ok(Store.tagTree().length === 3, 'norm: sense cercles (A dins de B dins de A)');
ok(JSON.stringify(Store.snapshot().cardTags) === '{"日":["t1"]}', 'norm: etiquetes de fitxes que existeixen, sense repetir');
ok(Store.addTag('F').id === 't5', 'id nou: el següent al més alt');

// Prefs: preferències del navegador
Prefs.set('theme', 'dark');
Prefs.set('practice', { size: 20 });
ok(store['kanji:tema'] === 'dark' && Prefs.get('theme') === 'dark' && Prefs.get('practice').size === 20, 'Prefs: text pla i objectes');
store['kanji:avis'] = '1';
ok(!!Prefs.get('notice') && Prefs.get('add') === null, 'Prefs: format antic de l’avís i null si no hi ha res');
ok(Prefs.view('meanings') === true && Prefs.view('meanings', false) === false && JSON.parse(store['kanji:vista']).meanings === false, 'Prefs.view');

console.log(fails ? `\n${fails} FAILS` : '\nTOT OK');

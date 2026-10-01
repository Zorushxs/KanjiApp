// Regles d'una fitxa, que pot ser un kanji sol o una paraula (学校, 食べる, じゃがいも): tipus, nivell,
// lectures principals i verificació. Aquí no hi ha HTML; el que es pinta és a peces.js.
const Card = (() => {
  const HAN = /^\p{Script=Han}$/u;

  // ---------- Tipus i nivell ----------
  // És una paraula si no és un sol kanji. (El camp es diu "kanji" en tots dos casos.)
  const isWord = text => !HAN.test(String(text));
  const kind = card => (isWord(card.kanji) ? 'word' : 'kanji');

  // Nivell JLPT per als filtres: 'n5'…'n1', o 'none' si no en té.
  const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1', 'none'];
  const level = card => (card.jlpt ? 'n' + card.jlpt : 'none');
  const levelName = lv => (lv === 'none' ? t('home.noLevel') : lv.toUpperCase());

  // Classe de mida per a les paraules llargues, perquè hi càpiguen a la graella, la fitxa i la pràctica.
  function sizeClass(text) {
    const length = [...String(text)].length;
    if (length < 2) return '';
    if (length === 2) return ' w2';
    if (length === 3) return ' w3';
    return ' w4';
  }

  const href = text => '#/k/' + encodeURIComponent(text);
  const jisho = text => 'https://jisho.org/search/' + encodeURIComponent(isWord(text) ? text : text + ' #kanji');

  // ---------- Lectures ----------
  // Les lectures d'un kanji s'escriuen com a KanjiVG i Jisho: ニチ (on), た.べる (kun amb okurigana), -び (sufix).
  // Sense punts ni guions: た.べる → たべる (per a la veu i la cerca).
  const plain = reading => String(reading).replace(/[.\-]/g, '');
  // Només l'arrel, sense l'okurigana ni els guions: た.べる → た, -び → び.
  const stem = reading => String(reading).split('.')[0].replace(/-/g, '');
  const allReadings = card => [...card.onyomi, ...card.kunyomi];
  // Totes les lectures seguides, per a la veu.
  const readingsToSay = card => allReadings(card).map(plain).join('、');
  // Totes les formes en hiragana que poden ser la lectura principal: ニチ → にち, た.べる → たべる i た.
  const mainCandidates = card => allReadings(card).flatMap(r => [plain(r), stem(r)]).map(U.hira);

  // Les lectures principals: la primera (camp "reading") i, si l'has triada, la segona (七: しち / なな).
  const mains = card => [card.reading, card.reading2].filter(Boolean);
  // És una lectura principal? Val la paraula sencera (たべる) o només l'arrel (た).
  const isMain = (card, reading) => [plain(reading), stem(reading)].some(x => mains(card).includes(U.hira(x)));

  // En regenerar una fitxa: de les lectures principals que havies triat (una o dues), les que encara hi són.
  // D'una paraula, la lectura és la nova i es conserva la segona que hi havies posat (si no és la mateixa).
  function keptMains(old, card) {
    if (isWord(card.kanji)) {
      const keepSecond = card.reading && old.reading2 && old.reading2 !== card.reading;
      return keepSecond ? [card.reading, old.reading2] : [];
    }
    const candidates = mainCandidates(card);
    return [old.reading, old.reading2].filter(r => r && candidates.includes(r));
  }

  // ---------- Verificació (camp "verified") ----------
  // false: per verificar · true: verificat · 'error': té errors.
  const VERIFIED = [false, true, 'error'];
  const VER_STATES = {
    false: { cls: 'pending', key: 'ver.pending', icon: '○' },
    true: { cls: 'ok', key: 'ver.ok', icon: '✓' },
    error: { cls: 'err', key: 'ver.err', icon: '✗' },
  };
  // Classe CSS, clau de text i icona de l'estat.
  const verState = verified => VER_STATES[String(verified)] || VER_STATES.false;
  // El següent estat en prémer el botó: per verificar → verificat → té errors → per verificar.
  const nextVerified = verified => VERIFIED[(VERIFIED.indexOf(verified) + 1) % VERIFIED.length];

  return {
    isWord, kind, LEVELS, level, levelName, sizeClass, href, jisho,
    plain, stem, allReadings, readingsToSay, mainCandidates, mains, isMain, keptMains,
    VERIFIED, verState, nextVerified,
  };
})();

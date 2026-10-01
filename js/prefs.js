// Preferències d'aquest navegador (localStorage), totes les claus en un sol lloc. Les dades (fitxes i
// progrés) no van aquí, sinó a almacen.js. Si el navegador no deixa llegir o escriure, l'app funciona igual.
const Prefs = (() => {
  const KEYS = {
    theme: 'kanji:tema',        // 'light' | 'dark' (index.html també el llegeix abans de pintar)
    lang: 'kanji:idioma',       // 'ca' | 'es' | 'en'
    notice: 'kanji:avis',       // has amagat l'avís de «no es pot desar en un arxiu»
    view: 'kanji:vista',        // { meanings, romaji }: què es mostra a l'app
    practice: 'kanji:practica', // opcions de la pantalla Practicar
    add: 'kanji:afegir',        // mode de la pantalla Afegir
  };

  // Torna el valor desat (objecte, número o text) o null si no n'hi ha.
  function get(name) {
    let text = null;
    try { text = localStorage.getItem(KEYS[name]); } catch {}
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text; // el tema i l'idioma es desen com a text pla ('dark', 'ca')
    }
  }

  function set(name, value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    try { localStorage.setItem(KEYS[name], text); } catch {}
  }

  // Què es mostra: significats a la graella i rōmaji a tota l'app. view('romaji') llegeix;
  // view('romaji', false) desa i torna el valor nou.
  const VIEW_DEFAULT = { meanings: true, romaji: true };
  const savedView = get('view');
  const viewPrefs = { ...VIEW_DEFAULT, ...(typeof savedView === 'object' ? savedView : {}) };
  function view(key, value) {
    if (value === undefined) return viewPrefs[key];
    viewPrefs[key] = value;
    set('view', viewPrefs);
    return value;
  }

  return { get, set, view };
})();

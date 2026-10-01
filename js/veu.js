// Veu en japonès. Si el navegador té una veu ja-JP (Web Speech API), es fa servir: funciona sense connexió.
// Si no en té (per exemple Opera, o Windows sense la veu japonesa instal·lada) o no respon, es reprodueix la veu
// en línia de Google Translate. És un servei no oficial: envia el text a Google i podria deixar de funcionar.
// Perquè respongui, la pàgina no ha d'enviar el referrer (vegeu <meta name="referrer"> a index.html).
// Cada clic deixa missatges a la consola (F12) amb el prefix [Veu]. Veu.diagnose() hi mostra les veus i fa una prova.
const Veu = (() => {
  const hasSpeech = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  const ONLINE = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=';
  const TAG = '[Veu]';
  const WAIT = 4000; // si la veu del navegador no comença a sonar en 4 s, es prova la en línia
  let voice = null, current = null, audio = null, listed = false;

  // Tria una veu ja-JP; les "Natural", "Online" o "Google" solen sonar millor.
  const isJa = v => /^ja([-_]|$)/i.test(v.lang);
  function pickVoice() {
    const ja = speechSynthesis.getVoices().filter(isJa);
    voice = ja.find(v => /natural|online|google/i.test(v.name)) || ja[0] || null;
  }
  if (hasSpeech) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  // El primer cop que escoltes alguna cosa: quines veus té el navegador.
  function listOnce() {
    if (listed) return;
    listed = true;
    if (!hasSpeech) {
      console.warn(TAG, 'Aquest navegador no té síntesi de veu: es farà servir la veu en línia.');
      return;
    }
    const all = speechSynthesis.getVoices(), ja = all.filter(isJa);
    const names = ja.length ? ': ' + ja.map(v => v.name).join(', ') : '';
    console.info(TAG, `El navegador té ${all.length} veus, ${ja.length} en japonès${names}.`);
    if (!ja.length) {
      console.info(TAG, 'Sense veu japonesa es fa servir la veu en línia. Per tenir-ne una sense connexió a Windows: '
        + 'Configuració → Hora i idioma → Veu → Afegeix veus → Japonès.');
    }
  }

  // Veu del navegador. Resol quan comença a sonar ('interrupted' si l'has tallat amb un altre clic).
  function device(text) {
    return new Promise((resolve, reject) => {
      speechSynthesis.cancel();
      const u = current = new SpeechSynthesisUtterance(text); // es guarda la referència: Chrome talla les que es perden
      u.lang = 'ja-JP';
      u.voice = voice;
      u.rate = 0.9;
      let late = false;
      const timer = setTimeout(() => {
        late = true;
        reject(new Error(`al cap de ${WAIT / 1000} s encara no ha començat a sonar`));
      }, WAIT);
      u.onstart = () => {
        clearTimeout(timer);
        if (!late) resolve('start');
      };
      u.onerror = e => {
        clearTimeout(timer);
        if (e.error === 'interrupted' || e.error === 'canceled') return resolve('interrupted');
        const why = e.error === 'not-allowed' ? ' (el navegador demana un clic a la pàgina abans de parlar)' : '';
        reject(new Error(`error «${e.error}»${why}`));
      };
      speechSynthesis.speak(u);
      if (speechSynthesis.paused) speechSynthesis.resume();
    });
  }

  // Veu en línia. Resol quan comença a sonar; en cas d'error explica el motiu i guarda l'adreça per provar-la.
  function online(text) {
    if (audio) audio.pause();
    const url = ONLINE + encodeURIComponent(text.slice(0, 190));
    audio = new Audio(url);
    return audio.play().then(() => 'start', e => {
      if (e.name === 'AbortError') return 'interrupted';
      const why = e.name === 'NotAllowedError' ? 'el navegador ha bloquejat la reproducció d’àudio'
        : e.name === 'NotSupportedError'
          ? 'Google no ha tornat àudio (sense connexió, petició bloquejada per un bloquejador o el servei ha canviat)'
        : `${e.name}: ${e.message}`;
      const err = new Error(why);
      err.url = url;
      throw err;
    });
  }

  // Escriu «Sona ✓» i torna la font que ha sonat.
  const sounds = source => result => {
    if (result !== 'interrupted') console.info(TAG, 'Sona ✓');
    return source;
  };
  function viaOnline(text) {
    console.info(TAG, `«${text}» → veu en línia de Google Translate`);
    return online(text).then(sounds('online'), e => {
      console.error(TAG, `No sona: ${e.message}.\nProva aquesta adreça en una pestanya nova: ${e.url}`);
      throw e;
    });
  }

  // Torna una promesa amb la font que ha sonat ('device' o 'online'); falla si no sona de cap manera.
  function say(text) {
    listOnce();
    if (hasSpeech && !voice) pickVoice();
    if (!hasSpeech || !voice) return viaOnline(text);
    console.info(TAG, `«${text}» → veu del navegador: ${voice.name} (${voice.lang})`);
    return device(text).then(sounds('device'), e => {
      speechSynthesis.cancel();
      console.warn(TAG, `La veu del navegador no ha funcionat: ${e.message}. Provo la veu en línia…`);
      return viaOnline(text);
    });
  }

  // Per escriure a la consola: Veu.diagnose() llista les veus del navegador i diu «にほんご».
  function diagnose() {
    if (hasSpeech) {
      const voices = speechSynthesis.getVoices();
      console.table(voices.map(v => ({ nom: v.name, idioma: v.lang, local: v.localService, japonès: isJa(v) })));
      console.info(TAG, voice ? `Veu triada: ${voice.name}` : 'Cap veu japonesa: es farà servir la veu en línia.');
    }
    listed = true;
    return say('にほんご');
  }

  return { say, diagnose, get source() { return hasSpeech && voice ? 'device' : 'online'; } };
})();

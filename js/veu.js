// Veu en japonès amb la Web Speech API del navegador (no cal res extern).
const Veu = (() => {
  const ok = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  let voice = null, loaded = false;
  // Tria una veu ja-JP; les "Natural"/"Online"/"Google" solen sonar millor.
  function pick() {
    const vs = speechSynthesis.getVoices(), ja = vs.filter(v => /^ja([-_]|$)/i.test(v.lang));
    loaded = vs.length > 0;
    voice = ja.find(v => /natural|online|google/i.test(v.name)) || ja[0] || null;
  }
  if (ok) { pick(); speechSynthesis.onvoiceschanged = pick; }

  // Torna 'ok', 'nospeech' (el navegador no en sap) o 'novoice' (no hi ha veu japonesa; ho prova igualment).
  function say(text) {
    if (!ok) return 'nospeech';
    if (!voice) pick();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 0.9;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
    return loaded && !voice ? 'novoice' : 'ok';
  }
  return { say };
})();

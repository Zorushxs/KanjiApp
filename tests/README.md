# Proves

No cal instal·lar res a part de Node, Python i Chrome.

- **Lògica** (validació, fusió, Leitner, prompt…): `node tests/logic.test.js`
- **Rōmaji** (kana → rōmaji): `node tests/romaji.test.js`
- **Navegador** (l'app sencera, pantalla per pantalla): `bash tests/browser/run.sh` des de Git Bash. Engega un servidor local, obre `tests/browser/harness.html` amb Chrome sense finestra i mostra només el que falla. També la pots obrir a mà: `python tests/browser/server.py` i ves a http://127.0.0.1:8767/tests/browser/harness.html.

Les proves de veu depenen de les veus del Chrome i de la connexió: si falla només «consola: veu del navegador», torna-ho a provar.

`tests/browser/frames.html` serveix per fer captures a mida de mòbil (paràmetres al principi del fitxer), i `sample.js` és la resposta de Claude d'exemple que fan servir les proves.

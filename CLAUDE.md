# KanjiApp: notes per a Claude

Web per aprendre kanji i paraules en japonès, per a principiants. Les preferències personals i la manera de treballar són a `CLAUDE.local.md` (només local, no es puja al repo).

## Tecnologia i convencions

- HTML, CSS i JS sense dependències ni compilació, amb rutes relatives, pensat primer per al mòbil i amb tema clar i fosc.
- **Cada canvi apuja `?v=N`** a totes les referències d'[index.html](index.html) (15 en total: 1 CSS i 14 JS); ara és `?v=16`. Si no, GitHub Pages serveix els fitxers vells.
- **Interfície en ca/es/en**: tots els textos són a [js/i18n.js](js/i18n.js), en els tres idiomes (cadenes entre cometes simples i apòstrof tipogràfic ’). Els comentaris del codi són en català.
- Són scripts clàssics, cadascun amb un IIFE que exposa un objecte global: `I18n`/`t`, `U` (util), `Almacen`, `Validar`, `Store`, `Prompt`, `Veu`, `Traces`, `Inici`, `Fitxa`, `Afegir`, `Practica`, `Calendari`, `App`. L'ordre de càrrega és el d'index.html.
- Rutes amb hash: `#/`, `#/k/<kanji>`, `#/afegir[/arg]`, `#/practica[/sessio]`, `#/calendari`.
- **Persistència**: [js/almacen.js](js/almacen.js), copiat d'un altre projecte (fitxer JSON + còpia al navegador + reconnexió + exportar/importar). Les preferències de vista (significats i rōmaji) es desen a localStorage `kanji:vista`.
- Commits: en anglès, `Add: …` / `Fix: …`, amb una llista de punts opcional.
- Compte amb les classes CSS genèriques: ja n'hi ha hagut col·lisions (`.back`, `.today`, `.n`, `.seg span`). Fes servir noms específics.

## Dades

`{ version: 1, kanji: [fitxes], progress: { <kanji>: { box, due, seen, fails, last } }, history: { 'AAAA-MM-DD': respostes } }`

- **Fitxa**: `kanji` (un kanji sol o una paraula sencera), `meanings{ca,es,en}[]`, `onyomi[]` (katakana), `kunyomi[]`, `reading`, `reading2`, `strokes`, `jlpt`, `emoji`, `origin`/`mnemonic`/`trivia{ca,es,en}`, `examples[{word,reading,meaning{}}]`, `sentence{jp,reading,romaji,meaning{}}`, `verified` (`false` | `true` | `'error'`), `edited`, `mainByUser`.
- **Paraules** (学校, 食べる, じゃがいも): van a la mateixa llista `kanji`, amb `onyomi`/`kunyomi` buits i `strokes: null`. A l'inici i a la pràctica hi ha el filtre Kanji/Paraules (si no en tries cap, es veuen tots dos).
- **Lectures principals**: `reading` és la que s'aprèn primer. `reading2` és opcional (七: しち / なな) i només la posa l'usuari, des de la fitxa; `Validar.check` la buida sempre que la dona Claude. En regenerar una fitxa, les lectures triades per l'usuari es mantenen si encara surten entre les lectures (`Validar.keptMains`, `Store.merge`).
- **El progrés va a part del contingut**, així que regenerar una fitxa no l'esborra.
- **Leitner**: dies `[0,1,3,7,14,30]`. Un repàs extra el mateix dia no fa pujar de caixa, però una fallada la torna a la caixa 1. `history` compta cada resposta.
- **Rōmaji**: el de lectures i paraules el calcula l'app (`U.romaji`). El de la frase el dona Claude, perquè ha de saber que は es diu «wa».

## Flux per afegir fitxes

[js/prompt.js](js/prompt.js) genera el prompt que l'usuari copia a Claude.ai, i ell hi enganxa la resposta. [js/validar.js](js/validar.js) la valida (`coerce` per la forma, `check` estricte per al que ve de Claude, `review` amb els estats nou/actualitzat/igual/error), aprofita les respostes tallades (es queda amb les fitxes senceres) i [js/store.js](js/store.js) les fusiona per caràcter.

- **«Trio els kanjis»**: l'usuari els escriu; una paraula sencera va entre 「」. Els que ja té surten en gris i no s'afegeixen al prompt.
- **«Claude tria els kanjis»**: el botó **no copia res**, només ensenya les opcions (temàtica, quants n'hi ha (per defecte 10), paraules concretes). Quan prem «Copiar prompt», el prompt porta tots els kanji i paraules que ja té. Les paraules s'han d'escriure com es fa habitualment al Japó a nivell inicial (じゃがいも, no 芋).

## Proves

Són a [tests/](tests/README.md). Després de cada canvi, passa-les totes i afegeix proves per al que hagis fet:

- `node tests/logic.test.js` i `node tests/romaji.test.js`
- `bash tests/browser/run.sh`: l'app sencera en un Chrome sense finestra (~220 comprovacions). La prova de la veu del navegador de vegades falla per temps; si és l'única que falla, torna-la a passar.
- Per veure com queda, fes captures amb `tests/browser/frames.html` (390 px, en clar i en fosc i en els tres idiomes). Fes servir `--virtual-time-budget` perquè l'app tingui temps de pintar-se.

## Decisions

- La pràctica ja no té mode «Lectura»; ara hi ha «Kanji → significat/lectura».
- Paraules que tenen kanji però que normalment s'escriuen en kana: Claude les dona tal com s'escriuen (じゃがいも).
- Si la veu japonesa del navegador no hi és o falla, hi ha una alternativa en línia ([js/veu.js](js/veu.js)), i la consola explica què ha passat.

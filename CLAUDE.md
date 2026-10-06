# KanjiApp: notes per a Claude

Web per aprendre kanji i paraules en japonès, per a principiants. Les preferències personals i la manera de treballar són a `CLAUDE.local.md` (només local, no es puja al repo).

## Tecnologia i convencions

- HTML, CSS i JS sense dependències ni compilació, amb rutes relatives, pensat primer per al mòbil i amb tema clar i fosc.
- **Cada canvi apuja `?v=N`** a totes les referències d'[index.html](index.html) amb `node tools/versio.js` (ara és `?v=26`). Si no, GitHub Pages serveix els fitxers vells.
- **Interfície en ca/es/en**: tots els textos són a [js/i18n.js](js/i18n.js), en els tres idiomes (cadenes entre cometes simples i apòstrof tipogràfic ’). Els comentaris del codi són en català.
- Són scripts clàssics, cadascun amb un IIFE que exposa un objecte global: `Prefs`, `I18n`/`t`, `U` (util), `Card`, `Peces`, `Almacen`, `Validar`, `Store`, `Prompt`, `Veu`, `Traces`, `Inici`, `Fitxa`, `Afegir`, `Practica`, `Calendari`, `Etiquetes`, `App`. L'ordre de càrrega és el d'index.html.
- **On va cada cosa**: `U` només té coses generals (DOM, HTML, dates, kana → rōmaji, icones, avisos). Les regles d'una fitxa (si és paraula, nivell, lectures principals, verificació) són a `Card` ([js/card.js](js/card.js)), sense HTML. Els trossos d'HTML que comparteixen les pantalles (rōmaji, lectures, botó de veu, rajola) són a `Peces` ([js/peces.js](js/peces.js)).
- **HTML amb `U.html`**: les plantilles s'escriuen com a ``html`<p>${text}</p>` ``, que escapa sol el text (no cal `esc`). Es poden niar, les llistes s'uneixen, `null`/`undefined` no pinten res i `true`/`false` s'escriuen (per als `aria-*`). Per a les condicions, `cond ? html`…` : ''` (no `&&`). `U.join(llista, separador)` i `U.raw(text)` per a l'HTML que ja és segur.
- **Clics amb `U.onActions(root, { nom(el, e) {…} })`**: cada botó porta `data-act="nom"`; si n'hi ha un dins d'un altre, guanya el de més endins.
- **Pantalles**: cada una és `{ nav, render(root, arg), key(e) }` i guarda el seu estat en un sol objecte (`state`, `options`, `session`). Funcions curtes, una per panell o tros de la pantalla.
- **Estil**: una instrucció per línia, línies de menys de ~130 caràcters i noms que diguin què són (`card`, `progress`, `grade`, no `k`, `p`, `g`).
- Rutes amb hash: `#/`, `#/k/<kanji>`, `#/afegir[/arg]`, `#/practica[/sessio]`, `#/calendari`, `#/etiquetes[/<id>]`.
- **Persistència**: [js/almacen.js](js/almacen.js), copiat d'un altre projecte (fitxer JSON + còpia al navegador + reconnexió + exportar/importar). Les preferències del navegador (tema, idioma, què es mostra, opcions de pràctica…) passen totes per `Prefs` ([js/prefs.js](js/prefs.js)), on hi ha la llista de claus de localStorage.
- Commits: en anglès, `Add: …` / `Fix: …`, amb una llista de punts opcional.
- Compte amb les classes CSS genèriques: ja n'hi ha hagut col·lisions (`.back`, `.today`, `.n`, `.seg span`). Fes servir noms específics.

## Dades

`{ version: 1, kanji: [fitxes], progress: { <kanji>: { box, due, seen, fails, last } }, history: { 'AAAA-MM-DD': respostes }, tags: [{ id, name, parent }], cardTags: { <kanji>: [id] } }`

- **Fitxa**: `kanji` (un kanji sol o una paraula sencera), `meanings{ca,es,en}[]`, `onyomi[]` (katakana), `kunyomi[]`, `reading`, `reading2`, `strokes`, `jlpt`, `emoji`, `origin`/`mnemonic`/`trivia{ca,es,en}`, `examples[{word,reading,meaning{}}]`, `sentence{jp,reading,romaji,meaning{}}`, `verified` (`false` | `true` | `'error'`), `edited`, `mainByUser`.
- **Paraules** (学校, 食べる, じゃがいも): van a la mateixa llista `kanji`, amb `onyomi`/`kunyomi` buits i `strokes: null`. A l'inici i a la pràctica hi ha el filtre Kanji/Paraules (si no en tries cap, es veuen tots dos).
- **Lectures principals**: `reading` és la que s'aprèn primer. `reading2` és opcional (七: しち / なな) i només la posa l'usuari, des de la fitxa; `Validar.check` la buida sempre que la dona Claude. En regenerar una fitxa, les lectures triades per l'usuari es mantenen si encara surten entre les lectures (`Card.keptMains`, `Store.merge`).
- **El progrés va a part del contingut**, així que regenerar una fitxa no l'esborra.
- **Etiquetes**: també a part del contingut. Fan un arbre (`parent` és `''` a les principals, i hi pot haver tants nivells com vulguis), en l’ordre que tries amb ↑ ↓ (el de la llista `tags`), i una fitxa en pot tenir moltes. Filtrar o cercar per una etiqueta inclou les de dins (`Store.cardsInTag`). Es posen des de la fitxa (panell «Etiquetes») o en grup a `#/etiquetes/<id>` (toques les fitxes). A l'inici tenen una fila de botons a part de Kanji/Paraules, i el cercador les troba sense accents. «Sense etiqueta» és automàtica (no es desa): són les fitxes que no en tenen cap.
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

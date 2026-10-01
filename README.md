# Kanji

Web per aprendre kanji (i paraules) practicant: fitxes amb lectures, veu, ordre de traços i mnemotècnia, i pràctica amb repetició espaiada (Leitner, 5 caixes). Funciona a mòbil i PC, en català, castellà i anglès, amb tema clar i fosc.

HTML, CSS i JavaScript sense dependències ni compilació. Es publica tal qual amb GitHub Pages.

## Com s'afegeixen kanji

1. A **Afegir**, tria com vols escollir els kanji i prem **Copiar prompt**:
   - **Trio els kanjis**: escriu els kanji; per a una paraula sencera, posa-la entre 「」 (「学校」). Els que ja tens no hi van (surten en gris); toca'n un si el vols regenerar.
   - **Claude tria els kanjis**: una temàtica i quants kanji en vols (si no hi poses número, 10) i, a més a més, les paraules concretes que vulguis saber escriure. Claude dona cada paraula tal com s'escriu habitualment al Japó i a nivell inicial (patata → じゃがいも, escola → 学校), en fa la fitxa i també la dels kanji nous que tingui. El prompt porta tots els teus kanji i paraules perquè no te'n repeteixi cap.
2. Enganxa el prompt a [Claude.ai](https://claude.ai) i copia'n la resposta.
3. Enganxa-la a l'app: la valida, en mostra una previsualització (nous, actualitzats, errors) i la fusiona per caràcter. Si en demanes molts i la resposta arriba tallada, desa les fitxes que han arribat senceres i et deixa copiar el prompt dels que falten.

Si regeneres un kanji que ja tens, se'n substitueix el contingut i se'n conserva el progrés de pràctica.

## Inici

La graella té filtres per nivell (N5, N4…) i per tipus (**Kanji** o **Paraules**; sense cap, es veuen tots dos). Amb els interruptors de **Mostrar** pots amagar els significats de sota de cada fitxa (per provar-te) i el rōmaji de tota l'app. Es recorden en aquest navegador.

A la fitxa d'un kanji passes a l'anterior o la següent amb les fletxes (també les del teclat) i, al mòbil, lliscant el dit cap a la dreta o cap a l'esquerra.

## Pràctica i calendari

**Practicar** fa servir 5 caixes (Leitner): si l'encertes puja de caixa i torna més tard (1, 3, 7, 14 i 30 dies); si falles, torna a la caixa 1. Amb l'interruptor **Tornar a practicar els d'avui** (per a tot el programa, no per targeta), els kanji que ja has practicat avui poden tornar a sortir: encertar-los no els puja de caixa, però fallar-los els torna a la caixa 1.

**Calendari** mostra mes a mes quantes targetes has respost cada dia: cada resposta a Practicar (No, Sí o Dubte) compta 1, també al repàs lliure i quan una fallada torna a sortir. Com més intens és el color, més has practicat (0, 1–9, 10–19, 20–39, 40–59 i 60 o més).

## Dades

Tot es desa en un JSON: el tries amb **Crear arxiu / Obrir existent** (Chrome i Edge d'escriptori) i sempre se'n guarda una còpia al navegador. **Exportar** i **Importar** serveixen per fer còpies o passar les dades a un altre dispositiu.

```json
{
  "version": 1,
  "kanji": [ { "kanji": "日", "meanings": { "ca": ["sol"], "es": ["sol"], "en": ["sun"] }, "...": "..." } ],
  "progress": { "日": { "box": 2, "due": "2026-10-02", "seen": 5, "fails": 1, "last": "2026-09-29" } },
  "history": { "2026-09-29": 32 }
}
```

`last` és l'últim dia que l'has practicat, i `history`, quantes respostes has donat cada dia (per al calendari).

El format de cada fitxa és el que defineix el prompt de [js/prompt.js](js/prompt.js), amb els textos en `ca`, `es` i `en`. Una fitxa pot ser un kanji sol o una **paraula**: llavors `kanji` porta la paraula sencera (学校, 食べる, じゃがいも), `onyomi` i `kunyomi` van buits, `strokes` és `null` i `reading` és com es llegeix tota la paraula. `reading` és la lectura que s'aprèn primer (一 → いち) i `sentence.romaji`, la frase en rōmaji; el rōmaji de les paraules i lectures el calcula l'app a partir del kana. El camp `verified` el canvies tu des de la fitxa: `false` (per verificar), `true` (verificat) o `"error"` (té errors).

## Veu

Si el navegador té una veu japonesa, la fa servir i funciona sense connexió. Si no en té (per exemple Opera, o Windows sense la veu japonesa), reprodueix la veu en línia de Google Translate. És un servei no oficial: envia el text a Google i podria deixar de funcionar. Per tenir veu sense connexió a Windows: **Configuració → Hora i idioma → Veu → Afegeix veus → Japonès**.

## Estructura

```
index.html          Esquelet de la pàgina
css/styles.css      Estils (mobile-first, tema clar/fosc amb variables)
js/i18n.js          Tots els textos de la interfície (ca/es/en)
js/util.js          Utilitats: escapament, dates, kana, icones, avisos
js/almacen.js       Persistència (JSON al disc + còpia al navegador)
js/validar.js       Lectura i validació del JSON que ve de la IA
js/store.js         Estat: kanji + progrés, fusió i caixes Leitner
js/prompt.js        Prompt de contingut per a Claude.ai
js/veu.js           Veu en japonès (Web Speech API)
js/traces.js        Ordre de traços animat (KanjiVG)
js/inici.js         Pantalla: graella, cerca i filtre JLPT
js/fitxa.js         Pantalla: fitxa d'un kanji
js/afegir.js        Pantalla: afegir kanji
js/practica.js      Pantalla: pràctica
js/calendari.js     Pantalla: calendari de pràctica
js/app.js           Rutes, tema, idioma, arxiu, exportar/importar
```

Per provar-la en local: `python -m http.server` dins de la carpeta i obre `http://localhost:8000`.

## Crèdits

L'ordre de traços es carrega de [KanjiVG](https://kanjivg.tagaini.net), © Ulrich Apel, amb llicència [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

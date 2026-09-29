# Kanji

Web per aprendre kanji practicant: fitxes amb lectures, veu, ordre de traços i mnemotècnia, i pràctica amb repetició espaiada (Leitner, 5 caixes). Funciona a mòbil i PC, en català, castellà i anglès, amb tema clar i fosc.

HTML, CSS i JavaScript sense dependències ni compilació. Es publica tal qual amb GitHub Pages.

## Com s'afegeixen kanji

1. A **Afegir**, escriu els kanji i prem **Copiar prompt**. Els que ja tens no hi van (surten en gris); toca'n un si el vols regenerar.
2. Enganxa el prompt a [Claude.ai](https://claude.ai) i copia'n la resposta.
3. Enganxa-la a l'app: la valida, en mostra una previsualització (nous, actualitzats, errors) i la fusiona per caràcter.

Si regeneres un kanji que ja tens, se'n substitueix el contingut i se'n conserva el progrés de pràctica.

## Dades

Tot es desa en un JSON: el tries amb **Crear arxiu / Obrir existent** (Chrome i Edge d'escriptori) i sempre se'n guarda una còpia al navegador. **Exportar** i **Importar** serveixen per fer còpies o passar les dades a un altre dispositiu.

```json
{
  "version": 1,
  "kanji": [ { "kanji": "日", "meanings": { "ca": ["sol"], "en": ["sun"] }, "...": "..." } ],
  "progress": { "日": { "box": 2, "due": "2026-10-02", "seen": 5, "fails": 1 } }
}
```

El format de cada kanji és el que defineix el prompt de [js/prompt.js](js/prompt.js), amb els textos en `ca`, `es` i `en`. El camp `verified` el canvies tu des de la fitxa: `false` (per verificar), `true` (verificat) o `"error"` (té errors).

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
js/app.js           Rutes, tema, idioma, arxiu, exportar/importar
```

Per provar-la en local: `python -m http.server` dins de la carpeta i obre `http://localhost:8000`.

## Crèdits

L'ordre de traços es carrega de [KanjiVG](https://kanjivg.tagaini.net), © Ulrich Apel, amb llicència [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

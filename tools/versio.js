// Apuja el número de versió (?v=N) de tots els CSS i JS d'index.html, perquè GitHub Pages no serveixi
// els fitxers vells que el navegador té guardats. Com s'executa: node tools/versio.js
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const page = fs.readFileSync(file, 'utf8');

const versions = [...page.matchAll(/\?v=(\d+)/g)].map(m => Number(m[1]));
if (!versions.length) {
  console.log('index.html no té cap ?v=N.');
  process.exit(1);
}
const next = Math.max(...versions) + 1;
fs.writeFileSync(file, page.replace(/\?v=\d+/g, '?v=' + next));
console.log(`?v=${next} a ${versions.length} referències d'index.html.`);

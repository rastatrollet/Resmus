import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const KEY = 'ca21d237580b40cb8302c02de9735b84';
const OP = process.argv[2] || 'jlt';

const buf = await fetch(`https://opendata.samtrafiken.se/netex/${OP}/${OP}.zip?key=${KEY}`).then(r => r.arrayBuffer());
const JSZip = require('jszip');
const zip = await JSZip.loadAsync(buf);
const keys = Object.keys(zip.files).filter(k => !zip.files[k].dir);
console.log(`Files (${keys.length}):`);
keys.slice(0, 15).forEach(k => console.log(' ', k));

// Find a non-shared line file
const lineKey = keys.find(k => k.startsWith('line_') || k.includes('Line'));
if (lineKey) {
    const f = zip.files[lineKey];
    const txt = await f.async('text');
    // Write to temp file so we can inspect it
    const { writeFileSync } = await import('fs');
    writeFileSync('scripts/_netex_sample.xml', txt);
    console.log(`\nWrote ${txt.length} chars to scripts/_netex_sample.xml`);
    console.log('First 3000:\n' + txt.slice(0, 3000));
}

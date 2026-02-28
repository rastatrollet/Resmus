const fs = require('fs');
const JSZip = require('jszip');

async function checkJlt() {
    try {
        const buf = fs.readFileSync('jlt.zip');
        console.log("Zip loaded, size:", buf.length);
        const zs = await JSZip.loadAsync(buf);
        const files = Object.keys(zs.files).filter(f => f.endsWith('.xml') && !zs.files[f].dir);
        let count = 0;
        for (const file of files) {
            const xml = await zs.files[file].async('text');
            const lines = xml.match(/<Line[^>]*id="([^"]+)"[^>]*>[\s\S]*?<PublicCode>([^<]+)<\/PublicCode>/g);
            if (lines) console.log("Lines sample:", lines.slice(0, 3));

            const journeys = xml.match(/<ServiceJourney[^>]*id="([^"]+)"/g);
            if (journeys) {
                console.log("SJ sample:", journeys.slice(0, 5));
                count += journeys.length;
            }
            if (count > 0) break;
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
checkJlt();

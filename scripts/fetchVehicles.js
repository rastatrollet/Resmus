import fs from 'fs';

async function processSheet(gid, outputPath) {
    const url = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?gid=${gid}&single=true&output=csv`;
    const res = await fetch(url);
    const text = await res.text();

    // Parse CSV properly
    const lines = text.split('\n');
    let data = {};

    for (let i = 0; i < lines.length; i++) {
        let l = lines[i].trim();
        if (!l) continue;

        // Very basic assumption: IDs are numeric strings
        let parts = l.split(',');
        if (parts.length < 3) continue;

        const idStr = parts[0].trim();
        // Check if ID starts with a digit, is at least 4 chars long
        if (!/^\d/.test(idStr) || idStr.length < 4) continue;

        const id = idStr;
        const plate = parts[1] && parts[1] !== '*' ? parts[1].trim() : null;
        const model = parts[2] && parts[2] !== '*' ? parts[2].trim() : null;
        const operator = parts[3] && parts[3] !== '*' ? parts[3].trim() : null;
        let altId = parts.length > 4 && parts[4] && parts[4] !== '*' ? parts[4].trim() : null;
        if (altId === '\r') altId = null; // Fix carriage returns

        if (plate || model || operator || altId) {
            data[id] = {
                plate: plate || undefined,
                model: model || undefined,
                operator: operator || undefined,
                altId: altId || undefined
            };
            if (!data[id].operator) delete data[id].operator;
            if (!data[id].model) delete data[id].model;
            if (!data[id].plate) delete data[id].plate;
            if (!data[id].altId) delete data[id].altId;
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Saved ${Object.keys(data).length} vehicles to ${outputPath}`);
}

async function main() {
    await processSheet('617657268', './src/sl-vehicles.json');
    await processSheet('1024044367', './src/skane-vehicles.json');
}

main().catch(console.error);

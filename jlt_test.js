import JSZip from 'jszip';
fetch('https://opendata.samtrafiken.se/netex/jlt/jlt.zip?key=ca21d237580b40cb8302c02de9735b84')
    .then(r => r.arrayBuffer())
    .then(b => JSZip.loadAsync(b))
    .then(async zip => {
        const fn = Object.keys(zip.files).find(x => x.endsWith('.xml') && !x.includes('Stops'));
        const xml = await zip.files[fn].async('string');

        // find JourneyPattern
        const jpMatch = xml.match(/<JourneyPattern[^>]*>[\s\S]*?<\/JourneyPattern>/);
        if (jpMatch) {
            console.log('--- JP ---');
            console.log(jpMatch[0].substring(0, 1000));
        }

        // find DestinationDisplay
        const ddMatch = xml.match(/<DestinationDisplay[^>]*>[\s\S]*?<\/DestinationDisplay>/);
        if (ddMatch) {
            console.log('--- DD ---');
            console.log(ddMatch[0]);
        }

        // find ServiceJourney
        const sjMatch = xml.match(/<ServiceJourney[^>]*>[\s\S]*?<\/ServiceJourney>/);
        if (sjMatch) {
            console.log('--- SJ ---');
            console.log(sjMatch[0].substring(0, 1000));
        }
    });

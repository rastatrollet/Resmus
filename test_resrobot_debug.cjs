
const fs = require('fs');
const https = require('https');

const RESROBOT_KEY = "d1adb079-6671-4598-a6b5-8b66a871b11b";
const URL = "https://api.resrobot.se/v2.1/departureBoard";
const STHLM_C_ID = "740000001";

const fullUrl = `${URL}?id=${STHLM_C_ID}&accessId=${RESROBOT_KEY}&format=json&duration=60&maxJourneys=5&rt=true`;

console.log("Fetching:", fullUrl);

https.get(fullUrl, (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        try {
            const json = JSON.parse(data);
            fs.writeFileSync('resrobot_out_utf8.txt', JSON.stringify(json, null, 2));
            console.log("Done. Written to resrobot_out_utf8.txt");
        } catch (e) {
            console.error("Error parsing JSON", e);
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});

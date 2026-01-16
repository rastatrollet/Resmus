
import { API_KEYS, API_URLS } from './services/config.js';

if (!globalThis.fetch) {
    console.error("Node 18+ required");
    process.exit(1);
}

const testResrobot = async () => {
    console.log("Testing Resrobot API - Departures...");

    // Stockholm C ID (approx)
    // Actually let's search first to get a valid ID to be safe
    const searchUrl = `${API_URLS.RESROBOT_API}/location.name?input=Stockholm&maxNo=1&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const id = searchData.StopLocation[0].id;
    console.log("Using Station ID:", id);

    // Test departureBoard WITHOUT .json
    const depUrl = `${API_URLS.RESROBOT_API}/departureBoard?id=${id}&duration=60&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;

    console.log(`\nTesting: ${depUrl}`);
    try {
        const res = await fetch(depUrl);
        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Body start:", text.substring(0, 200));

        try {
            const json = JSON.parse(text);
            console.log("JSON parsed successfully. Departures found:", json.Departure?.length);
        } catch (e) {
            console.log("Not JSON");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
};

testResrobot();

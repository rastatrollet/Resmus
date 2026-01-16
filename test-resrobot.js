
import { API_KEYS, API_URLS } from './services/config.js';

if (!globalThis.fetch) {
    console.error("Node 18+ required");
    process.exit(1);
}

const testResrobot = async () => {
    console.log("Testing Resrobot API...");
    // console.log("Key:", API_KEYS.RESROBOT_API_KEY); 

    const query = "Stockholm";

    // Variant 1: .json and format=json
    const url1 = `${API_URLS.RESROBOT_API}/location.name.json?input=${encodeURIComponent(query)}&maxNo=5&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;

    // Variant 2: no .json
    const url2 = `${API_URLS.RESROBOT_API}/location.name?input=${encodeURIComponent(query)}&maxNo=5&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;

    console.log(`\n--- Test 1: ${url1} ---`);
    try {
        const res = await fetch(url1);
        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Body:", text.substring(0, 500)); // Print first 500 chars
    } catch (e) {
        console.error("Error:", e.message);
    }

    console.log(`\n--- Test 2: ${url2} ---`);
    try {
        const res = await fetch(url2);
        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Body:", text.substring(0, 500));
    } catch (e) {
        console.error("Error:", e.message);
    }
};

testResrobot();

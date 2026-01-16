import { API_KEYS, API_URLS } from './services/config.js';

if (!globalThis.fetch) {
    console.error("Node 18+ required");
    process.exit(1);
}

const testVasttrafik = async () => {
    console.log("Testing Västtrafik API...");
    console.log("Auth Key Present:", !!API_KEYS.VASTTRAFIK_AUTH);
    console.log("Token URL:", API_URLS.VASTTRAFIK_TOKEN);

    // Test 1: Get Token
    console.log("\n--- Test 1: Token Request ---");
    try {
        const res = await fetch(API_URLS.VASTTRAFIK_TOKEN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${API_KEYS.VASTTRAFIK_AUTH}`
            },
            body: 'grant_type=client_credentials'
        });

        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Response:", text.substring(0, 500));

        if (res.ok) {
            const data = JSON.parse(text);
            if (data.access_token) {
                console.log("\n✅ Token obtained successfully");
                const token = data.access_token;

                // Test 2: Search for a station
                console.log("\n--- Test 2: Station Search ---");
                const searchUrl = `${API_URLS.VASTTRAFIK_API}/locations/by-text?q=Centralstationen&limit=5&types=stoparea`;
                const searchRes = await fetch(searchUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log("Search Status:", searchRes.status);
                const searchData = await searchRes.json();
                console.log("Search Results:", JSON.stringify(searchData, null, 2).substring(0, 500));

                if (searchData.results && searchData.results.length > 0) {
                    const stationId = searchData.results[0].gid;
                    console.log("\n--- Test 3: Departures ---");
                    const depUrl = `${API_URLS.VASTTRAFIK_API}/stop-areas/${stationId}/departures?limit=5&timeSpan=60`;
                    const depRes = await fetch(depUrl, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log("Departures Status:", depRes.status);
                    const depData = await depRes.json();
                    console.log("Departures:", JSON.stringify(depData, null, 2).substring(0, 500));
                }
            }
        } else {
            console.log("\n❌ Token request failed");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
};

testVasttrafik();

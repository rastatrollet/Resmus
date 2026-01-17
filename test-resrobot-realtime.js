
const API_URLS = {
    RESROBOT_API: "https://api.resrobot.se/v2.1",
};

const RESROBOT_API_KEY = "d1adb079-6671-4598-a6b5-8b66a871b11b"; // From config.ts
const STATION_ID = "740000003"; // Göteborg Centralstation

async function run() {
    console.log("Fetching Resrobot Departures via Proxy...");

    // Add passlist=0 to minimize payload, but ensure realtime is there.
    // Resrobot documentation says realtime is included by default if available.
    // But let's check.
    const url = `${API_URLS.RESROBOT_API}/departureBoard.json?id=${STATION_ID}&duration=60&accessId=${RESROBOT_API_KEY}&format=json&maxJourneys=10`;

    // Configured for Proxy
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);

    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) {
            console.error("Proxy fetch failed:", res.status);
            // console.log(await res.text());
            return;
        }

        const data = await res.json();
        console.log("Got Data.");
        console.log("Departure count:", data.Departure ? data.Departure.length : 0);

        if (data.Departure && data.Departure.length > 0) {
            console.log("\nSample Departure (First item):");
            const first = data.Departure[0];
            console.log(JSON.stringify(first, null, 2));

            // Check for realtime fields
            const hasRtTime = data.Departure.some(d => d.rtTime);
            console.log("\nHas realtime data (rtTime)?", hasRtTime);

            if (!hasRtTime) {
                console.log("NOTE: No 'rtTime' found. API Key might lack Realtime permission OR station has no realtime info.");
            } else {
                console.log("Realtime data detected!");
            }
        } else {
            console.log("No departures found or bad format.");
            console.log("Raw Data keys:", Object.keys(data));
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

run();

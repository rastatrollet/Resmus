
const API_URLS = {
    VASTTRAFIK_TOKEN: "https://ext-api.vasttrafik.se/token",
    VASTTRAFIK_TS_API: "https://ext-api.vasttrafik.se/ts/v1",
};

// Hardcoded key from config.ts
const VASTTRAFIK_AUTH = "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh";

async function run() {
    console.log("Fetching token...");
    const tokenRes = await fetch(API_URLS.VASTTRAFIK_TOKEN, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${VASTTRAFIK_AUTH}`
        },
        body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) {
        console.error("Token fail:", tokenRes.status, await tokenRes.text());
        return;
    }
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    console.log("Token obtained.");

    const url = `${API_URLS.VASTTRAFIK_TS_API}/traffic-situations`;
    console.log("Fetching disruptions from:", url);

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error("Disruptions fail:", res.status, await res.text());
        return;
    }

    const data = await res.json();
    const fs = await import('fs');
    console.log("Raw count:", data.length);

    // Analyze unique
    const uniqueIds = new Set(data.map(d => d.situationNumber));
    console.log("Unique SituationNumbers:", uniqueIds.size);

    // Analyze Active (not expired)
    const now = new Date();
    const active = data.filter(d => {
        if (!d.endTime) return true;
        return new Date(d.endTime) > now;
    });
    console.log("Active (Raw):", active.length);

    const activeUnique = new Set(active.map(d => d.situationNumber));
    console.log("Active & Unique:", activeUnique.size);

    // Log the active unique ones to see what they are
    const activeUniqueList = [];
    const seen = new Set();
    for (const d of active) {
        if (!seen.has(d.situationNumber)) {
            seen.add(d.situationNumber);
            activeUniqueList.push({
                id: d.situationNumber,
                title: d.title,
                endTime: d.endTime
            });
        }
    }
    // console.log("Active Unique List:", JSON.stringify(activeUniqueList, null, 2));


}

run();

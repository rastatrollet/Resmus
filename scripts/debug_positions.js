
const AUTH = "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh";
const TOKEN_URL = "https://ext-api.vasttrafik.se/token";
const API_URL = "https://ext-api.vasttrafik.se/pr/v4/positions?limit=5&lowerLeftLat=57.6&lowerLeftLong=11.8&upperRightLat=57.8&upperRightLong=12.1";

async function run() {
    console.log("Fetching token...");
    try {
        const tokenRes = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${AUTH}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenRes.ok) {
            console.error("Token failed", tokenRes.status, await tokenRes.text());
            return;
        }

        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;
        console.log("Token obtained.");

        console.log("Fetching positions...");
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.error("Positions failed", res.status);
            return;
        }

        const data = await res.json();
        console.log("Data length:", data.length);
        if (data.length > 0) {
            const item = data[0];
            console.log("ROOT KEYS:", Object.keys(item));
            if (item.serviceJourney) {
                console.log("SJ KEYS:", Object.keys(item.serviceJourney));
                if (item.serviceJourney.line) {
                    console.log("SJ LINE KEYS:", Object.keys(item.serviceJourney.line));
                }
            }
            console.log("FULL ITEM JSON:");
            console.log(JSON.stringify(item, null, 2));
        } else {
            console.log("No positions found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();

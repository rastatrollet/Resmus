
const API_URLS = {
    VASTTRAFIK_TOKEN: "https://corsproxy.io/?https%3A%2F%2Fext-api.vasttrafik.se%2Ftoken",
    VASTTRAFIK_TS_API: "https://corsproxy.io/?https%3A%2F%2Fext-api.vasttrafik.se%2Fts%2Fv1",
};

// Config from hardcoded strings found in config.ts
const VASTTRAFIK_AUTH = "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh";

async function run() {
    console.log("Fetching token via Proxy...");
    // Token endpoint via proxy sometimes behaves differently with POST bodies
    // But let's try to mimic transitService.ts exactly which uses fetchWithCors 
    // Wait, fetchWithCors constructs the proxy URL manually.

    // Let's mimic fetchWithCors logic
    const fetchWithCors = async (url, options = {}) => {
        const targetUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
        // console.log("Proxy URL:", proxyUrl);
        return fetch(proxyUrl, options);
    };

    // 1. Get Token
    const tokenUrl = "https://ext-api.vasttrafik.se/token";
    const tokenRes = await fetchWithCors(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${VASTTRAFIK_AUTH}`
        },
        body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) {
        console.error("Token fail via proxy:", tokenRes.status);
        console.log(await tokenRes.text());
        return;
    }
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    console.log("Token obtained via Proxy.");

    // 2. Get Disruptions
    const url = "https://ext-api.vasttrafik.se/ts/v1/traffic-situations";
    console.log("Fetching disruptions via Proxy from:", url);

    const res = await fetchWithCors(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error("Disruptions fail via proxy:", res.status);
        return;
    }

    const data = await res.json();
    console.log("Raw count via Proxy:", data.length);
}

run();

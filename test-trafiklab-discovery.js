
const API_KEY = "600ef54ef3234bd1880624c148baa8f7"; // GTFS Regional Realtime Key

async function testUrl(name, url, desc) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status} ${res.statusText}`);
        if (res.ok) {
            const text = await res.text();
            console.log(`Response start: ${text.substring(0, 100)}...`);
            try {
                const json = JSON.parse(text);
                console.log("Format: JSON");
                console.log("Keys:", Object.keys(json));
            } catch {
                console.log("Format: Not JSON (Probable Protobuf or XML)");
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function run() {
    // 1. Configured "TRAFIKLAB_REALTIME_API" (Mystery Endpoint)
    await testUrl("Mystery API", `https://realtime-api.trafiklab.se/v1/departures?key=${API_KEY}`, "User config URL");

    // 2. GTFS-RT Service Alerts (Västtrafik)
    await testUrl("GTFS-RT Alerts (Västtrafik)", `https://opendata.samtrafiken.se/gtfs-rt/vasttrafik/ServiceAlerts.pb?key=${API_KEY}&format=json`, "Standard GTFS-RT");

    // 3. GTFS-RT Trip Updates (Västtrafik)
    await testUrl("GTFS-RT TripUpdates (Västtrafik)", `https://opendata.samtrafiken.se/gtfs-rt/vasttrafik/TripUpdates.pb?key=${API_KEY}&format=json`, "Standard GTFS-RT");

    // 4. SIRI StopMonitoring (Example for a Västtrafik stop area? Or generic?)
    // Samtrafiken SIRI usually requires specific operator endpoints or is XML.
    // Let's try correct Samtrafiken SIRI URL structure if known.
    // "https://opendata.samtrafiken.se/siri-itxpt/v1/stop-monitoring" used to be common pattern? No.
    await testUrl("SIRI VehicleMonitoring", `https://opendata.samtrafiken.se/siri-itxpt/VehicleMonitoring.json?key=${API_KEY}`, "SIRI VM");

    // 5. SL Realtidsinformation 4
    await testUrl("SL Realtidsinformation 4", `https://api.sl.se/api2/realtimedeparturesV4.json?key=${API_KEY}&siteid=9192&timewindow=60`, "SL API");
}

run();

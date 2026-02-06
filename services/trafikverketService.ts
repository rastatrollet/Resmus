
import { Departure, Provider } from '../types';
import { API_KEYS } from './config';
import { TRV_REASON_CODES } from './trafficReasonCodes';

const TV_AUTH_KEY = API_KEYS.TRAFIKVERKET_API_KEY;


const API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json";

const getProxyUrl = () => {
    return import.meta.env.DEV ? '/trafikverket-api/v2/data.json' : "https://corsproxy.io/?" + encodeURIComponent(API_URL);
};

export const TrafikverketService = {
    getTrainDepartures: async (stationIdentifier: string, dateTime?: string, mode: 'departures' | 'arrivals' = 'departures'): Promise<Departure[]> => {
        try {
            console.log('[Trafikverket] getTrainDepartures called with:', stationIdentifier);

            // Ensure we have the station cache for mapping signatures to names
            await TrafikverketService.ensureStationCache();
            console.log('[Trafikverket] Station cache size:', TrafikverketService.stationCache.size);

            let locationSign = '';

            // 1. Check if identifier is a valid Signature (Case-insensitive check against cache)
            // stationCache keys are Signatures (e.g. "CST", "M")
            const upperId = stationIdentifier.toUpperCase();
            console.log(`[Trafikverket] Checking cache for signature: '${upperId}' (Input: '${stationIdentifier}')`);

            if (TrafikverketService.stationCache.has(upperId)) {
                locationSign = upperId;
                console.log('[Trafikverket] Found signature in cache:', locationSign);
            }
            // Also check raw input just in case
            else if (TrafikverketService.stationCache.has(stationIdentifier)) {
                locationSign = stationIdentifier;
                console.log('[Trafikverket] Found raw signature in cache:', locationSign);
            }
            // 2. Check if identifier is a valid Name (e.g. "Malmö C" -> "M")
            // stationNameMap keys are Names
            else if (TrafikverketService.stationNameMap.has(stationIdentifier)) {
                locationSign = TrafikverketService.stationNameMap.get(stationIdentifier) || '';
                console.log('[Trafikverket] Found name in map:', stationIdentifier, '->', locationSign);
            }
            // 3. Fuzzy search in Name Map
            else {
                // Try finding name case-insensitive
                const lowerId = stationIdentifier.toLowerCase();
                for (const [name, sig] of TrafikverketService.stationNameMap.entries()) {
                    if (name.toLowerCase() === lowerId) {
                        locationSign = sig;
                        console.log('[Trafikverket] Found via fuzzy search:', name, '->', locationSign);
                        break;
                    }
                }
            }

            // 4. Fallback: If still no sign, try the API with "clean name" logic (legacy fallback)
            // Only do this if it implies a name (length > 1)
            if (!locationSign && stationIdentifier.length > 1) {
                console.log('[Trafikverket] No signature found in cache, trying API lookup...');
                const cleanName = stationIdentifier.replace(/ T-bana| Spårv| station| C| Central/gi, "").trim();
                // Heuristic: If it looks like a Short Code (uppercase, 2-5 chars), try it as Signature directly in query?
                // But validation failed above. So it's likely a name not in cache (rare) or a typo.
                // Let's rely on the AdvertisedLocationName query.

                const stationXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainStation" namespace="rail.infrastructure" schemaversion="1.5">
        <FILTER>
            <EQ name="AdvertisedLocationName" value="${cleanName}" />
        </FILTER>
        <INCLUDE>LocationSignature</INCLUDE>
    </QUERY>
</REQUEST>`;
                try {
                    const proxyUrl = getProxyUrl();
                    const stationRes = await fetch(proxyUrl, { method: 'POST', body: stationXml, headers: { 'Content-Type': 'text/xml' } });
                    if (stationRes.ok) {
                        const sData = await stationRes.json();
                        locationSign = sData?.RESPONSE?.RESULT?.[0]?.TrainStation?.[0]?.LocationSignature;
                        console.log('[Trafikverket] API lookup result:', locationSign);
                    }
                } catch (e) {
                    console.error('[Trafikverket] API lookup error:', e);
                }
            }

            if (!locationSign) {
                console.warn('[Trafikverket] No LocationSignature found for:', stationIdentifier);
                return [];
            }

            console.log('[Trafikverket] Using LocationSignature:', locationSign);

            // Step 2: Fetch Departures
            // Filter: LocationSignature = X, ActivityType = Avgång, Time >= now
            const timeFilter = dateTime ? new Date(dateTime).toISOString() : new Date().toISOString();
            console.log('[Trafikverket] Time filter:', timeFilter);

            const depXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">
        <FILTER>
            <EQ name="LocationSignature" value="${locationSign}" />
            <GT name="AdvertisedTimeAtLocation" value="${timeFilter}" />
            <LT name="AdvertisedTimeAtLocation" value="${new Date(new Date(timeFilter).getTime() + 14400000).toISOString()}" />
            <EQ name="Advertised" value="true" />
        </FILTER>
        <INCLUDE>AdvertisedTrainIdent</INCLUDE>
        <INCLUDE>AdvertisedTimeAtLocation</INCLUDE>
        <INCLUDE>TimeAtLocation</INCLUDE>
        <INCLUDE>TrackAtLocation</INCLUDE>
        <INCLUDE>ToLocation</INCLUDE>
        <INCLUDE>FromLocation</INCLUDE>
        <INCLUDE>Canceled</INCLUDE>
        <INCLUDE>Deviation</INCLUDE>
        <INCLUDE>EstimatedTimeAtLocation</INCLUDE>
        <INCLUDE>InformationOwner</INCLUDE>
        <INCLUDE>ProductInformation</INCLUDE>
        <INCLUDE>ActivityType</INCLUDE>
        <INCLUDE>OperationalTransportIdentifiers</INCLUDE>
    </QUERY>
</REQUEST>`;
            // Increased window to 4 hours

            const proxyUrl = getProxyUrl();

            const depRes = await fetch(proxyUrl, {
                method: 'POST',
                body: depXml,
                headers: { 'Content-Type': 'text/xml; charset=utf-8' }
            });

            if (!depRes.ok) {
                console.error('[Trafikverket] Departures fetch failed:', depRes.status, depRes.statusText);
                return [];
            }
            const depData = await depRes.json();
            // console.log('[Trafikverket] Raw API Response:', JSON.stringify(depData).substring(0, 500) + '...');
            let trains = depData?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || [];
            console.log(`[Trafikverket] Found ${trains.length} total announcements (Arr/Dep) from API`);

            // Debug: Log unique ActivityTypes to see what we are getting
            const types = [...new Set(trains.map((t: any) => t.ActivityType))];
            console.log('[Trafikverket] ActivityTypes found:', types);

            // Filter for ActivityType="Avgång" in JS to avoid encoding issues
            // Check includes 'Avg' to be safe against encoding or trailing spaces
            // Also filter out '600' (General Announcements)
            // Filter for ActivityType based on mode
            const activityFilter = mode === 'arrivals' ? 'Ank' : 'Avg';

            trains = trains.filter((t: any) =>
                (t.ActivityType && t.ActivityType.indexOf(activityFilter) >= 0) &&
                t.AdvertisedTrainIdent !== '600'
            );
            console.log(`[Trafikverket] ${trains.length} departures after filtering`);

            return trains.map((t: any) => {
                // Map Locations
                // If departures: ToLocation is destination.
                // If arrivals: FromLocation is origin (where it came from).
                const locRaw = mode === 'arrivals' ? t.FromLocation : t.ToLocation;

                const direction = locRaw ? locRaw.map((l: any) => {
                    let sig = (typeof l === 'object' && l.LocationName) ? l.LocationName : l;
                    // Ensure uppercase lookup
                    const name = TrafikverketService.stationCache.get(sig.toUpperCase());
                    return name || sig;
                }).join(', ') : (mode === 'arrivals' ? 'Okänt ursprung' : 'Slutstation');

                // Operator & Product
                // ProductInformation is array of { code, description } e.g. "Snabbtåg"
                const product = t.ProductInformation?.[0]?.Description || "";
                const operator = t.InformationOwner;

                // Safely handle Deviation (string[] or Object[])
                let dMsg: string | undefined = undefined;
                if (t.Deviation) {
                    dMsg = t.Deviation.map((d: any) => {
                        if (typeof d === 'string') return d;
                        if (d && typeof d === 'object') return d.Description || d.Code || '';
                        return '';
                    }).filter((s: string) => s).join('. ');
                }

                return {
                    id: `tv-${t.AdvertisedTrainIdent}-${t.AdvertisedTimeAtLocation}`,
                    journeyRef: `tv-${t.AdvertisedTrainIdent}-${t.AdvertisedTimeAtLocation}`, // Needed for parsing later
                    line: t.AdvertisedTrainIdent,
                    direction: direction,
                    time: new Date(t.AdvertisedTimeAtLocation).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                    datetime: t.AdvertisedTimeAtLocation,
                    timestamp: t.AdvertisedTimeAtLocation,
                    realtime: t.EstimatedTimeAtLocation ? new Date(t.EstimatedTimeAtLocation).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : null,
                    track: t.TrackAtLocation || '',
                    provider: Provider.TRAFIKVERKET,
                    status: t.Canceled ? 'CANCELLED' : (t.EstimatedTimeAtLocation && t.EstimatedTimeAtLocation !== t.AdvertisedTimeAtLocation ? 'LATE' : 'ON_TIME'),
                    type: 'TRAIN',
                    operator: operator,
                    operationalTransportIdentifiers: t.OperationalTransportIdentifiers,
                    // Store product type (Snabbtåg, osv) somewhere? Maybe in disruptionMessage for now or new field?
                    // Let's prepend to disruptionMessage if it's interesting? No.
                    // Let's try to map it to 'line' if we want "SJ 123"?
                    // User wanted "Perfekt". Displaying "SJ Snabbtåg" is nice. 
                    // Let's assume frontend uses 'operator' field logic.
                };
            });

        } catch (e) {
            console.error("Trafikverket error:", e);
            return [];
        }
    },

    lastModified: '',
    stationCache: new Map<string, string>(),

    COMMON_STATIONS: {
        // Storstäder & Knutar
        "G": "Göteborg C",
        "S": "Stockholm C",
        "M": "Malmö C",
        "Cst": "Stockholm C",
        "L": "Linköping C",
        "Nr": "Norrköping C",
        "Kn": "Katrineholm C",
        "Hpbg": "Hallsberg",
        "F": "Falköping C",
        "Sk": "Skövde C",
        "Herr": "Herrljunga",
        "Lp": "Linköping",
        "U": "Uppsala C",
        "Vä": "Västerås C",
        "Ö": "Örebro C",
        "Et": "Eskilstuna C",
        "Gä": "Gävle C",
        "Sd": "Sundsvall C",
        "B": "Borås C",
        "K": "Karlstad C",
        "Ck": "Karlskrona C",
        "H": "Helsingborg C",
        "Lu": "Lund C",
        "Hm": "Hässleholm C",
        "Al": "Alingsås", // Pendel
        "Ler": "Lerum",
        "J": "Jonsered",
        "P": "Partille",
        "Sub": "Sundbyberg",
        "So": "Solna",
        "Ke": "Karlberg",
        "Äs": "Älvsjö",
        "Fas": "Farsta strand",
        "Tul": "Tullinge",
        "Fle": "Flemingsberg",
        "Söc": "Södertälje C",
        "Söd": "Södertälje Syd",
        "Gn": "Gnesta",
        "Mvn": "Mariefred",
        "Arb": "Arboga",
        "Kö": "Köping",
        "Kac": "Kalmar C",
        "Vö": "Växjö",
        "Jö": "Jönköping C",
        "N": "Nässjö C",
        "My": "Mjölby",
        "Tn": "Tranås",
        "Ms": "Motala",
        "Mö": "Malmö C", // Alternate
        "Uå": "Umeå C",
        "Le": "Luleå",
        "Bdn": "Boden C",
        "Krn": "Kiruna",
        "Vt": "Värtan",
        "Åbe": "Årstaberg",
        "Sst": "Stockholms Södra",
        "O": "Odenplan", // Citybanan
        "Sci": "Stockholm City",
        "Sod": "Södra station", // Colloquial
        "Hgl": "Hagalund",
        "Hie": "Hyllie",
        "Tri": "Triangeln",
        "Knh": "Köpenhamn H", // CPH
        "Cph": "Köpenhamn H",
        "Kast": "Kastrup", // Airport
        "Arnc": "Arlanda C",
        "Arns": "Arlanda S",
        "Arnn": "Arlanda N"
    } as Record<string, string>,

    stationNameMap: new Map<string, string>(), // Name -> Sig
    stationCoordsMap: new Map<string, { lat: number, lng: number }>(),

    getDisruptions: async (): Promise<any[]> => {
        // Calculate twoDaysAgoIso
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const twoDaysAgoIso = d.toISOString();

        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="OperativeEvent" namespace="ols.open" schemaversion="1.0" limit="50">
        <FILTER>
            <AND>
                <EQ name="EventState" value="1" />
                <IN name="EventTrafficType" value="0,2" />
                <EQ name="Deleted" value="false" />
            </AND>
        </FILTER>
        <INCLUDE>OperativeEventId</INCLUDE>
        <INCLUDE>EventState</INCLUDE>
        <INCLUDE>EventTrafficType</INCLUDE>
        <INCLUDE>ModifiedDateTime</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>EndDateTime</INCLUDE>
        <INCLUDE>RailRoadTimeForServiceResumption</INCLUDE>
        <INCLUDE>CountyNo</INCLUDE>
        <INCLUDE>EventType.Description</INCLUDE>
        <INCLUDE>EventType.EventTypeCode</INCLUDE>
        <INCLUDE>TrafficImpact.PublicMessage.Header</INCLUDE>
        <INCLUDE>TrafficImpact.PublicMessage.Description</INCLUDE>
        <INCLUDE>TrafficImpact.PublicMessage.StartDateTime</INCLUDE>
        <INCLUDE>TrafficImpact.PublicMessage.EndDateTime</INCLUDE>
        <INCLUDE>TrafficImpact.PublicMessage.ModifiedDateTime</INCLUDE>
        <INCLUDE>TrafficImpact.SelectedSection.FromLocation.Signature</INCLUDE>
        <INCLUDE>TrafficImpact.SelectedSection.ToLocation.Signature</INCLUDE>
        <INCLUDE>TrafficImpact.SelectedSection.ViaLocation.Signature</INCLUDE>
        <INCLUDE>EventSection.FromLocation.Signature</INCLUDE>
        <INCLUDE>EventSection.ToLocation.Signature</INCLUDE>
        <INCLUDE>EventSection.ViaLocation.Signature</INCLUDE>
    </QUERY>
    <QUERY objecttype="RailwayEvent" namespace="ols.open" schemaversion="1.0" limit="50">
        <FILTER>
            <AND>
                <EQ name="Deleted" value="false" />
                <GT name="StartDateTime" value="${twoDaysAgoIso}" />
            </AND>
        </FILTER>
        <INCLUDE>EventId</INCLUDE>
        <INCLUDE>OperativeEventId</INCLUDE>
        <INCLUDE>EventStatus</INCLUDE>
        <INCLUDE>ReasonCode</INCLUDE>
        <INCLUDE>CreatedDateTime</INCLUDE>
        <INCLUDE>ModifiedDateTime</INCLUDE>
        <INCLUDE>ModifiedTime</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>EndDateTime</INCLUDE>
        <INCLUDE>Version</INCLUDE>
        <INCLUDE>SelectedSection.FromLocation.Signature</INCLUDE>
        <INCLUDE>SelectedSection.ToLocation.Signature</INCLUDE>
        <INCLUDE>SelectedSection.ViaLocation.Signature</INCLUDE>
        <INCLUDE>SelectedSection.IntermediateLocation.Signature</INCLUDE>
        <INCLUDE>SelectedSection.IntermediateLocation.LocationOrder</INCLUDE>
    </QUERY>
</REQUEST>`;

        try {
            const proxyUrl = getProxyUrl();
            const res = await fetch(proxyUrl, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });

            if (!res.ok) {
                console.warn('[Trafikverket] Main disruptions fetch failed:', res.status);
                return [];
            }

            const data = await res.json();
            const opEvents = data?.RESPONSE?.RESULT?.[0]?.OperativeEvent || [];
            const railwayEvents = data?.RESPONSE?.RESULT?.[1]?.RailwayEvent || [];

            console.log(`[Trafikverket] Found ${opEvents.length} operative events and ${railwayEvents.length} railway events`);

            // Index RailwayEvents by OperativeEventId for merging
            const railwayEventMap = new Map<string, any[]>();
            railwayEvents.forEach((r: any) => {
                if (r.OperativeEventId) {
                    if (!railwayEventMap.has(r.OperativeEventId)) railwayEventMap.set(r.OperativeEventId, []);
                    railwayEventMap.get(r.OperativeEventId)?.push(r);
                }
            });

            // Set of processes RailwayEvent IDs to avoid duplicates if we show orphans later
            const processedRailwayEventIds = new Set<string>();

            const mappedOpEvents = opEvents.map((e: any) => {
                try {
                    const id = e.OperativeEventId;
                    const linkedRailwayEvents = railwayEventMap.get(id) || [];
                    linkedRailwayEvents.forEach(r => processedRailwayEventIds.add(r.EventId));

                    const affectedMap = new Map<string, any>();

                    const addSig = (sig: any) => { if (sig) affectedMap.set(sig, { designation: sig, color: '#f59e0b' }); };

                    // 1. Gather affected locations from OpEvent
                    if (e.EventSection) {
                        const sections = Array.isArray(e.EventSection) ? e.EventSection : [e.EventSection];
                        sections.forEach((s: any) => {
                            addSig(s.FromLocation?.Signature);
                            addSig(s.ToLocation?.Signature);
                            addSig(s.ViaLocation?.Signature);
                        });
                    }
                    if (e.TrafficImpact?.SelectedSection) {
                        const sections = Array.isArray(e.TrafficImpact.SelectedSection) ? e.TrafficImpact.SelectedSection : [e.TrafficImpact.SelectedSection];
                        sections.forEach((s: any) => {
                            addSig(s.FromLocation?.Signature);
                            addSig(s.ToLocation?.Signature);
                            addSig(s.ViaLocation?.Signature);
                        });
                    }

                    // 2. Gather info from Linked RailwayEvents (often better data)
                    let reasonCodesFromRailway: string[] = [];
                    linkedRailwayEvents.forEach(r => {
                        if (r.ReasonCode) {
                            const codes = Array.isArray(r.ReasonCode) ? r.ReasonCode : [r.ReasonCode];
                            codes.forEach((c: any) => {
                                // Prefer Code (e.g. OMÄ03)
                                if (c.Code) reasonCodesFromRailway.push(c.Code);
                                else if (typeof c === 'string') reasonCodesFromRailway.push(c);
                            });
                        }
                        // Also gather locations from RailwayEvent if OpEvent missed them
                        if (r.SelectedSection) {
                            const rSections = Array.isArray(r.SelectedSection) ? r.SelectedSection : [r.SelectedSection];
                            rSections.forEach((s: any) => {
                                addSig(s.FromLocation?.Signature || s.FromLocation);
                                addSig(s.ToLocation?.Signature || s.ToLocation);
                                addSig(s.ViaLocation?.Signature || s.ViaLocation);
                            });
                        }
                    });

                    // Title & Description
                    let title = "Trafikstörning";
                    let description = "";

                    // Try to get Header/Description from PublicMessage
                    if (e.TrafficImpact?.PublicMessage) {
                        const msg = Array.isArray(e.TrafficImpact.PublicMessage) ? e.TrafficImpact.PublicMessage[0] : e.TrafficImpact.PublicMessage;
                        title = msg.Header || title;
                        description = msg.Description || description;
                    }

                    // If title is generic, try using EventType description
                    if (title === "Trafikstörning" && e.EventType?.Description) {
                        title = e.EventType.Description;
                    }

                    // If we have linked railway events, maybe use their ReasonCode description as title if the current title is generic?
                    if (title === "Trafikstörning" && linkedRailwayEvents.length > 0) {
                        // Use first linked event's reason description
                        const firstRy = linkedRailwayEvents[0];
                        if (firstRy.ReasonCode) {
                            const codes = Array.isArray(firstRy.ReasonCode) ? firstRy.ReasonCode : [firstRy.ReasonCode];
                            if (codes[0]?.Description) title = codes[0].Description;
                        }
                    }

                    if (!title) title = "Trafikstörning";
                    if (!description) description = "Ingen detaljerad information tillgänglig.";

                    // Extract Location Description (Plats)
                    // Use names from affectedMap if available, otherwise just signatures
                    const affectedNames = Array.from(affectedMap.keys()).map(sig => {
                        return TrafikverketService.COMMON_STATIONS[sig] || TrafikverketService.stationCache.get(sig) || sig;
                    });
                    const locationDesc = affectedNames.length > 0 ? [...new Set(affectedNames)].join(', ') : (e.CountyNo ? `Län ${e.CountyNo}` : "Hela nätet/Okänd");

                    // Reason Code Text
                    // Prioritize RailwayEvent codes (OMÄ03 etc). Ignore OpEvent EventTypeCode (usually numeric like 16).
                    let reasonCodeText = "";
                    if (reasonCodesFromRailway.length > 0) {
                        reasonCodeText = [...new Set(reasonCodesFromRailway)].join(', ');
                    } else if (e.EventType?.EventTypeCode) {
                        // Only use if NOT numeric (just in case), or fallback
                        // User specifically asked to avoid "16".
                        if (isNaN(Number(e.EventType.EventTypeCode))) {
                            reasonCodeText = e.EventType.EventTypeCode;
                        }
                    }

                    return {
                        id: id,
                        situationNumber: id,
                        title: title,
                        description: description,
                        severity: 'normal',
                        startTime: e.StartDateTime,
                        endTime: e.EndDateTime || e.RailRoadTimeForServiceResumption,
                        updatedTime: e.ModifiedDateTime,
                        creationTime: e.StartDateTime,
                        type: 'TRAIN',
                        affected: Array.from(affectedMap.values()),
                        reasonCodeText: reasonCodeText,
                        locationDesc: locationDesc
                    };
                } catch (err) {
                    console.error("Error mapping TV OpEvent:", err);
                    return null;
                }
            }).filter(Boolean);

            // Process Orphan RailwayEvents (those NOT linked to an OpEvent we just processed)
            const mappedRailwayEvents = railwayEvents.filter((r: any) => !processedRailwayEventIds.has(r.EventId)).map((e: any) => {
                try {
                    const id = e.EventId;

                    let title = "Järnvägshändelse";
                    let reasonCodeText = "";

                    if (e.ReasonCode) {
                        if (Array.isArray(e.ReasonCode)) {
                            // Extract Codes
                            reasonCodeText = e.ReasonCode.map((rc: any) => rc.Code || rc).join(', ');
                            // Build Title from Codes map
                            title = e.ReasonCode.map((rc: any) => {
                                const code = rc.Code;
                                return TRV_REASON_CODES[code] || (rc.Description || code);
                            }).join(', ');
                        } else if (typeof e.ReasonCode === 'object') {
                            reasonCodeText = e.ReasonCode.Code || "";
                            const code = e.ReasonCode.Code;
                            title = TRV_REASON_CODES[code] || (e.ReasonCode.Description || code || "Järnvägshändelse");
                        } else {
                            reasonCodeText = String(e.ReasonCode);
                            const codeStr = String(e.ReasonCode);
                            title = TRV_REASON_CODES[codeStr] || codeStr;
                        }
                    }

                    let description = "";
                    const affectedMap = new Map<string, any>();
                    const addSig = (sig: any) => { if (sig) affectedMap.set(sig, { designation: sig, color: '#f59e0b' }); };

                    if (e.SelectedSection && Array.isArray(e.SelectedSection)) {
                        const sections = e.SelectedSection.map((s: any) => {
                            const from = s.FromLocation?.LocationName || s.FromLocation?.Signature || s.FromLocation;
                            const to = s.ToLocation?.LocationName || s.ToLocation?.Signature || s.ToLocation;
                            const fromName = (typeof from === 'string' && TrafikverketService.stationCache.get(from)) || from;
                            const toName = (typeof to === 'string' && TrafikverketService.stationCache.get(to)) || to;
                            if (fromName && toName) return `${fromName} – ${toName}`;
                            return null;
                        }).filter(Boolean);

                        if (sections.length > 0) description = sections.join(', ');

                        e.SelectedSection.forEach((s: any) => {
                            addSig(s.FromLocation?.Signature || s.FromLocation);
                            addSig(s.ToLocation?.Signature || s.ToLocation);
                        });
                    }

                    if (!description) description = e.EventStatus || "Ingen information";

                    // Location Desc
                    const affectedNames = Array.from(affectedMap.keys()).map(sig => {
                        return TrafikverketService.COMMON_STATIONS[sig] || TrafikverketService.stationCache.get(sig) || sig;
                    });
                    const locationDesc = affectedNames.length > 0 ? [...new Set(affectedNames)].join(', ') : "Järnvägsnätet";

                    return {
                        id: id,
                        situationNumber: id,
                        title: title,
                        description: description,
                        severity: e.EventStatus === 'OperativeHändelse' ? 'normal' : 'slight',
                        startTime: e.StartDateTime,
                        endTime: e.EndDateTime,
                        updatedTime: e.ModifiedTime || e.ModifiedDateTime,
                        creationTime: e.StartDateTime,
                        type: 'TRAIN',
                        affected: Array.from(affectedMap.values()),
                        reasonCodeText: reasonCodeText,
                        locationDesc: locationDesc
                    };
                } catch (err) { return null; }
            }).filter(Boolean);

            const allEvents = [...mappedOpEvents, ...mappedRailwayEvents];

            // Deduplicate based on ID (though logic above should prevent dupes between Op and Ry)
            // Allow duplicates as requested by user ("Visa dubletter")
            // const uniqueEvents = allEvents.filter ... (removed)

            return allEvents.sort((a, b) => {
                if (!a || !b) return 0;
                const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
                const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
                return tB - tA;
            });

        } catch (e) {
            console.error("TV Disruptions error", e);
            return [];
        }
    },

    getTrainMessages: async (): Promise<any[]> => {
        try {
            const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainMessage" namespace="rail.infrastructure" schemaversion="1.7" limit="50">
        <FILTER>
            <GT name="StartDateTime" value="${new Date(Date.now() - 24 * 3600 * 1000).toISOString()}" />
        </FILTER>
        <INCLUDE>EventId</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>EndDateTime</INCLUDE>
        <INCLUDE>ExternalDescription</INCLUDE>
        <INCLUDE>Header</INCLUDE>
        <INCLUDE>ReasonCode</INCLUDE>
        <INCLUDE>TrafficImpact</INCLUDE>
        <INCLUDE>AffectedLocation</INCLUDE>
        <INCLUDE>CountyNo</INCLUDE>
    </QUERY>
</REQUEST>`;

            const proxyUrl = getProxyUrl();
            const response = await fetch(proxyUrl, {
                method: 'POST',
                body: xml,
                headers: { 'Content-Type': 'text/xml' }
            });

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const data = await response.json();
            const messages = data?.RESPONSE?.RESULT?.[0]?.TrainMessage || [];

            return messages.map((m: any) => {
                let affected: any[] = [];
                if (m.AffectedLocation) {
                    const locs = Array.isArray(m.AffectedLocation) ? m.AffectedLocation : [m.AffectedLocation];
                    affected = locs.map((l: any) => {
                        const sig = l;
                        return { designation: sig, color: '#f59e0b' };
                    });
                }

                return {
                    id: m.EventId,
                    title: m.Header || "Trafikmeddelande",
                    description: m.ExternalDescription || "Ingen beskrivning",
                    startTime: m.StartDateTime,
                    endTime: m.EndDateTime,
                    type: 'TRAIN',
                    provider: Provider.TRAFIKVERKET,
                    affected: affected,
                    severity: 'slight', // TrainMessages are often info/minor
                    reasonCodeText: m.ReasonCode ? (Array.isArray(m.ReasonCode) ? m.ReasonCode.map((rc: any) => rc.Code).join(', ') : m.ReasonCode.Code) : ''
                };
            });

        } catch (e) {
            console.error("TV Messages error", e);
            return [];
        }
    },

    getJourneyDetails: async (journeyRef: string): Promise<any[]> => {
        // Ref expected format: "tv-{TrainIdent}-{DateOrTime}" or just "{TrainIdent}"
        // We need TrainIdent and Date.
        // If Ref comes from our getDepartures, it's "tv-123-2023-01-01T12:00:00".
        // Let's parse it.

        // Ensure cache is loaded for coords
        await TrafikverketService.ensureStationCache();

        let trainIdent = journeyRef;
        let date = new Date().toISOString().split('T')[0];

        if (journeyRef.startsWith('tv-')) {
            const parts = journeyRef.split('-');
            // tv-123-2023-01-01T12:00:00...
            // parts[0] = tv
            // parts[1] = 123
            // parts[2]... could be date parts if ISO string was split?
            // "tv-123-2023-01-01T12:00" -> 123 is index 1.
            trainIdent = parts[1];
            if (!trainIdent) return [];

            // Extract date from the rest if available, otherwise today
            const potentialDate = parts.slice(2).join('-');
            if (potentialDate && !isNaN(new Date(potentialDate).getTime())) {
                date = potentialDate.split('T')[0];
            }
        }

        // Expand window to catch journeys spanning midnight (Yesterday, Today, Tomorrow)
        const d = new Date(date);
        d.setDate(d.getDate() - 1); // Yesterday
        const fromDate = d.toISOString().split('T')[0];

        d.setDate(d.getDate() + 2); // Tomorrow (Yesterday + 2)
        const toDate = d.toISOString().split('T')[0];

        // Fetch all announcements for this train on this date window
        // Ensure valid date objects
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        // Fetch all announcements for this train on this date window
        // Sorted by time to get the route order
        // Fetch all announcements for this train on this date window
        // Sorted by time to get the route order
        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">
        <FILTER>
            <EQ name="AdvertisedTrainIdent" value="${trainIdent}" />
            <GT name="AdvertisedTimeAtLocation" value="${start.toISOString()}" />
            <LT name="AdvertisedTimeAtLocation" value="${end.toISOString()}" /> 
        </FILTER>
        <INCLUDE>LocationSignature</INCLUDE>
        <INCLUDE>AdvertisedLocationName</INCLUDE>
        <INCLUDE>AdvertisedTimeAtLocation</INCLUDE>
        <INCLUDE>EstimatedTimeAtLocation</INCLUDE>
        <INCLUDE>TimeAtLocation</INCLUDE>
        <INCLUDE>TrackAtLocation</INCLUDE>
        <INCLUDE>ActivityType</INCLUDE>
        <INCLUDE>Canceled</INCLUDE>
        <INCLUDE>Deviation</INCLUDE>
        <INCLUDE>OperationalTransportIdentifiers</INCLUDE>
    </QUERY>
</REQUEST>`;

        try {
            const proxyUrl = getProxyUrl();
            const res = await fetch(proxyUrl, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
            if (!res.ok) return [];
            const data = await res.json();
            const stops = data?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || [];

            const stationMap = new Map<string, any>();

            stops.forEach((s: any) => {
                const sig = s.LocationSignature;
                if (!stationMap.has(sig)) {
                    stationMap.set(sig, {
                        name: s.AdvertisedLocationName || TrafikverketService.stationCache.get(sig) || sig,
                        sig: sig,
                        arr: null,
                        dep: null,
                        track: s.TrackAtLocation,
                        cancelled: s.Canceled,
                        deviations: s.Deviation,
                        operationalTransportIdentifiers: s.OperationalTransportIdentifiers
                    });
                }
                const entry = stationMap.get(sig);
                if (s.ActivityType === 'Ankomst') entry.arr = s;
                if (s.ActivityType === 'Avgång') {
                    entry.dep = s;
                    // Prefer departure info for Technical IDs if available
                    if (s.OperationalTransportIdentifiers) {
                        entry.operationalTransportIdentifiers = s.OperationalTransportIdentifiers;
                    }
                }

                // Update track if one event has it and other doesn't? Usually same.
                if (s.TrackAtLocation) entry.track = s.TrackAtLocation;
            });

            // Convert back to array (sorted by time of first event found for that station in the list?)
            // The `stops` array is sorted by time. We can just iterate `stops` and pick unique stations in order.

            const result: any[] = [];
            const processedSigs = new Set<string>();

            stops.forEach((s: any) => {
                const sig = s.LocationSignature;
                if (processedSigs.has(sig)) return;
                processedSigs.add(sig);

                const entry = stationMap.get(sig);

                const arr = entry.arr;
                const dep = entry.dep;

                const arrivalTime = arr?.AdvertisedTimeAtLocation;
                const realtimeArrival = arr?.EstimatedTimeAtLocation;
                const departureTime = dep?.AdvertisedTimeAtLocation;
                const realtimeDeparture = dep?.EstimatedTimeAtLocation;

                // Fallback time for 'time' field (Departure preferred)
                const mainTime = departureTime || arrivalTime;

                // Track can differ
                const track = dep?.TrackAtLocation || arr?.TrackAtLocation || entry.track || '';

                const isCancelled = entry.cancelled;
                const coords = TrafikverketService.stationCoordsMap.get(sig);

                result.push({
                    name: entry.name,
                    time: mainTime ? new Date(mainTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '',
                    track: track,
                    date: mainTime,
                    isCancelled: isCancelled,
                    isDeparture: true,
                    notes: entry.deviations,
                    coords: coords,
                    // Standard Fields for JourneyTimeline
                    arrivalTime: arrivalTime,
                    realtimeArrival: realtimeArrival,
                    departureTime: departureTime,
                    realtimeDeparture: realtimeDeparture,
                    operationalTransportIdentifiers: entry.operationalTransportIdentifiers
                });
            });

            return result;

        } catch (e) {
            console.error("TV Journey Details Error", e);
            return [];
        }

    },

    ensureStationCache: async () => {
        if (TrafikverketService.stationCache.size > 0 && TrafikverketService.stationCoordsMap.size > 0) return;

        // Fetch all stations (Geometry not needed here, lightweight)
        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainStation" namespace="rail.infrastructure" schemaversion="1.5">
        <INCLUDE>LocationSignature</INCLUDE>
        <INCLUDE>AdvertisedLocationName</INCLUDE>
        <INCLUDE>AdvertisedShortLocationName</INCLUDE>
        <INCLUDE>Geometry.WGS84</INCLUDE>
    </QUERY>
</REQUEST>`;
        try {
            // We can check if we have it in localStorage?
            const cached = localStorage.getItem('tv_station_cache_v3');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < 86400000) { // 24h cache
                    parsed.data.forEach((s: any) => {
                        const sig = s.sig.toUpperCase();
                        TrafikverketService.stationCache.set(sig, s.name);
                        TrafikverketService.stationNameMap.set(s.name, sig);
                        if (s.lat && s.lng) {
                            TrafikverketService.stationCoordsMap.set(sig, { lat: s.lat, lng: s.lng });
                        }
                    });
                    return;
                }
            }

            const proxyUrl = getProxyUrl();
            const res = await fetch(proxyUrl, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml' } });
            if (!res.ok) return;
            const data = await res.json();
            const stations = data?.RESPONSE?.RESULT?.[0]?.TrainStation || [];

            const cacheData: any[] = [];
            stations.forEach((s: any) => {
                const sig = s.LocationSignature.toUpperCase();
                TrafikverketService.stationCache.set(sig, s.AdvertisedLocationName);
                TrafikverketService.stationNameMap.set(s.AdvertisedLocationName, sig);

                let lat = 0, lng = 0;
                if (s.Geometry?.WGS84) {
                    const match = s.Geometry.WGS84.match(/POINT \(([\d\.]+) ([\d\.]+)\)/);
                    if (match) {
                        lng = parseFloat(match[1]);
                        lat = parseFloat(match[2]);
                    }
                }

                if (lat && lng) {
                    TrafikverketService.stationCoordsMap.set(sig, { lat, lng });
                    cacheData.push({ sig: sig, name: s.AdvertisedLocationName, lat, lng });
                } else {
                    cacheData.push({ sig: sig, name: s.AdvertisedLocationName });
                }
            });

            localStorage.setItem('tv_station_cache_v3', JSON.stringify({ timestamp: Date.now(), data: cacheData }));
        } catch (e) { console.error("Cache init error", e); }
    },

    searchStations: async (query: string): Promise<any[]> => {
        // Ensure cache is loaded
        await TrafikverketService.ensureStationCache();

        if (!query || query.length < 2) return [];
        const lowerQ = query.toLowerCase();

        const results: any[] = [];
        let count = 0;

        // Iterate over cached names
        // Note: Map iteration order is insertion order.
        for (const [name, sig] of TrafikverketService.stationNameMap.entries()) {
            if (name.toLowerCase().includes(lowerQ)) {

                // Prioritize exact start matches
                const isStartMatch = name.toLowerCase().startsWith(lowerQ);

                const coords = TrafikverketService.stationCoordsMap.get(sig);
                const station = {
                    id: `tv-${sig}`,
                    name: name,
                    provider: Provider.TRAFIKVERKET,
                    coords: coords || { lat: 0, lng: 0 },
                    isStartMatch // Helper for sorting
                };

                results.push(station);

                // Soft limit for performance, but we sort later so maybe collect more?
                // Let's collect up to 50
                count++;
                if (count >= 50) break;
            }
        }

        // Sort: StartsWith query first, then alphabetical
        return results.sort((a, b) => {
            if (a.isStartMatch && !b.isStartMatch) return -1;
            if (!a.isStartMatch && b.isStartMatch) return 1;
            return a.name.localeCompare(b.name);
        }).slice(0, 20); // Return top 20
    },

    getStationMessages: async (stationIdentifier: string): Promise<any[]> => {
        try {
            // Resolve signature
            await TrafikverketService.ensureStationCache();
            let locationSign = '';
            const upperId = stationIdentifier.toUpperCase();
            if (TrafikverketService.stationCache.has(upperId)) locationSign = upperId;
            else if (TrafikverketService.stationNameMap.has(stationIdentifier)) locationSign = TrafikverketService.stationNameMap.get(stationIdentifier) || '';
            else {
                // Fuzzy fallback
                const lowerId = stationIdentifier.toLowerCase();
                for (const [name, sig] of TrafikverketService.stationNameMap.entries()) {
                    if (name.toLowerCase() === lowerId) { locationSign = sig; break; }
                }
            }

            if (!locationSign) return [];

            // XML for TrainMessage
            const messageXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainMessage" schemaversion="1.5">
        <FILTER>
            <EQ name="AffectedLocation" value="${locationSign}" />
            <GT name="StartDateTime" value="${new Date(Date.now() - 172800000).toISOString()}" />
            <GT name="PrognosticatedEndDateTime" value="${new Date().toISOString()}" />
        </FILTER>
        <INCLUDE>EventId</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>PrognosticatedEndDateTime</INCLUDE>
        <INCLUDE>ExternalDescription</INCLUDE>
        <INCLUDE>ReasonCode</INCLUDE>
    </QUERY>
</REQUEST>`;

            // XML for RailwayEvent (Trafikläget) - namespace ols.open
            const railwayXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="RailwayEvent" namespace="ols.open" schemaversion="1.0" limit="20">
        <FILTER>
            <OR>
                 <EQ name="SelectedSection.FromLocation.Signature" value="${locationSign}" />
                 <EQ name="SelectedSection.ToLocation.Signature" value="${locationSign}" />
                 <EQ name="SelectedSection.ViaLocation.Signature" value="${locationSign}" />
            </OR>
            <GT name="StartDateTime" value="${new Date(Date.now() - 172800000).toISOString()}" />
        </FILTER>
        <INCLUDE>EventId</INCLUDE>
        <INCLUDE>EventStatus</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>EndDateTime</INCLUDE>
        <INCLUDE>ReasonCode</INCLUDE>
        <INCLUDE>SelectedSection</INCLUDE>
    </QUERY>
</REQUEST>`;

            try {
                const proxyUrl = getProxyUrl();

                const [resMsg, resRy] = await Promise.all([
                    fetch(proxyUrl, { method: 'POST', body: messageXml, headers: { 'Content-Type': 'text/xml' } }),
                    fetch(proxyUrl, { method: 'POST', body: railwayXml, headers: { 'Content-Type': 'text/xml' } })
                ]);

                let messages: any[] = [];
                let railwayEvents: any[] = [];

                if (resMsg.ok) {
                    const data = await resMsg.json();
                    messages = data?.RESPONSE?.RESULT?.[0]?.TrainMessage || [];
                }

                if (resRy.ok) {
                    const data = await resRy.json();
                    railwayEvents = data?.RESPONSE?.RESULT?.[0]?.RailwayEvent || [];
                }

                const mapMsg = messages.map((m: any) => ({
                    id: m.EventId,
                    title: (Array.isArray(m.ReasonCode) ? m.ReasonCode[0]?.Description : m.ReasonCode?.Description) || "Trafikmeddelande",
                    description: m.ExternalDescription,
                    severity: 'normal',
                    startTime: m.StartDateTime,
                    endTime: m.PrognosticatedEndDateTime
                }));

                const mapRy = railwayEvents.map((e: any) => {
                    let title = "Trafikstörning";
                    if (e.ReasonCode) {
                        if (Array.isArray(e.ReasonCode)) title = e.ReasonCode.map((c: any) => c.Description || c.Code).join(', ');
                        else title = e.ReasonCode.Description || e.ReasonCode.Code || String(e.ReasonCode);
                    }

                    // Build description from sections
                    let desc = "";
                    if (e.SelectedSection && Array.isArray(e.SelectedSection)) {
                        const sections = e.SelectedSection.map((s: any) => {
                            const f = s.FromLocation?.LocationName || s.FromLocation?.Signature || s.FromLocation;
                            const t = s.ToLocation?.LocationName || s.ToLocation?.Signature || s.ToLocation;

                            // Try mapping names
                            const fName = (typeof f === 'string' && TrafikverketService.stationCache.get(f)) || f;
                            const tName = (typeof t === 'string' && TrafikverketService.stationCache.get(t)) || t;

                            if (fName && tName) return `${fName} – ${tName}`;
                            return null;
                        }).filter(Boolean);
                        desc = sections.join(', ');
                    }
                    if (!desc && e.EventStatus) desc = `Status: ${e.EventStatus}`;

                    return {
                        id: e.EventId,
                        title: title,
                        description: desc,
                        severity: e.EventStatus === 'OperativeHändelse' ? 'normal' : 'slight',
                        startTime: e.StartDateTime,
                        endTime: e.EndDateTime
                    };
                });

                return [...mapMsg, ...mapRy];

            } catch (e) {
                console.error("TV Station Messages Error", e);
                return [];
            }
        } catch (e) {
            console.error("Failed to resolve station messages (outer catch)", e); // Added for clarity if outer catch is hit
            return [];
        }
    }
};


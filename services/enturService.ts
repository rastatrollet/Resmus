// Entur GraphQL service

export const EnturService = {
  /**
   * Fetch live vehicle positions from Entur GraphQL API
   */
  getLiveVehicles: async (bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<any[]> => {
    const query = `{
          vehicles {
            lastUpdated
            vehicleId
            mode
            speed
            bearing
            location {
              latitude
              longitude
            }
            line {
              publicCode
              lineName
            }
            destinationName
          }
        }`;

    try {
      const res = await fetch('https://api.entur.io/realtime/v2/vehicles/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ET-Client-Name': 'resmus-map'
        },
        body: JSON.stringify({ query })
      });

      if (!res.ok) throw new Error('Entur API error');
      const data = await res.json();

      const rawVehicles = data?.data?.vehicles || [];
      const nowMs = Date.now();

      let filtered = rawVehicles.filter((v: any) => {
        // Filter out stale vehicles (older than 5 minutes)
        if (v.lastUpdated) {
          const ageMs = nowMs - new Date(v.lastUpdated).getTime();
          if (ageMs > 5 * 60 * 1000) return false;
        }
        return true;
      });

      if (bounds) {
        // Approximate bounding box filter to avoid processing all of Norway
        filtered = filtered.filter((v: any) => {
          const lat = v.location?.latitude;
          const lng = v.location?.longitude;
          if (!lat || !lng) return false;

          // Simple BBox check with margin
          const m = 0.5;
          return lat >= bounds.minLat - m && lat <= bounds.maxLat + m &&
            lng >= bounds.minLng - m && lng <= bounds.maxLng + m;
        });
      }

      // Deduplicate by vehicle ID to prevent "dubletter" + discard items with no vehicle ID
      const uniqueVehicles = new Map();
      filtered.forEach((v: any) => {
        if (v.vehicleId) {
          uniqueVehicles.set(v.vehicleId, v);
        }
      });
      filtered = Array.from(uniqueVehicles.values());

      return filtered.map((v: any) => {
        const lat = v.location?.latitude;
        const lng = v.location?.longitude;
        if (!lat || !lng) return null;

        // Entur mode Mapping
        let modeNum = 3; // BUS default
        let modeStr = 'BUS';
        const rawMode = String(v.mode || '').toUpperCase();
        if (rawMode === 'RAIL') { modeNum = 2; modeStr = 'TRAIN'; }
        if (rawMode === 'TRAM') { modeNum = 0; modeStr = 'TRAM'; }
        if (rawMode === 'METRO') { modeNum = 1; modeStr = 'METRO'; }
        if (rawMode === 'FERRY' || rawMode === 'WATER') { modeNum = 4; modeStr = 'FERRY'; }

        const lineCode = v.line?.publicCode || v.line?.lineName || '?';
        const dest = v.destinationName || '';

        // Final fallback via line name just in case mode is missing
        if (!v.mode || modeStr === 'BUS') {
          const rawName = String(v.line?.lineName || '').toLowerCase();
          const pCode = String(v.line?.publicCode || '').toUpperCase();

          if (rawName.includes('tog') || pCode.startsWith('RE') || pCode.startsWith('F') || pCode.startsWith('R')) {
            // Additional check because some F/R lines are buses. We check for F/R followed by digits
            if (pCode.startsWith('RE') || /^F\d/.test(pCode) || /^R\d/.test(pCode) || rawName.includes('tog')) {
              modeNum = 2;
              modeStr = 'TRAIN';
            }
          }
          if (rawName.includes('båt') || rawName.includes('ferje')) { modeNum = 4; modeStr = 'FERRY'; }
          if (rawName.includes('trikk')) { modeNum = 0; modeStr = 'TRAM'; }
          if (rawName.includes('t-bane')) { modeNum = 1; modeStr = 'METRO'; }
        }

        // Speed is often given in m/s, convert to km/h roughly
        let speed = Number(v.speed) || 0;
        if (speed > 0 && speed < 50) speed = Math.round(speed * 3.6); // assume m/s if < 50 and convert to km/h

        return {
          id: `ent-${v.vehicleId || Math.random()}`,
          lat,
          lng,
          bearing: Number(v.bearing) || 0,
          speed: speed,
          line: lineCode,
          dest,
          transportMode: modeStr,
          routeType: modeNum,
          timestamp: v.lastUpdated ? new Date(v.lastUpdated).getTime() / 1000 : nowMs / 1000,
          operator: 'entur',
          vehicleLabel: v.vehicleId
        };
      }).filter(Boolean);

    } catch (e) {
      console.error("Entur Fetch Error", e);
      return [];
    }
  }
};

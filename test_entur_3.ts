import { EnturService } from './services/enturService.ts';

(async () => {
    const d = await EnturService.getLiveVehicles({ minLat: 59.0, maxLat: 61.0, minLng: 10.0, maxLng: 12.0 });
    console.log("length:", d.length);
})();

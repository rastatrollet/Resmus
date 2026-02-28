/**
 * GtfsShapeService (v2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Now delegates entirely to NeTExShapeService.
 * The public API is identical so all callers (LiveMap.tsx etc.) continue
 * to use `GtfsShapeService` without changes.
 *
 * Data source: Trafiklab NeTEx Regional Static
 *   key: ca21d237580b40cb8302c02de9735b84
 */

export type {
    RouteInfo,
    ShapePolyline,
    JourneyStop,
    VehicleRoutePayload,
} from './netexShapeService';

export { NeTExShapeService as GtfsShapeService } from './netexShapeService';

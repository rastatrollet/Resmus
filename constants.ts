import { Provider } from './types';

export const APP_NAME = "Resmus 2026";

export const PROVIDER_LABELS: Record<Provider, string> = {
  [Provider.VASTTRAFIK]: 'Västtrafik',
  [Provider.SL]: 'SL',
  [Provider.RESROBOT]: 'Resrobot',
  [Provider.TRAFIKVERKET]: 'Trafikverket',
};
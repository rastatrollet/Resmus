import React, { createContext, useContext, useState, useEffect } from 'react';

// Simple AI translation function (you can replace with actual AI service)
const translateWithAI = async (text: string, targetLang: string): Promise<string> => {
  // For demo purposes, return the text with a note
  // In production, integrate with OpenAI, Google Translate API, etc.
  if (targetLang === 'en') {
    // Simple English translations for common Swedish terms
    const translations: { [key: string]: string } = {
      'Avgångar': 'Departures',
      'Ankomster': 'Arrivals',
      'Sök hållplats': 'Search station',
      'Trafikstörningar': 'Traffic disruptions',
      'Inga avgångar hittades': 'No departures found',
      'Allt flyter på': 'Everything is running smoothly',
      'Inga trafikstörningar just nu': 'No traffic disruptions at the moment',
      'VÄSTTÅGEN': 'VÄSTTÅGEN',
      'TÅG': 'TRAIN',
      'störningar': 'disruptions',
      'aktiva': 'active',
      'kritiska': 'critical',
      'normala': 'normal',
      'lägre': 'minor',
      'pågående': 'ongoing',
      'planerade': 'planned',
      'Händelser skapade idag': 'Events created today',
      'gamla händelser': 'old events',
      'nya händelser': 'new events'
    };

    // Simple word-by-word translation
    return text.split(' ').map(word => translations[word] || word).join(' ');
  }

  return text; // Return original text for other languages
};

// Translation data
const translations = {
  sv: {
    // Navigation
    departures: 'Avgångar',
    favorites: 'Favoriter',
    search_trip: 'Sök Resa',
    disruptions: 'Störningar',
    settings: 'Inställningar',
    more: 'Mer',
    info: 'Info',

    // Common phrases
    search_station: 'Sök hållplats...',
    show_departures_nearby: 'Visa hållplatser nära mig',
    location_not_found: 'Kunde inte hämta position.',
    all_flows_well: 'Allt flyter på',
    no_disruptions: 'Inga trafikstörningar just nu',
    active_disruptions: 'aktiva störningar',
    valid: 'Giltigt',
    updated: 'Uppdaterad',
    just_now: 'Just nu',
    minutes_ago: 'min sedan',
    hours_ago: 'h sedan',
    days_ago: 'dagar sedan',
    cancelled: 'Inställd',
    from: 'Från',
    to: 'Till',

    // Disruption types
    transport: 'Kollektivtrafik',
    impact: 'Påverkan',
    serious_impact: 'Allvarlig påverkan',
    normal_impact: 'Normal påverkan',
    minor_impact: 'Mindre påverkan',
    cause: 'Orsaken',
    vehicle_failure: 'Fordonsfel',
    alternative_routes: 'Alternativa resvägar',
    info_available_shortly: 'Information kommer inom kort.',

    // Train types
    vasttagen: 'Västtågen',
    tram: 'Spårvagn',
    ferry: 'Färja/Båt',
    bus: 'Buss',

    // Routes
    gothenburg_center: 'Göteborg centrum',
    gothenburg_molndal: 'Göteborg - Mölndal',
    gothenburg_partille: 'Göteborg - Partille',
    gothenburg_kungsbacka: 'Göteborg - Kungsbacka',
    gothenburg_alingsas: 'Göteborg - Alingsås',
    gothenburg_boras: 'Göteborg - Borås',
    gothenburg_trollhattan: 'Göteborg - Trollhättan',
    gothenburg_uddevalla: 'Göteborg - Uddevalla',
    gothenburg_stromstad: 'Göteborg - Strömstad',
    regional_traffic: 'Regionaltrafik',
    express_line: 'Expresslinje',
    airport_transfer: 'Flygtransfer',
    gothenburg_stockholm: 'Göteborg - Stockholm',
    gothenburg_styro: 'Göteborg - Styrsö',

    // Actions
    exit_fullscreen: 'Avsluta helskärm',
    fullscreen_mode: 'Helskärmsläge',
    notifications_on: 'Notiser på',
    enable_notifications: 'Aktivera notiser',
    notifications_enabled: 'Notiser aktiverade',
    you_will_receive_notifications: 'Du kommer nu få meddelanden om nya trafikstörningar.',
    no_favorites_yet: 'Du har inga favoriter än.',
    search_and_star: 'Sök på en hållplats och klicka på stjärnan.',
    click_for_departures: 'Klicka för att se avgångar',
    line_withdrawn: 'Linje {{line}} indragen',
    disruptions_at_station: '{{count}} störning{{plural}} på hållplatsen',
    local_buses: 'Lokala bussar',
    regional_buses: 'Regionala bussar',
    express_buses: 'Expressbussar',
    airport_buses: 'Flygbussar'
  },
  en: {
    // Navigation
    departures: 'Departures',
    favorites: 'Favorites',
    search_trip: 'Search Trip',
    disruptions: 'Disruptions',
    settings: 'Settings',
    more: 'More',
    info: 'Info',

    // Common phrases
    search_station: 'Search station...',
    show_departures_nearby: 'Show stations near me',
    location_not_found: 'Could not get location.',
    all_flows_well: 'Everything is running smoothly',
    no_disruptions: 'No traffic disruptions at the moment',
    active_disruptions: 'active disruptions',
    valid: 'Valid',
    updated: 'Updated',
    just_now: 'Just now',
    minutes_ago: 'min ago',
    hours_ago: 'h ago',
    days_ago: 'days ago',
    cancelled: 'Cancelled',
    from: 'From',
    to: 'To',

    // Disruption types
    transport: 'Public transport',
    impact: 'Impact',
    serious_impact: 'Serious impact',
    normal_impact: 'Normal impact',
    minor_impact: 'Minor impact',
    cause: 'Cause',
    vehicle_failure: 'Vehicle failure',
    alternative_routes: 'Alternative routes',
    info_available_shortly: 'Information will be available shortly.',

    // Train types
    vasttagen: 'Västtågen',
    tram: 'Tram',
    ferry: 'Ferry/Boat',
    bus: 'Bus',

    // Routes
    gothenburg_center: 'Gothenburg center',
    gothenburg_molndal: 'Gothenburg - Mölndal',
    gothenburg_partille: 'Gothenburg - Partille',
    gothenburg_kungsbacka: 'Gothenburg - Kungsbacka',
    gothenburg_alingsas: 'Gothenburg - Alingsås',
    gothenburg_boras: 'Gothenburg - Borås',
    gothenburg_trollhattan: 'Gothenburg - Trollhättan',
    gothenburg_uddevalla: 'Gothenburg - Uddevalla',
    gothenburg_stromstad: 'Gothenburg - Strömstad',
    regional_traffic: 'Regional traffic',
    express_line: 'Express line',
    airport_transfer: 'Airport transfer',
    gothenburg_stockholm: 'Gothenburg - Stockholm',
    gothenburg_styro: 'Gothenburg - Styrsö',

    // Actions
    exit_fullscreen: 'Exit fullscreen',
    fullscreen_mode: 'Fullscreen mode',
    notifications_on: 'Notifications on',
    enable_notifications: 'Enable notifications',
    notifications_enabled: 'Notifications enabled',
    you_will_receive_notifications: 'You will now receive notifications about new traffic disruptions.',
    no_favorites_yet: 'No favorites yet.',
    search_and_star: 'Search for a station and click the star.',
    click_for_departures: 'Click to see departures',
    line_withdrawn: 'Line {{line}} withdrawn',
    disruptions_at_station: '{{count}} disruption{{plural}} at the station',
    local_buses: 'Local buses',
    regional_buses: 'Regional buses',
    express_buses: 'Express buses',
    airport_buses: 'Airport buses'
  },
  es: {
    // Navigation
    departures: 'Salidas',
    favorites: 'Favoritos',
    search_trip: 'Buscar viaje',
    disruptions: 'Interrupciones',
    settings: 'Configuración',
    more: 'Más',
    info: 'Info',

    // Common phrases
    search_station: 'Buscar estación...',
    show_departures_nearby: 'Mostrar estaciones cerca de mí',
    location_not_found: 'No se pudo obtener la ubicación.',
    all_flows_well: 'Todo fluye bien',
    no_disruptions: 'No hay interrupciones de tráfico en este momento',
    active_disruptions: 'interrupciones activas',
    valid: 'Válido',
    updated: 'Actualizado',
    just_now: 'Ahora mismo',
    minutes_ago: 'min atrás',
    hours_ago: 'h atrás',
    days_ago: 'días atrás',
    cancelled: 'Cancelado',
    from: 'Desde',
    to: 'Hasta',

    // Disruption types
    transport: 'Transporte público',
    impact: 'Impacto',
    serious_impact: 'Impacto grave',
    normal_impact: 'Impacto normal',
    minor_impact: 'Impacto menor',
    cause: 'Causa',
    vehicle_failure: 'Falla del vehículo',
    alternative_routes: 'Rutas alternativas',
    info_available_shortly: 'La información estará disponible pronto.',

    // Train types
    vasttagen: 'Västtågen',
    tram: 'Tranvía',
    ferry: 'Ferry/Barco',
    bus: 'Autobús',

    // Routes
    gothenburg_center: 'Centro de Gotemburgo',
    gothenburg_molndal: 'Gotemburgo - Mölndal',
    gothenburg_partille: 'Gotemburgo - Partille',
    gothenburg_kungsbacka: 'Gotemburgo - Kungsbacka',
    gothenburg_alingsas: 'Gotemburgo - Alingsås',
    gothenburg_boras: 'Gotemburgo - Borås',
    gothenburg_trollhattan: 'Gotemburgo - Trollhättan',
    gothenburg_uddevalla: 'Gotemburgo - Uddevalla',
    gothenburg_stromstad: 'Gotemburgo - Strömstad',
    regional_traffic: 'Tráfico regional',
    express_line: 'Línea exprés',
    airport_transfer: 'Traslado al aeropuerto',
    gothenburg_stockholm: 'Gotemburgo - Estocolmo',
    gothenburg_styro: 'Gotemburgo - Styrsö',

    // Actions
    exit_fullscreen: 'Salir de pantalla completa',
    fullscreen_mode: 'Modo pantalla completa',
    notifications_on: 'Notificaciones activas',
    enable_notifications: 'Activar notificaciones',
    notifications_enabled: 'Notificaciones activadas',
    you_will_receive_notifications: 'Ahora recibirás notificaciones sobre nuevas interrupciones de tráfico.',
    no_favorites_yet: 'Aún no hay favoritos.',
    search_and_star: 'Busca una estación y haz clic en la estrella.',
    click_for_departures: 'Haz clic para ver salidas',
    line_withdrawn: 'Línea {{line}} retirada',
    disruptions_at_station: '{{count}} interrupción{{plural}} en la estación',
    local_buses: 'Autobuses locales',
    regional_buses: 'Autobuses regionales',
    express_buses: 'Autobuses exprés',
    airport_buses: 'Autobuses al aeropuerto'
  }
};

type Language = 'sv' | 'en' | 'es';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, any>) => string;
  availableLanguages: { code: Language; name: string; flag: string }[];
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  // Detect browser language
  const detectLanguage = (): Language => {
    const browserLang = navigator.language.split('-')[0];
    const savedLang = localStorage.getItem('resmus_language') as Language;

    if (savedLang && translations[savedLang]) {
      return savedLang;
    }

    if (browserLang === 'sv' || browserLang === 'en' || browserLang === 'es') {
      return browserLang as Language;
    }

    return 'sv'; // Default to Swedish
  };

  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('resmus_language', lang);
  };

  const t = (key: string, variables?: Record<string, any>): string => {
    const langTranslations = translations[language] || translations.sv;
    let translation = (langTranslations as any)[key] || key;

    // Handle pluralization
    if (variables?.plural !== undefined) {
      if (variables.count !== 1) {
        translation = translation.replace('{{plural}}', 'ar'); // Swedish plural
      } else {
        translation = translation.replace('{{plural}}', ''); // Remove plural marker
      }
    }

    // Replace variables
    if (variables) {
      Object.keys(variables).forEach(varKey => {
        translation = translation.replace(new RegExp(`{{${varKey}}}`, 'g'), variables[varKey]);
      });
    }

    return translation;
  };

  const availableLanguages = [
    { code: 'sv' as Language, name: 'Svenska', flag: '🇸🇪' },
    { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
    { code: 'es' as Language, name: 'Español', flag: '🇪🇸' }
  ];

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </TranslationContext.Provider>
  );
};
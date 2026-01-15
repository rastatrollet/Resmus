import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Trash2, MapPin } from 'lucide-react';
import { Station } from '../types';
import { TransitService } from '../services/transitService';

export const FavoritesView: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Station[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('resmus_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load favorites");
      }
    }
  }, []);

  const removeFavorite = (station: Station) => {
    const newFavs = favorites.filter(f => f.id !== station.id);
    setFavorites(newFavs);
    localStorage.setItem('resmus_favorites', JSON.stringify(newFavs));
  };

  const handleSelectStation = (station: Station) => {
    // Store the selected station temporarily and navigate to departures
    localStorage.setItem('resmus_selected_favorite', JSON.stringify(station));
    navigate('/');
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/20">
            <Star className="text-white" size={28} fill="white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Mina Favoriter</h1>
          <p className="text-slate-600 dark:text-slate-400">Dina sparade hållplatser</p>
        </div>

        {/* Favorites Grid */}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((station) => (
              <div
                key={station.id}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 hover:shadow-md hover:border-sky-500 dark:hover:border-sky-500 transition-all cursor-pointer group"
                onClick={() => handleSelectStation(station)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-500 flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-white truncate text-sm leading-tight">
                        {station.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {station.provider}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(station);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Klicka för att se avgångar
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-20 text-center opacity-40">
            <Star size={48} className="text-slate-300 mb-4" />
            <p className="font-bold text-slate-400 text-lg mb-2">Inga favoriter än</p>
            <p className="text-sm text-slate-400 max-w-sm">
              Spara dina favoritplatser genom att klicka på stjärnikonen när du tittar på avgångar från en hållplats.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 mt-8">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dina favoriter sparas lokalt i din webbläsare
          </p>
        </div>
      </div>
    </div>
  );
};
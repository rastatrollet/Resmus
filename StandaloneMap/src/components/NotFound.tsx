import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMap, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export const NotFound: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full"></div>
        <div className="relative w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">
          <FontAwesomeIcon icon={faMap} className="text-5xl" />
          <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white text-xs font-black px-2 py-1 rounded-md shadow-lg rotate-[-6deg]">
            404
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Vilse i trafiken?</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
        Sidan du letar efter verkar inte finnas eller har blivit flyttad.
      </p>

      <Link
        to="/"
        className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3.5 px-8 rounded-xl shadow-xl shadow-slate-900/10 hover:scale-105 transition-transform flex items-center gap-2"
      >
        <FontAwesomeIcon icon={faArrowLeft} /> Gå tillbaka hem
      </Link>
    </div>
  );
};

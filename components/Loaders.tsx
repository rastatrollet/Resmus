import React from 'react';
import { Loader2 } from 'lucide-react';

// ThemedSpinner Component
export const ThemedSpinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <Loader2 size={size} className={`animate-spin text-sky-500 ${className}`} />
);

// JourneySkeleton Component
export const JourneySkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="p-4">
      <div className="flex justify-between items-end mb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
            <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        <div className="h-[2px] w-4 bg-slate-200 dark:bg-slate-700"></div>
        <div className="h-7 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        <div className="h-[2px] w-4 bg-slate-200 dark:bg-slate-700"></div>
        <div className="h-7 w-14 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    </div>
  </div>
);

// DepartureSkeleton Component
export const DepartureSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    </div>
  </div>
);

// DisruptionSkeleton Component
export const DisruptionSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="flex-1">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mb-1"></div>
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    </div>
  </div>
);
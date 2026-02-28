import React from 'react';

interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    icon?: React.ReactNode;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, label, icon }) => {
    return (
        <label htmlFor={id} className={`flex items-center justify-between cursor-pointer group p-2 rounded-xl transition-colors ${checked ? 'bg-slate-800/50' : 'hover:bg-white/5'}`}>
            <div className="flex items-center gap-3">
                {icon && (
                    <div className={`transition-colors duration-300 ${checked ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-400'}`}>
                        {icon}
                    </div>
                )}
                {label && (
                    <span className={`text-sm font-bold transition-colors duration-300 ${checked ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-300'}`}>
                        {label}
                    </span>
                )}
            </div>

            <div className="relative">
                <input
                    type="checkbox"
                    id={id}
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors duration-300 ${checked ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 'bg-slate-700'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </div>
        </label>
    );
};

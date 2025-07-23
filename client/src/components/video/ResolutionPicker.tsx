import React from "react";
import type { Resolution } from "./ResolutionCard";

const RESOLUTION_OPTIONS: {
    value: Resolution;
    label: string;
    description: string;
}[] = [
        { value: "360p", label: "Standard Quality", description: "Good for mobile & quick sharing." },
        { value: "480p", label: "Enhanced Quality", description: "Balanced for web & desktop." },
        { value: "720p", label: "High Definition", description: "Best for crisp, clear playback." },

    ];

interface ResolutionPickerProps {
    value: Resolution;
    onChange: (newValue: Resolution) => void;
    disabled?: boolean;
}

export const ResolutionPicker: React.FC<ResolutionPickerProps> = ({
    value,
    onChange,
    disabled = false,
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {RESOLUTION_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    disabled={disabled}
                    className={`
            relative group overflow-hidden rounded-2xl p-6 text-center 
            transition-all duration-300 transform hover:scale-[1.02]
            ${value === option.value
                            ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-2 border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                            : 'bg-gray-800/40 border border-white/10 hover:border-indigo-400/40 hover:bg-indigo-500/20'
                        }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
                >
                    <div className="relative z-10">
                        <div className="text-2xl font-bold text-white mb-2">{option.value}</div>
                        <div className="text-sm text-gray-300">
                            {option.label}
                        </div>
                    </div>
                    {value === option.value && (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/20 via-transparent to-purple-400/20 animate-pulse"></div>
                    )}
                </button>
            ))}
        </div>
    );
};

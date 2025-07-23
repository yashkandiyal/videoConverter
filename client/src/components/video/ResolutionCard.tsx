import React from "react";
import { Check, Sparkles } from "lucide-react";

export type Resolution = "720p" | "480p" | "360p";

export interface ResolutionCardProps {
  resolution: Resolution;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const ResolutionCard: React.FC<ResolutionCardProps> = ({
  selected,
  onClick,
  disabled,
  icon,
  title,
  description,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group relative overflow-hidden rounded-3xl border-2 transition-all duration-500 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-purple-400/50
        ${selected
          ? "border-purple-400/50 bg-white/5 backdrop-blur-md shadow-2xl shadow-purple-500/20 scale-105"
          : "border-white/10 bg-white/5 backdrop-blur-sm hover:border-purple-400/30 hover:bg-white/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
        }
        ${disabled ? "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none" : "cursor-pointer"}`
      }
    >
      {/* Animated background gradients */}
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-500 ${selected
          ? 'from-purple-500/20 via-transparent to-blue-500/20'
          : 'from-purple-500/5 via-transparent to-blue-500/5 group-hover:from-purple-500/10 group-hover:to-blue-500/10'
          }`}></div>

        {/* Floating orb effects */}
        {selected && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl animate-pulse"></div>
        )}
      </div>

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>

      {/* Main content */}
      <div className="relative p-6 z-10">
        <div className="flex items-center space-x-6">

          {/* Enhanced icon container */}
          <div className="relative">
            <div className={`p-4 rounded-2xl transition-all duration-300 backdrop-blur-sm border ${selected
              ? "bg-gradient-to-br from-purple-400/20 to-blue-400/20 border-purple-400/30"
              : "bg-white/5 border-white/10 group-hover:bg-purple-400/10 group-hover:border-purple-400/20"
              }`}>
              <div className={`transition-all duration-300 ${selected ? "text-purple-400 scale-110" : "text-gray-300 group-hover:text-purple-300 group-hover:scale-105"
                }`}>
                {icon}
              </div>
            </div>

            {/* Floating particles around selected icon */}
            {selected && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400/60 rounded-full animate-ping"></div>
                <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-ping delay-500"></div>
                <div className="absolute top-1/2 -right-2 w-1 h-1 bg-purple-300/60 rounded-full animate-ping delay-1000"></div>
              </div>
            )}
          </div>

          {/* Enhanced text content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h3 className={`font-bold text-xl transition-all duration-300 ${selected
                ? "bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent"
                : "text-white group-hover:text-purple-100"
                }`}>
                {title}
              </h3>

              {/* Premium badge for selected */}
              {selected && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-400/30">
                  <Sparkles size={12} className="text-purple-300" />
                  <span className="text-xs font-medium text-purple-200">ACTIVE</span>
                </div>
              )}
            </div>

            <p className={`text-sm transition-colors duration-300 ${selected ? "text-purple-100/80" : "text-gray-400 group-hover:text-gray-300"
              }`}>
              {description}
            </p>
          </div>
        </div>

        {/* Enhanced progress indicator */}
        {selected && (
          <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>

      {/* Enhanced animated checkmark */}
      <div className="absolute top-4 right-4">
        <div
          className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ease-out
            ${selected
              ? "bg-gradient-to-br from-purple-400 to-blue-400 scale-100 shadow-lg shadow-purple-500/30"
              : "bg-white/5 border border-white/10 scale-0"
            }`}
        >
          <Check size={16} className={`transition-all duration-300 ${selected ? "text-white" : "text-gray-400"
            }`} />

          {/* Success rings */}
          {selected && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border border-purple-400/40 rounded-full animate-ping"></div>
              <div className="absolute inset-0 border border-blue-400/30 rounded-full animate-ping delay-300"></div>
            </div>
          )}
        </div>
      </div>

      {/* Selection glow effect */}
      {selected && (
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none animate-pulse"></div>
      )}

      {/* Hover state border glow */}
      <div className={`absolute inset-0 rounded-3xl transition-opacity duration-300 pointer-events-none ${selected
        ? "opacity-100 shadow-[inset_0_0_0_1px_rgba(147,51,234,0.3)]"
        : "opacity-0 group-hover:opacity-100 shadow-[inset_0_0_0_1px_rgba(147,51,234,0.2)]"
        }`}></div>
    </div>
  );
};

export default ResolutionCard;
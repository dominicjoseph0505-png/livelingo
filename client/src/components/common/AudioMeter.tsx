import React from 'react';

export interface AudioMeterProps {
  level: number; // 0 to 100
  frequencyData?: Uint8Array;
  isActive?: boolean;
  barCount?: number;
  height?: number;
  className?: string;
}

export const AudioMeter: React.FC<AudioMeterProps> = ({
  level,
  frequencyData,
  isActive = true,
  barCount = 14,
  height = 36,
  className = '',
}) => {
  // Generate bar heights based on frequencyData or calculated level
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (!isActive) return 4;

    if (frequencyData && frequencyData.length > 0) {
      const index = Math.floor((i / barCount) * (frequencyData.length / 2));
      const val = frequencyData[index] || 0;
      return Math.max(4, Math.round((val / 255) * height));
    }

    // Dynamic wave simulation from level
    const offset = Math.sin((i / barCount) * Math.PI) * (level / 100);
    return Math.max(4, Math.round(offset * height));
  });

  return (
    <div
      className={`flex items-center justify-center gap-1.5 h-[${height}px] ${className}`}
      aria-label={`Microphone volume level: ${level}%`}
      role="progressbar"
      aria-valuenow={level}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {bars.map((barHeight, idx) => {
        // High energy bars get cobalt color
        const isHigh = barHeight > height * 0.45;
        const color = isActive
          ? isHigh
            ? 'bg-[#3563E9]'
            : 'bg-[#3563E9]/50'
          : 'bg-[#E5E2D9]';

        return (
          <div
            key={idx}
            className={`w-1.5 rounded-full transition-all duration-75 ${color}`}
            style={{
              height: `${barHeight}px`,
            }}
          />
        );
      })}
    </div>
  );
};

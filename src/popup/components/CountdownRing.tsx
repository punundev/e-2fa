import React from 'react';
import { t } from '../../lib/i18n';

interface CountdownRingProps {
  remaining: number;
  period: number;
  size?: number;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  remaining,
  period,
  size = 28,
}) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remaining / period));
  const strokeDashoffset = circumference - progress * circumference;

  const isUrgent = remaining <= 5;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={remaining}
      aria-valuemin={0}
      aria-valuemax={period}
      aria-label={t('card_period', { seconds: remaining })}
    >
      <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ring-track)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isUrgent ? '#ef4444' : 'var(--ring-color)'}
          className="transition-all duration-300 ease-linear"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="absolute text-[10px] font-mono font-medium app-text-secondary">
        {remaining}
      </span>
    </div>
  );
};

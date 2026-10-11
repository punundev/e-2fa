import React from "react";
import { getBrandIcon } from "../../lib/brand-icons";

interface BrandLogoProps {
  issuer?: string;
  name?: string;
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  issuer,
  name,
  size = 28,
  className = "",
}) => {
  const brand = getBrandIcon(issuer, name);
  const iconSize = Math.round(size * 0.58);

  const getFillColor = (hex: string) => {
    const lower = hex.toLowerCase();
    if (lower === "000000" || lower === "ffffff" || lower === "181717") {
      return "currentColor";
    }
    return `#${hex}`;
  };

  const initial = (issuer || name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`rounded-lg app-bg-subtle border border-[var(--border-subtle)] flex items-center justify-center shrink-0 transition-transform ${className}`}
      title={brand?.title || issuer || name || ""}
    >
      {brand ? (
        <svg
          role="img"
          viewBox="0 0 24 24"
          width={iconSize}
          height={iconSize}
          className="shrink-0"
        >
          <path
            fill={getFillColor(brand.hex)}
            d={brand.path}
          />
        </svg>
      ) : (
        <span className="text-[11px] font-bold app-text-accent select-none">
          {initial}
        </span>
      )}
    </div>
  );
};

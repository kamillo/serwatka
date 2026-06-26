"use client";

import { useId } from "react";

/**
 * Logomark serwatka — organiczna kropla „S" (gradient emerald→gold→cyan)
 * + opcjonalny wordmark. Marka z res/serwatka_logo.svg.
 */
export function Logo({
  size = 32,
  showText = true,
}: {
  size?: number;
  showText?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const fluid = `fluid-${id}`;
  const core = `core-${id}`;

  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        aria-hidden="true"
        className="drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
      >
        <defs>
          <linearGradient id={fluid} x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id={core} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <g transform="translate(8, 8)">
          <path
            d="M 70 20 C 105 20, 125 50, 125 80 C 125 115, 95 135, 70 135 C 40 135, 20 110, 25 80 C 28 62, 42 45, 58 35 C 62 32, 68 35, 65 40 C 55 55, 48 70, 50 85 C 53 105, 72 118, 90 110 C 105 102, 110 80, 100 65 C 90 50, 75 35, 70 20 Z"
            fill={`url(#${fluid})`}
          />
          <path
            d="M 70 45 C 85 60, 95 75, 90 92 C 86 105, 72 112, 60 102 C 50 92, 58 75, 70 45 Z"
            fill={`url(#${core})`}
          />
          <circle cx="70" cy="20" r="3" fill="#06B6D4" />
        </g>
      </svg>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-extrabold tracking-tight text-slate-50">
            serwatka
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-emerald-400/70">
            net worth
          </span>
        </span>
      )}
    </span>
  );
}

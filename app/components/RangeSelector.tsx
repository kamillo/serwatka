import Link from "next/link";
import { RANGE_PRESETS, type RangePreset } from "@/lib/data";

export function RangeSelector({ current }: { current: RangePreset }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {RANGE_PRESETS.map((p) => {
        const active = p.value === current;
        return (
          <Link
            key={p.value}
            href={`/?range=${p.value}`}
            className={`rounded-md px-3 py-1 text-sm transition ${
              active
                ? "bg-white/10 font-medium text-slate-50 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

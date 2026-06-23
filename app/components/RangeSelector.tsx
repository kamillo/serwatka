import Link from "next/link";
import { RANGE_PRESETS, type RangePreset } from "@/lib/data";

export function RangeSelector({ current }: { current: RangePreset }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-neutral-800">
      {RANGE_PRESETS.map((p) => {
        const active = p.value === current;
        return (
          <Link
            key={p.value}
            href={`/?range=${p.value}`}
            className={`rounded-md px-3 py-1 text-sm transition ${
              active
                ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { KpiTile, type KpiTileProps } from "./KpiTile";

export interface KpiGroupProps {
  title: string;
  subtitle?: string;
  tiles: (KpiTileProps & { id: string })[];
  columns?: 2 | 3 | 4 | 5;
}

export function KpiGroup({ title, subtitle, tiles, columns = 4 }: KpiGroupProps) {
  const colsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }[columns];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-[#0A0A0A] uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-[#0A0A0A]/60 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`grid gap-3 ${colsClass}`}>
        {tiles.map(t => (
          <KpiTile key={t.id} {...t} />
        ))}
      </div>
    </section>
  );
}

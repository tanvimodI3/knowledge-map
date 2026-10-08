"use client";

import { GitBranch, Lightbulb, Network, Waypoints } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useMaps } from "@/context/maps-context";

// All numbers are derived from the maps in the store.
// BACKEND: if maps get large, have the API return these totals instead of
// computing them in the browser (e.g. GET /api/stats).
export function StatsCards() {
  const { maps } = useMaps();

  const skills = maps.reduce((n, m) => n + m.skills.length, 0);
  const connections = maps.reduce((n, m) => n + m.connections.length, 0);
  // Each connection touches two skills, so links per skill = 2 * connections / skills.
  const linksPerSkill = skills ? ((connections * 2) / skills).toFixed(1) : "0.0";

  const stats = [
    { label: "Knowledge maps", value: maps.length, icon: Network },
    { label: "Skills tracked", value: skills, icon: Lightbulb },
    { label: "Connections", value: connections, icon: GitBranch },
    { label: "Links per skill", value: linksPerSkill, icon: Waypoints },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="gap-0 py-0">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            </div>
            <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

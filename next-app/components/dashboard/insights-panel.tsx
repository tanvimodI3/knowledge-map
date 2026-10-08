"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMaps } from "@/context/maps-context";
import { relativeTime } from "@/lib/knowledge-map/utils";

// Right-hand column on the overview: category breakdown + recent activity.
export function InsightsPanel() {
  const { maps, activity } = useMaps();

  // BACKEND: both of these can be computed server-side (aggregate + events list).
  const counts = new Map<string, number>();
  maps.forEach((m) =>
    m.skills.forEach((s) => counts.set(s.category, (counts.get(s.category) ?? 0) + 1)),
  );
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Skills by category</CardTitle>
          <CardDescription>Across all your maps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {top.length === 0 && (
            <p className="text-sm text-muted-foreground">Add skills to see a breakdown.</p>
          )}
          {top.map(([category, count]) => (
            <div key={category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{category}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Activity shows up here as you build maps.
            </p>
          )}
          <ul className="space-y-3">
            {activity.slice(0, 6).map((item) => {
              const map = maps.find((m) => m.id === item.mapId);
              return (
                <li key={item.id} className="text-sm">
                  <p>{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {map ? (
                      <Link
                        href={`/dashboard/maps/${map.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {map.title}
                      </Link>
                    ) : (
                      "Deleted map"
                    )}{" "}
                    · {relativeTime(item.at)}
                  </p>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

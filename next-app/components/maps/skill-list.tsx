"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMaps } from "@/context/maps-context";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";
import { suggestConnections } from "@/lib/knowledge-map/utils";

interface Props {
  map: KnowledgeMap;
  onSelect: (id: string) => void;
}

// Default right-hand panel: searchable skill list + one-click suggested links.
export function SkillList({ map, onSelect }: Props) {
  const { addConnection } = useMaps();
  const [query, setQuery] = useState("");

  const linkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    map.connections.forEach((c) => {
      counts.set(c.sourceId, (counts.get(c.sourceId) ?? 0) + 1);
      counts.set(c.targetId, (counts.get(c.targetId) ?? 0) + 1);
    });
    return counts;
  }, [map.connections]);

  const suggestions = useMemo(() => suggestConnections(map, 3), [map]);

  const filtered = map.skills
    .filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm">Skills</CardTitle>
          <CardDescription>Select one to see and edit its connections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills"
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-64">
            <ul className="space-y-1 pr-3">
              {filtered.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {map.skills.length === 0 ? "No skills yet." : "No skills match."}
                </li>
              )}
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span>
                      <span className="block text-sm">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">{s.category}</span>
                    </span>
                    <Badge variant="outline">{linkCounts.get(s.id) ?? 0} links</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">Suggested connections</CardTitle>
            <CardDescription>Same category, not linked yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {suggestions.map(({ a, b }) => (
              <div key={a.id + b.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {a.name} <span className="text-muted-foreground">↔</span> {b.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addConnection(map.id, a.id, b.id, "related");
                    toast.success(`Connected ${a.name} and ${b.name}`);
                  }}
                >
                  Connect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

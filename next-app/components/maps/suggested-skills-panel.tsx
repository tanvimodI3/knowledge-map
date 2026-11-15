"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus, Check } from "lucide-react";
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
import { useAuth } from "@/context/auth-context";
import { useMaps } from "@/context/maps-context";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";

interface RecommendationItem {
  item: string;
  name: string;
  score: number;
  topRule: string;
  hasGlobal: boolean;
  hasLocal: boolean;
}

interface Props {
  map: KnowledgeMap;
  onAdded?: (skillId: string) => void;
}

export function SuggestedSkillsPanel({ map, onAdded }: Props) {
  const { user } = useAuth();
  const { addSkill } = useMaps();
  const [suggestions, setSuggestions] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecommendations() {
      if (!user || !map.id) return;
      try {
        setLoading(true);
        const token = await user.getIdToken();
        const res = await fetch(`/api/recommendations/${map.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [user, map.id]);

  // Filter out any skills that are already on this map
  const unaddedSuggestions = suggestions.filter(
    (s) => !map.skills.some((ms) => ms.name.toLowerCase() === s.name.toLowerCase()),
  );

  async function handleAdd(rec: RecommendationItem) {
    try {
      setAddingId(rec.item);
      const newSkill = await addSkill(
        map.id,
        {
          name: rec.name,
          category: "Recommended",
          level: "beginner",
        },
        [],
      );
      toast.success(`Added recommended skill “${rec.name}”`);
      onAdded?.(newSkill.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add skill";
      toast.error(msg);
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return null;
  }

  if (unaddedSuggestions.length === 0) {
    return null;
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-sm">Suggested skills</CardTitle>
        </div>
        <CardDescription>
          Ranked by knowledge-graph multi-context model
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {unaddedSuggestions.slice(0, 3).map((rec) => {
          const isAdding = addingId === rec.item;
          const displayRule =
            rec.topRule && rec.topRule !== "none"
              ? rec.topRule.replace(/,/g, " ∧ ")
              : "graph neighborhood context";

          return (
            <div
              key={rec.item}
              className="flex items-start justify-between gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {rec.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({Math.round(rec.score * 100)}% match)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] lowercase">
                    why: {displayRule}
                  </Badge>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="size-7 p-0"
                disabled={isAdding}
                onClick={() => handleAdd(rec)}
                aria-label={`Add ${rec.name}`}
              >
                {isAdding ? (
                  <Check className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";

interface RankedPath {
  id: string;
  user: string;
  item: string;
  nodes: string[];
  relations: string[];
  ruleKey: string;
  score: number;
}

interface RecommendationSummary {
  rawPathCount: number;
  filteredPathCount: number;
  selectedFilter: "chi_square" | "frequency";
  selectedRuleCount: number;
  rankedPathCount: number;
}

interface Recommendation {
  mapId: string;
  options: RankedPath[];
  selectedPathId: string | null;
  selectedPath: RankedPath | null;
  summary: RecommendationSummary;
  generatedAt: string;
  selectedAt: string;
}

interface Props {
  map: KnowledgeMap;
  onSelectSkill: (skillId: string | null) => void;
}

export function RecommendationPanel({ map, onSelectSkill }: Props) {
  const { user } = useAuth();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => {
    const result = new Map(map.skills.map((skill) => [skill.id, skill.name]));
    return result;
  }, [map.skills]);

  async function authHeaders() {
    if (!user) throw new Error("You must be signed in.");
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }

  async function loadRecommendation() {
    if (!user) return;
    setLoading(true);
    setError(null);
    setShowAlternatives(false);
    try {
      const response = await fetch(`/api/maps/${map.id}/path-recommendations`, {
        headers: await authHeaders(),
        cache: "no-store",
      });
      if (response.status === 404) {
        setRecommendation(null);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Failed to load recommendations");
      setRecommendation(data.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }

  async function generateRecommendation() {
    setGenerating(true);
    setError(null);
    setShowAlternatives(false);
    try {
      const response = await fetch(`/api/maps/${map.id}/path-recommendations`, {
        method: "POST",
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Failed to generate recommendations");
      setRecommendation(data.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recommendations");
    } finally {
      setGenerating(false);
    }
  }

  async function selectOption(pathId: string) {
    try {
      const response = await fetch(`/api/maps/${map.id}/path-recommendations`, {
        method: "PATCH",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ pathId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Failed to select recommendation");
      setRecommendation(data.recommendation);
      setShowAlternatives(false);
      const selected = data.recommendation.selectedPath;
      const skillId = selected ? map.skills.find((skill) => skill.id === selected.item)?.id ?? null : null;
      onSelectSkill(skillId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to select recommendation";
      setError(message);
      toast.error(message);
    }
  }

  useEffect(() => {
    setRecommendation(null);
    setShowAlternatives(false);
    setError(null);
    void loadRecommendation();
    // The map/user identity must reset this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, user?.uid]);

  const selected = recommendation?.selectedPath;
  const options = recommendation?.options ?? [];
  const selectedIndex = selected ? options.findIndex((option) => option.id === selected.id) : -1;

  function candidateName(option: RankedPath) {
    return names.get(option.item) ?? option.item;
  }

  function explainContext(_option: RankedPath) {
    return "Suggested from relationships and paths in this knowledge map.";
  }

  function readablePath(option: RankedPath) {
    return option.nodes.map((id, index) =>
      index === 0 && id.startsWith("u_")
        ? "You"
        : names.get(id) ?? id,
    ).join(" → ");
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <CardTitle className="text-base">Path recommendation</CardTitle>
        {recommendation && (
          <Button variant="ghost" size="sm" onClick={generateRecommendation} disabled={generating}>
            <RefreshCw className={generating ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {loading || generating ? (
          <p className="text-sm text-muted-foreground">{generating ? "Generating recommendations…" : "Loading recommendations…"}</p>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={recommendation ? loadRecommendation : generateRecommendation}>
              Retry
            </Button>
          </div>
        ) : !recommendation || options.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {recommendation ? "The backend returned no path recommendations." : "No recommendations have been generated for this map yet."}
            </p>
            <Button size="sm" onClick={generateRecommendation}>Generate recommendations</Button>
          </div>
        ) : selected ? (
          <>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Candidate · Rank {selectedIndex + 1}</p>
                  <p className="font-medium">{candidateName(selected)}</p>
                </div>
                <Badge variant="outline">Skill</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                This ranks likely next skills using the paths already in your map. It is not an AI prediction or learning assessment.
              </p>
              {selected.nodes.length > 0 && (
                <p className="text-xs"><span className="text-muted-foreground">Why it may be next:</span> {readablePath(selected)}</p>
              )}
            </div>

            {options.length > 1 ? (
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={() => setShowAlternatives((value) => !value)}>
                  Change <ChevronDown className={showAlternatives ? "size-3.5 rotate-180" : "size-3.5"} />
                </Button>
                {showAlternatives && (
                  <div className="space-y-2">
                    {options.map((option, index) => option.id === selected.id ? null : (
                      <button
                        key={option.id}
                        type="button"
                        className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/40"
                        onClick={() => void selectOption(option.id)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span>
                            <span className="block text-xs text-muted-foreground">Candidate · Rank {index + 1}</span>
                            <span className="block font-medium">{candidateName(option)}</span>
                          </span>
                          <Badge variant="outline">Skill</Badge>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{explainContext(option)}</span>
                        {option.nodes.length > 0 && <span className="mt-1 block text-xs">Path: {readablePath(option)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No alternate recommendations were returned by the backend.</p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

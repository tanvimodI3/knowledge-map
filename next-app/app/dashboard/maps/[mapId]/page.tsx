"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Network, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMaps } from "@/context/maps-context";
import { AddSkillDialog } from "@/components/maps/add-skill-dialog";
import { SkillDetailPanel } from "@/components/maps/skill-detail-panel";
import { SkillGraph } from "@/components/maps/skill-graph";
import { SkillList } from "@/components/maps/skill-list";
import { RecommendationPanel } from "@/components/maps/recommendation-panel";
import { cn } from "@/lib/utils";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";

export default function MapPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const { getMap, maps } = useMaps();
  const [map, setMap] = useState<KnowledgeMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function loadMap() {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const loaded = await getMap(mapId);
      setMap(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Map could not be loaded.";
      if (message === "Map not found") setNotFound(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedId(null);
    void loadMap();
    // Reload whenever the route map ID changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  useEffect(() => {
    const updated = maps.find((item) => item.id === mapId);
    if (updated) setMap(updated);
  }, [maps, mapId]);

  if (loading) {
    return (
      <Card className="items-center gap-3 px-6 py-16 text-center">
        <Network className="size-8 animate-pulse text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="items-center gap-3 px-6 py-16 text-center">
        <Network className="size-8 text-destructive" strokeWidth={1.5} />
        <p className="font-medium">Map could not be loaded</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadMap()}>
            Try again
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </Link>
        </div>
      </Card>
    );
  }

  if (notFound || !map) {
    return (
      <Card className="items-center gap-3 px-6 py-16 text-center">
        <p className="font-medium">Map not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </Card>
    );
  }

  const selected = map.skills.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-3")}
        >
          <ArrowLeft className="size-4" />
          All maps
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{map.title}</h1>
            {map.description && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{map.description}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Badge variant="secondary">{map.skills.length} skills</Badge>
              <Badge variant="secondary">{map.connections.length} connections</Badge>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add skill
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="gap-0 overflow-hidden py-0">
          {map.skills.length === 0 ? (
            <div className="flex h-[460px] flex-col items-center justify-center gap-3 p-6 text-center">
              <Network className="size-8 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <p className="font-medium">This map is empty</p>
                <p className="text-sm text-muted-foreground">
                  Add a skill, then connect it to others to see the map take shape.
                </p>
              </div>
              <Button onClick={() => setAddOpen(true)}>Add your first skill</Button>
            </div>
          ) : (
            <SkillGraph
              skills={map.skills}
              connections={map.connections}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </Card>

        {selected ? (
          <SkillDetailPanel map={map} skill={selected} onSelect={setSelectedId} />
        ) : (
          <SkillList map={map} onSelect={setSelectedId} />
        )}
      </div>

      <RecommendationPanel map={map} onSelectSkill={setSelectedId} />

      <AddSkillDialog
        map={map}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={setSelectedId} // select the new skill so its links are visible right away
      />
    </div>
  );
}

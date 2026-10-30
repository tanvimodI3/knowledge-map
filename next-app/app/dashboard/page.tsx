"use client";

import { useMemo, useState } from "react";
import { Network, Plus, RefreshCw, Search } from "lucide-react";

import { CreateMapDialog } from "@/components/dashboard/create-map-dialog";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { MapCard } from "@/components/dashboard/map-card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { useMaps } from "@/context/maps-context";

type SortKey = "recent" | "skills" | "name";

export default function DashboardPage() {
  const { user } = useAuth();
  const { maps, error, loading, refreshData } = useMaps();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const firstName = user?.displayName?.split(" ")[0];

  // Search + sort happen in the browser for now.
  // BACKEND: for lots of maps, move to GET /api/maps?q=...&sort=... with pagination.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = maps.filter(
      (m) =>
        !q || m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "skills") return b.skills.length - a.skills.length;
      if (sort === "name") return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [maps, query, sort]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Map what you know, and how it all connects.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New map
        </Button>
      </div>

      <StatsCards />

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search maps"
                className="pl-8"
              />
            </div>
            <Tabs value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <TabsList>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="skills">Most skills</TabsTrigger>
                <TabsTrigger value="name">A–Z</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {error ? (
            <Card className="items-center gap-3 border-destructive/30 px-6 py-16 text-center">
              <Network className="size-8 text-destructive" strokeWidth={1.5} />
              <div>
                <p className="font-medium">Maps could not be loaded</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => void refreshData()}
                disabled={loading}
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                Try again
              </Button>
            </Card>
          ) : maps.length === 0 ? (
            <Card className="items-center gap-3 border-dashed px-6 py-16 text-center">
              <Network className="size-8 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <p className="font-medium">No maps yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first map, then add skills and connect them.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>Create a map</Button>
            </Card>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No maps match “{query}”.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((map) => (
                <MapCard key={map.id} map={map} />
              ))}
              {!query && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <Plus className="size-5" />
                  New map
                </button>
              )}
            </div>
          )}
        </section>

        <aside>
          <InsightsPanel />
        </aside>
      </div>

      <CreateMapDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

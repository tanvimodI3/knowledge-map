"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type {
  ActivityItem,
  KnowledgeMap,
  RelationChoice,
  Skill,
} from "@/lib/knowledge-map/types";
import { areConnected, choiceToEdge, newId } from "@/lib/knowledge-map/utils";

interface MapsContextValue {
  maps: KnowledgeMap[];
  activity: ActivityItem[];
  loading: boolean;
  createMap: (input: { title: string; description: string }) => Promise<KnowledgeMap>;
  deleteMap: (id: string) => KnowledgeMap | undefined;
  restoreMap: (map: KnowledgeMap) => void;
  addSkill: (
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ) => Promise<Skill>;
  removeSkill: (mapId: string, skillId: string) => void;
  addConnection: (
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ) => void;
  removeConnection: (mapId: string, connectionId: string) => void;
  refreshData: () => Promise<void>;
}

const MapsContext = createContext<MapsContextValue | undefined>(undefined);

export function MapsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [maps, setMaps] = useState<KnowledgeMap[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function getAuthHeaders(): Promise<HeadersInit> {
    if (!user) throw new Error("You must be signed in.");
    const token = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function loadInitialData() {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [mapsRes, actRes] = await Promise.all([
        fetch("/api/maps", { headers }),
        fetch("/api/activity?limit=20", { headers }),
      ]);

      if (mapsRes.ok) {
        const mapsData = await mapsRes.json();
        setMaps(mapsData.maps || []);
      }
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivity(actData.activity || []);
      }
    } catch (err) {
      console.error("Failed to load knowledge map data:", err);
      toast.error("Failed to load knowledge map data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [user]);

  async function refreshActivity() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/activity?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity || []);
      }
    } catch {
      // Non-fatal background refresh
    }
  }

  // Apply a local change to one map and bump its updatedAt.
  function touch(mapId: string, update: (map: KnowledgeMap) => KnowledgeMap) {
    setMaps((prev) =>
      prev.map((m) =>
        m.id === mapId ? { ...update(m), updatedAt: new Date().toISOString() } : m,
      ),
    );
  }

  async function createMap({
    title,
    description,
  }: {
    title: string;
    description: string;
  }): Promise<KnowledgeMap> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/maps", {
      method: "POST",
      headers,
      body: JSON.stringify({ title, description }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || "Failed to create map");
    }

    const { map } = await res.json();
    setMaps((prev) => [map, ...prev]);
    refreshActivity();
    return map;
  }

  function deleteMap(id: string): KnowledgeMap | undefined {
    const target = maps.find((m) => m.id === id);
    if (!target) return undefined;

    // Optimistic remove
    setMaps((prev) => prev.filter((m) => m.id !== id));

    // Call backend API
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/maps/${id}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) {
          throw new Error("Failed to delete map");
        }
        refreshActivity();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete map";
        toast.error(msg);
        // Rollback
        setMaps((prev) => [target, ...prev]);
      }
    })();

    return target;
  }

  function restoreMap(map: KnowledgeMap) {
    // Optimistic restore
    setMaps((prev) => (prev.some((m) => m.id === map.id) ? prev : [map, ...prev]));

    // Call backend API
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/maps/${map.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ deleted: false }),
        });
        if (!res.ok) {
          throw new Error("Failed to restore map");
        }
        refreshActivity();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to restore map";
        toast.error(msg);
        // Rollback
        setMaps((prev) => prev.filter((m) => m.id !== map.id));
      }
    })();
  }

  async function addSkill(
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ): Promise<Skill> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/maps/${mapId}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        level: input.level,
        links,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || "Failed to add skill");
    }

    const { skill, connections } = await res.json();

    touch(mapId, (m) => ({
      ...m,
      skills: [...m.skills, skill],
      connections: [...m.connections, ...connections],
    }));

    refreshActivity();
    return skill;
  }

  function removeSkill(mapId: string, skillId: string) {
    const currentMap = maps.find((m) => m.id === mapId);
    if (!currentMap) return;

    // Optimistic remove
    touch(mapId, (m) => ({
      ...m,
      skills: m.skills.filter((s) => s.id !== skillId),
      connections: m.connections.filter(
        (c) => c.sourceId !== skillId && c.targetId !== skillId,
      ),
    }));

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/maps/${mapId}/skills/${skillId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) throw new Error("Failed to remove skill");
        refreshActivity();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to remove skill";
        toast.error(msg);
        // Rollback
        setMaps((prev) => prev.map((m) => (m.id === mapId ? currentMap : m)));
      }
    })();
  }

  function addConnection(
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ) {
    if (subjectId === otherId) return;
    const currentMap = maps.find((m) => m.id === mapId);
    if (!currentMap) return;

    const edge = choiceToEdge(choice, subjectId, otherId);
    if (areConnected(currentMap.connections, subjectId, otherId)) return;

    // Temporary optimistic ID
    const tempId = newId();
    const tempConn = { id: tempId, ...edge };

    touch(mapId, (m) => ({
      ...m,
      connections: [...m.connections, tempConn],
    }));

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/maps/${mapId}/connections`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            type: edge.type,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Failed to create connection");
        }

        const { connection } = await res.json();
        touch(mapId, (m) => ({
          ...m,
          connections: m.connections.map((c) => (c.id === tempId ? connection : c)),
        }));
        refreshActivity();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to connect skills";
        toast.error(msg);
        // Rollback
        touch(mapId, (m) => ({
          ...m,
          connections: m.connections.filter((c) => c.id !== tempId),
        }));
      }
    })();
  }

  function removeConnection(mapId: string, connectionId: string) {
    const currentMap = maps.find((m) => m.id === mapId);
    if (!currentMap) return;
    const targetConn = currentMap.connections.find((c) => c.id === connectionId);

    // Optimistic remove
    touch(mapId, (m) => ({
      ...m,
      connections: m.connections.filter((c) => c.id !== connectionId),
    }));

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/maps/${mapId}/connections/${connectionId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) throw new Error("Failed to remove connection");
        refreshActivity();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to remove connection";
        toast.error(msg);
        // Rollback
        if (targetConn) {
          touch(mapId, (m) => ({
            ...m,
            connections: [...m.connections, targetConn],
          }));
        }
      }
    })();
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <MapsContext.Provider
      value={{
        maps,
        activity,
        loading,
        createMap,
        deleteMap,
        restoreMap,
        addSkill,
        removeSkill,
        addConnection,
        removeConnection,
        refreshData: loadInitialData,
      }}
    >
      {children}
    </MapsContext.Provider>
  );
}

export function useMaps() {
  const ctx = useContext(MapsContext);
  if (!ctx) throw new Error("useMaps must be used within a MapsProvider");
  return ctx;
}

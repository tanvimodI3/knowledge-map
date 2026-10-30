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
  Connection,
  KnowledgeMap,
  RelationChoice,
  Skill,
} from "@/lib/knowledge-map/types";

interface MapsContextValue {
  maps: KnowledgeMap[];
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  getMap: (mapId: string) => Promise<KnowledgeMap>;
  createMap: (input: { title: string; description: string }) => Promise<KnowledgeMap>;
  deleteMap: (id: string) => Promise<KnowledgeMap>;
  restoreMap: (map: KnowledgeMap) => Promise<KnowledgeMap>;
  addSkill: (
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ) => Promise<Skill>;
  removeSkill: (mapId: string, skillId: string) => Promise<void>;
  addConnection: (
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ) => Promise<Connection>;
  removeConnection: (mapId: string, connectionId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const MapsContext = createContext<MapsContextValue | undefined>(undefined);

async function apiError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error?.message || fallback);
}

export function MapsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [maps, setMaps] = useState<KnowledgeMap[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function getAuthHeaders(): Promise<HeadersInit> {
    if (!user) throw new Error("You must be signed in.");
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  async function loadInitialData() {
    if (!user) {
      setMaps([]);
      setActivity([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const [mapsRes, activityRes] = await Promise.all([
        fetch("/api/maps", { headers, cache: "no-store" }),
        fetch("/api/activity?limit=20", { headers, cache: "no-store" }),
      ]);

      if (!mapsRes.ok) throw await apiError(mapsRes, "Failed to load maps.");
      const mapsData = await mapsRes.json();
      setMaps(Array.isArray(mapsData.maps) ? mapsData.maps : []);

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(Array.isArray(activityData.activity) ? activityData.activity : []);
      } else {
        setActivity([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load knowledge map data.";
      setMaps([]);
      setActivity([]);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
    // Reload when the verified Firebase user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function refreshActivity() {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/activity?limit=20", { headers, cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setActivity(Array.isArray(data.activity) ? data.activity : []);
    } catch {
      // Activity is secondary and does not undo a successful mutation.
    }
  }

  async function getMap(mapId: string): Promise<KnowledgeMap> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/maps/${encodeURIComponent(mapId)}`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) throw await apiError(response, "Failed to load map.");
    const data = await response.json();
    if (!data.map) throw new Error("The server returned an invalid map response.");

    setMaps((previous) => {
      const exists = previous.some((map) => map.id === data.map.id);
      return exists
        ? previous.map((map) => (map.id === data.map.id ? data.map : map))
        : [...previous, data.map];
    });
    return data.map;
  }

  async function createMap(input: { title: string; description: string }): Promise<KnowledgeMap> {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/maps", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiError(response, "Failed to create map.");
    const data = await response.json();
    setMaps((previous) => [data.map, ...previous.filter((map) => map.id !== data.map.id)]);
    void refreshActivity();
    return data.map;
  }

  async function deleteMap(id: string): Promise<KnowledgeMap> {
    const target = maps.find((map) => map.id === id);
    if (!target) throw new Error("Map not found.");

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/maps/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) throw await apiError(response, "Failed to delete map.");

    setMaps((previous) => previous.filter((map) => map.id !== id));
    void refreshActivity();
    return target;
  }

  async function restoreMap(map: KnowledgeMap): Promise<KnowledgeMap> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/maps/${encodeURIComponent(map.id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ deleted: false }),
    });
    if (!response.ok) throw await apiError(response, "Failed to restore map.");
    const data = await response.json();

    setMaps((previous) =>
      previous.some((item) => item.id === data.map.id)
        ? previous.map((item) => (item.id === data.map.id ? data.map : item))
        : [data.map, ...previous],
    );
    void refreshActivity();
    return data.map;
  }

  async function addSkill(
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ): Promise<Skill> {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/maps/${encodeURIComponent(mapId)}/skills`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        level: input.level,
        links,
      }),
    });
    if (!response.ok) throw await apiError(response, "Failed to add skill.");
    const data = await response.json();

    setMaps((previous) =>
      previous.map((map) =>
        map.id === mapId
          ? {
              ...map,
              skills: [...map.skills.filter((skill) => skill.id !== data.skill.id), data.skill],
              connections: [
                ...map.connections.filter(
                  (connection) =>
                    !data.connections.some((created: Connection) => created.id === connection.id),
                ),
                ...data.connections,
              ],
              updatedAt: new Date().toISOString(),
            }
          : map,
      ),
    );
    void refreshActivity();
    return data.skill;
  }

  async function removeSkill(mapId: string, skillId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `/api/maps/${encodeURIComponent(mapId)}/skills/${encodeURIComponent(skillId)}`,
      { method: "DELETE", headers },
    );
    if (!response.ok) throw await apiError(response, "Failed to remove skill.");

    setMaps((previous) =>
      previous.map((map) =>
        map.id === mapId
          ? {
              ...map,
              skills: map.skills.filter((skill) => skill.id !== skillId),
              connections: map.connections.filter(
                (connection) =>
                  connection.sourceId !== skillId && connection.targetId !== skillId,
              ),
              updatedAt: new Date().toISOString(),
            }
          : map,
      ),
    );
    void refreshActivity();
  }

  async function addConnection(
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ): Promise<Connection> {
    if (subjectId === otherId) throw new Error("Cannot connect a skill to itself.");

    const currentMap = maps.find((map) => map.id === mapId);
    if (!currentMap) throw new Error("Map not found.");
    if (
      currentMap.connections.some(
        (connection) =>
          (connection.sourceId === subjectId && connection.targetId === otherId) ||
          (connection.sourceId === otherId && connection.targetId === subjectId),
      )
    ) {
      throw new Error("These skills are already connected.");
    }

    let sourceId = subjectId;
    let targetId = otherId;
    let type: "prerequisite" | "related" = "related";
    if (choice === "needs") {
      sourceId = otherId;
      targetId = subjectId;
      type = "prerequisite";
    } else if (choice === "leads-to") {
      sourceId = subjectId;
      targetId = otherId;
      type = "prerequisite";
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/maps/${encodeURIComponent(mapId)}/connections`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sourceId, targetId, type }),
    });
    if (!response.ok) throw await apiError(response, "Failed to create connection.");
    const data = await response.json();

    setMaps((previous) =>
      previous.map((map) =>
        map.id === mapId
          ? {
              ...map,
              connections: [...map.connections, data.connection],
              updatedAt: new Date().toISOString(),
            }
          : map,
      ),
    );
    void refreshActivity();
    return data.connection;
  }

  async function removeConnection(mapId: string, connectionId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `/api/maps/${encodeURIComponent(mapId)}/connections/${encodeURIComponent(connectionId)}`,
      { method: "DELETE", headers },
    );
    if (!response.ok) throw await apiError(response, "Failed to remove connection.");

    setMaps((previous) =>
      previous.map((map) =>
        map.id === mapId
          ? {
              ...map,
              connections: map.connections.filter(
                (connection) => connection.id !== connectionId,
              ),
              updatedAt: new Date().toISOString(),
            }
          : map,
      ),
    );
    void refreshActivity();
  }

  if (loading && !user) {
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
        error,
        getMap,
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

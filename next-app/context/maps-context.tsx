"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type {
  ActivityItem,
  KnowledgeMap,
  RelationChoice,
  Skill,
} from "@/lib/knowledge-map/types";
import { createSeedActivity, createSeedMaps } from "@/lib/knowledge-map/mock-data";
import { areConnected, choiceToEdge, newId } from "@/lib/knowledge-map/utils";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  FRONTEND-ONLY STORE
 *  Everything lives in React state, so it resets on refresh.
 *
 *  BACKEND HANDOFF: every function below has a `BACKEND:` comment saying which
 *  call should replace the local state update. Keep the function signatures the
 *  same and the UI components won't need to change. Search the project for
 *  "BACKEND:" to find every integration point.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface MapsContextValue {
  maps: KnowledgeMap[];
  activity: ActivityItem[];
  createMap: (input: { title: string; description: string }) => KnowledgeMap;
  deleteMap: (id: string) => KnowledgeMap | undefined;
  restoreMap: (map: KnowledgeMap) => void;
  addSkill: (
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ) => Skill;
  removeSkill: (mapId: string, skillId: string) => void;
  addConnection: (
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ) => void;
  removeConnection: (mapId: string, connectionId: string) => void;
}

const MapsContext = createContext<MapsContextValue | undefined>(undefined);

export function MapsProvider({ children }: { children: ReactNode }) {
  // BACKEND: replace with a fetch on mount (GET /api/maps), scoped to the signed-in
  // Firebase user (send their ID token). Show a skeleton while it loads.
  const [maps, setMaps] = useState<KnowledgeMap[]>(() => createSeedMaps());
  const [activity, setActivity] = useState<ActivityItem[]>(() => createSeedActivity());

  // Apply a change to one map and bump its updatedAt.
  function touch(mapId: string, update: (map: KnowledgeMap) => KnowledgeMap) {
    setMaps((prev) =>
      prev.map((m) =>
        m.id === mapId ? { ...update(m), updatedAt: new Date().toISOString() } : m,
      ),
    );
  }

  // BACKEND: activity should be derived server-side (e.g. an `events` collection).
  function log(mapId: string, message: string) {
    setActivity((prev) =>
      [{ id: newId(), mapId, message, at: new Date().toISOString() }, ...prev].slice(0, 20),
    );
  }

  function nameOf(mapId: string, skillId: string) {
    return maps.find((m) => m.id === mapId)?.skills.find((s) => s.id === skillId)?.name ?? "skill";
  }

  function createMap({ title, description }: { title: string; description: string }) {
    // BACKEND: POST /api/maps { title, description } → use the returned map (with its real id).
    const now = new Date().toISOString();
    const map: KnowledgeMap = {
      id: newId(),
      title,
      description,
      skills: [],
      connections: [],
      createdAt: now,
      updatedAt: now,
    };
    setMaps((prev) => [map, ...prev]);
    log(map.id, `Created ${title}`);
    return map;
  }

  function deleteMap(id: string) {
    // BACKEND: DELETE /api/maps/:id (consider a soft delete so "Undo" can really restore it).
    const target = maps.find((m) => m.id === id);
    setMaps((prev) => prev.filter((m) => m.id !== id));
    return target;
  }

  function restoreMap(map: KnowledgeMap) {
    // BACKEND: undo the soft delete (e.g. PATCH /api/maps/:id { deleted: false }).
    setMaps((prev) => (prev.some((m) => m.id === map.id) ? prev : [map, ...prev]));
  }

  function addSkill(
    mapId: string,
    input: Omit<Skill, "id">,
    links: { skillId: string; choice: RelationChoice }[],
  ) {
    // BACKEND: POST /api/maps/:mapId/skills { ...input, connections: links }
    // ideally in ONE request/transaction so a skill is never saved without its links.
    const skill: Skill = { id: newId(), ...input };
    const newConnections = links.map(({ skillId, choice }) => ({
      id: newId(),
      ...choiceToEdge(choice, skill.id, skillId),
    }));
    touch(mapId, (m) => ({
      ...m,
      skills: [...m.skills, skill],
      connections: [...m.connections, ...newConnections],
    }));
    log(
      mapId,
      links.length
        ? `Added ${skill.name} with ${links.length} connection${links.length > 1 ? "s" : ""}`
        : `Added ${skill.name}`,
    );
    return skill;
  }

  function removeSkill(mapId: string, skillId: string) {
    // BACKEND: DELETE /api/maps/:mapId/skills/:skillId (server should also delete its connections).
    const name = nameOf(mapId, skillId);
    touch(mapId, (m) => ({
      ...m,
      skills: m.skills.filter((s) => s.id !== skillId),
      connections: m.connections.filter(
        (c) => c.sourceId !== skillId && c.targetId !== skillId,
      ),
    }));
    log(mapId, `Removed ${name}`);
  }

  function addConnection(
    mapId: string,
    subjectId: string,
    otherId: string,
    choice: RelationChoice,
  ) {
    // BACKEND: POST /api/maps/:mapId/connections { sourceId, targetId, type }
    if (subjectId === otherId) return;
    const connection = { id: newId(), ...choiceToEdge(choice, subjectId, otherId) };
    touch(mapId, (m) =>
      areConnected(m.connections, subjectId, otherId)
        ? m
        : { ...m, connections: [...m.connections, connection] },
    );
    log(mapId, `Connected ${nameOf(mapId, subjectId)} and ${nameOf(mapId, otherId)}`);
  }

  function removeConnection(mapId: string, connectionId: string) {
    // BACKEND: DELETE /api/maps/:mapId/connections/:connectionId
    touch(mapId, (m) => ({
      ...m,
      connections: m.connections.filter((c) => c.id !== connectionId),
    }));
  }

  return (
    <MapsContext.Provider
      value={{
        maps,
        activity,
        createMap,
        deleteMap,
        restoreMap,
        addSkill,
        removeSkill,
        addConnection,
        removeConnection,
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

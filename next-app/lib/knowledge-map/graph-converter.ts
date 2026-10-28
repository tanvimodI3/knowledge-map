import { adminDb } from "@/lib/firebase-admin";
import { assembleMap, mapRef } from "@/app/api/_lib/firestore-helpers";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";

export interface KGEntity {
  name: string;
  type: "user" | "skill";
  category?: string;
  level?: string;
}

export interface KGTriple {
  head: string;
  relation: string;
  tail: string;
}

export interface KnowledgeGraphData {
  entities: Record<string, KGEntity>;
  triples: KGTriple[];
  userId: string;
  mapId: string;
}

/**
 * Converts a KnowledgeMap instance from Firestore into the
 * `{ entities, triples }` shape required by Part 1A PathFinder.
 */
export function mapToKnowledgeGraph(
  map: KnowledgeMap,
  user?: { id?: string; name?: string }
): KnowledgeGraphData {
  const rawUid = user?.id || "default_user";
  const userId = rawUid.startsWith("u_") ? rawUid : `u_${rawUid}`;
  const userName = user?.name || "Student";

  const entities: Record<string, KGEntity> = {
    [userId]: {
      name: userName,
      type: "user",
    },
  };

  const triples: KGTriple[] = [];

  // 1. Add all skills as entities and create direct (user -> interacts -> skill) triples
  for (const skill of map.skills) {
    entities[skill.id] = {
      name: skill.name,
      type: "skill",
      category: skill.category,
      level: skill.level,
    };

    triples.push({
      head: userId,
      relation: "interacts",
      tail: skill.id,
    });
  }

  // 2. Add all map connections as graph triples (e.g., prerequisite, related)
  for (const conn of map.connections) {
    // If the referenced skills exist in this map, add the edge
    if (entities[conn.sourceId] && entities[conn.targetId]) {
      triples.push({
        head: conn.sourceId,
        relation: conn.type,
        tail: conn.targetId,
      });
    }
  }

  return {
    entities,
    triples,
    userId,
    mapId: map.id,
  };
}

/**
 * Reads a user's map directly from Firestore and converts it to a KnowledgeGraph.
 */
export async function fetchMapAsGraph(
  uid: string,
  mapId: string
): Promise<KnowledgeGraphData | null> {
  const ref = mapRef(uid, mapId);
  const [map, userSnap] = await Promise.all([
    assembleMap(ref),
    adminDb.doc(`users/${uid}`).get(),
  ]);

  if (!map) {
    return null;
  }

  const userData = userSnap.exists ? userSnap.data() : null;
  const userName = userData?.displayName || userData?.name || userData?.email || "Student";

  return mapToKnowledgeGraph(map, { id: uid, name: userName });
}

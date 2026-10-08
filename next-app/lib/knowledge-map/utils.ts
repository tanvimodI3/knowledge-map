import type {
  Connection,
  KnowledgeMap,
  RelationChoice,
  Skill,
} from "./types";

// BACKEND: ids should come from the database. These client-side ids are only
// placeholders so the UI works without a server.
export const newId = () => crypto.randomUUID();

/** Turn the UI choice ("needs" / "leads-to" / "related") into an edge. */
export function choiceToEdge(
  choice: RelationChoice,
  subjectId: string, // the skill being added / edited
  otherId: string, // the existing skill it's being linked to
): Omit<Connection, "id"> {
  switch (choice) {
    case "needs": // other must come first
      return { sourceId: otherId, targetId: subjectId, type: "prerequisite" };
    case "leads-to": // subject must come first
      return { sourceId: subjectId, targetId: otherId, type: "prerequisite" };
    default:
      return { sourceId: subjectId, targetId: otherId, type: "related" };
  }
}

export function areConnected(connections: Connection[], a: string, b: string) {
  return connections.some(
    (c) =>
      (c.sourceId === a && c.targetId === b) ||
      (c.sourceId === b && c.targetId === a),
  );
}

/**
 * Simple deterministic layout: skills sit on an ellipse, grouped by category.
 * Fine for up to ~25 skills per map.
 * BACKEND/LATER: swap for a force-directed layout (d3-force) if maps get big,
 * or store x/y per skill in the DB so users can drag nodes around.
 */
export function layoutSkills(
  skills: Skill[],
  width: number,
  height: number,
  padding = 40,
): Record<string, { x: number; y: number }> {
  const sorted = [...skills].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - padding;
  const ry = height / 2 - padding;
  const out: Record<string, { x: number; y: number }> = {};

  sorted.forEach((skill, i) => {
    if (sorted.length === 1) {
      out[skill.id] = { x: cx, y: cy };
      return;
    }
    const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
    out[skill.id] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
  return out;
}

/**
 * Suggest links between skills that share a category but aren't connected yet.
 * BACKEND/AI: replace with real suggestions (e.g. embedding similarity) from the API.
 */
export function suggestConnections(map: KnowledgeMap, limit = 3) {
  const out: { a: Skill; b: Skill }[] = [];
  const { skills, connections } = map;
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i];
      const b = skills[j];
      if (
        a.category.toLowerCase() === b.category.toLowerCase() &&
        !areConnected(connections, a.id, b.id)
      ) {
        out.push({ a, b });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Shared frontend types for knowledge maps.
// BACKEND: these mirror the shape the API/DB should return. If the backend
// shape differs, adapt it in ONE place (context/maps-context.tsx) so the UI
// components don't need to change.

export type SkillLevel = "beginner" | "intermediate" | "advanced";

/**
 * "prerequisite": directed edge — `sourceId` should be learned before `targetId`.
 * "related": undirected — the direction of source/target doesn't matter.
 */
export type RelationType = "prerequisite" | "related";

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
}

export interface KnowledgeMap {
  id: string;
  title: string;
  description: string;
  skills: Skill[];
  connections: Connection[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ActivityItem {
  id: string;
  mapId: string;
  message: string;
  at: string; // ISO string
}

/**
 * UI-level choice: how the skill being added/edited relates to an EXISTING skill.
 * Converted to a Connection (source/target/type) by `choiceToEdge` in utils.ts.
 */
export type RelationChoice = "needs" | "leads-to" | "related";

export const LEVELS: { value: SkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const RELATION_CHOICES: { value: RelationChoice; label: string }[] = [
  { value: "needs", label: "Needs it first" },
  { value: "leads-to", label: "Leads to it" },
  { value: "related", label: "Related" },
];

import type {
  ActivityItem,
  KnowledgeMap,
  RelationType,
  SkillLevel,
} from "./types";

// BACKEND: delete this whole file once maps are fetched from the API.
// It only exists so the dashboard has something to show during frontend work.

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type SkillSeed = [name: string, category: string, level: SkillLevel];
type LinkSeed = [from: string, to: string, type: RelationType];

function buildMap(
  id: string,
  title: string,
  description: string,
  skillSeeds: SkillSeed[],
  linkSeeds: LinkSeed[],
  createdDaysAgo: number,
  updatedDaysAgo: number,
): KnowledgeMap {
  return {
    id,
    title,
    description,
    skills: skillSeeds.map(([name, category, level]) => ({
      id: `${id}:${name}`,
      name,
      category,
      level,
    })),
    connections: linkSeeds.map(([from, to, type], i) => ({
      id: `${id}:c${i}`,
      sourceId: `${id}:${from}`,
      targetId: `${id}:${to}`,
      type,
    })),
    createdAt: ago(createdDaysAgo),
    updatedAt: ago(updatedDaysAgo),
  };
}

export function createSeedMaps(): KnowledgeMap[] {
  return [
    buildMap(
      "ml-engineer",
      "Machine Learning Engineer",
      "Math foundations through to retrieval-augmented systems.",
      [
        ["Python", "Programming", "advanced"],
        ["Linear Algebra", "Math", "intermediate"],
        ["Probability", "Math", "intermediate"],
        ["Neural Networks", "Deep Learning", "intermediate"],
        ["Transformers", "Deep Learning", "beginner"],
        ["RAG", "Applications", "beginner"],
        ["PyTorch", "Frameworks", "intermediate"],
        ["JAX", "Frameworks", "beginner"],
      ],
      [
        ["Linear Algebra", "Neural Networks", "prerequisite"],
        ["Probability", "Neural Networks", "prerequisite"],
        ["Python", "PyTorch", "prerequisite"],
        ["Python", "JAX", "prerequisite"],
        ["Neural Networks", "Transformers", "prerequisite"],
        ["Transformers", "RAG", "prerequisite"],
        ["PyTorch", "JAX", "related"],
        ["PyTorch", "Neural Networks", "related"],
      ],
      21,
      0.2,
    ),
    buildMap(
      "fullstack-web",
      "Fullstack Web",
      "From the browser to the database and back.",
      [
        ["JavaScript", "Frontend", "advanced"],
        ["React", "Frontend", "advanced"],
        ["Next.js", "Frontend", "intermediate"],
        ["Node.js", "Backend", "intermediate"],
        ["REST APIs", "Backend", "intermediate"],
        ["Authentication", "Backend", "beginner"],
        ["SQL", "Data", "intermediate"],
      ],
      [
        ["JavaScript", "React", "prerequisite"],
        ["React", "Next.js", "prerequisite"],
        ["JavaScript", "Node.js", "prerequisite"],
        ["Node.js", "REST APIs", "prerequisite"],
        ["REST APIs", "Authentication", "prerequisite"],
        ["SQL", "REST APIs", "related"],
        ["Next.js", "Authentication", "related"],
      ],
      14,
      3,
    ),
    buildMap(
      "systems",
      "Systems Programming",
      "Processes, concurrency, and how programs talk to the OS.",
      [
        ["Operating Systems", "CS Fundamentals", "beginner"],
        ["Concurrency", "CS Fundamentals", "beginner"],
        ["Go", "Programming", "intermediate"],
      ],
      [
        ["Operating Systems", "Concurrency", "prerequisite"],
        ["Go", "Concurrency", "related"],
      ],
      30,
      9,
    ),
  ];
}

export function createSeedActivity(): ActivityItem[] {
  return [
    { id: "a1", mapId: "ml-engineer", message: "Connected Transformers → RAG", at: ago(0.2) },
    { id: "a2", mapId: "fullstack-web", message: "Added Authentication", at: ago(3) },
    { id: "a3", mapId: "systems", message: "Created Systems Programming", at: ago(9) },
  ];
}

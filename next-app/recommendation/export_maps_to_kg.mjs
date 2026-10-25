import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createSeedMaps } from "../lib/knowledge-map/mock-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts app KnowledgeMaps into Knowledge Graph triples and entities.
 */
export function convertMapsToKG(maps) {
  const entities = {};
  const triples = [];

  // Create mock users learning from these maps
  const sampleUsers = [
    { id: "user_learner_1", name: "Alex (Student)" },
    { id: "user_learner_2", name: "Sam (Engineer)" },
  ];

  for (const u of sampleUsers) {
    entities[u.id] = { name: u.name, type: "user" };
  }

  for (const map of maps) {
    // Register skills as entities
    for (const skill of map.skills) {
      entities[skill.id] = {
        name: skill.name,
        type: "skill",
        category: skill.category,
      };

      // Add interactions for learners
      // Learner 1 knows beginner & intermediate skills
      if (skill.level === "beginner" || skill.level === "intermediate") {
        triples.push({
          head: "user_learner_1",
          relation: "interacts",
          tail: skill.id,
        });
      }
      // Learner 2 knows advanced & intermediate skills
      if (skill.level === "intermediate" || skill.level === "advanced") {
        triples.push({
          head: "user_learner_2",
          relation: "interacts",
          tail: skill.id,
        });
      }
    }

    // Register connections as graph triples
    for (const conn of map.connections) {
      triples.push({
        head: conn.sourceId,
        relation: conn.type,
        tail: conn.targetId,
      });
    }
  }

  return { entities, triples };
}

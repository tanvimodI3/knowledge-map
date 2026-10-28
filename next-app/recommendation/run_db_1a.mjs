import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PathFinder } from "./path_finder.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

// 1. Load environment variables via Next.js native env loader
try {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(appRoot);
} catch {
  // If @next/env is not available, rely on existing process.env
}

// 2. Initialise Firebase Admin
function getAdminDb() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else if (projectId) {
      initializeApp({ projectId });
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

/**
 * Fetch a specific map or automatically locate the first active map in Firestore.
 */
async function getMapFromDatabase(db, targetUid, targetMapId) {
  let uid = targetUid;
  let mapId = targetMapId;
  let mapData = null;

  if (uid && mapId) {
    const mapDoc = await db.doc(`users/${uid}/maps/${mapId}`).get();
    if (!mapDoc.exists || mapDoc.data()?.deletedAt !== null) {
      throw new Error(`Map ${mapId} for user ${uid} not found or deleted in Firestore.`);
    }
    mapData = { id: mapDoc.id, ...mapDoc.data() };
  } else {
    console.log(`[1A DB Runner] Searching Firestore for available user maps...`);
    // Query users collection
    const usersSnap = await db.collection("users").limit(10).get();
    for (const uDoc of usersSnap.docs) {
      const mapsSnap = await db
        .collection(`users/${uDoc.id}/maps`)
        .where("deletedAt", "==", null)
        .limit(1)
        .get();

      if (!mapsSnap.empty) {
        uid = uDoc.id;
        const mDoc = mapsSnap.docs[0];
        mapId = mDoc.id;
        mapData = { id: mDoc.id, ...mDoc.data() };
        break;
      }
    }
  }

  if (!mapData || !uid || !mapId) {
    throw new Error(
      `No active maps found in Firestore.\n` +
      `Create a map in the web application first, or specify: node recommendation/run_db_1a.mjs <uid> <mapId>`
    );
  }

  // Fetch skills and connections subcollections
  const [skillsSnap, connsSnap, userSnap] = await Promise.all([
    db.collection(`users/${uid}/maps/${mapId}/skills`).get(),
    db.collection(`users/${uid}/maps/${mapId}/connections`).get(),
    db.doc(`users/${uid}`).get(),
  ]);

  const userName = userSnap.exists
    ? userSnap.data()?.displayName || userSnap.data()?.name || "Student"
    : "Student";

  return {
    uid,
    userName,
    mapId,
    title: mapData.title || "Untitled Map",
    skills: skillsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    connections: connsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

/**
 * Build graph { entities, triples } from Firestore map data
 */
function buildGraph(mapInfo) {
  const userId = `u_${mapInfo.uid}`;
  const entities = {
    [userId]: { name: mapInfo.userName, type: "user" },
  };
  const triples = [];

  // Register skills and add (user -> interacts -> skill)
  for (const s of mapInfo.skills) {
    entities[s.id] = {
      name: s.name,
      type: "skill",
      category: s.category || "General",
      level: s.level || "beginner",
    };

    triples.push({
      head: userId,
      relation: "interacts",
      tail: s.id,
    });
  }

  // Register connections
  for (const c of mapInfo.connections) {
    if (entities[c.sourceId] && entities[c.targetId]) {
      triples.push({
        head: c.sourceId,
        relation: c.type || "prerequisite",
        tail: c.targetId,
      });
    }
  }

  return { entities, triples };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const targetUid = args[0] || null;
  const targetMapId = args[1] || null;

  console.log("======================================================");
  console.log(" PART 1A: Database-Connected Path Discovery (BFS)");
  console.log("======================================================");

  try {
    const db = getAdminDb();
    const mapInfo = await getMapFromDatabase(db, targetUid, targetMapId);

    console.log(`[✓] Connected to Firestore map:`);
    console.log(`    User:  ${mapInfo.userName} (${mapInfo.uid})`);
    console.log(`    Map:   "${mapInfo.title}" (${mapInfo.mapId})`);
    console.log(`    Skills: ${mapInfo.skills.length} nodes`);
    console.log(`    Connections: ${mapInfo.connections.length} edges`);

    if (mapInfo.skills.length === 0) {
      console.log(`[!] Map has no skills yet. Add skills in the web UI first.`);
      return;
    }

    const graph = buildGraph(mapInfo);
    const finder = new PathFinder(graph, 3, 200);

    // Run discovery with 0.2 holdout for train/test split
    const { allPaths, testPairs, ruleFrequency } = finder.runDiscovery(0.2);

    // Save outputs into recommendation/ directory
    const rawPathsFile = path.join(__dirname, "raw_paths.json");
    const testPairsFile = path.join(__dirname, "test_pairs.json");

    fs.writeFileSync(rawPathsFile, JSON.stringify(allPaths, null, 2), "utf8");
    fs.writeFileSync(testPairsFile, JSON.stringify(testPairs, null, 2), "utf8");

    console.log(`\n[✓] Outputs successfully generated from Firestore data:`);
    console.log(`    → ${rawPathsFile} (${allPaths.length} discovered paths)`);
    console.log(`    → ${testPairsFile} (${testPairs.length} test pairs)`);

    // Top Rules
    console.log(`\nTop Discovered Rules:`);
    const sortedRules = [...ruleFrequency.entries()].sort((a, b) => b[1] - a[1]);
    sortedRules.slice(0, 5).forEach(([rule, count]) => {
      console.log(`  • ${count.toString().padStart(3, " ")} occurrences : ${rule}`);
    });

    // Sanity Check in plain English
    finder.printSanityCheck(allPaths, 10);

    console.log(`\n[Next Step] Teammates 1B and 1C can now run directly on raw_paths.json!`);
  } catch (err) {
    console.error(`\n[1A Error]:`, err.message || err);
    process.exit(1);
  }
}

main();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PART 1A: Rule Discovery & Path Finding (Wu et al., 2022, Sec 3.1.1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Implements all specifications from the team leader's Part 1A document:
 * 1. Adjacency list with forward (r) and inverse (r⁻¹) relations.
 * 2. Extraction of all (user, item) interacts pairs.
 * 3. 80/20 train/test holdout split (saving test_pairs.json).
 * 4. Depth-limited BFS (max_depth = 3) on the train graph to find simple paths.
 * 5. Formatting each path: { user, item, nodes: [...], relations: [...] }.
 * 6. Path capping (max 200 paths per pair) to avoid combinatorial explosion.
 * 7. Sanity check: prints 10 random paths in plain English.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class PathFinder {
  /**
   * @param {Object} graph
   * @param {number} maxDepth
   * @param {number} maxPathsPerPair
   */
  constructor(graph, maxDepth = 3, maxPathsPerPair = 200) {
    this.graph = graph;
    this.adj = new Map();
    this.maxDepth = maxDepth;
    this.maxPathsPerPair = maxPathsPerPair;
  }

  /**
   * Step 1 & 2: Build adjacency list and find all (user, item) interacts pairs.
   * Step 3: Hold out 20% random test edges into test_pairs.json.
   */
  prepareGraph(holdoutRatio = 0.2, randomSeed = 42) {
    // 1. Identify all direct interacts triples
    const allInteractions = [];
    for (const triple of this.graph.triples) {
      if (triple.relation === "interacts") {
        allInteractions.push({ user: triple.head, item: triple.tail });
      }
    }

    // 2. Pseudo-random shuffle with fixed seed for reproducibility
    const shuffled = [...allInteractions];
    let seed = randomSeed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const testCount = Math.max(1, Math.round(shuffled.length * holdoutRatio));
    const testPairs = shuffled.slice(0, testCount);
    const trainPairs = shuffled.slice(testCount);

    const testSet = new Set(testPairs.map((p) => `${p.user}__interacts__${p.item}`));

    // 3. Build Adjacency List for the TRAIN graph (held-out test edges removed)
    this.adj.clear();
    for (const id of Object.keys(this.graph.entities)) {
      this.adj.set(id, []);
    }

    for (const triple of this.graph.triples) {
      const key = `${triple.head}__${triple.relation}__${triple.tail}`;
      // Skip held-out test edges
      if (testSet.has(key)) {
        continue;
      }

      const isInteracts = triple.relation === "interacts";

      if (!this.adj.has(triple.head)) this.adj.set(triple.head, []);
      if (!this.adj.has(triple.tail)) this.adj.set(triple.tail, []);

      // Forward edge: head -> tail with relation r
      this.adj.get(triple.head).push({
        target: triple.tail,
        relation: triple.relation,
        isDirectInteracts: isInteracts,
      });

      // Reverse edge: tail -> head with inverse relation r⁻¹
      this.adj.get(triple.tail).push({
        target: triple.head,
        relation: `${triple.relation}⁻¹`,
        isDirectInteracts: isInteracts,
      });
    }

    return { trainPairs, testPairs };
  }

  /**
   * Step 4: BFS to find all simple paths between user and item up to maxDepth hops.
   * Skips the direct (user, interacts, item) edge so the path explains the connection.
   */
  findPathsBetween(user, item) {
    const paths = [];

    // State in BFS queue: [currentNode, visitedSet, pathNodes, pathRelations]
    const queue = [
      {
        node: user,
        visited: new Set([user]),
        nodes: [user],
        relations: [],
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      // Reached target item (length must be >= 1 relation)
      if (current.node === item && current.relations.length > 0) {
        paths.push({
          user,
          item,
          nodes: current.nodes,
          relations: current.relations,
        });

        if (paths.length >= this.maxPathsPerPair) {
          break; // Cap to prevent path explosion on dense nodes
        }
        continue;
      }

      // If at depth limit, stop expanding
      if (current.relations.length >= this.maxDepth) {
        continue;
      }

      const neighbors = this.adj.get(current.node) || [];
      for (const edge of neighbors) {
        // Skip direct interacts edge between this user and this target item
        if (
          current.node === user &&
          edge.target === item &&
          edge.isDirectInteracts
        ) {
          continue;
        }

        // Avoid cycles (simple paths only)
        if (!current.visited.has(edge.target)) {
          const nextVisited = new Set(current.visited);
          nextVisited.add(edge.target);

          queue.push({
            node: edge.target,
            visited: nextVisited,
            nodes: [...current.nodes, edge.target],
            relations: [...current.relations, edge.relation],
          });
        }
      }
    }

    return paths;
  }

  /**
   * Run full path discovery across all training pairs.
   */
  runDiscovery(holdoutRatio = 0.2) {
    const { trainPairs, testPairs } = this.prepareGraph(holdoutRatio);
    console.log(`\n======================================================`);
    console.log(`[Part 1A] Running Path Discovery (Wu et al. 2022, Sec 3.1.1)`);
    console.log(`======================================================`);
    console.log(`• Total Entities: ${Object.keys(this.graph.entities).length}`);
    console.log(`• Total Triples:  ${this.graph.triples.length}`);
    console.log(`• Train Pairs:    ${trainPairs.length}`);
    console.log(`• Held-out Test:  ${testPairs.length} (saved to test_pairs.json)`);
    console.log(`• Max Depth:      ${this.maxDepth} hops`);
    console.log(`• Max Paths/Pair: ${this.maxPathsPerPair}`);

    const allPaths = [];
    const ruleFrequency = new Map();

    for (const pair of trainPairs) {
      const paths = this.findPathsBetween(pair.user, pair.item);
      allPaths.push(...paths);

      for (const p of paths) {
        const ruleKey = p.relations.join(" ∧ ");
        ruleFrequency.set(ruleKey, (ruleFrequency.get(ruleKey) || 0) + 1);
      }
    }

    console.log(`\n• Discovered ${allPaths.length} total raw paths.`);
    console.log(`• Discovered ${ruleFrequency.size} distinct rules.`);

    return { allPaths, testPairs, ruleFrequency };
  }

  /**
   * Step 6: Print 10 random paths in plain English for human sanity check.
   */
  printSanityCheck(paths, sampleSize = 10) {
    console.log(`\n------------------------------------------------------`);
    console.log(`[Step 6 Sanity Check] Sample Discovered Paths in Plain English:`);
    console.log(`------------------------------------------------------`);

    if (paths.length === 0) {
      console.log(`No multi-hop paths found. Check graph connectivity.`);
      return;
    }

    const shuffled = [...paths].sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, Math.min(sampleSize, paths.length));

    samples.forEach((p, idx) => {
      const readableSegments = [];
      for (let i = 0; i < p.relations.length; i++) {
        const fromNode = this.graph.entities[p.nodes[i]]?.name || p.nodes[i];
        const toNode = this.graph.entities[p.nodes[i + 1]]?.name || p.nodes[i + 1];
        const rel = p.relations[i];
        readableSegments.push(`${fromNode} ──[ ${rel} ]──► ${toNode}`);
      }
      console.log(`Path #${idx + 1}:`);
      console.log(`  Rule: [${p.relations.join(" ∧ ")}]`);
      console.log(`  English: ${readableSegments.join("  ")}\n`);
    });
  }
}

/**
 * Runner CLI execution
 */
export function executePart1A(inputGraphPath, outputDir) {
  const resolvedGraphPath =
    inputGraphPath || path.join(__dirname, "sample_graph.json");
  const targetDir = outputDir || __dirname;

  if (!fs.existsSync(resolvedGraphPath)) {
    throw new Error(`Input graph file not found at: ${resolvedGraphPath}`);
  }

  const rawData = fs.readFileSync(resolvedGraphPath, "utf8");
  const graph = JSON.parse(rawData);

  const finder = new PathFinder(graph, 3, 200);
  const { allPaths, testPairs, ruleFrequency } = finder.runDiscovery(0.2);

  // Write outputs exactly as requested
  const rawPathsFile = path.join(targetDir, "raw_paths.json");
  const testPairsFile = path.join(targetDir, "test_pairs.json");

  fs.writeFileSync(rawPathsFile, JSON.stringify(allPaths, null, 2), "utf8");
  fs.writeFileSync(testPairsFile, JSON.stringify(testPairs, null, 2), "utf8");

  console.log(`[✓] Output files successfully written:`);
  console.log(`    → ${rawPathsFile} (${allPaths.length} paths)`);
  console.log(`    → ${testPairsFile} (${testPairs.length} test pairs)`);

  // Top Rules Summary
  console.log(`\nTop Discovered Rules:`);
  const sortedRules = [...ruleFrequency.entries()].sort((a, b) => b[1] - a[1]);
  sortedRules.slice(0, 5).forEach(([rule, count]) => {
    console.log(`  • ${count.toString().padStart(3, " ")} occurrences : ${rule}`);
  });

  // Run Sanity Check
  finder.printSanityCheck(allPaths, 10);

  return { allPaths, testPairs };
}

// Run CLI
executePart1A();

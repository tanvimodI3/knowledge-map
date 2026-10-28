import { spawn } from "node:child_process"
import path from "node:path"

export interface RankedPath {
  id: string
  user: string
  item: string
  nodes: string[]
  relations: string[]
  ruleKey: string
  score: number
}

export interface RecommendationSummary {
  rawPathCount: number
  filteredPathCount: number
  selectedFilter: "chi_square" | "frequency"
  selectedRuleCount: number
  rankedPathCount: number
}

interface PipelineResult {
  options: RankedPath[]
  summary: RecommendationSummary
}

export interface RecommendationInput {
  paths: Array<{
    user: string
    item: string
    nodes: string[]
    relations: string[]
  }>
  testPairs: Array<{ user: string; item: string }>
  graph: {
    entities: Record<
      string,
      { name: string; type: string; category?: string; level?: string }
    >
    triples: Array<{ head: string; relation: string; tail: string }>
  }
}

export function generateRankedPaths(
  input: RecommendationInput
): Promise<PipelineResult> {
  const executable = process.env.PYTHON_EXECUTABLE || "python"
  const scriptPath = path.join(
    process.cwd(),
    "recommendation",
    "live_path_recommendations.py"
  )

  return new Promise((resolve, reject) => {
    const process = spawn(executable, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    process.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
    process.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))
    process.on("error", reject)
    process.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Path scoring process failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`
          )
        )
        return
      }

      try {
        resolve(
          JSON.parse(Buffer.concat(stdout).toString("utf8")) as PipelineResult
        )
      } catch (error) {
        reject(
          new Error("Path scoring process returned invalid JSON.", {
            cause: error,
          })
        )
      }
    })

    process.stdin.on("error", reject)
    process.stdin.end(JSON.stringify(input))
  })
}

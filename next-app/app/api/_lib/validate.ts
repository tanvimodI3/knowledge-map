import type {
    RelationChoice,
    RelationType,
    SkillLevel,
} from "@/lib/knowledge-map/types";

/* ── allowed values ───────────────────────────────────────────────── */

const VALID_LEVELS: readonly SkillLevel[] = [
    "beginner",
    "intermediate",
    "advanced",
];

const VALID_CONNECTION_TYPES: readonly RelationType[] = [
    "prerequisite",
    "related",
];

const VALID_CHOICES: readonly RelationChoice[] = [
    "needs",
    "leads-to",
    "related",
];

/* ── type guards ──────────────────────────────────────────────────── */

export function isValidLevel(v: unknown): v is SkillLevel {
    return typeof v === "string" && VALID_LEVELS.includes(v as SkillLevel);
}

export function isValidConnectionType(v: unknown): v is RelationType {
    return (
        typeof v === "string" &&
        VALID_CONNECTION_TYPES.includes(v as RelationType)
    );
}

export function isValidChoice(v: unknown): v is RelationChoice {
    return typeof v === "string" && VALID_CHOICES.includes(v as RelationChoice);
}

export function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

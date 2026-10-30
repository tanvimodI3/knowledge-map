import { adminDb } from "@/lib/firebase-admin";
import { verifyRequest } from "@/lib/auth-helpers";
import { Timestamp } from "firebase-admin/firestore";
import { errorResponse } from "@/app/api/_lib/errors";
import {
  isNonEmptyString,
  isValidChoice,
  isValidLevel,
} from "@/app/api/_lib/validate";
import { logActivity } from "@/app/api/_lib/activity";
import { mapRef } from "@/app/api/_lib/firestore-helpers";
import type {
  Connection,
  RelationChoice,
  Skill,
} from "@/lib/knowledge-map/types";

type Params = { params: Promise<{ mapId: string }> };

/**
 * Convert a UI choice ("needs" / "leads-to" / "related") into directed edge fields.
 *
 * Same logic as the client-side `choiceToEdge` in utils.ts, but re-implemented
 * here so the server doesn't import client code.
 */
function choiceToEdge(
  choice: RelationChoice,
  newSkillId: string,
  existingSkillId: string,
): { sourceId: string; targetId: string; type: Connection["type"] } {
  switch (choice) {
    case "needs":
      // existing skill is the prerequisite OF the new skill
      return {
        sourceId: existingSkillId,
        targetId: newSkillId,
        type: "prerequisite",
      };
    case "leads-to":
      // new skill is the prerequisite OF the existing skill
      return {
        sourceId: newSkillId,
        targetId: existingSkillId,
        type: "prerequisite",
      };
    default:
      return {
        sourceId: newSkillId,
        targetId: existingSkillId,
        type: "related",
      };
  }
}

/* ──────────── POST /api/maps/{mapId}/skills ──────────────────── */

export async function POST(request: Request, { params }: Params) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing token");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_INPUT", "Request body must be JSON");
  }

  const { name, category, level, links } = body as Record<string, unknown>;

  // ── validate scalar fields ──
  if (!isNonEmptyString(name)) {
    return errorResponse(400, "INVALID_INPUT", "Skill name is required");
  }
  if (!isNonEmptyString(category)) {
    return errorResponse(400, "INVALID_INPUT", "Category is required");
  }
  if (!isValidLevel(level)) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      "Level must be beginner, intermediate, or advanced",
    );
  }

  // ── validate links array ──
  const parsedLinks: { skillId: string; choice: RelationChoice }[] = [];

  if (links !== undefined) {
    if (!Array.isArray(links)) {
      return errorResponse(400, "INVALID_INPUT", "Links must be an array");
    }
    for (const link of links) {
      if (
        !link ||
        typeof link !== "object" ||
        !isNonEmptyString((link as Record<string, unknown>).skillId) ||
        !isValidChoice((link as Record<string, unknown>).choice)
      ) {
        return errorResponse(
          400,
          "INVALID_INPUT",
          "Each link needs a valid skillId and choice (needs, leads-to, or related)",
        );
      }
      parsedLinks.push({
        skillId: (link as Record<string, unknown>).skillId as string,
        choice: (link as Record<string, unknown>).choice as RelationChoice,
      });
    }
  }

  const uid = decoded.uid;
  const { mapId } = await params;
  const mRef = mapRef(uid, mapId);

  try {
    // ── verify map exists and is not deleted ──
    const mapSnap = await mRef.get();
    if (!mapSnap.exists || mapSnap.data()?.deletedAt) {
      return errorResponse(404, "NOT_FOUND", "Map not found");
    }

    // ── verify every linked skill exists in this map ──
    if (parsedLinks.length > 0) {
      const skillsCol = mRef.collection("skills");
      for (const link of parsedLinks) {
        const linkedSkill = await skillsCol.doc(link.skillId).get();
        if (!linkedSkill.exists) {
          return errorResponse(
            400,
            "INVALID_INPUT",
            `Linked skill ${link.skillId} does not exist in this map`,
          );
        }
      }
    }

    // ── atomic batch: create skill + connections + update map ──
    const batch = adminDb.batch();
    const now = Timestamp.now();

    // Create the skill document (auto-generate ID).
    const skillRef = mRef.collection("skills").doc();
    batch.set(skillRef, {
      name: (name as string).trim(),
      category: (category as string).trim(),
      level,
      createdAt: now,
    });

    // Create connection documents from links.
    const connections: Connection[] = [];
    for (const link of parsedLinks) {
      const connRef = mRef.collection("connections").doc();
      const edge = choiceToEdge(link.choice, skillRef.id, link.skillId);
      batch.set(connRef, { ...edge, createdAt: now });
      connections.push({ id: connRef.id, ...edge });
    }

    // Bump the parent map's updatedAt.
    batch.update(mRef, { updatedAt: now });

    // Commit — all-or-nothing.
    await batch.commit();

    // ── log activity after success ──
    const trimmedName = (name as string).trim();
    const msg =
      parsedLinks.length > 0
        ? `Added ${trimmedName} with ${parsedLinks.length} connection${parsedLinks.length > 1 ? "s" : ""}`
        : `Added ${trimmedName}`;
    await logActivity(uid, mapId, msg);

    // ── response ──
    const skill: Skill = {
      id: skillRef.id,
      name: trimmedName,
      category: (category as string).trim(),
      level: level as Skill["level"],
    };

    return Response.json({ skill, connections }, { status: 201 });
  } catch (err) {
    console.error("POST /api/maps/[mapId]/skills error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to create skill");
  }
}

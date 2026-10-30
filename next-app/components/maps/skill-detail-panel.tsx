"use client";

import { useMemo, useState } from "react";
import { Link2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useMaps } from "@/context/maps-context";
import type { KnowledgeMap, RelationChoice, Skill } from "@/lib/knowledge-map/types";
import { areConnected } from "@/lib/knowledge-map/utils";
import { ConnectionPicker } from "./connection-picker";

interface Props {
  map: KnowledgeMap;
  skill: Skill;
  onSelect: (id: string | null) => void;
}

// Shown in place of the skill list when a node is selected: its links, and a way
// to add more connections to an EXISTING skill.
export function SkillDetailPanel({ map, skill, onSelect }: Props) {
  const { removeConnection, removeSkill } = useMaps();
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Group this skill's connections by how they relate to it.
  const groups = useMemo(() => {
    const byId = new Map(map.skills.map((s) => [s.id, s]));
    const result: Record<"Needs first" | "Leads to" | "Related", { id: string; other: Skill }[]> = {
      "Needs first": [],
      "Leads to": [],
      Related: [],
    };
    for (const c of map.connections) {
      if (c.sourceId !== skill.id && c.targetId !== skill.id) continue;
      const other = byId.get(c.sourceId === skill.id ? c.targetId : c.sourceId);
      if (!other) continue;
      const key =
        c.type === "related" ? "Related" : c.targetId === skill.id ? "Needs first" : "Leads to";
      result[key].push({ id: c.id, other });
    }
    return result;
  }, [map.connections, map.skills, skill.id]);

  const total = Object.values(groups).reduce((n, g) => n + g.length, 0);

  async function handleRemoveConnection(id: string) {
    try {
      await removeConnection(map.id, id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove connection.");
    }
  }

  async function handleRemoveSkill() {
    if (!confirmingDelete) {
      setConfirmingDelete(true); // two-step confirm instead of a modal
      return;
    }
    try {
      await removeSkill(map.id, skill.id);
      onSelect(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove skill.");
      setConfirmingDelete(false);
    }
  }

  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-start justify-between gap-2 p-4">
          <div className="space-y-2">
            <CardTitle className="text-base">{skill.name}</CardTitle>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{skill.category}</Badge>
              <Badge variant="outline" className="capitalize">
                {skill.level}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Back to all skills" onClick={() => onSelect(null)}>
            <X className="size-4" />
          </Button>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <CardDescription>
              {total} connection{total === 1 ? "" : "s"}
            </CardDescription>
            <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
              <Link2 className="size-3.5" />
              Connect
            </Button>
          </div>

          {total === 0 && (
            <p className="text-sm text-muted-foreground">
              Not connected to anything yet. Use Connect to link it to other skills.
            </p>
          )}

          {(Object.keys(groups) as (keyof typeof groups)[]).map(
            (label) =>
              groups[label].length > 0 && (
                <div key={label} className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <ul className="space-y-1">
                    {groups[label].map(({ id, other }) => (
                      <li key={id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
                        <button
                          type="button"
                          className="text-sm underline-offset-4 hover:underline"
                          onClick={() => onSelect(other.id)}
                        >
                          {other.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label={`Remove connection to ${other.name}`}
                          onClick={() => handleRemoveConnection(id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}

          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleRemoveSkill}
            onBlur={() => setConfirmingDelete(false)}
          >
            {confirmingDelete ? "Click again to confirm" : "Remove skill"}
          </Button>
        </CardContent>
      </Card>

      <ConnectSkillDialog map={map} skill={skill} open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}

// Link an existing skill to others that it isn't connected to yet.
function ConnectSkillDialog({
  map,
  skill,
  open,
  onOpenChange,
}: Omit<Props, "onSelect"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addConnection } = useMaps();
  const [links, setLinks] = useState<Record<string, RelationChoice>>({});

  const candidates = map.skills.filter(
    (s) => s.id !== skill.id && !areConnected(map.connections, skill.id, s.id),
  );
  const suggestedIds = new Set(
    candidates
      .filter((s) => s.category.toLowerCase() === skill.category.toLowerCase())
      .map((s) => s.id),
  );

  function handleOpenChange(next: boolean) {
    if (!next) setLinks({});
    onOpenChange(next);
  }

  async function handleSubmit() {
    const entries = Object.entries(links);
    try {
      await Promise.all(
        entries.map(([otherId, choice]) =>
          addConnection(map.id, skill.id, otherId, choice),
        ),
      );
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create connections.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect “{skill.name}”</DialogTitle>
          <DialogDescription>Link it to other skills in this map.</DialogDescription>
        </DialogHeader>

        <ConnectionPicker
          subject={skill.name}
          candidates={candidates}
          value={links}
          onChange={setLinks}
          suggestedIds={suggestedIds}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={Object.keys(links).length === 0}>
            Add connections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

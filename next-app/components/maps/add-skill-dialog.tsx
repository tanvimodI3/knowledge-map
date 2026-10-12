"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMaps } from "@/context/maps-context";
import {
  LEVELS,
  type KnowledgeMap,
  type RelationChoice,
  type SkillLevel,
} from "@/lib/knowledge-map/types";
import { ConnectionPicker } from "./connection-picker";

interface Props {
  map: KnowledgeMap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new skill's id so the page can select it. */
  onAdded?: (skillId: string) => void;
}

// Add a skill AND choose its connections to existing skills in one step.
export function AddSkillDialog({ map, open, onOpenChange, onAdded }: Props) {
  const { addSkill } = useMaps();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<SkillLevel>("beginner");
  const [links, setLinks] = useState<Record<string, RelationChoice>>({});
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(map.skills.map((s) => s.category))], [map.skills]);

  // Flag existing skills in the same category as likely connections.
  const suggestedIds = useMemo(() => {
    const c = category.trim().toLowerCase();
    return new Set(
      c ? map.skills.filter((s) => s.category.toLowerCase() === c).map((s) => s.id) : [],
    );
  }, [category, map.skills]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setCategory("");
      setLevel("beginner");
      setLinks({});
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (map.skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("This map already has a skill with that name.");
      return;
    }

    try {
      const skill = await addSkill(
        map.id,
        { name: trimmed, category: category.trim() || "General", level },
        Object.entries(links).map(([skillId, choice]) => ({ skillId, choice })),
      );

      toast.success(`Added “${skill.name}”`);
      onAdded?.(skill.id);
      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add skill";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a skill</DialogTitle>
            <DialogDescription>
              Add it to “{map.title}”, then link it to the skills it relates to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="skill-name">Skill</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Transformers"
              autoFocus
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-category">Category</Label>
            <Input
              id="skill-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Deep Learning"
            />
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={category === c ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Level</Label>
            <div className="flex gap-1.5">
              {LEVELS.map((l) => (
                <Button
                  key={l.value}
                  type="button"
                  size="sm"
                  variant={level === l.value ? "default" : "outline"}
                  onClick={() => setLevel(l.value)}
                >
                  {l.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Connections</Label>
            <ConnectionPicker
              subject={name.trim()}
              candidates={map.skills}
              value={links}
              onChange={setLinks}
              suggestedIds={suggestedIds}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add skill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RELATION_CHOICES, type RelationChoice, type Skill } from "@/lib/knowledge-map/types";

interface Props {
  /** Name of the skill being added / edited (used in the helper text). */
  subject: string;
  /** Existing skills it could be linked to. */
  candidates: Skill[];
  /** skillId → how `subject` relates to it. Only checked skills are in here. */
  value: Record<string, RelationChoice>;
  onChange: (value: Record<string, RelationChoice>) => void;
  /** Skills to flag as "Suggested" (e.g. same category). */
  suggestedIds?: Set<string>;
}

// Shared by "Add skill" and "Connect skill": tick the skills to link to,
// then say how they relate. Purely presentational — the parent owns the state.
export function ConnectionPicker({ subject, candidates, value, onChange, suggestedIds }: Props) {
  if (candidates.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No other skills to connect to yet.
      </p>
    );
  }

  function toggle(id: string, checked: boolean) {
    const next = { ...value };
    if (checked) next[id] = next[id] ?? "related";
    else delete next[id];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Tick the skills that connect to{" "}
        <span className="font-medium text-foreground">{subject || "this skill"}</span>, then
        choose how.
      </p>
      <ScrollArea className="h-56 rounded-md border">
        <ul className="divide-y">
          {candidates.map((s) => {
            const choice = value[s.id];
            return (
              <li key={s.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`cp-${s.id}`}
                    checked={choice !== undefined}
                    onCheckedChange={(checked) => toggle(s.id, checked === true)}
                  />
                  <Label htmlFor={`cp-${s.id}`} className="flex-1 cursor-pointer font-normal">
                    {s.name}
                  </Label>
                  {suggestedIds?.has(s.id) && <Badge variant="secondary">Suggested</Badge>}
                  <span className="text-xs text-muted-foreground">{s.category}</span>
                </div>
                {choice && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {RELATION_CHOICES.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={choice === opt.value ? "default" : "outline"}
                        className="h-7 px-2.5 text-xs"
                        onClick={() => onChange({ ...value, [s.id]: opt.value })}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}

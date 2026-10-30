"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMaps } from "@/context/maps-context";
import type { KnowledgeMap } from "@/lib/knowledge-map/types";
import { layoutSkills, relativeTime } from "@/lib/knowledge-map/utils";
import { cn } from "@/lib/utils";

// Tiny thumbnail of the map's structure, drawn with the same layout as the full graph.
function MiniGraph({ map }: { map: KnowledgeMap }) {
  const W = 240;
  const H = 110;
  const pos = layoutSkills(map.skills, W, H, 22);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" aria-hidden="true">
      {map.connections.map((c) => {
        const a = pos[c.sourceId];
        const b = pos[c.targetId];
        if (!a || !b) return null;
        return (
          <line
            key={c.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeWidth={1}
            strokeDasharray={c.type === "related" ? "3 3" : undefined}
            className="stroke-foreground/20"
          />
        );
      })}
      {map.skills.map((s) => (
        <circle
          key={s.id}
          cx={pos[s.id].x}
          cy={pos[s.id].y}
          r={3.5}
          strokeWidth={1}
          className="fill-background stroke-foreground/60"
        />
      ))}
      {map.skills.length === 0 && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          Empty map
        </text>
      )}
    </svg>
  );
}

export function MapCard({ map }: { map: KnowledgeMap }) {
  const router = useRouter();
  const { deleteMap, restoreMap } = useMaps();

  async function handleDelete() {
    try {
      const removed = await deleteMap(map.id);
      toast(`Deleted “${removed.title}”`, {
        action: {
          label: "Undo",
          onClick: () => {
            void restoreMap(removed)
              .then((restored) => toast.success(`Restored “${restored.title}”`))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to restore map."));
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete map.");
    }
  }

  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/30">
      <Link href={`/dashboard/maps/${map.id}`} className="block">
        <div className="border-b bg-muted/30">
          <MiniGraph map={map} />
        </div>
        <div className="space-y-1 p-4">
          <h3 className="truncate pr-6 text-sm font-medium">{map.title}</h3>
          <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
            {map.description || "No description yet."}
          </p>
          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <span>{map.skills.length} skills</span>
            <span>{map.connections.length} links</span>
            <span className="ml-auto">{relativeTime(map.updatedAt)}</span>
          </div>
        </div>
      </Link>

      {/* Sits above the link so clicking it doesn't navigate. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Map options"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute right-2 top-2 size-8 bg-background/70",
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/dashboard/maps/${map.id}`)}>
            <ArrowUpRight className="size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

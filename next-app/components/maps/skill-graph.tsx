"use client";

import { useState } from "react";

import type { Connection, Skill, SkillLevel } from "@/lib/knowledge-map/types";
import { layoutSkills } from "@/lib/knowledge-map/utils";
import { cn } from "@/lib/utils";

const W = 640;
const H = 460;
// Node size encodes proficiency.
const RADIUS: Record<SkillLevel, number> = { beginner: 6, intermediate: 8, advanced: 10 };

interface Props {
  skills: Skill[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// Pure SVG graph (no extra deps). Hover or select a skill to highlight its links.
// BACKEND/LATER: to let users drag nodes, store x/y per skill and read them here
// instead of calling layoutSkills().
export function SkillGraph({ skills, connections, selectedId, onSelect }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const focusId = hoverId ?? selectedId;
  const pos = layoutSkills(skills, W, H, 70);
  const byId = new Map(skills.map((s) => [s.id, s]));

  const touchesFocus = (c: Connection) =>
    focusId !== null && (c.sourceId === focusId || c.targetId === focusId);
  const neighbours = new Set(
    connections.filter(touchesFocus).flatMap((c) => [c.sourceId, c.targetId]),
  );

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto min-h-[360px] w-full"
        preserveAspectRatio="xMidYMid meet"
        onClick={() => onSelect(null)} // clicking empty space clears the selection
      >
        <defs>
          <marker id="kg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0L10 5L0 10z" className="fill-foreground/40" />
          </marker>
          <marker id="kg-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0L10 5L0 10z" className="fill-primary" />
          </marker>
        </defs>

        {connections.map((c) => {
          const a = pos[c.sourceId];
          const b = pos[c.targetId];
          const target = byId.get(c.targetId);
          if (!a || !b || !target) return null;

          // Stop the arrow at the edge of the target node instead of its centre.
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pad = c.type === "prerequisite" ? RADIUS[target.level] + 6 : 0;
          const active = touchesFocus(c);
          const dim = focusId !== null && !active;

          return (
            <line
              key={c.id}
              x1={a.x}
              y1={a.y}
              x2={b.x - (dx / dist) * pad}
              y2={b.y - (dy / dist) * pad}
              strokeWidth={active ? 1.75 : 1}
              strokeDasharray={c.type === "related" ? "4 4" : undefined}
              markerEnd={
                c.type === "prerequisite"
                  ? active
                    ? "url(#kg-arrow-active)"
                    : "url(#kg-arrow)"
                  : undefined
              }
              className={cn(
                "transition-[stroke,opacity] duration-200",
                active ? "stroke-primary" : "stroke-foreground/25",
                dim && "opacity-30",
              )}
            />
          );
        })}

        {skills.map((s) => {
          const p = pos[s.id];
          const r = RADIUS[s.level];
          const selected = s.id === selectedId;
          const dim = focusId !== null && s.id !== focusId && !neighbours.has(s.id);

          return (
            <g
              key={s.id}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${s.name}, ${s.level}`}
              className="cursor-pointer"
              style={{ opacity: dim ? 0.35 : 1, transition: "opacity 200ms" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(s.id)}
              onBlur={() => setHoverId(null)}
            >
              {/* Inner group carries the one-time pop-in animation for new nodes. */}
              <g className="kg-node">
                <circle
                  r={r}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-colors",
                    selected ? "fill-primary stroke-primary" : "fill-background stroke-foreground/70",
                  )}
                />
                <text
                  y={r + 14}
                  textAnchor="middle"
                  className="select-none fill-foreground text-[11px]"
                >
                  {s.name.length > 22 ? `${s.name.slice(0, 19)}…` : s.name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
        <span>→ Prerequisite (learn first)</span>
        <span>- - Related</span>
        <span>Bigger dot = higher level</span>
      </div>

      <style>{`
        .kg-node { transform-box: fill-box; transform-origin: center; animation: kg-pop 450ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes kg-pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .kg-node { animation: none; } }
      `}</style>
    </div>
  );
}

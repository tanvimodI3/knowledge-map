"use client";

import { useState } from "react";

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
};

type Edge = {
  from: string;
  to: string;
};

const NODES: Node[] = [
  { id: "sources", label: "Sources", x: 90, y: 120, r: 5 },
  { id: "papers", label: "Papers", x: 70, y: 280, r: 6 },
  { id: "notes", label: "Notes", x: 260, y: 90, r: 9 },
  { id: "concepts", label: "Concepts", x: 300, y: 260, r: 11 },
  { id: "questions", label: "Open questions", x: 470, y: 150, r: 6 },
  { id: "projects", label: "Projects", x: 420, y: 330, r: 8 },
  { id: "people", label: "People", x: 190, y: 400, r: 5 },
  { id: "experiments", label: "Experiments", x: 500, y: 420, r: 6 },
  { id: "definitions", label: "Definitions", x: 150, y: 230, r: 4 },
];

const EDGES: Edge[] = [
  { from: "sources", to: "notes" },
  { from: "sources", to: "papers" },
  { from: "papers", to: "concepts" },
  { from: "papers", to: "definitions" },
  { from: "notes", to: "concepts" },
  { from: "notes", to: "definitions" },
  { from: "concepts", to: "questions" },
  { from: "concepts", to: "projects" },
  { from: "concepts", to: "people" },
  { from: "questions", to: "projects" },
  { from: "projects", to: "experiments" },
  { from: "people", to: "definitions" },
];

const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));

function edgeLength(edge: Edge) {
  const a = nodeById[edge.from];
  const b = nodeById[edge.to];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function KnowledgeGraph() {
  const [active, setActive] = useState<string | null>(null);

  const connected = new Set(
    active
      ? EDGES.filter((e) => e.from === active || e.to === active).flatMap(
          (e) => [e.from, e.to],
        )
      : [],
  );

  return (
    <div className="relative aspect-square w-full">
      <svg
        viewBox="0 0 560 480"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {EDGES.map((edge, i) => {
          const a = nodeById[edge.from];
          const b = nodeById[edge.to];
          const len = edgeLength(edge);
          const dimmed = active && !connected.has(edge.from + edge.to);
          const highlighted =
            active && (edge.from === active || edge.to === active);
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={highlighted ? "#2A4B7C" : "#1B1D23"}
              strokeOpacity={dimmed ? 0.08 : highlighted ? 0.55 : 0.18}
              strokeWidth={highlighted ? 1.5 : 1}
              strokeLinecap="round"
              style={
                {
                  strokeDasharray: len,
                  "--len": len,
                  animation: `kg-draw 900ms ease-out both`,
                  animationDelay: `${180 + i * 90}ms`,
                  transition: "stroke 200ms ease, stroke-opacity 200ms ease",
                } as React.CSSProperties
              }
            />
          );
        })}

        {NODES.map((node, i) => {
          const dimmed = active && !connected.has(node.id) && active !== node.id;
          const isActive = active === node.id;
          return (
            <g
              key={node.id}
              style={{
                transformOrigin: `${node.x}px ${node.y}px`,
                animation: `kg-pop 520ms cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: `${i * 90}ms`,
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r + (isActive ? 3 : 0)}
                fill={isActive ? "#2A4B7C" : "#FAFAF8"}
                stroke={isActive ? "#2A4B7C" : "#1B1D23"}
                strokeOpacity={dimmed ? 0.25 : 0.8}
                strokeWidth={1.25}
                className="cursor-pointer transition-all duration-200"
                style={{ opacity: dimmed ? 0.35 : 1 }}
                onMouseEnter={() => setActive(node.id)}
                onMouseLeave={() => setActive(null)}
              />
              <text
                x={node.x}
                y={node.y - node.r - 10}
                textAnchor="middle"
                className="select-none font-mono text-[10px] uppercase tracking-wide"
                fill="#1B1D23"
                style={{
                  opacity: isActive ? 1 : 0,
                  transition: "opacity 150ms ease",
                }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <style>{`
        @keyframes kg-draw {
          from { stroke-dashoffset: var(--len, 0); opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes kg-pop {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg line, svg g {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
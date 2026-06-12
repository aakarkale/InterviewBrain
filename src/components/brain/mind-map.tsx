"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import gsap from "gsap";

import type { GraphData, GraphNode, GraphState } from "@/lib/brain/types";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & {
  kind: "scored" | "tagged" | "pattern";
  state: GraphState;
  strength: number;
};

function radius(n: GraphNode): number {
  if (n.kind === "company") return 13 + n.weight;
  if (n.kind === "competency") return 7 + n.weight * 2;
  return 7;
}

function nodeFill(n: GraphNode): string {
  if (n.kind === "company") return "var(--color-primary)";
  if (n.kind === "story") return "var(--color-secondary)";
  if (n.state === "weakness") return "var(--color-destructive)";
  if (n.state === "strength") return "var(--color-success)";
  return "var(--color-muted-foreground)";
}

function edgeStroke(state: GraphState, kind: SimLink["kind"]): string {
  if (state === "weakness") return "var(--color-destructive)";
  if (state === "strength") return "var(--color-success)";
  if (kind === "pattern") return "var(--color-primary)";
  return "var(--color-border)";
}

export function MindMap({ data }: { data: GraphData }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Run the force simulation once per dataset: tick to a stable layout, then
  // render statically. Coordinates are arbitrary; the viewBox is fit to the
  // result so the graph always fills the frame regardless of node count.
  const layout = useMemo(() => {
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = data.edges.map((e) => ({ ...e }));

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "pattern" ? 95 : 72))
          .strength((l) => 0.25 + l.strength * 0.3)
      )
      .force("charge", forceManyBody().strength(-340))
      .force("center", forceCenter(0, 0))
      .force(
        "collide",
        forceCollide<SimNode>().radius((n) => radius(n) + 16)
      )
      .force("x", forceX(0).strength(0.06))
      .force("y", forceY(0).strength(0.06))
      .stop();

    for (let i = 0; i < 340; i++) sim.tick();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const r = radius(n) + 26; // label allowance
      minX = Math.min(minX, (n.x ?? 0) - r);
      minY = Math.min(minY, (n.y ?? 0) - r);
      maxX = Math.max(maxX, (n.x ?? 0) + r);
      maxY = Math.max(maxY, (n.y ?? 0) + r);
    }
    if (!Number.isFinite(minX)) {
      minX = -100;
      minY = -100;
      maxX = 100;
      maxY = 100;
    }

    const adjacency = new Map<string, Set<string>>();
    for (const l of links) {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      (adjacency.get(s) ?? adjacency.set(s, new Set()).get(s)!).add(t);
      (adjacency.get(t) ?? adjacency.set(t, new Set()).get(t)!).add(s);
    }

    return {
      nodes,
      links,
      adjacency,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [data]);

  // GSAP entrance — the reserved in-app motion moment. Skipped under
  // prefers-reduced-motion (elements render at their final state).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodeEls = svg.querySelectorAll<SVGGElement>("[data-node-inner]");
    const edgeEls = svg.querySelectorAll<SVGLineElement>("[data-edge]");
    if (reduce) {
      gsap.set([...nodeEls, ...edgeEls], { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(edgeEls, {
        opacity: 0,
        duration: 0.6,
        stagger: 0.012,
        delay: 0.15,
        ease: "power1.out",
      });
      gsap.from(nodeEls, {
        opacity: 0,
        scale: 0,
        transformOrigin: "center",
        duration: 0.7,
        stagger: 0.03,
        ease: "back.out(1.7)",
      });
    }, svg);
    return () => ctx.revert();
  }, [layout]);

  if (layout.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
        Your map grows as you practice and log rounds — companies, competencies,
        and stories connect here once the brain has signal.
      </div>
    );
  }

  const neighbors = hovered ? layout.adjacency.get(hovered) : null;
  const isDim = (id: string) =>
    hovered !== null && id !== hovered && !(neighbors?.has(id) ?? false);

  const hoveredNode = hovered
    ? layout.nodes.find((n) => n.id === hovered)
    : null;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border bg-card/40">
        <svg
          ref={svgRef}
          viewBox={layout.viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-[clamp(420px,60vh,680px)] w-full touch-none"
          role="img"
          aria-label="Mind-map of your applications, competencies, and stories"
        >
          <g>
            {layout.links.map((l, i) => {
              const s = l.source as SimNode;
              const t = l.target as SimNode;
              const active =
                hovered === null || hovered === s.id || hovered === t.id;
              return (
                <line
                  key={i}
                  data-edge
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={edgeStroke(l.state, l.kind)}
                  strokeWidth={l.kind === "pattern" ? 1 + l.strength * 1.6 : 1}
                  strokeLinecap="round"
                  strokeDasharray={l.kind === "tagged" ? "2 4" : undefined}
                  style={{
                    opacity: active ? 0.25 + l.strength * 0.5 : 0.06,
                    transition: "opacity 0.2s",
                  }}
                />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((n) => {
              const r = radius(n);
              const dim = isDim(n.id);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                  opacity={dim ? 0.25 : 1}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
                  onFocus={() => setHovered(n.id)}
                  onBlur={() => setHovered((h) => (h === n.id ? null : h))}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.kind}: ${n.label}`}
                >
                  <g data-node-inner>
                    {n.kind === "story" ? (
                      <rect
                        x={-r}
                        y={-r}
                        width={r * 2}
                        height={r * 2}
                        rx={4}
                        fill={nodeFill(n)}
                        stroke="var(--color-border-strong)"
                        strokeWidth={1}
                      />
                    ) : (
                      <circle
                        r={r}
                        fill={nodeFill(n)}
                        stroke={
                          n.kind === "company"
                            ? "var(--color-primary)"
                            : "var(--color-background)"
                        }
                        strokeWidth={n.kind === "company" ? 0 : 1.5}
                        fillOpacity={n.kind === "company" ? 0.9 : 0.95}
                      />
                    )}
                    <text
                      y={r + 11}
                      textAnchor="middle"
                      className="select-none"
                      style={{
                        fontSize: n.kind === "company" ? 11 : 9.5,
                        fontWeight: n.kind === "company" ? 600 : 500,
                        fill: "var(--color-foreground)",
                        paintOrder: "stroke",
                        stroke: "var(--color-background)",
                        strokeWidth: 3,
                        strokeLinejoin: "round",
                      }}
                    >
                      {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* detail / legend overlay */}
      <div className="pointer-events-none absolute top-3 left-3 max-w-xs">
        {hoveredNode ? (
          <div className="rounded-lg border bg-popover/95 p-3 text-xs shadow-sm backdrop-blur">
            <p className="font-medium">{hoveredNode.label}</p>
            <p className="mt-0.5 text-muted-foreground capitalize">
              {hoveredNode.kind}
              {hoveredNode.state !== "neutral" ? ` · ${hoveredNode.state}` : ""}
            </p>
            {hoveredNode.detail ? (
              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                {hoveredNode.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const items: { label: string; swatch: string; shape: "circle" | "square" }[] =
    [
      { label: "Company", swatch: "var(--color-primary)", shape: "circle" },
      { label: "Weakness", swatch: "var(--color-destructive)", shape: "circle" },
      { label: "Strength", swatch: "var(--color-success)", shape: "circle" },
      { label: "Story", swatch: "var(--color-secondary)", shape: "square" },
    ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className={it.shape === "square" ? "size-2.5 rounded-sm" : "size-2.5 rounded-full"}
            style={{ background: it.swatch }}
          />
          {it.label}
        </span>
      ))}
      <span className="text-muted-foreground/70">Hover a node to trace its links.</span>
    </div>
  );
}

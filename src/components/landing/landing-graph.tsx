"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

// A live, hand-curated taste of the brain's mind-map for the landing page:
// one weak competency ("Metrics") wired to three companies — the cross-company
// pattern the product is built to surface — plus a strength and a story. It
// drifts gently, you can drag the nodes, and hovering traces the connections.
// Not the visitor's data (they're logged out); a representative example.

type Kind = "company" | "weak" | "strong" | "story";

type Node = SimulationNodeDatum & {
  id: string;
  label: string;
  kind: Kind;
  r: number;
};
type Link = SimulationLinkDatum<Node> & {
  kind: "weak" | "strong" | "tag";
};

const NODES: Node[] = [
  { id: "metrics", label: "Metrics", kind: "weak", r: 26 },
  { id: "stripe", label: "Stripe", kind: "company", r: 17 },
  { id: "figma", label: "Figma", kind: "company", r: 17 },
  { id: "linear", label: "Linear", kind: "company", r: 17 },
  { id: "ownership", label: "Ownership", kind: "strong", r: 13 },
  { id: "story", label: "Turnaround story", kind: "story", r: 12 },
];

const LINKS: Link[] = [
  { source: "metrics", target: "stripe", kind: "weak" },
  { source: "metrics", target: "figma", kind: "weak" },
  { source: "metrics", target: "linear", kind: "weak" },
  { source: "ownership", target: "stripe", kind: "strong" },
  { source: "story", target: "metrics", kind: "tag" },
];

const NEIGHBORS: Record<string, Set<string>> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const n of NODES) m[n.id] = new Set([n.id]);
  for (const l of LINKS) {
    m[l.source as string].add(l.target as string);
    m[l.target as string].add(l.source as string);
  }
  return m;
})();

function fill(kind: Kind): string {
  if (kind === "company") return "var(--accent)";
  if (kind === "weak") return "var(--danger)";
  if (kind === "strong") return "var(--ok)";
  return "var(--accent-2)";
}

function stroke(kind: Link["kind"]): string {
  if (kind === "weak") return "var(--danger)";
  if (kind === "strong") return "var(--ok)";
  return "var(--accent-2)";
}

const CAPTION: Record<string, string> = {
  metrics: "Weak across Stripe, Figma & Linear",
  stripe: "Stripe · 1 weak link, 1 strength",
  figma: "Figma · metrics flagged",
  linear: "Linear · metrics flagged",
  ownership: "Ownership · your strength at Stripe",
  story: "Reused for your metrics answers",
};

export function LandingGraph() {
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const edgeRefs = useRef(new Map<number, SVGLineElement>());
  const simRef = useRef<Simulation<Node, Link> | null>(null);

  // Stable copies so the simulation owns mutable x/y without re-rendering.
  const { nodes, links } = useMemo(
    () => ({
      nodes: NODES.map((n) => ({ ...n })),
      links: LINKS.map((l) => ({ ...l })),
    }),
    []
  );

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function paint() {
      for (const n of nodes) {
        nodeRefs.current
          .get(n.id)
          ?.setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
      }
      links.forEach((l, i) => {
        const el = edgeRefs.current.get(i);
        if (!el) return;
        const s = l.source as Node;
        const t = l.target as Node;
        el.setAttribute("x1", String(s.x ?? 0));
        el.setAttribute("y1", String(s.y ?? 0));
        el.setAttribute("x2", String(t.x ?? 0));
        el.setAttribute("y2", String(t.y ?? 0));
      });
    }

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "tag" ? 70 : 92))
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-440))
      .force("x", forceX(0).strength(0.08))
      .force("y", forceY(0).strength(0.08))
      .force(
        "collide",
        forceCollide<Node>().radius((n) => n.r + 14)
      )
      .velocityDecay(0.5)
      .on("tick", paint);

    for (let i = 0; i < 120; i++) sim.tick();
    paint();

    if (reduce) {
      sim.stop();
    } else {
      // gentle perpetual drift so the graph feels alive
      sim.alphaTarget(0.015).alphaDecay(0).restart();
    }
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  // Pointer drag for any node (reheats while held, springs back on release).
  function onPointerDown(e: React.PointerEvent<SVGGElement>, n: Node) {
    const svg = svgRef.current;
    if (!svg) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const toLocal = (cx: number, cy: number) => {
      const r = svg.getBoundingClientRect();
      // viewBox is centered at 0,0 spanning 360 wide
      const scale = 360 / r.width;
      return {
        x: (cx - r.left - r.width / 2) * scale,
        y: (cy - r.top - r.height / 2) * scale,
      };
    };
    simRef.current?.alphaTarget(0.3).restart();
    const move = (ev: PointerEvent) => {
      const p = toLocal(ev.clientX, ev.clientY);
      n.fx = p.x;
      n.fy = p.y;
    };
    const up = () => {
      n.fx = null;
      n.fy = null;
      simRef.current?.alphaTarget(0.015);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const dim = (id: string) =>
    hovered !== null && !NEIGHBORS[hovered]?.has(id);

  return (
    <div className="l-graph-panel" data-graph>
      <div className="l-graph-head">
        <span className="l-graph-dot" aria-hidden />
        <span>{hovered ? CAPTION[hovered] : "Metrics — weak across 3 companies"}</span>
      </div>
      <svg
        ref={svgRef}
        className="l-graph-svg"
        viewBox="-180 -150 360 300"
        role="img"
        aria-label="Interactive mind-map: a Metrics weakness linked to Stripe, Figma and Linear, plus an Ownership strength and a reusable story. Drag the nodes."
      >
        <g>
          {links.map((l, i) => (
            <line
              key={i}
              ref={(el) => {
                if (el) edgeRefs.current.set(i, el);
                else edgeRefs.current.delete(i);
              }}
              stroke={stroke(l.kind)}
              strokeWidth={l.kind === "weak" ? 2 : 1.5}
              strokeLinecap="round"
              strokeDasharray={l.kind === "tag" ? "2 5" : undefined}
              style={{
                opacity:
                  hovered &&
                  !(
                    NEIGHBORS[hovered]?.has((l.source as Node).id) &&
                    NEIGHBORS[hovered]?.has((l.target as Node).id)
                  )
                    ? 0.08
                    : 0.55,
                transition: "opacity 150ms ease",
              }}
            />
          ))}
        </g>
        <g>
          {nodes.map((n) => (
            <g
              key={n.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(n.id, el);
                else nodeRefs.current.delete(n.id);
              }}
              className="l-graph-node"
              style={{ opacity: dim(n.id) ? 0.18 : 1 }}
              onPointerEnter={() => setHovered(n.id)}
              onPointerLeave={() => setHovered((h) => (h === n.id ? null : h))}
              onPointerDown={(e) => onPointerDown(e, n)}
            >
              <circle
                r={n.r + 4}
                fill="none"
                stroke={fill(n.kind)}
                strokeWidth={1.25}
                style={{
                  opacity: hovered === n.id ? 0.5 : 0,
                  transition: "opacity 150ms ease",
                }}
              />
              <circle r={n.r} fill={fill(n.kind)} fillOpacity={0.92} />
              <text
                y={n.r + 13}
                textAnchor="middle"
                className="l-graph-label"
                style={{ fill: hovered === n.id ? "var(--text-1)" : "var(--text-2)" }}
              >
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="l-graph-legend" aria-hidden>
        {(
          [
            ["Company", "var(--accent)"],
            ["Weak spot", "var(--danger)"],
            ["Strength", "var(--ok)"],
          ] as const
        ).map(([label, c]) => (
          <Fragment key={label}>
            <span className="l-graph-key">
              <span style={{ background: c }} />
              {label}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

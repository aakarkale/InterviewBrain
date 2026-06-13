"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Maximize2, Minus, Plus } from "lucide-react";
import gsap from "gsap";

import type { GraphData, GraphNode, GraphState } from "@/lib/brain/types";

// Obsidian-style graph view: a live force simulation you can drag, pan, and
// zoom, with hover tracing and zoom-dependent labels. Nodes keep our semantic
// group colors (company / competency state / story) — the interaction model
// is Obsidian's.

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & {
  kind: "scored" | "tagged" | "pattern";
  state: GraphState;
  strength: number;
};

type Transform = { x: number; y: number; k: number };

const K_MIN = 0.15;
const K_MAX = 3.5;

function radius(n: GraphNode): number {
  if (n.kind === "company") return 12 + n.weight;
  if (n.kind === "competency") return 6 + n.weight * 2;
  return 6.5;
}

function nodeFill(n: GraphNode): string {
  if (n.kind === "company") return "var(--color-primary)";
  if (n.kind === "story") return "var(--accent-2)";
  if (n.state === "weakness") return "var(--color-destructive)";
  if (n.state === "strength") return "var(--color-success)";
  return "var(--color-muted-foreground)";
}

function edgeStroke(state: GraphState, kind: SimLink["kind"]): string {
  if (state === "weakness") return "var(--color-destructive)";
  if (state === "strength") return "var(--color-success)";
  if (kind === "pattern") return "var(--color-primary)";
  return "var(--color-border-strong)";
}

const linkId = (v: SimLink["source"]) =>
  typeof v === "object" ? (v as SimNode).id : String(v);

export function MindMap({ data }: { data: GraphData }) {
  // hovered = transient trace; selected = pinned by click/Enter.
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<SVGGElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const edgeRefs = useRef(new Map<number, SVGLineElement>());
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  // background pan / pinch bookkeeping (active non-node pointers)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d: number; cx: number; cy: number } | null>(null);
  const interactedRef = useRef(false);

  const graph = useMemo(() => {
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = data.edges.map((e) => ({ ...e }));
    const adjacency = new Map<string, Set<string>>();
    for (const l of links) {
      const s = linkId(l.source);
      const t = linkId(l.target);
      (adjacency.get(s) ?? adjacency.set(s, new Set()).get(s)!).add(t);
      (adjacency.get(t) ?? adjacency.set(t, new Set()).get(t)!).add(s);
    }
    return { nodes, links, adjacency };
  }, [data]);

  // ---- transform plumbing ------------------------------------------------

  function applyTransform() {
    const { x, y, k } = transformRef.current;
    sceneRef.current?.setAttribute(
      "transform",
      `translate(${x},${y}) scale(${k})`
    );
    // Labels fade in as you zoom; companies (hubs) surface first.
    const svg = svgRef.current;
    if (svg) {
      const label = Math.max(0, Math.min(1, (k - 0.55) / 0.45));
      const hub = Math.max(0, Math.min(1, (k - 0.3) / 0.35));
      svg.style.setProperty("--mm-label", label.toFixed(3));
      svg.style.setProperty("--mm-label-hub", hub.toFixed(3));
    }
  }

  function setTransform(next: Transform) {
    transformRef.current = {
      x: next.x,
      y: next.y,
      k: Math.max(K_MIN, Math.min(K_MAX, next.k)),
    };
    applyTransform();
  }

  // Zoom keeping the given screen point fixed (Obsidian zooms at the cursor).
  function zoomAt(px: number, py: number, factor: number) {
    const { x, y, k } = transformRef.current;
    const k2 = Math.max(K_MIN, Math.min(K_MAX, k * factor));
    const r = k2 / k;
    setTransform({ x: px - (px - x) * r, y: py - (py - y) * r, k: k2 });
  }

  function fitToView(animate = false) {
    const el = containerRef.current;
    if (!el || graph.nodes.length === 0) return;
    const { width, height } = el.getBoundingClientRect();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of graph.nodes) {
      const r = radius(n) + 30;
      minX = Math.min(minX, (n.x ?? 0) - r);
      minY = Math.min(minY, (n.y ?? 0) - r);
      maxX = Math.max(maxX, (n.x ?? 0) + r);
      maxY = Math.max(maxY, (n.y ?? 0) + r);
    }
    if (!Number.isFinite(minX)) return;
    const k = Math.min(
      1.15,
      (width / (maxX - minX)) * 0.94,
      (height / (maxY - minY)) * 0.94
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const target = { x: width / 2 - k * cx, y: height / 2 - k * cy, k };
    if (animate) {
      const from = { ...transformRef.current };
      gsap.to(from, {
        ...target,
        duration: 0.45,
        ease: "power2.out",
        onUpdate: () => setTransform(from),
      });
    } else {
      setTransform(target);
    }
  }

  // ---- simulation --------------------------------------------------------

  function writePositions() {
    for (const n of graph.nodes) {
      nodeRefs.current
        .get(n.id)
        ?.setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
    }
    graph.links.forEach((l, i) => {
      const el = edgeRefs.current.get(i);
      if (!el) return;
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      el.setAttribute("x1", String(s.x ?? 0));
      el.setAttribute("y1", String(s.y ?? 0));
      el.setAttribute("x2", String(t.x ?? 0));
      el.setAttribute("y2", String(t.y ?? 0));
    });
  }

  useLayoutEffect(() => {
    if (graph.nodes.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sim = forceSimulation<SimNode>(graph.nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(graph.links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "pattern" ? 105 : l.kind === "scored" ? 78 : 62))
          .strength((l) => 0.3 + l.strength * 0.3)
      )
      .force("charge", forceManyBody().strength(-260))
      .force("x", forceX(0).strength(0.055))
      .force("y", forceY(0).strength(0.055))
      .force(
        "collide",
        forceCollide<SimNode>().radius((n) => radius(n) + 8)
      )
      .velocityDecay(0.38)
      .stop();

    // Form the shape before first paint, then run live so the graph keeps
    // breathing while it settles — the Obsidian unfold.
    const preTicks = reduce ? 300 : 80;
    for (let i = 0; i < preTicks; i++) sim.tick();
    writePositions();
    fitToView();

    if (!reduce) {
      sim.alpha(0.5).alphaDecay(0.02);
      sim.on("tick", writePositions);
      sim.restart();
    }
    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // Entrance: one quick canvas fade — the motion is the simulation itself.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || graph.nodes.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(svg, { opacity: 1 });
      return;
    }
    const tween = gsap.fromTo(
      svg,
      { opacity: 0 },
      { opacity: 1, duration: 0.45, ease: "power1.out" }
    );
    return () => {
      tween.kill();
    };
  }, [graph]);

  // Wheel zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      interactedRef.current = true;
      const rect = svg.getBoundingClientRect();
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * 0.0022)
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the graph fitted on resize until the user takes the wheel.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!interactedRef.current) fitToView();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---- background pan + pinch -------------------------------------------

  function onCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Node pointerdowns stopPropagation, so this is background only.
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    }
  }

  function onCanvasPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    interactedRef.current = true;
    const cur = { x: e.clientX, y: e.clientY };
    pointersRef.current.set(e.pointerId, cur);

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = svgRef.current!.getBoundingClientRect();
      zoomAt(cx - rect.left, cy - rect.top, d / pinchRef.current.d);
      const t = transformRef.current;
      setTransform({
        ...t,
        x: t.x + (cx - pinchRef.current.cx),
        y: t.y + (cy - pinchRef.current.cy),
      });
      pinchRef.current = { d, cx, cy };
    } else if (pointersRef.current.size === 1) {
      const t = transformRef.current;
      setTransform({ ...t, x: t.x + (cur.x - prev.x), y: t.y + (cur.y - prev.y) });
    }
  }

  function onCanvasPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  function onCanvasClick(e: React.MouseEvent) {
    // Background click clears the pinned selection (node clicks don't bubble).
    if (e.target === e.currentTarget || (e.target as Element).tagName === "svg") {
      setSelected(null);
    }
  }

  // ---- node drag ----------------------------------------------------------

  function toSimCoords(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const { x, y, k } = transformRef.current;
    return {
      x: (clientX - rect.left - x) / k,
      y: (clientY - rect.top - y) / k,
    };
  }

  function onNodePointerDown(e: React.PointerEvent<SVGGElement>, n: SimNode) {
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    interactedRef.current = true;

    const start = { x: e.clientX, y: e.clientY };
    let dragged = false;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (
        !dragged &&
        Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4
      ) {
        dragged = true;
        // Reheat while dragging; the node follows the pointer exactly.
        simRef.current?.alphaTarget(0.3).restart();
      }
      if (dragged) {
        const p = toSimCoords(ev.clientX, ev.clientY);
        n.fx = p.x;
        n.fy = p.y;
        if (!simRef.current || simRef.current.alpha() < 0.01) {
          // reduced-motion: still track the pointer
          n.x = p.x;
          n.y = p.y;
          writePositions();
        }
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (dragged) {
        // Release: the node springs back into the layout (Obsidian behavior).
        n.fx = null;
        n.fy = null;
        simRef.current?.alphaTarget(0);
      } else {
        setSelected((s) => (s === n.id ? null : n.id));
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // ---- render -------------------------------------------------------------

  if (graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-surface-0/40 px-6 py-12 text-center text-sm text-muted-foreground">
        Your map grows as you practice and log rounds — companies, competencies,
        and stories connect here once the brain has signal.
      </div>
    );
  }

  const focus = hovered ?? selected;
  const neighbors = focus ? graph.adjacency.get(focus) : null;
  const isDim = (id: string) =>
    focus !== null && id !== focus && !(neighbors?.has(id) ?? false);
  const focusNode = focus ? graph.nodes.find((n) => n.id === focus) : null;

  return (
    <div className="relative" ref={containerRef}>
      <div className="overflow-hidden rounded-lg border bg-background">
        <svg
          ref={svgRef}
          className="block h-[clamp(420px,62vh,660px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          style={{ opacity: 0 }}
          role="application"
          aria-label="Graph of your applications, competencies, and stories. Drag nodes, scroll to zoom, drag the background to pan."
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onClick={onCanvasClick}
        >
          <g ref={sceneRef}>
            <g>
              {graph.links.map((l, i) => {
                const s = linkId(l.source);
                const t = linkId(l.target);
                const lit = focus !== null && (focus === s || focus === t);
                const dim = focus !== null && !lit;
                return (
                  <line
                    key={i}
                    ref={(el) => {
                      if (el) edgeRefs.current.set(i, el);
                      else edgeRefs.current.delete(i);
                    }}
                    stroke={edgeStroke(l.state, l.kind)}
                    strokeWidth={l.kind === "pattern" ? 1 + l.strength * 1.4 : 1}
                    strokeLinecap="round"
                    strokeDasharray={l.kind === "tagged" ? "2 4" : undefined}
                    style={{
                      opacity: dim
                        ? 0.04
                        : lit
                          ? 0.9
                          : 0.22 + l.strength * 0.3,
                      transition: "opacity 150ms ease",
                    }}
                  />
                );
              })}
            </g>
            <g>
              {graph.nodes.map((n) => {
                const r = radius(n);
                const dim = isDim(n.id);
                const lit = focus === n.id;
                const hub = n.kind === "company";
                return (
                  <g
                    key={n.id}
                    ref={(el) => {
                      if (el) nodeRefs.current.set(n.id, el);
                      else nodeRefs.current.delete(n.id);
                    }}
                    className="cursor-pointer outline-none"
                    style={{
                      opacity: dim ? 0.08 : 1,
                      transition: "opacity 150ms ease",
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.kind}: ${n.label}`}
                    aria-pressed={selected === n.id}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() =>
                      setHovered((h) => (h === n.id ? null : h))
                    }
                    onFocus={() => setHovered(n.id)}
                    onBlur={() => setHovered((h) => (h === n.id ? null : h))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected((s) => (s === n.id ? null : n.id));
                      }
                    }}
                  >
                    {/* halo ring on focus/selection */}
                    <circle
                      r={r + 3.5}
                      fill="none"
                      stroke={nodeFill(n)}
                      strokeWidth={1.25}
                      style={{
                        opacity: lit ? 0.55 : 0,
                        transition: "opacity 150ms ease",
                      }}
                    />
                    <circle
                      r={r}
                      fill={nodeFill(n)}
                      style={{
                        transform: lit ? "scale(1.12)" : "scale(1)",
                        transition: "transform 150ms ease",
                      }}
                    />
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{
                        fontSize: hub ? 10.5 : 9,
                        fontWeight: hub ? 600 : 500,
                        fill: lit ? "var(--text-1)" : "var(--text-2)",
                        opacity: lit
                          ? 1
                          : `var(${hub ? "--mm-label-hub" : "--mm-label"}, 1)`,
                        transition: "fill 150ms ease",
                        paintOrder: "stroke",
                        stroke: "var(--bg)",
                        strokeWidth: 3,
                        strokeLinejoin: "round",
                      }}
                    >
                      {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* zoom controls */}
      <div className="absolute right-3 bottom-12 flex flex-col overflow-hidden rounded-md border bg-popover/90 backdrop-blur">
        <GraphButton
          label="Zoom in"
          onClick={() => {
            interactedRef.current = true;
            const el = containerRef.current!.getBoundingClientRect();
            zoomAt(el.width / 2, el.height / 2, 1.35);
          }}
        >
          <Plus className="size-3.5" />
        </GraphButton>
        <GraphButton
          label="Zoom out"
          onClick={() => {
            interactedRef.current = true;
            const el = containerRef.current!.getBoundingClientRect();
            zoomAt(el.width / 2, el.height / 2, 1 / 1.35);
          }}
        >
          <Minus className="size-3.5" />
        </GraphButton>
        <GraphButton label="Fit graph" onClick={() => fitToView(true)}>
          <Maximize2 className="size-3.5" />
        </GraphButton>
      </div>

      {/* detail panel: hover traces, click pins */}
      <div className="pointer-events-none absolute top-3 left-3 max-w-xs">
        {focusNode ? (
          <div className="rounded-md border bg-popover/95 p-3 backdrop-blur">
            <p className="text-sm font-medium">{focusNode.label}</p>
            <p className="text-micro mt-1 text-text-3">
              {focusNode.kind}
              {focusNode.state !== "neutral" ? ` · ${focusNode.state}` : ""}
              {selected === focusNode.id ? " · pinned" : ""}
            </p>
            {focusNode.detail ? (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {focusNode.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <Legend />
    </div>
  );
}

function GraphButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center border-b text-muted-foreground transition-colors duration-150 last:border-b-0 hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Legend() {
  const items: { label: string; swatch: string }[] = [
    { label: "Company", swatch: "var(--color-primary)" },
    { label: "Weakness", swatch: "var(--color-destructive)" },
    { label: "Strength", swatch: "var(--color-success)" },
    { label: "Competency", swatch: "var(--color-muted-foreground)" },
    { label: "Story", swatch: "var(--accent-2)" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: it.swatch }}
          />
          {it.label}
        </span>
      ))}
      <span className="text-text-3">
        Drag nodes · scroll to zoom · drag the background to pan
      </span>
    </div>
  );
}

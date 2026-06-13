"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

// The full landing motion stack. Everything lives behind a
// prefers-reduced-motion: no-preference matchMedia: reduced-motion
// users get a fully static, fully visible page (content is visible
// by default; tweens are from/set-based and revert on cleanup).
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Lenis inertial scrolling, driven by the GSAP ticker
      const lenis = new Lenis({ autoRaf: false });
      const raf = (time: number) => lenis.raf(time * 1000);
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      const cleanups: Array<() => void> = [];

      const ctx = gsap.context(() => {
        // prepare hand-drawn paths for stroke draw-in
        gsap.utils.toArray<SVGPathElement>("[data-draw]").forEach((p) => {
          const len = p.getTotalLength();
          p.style.strokeDasharray = `${len}px`;
          p.style.strokeDashoffset = `${len}px`;
        });

        // -- hero entrance
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from("[data-hero-item]", {
          y: 26,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.09,
        })
          .from(
            "[data-starburst]",
            {
              scale: 0.55,
              autoAlpha: 0,
              duration: 1.6,
              ease: "elastic.out(1, 0.55)",
              transformOrigin: "50% 50%",
            },
            0.2
          )
          .to(
            '[data-draw="hero"]',
            { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" },
            "-=0.9"
          )
          .from(
            "[data-annotation-label]",
            { autoAlpha: 0, duration: 0.5 },
            "-=0.3"
          );

        // -- scrubbed hero drift/fade on scroll away
        gsap.to("[data-hero-inner]", {
          yPercent: -10,
          autoAlpha: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        // -- generic section reveals
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 24,
            autoAlpha: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          });
        });

        // -- batched tile entrances
        gsap.set("[data-tile]", { y: 32, autoAlpha: 0 });
        ScrollTrigger.batch("[data-tile]", {
          start: "top 90%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.6,
              ease: "power3.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });

        // -- nav chrome after leaving the very top
        const nav = root.querySelector<HTMLElement>("[data-nav]");
        if (nav) {
          ScrollTrigger.create({
            start: 10,
            end: "max",
            onToggle: (self) => {
              nav.dataset.scrolled = String(self.isActive);
            },
          });
        }

        // -- pointer tilt on the hero insight card (quickTo)
        const card = root.querySelector<HTMLElement>("[data-tilt]");
        const zone = root.querySelector<HTMLElement>("[data-hero]");
        if (card && zone) {
          gsap.set(card, { transformPerspective: 800 });
          const rotX = gsap.quickTo(card, "rotationX", {
            duration: 0.6,
            ease: "power3.out",
          });
          const rotY = gsap.quickTo(card, "rotationY", {
            duration: 0.6,
            ease: "power3.out",
          });

          const onMove = (e: PointerEvent) => {
            const r = card.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            rotX(gsap.utils.clamp(-8, 8, -dy * 10));
            rotY(gsap.utils.clamp(-10, 10, dx * 12));
          };
          const onLeave = () => {
            rotX(0);
            rotY(0);
          };

          zone.addEventListener("pointermove", onMove);
          zone.addEventListener("pointerleave", onLeave);
          cleanups.push(() => {
            zone.removeEventListener("pointermove", onMove);
            zone.removeEventListener("pointerleave", onLeave);
          });
        }

        // -- per-element glow tracking (--mx/--my knobs from tokens.css)
        root.querySelectorAll<HTMLElement>(".glow-track").forEach((el) => {
          const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            el.style.setProperty(
              "--mx",
              `${((e.clientX - r.left) / r.width) * 100}%`
            );
            el.style.setProperty(
              "--my",
              `${((e.clientY - r.top) / r.height) * 100}%`
            );
          };
          const onEnter = () => el.classList.add("is-glowing");
          const onLeave = () => el.classList.remove("is-glowing");

          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerenter", onEnter);
          el.addEventListener("pointerleave", onLeave);
          cleanups.push(() => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerenter", onEnter);
            el.removeEventListener("pointerleave", onLeave);
          });
        });

        // -- gliding anchor nav via Lenis
        root.querySelectorAll<HTMLAnchorElement>("[data-glide]").forEach((a) => {
          const onClick = (e: MouseEvent) => {
            const hash = a.getAttribute("href");
            if (!hash?.startsWith("#")) return;
            e.preventDefault();
            lenis.scrollTo(hash, { offset: -72, duration: 1.1 });
          };
          a.addEventListener("click", onClick);
          cleanups.push(() => a.removeEventListener("click", onClick));
        });
      }, root);

      return () => {
        cleanups.forEach((fn) => fn());
        ctx.revert();
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    });

    return () => mm.revert();
  }, [rootRef]);
}

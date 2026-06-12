"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Brain,
  ClipboardCheck,
  FolderOpen,
  ListChecks,
  MessageSquareText,
} from "lucide-react";

import { Starburst } from "./starburst";
import { MiniMap } from "./mini-map";
import { useLandingMotion } from "./use-landing-motion";

const LOOP_STEPS = [
  {
    title: "Store",
    body: "Drop the JD, your tailored resume, research notes, and call transcripts into one vault per application.",
  },
  {
    title: "Practice",
    body: "Run a text mock interview built from that vault — your real materials, the actual round you're facing.",
  },
  {
    title: "Learn",
    body: "Rubric-scored feedback writes back into the brain after every session — and every real round you log.",
  },
  {
    title: "Repeat, smarter",
    body: "The next session opens already knowing your weak spots, across every company you're talking to.",
  },
];

const TILES = [
  {
    icon: FolderOpen,
    title: "Application vault",
    body: "JD, tailored resume, recruiter notes, call transcripts — one place per company, all of it feeding the interviewer.",
  },
  {
    icon: ListChecks,
    title: "Round tracking",
    body: "Log each round's interviewer, outcome, and what actually happened. Real interviews teach the brain too.",
  },
  {
    icon: MessageSquareText,
    title: "Mocks in context",
    body: "Text interviews prompted with your resume, the JD, and the context of your specific next round.",
  },
  {
    icon: ClipboardCheck,
    title: "Rubric-scored feedback",
    body: "Every session is scored against a fixed competency rubric, so progress is comparable across companies.",
  },
  {
    icon: Brain,
    title: "The cross-company brain",
    body: "Pattern detection across all your applications, surfaced as plain-language insights — with receipts.",
  },
  {
    icon: BookOpenText,
    title: "Story bank",
    body: "Your STAR stories, written once, reused everywhere, and linked to competencies automatically.",
    amber: true,
  },
];

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);

  return (
    <div ref={rootRef} className="landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="l-nav" data-nav>
        <div className="l-container l-nav-inner">
          <Link href="/" className="l-wordmark">
            InterviewBrain
          </Link>
          <nav className="l-nav-links" aria-label="Page sections">
            <a href="#loop" data-glide>
              The loop
            </a>
            <a href="#features" data-glide>
              Inside
            </a>
            <a href="#brain" data-glide>
              The brain
            </a>
          </nav>
          <div className="l-nav-cta">
            <Link href="/login" className="l-btn l-btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="l-btn l-btn-solid">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="l-hero" data-hero>
          <Starburst className="l-starburst" />
          <div className="l-container l-hero-inner" data-hero-inner>
            <div>
              <p className="l-eyebrow" data-hero-item>
                For PMs interviewing at several companies at once
              </p>
              <h1 className="l-headline" data-hero-item>
                Interview prep that{" "}
                <span className="l-headline-accent">remembers.</span>
              </h1>
              <p className="l-sub" data-hero-item>
                Keep each application&apos;s research in one vault. Run mock
                interviews built from it. Get feedback that knows what you
                fumbled last week — at every other company too.
              </p>
              <div className="l-hero-cta" data-hero-item>
                <Link href="/signup" className="l-btn l-btn-solid l-btn-lg">
                  Start free
                </Link>
                <a href="#loop" className="l-btn l-btn-outline l-btn-lg" data-glide>
                  See the loop
                </a>
              </div>
            </div>

            <div className="l-hero-visual" data-hero-item>
              <div className="l-hero-card glow-track" data-tilt>
                <div className="l-annotation" aria-hidden="true">
                  <span data-annotation-label>the brain, doing its job</span>
                  <svg viewBox="0 0 56 64">
                    <path data-draw="hero" d="M 6 6 q -2 30 8 42 q 8 10 30 12" />
                    <path data-draw="hero" d="M 36 52 l 9 7 l -11 4" />
                  </svg>
                </div>
                <span className="l-chip">Insight · cross-application</span>
                <p className="l-insight-title">
                  Metrics questions are your weakest area across 3 companies.
                </p>
                <ul className="l-evidence">
                  <li>Stripe — round 2, onsite debrief</li>
                  <li>Figma — practice session, May 28</li>
                  <li>Linear — recruiter screen transcript</li>
                </ul>
                <div className="l-conf">
                  <span className="l-conf-blocks" aria-hidden="true">
                    <span className="on" />
                    <span className="on" />
                    <span className="on" />
                    <span className="on" />
                    <span />
                  </span>
                  confidence&nbsp;high
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="loop" className="l-section">
          <div className="l-container">
            <p className="l-kicker" data-reveal>
              How it works
            </p>
            <h2 className="l-h2" data-reveal>
              The loop is the product.
            </h2>
            <p className="l-section-sub" data-reveal>
              Research storage and AI mocks exist. What doesn&apos;t: a loop
              where each one makes the other smarter, session after session.
            </p>
            <ol className="l-loop-steps">
              {LOOP_STEPS.map((step) => (
                <li key={step.title} data-reveal>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="l-section">
          <div className="l-container">
            <p className="l-kicker" data-reveal>
              Inside
            </p>
            <h2 className="l-h2" data-reveal>
              Everything serves the loop.
            </h2>
            <p className="l-section-sub" data-reveal>
              No kanban boards, no resume optimizers, no question-bank
              browsing. If the interviewer or the brain doesn&apos;t consume
              it, it didn&apos;t get built.
            </p>
            <div className="l-tiles">
              {TILES.map(({ icon: Icon, title, body, amber }) => (
                <article
                  key={title}
                  className="l-tile glow-track"
                  data-tile
                  style={
                    amber
                      ? ({ "--accent": "var(--accent-2)" } as React.CSSProperties)
                      : undefined
                  }
                >
                  <div className="l-tile-icon">
                    <Icon aria-hidden />
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="brain" className="l-section">
          <div className="l-container l-brain-inner">
            <div>
              <p className="l-kicker" data-reveal>
                The brain
              </p>
              <h2 className="l-h2" data-reveal>
                One brain across every application.
              </h2>
              <p className="l-section-sub" data-reveal>
                Generic tools forget you between sessions. InterviewBrain
                doesn&apos;t: every mock, every logged round, every recruiter
                call feeds one model of where you&apos;re strong — and where
                you keep slipping.
              </p>
              <blockquote className="l-quote" data-reveal>
                <strong>
                  &ldquo;Metrics questions are your weakest area across 3
                  companies.&rdquo;
                </strong>
                <br />
                Surfaced automatically, with the evidence to back it up. The
                mind-map is derived from your data at load time — never
                curated by hand.
              </blockquote>
            </div>
            <div data-reveal>
              <MiniMap />
            </div>
          </div>
        </section>

        <section className="l-cta">
          <div className="l-container">
            <h2 className="l-h2" data-reveal>
              Walk in already warmed up.
            </h2>
            <p data-reveal>
              Free while in beta — 3 active applications, 10 practice sessions
              a month.
            </p>
            <div data-reveal>
              <Link href="/signup" className="l-btn l-btn-solid l-btn-lg">
                Create your vault
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-container l-footer-inner">
          <span>InterviewBrain · © 2026</span>
          <div className="l-footer-links">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

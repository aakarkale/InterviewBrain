-- Fixed competency taxonomy (SPEC.md Open Question #2, approved
-- 2026-06-11). Slugs are load-bearing rubric keys: every session
-- scores against them and the brain's pattern detection joins on
-- them, so they are never renamed or deleted — only added to.
-- Metrics deliberately appears as a lens in all three types
-- (product_metrics / metric_definition / metric_diagnosis) so
-- cross-type metric weakness is detectable.

insert into public.competencies (id, name, interview_type) values
  -- behavioral (7)
  ('ownership_initiative', 'Ownership & Initiative', 'behavioral'),
  ('influencing_stakeholders', 'Influencing & Stakeholder Management', 'behavioral'),
  ('conflict_navigation', 'Conflict Navigation', 'behavioral'),
  ('failure_growth', 'Failure & Growth', 'behavioral'),
  ('team_leadership', 'Team Leadership & Collaboration', 'behavioral'),
  ('ambiguity_adaptability', 'Adaptability in Ambiguity', 'behavioral'),
  ('impact_storytelling', 'Impact Storytelling', 'behavioral'),
  -- product sense (6)
  ('user_empathy', 'User Empathy & Problem Discovery', 'product_sense'),
  ('problem_framing', 'Problem Framing & Scoping', 'product_sense'),
  ('solution_creativity', 'Solution Creativity', 'product_sense'),
  ('prioritization_tradeoffs', 'Prioritization & Trade-offs', 'product_sense'),
  ('product_metrics', 'Product Success Metrics', 'product_sense'),
  ('strategic_alignment', 'Strategic & Business Alignment', 'product_sense'),
  -- execution (6)
  ('metric_definition', 'Metric Definition & Goal Setting', 'execution'),
  ('metric_diagnosis', 'Metric Diagnosis', 'execution'),
  ('experiment_design', 'Experiment Design & Interpretation', 'execution'),
  ('tradeoff_judgment', 'Trade-off Judgment', 'execution'),
  ('execution_planning', 'Execution Planning & Risk', 'execution'),
  ('structured_problem_solving', 'Structured Problem Solving', 'execution');

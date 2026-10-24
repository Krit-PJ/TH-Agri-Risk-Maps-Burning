spec: "K Work Architecture v4.0 / revision 2"
project: "Thailand Agri-Risk Maps Burning"
task_id: "national-production-2026-10-24"
updated_at: "2026-10-24T19:45:00+07:00"
status: BLOCKED
domain: [ENGINEERING, OPERATIONS]
mode: DEEP
risk_reason: "Production website, province-isolated imports, GIS presentation, and risk calculations span GitHub Pages and Apps Script."
model_selection:
  policy: AUTO
  recommended_tier: ADVANCED
  requested_model: unspecified
  requested_effort: unspecified
  actual_model: unknown
  actual_effort: unknown
  control: ADVISORY
  reason: "Cross-system architecture and evidence-constrained formulas require difficult synthesis."
  mapping_ref: "unresolved"
objective: "Deploy a usable national Map-first public experience and evidence-backed HS import/risk foundations without fabricating missing model parameters."
acceptance:
  - {id: A1, criterion: "National landing shows all 77 provinces and only published provinces are selectable", check: "DOM/data tests plus desktop screenshot", result: PASS, evidence: "tests/public-shell.test.cjs; app/data/boundary/provinces.geojson; landing-preview.png"}
  - {id: A2, criterion: "Excel imports select AllData/hsAll only, parse Maps, and deduplicate across files", check: "contract tests", result: PASS, evidence: "tests/import-contract.test.cjs"}
  - {id: A3, criterion: "Approved risk formulas and upper-level gate have known-value tests", check: "unit tests", result: PASS, evidence: "tests/risk-core.test.cjs"}
  - {id: A4, criterion: "Three font sizes, clean UI, and print excludes score charts", check: "source inspection and screenshot", result: PASS, evidence: "index.html; app/index.html; app/css/style.css; landing-preview.png"}
  - {id: A5, criterion: "Repository deployed and public URL verified", check: "GitHub push, Pages workflow, HTTP verification", result: PASS, evidence: "commit bac278c; GitHub Actions 40093400263 and 40093399719; production HTTP 200"}
scope_in: ["GitHub Pages frontend", "HS Excel import contract", "Risk V2 calculation core/registry", "tests and operations docs", "production deployment"]
scope_out: ["inventing missing baselines or T subformulas", "rewriting Git history", "mutating production Sheet data"]
authorized_actions: ["User explicitly authorized GitHub, Google Sheet, and Apps Script management and requested completion"]
human_gate: {state: AUTHORIZED, action: "deploy GitHub Pages changes", basis: "current and prior explicit user instructions"}
anchors:
  workspace_or_source: "TH-Agri-Risk-Maps-Burning-public"
  revision: "main @ bac278c"
  environment: "GitHub Pages production; Apps Script deployment retained"
  entrypoints: ["index.html", "app/index.html", "app/js/app.js", "app/js/risk-core.js"]
  data_as_of: "HS source files inspected 2026-10-24; bundled catalog generated 2026-10-21"
  freshness_check: "28 tests passed and production HTTP/assets verified 2026-10-24"
context: {level: P3, next_question: "What owner-approved province baselines and T subformulas should activate Risk V2?"}
decisions: ["Use dependency-free SVG for the national overview", "Keep analytical boundaries unsimplified", "Block Risk V2 activation until approved province parameters exist"]
assumptions: ["Production Apps Script deployment remains version 7; no Apps Script source change is required for this frontend/import-contract release"]
changes: ["Map-first landing", "0.44 MB national overview", "Excel detail profiles", "Risk V2 core and readiness gate", "font/print improvements", "28-test suite"]
recovery: "Revert the deployment commit; GitHub Pages retains commit history. No production Sheet mutation in this task."
blockers: ["Risk V2 activation requires owner-approved baselines, T subformulas, CropRisk mapping, and approval evidence"]
next_action: "Owner supplies or approves baseline parameters, T subformulas, CropRisk mapping, and approval evidence; then activate and validate Risk V2."
budget:
  limits: {active_minutes: 90, tool_calls: 60, context_tokens: 45000, generated_tokens: 18000}
  used: {active_minutes: unknown, tool_calls: unknown, context_tokens: unknown, generated_tokens: unknown}
  token_quality: unknown
  hard_limits: "none specified"
  overrides: []
telemetry:
  elapsed_minutes: unknown
  attempts_without_progress: 0
  last_failed_hypotheses: ["Replacing an existing file by delete+add in one apply_patch is unsupported", "Headless Chrome 390px window does not provide a reliable mobile emulation viewport"]
  rework_due_to_defect: false
  first_check_passed: false
  human_requests: 0
  useful_tool_calls: unknown
  model_switches: []
  cost: {amount: unknown, currency: unknown, as_of: unknown, quality: unknown}

spec: "K Work Architecture v4.0 / revision 2"
project: "Thailand Agri-Risk Maps Burning"
task_id: "hsall-filter-ui-2026-10-24"
updated_at: "2026-10-24T20:05:00+07:00"
status: IN_PROGRESS
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
objective: "Correct hsAll LandType/PlantType filtering and deploy a clean, readable production dashboard UI."
acceptance:
  - {id: A1, criterion: "hsAll is preferred and LandType/PlantType come from their named columns", check: "contract and source tests", result: PASS, evidence: "tests/import-contract.test.cjs; tests/hotspot-filter.test.cjs"}
  - {id: A2, criterion: "LandType defaults to พื้นที่เกษตร and filters map/dashboard/risk consistently", check: "behavior contract plus 1,755-row published-data check", result: PASS, evidence: "tests/hotspot-filter.test.cjs"}
  - {id: A3, criterion: "Typography, menu, controls, and colors form a readable responsive UI", check: "desktop browser screenshot and source inspection", result: PASS, evidence: "dashboard-review-final.png; app/css/style.css"}
  - {id: A4, criterion: "All regression tests pass", check: "node --test tests/*.test.cjs", result: PASS, evidence: "32/32 local tests"}
  - {id: A5, criterion: "GitHub Pages production deploy succeeds and serves revised assets", check: "Actions and HTTP verification", result: NOT_RUN, evidence: "pending deployment"}
scope_in: ["hsAll import precedence", "LandType and PlantType frontend filters", "dashboard visual system", "tests/docs", "GitHub Pages deployment"]
scope_out: ["Risk V2 parameter activation", "mutating production Sheet data", "rewriting Git history"]
authorized_actions: ["User explicitly authorized GitHub, Google Sheet, and Apps Script management and requested completion"]
human_gate: {state: AUTHORIZED, action: "deploy GitHub Pages changes", basis: "current and prior explicit user instructions"}
anchors:
  workspace_or_source: "TH-Agri-Risk-Maps-Burning-public"
  revision: "main @ f7295ef before current changes"
  environment: "GitHub Pages production; Apps Script deployment retained"
  entrypoints: ["app/index.html", "app/css/style.css", "app/js/app.js", "app/js/map.js", "app/js/dashboard.js"]
  data_as_of: "HS source files inspected 2026-10-24; bundled catalog generated 2026-10-21"
  freshness_check: "32 tests passed and desktop UI screenshot inspected 2026-10-24"
context: {level: P2, next_question: "Will GitHub Pages serve the revised filter and style assets after deployment?"}
decisions: ["Prefer hsAll when both detail sheets exist", "Use one LandType/PlantType filter state for map, dashboard, and risk", "Default LandType to พื้นที่เกษตร"]
assumptions: ["Risk V2 activation remains separately gated by approved baseline and T parameters", "No Apps Script source change is required for frontend filtering"]
changes: ["hsAll precedence", "LandType/PlantType dropdowns", "shared filter propagation", "clean light-green dashboard design system", "32-test suite"]
recovery: "Revert the deployment commit; GitHub Pages retains commit history. No production Sheet mutation in this task."
blockers: []
next_action: "Commit, push main, wait for Pages, and verify revised production assets."
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

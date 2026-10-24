spec: "K Work Architecture v4.0 / revision 2"
project: "Thailand Agri-Risk Maps Burning"
task_id: "national-template-rebuild-2026-10-24"
updated_at: "2026-10-24T23:50:00+07:00"
status: PASS
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
objective: "Rebuild the public system from the approved prototype with a national 77-province map, active-HS province selection, provincial administration, printable reports, and a persistent visitor counter."
acceptance:
  - {id: A1, criterion: "Public home displays all 77 province boundaries and offers only provinces with published HS", check: "source contract, catalog test, inspected national-map screenshot", result: PASS, evidence: "tests/public-shell.test.cjs; tests/catalog.test.cjs; national-rebuild-final.png"}
  - {id: A2, criterion: "Selected province activates its dashboard data and maintains provincial isolation", check: "catalog/data-plane tests", result: PASS, evidence: "tests/apps-script-core.test.cjs; tests/catalog.test.cjs"}
  - {id: A3, criterion: "A4 report contains selected boundaries and every district without Score bars", check: "headless Chrome PDF and source test", result: PASS, evidence: "district-report-final7.pdf; tests/public-shell.test.cjs"}
  - {id: A4, criterion: "Login separates phone-only Admin and credentialed Super Admin in one entry point", check: "frontend and backend authorization tests", result: PASS, evidence: "tests/public-shell.test.cjs; tests/apps-script-core.test.cjs"}
  - {id: A5, criterion: "Visitor counter persists at the shared backend", check: "unit test and deployed API call", result: PASS, evidence: "36/36 tests; Apps Script deployment @8 returned visit_ok=true/count=1"}
  - {id: A6, criterion: "All regression tests pass", check: "npm test", result: PASS, evidence: "36/36 local tests"}
  - {id: A7, criterion: "Production deployment succeeds", check: "Apps Script and GitHub Pages live verification", result: IN_PROGRESS, evidence: "Apps Script @8 verified; GitHub Pages push pending"}
scope_in: ["national public shell", "active-HS province selector", "role login UI", "persistent counter", "print layout", "Tailwind build", "Apps Script and GitHub Pages deployment"]
scope_out: ["Risk V2 parameter activation", "mutating production Sheet data", "rewriting Git history"]
authorized_actions: ["User explicitly authorized GitHub, Google Sheet, and Apps Script management and requested completion"]
human_gate: {state: AUTHORIZED, action: "deploy GitHub Pages changes", basis: "current and prior explicit user instructions"}
anchors:
  workspace_or_source: "TH-Agri-Risk-Maps-Burning-public"
  revision: "main; final release commit pending"
  environment: "GitHub Pages production; Apps Script deployment @8"
  entrypoints: ["index.html", "app/js/landing.js", "app/index.html", "app/js/app.js", "app/js/map.js", "app/cloud/apps-script/Code.gs"]
  data_as_of: "HS source files inspected 2026-10-24; bundled catalog generated 2026-10-21"
  freshness_check: "36 tests passed; national/dashboard/PDF evidence inspected; Apps Script health and visit endpoints verified 2026-10-24"
context: {level: P2, next_question: "none"}
decisions: ["Retain approved prototype behavior while replacing the public shell", "Render administrative/risk polygons as SVG for distortion-free printing", "Use Apps Script PropertiesService and lock for a persistent shared counter", "Keep phone identifiers as strings so leading zero is preserved"]
assumptions: ["Risk V2 activation remains separately gated by approved baseline and T parameters", "No Apps Script source change is required for frontend filtering"]
changes: ["77-province map-first home", "active-HS-only selector", "single role-tab login entry", "partner links and DOAE-only branding", "Tailwind visual system", "persistent visitor counter", "A4 all-district report", "36-test suite"]
recovery: "Revert the deployment commit; GitHub Pages retains commit history. No production Sheet mutation in this task."
blockers: []
next_action: "Commit/push GitHub Pages release and verify production HTTP."
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
  first_check_passed: true
  human_requests: 0
  useful_tool_calls: unknown
  model_switches: []
  cost: {amount: unknown, currency: unknown, as_of: unknown, quality: unknown}

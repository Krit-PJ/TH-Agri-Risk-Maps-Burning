# Thailand Agri-Risk Maps Burning — Phase 1 Foundation

Date: 2026-10-23  
Status: approved for implementation  
Pilot tenant: Kamphaeng Phet (`62`)

## 1. Current-state audit

- The public repository contains boundary packages for all 77 provinces and bundled published hotspot files for province `62`.
- The public landing page reads a static catalog while the Apps Script control plane writes to Google Sheets. New approved Sheet rows therefore do not automatically become visible on GitHub Pages.
- Accounts, registrations, hotspots, audit, and settings are currently stored in one workbook. This is acceptable for an initial proof of concept but does not provide strong tenant isolation for 77 provinces.
- The current cloud UI supports registration, approval, and raw JSON save only. Delete, restore, publish, account lifecycle, audit, and dashboard operations are not exposed through the UI.
- A previous public commit contained supplied credentials in test fixtures. Those values must be treated as compromised and rotated outside source control.
- A verified backup of the control workbook and Apps Script project was created in the project Drive folder before migration.

## 2. Target architecture

One codebase and one public portal are retained. Runtime responsibilities are separated:

1. **Public plane** — GitHub Pages, province boundaries, and read-only published hotspot API access.
2. **Control plane** — accounts, roles, province registry, registration decisions, rate limits, publication state, system settings, and central audit.
3. **Province data plane** — one workbook per onboarded province containing hotspots, import batches, validation errors, reference data, and province audit.

The initial production path is a dynamic Apps Script public API with bundled GeoJSON fallback. The API is selected because it makes approved rows visible without a repository commit. JSONP is retained as a transport fallback for GitHub Pages because Apps Script ContentService cross-origin behavior is not consistently configurable.

## 3. Threat model

| Threat | Control |
|---|---|
| Cross-province IDOR | Province is derived from the authenticated session; both existing and proposed rows are authorized under a script lock. |
| Stale sessions after account change | Session stores account revision and device binding; every protected operation re-reads current authority. |
| Credential disclosure | Secrets stay in Script Properties; tests use synthetic values; repository secret scans run before release. |
| Activation guessing | Strong random activation secret, expiry, persistent rate limit, and atomic device claim. |
| Partial batch write | Validate and authorize the complete batch before any write; assign a batch ID and record one audit correlation ID. |
| Accidental hard deletion | Soft delete with actor, timestamp, and reason; restore is explicit. |
| Draft data publication | Public API filters only exact `workflowStatus=published` and `deletedAt` empty. |
| Formula injection | Text beginning with `=`, `+`, `-`, or `@` is escaped before spreadsheet writes. |
| Shared super-admin accountability | Legacy owner becomes break-glass only; normal administration uses individual accounts and audited roles. |

## 4. Data model

### Control workbook

- `Accounts`
- `RegistrationRequests`
- `ProvinceRegistry`
- `Roles`
- `DeviceBindings`
- `PublicationJobs`
- `RateLimits`
- `SystemAudit`
- `Settings`
- `SchemaMigrations`

### Province workbook

- `Hotspots`
- `ImportBatches`
- `ValidationErrors`
- `ProvinceAudit`
- `ReferenceData`

Hotspot workflow: `draft → validated → submitted → approved → published`. `deleted` is represented by soft-delete fields and may be restored.

## 5. Permission matrix

| Permission | Data Entry | Province Admin | National Approver | Account Approver | System Admin | Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Read province hotspots | scoped | scoped | all | no | all | all/read-only |
| Create/edit draft | scoped | scoped | no | no | all | no |
| Submit | scoped | scoped | no | no | all | no |
| Approve/publish | no | optional scoped | all | no | all | no |
| Soft delete/restore | no | scoped | all | no | all | no |
| Decide registration | no | no | no | all | all | no |
| Manage accounts/devices | no | no | no | all | all | no |
| System settings/migrations | no | no | no | no | all | no |
| Read audit | scoped self | scoped | all | account events | all | all |

## 6. Migration plan

1. Preserve existing files and create Drive backups.
2. Add missing control-plane sheets and append new columns without reordering existing columns.
3. Create the province `62` data workbook and register it in `ProvinceRegistry`.
4. Migrate any operational hotspot rows from the legacy central `Hotspots` sheet to the province workbook. Bundled public GeoJSON remains a read-only fallback until migrated through the approved import workflow.
5. Deploy the new Apps Script version only after the workbook schema is verified.
6. Publish the GitHub Pages adapter only after live API health, catalog, registration, and authorization checks pass.
7. Onboard other provinces only after pilot UAT and load testing.

All migrations must be idempotent and write a `SchemaMigrations` record.

## 7. Test plan

- Unit: validators, permissions, state transitions, safe text, duplicate identity, session revision, publication filtering.
- Integration: control workbook routing, province workbook routing, registration-to-activation, import-to-publish, disable-account session invalidation.
- Security: cross-province IDOR, payload tampering, stale sessions, brute force, formula injection, XSS, secret scanning.
- End-to-end: public catalog, public map, data entry, province admin, account approver, system admin, auditor, mobile viewport, and slow connection.

## 8. Rollback plan

- Keep the verified Drive workbook and Apps Script backups unchanged.
- Apps Script rollback uses the previous deployment version and original control workbook ID.
- GitHub rollback uses the last known-good commit; no force reset is permitted.
- Province workbook migration is additive. Original central tabs are retained until pilot acceptance.
- Publication falls back to bundled GeoJSON if the dynamic API is unavailable.

## 9. Critical decisions

1. Dynamic public API is the primary publication path; bundled files are a resilience fallback.
2. One province workbook is provisioned for the pilot. The remaining 76 are created only when onboarding begins, avoiding unused-file sprawl.
3. Google Sheets remains the approved operational store for the pilot, not the assumed permanent national database. Capacity and latency evidence from the pilot will determine when to move the data plane to a transactional database.
4. The legacy owner login is break-glass only. Production administration must move to individual accounts.
5. Public publication requires explicit `published` workflow state; missing status is private.


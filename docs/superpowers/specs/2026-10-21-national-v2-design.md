# Thailand Agri-Risk Maps Burning V2 Design

## Intent

ยกระดับระบบกำแพงเพชรเป็นระบบ 77 จังหวัดที่เปิดดูข้อมูลสาธารณะได้จาก GitHub Pages และให้เจ้าหน้าที่ลงทะเบียน รับทราบ PDPA และจัดการข้อมูลเฉพาะพื้นที่ผ่านบริการ Google Workspace ที่มีการตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์

## Goals

- ติดตั้งขอบเขตจังหวัด อำเภอ และตำบลครบ 77 จังหวัดใน frontend repository
- แสดงตัวเลือกจังหวัดสาธารณะเฉพาะจังหวัดที่มีข้อมูล Hotspot เผยแพร่จริง
- รักษา dashboard, filter, print และสูตรความเสี่ยงเดิม
- แยกสิทธิ์ Admin รายจังหวัดกับ Super Admin ทั้งประเทศ และบังคับสิทธิ์ทุกคำสั่งเขียนที่ backend
- มีขั้นตอนลงทะเบียนสองหน้า: แบบฟอร์ม → เอกสารรับทราบ PDPA → ส่งคำขอครั้งเดียว
- ใช้ Google Sheets/Drive เป็นข้อมูลหลัก และ Apps Script เป็น secure admin/registration surface
- deploy public map ผ่าน GitHub Actions ไป GitHub Pages

## Security decision

GitHub Pages เป็น static public host และไม่ใช่ security boundary จึงห้ามเก็บหมายเลขโทรศัพท์ รายการผู้อนุมัติ รหัสผ่าน หรือ role ที่เชื่อถือได้ใน repository แม้ข้อกำหนดเดิมขอให้เก็บรหัสโทรศัพท์ไว้ที่ frontend เพราะจะเปิดเผย PII และทำให้สวมสิทธิ์ได้ทันที

การใช้งานแบ่งเป็นสอง origin:

1. **GitHub Pages** — public map, boundary GeoJSON, published Hotspot, risk/dashboard/print, ลิงก์ลงทะเบียนและเจ้าหน้าที่
2. **Apps Script Web App** — registration, PDPA acknowledgement, login/session, approval, scoped CRUD/import และการ publish ข้อมูลที่ตรวจแล้ว

หมายเลขโทรศัพท์ยังเป็นชื่อเข้าใช้ที่เจ้าหน้าที่จำง่าย แต่ Apps Script ต้องผูก session กับ Google identity ที่ผ่าน deployment access policy หรือปัจจัยยืนยันตัวตนเพิ่มเติม ห้ามยอมรับ phone-only client check เป็นสิทธิ์จริง บัญชีเริ่มต้นกำแพงเพชรและ Super Admin ถูก seed ใน private Sheet/Script Properties เท่านั้น ไม่อยู่ใน source หรือ public response

## Data model

Google Sheet มีตาราง:

- `Accounts`: accountId, phoneHash, displayName, position, positionOther, affiliation, provinceCode, districtCodes, role, status, revision, googleEmail, createdAt, approvedAt
- `RegistrationRequests`: requestId, idempotencyKey, phoneHash, profile fields, noticeVersion, acknowledgedAt, status, createdAt
- `Hotspots`: canonical hotspot fields, provinceCode/districtCode/subdistrictCode, published, source, updatedAt, updatedBy
- `AuditLog`: timestamp, actorId, action, targetType, targetId, provinceCode, result
- `Settings`: key/value including noticeVersion, public provinces, published years, GitHub repository and release revision

Raw phone numbers are private and never returned by public endpoints. Canonical province/district/subdistrict codes from source data are used for joins.

## Public data contract

- `app/data/boundary/<provinceCode>/{province,districts,subdistricts}.geojson`
- `app/data/hotspot/<provinceCode>/hotspot_<yearBE>.geojson` only for reviewed public records
- `app/data/catalog.json` is generated from actual files. `activeProvinceCodes` contains only provinces with at least one valid published Hotspot feature.
- Empty or missing data never fabricates values; UI displays 0/ไม่มีข้อมูล and keeps the map operational.

## User flows

### Public user

Open GitHub Pages, select an active province, then use the existing district/tambon/crop/period filters. Changing draft period has no effect until “แสดงข้อมูล”.

### Registration

Open Apps Script registration page, fill name, phone, position (including “อื่นๆ”), affiliation and province. “ถัดไป : อ่านประกาศ” opens the exact PDPA notice. Cancel returns to the public home. Confirm performs one idempotent submission and displays a request ID.

### Admin

After approval, enter the registered phone on the Apps Script login page. Backend verifies the ambient Google identity/additional challenge and approved account, issues an expiring server-side session, and scopes all map/import/edit/delete calls to the account province.

### Super Admin

Can approve requests, manage accounts and data for all provinces, and publish reviewed public snapshots. Bootstrap secrets are configured privately and never committed.

## Non-goals

- No public repository of account/phone data
- No claim that client-side login protects admin functions
- No synthetic Hotspot records
- No change to risk formula or risk thresholds
- No automatic publication of private Sheet rows

## Acceptance

- 77 boundary folders validate and match canonical province codes
- public province dropdown equals catalog provinces with actual HS features
- registration cannot double-submit the same idempotency key
- Admin cannot read or mutate another province; Super Admin can
- public responses exclude phone/account/private audit fields
- current risk, date comparison, print and responsive tests remain green
- GitHub Pages deployment and Apps Script deployment are both smoke-tested at their real URLs


# TH Agri-Risk Map Burning — Public Data API v1

API อ่านอย่างเดียวสำหรับระบบอื่นที่ต้องการนำข้อมูลจุดความร้อนและระดับความเสี่ยงไปใช้ ข้อมูลเป็นปัจจุบันเสมอ
แคชจะถูกล้างทันทีเมื่อมีการนำเข้า เปิด/ปิดชุดข้อมูล หรือเปลี่ยนการตั้งค่า

**Base URL**

```
https://script.google.com/macros/s/AKfycbzAgSOxgQsaOx9bqBYM53KXFzk1QKsop46HZeINgtUzLXkaZTYYaZH3RZu0l-HDlN8TKA/exec?action=api
```

* วิธีเรียก: `GET` เท่านั้น เรียกจากเบราว์เซอร์ (fetch, CORS), Excel / Power Query, Google Sheets `IMPORTDATA()`, Python, R ได้
* รูปแบบ: `format=json` (ค่าเริ่มต้น) หรือ `format=csv` (UTF-8 พร้อม BOM เปิดใน Excel ได้ทันที)
* วันที่: `YYYY-MM-DD` เวลาไทย · ฤดูกาลเผา: 1 ต.ค. – 30 ก.ย. ตั้งชื่อตามปี พ.ศ. ที่สิ้นสุด (เช่น ฤดู 2570 = 1 ต.ค. 2569 – 30 ก.ย. 2570)
* รหัสพื้นที่: จังหวัด 2 หลัก · อำเภอ 4 หลัก · ตำบล 6 หลัก (รหัสกรมการปกครอง)

## Endpoints

| fn | พารามิเตอร์ | คืนค่า |
|---|---|---|
| `meta` | – | เวอร์ชัน API, สูตรที่ใช้งานอยู่, ช่วงข้อมูล, ประเภทพื้นที่, ระดับ, รายการ endpoint |
| `provinces` | `format` | จังหวัดที่มีข้อมูล: จำนวนจุดพื้นที่เกษตร วันแรก/วันล่าสุด |
| `risk` | `province` (จำเป็น), `level=subdistrict\|district`, `model=M4\|BRI2`, `land`, `end`, `format`, `key` | ระดับความเสี่ยงรายตำบล/อำเภอ |
| `hotspots` | `province` (จำเป็น), `land`, `from`, `to`, `format` | จุดความร้อนรายจุด (แหล่งข้อมูลหลัก ชุดที่เปิดใช้งาน) |

### ตัวอย่าง

```
?action=api&fn=meta
?action=api&fn=provinces&format=csv
?action=api&fn=risk&province=62&level=subdistrict
?action=api&fn=risk&province=62&level=district&format=csv
?action=api&fn=hotspots&province=62&from=2026-10-01&to=2026-11-30&format=csv
?action=api&fn=hotspots&province=58&land=ALL
```

Google Sheets: `=IMPORTDATA("<Base URL>&fn=risk&province=62&format=csv")`

```python
import pandas as pd
url = "<Base URL>&fn=risk&province=62&format=csv"
df = pd.read_csv(url)
```

## fn=risk — คอลัมน์

ทุกผู้ใช้:

| คอลัมน์ | ความหมาย |
|---|---|
| `code`, `name` | รหัส/ชื่อตำบล (หรืออำเภอเมื่อ `level=district`) |
| `districtCode`, `district` | รหัส/ชื่ออำเภอ |
| `levelIndex`, `level` | 0 ต่ำ · 1 ปานกลาง · 2 สูง · 3 สูงมาก · −1 ไม่ประเมิน (ไม่มีพื้นที่เกษตร) |
| `hs0` | จำนวนจุดความร้อนฤดูปัจจุบันตั้งแต่ 1 ต.ค. ถึงวันข้อมูลล่าสุด (สัญญาณเฝ้าระวัง) |

เพิ่มเมื่อส่ง `key` ที่ได้รับจากผู้ดูแลระบบ (Model 4):

| คอลัมน์ | ความหมาย |
|---|---|
| `score` | คะแนนจัดลำดับเฝ้าระวัง 0–100 (เปอร์เซ็นไทล์เทียบฐานกลาง) — **ไม่ใช่ความน่าจะเป็นการเผา** |
| `H` | หน่วยตรวจพบ (กริด 500 ม.–วัน) ต่อ 1,000 ไร่พื้นที่เพาะปลูกต่อฤดู หลังปรับ Empirical Bayes |
| `cropRai` | พื้นที่เพาะปลูก (ไร่) จาก ESA WorldCover 2021 |
| `u0`, `u1`, `u2` | หน่วยตรวจพบของฤดูฐาน (ใหม่ → เก่า) |
| `base`, `trend` | จุดช่วงเดียวกันฤดูก่อน และแนวโน้ม `up` / `down` / `flat` |
| `reason` | เหตุผลหลักของคะแนน (ข้อความ) |
| `nHigh`, `cropHigh`, `nTambon` | (ระดับอำเภอ) จำนวนตำบลคะแนนสูง–สูงมาก, พื้นที่เกษตรในตำบลเหล่านั้น, จำนวนตำบลทั้งหมด |

ส่วนหัว JSON บอก `model`, `modelVersion`, `season`, `history` (ฤดูฐาน), `end`, `latest`, `fallback` (ถ้าใช้ Model 3 แทน)
Model 4 ใช้กับ `land` = พื้นที่เกษตร / เขต สปก. ใน 17 จังหวัดที่มีข้อมูลพื้นที่เพาะปลูก ประเภทอื่นระบบใช้ Model 3 และแจ้งใน `fallback`

## API key (ข้อมูลคะแนนละเอียด)

ผู้ดูแลระบบออก key จาก Apps Script Editor: `createApiKey('ชื่อหน่วยงาน')` (ดูใน Log), `listApiKeys()`, `revokeApiKey('key')`
key เก็บใน Script Properties ไม่อยู่ใน GitHub ทุกการออก/ยกเลิกบันทึกใน AuditLog

## ข้อควรทราบ

* ระดับและคะแนนเป็น **ลำดับเชิงเปรียบเทียบสำหรับจัดลำดับการเฝ้าระวัง** ไม่ใช่ความน่าจะเป็นหรือพื้นที่ที่จะเผาจริง
* จุดความร้อนคือการตรวจพบความร้อนจากดาวเทียม ไม่ใช่จำนวนเหตุการณ์เผาหรือจำนวนแปลง
* อ้างอิงที่มา: “ระบบ Agri-Risk Map Burning (กรมส่งเสริมการเกษตร)” พร้อมวันที่ `generatedAt`
* วิธีคำนวณ: คู่มือ `docs/Agri-Risk-Manual.pdf` หัวข้อ 4–7

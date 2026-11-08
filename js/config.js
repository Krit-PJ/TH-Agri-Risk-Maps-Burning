/* ค่าตั้งระบบ — แก้ API_URL หลัง Deploy Google Apps Script (ดู README.md) */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzAgSOxgQsaOx9bqBYM53KXFzk1QKsop46HZeINgtUzLXkaZTYYaZH3RZu0l-HDlN8TKA/exec',

  MAP_CENTER: [13.2, 100.9], MAP_ZOOM: 6, MAP_MIN_ZOOM: 5, MAP_MAX_ZOOM: 18,
  THAILAND_BOUNDS: [[5.6, 97.3], [20.5, 105.7]],

  DATA: {
    provinces: 'data/boundary/provinces.geojson',
    district: code => `data/boundary/province/${code}.district.geojson`,
    subdistrict: code => `data/boundary/province/${code}.subdistrict.geojson`,
    outline: code => `data/boundary/province/${code}.outline.geojson`
  },

  LINKS: [
    { label: 'ตรวจสอบจุดความร้อน', title: 'ระบบตรวจสอบจุดความร้อนในพื้นที่การเกษตรของประเทศไทย', url: 'https://krit-pj.github.io/agri-hs-verification/' },
    { label: 'Green Gain Hub', title: 'Green Gain Hub — เชื่อมเกษตรกรผู้ขายเศษวัสดุการเกษตรกับผู้รับซื้อ', url: 'https://krit-pj.github.io/Green_Gain_Hub-KPP/' },
    { label: 'ทีมผู้พัฒนาและที่ปรึกษา', title: 'ผู้ร่วมพัฒนาและให้คำปรึกษา ระบบประเมินและเฝ้าระวังความเสี่ยงการเผาในพื้นที่เกษตร', url: 'team.html', internal: true }
  ],

  BASEMAPS: {
    voyager: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
    topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    print: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' }
  },

  /* สีขอบเขต: กลุ่มสีเทาอมฟ้า — ไม่ซ้ำกับสีที่สื่อความหมาย (ระดับความเสี่ยง / ฤดูกาล HS) */
  BOUNDARY: {
    national: { color: '#5b6b7f', weight: 0.8, opacity: 0.45, fillColor: '#5b6b7f', fillOpacity: 0.02 },
    available: { color: '#475569', weight: 1.4, opacity: 0.8, fillColor: '#64748b', fillOpacity: 0.12 },
    hover: { color: '#1e293b', weight: 2.4, opacity: 1, fillColor: '#64748b', fillOpacity: 0.26 },
    province: { color: '#334155', weight: 2.6, opacity: 0.9, fillOpacity: 0 },
    district: { color: '#475569', weight: 1.5, opacity: 0.85, fillOpacity: 0.02 },
    subdistrict: { color: '#64748b', weight: 0.8, opacity: 0.7, fillOpacity: 0.01, dashArray: '3 3' }
  },

  /* สีจุด HS แยกตามฤดูกาล (ต.ค.–ก.ย.) — โทนน้ำเงิน/ม่วง ไม่ซ้ำกับ 4 สีระดับความเสี่ยง (เขียว/เหลือง/ส้ม/แดง) ฤดูล่าสุดสีเข้มสุด */
  SEASON_COLORS: ['#1d4ed8', '#7c3aed', '#0e7490', '#a21caf', '#475569', '#4338ca'],

  RISK_LEVELS: [
    { label: 'ต่ำ', key: 'low', color: '#2ecc71', min: 0, max: 25, range: '0–24.9', desc: 'ครึ่งล่างของพื้นที่ทั้งหมด หรือไม่พบจุดความร้อน' },
    { label: 'ปานกลาง', key: 'medium', color: '#f1c40f', min: 25, max: 50, range: '25–49.9', desc: 'เสี่ยงกว่าครึ่งหนึ่งของพื้นที่' },
    { label: 'สูง', key: 'high', color: '#e67e22', min: 50, max: 75, range: '50–74.9', desc: 'อยู่ในกลุ่ม 25% ที่เสี่ยงที่สุด' },
    { label: 'สูงมาก', key: 'very-high', color: '#e74c3c', min: 75, max: 101, range: '75–100', desc: 'อยู่ในกลุ่ม 10% ที่เสี่ยงที่สุด' }
  ],
  /* ระดับความเสี่ยงคำนวณที่ Backend ด้วยดัชนี BRI (backend/Risk.gs) — หน้าเว็บรับเฉพาะผลระดับ 0–3 */
  PLANT_TYPES: ['นาข้าว', 'อ้อย', 'ข้าวโพดและไร่หมุนเวียน', 'เกษตรอื่น ๆ', 'พื้นที่ป่า', 'อื่น ๆ'],
  /* ประเภทพื้นที่รับผิดชอบ (LandType) — ค่าเริ่มต้นแสดงพื้นที่เกษตร · ALL = ทุกประเภท */
  LAND_TYPES: ['พื้นที่เกษตร', 'เขต สปก.', 'ป่าอนุรักษ์', 'ป่าสงวนแห่งชาติ', 'ชุมชนและอื่น ๆ', 'พื้นที่ริมทางหลวง'],
  DEFAULT_LAND: 'พื้นที่เกษตร',
  /* คู่มือ (PDF) — ใช้เมื่อไม่ได้ตั้งลิงก์คู่มือในหน้าตั้งค่า */
  GUIDE_PDF: 'docs/Agri-Risk-Manual.pdf',
  /* icon ชนิดพืช (SVG 24×24 เส้น currentColor) — ใช้บนแถบกรองแผนที่และรายละเอียดจุด */
  CROP_ICONS: {
    'นาข้าว': { short: 'นาข้าว', svg: '<path d="M7 22c1-6 3-11 8-15"/><path d="M15 7c1.6.6 2.8 2 3.2 4"/><ellipse cx="17.6" cy="13" rx="1.1" ry="1.8"/><ellipse cx="15.4" cy="11.2" rx="1.1" ry="1.8" transform="rotate(-25 15.4 11.2)"/><ellipse cx="13" cy="10" rx="1.1" ry="1.8" transform="rotate(-50 13 10)"/><ellipse cx="18.6" cy="16.4" rx="1" ry="1.6"/><path d="M8.5 17c-2-.6-3.6-2-4.3-4M10 13c-1.8-1-2.8-2.6-3-4.6"/>' },
    'อ้อย': { short: 'อ้อย', svg: '<path d="M9 22V3M15 22V6"/><path d="M7.5 8h3M7.5 13.5h3M7.5 19h3M13.5 11h3M13.5 16.5h3"/><path d="M9 5.5C7.5 4 5.5 3.6 3.5 4.2M15 8.5c1.6-1.6 3.6-2 5.6-1.4"/>' },
    'ข้าวโพดและไร่หมุนเวียน': { short: 'ข้าวโพดฯ', svg: '<path d="M12 3c2.4 0 3.8 3.2 3.8 8.2S14.4 19 12 19s-3.8-2.8-3.8-7.8S9.6 3 12 3z"/><path d="M8.6 8.5h6.8M8.3 12h7.4M8.8 15.5h6.4M12 3.5v15"/><path d="M8.3 13C5 14 3.6 17 3.6 21c3.2 0 6.2-1.4 8.4-3M15.7 13c3.3 1 4.7 4 4.7 8-3.2 0-6.2-1.4-8.4-3"/>' },
    'เกษตรอื่น ๆ': { short: 'เกษตรอื่น ๆ', svg: '<path d="M12 22v-9"/><path d="M12 13C12 8.5 9.2 6 4 6c0 4.8 3 7 8 7z"/><path d="M12 11c0-4 3-6.4 8-6.4 0 4.2-3 6.4-8 6.4z"/><path d="M8 22h8"/>' },
    'พื้นที่ป่า': { short: 'พื้นที่ป่า', svg: '<path d="M12 2.5 6.5 10h3L5.5 15.5h13L14.5 10h3z"/><path d="M12 15.5V21.5M9 21.5h6"/>' },
    'อื่น ๆ': { short: 'อื่น ๆ', svg: '<circle cx="6.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="17.5" cy="12" r="1.7"/>' }
  },
  MONTH_SHORT: ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
};

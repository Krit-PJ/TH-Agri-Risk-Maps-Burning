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
    { label: 'Green Gain Hub', title: 'Green Gain Hub — เชื่อมเกษตรกรผู้ขายเศษวัสดุการเกษตรกับผู้รับซื้อ', url: 'https://krit-pj.github.io/Green_Gain_Hub-KPP/' }
  ],

  BASEMAPS: {
    voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '© OpenStreetMap contributors © CARTO' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
    topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    print: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '© OpenStreetMap contributors © CARTO' }
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

  /* สีจุด HS แยกตามฤดูกาล (ต.ค.–ก.ย.) — ฤดูกาลล่าสุดใช้สีแดง */
  SEASON_COLORS: ['#ef4444', '#f59e0b', '#06b6d4', '#8b5cf6', '#14b8a6', '#ec4899'],

  RISK_LEVELS: [
    { label: 'ต่ำ', key: 'low', color: '#2ecc71', min: 0, max: 25, range: '0–24.9' },
    { label: 'ปานกลาง', key: 'medium', color: '#f1c40f', min: 25, max: 50, range: '25–49.9' },
    { label: 'สูง', key: 'high', color: '#e67e22', min: 50, max: 75, range: '50–74.9' },
    { label: 'สูงมาก', key: 'very-high', color: '#e74c3c', min: 75, max: 101, range: '75–100' }
  ],
  /* น้ำหนักฤดูกาล: ล่าสุด → ย้อนหลัง (ปรับให้รวมเป็น 1 อัตโนมัติ) */
  RISK_MODEL: { seasonWeights: [0.40, 0.35, 0.25, 0.15, 0.10], weights: { hotspot: 0.40, trend: 0.20, crop: 0.20, area: 0.20 } },
  CROP_RISK: { 'นาข้าว': 70, 'อ้อย': 80, 'ข้าวโพดและไร่หมุนเวียน': 90, 'เกษตรอื่น ๆ': 55, 'อื่น ๆ': 45 },
  PLANT_TYPES: ['นาข้าว', 'อ้อย', 'ข้าวโพดและไร่หมุนเวียน', 'เกษตรอื่น ๆ', 'อื่น ๆ'],
  MONTH_SHORT: ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
};

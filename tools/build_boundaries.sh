#!/usr/bin/env bash
# สร้างไฟล์ขอบเขตการปกครองจาก OpenGISData-Thailand (CC BY 4.0)
#   ใช้: bash tools/build_boundaries.sh /path/to/OpenGISData-Thailand
# อำเภอและจังหวัด (รายจังหวัด) สร้างโดยรวม (dissolve) จากตำบลที่ทำให้เรียบชุดเดียวกัน
# เส้นขอบทุกระดับจึงซ้อนทับกันพอดี
set -euo pipefail
SRC="${1:?ระบุโฟลเดอร์ OpenGISData-Thailand}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/data/boundary"
TMP="$(mktemp -d)"
mkdir -p "$OUT/province" "$TMP/d" "$TMP/s" "$TMP/p"
# 1) ภาพรวมประเทศ (หน้าแรก)
npx mapshaper "$SRC/provinces.geojson" -filter-fields pro_code,pro_th,pro_en,lat,lon \
  -simplify 9% keep-shapes -clean -o "$OUT/provinces.geojson" precision=0.0001 format=geojson force
# 2) ตำบลทั้งประเทศ ทำให้เรียบครั้งเดียว (รักษา topology)
npx mapshaper "$SRC/subdistricts.geojson" -filter-fields tam_code,tam_th,amp_code,amp_th,pro_code,area_sqkm \
  -simplify 15% keep-shapes -clean -o "$TMP/sub.json" precision=0.0001 format=geojson
# 3) แยกรายจังหวัด: ตำบล / อำเภอ (dissolve) / ขอบจังหวัด (dissolve)
npx mapshaper "$TMP/sub.json" -split pro_code -o "$TMP/s/" format=geojson precision=0.0001
npx mapshaper "$TMP/sub.json" -dissolve amp_code copy-fields=amp_th,pro_code sum-fields=area_sqkm \
  -split pro_code -o "$TMP/d/" format=geojson precision=0.0001
npx mapshaper "$TMP/sub.json" -dissolve pro_code sum-fields=area_sqkm -split pro_code -o "$TMP/p/" format=geojson precision=0.0001
for k in s:subdistrict d:district p:outline; do
  dir=${k%%:*}; name=${k##*:}
  for f in "$TMP/$dir"/*.json; do b=$(basename "$f" .json); mv "$f" "$OUT/province/$b.$name.geojson"; done
done
rm -rf "$TMP"
echo "เสร็จสิ้น: $OUT"

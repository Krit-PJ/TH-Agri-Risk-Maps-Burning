// Generated recovery config snapshot; run tools/sync_config_fallback.py after config changes.
window.AGRI_CONFIG_FALLBACK = {
  "system": {
    "schemaVersion": 1,
    "defaultProvinceCode": "",
    "currentYearBE": 2569,
    "provinceDefaults": {
      "defaultMapCenter": [
        13.5,
        101
      ],
      "defaultZoom": 6,
      "minZoom": 4,
      "maxZoom": 18,
      "boundaryPath": {
        "province": "data/boundary/{provinceCode}/province.geojson",
        "district": "data/boundary/{provinceCode}/districts.geojson",
        "subdistrict": "data/boundary/{provinceCode}/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/{provinceCode}/hotspot_2566.geojson",
        "2567": "data/hotspot/{provinceCode}/hotspot_2567.geojson",
        "2568": "data/hotspot/{provinceCode}/hotspot_2568.geojson",
        "2569": "data/hotspot/{provinceCode}/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/{provinceCode}/crop.geojson",
      "burnscarPath": "data/burnscar/{provinceCode}/burnscar.geojson",
      "dashboardTitle": "Agri-Risk Map Burning",
      "dashboardSubtitle": "ระบบประเมินและเฝ้าระวังความเสี่ยงการเผาในพื้นที่เกษตร จังหวัด{provinceNameTH}",
      "reportTitle": "Agri-Risk Map Burning",
      "organizationName": "สำนักงานเกษตรจังหวัด{provinceNameTH}",
      "developerCredit": "พัฒนาโดย ดร. กิตติ  โพธิ์จวง สำนักงานเกษตรจังหวัดกำแพงเพชร",
      "logoPath": "",
      "guideUrl": "docs/multi-province-guide.html",
      "enabledPlantTypes": [
        "นาข้าว",
        "อ้อย",
        "เกษตรอื่น ๆ",
        "อื่น ๆ"
      ],
      "allowedLandTypes": [
        "พื้นที่เกษตร"
      ],
      "fiscalYearStartMonth": 10,
      "defaultPeriodMode": "fiscal-to-latest",
      "legacyHotspots": false
    },
    "boundarySourceUrl": "https://drive.google.com/drive/folders/1DABxq44IWPg9odoIa_CdYeuDYUXCkyMv",
    "nationalBoundaryPath": {
      "province": null,
      "district": null,
      "subdistrict": null
    },
    "access": {
      "type": "static-browser-gate",
      "accounts": []
    },
    "legacyExampleProvinceCode": "62",
    "legacyExampleProvincePath": "data/boundary/operational-province.geojson"
  },
  "provinces": [
    {
      "provinceCode": "10",
      "provinceNameTH": "กรุงเทพมหานคร",
      "provinceNameEN": "Bangkok",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.771,
        100.622
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดกรุงเทพมหานคร",
      "boundaryPath": {
        "province": "data/boundary/10/province.geojson",
        "district": "data/boundary/10/districts.geojson",
        "subdistrict": "data/boundary/10/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/10/hotspot_2566.geojson",
        "2567": "data/hotspot/10/hotspot_2567.geojson",
        "2568": "data/hotspot/10/hotspot_2568.geojson",
        "2569": "data/hotspot/10/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/10/crop.geojson",
      "burnscarPath": "data/burnscar/10/burnscar.geojson"
    },
    {
      "provinceCode": "11",
      "provinceNameTH": "สมุทรปราการ",
      "provinceNameEN": "Samut Prakan",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.596,
        100.709
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดสมุทรปราการ",
      "boundaryPath": {
        "province": "data/boundary/11/province.geojson",
        "district": "data/boundary/11/districts.geojson",
        "subdistrict": "data/boundary/11/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/11/hotspot_2566.geojson",
        "2567": "data/hotspot/11/hotspot_2567.geojson",
        "2568": "data/hotspot/11/hotspot_2568.geojson",
        "2569": "data/hotspot/11/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/11/crop.geojson",
      "burnscarPath": "data/burnscar/11/burnscar.geojson"
    },
    {
      "provinceCode": "12",
      "provinceNameTH": "นนทบุรี",
      "provinceNameEN": "Nonthaburi",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.925,
        100.3921
      ],
      "defaultZoom": 11,
      "organizationName": "สำนักงานเกษตรจังหวัดนนทบุรี",
      "boundaryPath": {
        "province": "data/boundary/12/province.geojson",
        "district": "data/boundary/12/districts.geojson",
        "subdistrict": "data/boundary/12/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/12/hotspot_2566.geojson",
        "2567": "data/hotspot/12/hotspot_2567.geojson",
        "2568": "data/hotspot/12/hotspot_2568.geojson",
        "2569": "data/hotspot/12/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/12/crop.geojson",
      "burnscarPath": "data/burnscar/12/burnscar.geojson"
    },
    {
      "provinceCode": "13",
      "provinceNameTH": "ปทุมธานี",
      "provinceNameEN": "Pathum Thani",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.065,
        100.682
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดปทุมธานี",
      "boundaryPath": {
        "province": "data/boundary/13/province.geojson",
        "district": "data/boundary/13/districts.geojson",
        "subdistrict": "data/boundary/13/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/13/hotspot_2566.geojson",
        "2567": "data/hotspot/13/hotspot_2567.geojson",
        "2568": "data/hotspot/13/hotspot_2568.geojson",
        "2569": "data/hotspot/13/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/13/crop.geojson",
      "burnscarPath": "data/burnscar/13/burnscar.geojson"
    },
    {
      "provinceCode": "14",
      "provinceNameTH": "พระนครศรีอยุธยา",
      "provinceNameEN": "Phra Nakhon Si Ayutthaya",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.3452,
        100.5271
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดพระนครศรีอยุธยา",
      "boundaryPath": {
        "province": "data/boundary/14/province.geojson",
        "district": "data/boundary/14/districts.geojson",
        "subdistrict": "data/boundary/14/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/14/hotspot_2566.geojson",
        "2567": "data/hotspot/14/hotspot_2567.geojson",
        "2568": "data/hotspot/14/hotspot_2568.geojson",
        "2569": "data/hotspot/14/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/14/crop.geojson",
      "burnscarPath": "data/burnscar/14/burnscar.geojson"
    },
    {
      "provinceCode": "15",
      "provinceNameTH": "อ่างทอง",
      "provinceNameEN": "Ang Thong",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.624,
        100.3484
      ],
      "defaultZoom": 11,
      "organizationName": "สำนักงานเกษตรจังหวัดอ่างทอง",
      "boundaryPath": {
        "province": "data/boundary/15/province.geojson",
        "district": "data/boundary/15/districts.geojson",
        "subdistrict": "data/boundary/15/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/15/hotspot_2566.geojson",
        "2567": "data/hotspot/15/hotspot_2567.geojson",
        "2568": "data/hotspot/15/hotspot_2568.geojson",
        "2569": "data/hotspot/15/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/15/crop.geojson",
      "burnscarPath": "data/burnscar/15/burnscar.geojson"
    },
    {
      "provinceCode": "16",
      "provinceNameTH": "ลพบุรี",
      "provinceNameEN": "Lop Buri",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.109,
        100.9081
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดลพบุรี",
      "boundaryPath": {
        "province": "data/boundary/16/province.geojson",
        "district": "data/boundary/16/districts.geojson",
        "subdistrict": "data/boundary/16/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/16/hotspot_2566.geojson",
        "2567": "data/hotspot/16/hotspot_2567.geojson",
        "2568": "data/hotspot/16/hotspot_2568.geojson",
        "2569": "data/hotspot/16/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/16/crop.geojson",
      "burnscarPath": "data/burnscar/16/burnscar.geojson"
    },
    {
      "provinceCode": "17",
      "provinceNameTH": "สิงห์บุรี",
      "provinceNameEN": "Sing Buri",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.9121,
        100.3472
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดสิงห์บุรี",
      "boundaryPath": {
        "province": "data/boundary/17/province.geojson",
        "district": "data/boundary/17/districts.geojson",
        "subdistrict": "data/boundary/17/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/17/hotspot_2566.geojson",
        "2567": "data/hotspot/17/hotspot_2567.geojson",
        "2568": "data/hotspot/17/hotspot_2568.geojson",
        "2569": "data/hotspot/17/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/17/crop.geojson",
      "burnscarPath": "data/burnscar/17/burnscar.geojson"
    },
    {
      "provinceCode": "18",
      "provinceNameTH": "ชัยนาท",
      "provinceNameEN": "Chai Nat",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.1327,
        100.0279
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดชัยนาท",
      "boundaryPath": {
        "province": "data/boundary/18/province.geojson",
        "district": "data/boundary/18/districts.geojson",
        "subdistrict": "data/boundary/18/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/18/hotspot_2566.geojson",
        "2567": "data/hotspot/18/hotspot_2567.geojson",
        "2568": "data/hotspot/18/hotspot_2568.geojson",
        "2569": "data/hotspot/18/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/18/crop.geojson",
      "burnscarPath": "data/burnscar/18/burnscar.geojson"
    },
    {
      "provinceCode": "19",
      "provinceNameTH": "สระบุรี",
      "provinceNameEN": "Saraburi",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.6273,
        101.0169
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดสระบุรี",
      "boundaryPath": {
        "province": "data/boundary/19/province.geojson",
        "district": "data/boundary/19/districts.geojson",
        "subdistrict": "data/boundary/19/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/19/hotspot_2566.geojson",
        "2567": "data/hotspot/19/hotspot_2567.geojson",
        "2568": "data/hotspot/19/hotspot_2568.geojson",
        "2569": "data/hotspot/19/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/19/crop.geojson",
      "burnscarPath": "data/burnscar/19/burnscar.geojson"
    },
    {
      "provinceCode": "20",
      "provinceNameTH": "ชลบุรี",
      "provinceNameEN": "Chon Buri",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.1908,
        101.2025
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดชลบุรี",
      "boundaryPath": {
        "province": "data/boundary/20/province.geojson",
        "district": "data/boundary/20/districts.geojson",
        "subdistrict": "data/boundary/20/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/20/hotspot_2566.geojson",
        "2567": "data/hotspot/20/hotspot_2567.geojson",
        "2568": "data/hotspot/20/hotspot_2568.geojson",
        "2569": "data/hotspot/20/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/20/crop.geojson",
      "burnscarPath": "data/burnscar/20/burnscar.geojson"
    },
    {
      "provinceCode": "21",
      "provinceNameTH": "ระยอง",
      "provinceNameEN": "Rayong",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        12.8534,
        101.4289
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดระยอง",
      "boundaryPath": {
        "province": "data/boundary/21/province.geojson",
        "district": "data/boundary/21/districts.geojson",
        "subdistrict": "data/boundary/21/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/21/hotspot_2566.geojson",
        "2567": "data/hotspot/21/hotspot_2567.geojson",
        "2568": "data/hotspot/21/hotspot_2568.geojson",
        "2569": "data/hotspot/21/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/21/crop.geojson",
      "burnscarPath": "data/burnscar/21/burnscar.geojson"
    },
    {
      "provinceCode": "22",
      "provinceNameTH": "จันทบุรี",
      "provinceNameEN": "Chanthaburi",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        12.8807,
        102.1298
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดจันทบุรี",
      "boundaryPath": {
        "province": "data/boundary/22/province.geojson",
        "district": "data/boundary/22/districts.geojson",
        "subdistrict": "data/boundary/22/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/22/hotspot_2566.geojson",
        "2567": "data/hotspot/22/hotspot_2567.geojson",
        "2568": "data/hotspot/22/hotspot_2568.geojson",
        "2569": "data/hotspot/22/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/22/crop.geojson",
      "burnscarPath": "data/burnscar/22/burnscar.geojson"
    },
    {
      "provinceCode": "23",
      "provinceNameTH": "ตราด",
      "provinceNameEN": "Trat",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        12.3174,
        102.5206
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดตราด",
      "boundaryPath": {
        "province": "data/boundary/23/province.geojson",
        "district": "data/boundary/23/districts.geojson",
        "subdistrict": "data/boundary/23/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/23/hotspot_2566.geojson",
        "2567": "data/hotspot/23/hotspot_2567.geojson",
        "2568": "data/hotspot/23/hotspot_2568.geojson",
        "2569": "data/hotspot/23/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/23/crop.geojson",
      "burnscarPath": "data/burnscar/23/burnscar.geojson"
    },
    {
      "provinceCode": "24",
      "provinceNameTH": "ฉะเชิงเทรา",
      "provinceNameEN": "Chachoengsao",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.6064,
        101.4255
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดฉะเชิงเทรา",
      "boundaryPath": {
        "province": "data/boundary/24/province.geojson",
        "district": "data/boundary/24/districts.geojson",
        "subdistrict": "data/boundary/24/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/24/hotspot_2566.geojson",
        "2567": "data/hotspot/24/hotspot_2567.geojson",
        "2568": "data/hotspot/24/hotspot_2568.geojson",
        "2569": "data/hotspot/24/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/24/crop.geojson",
      "burnscarPath": "data/burnscar/24/burnscar.geojson"
    },
    {
      "provinceCode": "25",
      "provinceNameTH": "ปราจีนบุรี",
      "provinceNameEN": "Prachin Buri",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.0479,
        101.6481
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดปราจีนบุรี",
      "boundaryPath": {
        "province": "data/boundary/25/province.geojson",
        "district": "data/boundary/25/districts.geojson",
        "subdistrict": "data/boundary/25/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/25/hotspot_2566.geojson",
        "2567": "data/hotspot/25/hotspot_2567.geojson",
        "2568": "data/hotspot/25/hotspot_2568.geojson",
        "2569": "data/hotspot/25/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/25/crop.geojson",
      "burnscarPath": "data/burnscar/25/burnscar.geojson"
    },
    {
      "provinceCode": "26",
      "provinceNameTH": "นครนายก",
      "provinceNameEN": "Nakhon Nayok",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.2172,
        101.1711
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดนครนายก",
      "boundaryPath": {
        "province": "data/boundary/26/province.geojson",
        "district": "data/boundary/26/districts.geojson",
        "subdistrict": "data/boundary/26/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/26/hotspot_2566.geojson",
        "2567": "data/hotspot/26/hotspot_2567.geojson",
        "2568": "data/hotspot/26/hotspot_2568.geojson",
        "2569": "data/hotspot/26/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/26/crop.geojson",
      "burnscarPath": "data/burnscar/26/burnscar.geojson"
    },
    {
      "provinceCode": "27",
      "provinceNameTH": "สระแก้ว",
      "provinceNameEN": "Sa Kaeo",
      "regionName": "ภาคตะวันออก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.7885,
        102.322
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสระแก้ว",
      "boundaryPath": {
        "province": "data/boundary/27/province.geojson",
        "district": "data/boundary/27/districts.geojson",
        "subdistrict": "data/boundary/27/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/27/hotspot_2566.geojson",
        "2567": "data/hotspot/27/hotspot_2567.geojson",
        "2568": "data/hotspot/27/hotspot_2568.geojson",
        "2569": "data/hotspot/27/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/27/crop.geojson",
      "burnscarPath": "data/burnscar/27/burnscar.geojson"
    },
    {
      "provinceCode": "30",
      "provinceNameTH": "นครราชสีมา",
      "provinceNameEN": "Nakhon Ratchasima",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.9567,
        102.1097
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดนครราชสีมา",
      "boundaryPath": {
        "province": "data/boundary/30/province.geojson",
        "district": "data/boundary/30/districts.geojson",
        "subdistrict": "data/boundary/30/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/30/hotspot_2566.geojson",
        "2567": "data/hotspot/30/hotspot_2567.geojson",
        "2568": "data/hotspot/30/hotspot_2568.geojson",
        "2569": "data/hotspot/30/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/30/crop.geojson",
      "burnscarPath": "data/burnscar/30/burnscar.geojson"
    },
    {
      "provinceCode": "31",
      "provinceNameTH": "บุรีรัมย์",
      "provinceNameEN": "Buri Ram",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.8212,
        102.9571
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดบุรีรัมย์",
      "boundaryPath": {
        "province": "data/boundary/31/province.geojson",
        "district": "data/boundary/31/districts.geojson",
        "subdistrict": "data/boundary/31/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/31/hotspot_2566.geojson",
        "2567": "data/hotspot/31/hotspot_2567.geojson",
        "2568": "data/hotspot/31/hotspot_2568.geojson",
        "2569": "data/hotspot/31/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/31/crop.geojson",
      "burnscarPath": "data/burnscar/31/burnscar.geojson"
    },
    {
      "provinceCode": "32",
      "provinceNameTH": "สุรินทร์",
      "provinceNameEN": "Surin",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.8859,
        103.6555
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสุรินทร์",
      "boundaryPath": {
        "province": "data/boundary/32/province.geojson",
        "district": "data/boundary/32/districts.geojson",
        "subdistrict": "data/boundary/32/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/32/hotspot_2566.geojson",
        "2567": "data/hotspot/32/hotspot_2567.geojson",
        "2568": "data/hotspot/32/hotspot_2568.geojson",
        "2569": "data/hotspot/32/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/32/crop.geojson",
      "burnscarPath": "data/burnscar/32/burnscar.geojson"
    },
    {
      "provinceCode": "33",
      "provinceNameTH": "ศรีสะเกษ",
      "provinceNameEN": "Si Sa Ket",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.8564,
        104.3688
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดศรีสะเกษ",
      "boundaryPath": {
        "province": "data/boundary/33/province.geojson",
        "district": "data/boundary/33/districts.geojson",
        "subdistrict": "data/boundary/33/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/33/hotspot_2566.geojson",
        "2567": "data/hotspot/33/hotspot_2567.geojson",
        "2568": "data/hotspot/33/hotspot_2568.geojson",
        "2569": "data/hotspot/33/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/33/crop.geojson",
      "burnscarPath": "data/burnscar/33/burnscar.geojson"
    },
    {
      "provinceCode": "34",
      "provinceNameTH": "อุบลราชธานี",
      "provinceNameEN": "Ubon Ratchathani",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.1839,
        105.1109
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดอุบลราชธานี",
      "boundaryPath": {
        "province": "data/boundary/34/province.geojson",
        "district": "data/boundary/34/districts.geojson",
        "subdistrict": "data/boundary/34/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/34/hotspot_2566.geojson",
        "2567": "data/hotspot/34/hotspot_2567.geojson",
        "2568": "data/hotspot/34/hotspot_2568.geojson",
        "2569": "data/hotspot/34/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/34/crop.geojson",
      "burnscarPath": "data/burnscar/34/burnscar.geojson"
    },
    {
      "provinceCode": "35",
      "provinceNameTH": "ยโสธร",
      "provinceNameEN": "Yasothon",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.8956,
        104.3384
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดยโสธร",
      "boundaryPath": {
        "province": "data/boundary/35/province.geojson",
        "district": "data/boundary/35/districts.geojson",
        "subdistrict": "data/boundary/35/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/35/hotspot_2566.geojson",
        "2567": "data/hotspot/35/hotspot_2567.geojson",
        "2568": "data/hotspot/35/hotspot_2568.geojson",
        "2569": "data/hotspot/35/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/35/crop.geojson",
      "burnscarPath": "data/burnscar/35/burnscar.geojson"
    },
    {
      "provinceCode": "36",
      "provinceNameTH": "ชัยภูมิ",
      "provinceNameEN": "Chaiyaphum",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.0316,
        101.8173
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดชัยภูมิ",
      "boundaryPath": {
        "province": "data/boundary/36/province.geojson",
        "district": "data/boundary/36/districts.geojson",
        "subdistrict": "data/boundary/36/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/36/hotspot_2566.geojson",
        "2567": "data/hotspot/36/hotspot_2567.geojson",
        "2568": "data/hotspot/36/hotspot_2568.geojson",
        "2569": "data/hotspot/36/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/36/crop.geojson",
      "burnscarPath": "data/burnscar/36/burnscar.geojson"
    },
    {
      "provinceCode": "37",
      "provinceNameTH": "อำนาจเจริญ",
      "provinceNameEN": "Amnat Charoen",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.8923,
        104.7409
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดอำนาจเจริญ",
      "boundaryPath": {
        "province": "data/boundary/37/province.geojson",
        "district": "data/boundary/37/districts.geojson",
        "subdistrict": "data/boundary/37/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/37/hotspot_2566.geojson",
        "2567": "data/hotspot/37/hotspot_2567.geojson",
        "2568": "data/hotspot/37/hotspot_2568.geojson",
        "2569": "data/hotspot/37/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/37/crop.geojson",
      "burnscarPath": "data/burnscar/37/burnscar.geojson"
    },
    {
      "provinceCode": "38",
      "provinceNameTH": "บึงกาฬ",
      "provinceNameEN": "Bueng Kan",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.1486,
        103.7103
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดบึงกาฬ",
      "boundaryPath": {
        "province": "data/boundary/38/province.geojson",
        "district": "data/boundary/38/districts.geojson",
        "subdistrict": "data/boundary/38/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/38/hotspot_2566.geojson",
        "2567": "data/hotspot/38/hotspot_2567.geojson",
        "2568": "data/hotspot/38/hotspot_2568.geojson",
        "2569": "data/hotspot/38/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/38/crop.geojson",
      "burnscarPath": "data/burnscar/38/burnscar.geojson"
    },
    {
      "provinceCode": "39",
      "provinceNameTH": "หนองบัวลำภู",
      "provinceNameEN": "Nong Bua Lam Phu",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.182,
        102.3021
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดหนองบัวลำภู",
      "boundaryPath": {
        "province": "data/boundary/39/province.geojson",
        "district": "data/boundary/39/districts.geojson",
        "subdistrict": "data/boundary/39/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/39/hotspot_2566.geojson",
        "2567": "data/hotspot/39/hotspot_2567.geojson",
        "2568": "data/hotspot/39/hotspot_2568.geojson",
        "2569": "data/hotspot/39/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/39/crop.geojson",
      "burnscarPath": "data/burnscar/39/burnscar.geojson"
    },
    {
      "provinceCode": "40",
      "provinceNameTH": "ขอนแก่น",
      "provinceNameEN": "Khon Kaen",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.4086,
        102.5786
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดขอนแก่น",
      "boundaryPath": {
        "province": "data/boundary/40/province.geojson",
        "district": "data/boundary/40/districts.geojson",
        "subdistrict": "data/boundary/40/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/40/hotspot_2566.geojson",
        "2567": "data/hotspot/40/hotspot_2567.geojson",
        "2568": "data/hotspot/40/hotspot_2568.geojson",
        "2569": "data/hotspot/40/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/40/crop.geojson",
      "burnscarPath": "data/burnscar/40/burnscar.geojson"
    },
    {
      "provinceCode": "41",
      "provinceNameTH": "อุดรธานี",
      "provinceNameEN": "Udon Thani",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.4251,
        102.8632
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดอุดรธานี",
      "boundaryPath": {
        "province": "data/boundary/41/province.geojson",
        "district": "data/boundary/41/districts.geojson",
        "subdistrict": "data/boundary/41/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/41/hotspot_2566.geojson",
        "2567": "data/hotspot/41/hotspot_2567.geojson",
        "2568": "data/hotspot/41/hotspot_2568.geojson",
        "2569": "data/hotspot/41/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/41/crop.geojson",
      "burnscarPath": "data/burnscar/41/burnscar.geojson"
    },
    {
      "provinceCode": "42",
      "provinceNameTH": "เลย",
      "provinceNameEN": "Loei",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.4086,
        101.6351
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดเลย",
      "boundaryPath": {
        "province": "data/boundary/42/province.geojson",
        "district": "data/boundary/42/districts.geojson",
        "subdistrict": "data/boundary/42/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/42/hotspot_2566.geojson",
        "2567": "data/hotspot/42/hotspot_2567.geojson",
        "2568": "data/hotspot/42/hotspot_2568.geojson",
        "2569": "data/hotspot/42/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/42/crop.geojson",
      "burnscarPath": "data/burnscar/42/burnscar.geojson"
    },
    {
      "provinceCode": "43",
      "provinceNameTH": "หนองคาย",
      "provinceNameEN": "Nong Khai",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.9402,
        102.8333
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดหนองคาย",
      "boundaryPath": {
        "province": "data/boundary/43/province.geojson",
        "district": "data/boundary/43/districts.geojson",
        "subdistrict": "data/boundary/43/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/43/hotspot_2566.geojson",
        "2567": "data/hotspot/43/hotspot_2567.geojson",
        "2568": "data/hotspot/43/hotspot_2568.geojson",
        "2569": "data/hotspot/43/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/43/crop.geojson",
      "burnscarPath": "data/burnscar/43/burnscar.geojson"
    },
    {
      "provinceCode": "44",
      "provinceNameTH": "มหาสารคาม",
      "provinceNameEN": "Maha Sarakham",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.9998,
        103.1654
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดมหาสารคาม",
      "boundaryPath": {
        "province": "data/boundary/44/province.geojson",
        "district": "data/boundary/44/districts.geojson",
        "subdistrict": "data/boundary/44/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/44/hotspot_2566.geojson",
        "2567": "data/hotspot/44/hotspot_2567.geojson",
        "2568": "data/hotspot/44/hotspot_2568.geojson",
        "2569": "data/hotspot/44/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/44/crop.geojson",
      "burnscarPath": "data/burnscar/44/burnscar.geojson"
    },
    {
      "provinceCode": "45",
      "provinceNameTH": "ร้อยเอ็ด",
      "provinceNameEN": "Roi Et",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.9196,
        103.8133
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดร้อยเอ็ด",
      "boundaryPath": {
        "province": "data/boundary/45/province.geojson",
        "district": "data/boundary/45/districts.geojson",
        "subdistrict": "data/boundary/45/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/45/hotspot_2566.geojson",
        "2567": "data/hotspot/45/hotspot_2567.geojson",
        "2568": "data/hotspot/45/hotspot_2568.geojson",
        "2569": "data/hotspot/45/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/45/crop.geojson",
      "burnscarPath": "data/burnscar/45/burnscar.geojson"
    },
    {
      "provinceCode": "46",
      "provinceNameTH": "กาฬสินธุ์",
      "provinceNameEN": "Kalasin",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.6281,
        103.6218
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดกาฬสินธุ์",
      "boundaryPath": {
        "province": "data/boundary/46/province.geojson",
        "district": "data/boundary/46/districts.geojson",
        "subdistrict": "data/boundary/46/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/46/hotspot_2566.geojson",
        "2567": "data/hotspot/46/hotspot_2567.geojson",
        "2568": "data/hotspot/46/hotspot_2568.geojson",
        "2569": "data/hotspot/46/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/46/crop.geojson",
      "burnscarPath": "data/burnscar/46/burnscar.geojson"
    },
    {
      "provinceCode": "47",
      "provinceNameTH": "สกลนคร",
      "provinceNameEN": "Sakon Nakhon",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.3899,
        103.8243
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสกลนคร",
      "boundaryPath": {
        "province": "data/boundary/47/province.geojson",
        "district": "data/boundary/47/districts.geojson",
        "subdistrict": "data/boundary/47/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/47/hotspot_2566.geojson",
        "2567": "data/hotspot/47/hotspot_2567.geojson",
        "2568": "data/hotspot/47/hotspot_2568.geojson",
        "2569": "data/hotspot/47/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/47/crop.geojson",
      "burnscarPath": "data/burnscar/47/burnscar.geojson"
    },
    {
      "provinceCode": "48",
      "provinceNameTH": "นครพนม",
      "provinceNameEN": "Nakhon Phanom",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.3838,
        104.4287
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดนครพนม",
      "boundaryPath": {
        "province": "data/boundary/48/province.geojson",
        "district": "data/boundary/48/districts.geojson",
        "subdistrict": "data/boundary/48/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/48/hotspot_2566.geojson",
        "2567": "data/hotspot/48/hotspot_2567.geojson",
        "2568": "data/hotspot/48/hotspot_2568.geojson",
        "2569": "data/hotspot/48/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/48/crop.geojson",
      "burnscarPath": "data/burnscar/48/burnscar.geojson"
    },
    {
      "provinceCode": "49",
      "provinceNameTH": "มุกดาหาร",
      "provinceNameEN": "Mukdahan",
      "regionName": "ภาคตะวันออกเฉียงเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.5617,
        104.5175
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดมุกดาหาร",
      "boundaryPath": {
        "province": "data/boundary/49/province.geojson",
        "district": "data/boundary/49/districts.geojson",
        "subdistrict": "data/boundary/49/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/49/hotspot_2566.geojson",
        "2567": "data/hotspot/49/hotspot_2567.geojson",
        "2568": "data/hotspot/49/hotspot_2568.geojson",
        "2569": "data/hotspot/49/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/49/crop.geojson",
      "burnscarPath": "data/burnscar/49/burnscar.geojson"
    },
    {
      "provinceCode": "50",
      "provinceNameTH": "เชียงใหม่",
      "provinceNameEN": "Chiang Mai",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.7911,
        98.7276
      ],
      "defaultZoom": 8,
      "organizationName": "สำนักงานเกษตรจังหวัดเชียงใหม่",
      "boundaryPath": {
        "province": "data/boundary/50/province.geojson",
        "district": "data/boundary/50/districts.geojson",
        "subdistrict": "data/boundary/50/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/50/hotspot_2566.geojson",
        "2567": "data/hotspot/50/hotspot_2567.geojson",
        "2568": "data/hotspot/50/hotspot_2568.geojson",
        "2569": "data/hotspot/50/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/50/crop.geojson",
      "burnscarPath": "data/burnscar/50/burnscar.geojson"
    },
    {
      "provinceCode": "51",
      "provinceNameTH": "ลำพูน",
      "provinceNameEN": "Lamphun",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.1191,
        98.9546
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดลำพูน",
      "boundaryPath": {
        "province": "data/boundary/51/province.geojson",
        "district": "data/boundary/51/districts.geojson",
        "subdistrict": "data/boundary/51/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/51/hotspot_2566.geojson",
        "2567": "data/hotspot/51/hotspot_2567.geojson",
        "2568": "data/hotspot/51/hotspot_2568.geojson",
        "2569": "data/hotspot/51/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/51/crop.geojson",
      "burnscarPath": "data/burnscar/51/burnscar.geojson"
    },
    {
      "provinceCode": "52",
      "provinceNameTH": "ลำปาง",
      "provinceNameEN": "Lampang",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.3274,
        99.5122
      ],
      "defaultZoom": 8,
      "organizationName": "สำนักงานเกษตรจังหวัดลำปาง",
      "boundaryPath": {
        "province": "data/boundary/52/province.geojson",
        "district": "data/boundary/52/districts.geojson",
        "subdistrict": "data/boundary/52/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/52/hotspot_2566.geojson",
        "2567": "data/hotspot/52/hotspot_2567.geojson",
        "2568": "data/hotspot/52/hotspot_2568.geojson",
        "2569": "data/hotspot/52/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/52/crop.geojson",
      "burnscarPath": "data/burnscar/52/burnscar.geojson"
    },
    {
      "provinceCode": "53",
      "provinceNameTH": "อุตรดิตถ์",
      "provinceNameEN": "Uttaradit",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.7497,
        100.5169
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดอุตรดิตถ์",
      "boundaryPath": {
        "province": "data/boundary/53/province.geojson",
        "district": "data/boundary/53/districts.geojson",
        "subdistrict": "data/boundary/53/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/53/hotspot_2566.geojson",
        "2567": "data/hotspot/53/hotspot_2567.geojson",
        "2568": "data/hotspot/53/hotspot_2568.geojson",
        "2569": "data/hotspot/53/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/53/crop.geojson",
      "burnscarPath": "data/burnscar/53/burnscar.geojson"
    },
    {
      "provinceCode": "54",
      "provinceNameTH": "แพร่",
      "provinceNameEN": "Phrae",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.1998,
        100.0648
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดแพร่",
      "boundaryPath": {
        "province": "data/boundary/54/province.geojson",
        "district": "data/boundary/54/districts.geojson",
        "subdistrict": "data/boundary/54/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/54/hotspot_2566.geojson",
        "2567": "data/hotspot/54/hotspot_2567.geojson",
        "2568": "data/hotspot/54/hotspot_2568.geojson",
        "2569": "data/hotspot/54/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/54/crop.geojson",
      "burnscarPath": "data/burnscar/54/burnscar.geojson"
    },
    {
      "provinceCode": "55",
      "provinceNameTH": "น่าน",
      "provinceNameEN": "Nan",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.8509,
        100.8351
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดน่าน",
      "boundaryPath": {
        "province": "data/boundary/55/province.geojson",
        "district": "data/boundary/55/districts.geojson",
        "subdistrict": "data/boundary/55/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/55/hotspot_2566.geojson",
        "2567": "data/hotspot/55/hotspot_2567.geojson",
        "2568": "data/hotspot/55/hotspot_2568.geojson",
        "2569": "data/hotspot/55/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/55/crop.geojson",
      "burnscarPath": "data/burnscar/55/burnscar.geojson"
    },
    {
      "provinceCode": "56",
      "provinceNameTH": "พะเยา",
      "provinceNameEN": "Phayao",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        19.2344,
        100.1914
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดพะเยา",
      "boundaryPath": {
        "province": "data/boundary/56/province.geojson",
        "district": "data/boundary/56/districts.geojson",
        "subdistrict": "data/boundary/56/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/56/hotspot_2566.geojson",
        "2567": "data/hotspot/56/hotspot_2567.geojson",
        "2568": "data/hotspot/56/hotspot_2568.geojson",
        "2569": "data/hotspot/56/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/56/crop.geojson",
      "burnscarPath": "data/burnscar/56/burnscar.geojson"
    },
    {
      "provinceCode": "57",
      "provinceNameTH": "เชียงราย",
      "provinceNameEN": "Chiang Rai",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        19.8473,
        99.866
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดเชียงราย",
      "boundaryPath": {
        "province": "data/boundary/57/province.geojson",
        "district": "data/boundary/57/districts.geojson",
        "subdistrict": "data/boundary/57/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/57/hotspot_2566.geojson",
        "2567": "data/hotspot/57/hotspot_2567.geojson",
        "2568": "data/hotspot/57/hotspot_2568.geojson",
        "2569": "data/hotspot/57/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/57/crop.geojson",
      "burnscarPath": "data/burnscar/57/burnscar.geojson"
    },
    {
      "provinceCode": "58",
      "provinceNameTH": "แม่ฮ่องสอน",
      "provinceNameEN": "Mae Hong Son",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "defaultMapCenter": [
        18.811,
        98.0307
      ],
      "defaultZoom": 8,
      "organizationName": "สำนักงานเกษตรจังหวัดแม่ฮ่องสอน",
      "boundaryPath": {
        "province": "data/boundary/58/province.geojson",
        "district": "data/boundary/58/districts.geojson",
        "subdistrict": "data/boundary/58/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/58/hotspot_2566.geojson",
        "2567": "data/hotspot/58/hotspot_2567.geojson",
        "2568": "data/hotspot/58/hotspot_2568.geojson",
        "2569": "data/hotspot/58/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/58/crop.geojson",
      "burnscarPath": "data/burnscar/58/burnscar.geojson"
    },
    {
      "provinceCode": "60",
      "provinceNameTH": "นครสวรรค์",
      "provinceNameEN": "Nakhon Sawan",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.6836,
        100.1498
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดนครสวรรค์",
      "boundaryPath": {
        "province": "data/boundary/60/province.geojson",
        "district": "data/boundary/60/districts.geojson",
        "subdistrict": "data/boundary/60/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/60/hotspot_2566.geojson",
        "2567": "data/hotspot/60/hotspot_2567.geojson",
        "2568": "data/hotspot/60/hotspot_2568.geojson",
        "2569": "data/hotspot/60/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/60/crop.geojson",
      "burnscarPath": "data/burnscar/60/burnscar.geojson"
    },
    {
      "provinceCode": "61",
      "provinceNameTH": "อุทัยธานี",
      "provinceNameEN": "Uthai Thani",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        15.3494,
        99.4776
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดอุทัยธานี",
      "boundaryPath": {
        "province": "data/boundary/61/province.geojson",
        "district": "data/boundary/61/districts.geojson",
        "subdistrict": "data/boundary/61/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/61/hotspot_2566.geojson",
        "2567": "data/hotspot/61/hotspot_2567.geojson",
        "2568": "data/hotspot/61/hotspot_2568.geojson",
        "2569": "data/hotspot/61/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/61/crop.geojson",
      "burnscarPath": "data/burnscar/61/burnscar.geojson"
    },
    {
      "provinceCode": "62",
      "provinceNameTH": "กำแพงเพชร",
      "provinceNameEN": "Kamphaeng Phet",
      "regionName": "ภาคเหนือ",
      "dataStatus": "installed",
      "aliases": [
        "Kampaeng Phet"
      ],
      "defaultMapCenter": [
        16.47,
        99.52
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดกำแพงเพชร",
      "developerCredit": "พัฒนาโดย ดร. กิตติ  โพธิ์จวง สำนักงานเกษตรจังหวัดกำแพงเพชร",
      "logoPath": "assets/logo-kpp.jpg",
      "guideUrl": "https://drive.google.com/drive/folders/1KAWXj3XS3tW6b-HqznqV-IZT_LwAzhVy?usp=sharing",
      "districtOrder": [
        "เมืองกำแพงเพชร",
        "ไทรงาม",
        "คลองลาน",
        "ขาณุวรลักษบุรี",
        "คลองขลุง",
        "พรานกระต่าย",
        "ลานกระบือ",
        "ทรายทองวัฒนา",
        "ปางศิลาทอง",
        "บึงสามัคคี",
        "โกสัมพีนคร"
      ],
      "boundaryPath": {
        "province": null,
        "district": "data/boundary/district_kpt.geojson",
        "subdistrict": "data/boundary/subdistrict_kpt.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/hotspot_2566.geojson",
        "2567": "data/hotspot/hotspot_2567.geojson",
        "2568": "data/hotspot/hotspot_2568.geojson",
        "2569": "data/hotspot/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/crop_kpt.geojson",
      "burnscarPath": "data/burnscar/burnscar_kpt.geojson",
      "legacyHotspots": true,
      "minZoom": 7
    },
    {
      "provinceCode": "63",
      "provinceNameTH": "ตาก",
      "provinceNameEN": "Tak",
      "regionName": "ภาคตะวันตก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.7187,
        98.7931
      ],
      "defaultZoom": 8,
      "organizationName": "สำนักงานเกษตรจังหวัดตาก",
      "boundaryPath": {
        "province": "data/boundary/63/province.geojson",
        "district": "data/boundary/63/districts.geojson",
        "subdistrict": "data/boundary/63/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/63/hotspot_2566.geojson",
        "2567": "data/hotspot/63/hotspot_2567.geojson",
        "2568": "data/hotspot/63/hotspot_2568.geojson",
        "2569": "data/hotspot/63/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/63/crop.geojson",
      "burnscarPath": "data/burnscar/63/burnscar.geojson"
    },
    {
      "provinceCode": "64",
      "provinceNameTH": "สุโขทัย",
      "provinceNameEN": "Sukhothai",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        17.2636,
        99.7111
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสุโขทัย",
      "boundaryPath": {
        "province": "data/boundary/64/province.geojson",
        "district": "data/boundary/64/districts.geojson",
        "subdistrict": "data/boundary/64/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/64/hotspot_2566.geojson",
        "2567": "data/hotspot/64/hotspot_2567.geojson",
        "2568": "data/hotspot/64/hotspot_2568.geojson",
        "2569": "data/hotspot/64/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/64/crop.geojson",
      "burnscarPath": "data/burnscar/64/burnscar.geojson"
    },
    {
      "provinceCode": "65",
      "provinceNameTH": "พิษณุโลก",
      "provinceNameEN": "Phitsanulok",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.983,
        100.543
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดพิษณุโลก",
      "boundaryPath": {
        "province": "data/boundary/65/province.geojson",
        "district": "data/boundary/65/districts.geojson",
        "subdistrict": "data/boundary/65/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/65/hotspot_2566.geojson",
        "2567": "data/hotspot/65/hotspot_2567.geojson",
        "2568": "data/hotspot/65/hotspot_2568.geojson",
        "2569": "data/hotspot/65/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/65/crop.geojson",
      "burnscarPath": "data/burnscar/65/burnscar.geojson"
    },
    {
      "provinceCode": "66",
      "provinceNameTH": "พิจิตร",
      "provinceNameEN": "Phichit",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.2597,
        100.343
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดพิจิตร",
      "boundaryPath": {
        "province": "data/boundary/66/province.geojson",
        "district": "data/boundary/66/districts.geojson",
        "subdistrict": "data/boundary/66/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/66/hotspot_2566.geojson",
        "2567": "data/hotspot/66/hotspot_2567.geojson",
        "2568": "data/hotspot/66/hotspot_2568.geojson",
        "2569": "data/hotspot/66/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/66/crop.geojson",
      "burnscarPath": "data/burnscar/66/burnscar.geojson"
    },
    {
      "provinceCode": "67",
      "provinceNameTH": "เพชรบูรณ์",
      "provinceNameEN": "Phetchabun",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        16.2781,
        101.1465
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดเพชรบูรณ์",
      "boundaryPath": {
        "province": "data/boundary/67/province.geojson",
        "district": "data/boundary/67/districts.geojson",
        "subdistrict": "data/boundary/67/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/67/hotspot_2566.geojson",
        "2567": "data/hotspot/67/hotspot_2567.geojson",
        "2568": "data/hotspot/67/hotspot_2568.geojson",
        "2569": "data/hotspot/67/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/67/crop.geojson",
      "burnscarPath": "data/burnscar/67/burnscar.geojson"
    },
    {
      "provinceCode": "70",
      "provinceNameTH": "ราชบุรี",
      "provinceNameEN": "Ratchaburi",
      "regionName": "ภาคตะวันตก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.5346,
        99.5779
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดราชบุรี",
      "boundaryPath": {
        "province": "data/boundary/70/province.geojson",
        "district": "data/boundary/70/districts.geojson",
        "subdistrict": "data/boundary/70/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/70/hotspot_2566.geojson",
        "2567": "data/hotspot/70/hotspot_2567.geojson",
        "2568": "data/hotspot/70/hotspot_2568.geojson",
        "2569": "data/hotspot/70/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/70/crop.geojson",
      "burnscarPath": "data/burnscar/70/burnscar.geojson"
    },
    {
      "provinceCode": "71",
      "provinceNameTH": "กาญจนบุรี",
      "provinceNameEN": "Kanchanaburi",
      "regionName": "ภาคตะวันตก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.5842,
        99.0479
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดกาญจนบุรี",
      "boundaryPath": {
        "province": "data/boundary/71/province.geojson",
        "district": "data/boundary/71/districts.geojson",
        "subdistrict": "data/boundary/71/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/71/hotspot_2566.geojson",
        "2567": "data/hotspot/71/hotspot_2567.geojson",
        "2568": "data/hotspot/71/hotspot_2568.geojson",
        "2569": "data/hotspot/71/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/71/crop.geojson",
      "burnscarPath": "data/burnscar/71/burnscar.geojson"
    },
    {
      "provinceCode": "72",
      "provinceNameTH": "สุพรรณบุรี",
      "provinceNameEN": "Suphan Buri",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        14.6089,
        99.8919
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสุพรรณบุรี",
      "boundaryPath": {
        "province": "data/boundary/72/province.geojson",
        "district": "data/boundary/72/districts.geojson",
        "subdistrict": "data/boundary/72/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/72/hotspot_2566.geojson",
        "2567": "data/hotspot/72/hotspot_2567.geojson",
        "2568": "data/hotspot/72/hotspot_2568.geojson",
        "2569": "data/hotspot/72/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/72/crop.geojson",
      "burnscarPath": "data/burnscar/72/burnscar.geojson"
    },
    {
      "provinceCode": "73",
      "provinceNameTH": "นครปฐม",
      "provinceNameEN": "Nakhon Pathom",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.9243,
        100.1026
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดนครปฐม",
      "boundaryPath": {
        "province": "data/boundary/73/province.geojson",
        "district": "data/boundary/73/districts.geojson",
        "subdistrict": "data/boundary/73/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/73/hotspot_2566.geojson",
        "2567": "data/hotspot/73/hotspot_2567.geojson",
        "2568": "data/hotspot/73/hotspot_2568.geojson",
        "2569": "data/hotspot/73/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/73/crop.geojson",
      "burnscarPath": "data/burnscar/73/burnscar.geojson"
    },
    {
      "provinceCode": "74",
      "provinceNameTH": "สมุทรสาคร",
      "provinceNameEN": "Samut Sakhon",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.5689,
        100.2124
      ],
      "defaultZoom": 11,
      "organizationName": "สำนักงานเกษตรจังหวัดสมุทรสาคร",
      "boundaryPath": {
        "province": "data/boundary/74/province.geojson",
        "district": "data/boundary/74/districts.geojson",
        "subdistrict": "data/boundary/74/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/74/hotspot_2566.geojson",
        "2567": "data/hotspot/74/hotspot_2567.geojson",
        "2568": "data/hotspot/74/hotspot_2568.geojson",
        "2569": "data/hotspot/74/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/74/crop.geojson",
      "burnscarPath": "data/burnscar/74/burnscar.geojson"
    },
    {
      "provinceCode": "75",
      "provinceNameTH": "สมุทรสงคราม",
      "provinceNameEN": "Samut Songkhram",
      "regionName": "ภาคกลาง",
      "dataStatus": "installed",
      "defaultMapCenter": [
        13.397,
        99.9534
      ],
      "defaultZoom": 11,
      "organizationName": "สำนักงานเกษตรจังหวัดสมุทรสงคราม",
      "boundaryPath": {
        "province": "data/boundary/75/province.geojson",
        "district": "data/boundary/75/districts.geojson",
        "subdistrict": "data/boundary/75/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/75/hotspot_2566.geojson",
        "2567": "data/hotspot/75/hotspot_2567.geojson",
        "2568": "data/hotspot/75/hotspot_2568.geojson",
        "2569": "data/hotspot/75/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/75/crop.geojson",
      "burnscarPath": "data/burnscar/75/burnscar.geojson"
    },
    {
      "provinceCode": "76",
      "provinceNameTH": "เพชรบุรี",
      "provinceNameEN": "Phetchaburi",
      "regionName": "ภาคตะวันตก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        12.9471,
        99.6188
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดเพชรบุรี",
      "boundaryPath": {
        "province": "data/boundary/76/province.geojson",
        "district": "data/boundary/76/districts.geojson",
        "subdistrict": "data/boundary/76/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/76/hotspot_2566.geojson",
        "2567": "data/hotspot/76/hotspot_2567.geojson",
        "2568": "data/hotspot/76/hotspot_2568.geojson",
        "2569": "data/hotspot/76/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/76/crop.geojson",
      "burnscarPath": "data/burnscar/76/burnscar.geojson"
    },
    {
      "provinceCode": "77",
      "provinceNameTH": "ประจวบคีรีขันธ์",
      "provinceNameEN": "Prachuap Khiri Khan",
      "regionName": "ภาคตะวันตก",
      "dataStatus": "installed",
      "defaultMapCenter": [
        11.9466,
        99.6351
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดประจวบคีรีขันธ์",
      "boundaryPath": {
        "province": "data/boundary/77/province.geojson",
        "district": "data/boundary/77/districts.geojson",
        "subdistrict": "data/boundary/77/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/77/hotspot_2566.geojson",
        "2567": "data/hotspot/77/hotspot_2567.geojson",
        "2568": "data/hotspot/77/hotspot_2568.geojson",
        "2569": "data/hotspot/77/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/77/crop.geojson",
      "burnscarPath": "data/burnscar/77/burnscar.geojson"
    },
    {
      "provinceCode": "80",
      "provinceNameTH": "นครศรีธรรมราช",
      "provinceNameEN": "Nakhon Si Thammarat",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        8.3794,
        99.7868
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดนครศรีธรรมราช",
      "boundaryPath": {
        "province": "data/boundary/80/province.geojson",
        "district": "data/boundary/80/districts.geojson",
        "subdistrict": "data/boundary/80/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/80/hotspot_2566.geojson",
        "2567": "data/hotspot/80/hotspot_2567.geojson",
        "2568": "data/hotspot/80/hotspot_2568.geojson",
        "2569": "data/hotspot/80/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/80/crop.geojson",
      "burnscarPath": "data/burnscar/80/burnscar.geojson"
    },
    {
      "provinceCode": "81",
      "provinceNameTH": "กระบี่",
      "provinceNameEN": "Krabi",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        8.1412,
        99.0074
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดกระบี่",
      "boundaryPath": {
        "province": "data/boundary/81/province.geojson",
        "district": "data/boundary/81/districts.geojson",
        "subdistrict": "data/boundary/81/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/81/hotspot_2566.geojson",
        "2567": "data/hotspot/81/hotspot_2567.geojson",
        "2568": "data/hotspot/81/hotspot_2568.geojson",
        "2569": "data/hotspot/81/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/81/crop.geojson",
      "burnscarPath": "data/burnscar/81/burnscar.geojson"
    },
    {
      "provinceCode": "82",
      "provinceNameTH": "พังงา",
      "provinceNameEN": "Phang Nga",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        8.6762,
        98.4169
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดพังงา",
      "boundaryPath": {
        "province": "data/boundary/82/province.geojson",
        "district": "data/boundary/82/districts.geojson",
        "subdistrict": "data/boundary/82/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/82/hotspot_2566.geojson",
        "2567": "data/hotspot/82/hotspot_2567.geojson",
        "2568": "data/hotspot/82/hotspot_2568.geojson",
        "2569": "data/hotspot/82/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/82/crop.geojson",
      "burnscarPath": "data/burnscar/82/burnscar.geojson"
    },
    {
      "provinceCode": "83",
      "provinceNameTH": "ภูเก็ต",
      "provinceNameEN": "Phuket",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        7.9704,
        98.3457
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดภูเก็ต",
      "boundaryPath": {
        "province": "data/boundary/83/province.geojson",
        "district": "data/boundary/83/districts.geojson",
        "subdistrict": "data/boundary/83/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/83/hotspot_2566.geojson",
        "2567": "data/hotspot/83/hotspot_2567.geojson",
        "2568": "data/hotspot/83/hotspot_2568.geojson",
        "2569": "data/hotspot/83/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/83/crop.geojson",
      "burnscarPath": "data/burnscar/83/burnscar.geojson"
    },
    {
      "provinceCode": "84",
      "provinceNameTH": "สุราษฎร์ธานี",
      "provinceNameEN": "Surat Thani",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        9.0513,
        99.0893
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสุราษฎร์ธานี",
      "boundaryPath": {
        "province": "data/boundary/84/province.geojson",
        "district": "data/boundary/84/districts.geojson",
        "subdistrict": "data/boundary/84/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/84/hotspot_2566.geojson",
        "2567": "data/hotspot/84/hotspot_2567.geojson",
        "2568": "data/hotspot/84/hotspot_2568.geojson",
        "2569": "data/hotspot/84/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/84/crop.geojson",
      "burnscarPath": "data/burnscar/84/burnscar.geojson"
    },
    {
      "provinceCode": "85",
      "provinceNameTH": "ระนอง",
      "provinceNameEN": "Ranong",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        9.9706,
        98.6992
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดระนอง",
      "boundaryPath": {
        "province": "data/boundary/85/province.geojson",
        "district": "data/boundary/85/districts.geojson",
        "subdistrict": "data/boundary/85/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/85/hotspot_2566.geojson",
        "2567": "data/hotspot/85/hotspot_2567.geojson",
        "2568": "data/hotspot/85/hotspot_2568.geojson",
        "2569": "data/hotspot/85/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/85/crop.geojson",
      "burnscarPath": "data/burnscar/85/burnscar.geojson"
    },
    {
      "provinceCode": "86",
      "provinceNameTH": "ชุมพร",
      "provinceNameEN": "Chumphon",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        10.3447,
        99.0616
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดชุมพร",
      "boundaryPath": {
        "province": "data/boundary/86/province.geojson",
        "district": "data/boundary/86/districts.geojson",
        "subdistrict": "data/boundary/86/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/86/hotspot_2566.geojson",
        "2567": "data/hotspot/86/hotspot_2567.geojson",
        "2568": "data/hotspot/86/hotspot_2568.geojson",
        "2569": "data/hotspot/86/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/86/crop.geojson",
      "burnscarPath": "data/burnscar/86/burnscar.geojson"
    },
    {
      "provinceCode": "90",
      "provinceNameTH": "สงขลา",
      "provinceNameEN": "Songkhla",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        6.9342,
        100.5456
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสงขลา",
      "boundaryPath": {
        "province": "data/boundary/90/province.geojson",
        "district": "data/boundary/90/districts.geojson",
        "subdistrict": "data/boundary/90/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/90/hotspot_2566.geojson",
        "2567": "data/hotspot/90/hotspot_2567.geojson",
        "2568": "data/hotspot/90/hotspot_2568.geojson",
        "2569": "data/hotspot/90/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/90/crop.geojson",
      "burnscarPath": "data/burnscar/90/burnscar.geojson"
    },
    {
      "provinceCode": "91",
      "provinceNameTH": "สตูล",
      "provinceNameEN": "Satun",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        6.8347,
        99.9282
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดสตูล",
      "boundaryPath": {
        "province": "data/boundary/91/province.geojson",
        "district": "data/boundary/91/districts.geojson",
        "subdistrict": "data/boundary/91/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/91/hotspot_2566.geojson",
        "2567": "data/hotspot/91/hotspot_2567.geojson",
        "2568": "data/hotspot/91/hotspot_2568.geojson",
        "2569": "data/hotspot/91/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/91/crop.geojson",
      "burnscarPath": "data/burnscar/91/burnscar.geojson"
    },
    {
      "provinceCode": "92",
      "provinceNameTH": "ตรัง",
      "provinceNameEN": "Trang",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        7.5441,
        99.5951
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดตรัง",
      "boundaryPath": {
        "province": "data/boundary/92/province.geojson",
        "district": "data/boundary/92/districts.geojson",
        "subdistrict": "data/boundary/92/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/92/hotspot_2566.geojson",
        "2567": "data/hotspot/92/hotspot_2567.geojson",
        "2568": "data/hotspot/92/hotspot_2568.geojson",
        "2569": "data/hotspot/92/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/92/crop.geojson",
      "burnscarPath": "data/burnscar/92/burnscar.geojson"
    },
    {
      "provinceCode": "93",
      "provinceNameTH": "พัทลุง",
      "provinceNameEN": "Phatthalung",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        7.5163,
        100.0701
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดพัทลุง",
      "boundaryPath": {
        "province": "data/boundary/93/province.geojson",
        "district": "data/boundary/93/districts.geojson",
        "subdistrict": "data/boundary/93/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/93/hotspot_2566.geojson",
        "2567": "data/hotspot/93/hotspot_2567.geojson",
        "2568": "data/hotspot/93/hotspot_2568.geojson",
        "2569": "data/hotspot/93/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/93/crop.geojson",
      "burnscarPath": "data/burnscar/93/burnscar.geojson"
    },
    {
      "provinceCode": "94",
      "provinceNameTH": "ปัตตานี",
      "provinceNameEN": "Pattani",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        6.7306,
        101.3498
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดปัตตานี",
      "boundaryPath": {
        "province": "data/boundary/94/province.geojson",
        "district": "data/boundary/94/districts.geojson",
        "subdistrict": "data/boundary/94/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/94/hotspot_2566.geojson",
        "2567": "data/hotspot/94/hotspot_2567.geojson",
        "2568": "data/hotspot/94/hotspot_2568.geojson",
        "2569": "data/hotspot/94/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/94/crop.geojson",
      "burnscarPath": "data/burnscar/94/burnscar.geojson"
    },
    {
      "provinceCode": "95",
      "provinceNameTH": "ยะลา",
      "provinceNameEN": "Yala",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        6.1905,
        101.228
      ],
      "defaultZoom": 9,
      "organizationName": "สำนักงานเกษตรจังหวัดยะลา",
      "boundaryPath": {
        "province": "data/boundary/95/province.geojson",
        "district": "data/boundary/95/districts.geojson",
        "subdistrict": "data/boundary/95/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/95/hotspot_2566.geojson",
        "2567": "data/hotspot/95/hotspot_2567.geojson",
        "2568": "data/hotspot/95/hotspot_2568.geojson",
        "2569": "data/hotspot/95/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/95/crop.geojson",
      "burnscarPath": "data/burnscar/95/burnscar.geojson"
    },
    {
      "provinceCode": "96",
      "provinceNameTH": "นราธิวาส",
      "provinceNameEN": "Narathiwat",
      "regionName": "ภาคใต้",
      "dataStatus": "installed",
      "defaultMapCenter": [
        6.1779,
        101.7185
      ],
      "defaultZoom": 10,
      "organizationName": "สำนักงานเกษตรจังหวัดนราธิวาส",
      "boundaryPath": {
        "province": "data/boundary/96/province.geojson",
        "district": "data/boundary/96/districts.geojson",
        "subdistrict": "data/boundary/96/subdistricts.geojson"
      },
      "hotspotPath": {
        "2566": "data/hotspot/96/hotspot_2566.geojson",
        "2567": "data/hotspot/96/hotspot_2567.geojson",
        "2568": "data/hotspot/96/hotspot_2568.geojson",
        "2569": "data/hotspot/96/hotspot_2569.geojson"
      },
      "cropPath": "data/crop/96/crop.geojson",
      "burnscarPath": "data/burnscar/96/burnscar.geojson"
    }
  ],
  "active": {
    "activeProvinceCode": ""
  },
  "risk": {
    "description": "Default operational model; not a national standard",
    "yearWeights": {
      "2566": 0.15,
      "2567": 0.25,
      "2568": 0.35,
      "2569": 0.4
    },
    "weights": {
      "hotspot": 0.4,
      "trend": 0.2,
      "crop": 0.2,
      "area": 0.2
    },
    "levels": [
      {
        "label": "ต่ำ",
        "class": "risk-low",
        "color": "#2ecc71",
        "min": 0,
        "max": 25
      },
      {
        "label": "ปานกลาง",
        "class": "risk-medium",
        "color": "#f1c40f",
        "min": 25,
        "max": 50
      },
      {
        "label": "สูง",
        "class": "risk-high",
        "color": "#e67e22",
        "min": 50,
        "max": 75
      },
      {
        "label": "สูงมาก",
        "class": "risk-very-high",
        "color": "#e74c3c",
        "min": 75,
        "max": 101
      }
    ],
    "cropScores": {
      "นาข้าว": 70,
      "อ้อย": 80,
      "ข้าวโพดและไร่หมุนเวียน": 90,
      "เกษตรอื่น ๆ": 55,
      "พื้นที่ป่า": 95,
      "อื่น ๆ": 45
    },
    "annualEvidenceGate": {
      "lowMaxCount": 2,
      "mediumMaxCount": 5,
      "highMaxCount": 10,
      "lowBase": 5,
      "lowStep": 10,
      "mediumBase": 25,
      "mediumSpan": 15,
      "highBase": 50,
      "highSpan": 15,
      "veryHighBase": 75,
      "veryHighLogScale": 7,
      "veryHighSpan": 20,
      "exposureWeight": 0.09,
      "veryHighExposureWeight": 0.05,
      "caps": [
        24.99,
        49.99,
        74.99,
        100
      ],
      "floors": [
        0,
        25,
        50,
        75
      ]
    },
    "highCoverageRule": {
      "enabled": false,
      "reason": "No such rule exists in the audited operational engine"
    },
    "aggregationRule": {
      "district": "recompute-from-hotspots",
      "province": "distribution-of-district-risk"
    },
    "emptyCropType": "อื่น ๆ"
  },
  "importRules": {
    "schemaVersion": 1,
    "preferredDetailSheet": "AllData",
    "requiredFields": [
      "Province",
      "LandType",
      "PlantType"
    ],
    "dateFields": [
      "YYYY-MM-DD",
      "Date",
      "acq_date"
    ],
    "coordinateFields": [
      [
        "Longitude",
        "Latitude"
      ],
      [
        "longitude",
        "latitude"
      ],
      [
        "Maps"
      ],
      [
        "X",
        "Y"
      ]
    ],
    "deduplicate": "hsID-or-date-time-coordinate",
    "plantAliases": {
      "ข้าว": "นาข้าว",
      "เกษตรอื่นๆ": "เกษตรอื่น ๆ",
      "อื่นๆ": "อื่น ๆ",
      "อื่น": "อื่น ๆ"
    },
    "landAliases": {
      "พื้นที่เกษตรกรรม": "พื้นที่เกษตร"
    },
    "referenceSheet": "hsPlant2026",
    "plantContains": [
      {
        "contains": "ข้าวโพด",
        "value": "ข้าวโพดและไร่หมุนเวียน"
      },
      {
        "contains": "อ้อย",
        "value": "อ้อย"
      },
      {
        "contains": "ป่า",
        "value": "พื้นที่ป่า"
      }
    ]
  }
};

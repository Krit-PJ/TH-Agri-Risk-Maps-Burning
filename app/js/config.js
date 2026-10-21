const CONFIG = {
  MAP_CENTER: [], MAP_ZOOM: 9, MAP_MIN_ZOOM: 4, MAP_MAX_ZOOM: 18,
  CURRENT_YEAR_BE: null, DATA: {},
  BASEMAPS: {
    osm:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  },
  YEAR_COLORS:{2566:'#8b5cf6',2567:'#06b6d4',2568:'#f59e0b',2569:'#ef4444'},
  YEAR_COLOR_FALLBACK:['#ef4444','#f59e0b','#06b6d4','#8b5cf6','#14b8a6'],
  RISK_LEVELS:[], RISK_MODEL:{}, CROP_RISK:{},
  VISITOR_COUNTER:{endpoint:''}
};

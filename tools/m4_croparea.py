import json, numpy as np, rasterio, glob
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_bounds
B='/home/claude/app/data/boundary'; P17=['50','51','52','53','54','55','56','57','58','60','61','62','63','64','65','66','67']
feats=[]; codes=[]
for p in P17:
    for x in json.load(open(f'{B}/province/{p}.subdistrict.geojson'))['features']:
        codes.append(x['properties']['tam_code']); feats.append(x['geometry'])
idx={c:i+1 for i,c in enumerate(codes)}
crop=np.zeros(len(codes)+1); tot=np.zeros(len(codes)+1)
F=4  # 40 m
for t in sorted(glob.glob('/mnt/user-data/uploads/KPP_Agri-Dashboard-work/agri-risk-data/worldcover/*.tif')):
    with rasterio.open(t) as r:
        h,w=r.height//F, r.width//F
        a=r.read(1,out_shape=(h,w),resampling=Resampling.nearest)
        tr=from_bounds(*r.bounds,w,h)
    lab=rasterize([(g,idx[c]) for g,c in zip(feats,codes)], out_shape=(h,w), transform=tr, fill=0, dtype='int32')
    lat=np.linspace(r.bounds.top, r.bounds.bottom, h)
    px=(abs(tr.a)*111320*np.cos(np.radians(lat)))[:,None]*(abs(tr.e)*110574)  # m2 per pixel by row
    px=np.broadcast_to(px,(h,w))
    m=lab>0
    tot+=np.bincount(lab[m],weights=px[m],minlength=len(codes)+1)
    c=m&(a==40)
    crop+=np.bincount(lab[c],weights=px[c],minlength=len(codes)+1)
    print(t.split('/')[-1], h, w, m.sum())
out={c:(crop[i+1]/1600, tot[i+1]/1600) for i,c in enumerate(codes)}   # rai
json.dump(out,open('/tmp/claude-0/-home-claude/db6930ef-5b83-5fef-8382-75e3a38d5b9c/scratchpad/an/crop_rai.json','w'))
v=np.array(list(out.values())); print('tambons',len(out),'crop rai total %.0f'%v[:,0].sum(),'covered rai %.0f'%v[:,1].sum(), 'zero-crop tambons', (v[:,0]<1).sum())

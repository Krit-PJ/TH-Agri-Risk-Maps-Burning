import json, numpy as np, pandas as pd
A='/tmp/claude-0/-home-claude/db6930ef-5b83-5fef-8382-75e3a38d5b9c/scratchpad/an'
B='/home/claude/app/data/boundary'; P17=['50','51','52','53','54','55','56','57','58','60','61','62','63','64','65','66','67']
cr=json.load(open(f'{A}/crop_rai.json'))
U=[]
for p in P17:
    for x in json.load(open(f'{B}/province/{p}.subdistrict.geojson'))['features']:
        q=x['properties']; U.append(dict(prov=p, code=q['tam_code'], amp=q['amp_code'], crop=round(cr[q['tam_code']][0])))
U=pd.DataFrame(U)
n=pd.read_pickle(f'{A}/firms/north17_full.pkl')
f=n[n.agri & ~n.dup & (n.sat=='N')].copy()
loc=pd.to_datetime(f.utc)+pd.Timedelta(hours=7)
f['d']=loc.dt.strftime('%Y-%m-%d'); f['lat']=f.lat.round(4); f['lng']=f.lon.round(4)
COS=np.cos(np.radians(17))
f['k']=np.floor(f.lng*111320*COS/500).astype(int).astype(str)+'_'+np.floor(f.lat*110574/500).astype(int).astype(str)+'_'+f.d
y=f.d.str[:4].astype(int); m=f.d.str[5:7].astype(int); f['season']=np.where(m>=10,y+544,y+543)
g=f.drop_duplicates('k')
def units(s): return U.code.map(g[g.season==s].groupby('tam_code').size()).fillna(0).values
u={s:units(s) for s in (2567,2568,2569)}
E=U.crop.values/1000.0; ok=E>=0.001   # per 1,000 rai cropland
# central EB params from base seasons 2567-2568 (per-season rates, pooled)
o=np.concatenate([u[2567][ok],u[2568][ok]]); Ee=np.concatenate([E[ok],E[ok]])
r=o/Ee; mu=o.sum()/Ee.sum(); s2=max(np.average((r-mu)**2,weights=Ee)-mu/Ee.mean(),1e-9)
def ebR(o,E):
    Bk=mu/(mu+s2*E); R=Bk*mu+(1-Bk)*(o/E); R[o<=0]=0; return R
base=np.sort(ebR(o,Ee))
def score(R):
    lo=np.searchsorted(base,R,'left'); hi=np.searchsorted(base,R,'right'); s=(lo+hi)/2/len(base)*100; s[R<=0]=0; return s
q=np.quantile(base,np.linspace(0,1,201))   # 201 quantiles stored for the app
def score_q(R):  # same as app: interpolate over quantiles (percent)
    s=np.interp(R,q,np.linspace(0,100,201)); s[R<=0]=0; return s
SW=[0.40,0.35,0.25]
def hist_rate(seasons):
    w=np.array(SW[:len(seasons)]); w=w/w.sum(); o=sum(wi*u[s] for wi,s in zip(w,seasons)); return o
# test: history 2568,2567 -> predict 2569
oh=hist_rate([2568,2567]); R=np.zeros(len(U)); R[ok]=ebR(oh[ok],E[ok]); S=np.full(len(U),-1.0); S[ok]=score_q(R[ok])
def capture(score,target,area,b):
    o_=np.argsort(-score,kind='stable'); cum=np.cumsum(area[o_])/area.sum(); return target[o_[cum<=b]].sum()/target.sum()
crop=U.crop.values.astype(float)
print('mu %.4f s2 %.4f base n %d zero share %.3f'%(mu,s2,len(base),(base==0).mean()))
print('TEST 2569 capture top10%% crop area %.3f  20%% %.3f'%(capture(S,u[2569],crop,.1),capture(S,u[2569],crop,.2)))
lv=np.select([S<0,S<50,S<75,S<90],[-1,0,1,2],3)
for L in (-1,0,1,2,3): print('level',L,'tambons',(lv==L).sum(),'crop share %.3f'%(crop[lv==L].sum()/crop.sum()),'next-season units share %.3f'%(u[2569][lv==L].sum()/u[2569].sum()))
# current scoring 2570 (history 2569,2568,2567)
oh3=hist_rate([2569,2568,2567]); R3=np.zeros(len(U)); R3[ok]=ebR(oh3[ok],E[ok]); S3=np.full(len(U),-1.0); S3[ok]=score_q(R3[ok])
U['score2570']=S3.round(1); U['H']=R3.round(3)
print(U[U.prov=='62'].sort_values('score2570',ascending=False).head(8))
json.dump(dict(version='M4-2569.1', base=[2567,2568], sat='Suomi-NPP', grid=500, mu=mu, s2=s2, q=[round(x,5) for x in q]), open(f'{A}/m4_base.json','w'))
U.to_pickle(f'{A}/m4_units.pkl')

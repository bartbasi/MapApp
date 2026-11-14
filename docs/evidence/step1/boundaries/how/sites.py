import json, sys
out=[]
def polys(g):
    return [g['coordinates']] if g['type']=='Polygon' else g['coordinates']
want={'il-champaign':{76684:'university',76642:'state',135681:'local'},'il-macon':{70469:'county_district',105981:'local',164852:'state'}}
for c,w in want.items():
    d=json.load(open(f'data/cache/padus/{c}.geojson',encoding='utf-8'))
    for f in d['features']:
        p=f['properties']
        if p['OBJECTID'] in w:
            out.append({'name':p['Unit_Nm'],'manager':p['Mang_Name'],'source':'PAD-US OBJECTID %d'%p['OBJECTID'],'expectId':p['OBJECTID'],'expectCategory':w[p['OBJECTID']],'polygons':polys(f['geometry'])})
d=json.load(open('data/cache/ccrpc-greenways/data.geojson',encoding='utf-8'))
for f in d['features']:
    p=f['properties']
    if p['objectid']=='164':
        out.append({'name':p['name'],'manager':p['agency_responsible'],'source':'CCRPC objectid 164','expectId':1000000164,'expectCategory':'county_district','polygons':polys(f['geometry'])})
for s in out:
    xs=[pt[0] for poly in s['polygons'] for ring in poly for pt in ring]; ys=[pt[1] for poly in s['polygons'] for ring in poly for pt in ring]
    s['bbox']=[min(xs),min(ys),max(xs),max(ys)]
    print(s['name'],s['expectCategory'],len(xs),s['bbox'])
json.dump(out,open(sys.argv[1],'w'))

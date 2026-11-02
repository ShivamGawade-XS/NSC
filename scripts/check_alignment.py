import urllib.request
import json

payload = {
    'dataset_id': 'merra2_reanalysis',
    'variable_id': 'T2M',
    'start_year': 2000,
    'end_year': 2023,
    'bbox': [-100.0, 30.0, -95.0, 35.0]
}

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/analysis',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
res = urllib.request.urlopen(req)
data = json.loads(res.read())
aid = data['analysis_id']

# 1. Check grid points
grid = data['grid']
print(f"Total grid points in analysis: {len(grid)}")

# 2. Check signals
sigs_req = urllib.request.Request(f'http://127.0.0.1:8000/api/v1/analysis/{aid}/signals')
sigs = json.loads(urllib.request.urlopen(sigs_req).read())['signals']
print(f"Signals count: {len(sigs)}")
for idx, s in enumerate(sigs[:3]):
    print(f"Signal #{idx+1}: lat={s['lat']}, lon={s['lon']}, slope={s['slope']}, p_value={s['p_value']}, q_value={s['q_value']}")

# 3. Check cell detail for top signal
top_s = sigs[0]
cell_url = f"http://127.0.0.1:8000/api/v1/analysis/{aid}/cell?lat={top_s['lat']}&lon={top_s['lon']}"
cell_res = json.loads(urllib.request.urlopen(cell_url).read())
print(f"\nCell detail from /cell?lat={top_s['lat']}&lon={top_s['lon']}:")
print(f"lat={cell_res['lat']}, lon={cell_res['lon']}, slope={cell_res['slope']}, p_value={cell_res['p_value']}, q_value={cell_res['q_value']}")

# 4. Check matching grid point
matching_gp = [g for g in grid if abs(g['lat'] - top_s['lat']) < 1e-4 and abs(g['lon'] - top_s['lon']) < 1e-4]
if matching_gp:
    g = matching_gp[0]
    print(f"\nMatching grid point from /analysis.grid:")
    print(f"lat={g['lat']}, lon={g['lon']}, slope={g['slope']}, p_value={g['p_value']}, q_value={g['q_value']}")

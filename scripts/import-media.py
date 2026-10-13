import concurrent.futures,hashlib,json,subprocess
from pathlib import Path
manifest=json.loads(Path('media-manifest.json').read_text())
def download(item):
 path=Path('dist')/item['path'];path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']:return
 tmp=path.with_name(path.name+'.download')
 subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','3','--max-time','180','https://meinguyen-co.foamycurry3.chatgpt.site/'+item['path'],'--output',str(tmp)],check=True)
 if hashlib.sha256(tmp.read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Media checksum mismatch: '+item['path'])
 tmp.replace(path)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(download,manifest))
print('Verified',len(manifest),'media files')

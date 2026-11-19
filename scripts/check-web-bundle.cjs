const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||'dist';
if(!fs.existsSync(path.join(root,'assets')))throw Error('Build assets are missing');
const external=[];
for(const name of fs.readdirSync(path.join(root,'assets'))){if(!name.endsWith('.js'))continue;const source=fs.readFileSync(path.join(root,'assets',name),'utf8');if(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-/.test(source))external.push(name);}
if(external.length){console.error('Firebase must be bundled locally; external SDK modules found: '+external.join(', '));process.exitCode=1;}else console.log('Web bundle verified: no external Firebase SDK modules');
// Follow only static imports: other language packs must stay outside startup.
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.vite/manifest.json'),'utf8'));
for(const locale of Object.keys(JSON.parse(fs.readFileSync('locales/catalogs.json','utf8'))).filter(code=>code!=='ko'&&code!=='en')){
 if(!manifest[`locales/split/${locale}.json`]?.isDynamicEntry)throw Error(`Missing on-demand language pack: ${locale}`);
}
for(const [key,entry]of Object.entries(manifest).filter(([,entry])=>entry.isEntry)){
 const seen=new Set();
 function visit(key){if(seen.has(key))return;seen.add(key);for(const dependency of manifest[key].imports||[])visit(dependency);}
 visit(key);
 for(const dependency of seen){
  if(/locales\/(catalogs\.json|split\/(?!en\.json)[^/]+\.json)/.test(dependency))throw Error(`Language pack included at startup: ${key} -> ${dependency}`);
 }
 // Catches catalogs merged directly into a shared chunk as well.
 const i18n=[...seen].filter(key=>/i18n-/.test(manifest[key].file));
 for(const key of i18n)if(fs.statSync(path.join(root,manifest[key].file)).size>100_000)throw Error('Initial i18n chunk exceeds 100 kB');
}
console.log('Web bundle verified: language packs load on demand');

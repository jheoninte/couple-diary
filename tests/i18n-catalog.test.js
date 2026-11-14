import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const catalogs=JSON.parse(fs.readFileSync(path.join(root,'locales/catalogs.json'),'utf8'));
const PH=/\{[a-zA-Z]+\}|<\/?[a-z]+>/g;
const sig=(s)=>(s.match(PH)||[]).sort().join(',');

test('every locale preserves placeholders and HTML tags of the Korean source',()=>{
  const locales=Object.keys(catalogs);
  assert.ok(locales.length>=17);
  const bad=[];
  for(const loc of locales){
    for(const [key,val] of Object.entries(catalogs[loc]||{})){
      if(sig(key)!==sig(val)) bad.push(`${loc}: ${key}`);
    }
  }
  assert.deepEqual(bad,[]);
});

test('all user-facing strings outside legal pages have translations',()=>{
  const r=spawnSync(process.execPath,['scripts/check-i18n-coverage.cjs'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);
});

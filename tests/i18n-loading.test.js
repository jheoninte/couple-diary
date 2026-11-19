import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {loadLocale,translate} from '../i18n-core.js';

test('language loading falls back to English, retries failures and shares in-flight imports',async()=>{
 let fail=true,requests=0;
 const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier.endsWith('/split/ja.json')){
   requests++;
   if(fail){fail=false;throw Error('Language download unavailable');}
  }
  return next(specifier,context);
 }});
 try{
  assert.equal(translate('로그인','ja'),'Log in');
  await assert.rejects(loadLocale('ja'),/download unavailable/);
  assert.equal(translate('로그인','ja'),'Log in');
  await Promise.all([loadLocale('ja'),loadLocale('ja')]);
  assert.equal(requests,2);
  assert.equal(translate('로그인','ja'),'ログイン');
  await loadLocale('ja');assert.equal(requests,2);
  await assert.rejects(loadLocale('../catalogs'),RangeError);
 }finally{hooks.deregister();}
});

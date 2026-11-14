const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('the app window uses DiaryViewController so the StoreKit plugin is registered',()=>{
 assert.match(read('ios/App/App/SceneDelegate.swift'),/rootViewController = DiaryViewController\(\)/);
 assert.match(read('ios/App/App/DiaryViewController.swift'),/registerPluginInstance\(DiaryStore\(\)\)/);
 assert.match(read('scripts/configure-ios.cjs'),/rootViewController = DiaryViewController\(\)/);
});
test('StoreKit products include amount and currency for the Plus screen',()=>{const s=read('ios/App/App/DiaryStore.swift');assert.match(s,/"amount":/);assert.match(s,/"currency":/);});
test('pages never zoom like a web page',()=>{for(const f of fs.readdirSync('.').filter(n=>n.endsWith('.html')))assert.match(read(f),/maximum-scale=1, user-scalable=no/,f);assert.match(read('ios/App/App/DiaryViewController.swift'),/pinchGestureRecognizer\?\.isEnabled = false/);});

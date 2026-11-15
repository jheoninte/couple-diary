const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('the app window uses DiaryViewController so the StoreKit plugin is registered',()=>{
 assert.match(read('ios/App/App/SceneDelegate.swift'),/rootViewController = DiaryViewController\(\)/);
 assert.match(read('ios/App/App/DiaryViewController.swift'),/registerPluginInstance\(DiaryStore\(\)\)/);
 assert.match(read('scripts/configure-ios.cjs'),/rootViewController = DiaryViewController\(\)/);
});
test('StoreKit products include amount and currency for the Plus screen',()=>{const s=read('ios/App/App/DiaryStore.swift');assert.match(s,/"amount":/);assert.match(s,/"currency":/);});
test('pages never zoom like a web page',()=>{for(const f of fs.readdirSync('.').filter(n=>n.endsWith('.html')))assert.match(read(f),/maximum-scale=1, user-scalable=no/,f);assert.match(read('ios/App/App/DiaryViewController.swift'),/pinchGestureRecognizer\?\.isEnabled = false/);});
test('push notifications: plugin registered, delegate set at launch, entitlement configured',()=>{
 assert.match(read('ios/App/App/DiaryViewController.swift'),/registerPluginInstance\(DiaryPush\(\)\)/);
 assert.match(read('ios/App/App/AppDelegate.swift'),/UNUserNotificationCenter\.current\(\)\.delegate = DiaryPushCenter\.shared/);
 assert.match(read('ios/App/App/AppDelegate.swift'),/didRegisterForRemoteNotificationsWithDeviceToken/);
 assert.match(read('ios/App/App/App.entitlements'),/aps-environment/);
 const project=read('ios/App/App.xcodeproj/project.pbxproj');
 assert.match(project,/DiaryPush\.swift in Sources/);assert.equal(project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g).length,2);
 assert.match(read('scripts/configure-ios.cjs'),/'DiaryPush\.swift'/);
});

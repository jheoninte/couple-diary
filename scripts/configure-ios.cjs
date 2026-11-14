const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root='ios/App/App',plist=root+'/Info.plist';
function set(key,type,value){spawnSync('/usr/libexec/PlistBuddy',['-c',`Delete :${key}`,plist]);const r=spawnSync('/usr/libexec/PlistBuddy',['-c',`Add :${key} ${type} ${value}`,plist],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const publicConfig=fs.readFileSync('native-config.js','utf8');
const appId=publicConfig.match(/\badmobAppId:\s*'([^']+)'/)?.[1];
if(!/^ca-app-pub-\d{16}~\d{10}$/.test(appId||''))throw Error('Invalid AdMob app ID');
set('GADApplicationIdentifier','string',appId);
set('NSUserTrackingUsageDescription','string','광고 제공과 광고 성과 측정을 위해 기기 식별자를 사용할 수 있습니다. 허용하지 않아도 일기를 이용할 수 있습니다.');
set('ITSAppUsesNonExemptEncryption','bool','false');
set('CFBundleDevelopmentRegion','string','ko');
const sb=root+'/Base.lproj/Main.storyboard';fs.writeFileSync(sb,fs.readFileSync(sb,'utf8').replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="DiaryViewController" customModule="App"'));
const p='ios/App/App.xcodeproj/project.pbxproj';let s=fs.readFileSync(p,'utf8');
for(const [i,name] of ['DiaryStore.swift','DiaryViewController.swift'].entries()){
 const file=`D1A00000000000000000000${i}`,build=`D1A10000000000000000000${i}`;if(s.includes(file))continue;
 s=s.replace('/* End PBXBuildFile section */',`${build} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${file}; };\n/* End PBXBuildFile section */`);
 s=s.replace('/* End PBXFileReference section */',`${file} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`);
 s=s.replace('504EC3071FED79650016851F /* AppDelegate.swift */,',`504EC3071FED79650016851F /* AppDelegate.swift */,\n${file} /* ${name} */,`);
 s=s.replace('504EC3081FED79650016851F /* AppDelegate.swift in Sources */,',`504EC3081FED79650016851F /* AppDelegate.swift in Sources */,\n${build} /* ${name} in Sources */,`);
}
fs.writeFileSync(p,s);console.log('iOS plugin registered; verified AdMob account app ID configured.');

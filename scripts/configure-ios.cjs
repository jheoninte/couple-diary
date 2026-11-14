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
fs.writeFileSync(p,s);

// Localized app name and tracking prompt (ko/en/ja). Other languages fall back to English.
const strings={
 ko:{CFBundleDisplayName:'우리의 공간',NSUserTrackingUsageDescription:'광고 제공과 광고 성과 측정을 위해 기기 식별자를 사용할 수 있습니다. 허용하지 않아도 일기를 이용할 수 있습니다.'},
 en:{CFBundleDisplayName:'Our Diary',NSUserTrackingUsageDescription:'Your device identifier may be used to show ads and measure ad performance. You can use the diary even if you choose not to allow it.'},
 ja:{CFBundleDisplayName:'今日のふたり',NSUserTrackingUsageDescription:'広告の表示と広告効果の測定のために、端末の識別子を使用することがあります。許可しなくても日記はご利用いただけます。'}
};
{
 let proj=fs.readFileSync(p,'utf8');
 const esc=(v)=>v.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
 const ids={ko:['D1B00000000000000000000A','D1B00000000000000000001A'],en:['D1B00000000000000000000B','D1B00000000000000000001B'],ja:['D1B00000000000000000000C','D1B00000000000000000001C']};
 for(const [lang,vals] of Object.entries(strings)){
  fs.mkdirSync(`${root}/${lang}.lproj`,{recursive:true});
  fs.writeFileSync(`${root}/${lang}.lproj/InfoPlist.strings`,Object.entries(vals).map(([k,v])=>`"${k}" = "${esc(v)}";`).join('\n')+'\n');
 }
 const group='D1B0000000000000000000AA',build='D1B0000000000000000001AA';
 if(!proj.includes(group)){
  const refs=Object.keys(strings).map(l=>`\t\t${ids[l][0]} /* ${l} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${l}; path = ${l}.lproj/InfoPlist.strings; sourceTree = "<group>"; };`).join('\n');
  proj=proj.replace('/* End PBXFileReference section */',refs+'\n/* End PBXFileReference section */');
  proj=proj.replace('/* End PBXBuildFile section */',`\t\t${build} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${group} /* InfoPlist.strings */; };\n/* End PBXBuildFile section */`);
  const children=Object.keys(strings).map(l=>`\t\t\t\t${ids[l][0]} /* ${l} */,`).join('\n');
  proj=proj.replace('/* End PBXVariantGroup section */',`\t\t${group} /* InfoPlist.strings */ = {\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n${children}\n\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t};\n/* End PBXVariantGroup section */`);
  proj=proj.replace('504EC3101FED79650016851F /* LaunchScreen.storyboard */,',`504EC3101FED79650016851F /* LaunchScreen.storyboard */,\n\t\t\t\t${group} /* InfoPlist.strings */,`);
  proj=proj.replace('504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,',`504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\t${build} /* InfoPlist.strings in Resources */,`);
  proj=proj.replace(/knownRegions = \(\s*en,\s*Base,\s*\);/,'knownRegions = (\n\t\t\t\ten,\n\t\t\t\tko,\n\t\t\t\tja,\n\t\t\t\tBase,\n\t\t\t);');
  fs.writeFileSync(p,proj);
 }
 spawnSync('/usr/libexec/PlistBuddy',['-c','Delete :CFBundleLocalizations',plist]);
 for(const c of ['Add :CFBundleLocalizations array','Add :CFBundleLocalizations:0 string ko','Add :CFBundleLocalizations:1 string en','Add :CFBundleLocalizations:2 string ja'])spawnSync('/usr/libexec/PlistBuddy',['-c',c,plist]);
}
console.log('iOS plugin registered; verified AdMob account app ID configured.');

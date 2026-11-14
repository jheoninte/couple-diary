import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import {resolveFirebaseEnvironment} from './firebase-environment.js';
const {emulator,config}=resolveFirebaseEnvironment({hostname:location.hostname,search:location.search,native:window.Capacitor?.isNativePlatform?.()===true,env:import.meta.env||{}});
export const app = initializeApp(config);
// Email/password needs no OAuth iframe. getAuth proactively waits for that iframe on iOS.
export const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});
auth.languageCode = window.diaryI18n?.getLocale?.()||navigator.language||'en';
window.addEventListener('diary:language-changed',event=>{auth.languageCode=event.detail.locale;});
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-northeast3');
if(emulator) {
    connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    connectFirestoreEmulator(db,'127.0.0.1',8080);
    connectStorageEmulator(storage,'127.0.0.1',9199);
    connectFunctionsEmulator(functions,'127.0.0.1',5001);
}
export function pageURL(page) {return page + (emulator ? '?emulator=1' : '');}

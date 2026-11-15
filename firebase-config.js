import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import {resolveFirebaseEnvironment} from './firebase-environment.js';
const {emulator,config}=resolveFirebaseEnvironment({hostname:location.hostname,search:location.search,native:window.Capacitor?.isNativePlatform?.()===true,env:import.meta.env||{}});
export const app = initializeApp(config);

// On Capacitor iOS, IndexedDB can be slow to open on cold start / right after login.
// Prefer localStorage (browserLocalPersistence) on native for faster, more reliable session restore.
const isNative = window.Capacitor?.isNativePlatform?.() === true;
const persistence = isNative
  ? [browserLocalPersistence, indexedDBLocalPersistence]
  : [indexedDBLocalPersistence, browserLocalPersistence];

export const auth = initializeAuth(app, { persistence });
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

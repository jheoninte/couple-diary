import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
const emulator = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulator');
const config = {
    apiKey: emulator ? 'demo-key' : 'AIzaSyBoEZNvbq_eYne5y1Ejm5IwLa2WDHfdYQs',
    authDomain: 'couple-diary-75157.firebaseapp.com',
    projectId: emulator ? 'demo-couple-diary' : 'couple-diary-75157',
    storageBucket: emulator ? 'demo-couple-diary.appspot.com' : 'couple-diary-75157.firebasestorage.app',
    messagingSenderId: '681335251233', appId: '1:681335251233:web:fb6865fe60058287fd9e60'
};
export const app = initializeApp(config);
export const auth = getAuth(app);
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

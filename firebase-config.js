// Firebase 설정 및 초기화
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, where, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBoEZNvbq_eYne5y1Ejm5IwLa2WDHfdYQs",
    authDomain: "couple-diary-75157.firebaseapp.com",
    projectId: "couple-diary-75157",
    storageBucket: "couple-diary-75157.firebasestorage.app",
    messagingSenderId: "681335251233",
    appId: "1:681335251233:web:fb6865fe60058287fd9e60"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 전역 변수로 내보내기
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;
window.firebaseUser = null;

console.log('🔥 Firebase initialized successfully!');

// Firebase 연동 스크립트
// index.html 파일의 <script> 태그 바로 앞에 이 스크립트를 추가하세요

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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

let currentUser = null;
let userDocRef = null;
let unsubscribe = null;

// 로그인 체크
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // 로그인 안 되어 있으면 로그인 페이지로 이동
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    console.log('✅ 로그인됨:', user.email);

    // 사용자 문서 참조
    userDocRef = doc(db, 'users', user.uid);

    // Firestore에서 데이터 로드
    await loadDataFromFirestore();

    // 실시간 동기화 시작
    startRealtimeSync();

    // 로그아웃 버튼 추가
    addLogoutButton();
});

// Firestore에서 데이터 로드
async function loadDataFromFirestore() {
    try {
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 데이터를 전역 변수에 로드
            if (data.entries) entries = data.entries;
            if (data.partnerEntries) partnerEntries = data.partnerEntries;
            if (data.myIcon) myIcon = data.myIcon;
            if (data.partnerIcon) partnerIcon = data.partnerIcon;
            if (data.anniversaries) anniversaries = data.anniversaries;
            if (data.currentTheme) currentTheme = data.currentTheme;
            if (data.appTitle) appTitle = data.appTitle;
            if (data.startDate) startDate = data.startDate;

            console.log('✅ Firestore에서 데이터 로드 완료');
            
            // UI 업데이트
            applyTheme(currentTheme);
            updateAppTitle(appTitle);
            renderCalendar();
            updateStats();
            updateMemories();
            updateUpcomingAnniversary();
        } else {
            // 처음 사용하는 경우 - 초기 데이터 생성
            await saveDataToFirestore();
            console.log('✅ 새 사용자 데이터 생성');
        }
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
    }
}

// Firestore에 데이터 저장
async function saveDataToFirestore() {
    if (!currentUser || !userDocRef) return;

    try {
        await setDoc(userDocRef, {
            entries: entries,
            partnerEntries: partnerEntries,
            myIcon: myIcon,
            partnerIcon: partnerIcon,
            anniversaries: anniversaries,
            currentTheme: currentTheme,
            appTitle: appTitle,
            startDate: startDate,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('✅ Firestore에 데이터 저장 완료');
    } catch (error) {
        console.error('❌ 데이터 저장 실패:', error);
    }
}

// 실시간 동기화
function startRealtimeSync() {
    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            // 데이터 업데이트
            entries = data.entries || {};
            partnerEntries = data.partnerEntries || {};
            myIcon = data.myIcon || '🐶';
            partnerIcon = data.partnerIcon || '🐱';
            anniversaries = data.anniversaries || [];
            currentTheme = data.currentTheme || 'pink';
            appTitle = data.appTitle || '우리의 공간';
            startDate = data.startDate || new Date().toISOString().split('T')[0];

            // UI 업데이트
            applyTheme(currentTheme);
            updateAppTitle(appTitle);
            renderCalendar();
            updateStats();
            updateMemories();
            updateUpcomingAnniversary();
            
            console.log('🔄 실시간 동기화 완료');
        }
    });
}

// 사진을 Firebase Storage에 업로드
async function uploadPhotoToStorage(base64Data, filename) {
    if (!currentUser) return null;

    try {
        // Base64를 Blob으로 변환
        const response = await fetch(base64Data);
        const blob = await response.blob();

        // Storage에 업로드
        const storageRef = ref(storage, `photos/${currentUser.uid}/${filename}`);
        await uploadBytes(storageRef, blob);

        // 다운로드 URL 가져오기
        const downloadURL = await getDownloadURL(storageRef);
        console.log('✅ 사진 업로드 완료:', filename);
        return downloadURL;
    } catch (error) {
        console.error('❌ 사진 업로드 실패:', error);
        return null;
    }
}

// 사진 삭제
async function deletePhotoFromStorage(photoURL) {
    if (!currentUser) return;

    try {
        const photoRef = ref(storage, photoURL);
        await deleteObject(photoRef);
        console.log('✅ 사진 삭제 완료');
    } catch (error) {
        console.error('❌ 사진 삭제 실패:', error);
    }
}

// 로그아웃 버튼 추가
function addLogoutButton() {
    const settingsBtn = document.querySelector('.settings-btn');
    if (!settingsBtn) return;

    // 이미 있으면 추가하지 않음
    if (document.getElementById('logoutBtn')) return;

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.className = 'settings-btn';
    logoutBtn.style.top = '140px';
    logoutBtn.textContent = '🚪';
    logoutBtn.title = '로그아웃';
    logoutBtn.onclick = async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await signOut(auth);
            window.location.href = 'login.html';
        }
    };

    settingsBtn.parentNode.insertBefore(logoutBtn, settingsBtn.nextSibling);
}

// 기존 함수들을 Firebase 버전으로 오버라이드
const originalSaveDiary = window.saveDiary;
window.saveDiary = async function() {
    // 기존 로직 실행
    const dateStr = document.getElementById('entryDate').value;
    const content = document.getElementById('diaryContent').value.trim();
    
    if (!content) {
        alert('일기를 작성해주세요!');
        return;
    }
    
    if (!selectedMoodValue) {
        alert('오늘의 기분을 선택해주세요!');
        return;
    }

    // 사진 업로드 처리
    const uploadedPhotoURLs = [];
    for (let i = 0; i < uploadedPhotos.length; i++) {
        const photoURL = await uploadPhotoToStorage(
            uploadedPhotos[i], 
            `${dateStr}_${i}_${Date.now()}.jpg`
        );
        if (photoURL) uploadedPhotoURLs.push(photoURL);
    }
    
    const entry = {
        content,
        mood: selectedMoodValue,
        photos: uploadedPhotoURLs,
        createdAt: new Date().toISOString()
    };
    
    entries[dateStr] = entry;
    
    // Firestore에 저장
    await saveDataToFirestore();
    
    // 성공 메시지
    alert('💕 일기가 저장되었습니다!');
    
    // 폼 초기화
    resetForm();
    
    // 화면 업데이트
    selectedDate = dateStr;
    renderCalendar();
    updateStats();
    updateMemories();
    switchTab('calendar', document.querySelector('.tab-btn'));
    displayDateEntries(dateStr);
};

// 일기 삭제도 Firebase 버전으로
const originalDeleteEntry = window.deleteEntry;
window.deleteEntry = function(dateStr) {
    showConfirmModal(
        '일기를 삭제하시겠습니까?',
        '삭제된 일기는 복구할 수 없습니다.',
        async () => {
            // 사진 삭제
            if (entries[dateStr] && entries[dateStr].photos) {
                for (const photoURL of entries[dateStr].photos) {
                    await deletePhotoFromStorage(photoURL);
                }
            }

            delete entries[dateStr];
            await saveDataToFirestore();
            
            renderCalendar();
            updateStats();
            updateMemories();
            displayDateEntries(dateStr);
        },
        '🗑️'
    );
};

// 설정 저장도 Firebase 버전으로
const originalSaveSettings = window.saveSettings;
window.saveSettings = async function() {
    localStorage.setItem('myIcon', myIcon);
    localStorage.setItem('partnerIcon', partnerIcon);
    localStorage.setItem('appTheme', currentTheme);
    
    const newTitle = document.getElementById('appTitleInput').value.trim() || '우리의 공간';
    appTitle = newTitle;
    updateAppTitle(newTitle);
    
    // Firestore에 저장
    await saveDataToFirestore();
    
    alert('✅ 설정이 저장되었습니다!');
    closeSettings();
    
    renderCalendar();
    updateUpcomingAnniversary();
    displayDateEntries(selectedDate);
};

console.log('🔥 Firebase 스크립트 로드 완료');

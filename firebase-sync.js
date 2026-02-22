// Firebase 연동 스크립트 v2.0 - 커플 연결 기능 추가
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
let coupleDocRef = null;
let unsubscribe = null;
let myUserId = null;
let partnerUserId = null;

// 로그인 체크
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    myUserId = user.uid;
    console.log('✅ 로그인됨:', user.email);

    // 커플 연결 확인
    const isConnected = await checkCoupleConnection();
    
    if (!isConnected) {
        // 연결 안 되어 있으면 연결 페이지로 이동
        window.location.href = 'couple-connect.html';
        return;
    }

    // Firestore에서 데이터 로드
    await loadDataFromFirestore();

    // 실시간 동기화 시작
    startRealtimeSync();

    // UI 버튼 추가
    addUIButtons();
});

// 커플 연결 확인
async function checkCoupleConnection() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists() || !userDoc.data().coupleId) {
            return false;
        }

        const coupleId = userDoc.data().coupleId;
        const coupleDoc = await getDoc(doc(db, 'couples', coupleId));
        
        if (!coupleDoc.exists()) {
            return false;
        }

        const coupleData = coupleDoc.data();
        
        // 두 명 모두 연결되어 있는지 확인
        if (!coupleData.user1 || !coupleData.user2) {
            return false;
        }

        // 파트너 ID 설정
        partnerUserId = coupleData.user1 === currentUser.uid ? coupleData.user2 : coupleData.user1;
        coupleDocRef = doc(db, 'couples', coupleId);
        
        console.log('✅ 커플 연결됨');
        return true;
    } catch (error) {
        console.error('❌ 커플 연결 확인 실패:', error);
        return false;
    }
}

// Firestore에서 데이터 로드
async function loadDataFromFirestore() {
    try {
        const docSnap = await getDoc(coupleDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 내 일기와 파트너 일기 구분
            entries = data.myEntries?.[myUserId] || {};
            partnerEntries = data.myEntries?.[partnerUserId] || {};
            
            // 기타 설정
            if (data.settings) {
                const mySettings = data.settings[myUserId] || {};
                myIcon = mySettings.icon || '🐶';
                currentTheme = mySettings.theme || 'pink';
                appTitle = mySettings.appTitle || '우리의 공간';
            }
            
            if (data.anniversaries) anniversaries = data.anniversaries;
            if (data.startDate) startDate = data.startDate;

            console.log('✅ Firestore에서 데이터 로드 완료');
            
            // 파트너 아이콘 설정
            if (data.settings && data.settings[partnerUserId]) {
                partnerIcon = data.settings[partnerUserId].icon || '🐱';
            }
            
            // UI 업데이트
            applyTheme(currentTheme);
            updateAppTitle(appTitle);
            renderCalendar();
            updateStats();
            updateMemories();
            updateUpcomingAnniversary();
        } else {
            // 처음 사용하는 경우
            await saveDataToFirestore();
            console.log('✅ 새 커플 데이터 생성');
        }
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
    }
}

// Firestore에 데이터 저장
async function saveDataToFirestore() {
    if (!currentUser || !coupleDocRef) return;

    try {
        // 내 일기만 저장 (파트너 일기는 건드리지 않음)
        await setDoc(coupleDocRef, {
            [`myEntries.${myUserId}`]: entries,
            [`settings.${myUserId}`]: {
                icon: myIcon,
                theme: currentTheme,
                appTitle: appTitle
            },
            anniversaries: anniversaries,
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

    unsubscribe = onSnapshot(coupleDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            // 내 일기와 파트너 일기 로드
            entries = data.myEntries?.[myUserId] || {};
            partnerEntries = data.myEntries?.[partnerUserId] || {};
            
            // 설정 로드
            if (data.settings) {
                const mySettings = data.settings[myUserId] || {};
                myIcon = mySettings.icon || '🐶';
                currentTheme = mySettings.theme || 'pink';
                appTitle = mySettings.appTitle || '우리의 공간';
                
                const partnerSettings = data.settings[partnerUserId] || {};
                partnerIcon = partnerSettings.icon || '🐱';
            }
            
            anniversaries = data.anniversaries || [];
            startDate = data.startDate || new Date().toISOString().split('T')[0];

            // UI 업데이트
            applyTheme(currentTheme);
            updateAppTitle(appTitle);
            renderCalendar();
            updateStats();
            updateMemories();
            updateUpcomingAnniversary();
            
            // 현재 표시 중인 날짜가 있으면 새로고침
            if (selectedDate) {
                displayDateEntries(selectedDate);
            }
            
            console.log('🔄 실시간 동기화 완료');
        }
    });
}

// 사진을 Firebase Storage에 업로드
async function uploadPhotoToStorage(base64Data, filename) {
    if (!currentUser) return null;

    try {
        const response = await fetch(base64Data);
        const blob = await response.blob();

        const storageRef = ref(storage, `photos/${myUserId}/${filename}`);
        await uploadBytes(storageRef, blob);

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

// UI 버튼 추가
function addUIButtons() {
    const settingsBtn = document.querySelector('.settings-btn');
    if (!settingsBtn) return;

    // 이미 있으면 추가하지 않음
    if (document.getElementById('coupleBtn')) return;

    // 커플 연결 버튼
    const coupleBtn = document.createElement('button');
    coupleBtn.id = 'coupleBtn';
    coupleBtn.className = 'settings-btn';
    coupleBtn.style.top = '80px';
    coupleBtn.textContent = '💑';
    coupleBtn.title = '커플 설정';
    coupleBtn.onclick = () => {
        window.location.href = 'couple-connect.html';
    };
    settingsBtn.parentNode.insertBefore(coupleBtn, settingsBtn);

    // 로그아웃 버튼
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
    settingsBtn.parentNode.insertBefore(logoutBtn, settingsBtn);
}

// 일기 저장 (오버라이드)
const originalSaveDiary = window.saveDiary;
window.saveDiary = async function() {
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

    // 사진 업로드
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
        createdAt: new Date().toISOString(),
        author: myUserId,
        authorEmail: currentUser.email
    };
    
    entries[dateStr] = entry;
    
    // Firestore에 저장
    await saveDataToFirestore();
    
    alert('💕 일기가 저장되었습니다!');
    
    resetForm();
    
    selectedDate = dateStr;
    renderCalendar();
    updateStats();
    updateMemories();
    switchTab('calendar', document.querySelector('.tab-btn'));
    displayDateEntries(dateStr);
};

// 일기 삭제 (오버라이드)
const originalDeleteEntry = window.deleteEntry;
window.deleteEntry = function(dateStr) {
    showConfirmModal(
        '일기를 삭제하시겠습니까?',
        '삭제된 일기는 복구할 수 없습니다.',
        async () => {
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

// 설정 저장 (오버라이드)
const originalSaveSettings = window.saveSettings;
window.saveSettings = async function() {
    localStorage.setItem('myIcon', myIcon);
    localStorage.setItem('partnerIcon', partnerIcon);
    localStorage.setItem('appTheme', currentTheme);
    
    const newTitle = document.getElementById('appTitleInput').value.trim() || '우리의 공간';
    appTitle = newTitle;
    updateAppTitle(newTitle);
    
    await saveDataToFirestore();
    
    alert('✅ 설정이 저장되었습니다!');
    closeSettings();
    
    renderCalendar();
    updateUpcomingAnniversary();
    displayDateEntries(selectedDate);
};

console.log('🔥 Firebase 스크립트 v2.0 로드 완료 (커플 연결 기능 추가)');

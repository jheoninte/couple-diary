// Firebase 연동 스크립트 v2.1 - 데이터 구조 버그 수정
// index.html 파일의 <script> 태그 바로 앞에 이 스크립트를 추가하세요

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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
let isSaving = false; // 저장 중 플래그

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
        
        if (!coupleData.user1) {
            return false;
        }

        // user2가 아직 연결 안 된 경우 처리
        if (coupleData.user2) {
            partnerUserId = coupleData.user1 === currentUser.uid ? coupleData.user2 : coupleData.user1;
        } else {
            // user2가 없으면 partnerUserId는 null (혼자 사용)
            partnerUserId = null;
        }
        coupleDocRef = doc(db, 'couples', coupleId);
        
        console.log('✅ 커플 연결됨');
        console.log('내 ID:', myUserId);
        console.log('파트너 ID:', partnerUserId);
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
            
            console.log('📊 Firestore 전체 데이터:', data);
            console.log('🔍 myUserId:', myUserId);
            console.log('🔍 partnerUserId:', partnerUserId);
            console.log('🔍 myEntries 존재:', !!data.myEntries);
            
            // myEntries 구조 확인
            if (data.myEntries) {
                console.log('🔍 myEntries 키들:', Object.keys(data.myEntries));
                entries = data.myEntries[myUserId] || {};
                console.log('🔍 내 일기 원본:', entries);
                
                // partnerUserId가 null이면 빈 객체
                if (partnerUserId) {
                    partnerEntries = data.myEntries[partnerUserId] || {};
                    console.log('🔍 파트너 일기 원본:', partnerEntries);
                } else {
                    partnerEntries = {};
                    console.log('⚠️ partnerUserId가 null입니다!');
                }
            }
            
            // 설정 로드
            if (data.settings && data.settings[myUserId]) {
                myIcon = data.settings[myUserId].icon || '🐶';
                currentTheme = data.settings[myUserId].theme || 'pink';
                appTitle = data.settings[myUserId].appTitle || '우리의 공간';
            }
            
            if (data.settings && data.settings[partnerUserId]) {
                partnerIcon = data.settings[partnerUserId].icon || '🐱';
            } else {
                // 파트너가 아직 연결 안 된 경우 기본 아이콘
                partnerIcon = '🐱';
            }
            
            if (data.anniversaries) anniversaries = data.anniversaries;
            if (data.startDate) startDate = data.startDate;

            console.log('✅ Firestore에서 데이터 로드 완료');
            console.log('📝 내 일기 수:', Object.keys(entries).length);
            console.log('📝 파트너 일기 수:', Object.keys(partnerEntries).length);
            
            // UI 업데이트
            applyTheme(currentTheme);
            updateAppTitle(appTitle);
            renderCalendar();
            updateStats();
            updateMemories();
            updateUpcomingAnniversary();
        } else {
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
        isSaving = true; // 저장 시작
        
        // 기존 데이터 먼저 가져오기
        const docSnap = await getDoc(coupleDocRef);
        const existingData = docSnap.exists() ? docSnap.data() : {};
        
        // myEntries 객체 구조 생성
        const myEntriesData = existingData.myEntries || {};
        myEntriesData[myUserId] = entries;
        
        // 파트너 일기도 업데이트 (댓글/좋아요를 파트너 일기에 남긴 경우)
        if (partnerUserId && Object.keys(partnerEntries).length > 0) {
            myEntriesData[partnerUserId] = partnerEntries;
        }
        
        // settings 객체 구조 생성
        const settingsData = existingData.settings || {};
        settingsData[myUserId] = {
            icon: myIcon,
            theme: currentTheme,
            appTitle: appTitle
        };

        const updateData = {
            myEntries: myEntriesData,
            settings: settingsData,
            anniversaries: anniversaries,
            startDate: startDate,
            updatedAt: new Date().toISOString()
        };

        await setDoc(coupleDocRef, updateData, { merge: true });

        console.log('✅ Firestore에 데이터 저장 완료');
        
        // 저장 완료 후 잠시 대기 (Firebase에서 동기화 이벤트 받을 시간)
        setTimeout(() => {
            isSaving = false;
        }, 500);
        
    } catch (error) {
        console.error('❌ 데이터 저장 실패:', error);
        isSaving = false;
    }
}

// 실시간 동기화
function startRealtimeSync() {
    if (unsubscribe) unsubscribe();

    let isFirstLoad = true; // 첫 로드 플래그

    unsubscribe = onSnapshot(coupleDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            console.log('🔄 실시간 동기화 수신:', {
                hasMyEntries: !!data.myEntries,
                myEntriesKeys: data.myEntries ? Object.keys(data.myEntries) : [],
                hasSettings: !!data.settings,
                isFirstLoad: isFirstLoad
            });
            
            // 첫 로드일 때는 무조건 Firebase 데이터 사용
            if (isFirstLoad) {
                if (data.myEntries && typeof data.myEntries === 'object') {
                    entries = data.myEntries[myUserId] || {};
                    partnerEntries = partnerUserId ? (data.myEntries[partnerUserId] || {}) : {};
                } else {
                    entries = {};
                    partnerEntries = {};
                }
                
                isFirstLoad = false;
                console.log('📦 첫 로드 완료');
            } else {
                // 이후 동기화는 저장 중일 때만 무시
                if (isSaving) {
                    console.log('⏸️ 저장 중이므로 동기화 대기');
                    return;
                }
                
                // 병합 방식으로 업데이트
                if (data.myEntries && typeof data.myEntries === 'object') {
                    const newMyEntries = data.myEntries[myUserId] || {};
                    const newPartnerEntries = partnerUserId ? (data.myEntries[partnerUserId] || {}) : {};
                    
                    // 깊은 병합: Firebase 데이터를 우선하되, 로컬 변경사항 보존
                    entries = mergeEntries(entries, newMyEntries);
                    partnerEntries = mergeEntries(partnerEntries, newPartnerEntries);
                    
                    console.log('🔄 데이터 병합 완료');
                }
            }
            
            console.log('📝 동기화 후 일기 수:', {
                mine: Object.keys(entries).length,
                partner: Object.keys(partnerEntries).length
            });
            
            // 설정 로드
            if (data.settings && typeof data.settings === 'object') {
                if (data.settings[myUserId]) {
                    myIcon = data.settings[myUserId].icon || '🐶';
                    currentTheme = data.settings[myUserId].theme || 'pink';
                    appTitle = data.settings[myUserId].appTitle || '우리의 공간';
                }
                
                if (partnerUserId && data.settings[partnerUserId]) {
                    partnerIcon = data.settings[partnerUserId].icon || '🐱';
                } else {
                    partnerIcon = '🐱';
                }
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
            
            if (selectedDate) {
                displayDateEntries(selectedDate);
            }
            
            console.log('✅ 실시간 동기화 완료');
        }
    });
}

// 일기 데이터 병합 함수
function mergeEntries(localEntries, firebaseEntries) {
    const merged = {};
    
    // Firebase의 모든 날짜 추가
    for (const date in firebaseEntries) {
        merged[date] = firebaseEntries[date];
    }
    
    // 로컬에만 있는 날짜 추가 (최근 변경사항)
    for (const date in localEntries) {
        if (!merged[date]) {
            merged[date] = localEntries[date];
        } else {
            // 같은 날짜가 있으면 최신 데이터 사용 (createdAt 비교)
            const localTime = new Date(localEntries[date].createdAt || 0).getTime();
            const firebaseTime = new Date(merged[date].createdAt || 0).getTime();
            
            if (localTime > firebaseTime) {
                merged[date] = localEntries[date];
            }
        }
    }
    
    return merged;
}

// 사진 업로드
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

    if (document.getElementById('coupleBtn')) return;

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

// 댓글 추가 (오버라이드) - index.html 구조에 맞춤
window.addComment = async function(dateStr) {
    try {
        // 동적으로 생성된 댓글 입력란 찾기
        const commentInput = document.getElementById(`comment-input-${dateStr}`);
        
        if (!commentInput) {
            console.error('❌ 댓글 입력란을 찾을 수 없습니다:', `comment-input-${dateStr}`);
            alert('댓글 입력란을 찾을 수 없습니다.');
            return;
        }
        
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            alert('댓글을 입력해주세요!');
            return;
        }
        
        // 내 일기인지 파트너 일기인지 확인
        let targetEntries = null;
        let isPartner = false;
        
        if (entries[dateStr]) {
            targetEntries = entries;
            isPartner = false;
        } else if (partnerEntries[dateStr]) {
            targetEntries = partnerEntries;
            isPartner = true;
        } else {
            console.error('❌ 해당 날짜의 일기를 찾을 수 없습니다:', dateStr);
            alert('일기 데이터를 찾을 수 없습니다.');
            return;
        }
        
        if (!targetEntries[dateStr].comments) {
            targetEntries[dateStr].comments = [];
        }
        
        const comment = {
            text: commentText,
            author: myUserId,
            authorEmail: currentUser.email,
            authorIcon: myIcon,
            createdAt: new Date().toISOString()
        };
        
        targetEntries[dateStr].comments.push(comment);
        
        console.log('💬 댓글 추가 성공:', {
            date: dateStr,
            isPartner: isPartner,
            text: commentText,
            totalComments: targetEntries[dateStr].comments.length
        });
        
        // Firebase에 저장
        await saveDataToFirestore();
        
        // 입력란 초기화
        commentInput.value = '';
        
        // UI 즉시 업데이트
        displayDateEntries(dateStr);
        
    } catch (error) {
        console.error('❌ 댓글 추가 실패:', error);
        alert('댓글 추가에 실패했습니다: ' + error.message);
    }
};

// 좋아요 토글 (오버라이드) - index.html 구조에 맞춤
window.toggleLike = async function(dateStr) {
    try {
        // 내 일기인지 파트너 일기인지 확인
        let targetEntries = null;
        let isPartner = false;
        
        if (entries[dateStr]) {
            targetEntries = entries;
            isPartner = false;
        } else if (partnerEntries[dateStr]) {
            targetEntries = partnerEntries;
            isPartner = true;
        } else {
            console.error('❌ 해당 날짜의 일기를 찾을 수 없습니다:', dateStr);
            alert('일기 데이터를 찾을 수 없습니다.');
            return;
        }
        
        if (!targetEntries[dateStr].likedBy) {
            targetEntries[dateStr].likedBy = [];
        }
        
        const likedBy = targetEntries[dateStr].likedBy;
        const index = likedBy.indexOf(myUserId);
        
        if (index > -1) {
            // 좋아요 취소
            likedBy.splice(index, 1);
            console.log('💔 좋아요 취소:', dateStr);
        } else {
            // 좋아요 추가
            likedBy.push(myUserId);
            console.log('❤️ 좋아요 추가:', dateStr);
        }
        
        // 기존 liked 속성도 업데이트 (호환성)
        targetEntries[dateStr].liked = likedBy.length > 0;
        
        console.log('✅ 좋아요 토글 성공:', {
            date: dateStr,
            isPartner: isPartner,
            liked: index === -1,
            totalLikes: likedBy.length
        });
        
        // Firebase에 저장
        await saveDataToFirestore();
        
        // localStorage도 업데이트 (기존 코드 호환성)
        if (isPartner) {
            localStorage.setItem('partnerEntries', JSON.stringify(partnerEntries));
        } else {
            localStorage.setItem('diaryEntries', JSON.stringify(entries));
        }
        
        // UI 즉시 업데이트
        displayDateEntries(dateStr);
        
    } catch (error) {
        console.error('❌ 좋아요 토글 실패:', error);
        alert('좋아요 처리에 실패했습니다: ' + error.message);
    }
};

console.log('🔥 Firebase 스크립트 v2.2 로드 완료 (댓글/좋아요 Firebase 저장 추가)');

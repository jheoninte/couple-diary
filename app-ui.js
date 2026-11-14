import holidays from './holidays-data.js';
import './monetization.js';
import { preparePhoto } from './image-processing.js';
import {localDate, validDate, dayNumber, togetherDays, escapeHTML, safePhotoURL, readJSON, draftKey, anniversaryTarget, LIMITS} from './web-core.js';
// Small, consistent interface icons; personal moods and avatars remain expressive.
function uiIcon(name) {
    const paths={book:'<path d="M12 5C8 2 3 4 3 4v16s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v16"/>',photo:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',comment:'<path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-5A9 9 0 1 1 21 11.5Z"/>'};
    return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.book}</svg>`;
}
// 전역 변수
        let currentDate = new Date();
        let selectedDate = localDate(); // 현재 선택된 날짜
        let entries = {};
        let partnerEntries = {};
        let uploadedPhotos = [];
        let selectedMoodValue = '';
        let autosaveTimer = null;
        let startDate = localDate();
        let myIcon = '🐶';
        let partnerIcon = '🐱';
        let confirmCallback = null; // 확인 모달 콜백
        let anniversaries = [];
        let selectedAnniversaryIcon = '🎉'; // 기념일 아이콘
        let currentTheme = 'pink';
        let appTitle = '우리의 공간';
        let myDisplayName='나', partnerDisplayName='파트너';
        let editingRevision=0, editorDate=localDate(), suppressDraft=false, session=null;
        const modalFocus=new Map();
        function focusModal(id,selector){modalFocus.set(id,document.activeElement);document.querySelector(`#${id} ${selector}`)?.focus();}
        function restoreModalFocus(id){modalFocus.get(id)?.focus();modalFocus.delete(id);}

        // 확인 모달 관련 함수
        function showConfirmModal(title, message, callback, icon = '⚠️') {
            document.getElementById('confirmIcon').textContent = icon;
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            document.getElementById('confirmModal').classList.add('active');
            
            confirmCallback = callback;
            
            // 삭제 버튼에 이벤트 리스너 추가
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            
            newDeleteBtn.addEventListener('click', () => {
                if (confirmCallback) {
                    confirmCallback();
                }
                closeConfirmModal();
            });
            focusModal('confirmModal','.confirm-btn-cancel');
        }

        function closeConfirmModal() {
            document.getElementById('confirmModal').classList.remove('active');
            confirmCallback = null;
            restoreModalFocus('confirmModal');
        }

        function closeConfirmModalOnOutside(event) {
            if (event.target.id === 'confirmModal') {
                closeConfirmModal();
            }
        }



        // 테마 및 제목 관련 함수
        function selectTheme(btn, theme) {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTheme = theme;
            
            // 즉시 테마 적용
            applyTheme(theme);
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            try{localStorage.setItem('appTheme',theme);}catch{}
        }

        function updateAppTitle(title) {
            document.getElementById('appTitle').textContent = title;
            
        }

        // 설정 관련 함수
        function openSettings() {
            document.getElementById('settingsModal').classList.add('active');
            
            // 현재 선택된 내 아이콘 표시
            document.querySelectorAll('.icon-selector .icon-btn').forEach(btn => {
                btn.classList.remove('selected');
                if (btn.textContent === myIcon) {
                    btn.classList.add('selected');
                }
            });
            
            // 현재 테마 표시
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.remove('selected');
                if (btn.onclick.toString().includes(`'${currentTheme}'`)) {
                    btn.classList.add('selected');
                }
            });
            
            // 현재 제목 표시
            document.getElementById('appTitleInput').value = appTitle;
            
            // 닉네임 표시
            const displayNameInput = document.getElementById('displayNameInput');
            if (displayNameInput && typeof myDisplayName !== 'undefined') {
                displayNameInput.value = myDisplayName;
            }
            
            // 사귄 날짜 표시 및 함께한 날 계산
            const startDateInput = document.getElementById('startDateInput');
            if (startDateInput && startDate) {
                startDateInput.value = startDate;
                updateDaysTogether();
            }
            
            // 기념일 리스트 렌더링
            renderAnniversaryList();
            focusModal('settingsModal','.settings-close');
        }

        function closeSettings() {
            document.getElementById('settingsModal').classList.remove('active');
            restoreModalFocus('settingsModal');
        }

        function selectMyIcon(btn, icon) {
            const selector = btn.parentElement;
            selector.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            myIcon = icon;
        }

        // 함께한 날 계산 함수
        function updateDaysTogether() { const el=document.getElementById('daysTogether'); if(el)el.textContent=`💕 함께한 지 ${togetherDays(startDate)}일`; }

        function saveSettings() { return window.diaryActions?.saveSettings(); }

        // 초기화
        function init() {
            // 테마 적용
            applyTheme(currentTheme);
            
            // 제목 적용
            updateAppTitle(appTitle);
            
            // 오늘 날짜 설정
            const today = localDate();
            selectedDate = today; // 전역 변수에 설정
            document.getElementById('entryDate').value = today;
            
            // 달력 렌더링
            renderCalendar();
            
            // 통계 업데이트
            updateStats();
            
            // 추억 갤러리 업데이트
            updateMemories();
            
            // 다가오는 기념일 업데이트
            updateUpcomingAnniversary();
            
            // 오늘 날짜 자동 표시
            displayDateEntries(today);
            
            // 사진 드래그 앤 드롭 설정
            setupDragAndDrop();
            
            // 자동 저장 설정
            setupAutosave();
            
            // 데모 데이터 제거 (Firebase 사용)
            // if (Object.keys(entries).length === 0) {
            //     addDemoData();
            // }
        }

        // 데모 데이터 추가
        function addDemoData() {}

        // 통계 업데이트
        function updateStats() { document.getElementById('totalDays').textContent=togetherDays(startDate); document.getElementById('totalEntries').textContent=Object.keys(entries).length+Object.keys(partnerEntries).length; }

        // 달력 렌더링
        function renderCalendar() {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            
            // 월 표시
            document.getElementById('currentMonth').textContent = 
                `${year}년 ${month + 1}월`;
            
            // 첫 날과 마지막 날
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startingDayOfWeek = firstDay.getDay();
            
            let html = '';
            
            // 이전 달 빈 칸
            for (let i = 0; i < startingDayOfWeek; i++) {
                html += '<div class="day other-month"></div>';
            }
            
            // 현재 달 날짜
            const today = new Date();
            const todayStr = localDate(today);
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasMyEntry = entries[dateStr];
                const hasPartnerEntry = partnerEntries[dateStr];
                const hasBoth = hasMyEntry && hasPartnerEntry;
                const isHoliday = holidays[dateStr];
                const anniversary = anniversaries.find(a => anniversaryTarget(a, `${year}-01-01`) === dateStr);
                const isAnniversary = !!anniversary;
                
                let classes = 'day';
                if (isToday) classes += ' today';
                if (isSelected) classes += ' selected';
                if (hasBoth) classes += ' has-both';
                else if (hasMyEntry || hasPartnerEntry) classes += ' has-entry';
                if (isHoliday) classes += ' holiday';
                if (isAnniversary) classes += ' anniversary-day';
                
                const holidayAttr = isHoliday ? `data-holiday="${isHoliday}"` : '';
                
                // 아이콘 표시
                let iconsHtml = '';
                if (hasBoth) {
                    iconsHtml = `<div class="day-icons">${escapeHTML(myIcon)}${escapeHTML(partnerIcon)}</div>`;
                } else if (hasMyEntry) {
                    iconsHtml = `<div class="day-icons">${escapeHTML(myIcon)}</div>`;
                } else if (hasPartnerEntry) {
                    iconsHtml = `<div class="day-icons">${escapeHTML(partnerIcon)}</div>`;
                }
                
                // 기념일 아이콘
                let anniversaryIconHtml = '';
                if (isAnniversary) {
                    const icon = anniversary.icon || '🎉';
                    anniversaryIconHtml = `<span class="anniversary-icon">${escapeHTML(icon)}</span>`;
                }
                
                html += `<button class="${classes}" ${holidayAttr} onclick="selectDate('${dateStr}')">
                    ${anniversaryIconHtml}
                    <span class="day-number">${day}</span>${iconsHtml}
                </button>`;
            }
            
            // 다음 달 빈 칸
            const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
            for (let i = daysInMonth + startingDayOfWeek; i < totalCells; i++) {
                html += '<div class="day other-month"></div>';
            }
            
            document.getElementById('calendarDays').innerHTML = html;
            const selectedDay=selectedDate.startsWith(`${year}-${String(month+1).padStart(2,'0')}-`)?Number(selectedDate.slice(-2)):1;
            const weekStart=Math.floor((startingDayOfWeek+selectedDay-1)/7)*7;
            [...document.getElementById('calendarDays').children].forEach((cell,i)=>cell.classList.toggle('outside-week',i<weekStart||i>=weekStart+7));
        }

        function setCalendarExpanded(expanded) {
            document.querySelector('.calendar-card').classList.toggle('expanded',expanded);
            const button=document.getElementById('calendarViewToggle');
            button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'주간 보기':'월 전체';
        }
        window.toggleCalendarView=()=>setCalendarExpanded(document.getElementById('calendarViewToggle').getAttribute('aria-expanded')!=='true');

        function prevMonth() {
            setCalendarExpanded(true);
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        }

        function nextMonth() {
            setCalendarExpanded(true);
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        }

        function selectDate(dateStr) {
            selectedDate = dateStr;
            renderCalendar();
            displayDateEntries(dateStr);
        }

        // 기념일 관련 함수
        function selectAnniversaryIcon(btn, icon) {
            document.querySelectorAll('.anniversary-icon-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAnniversaryIcon = icon;
            document.getElementById('selectedAnniversaryIcon').textContent = icon;
        }

        function renderAnniversaryList() {
            const container = document.getElementById('anniversaryList');
            const addBtn = document.getElementById('addAnniversaryBtn');
            
            if (anniversaries.length === 0) {
                container.innerHTML = '<div class="anniversary-empty">아직 등록된 기념일이 없습니다.</div>';
                addBtn.disabled = false;
                return;
            }
            
            // 날짜순 정렬
            anniversaries.sort((a, b) => anniversaryTarget(a).localeCompare(anniversaryTarget(b)));
            
            let html = '';
            anniversaries.forEach((anni, index) => {
                const dday = calculateDday(anniversaryTarget(anni));
                const icon = anni.icon || '🎉';
                html += `
                    <div class="anniversary-item">
                        <div class="anniversary-info">
                            <div class="anniversary-icon-display">${escapeHTML(icon)}</div>
                            <div class="anniversary-text">
                                <div class="anniversary-name">${escapeHTML(anni.name)}</div>
                                <div class="anniversary-date">${escapeHTML(anni.date)}</div>
                                <div class="anniversary-dday">${dday}</div>
                            </div>
                        </div>
                        <button class="anniversary-delete" onclick="deleteAnniversary(${index})">×</button>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            addBtn.disabled = anniversaries.length >= 30;
        }

        function calculateDday(dateStr) { const diff=dayNumber(dateStr)-dayNumber(localDate());return diff===0?'오늘이 바로 그날! 🎉':diff>0?`D-${diff}`:`${Math.abs(diff)}일 전`; }

        function showAddAnniversaryForm() {
            document.getElementById('anniversaryForm').style.display = 'block';
            document.getElementById('addAnniversaryBtn').style.display = 'none';
            document.getElementById('anniversaryName').focus();
        }

        function cancelAnniversaryForm() {
            document.getElementById('anniversaryForm').style.display = 'none';
            document.getElementById('addAnniversaryBtn').style.display = 'block';
            document.getElementById('anniversaryName').value = '';
            document.getElementById('anniversaryDate').value = '';
            document.getElementById('anniversaryRecurring').checked=false;
            selectedAnniversaryIcon = '🎉';
            document.getElementById('selectedAnniversaryIcon').textContent = '🎉';
            document.querySelectorAll('.anniversary-icon-btn').forEach(b => b.classList.remove('selected'));
        }

        function saveAnniversary() { return window.diaryActions?.saveAnniversary(); }

        function deleteAnniversary(index) { return window.diaryActions?.deleteAnniversary(index); }

        function updateUpcomingAnniversary() {
            const container = document.getElementById('upcomingAnniversary');
            
            if (anniversaries.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 오늘 또는 가장 가까운 미래 기념일 찾기
            let nearest = null;
            let minDiff = Infinity;
            
            anniversaries.forEach(anni => {
                const target = new Date(anniversaryTarget(anni)+'T00:00:00');
                target.setHours(0, 0, 0, 0);
                const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                
                if (diff >= 0 && diff < minDiff) {
                    minDiff = diff;
                    nearest = { ...anni, diff };
                }
            });
            
            if (!nearest || nearest.diff > 30) {
                container.innerHTML = '';
                return;
            }
            
            const dday = calculateDday(anniversaryTarget(nearest));
            const icon = nearest.icon || '🎉';
            let message = '';
            
            if (nearest.diff === 0) {
                message = `오늘은 <strong>${escapeHTML(nearest.name)}</strong>입니다! ${escapeHTML(icon)}`;
            } else if (nearest.diff <= 7) {
                message = `<strong>${escapeHTML(nearest.name)}</strong>이(가) ${nearest.diff}일 남았어요! ${dday}`;
            } else {
                message = `다가오는 기념일: <strong>${escapeHTML(nearest.name)}</strong> ${dday}`;
            }
            
            container.innerHTML = `
                <div class="anniversary-alert">
                    <div class="anniversary-alert-title">
                        <span>${escapeHTML(icon)}</span>
                        <span>다가오는 기념일</span>
                    </div>
                    <div class="anniversary-alert-content">${message}</div>
                </div>
            `;
        }

        // 선택된 날짜의 일기 표시
        function displayDateEntries(dateStr, discardInputs=false) {
            const heading=document.getElementById('selectedDateHeading');
            if(heading)heading.textContent=dateStr===localDate()?'오늘의 이야기':new Date(dateStr+'T12:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric'})+'의 이야기';
            const drafts=discardInputs?[]:[...document.querySelectorAll('#selectedDayEntries input')].map(input=>({id:input.id,value:input.value,focused:input===document.activeElement}));
            const myEntry = entries[dateStr];
            const partnerEntry = partnerEntries[dateStr];
            const anniversary = anniversaries.find(a => anniversaryTarget(a, dateStr.slice(0,4)+'-01-01') === dateStr);
            let html = '';
            
            // 기념일 배지
            if (anniversary) {
                const icon = anniversary.icon || '🎉';
                html += `
                    <div class="anniversary-alert">
                        <div class="anniversary-alert-title">
                            <span>${escapeHTML(icon)}</span>
                            <span>${escapeHTML(anniversary.name)}</span>
                        </div>
                        <div class="anniversary-alert-content">
                            ${calculateDday(anniversaryTarget(anniversary, dateStr))}
                        </div>
                    </div>
                `;
            }
            
            // 내 일기
            if (myEntry) {
                html += renderDiaryCard(dateStr, myEntry, 'my');
            }
            
            // 파트너 일기
            if (partnerEntry) {
                html += renderDiaryCard(dateStr, partnerEntry, 'partner');
            }
            
            if (!myEntry && !partnerEntry) {
                html += `
                    <div class="empty-state">
                        <div class="empty-state-icon">${uiIcon('book')}</div>
                        <p><strong>우리의 하루를 기다리고 있어요</strong>기억하고 싶은 순간을 한 줄씩 남겨보세요.</p>
                        <button class="empty-state-btn" onclick="goToWriteWithDate('${dateStr}')">
                            첫 이야기 남기기
                        </button>
                    </div>
                `;
            }
            
            document.getElementById('selectedDayEntries').innerHTML = html;
            observePhotos();
            for(const draft of drafts){
                const match=draft.id.match(/^(comment-input|edit-input)-(my|partner)-(\d{4}-\d{2}-\d{2})(?:-(.+))?$/);
                if(!match||match[3]!==dateStr)continue;
                if(match[1]==='comment-input')toggleCommentInput(dateStr,match[2]);
                else editComment(dateStr,match[4],match[2]);
                const input=document.getElementById(draft.id);if(input){input.value=draft.value;if(draft.focused)input.focus();}
            }
            
            // 댓글 버튼 이벤트 리스너 설정
            setupCommentEventListeners();
        }
        function getCommentDisplayInfo(comment) {
            const currentUserUid = window.currentUserUid;
            const isMine = comment.author === currentUserUid;
            return {
                label: isMine ? myDisplayName : partnerDisplayName,
                icon: isMine ? myIcon : partnerIcon,
                canEdit: isMine
            };
        }

        // 일기 카드 렌더링
        function renderDiaryCard(dateStr, entry, type) {
            const isMyEntry = type === 'my';
            const cardClass = isMyEntry ? '' : 'partner';
            const writerClass = isMyEntry ? '' : 'partner-writer';
            const writerIcon = isMyEntry ? myIcon : partnerIcon;
            const writerName = isMyEntry ? myDisplayName : partnerDisplayName;
            const commentCount = Array.isArray(entry.comments) ? entry.comments.length : 0;
            
            let html = `
                <div class="diary-card ${cardClass}">
                    <div class="diary-card-header">
                        <div>
                            <div class="diary-writer ${writerClass}">
                                <span class="diary-writer-icon">
                                    <span class="user-icon">${escapeHTML(writerIcon)}</span>
                                    <span>${escapeHTML(writerName)}</span>
                                </span>
                            </div>
                            <div class="diary-date">${dateStr}</div>
                        </div>
                        <div class="diary-mood">${escapeHTML(entry.mood || '😊')}</div>
                    </div>
                    <div class="diary-content">${escapeHTML(entry.content)}</div>
            `;
            
            if (entry.photos && entry.photos.length > 0) {
                html += '<div class="diary-images">';
                entry.photos.forEach(photo => {
                    html += `<img data-photo-path="${escapeHTML(photo)}" class="diary-image" alt="사진" loading="lazy">`;
                });
                html += '</div>';
            }

            const charCount = entry.content.length;
            const photoCount = entry.photos ? entry.photos.length : 0;
            html += `
                <div class="diary-meta">
                    <span class="diary-meta-item">${charCount}자의 마음</span>
                    ${photoCount > 0 ? `<span class="diary-meta-item">사진 ${photoCount}장</span>` : ''}
                    <span class="diary-meta-item">${new Date(entry.createdAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
            `;
            
            if (isMyEntry) {
                html += `
                    <div class="diary-actions">
                        <button class="action-btn" onclick="editEntry('${dateStr}')">${uiIcon('edit')} 수정</button>
                        <button class="action-btn" onclick="deleteEntry('${dateStr}')">${uiIcon('trash')} 삭제</button>
                    </div>
                `;
            } else {
                const likedClass = (entry.likedBy||[]).includes(window.currentUserUid) ? 'liked' : '';
                html += `
                    <div class="diary-actions">
                        <button class="action-btn ${likedClass}" onclick="window.toggleLike('${dateStr}', '${type}')">
                            ${uiIcon('heart')} 좋아요
                        </button>
                        <button class="action-btn" onclick="toggleCommentInput('${dateStr}', '${type}')">${uiIcon('comment')} 댓글 ${commentCount > 0 ? `(${commentCount})` : ''}</button>
                    </div>
                `;
            }

            html += `<div class="comments-section" id="comments-${type}-${dateStr}">`;
            if (commentCount > 0) {
                entry.comments.forEach((comment, index) => {
                    const display = getCommentDisplayInfo(comment);
                    html += `
                        <div class="comment" id="comment-${type}-${dateStr}-${escapeHTML(comment.id)}">
                            <div class="comment-header">
                                <div class="comment-author">${escapeHTML(display.icon)} ${escapeHTML(display.label)}</div>
                                <div class="comment-actions">
                                    ${display.canEdit ? `
                                        <button class="comment-action-btn" data-action="edit" data-type="${type}" data-date="${dateStr}" data-index="${escapeHTML(comment.id)}">수정</button>
                                        <button class="comment-action-btn" data-action="delete" data-type="${type}" data-date="${dateStr}" data-index="${escapeHTML(comment.id)}">삭제</button>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="comment-text">${escapeHTML(comment.text)}</div>
                        </div>
                    `;
                });
            }
            html += '</div>';
            
            html += '</div>';
            return html;
        }

        // 댓글 버튼 이벤트 리스너 설정
        function setupCommentEventListeners() {
            document.querySelectorAll('.comment-action-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const action = this.dataset.action;
                    const type = this.dataset.type || 'partner';
                    const dateStr = this.dataset.date;
                    const index = this.dataset.index;
                    
                    if (action === 'edit') {
                        window.editComment(dateStr, index, type);
                    } else if (action === 'delete') {
                        window.deleteComment(dateStr, index, type);
                    }
                });
            });
        }

        // 기분 선택
        function selectMood(btn, mood) {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMoodValue = mood;
            persistDraft();
        }

        // 글자 수 카운트
        function updateCharCount() {
            const content = document.getElementById('diaryContent').value;
            document.getElementById('charCount').textContent = content.length;
        }

        // 자동 저장 설정
        function setupAutosave() {
    document.getElementById('diaryContent').addEventListener('input',()=>{clearTimeout(autosaveTimer);autosaveTimer=setTimeout(persistDraft,500);});
    document.getElementById('entryDate').addEventListener('change',()=>{
        const next=document.getElementById('entryDate').value;
        if(!validDate(next))return;
        persistDraft(editorDate); openEditor(next);
    });
    window.addEventListener('pagehide',()=>persistDraft());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)persistDraft();});
}

        function showAutosaveIndicator() {
            const indicator = document.getElementById('autosaveIndicator');
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }

        // 일기 저장
        function saveDiary() { return window.diaryActions?.saveDiary(); }

        function resetForm() {
            clearTimeout(autosaveTimer);
            document.getElementById('diaryContent').value = '';
            editingRevision=0;
            document.getElementById('photoPreview').innerHTML = '';
            document.getElementById('photoInput').value = '';
            document.getElementById('charCount').textContent = '0';
            uploadedPhotos = [];
            selectedMoodValue = '';
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        }

        // 일기 수정
        function editEntry(dateStr) { persistDraft();openEditor(dateStr);switchTab('write',document.querySelectorAll('.tab-btn')[1]); }

        // 일기 삭제
        function deleteEntry(dateStr) { return window.diaryActions?.deleteEntry(dateStr); }
        function getEntryCollectionByType(type) {
            return type === 'my' ? entries : partnerEntries;
        }

        // 좋아요 토글
        function toggleLike(dateStr, type='partner') { return window.diaryActions?.toggleLike(dateStr, type); }

        // 댓글 입력창 토글
        function toggleCommentInput(dateStr, type = 'partner') {
            const commentsSection = document.getElementById(`comments-${type}-${dateStr}`);
            if (!commentsSection) return;

            const existingInput = commentsSection.querySelector('.comment-input-group');
            const inputId = `comment-input-${type}-${dateStr}`;
            
            if (existingInput) {
                existingInput.remove();
            } else {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'comment-input-group';
                inputGroup.innerHTML = `
                    <input type="text" placeholder="댓글을 입력하세요..." id="${inputId}" maxlength="1000">
                    <button onclick="window.addComment('${dateStr}', '${type}')">등록</button>
                `;
                commentsSection.appendChild(inputGroup);
                document.getElementById(inputId).focus();
            }
        }

        // 댓글 추가
        function addComment(dateStr, type='partner') { return window.diaryActions?.addComment(dateStr, type); }

        // 사진 업로드 처리
        document.getElementById('photoInput').addEventListener('change',e=>addPhotos(e.target.files));
        function displayPhotoPreviews() {
    const preview=document.getElementById('photoPreview');preview.replaceChildren();
    uploadedPhotos.forEach((photo,index)=>{
        const item=document.createElement('div');item.className='preview-item';
        const img=document.createElement('img');img.alt='첨부 사진';
        if(photo.startsWith('data:')||photo.startsWith('blob:'))img.src=safePhotoURL(photo);
        else window.diaryActions?.photoURL(photo).then(url=>{img.src=url;}).catch(()=>{img.alt='사진을 불러오지 못했습니다';});
        const button=document.createElement('button');button.className='preview-remove';button.textContent='×';button.type='button';button.setAttribute('aria-label','사진 삭제');
        button.onclick=()=>removePhoto(index);item.append(img,button);preview.append(item);
    });
}

        function removePhoto(index) {
            uploadedPhotos.splice(index, 1);
            persistDraft();
            displayPhotoPreviews();
        }

        // 드래그 앤 드롭 설정
        function setupDragAndDrop() {
    const area=document.querySelector('.photo-upload-area');
    ['dragenter','dragover','dragleave','drop'].forEach(name=>area.addEventListener(name,e=>{e.preventDefault();e.stopPropagation();}));
    area.addEventListener('drop',e=>addPhotos(e.dataTransfer.files));
}

        // 추억 갤러리 업데이트
        function updateMemories() {
            const allPhotos = [
                ...Object.values(entries),
                ...Object.values(partnerEntries)
            ]
            .filter(e => e.photos && e.photos.length > 0)
            .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
            .flatMap(e => e.photos.map(path=>({path,date:e.date||''})));
            
            document.getElementById('galleryCount').textContent = `${allPhotos.length}개의 사진`;
            
            const grid = document.getElementById('memoriesGrid');
            
            if (allPhotos.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">${uiIcon('photo')}</div>
                        <p><strong>함께한 순간을 모아볼까요?</strong>일기에 남긴 사진이 이곳에 차곡차곡 쌓여요.</p>
                        <button class="empty-state-btn" onclick="goToWrite()">
                            사진과 함께 기록하기
                        </button>
                    </div>
                `;
            } else {
                grid.innerHTML = allPhotos.map(photo => 
                    `<div class="memory-item">
                        <img data-photo-path="${escapeHTML(photo.path)}" loading="lazy" alt="${escapeHTML(photo.date)} 함께한 순간">
                        ${photo.date?`<span class="memory-date">${escapeHTML(photo.date.replaceAll('-','.'))}</span>`:''}
                    </div>`
                ).join('');
                observePhotos();
            }
        }

        // 이미지 모달
        function openModal(photoSrc) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            modal.classList.add('active');
            modalImg.src = safePhotoURL(photoSrc);
            focusModal('imageModal','.modal-close');
        }

        function closeModal() {
            const modal = document.getElementById('imageModal');
            modal.classList.remove('active');
            restoreModalFocus('imageModal');
        }
        // 댓글 수정
        function editComment(dateStr, commentIndex, type = 'partner') {
            const targetEntries = getEntryCollectionByType(type);
            const entry = targetEntries[dateStr];
            if (!entry || !entry.comments || !entry.comments.find(c=>c.id===commentIndex)) return;

            const comment = entry.comments.find(c=>c.id===commentIndex);
            const commentElement = document.getElementById(`comment-${type}-${dateStr}-${commentIndex}`);
            if (!commentElement) return;

            const display = getCommentDisplayInfo(comment);
            commentElement.innerHTML = `
                <div class="comment-header">
                    <div class="comment-author">${escapeHTML(display.icon)} ${escapeHTML(display.label)}</div>
                </div>
                <input type="text" class="comment-edit-input" id="edit-input-${type}-${dateStr}-${commentIndex}" value="${escapeHTML(comment.text)}">
                <div class="comment-edit-actions">
                    <button class="comment-save-btn" onclick="saveCommentEdit('${dateStr}', '${escapeHTML(commentIndex)}', '${type}')">저장</button>
                    <button class="comment-cancel-btn" onclick="cancelCommentEdit('${dateStr}', '${type}')">취소</button>
                </div>
            `;
            
            document.getElementById(`edit-input-${type}-${dateStr}-${commentIndex}`).focus();
        }

        // 댓글 수정 저장
        function saveCommentEdit(dateStr, commentIndex, type='partner') { return window.diaryActions?.saveCommentEdit(dateStr, commentIndex, type); }

        // 댓글 수정 취소
        function cancelCommentEdit(dateStr, type = 'partner') {
            displayDateEntries(dateStr);
        }

        // 댓글 삭제
        function deleteComment(dateStr, commentIndex, type='partner') { return window.diaryActions?.deleteComment(dateStr, commentIndex, type); }

        // 검색 기능
        function searchDiaries() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            const resultsContainer = document.getElementById('searchResults');
            
            if (!query) {
                resultsContainer.innerHTML = '';
                return;
            }
            
            const allEntries = [
                ...Object.entries(entries).map(([date, entry]) => ({date, entry, type: 'my'})),
                ...Object.entries(partnerEntries).map(([date, entry]) => ({date, entry, type: 'partner'}))
            ];
            
            const results = allEntries.filter(({entry}) => 
                entry.content.toLowerCase().includes(query)
            ).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (results.length === 0) {
                resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 12px;">검색 결과가 없습니다.</p>';
                return;
            }
            
            const html = results.map(({date, entry, type}) => {
                const icon = type === 'my' ? myIcon : partnerIcon;
                const preview = entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : '');
                return `
                    <div class="search-result-item" onclick="goToSearchResult('${date}')">
                        <div class="search-result-date">${escapeHTML(icon)} ${date}</div>
                        <div class="search-result-preview">${escapeHTML(preview)}</div>
                    </div>
                `;
            }).join('');
            
            resultsContainer.innerHTML = html;
        }

        // 검색 결과로 이동
        function goToSearchResult(dateStr) {
            document.getElementById('searchInput').value = '';
            document.getElementById('searchResults').innerHTML = '';
            
            // 해당 날짜로 달력 이동
            const [year, month] = dateStr.split('-').map(Number);
            currentDate = new Date(year, month - 1, 1);
            renderCalendar();
            
            // 해당 날짜 선택
            setTimeout(() => {
                selectDate(dateStr);
                document.getElementById('selectedDayEntries').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }

        // 일기 작성 페이지로 이동
        function goToWrite() { openEditor(localDate()); switchTab('write',document.querySelectorAll('.tab-btn')[1]); }

        function goToWriteWithDate(dateStr) { openEditor(dateStr); switchTab('write',document.querySelectorAll('.tab-btn')[1]); }

        // 탭 전환
        function switchTab(tabName, btnElement) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => {b.classList.remove('active');b.removeAttribute('aria-current');});
            
            document.getElementById(tabName).classList.add('active');
            if (btnElement) {
                btnElement.classList.add('active');
                btnElement.setAttribute('aria-current','page');
            }
            
            if (tabName === 'memories') {
                updateMemories();
            }
            document.querySelector('.app-header')?.scrollIntoView?.({block:'start'});
        }

        let photoObserver=null;
        function observePhotos(){
            if(!('IntersectionObserver' in window))return;
            photoObserver?.disconnect();
            photoObserver=new IntersectionObserver(changes=>{
                for(const change of changes){
                    const image=change.target;image.dataset.inView=String(change.isIntersecting);
                    if(!change.isIntersecting){image.removeAttribute('src');continue;}
                    window.diaryActions?.photoURL(image.dataset.photoPath).then(url=>{
                        if(image.isConnected&&image.dataset.inView==='true')image.src=url;
                    }).catch(()=>{image.alt='사진을 불러오지 못했습니다';window.diaryUI.status('일부 사진을 불러오지 못했습니다. 기록과 사진 경로는 유지됩니다.','error');});
                }
            },{rootMargin:'120px'});
            document.querySelectorAll('img[data-photo-path]').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',`${img.alt} 크게 보기`);photoObserver.observe(img);});
        }
        document.addEventListener('click',e=>{const image=e.target.closest?.('img[data-photo-path]');if(image)window.diaryActions?.openPhoto(image.dataset.photoPath);});
        document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches?.('img[data-photo-path]')){e.preventDefault();e.target.click();}});
        // 초기화
        init();
    
function persistDraft(date=editorDate) {
    if(!session||suppressDraft||!validDate(date)||session.archive)return;
    const content=document.getElementById('diaryContent').value;
    const key=draftKey(session.uid,session.coupleId,date);
    try {
        if(!content.trim()&&!uploadedPhotos.length){localStorage.removeItem(key);return;}
        localStorage.setItem(key,JSON.stringify({content,mood:selectedMoodValue,photos:uploadedPhotos,revision:editingRevision,savedAt:new Date().toISOString()}));
        showAutosaveIndicator();
    }catch {window.diaryUI.status('기기 저장 공간이 부족합니다. 작성 내용을 복사해 보관해주세요.','error');}
}
function openEditor(date,preserve=true) {
    if(!validDate(date))return;
    if(preserve)persistDraft(editorDate);
    suppressDraft=true;resetForm();editorDate=date;document.getElementById('entryDate').value=date;
    const existing=entries[date];
    if(existing){document.getElementById('diaryContent').value=existing.content;selectedMoodValue=existing.mood||'';uploadedPhotos=[...(existing.photoPaths||[])];editingRevision=existing.revision||0;}
    const draft=session?readJSON(localStorage,draftKey(session.uid,session.coupleId,date),null):null;
    if(draft&&typeof draft.content==='string'&&(!draft.photos||(Array.isArray(draft.photos)&&draft.photos.every(p=>typeof p==='string')))) {
        document.getElementById('diaryContent').value=draft.content;selectedMoodValue=draft.mood||'';
        uploadedPhotos=Array.isArray(draft.photos)?draft.photos.slice(0,3):[];editingRevision=Number.isSafeInteger(draft.revision)?draft.revision:0;
        window.diaryUI.status('이 기기에 보관된 초안을 복원했습니다.','info');
    }
    suppressDraft=false;updateCharCount();displayPhotoPreviews();
    document.querySelectorAll('.mood-btn').forEach(b=>b.classList.toggle('selected',b.textContent===selectedMoodValue));
}
async function addPhotos(files) {
    if(window.diaryMonetization&&!window.diaryMonetization.requestPhoto())return;
    const targetDate=editorDate;
    const list=Array.from(files);if(uploadedPhotos.length+list.length>3){alert('사진은 총 3장까지 첨부할 수 있습니다.');return;}
    if(window.diaryUI.photoBusy)return;
    window.diaryUI.photoBusy=true;
    try {
        const prepared=[];
        for(const file of list) {
            prepared.push(await preparePhoto(file));
        }
        if(editorDate!==targetDate)throw Error('날짜가 변경되었습니다. 사진을 다시 첨부해주세요.');
        uploadedPhotos.push(...prepared);displayPhotoPreviews();persistDraft();
    }catch(e){alert(e.message);}finally{window.diaryUI.photoBusy=false;document.getElementById('photoInput').value='';}
}
window.diaryUI={
    photoBusy:false,
    session(value){session=value;entries={};partnerEntries={};anniversaries=[];editorDate=localDate();openEditor(localDate(),false);},
    editor(){return {date:document.getElementById('entryDate').value,content:document.getElementById('diaryContent').value.trim(),mood:selectedMoodValue,photos:[...uploadedPhotos],revision:editingRevision};},
    updateRevision(date,next,previous){if(editorDate===date&&editingRevision===previous)editingRevision=next;},
    replaceEditor(date){
        const key=draftKey(session.uid,session.coupleId,date);
        try{const previous=localStorage.getItem(key);if(previous)localStorage.setItem(key+':recovery',previous);localStorage.removeItem(key);}catch{}
        openEditor(date,false);
    },
    recoverEditor(){
        const date=document.getElementById('entryDate').value,key=draftKey(session.uid,session.coupleId,date);
        try{const recovery=localStorage.getItem(key+':recovery');if(!recovery){this.status('복구할 직전 초안이 없습니다.','info');return;}localStorage.setItem(key,recovery);openEditor(date,false);}catch{this.status('초안을 복구하지 못했습니다.','error');}
    },
    clearDraft(date){try{localStorage.removeItem(draftKey(session.uid,session.coupleId,date));}catch{}suppressDraft=true;resetForm();suppressDraft=false;},
    persistDraft, resetForm, openEditor,
    state(){return {entries,partnerEntries,anniversaries,startDate,myIcon,currentTheme,appTitle,myDisplayName,selectedAnniversaryIcon};},
    render(data){
        entries=data.entries;partnerEntries=data.partnerEntries;anniversaries=data.anniversaries||[];startDate=data.startDate||localDate();
        const mine=data.settings?.[session.uid]||{},partner=data.settings?.[data.partnerUid]||{};
        myIcon=mine.icon||'🐶';partnerIcon=partner.icon||'🐱';currentTheme=mine.theme||'pink';appTitle=mine.appTitle||'우리의 공간';
        myDisplayName=mine.displayName||'나';partnerDisplayName=partner.displayName||'파트너';
        window.currentUserUid=session.uid;window.partnerUserUid=data.partnerUid;
        applyTheme(currentTheme);updateAppTitle(appTitle);renderCalendar();updateStats();updateMemories();updateUpcomingAnniversary();updateDaysTogether();
        if(selectedDate)displayDateEntries(selectedDate);
        if(document.getElementById('settingsModal').classList.contains('active'))renderAnniversaryList();
    },
    status(message,kind='info'){const el=document.getElementById('syncStatus');el.textContent=message;el.dataset.kind=kind;},
    saved(date){selectedDate=date;switchTab('calendar',document.querySelector('.tab-btn'));displayDateEntries(date);document.querySelector('.entries-panel')?.scrollIntoView?.({block:'start'});},
    closeSettings, cancelAnniversaryForm, displayDateEntries
};

Object.assign(window,{showConfirmModal,closeConfirmModal,closeConfirmModalOnOutside,selectTheme,applyTheme,updateAppTitle,openSettings,closeSettings,selectMyIcon,updateDaysTogether,saveSettings,init,addDemoData,updateStats,renderCalendar,prevMonth,nextMonth,selectDate,selectAnniversaryIcon,renderAnniversaryList,calculateDday,showAddAnniversaryForm,cancelAnniversaryForm,saveAnniversary,deleteAnniversary,updateUpcomingAnniversary,displayDateEntries,getCommentDisplayInfo,renderDiaryCard,setupCommentEventListeners,selectMood,updateCharCount,setupAutosave,showAutosaveIndicator,saveDiary,resetForm,editEntry,deleteEntry,getEntryCollectionByType,toggleLike,toggleCommentInput,addComment,displayPhotoPreviews,removePhoto,setupDragAndDrop,updateMemories,openModal,closeModal,editComment,saveCommentEdit,cancelCommentEdit,deleteComment,searchDiaries,goToSearchResult,goToWrite,goToWriteWithDate,switchTab,persistDraft,openEditor,addPhotos});
document.getElementById('settingsModal').addEventListener('click',event=>{if(event.target.id==='settingsModal')closeSettings();});
document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    const modal=document.querySelector('.modal.active')||document.querySelector('.confirm-modal.active')||document.querySelector('.settings-modal.active');
    if(!modal)return;
    if(event.key==='Escape'){event.preventDefault();({imageModal:closeModal,confirmModal:closeConfirmModal,settingsModal:closeSettings})[modal.id]();return;}
    if(event.key!=='Tab')return;
    const controls=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea,select,summary')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
import('./firebase-sync.js').catch(error=>{console.error('Startup failed',error.code||error.message);document.getElementById('loadingMessage').textContent='앱을 불러오지 못했습니다. 네트워크 연결을 확인하고 새로고침해주세요.';});

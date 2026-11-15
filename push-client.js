// Push notifications in the iOS app: permission, device token registration, preferences, and opening the
// entry a notification points to. A regular browser never loads the native plugin and hides the settings.
import { call, getUser } from './diary-api.js';
import { validDate } from './web-core.js';

const ASKED_KEY = 'diary.push.asked.v1';
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

// Pure routing for a tapped notification, kept separate so it can be tested without a device.
export function targetFor(data, session) {
  if (!data || !session || session.archive || data.coupleId !== session.coupleId) return null;
  if (!['diary', 'like', 'comment', 'reply'].includes(data.kind) || !validDate(data.date)) return null;
  return { date: data.date };
}

const deviceTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } };

export function createPushClient({ plugin, locale, status, confirm, open, timeZone = deviceTimeZone, signedOutTimeout = 4000 }) {
  let session = null, token = null, permission = 'prompt', registering = null, offered = false;
  const pendingOpens = [];
  let ready = false;

  async function register({ ask = false } = {}) {
    if (registering) return registering;
    registering = (async () => {
      permission = (await plugin.status()).status;
      if (permission === 'denied' || (permission === 'prompt' && !ask)) return permission;
      const result = await plugin.register();
      permission = result.status;
      if (result.token && session) {
        await call('pushRegister', { token: result.token, environment: result.environment, locale: locale(), timeZone: timeZone() });
        token = result.token;
      }
      return permission;
    })().finally(() => { registering = null; });
    return registering;
  }

  function flushOpens() {
    if (!ready) return;
    while (pendingOpens.length) { const target = targetFor(pendingOpens.shift(), session); if (target) open(target); }
  }

  return {
    get permission() { return permission; },
    // Returns true when the signed-in space changed (the event also repeats on every couple update).
    async context(value) {
      const next = value && !value.archive ? value : null;
      if (next?.uid === session?.uid && next?.coupleId === session?.coupleId) return false;
      session = next; ready = false;
      if (!session) return true;
      // Already allowed: refresh the token and language silently on every launch.
      try { await register(); } catch (e) { console.warn('[push] refresh failed', e?.code || e?.message); }
      return true;
    },
    ready() { ready = true; flushOpens(); },
    // After returning from iPhone Settings: register if permission was just granted there.
    async refresh() {
      const previous = permission;
      permission = (await plugin.status()).status;
      if (session && permission === 'granted' && previous !== 'granted') await register();
      return permission;
    },
    opened(data) { pendingOpens.push(data); flushOpens(); },
    async enable() {
      const result = await register({ ask: true });
      if (result === 'denied') await plugin.openSettings();
      return result;
    },
    // A gentle explanation before the one-time system prompt, shown after the first saved diary.
    async offer() {
      if (!session || offered || read(ASKED_KEY)) return;
      offered = true;
      permission = (await plugin.status()).status;
      if (permission !== 'prompt') return;
      write(ASKED_KEY, '1');
      confirm(() => register({ ask: true }).then(status).catch(() => status('error')));
    },
    async languageChanged() { if (token && permission === 'granted') await register().catch(() => {}); },
    async signOut() {
      if (!token) return;
      const current = token; token = null;
      await Promise.race([call('pushUnregister', { token: current }).catch(() => {}), new Promise(r => setTimeout(r, signedOutTimeout))]);
    },
    async preferences() { return { diary: true, reactions: true, anniversaries: true, ...((await getUser()).notify || {}) }; },
    savePreferences: notify => call('pushPrefs', { notify })
  };
}

async function mountNative() {
  const { registerPlugin } = await import('@capacitor/core');
  const plugin = registerPlugin('DiaryPush');
  const ui = () => window.diaryUI;
  const box = document.getElementById('notifySetting'), permissionBox = document.getElementById('notifyPermission');
  const permissionText = document.getElementById('notifyPermissionText'), permissionButton = document.getElementById('notifyPermissionBtn');
  const toggles = { diary: document.getElementById('notifyDiary'), reactions: document.getElementById('notifyReactions'), anniversaries: document.getElementById('notifyAnniversaries') };

  const reportStatus = result => {
    if (result === 'error') ui()?.status('알림을 켜지 못했습니다. 잠시 후 다시 시도해주세요.', 'error');
    render();
  };
  const client = createPushClient({
    plugin,
    locale: () => window.diaryI18n?.getLocale?.() || navigator.language || 'ko',
    status: reportStatus,
    confirm: accept => window.showConfirmModal?.('상대방의 일기 소식을 알려드릴까요?', '상대방이 일기를 쓰거나 내 일기에 하트·댓글을 남기면 바로 알려드려요.', accept, '🔔', '알림 받기'),
    open: ({ date }) => {
      window.closeSettings?.();
      window.switchTab?.('calendar', document.querySelector('.tab-btn'));
      window.goToSearchResult?.(date);
    }
  });
  window.diaryPush = client;

  function render() {
    if (!box) return;
    box.hidden = false;
    const granted = client.permission === 'granted';
    permissionBox.hidden = granted;
    if (!granted) {
      const denied = client.permission === 'denied';
      permissionText.textContent = denied ? 'iPhone 설정에서 알림이 꺼져 있어요.' : '알림을 켜면 상대방의 새 일기와 하트·댓글을 바로 알려드려요.';
      permissionButton.textContent = denied ? '설정 열기' : '알림 켜기';
    }
    for (const input of Object.values(toggles)) input.disabled = !granted;
  }
  let sessionValue = null;
  window.addEventListener('diary:context', async event => {
    sessionValue = event.detail;
    if (!await client.context(sessionValue)) return;
    if (!sessionValue || sessionValue.archive) { if (box) box.hidden = true; return; }
    render();
    try { const prefs = await client.preferences(); for (const [key, input] of Object.entries(toggles)) input.checked = prefs[key] !== false; } catch {}
  });
  window.addEventListener('diary:ready', () => client.ready());
  window.addEventListener('diary:saved', () => client.offer().catch(() => {}));
  window.addEventListener('diary:language-changed', () => client.languageChanged());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sessionValue) client.refresh().catch(() => {}).then(render); });
  permissionButton?.addEventListener('click', async () => {
    try { reportStatus(await client.enable()); } catch { reportStatus('error'); }
  });
  for (const input of Object.values(toggles)) input?.addEventListener('change', async () => {
    const notify = Object.fromEntries(Object.entries(toggles).map(([key, el]) => [key, el.checked]));
    try { await client.savePreferences(notify); }
    catch { input.checked = !input.checked; ui()?.status('알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.', 'error'); }
  });
  await plugin.addListener('opened', data => client.opened(data));
}

if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform() === 'ios') {
  mountNative().catch(e => console.warn('[push] unavailable', e?.message || e));
}

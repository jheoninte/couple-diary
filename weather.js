// Home-screen weather strip: my weather (iOS, WeatherKit) and the partner's shared weather.
// Location is asked for only when the person taps the strip; if refused, they can type a city instead.
import { call, getUser } from './diary-api.js';
import { t } from './i18n.js';
import { formatTemp, fresh, summary, LEGAL_URL } from './weather-core.js';

const CACHE_KEY = 'diary.weather.v1', PLACE_KEY = 'diary.weather.place.v1';
const REFRESH_MS = 30 * 60000, ENTRY_MAX_AGE = 3 * 3600000, PARTNER_MAX_AGE = 6 * 3600000;
const PLACEHOLDER_NAMES = new Set(['나', '파트너']);
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  set(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};

// Decides what the strip shows; kept apart from the DOM so it can be tested.
export function createWeather({ plugin, call: callServer, getUser: readUser, storage = store, now = () => Date.now() }) {
  let session = null, mine = storage.get(CACHE_KEY), status = 'prompt', supported = !!plugin, share = true, sharedAt = 0, loading = null;
  const place = () => storage.get(PLACE_KEY) || '';

  async function shareMine() {
    if (!session || !share || !mine?.data) return;
    if (now() - sharedAt < REFRESH_MS && mine.sharedFor === mine.at) return;
    await callServer('weather', { coupleId: session.coupleId, weather: summary(mine.data) });
    sharedAt = now(); mine = { ...mine, sharedFor: mine.at }; storage.set(CACHE_KEY, mine);
  }

  // ask: show the iOS location prompt if undecided. Returns the plugin status.
  async function load({ ask = false, force = false } = {}) {
    if (!plugin) return 'unsupported';
    if (loading) return loading;
    loading = (async () => {
      const state = await plugin.status();
      supported = state.supported !== false; status = state.status;
      if (!supported) return 'unsupported';
      const query = place();
      if (!query && status === 'denied') return 'denied';
      if (!query && status === 'prompt' && !ask) return 'prompt';
      if (!force && fresh(mine, REFRESH_MS, now()) && (mine.query || '') === query) return 'granted';
      const result = await plugin.current(query ? { query } : { ask });
      if (result.status !== 'granted') { status = query ? status : result.status; return result.status; }
      status = 'granted'; mine = { data: result, at: now(), query }; storage.set(CACHE_KEY, mine);
      await shareMine().catch(() => {});
      return 'granted';
    })().finally(() => { loading = null; });
    return loading;
  }

  return {
    load,
    get state() { return { mine: mine?.data && (mine.query || '') === place() ? mine.data : null, status, supported, place: place(), share }; },
    async context(value) {
      session = value && !value.archive ? value : null;
      if (session) try { share = (await readUser()).shareWeather !== false; } catch {}
    },
    // A typed city, or '' to go back to the current location.
    async setPlace(value) { storage.set(PLACE_KEY, value ? String(value).trim().slice(0, 60) : null); return load({ force: true }); },
    async setShare(on) {
      share = on;
      if (!session) return;
      if (!on) await callServer('weather', { coupleId: session.coupleId, share: false });
      else { await callServer('weather', { coupleId: session.coupleId, share: true }); sharedAt = 0; if (mine) mine = { ...mine, sharedFor: null }; await shareMine(); }
    },
    // The weather recorded on a diary written today; nothing for past dates or stale readings.
    forEntry(date, today) {
      if (date !== today || !fresh(mine, ENTRY_MAX_AGE, now()) || (mine.query || '') !== place()) return undefined;
      const s = summary(mine.data); return s ? { icon: s.icon, temp: s.temp } : undefined;
    }
  };
}

export function partnerWeather(couple, uid, now = Date.now()) {
  const partner = couple && [couple.user1, couple.user2].find(u => u && u !== uid);
  const row = partner && couple.weather?.[partner];
  if (!row || !fresh(row, PARTNER_MAX_AGE, now)) return null;
  const name = couple.settings?.[partner]?.displayName;
  return { ...row, name: name && !PLACEHOLDER_NAMES.has(name) ? name : '' };
}

function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }

async function mount() {
  const strip = document.getElementById('weatherStrip'); if (!strip) return;
  const mineBox = document.getElementById('weatherMine'), partnerBox = document.getElementById('weatherPartner');
  const attribution = document.getElementById('weatherAttribution');
  const setting = document.getElementById('weatherSetting'), shareToggle = document.getElementById('weatherShare');
  const native = window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform() === 'ios';
  let plugin = null;
  if (native) { const { registerPlugin } = await import('@capacitor/core'); plugin = registerPlugin('DiaryWeather'); }
  const weather = createWeather({ plugin, call, getUser });
  window.diaryWeather = weather;
  let couple = null, uid = null;

  function render() {
    const { mine, status, supported, place } = weather.state;
    mineBox.replaceChildren();
    if (mine) {
      const now = el('button', 'weather-now'); now.type = 'button'; now.setAttribute('aria-label', t('지역 바꾸기'));
      now.append(el('span', 'weather-icon', summary(mine).icon), el('span', 'weather-temp', formatTemp(mine.temp)));
      const meta = el('div', 'weather-meta');
      meta.append(el('span', 'weather-city', (place ? '' : '📍 ') + (mine.city || place)));
      if (Number.isFinite(mine.high) && Number.isFinite(mine.low)) meta.append(el('span', 'weather-range', t('최고 {high} · 최저 {low}', { high: formatTemp(mine.high), low: formatTemp(mine.low) })));
      now.onclick = choosePlace; meta.onclick = choosePlace;
      mineBox.append(now, meta);
    } else if (plugin && supported) {
      const button = el('button', 'weather-enable', status === 'denied' ? t('📍 지역을 입력해 날씨 보기') : t('📍 내 지역 날씨 보기'));
      button.type = 'button';
      button.onclick = async () => {
        if (weather.state.status === 'denied') return choosePlace();
        button.disabled = true;
        try { const result = await weather.load({ ask: true }); if (result === 'denied') await choosePlace(); }
        catch { window.diaryUI?.status('날씨를 불러오지 못했어요. 잠시 후 다시 시도해주세요.', 'error'); }
        finally { render(); }
      };
      mineBox.append(button);
    }
    const partner = partnerWeather(couple, uid);
    partnerBox.hidden = !partner; partnerBox.replaceChildren();
    if (partner) {
      partnerBox.append(el('span', 'weather-icon small', partner.icon), el('span', 'weather-temp small', formatTemp(partner.temp)));
      partnerBox.append(el('span', 'weather-partner-label', [partner.name, partner.city].filter(Boolean).join(' · ')));
    }
    const any = mine || partner;
    strip.hidden = !any && !mineBox.childElementCount;
    // Apple requires the Weather mark and a legal link wherever WeatherKit data is shown.
    attribution.hidden = !any; attribution.replaceChildren();
    if (any) {
      if (mine?.markLight) { const img = el('img'); img.src = mine.markLight; img.alt = 'Apple Weather'; img.onerror = () => img.replaceWith(el('span', null, ' Weather')); attribution.append(img); }
      else attribution.append(el('span', null, native ? ' Weather' : 'Apple Weather'));
    }
    if (setting) setting.hidden = !(plugin && supported);
    if (shareToggle) shareToggle.checked = weather.state.share;
  }

  async function choosePlace() {
    const current = weather.state.place;
    const answer = window.prompt(t('날씨를 볼 도시 이름을 입력하세요. 비워두면 현재 위치를 사용해요.'), current);
    if (answer === null) return;
    try {
      const result = await weather.setPlace(answer);
      if (result === 'notFound') { window.diaryUI?.status('그 지역을 찾지 못했어요. 도시 이름을 다시 확인해주세요.', 'error'); await weather.setPlace(current); }
    } catch { window.diaryUI?.status('날씨를 불러오지 못했어요. 잠시 후 다시 시도해주세요.', 'error'); }
    render();
  }

  attribution.addEventListener('click', () => { if (plugin) plugin.openLegal().catch(() => {}); else window.open(LEGAL_URL, '_blank', 'noopener'); });
  shareToggle?.addEventListener('change', async () => {
    try { await weather.setShare(shareToggle.checked); }
    catch { shareToggle.checked = !shareToggle.checked; window.diaryUI?.status('설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.', 'error'); }
  });
  let contextKey = null;
  window.addEventListener('diary:context', async event => {
    // The event repeats on every couple update; only a new sign-in or space needs a reload.
    const value = event.detail, key = value ? `${value.uid}/${value.coupleId}/${!!value.archive}` : null;
    if (key === contextKey) return; contextKey = key; uid = value?.uid || null;
    await weather.context(value); if (value) weather.load().catch(() => {}).then(render); else render();
  });
  window.addEventListener('diary:couple', event => { couple = event.detail; render(); });
  window.addEventListener('diary:language-changed', render);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && uid) weather.load().catch(() => {}).then(render); });
  render();
}

if (typeof document !== 'undefined' && !globalThis.__diaryWeatherTest) mount().catch(e => console.warn('[weather] unavailable', e?.message || e));

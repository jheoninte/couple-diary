import { NATIVE_CONFIG } from './native-config.js';
import { ensureTrackingDecision } from './ads-tracking.js';
// Only the bundled iOS app imports native packages. A regular browser keeps working.
if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform() === 'ios') {
  document.body.classList.add('native-ios');
  window.diaryNativeReady = initializeNative();
  window.diaryNativeReady.catch(() => window.dispatchEvent(new Event('diary:native-unavailable')));
}
async function initializeNative() {
  const { registerPlugin } = await import('@capacitor/core');
  const store = registerPlugin('DiaryStore');
  window.diaryStore = {
    products: [],
    async load() { this.products = (await store.products()).products; return this.products; },
    purchase: options => store.purchase(options),
    restore: () => store.restore(),
    pending: () => store.pending(),
    finish: options => store.finish(options),
    manage: () => store.manage(),
    onTransaction: listener => store.addListener('transactionUpdated', listener),
  };
  const photos = registerPlugin('DiaryPhotos');
  window.diaryPhotoPicker = { pick: limit => photos.pick({ limit }).then(r => r.photos || []) };
  // Ads are not initialized on the login page, before membership is known, or for Plus users.
  let sdk, permission = false, started, nonPersonalized = false, privacyRequired = false;
  // The privacy-options entry is only meaningful where UMP requires it (EEA/UK/CH); elsewhere the form never opens.
  const syncPrivacyButton = () => { const b = document.getElementById('adPrivacyBtn'); if (b) b.hidden = !privacyRequired; };
  async function consent() {
    if (started) return started;
    started = (async () => {
      sdk = await import('@capacitor-community/admob');
      // Order: consent (UMP) → tracking permission (ATT) → ad SDK.
      try {
        let info = await sdk.AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await sdk.AdMob.showConsentForm();
        permission = info.canRequestAds === true; nonPersonalized = false;
        privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED'; syncPrivacyButton();
        console.info('[ads] consent status', info.status, 'canRequestAds', permission);
      } catch (e) {
        console.warn('[ads] consent unavailable; non-personalized ads only', e?.message || e);
        permission = true; nonPersonalized = true;
      }
      console.info('[ads] tracking', await ensureTrackingDecision(sdk.AdMob));
      if (permission) await sdk.AdMob.initialize({ initializeForTesting: NATIVE_CONFIG.testAds });
    })().catch(e => { console.warn('[ads] setup failed', e?.code || '', e?.message || e); permission = false; started = null; });
    await started;
  }
  window.diaryAdConsent = { canRequestAds: () => permission, privacyRequired: () => privacyRequired,
    async request() { await consent(); window.dispatchEvent(new Event('diary:ad-consent-changed')); },
    async privacy() {
      await consent(); if (!sdk) return;
      const previous = permission; permission = false; window.dispatchEvent(new Event('diary:ad-consent-changed'));
      try { await sdk.AdMob.showPrivacyOptionsForm(); permission = (await sdk.AdMob.requestConsentInfo()).canRequestAds === true; nonPersonalized = false; if (permission) await ensureTrackingDecision(sdk.AdMob); }
      catch (e) { permission = previous; throw e; }
      finally { window.dispatchEvent(new Event('diary:ad-consent-changed')); }
    }
  };
  const overlayOpen = () => !!document.querySelector('dialog[open],.modal.active,.settings-modal.active');
  let bannerWanted = false, bannerVisible = false;
  function setAdSpace(px) { document.documentElement.style.setProperty('--native-ad-space', px + 'px'); }
  function syncBannerWithOverlays() {
    if (!bannerWanted || !sdk) return;
    if (overlayOpen()) { if (bannerVisible) { bannerVisible = false; setAdSpace(0); sdk.AdMob.removeBanner().catch(() => {}); } }
    else if (!bannerVisible) window.diaryNativeAds.showBanner().catch(() => {});
  }
  let loadListener;
  async function watchBannerLoads() {
    if (loadListener || !sdk) return;
    loadListener = await sdk.AdMob.addListener('bannerAdLoaded', event => {
      // Use actual height when available; fall back to 50 (standard phone banner)
      const h = event?.size?.height || event?.height || 50;
      setAdSpace(Math.max(50, Math.min(h, 90)));
      if (!bannerVisible) sdk.AdMob.removeBanner().catch(() => {});
    });
  }
  new MutationObserver(syncBannerWithOverlays).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
  window.diaryNativeAds = {
    async showBanner() {
      if (!permission) return;
      bannerWanted = true;
      if (overlayOpen() || bannerVisible) return;
      const navHeight = document.querySelector('.tab-nav')?.getBoundingClientRect().height || 82;
      document.documentElement.style.setProperty('--native-nav-space', `${navHeight}px`);
      setAdSpace(50); // provisional until bannerAdLoaded reports real height
      bannerVisible = true;
      await watchBannerLoads().catch(() => {});
      try {
        await sdk.AdMob.showBanner({ adId: NATIVE_CONFIG.bannerId, isTesting: NATIVE_CONFIG.testAds,
          adSize: sdk.BannerAdSize.BANNER, npa: nonPersonalized, position: sdk.BannerAdPosition.BOTTOM_CENTER, margin: Math.ceil(navHeight + 8) });
      } catch (e) { bannerVisible = false; setAdSpace(0); throw e; }
      if (!bannerWanted || overlayOpen()) { bannerVisible = false; setAdSpace(0); await sdk.AdMob.removeBanner(); }
    },
    async hideBanner() { bannerWanted = false; bannerVisible = false; setAdSpace(0); await sdk?.AdMob.removeBanner(); },
    async showInterstitial() {
      if (!permission) return;
      await sdk.AdMob.prepareInterstitial({ adId: NATIVE_CONFIG.interstitialId, isTesting: NATIVE_CONFIG.testAds, npa: nonPersonalized });
      if (!permission || window.diaryMonetization?.state()?.premium || document.visibilityState !== 'visible' ||
          !document.querySelector('#calendar.active') || document.querySelector('dialog[open],.settings-modal.active,.modal.active')) return;
      await sdk.AdMob.showInterstitial();
    }
  };
  window.dispatchEvent(new Event('diary:native-ready'));
}

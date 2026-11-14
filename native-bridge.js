import { NATIVE_CONFIG } from './native-config.js';
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
  // Ads are not initialized on the login page, before membership is known, or for Plus users.
  let sdk, permission = false, started;
  async function consent() {
    if (started) return started;
    started = (async () => {
      sdk = await import('@capacitor-community/admob');
      let info = await sdk.AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await sdk.AdMob.showConsentForm();
      permission = info.canRequestAds === true;
      if (permission) await sdk.AdMob.initialize({ initializeForTesting: NATIVE_CONFIG.testAds });
    })().catch(() => { permission = false; started = null; });
    await started;
  }
  window.diaryAdConsent = { canRequestAds: () => permission,
    async request() { await consent(); window.dispatchEvent(new Event('diary:ad-consent-changed')); },
    async privacy() {
      await consent(); if (!sdk) return;
      permission = false; window.dispatchEvent(new Event('diary:ad-consent-changed'));
      try { await sdk.AdMob.showPrivacyOptionsForm(); permission = (await sdk.AdMob.requestConsentInfo()).canRequestAds === true; }
      finally { window.dispatchEvent(new Event('diary:ad-consent-changed')); }
    }
  };
  window.diaryNativeAds = {
    async showBanner() {
      if (!permission) return;
      // Reserve 60 points above bottom navigation. Never place a banner over the tab bar.
      document.documentElement.style.setProperty('--native-ad-space', '60px');
      try {
        await sdk.AdMob.showBanner({ adId: NATIVE_CONFIG.bannerId, isTesting: NATIVE_CONFIG.testAds,
          adSize: sdk.BannerAdSize.BANNER, position: sdk.BannerAdPosition.BOTTOM_CENTER, margin: 82 });
      } catch (e) { document.documentElement.style.setProperty('--native-ad-space', '0px'); throw e; }
    },
    async hideBanner() { document.documentElement.style.setProperty('--native-ad-space', '0px'); await sdk?.AdMob.removeBanner(); },
    async showInterstitial() {
      if (!permission) return;
      await sdk.AdMob.prepareInterstitial({ adId: NATIVE_CONFIG.interstitialId, isTesting: NATIVE_CONFIG.testAds });
      // Loading can take time; recheck before presenting the native overlay.
      if (!permission || window.diaryMonetization?.state()?.premium || document.visibilityState !== 'visible' ||
          !document.querySelector('#calendar.active') || document.querySelector('dialog[open],.settings-modal.active,.modal.active')) return;
      await sdk.AdMob.showInterstitial();
    }
  };
  window.dispatchEvent(new Event('diary:native-ready'));
}

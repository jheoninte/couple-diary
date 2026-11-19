import { NATIVE_CONFIG } from './native-config.js';
import { ensureTrackingDecision } from './ads-tracking.js';
import { createNativeAdsAdapter } from './native-ads.js';
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
        console.warn('[ads] consent unavailable; skipping ads', e?.message || e);
        permission = false;
      }
      if (permission) {
        console.info('[ads] tracking', await ensureTrackingDecision(sdk.AdMob));
        await sdk.AdMob.initialize({ initializeForTesting: NATIVE_CONFIG.testAds });
      }
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
  window.diaryNativeAds = createNativeAdsAdapter({
    getSDK: () => sdk, config: NATIVE_CONFIG, canRequestAds: () => permission,
    isPremium: () => window.diaryMonetization?.state()?.premium !== false,
    isBillingBusy: () => window.diaryBilling?.busy === true,
    nonPersonalized: () => nonPersonalized,
  });
  window.dispatchEvent(new Event('diary:native-ready'));
}

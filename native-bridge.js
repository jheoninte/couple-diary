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
  // Ads are not initialized on the login page, before membership is known, or for Plus users.
  let sdk, permission = false, started, nonPersonalized = false;
  async function consent() {
    if (started) return started;
    started = (async () => {
      sdk = await import('@capacitor-community/admob');
      // Order: consent (UMP) → tracking permission (ATT) → ad SDK.
      try {
        let info = await sdk.AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await sdk.AdMob.showConsentForm();
        permission = info.canRequestAds === true; nonPersonalized = false;
        console.info('[ads] consent status', info.status, 'canRequestAds', permission);
      } catch (e) {
        // UMP fails when no consent message is published for this app in AdMob (Privacy & messaging).
        // Keep the diary usable and ask for tracking anyway; serve only non-personalized ads until consent works.
        console.warn('[ads] consent unavailable; non-personalized ads only', e?.message || e);
        permission = true; nonPersonalized = true;
      }
      // The tracking prompt is independent of consent so it is always offered once on iOS.
      console.info('[ads] tracking', await ensureTrackingDecision(sdk.AdMob));
      if (permission) await sdk.AdMob.initialize({ initializeForTesting: NATIVE_CONFIG.testAds });
    })().catch(e => { console.warn('[ads] setup failed', e?.code || '', e?.message || e); permission = false; started = null; });
    await started;
  }
  window.diaryAdConsent = { canRequestAds: () => permission,
    async request() { await consent(); window.dispatchEvent(new Event('diary:ad-consent-changed')); },
    async privacy() {
      await consent(); if (!sdk) return;
      const previous = permission; permission = false; window.dispatchEvent(new Event('diary:ad-consent-changed'));
      try { await sdk.AdMob.showPrivacyOptionsForm(); permission = (await sdk.AdMob.requestConsentInfo()).canRequestAds === true; nonPersonalized = false; if (permission) await ensureTrackingDecision(sdk.AdMob); }
      catch (e) { permission = previous; throw e; } // consent form not configured: keep the current (non-personalized) state
      finally { window.dispatchEvent(new Event('diary:ad-consent-changed')); }
    }
  };
  // The native banner floats above the web view, so it must never cover a sheet such as the Plus purchase screen.
  // While a dialog/modal is open the banner is removed; it is requested again when the last one closes.
  const overlayOpen = () => !!document.querySelector('dialog[open],.modal.active,.settings-modal.active');
  let bannerWanted = false, bannerVisible = false;
  function syncBannerWithOverlays() {
    if (!bannerWanted || !sdk) return;
    if (overlayOpen()) { if (bannerVisible) { bannerVisible = false; document.documentElement.style.setProperty('--native-ad-space', '0px'); sdk.AdMob.removeBanner().catch(() => {}); } }
    else if (!bannerVisible) window.diaryNativeAds.showBanner().catch(() => {});
  }
  new MutationObserver(syncBannerWithOverlays).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
  window.diaryNativeAds = {
    async showBanner() {
      if (!permission) return;
      bannerWanted = true;
      if (overlayOpen() || bannerVisible) return;
      // Reserve 60 points above bottom navigation. Never place a banner over the tab bar.
      const navHeight = document.querySelector('.tab-nav')?.getBoundingClientRect().height || 82;
      document.documentElement.style.setProperty('--native-nav-space', `${navHeight}px`);
      document.documentElement.style.setProperty('--native-ad-space', '60px');
      bannerVisible = true;
      try {
        await sdk.AdMob.showBanner({ adId: NATIVE_CONFIG.bannerId, isTesting: NATIVE_CONFIG.testAds,
          adSize: sdk.BannerAdSize.BANNER, npa: nonPersonalized, position: sdk.BannerAdPosition.BOTTOM_CENTER, margin: Math.ceil(navHeight + 8) });
      } catch (e) { bannerVisible = false; document.documentElement.style.setProperty('--native-ad-space', '0px'); throw e; }
      if (!bannerWanted || overlayOpen()) { bannerVisible = false; document.documentElement.style.setProperty('--native-ad-space', '0px'); await sdk.AdMob.removeBanner(); }
    },
    async hideBanner() { bannerWanted = false; bannerVisible = false; document.documentElement.style.setProperty('--native-ad-space', '0px'); await sdk?.AdMob.removeBanner(); },
    async showInterstitial() {
      if (!permission) return;
      await sdk.AdMob.prepareInterstitial({ adId: NATIVE_CONFIG.interstitialId, isTesting: NATIVE_CONFIG.testAds, npa: nonPersonalized });
      // Loading can take time; recheck before presenting the native overlay.
      if (!permission || window.diaryMonetization?.state()?.premium || document.visibilityState !== 'visible' ||
          !document.querySelector('#calendar.active') || document.querySelector('dialog[open],.settings-modal.active,.modal.active')) return;
      await sdk.AdMob.showInterstitial();
    }
  };
  const footer = document.querySelector('.app-footer');
  if (footer) {
    const button = document.createElement('button');
    button.className = 'text-button'; button.textContent = '광고 개인정보 설정';
    button.onclick = () => window.diaryAdConsent.privacy().catch(() =>
      window.diaryUI?.status('광고 개인정보 설정을 열지 못했습니다. 잠시 후 다시 시도해주세요.', 'error'));
    footer.append(document.createElement('br'), button);
  }
  window.dispatchEvent(new Event('diary:native-ready'));
}

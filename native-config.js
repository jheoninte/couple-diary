// Public identifiers only. TestFlight keeps official test units; release requires explicit opt-in.
const testAds = import.meta.env?.VITE_ADMOB_LIVE_ADS !== 'true';
export const NATIVE_CONFIG = Object.freeze({
  bundleId: 'com.interest.couplediary', testAds,
  appStoreId: '6834614043', teamId: '79978S7426',
  admobAppId: 'ca-app-pub-6762072012517736~9647026272',
  productionAdmobAppId: 'ca-app-pub-6762072012517736~9647026272', // Ownership verified in AdMob 2026-11-14; store link/review pending.
  productionBannerId: 'ca-app-pub-6762072012517736/2402961079',
  productionInterstitialId: 'ca-app-pub-6762072012517736/7387869458',
  bannerId: testAds ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-6762072012517736/2402961079',
  interstitialId: testAds ? 'ca-app-pub-3940256099942544/4411468910' : 'ca-app-pub-6762072012517736/7387869458',
  products: { monthly: 'com.interest.couplediary.plus.monthly', yearly: 'com.interest.couplediary.plus.yearly' }
});

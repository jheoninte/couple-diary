// Public IDs only. AdMob's native SDK cannot serve ads in a normal web browser.
// Keep off until the website is approved and a consent-management integration exists.
export const ADS_CONFIG = Object.freeze({
  provider: typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? "native" : "none",
  publisherId: "", // Web AdSense ca-pub-****************, NOT an AdMob app ID
  bannerSlot: "",
  interstitialEnabled: true, // Applied only by the native provider; web remains off.
});

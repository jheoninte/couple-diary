import { ADS_CONFIG } from "./ads-config.js";
import { recordSave, canShowInterstitial } from "./monetization-core.js";

// The CMP and future native SDK adapter must explicitly opt in. Never assume consent.
export function createAdsController({
  config = ADS_CONFIG,
  storage = null,
  now = () => Date.now(),
} = {}) {
  if (!storage) {
    try {
      storage = window.localStorage;
    } catch {
      /* No storage means no interstitials. */
    }
  }
  let session = null,
    premium = true,
    banner = null,
    bannerRequest = 0,
    lastContext = "";
  const consent = () => {
    try {
      return window.diaryAdConsent?.canRequestAds?.() === true;
    } catch {
      return false;
    }
  };
  const native = () =>
    config.provider === "native" ? window.diaryNativeAds : null;
  function removeBanner() {
    bannerRequest++;
    banner?.replaceChildren();
    banner = null;
    document.getElementById("adBanner").hidden = true;
    try {
      Promise.resolve(native()?.hideBanner?.()).catch(() => {});
    } catch {
      /* SDK errors cannot block records. */
    }
  }
  async function updateBanner() {
    removeBanner();
    if (!session || session.archive || premium || !consent()) return;
    const request = bannerRequest;
    if (native()) {
      const adapter = native();
      await adapter.showBanner?.();
      if (request !== bannerRequest || premium || !consent()) {
        try {
          await adapter.hideBanner?.();
        } catch {
          /* The next render also clears banners. */
        }
      }
      return;
    }
    if (
      config.provider !== "adsense" ||
      !/^ca-pub-\d{16}$/.test(config.publisherId) ||
      !/^\d{10}$/.test(config.bannerSlot)
    )
      return;
    if (!document.getElementById("adsense-loader")) {
      const script = document.createElement("script");
      script.id = "adsense-loader";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}`;
      script.onload = () => {
        if (request === bannerRequest) mount();
      };
      script.onerror = removeBanner;
      document.head.append(script);
    } else mount();
    function mount() {
      if (request !== bannerRequest || premium || !consent() || !session)
        return;
      banner = document.getElementById("adBannerMount");
      const ad = document.createElement("ins");
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.dataset.adClient = config.publisherId;
      ad.dataset.adSlot = config.bannerSlot;
      ad.dataset.adFormat = "horizontal";
      ad.dataset.fullWidthResponsive = "true";
      banner.append(ad);
      document.getElementById("adBanner").hidden = false;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        removeBanner();
      }
    }
  }
  return {
    update(context, isPremium) {
      const key = JSON.stringify([
        context?.uid,
        context?.coupleId,
        context?.archive,
        isPremium,
      ]);
      session = context;
      premium = isPremium;
      if (lastContext === key) return Promise.resolve();
      lastContext = key;
      return updateBanner();
    },
    reset() {
      premium = true;
      session = null;
      lastContext = "";
      removeBanner();
    },
    consentChanged() {
      return updateBanner();
    },
    async afterSave() {
      if (
        !session ||
        session.archive ||
        premium ||
        !config.interstitialEnabled ||
        !native() ||
        !consent()
      )
        return;
      const key = `diary:ads:v1:${session.uid}`;
      let counts;
      try {
        counts = recordSave(JSON.parse(storage.getItem(key) || "null"), now());
        storage.setItem(key, JSON.stringify(counts));
      } catch {
        return;
      }
      if (
        !canShowInterstitial(counts, now()) ||
        document.visibilityState !== "visible" ||
        !document.querySelector("#calendar.active") ||
        document.querySelector(
          "dialog[open],.settings-modal.active,.confirm-modal.active,.modal.active",
        )
      )
        return;
      // Reserve before showing: failures skip an opportunity rather than repeat ads.
      counts.shown++;
      counts.lastShown = now();
      try {
        storage.setItem(key, JSON.stringify(counts));
      } catch {
        return;
      }
      try {
        await native().showInterstitial?.();
      } catch {
        /* Ads never block saved records. */
      }
    },
  };
}

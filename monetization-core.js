// No payment privileges live in this module. These helpers only control presentation.
export function annualDiscount(monthly, yearly) {
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}
export function activeMembership(state, now = Date.now()) {
  return (
    state?.premium === true &&
    Number.isSafeInteger(state.premiumUntil) &&
    state.premiumUntil > now
  );
}
export const AD_POLICY = Object.freeze({
  graceMs: 48 * 60 * 60 * 1000,
  minimumSaves: 3,
  savesBetweenAds: 3,
  cooldownMs: 24 * 60 * 60 * 1000,
  maxPerDay: 1,
  minimumSessionMs: 2 * 60 * 1000,
  afterSaveMs: 30 * 1000,
  opportunityMs: 10 * 60 * 1000,
  maximumTransitionDelayMs: 1000,
});
export function adDay(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function adState(old, now) {
  const sameDay = old?.day === adDay(now);
  return {
    firstSeenAt: Number.isFinite(old?.firstSeenAt) ? old.firstSeenAt : now,
    saves: Math.max(0, Number(old?.saves) || 0),
    day: adDay(now),
    shown: sameDay ? Math.max(0, Number(old?.shown) || 0) : 0,
    lastShown: Number.isFinite(old?.lastShown) ? old.lastShown : null,
    lastShownSave: Math.max(0, Number(old?.lastShownSave) || 0),
  };
}
export function recordSave(old, now) {
  const state = adState(old, now);
  return {...state, saves: state.saves + 1};
}
export function canShowInterstitial(counts, now) {
  return (
    !!counts &&
    now - counts.firstSeenAt >= AD_POLICY.graceMs &&
    counts.saves >= AD_POLICY.minimumSaves &&
    counts.saves - counts.lastShownSave >= AD_POLICY.savesBetweenAds &&
    (counts.day !== adDay(now) || counts.shown < AD_POLICY.maxPerDay) &&
    (counts.lastShown === null || now - counts.lastShown >= AD_POLICY.cooldownMs)
  );
}

import { call } from "./diary-api.js";
import { activeMembership, annualDiscount } from "./monetization-core.js";
import { createAdsController } from "./ads-controller.js";
import './native-bridge.js';
import './native-billing.js';
import { t, fmt } from './i18n.js';

let session = null,
  state = null,
  generation = 0,
  refreshing = null,
  expiryTimer = null;
const ads = createAdsController();
const won = (value) => fmt.won(value);
const dialog = document.createElement("dialog");
dialog.id = "membershipDialog";
dialog.setAttribute("aria-labelledby", "membershipTitle");
dialog.innerHTML = `<button class="membership-close" aria-label="구독 안내 닫기">×</button>
    <div class="plus-mark" aria-hidden="true">✦</div><p class="eyebrow">OUR SPACE PLUS</p>
    <h2 id="membershipTitle">우리의 순간을,<br>사진으로 더 오래.</h2>
    <p class="membership-lead">한 명이 구독하면 두 사람 모두 함께 누려요.</p>
    <ul class="membership-benefits"><li>매일의 일기에 사진 최대 3장</li><li>둘만의 사진 앨범</li><li>두 사람 모두 광고 없이</li></ul>
    <fieldset class="plan-options"><legend class="sr-only">구독 요금제 선택</legend>
        <label class="plan-option"><input type="radio" name="plusPlan" value="monthly"><span>월간 구독<small>매월 결제</small></span><strong id="monthlyPrice">확인 중</strong></label>
        <label class="plan-option"><input type="radio" name="plusPlan" value="yearly" checked><span>연간 구독 <em id="annualDiscount"></em><small id="annualEquivalent">연간 금액을 한 번에 결제</small></span><strong id="yearlyPrice">확인 중</strong></label>
    </fieldset>
    <p id="membershipState" class="membership-state" role="status">구독 정보를 확인하고 있어요.</p>
    <button id="membershipCheckout" class="save-btn" disabled>결제 연동 준비 중</button>
    <button id="membershipRefresh" class="text-button">구독 상태 새로고침</button>
    <div id="nativeBillingActions" hidden><button id="restorePurchases" class="text-button">구매 복원</button><button id="manageSubscription" class="text-button">Apple 구독 관리</button></div>
    <p class="membership-terms" id="membershipRenewal"></p>
    <p class="membership-terms">사진은 자동 압축됩니다. 일기당 최대 3장, 1인 하루 업로드 6회·월 90회입니다. 실패한 업로드 예약도 한도에 포함될 수 있습니다.</p>
    <p class="membership-terms"><a href="https://www.comino.app/privacy-p-kr" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a> · <a href="https://www.comino.app/term-p-kr" target="_blank" rel="noopener noreferrer">이용약관</a></p>
    <p class="membership-terms">구독이 끝나도 기존 일기와 사진은 계속 볼 수 있어요. 새 사진 첨부만 제한되며, 텍스트 기록은 계속 무료입니다.</p>`;
document.body.append(dialog);
const adBanner = document.createElement("aside");
adBanner.id = "adBanner";
adBanner.hidden = true;
adBanner.setAttribute("aria-label", "광고");
adBanner.innerHTML =
  '<span class="ad-label">광고</span><div id="adBannerMount"></div>';
document.getElementById("mainContent").after(adBanner);
const entry = document.getElementById("membershipBtn");
document.querySelector(".membership-close").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
entry.onclick = () => openPaywall();
document.getElementById("membershipRefresh").onclick = () => refresh(true);
for (const [id, method] of [['membershipCheckout', 'buy'], ['restorePurchases', 'restore'], ['manageSubscription', 'manage']]) {
  document.getElementById(id).onclick = async () => {
    try { await window.diaryBilling?.[method](dialog.querySelector('input[name=plusPlan]:checked').value); }
    catch (e) { document.getElementById('membershipState').textContent = e.message || '구독을 처리하지 못했습니다. 잠시 후 복원해주세요.'; }
  };
}
window.addEventListener('diary:billing-updated', render);
window.addEventListener('diary:native-ready', render);
const adPrivacyBtn = document.getElementById('adPrivacyBtn');
if (adPrivacyBtn) {
  adPrivacyBtn.onclick = async () => {
    try { await window.diaryAdConsent?.privacy?.(); }
    catch { window.diaryUI?.status?.('광고 개인정보 설정을 열지 못했습니다. 잠시 후 다시 시도해주세요.', 'error'); }
  };
}
dialog
  .querySelectorAll("input[name=plusPlan]")
  .forEach((input) => input.addEventListener("change", renderRenewal));

function renderRenewal() {
  if (!state?.plans) return;
  const plan = dialog.querySelector("input[name=plusPlan]:checked").value,
    price = state.plans[plan].amount;
  document.getElementById("membershipRenewal").textContent =
    window.diaryBilling?.available && window.diaryBilling.products[plan]
      ? t(plan === 'yearly' ? '1년마다 {price} 자동 갱신됩니다. 결제는 Apple 계정에 청구되며, 다음 갱신 전 Apple 구독 관리에서 해지할 수 있습니다. 연간 구독은 한 번에 청구됩니다.' : '1개월마다 {price} 자동 갱신됩니다. 결제는 Apple 계정에 청구되며, 다음 갱신 전 Apple 구독 관리에서 해지할 수 있습니다. 연간 구독은 한 번에 청구됩니다.', { price: window.diaryBilling.products[plan].displayPrice })
      : t('결제 연결 후 {plan} 자동 갱신 상품으로 제공할 예정입니다. 현재는 요금 안내만 제공하며 결제·구독 신청은 발생하지 않습니다.', { plan: t(plan === 'yearly' ? '연 {price}' : '월 {price}', { price: won(price) }) });
}
function render() {
  const active = activeMembership(state);
  const cached = window.diaryBilling?.cachedUntil?.() || 0;
  const showCached = !active && cached > Date.now();
  entry.textContent = active ? "PLUS 이용 중" : showCached ? "PLUS" : "PLUS";
  entry.classList.toggle("subscribed", active);
  const stateEl = document.getElementById("membershipState");
  const billing = window.diaryBilling;
  const native = document.body.classList.contains('native-ios');
  const adPrivacy = document.getElementById('adPrivacyBtn');
  if (adPrivacy) adPrivacy.hidden = !(native && window.diaryAdConsent?.privacy);
  if (state?.plans) {
    const { monthly, yearly } = state.plans;
    document.getElementById("monthlyPrice").textContent =
      t('{price} / 월', { price: won(monthly.amount) });
    document.getElementById("yearlyPrice").textContent =
      t('{price} / 년', { price: won(yearly.amount) });
    document.getElementById("annualDiscount").textContent =
      t('{n}% 할인', { n: fmt.number(annualDiscount(monthly.amount, yearly.amount)) });
    document.getElementById("annualEquivalent").textContent =
      t('월 {price} 수준 · 연간 일시 결제', { price: won(yearly.amount / 12) });
  }
  if (native && billing?.products.monthly && billing?.products.yearly) {
    const {monthly,yearly} = billing.products;
    document.getElementById('monthlyPrice').textContent = t('{price} / 월', { price: monthly.displayPrice });
    document.getElementById('yearlyPrice').textContent = t('{price} / 년', { price: yearly.displayPrice });
    const sameCurrency = typeof monthly.currency === 'string' && monthly.currency === yearly.currency && Number.isFinite(monthly.amount) && Number.isFinite(yearly.amount);
    document.getElementById('annualDiscount').textContent = sameCurrency ? t('{n}% 할인', { n: fmt.number(annualDiscount(monthly.amount, yearly.amount)) }) : '';
    document.getElementById('annualEquivalent').textContent = sameCurrency ? t('월 {price} 수준 · 연간 일시 결제', { price: fmt.currency(yearly.amount / 12, yearly.currency) }) : '연간 일시 결제';
  }
  const chosen = dialog.querySelector('input[name=plusPlan]:checked').value;
  const checkout = document.getElementById('membershipCheckout');
  checkout.disabled = !state || active || !billing?.available || !billing.products[chosen] || billing.busy;
  checkout.textContent = billing?.busy ? '구독 확인 중…' : active ? '두 사람 모두 Plus 이용 중' : billing?.available && billing.products[chosen] ? 'Apple로 구독하기' : '결제 연동 준비 중';
  document.getElementById('nativeBillingActions').hidden = !native;
  document.getElementById('restorePurchases').disabled = !billing?.available || billing.busy;
  stateEl.textContent = active
    ? t('두 사람 모두 Plus 이용 중 · {date}까지', { date: fmt.date(state.premiumUntil) })
    : showCached
      ? t('구독 상태를 확인하고 있어요. 이전 기록은 {date}까지 유효했습니다.', { date: fmt.date(cached) })
      : state
        ? native ? billing?.available ? 'App Store에서 결제 금액을 확인하고 구독할 수 있어요.' : 'App Store 상품과 서버 연결을 준비 중이에요. 결제는 비활성 상태입니다.' : "Plus 구독은 iOS 앱에서 이용할 수 있습니다."
        : "구독 상태를 확인하지 못했어요. 연결 후 다시 확인해주세요.";
  const hint = document.getElementById("photoPlanHint");
  if (hint)
    hint.textContent = active
      ? "최대 3장 · JPEG, PNG, WebP"
      : "Plus 구독으로 사진 최대 3장";
  renderRenewal();
  clearTimeout(expiryTimer);
  if (active)
    expiryTimer = setTimeout(
      () => {
        state = null;
        ads.reset();
        render();
        refresh();
        window.diaryUI?.status?.('구독 기간이 끝났습니다. 새 사진 첨부는 Plus가 필요해요.', 'info');
      },
      Math.min(2147483647, Math.max(1000, state.premiumUntil - Date.now())),
    );
  ads.update(session, state ? active : true).catch(() => ads.reset());
  if (native && session && state && !active) window.diaryAdConsent?.request?.();
}
async function refresh(force = false) {
  if (!session || session.archive) {
    state = null;
    render();
    return;
  }
  if (refreshing && !force) return refreshing;
  const current = ++generation,
    context = { ...session };
  refreshing = (async () => {
    try {
      const next = await call("membership", { coupleId: context.coupleId });
      if (current !== generation) return;
      state = next;
      if (next?.premiumUntil) window.diaryBilling?.cacheStatus?.(next.premiumUntil);
      render();
    } catch {
      if (current === generation) {
        state = null;
        render();
      }
    } finally {
      if (current === generation) refreshing = null;
    }
  })();
  return refreshing;
}
function openPaywall() {
  if (!dialog.open) dialog.showModal();
  render();
  if (!state) refresh();
}
window.diaryMonetization = {
  requestPhoto() {
    if (activeMembership(state) && session && !session.archive) return true;
    openPaywall();
    return false;
  },
  openPaywall,
  refresh,
  state() {
    return state;
  },
};
window.addEventListener("diary:context", (event) => {
  const next = event.detail;
  if (
    !next ||
    next.uid !== session?.uid ||
    next.coupleId !== session?.coupleId
  ) {
    generation++;
    state = null;
    ads.reset();
    refreshing = null;
    if (dialog.open) dialog.close();
  }
  session = next;
  render();
  refresh();
});
window.addEventListener("diary:saved", () => ads.afterSave());
window.addEventListener("diary:ad-consent-changed", () =>
  ads.consentChanged().catch(() => ads.reset()),
);
window.addEventListener("online", () => refresh());
window.addEventListener("focus", () => {
  if (session) refresh();
});
render();

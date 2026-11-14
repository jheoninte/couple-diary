import './native-bridge.js';
import { syncTransactions } from './billing-sync.js';
import { functions } from './firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import { NATIVE_CONFIG } from './native-config.js';
if (window.diaryNativeReady) {
  const remote = async (action, data = {}) => (await httpsCallable(functions, 'appleBilling', { timeout: 60000 })({ action, ...data })).data;
  let context, revision = 0, initialized;
  const changed = () => window.dispatchEvent(new Event('diary:billing-updated'));
  async function verify(signedTransaction, version) {
    if (!context || version !== revision) throw Error('로그인 계정이 변경되었습니다. 원래 계정으로 복원해주세요.');
    const result = await remote('verify', { signedTransaction });
    if (result.superseded) throw Error('구독 확인이 진행 중입니다. 잠시 후 복원해주세요.');
    await window.diaryStore.finish({ transactionId: result.transactionId });
    if (version === revision) await window.diaryMonetization?.refresh(true);
  }
  async function sync(rows, version) {
    return syncTransactions(rows, signed => verify(signed, version), async () => {
      if (version !== revision) return;
      await remote('refresh');
      if (version === revision) await window.diaryMonetization?.refresh(true);
    });
  }
  window.diaryBilling = {
    available: false, products: {}, busy: false,
    async buy(plan) {
      if (this.busy || !this.available || !context || window.diaryMonetization?.state()?.premium) return;
      const version = revision;
      this.busy = true; changed();
      try {
        const { appAccountToken } = await remote('accountToken');
        if (version !== revision) throw Error('로그인 계정이 변경되었습니다.');
        const result = await window.diaryStore.purchase({ productId: NATIVE_CONFIG.products[plan], appAccountToken });
        if (result.status === 'purchased') await verify(result.signedTransaction, version);
        if (result.status === 'pending') throw Error('Apple 결제 승인을 기다리고 있습니다. 승인 후 자동으로 반영됩니다.');
      } finally { this.busy = false; changed(); }
    },
    async restore() {
      if (this.busy || !context || !this.available) return;
      const version = revision; this.busy = true; changed();
      try {
        const failures = await sync((await window.diaryStore.restore()).transactions, version);
        if (failures.length) throw Error('일부 구매를 복원하지 못했습니다. 구매 당시 앱 계정으로 로그인했는지 확인해주세요.');
      } finally { this.busy = false; changed(); }
    },
    manage: () => window.diaryStore.manage(),
  };
  async function initialize(next) {
    context = next; const version = ++revision;
    window.diaryBilling.available = false; changed();
    if (!next || next.archive) return;
    let step = 'native';
    try {
      await window.diaryNativeReady;
      if (!initialized) initialized = window.diaryStore.onTransaction(event => {
        if (context) verify(event.signedTransaction, revision).catch(() => {});
      });
      await initialized;
      step = 'server';
      const { available } = await remote('availability');
      if (!available || version !== revision) { if (!available) console.warn('[billing] server reports billing unavailable'); return; }
      step = 'products';
      const products = await window.diaryStore.load();
      const missing = Object.values(NATIVE_CONFIG.products).filter(id => !products.some(product => product.id === id));
      if (missing.length) console.warn('[billing] App Store returned', products.length, 'products; missing', missing.join(','));
      if (version !== revision) return;
      window.diaryBilling.products = Object.fromEntries(Object.entries(NATIVE_CONFIG.products).map(([plan, id]) => [plan, products.find(product => product.id === id)]));
      window.diaryBilling.available = true; changed();
      await sync((await window.diaryStore.pending()).transactions, version);
    } catch (e) { console.warn('[billing] setup failed at', step, e?.code || '', e?.message || e); /* Never manufacture a successful purchase. */ }
  }
  window.addEventListener('diary:context', event => {
    const next = event.detail;
    if (next?.uid !== context?.uid || next?.coupleId !== context?.coupleId || next?.archive !== context?.archive) initialize(next);
  });
}

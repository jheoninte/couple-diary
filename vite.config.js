import { defineConfig, loadEnv } from 'vite';
import { resolveFirebaseEnvironment } from './firebase-environment.js';
import { resolve } from 'node:path';

export default defineConfig(({mode}) => {
  if(mode==='staging')resolveFirebaseEnvironment({env:{...loadEnv(mode,process.cwd(),'VITE_'),MODE:mode}});
  return {
  optimizeDeps: { include: ['firebase/app','firebase/auth','firebase/firestore','firebase/storage','firebase/functions'] },
  // Bundle Firebase locally for WKWebView; the ordinary web version still uses CDN imports.
  plugins: [{ name: 'bundle-firebase', enforce: 'pre', transform(code, id) {
    if (!id.includes('node_modules') && id.split('?')[0].endsWith('.js')) return code.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-([a-z-]+)\.js/g, 'firebase/$1');
  }}],
  build: { target: 'es2022', rollupOptions: { input: Object.fromEntries(
    ['index', 'login', 'couple-connect', 'licenses', 'privacy', 'terms', 'account-delete', 'onboarding'].map(name => [name, resolve(import.meta.dirname, `${name}.html`)])) } }
};
});

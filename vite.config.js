import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Bundle Firebase locally for WKWebView; the ordinary web version still uses CDN imports.
  plugins: [{ name: 'bundle-firebase', enforce: 'pre', transform(code, id) {
    if (!id.includes('node_modules') && id.endsWith('.js')) return code.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-([a-z-]+)\.js/g, 'firebase/$1');
  }}],
  build: { target: 'es2022', rollupOptions: { input: Object.fromEntries(
    ['index', 'login', 'couple-connect', 'licenses', 'privacy', 'terms'].map(name => [name, resolve(import.meta.dirname, `${name}.html`)])) } }
});

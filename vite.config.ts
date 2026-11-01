import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** The origin of the API from VITE_API_URL, or '' in mock mode. */
function apiOrigin(raw: string | undefined): string {
  try { const u = new URL(raw ?? ''); return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : ''; } catch { return ''; }
}

/* Content-Security-Policy. SECURITY.md has the same policy for the production server.
   - script-src 'self': no inline scripts, no eval. The theme script is /theme-init.js.
   - style-src 'self': React sets styles through the CSSOM, which CSP allows. If a library ever needs
     inline <style> tags, add a nonce. Do not add 'unsafe-inline'.
   - frame-ancestors only works as an HTTP header, so it is left out of the <meta> copy. */
function csp(api: string, forHeader: boolean): string {
  const d = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self'${api ? ' ' + api : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ];
  if (forHeader) d.push("frame-ancestors 'none'");
  return d.join('; ');
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

/** Adds the CSP <meta> to the built index.html only. The dev server needs inline scripts for hot reload. */
function cspMeta(api: string): Plugin {
  return {
    name: 'nudge-csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(api, false) }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const api = apiOrigin(env.VITE_API_URL);
  return {
    plugins: [react(), cspMeta(api)],
    envPrefix: 'VITE_',
    server: { port: 5173, headers: SECURITY_HEADERS },
    // The preview server serves the production build, so it sends the full header set including the CSP.
    preview: { port: 4173, headers: { ...SECURITY_HEADERS, 'Content-Security-Policy': csp(api, true) } },
    build: { sourcemap: false, assetsInlineLimit: 0 },
  };
});

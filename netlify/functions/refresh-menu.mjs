// Scheduled every 15 minutes. The website is built ahead of time, so the
// Manager dashboard's changes (prices, removals, new dishes, stock) only show
// after a rebuild. This compares the live dashboard tables with the
// fingerprint baked into the current site (/data-version.txt) and, when they
// differ, asks Netlify to rebuild through the build hook in BUILD_HOOK_URL.
// The same change is never re-triggered within an hour, so a failing build
// can't loop and use up build minutes.
import { getStore } from '@netlify/blobs';
import { DASHBOARD_TABLES, fingerprint } from './_shared/fingerprint.mjs';

// Public, read-only settings (the same ones in site/config.js).
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'https://efdclcbhsvlnvmjfqnin.supabase.co';
const SUPABASE_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rDbVVk0PEbIr4gcnxG0fKQ_CZO3UfoN';
const RETRY_AFTER_MS = 60 * 60 * 1000;

async function table(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) return console.log('refresh-menu: BUILD_HOOK_URL is not set; nothing to do');

  const live = fingerprint(...(await Promise.all(DASHBOARD_TABLES.map(table))));
  const siteUrl = process.env.URL || 'https://rimalseafood.com';
  const res = await fetch(`${siteUrl}/data-version.txt`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  const deployed = res.ok ? (await res.text()).trim() : '';
  if (deployed === live) return console.log('refresh-menu: site is up to date');

  const store = getStore('refresh-menu');
  const last = await store.get('last', { type: 'json' });
  if (last?.version === live && Date.now() - last.at < RETRY_AFTER_MS) {
    return console.log('refresh-menu: rebuild for this change already requested');
  }
  const hookRes = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10_000) });
  await store.setJSON('last', { version: live, at: Date.now() });
  console.log(`refresh-menu: dashboard changed (${deployed || 'none'} -> ${live}); rebuild requested (HTTP ${hookRes.status})`);
};

export const config = { schedule: '*/15 * * * *' };

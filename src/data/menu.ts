// Build-time access to the restaurant's menu.
//
// The built-in menu lives in site/menu-data.js (shared with the current site),
// together with rimalApplyDashboard(), which applies the Manager dashboard's
// edits. That file is evaluated here in a sandbox so there is one copy of the
// data. At build time the live dashboard rows (menu_overrides, menu_items,
// inventory) are read from Supabase with the public, read-only key, so the
// site shows today's names, prices and removals. If the database can't be
// reached the build still succeeds with the built-in menu and prints a warning.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
// @ts-expect-error plain JS module shared with the Netlify function
import { fingerprint } from '../../netlify/functions/_shared/fingerprint.mjs';

export type ServiceMode = 'togo' | 'stay' | 'both';
export interface Choice { key: string; label: string; values: string[] }
export interface Size { label: string; price: number }
export interface MenuItem {
  id?: string;
  name: string;
  price: number;
  desc?: string;
  photo?: string;
  choices?: Choice[];
  sides?: number;
  sizes?: Size[];
  serviceMode?: ServiceMode;
}
export interface MenuCategory { id: string; label: string; note?: string; items: MenuItem[] }
export interface MarketItem { name: string; price: number; unit: string; photo?: string; step?: number; desc?: string; sizes?: Size[] }
export interface MarketGroup { label: string; items: MarketItem[] }

type Tagged<T> = T & { _key?: string };
interface Sandbox {
  window: {
    RIMAL_MENU: MenuCategory[];
    RIMAL_MARKET: MarketGroup[];
    RIMAL_SIDES: string[];
    RIMAL_CONFIG?: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
    rimalApplyDashboard: (overrides: unknown[], customItems: unknown[]) => { menu: MenuCategory[]; market: MarketGroup[] };
    rimalCorrect: (d: { menu: MenuCategory[]; market: MarketGroup[] }) => { menu: MenuCategory[]; market: MarketGroup[] };
  };
}
interface OverrideRow { item_key: string; service_mode?: string | null }
interface CustomRow {
  name: string;
  description?: string | null;
  category: string;
  price: number | string;
  unit?: string | null;
  options?: { label: string; price: number | string }[] | null;
  display_order?: number | null;
  service_mode?: string | null;
}
interface InventoryRow { item_name: string; stock: number | string }

// Resolved from the project root: the build bundles this module, so paths
// relative to import.meta.url would point inside the build output.
const root = process.cwd();
const sandbox = { window: {} } as Sandbox;
vm.runInNewContext(readFileSync(join(root, 'site', 'menu-data.js'), 'utf8'), sandbox, { filename: 'menu-data.js' });
vm.runInNewContext(readFileSync(join(root, 'site', 'config.js'), 'utf8'), sandbox, { filename: 'config.js' });
vm.runInNewContext(readFileSync(join(root, 'site', 'menu-corrections.js'), 'utf8'), sandbox, { filename: 'menu-corrections.js' });
const data = sandbox.window;

// Tag every built-in item with its dashboard key ("group-lunch|Grilled Salmon",
// "market-0|Red Snapper"), using the same rule as rimalApplyDashboard. The
// tag survives the apply step, so dashboard-only fields can be joined later.
for (const cat of data.RIMAL_MENU) {
  const seen = new Set<string>();
  for (const it of cat.items as Tagged<MenuItem>[]) {
    const base = `group-${cat.id}|${it.name}`;
    let key = base;
    for (let n = 2; seen.has(key); n++) key = `${base}#${n}`;
    seen.add(key);
    it._key = key;
  }
}
data.RIMAL_MARKET.forEach((g, gi) => g.items.forEach((it: Tagged<MarketItem>) => { it._key = `market-${gi}|${it.name}`; }));

// ---------- Live dashboard rows ----------
async function fetchTable<T>(table: string): Promise<T[]> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || data.RIMAL_CONFIG?.SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || data.RIMAL_CONFIG?.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('no Supabase URL/key');
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

async function loadLive() {
  if (process.env.RIMAL_OFFLINE) return { overrides: [], customItems: [], inventory: [], live: false };
  try {
    const [overrides, customItems, inventory] = await Promise.all([
      fetchTable<OverrideRow>('menu_overrides'),
      fetchTable<CustomRow>('menu_items'),
      fetchTable<InventoryRow>('inventory'),
    ]);
    return { overrides, customItems, inventory, live: true };
  } catch (e) {
    console.warn(`[menu] Live dashboard data unavailable (${(e as Error).message}); building with the built-in menu.`);
    return { overrides: [], customItems: [], inventory: [], live: false };
  }
}
const live = await loadLive();

const MENU_CATEGORY: Record<string, string> = {
  menu_lunch: 'lunch', menu_mains: 'mains', menu_catch: 'catch', menu_sides: 'sides',
  menu_salads: 'sides', menu_specials: 'specials', menu_drinks: 'drinks', menu_desserts: 'desserts',
};
const MARKET_GROUP: Record<string, number> = { market_fish: 0, market_shellfish: 1 };
const asMode = (v: unknown): ServiceMode | undefined => (v === 'togo' || v === 'stay' || v === 'both' ? v : undefined);
const cleanSizes = (opts: CustomRow['options']): Size[] =>
  (Array.isArray(opts) ? opts : [])
    .filter((o) => o && o.label && Number.isFinite(Number(o.price)))
    .map((o) => ({ label: o.label, price: Number(o.price) }));

function build() {
  // Overrides go through the shared apply step; dashboard-added dishes are
  // placed here so every category (including Catch Your Plate) is supported.
  const { menu, market } = data.rimalApplyDashboard(live.overrides, []);
  const modeByKey = new Map(live.overrides.map((o) => [o.item_key, asMode(o.service_mode)]));
  for (const cat of menu) {
    for (const it of cat.items as Tagged<MenuItem>[]) {
      const mode = it._key ? modeByKey.get(it._key) : undefined;
      if (mode) it.serviceMode = mode;
    }
  }

  const added = [...live.customItems].sort((a, b) => (Number(a.display_order) || 1000) - (Number(b.display_order) || 1000));
  let skipped = 0;
  for (const row of added) {
    const sizes = cleanSizes(row.options);
    const price = sizes.length ? sizes[0].price : Number(row.price);
    if (!row.name || !Number.isFinite(price)) { skipped++; continue; }
    if (row.category in MARKET_GROUP) {
      market[MARKET_GROUP[row.category]]?.items.push({ name: row.name, price, unit: row.unit || '', desc: row.description || undefined, ...(sizes.length ? { sizes } : {}) });
      continue;
    }
    const cat = menu.find((c) => c.id === MENU_CATEGORY[row.category]);
    if (!cat) { skipped++; continue; }
    cat.items.push({ name: row.name, price, desc: row.description || undefined, ...(sizes.length ? { sizes } : {}), serviceMode: asMode(row.service_mode) });
  }
  if (skipped) console.warn(`[menu] Skipped ${skipped} dashboard dish(es) with an unknown category or no price.`);

  // Spelling fixes for dashboard text (site/menu-corrections.js).
  const fixed = data.rimalCorrect({ menu, market });
  return {
    menu: fixed.menu.filter((c) => c.items.length > 0),
    market: fixed.market.filter((g) => g.items.length > 0),
  };
}
const built = build();

/** Today's menu and market: built-in items with the live dashboard edits applied. */
export function getMenu() {
  return built;
}

/** True when the build read the live dashboard data. */
export const isLive = live.live;

/** Market items the dashboard has at 0 stock. */
export const soldOut: readonly string[] = live.inventory.filter((r) => Number(r.stock) <= 0).map((r) => r.item_name);

export const sides: readonly string[] = data.RIMAL_SIDES;

export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
export const unitLabel = (unit: string) => ({ lb: 'lb', each: 'each', dz: 'dozen' })[unit] ?? unit;
export const photoUrl = (id: string, width = 480) =>
  `https://images.unsplash.com/photo-${id}?q=75&w=${width}&auto=format&fit=crop`;

/** Lowest price a customer can pay for an item (its smallest size, if sized). */
export const fromPrice = (item: MenuItem) =>
  item.sizes?.length ? Math.min(...item.sizes.map((s) => s.price)) : item.price;

/** Stable, URL-safe id for a category heading. */
export const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Arabic labels for category headings. */
export const categoryAr: Record<string, string> = {
  lunch: 'غداء',
  mains: 'الأطباق الرئيسية',
  catch: 'اختر سمكتك',
  sides: 'مقبلات وسلطات',
  specials: 'أطباق مميزة',
  drinks: 'مشروبات',
  desserts: 'حلويات',
};

/** Public (read-only, row-level-secured) Supabase settings for browser islands. */
export const supabasePublic = {
  url: (import.meta.env.PUBLIC_SUPABASE_URL || data.RIMAL_CONFIG?.SUPABASE_URL || '') as string,
  key: (import.meta.env.PUBLIC_SUPABASE_ANON_KEY || data.RIMAL_CONFIG?.SUPABASE_ANON_KEY || '') as string,
};

/**
 * Fingerprint of the dashboard rows this build used. The scheduled
 * refresh-menu function compares it with the live rows and rebuilds the site
 * when the Manager has changed something.
 */
export const dataVersion = live.live ? fingerprint(live.overrides, live.customItems, live.inventory) : 'offline';

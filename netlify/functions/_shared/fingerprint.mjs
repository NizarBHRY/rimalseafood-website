// Shared by the site build (src/data/menu.ts) and the refresh-menu function:
// one stable hash of the Manager dashboard tables, independent of row order.
import { createHash } from 'node:crypto';

export const DASHBOARD_TABLES = ['menu_overrides', 'menu_items', 'inventory'];

const stable = (v) =>
  Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  : JSON.stringify(v ?? null);

export function fingerprint(...tables) {
  const h = createHash('sha256');
  for (const rows of tables) h.update(`${(rows ?? []).map(stable).sort().join('\n')}\u0000`);
  return h.digest('hex').slice(0, 32);
}

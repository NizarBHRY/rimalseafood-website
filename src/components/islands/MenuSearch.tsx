// Menu search: filters the server-rendered menu in place. Rendered only in
// the browser (client:only), so without JavaScript the full menu shows and no
// dead search box appears.
import { useEffect, useRef, useState } from 'preact/hooks';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and');

export default function MenuSearch() {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const items = useRef<HTMLElement[]>([]);
  const groups = useRef<HTMLElement[]>([]);

  useEffect(() => {
    items.current = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-item]'));
    groups.current = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-group]'));
  }, []);

  useEffect(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const el of items.current) {
      const text = normalize(el.dataset.search ?? '');
      const match = terms.every((t) => text.includes(t));
      el.hidden = !match;
      if (match) shown++;
    }
    for (const g of groups.current) {
      g.hidden = !g.querySelector('[data-menu-item]:not([hidden])');
    }
    setCount(terms.length ? shown : null);
  }, [query]);

  return (
    <div class="menu-search" role="search">
      <label for="menu-search-input">Search the menu</label>
      <div class="menu-search-row">
        <input
          id="menu-search-input"
          type="search"
          placeholder="Shrimp, salmon, salad…"
          autocomplete="off"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        {query && (
          <button type="button" class="btn btn--ghost" onClick={() => setQuery('')}>
            Clear
          </button>
        )}
      </div>
      <p class="menu-search-status" aria-live="polite">
        {count === null ? '' : count === 0 ? 'No dishes match. Try another word, or call us.' : `${count} ${count === 1 ? 'dish' : 'dishes'} found`}
      </p>
    </div>
  );
}

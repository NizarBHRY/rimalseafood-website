// Rewards lookup: a customer types their phone number and sees their stamps.
// Uses the same public get_rewards function as the staff dashboard. The name
// on the account is never shown, so typing someone else's number reveals
// nothing personal, and nothing is saved in the browser.
import { useState } from 'preact/hooks';

interface Props { url: string; anonKey: string; needed?: number }
interface Account { visits: number; cycle_purchases: number; platters_ready: number }
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'none' }
  | { kind: 'found'; acct: Account };

const digits = (s: string) => s.replace(/\D/g, '');

export default function RewardsLookup({ url, anonKey, needed = 5 }: Props) {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function lookUp(e: Event) {
    e.preventDefault();
    let d = digits(phone);
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length !== 10) {
      setState({ kind: 'error', message: 'Enter the 10-digit phone number you give at the counter.' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`${url}/rest/v1/rpc/get_rewards`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_phone: d }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as Account[];
      setState(rows[0] ? { kind: 'found', acct: rows[0] } : { kind: 'none' });
    } catch {
      setState({ kind: 'error', message: 'We could not reach the rewards system. Check your connection, or ask us at the counter.' });
    }
  }

  const stamps = state.kind === 'found' ? Math.min(needed, Number(state.acct.cycle_purchases) || 0) : 0;
  const ready = state.kind === 'found' ? Number(state.acct.platters_ready) || 0 : 0;

  return (
    <div class="rewards-lookup">
      <form onSubmit={lookUp} class="rewards-form">
        <label for="rewards-phone">Your phone number</label>
        <div class="rewards-row">
          <input
            id="rewards-phone"
            type="tel"
            inputMode="tel"
            autocomplete="tel-national"
            placeholder="(347) 555-0123"
            value={phone}
            onInput={(e) => setPhone((e.currentTarget as HTMLInputElement).value)}
            aria-describedby="rewards-status"
          />
          <button type="submit" class="btn" disabled={state.kind === 'loading'}>
            {state.kind === 'loading' ? 'Checking…' : 'Check my stamps'}
          </button>
        </div>
      </form>

      <div id="rewards-status" aria-live="polite" class="rewards-status">
        {state.kind === 'error' && <p class="rewards-error">{state.message}</p>}
        {state.kind === 'none' && (
          <p>No rewards yet for that number. Give it at the counter with your next paid order and your first stamp is added.</p>
        )}
        {state.kind === 'found' && (
          <>
            <ol class="stamps is-live" role="list" aria-label={`${stamps} of ${needed} stamps toward your next free platter`}>
              {Array.from({ length: needed }, (_, i) => (
                <li class={i < stamps ? 'is-on' : ''} style={{ '--i': i }} aria-hidden="true">{i + 1}</li>
              ))}
              <li class="prize" aria-hidden="true">Free platter</li>
            </ol>
            <p>
              <strong>{stamps} of {needed}</strong> purchases toward your next free platter.
              {ready > 0 && (
                <> You have <strong>{ready} free {ready === 1 ? 'platter' : 'platters'}</strong> waiting. Ask at the counter.</>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

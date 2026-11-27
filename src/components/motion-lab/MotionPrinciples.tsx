/** @jsxImportSource react */
// 19 motion principles, each as a split-screen Before / After pair.
// "Play all" walks through them in order, one 21 s / 19 slot each.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import { DEMOS, type Demo } from './demos';

const TOTAL_MS = 21_000;
const SLOT_MS = TOTAL_MS / DEMOS.length; // ≈ 1105 ms
/** Time to bring a row into view before its demo starts. */
const LEAD_MS = 250;

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900';
const pad2 = (n: number) => String(n).padStart(2, '0');

const TOKENS = [
  ['Duration', '200 ms max · 100 ms feedback'],
  ['Enter', 'cubic-bezier(0.22, 1, 0.36, 1)'],
  ['Exit', 'cubic-bezier(0.64, 0, 0.78, 0)'],
  ['Stagger', '40 ms'],
  ['Press', 'spring 300 / 25'],
  ['Pop-in', 'from 0.97'],
];

export default function MotionPrinciples() {
  const reduce = useReducedMotion();
  const [runs, setRuns] = useState(() => DEMOS.map(() => 0));
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(-1);
  const [announce, setAnnounce] = useState('');
  const rows = useRef<(HTMLElement | null)[]>([]);

  const replay = (i: number) => setRuns((r) => r.map((n, j) => (j === i ? n + 1 : n)));

  useEffect(() => {
    if (!playing) return;
    setAnnounce(`Playing all ${DEMOS.length} examples.`);
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));
    DEMOS.forEach((_, i) => {
      at(i * SLOT_MS, () => {
        setActive(i);
        rows.current[i]?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      });
      at(i * SLOT_MS + LEAD_MS, () => replay(i));
    });
    at(TOTAL_MS, () => {
      setPlaying(false);
      setActive(-1);
      setAnnounce('Finished.');
    });
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [playing, reduce]);

  const stop = () => {
    setPlaying(false);
    setActive(-1);
    setAnnounce('Stopped.');
  };

  return (
    // reducedMotion="user": for anyone whose system asks for reduced motion,
    // every Framer Motion transform is dropped and only opacity animates.
    <MotionConfig reducedMotion="user">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-2 py-2 md:px-4">
          <div className="mr-auto">
            <p className="text-sm font-semibold">Motion principles</p>
            <p className="text-sm text-neutral-600" aria-hidden={!playing}>
              {active >= 0 ? `${pad2(active + 1)} / ${DEMOS.length} · ${DEMOS[active].title}` : `${DEMOS.length} examples · 21 s in sequence`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (playing ? stop() : setPlaying(true))}
            className={`group relative inline-flex h-5 items-center rounded-lg bg-neutral-900 px-2 text-sm font-medium text-white ${focus}`}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-white/15 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100" />
            <span className="relative">{playing ? 'Stop' : 'Play all · 21 s'}</span>
          </button>
          <ol className="flex w-full gap-0.5" aria-hidden>
            {DEMOS.map((d, i) => (
              <li key={d.title} className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <span className={`absolute inset-0 bg-neutral-900 transition-opacity duration-100 ease-out ${i <= active ? 'opacity-100' : 'opacity-0'}`} />
              </li>
            ))}
          </ol>
        </div>
      </header>
      <p className="sr-only" role="status">{announce}</p>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-2 py-4 md:px-4 md:py-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">19 motion principles, before and after</h1>
          <p className="max-w-2xl text-neutral-600">
            Each pair shows the same interface twice. <strong className="font-medium text-neutral-900">Before</strong> breaks the
            principle; <strong className="font-medium text-neutral-900">After</strong> follows it, using one shared set of motion
            tokens. Press Replay on any row, or Play all to watch them in order.
          </p>
          <dl className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            {TOKENS.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-neutral-200 bg-white p-1.5">
                <dt className="text-xs text-neutral-500">{k}</dt>
                <dd className="text-sm font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {reduce && (
            <p className="rounded-lg border border-neutral-300 bg-white p-2 text-sm">
              Your device asks for reduced motion, so movement on this page is replaced by short fades, and the Before
              examples don’t move at all. Turn the setting off to see the motion itself.
            </p>
          )}
        </section>

        {DEMOS.map((demo, i) => (
          <Row key={demo.title} demo={demo} index={i} run={runs[i]} active={active === i} onReplay={() => replay(i)} rowRef={(el) => (rows.current[i] = el)} />
        ))}
      </main>
    </MotionConfig>
  );
}

function Row({ demo, index, run, active, onReplay, rowRef }: {
  demo: Demo;
  index: number;
  run: number;
  active: boolean;
  onReplay: () => void;
  rowRef: (el: HTMLElement | null) => void;
}) {
  const [flag, setFlag] = useState(demo.flag?.initial ?? false);
  const id = `p${pad2(index + 1)}`;
  return (
    <article ref={rowRef} id={id} aria-labelledby={`${id}-t`} aria-current={active ? 'step' : undefined} className="relative rounded-2xl border border-neutral-200 bg-white p-2 md:p-3">
      <span aria-hidden className={`pointer-events-none absolute -inset-px rounded-2xl ring-2 ring-neutral-900 transition-opacity duration-100 ease-out ${active ? 'opacity-100' : 'opacity-0'}`} />
      <header className="flex flex-wrap items-start gap-2">
        <span className="pt-0.5 text-sm font-medium text-neutral-500 tabular-nums">{pad2(index + 1)}</span>
        <div className="mr-auto min-w-0 flex-1 basis-40">
          <h2 id={`${id}-t`} className="font-semibold">{demo.title}</h2>
          <p className="text-sm text-neutral-600">{demo.rule}</p>
        </div>
        {demo.flag && (
          <label className="flex h-5 items-center gap-1 text-sm">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} className={`size-2 accent-neutral-900 ${focus}`} />
            {demo.flag.label}
          </label>
        )}
        <button
          type="button"
          onClick={onReplay}
          aria-label={`Replay ${demo.title}`}
          className={`group relative inline-flex h-5 items-center rounded-lg border border-neutral-300 bg-white px-2 text-sm font-medium ${focus}`}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] bg-neutral-900/5 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100 group-active:opacity-100" />
          <span className="relative">Replay</span>
        </button>
      </header>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Side kind="before" note={demo.before.note}>
          <demo.before.C run={run} flag={flag} />
        </Side>
        <Side kind="after" note={demo.after.note}>
          <demo.after.C run={run} flag={flag} />
        </Side>
      </div>
    </article>
  );
}

function Side({ kind, note, children }: { kind: 'before' | 'after'; note: string; children: ReactNode }) {
  const after = kind === 'after';
  return (
    <figure data-variant={kind} className="flex min-w-0 flex-col gap-1">
      <figcaption className="flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
        <span aria-hidden className={`size-1 rounded-full ${after ? 'bg-emerald-600' : 'bg-rose-600'}`} />
        <span className={after ? 'text-neutral-900' : 'text-neutral-600'}>{after ? 'After' : 'Before'}</span>
      </figcaption>
      {/* Fixed height: nothing a demo does can move the page around it. */}
      <div className="relative h-26 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">{children}</div>
      <p className="text-sm text-neutral-600">{note}</p>
    </figure>
  );
}

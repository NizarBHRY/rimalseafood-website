/** @jsxImportSource react */
// The 19 before/after pairs. "Before" breaks the principle on purpose;
// "After" follows it using only the tokens in ./motion.
//
// Each demo gets `run` (bumped by Replay / Play all) and `flag` (an optional
// per-row switch). At run 0 every demo shows its resting state, so nothing
// moves on page load.
import { useId, useState, type ButtonHTMLAttributes, type FC, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, useAnimationControls } from 'framer-motion';
import {
  OFFSET, POP_FROM, SPRING, STAGGER, enter, exit, fadeUp, from, pop, useScript, useTrigger,
} from './motion';

export type DemoProps = { run: number; flag: boolean };
export type Demo = {
  title: string;
  rule: string;
  before: { note: string; C: FC<DemoProps> };
  after: { note: string; C: FC<DemoProps> };
  /** A switch shown in the row header and passed to both sides as `flag`. */
  flag?: { label: string; initial: boolean };
};

// ---------- Shared bits ----------

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900';
const btn = (primary?: boolean) =>
  `group relative inline-flex h-5 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-medium ${focus} ${
    primary ? 'bg-neutral-900 text-white' : 'border border-neutral-300 bg-white text-neutral-900'
  }`;

/** Hover/press tint as an opacity layer, so feedback never repaints the button. */
const Tint = ({ primary }: { primary?: boolean }) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100 group-active:opacity-100 ${
      primary ? 'bg-white/15' : 'bg-neutral-900/5'
    }`}
  />
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean };
const Btn = ({ primary, className = '', children, ...rest }: BtnProps) => (
  <button type="button" className={`${btn(primary)} ${className}`} {...rest}>
    <Tint primary={primary} />
    <span className="relative">{children}</span>
  </button>
);

const Pad = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`relative flex h-full flex-col gap-1 p-2 ${className}`}>{children}</div>
);

const Thumb = ({ tone = 'bg-neutral-300', className = 'size-4' }: { tone?: string; className?: string }) => (
  <span aria-hidden className={`block shrink-0 rounded-md ${tone} ${className}`} />
);

const Bar = ({ className }: { className: string }) => <span aria-hidden className={`block h-1.5 rounded-sm bg-neutral-200 ${className}`} />;

const DISHES = ['Grilled sea bass', 'Shrimp tajine', 'Fried calamari', 'Seafood soup', 'Lobster tail'];

// ---------- 1. Visual stability ----------

const OrderRows = () => (
  <>
    {[['Grilled sea bass', '×1'], ['Shrimp tajine', '×2']].map(([name, qty]) => (
      <div key={name} className="flex h-4 items-center justify-between text-sm">
        <span>{name}</span>
        <span className="tabular-nums text-neutral-500">{qty}</span>
      </div>
    ))}
  </>
);

function useLoad(run: number, ms: number) {
  const [t, replay] = useTrigger(run);
  const [loading, setLoading] = useState(false);
  useScript(t, (at) => {
    setLoading(true);
    at(ms, () => setLoading(false));
  });
  return { t, loading, replay };
}

const StabilityBefore: FC<DemoProps> = ({ run }) => {
  const { loading, replay } = useLoad(run, 400);
  return (
    <Pad>
      <p className="text-sm font-medium">Your order</p>
      {!loading && <OrderRows />}
      <Btn primary className="self-start" onClick={replay}>Checkout</Btn>
    </Pad>
  );
};

const StabilityAfter: FC<DemoProps> = ({ run }) => {
  const { t, loading, replay } = useLoad(run, 400);
  return (
    <Pad>
      <p className="text-sm font-medium">Your order</p>
      <div className="grid">
        {loading ? (
          <div className="col-start-1 row-start-1" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="flex h-4 items-center justify-between">
                <Bar className="w-16" />
                <Bar className="w-3" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div key={t} className="col-start-1 row-start-1" initial={t ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={enter}>
            <OrderRows />
          </motion.div>
        )}
      </div>
      <Btn primary className="self-start" onClick={replay}>Checkout</Btn>
    </Pad>
  );
};

// ---------- 2. Shared element transitions ----------

const CARDS = [
  { id: 'a', name: 'Sea bass', tone: 'bg-neutral-300', blurb: 'Charcoal grilled, lemon, herbs.' },
  { id: 'b', name: 'Shrimp', tone: 'bg-neutral-400', blurb: 'Tajine with tomato and garlic.' },
  { id: 'c', name: 'Calamari', tone: 'bg-neutral-500', blurb: 'Fried, with tahini sauce.' },
];

function useOpenCard(run: number) {
  const [t] = useTrigger(run);
  const [open, setOpen] = useState<string | null>(null);
  useScript(t, (at) => {
    setOpen('b');
    at(600, () => setOpen(null));
  });
  return [open, setOpen] as const;
}

const SharedBefore: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useOpenCard(run);
  const card = CARDS.find((c) => c.id === open);
  return (
    <div className="relative h-full p-2">
      {card ? (
        <button type="button" className={`flex size-full gap-2 rounded-lg border border-neutral-200 bg-white p-1 text-left ${focus}`} onClick={() => setOpen(null)} aria-label={`Close ${card.name}`}>
          <Thumb tone={card.tone} className="h-full w-1/2" />
          <span className="flex flex-col gap-0.5 py-1">
            <span className="text-sm font-medium">{card.name}</span>
            <span className="text-sm text-neutral-600">{card.blurb}</span>
          </span>
        </button>
      ) : (
        <ul className="grid h-full grid-cols-3 gap-1">
          {CARDS.map((c) => (
            <li key={c.id}>
              <button type="button" className={`flex size-full flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-left ${focus}`} onClick={() => setOpen(c.id)}>
                <Thumb tone={c.tone} className="w-full flex-1" />
                <span className="text-sm">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SharedAfter: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useOpenCard(run);
  const uid = useId();
  const card = CARDS.find((c) => c.id === open);
  return (
    <div className="relative h-full p-2">
      <ul className="grid h-full grid-cols-3 gap-1">
        {CARDS.map((c) => (
          <li key={c.id}>
            {open !== c.id && (
              <motion.button
                type="button"
                layoutId={`${uid}${c.id}`}
                transition={enter}
                style={{ borderRadius: 8 }}
                className={`flex size-full flex-col gap-1 border border-neutral-200 bg-white p-1 text-left ${focus}`}
                onClick={() => setOpen(c.id)}
              >
                <motion.span layoutId={`${uid}${c.id}-img`} transition={enter} style={{ borderRadius: 6 }} className={`block w-full flex-1 ${c.tone}`} />
                <motion.span layoutId={`${uid}${c.id}-name`} layout="position" transition={enter} className="text-sm">{c.name}</motion.span>
              </motion.button>
            )}
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {card && (
          <motion.button
            type="button"
            layoutId={`${uid}${card.id}`}
            transition={enter}
            style={{ borderRadius: 8 }}
            className={`absolute inset-2 flex gap-2 border border-neutral-200 bg-white p-1 text-left ${focus}`}
            onClick={() => setOpen(null)}
            aria-label={`Close ${card.name}`}
          >
            <motion.span layoutId={`${uid}${card.id}-img`} transition={enter} style={{ borderRadius: 6 }} className={`block h-full w-1/2 ${card.tone}`} />
            <span className="flex flex-col gap-0.5 py-1">
              <motion.span layoutId={`${uid}${card.id}-name`} layout="position" transition={enter} className="text-sm font-medium">{card.name}</motion.span>
              <motion.span className="text-sm text-neutral-600" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { ...enter, delay: STAGGER } }} exit={{ opacity: 0, transition: exit }}>
                {card.blurb}
              </motion.span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- 3. Performance ----------

function useBounce(run: number, back = 600) {
  const [t, replay] = useTrigger(run);
  const [on, setOn] = useState(false);
  useScript(t, (at) => {
    setOn(true);
    at(back, () => setOn(false));
  });
  return { on, setOn, replay };
}

const Tray = () => (
  <span className="flex size-full flex-col justify-center gap-0.5 rounded-xl border border-neutral-200 bg-white px-1">
    <Bar className="w-4" />
    <Bar className="w-3" />
  </span>
);

const PerfBefore: FC<DemoProps> = ({ run }) => {
  const { on } = useBounce(run);
  const curve = 'cubic-bezier(0.22, 1, 0.36, 1)';
  return (
    <div className="relative h-full p-2">
      <div className="relative h-full">
        <div
          className="absolute top-1/2 -mt-4 size-8 rounded-xl"
          style={{
            left: on ? 'calc(100% - 64px)' : '0px',
            boxShadow: on ? '0 16px 32px rgba(0,0,0,0.18)' : '0 0 0 rgba(0,0,0,0)',
            transition: `left 200ms ${curve}, box-shadow 200ms ${curve}`,
          }}
        >
          <Tray />
        </div>
      </div>
    </div>
  );
};

const PerfAfter: FC<DemoProps> = ({ run }) => {
  const { on } = useBounce(run);
  return (
    <div className="relative h-full p-2">
      <div className="relative h-full">
        {/* A rail as wide as the travel distance: x: 100% moves the tray exactly to the end. */}
        <motion.div className="absolute inset-y-0 left-0" style={{ width: 'calc(100% - 64px)' }} initial={false} animate={{ x: on ? '100%' : '0%' }} transition={enter}>
          <div className="absolute top-1/2 left-0 -mt-4 size-8">
            <motion.span aria-hidden className="absolute inset-0 rounded-xl shadow-[0_16px_32px_rgba(0,0,0,0.18)]" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={enter} />
            <span className="relative block size-full">
              <Tray />
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ---------- 4. Timing ----------

function useToast(run: number) {
  const [t, replay] = useTrigger(run);
  const [show, setShow] = useState(false);
  useScript(t, (at) => {
    setShow(true);
    at(600, () => setShow(false));
  });
  return { show, replay };
}

const toastClass = 'absolute inset-x-2 bottom-2 flex h-5 items-center rounded-lg bg-neutral-900 px-2 text-sm text-white';

const TimingBefore: FC<DemoProps> = ({ run }) => {
  const { show, replay } = useToast(run);
  return (
    <Pad>
      <Btn className="self-start" onClick={replay}>Add to order</Btn>
      <AnimatePresence>
        {show && (
          <motion.div
            className={toastClass}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: 'linear' } }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.6, ease: 'easeOut' } }}
          >
            Added to your order
          </motion.div>
        )}
      </AnimatePresence>
    </Pad>
  );
};

const TimingAfter: FC<DemoProps> = ({ run }) => {
  const { show, replay } = useToast(run);
  return (
    <Pad>
      <Btn className="self-start" onClick={replay}>Add to order</Btn>
      <AnimatePresence>
        {show && (
          <motion.div className={toastClass} variants={fadeUp} initial="hidden" animate="shown" exit="gone">
            Added to your order
          </motion.div>
        )}
      </AnimatePresence>
    </Pad>
  );
};

// ---------- 5. Staggering ----------

const ListRow = ({ name }: { name: string }) => (
  <span className="flex h-3 items-center gap-1 text-sm">
    <Thumb className="size-2" />
    {name}
  </span>
);

const StaggerBefore: FC<DemoProps> = ({ run }) => {
  const [t, replay] = useTrigger(run);
  return (
    <Pad className="flex-row items-start">
      <ul key={t} className="flex flex-col gap-0.5">
        {DISHES.map((d, i) => (
          <motion.li key={d} initial={t ? { opacity: 0, y: 16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeInOut', delay: i * 0.15 }}>
            <ListRow name={d} />
          </motion.li>
        ))}
      </ul>
      <Btn className="ml-auto" onClick={replay}>Reload</Btn>
    </Pad>
  );
};

const StaggerAfter: FC<DemoProps> = ({ run }) => {
  const [t, replay] = useTrigger(run);
  return (
    <Pad className="flex-row items-start">
      <ul key={t} className="flex flex-col gap-0.5">
        {DISHES.map((d, i) => (
          <motion.li key={d} variants={fadeUp} custom={i} initial={from(t)} animate="shown">
            <ListRow name={d} />
          </motion.li>
        ))}
      </ul>
      <Btn className="ml-auto" onClick={replay}>Reload</Btn>
    </Pad>
  );
};

// ---------- 6. Attention ----------

function useConfirm(run: number) {
  const [t] = useTrigger(run);
  const [ok, setOk] = useState(true);
  useScript(t, (at) => {
    setOk(false);
    at(300, () => setOk(true));
  });
  return [ok, setOk] as const;
}

const Check = ({ ok, onToggle }: { ok: boolean; onToggle: () => void }) => (
  <button type="button" role="checkbox" aria-checked={ok} onClick={onToggle} className={`flex items-center gap-1 self-start text-sm ${focus}`}>
    <span className={`grid size-2.5 place-items-center rounded border ${ok ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-400 bg-white'}`}>
      {ok && (
        <svg viewBox="0 0 12 12" className="size-1.5" aria-hidden>
          <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    Allergies noted
  </button>
);

const AttentionBefore: FC<DemoProps> = ({ run }) => {
  const [ok, setOk] = useConfirm(run);
  return (
    <Pad>
      <p className="text-sm font-medium">Table 4 · 3 dishes</p>
      <Check ok={ok} onToggle={() => setOk(!ok)} />
      <div className="mt-auto flex gap-1">
        <Btn>Back</Btn>
        <motion.button
          type="button"
          disabled={!ok}
          className={btn(true)}
          initial={false}
          animate={ok ? { scale: [1, 1.2, 0.9, 1.15, 1], opacity: 1 } : { scale: 1, opacity: 0.4 }}
          transition={{ duration: 0.7 }}
        >
          Send to kitchen
        </motion.button>
      </div>
    </Pad>
  );
};

const AttentionAfter: FC<DemoProps> = ({ run }) => {
  const [ok, setOk] = useConfirm(run);
  return (
    <Pad>
      <p className="text-sm font-medium">Table 4 · 3 dishes</p>
      <Check ok={ok} onToggle={() => setOk(!ok)} />
      <div className="mt-auto flex gap-1">
        <Btn>Back</Btn>
        <motion.button
          type="button"
          disabled={!ok}
          className={btn(true)}
          initial={false}
          animate={ok ? { scale: 1, opacity: 1 } : { scale: POP_FROM, opacity: 0.4 }}
          transition={enter}
          whileTap={ok ? { scale: POP_FROM, transition: SPRING } : undefined}
        >
          <Tint primary />
          <span className="relative">Send to kitchen</span>
        </motion.button>
      </div>
    </Pad>
  );
};

// ---------- 7. State changes ----------

function useSwitch(run: number) {
  const [t] = useTrigger(run);
  const [on, setOn] = useState(false);
  useScript(t, (at) => {
    setOn(true);
    at(600, () => setOn(false));
  });
  return [on, setOn] as const;
}

const SwitchRow = ({ children, label }: { children: ReactNode; label: ReactNode }) => (
  <Pad className="justify-center">
    <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2">
      <span className="text-sm">Text me when it’s ready</span>
      <span className="flex items-center gap-1">
        {label}
        {children}
      </span>
    </div>
  </Pad>
);

const StateBefore: FC<DemoProps> = ({ run }) => {
  const [on, setOn] = useSwitch(run);
  return (
    <SwitchRow label={<span className="w-3 text-sm text-neutral-600">{on ? 'On' : 'Off'}</span>}>
      <button type="button" role="switch" aria-checked={on} aria-label="Text me when it’s ready" onClick={() => setOn(!on)} className={`relative h-4 w-7 rounded-full ${on ? 'bg-neutral-900' : 'bg-neutral-300'} ${focus}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white ${on ? 'left-3.5' : 'left-0.5'}`} />
      </button>
    </SwitchRow>
  );
};

const StateAfter: FC<DemoProps> = ({ run }) => {
  const [on, setOn] = useSwitch(run);
  return (
    <SwitchRow
      label={
        <span className="grid w-3 text-sm text-neutral-600">
          <motion.span className="col-start-1 row-start-1" aria-hidden={on} initial={false} animate={{ opacity: on ? 0 : 1, y: on ? -4 : 0 }} transition={on ? exit : enter}>Off</motion.span>
          <motion.span className="col-start-1 row-start-1" aria-hidden={!on} initial={false} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 4 }} transition={on ? enter : exit}>On</motion.span>
        </span>
      }
    >
      <button type="button" role="switch" aria-checked={on} aria-label="Text me when it’s ready" onClick={() => setOn(!on)} className={`relative h-4 w-7 overflow-hidden rounded-full bg-neutral-300 ${focus}`}>
        <motion.span aria-hidden className="absolute inset-0 bg-neutral-900" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={enter} />
        <motion.span aria-hidden className="absolute top-0.5 left-0.5 size-3 rounded-full bg-white" initial={false} animate={{ x: on ? 24 : 0 }} transition={enter} />
      </button>
    </SwitchRow>
  );
};

// ---------- 8. Button physics ----------

const PhysicsBefore: FC<DemoProps> = ({ run }) => {
  const [t] = useTrigger(run);
  const [n, setN] = useState(1);
  useScript(t, () => setN((x) => x + 1));
  return (
    <Pad className="items-start justify-center">
      <button type="button" className={btn(true)} onClick={() => setN(n + 1)}>Add to order</button>
      <p className="text-sm text-neutral-600">In your order: <span className="tabular-nums">{n}</span></p>
    </Pad>
  );
};

const PhysicsAfter: FC<DemoProps> = ({ run }) => {
  const [t] = useTrigger(run);
  const [n, setN] = useState(1);
  const press = useAnimationControls();
  useScript(t, (at) => {
    press.start({ scale: POP_FROM });
    setN((x) => x + 1);
    at(120, () => press.start({ scale: 1 }));
  });
  return (
    <Pad className="items-start justify-center">
      <motion.button type="button" className={btn(true)} animate={press} transition={SPRING} whileTap={{ scale: POP_FROM }} onClick={() => setN(n + 1)}>
        <Tint primary />
        <span className="relative">Add to order</span>
      </motion.button>
      <p className="text-sm text-neutral-600">In your order: <span className="tabular-nums">{n}</span></p>
    </Pad>
  );
};

// ---------- 9. Scale ----------

const SHARE = ['Copy link', 'Send as text', 'Email'];
const menuClass = 'absolute top-8 left-2 flex w-20 flex-col rounded-lg border border-neutral-200 bg-white p-0.5 text-sm shadow-sm';
const MenuItems = () => (
  <>
    {SHARE.map((s) => (
      <span key={s} className="flex h-4 items-center rounded-md px-1">{s}</span>
    ))}
  </>
);

function useMenu(run: number) {
  const { on, setOn } = useBounce(run, 650);
  return [on, setOn] as const;
}

const ScaleBefore: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useMenu(run);
  return (
    <Pad>
      <Btn className="self-start" aria-expanded={open} onClick={() => setOpen(!open)}>Share order</Btn>
      <AnimatePresence>
        {open && (
          <motion.div className={menuClass} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.3 }}>
            <MenuItems />
          </motion.div>
        )}
      </AnimatePresence>
    </Pad>
  );
};

const ScaleAfter: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useMenu(run);
  return (
    <Pad>
      <Btn className="self-start" aria-expanded={open} onClick={() => setOpen(!open)}>Share order</Btn>
      <AnimatePresence>
        {open && (
          <motion.div className={menuClass} style={{ originX: 0, originY: 0 }} variants={pop} initial="hidden" animate="shown" exit="gone">
            <MenuItems />
          </motion.div>
        )}
      </AnimatePresence>
    </Pad>
  );
};

// ---------- 10. Layout ----------

function useError(run: number) {
  const { on } = useBounce(run, 700);
  return on;
}

const PhoneField = ({ err, children }: { err: boolean; children: ReactNode }) => {
  const id = useId();
  return (
    <Pad>
      <label htmlFor={id} className="text-sm font-medium">Phone for Rewards</label>
      <input
        id={id}
        readOnly
        value="555 01"
        aria-invalid={err}
        className={`h-5 rounded-lg border bg-white px-1.5 text-sm ${err ? 'border-rose-700' : 'border-neutral-300'} ${focus}`}
      />
      {children}
    </Pad>
  );
};

const LayoutBefore: FC<DemoProps> = ({ run }) => {
  const err = useError(run);
  return (
    <PhoneField err={err}>
      {err && <p className="text-sm text-rose-700">Enter all 10 digits.</p>}
      <Btn primary className="self-start">Join Rewards</Btn>
    </PhoneField>
  );
};

const LayoutAfter: FC<DemoProps> = ({ run }) => {
  const err = useError(run);
  return (
    <PhoneField err={err}>
      <div className="h-2.5">
        <AnimatePresence>
          {err && (
            <motion.p className="text-sm leading-5 text-rose-700" initial={{ opacity: 0, y: -OFFSET / 2 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, transition: exit }}>
              Enter all 10 digits.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <Btn primary className="self-start">Join Rewards</Btn>
    </PhoneField>
  );
};

// ---------- 11. Fades ----------

function useNotice(run: number) {
  const [t, replay] = useTrigger(run);
  const [show, setShow] = useState(true);
  useScript(t, (at) => {
    setShow(false);
    at(300, () => setShow(true));
  });
  return { show, replay };
}

const NOTICE = 'Your order is with the kitchen.';

const FadeBefore: FC<DemoProps> = ({ run }) => {
  const { show, replay } = useNotice(run);
  const curve = '200ms cubic-bezier(0.22, 1, 0.36, 1)';
  return (
    <Pad className="justify-between">
      <div
        className="rounded-lg border p-2 text-sm"
        style={{
          color: show ? 'rgb(23 23 23)' : 'rgb(23 23 23 / 0)',
          backgroundColor: show ? 'rgb(255 255 255)' : 'rgb(255 255 255 / 0)',
          borderColor: show ? 'rgb(212 212 212)' : 'rgb(212 212 212 / 0)',
          transition: `color ${curve}, background-color ${curve}, border-color ${curve}`,
        }}
      >
        {NOTICE}
      </div>
      <Btn className="self-start" onClick={replay}>Refresh status</Btn>
    </Pad>
  );
};

const FadeAfter: FC<DemoProps> = ({ run }) => {
  const { show, replay } = useNotice(run);
  return (
    <Pad className="justify-between">
      <motion.div className="rounded-lg border border-neutral-300 bg-white p-2 text-sm" initial={false} animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: OFFSET }} transition={show ? enter : exit}>
        {NOTICE}
      </motion.div>
      <Btn className="self-start" onClick={replay}>Refresh status</Btn>
    </Pad>
  );
};

// ---------- 12. Feedback ----------

function useFakePointer(run: number) {
  const [t] = useTrigger(run);
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  useScript(t, (at) => {
    setHover(true);
    at(250, () => setPress(true));
    at(350, () => setPress(false));
    at(650, () => setHover(false));
  });
  return { hover, press };
}

const CATS = ['Starters', 'Mains', 'Desserts'];
const chip = `group relative h-5 rounded-full border border-neutral-300 bg-white px-2 text-sm ${focus}`;

const FeedbackBefore: FC<DemoProps> = ({ run }) => {
  const { hover } = useFakePointer(run);
  return (
    <Pad className="justify-center">
      <div className="flex flex-wrap gap-1">
        {CATS.map((c) => (
          <button key={c} type="button" className={chip} data-hover={c === 'Mains' && hover}>
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-neutral-900/10 opacity-0 transition-opacity delay-150 duration-500 ease-linear group-hover:opacity-100 group-data-[hover=true]:opacity-100" />
            <span className="relative">{c}</span>
          </button>
        ))}
      </div>
    </Pad>
  );
};

const FeedbackAfter: FC<DemoProps> = ({ run }) => {
  const { hover, press } = useFakePointer(run);
  return (
    <Pad className="justify-center">
      <div className="flex flex-wrap gap-1">
        {CATS.map((c) => (
          <button key={c} type="button" className={chip} data-hover={c === 'Mains' && hover} data-press={c === 'Mains' && press}>
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-neutral-900/10 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100 group-data-[hover=true]:opacity-100" />
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-neutral-900/10 opacity-0 transition-opacity duration-100 ease-out group-active:opacity-100 group-data-[press=true]:opacity-100" />
            <span className="relative">{c}</span>
          </button>
        ))}
      </div>
    </Pad>
  );
};

// ---------- 13. Accessibility ----------

const CatchCard = () => (
  <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
    <Thumb className="size-6" />
    <span className="flex flex-col">
      <span className="text-sm font-medium">Today’s catch</span>
      <span className="text-sm text-neutral-600">Fresh from the market case</span>
    </span>
  </div>
);

const A11yBefore: FC<DemoProps> = ({ run }) => {
  const [t, replay] = useTrigger(run);
  return (
    <Pad className="justify-between">
      <motion.div key={t} initial={t ? { opacity: 0, x: 160 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <CatchCard />
      </motion.div>
      <Btn className="self-start" onClick={replay}>Show again</Btn>
    </Pad>
  );
};

const A11yAfter: FC<DemoProps> = ({ run, flag }) => {
  const [t, replay] = useTrigger(run);
  // 'always' is what 'user' becomes for someone whose system asks for reduced
  // motion: transforms are dropped, the opacity fade stays.
  return (
    <MotionConfig reducedMotion={flag ? 'always' : 'user'}>
      <Pad className="justify-between">
        <motion.div key={t} variants={fadeUp} initial={from(t)} animate="shown">
          <CatchCard />
        </motion.div>
        <Btn className="self-start" onClick={replay}>Show again</Btn>
      </Pad>
    </MotionConfig>
  );
};

// ---------- 14. Consistency ----------

const Trio = ({ t, chipT, tipT, badgeT, chipFrom, tipFrom, badgeFrom }: {
  t: number;
  chipT?: object; tipT?: object; badgeT?: object;
  chipFrom: object; tipFrom: object; badgeFrom: object;
}) => (
  <div key={t} className="flex flex-wrap items-center gap-2">
    <motion.span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-sm text-white" initial={t ? chipFrom : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={chipT}>Added</motion.span>
    <motion.span className="rounded-lg border border-neutral-300 bg-white px-1.5 py-0.5 text-sm" initial={t ? tipFrom : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={tipT}>Saved for later</motion.span>
    <motion.span className="grid size-3 place-items-center rounded-full bg-neutral-700 text-xs text-white tabular-nums" initial={t ? badgeFrom : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={badgeT}>3</motion.span>
  </div>
);

const ConsistencyBefore: FC<DemoProps> = ({ run }) => {
  const [t, replay] = useTrigger(run);
  return (
    <Pad className="justify-between">
      <Trio
        t={t}
        chipFrom={{ opacity: 0, y: 8 }} chipT={{ duration: 0.15, ease: 'linear' }}
        tipFrom={{ opacity: 0, scale: 0.8 }} tipT={{ duration: 0.45, ease: 'easeInOut' }}
        badgeFrom={{ opacity: 0, scale: 0 }} badgeT={{ type: 'spring', stiffness: 600, damping: 8 }}
      />
      <Btn className="self-start" onClick={replay}>Replay</Btn>
    </Pad>
  );
};

const ConsistencyAfter: FC<DemoProps> = ({ run }) => {
  const [t, replay] = useTrigger(run);
  return (
    <Pad className="justify-between">
      <Trio
        t={t}
        chipFrom={{ opacity: 0, y: OFFSET }} chipT={enter}
        tipFrom={{ opacity: 0, scale: POP_FROM }} tipT={enter}
        badgeFrom={{ opacity: 0, scale: POP_FROM }} badgeT={enter}
      />
      <Btn className="self-start" onClick={replay}>Replay</Btn>
    </Pad>
  );
};

// ---------- 15. Hierarchy ----------

function useExpand(run: number) {
  const [t] = useTrigger(run);
  const [open, setOpen] = useState(true);
  useScript(t, (at) => {
    setOpen(false);
    at(250, () => setOpen(true));
  });
  return [open, setOpen] as const;
}

const Chevron = () => (
  <svg viewBox="0 0 16 16" className="size-2" aria-hidden>
    <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Parent = ({ open, onToggle, chevron }: { open: boolean; onToggle: () => void; chevron: ReactNode }) => (
  <button type="button" aria-expanded={open} onClick={onToggle} className={`flex h-4 items-center gap-1 self-start text-sm font-medium ${focus}`}>
    {chevron}
    Mains <span className="font-normal text-neutral-500">3 dishes</span>
  </button>
);

const HierarchyBefore: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useExpand(run);
  return (
    <Pad>
      <Parent open={open} onToggle={() => setOpen(!open)} chevron={<span className={open ? 'rotate-90' : ''}><Chevron /></span>} />
      <AnimatePresence>
        {open && (
          <motion.ul className="flex flex-col gap-0.5" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.2 }}>
            {DISHES.slice(0, 3).map((d) => <li key={d}><ListRow name={d} /></li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </Pad>
  );
};

const HierarchyAfter: FC<DemoProps> = ({ run }) => {
  const [open, setOpen] = useExpand(run);
  return (
    <Pad>
      <Parent
        open={open}
        onToggle={() => setOpen(!open)}
        chevron={<motion.span className="block" initial={false} animate={{ rotate: open ? 90 : 0 }} transition={enter}><Chevron /></motion.span>}
      />
      <AnimatePresence>
        {open && (
          <motion.ul className="ml-1 flex flex-col gap-0.5 border-l border-neutral-300 pl-2" exit={{ opacity: 0, transition: exit }}>
            {DISHES.slice(0, 3).map((d, i) => (
              // Children come out of the parent: from above, one step in, after it.
              <motion.li key={d} initial={{ opacity: 0, y: -OFFSET }} animate={{ opacity: 1, y: 0, transition: { ...enter, delay: (i + 1) * STAGGER } }}>
                <ListRow name={d} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </Pad>
  );
};

// ---------- 16. Purposeful motion ----------

const Bell = () => (
  <svg viewBox="0 0 24 24" className="size-3" aria-hidden>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function useCount(run: number) {
  const [t, replay] = useTrigger(run);
  const [n, setN] = useState(4);
  useScript(t, () => setN((x) => x + 1));
  return { t, n, replay };
}

const OrdersCard = ({ children, icon }: { children: ReactNode; icon: ReactNode }) => (
  <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
    {icon}
    <span className="text-sm font-medium">New orders</span>
    <span className="ml-auto">{children}</span>
  </div>
);

const PurposeBefore: FC<DemoProps> = ({ run }) => {
  const { t, n, replay } = useCount(run);
  return (
    <Pad className="justify-between">
      <motion.div key={t} animate={t ? { y: [0, -8, 0, -4, 0] } : undefined} transition={{ duration: 0.6 }}>
        <OrdersCard icon={<motion.span className="block" animate={t ? { rotate: [0, 360] } : undefined} transition={{ duration: 0.6 }}><Bell /></motion.span>}>
          <motion.span className="grid h-3 min-w-3 place-items-center rounded-full bg-neutral-900 px-1 text-sm text-white tabular-nums" animate={t ? { scale: [0, 1.3, 1] } : undefined} transition={{ duration: 0.5 }}>
            {n}
          </motion.span>
        </OrdersCard>
      </motion.div>
      <Btn className="self-start" onClick={replay}>New order arrives</Btn>
    </Pad>
  );
};

const PurposeAfter: FC<DemoProps> = ({ run }) => {
  const { n, replay } = useCount(run);
  return (
    <Pad className="justify-between">
      <OrdersCard icon={<Bell />}>
        <span className="grid h-3 min-w-3 place-items-center overflow-hidden rounded-full bg-neutral-900 px-1 text-sm text-white tabular-nums">
          <AnimatePresence initial={false}>
            <motion.span key={n} className="col-start-1 row-start-1" initial={{ opacity: 0, y: OFFSET }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, y: -OFFSET, transition: exit }}>
              {n}
            </motion.span>
          </AnimatePresence>
        </span>
      </OrdersCard>
      <Btn className="self-start" onClick={replay}>New order arrives</Btn>
    </Pad>
  );
};

// ---------- 17. Loading ----------

const Dish = ({ name }: { name: string }) => (
  <span className="flex h-5 items-center gap-1">
    <Thumb className="size-4" />
    <span className="flex flex-col">
      <span className="text-sm font-medium">{name}</span>
      <span className="text-xs text-neutral-600">Today’s menu</span>
    </span>
  </span>
);

const LoadingBefore: FC<DemoProps> = ({ run }) => {
  const { loading, replay } = useLoad(run, 400);
  return (
    <Pad className="flex-row items-start">
      {loading ? (
        <div className="grid flex-1 place-items-center self-stretch" role="status" aria-label="Loading">
          <span className="size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {DISHES.slice(0, 3).map((d) => <li key={d}><Dish name={d} /></li>)}
        </ul>
      )}
      <Btn className="ml-auto" onClick={replay}>Reload</Btn>
    </Pad>
  );
};

const LoadingAfter: FC<DemoProps> = ({ run }) => {
  const { t, loading, replay } = useLoad(run, 400);
  return (
    <Pad className="flex-row items-start">
      <div className="grid">
        <AnimatePresence initial={false}>
          {loading ? (
            <motion.ul key="skeleton" className="col-start-1 row-start-1 flex flex-col gap-1" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }} exit={{ opacity: 0, transition: exit }}>
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex h-5 items-center gap-1">
                  <Thumb tone="bg-neutral-200" className="size-4" />
                  <span className="flex flex-col gap-0.5">
                    <Bar className="w-14" />
                    <Bar className="w-8" />
                  </span>
                </li>
              ))}
            </motion.ul>
          ) : (
            <ul key={`list-${t}`} className="col-start-1 row-start-1 flex flex-col gap-1">
              {DISHES.slice(0, 3).map((d, i) => (
                <motion.li key={d} variants={fadeUp} custom={i} initial={from(t)} animate="shown">
                  <Dish name={d} />
                </motion.li>
              ))}
            </ul>
          )}
        </AnimatePresence>
      </div>
      <Btn className="ml-auto" onClick={replay}>Reload</Btn>
    </Pad>
  );
};

// ---------- 18. Clean UI ----------

/** An 8px grid laid over the stage, so the alignment is visible. */
const Grid = ({ show }: { show: boolean }) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}
    style={{
      backgroundImage: 'linear-gradient(to right, rgb(59 130 246 / 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgb(59 130 246 / 0.18) 1px, transparent 1px)',
      backgroundSize: '8px 8px',
    }}
  />
);

const CleanBefore: FC<DemoProps> = ({ run }) => {
  const { on } = useBounce(run, 800);
  return (
    <div className="relative h-full p-[13px]">
      <div className="rounded-[3px] p-[7px] shadow-[0_6px_18px_rgba(0,0,0,0.35)]" style={{ background: 'linear-gradient(135deg, #6b21a8, #9f1239)' }}>
        <div className="flex items-center gap-[3px]">
          <span className="text-[19px] font-black text-white italic">Shrimp tajine!!</span>
          <span className="ml-[11px] rounded-[9px] bg-lime-300 px-[5px] text-[10px] font-bold text-black uppercase">New</span>
        </div>
        <p className="mt-[13px] text-[13px] text-white underline">Tomato · garlic · cumin</p>
        <button type="button" className={`mt-[6px] rounded-[20px] border-[3px] border-dashed border-white px-[9px] py-[2px] text-[15px] font-bold text-white ${focus}`}>ORDER NOW</button>
      </div>
      <Grid show={on} />
    </div>
  );
};

const CleanAfter: FC<DemoProps> = ({ run }) => {
  const { on } = useBounce(run, 800);
  return (
    <div className="relative h-full p-2">
      <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">Shrimp tajine</span>
          <span className="rounded-md bg-neutral-100 px-1 text-xs text-neutral-700">New</span>
        </div>
        <p className="text-sm text-neutral-600">Tomato, garlic, cumin</p>
        <Btn primary className="self-start">Add to order</Btn>
      </div>
      <Grid show={on} />
    </div>
  );
};

// ---------- 19. Labels ----------

const Mini = ({ good }: { good?: boolean }) => (
  <span aria-hidden className="flex flex-1 flex-col justify-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1">
    <span className={`block h-1.5 rounded-sm ${good ? 'w-6 bg-neutral-700' : 'w-8 bg-neutral-300'}`} />
    <span className="block h-1.5 w-4 rounded-sm bg-neutral-200" />
  </span>
);

const LabelsBefore: FC<DemoProps> = () => (
  <div className="flex h-full gap-1 p-2" role="img" aria-label="Two examples side by side, with no labels">
    <Mini />
    <Mini good />
  </div>
);

const LabelsAfter: FC<DemoProps> = ({ run }) => {
  const [t] = useTrigger(run);
  return (
    <div className="flex h-full gap-1 p-2">
      {(['Before', 'After'] as const).map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1">
          <motion.span key={t} className="text-xs font-semibold tracking-wide text-neutral-700 uppercase" variants={fadeUp} custom={i} initial={from(t)} animate="shown">
            {label}
          </motion.span>
          <Mini good={i === 1} />
        </div>
      ))}
    </div>
  );
};

// ---------- The list ----------

export const DEMOS: Demo[] = [
  {
    title: 'Visual stability',
    rule: 'Hold the space while content loads, so nothing below it moves.',
    before: { note: 'Rows vanish while loading. Checkout jumps up, then back down.', C: StabilityBefore },
    after: { note: 'A skeleton keeps the rows’ height. Checkout never moves.', C: StabilityAfter },
  },
  {
    title: 'Shared element transitions',
    rule: 'Carry the element from one state to the next with layoutId.',
    before: { note: 'The detail view replaces the grid in one frame. Where did the card go?', C: SharedBefore },
    after: { note: 'The card, its image and its name morph into the detail view and back.', C: SharedAfter },
  },
  {
    title: 'Performance',
    rule: 'Animate transform and opacity only. Never top/left or box-shadow.',
    before: { note: 'Animates left and box-shadow: layout and paint on every frame.', C: PerfBefore },
    after: { note: 'translateX, plus the opacity of a pre-drawn shadow layer. Compositor only.', C: PerfAfter },
  },
  {
    title: 'Timing',
    rule: '200 ms or less. Ease-out (0.22, 1, 0.36, 1) to enter, ease-in to leave.',
    before: { note: '600 ms linear in, 600 ms ease-out away. Slow, and it lingers.', C: TimingBefore },
    after: { note: '200 ms ease-out in, 150 ms ease-in out.', C: TimingAfter },
  },
  {
    title: 'Staggering',
    rule: 'Lists arrive item by item, 30–50 ms apart.',
    before: { note: '150 ms between items, 400 ms each: the list takes over a second.', C: StaggerBefore },
    after: { note: '40 ms between items. The whole list settles in under 400 ms.', C: StaggerAfter },
  },
  {
    title: 'Attention',
    rule: 'A small change in scale and opacity is enough to point at the primary action.',
    before: { note: 'The button bounces at 120% for 700 ms. It shouts.', C: AttentionBefore },
    after: { note: 'It goes from 97% and faded to full, once, in 200 ms.', C: AttentionAfter },
  },
  {
    title: 'State changes',
    rule: 'Animate between states instead of swapping them.',
    before: { note: 'Knob, colour and label all swap in a single frame.', C: StateBefore },
    after: { note: 'The knob slides, the track and the label cross-fade.', C: StateAfter },
  },
  {
    title: 'Button physics',
    rule: 'A press gives way a little, on a spring (stiffness 300, damping 25).',
    before: { note: 'No response to the press. Did it register?', C: PhysicsBefore },
    after: { note: 'Presses to 97% and springs back.', C: PhysicsAfter },
  },
  {
    title: 'Scale',
    rule: 'Pop in from 97%, never from 0.',
    before: { note: 'Grows from a dot in the middle, 300 ms.', C: ScaleBefore },
    after: { note: 'From 97% and transparent, growing out of its button.', C: ScaleAfter },
  },
  {
    title: 'Layout',
    rule: 'Reserve the space for content that comes and goes.',
    before: { note: 'The error message pushes the button down, then lets it jump back.', C: LayoutBefore },
    after: { note: 'The message line is always there. Only its text fades.', C: LayoutAfter },
  },
  {
    title: 'Fades',
    rule: 'Fade with opacity plus a short move, not colour.',
    before: { note: 'Fades the text, fill and border colours: a repaint every frame.', C: FadeBefore },
    after: { note: 'Opacity and an 8 px rise, on the compositor.', C: FadeAfter },
  },
  {
    title: 'Feedback',
    rule: 'Hover and press respond at once, in 100 ms.',
    before: { note: 'Hover shows after 150 ms and takes 500 ms. No pressed state.', C: FeedbackBefore },
    after: { note: 'Hover and press tints in 100 ms.', C: FeedbackAfter },
  },
  {
    title: 'Accessibility',
    rule: 'Respect prefers-reduced-motion: drop the movement, keep the fade.',
    before: { note: 'Slides 160 px whatever the setting.', C: A11yBefore },
    after: { note: 'With reduced motion it only fades. Without, it rises 8 px.', C: A11yAfter },
    flag: { label: 'Simulate reduced motion', initial: true },
  },
  {
    title: 'Consistency',
    rule: 'One easing and one duration everywhere.',
    before: { note: 'Three elements, three motions: linear, ease-in-out and a bouncy spring.', C: ConsistencyBefore },
    after: { note: 'All three use the same 200 ms ease-out.', C: ConsistencyAfter },
  },
  {
    title: 'Hierarchy',
    rule: 'Children move out of their parent, and after it.',
    before: { note: 'The dishes rise from below, all at once, level with “Mains”.', C: HierarchyBefore },
    after: { note: 'They come down out of “Mains”, indented, one after another.', C: HierarchyAfter },
  },
  {
    title: 'Purposeful motion',
    rule: 'Move only what changed.',
    before: { note: 'The card bounces, the bell spins, the badge pops.', C: PurposeBefore },
    after: { note: 'Only the number moves: the old one out, the new one in.', C: PurposeAfter },
  },
  {
    title: 'Loading',
    rule: 'Show the shape of what is coming, then fade it in.',
    before: { note: 'A spinner, then everything appears at once.', C: LoadingBefore },
    after: { note: 'A skeleton of the list, then the rows fade in over it.', C: LoadingAfter },
  },
  {
    title: 'Clean UI',
    rule: 'Neutral colours, and every space a multiple of 8 px.',
    before: { note: '3, 5, 7, 11 and 13 px gaps, a gradient and a heavy shadow.', C: CleanBefore },
    after: { note: 'Neutral, and on the 8 px grid that Replay shows.', C: CleanAfter },
  },
  {
    title: 'Labels',
    rule: 'Say which example is which, above each one.',
    before: { note: 'Two examples, and no way to tell which is the good one.', C: LabelsBefore },
    after: { note: 'A clear label above each example.', C: LabelsAfter },
  },
];

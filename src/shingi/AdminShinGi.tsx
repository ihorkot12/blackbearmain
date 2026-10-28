import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Plus, RefreshCw, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { BELT_CODES, BELT_LABELS, beltCategory, type BeltCode } from '../../api/_shingi/belts';

/* ───────────── API ───────────── */

async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem('admin_token') || '';
  const res = await fetch(`/api/shingi/${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Помилка ${res.status}`);
  return data as T;
}

async function downloadFile(path: string, fallbackName: string) {
  const token = localStorage.getItem('admin_token') || '';
  const res = await fetch(`/api/shingi/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Помилка ${res.status}`);
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ───────────── довідники та формат ───────────── */

const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Чернетка',
  announced: 'Анонс',
  registration: 'Реєстрація відкрита',
  groups_published: 'Групи опубліковані',
  done: 'Завершено',
  cancelled: 'Скасовано',
};

const ENTRY_STATUS_LABELS: Record<string, string> = {
  draft: 'Чернетка',
  submitted: 'Очікує оплати',
  paid: 'Оплачено',
  withdrawn: 'Знято',
  no_show: 'Не з’явився',
  fought: 'Бився',
};

const ENTRY_STATUS_TONE: Record<string, string> = {
  draft: 'bg-zinc-700/40 text-zinc-300',
  submitted: 'bg-amber-500/15 text-amber-300',
  paid: 'bg-emerald-500/15 text-emerald-300',
  withdrawn: 'bg-red-500/15 text-red-300',
  no_show: 'bg-red-500/15 text-red-300',
  fought: 'bg-sky-500/15 text-sky-300',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  created: 'Створено',
  processing: 'В обробці',
  success: 'Оплачено',
  failure: 'Помилка',
  expired: 'Прострочено',
  reversed: 'Повернено',
};

const PAYMENT_STATUS_TONE: Record<string, string> = {
  created: 'bg-amber-500/15 text-amber-300',
  processing: 'bg-amber-500/15 text-amber-300',
  success: 'bg-emerald-500/15 text-emerald-300',
  failure: 'bg-red-500/15 text-red-300',
  expired: 'bg-zinc-700/40 text-zinc-300',
  reversed: 'bg-red-500/15 text-red-300',
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' }) : '—';

const fmtMoney = (n?: number | null) => `${(n ?? 0).toLocaleString('uk-UA')} грн`;

const beltLabel = (belt?: string | null) => (belt && belt in BELT_LABELS ? BELT_LABELS[belt as BeltCode] : belt || '—');

const groupLabel = (key: string) => {
  const [block, sex, age, weight, cat] = key.split('|');
  const ageText = age === '18+' || age === '14-17' ? age : `${age} р.`;
  const weightText = weight === '?' ? 'вага ?' : `${weight.replace('-', '–')} кг`;
  return `${block === 'kids' ? 'Kids' : 'Open'} · ${sex === 'm' ? 'Ч' : 'Ж'} · ${ageText} · ${weightText} · ${cat}`;
};

const ageOnDate = (birth: string, on: string) => {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ey, em, ed] = on.split('-').map(Number);
  return ey - by - (em < bm || (em === bm && ed < bd) ? 1 : 0);
};

/* ───────────── UI-примітиви ───────────── */

const card = 'bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6';
const input =
  'w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-red-600 outline-none disabled:opacity-50';
const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const Badge = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
  <span className={`inline-block rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${tone}`}>{children}</span>
);

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
  </label>
);

const Loading = () => (
  <div className="flex h-40 items-center justify-center">
    <RefreshCw className="animate-spin text-red-600" size={28} />
  </div>
);

const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
    <p className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{value}</p>
    {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
  </div>
);

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Щось пішло не так');

/* ───────────── типи ───────────── */

type EventRow = {
  id: number;
  slug: string;
  title: string;
  event_date: string;
  status: string;
  fee_uah: number;
  limit_kids: number | null;
  limit_open: number | null;
  deadline_apps: string | null;
  deadline_pay: string | null;
  groups_publish_date: string | null;
  address: string | null;
  schedule_json: { kids?: string; open?: string } | null;
  notes: string | null;
  counters?: any;
};

/* ───────────── Подія ───────────── */

/** Налаштування бота однією кнопкою: вебхук + /start + кнопка меню «Кабінет». */
const BotCard = () => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const onPreview = /\.vercel\.app$/.test(window.location.hostname);

  const setup = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await api('admin/bot/setup', { method: 'POST', body: { base: window.location.origin } }));
      toast.success('Бота налаштовано');
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  return (
    <div className={card}>
      <h4 className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">Бот @shingii_bot</h4>
      <p className="text-sm text-zinc-400">
        Кнопка підключає вебхук і меню «Кабінет». Після цього тренер пише боту /start, натискає «Відкрити кабінет» і заходить без номера й паролів.
      </p>
      {onPreview && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-200">
          Ви на тестовому домені Vercel. Telegram не відкриє його всередині застосунку (там потрібен вхід у Vercel), тому запускайте це з головного домену сайту.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={btnPrimary} onClick={setup} disabled={busy}>
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Налаштувати бота
        </button>
        {result && (
          <span className="text-[13px] text-emerald-300">
            Вебхук: {result.webhook_url} {result.last_error ? `· помилка Telegram: ${result.last_error}` : '· без помилок'}
          </span>
        )}
      </div>
    </div>
  );
};

const eventToForm = (e: EventRow) => ({
  title: e.title || '',
  event_date: e.event_date || '',
  status: e.status,
  fee_uah: String(e.fee_uah ?? 400),
  limit_kids: e.limit_kids === null ? '' : String(e.limit_kids),
  limit_open: e.limit_open === null ? '' : String(e.limit_open),
  deadline_apps: e.deadline_apps || '',
  deadline_pay: e.deadline_pay || '',
  groups_publish_date: e.groups_publish_date || '',
  address: e.address || '',
  kids_time: e.schedule_json?.kids || '10:00',
  open_time: e.schedule_json?.open || '13:00',
  notes: e.notes || '',
});

const EventTab = ({ event, onSaved, onCreated }: { event: EventRow; onSaved: () => void; onCreated: (id: number) => void }) => {
  const [form, setForm] = useState(() => eventToForm(event));
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: 'SHIN GI · Kyokushin Open', slug: '', event_date: '' });

  useEffect(() => {
    setForm(eventToForm(event));
  }, [event]);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const c = event.counters;

  const save = async () => {
    setSaving(true);
    try {
      await api(`admin/events/${event.id}`, {
        method: 'PUT',
        body: {
          title: form.title,
          event_date: form.event_date,
          status: form.status,
          fee_uah: form.fee_uah,
          limit_kids: form.limit_kids,
          limit_open: form.limit_open,
          deadline_apps: form.deadline_apps,
          deadline_pay: form.deadline_pay,
          groups_publish_date: form.groups_publish_date,
          address: form.address,
          schedule_json: { kids: form.kids_time, open: form.open_time },
          notes: form.notes,
        },
      });
      toast.success('Подію збережено');
      onSaved();
    } catch (e) {
      fail(e);
    }
    setSaving(false);
  };

  const create = async () => {
    try {
      const res = await api<{ event: EventRow }>('admin/events', { method: 'POST', body: draft });
      toast.success('Подію створено');
      setCreating(false);
      onCreated(res.event.id);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="space-y-4">
      {c && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Клубів" value={c.clubs} />
          <Stat label="Бійців" value={c.fighters.total} sub={`Kids ${c.fighters.kids} · Open ${c.fighters.open}`} />
          <Stat
            label="Вільних місць"
            value={c.free.kids === null && c.free.open === null ? '∞' : `${c.free.kids ?? '∞'} / ${c.free.open ?? '∞'}`}
            sub="Kids / Open"
          />
          <Stat label="До події" value={c.days_to.event === null ? '—' : `${c.days_to.event} дн.`} sub={fmtDate(event.event_date)} />
        </div>
      )}

      <div className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Назва">
            <input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Статус" hint="Реєстрація відкрита — тренери подають заявки. Анонс — лише лічильники.">
            <select className={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Дата події">
            <input type="date" className={input} value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
          </Field>
          <Field label="Внесок, грн за бійця">
            <input type="number" min={0} className={input} value={form.fee_uah} onChange={(e) => set('fee_uah', e.target.value)} />
          </Field>
          <Field label="Дедлайн заявок" hint="За брифом: D−10">
            <input type="date" className={input} value={form.deadline_apps} onChange={(e) => set('deadline_apps', e.target.value)} />
          </Field>
          <Field label="Дедлайн внеску" hint="За брифом: D−7">
            <input type="date" className={input} value={form.deadline_pay} onChange={(e) => set('deadline_pay', e.target.value)} />
          </Field>
          <Field label="Публікація груп" hint="За брифом: D−5">
            <input type="date" className={input} value={form.groups_publish_date} onChange={(e) => set('groups_publish_date', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ліміт Kids" hint="Порожньо — без ліміту">
              <input type="number" min={1} className={input} value={form.limit_kids} onChange={(e) => set('limit_kids', e.target.value)} />
            </Field>
            <Field label="Ліміт Open">
              <input type="number" min={1} className={input} value={form.limit_open} onChange={(e) => set('limit_open', e.target.value)} />
            </Field>
          </div>
          <Field label="Початок блоку Kids">
            <input type="time" className={input} value={form.kids_time} onChange={(e) => set('kids_time', e.target.value)} />
          </Field>
          <Field label="Початок блоку Open">
            <input type="time" className={input} value={form.open_time} onChange={(e) => set('open_time', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Адреса">
              <input className={input} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Нотатки (бачать лише адміни)">
              <textarea rows={3} className={input} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Зберегти
          </button>
          <button className={btnSecondary} onClick={() => setCreating((v) => !v)}>
            <Plus size={14} /> Нова подія
          </button>
        </div>
      </div>

      {creating && (
        <div className={card}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Назва">
              <input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Slug" hint="Латиниця, цифри, дефіс. Напр. shin-gi-2">
              <input className={input} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} />
            </Field>
            <Field label="Дата" hint="Дедлайни заповняться за D−10 / D−7 / D−5">
              <input type="date" className={input} value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex gap-3">
            <button className={btnPrimary} onClick={create} disabled={!draft.slug || !draft.event_date || !draft.title}>Створити</button>
            <button className={btnSecondary} onClick={() => setCreating(false)}>Скасувати</button>
          </div>
        </div>
      )}

      <BotCard />
    </div>
  );
};

/* ───────────── Заявки ───────────── */

const AddTeamModal = ({ event, onClose, onDone }: { event: EventRow; onClose: () => void; onDone: () => void }) => {
  const [team, setTeam] = useState({ club: '', coach_full_name: '', federation: '', city: 'Київ', phone: '' });
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const parse = async () => {
    setBusy(true);
    try {
      const res = await api<{ parsed: any[]; errors: any[] }>('admin/fighters/parse', { method: 'POST', body: { event_id: event.id, text } });
      setParsed(res.parsed);
      setErrors(res.errors);
      setOverrides(new Set());
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  const ageOf = (f: any): number | null => (f.birth_date ? ageOnDate(f.birth_date, event.event_date) : f.age_years);

  const save = async () => {
    if (!parsed?.length) return;
    setBusy(true);
    try {
      await api('admin/entries', {
        method: 'POST',
        body: {
          event_id: event.id,
          profile: team,
          fighters: parsed.map((f, i) => ({
            full_name: f.full_name,
            sex: f.sex,
            birth_date: f.birth_date,
            age_years: f.age_years,
            weight_kg: f.weight_kg,
            belt: f.belt,
            block_override: overrides.has(i),
          })),
        },
      });
      toast.success(`Команду додано: ${parsed.length} бійців`);
      onDone();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950 p-4 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-tight">Додати команду вручну</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-white/5" aria-label="Закрити"><X size={18} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Клуб *"><input className={input} value={team.club} onChange={(e) => setTeam({ ...team, club: e.target.value })} /></Field>
          <Field label="ПІБ тренера *"><input className={input} value={team.coach_full_name} onChange={(e) => setTeam({ ...team, coach_full_name: e.target.value })} /></Field>
          <Field label="Федерація"><input className={input} value={team.federation} placeholder="WKO Shinkyokushinkai, IKO, IFK…" onChange={(e) => setTeam({ ...team, federation: e.target.value })} /></Field>
          <Field label="Місто"><input className={input} value={team.city} onChange={(e) => setTeam({ ...team, city: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Field label="Телефон"><input className={input} value={team.phone} inputMode="tel" onChange={(e) => setTeam({ ...team, phone: e.target.value })} /></Field>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Список бійців" hint="Один боєць на рядок: Іваненко Максим ч 12 38 8кю">
            <textarea rows={6} className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Іваненко Максим ч 12 38 8кю\nКоваль Софія, ж, 10, 31, 10 кю'} />
          </Field>
          <button className={`${btnSecondary} mt-3`} onClick={parse} disabled={busy || !text.trim()}>Розібрати список</button>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 space-y-1 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errors.map((er) => (
              <p key={er.line}><b>Рядок {er.line}:</b> {er.reason} <span className="text-red-300/60">— {er.raw}</span></p>
            ))}
            <p className="pt-1 text-[11px] text-red-300/70">Виправте ці рядки в тексті й розберіть ще раз — інакше їх не буде додано.</p>
          </div>
        )}

        {parsed && parsed.length > 0 && (
          <div className="mt-4 space-y-2">
            {parsed.map((f, i) => {
              const age = ageOf(f);
              return (
                <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{f.full_name}</b>
                    <span className="text-zinc-400">
                      {f.sex === 'm' ? 'Ч' : 'Ж'} · {age} р. · {f.weight_kg} кг · {beltLabel(f.belt)} ({beltCategory(f.belt)})
                    </span>
                  </div>
                  {f.warnings?.length > 0 && <p className="mt-1 text-[11px] text-amber-300">⚠ {f.warnings.join('; ')}</p>}
                  {age !== null && age >= 14 && age <= 17 && (
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={overrides.has(i)}
                        onChange={(e) =>
                          setOverrides((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(i); else next.delete(i);
                            return next;
                          })
                        }
                      />
                      Заявити в Open (14–17)
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btnPrimary} onClick={save} disabled={busy || !parsed?.length || !team.club.trim() || !team.coach_full_name.trim()}>
            Зберегти команду{parsed?.length ? ` (${parsed.length})` : ''}
          </button>
          <button className={btnSecondary} onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
};

type Patch = (id: number, body: Record<string, unknown>) => void;

/** Поля рядка заявки — окремі компоненти верхнього рівня, щоб поля не перемонтовувались і не губили фокус. */
const StatusSelect = ({ r, patch }: { r: any; patch: Patch }) => (
  <select className={input} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })} aria-label="Статус">
    {Object.entries(ENTRY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

const BlockSelect = ({ r, patch }: { r: any; patch: Patch }) => (
  <select className={input} value={r.block} onChange={(e) => patch(r.id, { block: e.target.value })} aria-label="Блок">
    <option value="kids">Kids</option>
    <option value="open">Open</option>
  </select>
);

const WeightInput = ({ r, patch }: { r: any; patch: Patch }) => (
  <input
    key={`${r.id}-${r.weight_kg}`}
    type="number"
    step="0.1"
    min={15}
    max={150}
    defaultValue={r.weight_kg ?? ''}
    className={input}
    aria-label="Вага, кг"
    onBlur={(e) => {
      const v = Number(e.target.value);
      if (v && v !== r.weight_kg) patch(r.id, { weight_kg: v });
    }}
  />
);

const BeltSelect = ({ r, patch }: { r: any; patch: Patch }) => (
  <select className={input} value={r.belt || ''} onChange={(e) => patch(r.id, { belt: e.target.value })} aria-label="Пояс">
    {BELT_CODES.map((b) => <option key={b} value={b}>{BELT_LABELS[b]}</option>)}
  </select>
);

const EntriesTab = ({ event }: { event: EventRow }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [block, setBlock] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ entries: any[] }>(`admin/entries?event_id=${event.id}`);
      setRows(res.entries);
    } catch (e) {
      fail(e);
      setRows([]);
    }
  }, [event.id]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const patch: Patch = async (id, body) => {
    try {
      const res = await api<{ entry: any }>(`admin/entries/${id}`, { method: 'PUT', body });
      setRows((list) =>
        (list || []).map((r) =>
          r.id === id ? { ...r, ...res.entry, belt_cat: res.entry.belt in BELT_LABELS ? beltCategory(res.entry.belt) : r.belt_cat } : r,
        ),
      );
    } catch (e) {
      fail(e);
      load();
    }
  };

  const shown = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          (!block || r.block === block) &&
          (!status || r.status === status) &&
          (!query || `${r.club} ${r.coach_full_name} ${r.full_name}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [rows, block, status, query],
  );

  if (!rows) return <Loading />;

  const counts = rows.reduce((acc: Record<string, number>, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between`}>
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Field label="Блок">
            <select className={input} value={block} onChange={(e) => setBlock(e.target.value)}>
              <option value="">Усі</option><option value="kids">Kids</option><option value="open">Open</option>
            </select>
          </Field>
          <Field label="Статус">
            <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Усі</option>
              {Object.entries(ENTRY_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Клуб, тренер або боєць">
            <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук…" />
          </Field>
        </div>
        <div className="flex gap-3">
          <button className={btnSecondary} onClick={load}><RefreshCw size={14} /> Оновити</button>
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus size={14} /> Додати команду</button>
        </div>
      </div>

      <p className="px-1 text-[12px] text-zinc-500">
        Показано {shown.length} з {rows.length}
        {Object.entries(counts).map(([s, n]) => ` · ${ENTRY_STATUS_LABELS[s]}: ${n}`)}
      </p>

      {shown.length === 0 && <div className={`${card} text-center text-zinc-500`}>Заявок поки немає</div>}

      {/* мобільні картки */}
      <div className="space-y-3 md:hidden">
        {shown.map((r) => (
          <div key={r.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-black">{r.full_name}</p>
                <p className="truncate text-[12px] text-zinc-400">{r.club} · {r.coach_full_name}</p>
                <p className="text-[12px] text-zinc-500">{r.sex === 'm' ? 'Ч' : 'Ж'} · {r.age ?? '?'} р. · кат. {r.belt_cat ?? '?'}</p>
              </div>
              <Badge tone={ENTRY_STATUS_TONE[r.status]}>{ENTRY_STATUS_LABELS[r.status]}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatusSelect r={r} patch={patch} />
              <BlockSelect r={r} patch={patch} />
              <WeightInput r={r} patch={patch} />
              <BeltSelect r={r} patch={patch} />
            </div>
            {r.group_key && <p className="mt-2 text-[11px] text-zinc-500">Група: {groupLabel(r.group_key)}</p>}
          </div>
        ))}
      </div>

      {/* таблиця */}
      <div className={`${card} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <th className="pb-3 pr-3">Клуб / тренер</th><th className="pb-3 pr-3">Боєць</th><th className="pb-3 pr-3">Ст.</th>
              <th className="pb-3 pr-3">Вік</th><th className="pb-3 pr-3">Кат.</th><th className="pb-3 pr-3">Статус</th>
              <th className="pb-3 pr-3">Блок</th><th className="pb-3 pr-3">Вага</th><th className="pb-3 pr-3">Пояс</th><th className="pb-3">Група</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-white/5 align-top hover:bg-white/[0.02]">
                <td className="py-2 pr-3"><p className="font-bold">{r.club}</p><p className="text-[12px] text-zinc-500">{r.coach_full_name}</p></td>
                <td className="py-2 pr-3 font-bold">{r.full_name}</td>
                <td className="py-2 pr-3">{r.sex === 'm' ? 'Ч' : 'Ж'}</td>
                <td className="py-2 pr-3">{r.age ?? '?'}</td>
                <td className="py-2 pr-3">{r.belt_cat ?? '?'}</td>
                <td className="py-2 pr-3"><StatusSelect r={r} patch={patch} /></td>
                <td className="py-2 pr-3"><BlockSelect r={r} patch={patch} /></td>
                <td className="py-2 pr-3"><WeightInput r={r} patch={patch} /></td>
                <td className="py-2 pr-3"><BeltSelect r={r} patch={patch} /></td>
                <td className="py-2 text-[12px] text-zinc-500">{r.group_key ? groupLabel(r.group_key) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <AddTeamModal
          event={event}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
};

/* ───────────── Групи ───────────── */

const GroupsTab = ({ event, onChanged }: { event: EventRow; onChanged: () => void }) => {
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`admin/groups?event_id=${event.id}`));
    } catch (e) {
      fail(e);
      setData({ groups: [], skipped: [], unassigned: 0, event_status: event.status });
    }
  }, [event.id, event.status]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const build = async (reset: boolean) => {
    setBusy(true);
    try {
      const res = await api<any>(`admin/groups/build?event_id=${event.id}${reset ? '&reset_manual=1' : ''}`, { method: 'POST' });
      toast.success(`Сформовано груп: ${res.stats.groups}, одиночних: ${res.stats.singles}`);
      await load();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  const publish = async () => {
    setBusy(true);
    try {
      await api(`admin/groups/publish?event_id=${event.id}`, { method: 'POST' });
      toast.success('Групи опубліковано');
      setConfirmPublish(false);
      onChanged();
      await load();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  const move = async (entryId: number, key: string) => {
    try {
      await api(`admin/entries/${entryId}`, { method: 'PUT', body: { group_key: key } });
      await load();
    } catch (e) {
      fail(e);
    }
  };

  if (!data) return <Loading />;
  const groups: any[] = data.groups;
  const singles = groups.filter((g) => g.single).length;

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap gap-3">
          <button className={btnPrimary} onClick={() => build(false)} disabled={busy}>
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />} Сформувати групи
          </button>
          <button className={btnSecondary} onClick={() => build(true)} disabled={busy}>Скинути ручні та сформувати</button>
          {!confirmPublish ? (
            <button className={btnSecondary} onClick={() => setConfirmPublish(true)} disabled={busy || groups.length === 0 || data.unassigned > 0}>
              Опублікувати…
            </button>
          ) : (
            <>
              <button className={btnPrimary} onClick={publish} disabled={busy}>Так, опублікувати</button>
              <button className={btnSecondary} onClick={() => setConfirmPublish(false)}>Скасувати</button>
            </>
          )}
        </div>
        <p className="text-[12px] text-zinc-500">
          Статус події: <b className="text-zinc-300">{EVENT_STATUS_LABELS[data.event_status] || data.event_status}</b> · груп: {groups.length}
          {singles > 0 && <> · <span className="text-amber-300">одиночних: {singles}</span></>}
        </p>
        {data.unassigned > 0 && (
          <p className="flex items-center gap-2 text-[12px] text-amber-300">
            <AlertTriangle size={14} /> У {data.unassigned} заявок ще немає групи — натисніть «Сформувати групи».
          </p>
        )}
        {data.skipped?.length > 0 && (
          <p className="text-[12px] text-red-300">Не потрапили в групи (немає віку чи поясу): {data.skipped.map((s: any) => s.full_name).join(', ')}</p>
        )}
      </div>

      {groups.length === 0 && <div className={`${card} text-center text-zinc-500`}>Немає заявок для групування</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className={`${card} ${g.single ? '!border-amber-500/40' : ''}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <h4 className="font-black tracking-tight">{groupLabel(g.key)}</h4>
              <Badge tone={g.single ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-700/40 text-zinc-300'}>{g.size}</Badge>
            </div>
            {g.single && <p className="mb-2 text-[11px] text-amber-300">Одиночний — потребує ручного об’єднання</p>}
            <div className="space-y-2">
              {g.members.map((m: any) => (
                <div key={m.entry_id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                  <p className="truncate font-bold">{m.full_name}{m.manual && <span className="ml-2 text-[10px] text-sky-300">вручну</span>}</p>
                  <p className="truncate text-[12px] text-zinc-500">{m.club} · {m.coach}</p>
                  <p className="text-[12px] text-zinc-500">{m.age} р. · {m.weight_kg ?? '?'} кг · {beltLabel(m.belt)}</p>
                  <select
                    className={`${input} mt-2`}
                    value=""
                    onChange={(e) => e.target.value && move(m.entry_id, e.target.value)}
                    aria-label="Перемістити в іншу групу"
                  >
                    <option value="">Перемістити в…</option>
                    {groups.filter((o) => o.key !== g.key).map((o) => (
                      <option key={o.key} value={o.key}>{groupLabel(o.key)} ({o.size})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────── Оплати ───────────── */

const PaymentsTab = ({ event }: { event: EventRow }) => {
  const [payments, setPayments] = useState<any[] | null>(null);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    setPayments(null);
    Promise.all([api<any>(`admin/payments?event_id=${event.id}`), api<any>(`admin/entries?event_id=${event.id}`)])
      .then(([p, e]) => {
        setPayments(p.payments);
        setEntries(e.entries);
      })
      .catch((e) => {
        fail(e);
        setPayments([]);
      });
  }, [event.id]);

  const byClub = useMemo(() => {
    const map = new Map<number, { club: string; coach: string; paid: number; pending: number }>();
    for (const r of entries) {
      if (r.status !== 'paid' && r.status !== 'submitted' && r.status !== 'fought') continue;
      const row = map.get(r.profile_id) || { club: r.club, coach: r.coach_full_name, paid: 0, pending: 0 };
      if (r.status === 'submitted') row.pending += 1;
      else row.paid += 1;
      map.set(r.profile_id, row);
    }
    return [...map.values()].sort((a, b) => b.pending - a.pending);
  }, [entries]);

  if (!payments) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Онлайн-оплата Monobank підключається на етапі 5. Поки що тут видно, скільки бійців чекає на оплату; статус «Оплачено» можна виставити вручну у вкладці «Заявки».
      </div>

      <div className={card}>
        <h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Внески за клубами · {fmtMoney(event.fee_uah)} за бійця</h4>
        {byClub.length === 0 && <p className="text-zinc-500">Ще немає заявок</p>}
        <div className="space-y-2">
          {byClub.map((c) => (
            <div key={c.club + c.coach} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
              <div className="min-w-0"><p className="truncate font-bold">{c.club}</p><p className="truncate text-[12px] text-zinc-500">{c.coach}</p></div>
              <div className="flex items-center gap-2">
                {c.pending > 0 && <Badge tone={ENTRY_STATUS_TONE.submitted}>Очікує: {c.pending} · {fmtMoney(c.pending * event.fee_uah)}</Badge>}
                {c.paid > 0 && <Badge tone={ENTRY_STATUS_TONE.paid}>Оплачено: {c.paid}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Платежі Monobank</h4>
        {payments.length === 0 && <p className="text-zinc-500">Платежів ще немає</p>}
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
              <div className="min-w-0"><p className="truncate font-bold">{p.club}</p><p className="truncate text-[12px] text-zinc-500">{p.reference}</p></div>
              <div className="flex items-center gap-2"><b>{fmtMoney(p.amount_uah)}</b><Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ───────────── Статистика ───────────── */

const Bars = ({ data, order }: { data: Record<string, number>; order?: string[] }) => {
  const keys = order || Object.keys(data).sort((a, b) => data[b] - data[a]);
  const max = Math.max(1, ...keys.map((k) => data[k] || 0));
  return (
    <div className="space-y-2">
      {keys.map((k) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-zinc-400">{k}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-red-600" style={{ width: `${((data[k] || 0) / max) * 100}%` }} />
          </div>
          <b className="w-8 text-right">{data[k] || 0}</b>
        </div>
      ))}
    </div>
  );
};

const StatsTab = ({ event }: { event: EventRow }) => {
  const [stats, setStats] = useState<any | null>(null);
  useEffect(() => {
    setStats(null);
    api(`admin/stats?event_id=${event.id}`)
      .then(setStats)
      .catch((e) => {
        fail(e);
        setStats({ error: true });
      });
  }, [event.id]);

  if (!stats) return <Loading />;
  if (stats.error) return <div className={`${card} text-zinc-500`}>Не вдалося завантажити статистику</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Клубів" value={stats.clubs} />
        <Stat label="Бійців" value={stats.fighters} sub={`Kids ${stats.by_block.kids || 0} · Open ${stats.by_block.open || 0}`} />
        <Stat label="Оплачено" value={fmtMoney(stats.money.paid_uah)} />
        <Stat label="Очікується" value={fmtMoney(stats.money.pending_uah)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}><h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Категорії поясів</h4><Bars data={stats.by_category} order={['A', 'B', 'C']} /></div>
        <div className={card}><h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Федерації</h4><Bars data={stats.by_federation} /></div>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <h4 className="mb-3 text-[11px] font-black uppercase tracking-widest text-zinc-500">Порівняння подій</h4>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <th className="pb-2">Подія</th><th className="pb-2">Дата</th><th className="pb-2">Клубів</th><th className="pb-2">Бійців</th>
            </tr>
          </thead>
          <tbody>
            {stats.events.map((e: any) => (
              <tr key={e.event_id} className={`border-t border-white/5 ${e.event_id === event.id ? 'text-white' : 'text-zinc-400'}`}>
                <td className="py-2">{e.title}</td><td className="py-2">{fmtDate(e.event_date)}</td><td className="py-2">{e.clubs}</td><td className="py-2">{e.fighters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ───────────── Експорт ───────────── */

const ExportTab = ({ event }: { event: EventRow }) => {
  const [busy, setBusy] = useState('');
  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    try {
      await downloadFile(`admin/export?event_id=${event.id}&format=${format}`, `shingi-${event.slug}.${format}`);
    } catch (e) {
      fail(e);
    }
    setBusy('');
  };
  return (
    <div className={`${card} space-y-4`}>
      <p className="text-sm text-zinc-400">
        У файлі: усі заявки (крім чернеток і знятих) з клубом, тренером, віком, вагою, поясом і групою. В Excel додатково — аркуш «Групи» (склад кожної групи) і аркуш «Оплати».
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={btnPrimary} onClick={() => run('xlsx')} disabled={!!busy}>
          {busy === 'xlsx' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} Excel (.xlsx)
        </button>
        <button className={btnSecondary} onClick={() => run('csv')} disabled={!!busy}>
          {busy === 'csv' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} CSV (лише заявки)
        </button>
      </div>
    </div>
  );
};

/* ───────────── Оболонка ───────────── */

const SUBTABS: Array<{ id: string; label: string; disabled?: string }> = [
  { id: 'event', label: 'Подія' },
  { id: 'entries', label: 'Заявки' },
  { id: 'groups', label: 'Групи' },
  { id: 'payments', label: 'Оплати' },
  { id: 'stats', label: 'Статистика' },
  { id: 'export', label: 'Експорт' },
  { id: 'questions', label: 'Питання', disabled: 'Буде на етапі 4' },
  { id: 'broadcasts', label: 'Розсилки', disabled: 'Буде на етапі 4' },
];

export const AdminShinGi = () => {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventId, setEventId] = useState<number | null>(null);
  const [tab, setTab] = useState<string>('event');
  const [error, setError] = useState('');

  const load = useCallback(async (select?: number) => {
    try {
      const res = await api<{ events: EventRow[] }>('admin/events');
      setEvents(res.events);
      setEventId((current) => select ?? current ?? res.events.find((e) => e.status !== 'cancelled')?.id ?? res.events[0]?.id ?? null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка завантаження');
      setEvents([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!events) return <Loading />;
  const event = events.find((e) => e.id === eventId) || null;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter sm:text-5xl">SHIN GI</h2>
          <p className="text-sm text-zinc-500">Kyokushin Open · реєстрація, групи, оплати</p>
        </div>
        {events.length > 0 && (
          <select className={`${input} sm:max-w-xs`} value={eventId ?? ''} onChange={(e) => setEventId(Number(e.target.value))} aria-label="Подія">
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {fmtDate(e.event_date)}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            disabled={!!t.disabled}
            title={t.disabled}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
              tab === t.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'
            } ${t.disabled ? 'cursor-not-allowed opacity-40 hover:text-zinc-400' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!event ? (
        <div className={`${card} text-center text-zinc-500`}>Подій ще немає</div>
      ) : (
        <>
          {tab === 'event' && <EventTab event={event} onSaved={() => load()} onCreated={(id) => load(id)} />}
          {tab === 'entries' && <EntriesTab event={event} />}
          {tab === 'groups' && <GroupsTab event={event} onChanged={() => load()} />}
          {tab === 'payments' && <PaymentsTab event={event} />}
          {tab === 'stats' && <StatsTab event={event} />}
          {tab === 'export' && <ExportTab event={event} />}
        </>
      )}
    </div>
  );
};

export default AdminShinGi;

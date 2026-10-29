import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BELT_CODES, BELT_LABELS, beltCategory, type BeltCode } from '../../api/_shingi/belts';
import { beltCat, blockRule, groupKeyOf, groupLabel, plausibilityWarnings, resolveBlock } from '../../api/_shingi/rules';
import { ApiError, ageOnDate, errorText, fmtDate, fmtMoney, kyivToday, sg } from './api';
import { Badge, BeltDot, Card, Chip, H2, Label, Shell, Spinner, Stepper, btnCls, display, inputCls, usePageSetup, useSession } from './ui';

const beltLabel = (belt?: string | null) => (belt && belt in BELT_LABELS ? BELT_LABELS[belt as BeltCode] : belt || '—');


const PAY_STATUS_LABEL: Record<string, string> = {
  created: 'очікує оплати',
  processing: 'в обробці',
  success: 'сплачено',
  failure: 'не пройшла',
  expired: 'прострочено',
  reversed: 'повернуто',
};

const ENTRY_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  submitted: 'Очікує оплати',
  paid: 'Оплачено',
  withdrawn: 'Знято',
  no_show: 'Не з’явився',
  fought: 'Бився',
};
const ENTRY_TONE: Record<string, 'gold' | 'red' | 'green' | 'grey'> = {
  draft: 'grey',
  submitted: 'gold',
  paid: 'green',
  withdrawn: 'red',
  no_show: 'red',
  fought: 'green',
};

type Notice = { kind: 'ok' | 'err'; text: string } | null;

const NoticeBox = ({ notice }: { notice: Notice }) =>
  notice ? (
    <p
      className={`border p-3 text-[14px] ${
        notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-[#A3101A]/60 bg-[#A3101A]/10 text-[#ff9a9a]'
      }`}
    >
      {notice.text}
    </p>
  ) : null;

/** Куди потрапить боєць і чому — щоб алгоритм був прозорий. */
const GroupLine = ({ age, sex, weight, belt, override = false }: { age: number | null; sex: 'm' | 'f'; weight: number | null; belt: string; override?: boolean }) => {
  if (age === null || Number.isNaN(age)) return null;
  const block = resolveBlock(age, override);
  const key = groupKeyOf({ block, sex, age, weight_kg: weight && Number.isFinite(weight) ? weight : null, belt });
  return (
    <p className="mt-1 text-[12px] text-[#9a9a95]">
      <span className="text-[#C9A227]">Група:</span> {groupLabel(key)} <span className="text-[#85857f]">· {blockRule(age, override)}</span>
    </p>
  );
};

const WarnLine = ({ warnings }: { warnings: string[] }) =>
  warnings.length > 0 ? <p className="mt-1 text-[12px] text-[#C9A227]">⚠ {warnings.join('; ')}</p> : null;

const RulesInfo = () => (
  <details className="mb-4 border border-[#242422] p-3 text-[14px] text-[#b9b9b4]">
    <summary className={`${display} cursor-pointer text-[12px] text-[#C9A227]`}>Як формуються групи</summary>
    <ol className="mt-3 list-decimal space-y-1 pl-5">
      <li><b>Блок.</b> До 14 років — Kids. 14–17 — Kids, але можна заявити в Open. 18+ — Open.</li>
      <li><b>Група</b> = блок · стать · вік · вага · категорія пояса. Хлопці й дівчата окремо.</li>
      <li><b>Вік.</b> Kids — повних років на дату події. Open — лише 14–17 або 18+.</li>
      <li><b>Вага.</b> Береться та, що ви вказали (зважування не буде). Kids — крок 5 кг, Open — крок 10 кг. Межа входить у верхню групу: 40,0 кг — це 40–45.</li>
      <li><b>Категорія пояса.</b> A — білий, 10 і 9 кю. B — 8, 7, 6, 5 кю. C — 4, 3, 2, 1 кю і всі дани.</li>
      <li>Якщо в групі лише один боєць, організатор об’єднає його з сусідньою вручну.</li>
    </ol>
  </details>
);

/* ───────────── Додати бійців ───────────── */

const EMPTY_ROW = { full_name: '', sex: 'm', age: '', weight: '', belt: 'k10' };

const AddFighters = ({ event, onSaved }: { event: any; onSaved: (text: string) => void }) => {
  const [tab, setTab] = useState<'paste' | 'table'>('paste');
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ parsed: any[]; errors: any[] } | null>(null);
  const [rows, setRows] = useState<any[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const parse = async () => {
    setBusy(true);
    setNotice(null);
    try {
      setResult(await sg('fighters/parse', { method: 'POST', body: { text, event_id: event?.id } }));
    } catch (e) {
      setNotice({ kind: 'err', text: errorText(e) });
    }
    setBusy(false);
  };

  const bulk = async (fighters: any[], after: () => void) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await sg<{ created: any[]; skipped: number }>('fighters/bulk', { method: 'POST', body: { fighters } });
      after();
      onSaved(`Додано бійців: ${res.created.length}${res.skipped ? `, пропущено (вже були): ${res.skipped}` : ''}. Відмітьте їх нижче й подайте заявку.`);
    } catch (e) {
      setNotice({ kind: 'err', text: errorText(e) });
    }
    setBusy(false);
  };

  const saveParsed = () =>
    result &&
    bulk(
      result.parsed.map((f) => ({
        full_name: f.full_name, sex: f.sex, birth_date: f.birth_date, age_years: f.age_years,
        weight_kg: f.weight_kg, belt: f.belt,
      })),
      () => {
        setText('');
        setResult(null);
      },
    );

  const saveRows = () => {
    const filled = rows.filter((r) => r.full_name.trim() || r.age || r.weight);
    if (filled.length === 0) return setNotice({ kind: 'err', text: 'Заповніть хоча б один рядок' });
    return bulk(
      filled.map((r) => ({
        full_name: r.full_name, sex: r.sex, birth_date: null,
        age_years: r.age === '' ? null : Number(r.age), weight_kg: Number(r.weight), belt: r.belt,
      })),
      () => setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]),
    );
  };

  const setRow = (i: number, key: string, value: string) =>
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  return (
    <Card>
      <H2 n="01">Додати бійців</H2>
      <RulesInfo />
      <div className="mb-4 flex gap-2">
        {[
          { id: 'paste', label: 'Вставити список' },
          { id: 'table', label: 'Таблиця' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as 'paste' | 'table')}
            className={`${display} border px-4 py-2 text-[12px] ${tab === t.id ? 'border-[#C9A227] text-[#C9A227]' : 'border-[#242422] text-[#8a8a86] hover:text-[#F2F2F0]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'paste' && (
        <div className="space-y-3">
          <Label text="Один боєць на рядок" hint="Прізвище Ім’я, вік (або рік народження), вага, пояс — у будь-якому порядку. Пояс: 8кю, 1 дан або колір. Стать (ч/ж) додайте, якщо ім’я неоднозначне.">
            <textarea
              rows={7}
              className={inputCls}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              placeholder={'Іваненко Максим 12 38 8кю\nКоваль Софія, 10 років, 31 кг, жовтий\nПетренко Артем — 2010, 62 кг, 4 кю'}
            />
          </Label>
          <button type="button" className={btnCls('ghost')} onClick={parse} disabled={busy || !text.trim()}>Розібрати список</button>

          {result && (
            <div className="space-y-3">
              {result.errors.length > 0 && (
                <div className="space-y-1 border border-[#A3101A]/60 bg-[#A3101A]/10 p-3 text-[14px] text-[#ff9a9a]">
                  {result.errors.map((er) => (
                    <p key={er.line}><b>Рядок {er.line}:</b> {er.reason} <span className="opacity-60">— {er.raw}</span></p>
                  ))}
                  <p className="pt-1 text-[12px] opacity-80">Виправте ці рядки в тексті вище й натисніть «Розібрати список» ще раз. Без виправлення їх не буде додано.</p>
                </div>
              )}
              {result.parsed.length > 0 && (
                <div className="divide-y divide-[#242422] border-y border-[#242422]">
                  {result.parsed.map((f) => (
                    <div key={f.line} className="py-3 text-[14px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b>{f.full_name}</b>
                        <span className="flex flex-wrap items-center gap-x-2 text-[#9a9a95]">
                          <BeltDot belt={f.belt} label={beltLabel(f.belt)} />
                          {f.sex === 'm' ? 'Ч' : 'Ж'} · {f.birth_date ? ageOnDate(f.birth_date, event?.event_date || kyivToday()) : f.age_years} р. · {f.weight_kg} кг · {beltLabel(f.belt)} ({beltCategory(f.belt)})
                        </span>
                      </div>
                      <GroupLine age={f.birth_date ? ageOnDate(f.birth_date, event?.event_date || kyivToday()) : f.age_years} sex={f.sex} weight={f.weight_kg} belt={f.belt} />
                      <WarnLine warnings={f.warnings || []} />
                    </div>
                  ))}
                  <button type="button" className={btnCls()} onClick={saveParsed} disabled={busy}>Зберегти {result.parsed.length}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'table' && (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border border-[#242422] p-3 sm:grid-cols-[2fr_80px_80px_90px_1.5fr_auto]">
              <input className={`${inputCls} col-span-2 sm:col-span-1`} placeholder="Прізвище Ім’я" value={r.full_name} onChange={(e) => setRow(i, 'full_name', e.target.value)} aria-label="ПІБ" />
              <select className={inputCls} value={r.sex} onChange={(e) => setRow(i, 'sex', e.target.value)} aria-label="Стать">
                <option value="m">Ч</option>
                <option value="f">Ж</option>
              </select>
              <input className={inputCls} type="number" inputMode="numeric" min={4} max={60} placeholder="Вік" value={r.age} onChange={(e) => setRow(i, 'age', e.target.value)} aria-label="Вік" />
              <input className={inputCls} type="number" inputMode="decimal" step="0.1" min={15} max={150} placeholder="Вага" value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} aria-label="Вага, кг" />
              <select className={inputCls} value={r.belt} onChange={(e) => setRow(i, 'belt', e.target.value)} aria-label="Пояс">
                {BELT_CODES.map((b) => <option key={b} value={b}>{BELT_LABELS[b]}</option>)}
              </select>
              <button type="button" className="px-2 text-[#85857f] hover:text-[#ff6b6b]" onClick={() => setRows((l) => l.filter((_, idx) => idx !== i))} aria-label="Прибрати рядок">✕</button>
              <div className="col-span-full">
                <GroupLine age={r.age === '' ? null : Number(r.age)} sex={r.sex} weight={r.weight === '' ? null : Number(r.weight)} belt={r.belt} />
                <WarnLine warnings={plausibilityWarnings({ age: r.age === '' ? null : Number(r.age), weight_kg: r.weight === '' ? null : Number(r.weight), belt: r.belt })} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={btnCls('ghost')} onClick={() => setRows((l) => [...l, { ...EMPTY_ROW }])}>+ Рядок</button>
            <button type="button" className={btnCls()} onClick={saveRows} disabled={busy}>Зберегти</button>
          </div>
        </div>
      )}

      <div className="mt-4"><NoticeBox notice={notice} /></div>
    </Card>
  );
};

/* ───────────── Сторінка ───────────── */

export default function CabinetPage() {
  usePageSetup('Кабінет');
  const navigate = useNavigate();
  const { me, logout, inTelegram } = useSession();
  const [cab, setCab] = useState<any | null>(null);
  const [fighters, setFighters] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [repeatFrom, setRepeatFrom] = useState('');
  const [fBlock, setFBlock] = useState('');
  const [fCat, setFCat] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fQuery, setFQuery] = useState('');
  const [acceptOffer, setAcceptOffer] = useState(false);

  useEffect(() => {
    if (!me) return;
    if (!me.authenticated || me.needs_profile) navigate('/shin-gi/register', { replace: true });
  }, [me, navigate]);

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([sg('cabinet'), sg('fighters')]);
      setCab(c);
      setFighters(f.fighters);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.code === 'profile_incomplete')) navigate('/shin-gi/register', { replace: true });
      else setNotice({ kind: 'err', text: errorText(e) });
    }
  }, [navigate]);

  useEffect(() => {
    if (me?.authenticated && !me.needs_profile) load();
  }, [me, load]);

  // повернення з банку: ?pay=<reference> — одразу питаємо статус, не чекаючи вебхука
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('pay');
    if (!reference || !me?.authenticated || me.needs_profile) return;
    sg<{ status: string }>(`pay/status?reference=${encodeURIComponent(reference)}`)
      .then(async (r) => {
        await load();
        setNotice(
          r.status === 'success'
            ? { kind: 'ok', text: 'Оплату отримано, дякуємо! Бійців позначено як оплачених.' }
            : r.status === 'processing' || r.status === 'created'
              ? { kind: 'ok', text: 'Оплата ще обробляється. Оновіть сторінку за хвилину.' }
              : { kind: 'err', text: 'Оплата не пройшла. Спробуйте ще раз або сплатіть готівкою організатору.' },
        );
        window.history.replaceState(null, '', window.location.pathname);
      })
      .catch(() => undefined);
  }, [me, load]);

  const event = cab?.event;
  const entryOf = useMemo(() => new Map<number, any>((cab?.entries || []).map((e: any) => [e.fighter_id, e])), [cab]);
  const registrationOpen = Boolean(event && event.status === 'registration' && (!event.deadline_apps || kyivToday() <= event.deadline_apps));

  const ageOf = (f: any) => (event ? (f.birth_date ? ageOnDate(f.birth_date, event.event_date) : f.age_years) : f.age_years);
  const isActive = (f: any) => ['submitted', 'paid', 'fought'].includes(entryOf.get(f.id)?.status);
  const visibleFighters = fighters.filter((f) => {
    const age = ageOf(f);
    const block = entryOf.get(f.id)?.block ?? (age === null ? '' : resolveBlock(age, openIds.has(f.id)));
    return (
      (!fBlock || block === fBlock) &&
      (!fCat || beltCat(f.belt) === fCat) &&
      (!fStatus || (fStatus === 'active' ? isActive(f) : !isActive(f))) &&
      (!fQuery || String(f.full_name).toLowerCase().includes(fQuery.toLowerCase()))
    );
  });

  const toggle = (set: Set<number>, id: number, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id); else next.delete(id);
    return next;
  };

  const submit = async () => {
    if (!event || selected.size === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const ids = [...selected];
      const res = await sg<{ sum_due_uah: number }>('entries', {
        method: 'POST',
        body: { event_id: event.id, fighter_ids: ids, block_override_ids: ids.filter((id) => openIds.has(id)) },
      });
      setSelected(new Set());
      await load();
      setNotice({ kind: 'ok', text: `Заявку подано: ${ids.length} бійців. До дедлайну внеску потрібно сплатити ${fmtMoney(res.sum_due_uah)}.` });
    } catch (e) {
      setNotice({ kind: 'err', text: errorText(e) });
    }
    setBusy(false);
  };

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    setNotice(null);
    try {
      await fn();
      await load();
      if (okText) setNotice({ kind: 'ok', text: okText });
    } catch (e) {
      setNotice({ kind: 'err', text: errorText(e) });
    }
  };

  const payByCard = async () => {
    if (!event) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await sg<{ page_url: string }>('pay/invoice', { method: 'POST', body: { event_id: event.id, accept_offer: true } });
      const tg = window.Telegram?.WebApp;
      if (tg?.openLink) tg.openLink(res.page_url);
      else window.location.href = res.page_url;
    } catch (e) {
      setNotice({ kind: 'err', text: errorText(e) });
    }
    setBusy(false);
  };

  const withdraw = (entry: any) => run(() => sg(`entries/${entry.id}`, { method: 'DELETE' }), 'Бійця знято із заявки');
  const removeFighter = (f: any) => {
    if (window.confirm(`Видалити ${f.full_name} зі списку?`)) run(() => sg(`fighters/${f.id}`, { method: 'DELETE' }), 'Бійця видалено');
  };
  const patchFighter = (f: any, body: Record<string, unknown>) => run(() => sg(`fighters/${f.id}`, { method: 'PUT', body }));

  const repeat = () =>
    run(() => sg('entries/repeat', { method: 'POST', body: { event_id: event.id, from_event_id: Number(repeatFrom) } }), 'Склад повторено як чернетку — перевірте і подайте заявку');

  const sendQuestion = () =>
    run(async () => {
      await sg('question', { method: 'POST', body: { text: question } });
      setQuestion('');
    }, 'Питання надіслано організаторам');

  if (!me || !cab) {
    return <Shell><Spinner /></Shell>;
  }

  const profile = cab.profile;
  const totals = cab.totals;
  const activeCount = fighters.filter((f) => ['submitted', 'paid', 'fought'].includes(entryOf.get(f.id)?.status)).length;
  const hasGroups = (cab.entries || []).some((e: any) => e.group_key);
  const blockTime = (block: string) => event?.schedule_json?.[block] || '—';
  // кроки: 0 Вхід, 1 Анкета (вже пройдені) → 2 Бійці → 3 Заявка → 4 все готово
  const step = fighters.length === 0 ? 2 : activeCount === 0 ? 3 : 4;
  const daysToApps = cab.counters?.days_to?.apps;

  return (
    <Shell
      right={
        <div className="flex items-center gap-3 text-[13px]">
          <span className="hidden text-[#8a8a86] sm:inline">{profile?.club}</span>
          {inTelegram ? (
            <button className={btnCls('ghost')} onClick={() => window.Telegram?.WebApp?.close?.()}>Закрити</button>
          ) : (
            <button className={btnCls('ghost')} onClick={logout}>Вийти</button>
          )}
        </div>
      }
    >
      <NoticeBox notice={notice} />

      {!event ? (
        <Card><p className="text-[#b9b9b4]">Найближчих подій поки немає. Ми повідомимо, коли оголосимо дату.</p></Card>
      ) : (
        <Card className="!p-5 sm:!p-8">
          <Stepper steps={['Вхід', 'Анкета', 'Бійці', 'Заявка']} current={step} />
          <div className="mt-7 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`${display} flex items-center gap-3 text-[12px] text-[#C9A227]`}>
                <span className="h-[2px] w-9 bg-[#A3101A]" />
                {event.title}
              </p>
              <h1 className={`${display} mt-3 text-[40px] font-bold leading-none sm:text-[64px]`}>{fmtDate(event.event_date)}</h1>
            </div>
            {event.status === 'registration' ? <Badge tone="green">Реєстрація відкрита</Badge>
              : event.status === 'groups_published' ? <Badge tone="gold">Групи опубліковані</Badge>
              : event.status === 'announced' ? <Badge tone="gold">Реєстрація ще не відкрита</Badge>
              : <Badge tone="grey">{event.status}</Badge>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip strong={fmtMoney(event.fee_uah)}>за бійця</Chip>
            <Chip strong={`Kids ${blockTime('kids')}`} />
            <Chip strong={`Open ${blockTime('open')}`} />
            {registrationOpen && typeof daysToApps === 'number' && daysToApps >= 0 && (
              <Chip strong={daysToApps === 0 ? 'Сьогодні' : `${daysToApps} дн.`}>до кінця подачі заявок</Chip>
            )}
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-[#242422] pt-5 text-[14px] sm:grid-cols-2">
            <div><dt className="text-[#85857f]">Заявки до</dt><dd>{fmtDate(event.deadline_apps)}</dd></div>
            <div><dt className="text-[#85857f]">Внесок до</dt><dd>{fmtDate(event.deadline_pay)}</dd></div>
            <div><dt className="text-[#85857f]">Групи публікуємо</dt><dd>{fmtDate(event.groups_publish_date)}</dd></div>
            <div><dt className="text-[#85857f]">Блоки</dt><dd>Kids о {blockTime('kids')} · Open о {blockTime('open')}</dd></div>
            <div>
              <dt className="text-[#85857f]">Адреса</dt>
              <dd>
                <a className="text-[#C9A227] underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address || '')}`}>{event.address}</a>
              </dd>
            </div>
          </dl>
          {!registrationOpen && event.status !== 'groups_published' && (
            <p className="mt-4 border border-[#242422] p-3 text-[14px] text-[#b9b9b4]">
              {event.status === 'registration' ? 'Дедлайн подачі заявок минув — зверніться до організаторів.' : 'Реєстрація ще не відкрита. Ви можете вже підготувати список бійців — подати заявку вдасться, коли відкриємо.'}
            </p>
          )}
        </Card>
      )}

      {hasGroups && (
        <Card>
          <H2>Ваші групи</H2>
          <div className="space-y-2">
            {cab.entries.filter((e: any) => e.group_key).map((e: any) => (
              <div key={e.id} className="border border-[#242422] p-3 text-[14px]">
                <b>{e.full_name}</b> — {groupLabel(e.group_key)} <span className="text-[#85857f]">(у групі: {e.group_size})</span>
                <p className="text-[12px] text-[#9a9a95]">Блок {e.block === 'kids' ? 'Kids' : 'Open'} о {blockTime(e.block)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AddFighters
        event={event}
        onSaved={async (text) => {
          await load();
          setNotice({ kind: 'ok', text });
        }}
      />

      {cab.history?.length > 0 && event && registrationOpen && (
        <Card>
          <H2>Повторити склад</H2>
          <div className="flex flex-wrap items-end gap-3">
            <Label text="З якої події">
              <select className={inputCls} value={repeatFrom} onChange={(e) => setRepeatFrom(e.target.value)}>
                <option value="">Оберіть…</option>
                {cab.history.map((h: any) => <option key={h.event_id} value={h.event_id}>{h.title} · {fmtDate(h.event_date)} ({h.fighters})</option>)}
              </select>
            </Label>
            <button className={btnCls('ghost')} disabled={!repeatFrom} onClick={repeat}>Повторити</button>
          </div>
        </Card>
      )}

      <Card>
        <H2 n="02">Мої бійці ({fighters.length})</H2>
        {fighters.length === 0 && <p className="text-[#9a9a95]">Поки нікого немає. Додайте бійців вище.</p>}
        {fighters.length > 0 && (
          <>
            <div className="mb-2 grid gap-2 sm:grid-cols-4">
              <select className={inputCls} value={fBlock} onChange={(e) => setFBlock(e.target.value)} aria-label="Блок">
                <option value="">Усі блоки</option>
                <option value="kids">Kids</option>
                <option value="open">Open</option>
              </select>
              <select className={inputCls} value={fCat} onChange={(e) => setFCat(e.target.value)} aria-label="Категорія пояса">
                <option value="">Усі категорії</option>
                <option value="A">A · білий, 10–9 кю</option>
                <option value="B">B · 8–5 кю</option>
                <option value="C">C · 4–1 кю, дани</option>
              </select>
              <select className={inputCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Статус">
                <option value="">Усі статуси</option>
                <option value="active">У заявці</option>
                <option value="pending">Не подані</option>
              </select>
              <input className={inputCls} value={fQuery} onChange={(e) => setFQuery(e.target.value)} placeholder="Пошук за ПІБ" aria-label="Пошук" />
            </div>
            <p className="mb-3 text-[12px] text-[#85857f]">Показано {visibleFighters.length} з {fighters.length}</p>
          </>
        )}
        <div className="divide-y divide-[#242422] border-y border-[#242422]">
          {visibleFighters.map((f) => {
            const entry = entryOf.get(f.id);
            const active = entry && ['submitted', 'paid', 'fought'].includes(entry.status);
            const age = ageOf(f);
            const canPick = registrationOpen && !active;
            return (
              <div key={f.id} className={`py-4 ${selected.has(f.id) ? 'bg-[#C9A227]/[0.04]' : ''}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1.5 h-4 w-4 accent-[#A3101A]"
                    disabled={!canPick}
                    checked={selected.has(f.id)}
                    onChange={(e) => setSelected((s) => toggle(s, f.id, e.target.checked))}
                    aria-label={`Обрати ${f.full_name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{f.full_name}</b>
                      {entry && <Badge tone={ENTRY_TONE[entry.status]}>{ENTRY_LABEL[entry.status]}</Badge>}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#9a9a95]">
                      <BeltDot belt={f.belt} label={beltLabel(f.belt)} />
                      <span>{beltLabel(f.belt)} · кат. {beltCategory(f.belt)}</span>
                      <span className="text-[#3a3a37]">|</span>
                      <span>{f.sex === 'm' ? 'Ч' : 'Ж'} · {age ?? '?'} р.</span>
                      <span className="text-[#3a3a37]">|</span>
                      <span>блок {entry ? (entry.block === 'kids' ? 'Kids' : 'Open') : age !== null && age >= 18 ? 'Open' : 'Kids'}</span>
                    </p>
                    <GroupLine age={age} sex={f.sex} weight={f.weight_kg} belt={f.belt} override={Boolean(entry?.block_override) || openIds.has(f.id)} />
                    <WarnLine warnings={plausibilityWarnings({ age, weight_kg: f.weight_kg, belt: f.belt })} />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        key={`${f.id}-${f.weight_kg}`}
                        className={`${inputCls} !w-24 !py-1.5`}
                        type="number" step="0.1" min={15} max={150} defaultValue={f.weight_kg ?? ''}
                        disabled={Boolean(active && entry.status !== 'submitted')}
                        aria-label="Вага, кг"
                        onBlur={(e) => { const v = Number(e.target.value); if (v && v !== f.weight_kg) patchFighter(f, { weight_kg: v }); }}
                      />
                      <span className="text-[12px] text-[#85857f]">кг</span>
                      <select
                        className={`${inputCls} !w-auto !py-1.5`}
                        value={f.belt}
                        disabled={Boolean(active && entry.status !== 'submitted')}
                        onChange={(e) => patchFighter(f, { belt: e.target.value })}
                        aria-label="Пояс"
                      >
                        {BELT_CODES.map((b) => <option key={b} value={b}>{BELT_LABELS[b]}</option>)}
                      </select>
                    </div>
                    {canPick && selected.has(f.id) && age !== null && age >= 14 && age <= 17 && (
                      <label className="mt-2 flex items-center gap-2 text-[13px] text-[#b9b9b4]">
                        <input type="checkbox" className="accent-[#A3101A]" checked={openIds.has(f.id)} onChange={(e) => setOpenIds((s) => toggle(s, f.id, e.target.checked))} />
                        Заявити в Open (за замовчуванням 14–17 — Kids)
                      </label>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[12px]">
                    {entry && ['draft', 'submitted'].includes(entry.status) && (
                      <button className="text-[#C9A227] hover:underline" onClick={() => withdraw(entry)}>Зняти</button>
                    )}
                    {!active && <button className="text-[#85857f] hover:text-[#ff6b6b]" onClick={() => removeFighter(f)}>Видалити</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {fighters.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={btnCls()} disabled={busy || selected.size === 0 || !registrationOpen} onClick={submit}>
              Подати заявку{selected.size ? ` (${selected.size})` : ''}
            </button>
            {fighters.some((f) => registrationOpen && !['submitted', 'paid', 'fought'].includes(entryOf.get(f.id)?.status)) && (
              <button
                className={btnCls('ghost')}
                onClick={() => setSelected(new Set(visibleFighters.filter((f) => !isActive(f)).map((f) => f.id)))}
                disabled={!registrationOpen}
              >
                Обрати показаних
              </button>
            )}
          </div>
        )}
      </Card>

      {event && (
        <Card>
          <H2 n="03">Внесок</H2>
          <p className="text-[15px]">
            У заявці: <b>{totals.fighters}</b> · оплачено: <b>{totals.paid}</b> · очікує оплати: <b>{totals.unpaid}</b>
          </p>
          <div className="mt-3 space-y-3">
            {totals.unpaid > 0 && (
              <div className="border border-[#242422] p-3 text-[14px]">
                <p className="flex justify-between gap-3"><span>Внесок за {totals.unpaid} бійц.</span><b>{fmtMoney(totals.sum_due_uah)}</b></p>
                {totals.card_fee_uah > 0 && (
                  <p className="flex justify-between gap-3 text-[#b9b9b4]">
                    <span>Комісія банку за оплату карткою ({totals.card_fee_percent}%)</span><span>{fmtMoney(totals.card_fee_uah)}</span>
                  </p>
                )}
                <p className="mt-1 flex justify-between gap-3 border-t border-[#242422] pt-1 text-[16px]">
                  <span>До сплати карткою</span><b>{fmtMoney(totals.card_total_uah)}</b>
                </p>
              </div>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-relaxed text-[#b9b9b4]">
              <input type="checkbox" className="mt-1" checked={acceptOffer} onChange={(e) => setAcceptOffer(e.target.checked)} />
              <span>
                Погоджуюсь з <a className="text-[#C9A227] underline" href="/shin-gi/offer" target="_blank" rel="noopener">умовами публічної оферти</a>,
                зокрема з тим, що комісію банку за онлайн-оплату сплачує платник.
              </span>
            </label>
            <button className={btnCls()} disabled={busy || !cab.payments_open || totals.unpaid === 0 || !acceptOffer} onClick={payByCard}>
              {totals.unpaid > 0 ? `Сплатити карткою — ${fmtMoney(totals.card_total_uah)}` : 'Немає що сплачувати'}
            </button>
            <p className="text-[13px] text-[#85857f]">
              {cab.payments_open
                ? 'Готівкою — без комісії: передайте внесок організатору, він відмітить оплату в системі.'
                : 'Онлайн-оплата зараз недоступна. Внесок можна передати готівкою організатору, він відмітить оплату в системі.'}
            </p>
          </div>
          {cab.payments?.length > 0 && (
            <div className="mt-4 space-y-1 text-[14px]">
              {cab.payments.map((p: any) => (
                <p key={p.id}>
                  {fmtMoney(p.amount_uah)} · {p.provider === 'cash' ? 'готівка' : 'картка'} —{' '}
                  <span className="text-[#9a9a95]">{PAY_STATUS_LABEL[p.status] || p.status}</span>
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <H2>Статистика клубу</H2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="border border-[#242422] p-3"><p className={`${display} text-[26px]`}>{cab.club_stats?.fighters_total ?? 0}</p><p className="text-[12px] text-[#8a8a86]">у списку</p></div>
          <div className="border border-[#242422] p-3"><p className={`${display} text-[26px]`}>{activeCount}</p><p className="text-[12px] text-[#8a8a86]">у заявці</p></div>
          <div className="border border-[#242422] p-3"><p className={`${display} text-[26px]`}>{cab.club_stats?.repeat_fighters ?? 0}</p><p className="text-[12px] text-[#8a8a86]">повторних</p></div>
        </div>
        <p className="mt-3 text-[14px] text-[#9a9a95]">
          Категорії поясів у заявці: A — {cab.club_stats?.by_category?.A ?? 0} · B — {cab.club_stats?.by_category?.B ?? 0} · C — {cab.club_stats?.by_category?.C ?? 0}
        </p>
        {cab.history?.length > 0 && (
          <div className="mt-4 space-y-1 text-[14px]">
            <p className="text-[#85857f]">Історія участі</p>
            {cab.history.map((h: any) => <p key={h.event_id}>{h.title} · {fmtDate(h.event_date)} — {h.fighters} бійців</p>)}
          </div>
        )}
      </Card>

      <Card>
        <H2>Питання організаторам</H2>
        <textarea className={inputCls} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Напишіть питання — відповімо в Telegram" />
        <div className="mt-3"><button className={btnCls('ghost')} disabled={!question.trim()} onClick={sendQuestion}>Надіслати</button></div>
      </Card>

      {selected.size > 0 && event && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[#C9A227]/40 bg-[#0A0A0A]/95 px-4 pt-3 backdrop-blur"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="text-[14px]">
              Обрано: <b className={`${display} text-[16px] text-[#C9A227]`}>{selected.size}</b>
              <span className="text-[#8a8a86]"> · внесок {fmtMoney(selected.size * event.fee_uah)}</span>
            </p>
            <div className="flex gap-2">
              <button className={btnCls('ghost')} onClick={() => setSelected(new Set())}>Скасувати</button>
              <button className={btnCls()} disabled={busy || !registrationOpen} onClick={submit}>Подати заявку</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

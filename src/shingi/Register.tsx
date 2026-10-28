import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorText, sg } from './api';
import { BOT_USERNAME, Card, Chip, H2, Label, Shell, Spinner, Stepper, TelegramLogin, btnCls, display, inputCls, usePageSetup, useSession } from './ui';

const STEPS = ['Вхід', 'Анкета', 'Бійці', 'Заявка'];

const FEDERATIONS = ['WKO Shinkyokushinkai', 'IKO', 'IFK', 'KWU', 'Kyokushin-kan', 'Інша'];

export default function RegisterPage() {
  usePageSetup('Реєстрація');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { me, error, inTelegram, reload, loginWithWidget } = useSession();
  const roleParam = params.get('role') === 'solo' ? 'solo' : params.get('role') === 'coach' ? 'coach' : '';
  const [form, setForm] = useState({
    role: roleParam || 'coach',
    federation: '',
    club: '',
    city: 'Київ',
    coach_full_name: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!me?.authenticated) return;
    if (!me.needs_profile) {
      navigate('/shin-gi/cabinet', { replace: true });
      return;
    }
    const p = me.profile;
    if (p) {
      setForm((f) => ({
        ...f,
        role: roleParam || p.role || f.role,
        federation: p.federation || f.federation,
        club: p.club || f.club,
        city: p.city || f.city,
        coach_full_name: p.coach_full_name || f.coach_full_name,
        phone: p.phone || f.phone,
      }));
    }
  }, [me, navigate, roleParam]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const solo = form.role === 'solo';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (form.coach_full_name.trim().split(/\s+/).length < 2) {
      setFormError('Вкажіть прізвище та ім’я тренера');
      return;
    }
    setSaving(true);
    try {
      await sg('profile', { method: 'PUT', body: form });
      await reload();
      navigate('/shin-gi/cabinet', { replace: true });
    } catch (err) {
      setFormError(errorText(err));
    }
    setSaving(false);
  };

  if (!me) return <Shell><Spinner /></Shell>;

  if (!me.authenticated) {
    return (
      <Shell>
        <Card className="!p-5 sm:!p-8">
          <Stepper steps={STEPS} current={0} />
          <p className={`${display} mt-8 flex items-center gap-3 text-[12px] text-[#C9A227]`}>
            <span className="h-[2px] w-9 bg-[#A3101A]" />
            Kyokushin Open · Київ
          </p>
          <h1 className={`${display} mt-3 text-[44px] font-bold leading-[0.95] sm:text-[72px]`}>
            Заявка <br />
            на <span className="text-[#A3101A]">SHIN GI</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#b9b9b4]">
            Спаринг-день у залі-сховищі на Шулявці: діти до 18 і дорослі 14+/18+. Увійдіть через Telegram — паролі не потрібні.
            Далі коротка анкета, і список бійців можна вставити одним повідомленням.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip strong="400 грн">за бійця</Chip>
            <Chip strong="Kids + Open" />
            <Chip strong="Медаль і грамота">кожному</Chip>
          </div>
          <div className="mt-8">
            {inTelegram && !error ? (
              <p className="text-[#b9b9b4]">Входимо через Telegram…</p>
            ) : (
              <>
                <a
                  className={`${btnCls()} !bg-[#229ED9] !border-[#229ED9] hover:!bg-[#1b8fc6] w-full sm:w-auto !px-7 !py-4 !text-[15px]`}
                  href={`https://t.me/${BOT_USERNAME}?start=${solo ? 'solo' : 'team'}`}
                >
                  Відкрити в Telegram →
                </a>
                <p className="mt-3 max-w-md text-[13px] leading-relaxed text-[#85857f]">
                  Бот відкриє заявку одним дотиком: без паролів і кодів. Натисніть «Start», потім кнопку під повідомленням.
                </p>
                <details className="mt-6 text-[13px] text-[#85857f]">
                  <summary className="cursor-pointer select-none hover:text-[#C9A227]">Я за комп’ютером — увійти через віджет</summary>
                  <div className="mt-3">
                    <TelegramLogin onAuth={loginWithWidget} />
                  </div>
                </details>
              </>
            )}
          </div>
          {error && <p className="mt-4 border border-[#A3101A]/60 bg-[#A3101A]/10 p-3 text-[14px] text-[#ff9a9a]">{error}</p>}
          <p className="mt-6 text-[13px] text-[#85857f]">
            Немає Telegram? Напишіть організатору{' '}
            <a className="text-[#C9A227] underline" href="https://t.me/ihorkot">@ihorkot</a> — створимо команду вручну.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={save} className="space-y-5">
        <Stepper steps={STEPS} current={1} />
        <Card>
          <H2 n="01">Хто ви?</H2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: 'coach', title: 'Я тренер', text: 'Реєструю команду і плачу внесок за всіх' },
              { id: 'solo', title: 'Я боєць', text: 'Реєструюсь сам (або за свою дитину)' },
            ].map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => set('role', r.id)}
                className={`border p-4 text-left transition-colors ${
                  form.role === r.id ? 'border-[#C9A227] bg-[#C9A227]/5' : 'border-[#242422] hover:border-[#5a5a57]'
                }`}
              >
                <span className={`${display} block text-[16px] font-semibold`}>{r.title}</span>
                <span className="mt-1 block text-[14px] text-[#9a9a95]">{r.text}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <H2 n="02">Анкета</H2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Федерація">
              <input className={inputCls} list="shingi-feds" value={form.federation} onChange={(e) => set('federation', e.target.value)} placeholder="Оберіть або впишіть" />
              <datalist id="shingi-feds">{FEDERATIONS.map((f) => <option key={f} value={f} />)}</datalist>
            </Label>
            <Label text={solo ? 'Клуб (або «Без клубу»)' : 'Клуб *'}>
              <input className={inputCls} required value={form.club} onChange={(e) => set('club', e.target.value)} />
            </Label>
            <Label text="Місто">
              <input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Label>
            <Label text="Телефон" hint="Для зв’язку організаторів">
              <input className={inputCls} inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+380…" />
            </Label>
            <div className="sm:col-span-2">
              <Label
                text={solo ? 'ПІБ вашого тренера (або ваш, якщо тренуєтесь самі) *' : 'ПІБ тренера *'}
                hint={solo ? 'Свої дані як бійця (вік, вага, пояс) додасте на наступному кроці — там же дані батьків, якщо вам ще немає 18.' : 'Батьки, які реєструють дитину, вказують ПІБ її тренера.'}
              >
                <input className={inputCls} required value={form.coach_full_name} onChange={(e) => set('coach_full_name', e.target.value)} placeholder="Прізвище Ім’я" />
              </Label>
            </div>
          </div>
          {formError && <p className="mt-4 border border-[#A3101A]/60 bg-[#A3101A]/10 p-3 text-[14px] text-[#ff9a9a]">{formError}</p>}
          <div className="mt-5">
            <button className={btnCls()} disabled={saving} type="submit">{saving ? 'Зберігаємо…' : 'Далі — додати бійців'}</button>
          </div>
        </Card>
      </form>
    </Shell>
  );
}

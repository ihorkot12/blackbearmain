import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Info,
  Mail,
  MapPin,
  Phone,
  Plus,
  Send,
  Shield,
  Trash2,
  User,
  Users
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Button } from './components/Button';
import { toast } from 'sonner';
import SEO from './components/SEO';

type RegistrationType = 'parent_child' | 'adult';

type ParticipantDraft = {
  name: string;
  age: string;
  birthday: string;
  location_id: string;
  coach_id: string;
  group_id: string;
  belt: string;
};

type RegistrationResult = {
  login: string;
  password: string;
  telegramConnectUrl?: string | null;
};

const beltOptions = [
  'Білий',
  'Оранжевий',
  'Оранжевий з синьою смужкою',
  'Синій',
  'Синій з жовтою смужкою',
  'Жовтий',
  'Жовтий з зеленою смужкою',
  'Зелений',
  'Зелений з коричневою смужкою',
  'Коричневий',
  'Коричневий з чорною смужкою',
  'Чорний'
];

const createParticipant = (): ParticipantDraft => ({
  name: '',
  age: '',
  birthday: '',
  location_id: '',
  coach_id: '',
  group_id: '',
  belt: 'Білий'
});

export const RegisterMember = () => {
  const [registrationType, setRegistrationType] = useState<RegistrationType>('parent_child');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [accountInfo, setAccountInfo] = useState({
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    password: '',
    confirmPassword: '',
    telegram_opt_in: false
  });

  const [participants, setParticipants] = useState<ParticipantDraft[]>([createParticipant()]);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);

  const isAdult = registrationType === 'adult';

  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          setLocations(Array.isArray(data.locations) ? data.locations : []);
          setCoaches(Array.isArray(data.coaches) ? data.coaches : []);
        }
      })
      .catch(() => toast.error('Не вдалося завантажити групи. Можна спробувати ще раз.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdult && participants.length > 1) {
      setParticipants([participants[0]]);
    }
  }, [isAdult, participants]);

  const copy = useMemo(() => {
    if (isAdult) {
      return {
        title: 'Реєстрація дорослого учасника',
        subtitle: 'Створіть акаунт для себе. Логіном буде ваш номер телефону, пароль ви задаєте самостійно.',
        participantHeading: 'Учасник клубу',
        participantName: 'ПІБ учасника',
        participantPlaceholder: 'Іванов Іван',
        contactHeading: 'Контакти для входу',
        phoneLabel: 'Телефон для входу',
        emailLabel: 'Email учасника',
        submit: 'Зареєструватись як учасник'
      };
    }

    return {
      title: 'Реєстрація дитини в клуб',
      subtitle: 'Батьки створюють один акаунт для себе і можуть додати одну або кілька дітей.',
      participantHeading: 'Дитина',
      participantName: 'ПІБ дитини',
      participantPlaceholder: 'Іванов Іван Іванович',
      contactHeading: 'Контакти батьків',
      phoneLabel: 'Телефон батьків для входу',
      emailLabel: 'Email батьків',
      submit: 'Зареєструвати дитину'
    };
  }, [isAdult]);

  const getFilteredGroups = (locationId: string, coachId: string) => {
    return groups.filter(group => {
      const matchLocation = !locationId || Number(group.location_id) === Number(locationId);
      const matchCoach = !coachId || Number(group.coach_id) === Number(coachId);
      return matchLocation && matchCoach;
    });
  };

  const updateParticipant = (index: number, field: keyof ParticipantDraft, value: string) => {
    setParticipants(current => current.map((participant, i) => {
      if (i !== index) return participant;
      const next = { ...participant, [field]: value };
      if (field === 'location_id' || field === 'coach_id') {
        next.group_id = '';
      }
      return next;
    }));
  };

  const addParticipant = () => {
    setParticipants(current => [...current, createParticipant()]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(current => current.length > 1 ? current.filter((_, i) => i !== index) : current);
  };

  const switchType = (type: RegistrationType) => {
    setRegistrationType(type);
    if (type === 'adult') {
      setParticipants(current => [current[0] || createParticipant()]);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast.error('Не вдалося скопіювати');
    }
  };

  const resetForm = () => {
    setIsSubmitted(false);
    setRegistrationResult(null);
    setRegistrationType('parent_child');
    setParticipants([createParticipant()]);
    setAccountInfo({
      parent_name: '',
      parent_phone: '',
      parent_email: '',
      password: '',
      confirmPassword: '',
      telegram_opt_in: false
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = accountInfo.parent_email.trim().toLowerCase();
    const phone = accountInfo.parent_phone.trim();
    const members = isAdult ? [participants[0]] : participants;

    if (!phone) {
      toast.error('Вкажіть телефон для входу');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Вкажіть коректний email');
      return;
    }

    if (accountInfo.password.length < 4) {
      toast.error('Пароль має бути мінімум 4 символи');
      return;
    }

    if (accountInfo.password !== accountInfo.confirmPassword) {
      toast.error('Паролі не співпадають');
      return;
    }

    if (!isAdult && !accountInfo.parent_name.trim()) {
      toast.error('Вкажіть ПІБ одного з батьків');
      return;
    }

    if (members.some(member => !member.name.trim())) {
      toast.error(isAdult ? 'Вкажіть ПІБ учасника' : 'Вкажіть ПІБ кожної дитини');
      return;
    }

    setIsSubmitting(true);

    try {
      const adultName = members[0]?.name.trim();
      const res = await fetch('/api/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_type: registrationType,
          children: members.map(member => ({
            ...member,
            name: member.name.trim(),
            age: member.age ? Number(member.age) : null,
            group_id: member.group_id || null
          })),
          parent_name: isAdult ? adultName : accountInfo.parent_name.trim(),
          parent_phone: phone,
          parent_email: email,
          password: accountInfo.password,
          telegram_opt_in: accountInfo.telegram_opt_in
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || 'Не вдалося зберегти реєстрацію');
        return;
      }

      const result = {
        login: data.login || phone,
        password: accountInfo.password,
        telegramConnectUrl: data.telegramConnectUrl
      };
      setRegistrationResult(result);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (result.telegramConnectUrl) {
        toast.success('Реєстрацію збережено. Зараз відкриємо Telegram-бот.');
        setTimeout(() => {
          window.location.href = result.telegramConnectUrl as string;
        }, 1100);
      } else {
        toast.success('Реєстрацію збережено');
      }
    } catch (err) {
      console.error('Registration failed', err);
      toast.error('Помилка мережі. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSubmitted && registrationResult) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <SEO title="Реєстрацію завершено" description="Реєстрацію члена клубу Black Bear Dojo завершено." />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(209,0,0,0.45)]">
            <CheckCircle2 size={48} className="text-white" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black uppercase tracking-tight">Реєстрацію завершено</h1>
            <p className="text-zinc-400">
              Акаунт створено. Логін для входу в кабінет: номер телефону у форматі нижче.
            </p>
          </div>

          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 text-left">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Логін</p>
              <div className="flex items-center justify-between gap-3 bg-black rounded-2xl p-4 border border-white/5">
                <code className="text-red-500 font-bold break-all">{registrationResult.login}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(registrationResult.login, 'login')}
                  className="text-zinc-500 hover:text-white transition-colors shrink-0"
                  aria-label="Скопіювати логін"
                >
                  {copiedField === 'login' ? <CheckCircle2 size={18} className="text-green-500" /> : <Info size={18} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Пароль той, який ви щойно вказали у формі. Його можна змінити через адміна або тренера.
            </p>
          </div>

          {registrationResult.telegramConnectUrl && (
            <div className="bg-red-600/10 border border-red-600/20 rounded-3xl p-5 text-left">
              <p className="text-sm text-zinc-200 font-bold mb-2">Telegram-підключення</p>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Якщо Telegram не відкрився автоматично, натисніть кнопку. Бот підключить цей акаунт до сповіщень.
              </p>
              <a
                href={registrationResult.telegramConnectUrl}
                className="h-12 px-5 bg-red-600 hover:bg-red-700 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Відкрити Telegram
              </a>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Button variant="primary" onClick={() => window.location.href = '/parent'} showIcon={false}>
              Увійти в кабінет
            </Button>
            <Button variant="secondary" onClick={resetForm} showIcon={false}>
              Нова реєстрація
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = '/'} showIcon={false}>
              На головну
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-600 selection:text-white">
      <SEO
        title="Реєстрація члена клубу"
        description="Реєстрація дитини або дорослого учасника Black Bear Dojo з особистим кабінетом."
      />
      <Navbar />

      <main className="pt-28 md:pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.25em] mb-6"
            >
              <Shield size={12} />
              Реєстрація
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-5">{copy.title}</h1>
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">{copy.subtitle}</p>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onSubmit={handleSubmit}
            className="space-y-8 md:space-y-10"
          >
            <section className="grid md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => switchType('parent_child')}
                className={`text-left rounded-3xl border p-6 transition-all ${
                  !isAdult ? 'bg-red-600/10 border-red-600/60' : 'bg-zinc-900/70 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Users className={!isAdult ? 'text-red-500' : 'text-zinc-500'} size={22} />
                  <span className="text-sm font-black uppercase tracking-widest">Батьки + дитина</span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Один батьківський акаунт, у якому можна бачити відвідування, оплату, бали й прогрес дітей.
                </p>
              </button>

              <button
                type="button"
                onClick={() => switchType('adult')}
                className={`text-left rounded-3xl border p-6 transition-all ${
                  isAdult ? 'bg-red-600/10 border-red-600/60' : 'bg-zinc-900/70 border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <User className={isAdult ? 'text-red-500' : 'text-zinc-500'} size={22} />
                  <span className="text-sm font-black uppercase tracking-widest">Дорослий учасник</span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Акаунт створюється напряму для учасника. Вхід: телефон і пароль.
                </p>
              </button>
            </section>

            <div className="space-y-8">
              {participants.map((participant, index) => (
                <motion.section
                  key={index}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative bg-zinc-900/60 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl"
                >
                  {!isAdult && participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(index)}
                      className="absolute top-6 right-6 text-zinc-600 hover:text-red-500 transition-colors"
                      aria-label="Видалити дитину"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}

                  <div className="space-y-8">
                    <div className="flex items-center gap-3 text-red-500">
                      <Users size={20} />
                      <h2 className="text-xs font-black uppercase tracking-[0.2em]">
                        {copy.participantHeading}{!isAdult ? ` #${index + 1}` : ''}
                      </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5 md:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">{copy.participantName}</label>
                        <div className="relative">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <input
                            required
                            type="text"
                            aria-label={copy.participantName}
                            placeholder={copy.participantPlaceholder}
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                            value={participant.name}
                            onChange={e => updateParticipant(index, 'name', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Дата народження</label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <input
                            type="date"
                            aria-label="Дата народження"
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                            value={participant.birthday}
                            onChange={e => updateParticipant(index, 'birthday', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Вік</label>
                        <input
                          type="number"
                          aria-label="Вік"
                          min="3"
                          max="80"
                          placeholder={isAdult ? 'Наприклад: 28' : 'Наприклад: 8'}
                          className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                          value={participant.age}
                          onChange={e => updateParticipant(index, 'age', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Поточний пояс</label>
                        <div className="relative">
                          <Award className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <select
                            aria-label="Поточний пояс"
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl pl-14 pr-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={participant.belt}
                            onChange={e => updateParticipant(index, 'belt', e.target.value)}
                          >
                            {beltOptions.map(belt => <option key={belt} value={belt}>{belt}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-red-500">
                        <MapPin size={20} />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em]">Локація та група</h3>
                      </div>

                      <div className="grid md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Локація</label>
                          <select
                            aria-label="Локація"
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={participant.location_id}
                            onChange={e => updateParticipant(index, 'location_id', e.target.value)}
                          >
                            <option value="">Поки не обрано</option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>{location.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Тренер</label>
                          <select
                            aria-label="Тренер"
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={participant.coach_id}
                            onChange={e => updateParticipant(index, 'coach_id', e.target.value)}
                          >
                            <option value="">Поки не обрано</option>
                            {coaches.map(coach => (
                              <option key={coach.id} value={coach.id}>{coach.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Група</label>
                          <select
                            aria-label="Група"
                            className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={participant.group_id}
                            onChange={e => updateParticipant(index, 'group_id', e.target.value)}
                          >
                            <option value="">Адміністратор уточнить групу</option>
                            {getFilteredGroups(participant.location_id, participant.coach_id).map(group => (
                              <option key={group.id} value={group.id}>
                                {group.name}{group.location_name ? ` • ${group.location_name}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              ))}
            </div>

            {!isAdult && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addParticipant}
                  className="group flex items-center gap-4 px-6 md:px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all"
                >
                  <span className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus size={20} />
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest">Додати ще одну дитину</span>
                </button>
              </div>
            )}

            <section className="bg-zinc-900/60 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-8">
              <div className="flex items-center gap-3 text-red-500">
                <Phone size={20} />
                <h2 className="text-xs font-black uppercase tracking-[0.2em]">{copy.contactHeading}</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-5 md:gap-6">
                {!isAdult && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">ПІБ батька/матері</label>
                    <input
                      required
                      type="text"
                      aria-label="ПІБ батька/матері"
                      placeholder="Іванов Іван"
                      className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                      value={accountInfo.parent_name}
                      onChange={e => setAccountInfo({ ...accountInfo, parent_name: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">{copy.phoneLabel}</label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      required
                      type="tel"
                      aria-label={copy.phoneLabel}
                      placeholder="+380..."
                      className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                      value={accountInfo.parent_phone}
                      onChange={e => setAccountInfo({ ...accountInfo, parent_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">{copy.emailLabel}</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      required
                      type="email"
                      aria-label={copy.emailLabel}
                      placeholder="name@example.com"
                      className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                      value={accountInfo.parent_email}
                      onChange={e => setAccountInfo({ ...accountInfo, parent_email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Пароль</label>
                  <input
                    required
                    type="password"
                    aria-label="Пароль"
                    placeholder="Мінімум 4 символи"
                    className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                    value={accountInfo.password}
                    onChange={e => setAccountInfo({ ...accountInfo, password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-3">Підтвердіть пароль</label>
                  <input
                    required
                    type="password"
                    aria-label="Підтвердіть пароль"
                    placeholder="Повторіть пароль"
                    className="w-full h-[60px] md:h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                    value={accountInfo.confirmPassword}
                    onChange={e => setAccountInfo({ ...accountInfo, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-start gap-4 p-5 bg-black/70 border border-white/5 rounded-3xl cursor-pointer hover:border-red-600/40 transition-colors">
                <input
                  type="checkbox"
                  checked={accountInfo.telegram_opt_in}
                  onChange={e => setAccountInfo({ ...accountInfo, telegram_opt_in: e.target.checked })}
                  className="mt-1 h-5 w-5 accent-red-600"
                />
                <span className="text-left">
                  <span className="block text-sm font-black uppercase tracking-widest text-white">Підключити Telegram-бот</span>
                  <span className="block text-xs text-zinc-400 leading-relaxed mt-2">
                    Після реєстрації відкриється наш бот з персональним кодом. У Telegram приходять важливі ручні повідомлення, оголошення та відповіді тренера. Відмітки відвідування й бали не спамлять у бот, вони зберігаються в кабінеті.
                  </span>
                </span>
              </label>
            </section>

            <div className="pt-2">
              <Button type="submit" className="w-full min-h-[62px]" disabled={isSubmitting}>
                {isSubmitting ? 'Зберігаємо...' : copy.submit}
              </Button>
              <p className="text-center text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-6 flex items-center justify-center gap-2 leading-relaxed">
                <Info size={12} />
                Дані потрібні для кабінету, зв’язку з клубом і коректного обліку учасника
              </p>
            </div>
          </motion.form>
        </div>
      </main>
    </div>
  );
};

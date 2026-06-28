import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Award, 
  Clock, 
  LogOut, 
  ChevronRight, 
  Trophy, 
  MessageSquare, 
  CreditCard,
  ShieldCheck,
  Activity,
  MapPin,
  Menu,
  X,
  LayoutDashboard,
  Flame,
  Star,
  Zap,
  CheckCircle2,
  AlertCircle,
  Users,
  Bell,
  BookOpen,
  ClipboardCheck,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { normalizeBeltName } from './belts';
import KarateManual from './KarateManual';
import { HomeworkParentDiary } from './HomeworkModules';

const clampProgress = (value: unknown) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(100, Math.max(0, numericValue));
};

const getSkillLabel = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const directLabel = record.name || record.title || record.label || record.skill || record.text;
  if (typeof directLabel === 'string') return directLabel.trim();

  return Object.values(record)
    .filter(item => ['string', 'number', 'boolean'].includes(typeof item))
    .map(item => String(item).trim())
    .filter(Boolean)
    .join(' ');
};

const normalizeSkillChecklist = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(getSkillLabel).filter(Boolean);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (parsed !== raw) return normalizeSkillChecklist(parsed);
    } catch {
      // Plain comma/newline separated checklist from older records.
    }

    return raw
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  const label = getSkillLabel(value);
  return label ? [label] : [];
};

const BELT_FLOW = [
  'Білий',
  'Оранжевий',
  'Оранжевий зі смужкою',
  'Синій',
  'Синій зі сріблястою смужкою',
  'Жовтий',
  'Жовтий зі смужкою',
  'Зелений',
  'Зелений зі смужкою',
  'Коричневий',
  'Коричневий зі смужкою',
  'Чорний'
];

const getNextBeltName = (belt?: string) => {
  const current = normalizeBeltName(belt);
  const currentIndex = BELT_FLOW.findIndex(item => item.toLowerCase() === current.toLowerCase());
  if (currentIndex >= 0 && currentIndex < BELT_FLOW.length - 1) return BELT_FLOW[currentIndex + 1];
  if (currentIndex === BELT_FLOW.length - 1) return 'підтвердження рівня';
  return 'наступний пояс';
};

const formatTrainingTime = (entry?: any) => {
  if (!entry) return 'Розклад ще не призначено';
  const time = [entry.start_time, entry.end_time].filter(Boolean).join(' - ');
  return [entry.day_of_week, time].filter(Boolean).join(', ');
};

const getParentAuthHeaders = () => {
  const token = localStorage.getItem('parent_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parentFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...getParentAuthHeaders(),
      ...(options.headers || {}),
    },
  });

const eventTypeLabel = (type?: string) => {
  if (type === 'seminar') return 'Семінар';
  if (type === 'certification') return 'Атестація';
  if (type === 'club_event') return 'Подія клубу';
  return 'Змагання';
};

const pointReasonLabel = (reason?: string) => {
  if (!reason) return 'Бали';
  if (reason === 'attendance') return 'Відвідування';
  if (reason === 'attendance_removal') return 'Корекція відвідування';
  if (reason === 'coach_bonus') return 'Бали від тренера';
  if (reason === 'discipline') return 'Дисципліна';
  if (reason === 'technique') return 'Техніка';
  if (reason === 'progress') return 'Прогрес';
  if (reason === 'manual_adjustment') return 'Корекція балів';
  if (reason === 'homework') return 'Домашнє завдання';
  if (reason === 'badge') return 'Досягнення';
  if (reason.startsWith('seminar')) return 'Семінар';
  if (reason.startsWith('certification')) return 'Атестація';
  if (reason.startsWith('club_event')) return 'Подія клубу';
  if (reason.startsWith('competition')) return 'Змагання';
  return reason;
};

const ParentPanel = () => {
  const [participant, setParticipant] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pointsLog, setPointsLog] = useState<any[]>([]);
  const [coachNotes, setCoachNotes] = useState<any[]>([]);
  const [ratingsSummary, setRatingsSummary] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [homeworkItems, setHomeworkItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [homeworkFocusTarget, setHomeworkFocusTarget] = useState<{ id?: number | null; title?: string; nonce: number } | null>(null);
  const [isChildMode, setIsChildMode] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ===== NEW STATE: Belt Progress, Attendance Streak =====
  const [beltProgress, setBeltProgress] = useState<any[] | null>(null);
  const [attendanceStreak, setAttendanceStreak] = useState<any[]>([]);
  const [coachMessage, setCoachMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [botUsername, setBotUsername] = useState('BlackBearDojoBot');
  const [familyAccesses, setFamilyAccesses] = useState<any[]>([]);
  const [familyAccessDraft, setFamilyAccessDraft] = useState({
    access_type: 'mother',
    name: '',
    phone: '',
    email: '',
    password: ''
  });
  const [isSavingFamilyAccess, setIsSavingFamilyAccess] = useState(false);

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then(r => r.json())
      .then(data => setBotUsername(data.botUsername))
      .catch(e => console.log(e));
  }, []);

  useEffect(() => {
    if (participant?.id) {
      fetchMessages();
      fetchFamilyAccesses();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [participant?.id]);

  const fetchFamilyAccesses = async () => {
    if (!participant?.id) return;
    try {
      const res = await parentFetch(`/api/participants/${participant.id}/accesses`);
      if (res.ok) {
        const data = await res.json();
        setFamilyAccesses(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch family accesses');
    }
  };

  const handleAddFamilyAccess = async () => {
    if (!participant?.id) return;
    const phone = familyAccessDraft.phone.trim();
    const name = familyAccessDraft.name.trim();
    if (!name || !phone || familyAccessDraft.password.length < 4) {
      toast.error('Вкажіть імʼя, телефон і пароль мінімум 4 символи');
      return;
    }

    setIsSavingFamilyAccess(true);
    try {
      const res = await parentFetch(`/api/participants/${participant.id}/accesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...familyAccessDraft,
          name,
          phone,
          login: phone,
          can_login: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Не вдалося додати доступ');
        return;
      }
      setFamilyAccessDraft({ access_type: 'mother', name: '', phone: '', email: '', password: '' });
      setFamilyAccesses(current => [...current, data]);
      toast.success('Додатковий вхід додано');
    } catch (e) {
      toast.error('Помилка мережі');
    } finally {
      setIsSavingFamilyAccess(false);
    }
  };

  const handleDeleteFamilyAccess = async (accessId: number) => {
    if (!participant?.id) return;
    if (!window.confirm('Видалити цей додатковий вхід до кабінету?')) return;
    try {
      const res = await parentFetch(`/api/participants/${participant.id}/accesses/${accessId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Не вдалося видалити доступ');
        return;
      }
      setFamilyAccesses(current => current.filter(access => access.id !== accessId));
      toast.success('Доступ видалено');
    } catch (e) {
      toast.error('Помилка мережі');
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await parentFetch(`/api/messages/${participant.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch messages');
    }
  };

  const handleSendMessage = async () => {
    if (!coachMessage.trim()) return;
    try {
      const res = await parentFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          content: coachMessage,
          sender_type: 'parent'
        })
      });
      if (res.ok) {
        toast.success('Повідомлення надіслано!');
        setCoachMessage('');
        fetchMessages();
      }
    } catch (e) {
      toast.error('Не вдалося надіслати повідомлення');
    }
  };

  useEffect(() => {
    if (participant?.id) {
      // Fetch belt progress
      parentFetch(`/api/parent/${participant.id}/belt-progress`)
        .then(r => r.json())
        .then(data => setBeltProgress(data.children || []))
        .catch(e => console.log(e));
      
      // Fetch attendance streak
      parentFetch(`/api/parent/${participant.id}/attendance-streak`)
        .then(r => r.json())
        .then(data => setAttendanceStreak(data.children || []))
        .catch(e => console.log(e));
    }
  }, [participant?.id]);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(fetchData, 30000); // Fetch every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [pRes, aRes, bRes, eventRes, pointsRes, notesRes, ratingsRes, sRes, cRes, payRes, annRes, notifRes, homeworkRes] = await Promise.all([
        parentFetch('/api/parent/me'),
        parentFetch('/api/parent/attendance'),
        parentFetch('/api/parent/badges'),
        parentFetch('/api/parent/events'),
        parentFetch('/api/parent/points-log'),
        parentFetch('/api/parent/coach-notes'),
        parentFetch('/api/parent/ratings'),
        parentFetch('/api/parent/schedule'),
        parentFetch('/api/parent/children'),
        parentFetch('/api/parent/payments'),
        fetch('/api/announcements'),
        parentFetch('/api/parent/notifications'),
        parentFetch('/api/parent/homework')
      ]);

      if (pRes.status === 401) {
        localStorage.removeItem('parent_token');
        localStorage.removeItem('parent_name');
        window.location.href = '/auth?role=parent';
        return;
      }

      const pData = pRes.ok ? await pRes.json() : null;
      const aData = aRes.ok ? await aRes.json() : [];
      const bData = bRes.ok ? await bRes.json() : [];
      const eventData = eventRes.ok ? await eventRes.json() : [];
      const pointsData = pointsRes.ok ? await pointsRes.json() : [];
      const notesData = notesRes.ok ? await notesRes.json() : [];
      const ratingsData = ratingsRes.ok ? await ratingsRes.json() : null;
      const sData = sRes.ok ? await sRes.json() : [];
      const cData = cRes.ok ? await cRes.json() : [];
      const payData = payRes.ok ? await payRes.json() : [];
      const annData = annRes.ok ? await annRes.json() : [];
      const notifData = notifRes.ok ? await notifRes.json() : [];
      const homeworkData = homeworkRes.ok ? await homeworkRes.json() : [];

      if (pData) setParticipant(pData);
      setAttendance(aData);
      setBadges(bData);
      setEvents(Array.isArray(eventData) ? eventData : []);
      setPointsLog(Array.isArray(pointsData) ? pointsData : []);
      setCoachNotes(Array.isArray(notesData) ? notesData : []);
      setRatingsSummary(ratingsData && !ratingsData.error ? ratingsData : null);
      setSchedule(sData);
      setChildren(cData);
      setPayments(payData);
      setAnnouncements(annData);
      setNotifications(notifData);
      setHomeworkItems(Array.isArray(homeworkData) ? homeworkData : []);
    } catch (e) {
      toast.error('Помилка завантаження даних');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleSwitchChild = async (childId: number) => {
    try {
      const res = await parentFetch('/api/parent/switch-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('parent_token', data.token);
        }
        fetchData();
        toast.success('Дитину змінено');
      }
    } catch (e) {
      toast.error('Не вдалося змінити дитину');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('parent_token');
    localStorage.removeItem('parent_name');
    await parentFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const handleConnectTelegram = () => {
    if (!participant) return;
    const token = `p_${participant.id}`;
    window.open(`https://t.me/${botUsername}?start=${token}`, '_blank');
  };

  const isHomeworkNotification = (notification: any) =>
    ['homework', 'homework_review'].includes(String(notification?.type || ''));

  const extractHomeworkTitle = (message?: string) => {
    const text = String(message || '');
    const quoted = text.match(/"([^"]+)"/);
    if (quoted?.[1]) return quoted[1];
    return text
      .replace(/^Нове домашнє завдання:\s*/i, '')
      .replace(/^Домашнє завдання\s*/i, '')
      .replace(/^Тренер залишив правки до ДЗ\s*/i, '')
      .trim();
  };

  const handleNotificationClick = (notification: any) => {
    if (!isHomeworkNotification(notification)) return;
    const referenceId = Number(notification.reference_id || 0);
    setHomeworkFocusTarget({
      id: Number.isFinite(referenceId) && referenceId > 0 ? referenceId : null,
      title: extractHomeworkTitle(notification.message),
      nonce: Date.now()
    });
    setActiveTab('homework');
  };

  const bestAthlete = ratingsSummary?.bestAthlete;
  const currentRank = ratingsSummary?.currentChild?.rank_position;
  const currentPoints = ratingsSummary?.currentChild?.total_points ?? participant?.rank_points ?? 0;
  const totalAchievements = badges.length + events.length;
  const currentSkillChecklist = normalizeSkillChecklist(participant?.skill_checklist);
  const isAdultMember = participant?.member_type === 'adult';
  const switchParentTab = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };
  const openPortalTabFromAthlete = (tab: string) => {
    setIsChildMode(false);
    switchParentTab(tab);
  };
  const activeHomeworkItems = homeworkItems.filter(item => !['approved', 'archived'].includes(String(item.status || '')));
  const homeworkNeedsAction = activeHomeworkItems.filter(item => ['assigned', 'in_progress', 'needs_work'].includes(String(item.status || '')));
  const urgentHomework = homeworkNeedsAction[0] || activeHomeworkItems[0] || homeworkItems[0];
  const homeworkDueText = urgentHomework?.due_date
    ? `до ${new Date(urgentHomework.due_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
    : 'без дедлайну';
  const homeworkStatusText = urgentHomework
    ? urgentHomework.status === 'submitted'
      ? 'очікує перевірки тренера'
      : urgentHomework.status === 'needs_work'
        ? 'потрібні правки'
        : homeworkDueText
    : 'немає активних завдань';
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;
  const importantNotifications = notifications
    .filter(n => !n.is_read || isHomeworkNotification(n) || ['payment', 'announcement'].includes(String(n.type || '')))
    .slice(0, 3);
  const firstImportantNotification = importantNotifications[0] || notifications[0];
  const openImportantNotification = () => {
    if (firstImportantNotification && isHomeworkNotification(firstImportantNotification)) {
      handleNotificationClick(firstImportantNotification);
      return;
    }
    switchParentTab('notifications');
  };
  const dashboardTitle = isAdultMember
    ? 'Вітаємо, учаснику!'
    : isChildMode
      ? 'Вітаємо, спортсмене!'
      : 'Вітаємо, батьки!';
  const dashboardSubtitle = isAdultMember
    ? 'Ваші тренування, прогрес, домашні завдання і важливі сповіщення в одному місці.'
    : 'Тренування, прогрес дитини, домашні завдання і важливі сповіщення в одному місці.';
  const manualCardText = isAdultMember
    ? 'Нормативи, техніка, словник і підготовка до пояса'
    : 'Нормативи, техніка і пояснення для учня та сімʼї';
  const nextTraining = schedule?.[0];
  const nextTrainingText = formatTrainingTime(nextTraining);
  const nextTrainingMeta = [
    nextTraining?.group_name || participant?.group_name,
    nextTraining?.location_name,
    nextTraining?.coach_name ? `тренер: ${nextTraining.coach_name}` : ''
  ].filter(Boolean).join(' • ');
  const nextBeltName = getNextBeltName(participant?.belt);
  const examReadiness = clampProgress(participant?.exam_readiness);
  const remainingReadiness = Math.max(0, 100 - examReadiness);
  const athleteBadges = badges.length > 0
    ? badges.slice(0, 4).map((badge: any) => badge.name || badge.title || badge.type || 'Відзнака')
    : currentSkillChecklist.slice(0, 4);
  const currentPaymentMonth = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date());
  const isPaymentDue = participant?.payment_status !== 'paid';
  const coachContactText = participant?.coach_name ? `тренера: ${participant.coach_name}` : 'тренера';
  const coachPhone = String(participant?.coach_phone || '').trim();
  const coachPhoneHref = coachPhone ? `tel:${coachPhone.replace(/[^\d+]/g, '')}` : '';
  const coachTelegramUsername = String(participant?.coach_telegram_username || '').replace(/^@+/, '').trim();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isChildMode) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-600/30 overflow-x-hidden">
        <Toaster position="top-right" theme="dark" richColors />
        
        {/* Athlete Mode Header */}
        <div className="fixed top-0 left-0 right-0 h-20 bg-zinc-900 border-b border-white/5 z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
              <Trophy className="text-white" size={20} />
            </div>
            <span className="text-lg font-black uppercase tracking-tighter">Режим <span className="text-red-600">спортсмена</span></span>
          </div>
          <button 
            onClick={() => setIsChildMode(false)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/5"
          >
            {isAdultMember ? 'Мій кабінет' : 'Кабінет батьків'}
          </button>
        </div>

        <main className="pt-28 pb-12 px-6 max-w-4xl mx-auto space-y-8">
          {/* Child Profile Card */}
          <section className="relative p-8 bg-gradient-to-br from-zinc-900 to-black rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] -mr-32 -mt-32" />
            
            <div className="relative flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="relative">
                <div className="w-32 h-32 bg-red-600 rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-[0_20px_40px_rgba(220,38,38,0.3)] border-4 border-white/10">
                  {participant?.name?.[0]}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-zinc-900 p-2 rounded-xl border border-white/10 shadow-xl">
                  <Flame className="text-orange-500" size={20} />
                </div>
              </div>
              
              <div className="flex-1">
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">{participant?.name}</h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <span className="px-4 py-1.5 bg-white/5 rounded-full text-xs font-bold text-zinc-400 border border-white/5">
                    {participant?.group_name || 'Групу не призначено'}
                  </span>
                  <span className="px-4 py-1.5 bg-red-600/20 rounded-full text-xs font-bold text-red-500 border border-red-600/20">
                    {normalizeBeltName(participant?.belt)} пояс
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-center bg-white/5 p-4 rounded-3xl border border-white/5 min-w-[100px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Серія</div>
                  <div className="text-2xl font-black text-orange-500 flex items-center justify-center gap-1">
                    <Flame size={20} />
                    {participant?.streak || 0}
                  </div>
                </div>
                <div className="text-center bg-white/5 p-4 rounded-3xl border border-white/5 min-w-[100px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Бали</div>
                  <div className="text-2xl font-black text-yellow-500 flex items-center justify-center gap-1">
                    <Star size={20} />
                    {participant?.rank_points || 0}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Домашні',
                value: homeworkNeedsAction.length > 0 ? `${homeworkNeedsAction.length} активні` : 'немає активних',
                text: urgentHomework?.title || 'Нові завдання від тренера будуть тут',
                icon: ClipboardCheck,
                tab: 'homework',
                tone: 'text-red-500',
                border: 'hover:border-red-500/30'
              },
              {
                title: 'Методичка',
                value: 'техніка',
                text: 'Нормативи, словник, пояси і підготовка',
                icon: BookOpen,
                tab: 'manual',
                tone: 'text-amber-400',
                border: 'hover:border-amber-400/30'
              },
              {
                title: 'Сповіщення',
                value: unreadNotificationsCount > 0 ? `${unreadNotificationsCount} нових` : 'все прочитано',
                text: firstImportantNotification?.message || 'Важливі повідомлення зʼявляться тут',
                icon: Bell,
                tab: 'notifications',
                tone: 'text-blue-400',
                border: 'hover:border-blue-400/30'
              },
              {
                title: 'Розклад',
                value: nextTrainingText,
                text: nextTrainingMeta || 'Графік тренувань',
                icon: Clock,
                tab: 'schedule',
                tone: 'text-emerald-400',
                border: 'hover:border-emerald-400/30'
              },
            ].map((card, i) => (
              <motion.button
                type="button"
                key={card.title}
                onClick={() => openPortalTabFromAthlete(card.tab)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`group relative overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-900/40 p-5 text-left transition-all hover:-translate-y-1 hover:bg-zinc-900 ${card.border} focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50`}
              >
                <card.icon className={`mb-8 ${card.tone}`} size={30} />
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{card.title}</div>
                <div className="mt-2 line-clamp-1 text-2xl font-black uppercase tracking-tight text-white">{card.value}</div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">{card.text}</p>
                <ChevronRight className="absolute right-5 top-5 text-zinc-700 transition-colors group-hover:text-white" size={18} />
              </motion.button>
            ))}
          </section>

          {/* Belt Progress Roadmap */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Мій Прогрес</h2>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">До наступного поясу</span>
            </div>
            
            <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-white/5">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <div className="text-4xl font-black text-white mb-1">{examReadiness}%</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Готовність до іспиту</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-zinc-300 mb-1">Наступний: {nextBeltName}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {remainingReadiness === 0 ? 'Готово до атестації' : `Залишилось ${remainingReadiness}%`}
                  </div>
                </div>
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${examReadiness}%` }}
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                />
              </div>
            </div>
          </section>

          {/* Badges Grid */}
          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-tight px-2">Мої відзнаки</h2>
            {athleteBadges.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {athleteBadges.map((badge, i) => (
                  <div key={`${badge}-${i}`} className="bg-zinc-900/30 p-6 rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center group hover:bg-white/5 transition-all cursor-pointer">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Award className="text-yellow-500" size={32} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white">{badge}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900/30 p-8 rounded-[2.5rem] border border-dashed border-white/10 text-center">
                <Award className="mx-auto text-zinc-700 mb-4" size={36} />
                <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
                  Відзнаки зʼявляться після оцінок тренера або подій
                </div>
              </div>
            )}
          </section>

          {/* Next Class Alert */}
          <section className={`${nextTraining ? 'bg-red-600 shadow-red-600/20' : 'bg-zinc-900 border border-white/5'} p-8 rounded-[3rem] shadow-2xl flex items-center justify-between gap-6`}>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Наступне тренування</div>
              <div className="text-2xl font-black text-white">{nextTrainingText}</div>
              {nextTrainingMeta && (
                <div className="text-xs font-bold text-white/70 mt-2">{nextTrainingMeta}</div>
              )}
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              {nextTraining ? <Zap className="text-white" size={32} /> : <Clock className="text-zinc-500" size={32} />}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-600/30">
      <Toaster position="top-right" theme="dark" richColors />
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-zinc-950 border-b border-white/5 z-[60] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <ShieldCheck className="text-white" size={18} />
          </div>
          <span className="text-sm font-black uppercase tracking-tighter">Black Bear <span className="text-zinc-600">Dojo</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLogout}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors"
            title="Вийти"
          >
            <LogOut size={18} />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-400"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-[55] bg-zinc-950 lg:hidden p-8 pt-24 overflow-y-auto"
          >
            <div className="space-y-2">
              <button
                onClick={handleLogout}
                className="mb-4 w-full flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border border-white/5 bg-white/[0.03] text-zinc-400 hover:border-red-600/30 hover:bg-red-600/10 hover:text-red-500 transition-all font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                <span className="flex items-center gap-4">
                  <LogOut size={20} />
                  Вийти
                </span>
                <ChevronRight size={16} className="opacity-40" />
              </button>
              {[
                { id: 'overview', label: 'Огляд', icon: LayoutDashboard },
                { id: 'family', label: 'Сім\'я', icon: Users },
                { id: 'schedule', label: 'Розклад', icon: Clock },
                { id: 'attendance', label: 'Відвідуваність', icon: Calendar },
                { id: 'progress', label: 'Прогрес', icon: Trophy },
                { id: 'homework', label: 'Домашні', icon: ClipboardCheck },
                { id: 'manual', label: 'Методичка', icon: BookOpen },
                { id: 'payments', label: 'Оплата', icon: CreditCard },
                { id: 'notifications', label: 'Сповіщення', icon: AlertCircle },
                { id: 'messages', label: 'Повідомлення', icon: MessageSquare },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 ${
                    activeTab === item.id 
                    ? 'bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)]' 
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-4 text-zinc-500 hover:text-red-500 transition-colors font-bold mt-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-2xl"
              >
                <LogOut size={20} />
                Вийти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Mobile Nav */}
      <div className="fixed top-0 left-0 bottom-0 w-80 bg-zinc-950 border-r border-white/5 z-50 hidden lg:flex flex-col px-6 py-7 overflow-hidden">
        <div className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter">Black Bear <span className="text-zinc-600">Dojo</span></span>
          </div>
          
          <div className="p-5 bg-white/[0.03] rounded-[2rem] border border-white/5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-600/20 text-red-600 rounded-2xl flex items-center justify-center font-black text-xl">
                {participant?.name?.[0]}
              </div>
              <div>
                <div className="font-bold text-sm truncate w-32">{participant?.name}</div>
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{participant?.group_name}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[8px] text-zinc-500 uppercase font-black mb-1">Рейтинг</div>
                <div className="text-sm font-bold text-red-500">{participant?.rank_points || 0}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="text-[8px] text-zinc-500 uppercase font-black mb-1">Пояс</div>
                <div className="text-sm font-bold text-zinc-300">{normalizeBeltName(participant?.belt)}</div>
              </div>
            </div>

            {children.length > 1 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="text-[8px] text-zinc-500 uppercase font-black mb-2 px-1">Ваші діти:</div>
                <div className="flex flex-col gap-1">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => handleSwitchChild(child.id)}
                      className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        child.id === participant?.id 
                        ? 'bg-red-600/20 text-red-500' 
                        : 'text-zinc-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            id="parent-sidebar-logout-top"
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border border-white/5 bg-white/[0.03] text-zinc-400 hover:border-red-600/30 hover:bg-red-600/10 hover:text-red-500 transition-all font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <span className="flex items-center gap-4">
              <LogOut size={20} />
              Вийти
            </span>
            <ChevronRight size={16} className="opacity-40" />
          </button>
        </div>

        <nav className="bb-parent-sidebar-nav space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
          {[
            { id: 'overview', label: 'Огляд', icon: LayoutDashboard },
            { id: 'family', label: 'Сім\'я', icon: Users },
            { id: 'schedule', label: 'Розклад', icon: Clock },
            { id: 'attendance', label: 'Відвідуваність', icon: Calendar },
            { id: 'progress', label: 'Прогрес', icon: Trophy },
            { id: 'homework', label: 'Домашні', icon: ClipboardCheck },
            { id: 'manual', label: 'Методичка', icon: BookOpen },
            { id: 'payments', label: 'Оплата', icon: CreditCard },
            { id: 'notifications', label: 'Сповіщення', icon: AlertCircle },
            { id: 'messages', label: 'Повідомлення', icon: MessageSquare },
          ].map(item => (
            <button
              key={item.id}
              id={`parent-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 ${
                activeTab === item.id 
                ? 'bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)]' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-5 pt-5 border-t border-white/5 space-y-3 shrink-0">
          <button 
            id="child-mode-button"
            onClick={() => setIsChildMode(true)}
            className="w-full flex items-center gap-4 px-5 py-3.5 bg-red-600/10 text-red-500 rounded-2xl font-bold hover:bg-red-600/20 transition-all border border-red-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <Trophy size={20} />
            Режим спортсмена
          </button>
          <button 
            id="parent-logout-button"
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-5 py-3.5 text-zinc-500 hover:text-red-500 transition-colors font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-2xl"
          >
            <LogOut size={20} />
            Вийти
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="bb-motion-surface lg:pl-80 min-h-screen pt-20 lg:pt-0">
        {/* Desktop Header */}
        <div className="hidden lg:flex fixed top-0 left-80 right-0 h-20 bg-black/50 backdrop-blur-md border-b border-white/5 z-40 items-center justify-between px-12">
          <div className="flex items-center gap-4">
            <div className="text-sm font-bold text-zinc-400">
              {activeTab === 'overview' ? 'Дашборд' : 
               activeTab === 'family' ? 'Сім\'я' :
               activeTab === 'schedule' ? 'Розклад' :
               activeTab === 'attendance' ? 'Відвідуваність' :
               activeTab === 'progress' ? 'Прогрес' :
               activeTab === 'homework' ? 'Домашні завдання' :
               activeTab === 'manual' ? 'Методичка' :
               activeTab === 'payments' ? 'Оплата' :
               activeTab === 'notifications' ? 'Сповіщення' : 'Повідомлення'}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('notifications')}
              className="relative p-3 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors group"
            >
              <Bell size={20} />
              {notifications.some(n => !n.is_read) && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-600 rounded-full border-2 border-black" />
              )}
            </button>
            <div className="h-8 w-px bg-white/10" />
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl text-zinc-400 hover:text-red-500 transition-all group"
            >
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">Вийти</span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="bb-motion-page p-8 lg:p-12 lg:pt-32 max-w-6xl mx-auto"
          >
          {activeTab === 'family' && (
            <div className="space-y-12">
              <header>
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Моя <span className="text-red-600">Сім'я</span></h1>
                <p className="text-zinc-500 font-medium max-w-2xl">Керуйте профілями всіх ваших дітей в одному місці.</p>
              </header>

              <div className="grid gap-6">
                {children.map(child => (
                  <div key={child.id} className="bg-zinc-900/50 p-8 rounded-[3rem] border border-white/5 flex flex-col md:flex-row items-center gap-8 group hover:border-red-600/20 transition-all">
                    <div className="w-24 h-24 bg-red-600/20 text-red-600 rounded-[2rem] flex items-center justify-center font-black text-3xl group-hover:scale-110 transition-transform">
                      {child.name?.[0]}
                    </div>
                    
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{child.name}</h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-4">
                        <span className="px-4 py-1.5 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-white/5">
                          {child.group_name}
                        </span>
                        <span className="px-4 py-1.5 bg-red-600/10 rounded-full text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-600/10">
                          {normalizeBeltName(child.belt)} пояс
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Оплата</div>
                          <div className={`text-xs font-black uppercase ${child.payment_status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                            {child.payment_status === 'paid' ? 'Оплачено' : 'Борг'}
                          </div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Сьогодні</div>
                          <div className={`text-xs font-black uppercase ${child.today_status === 'present' ? 'text-green-500' : 'text-zinc-500'}`}>
                            {child.today_status === 'present' ? 'Присутній' : 'Немає'}
                          </div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Streak</div>
                          <div className="text-xs font-black text-orange-500 flex items-center gap-1">
                            <Flame size={12} /> {child.streak || 0}
                          </div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Прогрес</div>
                          <div className="text-xs font-black text-white">{clampProgress(child.exam_readiness)}%</div>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleSwitchChild(child.id)}
                      disabled={child.id === participant?.id}
                      className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${
                        child.id === participant?.id 
                        ? 'bg-zinc-800 text-zinc-500 cursor-default' 
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
                      }`}
                    >
                      {child.id === participant?.id ? 'Обрано' : 'Обрати'}
                    </button>
                  </div>
                ))}
              </div>

              <section className="bg-zinc-900/50 p-6 md:p-8 rounded-[3rem] border border-white/5 space-y-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Доступи до кабінету</h2>
                    <p className="text-sm text-zinc-500 max-w-2xl">
                      Додайте другий номер для мами, тата або самої дитини. Всі входять у той самий кабінет і бачать однакові дані по дитині.
                    </p>
                  </div>
                  <div className="px-4 py-2 rounded-2xl bg-black/40 border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {familyAccesses.length} додатково
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {familyAccesses.length > 0 ? familyAccesses.map(access => (
                    <div key={access.id} className="bg-black/40 border border-white/5 rounded-3xl p-5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 rounded-lg bg-red-600/10 text-red-500 text-[9px] font-black uppercase tracking-widest">
                            {access.access_type === 'father' ? 'Тато' : access.access_type === 'mother' ? 'Мама' : access.access_type === 'child' ? 'Дитина' : 'Сімʼя'}
                          </span>
                          {!access.can_login && (
                            <span className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest">вимкнено</span>
                          )}
                        </div>
                        <div className="font-black text-white truncate">{access.name || 'Без імені'}</div>
                        <div className="text-xs text-zinc-500 mt-1 break-all">{access.login || access.phone}</div>
                        {access.email && <div className="text-xs text-zinc-600 mt-1 break-all">{access.email}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFamilyAccess(access.id)}
                        className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-600/10 transition-colors flex items-center justify-center shrink-0"
                        aria-label="Видалити доступ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )) : (
                    <div className="md:col-span-2 p-8 rounded-3xl border border-dashed border-white/10 text-center text-zinc-500 text-sm">
                      Додаткових входів ще немає. Основний вхід батьків вже працює.
                    </div>
                  )}
                </div>

                <div className="bg-black/30 border border-white/5 rounded-3xl p-5 md:p-6 space-y-5">
                  <div className="grid md:grid-cols-5 gap-4">
                    <select
                      value={familyAccessDraft.access_type}
                      onChange={e => setFamilyAccessDraft({ ...familyAccessDraft, access_type: e.target.value })}
                      className="h-12 bg-black border border-white/10 rounded-2xl px-4 text-sm outline-none focus:border-red-600"
                      aria-label="Тип доступу"
                    >
                      <option value="mother">Мама</option>
                      <option value="father">Тато</option>
                      <option value="child">Дитина</option>
                      <option value="guardian">Інший член сімʼї</option>
                    </select>
                    <input
                      type="text"
                      value={familyAccessDraft.name}
                      onChange={e => setFamilyAccessDraft({ ...familyAccessDraft, name: e.target.value })}
                      placeholder="Імʼя"
                      className="h-12 bg-black border border-white/10 rounded-2xl px-4 text-sm outline-none focus:border-red-600"
                    />
                    <input
                      type="tel"
                      value={familyAccessDraft.phone}
                      onChange={e => setFamilyAccessDraft({ ...familyAccessDraft, phone: e.target.value })}
                      placeholder="+380..."
                      className="h-12 bg-black border border-white/10 rounded-2xl px-4 text-sm outline-none focus:border-red-600"
                    />
                    <input
                      type="email"
                      value={familyAccessDraft.email}
                      onChange={e => setFamilyAccessDraft({ ...familyAccessDraft, email: e.target.value })}
                      placeholder="email, якщо є"
                      className="h-12 bg-black border border-white/10 rounded-2xl px-4 text-sm outline-none focus:border-red-600"
                    />
                    <input
                      type="password"
                      value={familyAccessDraft.password}
                      onChange={e => setFamilyAccessDraft({ ...familyAccessDraft, password: e.target.value })}
                      placeholder="Пароль"
                      className="h-12 bg-black border border-white/10 rounded-2xl px-4 text-sm outline-none focus:border-red-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFamilyAccess}
                    disabled={isSavingFamilyAccess}
                    className="w-full md:w-auto px-6 py-4 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-400 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
                  >
                    <Plus size={18} />
                    {isSavingFamilyAccess ? 'Додаємо...' : 'Додати вхід'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-10">
              <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Дашборд</p>
                  <h1 className="text-4xl font-black uppercase tracking-tighter sm:text-5xl">
                    {dashboardTitle.split(',')[0]}, <span className="text-red-600">{dashboardTitle.split(',')[1]?.trim()}</span>
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-zinc-500">{dashboardSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchParentTab('schedule')}
                  className="group flex min-h-20 items-center gap-4 rounded-[1.5rem] border border-white/5 bg-zinc-900/50 px-5 py-4 text-left transition-all hover:border-red-600/30 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600/10 text-red-500 transition-transform group-hover:scale-105">
                    <Clock size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Наступне заняття</div>
                    <div className="mt-1 max-w-64 truncate text-sm font-black text-white">{nextTrainingText}</div>
                    {nextTrainingMeta && <div className="mt-1 max-w-64 truncate text-[10px] font-bold uppercase tracking-widest text-zinc-600">{nextTrainingMeta}</div>}
                  </div>
                  <ChevronRight className="ml-auto text-zinc-700 transition-colors group-hover:text-red-500" size={18} />
                </button>
              </header>

              <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <motion.button
                  type="button"
                  onClick={() => switchParentTab('homework')}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  className="group relative min-h-60 overflow-hidden rounded-[2rem] border border-red-600/25 bg-gradient-to-br from-red-600/20 via-zinc-950 to-zinc-950 p-6 text-left shadow-2xl shadow-red-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                >
                  <div className="absolute right-6 top-6 opacity-10 transition-transform duration-500 group-hover:scale-110">
                    <ClipboardCheck size={112} />
                  </div>
                  <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                    <div>
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/25">
                          <ClipboardCheck size={24} />
                        </span>
                        <span className="rounded-full border border-red-500/30 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                          {homeworkNeedsAction.length > 0 ? `${homeworkNeedsAction.length} активні` : 'все спокійно'}
                        </span>
                      </div>
                      <h2 className="max-w-xl text-3xl font-black uppercase tracking-tighter text-white sm:text-4xl">Домашні завдання</h2>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                        {urgentHomework?.title ? urgentHomework.title : 'Коли тренер надішле завдання, воно одразу зʼявиться тут.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-2xl bg-black/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">{homeworkStatusText}</span>
                      <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-300">
                        Відкрити <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </motion.button>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <motion.button
                    type="button"
                    onClick={() => switchParentTab('manual')}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.99 }}
                    className="group relative overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-900/50 p-6 text-left transition-colors hover:border-amber-400/25 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                  >
                    <BookOpen className="mb-8 text-amber-400 transition-transform group-hover:scale-110" size={34} />
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-400">Методичка</div>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Техніка і пояси</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">{manualCardText}</p>
                    <ChevronRight className="absolute right-6 top-6 text-zinc-700 transition-colors group-hover:text-amber-400" size={20} />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={openImportantNotification}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.99 }}
                    className="group relative overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-900/50 p-6 text-left transition-colors hover:border-blue-400/25 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                  >
                    <Bell className="mb-8 text-blue-400 transition-transform group-hover:scale-110" size={34} />
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-400">Важливе</div>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
                      {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} нових` : 'Сповіщення'}
                    </h3>
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                      {firstImportantNotification?.message || 'Нові повідомлення тренера, оплати і домашки будуть тут.'}
                    </p>
                    <ChevronRight className="absolute right-6 top-6 text-zinc-700 transition-colors group-hover:text-blue-400" size={20} />
                  </motion.button>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Відвідуваність', value: attendance.length, hint: 'занять всього', icon: Activity, tab: 'attendance', tone: 'text-green-500' },
                  { label: 'Досягнення', value: totalAchievements, hint: 'відзнаки, семінари та події', icon: Award, tab: 'progress', tone: 'text-amber-400' },
                  { label: 'Оплата', value: participant?.payment_status === 'paid' ? 'ОК' : 'Борг', hint: participant?.payment_status === 'paid' ? 'все оплачено' : 'потрібна увага', icon: CreditCard, tab: 'payments', tone: participant?.payment_status === 'paid' ? 'text-green-500' : 'text-red-500' },
                  { label: 'Telegram', value: participant?.telegram_chat_id ? 'ОК' : 'Підключити', hint: participant?.telegram_chat_id ? 'сповіщення активні' : 'для важливих повідомлень', icon: MessageSquare, action: handleConnectTelegram, tone: participant?.telegram_chat_id ? 'text-blue-400' : 'text-zinc-300' },
                ].map((card, index) => (
                  <motion.button
                    type="button"
                    key={card.label}
                    onClick={() => card.action ? card.action() : switchParentTab(card.tab || 'overview')}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="group relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-zinc-900/45 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/10 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                  >
                    <card.icon className={`mb-6 ${card.tone}`} size={26} />
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{card.label}</div>
                    <div className="mt-2 text-3xl font-black text-white">{card.value}</div>
                    <div className="mt-2 text-xs font-medium text-zinc-500">{card.hint}</div>
                    <ChevronRight className="absolute right-5 top-5 text-zinc-800 transition-colors group-hover:text-red-500" size={18} />
                  </motion.button>
                ))}
              </div>

              <div id="bb-parent-telegram-social-anchor" className="bb-parent-connect-anchor" />

              {(bestAthlete || currentRank) && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-amber-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Trophy size={96} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-4">Кращий спортсмен групи</div>
                    <div className="text-2xl font-black uppercase tracking-tight mb-2">{bestAthlete?.name || 'Поки немає даних'}</div>
                    <div className="text-sm text-zinc-400">
                      {bestAthlete
                        ? `${bestAthlete.total_points} балів • ${bestAthlete.attendance_count} відвідувань • ДЗ +${bestAthlete.homework_points || 0}`
                        : 'Рейтинг зʼявиться після перших балів'}
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Star size={96} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Місце вашої дитини</div>
                    <div className="text-4xl font-black mb-2">{currentRank ? `#${currentRank}` : '—'}</div>
                    <div className="text-sm text-zinc-400">
                      {currentPoints} балів у поточному рейтингу групи
                      {Number(ratingsSummary?.currentChild?.homework_points || 0) > 0 && (
                        <span className="block mt-1 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                          +{ratingsSummary.currentChild.homework_points} за домашні завдання
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-12">
                <section>
                  <h2 className="text-2xl font-black uppercase tracking-tight mb-8">Наступні заняття</h2>
                  <div className="space-y-4">
                    {schedule.length > 0 ? schedule.map((item, i) => (
                      <div key={i} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:text-red-600 transition-colors">
                            <Clock size={24} />
                          </div>
                          <div>
                            <div className="text-[9px] text-red-500 font-black uppercase tracking-widest mb-1">{item.group_name || participant?.group_name}</div>
                            <div className="font-bold text-lg">{item.day_of_week}</div>
                            <div className="text-xs text-zinc-500 font-medium">{item.start_time} - {item.end_time}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">{item.location_name}</div>
                          <div className="text-[10px] text-red-600 font-bold">{item.coach_name}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500">
                        Розклад поки не призначено
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-8">
                  {/* BELT PROGRESS SECTION */}
                  <div className="bg-zinc-900/50 rounded-[2.5rem] shadow-sm p-8 border border-white/5 border-t-4 border-yellow-500">
                    <div className="flex items-center gap-3 mb-6">
                      <Trophy className="text-yellow-500" size={24} />
                      <h3 className="text-xl font-black uppercase tracking-tight">Прогрес поясів</h3>
                    </div>
                    <div className="space-y-4">
                      {beltProgress?.map((child) => (
                        <div key={child.id} className="border-l-4 border-orange-500/50 pl-4">
                          <p className="font-bold text-white">{child.first_name}</p>
                          <p className="text-sm text-zinc-400">Поточний пояс: <span className="font-black text-orange-500 uppercase tracking-widest text-xs">{normalizeBeltName(child.belt_level)}</span></p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Оновлено: {child.belt_updated_at ? new Date(child.belt_updated_at).toLocaleDateString('uk-UA') : 'Ніколи'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ATTENDANCE STREAK SECTION */}
                  <div className="bg-zinc-900/50 rounded-[2.5rem] shadow-sm p-8 border border-white/5 border-t-4 border-green-500">
                    <div className="flex items-center gap-3 mb-6">
                      <Activity className="text-green-500" size={24} />
                      <h3 className="text-xl font-black uppercase tracking-tight">Відвідуваність за 30 днів</h3>
                    </div>
                    <div className="space-y-4">
                      {attendanceStreak?.map((child) => (
                        <div key={child.id} className="border-l-4 border-green-500/50 pl-4">
                          <p className="font-bold text-white">{child.first_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-zinc-400">Заняття: <span className="font-black text-green-500 text-xs">{child.total_attendance || 0}</span> разів</p>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 px-2 py-1 rounded-lg">✓ Активно</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QUICK MESSAGE TO COACH */}
                  <div className="bg-zinc-900/50 rounded-[2.5rem] shadow-sm p-8 border border-white/5 border-t-4 border-blue-500">
                    <div className="flex items-center gap-3 mb-6">
                      <MessageSquare className="text-blue-500" size={24} />
                      <h3 className="text-xl font-black uppercase tracking-tight">Зв'язок з тренером</h3>
                    </div>
                    <textarea
                      value={coachMessage}
                      onChange={(e) => setCoachMessage(e.target.value)}
                      placeholder="Напишіть повідомлення тренеру (питання, причина відсутності тощо)..."
                      className="w-full bg-black/40 p-4 border border-white/5 rounded-2xl text-sm mb-4 focus:outline-none focus:border-blue-500/50 text-white placeholder:text-zinc-600 transition-colors"
                      rows={3}
                    />
                    <button
                      onClick={handleSendMessage}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                    >
                      Надіслати повідомлення
                    </button>
                  </div>

                  <div className="bg-zinc-900/50 rounded-[2.5rem] shadow-sm p-8 border border-white/5 border-t-4 border-red-600">
                    <div className="flex items-center gap-3 mb-6">
                      <MessageSquare className="text-red-600" size={24} />
                      <h3 className="text-xl font-black uppercase tracking-tight">Нотатки тренера</h3>
                    </div>
                    <div className="space-y-4">
                      {coachNotes.length > 0 ? coachNotes.slice(0, 5).map(note => (
                        <div key={note.id} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">{note.participant_name}</span>
                            {note.coach_name && <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{note.coach_name}</span>}
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">{note.content}</p>
                          <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                            {new Date(note.created_at).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs font-bold uppercase tracking-widest text-zinc-600">
                          Нотаток поки немає
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Повний <span className="text-red-600">розклад</span></h2>
              <div className="grid gap-4">
                {schedule.map((item, i) => (
                  <div key={i} className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-red-600/10 text-red-600 rounded-2xl flex items-center justify-center">
                        <Calendar size={32} />
                      </div>
                      <div>
                        <div className="text-2xl font-black">{item.day_of_week}</div>
                        <div className="text-zinc-500 font-bold">{item.start_time} - {item.end_time}</div>
                        <div className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-2">{item.group_name || participant?.group_name}</div>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end">
                      <div className="flex items-center gap-2 text-zinc-300 mb-2">
                        <MapPin size={16} className="text-red-600" />
                        <span className="font-bold">{item.location_name}</span>
                      </div>
                      <div className="text-sm text-zinc-500">Тренер: <span className="text-white font-bold">{item.coach_name}</span></div>
                    </div>
                  </div>
                ))}
                {schedule.length === 0 && (
                  <div className="p-16 text-center bg-zinc-900/20 rounded-[2rem] border border-dashed border-white/5">
                    <Clock size={40} className="mx-auto text-zinc-700 mb-4 opacity-40" />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Розклад для цієї групи ще не призначено</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Історія <span className="text-red-600">відвідувань</span></h2>
              <div className="bg-zinc-900/30 rounded-[2.5rem] border border-white/5 overflow-x-auto">
                {attendance.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Дата</th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Статус</th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Примітка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-8 font-bold">{new Date(record.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                          <td className="p-8">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              record.status === 'present' ? 'bg-green-500/20 text-green-500' : 'bg-red-600/20 text-red-500'
                            }`}>
                              {record.status === 'present' ? 'Присутній' : 'Відсутній'}
                            </span>
                          </td>
                          <td className="p-8 text-zinc-500 italic">{record.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-20 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
                    Даних про відвідуваність поки немає
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-12">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Прогрес та <span className="text-red-600">досягнення</span></h2>
              
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tight">Поточний рівень</h3>
                  <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 text-center">
                    <div className="w-32 h-32 mx-auto bg-red-600/10 rounded-full flex items-center justify-center mb-6 relative">
                      <div className="absolute inset-0 border-4 border-red-600/20 rounded-full border-t-red-600 animate-[spin_3s_linear_infinite]" />
                      <Trophy size={64} className="text-red-600" />
                    </div>
                    <div className="text-3xl font-black mb-2">{normalizeBeltName(participant?.belt)} Пояс</div>
                    <div className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{participant?.rank_points} балів рейтингу</div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tight">Готовність до іспиту</h3>
                  <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <div className="text-4xl font-black text-white mb-1">{clampProgress(participant?.exam_readiness)}%</div>
                        <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Загальна готовність</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-red-500 mb-1">Наступний рівень</div>
                        <div className="text-sm font-black uppercase tracking-widest text-zinc-300">{nextBeltName}</div>
                      </div>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${clampProgress(participant?.exam_readiness)}%` }}
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                      />
                    </div>
                    
                    <div className="mt-10">
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-6 px-2">Чек-лист навичок</div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {currentSkillChecklist.map((skill: string, i: number) => (
                          skill.trim() && (
                            <div key={i} className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                              <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <ShieldCheck size={14} className="text-green-500" />
                              </div>
                              <span className="text-sm font-bold text-zinc-300">{skill.trim()}</span>
                            </div>
                          )
                        ))}
                        {currentSkillChecklist.length === 0 && (
                          <div className="col-span-2 text-center p-8 text-zinc-500 italic text-sm">Чек-лист поки порожній</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black uppercase tracking-tight">Рейтинг групи</h3>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {currentRank ? `Ваше місце #${currentRank}` : 'Без місця'}
                    </span>
                  </div>
                  {bestAthlete && (
                    <div className="mb-5 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-black flex items-center justify-center">
                        <Trophy size={24} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Кращий спортсмен</div>
                        <div className="font-black uppercase tracking-tight">{bestAthlete.name}</div>
                        <div className="text-xs text-zinc-400">
                          {bestAthlete.total_points} балів • ДЗ +{bestAthlete.homework_points || 0}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {(ratingsSummary?.groupTop || []).slice(0, 8).map((row: any) => (
                      <div key={row.id} className={`flex items-center justify-between p-4 rounded-2xl border ${
                        row.id === participant?.id ? 'bg-red-600/10 border-red-600/30' : 'bg-white/[0.03] border-white/5'
                      }`}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            Number(row.rank_position) === 1 ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {row.rank_position}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{row.name}</div>
                            <div className="text-[10px] text-zinc-500">
                              {row.attendance_count || 0} відвідувань • {row.seminar_count || 0} семінарів • {row.homework_approved_count || 0} ДЗ
                            </div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                              +{row.homework_points || 0} балів за домашки
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-black text-white">{row.total_points}</div>
                      </div>
                    ))}
                    {(!ratingsSummary?.groupTop || ratingsSummary.groupTop.length === 0) && (
                      <div className="p-10 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500 text-sm">
                        Рейтинг зʼявиться після перших відвідувань або подій
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6">Семінари та події</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {events.slice(0, 8).map((event) => (
                        <div key={event.id} className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">{eventTypeLabel(event.type)}</div>
                            <div className="text-sm font-bold truncate">{event.name}</div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                              {event.participant_name} • {event.date ? new Date(event.date).toLocaleDateString('uk-UA') : 'без дати'}
                            </div>
                          </div>
                          <div className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 text-[10px] font-black whitespace-nowrap">
                            +{event.points_awarded || 0}
                          </div>
                        </div>
                      ))}
                      {events.length === 0 && (
                        <div className="p-10 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500 text-sm">
                          Подій і семінарів поки немає
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-6">Журнал балів</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {pointsLog.slice(0, 10).map((point) => (
                        <div key={point.id} className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate">{pointReasonLabel(point.reason)}</div>
                            <div className="text-[10px] text-zinc-500">
                              {point.participant_name} • {point.date ? new Date(point.date).toLocaleDateString('uk-UA') : 'без дати'}
                            </div>
                          </div>
                          <div className={`text-sm font-black ${Number(point.points) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {Number(point.points) >= 0 ? '+' : ''}{point.points}
                          </div>
                        </div>
                      ))}
                      {pointsLog.length === 0 && (
                        <div className="p-10 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500 text-sm">
                          Бали ще не нараховувались
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tight">Всі відзнаки</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {badges.map((badge, i) => (
                    <div key={i} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:bg-red-600/5 transition-colors">
                      <div className="w-12 h-12 bg-red-600/10 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Award size={24} />
                      </div>
                      <div className="font-bold text-xs">{badge.type}</div>
                      <div className="text-[9px] text-zinc-500 mt-1 uppercase font-black">{new Date(badge.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                  {badges.length === 0 && (
                    <div className="col-span-full p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500">
                      Відзнак поки немає
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <KarateManual audience="parent" currentBelt={normalizeBeltName(participant?.belt)} />
          )}

          {activeTab === 'homework' && (
            <HomeworkParentDiary participantId={participant?.id} focusTarget={homeworkFocusTarget} />
          )}

          {activeTab === 'payments' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Історія <span className="text-red-600">оплати</span></h2>
              <div className="grid gap-6">
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Поточний статус</div>
                    <div className={`text-2xl font-black uppercase tracking-tight ${
                      participant?.payment_status === 'paid' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {participant?.payment_status === 'paid' ? 'Все оплачено' : 'Потрібна оплата'}
                    </div>
                  </div>
                  <button className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">
                    Оплатити онлайн
                  </button>
                </div>

                {isPaymentDue && (
                  <div className="bg-red-600/10 border border-red-600/20 rounded-[2rem] p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600/20 text-red-500">
                          <AlertCircle size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Нагадування про оплату</div>
                          <h3 className="text-xl font-black uppercase tracking-tight text-white">Оплата за {currentPaymentMonth} до 5 числа</h3>
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                            Якщо оплату вже зробили, але статус не оновився або бачите помилку, зверніться до {coachContactText}.
                          </p>
                          <div className="mt-3 space-y-1 text-sm font-bold text-zinc-200">
                            {coachPhone && <div>Телефон: {coachPhone}</div>}
                            {coachTelegramUsername && <div>Telegram: @{coachTelegramUsername}</div>}
                            {!coachPhone && !coachTelegramUsername && <div>Контакти тренера можна уточнити через повідомлення в кабінеті.</div>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 lg:justify-end">
                        {coachPhoneHref && (
                          <a href={coachPhoneHref} className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white/15">
                            Подзвонити
                          </a>
                        )}
                        {coachTelegramUsername && (
                          <a href={`https://t.me/${coachTelegramUsername}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-700">
                            Telegram
                          </a>
                        )}
                        <button type="button" onClick={() => switchParentTab('messages')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-zinc-200 transition-colors hover:bg-white/10">
                          <MessageSquare size={16} />
                          Повідомлення
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-zinc-900/30 rounded-[2.5rem] border border-white/5 overflow-x-auto">
                  {payments.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Місяць / Дата</th>
                          <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Сума</th>
                          <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Тип</th>
                          <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="p-8 font-bold">
                              {payment.month && payment.year 
                                ? `${['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'][payment.month - 1]} ${payment.year}`
                                : new Date(payment.date).toLocaleDateString('uk-UA')}
                            </td>
                            <td className="p-8">{payment.amount} грн</td>
                            <td className="p-8 text-xs text-zinc-500 uppercase tracking-widest font-bold">
                              {payment.type === 'subscription' ? 'Абонемент' : payment.type === 'exam' ? 'Атестація' : 'Інше'}
                            </td>
                            <td className="p-8">
                              <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-500">Оплачено</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-20 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
                      Історія оплат порожня
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Ваші <span className="text-red-600">сповіщення</span></h2>
              <div className="space-y-4">
                {notifications.length > 0 ? notifications.map((n, i) => (
                  <motion.button
                    type="button"
                    key={i}
                    onClick={() => handleNotificationClick(n)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`w-full bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex items-start gap-6 group text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 ${isHomeworkNotification(n) ? 'hover:bg-white/[0.04] cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      n.type === 'attendance' ? 'bg-orange-500/10 text-orange-500' :
                      n.type === 'payment' ? 'bg-green-500/10 text-green-500' :
                      n.type === 'achievement' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-red-600/10 text-red-600'
                    }`}>
                      {n.type === 'attendance' ? <Calendar size={24} /> :
                       n.type === 'payment' ? <CreditCard size={24} /> :
                       n.type === 'achievement' ? <Trophy size={24} /> :
                       <AlertCircle size={24} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          n.type === 'attendance' ? 'text-orange-500' :
                          n.type === 'payment' ? 'text-green-500' :
                          n.type === 'achievement' ? 'text-yellow-500' :
                          'text-red-500'
                        }`}>
                          {n.type === 'attendance' ? 'Відвідуваність' :
                           n.type === 'payment' ? 'Оплата' :
                           n.type === 'achievement' ? 'Досягнення' :
                           'Повідомлення'}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                          {new Date(n.created_at).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed">{n.message}</p>
                    </div>
                  </motion.button>
                )) : (
                  <div className="p-20 text-center bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5">
                    <AlertCircle size={48} className="mx-auto text-zinc-700 mb-4 opacity-20" />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Сповіщень поки немає</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Повідомлення від <span className="text-red-600">додзьо</span></h2>
              
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 h-[500px] flex flex-col">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                      {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
                          Історія повідомлень порожня
                        </div>
                      ) : (
                        messages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.sender_type === 'parent' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                              msg.sender_type === 'parent' 
                              ? 'bg-red-600 text-white rounded-tr-none' 
                              : 'bg-white/5 text-zinc-300 rounded-tl-none border border-white/5'
                            }`}>
                              <p>{msg.content}</p>
                              <div className={`text-[8px] mt-1 font-bold uppercase tracking-widest ${
                                msg.sender_type === 'parent' ? 'text-white/50' : 'text-zinc-500'
                              }`}>
                                {new Date(msg.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-white/5 flex gap-3">
                      <input 
                        type="text"
                        value={coachMessage}
                        onChange={(e) => setCoachMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Напишіть тренеру..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-600/50 transition-all"
                      />
                      <button 
                        onClick={handleSendMessage}
                        className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl transition-all shadow-lg shadow-red-600/20"
                      >
                        <MessageSquare size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tight">Оголошення</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {announcements.map(ann => (
                      <div key={ann.id} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 border-l-4 border-l-red-600">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-sm truncate">{ann.title}</div>
                          <div className="text-[8px] text-zinc-500">{new Date(ann.created_at).toLocaleDateString()}</div>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-3">
                          {ann.content}
                        </p>
                      </div>
                    ))}
                    {announcements.length === 0 && (
                      <div className="p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500 text-xs">
                        Оголошень немає
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BELT PROGRESS SECTION REMOVED FROM HERE */}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default ParentPanel;

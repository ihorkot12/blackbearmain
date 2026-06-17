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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
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
      const [pRes, aRes, bRes, eventRes, pointsRes, notesRes, ratingsRes, sRes, cRes, payRes, annRes, notifRes] = await Promise.all([
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
        parentFetch('/api/parent/notifications')
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

  const bestAthlete = ratingsSummary?.bestAthlete;
  const currentRank = ratingsSummary?.currentChild?.rank_position;
  const currentPoints = ratingsSummary?.currentChild?.total_points ?? participant?.rank_points ?? 0;
  const totalAchievements = badges.length + events.length;
  const currentSkillChecklist = normalizeSkillChecklist(participant?.skill_checklist);

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
        
        {/* Child Mode Header */}
        <div className="fixed top-0 left-0 right-0 h-20 bg-zinc-900 border-b border-white/5 z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
              <Trophy className="text-white" size={20} />
            </div>
            <span className="text-lg font-black uppercase tracking-tighter">Шлях <span className="text-red-600">Воїна</span></span>
          </div>
          <button 
            onClick={() => setIsChildMode(false)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/5"
          >
            Батьківський режим
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
                    {participant?.group_name}
                  </span>
                  <span className="px-4 py-1.5 bg-red-600/20 rounded-full text-xs font-bold text-red-500 border border-red-600/20">
                    {normalizeBeltName(participant?.belt)} пояс
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-center bg-white/5 p-4 rounded-3xl border border-white/5 min-w-[100px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Streak</div>
                  <div className="text-2xl font-black text-orange-500 flex items-center justify-center gap-1">
                    <Flame size={20} />
                    {participant?.streak || 0}
                  </div>
                </div>
                <div className="text-center bg-white/5 p-4 rounded-3xl border border-white/5 min-w-[100px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Points</div>
                  <div className="text-2xl font-black text-yellow-500 flex items-center justify-center gap-1">
                    <Star size={20} />
                    {participant?.rank_points || 0}
                  </div>
                </div>
              </div>
            </div>
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
                  <div className="text-4xl font-black text-white mb-1">{clampProgress(participant?.exam_readiness)}%</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Готовність до іспиту</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-zinc-300 mb-1">Наступний: Жовтий</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Залишилось 20%</div>
                </div>
              </div>
              <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${clampProgress(participant?.exam_readiness)}%` }}
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                />
              </div>
            </div>
          </section>

          {/* Badges Grid */}
          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-tight px-2">Мої Нагороди</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['Дисципліна', 'Техніка', 'Сила', 'Швидкість'].map((badge, i) => (
                <div key={i} className="bg-zinc-900/30 p-6 rounded-[2.5rem] border border-white/5 flex flex-col items-center text-center group hover:bg-white/5 transition-all cursor-pointer">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Award className={i < 2 ? "text-yellow-500" : "text-zinc-700"} size={32} />
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${i < 2 ? "text-white" : "text-zinc-600"}`}>{badge}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Next Class Alert */}
          <section className="bg-red-600 p-8 rounded-[3rem] shadow-2xl shadow-red-600/20 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Наступне тренування</div>
              <div className="text-2xl font-black text-white">Сьогодні о 18:00</div>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Zap className="text-white" size={32} />
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
            className="fixed inset-0 z-[55] bg-zinc-950 lg:hidden p-8 pt-24"
          >
            <div className="space-y-2">
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
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
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
                className="w-full flex items-center gap-4 px-6 py-4 text-zinc-500 hover:text-red-500 transition-colors font-bold mt-8"
              >
                <LogOut size={20} />
                Вийти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Mobile Nav */}
      <div className="fixed top-0 left-0 bottom-0 w-80 bg-zinc-950 border-r border-white/5 z-50 hidden lg:flex flex-col p-8">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.3)]">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter">Black Bear <span className="text-zinc-600">Dojo</span></span>
          </div>
          
          <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 mb-8">
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
        </div>

        <nav className="space-y-2 flex-1">
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
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
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

        <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
          <button 
            id="child-mode-button"
            onClick={() => setIsChildMode(true)}
            className="w-full flex items-center gap-4 px-6 py-4 bg-red-600/10 text-red-500 rounded-2xl font-bold hover:bg-red-600/20 transition-all border border-red-600/20"
          >
            <Trophy size={20} />
            Дитячий режим
          </button>
          <button 
            id="parent-logout-button"
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 text-zinc-500 hover:text-red-500 transition-colors font-bold"
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
            <div className="space-y-12">
              <header>
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Вітаємо, <span className="text-red-600">батьки!</span></h1>
                <p className="text-zinc-500 font-medium max-w-2xl">Слідкуйте за успіхами вашої дитини в реальному часі.</p>
              </header>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Activity size={80} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Відвідуваність</div>
                  <div className="text-4xl font-black mb-2">{attendance.length}</div>
                  <div className="text-xs text-zinc-400">занять всього</div>
                </div>
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Award size={80} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Досягнення</div>
                  <div className="text-4xl font-black mb-2">{totalAchievements}</div>
                  <div className="text-xs text-zinc-400">відзнаки, семінари та події</div>
                </div>
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <MessageSquare size={80} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Telegram Сповіщення</div>
                  {participant?.telegram_chat_id ? (
                    <div className="flex items-center gap-2 text-green-500 font-bold mt-4">
                      <CheckCircle2 size={20} />
                      <span>Підключено</span>
                    </div>
                  ) : (
                    <button 
                      onClick={handleConnectTelegram}
                      className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                    >
                      Підключити
                    </button>
                  )}
                </div>
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <CreditCard size={80} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Статус оплати</div>
                  <div className={`text-xl font-black uppercase tracking-widest mt-4 px-4 py-2 rounded-xl inline-block ${
                    participant?.payment_status === 'paid' ? 'bg-green-500/20 text-green-500' : 'bg-red-600/20 text-red-500'
                  }`}>
                    {participant?.payment_status === 'paid' ? 'Оплачено' : 'Є заборгованість'}
                  </div>
                </div>
              </div>

              {(bestAthlete || currentRank) && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-amber-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Trophy size={96} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-4">Кращий спортсмен групи</div>
                    <div className="text-2xl font-black uppercase tracking-tight mb-2">{bestAthlete?.name || 'Поки немає даних'}</div>
                    <div className="text-sm text-zinc-400">{bestAthlete ? `${bestAthlete.total_points} балів • ${bestAthlete.attendance_count} відвідувань` : 'Рейтинг зʼявиться після перших балів'}</div>
                  </div>

                  <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Star size={96} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Місце вашої дитини</div>
                    <div className="text-4xl font-black mb-2">{currentRank ? `#${currentRank}` : '—'}</div>
                    <div className="text-sm text-zinc-400">{currentPoints} балів у поточному рейтингу групи</div>
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

              <section>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black uppercase tracking-tight">Останні сповіщення</h2>
                  <button 
                    onClick={() => setActiveTab('notifications')}
                    className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-500 transition-colors"
                  >
                    Всі сповіщення →
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {notifications.slice(0, 4).map((n, i) => (
                    <div key={i} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        n.type === 'attendance' ? 'bg-orange-500/10 text-orange-500' :
                        n.type === 'payment' ? 'bg-green-500/10 text-green-500' :
                        n.type === 'achievement' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-600/10 text-red-600'
                      }`}>
                        {n.type === 'attendance' ? <Calendar size={18} /> :
                         n.type === 'payment' ? <CreditCard size={18} /> :
                         n.type === 'achievement' ? <Trophy size={18} /> :
                         <AlertCircle size={18} />}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-300 line-clamp-2 mb-2">{n.message}</p>
                        <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                          {new Date(n.created_at).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="col-span-2 p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500 text-xs">
                      Сповіщень немає
                    </div>
                  )}
                </div>
              </section>
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
                        <div className="text-sm font-black uppercase tracking-widest text-zinc-300">Жовтий пояс</div>
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
                        <div className="text-xs text-zinc-400">{bestAthlete.total_points} балів</div>
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
                            <div className="text-[10px] text-zinc-500">{row.attendance_count || 0} відвідувань • {row.seminar_count || 0} семінарів</div>
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
            <HomeworkParentDiary participantId={participant?.id} />
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
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex items-start gap-6 group hover:bg-white/[0.02] transition-colors"
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
                  </motion.div>
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

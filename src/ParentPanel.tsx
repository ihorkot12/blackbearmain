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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';

const ParentPanel = () => {
  const [participant, setParticipant] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isChildMode, setIsChildMode] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ===== NEW STATE: Belt Progress, Attendance Streak =====
  const [beltProgress, setBeltProgress] = useState<any[] | null>(null);
  const [attendanceStreak, setAttendanceStreak] = useState<any[]>([]);
  const [coachMessage, setCoachMessage] = useState('');

  useEffect(() => {
    if (children && children.length > 0) {
      // Fetch belt progress for each child
      Promise.all(children.map(child => 
        fetch(`/api/parent/${participant?.id}/belt-progress`)
          .then(r => r.json())
      )).then(data => setBeltProgress(data[0]?.children || [])).catch(e => console.log(e));
      
      // Fetch attendance streak
      fetch(`/api/parent/${participant?.id}/attendance-streak`)
        .then(r => r.json())
        .then(data => setAttendanceStreak(data.children || []))
        .catch(e => console.log(e));
    }
  }, [participant?.id, children]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, aRes, bRes, sRes, cRes, payRes, annRes] = await Promise.all([
        fetch('/api/parent/me'),
        fetch('/api/parent/attendance'),
        fetch('/api/parent/badges'),
        fetch('/api/parent/schedule'),
        fetch('/api/parent/children'),
        fetch('/api/parent/payments'),
        fetch('/api/announcements')
      ]);

      if (pRes.status === 401) {
        window.location.href = '/auth?role=parent';
        return;
      }

      const pData = pRes.ok ? await pRes.json() : null;
      const aData = aRes.ok ? await aRes.json() : [];
      const bData = bRes.ok ? await bRes.json() : [];
      const sData = sRes.ok ? await sRes.json() : [];
      const cData = cRes.ok ? await cRes.json() : [];
      const payData = payRes.ok ? await payRes.json() : [];
      const annData = annRes.ok ? await annRes.json() : [];

      if (pData) setParticipant(pData);
      setAttendance(aData);
      setBadges(bData);
      setSchedule(sData);
      setChildren(cData);
      setPayments(payData);
      setAnnouncements(annData);
    } catch (e) {
      toast.error('Помилка завантаження даних');
    }
    setLoading(false);
  };

  const handleSwitchChild = async (childId: number) => {
    try {
      const res = await fetch('/api/parent/switch-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId })
      });
      if (res.ok) {
        fetchData();
        toast.success('Дитину змінено');
      }
    } catch (e) {
      toast.error('Не вдалося змінити дитину');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

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
                    {participant?.belt} пояс
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
                  <div className="text-4xl font-black text-white mb-1">{participant?.exam_readiness || 0}%</div>
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
                  animate={{ width: `${participant?.exam_readiness || 0}%` }}
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
                { id: 'payments', label: 'Оплата', icon: CreditCard },
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
                <div className="text-sm font-bold text-zinc-300">{participant?.belt || 'Білий'}</div>
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
            { id: 'payments', label: 'Оплата', icon: CreditCard },
            { id: 'messages', label: 'Повідомлення', icon: MessageSquare },
          ].map(item => (
            <button
              key={item.id}
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
            onClick={() => setIsChildMode(true)}
            className="w-full flex items-center gap-4 px-6 py-4 bg-red-600/10 text-red-500 rounded-2xl font-bold hover:bg-red-600/20 transition-all border border-red-600/20"
          >
            <Trophy size={20} />
            Дитячий режим
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 text-zinc-500 hover:text-red-500 transition-colors font-bold"
          >
            <LogOut size={20} />
            Вийти
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-80 min-h-screen pt-20 lg:pt-0">
        <div className="p-8 lg:p-12 max-w-6xl mx-auto">
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
                          {child.belt} пояс
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
                          <div className="text-xs font-black text-white">{child.exam_readiness || 0}%</div>
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
                  <div className="text-4xl font-black mb-2">{badges.length}</div>
                  <div className="text-xs text-zinc-400">отримано відзнак</div>
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

                <section>
                  <h2 className="text-2xl font-black uppercase tracking-tight mb-8">Останні досягнення</h2>
                  <div className="space-y-4">
                    {badges.length > 0 ? badges.slice(0, 3).map((badge, i) => (
                      <div key={i} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex items-center gap-6">
                        <div className="w-14 h-14 bg-red-600/10 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                          <Trophy size={28} />
                        </div>
                        <div>
                          <div className="font-bold text-lg">{badge.type}</div>
                          <div className="text-xs text-zinc-500">{new Date(badge.date).toLocaleDateString('uk-UA')}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500">
                        Досягнень поки немає
                      </div>
                    )}
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
                    <div className="text-3xl font-black mb-2">{participant?.belt} Пояс</div>
                    <div className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{participant?.rank_points} балів рейтингу</div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tight">Готовність до іспиту</h3>
                  <div className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <div className="text-4xl font-black text-white mb-1">{participant?.exam_readiness || 0}%</div>
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
                        animate={{ width: `${participant?.exam_readiness || 0}%` }}
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                      />
                    </div>
                    
                    <div className="mt-10">
                      <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-6 px-2">Чек-лист навичок</div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(participant?.skill_checklist || '').split(',').map((skill: string, i: number) => (
                          skill.trim() && (
                            <div key={i} className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                              <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <ShieldCheck size={14} className="text-green-500" />
                              </div>
                              <span className="text-sm font-bold text-zinc-300">{skill.trim()}</span>
                            </div>
                          )
                        ))}
                        {(!participant?.skill_checklist || participant?.skill_checklist.trim() === '') && (
                          <div className="col-span-2 text-center p-8 text-zinc-500 italic text-sm">Чек-лист поки порожній</div>
                        )}
                      </div>
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

          {activeTab === 'messages' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Повідомлення від <span className="text-red-600">додзьо</span></h2>
              <div className="space-y-4">
                {announcements.map(ann => (
                  <div key={ann.id} className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 border-l-4 border-l-red-600">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-black uppercase tracking-tight text-xl">{ann.title}</div>
                      <div className="text-xs text-zinc-500">{new Date(ann.created_at).toLocaleString('uk-UA')}</div>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <div className="p-20 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
                    Повідомлень поки немає
                  </div>
                )}
              </div>
            </div>
          )}

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
                  <p className="text-sm text-zinc-400">Поточний пояс: <span className="font-black text-orange-500 uppercase tracking-widest text-xs">{child.belt_level || 'Не вказано'}</span></p>
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
              onClick={() => {
                toast.success('Повідомлення надіслано тренеру!');
                setCoachMessage('');
              }}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              Надіслати повідомлення
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ParentPanel;

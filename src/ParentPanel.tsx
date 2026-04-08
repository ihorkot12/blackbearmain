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
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';

const ParentPanel = () => {
  const [participant, setParticipant] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, aRes, bRes, sRes, cRes] = await Promise.all([
        fetch('/api/parent/me'),
        fetch('/api/parent/attendance'),
        fetch('/api/parent/badges'),
        fetch('/api/parent/schedule'),
        fetch('/api/parent/children')
      ]);

      if (pRes.status === 401) {
        window.location.href = '/login?role=parent';
        return;
      }

      const pData = pRes.ok ? await pRes.json() : null;
      const aData = aRes.ok ? await aRes.json() : [];
      const bData = bRes.ok ? await bRes.json() : [];
      const sData = sRes.ok ? await sRes.json() : [];
      const cData = cRes.ok ? await cRes.json() : [];

      if (pData) setParticipant(pData);
      setAttendance(aData);
      setBadges(bData);
      setSchedule(sData);
      setChildren(cData);
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
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-400"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
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

        <button 
          onClick={handleLogout}
          className="mt-auto flex items-center gap-4 px-6 py-4 text-zinc-500 hover:text-red-500 transition-colors font-bold"
        >
          <LogOut size={20} />
          Вийти
        </button>
      </div>

      {/* Main Content */}
      <main className="lg:pl-80 min-h-screen pt-20 lg:pt-0">
        <div className="p-8 lg:p-12 max-w-6xl mx-auto">
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
              <div className="bg-zinc-900/30 rounded-[2.5rem] border border-white/5 overflow-hidden">
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
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Прогрес та <span className="text-red-600">досягнення</span></h2>
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
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
                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tight">Всі відзнаки</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {badges.map((badge, i) => (
                      <div key={i} className="bg-zinc-900/30 p-6 rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:bg-red-600/5 transition-colors">
                        <div className="w-12 h-12 bg-red-600/10 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Award size={24} />
                        </div>
                        <div className="font-bold text-sm">{badge.type}</div>
                        <div className="text-[10px] text-zinc-500 mt-1">{new Date(badge.date).toLocaleDateString()}</div>
                      </div>
                    ))}
                    {badges.length === 0 && (
                      <div className="col-span-2 p-12 text-center bg-zinc-900/20 rounded-3xl border border-dashed border-white/5 text-zinc-500">
                        Відзнак поки немає
                      </div>
                    )}
                  </div>
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
                
                <div className="bg-zinc-900/30 rounded-[2.5rem] border border-white/5 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Місяць</th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Сума</th>
                        <th className="p-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-8 font-bold">Квітень 2026</td>
                        <td className="p-8">1500 грн</td>
                        <td className="p-8">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-500">Оплачено</span>
                        </td>
                      </tr>
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-8 font-bold">Березень 2026</td>
                        <td className="p-8">1500 грн</td>
                        <td className="p-8">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-500">Оплачено</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tighter">Повідомлення від <span className="text-red-600">додзьо</span></h2>
              <div className="space-y-4">
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 border-l-4 border-l-red-600">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-black uppercase tracking-tight text-xl">Зміна розкладу на свята</div>
                    <div className="text-xs text-zinc-500">Сьогодні, 10:45</div>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Шановні батьки! Зверніть увагу, що у зв'язку зі святами, тренування в понеділок буде перенесено на 18:00.
                  </p>
                </div>
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-black uppercase tracking-tight text-xl">Атестація на пояси</div>
                    <div className="text-xs text-zinc-500">Вчора, 15:20</div>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Нагадуємо, що наступна атестація відбудеться 25 квітня. Прохання перевірити наявність допуску у тренера.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ParentPanel;

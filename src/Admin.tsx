import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Users, MessageSquare, LogOut, Save, Image as ImageIcon, 
  Plus, Trash2, MapPin, Clock, UserCheck, RefreshCw, 
  LayoutDashboard, Calendar, Search, ChevronRight, ChevronLeft, 
  Filter, CheckCircle2, XCircle, MoreVertical, Edit2, 
  TrendingUp, Activity, UserPlus, Award, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Bell, SearchIcon, Menu, X, AlertCircle, Eye, Shield,
  Smile, Trophy, Zap, Target, Heart, FileUp, Link
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Cell, Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster } from 'sonner';

// --- Custom Confirmation Modal ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, loading }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl -mr-16 -mt-16" />
          
          <div className="w-16 h-16 bg-red-600/10 text-red-600 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          
          <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{title}</h3>
          <p className="text-zinc-500 font-medium mb-8">{message}</p>
          
          <div className="flex gap-4">
            <button 
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {loading ? 'Видалення...' : 'Так, видалити'}
            </button>
            <button 
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
            >
              Скасувати
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const LoginPage = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: login.trim(), password: password.trim() })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.role === 'coach' || data.role === 'admin') {
        localStorage.setItem('admin_token', data.token);
        navigate('/admin');
      } else {
        localStorage.setItem('parent_token', data.token);
        navigate('/profile');
      }
    } else {
      setError('Неправильний логін або пароль');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md w-full bg-zinc-900 p-8 rounded-2xl border border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Вхід для адміністратора</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Логін</label>
            <input type="text" value={login} onChange={e => setLogin(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex flex-col gap-4">
            <button type="submit" className="w-full bg-red-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">Увійти</button>
          </div>
        </form>
        <div className="mt-6 pt-6 border-t border-white/5">
          <button 
            onClick={() => navigate('/')}
            className="w-full text-zinc-500 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            ← На головну
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ onQuickAction }: { onQuickAction: (tab: string, action?: string) => void }) => {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('admin_token');
      try {
        const res = await fetch('/api/dashboard/stats', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }).then(r => r.json());
        
        if (res.error) throw new Error(res.error);
        
        setStats(res.totals || {});
        setChartData({
          leadsOverTime: res.leadsOverTime || [],
          groupDistribution: res.groupDistribution || [],
          recentLeads: res.recentLeads || []
        });
      } catch (e) {
        console.error('Dashboard fetch failed', e);
        setStats({});
        setChartData({
          leadsOverTime: [],
          groupDistribution: [],
          recentLeads: []
        });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <RefreshCw className="animate-spin text-red-600" size={48} />
    </div>
  );

  const statCards = [
    { title: 'Всього учнів', value: stats?.total_participants || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Нові заявки', value: stats?.new_leads || 0, icon: Activity, color: 'text-red-500', bg: 'bg-red-500/10' },
    { title: 'Груп', value: stats?.total_locations || 0, icon: MapPin, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Тренерів', value: stats?.total_coaches || 0, icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-12 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black uppercase tracking-tighter mb-3">Головна</h2>
          <p className="text-zinc-500 font-medium text-lg">Огляд активності та ключові показники клубу</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-zinc-900/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Сьогодні</p>
            <p className="text-white font-black uppercase tracking-tight">{new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-900/30 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 relative group hover:border-white/10 transition-all"
          >
            <div className={`w-14 h-14 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
              <card.icon size={28} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{card.title}</p>
            <p className="text-4xl font-black uppercase tracking-tighter">{card.value}</p>
            <div className="absolute top-8 right-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <card.icon size={64} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-900/30 backdrop-blur-md p-10 rounded-[3rem] border border-white/5">
          <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
            <Activity size={24} className="text-red-600" />
            Динаміка заявок
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData?.leadsOverTime || []}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickFormatter={(val) => val ? new Date(val).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : ''}
                />
                <YAxis stroke="#ffffff20" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={4} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900/30 backdrop-blur-md p-10 rounded-[3rem] border border-white/5">
          <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
            <MapPin size={24} className="text-red-600" />
            Розподіл по групах
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData?.groupDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="count"
                  nameKey="group_name"
                >
                  {(chartData?.groupDistribution || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2'][index % 5]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900/30 backdrop-blur-md p-10 rounded-[3rem] border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <Activity size={24} className="text-red-600" />
              Останні заявки
            </h3>
            <button 
              onClick={() => onQuickAction('leads')}
              className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-500 transition-colors"
            >
              Всі заявки →
            </button>
          </div>
          <div className="space-y-4">
            {(chartData?.recentLeads || []).map((lead: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-5 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl border border-white/5 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600/10 text-red-600 rounded-xl flex items-center justify-center font-black text-lg">
                    {lead.name ? lead.name[0] : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{lead.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">{lead.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    lead.status === 'new' ? 'bg-red-600/20 text-red-500' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {lead.status === 'new' ? 'Нова' : lead.status}
                  </span>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase mt-2">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
            {(!chartData?.recentLeads || chartData.recentLeads.length === 0) && (
              <div className="text-center py-10 text-zinc-500 font-bold italic">Заявок поки немає</div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/30 backdrop-blur-md p-10 rounded-[3rem] border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(220,38,38,0.1)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="w-24 h-24 bg-red-600/10 text-red-600 rounded-3xl flex items-center justify-center mb-8 rotate-3 group-hover:rotate-6 transition-transform duration-500">
            <LayoutDashboard size={48} />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Швидкі дії</h3>
          <p className="text-zinc-500 text-sm font-medium mb-10 max-w-xs leading-relaxed">Керуйте розкладом, контентом та учасниками в один клік.</p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button 
              onClick={() => onQuickAction('participants', 'add')}
              className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:-translate-y-1"
            >
              Додати учня
            </button>
            <button 
              onClick={() => onQuickAction('schedule', 'add')}
              className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all border border-white/5 hover:-translate-y-1"
            >
              Редагувати розклад
            </button>
            <button 
              onClick={() => onQuickAction('content', 'video')}
              className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all border border-white/5 hover:-translate-y-1"
            >
              Контент сайту
            </button>
            <button 
              onClick={() => onQuickAction('leads')}
              className="px-6 py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all border border-white/5 hover:-translate-y-1"
            >
              Звіти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialAction, setInitialAction] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        navigate('/login');
        return;
      }
      const res = await fetch('/api/check-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        localStorage.removeItem('admin_token');
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleQuickAction = (tab: string, action?: string) => {
    setActiveTab(tab);
    if (action) {
      setInitialAction(action);
    }
  };

  const menuGroups = [
    {
      title: 'Операційка',
      items: [
        { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
        { id: 'attendance', label: 'Відвідуваність', icon: Calendar },
        { id: 'rating', label: 'Рейтинг', icon: Award },
        { id: 'participants', label: 'Учасники', icon: UserCheck },
        { id: 'schedule', label: 'Розклад', icon: Clock },
      ]
    },
    {
      title: 'Управління',
      items: [
        { id: 'leads', label: 'Заявки', icon: MessageSquare },
        { id: 'content', label: 'Конструктор', icon: Settings },
        { id: 'coaches', label: 'Тренери', icon: Users },
        { id: 'locations', label: 'Локації', icon: MapPin },
        { id: 'settings', label: 'Налаштування', icon: Activity },
      ]
    }
  ];

  const visibleGroups = menuGroups;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex font-sans selection:bg-red-600/30">
      <Toaster position="top-right" theme="dark" richColors />
      {/* Sidebar */}
      <div className="w-72 bg-zinc-950 border-r border-white/5 flex flex-col sticky top-0 h-screen z-40">
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center rotate-3 shadow-[0_0_30px_rgba(220,38,38,0.4)] rounded-xl">
              <span className="text-white font-black italic text-xl">B</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tighter text-xl uppercase leading-none">Black Bear</span>
              <span className="text-red-600 font-bold text-[10px] uppercase tracking-[0.4em] mt-1">
                Панель управління
              </span>
            </div>
          </div>
          
          <nav className="space-y-8">
            {visibleGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3">
                <h3 className="px-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{group.title}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative ${
                        activeTab === item.id 
                          ? 'text-white' 
                          : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {activeTab === item.id && (
                        <motion.div 
                          layoutId="active-tab"
                          className="absolute inset-0 bg-red-600 rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.3)]"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <item.icon size={20} className={`relative z-10 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110 transition-transform'}`} />
                      <span className="relative z-10 font-black uppercase tracking-widest text-[10px]">{item.label}</span>
                      {activeTab === item.id && <ChevronRight size={14} className="relative z-10 ml-auto opacity-50" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-8 space-y-2 border-t border-white/5 bg-zinc-950/50">
          <button 
            onClick={() => {
              localStorage.removeItem('admin_token');
              navigate('/');
            }}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-zinc-500 hover:bg-red-600/10 hover:text-red-500 transition-all duration-300 group border border-transparent hover:border-red-600/20"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-black uppercase tracking-widest text-[10px]">Вийти на сайт</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen flex flex-col bg-[radial-gradient(circle_at_50%_0%,_rgba(220,38,38,0.03)_0%,_transparent_50%)]">
        {/* Top Bar */}
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 sticky top-0 bg-black/50 backdrop-blur-xl z-30">
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            <div className="relative w-full group">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-red-600 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Швидкий пошук..." 
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium outline-none focus:border-red-600/50 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative p-3 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-black" />
            </button>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-black uppercase tracking-tight">Ігор Котляревський</p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Головний тренер</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-600/20">
                І
              </div>
            </div>
          </div>
        </header>

        <main className="p-12 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && <Dashboard onQuickAction={handleQuickAction} />}
              {activeTab === 'content' && <ContentEditor initialAction={initialAction} onActionComplete={() => setInitialAction(null)} />}
              {activeTab === 'leads' && <LeadsViewer />}
              {activeTab === 'coaches' && <CoachesEditor />}
              {activeTab === 'locations' && <LocationsEditor />}
              {activeTab === 'schedule' && <ScheduleEditor initialAction={initialAction} onActionComplete={() => setInitialAction(null)} />}
              {activeTab === 'participants' && <ParticipantsEditor initialAction={initialAction} onActionComplete={() => setInitialAction(null)} />}
              {activeTab === 'attendance' && <AttendanceEditor />}
              {activeTab === 'rating' && <RatingEditor />}
              {activeTab === 'settings' && <SettingsEditor />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const RatingEditor = () => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRank, setEditingRank] = useState<any>(null);
  const [showBadgeModal, setShowBadgeModal] = useState<any>(null);
  const [showCompModal, setShowCompModal] = useState<any>(null);
  const [showDetails, setShowDetails] = useState<any>(null);
  const [badgeType, setBadgeType] = useState('');
  const [compName, setCompName] = useState('');
  const [compResult, setCompResult] = useState('');
  const [detailsData, setDetailsData] = useState<{badges: any[], competitions: any[]}>({badges: [], competitions: []});

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/participants', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setParticipants(data);
    } catch (e) {
      toast.error('Помилка завантаження учасників');
    }
    setLoading(false);
  };

  const fetchDetails = async (participantId: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      const [bRes, cRes] = await Promise.all([
        fetch(`/api/participants/${participantId}/badges`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/participants/${participantId}/competitions`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const badges = await bRes.json();
      const competitions = await cRes.json();
      setDetailsData({ badges, competitions });
    } catch (e) {
      toast.error('Помилка завантаження деталей');
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  useEffect(() => {
    if (showDetails) {
      fetchDetails(showDetails.id);
    }
  }, [showDetails]);

  const handleUpdateRank = async (id: number, belt: string, points: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/participants/${id}/rank`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ belt, rank_points: points })
      });
      if (res.ok) {
        toast.success('Рейтинг оновлено');
        setEditingRank(null);
        fetchParticipants();
      }
    } catch (e) {
      toast.error('Помилка оновлення');
    }
  };

  const handleAddBadge = async (participantId: number) => {
    if (!badgeType) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/badges', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ participant_id: participantId, type: badgeType })
      });
      if (res.ok) {
        toast.success('Досягнення додано');
        setShowBadgeModal(null);
        setBadgeType('');
        fetchParticipants(); // Refresh main list for points
        if (showDetails?.id === participantId) fetchDetails(participantId);
      }
    } catch (e) {
      toast.error('Помилка');
    }
  };

  const handleAddComp = async (participantId: number) => {
    if (!compName) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          participant_id: participantId, 
          name: compName, 
          result: compResult,
          date: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) {
        toast.success('Результат змагань додано');
        setShowCompModal(null);
        setCompName('');
        setCompResult('');
        fetchParticipants(); // Refresh main list for points
        if (showDetails?.id === participantId) fetchDetails(participantId);
      }
    } catch (e) {
      toast.error('Помилка');
    }
  };

  const handleDeleteBadge = async (id: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/badges/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Досягнення видалено');
        fetchParticipants(); // Refresh main list for points
        if (showDetails) fetchDetails(showDetails.id);
      }
    } catch (e) {
      toast.error('Помилка видалення');
    }
  };

  const handleDeleteComp = async (id: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Запис видалено');
        fetchParticipants(); // Refresh main list for points
        if (showDetails) fetchDetails(showDetails.id);
      }
    } catch (e) {
      toast.error('Помилка видалення');
    }
  };

  const belts = [
    'Білий', 'Оранжевий', 'Оранжевий з синьою смужкою', 
    'Синій', 'Синій з жовтою смужкою', 
    'Жовтий', 'Жовтий з зеленою смужкою', 
    'Зелений', 'Зелений з коричневою смужкою', 
    'Коричневий', 'Коричневий з золотою смужкою', 
    'Чорний'
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase tracking-tight">Рейтинг та досягнення</h2>
        <button 
          onClick={fetchParticipants}
          className="bg-zinc-900 hover:bg-zinc-800 text-white p-4 rounded-2xl transition-all border border-white/5"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/50 border-b border-white/5">
            <tr>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Учень</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Група</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Пояс</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Бали</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {participants.map(p => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="p-6 font-bold">{p.name}</td>
                <td className="p-6 text-sm text-zinc-500">{p.group_name}</td>
                <td className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-8 rounded-full ${
                      p.belt?.includes('Білий') ? 'bg-white' :
                      p.belt?.includes('Оранжевий') ? 'bg-orange-500' :
                      p.belt?.includes('Синій') ? 'bg-blue-600' :
                      p.belt?.includes('Жовтий') ? 'bg-yellow-400' :
                      p.belt?.includes('Зелений') ? 'bg-green-600' :
                      p.belt?.includes('Коричневий') ? 'bg-amber-800' :
                      p.belt?.includes('Чорний') ? 'bg-zinc-950 border border-white/20' : 'bg-zinc-700'
                    }`} />
                    <span className="font-bold text-sm">{p.belt || 'Білий'}</span>
                  </div>
                </td>
                <td className="p-6 font-mono text-red-500 font-bold">{p.rank_points || 0}</td>
                <td className="p-6">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowDetails(p)}
                      className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Деталі"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => setEditingRank(p)}
                      className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Редагувати ранг"
                    >
                      <Award size={18} />
                    </button>
                    <button 
                      onClick={() => setShowBadgeModal(p)}
                      className="p-2 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Додати досягнення"
                    >
                      <Plus size={18} />
                    </button>
                    <button 
                      onClick={() => setShowCompModal(p)}
                      className="p-2 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Додати змагання"
                    >
                      <TrendingUp size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] border border-white/10 p-8 space-y-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tight">{showDetails.name}</h3>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">{showDetails.group_name}</p>
                </div>
                <button onClick={() => setShowDetails(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Award size={14} className="text-amber-500" />
                    Досягнення
                  </h4>
                  <div className="space-y-2">
                    {detailsData.badges.length === 0 ? (
                      <p className="text-zinc-600 text-sm italic">Немає досягнень</p>
                    ) : (
                      detailsData.badges.map(b => (
                        <div key={b.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                          <div>
                            <p className="font-bold text-sm">{b.type}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(b.date).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => handleDeleteBadge(b.id)} className="text-zinc-600 hover:text-red-500 p-2">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <TrendingUp size={14} className="text-blue-500" />
                    Змагання
                  </h4>
                  <div className="space-y-2">
                    {detailsData.competitions.length === 0 ? (
                      <p className="text-zinc-600 text-sm italic">Немає записів</p>
                    ) : (
                      detailsData.competitions.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                          <div>
                            <p className="font-bold text-sm">{c.name}</p>
                            <p className="text-xs text-blue-500 font-bold">{c.result}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{new Date(c.date).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => handleDeleteComp(c.id)} className="text-zinc-600 hover:text-red-500 p-2">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Rank Modal */}
      <AnimatePresence>
        {editingRank && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-6"
            >
              <h3 className="text-2xl font-black uppercase tracking-tight">Ранг: {editingRank.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Пояс</label>
                  <select 
                    value={editingRank.belt}
                    onChange={e => setEditingRank({...editingRank, belt: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
                  >
                    {belts.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Бали рейтингу</label>
                  <input 
                    type="number"
                    value={editingRank.rank_points}
                    onChange={e => setEditingRank({...editingRank, rank_points: parseInt(e.target.value)})}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handleUpdateRank(editingRank.id, editingRank.belt, editingRank.rank_points)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Зберегти
                </button>
                <button 
                  onClick={() => setEditingRank(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Скасувати
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Badge Modal */}
      <AnimatePresence>
        {showBadgeModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-6"
            >
              <h3 className="text-2xl font-black uppercase tracking-tight">Нове досягнення</h3>
              <p className="text-zinc-500 text-sm font-medium">Додати нагороду для {showBadgeModal.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Тип досягнення</label>
                  <input 
                    type="text"
                    placeholder="Наприклад: Кращий технік місяця"
                    value={badgeType}
                    onChange={e => setBadgeType(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handleAddBadge(showBadgeModal.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Додати
                </button>
                <button 
                  onClick={() => setShowBadgeModal(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Скасувати
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Competition Modal */}
      <AnimatePresence>
        {showCompModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-6"
            >
              <h3 className="text-2xl font-black uppercase tracking-tight">Результат змагань</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Назва турніру</label>
                  <input 
                    type="text"
                    value={compName}
                    onChange={e => setCompName(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Результат (місце)</label>
                  <input 
                    type="text"
                    placeholder="Наприклад: 1 місце"
                    value={compResult}
                    onChange={e => setCompResult(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handleAddComp(showCompModal.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Зберегти
                </button>
                <button 
                  onClick={() => setShowCompModal(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all"
                >
                  Скасувати
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingsEditor = () => {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      toast.error('Помилка завантаження налаштувань');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success('Налаштування збережено');
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      return toast.error('Паролі не співпадають');
    }
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          currentPassword: passwords.current, 
          newPassword: passwords.new 
        })
      });
      if (res.ok) {
        toast.success('Пароль змінено');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Помилка зміни пароля');
      }
    } catch (e) {
      toast.error('Помилка');
    }
  };

  if (loading) return <div className="p-20 text-center text-zinc-500">Завантаження...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-black uppercase tracking-tight">Налаштування системи</h2>
        <button 
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {saving ? 'Збереження...' : 'Зберегти зміни'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8">
          <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
            <Bell size={20} className="text-red-600" />
            Сповіщення
          </h3>
          <div className="space-y-4">
            {[
              { key: 'notify_email', label: 'Нові заявки на email' },
              { key: 'notify_attendance', label: 'Звіти про відвідуваність' },
              { key: 'notify_payments', label: 'Нагадування про оплату' },
              { key: 'notify_updates', label: 'Системні оновлення' }
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                <span className="font-bold text-sm">{item.label}</span>
                <button 
                  onClick={() => setSettings({...settings, [item.key]: settings[item.key] === 'true' ? 'false' : 'true'})}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings[item.key] === 'true' ? 'bg-red-600' : 'bg-zinc-700'}`}
                >
                  <motion.div 
                    animate={{ x: settings[item.key] === 'true' ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full" 
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] p-8">
          <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
            <Activity size={20} className="text-red-600" />
            Безпека
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Поточний пароль</label>
              <input 
                type="password"
                value={passwords.current}
                onChange={e => setPasswords({...passwords, current: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Новий пароль</label>
              <input 
                type="password"
                value={passwords.new}
                onChange={e => setPasswords({...passwords, new: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">Підтвердіть пароль</label>
              <input 
                type="password"
                value={passwords.confirm}
                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-red-600/50 transition-all"
              />
            </div>
            <button 
              onClick={handleChangePassword}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all mt-2"
            >
              Оновити пароль
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ParticipantsEditor = ({ initialAction, onActionComplete }: { initialAction?: string | null, onActionComplete?: () => void }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importGroupId, setImportGroupId] = useState('');

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const [pRes, gRes] = await Promise.all([
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/groups').then(r => r.json())
      ]);
      setParticipants(Array.isArray(pRes) ? pRes : []);
      setGroups(Array.isArray(gRes) ? gRes : []);
    } catch (e) {
      console.error('Fetch participants failed', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialAction === 'add' && groups.length > 0) {
      setEditingParticipant({ name: '', age: '', group_id: groups[0]?.id || '', parent_login: '', parent_password: '' });
      onActionComplete?.();
    }
  }, [initialAction, groups]);

  const handleSave = async (data: any) => {
    const token = localStorage.getItem('admin_token');
    try {
      const url = data.id ? `/api/participants/${data.id}` : '/api/participants';
      const method = data.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setEditingParticipant(null);
        fetchData();
        toast.success(data.id ? 'Дані оновлено' : 'Учасника збережено');
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`/api/participants/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Учасника видалено');
      fetchData();
    } catch (e) {
      toast.error('Помилка видалення');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  const handleImport = async () => {
    if (!importFile && !importUrl) {
      toast.error('Оберіть файл або вкажіть посилання');
      return;
    }
    setImportLoading(true);
    const token = localStorage.getItem('admin_token');
    const formData = new FormData();
    if (importFile) formData.append('file', importFile);
    if (importUrl) formData.append('sheetUrl', importUrl);
    formData.append('group_id', importGroupId);

    try {
      const res = await fetch('/api/participants/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Імпортовано ${data.count} учасників`);
        setShowImportModal(false);
        setImportFile(null);
        setImportUrl('');
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast.error(e.message || 'Помилка імпорту');
    }
    setImportLoading(false);
  };

  const filtered = participants.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Учасники</h2>
          <p className="text-zinc-500 font-medium">Керування базою учнів клубу</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-white/5 flex items-center gap-3"
          >
            <FileUp size={18} />
            Імпорт
          </button>
          <button 
            onClick={() => setEditingParticipant({ name: '', age: '', group_id: groups[0]?.id || '', parent_login: '', parent_password: '' })}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] flex items-center gap-3"
          >
            <Plus size={18} />
            Додати учня
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Пошук за ім'ям..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-red-600 transition-colors"
          />
        </div>
        <button className="bg-zinc-900 border border-white/5 p-4 rounded-2xl text-zinc-500 hover:text-white transition-colors">
          <Filter size={18} />
        </button>
      </div>

      <div className="bg-zinc-900/30 rounded-[3rem] border border-white/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5">
              <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Учень</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Вік</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Група</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Батьківський вхід</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                <td className="p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-600/10 text-red-600 rounded-full flex items-center justify-center font-black">
                      {p.name[0]}
                    </div>
                    <span className="font-bold text-lg">{p.name}</span>
                  </div>
                </td>
                <td className="p-8 text-zinc-400 font-medium">{p.age} років</td>
                <td className="p-8">
                  <span className="px-4 py-2 bg-white/5 rounded-full text-xs font-bold text-zinc-300 border border-white/5">
                    {p.group_name || 'Без групи'}
                  </span>
                </td>
                <td className="p-8">
                  <div className="text-xs font-mono text-zinc-500">
                    <p>L: {p.parent_login}</p>
                    <p>P: {p.parent_password}</p>
                  </div>
                </td>
                <td className="p-8 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setConfirmDelete({ id: p.id, name: p.name })} className="p-3 hover:bg-red-600/10 text-zinc-500 hover:text-red-500 rounded-xl transition-colors">
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => setEditingParticipant(p)}
                      className="p-3 hover:bg-white/10 text-zinc-500 hover:text-white rounded-xl transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Видалити учасника?"
        message={`Ви впевнені, що хочете видалити учня ${confirmDelete?.name}? Цю дію неможливо скасувати.`}
      />

      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-zinc-950 p-10 rounded-[3rem] border border-white/10 shadow-2xl">
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
              <FileUp className="text-red-600" size={32} />
              Імпорт учасників
            </h3>
            
            <div className="space-y-6">
              <div className="p-6 bg-white/[0.03] rounded-3xl border border-dashed border-white/10 text-center group hover:border-red-600/50 transition-colors">
                <input 
                  type="file" 
                  id="excel-upload" 
                  className="hidden" 
                  accept=".xlsx, .xls, .csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="excel-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 bg-red-600/10 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <FileUp size={32} />
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight mb-1">
                    {importFile ? importFile.name : 'Оберіть Excel або CSV файл'}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    Натисніть або перетягніть файл сюди
                  </p>
                </label>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
                  <Link size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Або вставте посилання на Google Таблицю..." 
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-red-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Цільова група (необов'язково)</label>
                <select 
                  value={importGroupId}
                  onChange={e => setImportGroupId(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                >
                  <option value="">Без групи (автоматично)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="bg-red-600/5 p-6 rounded-2xl border border-red-600/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-2">
                  <AlertCircle size={14} />
                  Вимоги до формату
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                  Файл має містити колонки: <span className="text-white font-bold">Ім'я</span> (обов'язково), 
                  <span className="text-white font-bold"> Вік</span>, 
                  <span className="text-white font-bold"> Логін</span>, 
                  <span className="text-white font-bold"> Пароль</span>.
                </p>
              </div>

              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportUrl('');
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/5 transition-colors uppercase tracking-widest text-[10px]"
                >
                  Скасувати
                </button>
                <button 
                  onClick={handleImport}
                  disabled={importLoading || (!importFile && !importUrl)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2"
                >
                  {importLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Імпортувати'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingParticipant && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-zinc-950 p-10 rounded-[3rem] border border-white/10 shadow-2xl">
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-8">
              {editingParticipant.id ? 'Редагувати учня' : 'Новий учень'}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">ПІБ учня</label>
                <input 
                  type="text" 
                  value={editingParticipant.name}
                  onChange={e => setEditingParticipant({...editingParticipant, name: e.target.value})}
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Вік</label>
                  <input 
                    type="number" 
                    value={editingParticipant.age}
                    onChange={e => setEditingParticipant({...editingParticipant, age: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Група</label>
                  <select 
                    value={editingParticipant.group_id}
                    onChange={e => setEditingParticipant({...editingParticipant, group_id: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                  >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Логін батьків</label>
                  <input 
                    type="text" 
                    value={editingParticipant.parent_login}
                    onChange={e => setEditingParticipant({...editingParticipant, parent_login: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Пароль батьків</label>
                  <input 
                    type="text" 
                    value={editingParticipant.parent_password}
                    onChange={e => setEditingParticipant({...editingParticipant, parent_password: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-red-600 transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button 
                  onClick={() => setEditingParticipant(null)}
                  className="flex-1 py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
                >
                  Скасувати
                </button>
                <button 
                  onClick={() => handleSave(editingParticipant)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AttendanceEditor = () => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<number, string>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch(`/api/attendance/${date}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
      ]);
      setParticipants(Array.isArray(pRes) ? pRes : []);
      const attMap: Record<number, string> = {};
      if (Array.isArray(aRes)) {
        aRes.forEach((a: any) => attMap[a.participant_id] = a.status);
      }
      setAttendance(attMap);
    } catch (e) {
      console.error('Fetch attendance failed', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const toggleAttendance = async (participantId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    const token = localStorage.getItem('admin_token');
    try {
      setAttendance(prev => ({ ...prev, [participantId]: newStatus }));
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ participant_id: participantId, date, status: newStatus })
      });
      toast.success(newStatus === 'present' ? 'Відмічено присутність' : 'Відмічено відсутність');
    } catch (e) {
      toast.error('Помилка оновлення');
      fetchData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Відвідуваність</h2>
          <p className="text-zinc-500 font-medium">Відмічайте присутність учнів на заняттях</p>
        </div>
        <div className="flex items-center gap-4 bg-zinc-900 p-2 rounded-2xl border border-white/5">
          <button 
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().split('T')[0]);
            }}
            className="p-3 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <input 
            type="date" 
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-transparent text-white font-bold outline-none px-4"
          />
          <button 
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() + 1);
              setDate(d.toISOString().split('T')[0]);
            }}
            className="p-3 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {participants.map(p => (
          <button
            key={p.id}
            onClick={() => toggleAttendance(p.id, attendance[p.id] || 'absent')}
            className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex items-center justify-between group ${
              attendance[p.id] === 'present' 
                ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                : 'bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10'
            }`}
          >
            <div className="text-left">
              <p className="font-black uppercase tracking-tight text-lg group-hover:translate-x-1 transition-transform">{p.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{p.group_name || 'Без групи'}</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              attendance[p.id] === 'present' ? 'bg-green-500 text-white rotate-12' : 'bg-white/5 text-zinc-700'
            }`}>
              {attendance[p.id] === 'present' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ContentEditor = ({ initialAction, onActionComplete }: { initialAction?: string | null, onActionComplete?: () => void }) => {
  const [content, setContent] = useState<Record<string, string>>({});
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    fetch(`/api/content?t=${Date.now()}`).then(res => res.json()).then(setContent);
  }, []);

  useEffect(() => {
    if (initialAction === 'video') {
      setActiveSection('video_problems');
      onActionComplete?.();
    }
  }, [initialAction]);

  const handleChange = (key: string, value: string) => {
    setContent(prev => ({ ...prev, [key]: value }));
    setDirtyFields(prev => new Set(prev).add(key));
  };

  const handleSave = async (delta?: Record<string, string>) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload: Record<string, string> = delta || {};
      if (!delta) {
        dirtyFields.forEach(key => {
          payload[key] = content[key];
        });
      }

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }

      const response = await fetch('/api/content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Server error');
      setDirtyFields(new Set());
      toast.success('Контент успішно збережено');
      
      // Re-fetch content to get URLs instead of base64 strings
      const freshContent = await fetch(`/api/content?t=${Date.now()}`).then(res => res.json());
      setContent(freshContent);
    } catch (e: any) {
      console.error('Save failed', e);
      toast.error(`Помилка збереження: ${e.message}`);
    }
    setSaving(false);
  };

  const handleImageUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 1280;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        
        // Upload to server and get URL
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ image: compressedBase64 })
          });
          
          if (!res.ok) throw new Error('Upload failed');
          const { url } = await res.json();
          
          setContent(prev => ({ ...prev, [key]: url }));
          setDirtyFields(prev => new Set(prev).add(key));
        } catch (err) {
          console.error('Image upload failed', err);
          toast.error('Помилка завантаження зображення');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const sections = [
    { id: 'hero', title: 'Головна', icon: LayoutDashboard },
    { id: 'about', title: 'Про нас', icon: Users },
    { id: 'directions', title: 'Напрями', icon: MapPin },
    { id: 'results', title: 'Результати', icon: Award },
    { id: 'transformation', title: 'Трансформація', icon: TrendingUp },
    { id: 'how_it_works', title: 'Як почати', icon: Clock },
    { id: 'faq', title: 'FAQ', icon: MessageSquare },
    { id: 'contacts', title: 'Контакти', icon: Settings },
    { id: 'video_problems', title: 'Відео та Проблеми', icon: Zap },
    { id: 'modern_challenges', title: 'Виклики сучасності', icon: Shield },
    { id: 'kids_landing', title: 'Діти 4-7', icon: Smile },
    { id: 'junior_landing', title: 'Діти 7-12', icon: Trophy },
    { id: 'teen_landing', title: 'Підлітки', icon: Zap },
    { id: 'personal_landing', title: 'Персональні', icon: Target },
    { id: 'women_landing', title: 'Жінки', icon: Heart },
    { id: 'analytics', title: 'Аналітика', icon: Shield },
  ];

  const sectionFields: Record<string, any[]> = {
    hero: [
      { key: 'hero_bg', label: 'Фонове зображення', type: 'image' },
      { key: 'hero_title', label: 'Заголовок', type: 'textarea' },
      { key: 'hero_subtitle', label: 'Підзаголовок', type: 'textarea' },
      { key: 'hero_button', label: 'Текст кнопки', type: 'text' },
    ],
    about: [
      { key: 'about_image', label: 'Зображення', type: 'image' },
      { key: 'about_title', label: 'Заголовок', type: 'text' },
      { key: 'about_text', label: 'Основний текст', type: 'textarea' },
      { key: 'about_quote', label: 'Цитата', type: 'textarea' },
    ],
    directions: [
      { key: 'directions_bg', label: 'Фон секції', type: 'image' },
      { key: 'directions_title', label: 'Заголовок', type: 'text' },
      { key: 'directions_subtitle', label: 'Підзаголовок', type: 'textarea' },
      { key: 'dir1_title', label: 'Напрям 1: Назва', type: 'text' },
      { key: 'dir1_text', label: 'Напрям 1: Опис', type: 'textarea' },
      { key: 'dir2_title', label: 'Напрям 2: Назва', type: 'text' },
      { key: 'dir2_text', label: 'Напрям 2: Опис', type: 'textarea' },
      { key: 'dir3_title', label: 'Напрям 3: Назва', type: 'text' },
      { key: 'dir3_text', label: 'Напрям 3: Опис', type: 'textarea' },
      { key: 'dir4_title', label: 'Напрям 4: Назва', type: 'text' },
      { key: 'dir4_text', label: 'Напрям 4: Опис', type: 'textarea' },
      { key: 'dir5_title', label: 'Напрям 5: Назва', type: 'text' },
      { key: 'dir5_text', label: 'Напрям 5: Опис', type: 'textarea' },
    ],
    results: [
      { key: 'results_bg', label: 'Фон секції', type: 'image' },
      { key: 'results_image', label: 'Центральне фото', type: 'image' },
      { key: 'results_title', label: 'Заголовок', type: 'text' },
      { key: 'results_subtitle', label: 'Підзаголовок', type: 'textarea' },
    ],
    transformation: [
      { key: 'transformation_bg', label: 'Фон секції', type: 'image' },
      { key: 'transformation_title', label: 'Заголовок', type: 'text' },
      { key: 'transformation_subtitle', label: 'Підзаголовок', type: 'textarea' },
    ],
    how_it_works: [
      { key: 'how_bg', label: 'Фон секції', type: 'image' },
      { key: 'how_title', label: 'Заголовок', type: 'text' },
      { key: 'how_step1_title', label: 'Крок 1: Заголовок', type: 'text' },
      { key: 'how_step1_text', label: 'Крок 1: Опис', type: 'textarea' },
      { key: 'how_step2_title', label: 'Крок 2: Заголовок', type: 'text' },
      { key: 'how_step2_text', label: 'Крок 2: Опис', type: 'textarea' },
      { key: 'how_step3_title', label: 'Крок 3: Заголовок', type: 'text' },
      { key: 'how_step3_text', label: 'Крок 3: Опис', type: 'textarea' },
    ],
    faq: [
      { key: 'faq_bg', label: 'Фон секції', type: 'image' },
      { key: 'faq_title', label: 'Заголовок', type: 'text' },
    ],
    contacts: [
      { key: 'contact_phone', label: 'Телефон', type: 'text' },
      { key: 'contact_email', label: 'Email', type: 'text' },
      { key: 'social_instagram', label: 'Instagram URL', type: 'text' },
      { key: 'social_facebook', label: 'Facebook URL', type: 'text' },
    ],
    video_problems: [
      { key: 'video_url', label: 'YouTube URL кліпа', type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' },
      { key: 'video_title', label: 'Заголовок відео', type: 'text' },
      { key: 'problems_title', label: 'Заголовок секції проблем', type: 'text' },
      { key: 'problems_subtitle', label: 'Підзаголовок секції проблем', type: 'textarea' },
      { key: 'problem1', label: 'Проблема 1', type: 'text' },
      { key: 'problem2', label: 'Проблема 2', type: 'text' },
      { key: 'problem3', label: 'Проблема 3', type: 'text' },
      { key: 'problem4', label: 'Проблема 4', type: 'text' },
      { key: 'problem5', label: 'Проблема 5', type: 'text' },
      { key: 'problem6', label: 'Проблема 6', type: 'text' },
    ],
    modern_challenges: [
      { key: 'modern_label', label: 'Малий заголовок (червоний)', type: 'text' },
      { key: 'modern_title', label: 'Головний заголовок', type: 'textarea' },
      { key: 'modern_description', label: 'Опис', type: 'textarea' },
      { key: 'modern_problem1', label: 'Пункт списку 1', type: 'text' },
      { key: 'modern_problem2', label: 'Пункт списку 2', type: 'text' },
      { key: 'modern_problem3', label: 'Пункт списку 3', type: 'text' },
      { key: 'modern_problem4', label: 'Пункт списку 4', type: 'text' },
      { key: 'modern_image', label: 'Зображення справа', type: 'image' },
      { key: 'modern_quote', label: 'Цитата на фото', type: 'textarea' },
    ],
    kids_landing: [
      { key: 'kids_hero_bg', label: 'Hero: Фонове зображення', type: 'image' },
      { key: 'kids_hero_title', label: 'Hero: Заголовок', type: 'textarea' },
      { key: 'kids_hero_subtitle', label: 'Hero: Підзаголовок', type: 'textarea' },
      { key: 'kids_advantages_image', label: 'Секція переваг: Зображення', type: 'image' },
      { key: 'kids_seo_title', label: 'SEO: Заголовок сторінки', type: 'text' },
      { key: 'kids_seo_description', label: 'SEO: Опис (Meta Description)', type: 'textarea' },
      { key: 'kids_seo_keywords', label: 'SEO: Ключові слова', type: 'text' },
    ],
    junior_landing: [
      { key: 'junior_hero_bg', label: 'Hero: Фонове зображення', type: 'image' },
      { key: 'junior_hero_title', label: 'Hero: Заголовок', type: 'textarea' },
      { key: 'junior_hero_subtitle', label: 'Hero: Підзаголовок', type: 'textarea' },
      { key: 'junior_advantages_image', label: 'Секція переваг: Зображення', type: 'image' },
      { key: 'junior_seo_title', label: 'SEO: Заголовок сторінки', type: 'text' },
      { key: 'junior_seo_description', label: 'SEO: Опис (Meta Description)', type: 'textarea' },
      { key: 'junior_seo_keywords', label: 'SEO: Ключові слова', type: 'text' },
    ],
    teen_landing: [
      { key: 'teen_hero_bg', label: 'Hero: Фонове зображення', type: 'image' },
      { key: 'teen_hero_title', label: 'Hero: Заголовок', type: 'textarea' },
      { key: 'teen_hero_subtitle', label: 'Hero: Підзаголовок', type: 'textarea' },
      { key: 'teen_advantages_image', label: 'Секція переваг: Зображення', type: 'image' },
      { key: 'teen_seo_title', label: 'SEO: Заголовок сторінки', type: 'text' },
      { key: 'teen_seo_description', label: 'SEO: Опис (Meta Description)', type: 'textarea' },
      { key: 'teen_seo_keywords', label: 'SEO: Ключові слова', type: 'text' },
    ],
    personal_landing: [
      { key: 'personal_hero_bg', label: 'Hero: Фонове зображення', type: 'image' },
      { key: 'personal_hero_title', label: 'Hero: Заголовок', type: 'textarea' },
      { key: 'personal_hero_subtitle', label: 'Hero: Підзаголовок', type: 'textarea' },
      { key: 'personal_advantages_image', label: 'Секція переваг: Зображення', type: 'image' },
      { key: 'personal_seo_title', label: 'SEO: Заголовок сторінки', type: 'text' },
      { key: 'personal_seo_description', label: 'SEO: Опис (Meta Description)', type: 'textarea' },
      { key: 'personal_seo_keywords', label: 'SEO: Ключові слова', type: 'text' },
    ],
    women_landing: [
      { key: 'women_hero_bg', label: 'Hero: Фонове зображення', type: 'image' },
      { key: 'women_hero_title', label: 'Hero: Заголовок', type: 'textarea' },
      { key: 'women_hero_subtitle', label: 'Hero: Підзаголовок', type: 'textarea' },
      { key: 'women_advantages_image', label: 'Секція переваг: Зображення', type: 'image' },
      { key: 'women_seo_title', label: 'SEO: Заголовок сторінки', type: 'text' },
      { key: 'women_seo_description', label: 'SEO: Опис (Meta Description)', type: 'textarea' },
      { key: 'women_seo_keywords', label: 'SEO: Ключові слова', type: 'text' },
    ],
    analytics: [
      { key: 'meta_pixel_code', label: 'Meta Pixel Code (Facebook)', type: 'textarea', placeholder: 'Вставте повний код пікселя <script>...</script>' },
      { key: 'google_pixel_code', label: 'Google Analytics / Tag Manager Code', type: 'textarea', placeholder: 'Вставте код відстеження Google' },
    ]
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Контент сайту</h2>
          <p className="text-zinc-500 font-medium text-lg">Керуйте текстами та зображеннями на головній сторінці</p>
        </div>
        <button 
          onClick={() => handleSave()}
          disabled={saving || dirtyFields.size === 0}
          className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 ${
            dirtyFields.size > 0 
              ? 'bg-red-600 text-white shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:bg-red-700' 
              : 'bg-zinc-900 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? 'Збереження...' : `Зберегти зміни (${dirtyFields.size})`}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] whitespace-nowrap transition-all border ${
              activeSection === s.id 
                ? 'bg-red-600 border-red-600 text-white shadow-lg' 
                : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:border-white/10'
            }`}
          >
            <s.icon size={16} />
            {s.title}
          </button>
        ))}
      </div>

      <motion.div 
        key={activeSection}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-zinc-900/30 backdrop-blur-md p-10 rounded-[3rem] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-10"
      >
        {sectionFields[activeSection].map(field => (
          <div key={field.key} className={field.type === 'textarea' || field.type === 'image' ? 'md:col-span-2' : ''}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">{field.label}</label>
            {field.type === 'text' && (
              <input 
                type="text" 
                value={content[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value)}
                className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-red-600 transition-all font-medium"
              />
            )}
            {field.type === 'textarea' && (
              <textarea 
                rows={field.key.includes('pixel') ? 12 : 4}
                value={content[field.key] || ''}
                placeholder={field.placeholder}
                onChange={e => handleChange(field.key, e.target.value)}
                className={`w-full bg-zinc-950 border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-red-600 transition-all font-medium resize-none ${field.key.includes('pixel') ? 'font-mono text-xs' : ''}`}
              />
            )}
            {field.type === 'image' && (
              <div className="space-y-4">
                <div className="relative aspect-video w-full max-w-2xl bg-zinc-950 rounded-3xl overflow-hidden border border-white/5 group">
                  {content[field.key] ? (
                    <img src={content[field.key]} alt={field.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                      <ImageIcon size={48} className="mb-4 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">Немає зображення</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer bg-white text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform">
                      Змінити фото
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(field.key, e)} />
                    </label>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase italic">Рекомендовано: 1920x1080px, до 5MB</p>
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const CoachesEditor = () => {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [editingCoach, setEditingCoach] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCoaches = () => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/coaches', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => setCoaches(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Fetch coaches failed:', err);
        setCoaches([]);
      });
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  const handleSaveCoach = async (coach: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(coach.id ? `/api/coaches/${coach.id}` : '/api/coaches', {
        method: coach.id ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(coach)
      });
      
      if (res.ok) {
        setEditingCoach(null);
        fetchCoaches();
        toast.success('Дані тренера збережено');
      } else {
        toast.error('Помилка збереження');
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
  };

  const handleDeleteCoach = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/coaches/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Тренера видалено');
        fetchCoaches();
      } else {
        toast.error('Помилка видалення');
      }
    } catch (e) {
      toast.error('Помилка видалення');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, coachId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл занадто великий. Максимальний розмір - 10 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6);

        // Upload to server and get URL
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ image: base64 })
          });
          
          if (!res.ok) throw new Error('Upload failed');
          const { url } = await res.json();

          if (coachId) {
            await fetch(`/api/coaches/${coachId}/photo`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ photo: url })
            });
            fetchCoaches();
          }
          
          if (editingCoach && (editingCoach.id === coachId || !editingCoach.id)) {
            setEditingCoach({ ...editingCoach, photo: url });
          }
        } catch (err) {
          console.error('Photo upload failed', err);
          toast.error('Помилка завантаження фото');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (editingCoach) {
    return (
      <div className="max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Редагування тренера</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setEditingCoach(null)}
              className="px-6 py-2 rounded-xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
            >
              Скасувати
            </button>
            <button 
              onClick={() => handleSaveCoach(editingCoach)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
            >
              <Save size={18} />
              Зберегти
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 p-8 rounded-[2rem] border border-white/5 space-y-6">
          <div className="flex gap-8">
            <div className="w-1/3">
              <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative group bg-black">
                {editingCoach.photo ? (
                  <img src={editingCoach.photo} alt={editingCoach.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon size={48} />
                  </div>
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-sm font-bold">Завантажити фото</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, editingCoach.id)} />
                </label>
              </div>
            </div>
            
            <div className="w-2/3 space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Ім'я</label>
                <input 
                  type="text" 
                  value={editingCoach.name} 
                  onChange={e => setEditingCoach({...editingCoach, name: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Посада / Звання</label>
                <input 
                  type="text" 
                  value={editingCoach.role} 
                  onChange={e => setEditingCoach({...editingCoach, role: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Біографія</label>
                <textarea 
                  value={editingCoach.bio} 
                  onChange={e => setEditingCoach({...editingCoach, bio: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white min-h-[100px] focus:border-red-600 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-300 mb-2">Досягнення (по одному на рядок)</label>
            <textarea 
              value={(editingCoach.achievements || []).join('\n')} 
              onChange={e => setEditingCoach({...editingCoach, achievements: e.target.value.split('\n').filter(Boolean)})}
              className="w-full bg-black border border-white/10 rounded-xl p-4 text-white min-h-[150px] focus:border-red-600 outline-none"
              placeholder="Майстер спорту&#10;Чемпіон України"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">Тренери</h2>
          <button 
            onClick={fetchCoaches}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
            title="Оновити"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <button 
          onClick={() => setEditingCoach({ name: '', role: '', bio: '', achievements: [], photo: '' })}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          Додати тренера
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.isArray(coaches) && coaches.map(coach => (
          <div key={coach.id} className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 flex flex-col">
            <div className="aspect-[4/3] rounded-xl overflow-hidden mb-6 bg-black relative group">
              {coach.photo ? (
                <img src={coach.photo} alt={coach.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <ImageIcon size={32} />
                </div>
              )}
              <button 
                onClick={() => setConfirmDelete({ id: coach.id, name: coach.name })}
                className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="text-xl font-bold mb-1">{coach.name}</h3>
            <p className="text-sm text-red-500 mb-4">{coach.role}</p>
            <button 
              onClick={() => setEditingCoach(coach)}
              className="mt-auto w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
            >
              Редагувати
            </button>
          </div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteCoach}
        loading={isDeleting}
        title="Видалити тренера?"
        message={`Ви впевнені, що хочете видалити тренера ${confirmDelete?.name}? Цю дію неможливо скасувати.`}
      />
    </div>
  );
};

const LocationsEditor = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLocations = () => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/locations', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('Fetch locations failed:', err);
        setLocations([]);
      });
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSaveLocation = async (location: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const method = location.id ? 'PUT' : 'POST';
      const url = location.id ? `/api/locations/${location.id}` : '/api/locations';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(location)
      });
      
      if (res.ok) {
        setEditingLocation(null);
        fetchLocations();
        toast.success('Локацію збережено');
      } else {
        toast.error('Помилка збереження');
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
  };

  const handleDeleteLocation = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/locations/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Локацію видалено');
        fetchLocations();
      } else {
        toast.error('Помилка видалення');
      }
    } catch (e) {
      toast.error('Помилка видалення');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">Локації</h2>
          <button 
            onClick={fetchLocations}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
            title="Оновити"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <button 
          onClick={() => setEditingLocation({ name: '', address: '', map_link: '', order_index: 0 })}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          Додати локацію
        </button>
      </div>

      {editingLocation && (
        <div className="bg-zinc-900 p-8 rounded-2xl border border-white/5 mb-8 space-y-4">
          <h3 className="text-xl font-bold mb-4">{editingLocation.id ? 'Редагувати' : 'Нова'} локація</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Назва</label>
              <input 
                type="text" 
                value={editingLocation.name} 
                onChange={e => setEditingLocation({...editingLocation, name: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Адреса</label>
              <input 
                type="text" 
                value={editingLocation.address} 
                onChange={e => setEditingLocation({...editingLocation, address: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-300 mb-2">Посилання на Google Maps</label>
            <input 
              type="text" 
              value={editingLocation.map_link} 
              onChange={e => setEditingLocation({...editingLocation, map_link: e.target.value})}
              className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => handleSaveLocation(editingLocation)}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              Зберегти
            </button>
            <button 
              onClick={() => setEditingLocation(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {Array.isArray(locations) && locations.map(loc => (
          <div key={loc.id} className="bg-zinc-900 p-6 rounded-2xl border border-white/5 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">{loc.name}</h3>
              <p className="text-zinc-400">{loc.address}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setEditingLocation(loc)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Редагувати
              </button>
              <button 
                onClick={() => setConfirmDelete({ id: loc.id, name: loc.name })}
                className="p-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteLocation}
        loading={isDeleting}
        title="Видалити локацію?"
        message={`Ви впевнені, що хочете видалити локацію ${confirmDelete?.name}? Цю дію неможливо скасувати.`}
      />
    </div>
  );
};

const ScheduleEditor = ({ initialAction, onActionComplete }: { initialAction?: string | null, onActionComplete?: () => void }) => {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, group_name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [sRes, lRes, cRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/locations'),
        fetch('/api/coaches')
      ]);
      const sData = await sRes.json();
      const lData = await lRes.json();
      const cData = await cRes.json();
      
      setSchedule(Array.isArray(sData) ? sData : []);
      setLocations(Array.isArray(lData) ? lData : []);
      setCoaches(Array.isArray(cData) ? cData : []);
    } catch (e) {
      setSchedule([]);
      setLocations([]);
      setCoaches([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialAction === 'add' && locations.length > 0 && coaches.length > 0) {
      setEditingEntry({ 
        location_id: locations[0].id, 
        coach_id: coaches[0].id, 
        day_of_week: 'Пн', 
        start_time: '16:00', 
        end_time: '17:30', 
        group_name: '', 
        price: '2500',
        order_index: 0 
      });
      onActionComplete?.();
    }
  }, [initialAction, locations, coaches]);

  const handleSaveEntry = async (entry: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const method = entry.id ? 'PUT' : 'POST';
      const url = entry.id ? `/api/schedule/${entry.id}` : '/api/schedule';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entry)
      });
      
      if (res.ok) {
        setEditingEntry(null);
        fetchData();
        toast.success('Запис розкладу збережено');
      } else {
        toast.error('Помилка збереження');
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
  };

  const handleDeleteEntry = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/schedule/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Запис видалено');
        fetchData();
      } else {
        toast.error('Помилка видалення');
      }
    } catch (e) {
      toast.error('Помилка видалення');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">Розклад занять</h2>
          <button 
            onClick={fetchData}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
            title="Оновити"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <button 
          onClick={() => {
            const defaultLocId = locations.length > 0 ? locations[0].id : null;
            const defaultCoachId = coaches.length > 0 ? coaches[0].id : null;
            setEditingEntry({ 
              location_id: defaultLocId, 
              coach_id: defaultCoachId, 
              day_of_week: 'Пн', 
              start_time: '16:00', 
              end_time: '17:30', 
              group_name: '', 
              price: '2500',
              order_index: 0 
            });
          }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          Додати заняття
        </button>
      </div>

      {editingEntry && (
        <div className="bg-zinc-900 p-8 rounded-2xl border border-white/5 mb-8 space-y-4">
          <h3 className="text-xl font-bold mb-4">{editingEntry.id ? 'Редагувати' : 'Нове'} заняття</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Локація</label>
              <select 
                value={editingEntry.location_id} 
                onChange={e => setEditingEntry({...editingEntry, location_id: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
              >
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Тренер</label>
              <select 
                value={editingEntry.coach_id} 
                onChange={e => setEditingEntry({...editingEntry, coach_id: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
              >
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">День тижня</label>
              <select 
                value={editingEntry.day_of_week} 
                onChange={e => setEditingEntry({...editingEntry, day_of_week: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
              >
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Група</label>
              <input 
                type="text" 
                value={editingEntry.group_name} 
                onChange={e => setEditingEntry({...editingEntry, group_name: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                placeholder="Молодша група"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Ціна (тільки число)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={editingEntry.price || ''} 
                  onChange={e => setEditingEntry({...editingEntry, price: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 pr-20 text-white outline-none"
                  placeholder="2500"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold uppercase">грн/міс</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Час початку</label>
              <input 
                type="text" 
                value={editingEntry.start_time} 
                onChange={e => setEditingEntry({...editingEntry, start_time: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                placeholder="16:00"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-300 mb-2">Час завершення</label>
              <input 
                type="text" 
                value={editingEntry.end_time} 
                onChange={e => setEditingEntry({...editingEntry, end_time: e.target.value})}
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                placeholder="17:30"
              />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => handleSaveEntry(editingEntry)}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              Зберегти
            </button>
            <button 
              onClick={() => setEditingEntry(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {locations.map(loc => {
          const locSchedule = schedule.filter(s => s.location_id === loc.id);
          if (locSchedule.length === 0) return null;
          
          return (
            <div key={loc.id} className="bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden">
              <div className="bg-black/50 p-6 border-b border-white/5">
                <h3 className="text-xl font-bold text-red-500">{loc.name}</h3>
                <p className="text-sm text-zinc-500">{loc.address}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">
                      <th className="p-4">День</th>
                      <th className="p-4">Час</th>
                      <th className="p-4">Група</th>
                      <th className="p-4">Ціна</th>
                      <th className="p-4">Тренер</th>
                      <th className="p-4 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {locSchedule.map(entry => (
                      <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold">{entry.day_of_week}</td>
                        <td className="p-4 text-zinc-300">{entry.start_time} - {entry.end_time}</td>
                        <td className="p-4">{entry.group_name}</td>
                        <td className="p-4 text-red-500 font-bold">{entry.price ? `${entry.price} грн/міс` : '—'}</td>
                        <td className="p-4 text-sm text-zinc-400">{entry.coach_name}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingEntry(entry)} className="p-2 hover:text-red-500 transition-colors">
                              Редагувати
                            </button>
                            <button onClick={() => setConfirmDelete({ id: entry.id, group_name: entry.group_name })} className="p-2 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteEntry}
        loading={isDeleting}
        title="Видалити запис розкладу?"
        message={`Ви впевнені, що хочете видалити заняття для групи ${confirmDelete?.group_name}? Цю дію неможливо скасувати.`}
      />
    </div>
  );
};

const LeadsViewer = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLeads = () => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/leads', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(data => setLeads(Array.isArray(data) ? data : []))
    .catch(err => {
      console.error('Fetch leads failed:', err);
      setLeads([]);
    });
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/leads/delete-all', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Всі заявки видалено');
        fetchLeads();
      } else {
        toast.error('Помилка видалення заявок');
      }
    } catch (e) {
      toast.error('Помилка видалення заявок');
    }
    setIsDeletingAll(false);
    setShowDeleteAllConfirm(false);
  };

  const handleSaveLead = async (lead: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lead)
      });
      
      if (res.ok) {
        setEditingLead(null);
        fetchLeads();
        toast.success('Заявку оновлено');
      } else {
        toast.error('Помилка оновлення заявки');
      }
    } catch (e) {
      toast.error('Помилка оновлення заявки');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/leads/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Заявку видалено');
        fetchLeads();
      } else {
        toast.error('Помилка видалення заявки');
      }
    } catch (e) {
      toast.error('Помилка видалення заявки');
    }
    setIsDeleting(false);
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">Заявки з сайту</h2>
          <button 
            onClick={fetchLeads}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
            title="Оновити"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        {leads.length > 0 && (
          <button 
            onClick={() => setShowDeleteAllConfirm(true)}
            className="px-6 py-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all flex items-center gap-2 border border-red-600/20"
          >
            <Trash2 size={18} />
            Видалити всі ({leads.length})
          </button>
        )}
      </div>
      
      <ConfirmModal 
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        loading={isDeletingAll}
        title="Видалити ВСІ заявки?"
        message="Ви впевнені, що хочете видалити абсолютно всі заявки? Цю дію неможливо скасувати."
      />
      
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-white/10 p-8 space-y-6">
            <h3 className="text-2xl font-bold">Редагувати заявку</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Ім'я</label>
                <input 
                  type="text" 
                  value={editingLead.name} 
                  onChange={e => setEditingLead({...editingLead, name: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Телефон</label>
                <input 
                  type="text" 
                  value={editingLead.phone} 
                  onChange={e => setEditingLead({...editingLead, phone: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Локація</label>
                <input 
                  type="text" 
                  value={editingLead.location} 
                  onChange={e => setEditingLead({...editingLead, location: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Група</label>
                <input 
                  type="text" 
                  value={editingLead.age_group} 
                  onChange={e => setEditingLead({...editingLead, age_group: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-2">Статус</label>
                <select 
                  value={editingLead.status} 
                  onChange={e => setEditingLead({...editingLead, status: e.target.value})}
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none"
                >
                  <option value="new">Нова</option>
                  <option value="contacted">Зв'язалися</option>
                  <option value="trial">Призначено пробне</option>
                  <option value="client">Клієнт</option>
                  <option value="closed">Закрито</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => handleSaveLead(editingLead)}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
              >
                Зберегти
              </button>
              <button 
                onClick={() => setEditingLead(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-[2rem] border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/50 border-b border-white/5">
            <tr>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Дата</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Ім'я</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Телефон</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Локація</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Група</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Статус</th>
              <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">Заявок поки немає</td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6 text-sm text-zinc-400">{new Date(lead.created_at).toLocaleString('uk-UA')}</td>
                  <td className="p-6 font-bold">{lead.name}</td>
                  <td className="p-6 font-mono text-red-400">{lead.phone}</td>
                  <td className="p-6 text-sm">{lead.location || 'Не вказано'}</td>
                  <td className="p-6 text-sm">{lead.age_group}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-widest ${
                      lead.status === 'new' ? 'bg-red-600/20 text-red-500' :
                      lead.status === 'contacted' ? 'bg-blue-600/20 text-blue-500' :
                      lead.status === 'trial' ? 'bg-amber-600/20 text-amber-500' :
                      lead.status === 'client' ? 'bg-green-600/20 text-green-500' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {lead.status === 'new' ? 'Нова' : 
                       lead.status === 'contacted' ? 'Зв\'язалися' :
                       lead.status === 'trial' ? 'Пробне' :
                       lead.status === 'client' ? 'Клієнт' :
                       lead.status === 'closed' ? 'Закрито' : lead.status}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingLead(lead)}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Редагувати"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete({ id: lead.id, name: lead.name })}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Видалити"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Видалити заявку?"
        message={`Ви впевнені, що хочете видалити заявку від ${confirmDelete?.name}? Цю дію неможливо скасувати.`}
      />
    </div>
  );
};

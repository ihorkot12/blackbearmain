import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Trophy, 
  Star, 
  CheckCircle2, 
  X, 
  LogOut, 
  Settings, 
  User, 
  Cake, 
  TrendingUp,
  Plus,
  Search,
  Layout,
  Save,
  Image as ImageIcon,
  Type,
  Trash2,
  Upload,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Shared UI Components (matching App.tsx) ---

const Button = ({ children, variant = 'primary', className = '', showIcon = true, ...props }: any) => {
  const variants = {
    primary: 'bg-gradient-to-b from-[#D10000] to-[#A80000] text-white shadow-[0_8px_24px_rgba(209,0,0,0.35)] hover:shadow-[0_12px_28px_rgba(209,0,0,0.45)] active:shadow-[0_4px_12px_rgba(209,0,0,0.4)]',
    secondary: 'bg-transparent border-2 border-white/20 text-white hover:bg-white/10 hover:border-white',
    zinc: 'bg-zinc-800 border border-white/5 text-white hover:bg-zinc-700',
  };
  
  const baseStyles = "h-[48px] px-6 rounded-[14px] font-bold uppercase tracking-[0.05em] transition-all duration-300 flex items-center justify-center gap-2 text-sm";
  const hoverStyles = "hover:translate-y-[-1px]";
  const activeStyles = "active:translate-y-[1px]";

  return (
    <button 
      className={`${baseStyles} ${hoverStyles} ${activeStyles} ${variants[variant as keyof typeof variants]} ${className}`}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{label}</label>}
    <input 
      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white placeholder:text-zinc-700"
      {...props}
    />
  </div>
);

const ImageUpload = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });
      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{label}</label>
      <div className="flex gap-4 items-start">
        <div className="w-24 h-24 bg-black rounded-xl border border-white/10 overflow-hidden flex-shrink-0 relative group">
          {value ? (
            <img src={value} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800">
              <ImageIcon size={32} />
            </div>
          )}
          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
            <Upload size={20} className="text-white" />
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        </div>
        <div className="flex-grow space-y-2">
          <input 
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 focus:border-red-600 outline-none transition-colors text-xs text-white placeholder:text-zinc-700"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Або вставте URL зображення..."
          />
          <p className="text-[9px] text-zinc-600 uppercase tracking-tighter">Рекомендовано: JPG/PNG, до 2MB</p>
        </div>
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-zinc-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Pages ---

export const LoginPage = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.role === 'coach') {
        if (data.token) localStorage.setItem('admin_token', data.token);
        navigate('/dashboard');
      } else {
        navigate('/profile');
      }
    } else {
      setError('Невірний логін або пароль');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-600/20">
            <User className="text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Вхід до системи</h1>
          <p className="text-zinc-500 text-sm mt-2">Введіть ваші дані для доступу</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <Input label="Логін / Телефон" value={login} onChange={(e: any) => setLogin(e.target.value)} placeholder="admin або +380..." required />
          <Input label="Пароль" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="••••••••" required />
          
          {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

          <Button type="submit" className="w-full">Увійти</Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            ← Повернутись на головну
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const CoachDashboard = () => {
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [siteContent, setSiteContent] = useState<any>({});
  const [coaches, setCoaches] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: '',
    age: '',
    group_id: '',
    parent_login: '',
    parent_password: '',
    birthday: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedDate]);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
      if (activeTab === 'leads') {
        const res = await fetch('/api/leads', { headers });
        if (res.ok) {
          const data = await res.json();
          setLeads(Array.isArray(data) ? data : []);
        }
      } else if (activeTab === 'participants') {
        const [pRes, gRes] = await Promise.all([
          fetch('/api/participants', { headers }),
          fetch('/api/groups')
        ]);
        if (pRes.ok) {
          const data = await pRes.json();
          setParticipants(Array.isArray(data) ? data : []);
        }
        if (gRes.ok) {
          const data = await gRes.json();
          setGroups(Array.isArray(data) ? data : []);
        }
      } else if (activeTab === 'attendance') {
        const [pRes, aRes] = await Promise.all([
          fetch('/api/participants', { headers }),
          fetch(`/api/attendance/${selectedDate}`, { headers })
        ]);
        if (pRes.ok) {
          const data = await pRes.json();
          setParticipants(Array.isArray(data) ? data : []);
        }
        if (aRes.ok) {
          const data = await aRes.json();
          setAttendance(Array.isArray(data) ? data : []);
        }
      } else if (activeTab === 'editor') {
        const [contentRes, coachesRes] = await Promise.all([
          fetch('/api/content'),
          fetch('/api/coaches')
        ]);
        if (contentRes.ok) setSiteContent(await contentRes.json());
        if (coachesRes.ok) {
          const data = await coachesRes.json();
          setCoaches(Array.isArray(data) ? data : []);
        }
      }
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  const handleSaveContent = async () => {
    const token = localStorage.getItem('admin_token');
    setIsSaving(true);
    try {
      await fetch('/api/content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(siteContent)
      });
      alert('Зміни збережено!');
    } catch (e) {
      alert('Помилка збереження');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCoach = async () => {
    const token = localStorage.getItem('admin_token');
    const newCoach = { name: 'Новий Тренер', role: 'Посада', bio: 'Опис...', photo: '', achievements: [] };
    const res = await fetch('/api/coaches', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newCoach)
    });
    if (res.ok) fetchData();
  };

  const handleUpdateCoach = async (id: number, data: any) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`/api/coaches/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setCoaches(Array.isArray(coaches) ? coaches.map(c => c.id === id ? { ...c, ...data } : c) : []);
      } else {
        alert('Помилка оновлення');
      }
    } catch (e) {
      alert('Помилка оновлення');
    }
  };

  const handleDeleteCoach = async (id: number) => {
    const token = localStorage.getItem('admin_token');
    if (!confirm('Видалити тренера?')) return;
    await fetch(`/api/coaches/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    const token = localStorage.getItem('admin_token');
    e.preventDefault();
    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newParticipant)
    });
    if (res.ok) {
      setIsModalOpen(false);
      setNewParticipant({ name: '', age: '', group_id: '', parent_login: '', parent_password: '', birthday: '' });
      fetchData();
    }
  };

  const handleToggleAttendance = async (participantId: number, currentStatus: string | null) => {
    const token = localStorage.getItem('admin_token');
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        participant_id: participantId,
        date: selectedDate,
        status: newStatus
      })
    });
    if (res.ok) {
      const aRes = await fetch(`/api/attendance/${selectedDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (aRes.ok) {
        const data = await aRes.json();
        setAttendance(Array.isArray(data) ? data : []);
      }
    }
  };

  const handleDeleteLead = async (id: number) => {
    const token = localStorage.getItem('admin_token');
    if (!confirm('Видалити заявку?')) return;
    await fetch(`/api/leads/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const handleDeleteParticipant = async (id: number) => {
    const token = localStorage.getItem('admin_token');
    if (!confirm('Видалити учня?')) return;
    await fetch(`/api/participants/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-950 border-r border-white/5 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black">B</div>
          <div className="font-black uppercase tracking-tighter text-sm">Coach Panel</div>
        </div>

        <nav className="flex-grow space-y-2">
          {[
            { id: 'leads', label: 'Ліди', icon: Star },
            { id: 'participants', label: 'Учасники', icon: Users },
            { id: 'attendance', label: 'Відвідуваність', icon: Calendar },
            { id: 'rankings', label: 'Рейтинг', icon: Trophy },
            { id: 'editor', label: 'Конструктор', icon: Layout },
            { id: 'settings', label: 'Налаштування', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === item.id ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <a
          href="/admin"
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors text-sm font-bold uppercase tracking-widest mt-4 border-t border-white/5 pt-4"
        >
          <Layout size={18} />
          Повна Адмінка
        </a>

        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-widest">
          <LogOut size={18} />
          Вихід
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-grow p-10 overflow-auto">
        <header className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black uppercase tracking-tight">
            {activeTab === 'leads' && 'Управління лідами'}
            {activeTab === 'participants' && 'База учасників'}
            {activeTab === 'attendance' && 'Журнал відвідуваності'}
            {activeTab === 'rankings' && 'Рейтинги та змагання'}
            {activeTab === 'editor' && 'Конструктор лендінгу'}
            {activeTab === 'settings' && 'Налаштування'}
          </h2>
          
          <div className="flex gap-4">
            {activeTab === 'editor' ? (
              <Button onClick={handleSaveContent} disabled={isSaving}>
                <Save size={16} /> {isSaving ? 'Зберігаємо...' : 'Зберегти зміни'}
              </Button>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input className="bg-zinc-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-red-600 transition-colors" placeholder="Пошук..." />
                </div>
                {activeTab === 'participants' && (
                  <Button variant="primary" className="h-[40px]" onClick={() => setIsModalOpen(true)}><Plus size={16} /> Додати учня</Button>
                )}
                {activeTab === 'attendance' && (
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-zinc-900 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:border-red-600 transition-colors text-white"
                  />
                )}
              </>
            )}
          </div>
        </header>

        {activeTab === 'editor' && (
          <div className="space-y-10 pb-20">
            {/* Navigation for Editor */}
            <div className="flex gap-4 sticky top-0 z-10 bg-black/80 backdrop-blur-md py-4 border-b border-white/5">
              {['Головна', 'Про клуб', 'Тренери', 'Контакти'].map(section => (
                <button key={section} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                  {section}
                </button>
              ))}
            </div>

            {/* Hero Section Editor */}
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <Layout className="text-red-600" size={20} />
                <h3 className="text-lg font-black uppercase tracking-tight">Головний блок (Hero)</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Input 
                    label="Заголовок (HTML дозволено)" 
                    value={siteContent.hero_title || ''} 
                    onChange={(e: any) => setSiteContent({...siteContent, hero_title: e.target.value})}
                  />
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Підзаголовок</label>
                    <textarea 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white h-24"
                      value={siteContent.hero_subtitle || ''}
                      onChange={(e) => setSiteContent({...siteContent, hero_subtitle: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <ImageUpload 
                    label="Фонове зображення" 
                    value={siteContent.hero_bg || ''} 
                    onChange={(val) => setSiteContent({...siteContent, hero_bg: val})}
                  />
                </div>
              </div>
            </div>

            {/* About Section Editor */}
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <Type className="text-red-600" size={20} />
                <h3 className="text-lg font-black uppercase tracking-tight">Блок "Про клуб"</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <Input 
                    label="Заголовок блоку" 
                    value={siteContent.about_title || ''} 
                    onChange={(e: any) => setSiteContent({...siteContent, about_title: e.target.value})}
                  />
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Текст опису</label>
                    <textarea 
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white h-32"
                      value={siteContent.about_text || ''}
                      onChange={(e) => setSiteContent({...siteContent, about_text: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <ImageUpload 
                    label="Зображення блоку" 
                    value={siteContent.about_image || ''} 
                    onChange={(val) => setSiteContent({...siteContent, about_image: val})}
                  />
                </div>
              </div>
            </div>

            {/* Coaches Manager */}
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Users className="text-red-600" size={20} />
                  <h3 className="text-lg font-black uppercase tracking-tight">Команда тренерів</h3>
                </div>
                <Button variant="zinc" className="h-10 px-4 text-[10px]" onClick={handleAddCoach}>
                  <Plus size={14} /> Додати тренера
                </Button>
              </div>

              <div className="space-y-6">
                {Array.isArray(coaches) && coaches.map((coach) => (
                  <div key={coach.id} className="bg-black/40 p-6 rounded-3xl border border-white/5 group relative">
                    <button 
                      onClick={() => handleDeleteCoach(coach.id)}
                      className="absolute top-4 right-4 text-zinc-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <ImageUpload 
                          label="Фото тренера" 
                          value={coach.photo} 
                          onChange={(val) => handleUpdateCoach(coach.id, { ...coach, photo: val })}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Input 
                            label="ПІБ" 
                            value={coach.name} 
                            onChange={(e: any) => handleUpdateCoach(coach.id, { ...coach, name: e.target.value })}
                          />
                          <Input 
                            label="Посада" 
                            value={coach.role} 
                            onChange={(e: any) => handleUpdateCoach(coach.id, { ...coach, role: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Біографія</label>
                          <textarea 
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white h-24"
                            value={coach.bio}
                            onChange={(e) => handleUpdateCoach(coach.id, { ...coach, bio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Досягнення (через кому)</label>
                          <input 
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white"
                            value={coach.achievements.join(', ')}
                            onChange={(e) => handleUpdateCoach(coach.id, { ...coach, achievements: e.target.value.split(',').map((s: string) => s.trim()) })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="bg-zinc-900 rounded-3xl border border-white/5 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Дата</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Ім'я</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Телефон</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Група</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-xs text-zinc-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-bold">{lead.name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-red-500">{lead.phone}</td>
                    <td className="px-6 py-4 text-xs uppercase font-bold text-zinc-500">{lead.age_group}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-red-600/10 text-red-500 text-[10px] font-black uppercase rounded-md border border-red-600/20">{lead.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDeleteLead(lead.id)} className="text-zinc-700 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="bg-zinc-900 rounded-3xl border border-white/5 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Учень</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Група</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {participants.map((p: any) => {
                  const att = attendance.find(a => a.participant_id === p.id);
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500">
                            <User size={16} />
                          </div>
                          <span className="text-sm font-bold">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs uppercase font-bold text-zinc-500">{p.group_name}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleToggleAttendance(p.id, att?.status || null)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            att?.status === 'present' 
                              ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-600/30' 
                              : 'bg-zinc-800 text-zinc-500 border border-white/5 hover:border-red-600/30'
                          }`}
                        >
                          {att?.status === 'present' ? 'Присутній' : 'Відсутній'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participants.map((p: any) => (
              <div key={p.id} className="bg-zinc-900 p-6 rounded-3xl border border-white/5 hover:border-red-600/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <User size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Група</div>
                      <div className="text-xs font-bold text-white">{p.group_name}</div>
                    </div>
                    <button onClick={() => handleDeleteParticipant(p.id)} className="text-zinc-700 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-black uppercase mb-1">{p.name}</h3>
                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-4">
                  <Cake size={14} /> {p.birthday ? new Date(p.birthday).toLocaleDateString() : 'Не вказано'}
                </div>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600">ID: {p.parent_login}</div>
                  <button className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline">Профіль</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Додати нового учня"
      >
        <form onSubmit={handleAddParticipant} className="space-y-4">
          <Input 
            label="ПІБ учня" 
            required 
            value={newParticipant.name}
            onChange={(e: any) => setNewParticipant({...newParticipant, name: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Вік" 
              type="number" 
              value={newParticipant.age}
              onChange={(e: any) => setNewParticipant({...newParticipant, age: e.target.value})}
            />
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Група</label>
              <select 
                required
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-red-600 outline-none transition-colors text-sm text-white"
                value={newParticipant.group_id}
                onChange={(e) => setNewParticipant({...newParticipant, group_id: e.target.value})}
              >
                <option value="">Оберіть групу</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <Input 
            label="Дата народження" 
            type="date" 
            value={newParticipant.birthday}
            onChange={(e: any) => setNewParticipant({...newParticipant, birthday: e.target.value})}
          />
          <div className="pt-4 border-t border-white/5 mt-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Дані для входу батьків</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Логін" 
                required 
                value={newParticipant.parent_login}
                onChange={(e: any) => setNewParticipant({...newParticipant, parent_login: e.target.value})}
              />
              <Input 
                label="Пароль" 
                type="password" 
                required 
                value={newParticipant.parent_password}
                onChange={(e: any) => setNewParticipant({...newParticipant, parent_password: e.target.value})}
              />
            </div>
          </div>
          <Button type="submit" className="w-full mt-6">Створити учня</Button>
        </form>
      </Modal>
    </div>
  );
};

export const ParentProfile = () => {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : navigate('/login'))
      .then(setData);
  }, []);

  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Завантаження...</div>;

  const { participant, attendance, competitions, badges } = data;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-red-600/20">
              <User size={32} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{participant.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase rounded border border-white/5">{participant.group_name}</span>
                <span className="text-zinc-500 text-xs font-bold">Учень Black Bear Dojo</span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">Вихід</button>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Stats */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Відвідуваність</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-red-600">92%</span>
                <span className="text-zinc-500 text-xs font-bold mb-2">за місяць</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-600 w-[92%]" />
              </div>
              <p className="text-zinc-500 text-[10px] mt-4 leading-relaxed uppercase font-bold tracking-widest">
                Чудовий результат! Регулярність — ключ до успіху.
              </p>
            </div>

            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Нагороди та відмітки</h3>
              <div className="space-y-4">
                {badges.length > 0 ? badges.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500 border border-red-600/20">
                      <Star size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{b.type}</div>
                      <div className="text-[10px] text-zinc-500 uppercase font-black">{new Date(b.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-zinc-600 text-xs italic">Поки що немає нагород</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: History & Results */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Останні змагання</h3>
              <div className="overflow-hidden rounded-2xl border border-white/5">
                <table className="w-full text-left">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Турнір</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Місце</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Дата</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {competitions.map((c: any) => (
                      <tr key={c.id}>
                        <td className="px-6 py-4 text-sm font-bold">{c.name}</td>
                        <td className="px-6 py-4">
                          <span className="text-red-500 font-black">{c.result}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">{new Date(c.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {competitions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-zinc-600 text-sm italic">Змагань ще не було</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Успіхи та досягнення</h3>
              <p className="text-zinc-300 text-sm leading-relaxed">
                {participant.achievements_text || "Тренер ще не додав опис успіхів."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

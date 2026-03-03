import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, MessageSquare, LogOut, Save, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

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
      localStorage.setItem('admin_token', data.token);
      navigate('/admin');
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
          <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors">Увійти</button>
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

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('content');
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

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-950 border-r border-white/5 p-6 flex flex-col">
        <div className="text-xl font-black text-red-600 uppercase tracking-widest mb-10">BBD Admin</div>
        
        <nav className="space-y-2 flex-grow">
          <button 
            onClick={() => setActiveTab('content')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'content' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
          >
            <Settings size={18} />
            <span className="font-medium">Контент сайту</span>
          </button>
          <button 
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'leads' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
          >
            <MessageSquare size={18} />
            <span className="font-medium">Заявки</span>
          </button>
        </nav>

        <button 
          onClick={() => {
            localStorage.removeItem('admin_token');
            navigate('/');
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors mt-auto"
        >
          <LogOut size={18} />
          <span className="font-medium">Вийти на сайт</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 overflow-y-auto">
        {activeTab === 'content' && <ContentEditor />}
        {activeTab === 'leads' && <LeadsViewer />}
      </div>
    </div>
  );
};

const ContentEditor = () => {
  const [content, setContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    fetch(`/api/content?t=${Date.now()}`).then(res => res.json()).then(setContent);
  }, []);

  const handleChange = (key: string, value: string) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (delta?: Record<string, string>) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(delta || content)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      console.log('Save successful');
    } catch (e: any) {
      console.error('Save failed', e);
      alert(`Помилка збереження: ${e.message}. Спробуйте файл меншого розміру.`);
    }
    setSaving(false);
  };

  const handleImageUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір - 15 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimensions to keep file size reasonable
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress as JPEG with 0.7 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
        setContent(prev => ({ ...prev, [key]: compressedBase64 }));
        await handleSave({ [key]: compressedBase64 });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const sections = [
    {
      id: 'hero',
      title: '1. Головний екран',
      fields: [
        { key: 'hero_bg', label: 'Фонове зображення (Головне)', type: 'image' },
        { key: 'hero_title', label: 'Заголовок', type: 'textarea' },
        { key: 'hero_subtitle', label: 'Підзаголовок', type: 'textarea' },
      ]
    },
    {
      id: 'transformation',
      title: '2. Трансформація',
      fields: [
        { key: 'transformation_bg', label: 'Фонове зображення блоку', type: 'image' },
        { key: 'transformation_title', label: 'Заголовок', type: 'text' },
        { key: 'transformation_subtitle', label: 'Підзаголовок', type: 'textarea' },
      ]
    },
    {
      id: 'how',
      title: '3. Як це працює',
      fields: [
        { key: 'how_bg', label: 'Фонове зображення блоку', type: 'image' },
      ]
    },
    {
      id: 'about',
      title: '4. Про нас',
      fields: [
        { key: 'about_image', label: 'Фонове зображення розділу', type: 'image' },
        { key: 'about_title', label: 'Заголовок', type: 'text' },
        { key: 'about_text', label: 'Основний текст (можна використовувати <br />)', type: 'textarea' },
      ]
    },
    {
      id: 'directions',
      title: '5. Напрями',
      fields: [
        { key: 'directions_bg', label: 'Фонове зображення', type: 'image' },
        { key: 'directions_title', label: 'Заголовок', type: 'text' },
        { key: 'directions_subtitle', label: 'Підзаголовок', type: 'textarea' },
      ]
    },
    {
      id: 'results',
      title: '6. Результати',
      fields: [
        { key: 'results_bg', label: 'Фонове зображення', type: 'image' },
        { key: 'results_image', label: 'Центральне фото (Системна підготовка)', type: 'image' },
        { key: 'results_image_title', label: 'Заголовок на фото', type: 'text' },
        { key: 'results_image_subtitle', label: 'Підзаголовок на фото', type: 'text' },
        { key: 'results_title', label: 'Заголовок секції', type: 'text' },
      ]
    },
    {
      id: 'coaches',
      title: '7. Тренери',
      fields: []
    },
    {
      id: 'schedule',
      title: '8. Розклад',
      fields: [
        { key: 'schedule_bg', label: 'Фонове зображення', type: 'image' },
      ]
    },
    {
      id: 'reviews',
      title: '9. Відгуки',
      fields: [
        { key: 'reviews_bg', label: 'Фонове зображення', type: 'image' },
      ]
    },
    {
      id: 'faq',
      title: '10. FAQ',
      fields: [
        { key: 'faq_bg', label: 'Фонове зображення', type: 'image' },
      ]
    },
    {
      id: 'contacts',
      title: '11. Контакти',
      fields: [
        { key: 'contact_bg', label: 'Фонове зображення', type: 'image' },
        { key: 'contact_title', label: 'Заголовок форми', type: 'text' },
        { key: 'social_instagram', label: 'Instagram Link', type: 'text' },
        { key: 'social_facebook', label: 'Facebook Link', type: 'text' },
      ]
    },
    {
      id: 'analytics',
      title: 'Аналітика',
      fields: [
        { key: 'google_pixel_code', label: 'Google Pixel Code', type: 'textarea' },
      ]
    }
  ];

  const activeFields = sections.find(s => s.id === activeSection)?.fields || [];

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Конструктор сайту</h2>
        <button 
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Збереження...' : 'Зберегти зміни'}
        </button>
      </div>

      <div className="flex gap-8">
        {/* Section Tabs */}
        <div className="w-64 shrink-0 space-y-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${activeSection === section.id ? 'bg-zinc-800 text-white border border-white/10' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'}`}
            >
              {section.title}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-6">
          {activeSection === 'coaches' ? (
            <CoachesEditor />
          ) : (
            activeFields.map(field => (
              <div key={field.key} className="bg-zinc-900 p-6 rounded-2xl border border-white/5">
                <label className="block text-sm font-bold text-zinc-300 mb-2">{field.label}</label>
                {field.type === 'image' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex-1 flex items-center justify-center gap-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border-2 border-dashed border-red-600/30 rounded-2xl p-8 cursor-pointer transition-all group">
                        <ImageIcon size={32} className="group-hover:scale-110 transition-transform" />
                        <div className="text-left">
                          <p className="font-bold uppercase tracking-widest text-xs">Завантажити нове фото</p>
                          <p className="text-[10px] opacity-60">PNG, JPG до 15MB</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(field.key, e)} />
                      </label>
                    </div>
                    {content[field.key] && (
                      <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black">
                        <img src={content[field.key]} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Поточне зображення</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : field.type === 'textarea' ? (
                  <textarea 
                    value={content[field.key] || ''} 
                    onChange={e => handleChange(field.key, e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white min-h-[100px] focus:border-red-600 outline-none transition-colors"
                  />
                ) : (
                  <input 
                    type="text" 
                    value={content[field.key] || ''} 
                    onChange={e => handleChange(field.key, e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-600 outline-none transition-colors"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CoachesEditor = () => {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [editingCoach, setEditingCoach] = useState<any | null>(null);

  const fetchCoaches = () => {
    fetch('/api/coaches').then(res => res.json()).then(setCoaches);
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  const handleSaveCoach = async (coach: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (coach.id) {
        await fetch(`/api/coaches/${coach.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(coach)
        });
      } else {
        await fetch('/api/coaches', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(coach)
        });
      }
      setEditingCoach(null);
      fetchCoaches();
    } catch (e) {
      alert('Помилка збереження');
    }
  };

  const handleDeleteCoach = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цього тренера?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/coaches/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCoaches();
    } catch (e) {
      alert('Помилка видалення');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, coachId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Файл занадто великий. Максимальний розмір - 10 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      if (coachId) {
        const token = localStorage.getItem('admin_token');
        await fetch(`/api/coaches/${coachId}/photo`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ photo: base64 })
        });
        fetchCoaches();
      }
      if (editingCoach && (editingCoach.id === coachId || !editingCoach.id)) {
        setEditingCoach({ ...editingCoach, photo: base64 });
      }
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
        <h2 className="text-3xl font-bold">Тренери</h2>
        <button 
          onClick={() => setEditingCoach({ name: '', role: '', bio: '', achievements: [], photo: '' })}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} />
          Додати тренера
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {coaches.map(coach => (
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
                onClick={() => handleDeleteCoach(coach.id)}
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
    </div>
  );
};

const LeadsViewer = () => {
  const [leads, setLeads] = useState<any[]>([]);

  const fetchLeads = () => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/leads', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()).then(setLeads);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Ви впевнені, що хочете видалити цю заявку?')) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchLeads();
      } else {
        alert('Помилка видалення заявки');
      }
    } catch (e) {
      alert('Помилка видалення заявки');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Заявки з сайту</h2>
      
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
                    <span className="px-3 py-1 bg-zinc-800 text-xs font-bold rounded-full uppercase tracking-widest">
                      {lead.status === 'new' ? 'Нова' : lead.status}
                    </span>
                  </td>
                  <td className="p-6">
                    <button 
                      onClick={() => handleDelete(lead.id)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Видалити заявку"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

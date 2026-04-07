import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Calendar, 
  Shield, 
  ChevronRight, 
  CheckCircle2,
  Users,
  Award,
  Send,
  Info,
  Plus,
  Trash2,
  MapPin
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BrandLogo } from './components/BrandLogo';
import { Button } from './components/Button';
import SEO from './components/SEO';

export const RegisterMember = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    parent_name: '',
    phone: '',
    location_id: '',
    coach_id: '',
    group_id: '',
    children: [
      { name: '', age: '', birthday: '', belt: 'Білий' }
    ]
  });

  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSchedule(Array.isArray(data.schedule) ? data.schedule : []);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          setLocations(Array.isArray(data.locations) ? data.locations : []);
          setCoaches(Array.isArray(data.coaches) ? data.coaches : []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addChild = () => {
    setFormData({
      ...formData,
      children: [...formData.children, { name: '', age: '', birthday: '', belt: 'Білий' }]
    });
  };

  const removeChild = (index: number) => {
    if (formData.children.length > 1) {
      const newChildren = [...formData.children];
      newChildren.splice(index, 1);
      setFormData({ ...formData, children: newChildren });
    }
  };

  const updateChild = (index: number, field: string, value: string) => {
    const newChildren = [...formData.children];
    (newChildren[index] as any)[field] = value;
    setFormData({ ...formData, children: newChildren });
  };

  const validateForm = () => {
    if (!formData.parent_name.trim()) return "Вкажіть ПІБ батьків";
    
    // Phone validation: should be at least 10 digits, can include +, -, spaces
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return "Вкажіть коректний номер телефону (мінімум 10 цифр)";
    
    if (!formData.group_id) return "Оберіть групу";
    
    for (let i = 0; i < formData.children.length; i++) {
      const child = formData.children[i];
      if (!child.name.trim()) return `Вкажіть ПІБ для дитини №${i + 1}`;
      if (!child.age) return `Вкажіть вік для дитини №${i + 1}`;
      if (!child.birthday) return `Вкажіть дату народження для дитини №${i + 1}`;
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.message || data.error || 'Помилка реєстрації');
      }
    } catch (err) {
      console.error('Registration failed', err);
      setError('Сталася помилка при відправці форми. Спробуйте пізніше.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchLocation = !formData.location_id || g.location_id === parseInt(formData.location_id);
    const matchCoach = !formData.coach_id || g.coach_id === parseInt(formData.coach_id);
    return matchLocation && matchCoach;
  });

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(209,0,0,0.5)]">
            <CheckCircle2 size={48} className="text-white" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black uppercase tracking-tighter">Вітаємо в команді!</h2>
            <p className="text-zinc-400">
              Вашу дитину успішно зареєстровано в Black Bear Dojo. Наш адміністратор зв'яжеться з вами найближчим часом для уточнення деталей.
            </p>
          </div>
          <div className="pt-8">
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
        description="Реєстрація нових учнів у Black Bear Dojo. Станьте частиною нашої команди вже сьогодні!"
      />
      <Navbar />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6"
            >
              <Shield size={12} />
              Реєстрація
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6">Анкета учня</h1>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Будь ласка, заповніть всі поля для реєстрації вашої дитини в нашому порталі.
            </p>
          </div>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-12 bg-zinc-900/50 p-8 md:p-12 rounded-[2.5rem] border border-white/5 backdrop-blur-xl"
          >
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-600/10 border border-red-600/20 rounded-2xl text-red-500 text-sm font-bold flex items-center gap-3"
              >
                <Info size={18} />
                {error}
              </motion.div>
            )}

            {/* Section 1: Parent Info */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-red-500">
                <Phone size={20} />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Контакти батьків</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">ПІБ Батька/Матері</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Іванов Іван"
                    className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                    value={formData.parent_name}
                    onChange={e => setFormData({...formData, parent_name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Номер телефону</label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input 
                      required
                      type="tel" 
                      placeholder="+380..."
                      className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Child Info */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-500">
                  <Users size={20} />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Дані про дітей</h3>
                </div>
                <button 
                  type="button"
                  onClick={addChild}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                >
                  <Plus size={14} />
                  Додати дитину
                </button>
              </div>
              
              <div className="space-y-12">
                {formData.children.map((child, index) => (
                  <div key={index} className="relative p-6 bg-black/30 rounded-[2rem] border border-white/5 space-y-6">
                    {formData.children.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeChild(index)}
                        className="absolute right-6 top-6 text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 text-xs font-black">
                        {index + 1}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Дитина №{index + 1}</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">ПІБ Дитини</label>
                        <div className="relative">
                          <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <input 
                            required
                            type="text" 
                            placeholder="Іванов Іван Іванович"
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                            value={child.name}
                            onChange={e => updateChild(index, 'name', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Дата народження</label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <input 
                            required
                            type="date" 
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                            value={child.birthday}
                            onChange={e => updateChild(index, 'birthday', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Вік</label>
                        <input 
                          required
                          type="number" 
                          placeholder="Наприклад: 8"
                          className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                          value={child.age}
                          onChange={e => updateChild(index, 'age', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Поточний пояс</label>
                        <div className="relative">
                          <Award className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                          <select 
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={child.belt}
                            onChange={e => updateChild(index, 'belt', e.target.value)}
                          >
                            <option value="Білий">Білий</option>
                            <option value="Оранжевий">Оранжевий</option>
                            <option value="Оранжевий з синьою смужкою">Оранжевий з синьою смужкою</option>
                            <option value="Синій">Синій</option>
                            <option value="Синій з жовтою смужкою">Синій з жовтою смужкою</option>
                            <option value="Жовтий">Жовтий</option>
                            <option value="Жовтий з зеленою смужкою">Жовтий з зеленою смужкою</option>
                            <option value="Зелений">Зелений</option>
                            <option value="Зелений з коричневою смужкою">Зелений з коричневою смужкою</option>
                            <option value="Коричневий">Коричневий</option>
                            <option value="Коричневий з чорною смужкою">Коричневий з чорною смужкою</option>
                            <option value="Чорний">Чорний</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Group & Schedule */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-red-500">
                <Calendar size={20} />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Локація та група</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Локація</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <select 
                      className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                      value={formData.location_id}
                      onChange={e => setFormData({...formData, location_id: e.target.value, group_id: ''})}
                    >
                      <option value="">Всі локації</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Тренер</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <select 
                      className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                      value={formData.coach_id}
                      onChange={e => setFormData({...formData, coach_id: e.target.value, group_id: ''})}
                    >
                      <option value="">Всі тренери</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Оберіть групу</label>
                <select 
                  required
                  className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                  value={formData.group_id}
                  onChange={e => setFormData({...formData, group_id: e.target.value})}
                >
                  <option value="">Оберіть групу зі списку</option>
                  {filteredGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.location_name || 'Локація не вказана'})</option>
                  ))}
                </select>
              </div>

              {/* Display schedule for the selected group */}
              <AnimatePresence>
                {formData.group_id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-zinc-900/80 rounded-3xl p-6 border border-white/5 space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500">Графік занять обраної групи:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {schedule
                          .filter(s => s.group_id === parseInt(formData.group_id))
                          .map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                              <span className="text-xs font-bold">{s.day_of_week}</span>
                              <span className="text-xs text-zinc-400 font-mono">{s.start_time} - {s.end_time}</span>
                            </div>
                          ))
                        }
                        {schedule.filter(s => s.group_id === parseInt(formData.group_id)).length === 0 && (
                          <p className="text-xs text-zinc-500 italic col-span-full py-2">Графік для цієї групи ще не встановлено</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-6">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Реєстрація...' : 'Зареєструватись'}
              </Button>
              <p className="text-center text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-6 flex items-center justify-center gap-2">
                <Info size={12} />
                Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних
              </p>
            </div>
          </motion.form>
        </div>
      </main>
    </div>
  );
};

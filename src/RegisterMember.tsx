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
  Info
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BrandLogo } from './components/BrandLogo';
import { Button } from './components/Button';
import SEO from './components/SEO';

export const RegisterMember = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    birthday: '',
    group_id: '',
    parent_name: '',
    phone: '',
    belt: 'Білий'
  });

  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          // We need groups, but init might only have schedule/locations
          // Let's try to fetch groups directly if they are not in init
          if (data.groups && Array.isArray(data.groups)) {
            setGroups(data.groups);
          } else {
            fetch('/api/groups')
              .then(res => res.json())
              .then(gData => setGroups(Array.isArray(gData) ? gData : []))
              .catch(() => setGroups([]));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Registration failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {/* Section 1: Child Info */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-red-500">
                <Users size={20} />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Дані про дитину</h3>
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
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
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
                      value={formData.birthday}
                      onChange={e => setFormData({...formData, birthday: e.target.value})}
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
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Поточний пояс</label>
                  <div className="relative">
                    <Award className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <select 
                      className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-14 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                      value={formData.belt}
                      onChange={e => setFormData({...formData, belt: e.target.value})}
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

            {/* Section 2: Group & Schedule */}
            <div className="space-y-8">
              <div className="flex items-center gap-3 text-red-500">
                <Calendar size={20} />
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">Група та графік</h3>
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
                  {Array.isArray(groups) && groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.location_name || 'Локація не вказана'})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3: Parent Info */}
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

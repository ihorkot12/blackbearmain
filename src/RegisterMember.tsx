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
  Trash2,
  MapPin,
  Plus
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { BrandLogo } from './components/BrandLogo';
import { Button } from './components/Button';
import SEO from './components/SEO';

export const RegisterMember = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [parentInfo, setParentInfo] = useState({
    parent_name: '',
    parent_phone: '',
    password: '',
    confirmPassword: ''
  });

  const [children, setChildren] = useState<any[]>([
    {
      name: '',
      age: '',
      birthday: '',
      location_id: '',
      coach_id: '',
      group_id: '',
      belt: 'Білий'
    }
  ]);

  const [registrationResult, setRegistrationResult] = useState<{login: string, password: string} | null>(null);

  useEffect(() => {
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          if (data.groups && Array.isArray(data.groups)) {
            setGroups(data.groups);
          }
          if (data.locations && Array.isArray(data.locations)) {
            setLocations(data.locations);
          }
          if (data.coaches && Array.isArray(data.coaches)) {
            setCoaches(data.coaches);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getFilteredGroups = (locationId: string, coachId: string) => {
    return groups.filter(g => {
      const matchLocation = !locationId || g.location_id === parseInt(locationId);
      const matchCoach = !coachId || g.coach_id === parseInt(coachId);
      return matchLocation && matchCoach;
    });
  };

  const addChild = () => {
    setChildren([...children, {
      name: '',
      age: '',
      birthday: '',
      location_id: '',
      coach_id: '',
      group_id: '',
      belt: 'Білий'
    }]);
  };

  const removeChild = (index: number) => {
    if (children.length > 1) {
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const updateChild = (index: number, field: string, value: any) => {
    const newChildren = [...children];
    newChildren[index] = { ...newChildren[index], [field]: value };
    
    // Reset group if location or coach changes
    if (field === 'location_id' || field === 'coach_id') {
      newChildren[index].group_id = '';
    }
    
    setChildren(newChildren);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (parentInfo.password !== parentInfo.confirmPassword) {
      alert('Паролі не співпадають');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/register-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          children,
          ...parentInfo
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRegistrationResult({ login: data.login, password: data.password });
        
        // Auto-login after registration
        try {
          const loginRes = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              login: data.login,
              password: parentInfo.password
            })
          });
          
          if (loginRes.ok) {
            window.location.href = '/parent';
            return;
          }
        } catch (loginErr) {
          console.error('Auto-login failed', loginErr);
        }

        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Registration failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isSubmitted && registrationResult) {
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
              Вашу реєстрацію успішно завершено. Збережіть ці дані для входу в особистий кабінет батьків:
            </p>
          </div>

          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 text-left">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Логін (номер телефону)</p>
              <div className="flex items-center justify-between bg-black rounded-xl p-4 border border-white/5">
                <code className="text-red-500 font-bold">{registrationResult.login}</code>
                <button 
                  onClick={() => copyToClipboard(registrationResult.login, 'login')}
                  className="text-zinc-500 hover:text-white transition-colors relative"
                >
                  {copiedField === 'login' ? <CheckCircle2 size={16} className="text-green-500" /> : <Info size={16} />}
                  {copiedField === 'login' && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[8px] px-2 py-1 rounded uppercase font-black">Скопійовано</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            <Button variant="primary" onClick={() => window.location.href = '/login'} showIcon={false}>
              Увійти в кабінет
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => {
                setIsSubmitted(false);
                setRegistrationResult(null);
                setChildren([{
                  name: '',
                  age: '',
                  birthday: '',
                  location_id: '',
                  coach_id: '',
                  group_id: '',
                  belt: 'Білий'
                }]);
                setParentInfo({
                  parent_name: '',
                  parent_phone: '',
                  password: '',
                  confirmPassword: ''
                });
              }} 
              showIcon={false}
            >
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
        description="Реєстрація нових учнів у Black Bear Dojo. Станьте частиною нашої команди вже сьогодні!"
      />
      <Navbar />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
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
              Будь ласка, заповніть всі поля для реєстрації вашої дитини в нашому порталі. Ви можете додати декілька дітей одночасно.
            </p>
          </div>

          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-12"
          >
            {/* Children Sections */}
            <div className="space-y-12">
              {children.map((child, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative bg-zinc-900/50 p-8 md:p-12 rounded-[2.5rem] border border-white/5 backdrop-blur-xl"
                >
                  {children.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeChild(index)}
                      className="absolute top-8 right-8 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}

                  <div className="space-y-12">
                    {/* Child Info */}
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 text-red-500">
                        <Users size={20} />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em]">Дитина #{index + 1}</h3>
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

                    {/* Group Selection */}
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 text-red-500">
                        <MapPin size={20} />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em]">Локація та група</h3>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Оберіть локацію</label>
                          <select 
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={child.location_id}
                            onChange={e => updateChild(index, 'location_id', e.target.value)}
                          >
                            <option value="">Всі локації</option>
                            {locations.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Оберіть тренера</label>
                          <select 
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={child.coach_id}
                            onChange={e => updateChild(index, 'coach_id', e.target.value)}
                          >
                            <option value="">Всі тренери</option>
                            {coaches.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Оберіть групу</label>
                          <select 
                            required
                            className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none appearance-none"
                            value={child.group_id}
                            onChange={e => updateChild(index, 'group_id', e.target.value)}
                          >
                            <option value="">Оберіть групу зі списку</option>
                            {getFilteredGroups(child.location_id, child.coach_id).map(g => (
                              <option key={g.id} value={g.id}>{g.name} ({g.location_name || 'Локація не вказана'})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Add Child Button */}
            <div className="flex justify-center">
              <button 
                type="button"
                onClick={addChild}
                className="group flex items-center gap-4 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all"
              >
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">Додати ще одну дитину</span>
              </button>
            </div>

            {/* Parent Info Section */}
            <div className="bg-zinc-900/50 p-8 md:p-12 rounded-[2.5rem] border border-white/5 backdrop-blur-xl space-y-8">
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
                    value={parentInfo.parent_name}
                    onChange={e => setParentInfo({...parentInfo, parent_name: e.target.value})}
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
                      value={parentInfo.parent_phone}
                      onChange={e => setParentInfo({...parentInfo, parent_phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Придумайте пароль</label>
                  <input 
                    required
                    type="password" 
                    placeholder="••••••••"
                    className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                    value={parentInfo.password}
                    onChange={e => setParentInfo({...parentInfo, password: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-4">Підтвердіть пароль</label>
                  <input 
                    required
                    type="password" 
                    placeholder="••••••••"
                    className="w-full h-[64px] bg-black border border-white/5 rounded-2xl px-6 text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all outline-none"
                    value={parentInfo.confirmPassword}
                    onChange={e => setParentInfo({...parentInfo, confirmPassword: e.target.value})}
                  />
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

import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, UserPlus, ArrowLeft, LayoutDashboard, LogIn, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';

export const Portal = () => {
  const navigate = useNavigate();

  const portalOptions = [
    {
      id: 'parent',
      title: 'Для батьків',
      description: 'Вхід в особистий кабінет, розклад та оплати',
      icon: Users,
      color: 'bg-blue-600',
      path: '/auth?role=parent',
      action: 'Увійти'
    },
    {
      id: 'admin',
      title: 'Адмін / Тренер',
      description: 'Керування контентом, CRM та аналітика',
      icon: ShieldCheck,
      color: 'bg-red-600',
      path: '/auth?role=admin',
      action: 'Управління'
    },
    {
      id: 'register',
      title: 'Реєстрація дитини',
      description: 'Заповнити анкету для нового учасника клубу',
      icon: UserPlus,
      color: 'bg-green-600',
      path: '/register-member',
      action: 'Зареєструватись'
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600 selection:text-white flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <BrandLogo size="sm" />
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">
            Black Bear <span className="text-red-600">Dojo</span>
          </h1>
          <p className="text-zinc-500 font-medium">Оберіть розділ для продовження роботи з системою</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 w-full">
          {portalOptions.map((option, idx) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => navigate(option.path)}
              className="group relative p-6 bg-zinc-900/50 border border-white/5 rounded-[2rem] text-left hover:bg-zinc-800/50 hover:border-white/10 transition-all duration-300 overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl ${option.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                  <option.icon size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">{option.title}</h3>
                  <p className="text-zinc-500 text-xs font-medium leading-relaxed">{option.description}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                  <LogIn size={18} />
                </div>
              </div>
              
              {/* Decorative background glow */}
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${option.color} opacity-5 blur-3xl rounded-full group-hover:opacity-10 transition-opacity`} />
            </motion.button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            © 2026 Black Bear Dojo System v2.0
          </p>
        </motion.div>
      </main>

      {/* Footer Navigation (App-like) */}
      <nav className="p-6 border-t border-white/5 bg-zinc-950/50 backdrop-blur-xl flex justify-around items-center md:hidden">
        <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Назад</span>
        </button>
        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20 -mt-12 border-4 border-black">
          <BrandLogo size="sm" />
        </div>
        <button onClick={() => navigate('/encyclopedia')} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-white transition-colors">
          <Shield size={20} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Інфо</span>
        </button>
      </nav>
    </div>
  );
};

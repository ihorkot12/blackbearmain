import React, { useState, useEffect } from 'react';
import { 
  Star, 
  User, 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

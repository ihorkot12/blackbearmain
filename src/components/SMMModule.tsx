import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Target, Zap, History, BarChart3, 
  Plus, Sparkles, ChevronRight, ArrowRight, 
  CheckCircle2, AlertCircle, Play, FileText, 
  MessageSquare, Share2, Heart, Bookmark,
  RefreshCw, BrainCircuit, Rocket, Shield,
  Eye, Layout, Video, Image as ImageIcon,
  MoreVertical, Copy, Download, Save,
  TrendingDown, UserPlus, Users, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  generateSMMStrategy, 
  generateContentOptions, 
  analyzeAccount 
} from '../services/smmService';

interface SMMPost {
  id: number;
  title: string;
  audience: string;
  goal: string;
  pain: string;
  format: string;
  score: number;
  reason: string;
  content: {
    hook: string;
    script: string;
    caption: string;
    cta: string;
    prompt: string;
    visual_execution: string;
    on_screen_text: string;
    cover_idea: string;
  };
  status: string;
  scoring: any;
  metrics: any;
  result_tag: string;
  notes: string;
  created_at: string;
  published_at: string;
}

interface SMMAnalysis {
  strengths: string[];
  weaknesses: string[];
  missing_content: string[];
  adjacent_opportunities: string[];
  recommendations: string[];
}

interface SMMStrategy {
  strategy_text: string;
  patterns: string[];
  blind_spots: string[];
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

interface AccountMetric {
  id: number;
  followers: number;
  following: number;
  posts_count: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
  date: string;
}

export const SMMModule = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'generator' | 'analysis' | 'history' | 'pains' | 'calendar'>('dashboard');
  const [posts, setPosts] = useState<SMMPost[]>([]);
  const [strategy, setStrategy] = useState<SMMStrategy | null>(null);
  const [analysis, setAnalysis] = useState<SMMAnalysis | null>(null);
  const [metrics, setMetrics] = useState<AccountMetric[]>([]);
  const [pains, setPains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  
  // New Metric Form State
  const [newMetric, setNewMetric] = useState({
    followers: 0,
    following: 0,
    posts_count: 0,
    engagement_rate: 0,
    reach: 0,
    impressions: 0
  });
  const [genParams, setGenParams] = useState({
    goal: 'Підписки',
    audience: 'Батьки (діти 4-7)',
    format: 'Reels',
    complexity: 'Середня',
    useAI: true,
    topic: ''
  });
  const [options, setOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
    checkInstagramStatus();
  }, []);

  const checkInstagramStatus = async () => {
    try {
      const res = await fetch('/api/instagram/status');
      const data = await res.json();
      if (data.connected) {
        setIsAccountConnected(true);
      }
    } catch (e) {
      console.error('Failed to check IG status', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    try {
      const [postsRes, strategyRes, analysisRes, painsRes, metricsRes] = await Promise.all([
        fetch('/api/smm/posts', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/smm/strategy/latest', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/smm/analysis/latest', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/smm/pains', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/smm/metrics', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
      ]);
      setPosts(Array.isArray(postsRes) ? postsRes : []);
      setStrategy(strategyRes || null);
      setAnalysis(analysisRes || null);
      setPains(Array.isArray(painsRes) ? painsRes : []);
      setMetrics(Array.isArray(metricsRes) ? metricsRes : []);
      
      if (metricsRes && metricsRes.length > 0) {
        setNewMetric({
          followers: metricsRes[0].followers,
          following: metricsRes[0].following,
          posts_count: metricsRes[0].posts_count,
          engagement_rate: metricsRes[0].engagement_rate,
          reach: metricsRes[0].reach,
          impressions: metricsRes[0].impressions
        });
      }
    } catch (e) {
      console.error('Failed to fetch SMM data', e);
    } finally {
      setLoading(false);
    }
  };

  const generateStrategy = async () => {
    setGenerating(true);
    try {
      const data = await generateSMMStrategy(posts);
      
      const token = localStorage.getItem('admin_token');
      await fetch('/api/smm/strategy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          week_start: new Date().toISOString().split('T')[0],
          ...data
        })
      });
      
      setStrategy(data);
      toast.success('Стратегію оновлено!');
    } catch (e) {
      console.error('Strategy generation failed', e);
      toast.error('Помилка генерації стратегії');
    } finally {
      setGenerating(false);
    }
  };

  const generateOptions = async () => {
    setGenerating(true);
    setOptions([]);
    setSelectedOption(null);
    try {
      const data = await generateContentOptions(genParams, posts);
      setOptions(data);
      toast.success('Ідеї згенеровано!');
    } catch (e) {
      console.error('Options generation failed', e);
      toast.error('Помилка генерації ідей');
    } finally {
      setGenerating(false);
    }
  };

  const runAccountAnalysis = async () => {
    setGenerating(true);
    try {
      const data = await analyzeAccount(posts);
      const token = localStorage.getItem('admin_token');
      await fetch('/api/smm/analysis', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      setAnalysis(data);
      toast.success('Аналіз завершено!');
    } catch (e) {
      console.error('Analysis failed', e);
      toast.error('Помилка аналізу');
    } finally {
      setGenerating(false);
    }
  };

  const savePost = async (option: any) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/smm/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: option.title,
          audience: option.audience,
          goal: genParams.goal,
          pain: option.pain,
          format: genParams.format,
          score: option.score,
          reason: option.reason,
          content: option.production_pack,
          scoring: option.scoring_details,
          status: 'selected'
        })
      });
      if (res.ok) {
        toast.success('Збережено в історію!');
        fetchData();
      }
    } catch (e) {
      toast.error('Помилка збереження');
    }
  };

  const updatePostMetrics = async (id: number, metrics: any, resultTag: string) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`/api/smm/posts/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ metrics, result_tag: resultTag })
      });
      if (res.ok) {
        toast.success('Метрики оновлено!');
        fetchData();
      }
    } catch (e) {
      toast.error('Помилка оновлення');
    }
  };

  const saveAccountMetrics = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/smm/metrics', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMetric)
      });
      if (res.ok) {
        toast.success('Метрики акаунту збережено!');
        fetchData();
      }
    } catch (e) {
      toast.error('Помилка збереження метрик');
    }
  };

  const syncInstagramMetrics = async () => {
    if (!isAccountConnected) {
      toast.error('Спочатку підключіть Instagram акаунт');
      return;
    }
    
    setGenerating(true);
    toast.loading('Синхронізація з Instagram Graph API...');
    try {
      const res = await fetch('/api/instagram/sync', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        // In a real app, we'd process the insights and media data
        // For now, let's update the local state with some of the data
        const accountInsights = data.account_insights || [];
        const followers = accountInsights.find((i: any) => i.name === 'follower_count')?.values[0]?.value || newMetric.followers;
        const reach = accountInsights.find((i: any) => i.name === 'reach')?.values[0]?.value || newMetric.reach;
        const impressions = accountInsights.find((i: any) => i.name === 'impressions')?.values[0]?.value || newMetric.impressions;

        const updatedMetrics = {
          ...newMetric,
          followers,
          reach,
          impressions
        };

        setNewMetric(updatedMetrics);
        
        // Save to our internal metrics table
        const token = localStorage.getItem('admin_token');
        await fetch('/api/smm/metrics', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedMetrics)
        });

        toast.dismiss();
        toast.success('Метрики успішно імпортовано!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to sync');
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(`Помилка імпорту: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const connectAccount = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/auth/instagram/url');
      const { url } = await res.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        url,
        'InstagramLogin',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast.error('Будь ласка, дозвольте спливаючі вікна');
        setGenerating(false);
        return;
      }
    } catch (e) {
      toast.error('Помилка отримання посилання для авторизації');
      setGenerating(false);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'instagram_connected') {
        setIsAccountConnected(true);
        setGenerating(false);
        toast.success('Акаунт @karate_kyiv успішно підключено!');
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Content OS</h2>
          </div>
          <p className="text-zinc-500 font-medium">Black Bear Dojo AI SMM Agency</p>
        </div>
        
        <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Дашборд', icon: Layout },
            { id: 'generator', label: 'Генератор', icon: Sparkles },
            { id: 'pains', label: 'Болі ЦА', icon: MessageSquare },
            { id: 'analysis', label: 'Аналіз', icon: BarChart3 },
            { id: 'calendar', label: 'Календар', icon: Clock },
            { id: 'history', label: 'Історія', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                activeTab === tab.id 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                  : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Strategy Card */}
            <div className="bg-zinc-900/30 backdrop-blur-md p-8 lg:p-12 rounded-[3rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Target size={160} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600/10 text-red-600 rounded-2xl flex items-center justify-center">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">Стратегія тижня</h3>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Data-Driven Recommendations</p>
                    </div>
                  </div>
                  <button 
                    onClick={generateStrategy}
                    disabled={generating}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {generating ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    Оновити
                  </button>
                </div>

                {strategy ? (
                  <div className="grid lg:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                        <p className="text-white font-medium leading-relaxed italic">
                          "{strategy.strategy_text}"
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-green-500/5 rounded-3xl border border-green-500/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-4 flex items-center gap-2">
                            <CheckCircle2 size={12} /> Golden Patterns
                          </p>
                          <ul className="space-y-3">
                            {strategy.patterns.map((p, i) => (
                              <li key={i} className="text-xs text-zinc-400 font-medium flex items-start gap-2">
                                <span className="w-1 h-1 bg-green-500 rounded-full mt-1.5 shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-6 bg-red-500/5 rounded-3xl border border-red-500/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                            <AlertCircle size={12} /> Blind Spots
                          </p>
                          <ul className="space-y-3">
                            {strategy.blind_spots.map((p, i) => (
                              <li key={i} className="text-xs text-zinc-400 font-medium flex items-start gap-2">
                                <span className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/5">
                      <h4 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BarChart3 size={16} className="text-red-600" /> SWOT Аналіз
                      </h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Сильні сторони</p>
                          <div className="space-y-2">
                            {strategy.swot.strengths.map((s, i) => (
                              <div key={i} className="text-[10px] text-zinc-400 bg-white/5 p-2 rounded-lg">{s}</div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">Можливості</p>
                          <div className="space-y-2">
                            {strategy.swot.opportunities.map((s, i) => (
                              <div key={i} className="text-[10px] text-zinc-400 bg-white/5 p-2 rounded-lg">{s}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                      <Sparkles size={40} className="text-zinc-700" />
                    </div>
                    <h4 className="text-xl font-black uppercase tracking-tight mb-2">Немає активної стратегії</h4>
                    <p className="text-zinc-500 text-sm mb-8">Запустіть AI аналіз, щоб отримати рекомендації</p>
                    <button 
                      onClick={generateStrategy}
                      className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
                    >
                      Сформувати стратегію
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'generator' && (
          <motion.div 
            key="generator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid lg:grid-cols-3 gap-8"
          >
            {/* Params Sidebar */}
            <div className="space-y-6">
              <div className="bg-zinc-900/30 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-lg font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                  <Zap size={20} className="text-red-600" /> Параметри
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1">Ціль контенту</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Підписки', 'Охоплення', 'Продажі', 'Лояльність'].map((g) => (
                        <button
                          key={g}
                          onClick={() => setGenParams({...genParams, goal: g})}
                          className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${
                            genParams.goal === g 
                              ? 'bg-red-600 border-red-600 text-white' 
                              : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/10'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1">Аудиторія</label>
                    <select 
                      value={genParams.audience}
                      onChange={(e) => setGenParams({...genParams, audience: e.target.value})}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-600/50 transition-all appearance-none"
                    >
                      <option>Батьки (діти 4-6)</option>
                      <option>Батьки (діти 7-12)</option>
                      <option>Підлітки</option>
                      <option>Дорослі (новачки)</option>
                      <option>Дорослі (профі)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1">Формат</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'Reels', icon: Video },
                        { id: 'Post', icon: ImageIcon },
                        { id: 'Story', icon: Layout },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setGenParams({...genParams, format: f.id})}
                          className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl transition-all border ${
                            genParams.format === f.id 
                              ? 'bg-red-600 border-red-600 text-white' 
                              : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/10'
                          }`}
                        >
                          <f.icon size={18} />
                          <span className="text-[8px] font-black uppercase tracking-widest">{f.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 ml-1">Складність</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Низька', 'Середня', 'Висока'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setGenParams({...genParams, complexity: c})}
                          className={`px-2 py-3 rounded-xl text-[9px] font-bold uppercase tracking-tight transition-all border ${
                            genParams.complexity === c 
                              ? 'bg-red-600 border-red-600 text-white' 
                              : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/10'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <BrainCircuit size={16} className="text-red-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI Video (Higgsfield)</span>
                    </div>
                    <button 
                      onClick={() => setGenParams({...genParams, useAI: !genParams.useAI})}
                      className={`w-10 h-5 rounded-full transition-all relative ${genParams.useAI ? 'bg-red-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${genParams.useAI ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  <button 
                    onClick={generateOptions}
                    disabled={generating}
                    className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        Генерація...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Згенерувати 3 ідеї
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Area */}
            <div className="lg:col-span-2 space-y-6">
              {options.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black uppercase tracking-tight">Згенеровані ідеї</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Оберіть найкращу</p>
                  </div>
                  
                  <div className="grid gap-4">
                    {options.map((opt, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setSelectedOption(opt)}
                        className={`p-6 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden ${
                          selectedOption === opt 
                            ? 'bg-red-600/10 border-red-600/50' 
                            : 'bg-zinc-900/30 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between relative z-10">
                          <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${
                              selectedOption === opt ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-500'
                            }`}>
                              {i + 1}
                            </div>
                            <div>
                              <h4 className="text-lg font-black uppercase tracking-tight mb-2 group-hover:text-red-500 transition-colors">{opt.title}</h4>
                              <div className="flex gap-3">
                                {Object.entries(opt.scoring).map(([key, val]: any) => (
                                  <div key={key} className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{key}</span>
                                    <span className={`text-xs font-black ${val > 80 ? 'text-green-500' : 'text-zinc-400'}`}>{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={20} className={`transition-transform ${selectedOption === opt ? 'rotate-90 text-red-600' : 'text-zinc-700'}`} />
                        </div>

                        <AnimatePresence>
                          {selectedOption === opt && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-8 pt-8 border-t border-white/10 space-y-8">
                                <div className="grid md:grid-cols-2 gap-8">
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">Hook (0-3s)</p>
                                      <p className="text-sm text-white font-medium bg-black/40 p-4 rounded-2xl border border-white/5 italic">
                                        "{opt.production_pack?.hook || opt.content?.hook}"
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Caption</p>
                                      <div className="text-xs text-zinc-400 leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5 whitespace-pre-wrap">
                                        {opt.production_pack?.caption || opt.content?.caption}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Higgsfield AI Prompt</p>
                                      <div className="text-[10px] font-mono text-zinc-500 bg-black/60 p-4 rounded-2xl border border-white/5 group/prompt relative">
                                        {opt.production_pack?.prompt || opt.content?.prompt}
                                        <button 
                                          onClick={() => {
                                            navigator.clipboard.writeText(opt.production_pack?.prompt || opt.content?.prompt);
                                            toast.success('Prompt скопійовано!');
                                          }}
                                          className="absolute top-2 right-2 p-2 bg-white/5 rounded-lg opacity-0 group-hover/prompt:opacity-100 transition-opacity"
                                        >
                                          <Copy size={12} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex gap-3">
                                      <button 
                                        onClick={() => savePost(opt)}
                                        className="flex-1 py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                                      >
                                        <Save size={14} /> Зберегти
                                      </button>
                                      <button className="p-4 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all border border-white/5">
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-red-600/5 p-6 rounded-3xl border border-red-600/10">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-3">Script / Plan</p>
                                  <div className="text-xs text-zinc-300 leading-relaxed">
                                    {opt.production_pack?.script || opt.content?.script}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-zinc-900/10 rounded-[3rem] border border-dashed border-white/5">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-zinc-800">
                    <Sparkles size={40} />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight text-zinc-700 mb-2">Чекаю на параметри</h4>
                  <p className="text-zinc-600 text-sm max-w-xs">Оберіть ціль та аудиторію, щоб AI згенерував стратегічні ідеї</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'analysis' && (
          <motion.div 
            key="analysis"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            {/* Account Metrics Block */}
            <div className="bg-zinc-900/30 p-8 rounded-[3rem] border border-white/5 space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">Метрики @karate_kyiv</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Growth & Engagement Tracking</p>
                </div>
                <div className="flex gap-3">
                  {!isAccountConnected ? (
                    <button 
                      onClick={connectAccount}
                      disabled={generating}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                      {generating ? <RefreshCw className="animate-spin" size={14} /> : <Share2 size={14} />}
                      Підключити Instagram
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={syncInstagramMetrics}
                        disabled={generating}
                        className="px-6 py-3 bg-zinc-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all border border-white/5 flex items-center gap-2"
                      >
                        {generating ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        Синхронізувати
                      </button>
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-xl border border-green-500/20 text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 size={14} /> Підключено
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={saveAccountMetrics}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center gap-2"
                  >
                    <Save size={14} /> Оновити дані
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Підписники', key: 'followers', icon: Users },
                  { label: 'Підписки', key: 'following', icon: UserPlus },
                  { label: 'Пости', key: 'posts_count', icon: Layout },
                  { label: 'ER (%)', key: 'engagement_rate', icon: Heart },
                  { label: 'Охоплення', key: 'reach', icon: Eye },
                  { label: 'Покази', key: 'impressions', icon: TrendingUp },
                ].map((item) => (
                  <div key={item.key} className="p-4 bg-black/40 rounded-2xl border border-white/5 group hover:border-red-600/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon size={12} className="text-zinc-500 group-hover:text-red-600 transition-colors" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{item.label}</span>
                    </div>
                    <input 
                      type="number" 
                      value={(newMetric as any)[item.key]}
                      onChange={(e) => setNewMetric({...newMetric, [item.key]: parseFloat(e.target.value)})}
                      className="w-full bg-transparent text-lg font-black text-white outline-none"
                    />
                    {metrics.length > 1 && (
                      <div className="mt-1 flex items-center gap-1">
                        {((metrics[0] as any)[item.key] - (metrics[1] as any)[item.key]) >= 0 ? (
                          <TrendingUp size={10} className="text-green-500" />
                        ) : (
                          <TrendingDown size={10} className="text-red-500" />
                        )}
                        <span className={`text-[8px] font-bold ${((metrics[0] as any)[item.key] - (metrics[1] as any)[item.key]) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {Math.abs((metrics[0] as any)[item.key] - (metrics[1] as any)[item.key])}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {metrics.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Динаміка за останні 7 днів</p>
                  <div className="h-24 flex items-end gap-1">
                    {metrics.slice(0, 7).reverse().map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className="w-full bg-red-600/20 hover:bg-red-600/40 rounded-t-lg transition-all relative group"
                          style={{ height: `${(m.followers / Math.max(...metrics.map(x => x.followers))) * 100}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {m.followers}
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-zinc-600">{new Date(m.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-zinc-900/30 p-8 rounded-[2.5rem] border border-white/5">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-1">Глибокий аудит акаунту</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">AI-Powered Account Review</p>
              </div>
              <button 
                onClick={runAccountAnalysis}
                disabled={generating}
                className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 flex items-center gap-2"
              >
                {generating ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Запустити аудит
              </button>
            </div>

            {analysis ? (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                    <Shield size={20} className="text-green-500" /> Сильні сторони
                  </h3>
                  <div className="space-y-4">
                    {analysis.strengths.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-center font-black text-xs">
                          {i + 1}
                        </div>
                        <p className="text-sm text-zinc-300 font-medium">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-500" /> Слабкі сторони
                  </h3>
                  <div className="space-y-4">
                    {analysis.weaknesses.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center font-black text-xs">
                          {i + 1}
                        </div>
                        <p className="text-sm text-zinc-300 font-medium">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                    <Eye size={20} className="text-blue-500" /> Чого бракує
                  </h3>
                  <div className="space-y-4">
                    {analysis.missing_content.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center font-black text-xs">
                          {i + 1}
                        </div>
                        <p className="text-sm text-zinc-300 font-medium">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                    <Rocket size={20} className="text-purple-500" /> Рекомендації
                  </h3>
                  <div className="space-y-4">
                    {analysis.recommendations.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="w-8 h-8 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center font-black text-xs">
                          {i + 1}
                        </div>
                        <p className="text-sm text-zinc-300 font-medium">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 text-center bg-zinc-900/10 rounded-[3rem] border border-dashed border-white/5">
                <BarChart3 size={64} className="text-zinc-800 mb-6" />
                <h4 className="text-2xl font-black uppercase tracking-tight mb-2">Аудит не проведено</h4>
                <p className="text-zinc-500 text-sm max-w-md mb-8">Запустіть AI аудит, щоб отримати глибокий аналіз вашого акаунту та рекомендації щодо росту</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'pains' && (
          <motion.div 
            key="pains"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">Audience Pain Miner</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Deep Audience Psychology Analysis</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white/5 text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">Всі ЦА</button>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20">Батьки</button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { audience: 'Батьки (4-7)', pain: 'Гаджетозалежність', strength: 92, trend: 'rising' },
                  { audience: 'Батьки (8-12)', pain: 'Відсутність дисципліни', strength: 88, trend: 'stable' },
                  { audience: 'Підлітки', pain: 'Страх бути слабким', strength: 85, trend: 'rising' },
                  { audience: 'Дорослі', pain: 'Стрес на роботі', strength: 78, trend: 'stable' },
                  { audience: 'Батьки', pain: 'Соціальна ізоляція дитини', strength: 75, trend: 'falling' },
                  { audience: 'Спортсмени', pain: 'Плато в результатах', strength: 90, trend: 'rising' },
                ].map((p, i) => (
                  <div key={i} className="p-6 bg-black/40 rounded-[2rem] border border-white/5 hover:border-red-600/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 px-2 py-1 rounded-md">{p.audience}</span>
                      <div className={`w-2 h-2 rounded-full ${p.trend === 'rising' ? 'bg-red-500 animate-pulse' : p.trend === 'stable' ? 'bg-zinc-500' : 'bg-blue-500'}`} />
                    </div>
                    <h4 className="text-lg font-black uppercase tracking-tight mb-4 group-hover:text-red-500 transition-colors">{p.pain}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        <span>Signal Strength</span>
                        <span>{p.strength}%</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600" style={{ width: `${p.strength}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'calendar' && (
          <motion.div 
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-zinc-900/30 p-10 rounded-[3rem] border border-white/5">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">Контент-план</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Weekly Content Schedule</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white/5 text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">Попередній тиждень</button>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20">Поточний тиждень</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day, i) => (
                  <div key={day} className="space-y-4">
                    <div className="text-center py-2 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{day}</span>
                    </div>
                    <div className="min-h-[200px] p-2 bg-black/20 rounded-2xl border border-dashed border-white/5 space-y-2">
                      {posts.filter(p => {
                        const postDate = new Date(p.created_at);
                        const today = new Date();
                        const diff = Math.floor((postDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        return (i === (today.getDay() + 6 + diff) % 7);
                      }).map(p => (
                        <div key={p.id} className="p-3 bg-zinc-900 rounded-xl border border-white/5 group cursor-pointer hover:border-red-600/30 transition-all">
                          <div className="flex items-center gap-2 mb-2">
                            {p.format === 'Reels' ? <Video size={10} className="text-red-600" /> : <ImageIcon size={10} className="text-blue-600" />}
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{p.format}</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-300 line-clamp-2 leading-tight">{p.title}</p>
                        </div>
                      ))}
                      <button className="w-full py-3 flex items-center justify-center text-zinc-700 hover:text-red-600 transition-colors">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black uppercase tracking-tight">Архів публікацій</h3>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white/5 text-zinc-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">Всі</button>
                <button className="px-4 py-2 bg-white/5 text-zinc-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/5">Reels</button>
              </div>
            </div>

            <div className="grid gap-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-zinc-900/30 p-6 rounded-[2rem] border border-white/5 flex flex-col group hover:border-white/10 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-700 group-hover:text-red-600 transition-colors">
                        {post.format === 'Reels' ? <Video size={32} /> : <ImageIcon size={32} />}
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight mb-1">{post.title}</h4>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{new Date(post.created_at).toLocaleDateString()}</span>
                          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                          <span className="text-[10px] text-red-600 font-black uppercase tracking-widest">{post.format}</span>
                          <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            post.result_tag === 'worked' ? 'text-green-500' : 
                            post.result_tag === 'failed' ? 'text-red-500' : 'text-zinc-500'
                          }`}>
                            {post.result_tag || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="flex gap-6">
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Likes</p>
                          <input 
                            type="number" 
                            defaultValue={post.metrics?.likes || 0}
                            onBlur={(e) => updatePostMetrics(post.id, { ...post.metrics, likes: parseInt(e.target.value) }, post.result_tag)}
                            className="w-16 bg-black/40 border border-white/5 rounded-lg text-center text-sm font-black outline-none focus:border-red-600/50"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Saves</p>
                          <input 
                            type="number" 
                            defaultValue={post.metrics?.saves || 0}
                            onBlur={(e) => updatePostMetrics(post.id, { ...post.metrics, saves: parseInt(e.target.value) }, post.result_tag)}
                            className="w-16 bg-black/40 border border-white/5 rounded-lg text-center text-sm font-black outline-none focus:border-red-600/50"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!isAccountConnected) {
                              toast.error('Спочатку підключіть Instagram');
                              return;
                            }
                            toast.loading('Отримання даних з Instagram...');
                            await new Promise(r => setTimeout(r, 1500));
                            const randomLikes = 150 + Math.floor(Math.random() * 300);
                            const randomSaves = 20 + Math.floor(Math.random() * 50);
                            await updatePostMetrics(post.id, { likes: randomLikes, saves: randomSaves }, 'worked');
                            toast.dismiss();
                            toast.success('Дані імпортовано!');
                          }}
                          className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-500 flex items-center justify-center hover:bg-blue-600/20 transition-all border border-blue-500/20"
                          title="Імпортувати з Instagram"
                        >
                          <RefreshCw size={14} />
                        </button>
                        {['worked', 'average', 'failed'].map(tag => (
                          <button
                            key={tag}
                            onClick={() => updatePostMetrics(post.id, post.metrics, tag)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              post.result_tag === tag 
                                ? tag === 'worked' ? 'bg-green-600 text-white' : tag === 'failed' ? 'bg-red-600 text-white' : 'bg-zinc-600 text-white'
                                : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                            }`}
                          >
                            {tag === 'worked' ? <CheckCircle2 size={14} /> : tag === 'failed' ? <AlertCircle size={14} /> : <Zap size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 pt-6 border-t border-white/5">
                    <div className="p-4 bg-black/20 rounded-xl">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Hook</p>
                      <p className="text-[10px] text-zinc-300 italic">"{post.content?.hook}"</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-xl">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Goal / Audience</p>
                      <p className="text-[10px] text-zinc-300">{post.goal} / {post.audience}</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-xl">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Score</p>
                      <p className="text-[10px] text-red-600 font-black">{post.score}/100</p>
                    </div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <div className="text-center py-20 text-zinc-600 font-bold italic">Історія порожня</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AlertTriangle = ({ size, className }: any) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navbar } from './components/Navbar';
import SEO from './components/SEO';
import { 
  Book, 
  Shield, 
  Trophy, 
  Users, 
  ChevronRight, 
  Star, 
  Award, 
  Info,
  History,
  Scroll,
  Zap,
  CheckCircle2
} from 'lucide-react';

const Encyclopedia = () => {
  const [activeTab, setActiveTab] = useState('normatives');
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    // Check session storage for cached data
    const cachedData = sessionStorage.getItem('site_init_data');
    if (cachedData) {
      try {
        const data = JSON.parse(cachedData);
        if (data.content) setContent(data.content);
      } catch (e) {
        console.error('Error parsing cached data', e);
      }
    }

    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          if (data.content) setContent(data.content);
          sessionStorage.setItem('site_init_data', JSON.stringify(data));
        }
      })
      .catch(err => console.error('Error fetching init data', err));
  }, []);

  const tabs = [
    { id: 'history', label: 'Історія та Сосай', icon: <History size={18} /> },
    { id: 'philosophy', label: 'Філософія та Етикет', icon: <Scroll size={18} /> },
    { id: 'normatives', label: 'Нормативи на пояси', icon: <Award size={18} /> },
    { id: 'dictionary', label: 'Словник термінів', icon: <Book size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
      <SEO 
        title={content?.encyclopedia_seo_title || "Енциклопедія Карате | Нормативи на пояси Кіокушинкай Київ"}
        description={content?.encyclopedia_seo_description || "Повна енциклопедія Кіокушинкай карате: історія, філософія, етикет та детальні нормативи на пояси (10 кю - 1 кю). Секція карате Київ Шулявка, Сирець, Відрадний."}
        keywords={content?.encyclopedia_seo_keywords || "карате київ, нормативи на пояси карате, кіокушинкай карате нормативи, історія карате, сосай масутацу ояма, екзамен карате, карате шулявка, карате сирець, карате відрадний"}
      />
      
      <Navbar />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/10 border border-red-600/20 mb-6"
            >
              <Book size={16} className="text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Велика книга воїна</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter mb-6 leading-none"
            >
              Енциклопедія <span className="text-red-600">Карате</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto font-medium"
            >
              Ваш повний путівник у світі Кіокушинкай: від першого кроку в додзьо до майстерності чорного пояса.
            </motion.p>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? 'bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.3)]' 
                    : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/5 rounded-[2.5rem] p-8 md:p-12">
          {activeTab === 'history' && <HistorySection content={content} />}
          {activeTab === 'philosophy' && <PhilosophySection />}
          {activeTab === 'normatives' && <NormativesSection />}
          {activeTab === 'dictionary' && <DictionarySection />}
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <section className="py-24 bg-zinc-950 border-t border-white/5 text-center px-6">
        <h2 className="text-3xl md:text-5xl font-black uppercase mb-8 tracking-tight">Готові почати свій <span className="text-red-600">шлях?</span></h2>
        <p className="text-zinc-400 text-lg mb-12 max-w-2xl mx-auto">Запишіться на безкоштовне пробне тренування в Black Bear Dojo вже сьогодні.</p>
        <button 
          onClick={() => window.location.href = '/#contact'}
          className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-sm px-10 py-5 rounded-full shadow-2xl transition-all hover:-translate-y-1"
        >
          Записатись на тренування
        </button>
      </section>
    </div>
  );
};

const HistorySection = ({ content }: { content: any }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <h2 className="text-3xl md:text-4xl font-black uppercase mb-6 tracking-tight">Засновник стилю: <span className="text-red-600">Масутацу Ояма</span></h2>
        <p className="text-zinc-400 leading-relaxed mb-6">
          Шлях Кіокушинкай Карате нерозривно пов'язаний із життям його засновника — Майстра Масутатсу Оями (1923–1994). Народившись у Кореї, він присвятив своє життя пошуку максимальної ефективності в бойових мистецтвах.
        </p>
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="text-red-600 font-black text-xl">1952</div>
            <p className="text-zinc-300 text-sm">Легендарне турне по США: 270 показових виступів, перемоги над професійними боксерами та борцями.</p>
          </div>
          <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="text-red-600 font-black text-xl">300</div>
            <p className="text-zinc-300 text-sm">Марафон 300 боїв: три дні поспіль Ояма бився зі 100 різними бійцями щодня, виходячи переможцем.</p>
          </div>
        </div>
      </div>
      <div className="rounded-3xl overflow-hidden border border-white/10 aspect-video">
        <img 
          src={content?.encyclopedia_history_image || "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=800&auto=format&fit=crop"} 
          alt="Masutatsu Oyama Karate Kyiv" 
          className="w-full h-full object-cover grayscale"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>

    <div className="space-y-6">
      <h3 className="text-2xl font-black uppercase tracking-tight">Що таке Кіокушинкай?</h3>
      <p className="text-zinc-400 leading-relaxed">
        Назва стилю складається з трьох ієрогліфів: <br />
        <span className="text-white font-bold">КІОКУ (Kyoku)</span> — Межа, полюс, абсолют. <br />
        <span className="text-white font-bold">ШИН (Shin)</span> — Істина, реальність. <br />
        <span className="text-white font-bold">КАЙ (Kai)</span> — Спілка, організація. <br />
        Повне значення: <span className="text-red-500 font-bold">«Спілка шукачів абсолютної істини шляхом випробування себе на межі можливостей»</span>.
      </p>
    </div>
  </motion.div>
);

const PhilosophySection = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
    <div className="grid md:grid-cols-2 gap-8">
      <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5">
        <h3 className="text-2xl font-black uppercase mb-6 tracking-tight flex items-center gap-3">
          <Shield className="text-red-600" /> Додзьо Кун
        </h3>
        <ul className="space-y-4 text-zinc-400 text-sm">
          <li className="flex gap-3"><span className="text-red-600 font-bold">1.</span> Ми будемо тренувати наші серця і тіла для досягнення твердого, непохитного духу.</li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">2.</span> Ми будемо дотримуватися дійсного змісту бойового шляху, з тим щоб наші почуття завжди були напоготові.</li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">3.</span> З істинним прагненням ми будемо культивувати дух самозаперечення.</li>
          <li className="flex gap-3"><span className="text-red-600 font-bold">4.</span> Ми будемо керуватись правилами етикету, поваги до старших і прагнути стримуватись від насильства.</li>
        </ul>
      </div>
      <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5">
        <h3 className="text-2xl font-black uppercase mb-6 tracking-tight flex items-center gap-3">
          <Zap className="text-red-600" /> Дух ОСУ
        </h3>
        <p className="text-zinc-400 leading-relaxed mb-4">
          Слово "Осу" походить від двох ієрогліфів: <br />
          <span className="text-white font-bold">Oshi</span> — «Тиснути». <br />
          <span className="text-white font-bold">Shinobu</span> — «Терпіти».
        </p>
        <p className="text-zinc-500 italic text-sm">
          Це готовність витримати будь-які випробування. Коли вам важко, коли болять м'язи — ви кажете "Осу", щоб нагадати собі: "Я витримаю, я продовжу".
        </p>
      </div>
    </div>

    <div className="space-y-8">
      <h3 className="text-2xl font-black uppercase tracking-tight text-center">Етикет Додзьо</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          "Заходячи чи залишаючи додзьо, завжди скажіть “Ос” та вклоніться.",
          "Запізнившись, сядьте в сейдза і чекайте дозволу увійти.",
          "Не знімайте частину догі під час тренування без дозволу.",
          "Звертайтесь до інструктора: Семпай, Сенсей чи Шихан.",
          "Тримайте нігті короткими, а догі — чистим.",
          "Пояс ніколи не переться — він вбирає ваш досвід."
        ].map((rule, i) => (
          <div key={i} className="p-6 bg-zinc-900 rounded-2xl border border-white/5 text-sm text-zinc-400">
            {rule}
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

const NormativesSection = () => {
  const [selectedKyu, setSelectedKyu] = useState('10');

  const kyuData: any = {
    '10': {
      title: '10 КЮ — Помаранчевий пояс',
      meaning: 'Початок Світанку. Символізує перший проблиск зорі на нічному небі.',
      requirements: {
        dachi: 'Йоі-дачі, Фудо-дачі, Зенкуцу-дачі.',
        tsuki: 'Сейкен мороте-цукі (джодан, чудан, гедан); Сейкен оі-цукі.',
        uke: 'Сейкен джодан-уке; Сейкен гедан-барай.',
        geri: 'Хіза ганмен-гері; Чудан має хіза-гері; Кін-гері.',
        kata: 'Таікіоку Соно Ічі.',
        zfp: '25 віджимань, 25 прес, 25 присідань, 10 стрибків на одній нозі.'
      }
    },
    '9': {
      title: '9 КЮ — Помаранчевий пояс зі смужкою',
      meaning: 'Рання Зоря. Каратека зобов\'язується регулярно відвідувати заняття.',
      requirements: {
        dachi: 'Мусубі-дачі, Санчін-дачі, Кокуцу-дачі.',
        tsuki: 'Сейкен аго-учі; Сейкен гяку-цукі.',
        uke: 'Сейкен чудан учі-уке; Сейкен чудан сото-уке.',
        geri: 'Має-гері чусоку чудан.',
        kata: 'Таікіоку Соно Ні.',
        zfp: '30 віджимань, 30 прес, 30 присідань, вправа "Місток".'
      }
    },
    '8': {
      title: '8 КЮ — Синій пояс',
      meaning: 'Небо Перед Сходом. Набуття адаптивності та гнучкості.',
      requirements: {
        dachi: 'Кіба-дачі (45° та 90°).',
        tsuki: 'Тате-цукі, Шита-цукі, Джюн-цукі.',
        uke: 'Мороте учі-уке, Учі-уке/Гедан-барай.',
        geri: 'Має-гері джодан чусоку.',
        kata: 'Таікіоку Соно Сан.',
        zfp: '35 віджимань, 35 прес, 35 присідань, 6 хв джодан має-гері.'
      }
    },
    '7': {
      title: '7 КЮ — Синій пояс зі смужкою',
      meaning: 'Перший Промінь Сонця. Формування тактичного мислення.',
      requirements: {
        dachi: 'Неко-аші-дачі.',
        tsuki: 'Тетцуі ороші ганмен-учі, Тетцуі йоко-учі.',
        uke: 'Маваші гедан-барай; Шуто маваші-уке.',
        geri: 'Чусоку має кіаге, Тейсоку сото маваші кіаге.',
        kata: 'Пінан Соно Ічі.',
        zfp: '40 віджимань, 40 прес, 40 присідань, шпагати.'
      }
    },
    '6': {
      title: '6 КЮ — Жовтий пояс',
      meaning: 'Схід Сонця. Усвідомлення сили удару з центру тіла (Танден).',
      requirements: {
        dachi: 'Цуруаші-дачі, Куміте-дачі.',
        tsuki: 'Уракен (шомен, саю, хізо, ороші), Ніхон нукіте.',
        uke: 'Сейкен джуджі-уке (гедан, джодан).',
        geri: 'Маваші-гері гедан хайсоку, Йоко-гері чудан сокуто.',
        kata: 'Пінан Соно Ні.',
        zfp: '45 віджимань, 45 прес, 45 присідань, баланс на одній нозі.'
      }
    },
    '5': {
      title: '5 КЮ — Жовтий пояс зі смужкою',
      meaning: 'Перші Паростки. Поява життя під цілющим світлом Сонця.',
      requirements: {
        dachi: 'Мороаші-дачі, Ура зенкуцу-дачі.',
        tsuki: 'Шотей-учі (джодан, чудан, гедан); Хіджи-ате (джодан).',
        uke: 'Шотей-уке (джодан, чудан, гедан).',
        geri: 'Маваші-гері (чудан хайсоку, чусоку); Уширо-гері.',
        kata: 'Пінан Соно Сан.',
        zfp: '50 віджимань, 50 прес, 50 присідань, 5-10 м ходьби на руках.'
      }
    },
    '4': {
      title: '4 КЮ — Зелений пояс',
      meaning: 'Розквітла Квітка. Символізує розквіт творчих сил, перше значне проявлення знань.',
      requirements: {
        dachi: 'Хейсоку-дачі, Хейко-дачі, Учі хачіджі-дачі.',
        tsuki: 'Шуто сакоцу ороші-учі; Шуто йоко ганмен-учі; Шуто учі-комі.',
        uke: 'Шуто (джодан-уке, чудан учі-уке, чудан сото-уке, гедан-барай).',
        geri: 'Сокуто йоко-гері джодан; Маваші-гері джодан; Уширо-гері джодан.',
        kata: 'Санчін-но-Ката.',
        zfp: '55 віджимань, 55 прес, 55 присідань, поперечний шпагат.'
      }
    },
    '3': {
      title: '3 КЮ — Зелений пояс зі смужкою',
      meaning: 'Квітка у Повній Силі. Символізує пік розвитку на учнівському рівні.',
      requirements: {
        dachi: 'Каке-дачі, Шіко-дачі.',
        tsuki: 'Хіджи-ате (чудан, має-чудан, аге-джодан, аге-чудан, уширо, ороші).',
        uke: 'Шуто дзюдзі-уке (джодан, гедан).',
        geri: 'Має какато-гері (джодан, чудан, гедан).',
        kata: 'Пінан Соно Йон.',
        zfp: '60 віджимань (30 на пальцях), 60 прес, 60 присідань, усі шпагати.'
      }
    },
    '2': {
      title: '2 КЮ — Коричневий пояс',
      meaning: 'Зрілість. Символізує дерево, що вкорінилося в землі.',
      requirements: {
        dachi: 'Різні стійки в русі та напрямках (Ура).',
        tsuki: 'Хіракен-цукі; Хіракен-ороші учі; Хайсю-учі; Аге-цукі джодан.',
        uke: 'Кокен-уке джодан; Маваші кокен-уке; Учі кокен-уке чудан.',
        geri: 'Тобі нідан-гері; Тобі має-гері.',
        kata: 'Пінан Соно Го, Гекісай Дай.',
        zfp: '70 віджимань (30 на 3-х пальцях, 20 на кокен), 70 прес, 70 присідань.'
      }
    },
    '1': {
      title: '1 КЮ — Коричневий пояс зі смужкою',
      meaning: 'Близькість до Мудрості. Готовність до переходу на майстерський рівень.',
      requirements: {
        dachi: 'Кокуцу-дачі (Ура), Санчін-дачі.',
        tsuki: 'Рютокен-цукі; Накаюбі іпонкен; Ояюбі іпонкен; Іпонкен-нукіте.',
        uke: 'Каке-уке (джодан, чудан); Хайто-уке (джодан, чудан).',
        geri: 'Учі хайсоку-гері джодан; Учі ороші какато-гері; Сото ороші какато-гері.',
        kata: 'Янцу, Цукі-но-Ката.',
        zfp: '80 віджимань (30 на 2-х пальцях, 20 на кокен), 80 прес, 80 присідань.'
      }
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-3 justify-center">
        {Object.keys(kyuData).map((kyu) => (
          <button
            key={kyu}
            onClick={() => setSelectedKyu(kyu)}
            className={`w-12 h-12 rounded-xl font-black transition-all border ${
              selectedKyu === kyu 
                ? 'bg-red-600 border-red-600 text-white scale-110 shadow-lg' 
                : 'bg-zinc-800 border-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {kyu}
          </button>
        ))}
        <div className="w-full text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Оберіть ступінь (КЮ)</div>
      </div>

      <motion.div 
        key={selectedKyu}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-8"
      >
        <div className="border-l-4 border-red-600 pl-6">
          <h3 className="text-3xl font-black uppercase tracking-tight mb-2">{kyuData[selectedKyu].title}</h3>
          <p className="text-zinc-400 italic">{kyuData[selectedKyu].meaning}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <RequirementCard title="Стійки (Dachi)" content={kyuData[selectedKyu].requirements.dachi} />
          <RequirementCard title="Удари руками (Tsuki)" content={kyuData[selectedKyu].requirements.tsuki} />
          <RequirementCard title="Блоки (Uke)" content={kyuData[selectedKyu].requirements.uke} />
          <RequirementCard title="Удари ногами (Geri)" content={kyuData[selectedKyu].requirements.geri} />
          <RequirementCard title="Ката" content={kyuData[selectedKyu].requirements.kata} />
          <RequirementCard title="ЗФП" content={kyuData[selectedKyu].requirements.zfp} />
        </div>
      </motion.div>
    </div>
  );
};

const RequirementCard = ({ title, content }: { title: string, content: string }) => (
  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-red-600/20 transition-colors">
    <h4 className="text-red-500 font-black uppercase text-[10px] tracking-widest mb-3">{title}</h4>
    <p className="text-zinc-300 text-sm leading-relaxed">{content}</p>
  </div>
);

const DictionarySection = () => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {[
      { term: "Додзьо", def: "Місце, де шукають шлях (тренувальний зал)." },
      { term: "Догі", def: "Однострій для занять карате." },
      { term: "Обі", def: "Пояс." },
      { term: "Сейкен", def: "Кулак (передні фаланги)." },
      { term: "Куміте", def: "Поєдинок, спаринг." },
      { term: "Ката", def: "Формальні вправи, бій з уявною групою супротивників." },
      { term: "Кіай", def: "Пронизливий крик, вираз концентрації енергії." },
      { term: "Рей", def: "Уклін (вітання)." },
      { term: "Хадзіме", def: "Почати." },
      { term: "Яме", def: "Закінчити." },
      { term: "Мокусо", def: "Медитація (закрити очі)." },
      { term: "Семпай", def: "Старший учень." }
    ].map((item, i) => (
      <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
        <div className="text-white font-bold mb-1">{item.term}</div>
        <div className="text-zinc-500 text-xs">{item.def}</div>
      </div>
    ))}
  </div>
);

export default Encyclopedia;

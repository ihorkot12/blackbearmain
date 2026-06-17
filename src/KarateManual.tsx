import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  GraduationCap,
  History,
  Info,
  Medal,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

type ManualAudience = 'parent' | 'coach' | 'admin';

type KarateManualProps = {
  audience?: ManualAudience;
  currentBelt?: string;
};

type KyuLevel = {
  kyu: string;
  belt: string;
  stripe?: boolean;
  tone: string;
  accent: string;
  focus: string;
  homeFocus: string;
  techniques: {
    stances: string;
    hands: string;
    blocks: string;
    kicks: string;
  };
  kata: string;
  kumite: string;
  theory: string;
  condition: string[];
};

type DictionaryTerm = {
  term: string;
  meaning: string;
  category: string;
  hint?: string;
};

const levelData: KyuLevel[] = [
  {
    kyu: '10 кю',
    belt: 'Оранжевий',
    tone: 'from-orange-500/20 via-orange-500/5 to-transparent',
    accent: 'bg-orange-500',
    focus: 'Перший рівень: стійка, етикет, базова координація і контроль корпусу.',
    homeFocus: 'Дитина має спокійно скласти кімоно, завʼязати пояс і назвати базові команди.',
    techniques: {
      stances: 'Йой-дачі, фудо-дачі, зенкуцу-дачі.',
      hands: 'Оі-цукі та мороте-цукі на трьох рівнях.',
      blocks: 'Джодан-уке, гедан-барай.',
      kicks: 'Хіза-гері, кін-гері, базовий мае-гері.',
    },
    kata: 'Тайкіоку соно ічі.',
    kumite: 'Без вільних поєдинків. Працюємо дистанцію, повагу і контроль.',
    theory: 'Значення Кіокушинкай, етикет додзьо, клятва додзьо-кун, засновник стилю.',
    condition: ['25 віджимань', '30 підйомів корпусу', '30 присідань', '3 хвилини базових ударів ногами'],
  },
  {
    kyu: '9 кю',
    belt: 'Оранжевий',
    stripe: true,
    tone: 'from-orange-400/20 via-zinc-200/5 to-transparent',
    accent: 'bg-orange-500',
    focus: 'Закріплення першої бази: стійкість, дихання, рівні ударів і дисципліна руху.',
    homeFocus: 'Важливо, щоб учень не поспішав: чистий рух краще за швидкий.',
    techniques: {
      stances: 'Мусубі-дачі, санчін-дачі, кокуцу-дачі.',
      hands: 'Аго-учі, гяку-цукі, прямі удари на рівнях джодан, чудан, гедан.',
      blocks: 'Чудан учі-уке, чудан сото-уке, подвійний мороте-уке.',
      kicks: 'Чудан мае-гері з правильною роботою коліна.',
    },
    kata: 'Тайкіоку соно ні.',
    kumite: 'Підготовчі вправи в парах без жорсткого контакту.',
    theory: 'Історія стилю, розвиток Кіокушинкай, 11 девізів Масутацу Оями.',
    condition: ['30 віджимань', '35 підйомів корпусу', '35 присідань', '30 секунд стійки на голові з опорою'],
  },
  {
    kyu: '8 кю',
    belt: 'Синій',
    tone: 'from-blue-500/20 via-blue-500/5 to-transparent',
    accent: 'bg-blue-600',
    focus: 'Рух у ширших стійках, перша впевнена робота в парі, розуміння ката.',
    homeFocus: 'Корисно повторювати назви стійок і не забувати про розминку спини та ніг.',
    techniques: {
      stances: 'Кіба-дачі та її варіанти з різними кутами стоп.',
      hands: 'Шита-цукі, дзюн-цукі, тате-цукі.',
      blocks: 'Мороте учі-уке, учі-уке з гедан-барай, какеваке-уке.',
      kicks: 'Джодан мае-гері та махові підготовчі рухи.',
    },
    kata: 'Тайкіоку соно сан.',
    kumite: 'Якусоку іппон куміте: домовлена атака і відповідь.',
    theory: 'Навіщо потрібні ката, що означає дух Осу і чому техніка має бути контрольованою.',
    condition: ['35 віджимань', '40 підйомів корпусу', '40 присідань', 'перекиди вперед і назад'],
  },
  {
    kyu: '7 кю',
    belt: 'Синій',
    stripe: true,
    tone: 'from-blue-500/20 via-zinc-200/5 to-transparent',
    accent: 'bg-blue-600',
    focus: 'Більше балансу, більше напрямків, перші дозовані поєдинки.',
    homeFocus: 'Звертайте увагу на поставу і контроль емоцій після роботи в парах.',
    techniques: {
      stances: 'Некоаші-дачі, мае коса-дачі, уширо коса-дачі.',
      hands: 'Тетцуі-учі в різних траєкторіях.',
      blocks: 'Шуто маваші-уке, мороте гедан-барай.',
      kicks: 'Має-кіаге, йоко-кіаге, учі/сото маваші-кіаге.',
    },
    kata: 'Пінан соно ічі.',
    kumite: 'Джу куміте в дозованому контакті.',
    theory: 'Безпечна дистанція, вміння чути команду тренера, контроль сили.',
    condition: ['40 віджимань', '45 підйомів корпусу', '45 присідань', 'робота на гнучкість і нахили'],
  },
  {
    kyu: '6 кю',
    belt: 'Жовтий',
    tone: 'from-yellow-400/20 via-yellow-400/5 to-transparent',
    accent: 'bg-yellow-400',
    focus: 'Перехід від простої техніки до бойової структури: темп, дихання, ритм.',
    homeFocus: 'Учень уже має розуміти, що тренування - це система, а не набір окремих вправ.',
    techniques: {
      stances: 'Цуруаші-дачі, куміте-дачі, дзю-камае.',
      hands: 'Уракен, нукіте, шита-нукіте, робота відкритою долонею.',
      blocks: 'Сейкен джуджі-уке, базові захисти в русі.',
      kicks: 'Кансецу-гері, йоко-гері, гедан маваші-гері.',
    },
    kata: 'Пінан соно ні, сакугі тайкіоку соно ічі.',
    kumite: '2 поєдинки з контролем темпу і дистанції.',
    theory: 'Дзію-куміте, мушин, бойова готовність без агресії.',
    condition: ['45 віджимань', '50 підйомів корпусу', '50 присідань', '3 хвилини балансу в цуруаші-дачі'],
  },
  {
    kyu: '5 кю',
    belt: 'Жовтий',
    stripe: true,
    tone: 'from-yellow-400/20 via-zinc-200/5 to-transparent',
    accent: 'bg-yellow-400',
    focus: 'Складніші комбінації, перша тактика, вміння бачити партнера.',
    homeFocus: 'Тут важливо підтримати регулярність: пропуски швидко бʼють по темпу росту.',
    techniques: {
      stances: 'Мороаші-дачі, ура-зенкуцу-дачі.',
      hands: 'Шотей-учі, хіджі-ате.',
      blocks: 'Шотей-уке на трьох рівнях.',
      kicks: 'Чудан маваші-гері, уширо-гері.',
    },
    kata: 'Пінан соно сан, сакугі тайкіоку соно ні.',
    kumite: '3 поєдинки з базовою тактикою.',
    theory: 'Види двобою, проста стратегія, робота з ритмом і дистанцією.',
    condition: ['50 віджимань', '60 підйомів корпусу', '60 присідань', '30 секунд балансу в стійці на руках з підтримкою'],
  },
  {
    kyu: '4 кю',
    belt: 'Зелений',
    tone: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    accent: 'bg-emerald-600',
    focus: 'Сила, гнучкість, дихання і стабільність під навантаженням.',
    homeFocus: 'Учню потрібен сон, вода і відновлення: навантаження стає серйозним.',
    techniques: {
      stances: 'Хейсоку-дачі, хейко-дачі, учі хачіджі-дачі.',
      hands: 'Шуто-учі в різних напрямках.',
      blocks: 'Шуто-уке, маваші-уке, гедан-барай.',
      kicks: 'Джодан йоко-гері, джодан маваші-гері, джодан уширо-гері.',
    },
    kata: 'Санчін-но-ката, сакугі тайкіоку соно сан.',
    kumite: '4 поєдинки.',
    theory: 'Дихання Ібукі, внутрішня енергія Кі, структура організації.',
    condition: ['55 віджимань', '70 підйомів корпусу', '70 присідань', 'шпагат і глибокі нахили'],
  },
  {
    kyu: '3 кю',
    belt: 'Зелений',
    stripe: true,
    tone: 'from-emerald-500/20 via-zinc-200/5 to-transparent',
    accent: 'bg-emerald-600',
    focus: 'Учень вчиться бути прикладом: стабільність, допомога молодшим, самоконтроль.',
    homeFocus: 'Цей рівень добре видно по поведінці: більше відповідальності, менше хаосу.',
    techniques: {
      stances: 'Каке-дачі, каке-аші-дачі, шико-дачі.',
      hands: 'Хіджі-ате в різних напрямках.',
      blocks: 'Шуто джуджі-уке.',
      kicks: 'Какато мае-гері, аго мае-гері.',
    },
    kata: 'Пінан соно йон.',
    kumite: '5 поєдинків.',
    theory: 'Термінологія заняття, основи медитації, концентрація перед стартом.',
    condition: ['60 віджимань', '80 підйомів корпусу', '80 присідань', 'баланс на одній нозі з високим підйомом'],
  },
  {
    kyu: '2 кю',
    belt: 'Коричневий',
    tone: 'from-amber-800/25 via-amber-600/5 to-transparent',
    accent: 'bg-amber-800',
    focus: 'Передмайстерський рівень: техніка має бути усвідомленою і придатною для пояснення іншим.',
    homeFocus: 'Учень уже може сам ставити малі цілі на місяць і оцінювати свій прогрес.',
    techniques: {
      stances: 'Усі попередні стійки з упевненим переходом.',
      hands: 'Хіракен, хайшу, кокен, складні форми кулака.',
      blocks: 'Кокен-уке, маваші кокен-уке, учі кокен-уке.',
      kicks: 'Тобі мае-гері, тобі нідан-гері, комбінації в стрибку.',
    },
    kata: 'Пінан соно го, гекусай дай, тайкіоку ура.',
    kumite: '6 поєдинків.',
    theory: 'Методика навчання молодших учнів і відповідальність старшого поясу.',
    condition: ['70 віджимань', '90 підйомів корпусу', '90 присідань', 'стрибки через палицю і вертикальні віджимання з підтримкою'],
  },
  {
    kyu: '1 кю',
    belt: 'Коричневий',
    stripe: true,
    tone: 'from-amber-800/25 via-zinc-200/5 to-transparent',
    accent: 'bg-amber-800',
    focus: 'Фініш учнівської програми: суддівська термінологія, лідерство і готовність до дан-рівня.',
    homeFocus: 'Головне - не гнатися за поясом. Тут цінується зрілість, спокій і стабільність.',
    techniques: {
      stances: 'Усі попередні стійки, робота з переходами і кутами.',
      hands: 'Рютокен, іппонкен, хайто, каке-уке.',
      blocks: 'Каке-уке, хайто-уке, комбінований захист.',
      kicks: 'Ороші какато-гері, джодан учі хайсоку-гері, тобі йоко-гері.',
    },
    kata: 'Янцу, цукі-но-ката, пінан соно ічі ура.',
    kumite: '8 поєдинків.',
    theory: 'Правила змагань, суддівська практика, структура WKO.',
    condition: ['80 віджимань', '100 підйомів корпусу', '100 присідань', '15 стрибків через палицю'],
  },
];

const dictionaryTerms: DictionaryTerm[] = [
  { term: 'Осу', meaning: 'повага, готовність терпіти і продовжувати', category: 'Команди' },
  { term: 'Рей', meaning: 'уклін', category: 'Команди' },
  { term: 'Йой', meaning: 'приготуватися', category: 'Команди' },
  { term: 'Хаджіме', meaning: 'почати', category: 'Команди' },
  { term: 'Яме', meaning: 'зупинитися', category: 'Команди' },
  { term: 'Мавате', meaning: 'розворот', category: 'Команди' },
  { term: 'Мокусо', meaning: 'коротка концентрація, медитація', category: 'Команди' },
  { term: 'Сейза', meaning: 'сидіти на колінах', category: 'Команди' },
  { term: 'Сенсей', meaning: 'вчитель, наставник', category: 'Команди' },
  { term: 'Семпай', meaning: 'старший учень', category: 'Команди' },
  { term: 'Джодан', meaning: 'верхній рівень: голова, шия', category: 'Рівні та напрямки' },
  { term: 'Чудан', meaning: 'середній рівень: корпус', category: 'Рівні та напрямки' },
  { term: 'Гедан', meaning: 'нижній рівень', category: 'Рівні та напрямки' },
  { term: 'Хідарі', meaning: 'ліва сторона', category: 'Рівні та напрямки' },
  { term: 'Мігі', meaning: 'права сторона', category: 'Рівні та напрямки' },
  { term: 'Має', meaning: 'вперед', category: 'Рівні та напрямки' },
  { term: 'Йоко', meaning: 'в сторону', category: 'Рівні та напрямки' },
  { term: 'Уширо', meaning: 'назад', category: 'Рівні та напрямки' },
  { term: 'Маваші', meaning: 'круговий напрямок', category: 'Рівні та напрямки' },
  { term: 'Сото', meaning: 'рух ззовні всередину', category: 'Рівні та напрямки' },
  { term: 'Учі', meaning: 'рух зсередини назовні', category: 'Рівні та напрямки' },
  { term: 'Йой-дачі', meaning: 'стійка готовності', category: 'Стійки' },
  { term: 'Фудо-дачі', meaning: 'стійка стабільності', category: 'Стійки' },
  { term: 'Зенкуцу-дачі', meaning: 'передня стійка', category: 'Стійки' },
  { term: 'Мусубі-дачі', meaning: 'пʼятки разом, носки відкриті', category: 'Стійки' },
  { term: 'Санчін-дачі', meaning: 'стійка сили і зібраності', category: 'Стійки' },
  { term: 'Кокуцу-дачі', meaning: 'задня стійка', category: 'Стійки' },
  { term: 'Кіба-дачі', meaning: 'стійка вершника', category: 'Стійки' },
  { term: 'Некоаші-дачі', meaning: 'котяча стійка', category: 'Стійки' },
  { term: 'Цуруаші-дачі', meaning: 'стійка журавля', category: 'Стійки' },
  { term: 'Куміте-дачі', meaning: 'бойова стійка', category: 'Стійки' },
  { term: 'Шико-дачі', meaning: 'широка стійка сумо', category: 'Стійки' },
  { term: 'Сейкен', meaning: 'передня частина кулака', category: 'Ударні частини' },
  { term: 'Уракен', meaning: 'тильна частина кулака', category: 'Ударні частини' },
  { term: 'Тетцуі', meaning: 'кулак-молот', category: 'Ударні частини' },
  { term: 'Шуто', meaning: 'ребро долоні', category: 'Ударні частини' },
  { term: 'Хайто', meaning: 'внутрішнє ребро долоні', category: 'Ударні частини' },
  { term: 'Шотей', meaning: 'основа долоні', category: 'Ударні частини' },
  { term: 'Кокен', meaning: 'запʼясток', category: 'Ударні частини' },
  { term: 'Хіджі', meaning: 'лікоть', category: 'Ударні частини' },
  { term: 'Оі-цукі', meaning: 'прямий удар однойменною рукою', category: 'Удари руками' },
  { term: 'Гяку-цукі', meaning: 'прямий удар протилежною рукою', category: 'Удари руками' },
  { term: 'Мороте-цукі', meaning: 'удар двома руками', category: 'Удари руками' },
  { term: 'Тате-цукі', meaning: 'вертикальний удар кулаком', category: 'Удари руками' },
  { term: 'Шита-цукі', meaning: 'короткий удар знизу', category: 'Удари руками' },
  { term: 'Мае-гері', meaning: 'прямий удар ногою вперед', category: 'Удари ногами' },
  { term: 'Хіза-гері', meaning: 'удар коліном', category: 'Удари ногами' },
  { term: 'Кін-гері', meaning: 'удар підйомом стопи знизу', category: 'Удари ногами' },
  { term: 'Йоко-гері', meaning: 'удар ногою в сторону', category: 'Удари ногами' },
  { term: 'Маваші-гері', meaning: 'круговий удар ногою', category: 'Удари ногами' },
  { term: 'Уширо-гері', meaning: 'удар пʼяткою назад', category: 'Удари ногами' },
  { term: 'Кансецу-гері', meaning: 'удар у напрямку колінного суглоба', category: 'Удари ногами' },
  { term: 'Какато-гері', meaning: 'удар пʼяткою', category: 'Удари ногами' },
  { term: 'Джодан-уке', meaning: 'верхній блок', category: 'Блоки' },
  { term: 'Гедан-барай', meaning: 'нижній змітаючий блок', category: 'Блоки' },
  { term: 'Учі-уке', meaning: 'блок зсередини назовні', category: 'Блоки' },
  { term: 'Сото-уке', meaning: 'блок ззовні всередину', category: 'Блоки' },
  { term: 'Мороте-уке', meaning: 'посилений блок двома руками', category: 'Блоки' },
  { term: 'Джуджі-уке', meaning: 'хрестоподібний блок', category: 'Блоки' },
  { term: 'Маваші-уке', meaning: 'круговий захист руками', category: 'Блоки' },
];

const historyEvents = [
  { year: '1923', title: 'Народження Масутацу Оями', text: 'Майбутній засновник Кіокушинкай народився 27 липня 1923 року.' },
  { year: '1938', title: 'Переїзд до Японії', text: 'Ояма навчається, тренується в карате, дзюдо та боксі, формуючи широку бойову базу.' },
  { year: '1947', title: 'Перемога в Японії', text: 'Стає чемпіоном післявоєнних всеяпонських змагань з бойових мистецтв.' },
  { year: '1948', title: 'Гірська підготовка', text: 'Період ізоляції та надважких тренувань закладає його принцип жорсткої самодисципліни.' },
  { year: '1953', title: 'Перший додзьо', text: 'Відкриває перший власний зал у Токіо і формує школу повноконтактної практики.' },
  { year: '1964', title: 'Назва Кіокушин', text: 'Офіційно оформлюється міжнародна організація і стиль, що означає шлях до абсолютної істини.' },
  { year: '1975', title: 'Перший світовий турнір', text: 'Кіокушинкай виходить на світовий спортивний рівень.' },
  { year: '1994', title: 'Спадщина Сосая', text: 'Ояма залишає систему, яка продовжує розвиватись у додзьо по всьому світу.' },
];

const etiquetteItems = [
  'Входячи в зал і виходячи із залу, учень вклоняється і каже "Осу".',
  'На тренуванні слухаємо команду тренера одразу, без суперечок і зайвих розмов.',
  'Догі має бути чистим, нігті короткими, прикраси зняті до початку заняття.',
  'Пояс не кидають на підлогу: він символізує шлях і роботу учня.',
  'Після роботи в парі дякуємо партнеру, навіть якщо вправа була складною.',
  'Сила без контролю не рахується майстерністю. У карате важливий самоконтроль.',
];

const coachPlaybook = [
  'Перед атестаційним місяцем відкрийте потрібний кю і дайте групі 3 конкретні цілі на тиждень.',
  'Після відмітки прогресу в учня звіряйте чек-лист із нормативами, щоб батьки бачили логіку росту.',
  'Для молодших груп використовуйте словник як 2-хвилинний старт: одне слово, один приклад, одна команда.',
  'Перед семінарами пояснюйте, які пункти програми вони закривають: техніка, ката, куміте чи теорія.',
];

const parentPlaybook = [
  'Питайте після тренування не "чому не переміг?", а "що сьогодні стало краще?".',
  'Раз на тиждень відкрийте потрібний пояс і подивіться разом 2-3 терміни зі словника.',
  'Не просіть дитину бити сильно вдома. Краще повторити назви, стійки і порядок ката без поспіху.',
  'Якщо дитина пропустила заняття, дивіться розділ прогресу і домовляйтесь із тренером, що підтягнути.',
];

const tabs = [
  { id: 'norms', label: 'Нормативи', icon: Award },
  { id: 'dictionary', label: 'Словник', icon: BookOpen },
  { id: 'oyama', label: 'Ояма', icon: History },
  { id: 'etiquette', label: 'Етикет', icon: ShieldCheck },
] as const;

const categoryColors: Record<string, string> = {
  Команди: 'border-red-500/20 bg-red-500/10 text-red-300',
  'Рівні та напрямки': 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  Стійки: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  'Ударні частини': 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  'Удари руками': 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
  'Удари ногами': 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
  Блоки: 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300',
};

const normalizeSearch = (value: string) => value.toLowerCase().trim();

const BeltChip = ({ level }: { level: KyuLevel }) => (
  <div className={`relative h-14 w-14 shrink-0 rounded-2xl ${level.accent} shadow-lg shadow-black/30 ring-1 ring-white/10 overflow-hidden`}>
    {level.stripe && (
      <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-zinc-100 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
    )}
    <span className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/30" />
  </div>
);

const SectionTitle = ({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text: string }) => (
  <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="max-w-3xl">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-red-500">{eyebrow}</p>
      <h2 className="text-3xl font-black uppercase tracking-tighter text-white md:text-5xl">{title}</h2>
    </div>
    <p className="max-w-md text-sm font-medium leading-relaxed text-zinc-400">{text}</p>
  </header>
);

const KarateManual = ({ audience = 'parent', currentBelt }: KarateManualProps) => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('norms');
  const [selectedKyu, setSelectedKyu] = useState(levelData[0].kyu);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Усі');

  const selectedLevel = levelData.find(level => level.kyu === selectedKyu) || levelData[0];
  const isCoachView = audience === 'coach' || audience === 'admin';
  const playbook = isCoachView ? coachPlaybook : parentPlaybook;

  const categories = useMemo(() => ['Усі', ...Array.from(new Set(dictionaryTerms.map(item => item.category)))], []);

  const filteredTerms = useMemo(() => {
    const search = normalizeSearch(query);
    return dictionaryTerms.filter(item => {
      const matchesCategory = category === 'Усі' || item.category === category;
      const matchesSearch = !search || `${item.term} ${item.meaning} ${item.category}`.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [category, query]);

  return (
    <div className="bb-motion-surface space-y-8 text-zinc-100">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/30 md:p-8 lg:p-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(220,38,38,0.18),transparent_34%,rgba(255,255,255,0.04)_34.5%,transparent_35%,transparent_72%,rgba(245,158,11,0.12))]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
              <ScrollText size={16} />
              Методичка Black Bear
            </div>
            <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white md:text-6xl">
              Карате база для <span className="text-red-600">{isCoachView ? 'тренера' : 'родини'}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-zinc-300">
              Нормативи на кю, словник команд, коротка історія Оями та правила додзьо в одному місці.
              Це допомагає однаково розуміти прогрес учня: тренеру, батькам і самому спортсмену.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Trophy, label: '10 рівнів', value: '10-1 кю' },
              { icon: BookOpen, label: 'Терміни', value: `${dictionaryTerms.length}+` },
              { icon: Star, label: currentBelt ? 'Поточний пояс' : 'Фокус', value: currentBelt || 'прогрес' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <item.icon size={18} className="text-red-500" />
                  <span className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">{item.label}</span>
                </div>
                <div className="text-xl font-black uppercase tracking-tight text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest transition-all md:px-5 ${
              activeTab === tab.id
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                : 'border border-white/5 bg-zinc-900/60 text-zinc-500 hover:border-red-500/30 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'norms' && (
          <motion.section
            key="norms"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <SectionTitle
              eyebrow="Атестаційна карта"
              title={<>Нормативи <span className="text-red-600">по поясах</span></>}
              text="Тут не заміна рішенню тренера, а зрозуміла карта: що вивчається на кожному рівні і на що дивитись перед атестацією."
            />

            <div className="grid gap-4 lg:grid-cols-10">
              {levelData.map(level => (
                <button
                  key={level.kyu}
                  type="button"
                  onClick={() => setSelectedKyu(level.kyu)}
                  className={`group rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 ${
                    selectedKyu === level.kyu
                      ? 'border-red-500/50 bg-red-500/10 shadow-xl shadow-red-950/20'
                      : 'border-white/5 bg-zinc-900/50 hover:border-white/15 hover:bg-zinc-900'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <BeltChip level={level} />
                    <ChevronRight size={16} className={`transition-transform ${selectedKyu === level.kyu ? 'text-red-400' : 'text-zinc-700 group-hover:translate-x-0.5 group-hover:text-red-400'}`} />
                  </div>
                  <div className="text-sm font-black uppercase tracking-tight text-white">{level.kyu}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase leading-snug text-zinc-500">
                    {level.belt}{level.stripe ? ' + смужка' : ''}
                  </div>
                </button>
              ))}
            </div>

            <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 p-6 md:p-8`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${selectedLevel.tone}`} />
              <div className="relative grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-6">
                  <div className="flex items-start gap-5">
                    <BeltChip level={selectedLevel} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">Обраний рівень</p>
                      <h3 className="mt-2 text-3xl font-black uppercase tracking-tighter text-white">
                        {selectedLevel.kyu}
                      </h3>
                      <p className="text-sm font-bold text-zinc-400">
                        {selectedLevel.belt}{selectedLevel.stripe ? ' зі сріблястою смужкою' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="mb-3 flex items-center gap-2 text-red-400">
                      <Target size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Фокус рівня</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-zinc-300">{selectedLevel.focus}</p>
                  </div>

                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                    <div className="mb-3 flex items-center gap-2 text-amber-300">
                      <Info size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isCoachView ? 'Тренерський акцент' : 'Для батьків'}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-amber-50/80">{selectedLevel.homeFocus}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: 'Стійки', value: selectedLevel.techniques.stances, icon: Users },
                    { label: 'Удари руками', value: selectedLevel.techniques.hands, icon: Flame },
                    { label: 'Блоки', value: selectedLevel.techniques.blocks, icon: ShieldCheck },
                    { label: 'Удари ногами', value: selectedLevel.techniques.kicks, icon: Dumbbell },
                    { label: 'Ката', value: selectedLevel.kata, icon: ScrollText },
                    { label: 'Куміте', value: selectedLevel.kumite, icon: Trophy },
                    { label: 'Теорія', value: selectedLevel.theory, icon: GraduationCap },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-colors hover:border-red-500/20 hover:bg-white/[0.05]">
                      <div className="mb-3 flex items-center gap-2 text-red-400">
                        <item.icon size={17} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-zinc-300">{item.value}</p>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-5 md:col-span-2">
                    <div className="mb-4 flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 size={17} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Кондиція</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedLevel.condition.map(item => (
                        <div key={item} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3 text-sm font-bold text-zinc-200">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'dictionary' && (
          <motion.section
            key="dictionary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <SectionTitle
              eyebrow="Термінологія"
              title={<>Словник <span className="text-red-600">додзьо</span></>}
              text="Швидкий пошук по командах, стійках, ударах і блоках. Зручно відкрити перед тренуванням або перед атестацією."
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Пошук: осу, мае-гері, кіба-дачі..."
                  className="h-14 w-full rounded-2xl border border-white/10 bg-zinc-950 pl-12 pr-4 text-sm font-medium text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-red-500/60"
                />
              </label>

              <div className="flex gap-2 overflow-x-auto">
                {categories.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`h-14 shrink-0 rounded-2xl px-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                      category === item
                        ? 'bg-white text-black'
                        : 'border border-white/10 bg-zinc-950 text-zinc-500 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTerms.map(item => (
                <div key={`${item.category}-${item.term}`} className="group rounded-2xl border border-white/5 bg-zinc-900/50 p-5 transition-all hover:-translate-y-0.5 hover:border-red-500/20 hover:bg-zinc-900">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-black uppercase tracking-tight text-white">{item.term}</h3>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-400">{item.meaning}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${categoryColors[item.category] || categoryColors.Блоки}`}>
                      {item.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredTerms.length === 0 && (
              <div className="rounded-[2rem] border border-dashed border-white/10 bg-zinc-900/30 p-12 text-center">
                <BookOpen className="mx-auto mb-4 text-zinc-700" size={44} />
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Нічого не знайдено</p>
              </div>
            )}
          </motion.section>
        )}

        {activeTab === 'oyama' && (
          <motion.section
            key="oyama"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <SectionTitle
              eyebrow="Історія стилю"
              title={<>Масутацу <span className="text-red-600">Ояма</span></>}
              text="Коротка, спокійна версія для кабінету: хто заснував стиль, чому Кіокушинкай повʼязаний із самодисципліною і повним контактом."
            />

            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-7">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/15 text-red-500">
                    <Medal size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">Сосай</p>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-white">Масутацу Ояма</h3>
                  </div>
                </div>
                <div className="space-y-4 text-sm font-medium leading-relaxed text-zinc-300">
                  <p>
                    Ояма побудував Кіокушинкай як шлях перевірки характеру через регулярну практику, контактну роботу,
                    витривалість і повагу до партнера.
                  </p>
                  <p>
                    Для учня це не легенда “про силу”, а зрозумілий принцип: тренування має робити людину дисциплінованішою,
                    спокійнішою і чеснішою до власної роботи.
                  </p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {[
                    { label: 'Принцип', value: 'Один рух - повна увага' },
                    { label: 'Шлях', value: 'Техніка + характер' },
                    { label: 'Для дітей', value: 'Дисципліна без страху' },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-red-400">{item.label}</p>
                      <p className="mt-1 text-sm font-black uppercase tracking-tight text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
                <div className="absolute bottom-8 left-10 top-8 w-px bg-gradient-to-b from-red-600 via-white/10 to-transparent" />
                <div className="space-y-5">
                  {historyEvents.map((item, index) => (
                    <motion.div
                      key={item.year}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.035 }}
                      className="relative grid grid-cols-[4.5rem_1fr] gap-4"
                    >
                      <div className="relative z-10 flex h-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-sm font-black text-red-300">
                        {item.year}
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <h3 className="text-sm font-black uppercase tracking-tight text-white">{item.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'etiquette' && (
          <motion.section
            key="etiquette"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <SectionTitle
              eyebrow="Культура додзьо"
              title={<>Етикет і <span className="text-red-600">підготовка</span></>}
              text="Тут прості речі, які роблять тренування безпечним, зібраним і зрозумілим для всіх: учня, тренера, батьків."
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {etiquetteItems.map((item, index) => (
                <div key={item} className="rounded-2xl border border-white/5 bg-zinc-900/50 p-6 transition-all hover:-translate-y-0.5 hover:border-red-500/20">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-500">
                    <span className="text-sm font-black">{index + 1}</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-zinc-300">{item}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Sparkles size={22} className="text-amber-300" />
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                    {isCoachView ? 'Як тренеру подати матеріал' : 'Як батькам допомогти'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {playbook.map(item => (
                    <div key={item} className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                      <p className="text-sm font-medium leading-relaxed text-zinc-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-red-500/20 bg-red-500/10 p-7">
                <div className="mb-5 flex items-center gap-3 text-red-300">
                  <Clock size={22} />
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">Перед атестацією</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['За 4 тижні', 'звірити пояс, ката, базові команди і відвідуваність'],
                    ['За 2 тижні', 'закрити слабкі місця в чек-листі прогресу'],
                    ['За 1 тиждень', 'зменшити хаос: сон, вода, форма, спокій'],
                    ['У день іспиту', 'не перевантажувати дитину порадами, довіритись тренеру'],
                  ].map(([label, text]) => (
                    <div key={label} className="rounded-2xl border border-red-500/10 bg-black/25 p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-300">{label}</p>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-200">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KarateManual;

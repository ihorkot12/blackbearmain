import { danToBelt, kyuToBelt, type BeltCode } from './belts.js';
import { ageOnDate, plausibilityWarnings } from './rules.js';

export type ParsedFighter = {
  line: number;
  raw: string;
  full_name: string;
  sex: 'm' | 'f';
  age_years: number | null;
  birth_date: string | null;
  weight_kg: number;
  belt: BeltCode;
  /** Пояс вгадано за кольором без смужки (напр. «помаранчевий» → 10 кю). */
  assumed: boolean;
  warnings: string[];
};

export type ParseError = { line: number; raw: string; reason: string };
export type ParseResult = { parsed: ParsedFighter[]; errors: ParseError[] };

const NOT_LETTER_OR_DIGIT = '(?<![\\p{L}\\p{N}])';
const NOT_FOLLOWED = '(?![\\p{L}\\p{N}])';

const MALE = new Set(['ч', 'м', 'хл', 'чол', 'чоловік', 'чоловіча', 'хлопчик', 'm', 'male']);
const FEMALE = new Set(['ж', 'д', 'дів', 'жін', 'жіноча', 'дівчинка', 'f', 'female']);
const NOISE = new Set(['пояс', 'кг', 'kg', 'р', 'рік', 'років', 'кю', 'дан']);

/** Колір → [без смужки, зі смужкою]. Без смужки беремо молодший кю (вищий номер). */
const COLORS: Array<{ re: string; plain: BeltCode; striped: BeltCode | null }> = [
  { re: 'біл(?:ий|ого|им|ому|а|е)', plain: 'white', striped: null },
  { re: 'помаранчев(?:ий|ого|им|ому|а|е)', plain: 'k10', striped: 'k9' },
  { re: 'син(?:ій|ього|ім|ьому|я|є)', plain: 'k8', striped: 'k7' },
  { re: 'жовт(?:ий|ого|им|ому|а|е)', plain: 'k6', striped: 'k5' },
  { re: 'зелен(?:ий|ого|им|ому|а|е)', plain: 'k4', striped: 'k3' },
  { re: 'коричнев(?:ий|ого|им|ому|а|е)', plain: 'k2', striped: 'k1' },
  { re: 'чорн(?:ий|ого|им|ому|а|е)', plain: 'd1', striped: null },
];

const STRIPE = '(?:\\s+(?:зі|із|з)\\s+(?:смужк\\p{L}*|полоск\\p{L}*))?';

const NAME_TOKEN = /^[\p{L}][\p{L}'’ʼ`-]*\.?$/u;

const MALE_NAMES = new Set(
  `іван олександр андрій максим дмитро артем богдан владислав данило даніїл денис єгор захар назар нікіта микита олег роман сергій
  тимофій ярослав матвій михайло марк кирило костянтин віктор володимир василь петро павло тарас станіслав святослав руслан ілля гліб
  лев юрій євген арсен антон артур вадим віталій анатолій георгій ігор леонід борис едуард тимур давид остап мирослав орест любомир
  макар платон семен степан федір ростислав олексій дем'ян всеволод влад діма даня тім стас слава`.split(/\s+/),
);
const FEMALE_NAMES = new Set(
  `марія анна софія анастасія вікторія дарина дар'я олена катерина єва єлизавета поліна аліса валерія вероніка діана злата ірина іванна
  христина кіра ксенія лілія марина мілана наталія оксана олександра олеся тетяна уляна юлія яна ярослава аміна емілія ліза людмила
  надія маргарита дана анжеліка альона аріна варвара влада таїсія ольга світлана леся мирослава соломія мар'яна ангеліна лариса
  міла настя соня даша катя вікторія`.split(/\s+/),
);

/** Стать за по-батькові, іменем або закінченням прізвища. Невпевнено — null, і користувач вказує «ч/ж» сам. */
export function guessSex(nameTokens: string[]): 'm' | 'f' | null {
  const lower = nameTokens.map((t) => t.toLowerCase().replace(/[’ʼ`]/g, "'"));
  for (const t of lower) {
    if (/(?:ович|йович|іч|ьич)$/u.test(t)) return 'm';
    if (/(?:івна|ївна|овна|ївна|ична)$/u.test(t)) return 'f';
  }
  for (const t of lower) {
    if (MALE_NAMES.has(t)) return 'm';
    if (FEMALE_NAMES.has(t)) return 'f';
  }
  const surname = lower[0];
  if (/(?:ська|цька|зька|ова|ева|єва|іна|їна)$/u.test(surname)) return 'f';
  if (/(?:ський|цький|зький|ов|ев|єв)$/u.test(surname)) return 'm';
  return null;
}

function validDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Замінює збіг пробілами тієї ж довжини, щоб решта рядка не з'їжджала. */
const blank = (text: string, match: RegExpMatchArray) =>
  text.slice(0, match.index!) + ' '.repeat(match[0].length) + text.slice(match.index! + match[0].length);

export function parseFighterLine(raw: string, line: number, eventDate: string): ParsedFighter | ParseError {
  const fail = (reason: string): ParseError => ({ line, raw, reason });
  const warnings: string[] = [];
  const eventYear = Number(eventDate.slice(0, 4));

  let work = raw.replace(/(\d),(\d)(?!\d)/g, '$1.$2');
  work = work.replace(/[,;]/g, ' ').replace(/\s[-–—]\s|[–—]/g, ' ');

  // дата народження дд.мм.рррр / рррр-мм-дд
  let birthDate: string | null = null;
  let birthYearOnly = false;
  const dmy = work.match(/(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{4})(?!\d)/);
  if (dmy) {
    const [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (!validDate(y, m, d)) return fail('некоректна дата народження');
    birthDate = `${y}-${pad(m)}-${pad(d)}`;
    work = blank(work, dmy);
  } else {
    const iso = work.match(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/);
    if (iso) {
      const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
      if (!validDate(y, m, d)) return fail('некоректна дата народження');
      birthDate = iso[0];
      work = blank(work, iso);
    }
  }

  // пояс: N кю / N дан (мають пріоритет над кольором)
  let belt: BeltCode | null = null;
  let assumed = false;
  const kyu = work.match(new RegExp(`${NOT_LETTER_OR_DIGIT}(\\d{1,2})\\s*(?:кю|kyu|kiu)${NOT_FOLLOWED}`, 'iu'));
  if (kyu) {
    belt = kyuToBelt(Number(kyu[1]));
    if (!belt) return fail(`пояса ${kyu[1]} кю не існує`);
    work = blank(work, kyu);
  }
  const dan = work.match(new RegExp(`${NOT_LETTER_OR_DIGIT}(\\d)\\s*(?:дан|dan)${NOT_FOLLOWED}`, 'iu'));
  if (dan) {
    const fromDan = danToBelt(Number(dan[1]));
    if (!fromDan) return fail(`пояса ${dan[1]} дан не існує`);
    if (!belt) belt = fromDan;
    work = blank(work, dan);
  }
  // кольори прибираємо завжди, але використовуємо лише якщо числового поясу нема;
  // слово на початку рядка — це прізвище (Білий, Чорний), а не пояс
  for (const color of COLORS) {
    const re = new RegExp(`${NOT_LETTER_OR_DIGIT}${color.re}${STRIPE}${NOT_FOLLOWED}`, 'giu');
    const m = [...work.matchAll(re)].find((hit) => work.slice(0, hit.index).trim() !== '');
    if (!m) continue;
    if (!belt) {
      const striped = color.striped !== null && /(?:смужк|полоск)/iu.test(m[0]);
      belt = striped ? color.striped : color.plain;
      // біле — однозначне; решта кольорів без смужки може бути двома кю
      assumed = !striped && color.plain !== 'white';
    }
    work = blank(work, m);
  }

  // вага / вік з суфіксами
  let weight: number | null = null;
  let age: number | null = null;
  const kg = work.match(new RegExp(`${NOT_LETTER_OR_DIGIT}(\\d{2,3}(?:\\.\\d)?)\\s*(?:кг|kg)${NOT_FOLLOWED}`, 'iu'));
  if (kg) {
    weight = Number(kg[1]);
    work = blank(work, kg);
  }
  const yrs = work.match(new RegExp(`${NOT_LETTER_OR_DIGIT}(\\d{1,2})\\s*(?:років|рік|роки|року|р|y|yo)${NOT_FOLLOWED}`, 'iu'));
  if (yrs) {
    age = Number(yrs[1]);
    work = blank(work, yrs);
  }

  // рік народження: окреме число 1990–2020; решта чисел — вік і вага
  const bare: number[] = [];
  work = work.replace(/(?<![\p{L}\p{N}.])\d+(?:\.\d+)?(?![\p{L}\p{N}])/gu, (token) => {
    const n = Number(token);
    if (!birthDate && /^\d{4}$/.test(token) && n >= 1990 && n <= 2020) {
      birthDate = `${n}-01-01`;
      birthYearOnly = true;
    } else {
      bare.push(n);
    }
    return ' '.repeat(token.length);
  });

  const needAge = age === null && birthDate === null;
  const needWeight = weight === null;
  if (bare.length > Number(needAge) + Number(needWeight)) return fail('зайві числа — перевірте вік і вагу');
  if (needAge && needWeight) {
    if (bare.length < 2) return fail('вкажіть вік і вагу');
    const [small, big] = [...bare].sort((a, b) => a - b);
    if (small === big) return fail('не зрозумів, де вік, а де вага');
    age = small;
    weight = big;
  } else if (needAge) {
    if (bare.length < 1) return fail('не знайшов вік');
    age = bare[0];
  } else if (needWeight) {
    if (bare.length < 1) return fail('не знайшов вагу');
    weight = bare[0];
  }

  // решта токенів: стать та ПІБ
  work = work.replace(/\.(?=\s|$)/g, ' ');
  const tokens = work.split(/\s+/).filter(Boolean);
  let sexIndex = -1;
  tokens.forEach((token, i) => {
    const t = token.toLowerCase();
    if (MALE.has(t) || FEMALE.has(t)) sexIndex = i;
  });
  const nameTokens = tokens.filter((token, i) => i !== sexIndex && !NOISE.has(token.toLowerCase()));
  const badToken = nameTokens.find((token) => !NAME_TOKEN.test(token));
  if (badToken) return fail(`не зрозумів «${badToken}»`);
  if (nameTokens.length < 2) return fail("вкажіть прізвище та ім'я");

  let sex: 'm' | 'f';
  if (sexIndex >= 0) {
    sex = MALE.has(tokens[sexIndex].toLowerCase()) ? 'm' : 'f';
  } else {
    const guessed = guessSex(nameTokens);
    if (!guessed) return fail('не зрозумів стать (ч/ж)');
    sex = guessed;
    warnings.push('стать вгадано за ім’ям — перевірте');
  }

  if (!belt) return fail('не знайшов пояс');

  if (weight === null || weight < 15 || weight > 150) return fail('вага поза межами 15–150 кг');
  let ageYears = age;
  if (birthDate) {
    ageYears = birthYearOnly ? eventYear - Number(birthDate.slice(0, 4)) : ageOnDate(birthDate, eventDate);
    if (birthYearOnly) warnings.push('вказано лише рік народження — вік приблизний');
  }
  if (ageYears === null || ageYears < 4 || ageYears > 60) return fail('вік поза межами 4–60 років');
  if (assumed) warnings.push('колір без смужки — вказано молодший кю, перевірте пояс');
  warnings.push(...plausibilityWarnings({ age: ageYears, weight_kg: weight, belt }));

  return {
    line,
    raw,
    full_name: nameTokens.join(' ').replace(/\.$/, ''),
    sex,
    age_years: birthDate && !birthYearOnly ? null : ageYears,
    birth_date: birthYearOnly ? null : birthDate,
    weight_kg: Math.round(weight * 10) / 10,
    belt,
    assumed,
    warnings,
  };
}

export function parseFighters(text: string, eventDate: string): ParseResult {
  const parsed: ParsedFighter[] = [];
  const errors: ParseError[] = [];
  const seen = new Map<string, number>();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const lineNo = index + 1;
    const result = parseFighterLine(trimmed, lineNo, eventDate);
    if ('reason' in result) {
      errors.push(result);
      return;
    }
    const dupKey = `${result.full_name.toLowerCase()}|${result.birth_date ?? result.age_years}`;
    const first = seen.get(dupKey);
    if (first !== undefined) result.warnings.push(`дублікат рядка ${first}`);
    else seen.set(dupKey, lineNo);
    parsed.push(result);
  });

  return { parsed, errors };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFighterLine, parseFighters, type ParsedFighter } from '../../api/_shingi/parser.js';

const EVENT = '2026-11-16';

const ok = (line: string): ParsedFighter => {
  const result = parseFighterLine(line, 1, EVENT);
  assert.ok(!('reason' in result), `очікував успіх, отримав: ${JSON.stringify(result)}`);
  return result as ParsedFighter;
};

const reason = (line: string): string => {
  const result = parseFighterLine(line, 1, EVENT);
  assert.ok('reason' in result, `очікував помилку, отримав: ${JSON.stringify(result)}`);
  return (result as { reason: string }).reason;
};

describe('parser: приклади з брифу', () => {
  it('«ч 12 38 8кю»', () => {
    const f = ok('Іваненко Максим ч 12 38 8кю');
    assert.equal(f.full_name, 'Іваненко Максим');
    assert.equal(f.sex, 'm');
    assert.equal(f.age_years, 12);
    assert.equal(f.weight_kg, 38);
    assert.equal(f.belt, 'k8');
    assert.equal(f.assumed, false);
  });

  it('коми та «10 кю»', () => {
    const f = ok('Коваль Софія, ж, 10, 31, 10 кю');
    assert.equal(f.sex, 'f');
    assert.equal(f.age_years, 10);
    assert.equal(f.weight_kg, 31);
    assert.equal(f.belt, 'k10');
  });

  it('тире, «р» і «кг»', () => {
    const f = ok('Петренко Артем — м, 16 р, 62 кг, 4 кю');
    assert.equal(f.age_years, 16);
    assert.equal(f.weight_kg, 62);
    assert.equal(f.belt, 'k4');
  });

  it('рік народження і колір зі смужкою', () => {
    const f = ok('Сидоренко Олена ж 2012 44 жовтий зі смужкою');
    assert.equal(f.belt, 'k5');
    assert.equal(f.assumed, false);
    assert.equal(f.birth_date, null);
    assert.equal(f.age_years, 14);
    assert.equal(f.weight_kg, 44);
    assert.ok(f.warnings.some((w) => w.includes('рік народження')));
  });

  it('дан', () => {
    const f = ok('Бондар Ігор ч 25 84 1 дан');
    assert.equal(f.belt, 'd1');
    assert.equal(f.age_years, 25);
    assert.equal(f.weight_kg, 84);
  });

  it('білий і стать «д»', () => {
    const f = ok('Шевченко Дарина д 9 29 білий');
    assert.equal(f.sex, 'f');
    assert.equal(f.belt, 'white');
    assert.equal(f.assumed, false);
  });
});

describe('parser: пояси та дати', () => {
  it('колір без смужки → молодший кю з позначкою assumed', () => {
    const f = ok('Мельник Іван ч 11 35 помаранчевий');
    assert.equal(f.belt, 'k10');
    assert.equal(f.assumed, true);
    assert.ok(f.warnings.length > 0);
  });

  it('помаранчевий зі смужкою → 9 кю без припущення', () => {
    const f = ok('Мельник Іван ч 11 35 помаранчевий зі смужкою');
    assert.equal(f.belt, 'k9');
    assert.equal(f.assumed, false);
  });

  it('числовий кю має пріоритет над кольором', () => {
    assert.equal(ok('Мельник Іван ч 11 35 7 кю синій').belt, 'k7');
  });

  it('повна дата народження → вік на дату події', () => {
    const f = ok('Ткач Ольга ж 05.03.2014 40 6 кю');
    assert.equal(f.birth_date, '2014-03-05');
    assert.equal(f.age_years, null);
    assert.equal(f.weight_kg, 40);
    assert.equal(f.belt, 'k6');
  });

  it('десяткова вага з комою', () => {
    const f = ok('Лис Андрій ч 14 62,5 кг 3 кю');
    assert.equal(f.weight_kg, 62.5);
    assert.equal(f.age_years, 14);
  });

  it('подвійне прізвище з дефісом і прізвище-колір на початку', () => {
    assert.equal(ok('Петренко-Іваненко Артем ч 12 38 8кю').full_name, 'Петренко-Іваненко Артем');
    const f = ok('Білий Олег ч 12 38 8кю');
    assert.equal(f.full_name, 'Білий Олег');
    assert.equal(f.belt, 'k8');
  });
});

describe('parser: помилки', () => {
  it('немає поясу', () => assert.equal(reason('Іваненко Максим ч 12 38'), 'не знайшов пояс'));
  it('немає статі', () => assert.equal(reason('Іваненко Максим 12 38 8кю'), 'не зрозумів стать (ч/ж)'));
  it('одне слово замість ПІБ', () => assert.equal(reason('Іваненко ч 12 38 8кю'), "вкажіть прізвище та ім'я"));
  it('вага поза межами', () => assert.equal(reason('Іваненко Максим ч 12 200 8кю'), 'вага поза межами 15–150 кг'));
  it('кю поза межами', () => assert.match(reason('Іваненко Максим ч 12 38 11 кю'), /не існує/));
  it('сміття у ПІБ', () => assert.match(reason('Іваненко Максим $$ ч 12 38 8кю'), /не зрозумів/));
});

describe('parser: список', () => {
  it('нумерує рядки з урахуванням порожніх і позначає дублікати', () => {
    const text = ['Іваненко Максим ч 12 38 8кю', '', 'Іваненко Максим ч 12 38 8кю', 'Сміття'].join('\n');
    const { parsed, errors } = parseFighters(text, EVENT);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[1].line, 3);
    assert.ok(parsed[1].warnings.some((w) => w.includes('дублікат рядка 1')));
    assert.equal(errors.length, 1);
    assert.equal(errors[0].line, 4);
  });

  it('порожній текст — порожній результат', () => {
    assert.deepEqual(parseFighters('  \n\n', EVENT), { parsed: [], errors: [] });
  });
});

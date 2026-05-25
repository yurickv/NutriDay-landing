import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { Tip } from '@/types/engagement';

const TIPS_SEED: Omit<Tip, '_id'>[] = [
  // Харчування
  { text: 'Їжте повільно та жуйте ретельно — мозку потрібно 20 хвилин, щоб отримати сигнал ситості.', category: 'nutrition', tags: ['їжа', 'звички'], isActive: true, displayWeight: 8 },
  { text: 'Починайте обід із салату або супу — це допоможе з\'їсти менше основної страви.', category: 'nutrition', tags: ['їжа', 'порції'], isActive: true, displayWeight: 7 },
  { text: 'Білок на сніданок зменшує тягу до солодкого протягом дня.', category: 'nutrition', tags: ['сніданок', 'білок'], isActive: true, displayWeight: 9 },
  { text: 'Додайте до кожного прийому їжі жменю овочів — це легко і корисно.', category: 'nutrition', tags: ['овочі', 'здоров\'я'], isActive: true, displayWeight: 8 },
  { text: 'Готуйте страви вдома — так ви контролюєте склад і калорійність.', category: 'nutrition', tags: ['готування', 'контроль'], isActive: true, displayWeight: 9 },
  { text: 'Не пропускайте сніданок — це запускає метаболізм на весь день.', category: 'nutrition', tags: ['сніданок', 'метаболізм'], isActive: true, displayWeight: 8 },
  { text: 'Вибирайте цільнозернові продукти замість рафінованих — вони насичують довше.', category: 'nutrition', tags: ['злаки', 'ситість'], isActive: true, displayWeight: 7 },
  { text: 'Перекус із горіхів і фруктів краще, ніж печиво або чіпси.', category: 'nutrition', tags: ['перекус', 'вибір'], isActive: true, displayWeight: 8 },
  { text: 'Гречка — суперфуд: багата білком, клітковиною та мінералами.', category: 'nutrition', tags: ['гречка', 'суперфуд'], isActive: true, displayWeight: 7 },
  { text: 'Риба 2-3 рази на тиждень — джерело омега-3 для здоров\'я серця і мозку.', category: 'nutrition', tags: ['риба', 'омега-3'], isActive: true, displayWeight: 8 },
  { text: 'Квасоля і сочевиця — чудове і недороге джерело рослинного білку.', category: 'nutrition', tags: ['бобові', 'білок'], isActive: true, displayWeight: 7 },
  { text: 'Смажте на мінімумі олії або використовуйте гриль — це зменшує калорійність.', category: 'cooking', tags: ['готування', 'калорії'], isActive: true, displayWeight: 7 },
  { text: 'Обирайте тушкування або запікання замість смаження — смак зберігається, жиру менше.', category: 'cooking', tags: ['готування', 'спосіб'], isActive: true, displayWeight: 8 },
  { text: 'Прянощі замість солі: куркума, чебрець, базилік додають смак без шкоди.', category: 'cooking', tags: ['спеції', 'сіль'], isActive: true, displayWeight: 7 },
  { text: 'Приготуйте велику порцію овочевого рагу — вистачить на 2-3 дні.', category: 'cooking', tags: ['планування', 'готування'], isActive: true, displayWeight: 8 },
  { text: 'Борщ стає смачнішим на другий день — ідеально для meal prep.', category: 'cooking', tags: ['борщ', 'meal-prep'], isActive: true, displayWeight: 6 },
  { text: 'Заморожуйте зелень влітку — взимку матимете ароматні страви з мінімальними витратами.', category: 'cooking', tags: ['заморозка', 'сезон'], isActive: true, displayWeight: 6 },
  // Гідратація
  { text: 'Почніть день зі склянки теплої води — це активізує травлення.', category: 'hydration', tags: ['вода', 'ранок'], isActive: true, displayWeight: 9 },
  { text: 'Тримайте пляшку з водою на видному місці — це нагадуватиме пити.', category: 'hydration', tags: ['вода', 'звичка'], isActive: true, displayWeight: 9 },
  { text: 'Відчуваєте голод між прийомами їжі? Спробуйте спершу випити воду.', category: 'hydration', tags: ['вода', 'голод'], isActive: true, displayWeight: 8 },
  { text: 'Трав\'яний чай без цукру рахується як вода і зігріває в холодну пору.', category: 'hydration', tags: ['чай', 'вода'], isActive: true, displayWeight: 7 },
  { text: 'Кава зневоднює — після кожної чашки випийте склянку води.', category: 'hydration', tags: ['кава', 'вода'], isActive: true, displayWeight: 8 },
  { text: 'Норма води: приблизно 30-35 мл на кг ваги тіла на день.', category: 'hydration', tags: ['вода', 'норма'], isActive: true, displayWeight: 8 },
  { text: 'Вода зі скибочкою лимона або огірка — смачна альтернатива солодким напоям.', category: 'hydration', tags: ['вода', 'смак'], isActive: true, displayWeight: 7 },
  { text: 'Пийте воду за 30 хвилин до їжі — це допомагає їсти менше.', category: 'hydration', tags: ['вода', 'апетит'], isActive: true, displayWeight: 8 },
  // Мотивація
  { text: 'Маленькі зміни щодня = великий результат через місяць. Ви вже на правильному шляху!', category: 'motivation', tags: ['прогрес', 'звички'], isActive: true, displayWeight: 10 },
  { text: 'Пропустили день? Це не провал. Повернутися — і є справжня перемога.', category: 'motivation', tags: ['пропуск', 'позитив'], isActive: true, displayWeight: 10 },
  { text: 'Фотографуйте себе раз на тиждень — зміни, які не видно в дзеркалі, буде видно на фото.', category: 'motivation', tags: ['прогрес', 'фото'], isActive: true, displayWeight: 8 },
  { text: 'Вміло складені страви з меню — це вже половина успіху. Продовжуйте!', category: 'motivation', tags: ['меню', 'успіх'], isActive: true, displayWeight: 9 },
  { text: 'Поставте невелику нагороду за тиждень дотримання плану — не їжою, а чимось приємним.', category: 'motivation', tags: ['нагорода', 'мотивація'], isActive: true, displayWeight: 8 },
  { text: 'Розкажіть подрузі або рідним про свою ціль — соціальна підтримка підвищує шанси успіху.', category: 'motivation', tags: ['підтримка', 'мета'], isActive: true, displayWeight: 7 },
  { text: 'Відчуваєте втому від обмежень? Нагадайте собі, ЧОМУ ви почали.', category: 'motivation', tags: ['ціль', 'мотивація'], isActive: true, displayWeight: 9 },
  { text: 'Кожен прийом їжі — нова можливість зробити корисний вибір. Вчорашнє не рахується.', category: 'motivation', tags: ['позитив', 'вибір'], isActive: true, displayWeight: 9 },
  { text: 'Ваш стрік — це доказ того, що у вас є сила волі і система. Не зупиняйтесь!', category: 'motivation', tags: ['стрік', 'сила'], isActive: true, displayWeight: 10 },
  // Спосіб життя
  { text: 'Сон 7-8 годин так само важливий для схуднення, як дієта і рух.', category: 'lifestyle', tags: ['сон', 'здоров\'я'], isActive: true, displayWeight: 9 },
  { text: 'Прогулянка 15-20 хвилин після вечері допомагає знизити рівень цукру в крові.', category: 'lifestyle', tags: ['рух', 'вечеря'], isActive: true, displayWeight: 8 },
  { text: 'Стрес підвищує кортизол і апетит — знайдіть свій спосіб розслаблятись.', category: 'lifestyle', tags: ['стрес', 'кортизол'], isActive: true, displayWeight: 8 },
  { text: 'Їжте за столом без телефону — це допомагає усвідомлено насолодитися їжею.', category: 'lifestyle', tags: ['усвідомленість', 'їжа'], isActive: true, displayWeight: 7 },
  { text: 'Плануйте меню на тиждень заздалегідь — це економить гроші та нерви.', category: 'lifestyle', tags: ['планування', 'організація'], isActive: true, displayWeight: 9 },
  { text: 'Ходіть пішки туди, де зазвичай їдете — кожен крок рахується.', category: 'lifestyle', tags: ['рух', 'кроки'], isActive: true, displayWeight: 7 },
  { text: 'Готуйте з задоволенням — смачна їжа, яку ви зробили самі, приносить більше насичення.', category: 'lifestyle', tags: ['готування', 'задоволення'], isActive: true, displayWeight: 7 },
  { text: 'Жінкам важливо прислухатись до тіла: у різні фази циклу апетит і енергія різні — це нормально.', category: 'lifestyle', tags: ['жінки', 'цикл', 'тіло'], isActive: true, displayWeight: 8 },
  { text: 'Магній і вітамін D — два дефіцити, що найчастіше впливають на втому і апетит. Перевірте рівень.', category: 'lifestyle', tags: ['вітаміни', 'мінерали'], isActive: true, displayWeight: 7 },
  { text: 'Холодна погода? Тепла каша вранці і гарячий суп вдень — і тіло, і душа задоволені.', category: 'lifestyle', tags: ['зима', 'тепло'], isActive: true, displayWeight: 6 },
  { text: 'Зважуйтесь раз на тиждень, вранці, після туалету, натще — тільки так вимірювання об\'єктивні.', category: 'lifestyle', tags: ['вага', 'вимірювання'], isActive: true, displayWeight: 8 },
];

// GET /api/tips?context=hydration|motivation — daily tip (same tip all day, context-aware)
export async function GET(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const context = searchParams.get('context') as Tip['category'] | null;

  const db = await getDb();

  // Seed tips if collection is empty
  const count = await db.collection('tips').countDocuments();
  if (count === 0) {
    await (db.collection('tips') as any).insertMany(TIPS_SEED); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  // Date-based deterministic selection (same tip per day)
  const today = new Date();
  const dateKey = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();

  let tips: Tip[];

  if (context) {
    tips = await db
      .collection('tips')
      .find<Tip>({ isActive: true, category: context })
      .toArray();
  } else {
    tips = await db
      .collection('tips')
      .find<Tip>({ isActive: true })
      .toArray();
  }

  if (!tips.length) {
    return NextResponse.json({ tip: null });
  }

  // Weighted selection using date hash
  const totalWeight = tips.reduce((sum, t) => sum + t.displayWeight, 0);
  let hash = dateKey % totalWeight;
  let selected = tips[0];
  for (const tip of tips) {
    hash -= tip.displayWeight;
    if (hash <= 0) {
      selected = tip;
      break;
    }
  }

  return NextResponse.json({ tip: selected });
}

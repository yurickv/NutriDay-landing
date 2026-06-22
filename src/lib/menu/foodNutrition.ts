/**
 * Nutrition reference for the meal planner.
 *
 * The LLM is no longer trusted to invent a dish's macros — it picks dishes and
 * lists ingredients with weights, and the code computes calories + macros from
 * THIS table by summing the ingredients. That makes the numbers deterministic
 * and stops the "protein of a single ingredient applied to the whole dish"
 * over-estimation (the model used to report 23 g protein/100 g for a stewed-
 * chicken-with-vegetables dish because it remembered raw chicken breast).
 *
 * Values are per 100 g of the RAW / as-purchased product, which is how the model
 * lists ingredient quantities (e.g. "гречана крупа 80 г" = dry buckwheat). Water
 * gain/loss during cooking is handled separately (see cookingYield), because a
 * dish's eaten weight differs from the sum of raw ingredient weights.
 *
 * To extend: add an entry with lowercase Ukrainian keywords. Keep keywords
 * distinctive; matching is substring-based on a normalised ingredient name.
 */

import { NutritionPer100 } from '@/types/meals';

export interface FoodEntry {
  // Canonical label (for debugging / future UI).
  label: string;
  // Per 100 g of raw product.
  protein: number;
  fat: number;
  carbs: number;
  // Lowercase keywords; an ingredient matches if its normalised name contains
  // any keyword. Order matters only for readability, not matching.
  keywords: string[];
}

// NOTE: values are conventional averages for products common in Ukraine. They
// don't need lab precision — they're vastly more accurate than the model's
// guesses and, crucially, consistent.
export const FOOD_TABLE: FoodEntry[] = [
  // ── Meat & poultry ─────────────────────────────────────────────────────
  {
    label: 'Куряче філе',
    protein: 23,
    fat: 1.9,
    carbs: 0,
    keywords: [
      'куряче філе',
      'курячого філе',
      'філе курки',
      'грудка курки',
      'куряча грудка',
      'курячі грудки',
      'курячих грудок',
      'курячу грудку',
    ],
  },
  {
    label: 'Курятина (стегно/гомілка)',
    protein: 18,
    fat: 9,
    carbs: 0,
    keywords: ['куряче стегно', 'куряча гомілка', 'курятина'],
  },
  {
    label: 'Індиче філе',
    protein: 22,
    fat: 2,
    carbs: 0,
    keywords: ['індиче філе', 'індичка', 'індичатина', 'філе індички'],
  },
  {
    label: 'Яловичина пісна',
    protein: 21,
    fat: 8,
    carbs: 0,
    keywords: ['яловичина', 'яловичини', 'телятина'],
  },
  {
    label: 'Свинина пісна',
    protein: 19,
    fat: 14,
    carbs: 0,
    keywords: ['свинина', 'свинини', 'свиняче'],
  },
  {
    label: 'Фарш курячий',
    protein: 20,
    fat: 8,
    carbs: 0,
    keywords: ['курячий фарш', 'фарш курячий', 'фарш з курки'],
  },
  {
    label: 'Фарш яловичий',
    protein: 18,
    fat: 12,
    carbs: 0,
    keywords: [
      'яловичий фарш',
      'фарш яловичий',
      'фарш зі свинини',
      'фарш свинячий',
      'фарш',
    ],
  },
  {
    label: 'Кролятина',
    protein: 21,
    fat: 11,
    carbs: 0,
    keywords: ['кролятина', 'кролик', 'кроля'],
  },
  {
    label: 'Качка',
    protein: 16,
    fat: 38,
    carbs: 0,
    keywords: ['качк', 'качине', 'качатина'],
  },
  {
    label: 'Печінка куряча',
    protein: 18,
    fat: 6,
    carbs: 1.5,
    keywords: ['куряча печінка', 'печінка куряча'],
  },
  {
    label: 'Печінка яловича',
    protein: 18,
    fat: 3.5,
    carbs: 4,
    keywords: ['печінка', 'печінки', 'печінкою'],
  },
  {
    label: 'Сало',
    protein: 1.4,
    fat: 90,
    carbs: 0,
    keywords: ['сало', 'сала', 'шпик'],
  },
  {
    label: 'Ковбаса варена',
    protein: 12,
    fat: 22,
    carbs: 1.5,
    keywords: ['варена ковбаса', 'ковбаса варена', 'докторська'],
  },
  {
    label: 'Ковбаса копчена/салямі',
    protein: 17,
    fat: 40,
    carbs: 1,
    keywords: [
      'копчена ковбаса',
      'ковбаса копчена',
      'салямі',
      'сервелат',
      'ковбас',
    ],
  },
  {
    label: 'Сосиски/сардельки',
    protein: 11,
    fat: 23,
    carbs: 2,
    keywords: ['сосиск', 'сардельк'],
  },
  {
    label: 'Бекон/грудинка',
    protein: 12,
    fat: 45,
    carbs: 0,
    keywords: ['бекон', 'бекону', 'грудинка'],
  },
  {
    label: 'Шинка/буженина',
    protein: 16,
    fat: 18,
    carbs: 0,
    keywords: ['шинка', 'шинки', 'шинкою', 'буженина'],
  },

  // ── Fish & seafood ─────────────────────────────────────────────────────
  {
    label: 'Рибне філе (загальне)',
    protein: 18,
    fat: 3,
    carbs: 0,
    keywords: [
      'рибне філе',
      'рибного філе',
      'філе риби',
      'філе рибне',
      'рибний філе',
    ],
  },
  {
    label: 'Тріска',
    protein: 18,
    fat: 0.7,
    carbs: 0,
    keywords: ['тріска', 'тріски'],
  },
  { label: 'Хек', protein: 16, fat: 2.2, carbs: 0, keywords: ['хек', 'хека'] },
  {
    label: 'Минтай',
    protein: 16,
    fat: 0.9,
    carbs: 0,
    keywords: ['минтай', 'минтая'],
  },
  {
    label: 'Лосось/форель',
    protein: 20,
    fat: 13,
    carbs: 0,
    keywords: ['лосось', 'лосося', 'форель', 'сьомга'],
  },
  {
    label: 'Скумбрія',
    protein: 18,
    fat: 13,
    carbs: 0,
    keywords: ['скумбрія', 'скумбрії'],
  },
  {
    label: 'Тунець',
    protein: 23,
    fat: 1,
    carbs: 0,
    keywords: ['тунець', 'тунця'],
  },
  {
    label: 'Креветки',
    protein: 18,
    fat: 1,
    carbs: 0,
    keywords: ['креветки', 'креветок'],
  },
  {
    label: 'Оселедець',
    protein: 17,
    fat: 12,
    carbs: 0,
    keywords: ['оселедець', 'оселедця', 'оселедцем'],
  },
  {
    label: 'Короп',
    protein: 16,
    fat: 5,
    carbs: 0,
    keywords: ['короп', 'коропа'],
  },
  {
    label: 'Карась',
    protein: 17,
    fat: 1.8,
    carbs: 0,
    keywords: ['карась', 'карася'],
  },
  {
    label: 'Судак',
    protein: 19,
    fat: 0.8,
    carbs: 0,
    keywords: ['судак', 'судака'],
  },
  {
    label: 'Щука',
    protein: 18,
    fat: 1.1,
    carbs: 0,
    keywords: ['щука', 'щуки'],
  },
  {
    label: 'Товстолоб',
    protein: 19,
    fat: 7,
    carbs: 0,
    keywords: ['товстолоб', 'товстолоба'],
  },
  {
    label: 'Кілька/тюлька',
    protein: 17,
    fat: 7,
    carbs: 0,
    keywords: ['кілька', 'тюльк', 'шпрот'],
  },
  {
    label: 'Краб/крабові палички',
    protein: 6,
    fat: 1,
    carbs: 14,
    keywords: ['крабов', 'крабові палички'],
  },
  {
    label: 'Мідії',
    protein: 12,
    fat: 2,
    carbs: 3.5,
    keywords: ['мідії', 'мідій'],
  },
  {
    label: 'Кальмар',
    protein: 18,
    fat: 1.4,
    carbs: 0,
    keywords: ['кальмар', 'кальмара'],
  },
  {
    label: 'Ікра червона/чорна',
    protein: 28,
    fat: 14,
    carbs: 0,
    keywords: ['ікра', 'ікри', 'ікрою'],
  },

  // ── Eggs & dairy ───────────────────────────────────────────────────────
  {
    label: 'Яйце куряче',
    protein: 13,
    fat: 11,
    carbs: 1.1,
    keywords: ['яйце', 'яйця', 'яєць', 'яйцем'],
  },
  {
    label: 'Молоко 2.5%',
    protein: 2.8,
    fat: 2.5,
    carbs: 4.7,
    keywords: ['молоко', 'молока'],
  },
  {
    label: 'Кефір 1%',
    protein: 3,
    fat: 1,
    carbs: 4,
    keywords: ['кефір', 'кефіру'],
  },
  {
    label: 'Йогурт натуральний',
    protein: 5,
    fat: 3.2,
    carbs: 8.5,
    keywords: ['йогурт', 'йогурту'],
  },
  {
    label: 'Сир кисломолочний 5%',
    protein: 16,
    fat: 5,
    carbs: 3,
    keywords: [
      'творог',
      'кисломолочний сир',
      'сир кисломолочний',
      'сир знежирений',
      'знежирений сир',
      'нежирний сир',
      'сир нежирний',
      'сиркова маса',
      'кисломолочний',
      'сир',
    ],
  },
  {
    label: 'Сир твердий',
    protein: 25,
    fat: 27,
    carbs: 0,
    keywords: [
      'твердий сир',
      'сир твердий',
      'голландськ',
      'пармезан',
      'моцарела',
      'фета',
      'бринза',
      'чеддер',
    ],
  },
  {
    label: 'Сметана 15%',
    protein: 2.6,
    fat: 15,
    carbs: 3,
    keywords: ['сметана', 'сметани', 'сметаною'],
  },
  {
    label: 'Вершки',
    protein: 2.5,
    fat: 20,
    carbs: 4,
    keywords: ['вершки', 'вершків'],
  },
  {
    label: 'Масло вершкове',
    protein: 0.5,
    fat: 82,
    carbs: 0.8,
    keywords: ['вершкове масло', 'масло вершкове', 'масло'],
  },
  {
    label: 'Ряжанка',
    protein: 2.9,
    fat: 4,
    carbs: 4.2,
    keywords: ['ряжанка', 'ряжанки'],
  },
  {
    label: 'Сир плавлений',
    protein: 11,
    fat: 23,
    carbs: 3,
    keywords: ['плавлений сир', 'сир плавлений', 'плавлений сирок'],
  },
  {
    label: 'Сир адигейський/сулугуні',
    protein: 19,
    fat: 16,
    carbs: 1.5,
    keywords: ['адигейський', 'сулугуні', 'чечіль'],
  },
  {
    label: 'Згущене молоко',
    protein: 7,
    fat: 8.5,
    carbs: 56,
    keywords: ['згущене молоко', 'згущёнка', 'згущенка'],
  },
  {
    label: 'Морозиво',
    protein: 3.5,
    fat: 11,
    carbs: 23,
    keywords: ['морозиво', 'морозива'],
  },

  // ── Grains, bread, pasta ───────────────────────────────────────────────
  {
    label: 'Вівсяні пластівці',
    protein: 12,
    fat: 6,
    carbs: 62,
    keywords: ['вівсян', 'вівсянка', 'геркулес', 'овес'],
  },
  {
    label: 'Гречка',
    protein: 12.6,
    fat: 3.3,
    carbs: 62,
    keywords: ['гречк', 'гречан'],
  },
  { label: 'Рис', protein: 7, fat: 1, carbs: 78, keywords: ['рис', 'рису'] },
  {
    label: 'Пшоно',
    protein: 11,
    fat: 3.3,
    carbs: 67,
    keywords: ['пшоно', 'пшона', 'пшоняна'],
  },
  {
    label: 'Перлова крупа',
    protein: 9,
    fat: 1,
    carbs: 67,
    keywords: ['перлов', 'перловка', 'ячна'],
  },
  {
    label: 'Манна крупа',
    protein: 10,
    fat: 1,
    carbs: 70,
    keywords: ['манн', 'манка'],
  },
  {
    label: 'Пшенична крупа',
    protein: 13,
    fat: 2,
    carbs: 68,
    keywords: ['пшенична крупа', 'пшеничної крупи', 'пшенична каша', 'пшеничної каші'],
  },
  {
    label: 'Кукурудзяна крупа',
    protein: 8,
    fat: 1.2,
    carbs: 71,
    keywords: ['кукурудзяна крупа', 'кукурудзяна каша', 'мамалига', 'полента'],
  },
  {
    label: 'Булгур',
    protein: 12,
    fat: 1.3,
    carbs: 63,
    keywords: ['булгур', 'булгуру'],
  },
  {
    label: 'Кіноа',
    protein: 14,
    fat: 6,
    carbs: 57,
    keywords: ['кіноа', 'кіное'],
  },
  {
    label: 'Кус-кус',
    protein: 13,
    fat: 1.7,
    carbs: 72,
    keywords: ['кус-кус', 'кускус', 'кус кус'],
  },
  {
    label: 'Макарони (тверді сорти)',
    protein: 11,
    fat: 1.3,
    carbs: 71,
    keywords: ['макарон', 'паста', 'спагеті', 'локшина', 'вермішель'],
  },
  {
    label: 'Хліб житній',
    protein: 6,
    fat: 1,
    carbs: 40,
    keywords: ['житній хліб', 'хліб житній', 'чорний хліб'],
  },
  {
    label: 'Хліб цільнозерновий',
    protein: 9,
    fat: 3,
    carbs: 43,
    keywords: ['цільнозерновий', 'цільнозерновий хліб', 'хліб цільнозерновий'],
  },
  {
    label: 'Хліб пшеничний',
    protein: 8,
    fat: 1,
    carbs: 49,
    keywords: ['хліб', 'батон', 'тост', 'булочка', 'булка'],
  },
  {
    label: 'Борошно пшеничне',
    protein: 10,
    fat: 1,
    carbs: 74,
    keywords: ['борошно', 'мука'],
  },
  {
    label: 'Висівки вівсяні',
    protein: 17,
    fat: 7,
    carbs: 50,
    keywords: ['висівки', 'отруби'],
  },
  {
    label: 'Пельмені/вареники з мʼясом',
    protein: 12,
    fat: 12,
    carbs: 29,
    keywords: [
      'пельмен',
      'вареники з мясом',
      'вареники з мʼясом',
      'вареники мясні',
    ],
  },
  {
    label: 'Вареники з картоплею',
    protein: 5,
    fat: 3,
    carbs: 33,
    keywords: ['вареники з картоплею', 'вареники картопляні', 'вареник'],
  },
  {
    label: 'Галушки',
    protein: 6,
    fat: 2,
    carbs: 35,
    keywords: ['галушки', 'галушок'],
  },
  {
    label: 'Млинці/налисники',
    protein: 6,
    fat: 6,
    carbs: 26,
    keywords: ['млинц', 'налисник', 'блинчик'],
  },
  {
    label: 'Оладки/деруни',
    protein: 5,
    fat: 8,
    carbs: 28,
    keywords: ['оладки', 'оладок', 'деруни', 'дерунів'],
  },
  {
    label: 'Сирники',
    protein: 12,
    fat: 9,
    carbs: 21,
    keywords: ['сирник', 'сирників'],
  },
  {
    label: 'Тісто дріжджове/листкове',
    protein: 7,
    fat: 14,
    carbs: 47,
    keywords: ['тісто', 'тіста', 'листкове', 'дріжджове'],
  },
  {
    label: 'Сухарі/панірувальні сухарі',
    protein: 11,
    fat: 2,
    carbs: 72,
    keywords: ['сухарі', 'сухар', 'панірувальн', 'паніровк'],
  },
  {
    label: 'Кукурудзяні пластівці',
    protein: 7,
    fat: 1,
    carbs: 83,
    keywords: [
      'кукурудзяні пластівці',
      'пластівці кукурудзяні',
      'кукурудзяні палички',
    ],
  },

  // ── Legumes ────────────────────────────────────────────────────────────
  {
    label: 'Сочевиця',
    protein: 24,
    fat: 1.5,
    carbs: 47,
    keywords: ['сочевиц'],
  },
  { label: 'Квасоля', protein: 21, fat: 2, carbs: 47, keywords: ['квасол'] },
  {
    label: 'Нут',
    protein: 19,
    fat: 6,
    carbs: 49,
    keywords: ['нут', 'нуту', 'хумус'],
  },
  {
    label: 'Горох',
    protein: 23,
    fat: 1.6,
    carbs: 49,
    keywords: ['горох', 'гороху', 'горохов'],
  },

  // ── Vegetables ─────────────────────────────────────────────────────────
  {
    label: 'Картопля',
    protein: 2,
    fat: 0.4,
    carbs: 17,
    keywords: ['картопл', 'картоплі', 'картоплею'],
  },
  {
    label: 'Морква',
    protein: 1.3,
    fat: 0.1,
    carbs: 7,
    keywords: ['морква', 'моркв'],
  },
  {
    label: 'Буряк',
    protein: 1.5,
    fat: 0.1,
    carbs: 9,
    keywords: ['буряк', 'буряка', 'бурячок'],
  },
  {
    label: 'Капуста білокачанна',
    protein: 1.8,
    fat: 0.1,
    carbs: 5,
    keywords: ['капуста', 'капусти', 'капустою'],
  },
  {
    label: 'Капуста цвітна/броколі',
    protein: 2.8,
    fat: 0.4,
    carbs: 5,
    keywords: ['броколі', 'цвітна капуста', 'брокколі'],
  },
  {
    label: 'Помідор',
    protein: 1,
    fat: 0.2,
    carbs: 4,
    keywords: ['помідор', 'томат', 'помідори', 'помідори черрі'],
  },
  {
    label: 'Огірок',
    protein: 0.8,
    fat: 0.1,
    carbs: 3,
    keywords: ['огірок', 'огірк'],
  },
  {
    label: 'Перець болгарський',
    protein: 1.3,
    fat: 0.3,
    carbs: 6,
    keywords: [
      'перець болгарський',
      'болгарський перець',
      'перець солодкий',
      'перець',
    ],
  },
  { label: 'Цибуля', protein: 1.4, fat: 0.2, carbs: 9, keywords: ['цибул'] },
  {
    label: 'Часник',
    protein: 6.5,
    fat: 0.5,
    carbs: 30,
    keywords: ['часник', 'часнику'],
  },
  {
    label: 'Кабачок',
    protein: 0.6,
    fat: 0.3,
    carbs: 5,
    keywords: ['кабач', 'цукіні', 'кабачки'],
  },
  {
    label: 'Баклажан',
    protein: 1.2,
    fat: 0.1,
    carbs: 6,
    keywords: ['баклажан'],
  },
  { label: 'Гарбуз', protein: 1, fat: 0.1, carbs: 7, keywords: ['гарбуз'] },
  {
    label: 'Гриби',
    protein: 3.5,
    fat: 1,
    carbs: 3.3,
    keywords: ['гриб', 'печериц', 'шампіньйон', 'гливи'],
  },
  {
    label: 'Зелений горошок',
    protein: 5,
    fat: 0.2,
    carbs: 14,
    keywords: ['зелений горошок', 'горошок'],
  },
  {
    label: 'Кукурудза',
    protein: 3.3,
    fat: 1.2,
    carbs: 19,
    keywords: ['кукурудза', 'кукурудзи'],
  },
  {
    label: 'Зелень/салат листовий',
    protein: 1.5,
    fat: 0.3,
    carbs: 3,
    keywords: [
      'салат',
      'листя',
      'листов',
      'шпинат',
      'руккола',
      'зелень',
      'кріп',
      'петрушка',
      'базилік',
      'мікс',
    ],
  },
  {
    label: 'Редиска',
    protein: 1.2,
    fat: 0.1,
    carbs: 3.4,
    keywords: ['редис', 'редиск'],
  },
  {
    label: 'Редька/дайкон',
    protein: 1.4,
    fat: 0.2,
    carbs: 6.7,
    keywords: ['редька', 'редьки', 'дайкон'],
  },
  {
    label: 'Селера',
    protein: 0.9,
    fat: 0.1,
    carbs: 2.1,
    keywords: ['селера', 'селери', 'селерою'],
  },
  {
    label: 'Зелена цибуля',
    protein: 1.3,
    fat: 0.1,
    carbs: 4.6,
    keywords: ['зелена цибуля', 'цибуля зелена', 'цибуля перо'],
  },
  {
    label: 'Квашена капуста',
    protein: 1.6,
    fat: 0.1,
    carbs: 4,
    keywords: ['квашена капуста', 'капуста квашена', 'кисла капуста'],
  },
  {
    label: 'Огірок солоний/квашений',
    protein: 0.8,
    fat: 0.1,
    carbs: 1.7,
    keywords: [
      'солоний огірок',
      'огірок солоний',
      'квашений огірок',
      'мариновані огірки',
      'корнішон',
    ],
  },
  {
    label: 'Спаржа',
    protein: 2.2,
    fat: 0.1,
    carbs: 3.9,
    keywords: ['спаржа', 'спаржі'],
  },
  {
    label: 'Маслини/оливки',
    protein: 0.8,
    fat: 11,
    carbs: 6,
    keywords: ['маслин', 'оливк'],
  },
  {
    label: 'Топінамбур',
    protein: 2,
    fat: 0.1,
    carbs: 17,
    keywords: ['топінамбур'],
  },
  {
    label: 'Ріпа/бруква',
    protein: 1.5,
    fat: 0.1,
    carbs: 6,
    keywords: ['ріпа', 'ріпи', 'бруква'],
  },

  // ── Fruit & berries ────────────────────────────────────────────────────
  { label: 'Яблуко', protein: 0.4, fat: 0.4, carbs: 10, keywords: ['яблук'] },
  { label: 'Банан', protein: 1.5, fat: 0.2, carbs: 21, keywords: ['банан'] },
  { label: 'Груша', protein: 0.4, fat: 0.3, carbs: 11, keywords: ['груш'] },
  {
    label: 'Апельсин/мандарин',
    protein: 0.9,
    fat: 0.2,
    carbs: 8,
    keywords: ['апельсин', 'мандарин', 'цитрус'],
  },
  {
    label: 'Ягоди',
    protein: 1,
    fat: 0.5,
    carbs: 8,
    keywords: ['ягод', 'чорниц', 'малин', 'полуниц', 'смородин', 'лохина'],
  },
  {
    label: 'Хурма',
    protein: 0.5,
    fat: 0.4,
    carbs: 17,
    keywords: ['хурма', 'хурми'],
  },
  { label: 'Слива', protein: 0.7, fat: 0.3, carbs: 9.5, keywords: ['слив'] },
  {
    label: 'Сухофрукти/родзинки',
    protein: 2.5,
    fat: 0.5,
    carbs: 65,
    keywords: [
      'родзинки',
      'ізюм',
      'курага',
      'чорнослив',
      'сухофрукт',
      'фініки',
    ],
  },
  {
    label: 'Лимон',
    protein: 0.9,
    fat: 0.1,
    carbs: 3,
    keywords: ['лимон', 'лимонн'],
  },
  { label: 'Авокадо', protein: 2, fat: 15, carbs: 9, keywords: ['авокадо'] },
  {
    label: 'Виноград',
    protein: 0.6,
    fat: 0.2,
    carbs: 16,
    keywords: ['виноград', 'винограду'],
  },
  {
    label: 'Персик/нектарин',
    protein: 0.9,
    fat: 0.1,
    carbs: 9.5,
    keywords: ['персик', 'нектарин'],
  },
  {
    label: 'Абрикос',
    protein: 0.9,
    fat: 0.1,
    carbs: 9,
    keywords: ['абрикос', 'абрикоси'],
  },
  {
    label: 'Черешня/вишня',
    protein: 0.8,
    fat: 0.3,
    carbs: 11,
    keywords: ['черешн', 'вишн'],
  },
  {
    label: 'Кавун',
    protein: 0.6,
    fat: 0.1,
    carbs: 6,
    keywords: ['кавун', 'кавуна'],
  },
  {
    label: 'Диня',
    protein: 0.6,
    fat: 0.3,
    carbs: 7.4,
    keywords: ['диня', 'дині'],
  },
  { label: 'Ківі', protein: 1, fat: 0.5, carbs: 10, keywords: ['ківі'] },
  {
    label: 'Гранат',
    protein: 0.7,
    fat: 1.2,
    carbs: 14,
    keywords: ['гранат', 'гранату'],
  },
  {
    label: 'Журавлина/калина',
    protein: 0.4,
    fat: 0.2,
    carbs: 12,
    keywords: ['журавлин', 'калин', 'брусниц'],
  },

  // ── Oils, nuts, seeds ──────────────────────────────────────────────────
  {
    label: 'Олія соняшникова/оливкова',
    protein: 0,
    fat: 99,
    carbs: 0,
    keywords: ['олія', 'олії', 'олією', 'оливков', 'соняшников'],
  },
  {
    label: 'Горіхи',
    protein: 15,
    fat: 60,
    carbs: 16,
    keywords: ['горіх', 'горішк', 'мигдаль', 'кеш', 'фундук', 'арахіс'],
  },
  {
    label: 'Насіння',
    protein: 20,
    fat: 50,
    carbs: 18,
    keywords: ['насіння', 'соняшник', 'гарбузове насіння', 'чіа', 'льон'],
  },

  // ── Sweeteners, sauces, misc ───────────────────────────────────────────
  { label: 'Мед', protein: 0.3, fat: 0, carbs: 80, keywords: ['мед', 'меду'] },
  {
    label: 'Цукор',
    protein: 0,
    fat: 0,
    carbs: 100,
    keywords: ['цукор', 'цукру'],
  },
  {
    label: 'Томатний соус/паста',
    protein: 3.5,
    fat: 0.5,
    carbs: 19,
    keywords: ['томатний соус', 'томатна паста', 'томатну', 'кетчуп'],
  },
  {
    label: 'Мед/джем',
    protein: 0.4,
    fat: 0,
    carbs: 65,
    keywords: ['джем', 'варення', 'повидло'],
  },
  {
    label: 'Майонез',
    protein: 1,
    fat: 67,
    carbs: 2.6,
    keywords: ['майонез', 'майонезу'],
  },
  { label: 'Гірчиця', protein: 9, fat: 11, carbs: 5, keywords: ['гірчиц'] },
  {
    label: 'Соєвий соус',
    protein: 6,
    fat: 0,
    carbs: 6,
    keywords: ['соєвий соус', 'соєвого соусу', 'соус соєвий'],
  },
  {
    label: 'Шоколад',
    protein: 6,
    fat: 35,
    carbs: 52,
    keywords: ['шоколад', 'шоколаду', 'какао'],
  },
  {
    label: 'Печиво/вафлі',
    protein: 7,
    fat: 20,
    carbs: 65,
    keywords: ['печиво', 'вафл', 'крекер', 'пряник'],
  },
  {
    label: 'Желатин',
    protein: 87,
    fat: 0.4,
    carbs: 0.7,
    keywords: ['желатин', 'желатину'],
  },
  {
    label: 'Крохмаль',
    protein: 0.6,
    fat: 0.1,
    carbs: 83,
    keywords: ['крохмаль', 'крохмалю'],
  },

  // ── Sweets, bars & snacks ──────────────────────────────────────────────
  {
    label: 'Цукерки шоколадні',
    protein: 4,
    fat: 25,
    carbs: 60,
    keywords: ['цукерк', 'шоколадні цукерки', 'трюфел', 'праліне'],
  },
  {
    label: 'Карамель/льодяники',
    protein: 0,
    fat: 0.1,
    carbs: 96,
    keywords: ['карамель', 'льодяник', 'льодяники'],
  },
  {
    label: 'Зефір/маршмелоу',
    protein: 0.8,
    fat: 0,
    carbs: 80,
    keywords: ['зефір', 'зефіру', 'маршмелоу', 'маршмелов'],
  },
  {
    label: 'Мармелад/пастила',
    protein: 0.4,
    fat: 0.1,
    carbs: 79,
    keywords: ['мармелад', 'пастила', 'жувальн'],
  },
  {
    label: 'Халва',
    protein: 12,
    fat: 30,
    carbs: 50,
    keywords: ['халва', 'халви'],
  },
  {
    label: 'Торт/тістечко',
    protein: 5,
    fat: 23,
    carbs: 50,
    keywords: ['торт', 'тістечк', 'тортик', 'еклер', 'тірамісу', 'чізкейк'],
  },
  {
    label: 'Кекс/мафін/маффін',
    protein: 6,
    fat: 16,
    carbs: 53,
    keywords: ['кекс', 'мафін', 'маффін', 'капкейк'],
  },
  {
    label: 'Пончик/донат',
    protein: 6,
    fat: 22,
    carbs: 47,
    keywords: ['пончик', 'донат', 'пампушк'],
  },
  {
    label: 'Круасан',
    protein: 8,
    fat: 21,
    carbs: 46,
    keywords: ['круасан', 'круасану'],
  },
  {
    label: 'Батончик шоколадний',
    protein: 5,
    fat: 25,
    carbs: 60,
    keywords: [
      'шоколадний батончик',
      'батончик шоколадний',
      'снікерс',
      'снiкерс',
      'марс',
      'твікс',
      'баунті',
    ],
  },
  {
    label: 'Протеїновий батончик',
    protein: 30,
    fat: 12,
    carbs: 40,
    keywords: [
      'протеїновий батончик',
      'протеїнового батончика',
      'білковий батончик',
      'protein bar',
    ],
  },
  {
    label: 'Злаковий/мюслі батончик',
    protein: 7,
    fat: 12,
    carbs: 65,
    keywords: [
      'злаковий батончик',
      'мюслі батончик',
      'батончик мюслі',
      'батончик',
    ],
  },
  {
    label: 'Мюслі/гранола',
    protein: 9,
    fat: 14,
    carbs: 64,
    keywords: ['мюслі', 'гранола', 'граноли'],
  },
  {
    label: 'Протеїн (порошок)',
    protein: 75,
    fat: 6,
    carbs: 10,
    keywords: [
      'протеїн',
      'протеїну',
      'сироватковий',
      'whey',
      'протеїновий порошок',
    ],
  },
  {
    label: 'Козинаки',
    protein: 16,
    fat: 33,
    carbs: 42,
    keywords: ['козинак', 'козинаки'],
  },
  {
    label: 'Попкорн',
    protein: 11,
    fat: 5,
    carbs: 78,
    keywords: ['попкорн', 'попкорну'],
  },
  {
    label: 'Чіпси картопляні',
    protein: 6,
    fat: 30,
    carbs: 53,
    keywords: ['чіпси', 'чіпсів'],
  },
  {
    label: 'Сухарики/крекери солоні',
    protein: 9,
    fat: 12,
    carbs: 67,
    keywords: ['сухарики', 'грінки', 'крекери солоні'],
  },
];

// Ingredients with ~zero macro contribution — recognised so they don't fall to
// the fallback (which would otherwise log a "no match" warning for plain water,
// salt, spices, etc.).
const ZERO_MACRO_KEYWORDS = [
  'вода',
  'води',
  'сіль',
  'соль',
  'перець мелений',
  'перець чорний',
  'спеці',
  'приправ',
  'паприка',
  'куркума',
  'оцет',
  'сода',
  'розпушувач',
  'лавровий',
  'зіра',
  'кмин',
  'чай',
  'кава',
  'дріжджі',
  'ванілін',
  'кориц',
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MacroPer100 {
  protein: number;
  fat: number;
  carbs: number;
}

// Resolve an ingredient name to per-100g macros. Returns null when nothing
// matches AND it isn't a recognised zero-macro item (so the caller can decide
// how to handle the unknown — currently: treat as zero but log in dev).
export function lookupFood(name: string): MacroPer100 | null {
  const n = normalize(name);
  if (!n) return null;

  // Longest keyword first → "куряче філе" wins over generic "сир"/"перець".
  let best: { entry: FoodEntry; len: number } | null = null;
  for (const entry of FOOD_TABLE) {
    for (const kw of entry.keywords) {
      if (n.includes(kw) && (!best || kw.length > best.len)) {
        best = { entry, len: kw.length };
      }
    }
  }
  if (best) {
    return {
      protein: best.entry.protein,
      fat: best.entry.fat,
      carbs: best.entry.carbs,
    };
  }

  // Known zero-macro item (water, salt, spices) → contribute nothing, no warn.
  if (ZERO_MACRO_KEYWORDS.some((kw) => n.includes(kw))) {
    return { protein: 0, fat: 0, carbs: 0 };
  }

  return null;
}

// Cooking changes a dish's eaten weight vs the raw ingredient sum: grains and
// pasta absorb water (weight up), meat/fish lose water (weight down). We use a
// coarse yield factor per dominant category so servingSize reflects the cooked
// portion the user actually eats. This does NOT change macros (mass of protein/
// fat/carbs is conserved), only the gram weight they're spread over.
export function estimateCookingYield(ingredientNames: string[]): number {
  const joined = normalize(ingredientNames.join(' '));
  // Grain/legume-dominant dishes roughly double in weight when boiled.
  if (
    /гречк|рис|пшоно|перлов|булгур|кіноа|сочевиц|квасол|горох|нут|макарон|вівсян|манн/.test(
      joined,
    )
  ) {
    return 1.0; // ingredient weights are already given for the cooked dish in
    // most LLM outputs; keep neutral to avoid double-counting. Hook kept for
    // future tuning if the model starts giving dry weights consistently.
  }
  return 1.0;
}

// Converts (quantity, unit, ingredientName) to grams for macro computation.
// Handles the most common units the LLM uses; unknown units → 0 (ingredient skipped).
function toGrams(quantity: number, unit: string, name: string): number {
  const u = unit.trim().toLowerCase();
  if (u === 'г' || u === 'гр' || u === 'мл') return quantity; // 1 мл ≈ 1 г

  if (u === 'ч.л.' || u === 'ч.л' || u === 'чл') return quantity * 5;
  if (u === 'ст.л.' || u === 'ст.л' || u === 'стл') return quantity * 15;

  if (u === 'шт' || u === 'шт.') {
    const n = normalize(name);
    if (/яйц/.test(n)) return quantity * 55;
    if (/картопл/.test(n)) return quantity * 120;
    if (/морква|буряк/.test(n)) return quantity * 90;
    if (/помідор|томат|огірок|перець/.test(n)) return quantity * 100;
    if (/банан|яблук|груш/.test(n)) return quantity * 150;
    if (/цибул/.test(n)) return quantity * 70;
    if (/часник/.test(n)) return quantity * 5;
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[foodNutrition] toGrams: unknown шт item "${name}", skipping`,
      );
    }
    return 0;
  }

  return 0; // unknown unit — skip ingredient
}

export interface NutritionDetailed {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  // Sum of grams of every ingredient we could convert to grams (toGrams > 0).
  totalGrams: number;
  // Grams of ingredients recognised in FOOD_TABLE or the zero-macro list.
  matchedGrams: number;
}

// Computes macros AND coverage info from an ingredient list. Coverage
// (matchedGrams / totalGrams) lets callers decide whether the deterministic
// result is trustworthy or they should fall back to an estimate.
export function computeNutritionDetailed(
  ingredients: { name: string; quantity: number; unit: string }[],
): NutritionDetailed {
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let totalGrams = 0;
  let matchedGrams = 0;

  for (const ing of ingredients) {
    const grams = toGrams(ing.quantity, ing.unit, ing.name);
    if (grams <= 0) continue;
    totalGrams += grams;

    const macros = lookupFood(ing.name);
    if (!macros) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[foodNutrition] no match for ingredient: "${ing.name}"`);
      }
      continue;
    }
    matchedGrams += grams;
    protein += (macros.protein / 100) * grams;
    fat += (macros.fat / 100) * grams;
    carbs += (macros.carbs / 100) * grams;
  }

  return {
    calories: Math.round(protein * 4 + fat * 9 + carbs * 4),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    totalGrams,
    matchedGrams,
  };
}

// Computes absolute calories + macros for a dish from its ingredient list.
// Thin wrapper over computeNutritionDetailed (kept for existing callers).
export function computeMealNutrition(
  ingredients: { name: string; quantity: number; unit: string }[],
): { calories: number; protein: number; fat: number; carbs: number } {
  const d = computeNutritionDetailed(ingredients);
  return { calories: d.calories, protein: d.protein, fat: d.fat, carbs: d.carbs };
}

// Derives per-100g values from an absolute total and its gram weight.
export function per100FromTotals(
  totals: { calories: number; protein: number; fat: number; carbs: number },
  grams: number,
): NutritionPer100 {
  if (grams <= 0) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const f = 100 / grams;
  return {
    calories: Math.round(totals.calories * f),
    protein: Math.round(totals.protein * f),
    fat: Math.round(totals.fat * f),
    carbs: Math.round(totals.carbs * f),
  };
}

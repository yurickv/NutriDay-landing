# UTM-конвенція NutriDay

Довідник для маркетингу/SMM: як тегувати посилання, щоб аналітика (PostHog + GA4)
коректно розрізняла джерела трафіку у воронці.

**Базовий URL — завжди лендінг:** `https://nutriday.com.ua/`
(весь трафік ведемо на «/», далі користувач іде в onboarding).

**Схема параметрів:**

- `utm_source` — майданчик (звідки прийшов): `instagram` / `partner` / `linkedin` / `tiktok`
- `utm_medium` — тип каналу: `social` (органіка) / `referral` (партнер) / `paid_social` (платна реклама)
- `utm_campaign` — розміщення/кампанія: `bio`, `stories`, `post`, назва партнера тощо
- `utm_content` — деталізація (тема поста, тип банера) — опційно

---

## Instagram (`utm_medium=social`)

| Розміщення  | Посилання                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Bio         | `https://nutriday.com.ua/?utm_source=instagram&utm_medium=social&utm_campaign=bio`                         |
| Stories     | `https://nutriday.com.ua/?utm_source=instagram&utm_medium=social&utm_campaign=stories`                     |
| Reels       | `https://nutriday.com.ua/?utm_source=instagram&utm_medium=social&utm_campaign=reels`                       |
| Пост (feed) | `https://nutriday.com.ua/?utm_source=instagram&utm_medium=social&utm_campaign=post&utm_content=tema-posta` |

## Партнерський сайт (`utm_medium=referral`)

| Розміщення | Посилання                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------- |
| Базовий    | `https://nutriday.com.ua/?utm_source=partner&utm_medium=referral&utm_campaign=nazva-partnera` |

`https://nutriday.com.ua/?utm_source=partner&utm_medium=referral&utm_campaign=gym-adrenalin`

| Банер | `https://nutriday.com.ua/?utm_source=partner&utm_medium=referral&utm_campaign=nazva-partnera&utm_content=banner` |
| Стаття | `https://nutriday.com.ua/?utm_source=partner&utm_medium=referral&utm_campaign=gym-adrenalin&utm_content=article` |

> `nazva-partnera` → слаг конкретного партнера (напр. `fitclub`, `dietolog-anna`).
> Якщо партнерів кілька — кожному свій `utm_campaign`, щоб розрізняти їх у розбивці.

## LinkedIn (`utm_medium=social`)

| Розміщення        | Посилання                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Профіль/bio       | `https://nutriday.com.ua/?utm_source=linkedin&utm_medium=social&utm_campaign=bio`                         |
| Пост              | `https://nutriday.com.ua/?utm_source=linkedin&utm_medium=social&utm_campaign=post&utm_content=tema-posta` |
| Сторінка компанії | `https://nutriday.com.ua/?utm_source=linkedin&utm_medium=social&utm_campaign=company`                     |

## TikTok (`utm_medium=social`)

| Розміщення | Посилання                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Bio        | `https://nutriday.com.ua/?utm_source=tiktok&utm_medium=social&utm_campaign=bio`                          |
| Відео      | `https://nutriday.com.ua/?utm_source=tiktok&utm_medium=social&utm_campaign=video&utm_content=tema-video` |

---

## Правила (щоб аналітика не «поламалась»)

- **Тільки нижній регістр, без пробілів.** Розділяй дефісами: `utm_content=zdorove-harchuvannia`.
  PostHog/GA4 вважають `Instagram` і `instagram` **різними** джерелами.
- **`utm_source` — строго зі списку:** `instagram` / `partner` / `linkedin` / `tiktok`.
  Саме за цим полем іде breakdown воронки.
- **`utm_medium`:** `social` для органіки, `referral` для партнера.
  Для **платної** реклами — `paid_social` (щоб відділити платне від органіки).
- **Без кирилиці у значеннях** — транслітом або англійською (частина клієнтів ламає кирилицю в URL).
- Порядок параметрів не важливий; важливі самі імена й значення.

## Як це працює далі

- **PostHog** автоматично парсить `utm_*` → `$initial_utm_source` (first-touch, на рівні людини)
  - у кожну подію. На стороні застосунку ми ще й дублюємо first-touch у `localStorage`
    (`nd_attribution`) і в запис `users` (`utmSource/Medium/Campaign`) при оплаті.
- **Воронку** розбивай по `utm_source` (Instagram vs partner vs linkedin vs tiktok),
  усередині дриляй по `utm_campaign` / `utm_content`.
- **GA4** визначає джерело сесії з тих самих `utm_*`.

Технічний контекст: `docs/superpowers/specs/2026-06-30-analytics-funnel-tracking-design.md` (§5).

# Контракт API (предложение)

Всё в этом файле — **предложение**: в прототипе API нет. Привязка к экранам и функциям прототипа — в колонке «Кто вызывает».

## 1. Стиль API: REST + SSE + задачи

- **REST** по ресурсам. Домен — CRUD-тяжёлый: клиенты, темы, публикации, баннеры, кампании, факты. Статусы меняются отдельными действиями (`POST /…/{id}/status`, `/schedule`, `/publish`) — так проще проверять права и переходы стейт-машин.
- **Задачи (jobs)** для всего, что дольше ~1 с: генерация, рендер, модерация, импорт из CRM. Ответ на запуск — `202` + `job`. В прототипе это `openBuildModal(title, steps, …)` с шагами — шаги приходят из задачи.
- **SSE** — один поток `GET /api/v1/events` на вкладку: прогресс задач, «печатает…» и потоковый текст чата, новые уведомления, смена статусов. Односторонний поток, работает через прокси, проще WebSocket. Входящие вебхуки от площадок — отдельно (`/webhooks/*`).
- Почему не RPC/GraphQL: публичные эндпоинты для клиента по ссылке и вебхуки всё равно REST; экраны грузят агрегаты (страница клиента, Главная) — для них есть отдельные эндпоинты-«виды».

База: `/api/v1`. Авторизация — cookie-сессия (веб) или `Authorization: Bearer`. Кабинет — из сессии. Деньги — **целые копейки** (`amount_kop`), в UI форматируются. Даты — ISO 8601, `YYYY-MM-DD` для дней; таймзона пользователя из профиля.

## 2. Общие соглашения

**Списки**: `?client=<id>&q=<строка>&status=<код>&sort=new|old|az&cursor=<…>&limit=50` → `{items:[…], next_cursor, counts:{draft:3, check:2, …}}`. `counts` нужны чипам статусов со счётчиками (`.chip .ccnt`). Период — `?period=1|3|6|12` (месяцы, скользящее окно до вчера, `perRange()`), месяц календаря — `?month=2026-11`.

**Текущий клиент**: фронт передаёт `client` явно. «Все клиенты» — без параметра.

**Ошибки**: `{"error":{"code":"…","message":"для человека","details":{…}}}`.

| HTTP | code | Когда | UI в прототипе |
|---|---|---|---|
| 402 | `insufficient_funds` | баланс < цены | `gateOpen('money')` «не хватает X ₽» |
| 409 | `confirmation_required` | цена > `LIMITS.confirm` | `gateOpen('confirm')` |
| 402 | `month_limit_reached` | превышен месячный лимит | (в прототипе не проверяется) |
| 422 | `gaps_present` | принять/опубликовать с `[…]` | `pgGapsBlock()` |
| 422 | `erid_required` | баннеры без erid | `bnSend()` |
| 409 | `invalid_transition` | недопустимый переход статуса | — |
| 409 | `campaign_running` | удалить идущую кампанию / клиента с ней | тост «сначала пауза» |
| 409 | `connection_expired` | публикация, доступ истёк | `fail` «Не вышел» |
| 422 | `client_required` | действие требует клиента | «Для кого делаем?» |
| 423 | `auth_locked` | 3 неверных кода/пароля | «Слишком много попыток» |

**Идемпотентность**: любой POST, который тратит деньги или создаёт сущность, принимает `Idempotency-Key` (UUID на клик). Повтор с тем же ключом возвращает тот же результат и не списывает второй раз.

**Удаление с «Вернуть»**: `DELETE` — мягкое (`deleted_at`), ответ `{undo_token, expires_in:8}`; `POST /undo/{token}` восстанавливает с теми же связями (`delRun/delUndo`). Связанные ссылки (кампания → страница, публикация → тема) обнуляются при удалении и возвращаются при undo. Окончательное удаление — фоновой задачей позже **(предложение: через 24 ч)**.

## 3. Деньги: цена «до N ₽», подтверждение, списание

В прототипе: `spendGate(cost, label, fn)` → при успехе действие → `charge(client, section, act, amount)` пишет в журнал. Цена на кнопке — максимум («до 2,25 ₽»), кнопка цену не показывает, она в подсказке (`uiDecorate`).

Предлагаемый поток:
1. **Котировка**: каждое платное действие имеет `action_code` и цену. `GET /billing/prices` — весь прайс; `POST /billing/quote {action, params}` → `{min_kop, max_kop}` (например, кадры × количество). Фронт показывает в подсказке.
2. **Запуск** платного действия: обычный POST ресурса. Сервер считает `max_kop`:
   - баланс < max → `402 insufficient_funds {need_kop, balance_kop}`;
   - `max > LIMITS.confirm` и в запросе нет `"confirm": true` → `409 confirmation_required {max_kop, threshold_kop, quote_id}`; фронт повторяет с `confirm:true, quote_id`;
   - иначе — **холд** `max_kop` и `202 job`.
3. **Завершение задачи**: списание фактической суммы ≤ холда, остаток холда освобождается, запись в журнал (`section`, `act`, `client`). Неудача по нашей вине или брак (`Не получился`) — холд снимается полностью; пересъёмка брака — 0 ₽.
4. После списания: если баланс < `lowAt` и `low=true` — уведомление `money`; если `auto=true` — автопополнение.

Прайс из прототипа (`BL_PRICES`, `spendGate`-вызовы):

| action_code | Цена | Функция |
|---|---|---|
| `chat.answer` | до 0,82 | `chatSend`, `dockSend` |
| `chat.shot` | до 4,64 | `chatSend(true)`, `chatAct('shot')` |
| `strategy.generate` | 0,82 | `strCreate`, `ikStrat` |
| `plan.generate` | 0,82 × месяцев | `plCreate` |
| `pub.post` / `pub.car` / `pub.story` | 0,82 / 1,64 / 1,20 | `socCreate`, `plMake`, `pqMake`, `psCreate`, `psFromPlan` |
| `pub.clip.storyboard` / `pub.clip.render` | 0,41 / 41,03 | `socCreate('clip')`, `socRender` |
| `pub.edit`, `pub.variant` | 0,41 | `psSend` (часть правок бесплатна), `socVariant` |
| `shot.generate` | 1,47–7,36 за шт (~3,69–7,36) | панель «Фото и видео»; `ipGen` 7,38 |
| `shot.reshoot_bad` | 0 | `reshoot` |
| `video.render` | 12,40–41,03 | `vdCreate` |
| `banners.set` / `banners.variant` | до 1,72 / 0,43 | `bnCreate` |
| `page.build` / `page.rebuild` | 2,25 | `pgCreate`, `pgBuild`, `pgFixGo` |
| `deck.outline` / `deck.build` | 0,31 / 2,63 | `dkCreate`, `dkBuild` |
| `report.monthly`, `report.ads` | 2,63 | `repNow`, `rsReport` |
| `campaign.parse` | 1,73 | `cmCreate` |
| `audiences.parse` | 0,31 | `grCreate` |
| `facts.parse`, `voice.rewrite` | 0,41 | `faParse`, `voAsk` |
| `kit.<id>` | 9,80 | `kitBuild` |
| `starter_kit` | 0,41 + сумма пунктов | `pkGo` (списание по шагам) |

Бесплатно: вопрос «Для кого делаем?», правки руками, статусы, согласования, ответы на пропуски, публикация, подключения.

## 4. Долгие операции

```json
POST /api/v1/clients/c_42/pages
Idempotency-Key: 6f1…
{"brief":"Чекап со скидкой до 30 ноября, с записью","goal":"Запись","brand_images":true,"audience_versions":false,"confirm":false}

202 Accepted
{"job":{"id":"j_901","kind":"page.build","status":"running","steps":["Читаем задачу","Пишем блоки","Сверяем с базой фактов"],"step":0,"progress":0,"hold_kop":225},
 "page":{"id":"pg_77","status":"draft"}}
```

`GET /jobs/{id}` и события SSE:

```
event: job.progress
data: {"id":"j_901","step":1,"progress":45}

event: job.done
data: {"id":"j_901","status":"done","charged_kop":225,"result":{"type":"page","id":"pg_77","status":"check"}}
```

`status`: `queued | running | done | failed | cancelled`; `failed` → `{error, refunded:true}`. Рендер ролика/клипа — не модалка: карточка сразу в сетке со статусом `proc` и прогрессом, по готовности — уведомление `ready` (`vdTick`, `socRender`). Чат: события `chat.typing`, `chat.delta {chat_id, message_id, text}`, `chat.message` (финальный структурированный ответ, см. chat-and-agents.md).

Прочие события: `notification.new`, `entity.updated {type,id,status}` (модерация, публикация, решение клиента по ссылке), `inbox.new`, `balance.changed`.

## 5. Ресурсы

Колонка «Кто вызывает» — экран / функция прототипа.

### Вход и профиль
| Метод | Путь | Кто вызывает |
|---|---|---|
| POST | `/auth/code` `{login}` → `{challenge_id, channel: email\|sms, resend_in:45, registered}` | вход, `authSend` |
| POST | `/auth/code/verify` `{challenge_id, code}` → сессия или `{onboarding_token}` | `authCheck` |
| POST | `/auth/password` `{login, password}` | `authPw` |
| GET | `/auth/yandex/start`, `/auth/yandex/callback` | `authYa` |
| POST | `/auth/onboarding` `{name, cabinet_name, work_type}` | «Давайте знакомиться», `authHello` |
| POST | `/auth/logout` | «Выйти из кабинета» |
| GET/PATCH | `/me` (имя, фамилия, фото, роль, tz, persona) | Профиль, `pfSave`, `personaSet` |
| PUT/DELETE | `/me/password` | `pfPwSave` |
| POST | `/me/contacts/{email\|phone}` → код → `/verify` | `pfContact`, `pfcSend` |
| GET/DELETE | `/me/sessions`, `/me/sessions/{id}`; POST `/me/sessions/revoke-others` | `pfEnd` |
| GET/PUT | `/me/notification-settings` | вкладка «Уведомления» |
| POST | `/me/telegram/link` → ссылка на бота | «Подключить Telegram» |
| POST | `/me/export` → job → архив | `dlMyData` |
| POST/DELETE | `/cabinet/deletion` (14 дней на отмену) | `pfDelete` |

### Команда
| GET | `/cabinet/members` | «Команда и доступы» |
|---|---|---|
| POST | `/cabinet/invites` `{email, role}` | `pfInvite` |
| PATCH/DELETE | `/cabinet/members/{id}` | `pfRole`, `pfDel` (у приглашения — «Отозвать») |

### Клиенты и бренд
| Метод | Путь | Кто вызывает |
|---|---|---|
| GET | `/clients` (с `pending_count` — «ждёт ответа: N») | переключатель клиента `clientMenu` |
| POST | `/clients` `{name, link?}` | `nclGo` → `projAdd` |
| GET/PATCH/DELETE | `/clients/{id}` | страница клиента, `delClient` |
| GET | `/clients/{id}/home` — агрегат: шаги, ждёт клиента, нужно от вас, публикации, темы, стиль, подключения, реклама, автоотчёт | `renderClientHome` |
| POST | `/clients/{id}/intake` `{text, files[], mode: story\|facts\|audiences}` → job → отчёт разбора | `strCreate`, `faParse`, `grCreate`, `ikParse/ikApply` |
| GET | `/clients/{id}/intake/gaps` (цель, аудитории, позиционирование, цены, адрес) | `ikGaps` |
| POST | `/clients/{id}/intake/answers` `{key, value}` | `ikAnswer` |
| GET | `/clients/{id}/gaps` → `[{plate:"[ваша скидка]", count, where:["стратегия","посты"]}]` | `faGaps`, «Чего не хватает» |
| POST | `/clients/{id}/gaps/fill` `{plate, value}` → `{replaced:5, fact_id}` | `faAnswer`, `pgGapFill`, `chqAns` |
| GET/POST/PATCH/DELETE | `/clients/{id}/facts[/{fid}]` `?cat&q` | «База фактов», `faEdit`, `delFact` |
| GET | `/clients/{id}/style`; PUT `/clients/{id}/style/draft` | «Стиль», `stSet` |
| GET | `/clients/{id}/style/impact` | `stImpact` («что перекрасится») |
| POST | `/clients/{id}/style/versions` (сохранить) / `…/versions/{v}/restore` | `stSave`, `stRollback` |
| POST | `/clients/{id}/style/rescan`, `/style/brandbook` (файл), `/style/logo` | `stRescan`, `stBrand` |
| GET | `/clients/{id}/style/tokens?format=css\|json\|figma` | `stTokens` |
| GET/PATCH | `/clients/{id}/voice` (tone, say, sources) | «Голос», `voSay`, `voSrc` |
| POST | `/clients/{id}/voice/rewrite` `{text}` (0,41) | `voAsk` |
| GET/POST/PATCH/DELETE | `/clients/{id}/audiences[/{aid}]` | «Аудитории», `delGroup` |
| POST | `/audiences/{id}/accept`, `/decline` | `grAccept`, `grDecline` |
| POST | `/clients/{id}/audiences/suggest` `{source: site\|crm}` → job | `grSuggestSite`, `grFindCRM` |

### Стратегия и контент-план
| Метод | Путь | Кто вызывает |
|---|---|---|
| GET | `/clients/{id}/strategy` | «Стратегия» |
| POST | `/clients/{id}/strategy/generate` `{text, files, period:3}` (0,82) | `strCreate`, `ikStrat` |
| PATCH/DELETE | `/clients/{id}/strategy` | правка полей, `delStrat` |
| POST | `/clients/{id}/strategy/status` `{to: check\|ok\|draft, send_anyway?}` | `strStatus` (+`sendCheck`) |
| POST | `/clients/{id}/strategy/tune`, `/tune/undo` | `sstTune`, `sstUndo` |
| GET | `/plan-items?client&month&status&q` | «Контент-план», `renderPlan`, `plList` |
| POST | `/clients/{id}/plan/generate` `{text, months:1, per_month:12}` (0,82×мес) | `plCreate` (без стратегии → `422 strategy_required`) |
| PATCH/DELETE | `/plan-items/{id}` (t, idea, facts, img, d, rub) | `plEdit`, `pqEdit`, `plImg`, `delTheme` |
| POST | `/plan-items/{id}/status` `{to}` | `plStatus` |
| POST | `/plan-items/send` `{client, ids?}` (все черновики) | `plSendAll` |
| POST | `/plan-items/{id}/publications` `{type}` | `plMake`, `pqMake`, `psFromPlan` |
| POST | `/plan-items/assemble` `{client, type, ids[]}` | `pqMakeAll` |
| GET | `/plan-items/export?client&format=csv\|docx` | `plExport`, `dlPlanDocx` |

### Публикации
| Метод | Путь | Кто вызывает |
|---|---|---|
| GET | `/publications?type&client&status&q&sort` | вкладки «Посты/Карусели/Сторис/Клипы», `renderSoc`, `psList` |
| POST | `/publications` `{type, client, topic, platforms[], slides?, frames?, duration?, files[]}` | `socCreate`, `psCreate`, `chatAct('post')` |
| GET/PATCH | `/publications/{id}` (text по площадкам, slides, frames, scenes, img, platforms, date/time) | редактор, `socTextEdit`, `socSlideEdit`, `socPlatToggle`, `socImg` |
| POST | `/publications/{id}/messages` `{text}` → правка из чата поста, новая версия | `psSend` → `psParse` |
| GET | `/publications/{id}/versions`; POST `/versions/{n}/restore` | `psVer`, `psRestore` |
| POST | `/publications/{id}/variant` `{platform}` (0,41) | `socVariant` |
| POST | `/publications/{id}/carousel` (1,64) | «карусель из поста» в `psParse` |
| POST | `/publications/{id}/status` `{to: check\|ok\|draft, send_anyway?}` | `socStatus` |
| POST | `/publications/{id}/schedule` `{at}` / `/unschedule` | `socSchedule`, `socScheduleGo` |
| GET | `/publications/{id}/publish-plan` → по площадкам: `auto` / `remind` / `not_connected` / `expired` | `socSplit`, `socPubAsk`, `socSchedNote` |
| POST | `/publications/{id}/publish` | `socPublishNow` → `socPublishGo` |
| POST | `/publications/{id}/retry` | `socRetry` |
| POST | `/publications/{id}/render` (клип, 41,03) | `socRender` |
| GET | `/publications/{id}/export` (тексты, PNG слайдов/сторис, PDF для LinkedIn, MP4 клипа, SRT) | `dlPost`, `dlCarousel`, `dlStory`, `dlClip`, `data-engine="clip-mp4"` |

### Подключения соцсетей и карт клиента
| GET | `/clients/{id}/connections` | «Соцсети и карты клиента», `connPanel` |
|---|---|---|
| POST | `/clients/{id}/connections/{platform}/oauth` `{return_to}` → `{auth_url}` | `connOpen` → `connOauth` |
| GET | `/oauth/{platform}/callback` → список сообществ/карточек | после входа |
| POST | `/clients/{id}/connections/{platform}` `{target_id}` / `{channel}` (Telegram) / `{mode:"remind"}` (TenChat) | `connDone`, `connTg` |
| DELETE | `/clients/{id}/connections/{platform}` | `connOff` |

### Согласование клиентом и бриф
| POST | `/clients/{id}/share-link` → `{url, code}`; DELETE — отозвать | `clientLink` |
|---|---|---|
| GET | `/public/c/{code}` → карточки `cvPending` (стратегия, темы, публикации, страницы, вопросы), пропуски → «уточняем»; `410` если отозвана | экран `#cv` |
| POST | `/public/c/{code}/decisions` `{item, decision: approve\|changes, comment}` | `cvOk`, `cvFixGo` |
| DELETE | `/public/c/{code}/decisions/{item}` | `cvUndo` |
| POST | `/public/c/{code}/brief` `{answers:{…}}` | `cvBriefGo` |
| POST | `/clients/{id}/brief` (создать вопросы из пропусков) | `briefSend` |

### Фото и видео
| GET | `/series?client`, `/shots?client&status&q` | «Фото и видео», `renderShots` |
|---|---|---|
| POST | `/clients/{id}/shots/generate` `{prompt, subject, format, count, quality, auto_plots}` | панель создания кадров |
| POST | `/shots/{id}/accept`, `/reshoot {comment}`; DELETE | `acceptShot`, `reshoot`, `delShot` |
| POST | `/uploads` → presigned URL; `/clients/{id}/shots/own` `{file_ids}` | `openUploadModal`, `ipUp` |
| GET/POST | `/videos`; POST `/videos {first_shot, mode, duration, formats, prompt}` | `vdCreate` |
| POST | `/videos/{id}/accept`, `/redo`; GET `/videos/{id}/files` | `vdAccept`, `vdRedo`, `vdDl` |

### Баннеры, страницы, презентации, шаблоны
| POST | `/banner-sets` `{client, text, background, goal}`; PATCH (vars, bg, off, erid, adv) | `bnCreate`, `bnEdit`, `bnSetBg`, `bnToggleFmt` |
|---|---|---|
| POST | `/banner-sets/{id}/variants`, `/moderation`, `/fix`; GET `/export.zip` | `bnAddVar`, `bnSend`, `bnFix`, `bnZip` |
| POST | `/pages` `{client, brief, goal, brand_images, audience_versions}` | `pgCreate` |
| POST | `/pages/{id}/build`, `/rebuild {comment}`, `/accept`, `/send`, `/client-approved`, `/publish` | `pgBuild`, `pgFixGo`, `pgAccept`, `pgSend`, `pgClientOk`, `pgPublish` |
| GET | `/pages/{id}/export.html`; `/clients/{id}/site` (домен, проверки) | `dlLanding`, `SITES` |
| POST | `/decks` `{client, type, slides_count, text, files}` → план | `dkCreate` |
| PATCH | `/decks/{id}` (outline, slides) ; POST `/replan`, `/build` | `olMove/olDel/olAdd`, `dkReplan`, `dkBuild` |
| POST/GET | `/decks/{id}/share` (настройки), `/share/stats` | `dkShare` |
| GET | `/decks/{id}/export?format=pptx\|pdf`; публично `/public/d/{code}` + POST `/public/d/{code}/views` | `dkExport` |
| GET | `/templates?type&client`; POST `/templates` (свой из работы); POST `/templates/{id}/apply {client}`; POST `/templates/{id}/kit {client}`; DELETE | `renderTpls`, `tplSave`, `tplUse`, `kitBuild` |

### Реклама и результаты
| POST | `/campaigns/parse` `{client, text, suggest_mix}` → черновик кампании | `cmCreate` |
|---|---|---|
| GET/PATCH/DELETE | `/campaigns[/{id}]` | `renderCamps`, `openCamp`, `delCamp` |
| POST | `/campaigns/{id}/launch`, `/pause`, `/resume` | `cmLaunch`, `cmPause` |
| GET | `/campaigns/{id}/utm` | `utmLinks` |
| PUT | `/campaigns/{id}/days/{date}` `{spend_kop, clicks, leads}` | `enSave` (`422` если заявок > кликов) |
| GET | `/results/ads?client&period` → kpi, ряды, сравнение (только если честное), источники | `renderResult` |
| GET | `/results/social?client&period` → охват, реакции на 1000, рубрики, площадки, топ, «кто реагирует» | `rsSocRender`, `sstCalc` |
| GET | `/signals?client` (не внесено, рост цены заявки, бюджет кончится раньше, кампания на паузе дешевле) | `campSignals`, `resultInsights` |
| POST | `/crm-reconciliations` (файл) → `{matched, revenue, disputed[]}`; PATCH `/disputed/{i}` `{accept}` | `crmOpen`, `crmRun`, `crmDis` |
| POST | `/results/ads/report` `{client, period}` → колода | `rsReport` |
| POST | `/clients/{id}/reports/monthly` → колода; PATCH `/clients/{id}` `{auto_report}`; POST `/decks/{id}/send` | `repNow`, `repToggle`, `repSend` |

### Входящие, финансы, оплата
| GET | `/inbox?client&filter=new\|done\|rev\|q\|bad\|ok` | «Входящие», `ibList` |
|---|---|---|
| GET | `/inbox/{id}` (с `draft`, `gaps`, `can_send_via_api`) ; POST `/draft/regenerate` | `ibView`, `ibDraft`, `ibAlt` |
| POST | `/inbox/{id}/reply` `{text}` (`422 gaps_present`) | `ibSend` |
| POST | `/inbox/{id}/hide`, `/unhide`; PATCH `{tag}` | `ibHide`, «Это не спам» |
| GET | `/clients/{id}/ratings` | рейтинг карточек над списком |
| GET | `/finance?client` (поступит, расходы, маржа, касса на 8 недель, клиенты, затраты, сезонность) | `renderFin`, `finCash` |
| PUT | `/finance/manual` `{cash_kop, salaries_kop, rent_kop}` | `finManualGo` |
| GET/POST/DELETE | `/finance/crm[/{crm}]`; POST `/oauth`, `/mapping {pipeline, paid_stage, amount_field, date_field}`; POST `/finance/sync` | `finConnect`, `finAuth`, `finMap`, `finDone`, `finOff`, `finSync` |
| POST | `/finance/clients/{id}/remind` | «Напомнить» о просрочке |
| GET | `/billing/balance` (баланс, средний расход, «хватит на ~N постов») | `balMeter`, `renderBilling` |
| GET | `/billing/journal?client&section&period&cursor`; `/journal.csv` | `renderJournal`, `dlJournal` |
| POST | `/billing/topups` `{amount_kop, method: card\|invoice}` → `{payment_url}` / счёт | `blPay` |
| GET/PUT | `/billing/limits` | лимиты |
| GET | `/billing/documents`, `/billing/documents/{id}` | `data-engine="billing-doc"` |
| GET/PATCH | `/billing/requisites` | «Реквизиты компании» |

### Чаты, стартовый набор, уведомления, напоминания
| GET/POST | `/chats?client&q`; POST `/chats {client?}` | «Чаты», `chatNew` |
|---|---|---|
| GET/DELETE | `/chats/{id}` ; `/chats/cabinet` (общий чат колонки) | `chatOpen`, `dockChat`, `delChat` |
| POST | `/chats/{id}/messages` `{text, files, agent, screen, context[], intent?}` → SSE | `chatSend`, `dockSend`, `hcSend` |
| POST | `/chats/{id}/messages/{mid}/answers` `{label, value\|skip}` | `chqAns` |
| POST | `/chats/{id}/messages/{mid}/actions/{kind}` (plan, post, banners, page, shot) | `chatAct`, `dockAct` |
| PATCH | `/chats/{id}` `{client, general}` | `chatPick`, `chatSetProj` |
| POST | `/starter-kits` `{client?, text, files, pick}`; GET; POST `/{id}/messages`; POST `/{id}/conflicts/{i}` | `pkStart`, `pkGo`, `pkSend`, `pkConf` |
| GET | `/notifications?client` ; POST `/notifications/read {ids\|all}` | колокольчик, `ntfGo`, `ntfAll` |
| GET | `/reminders?client` ; POST `/reminders/{key}/snooze`, `/done` | `renderToday`, меню «⋯» |
| GET | `/onboarding` (4 шага) | `renderOnboard` |

## 6. Пример: решение клиента по ссылке

```json
POST /api/v1/public/c/k7q2ma/decisions
{"item":"publication:sp2","decision":"changes","comment":"Убрать цену, добавить адрес второго филиала"}

200 {"item":"publication:sp2","status":"draft","decided":3,"total":5}
```
Сервер: `SOC.st=draft`, `fb=comment`, `cl=fix`; уведомление `fix` маркетологу; напоминание «Клиент просит правки» первым; событие `entity.updated` в SSE.

## 7. Вебхуки (входящие)

`/webhooks/vk` (Callback API: новые комментарии, сообщения), `/webhooks/telegram` (бот: посты в канале, комментарии в обсуждении, привязка для уведомлений), `/webhooks/payments`, `/webhooks/amocrm`, `/webhooks/bitrix24`. Подписи проверяются, обработка — через очередь, идемпотентно по id события.

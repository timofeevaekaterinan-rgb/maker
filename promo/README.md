# Промо-ролик Maker

`maker-promo.mp4` — 20 с, 1920×1080, 30 к/с, музыка без голоса. Постер — `poster.jpg`. Подключён к кнопкам «Смотреть видео» в `../landing.html`.

- `scene.html` — весь ролик кодом: `render(t)` рисует кадр на любую секунду. Открыть через сервер `maker` (порт 8934): `/promo/scene.html` — играет по кругу, `?t=12.3` — заморозить кадр.
- `ui/` — снимки настоящих экранов прототипа (Главная, Контент-план, Стиль, Голос, Баннеры, Главная на телефоне).
- `music.py` — саундтрек, синтез кодом (120 BPM, F#m–D–A–E), эффекты привязаны к таймлайну сцены → `music.wav`.
- `render.js` — покадровая запись: `npm i puppeteer-core@23`, потом `node render.js frames frames 30`.

Пересборка:
```
python3 music.py
node render.js frames frames 30
ffmpeg -framerate 30 -i frames/f%04d.jpg -i music.wav -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart maker-promo.mp4
```

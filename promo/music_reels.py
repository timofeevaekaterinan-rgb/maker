"""Саундтрек Reels Maker: 15 с, 120 BPM, без голоса. Инструменты — из music.py.
Эффекты привязаны к таймлайну reels.html. Запуск: python3 music_reels.py → music_reels.wav.
"""
import numpy as np, wave, os
import music as m
from music import SR, BEAT, tt, flt, kick, hat, clap, pluck, bassnote, padchord, tick, whoosh, impact, chime, reverb

DUR = 15.0
N = int(SR * DUR)
def buf(): return np.zeros(N)
def add(dst, x, at, g=1.0):
    i = int(at * SR)
    if i >= N: return
    x = x[: N - i]; dst[i:i + len(x)] += x * g
def thump():  # «бум» под гигантские буквы и круг
    t = tt(.5); f = 40 + 70 * np.exp(-t * 20); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6)

# Am – F – C – G, такт = 2 с
CH = [([57, 60, 64], 45), ([53, 57, 60], 41), ([60, 64, 67], 48), ([55, 59, 62], 43)]
PAUSES = [(4.0, 5.0), (9.0, 10.0), (14.0, 15.0)]   # панчлайны в скобках — ударные молчат
def quiet(t): return any(a <= t < b for a, b in PAUSES)

drums, bass, pad, keys, fx = buf(), buf(), buf(), buf(), buf()

for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if quiet(t): continue
    add(drums, kick(), t, .95)
    if b % 2 == 1: add(drums, clap(), t, .5)
    for s in (.125, .25, .375): add(drums, hat(), t + s, .16 if s == .25 else .08)
for bar in range(int(DUR // 2) + 1):
    t0 = bar * 2.0; notes, root = CH[bar % 4]
    for e in range(8):
        t = t0 + e * .25
        if t < DUR and not quiet(t): add(bass, bassnote(root + (12 if e % 2 else 0), .2), t, .5)
    add(pad, padchord(notes, 2.0), t0, .3)

# стикеры: свист → удар
for at in (.5, 5.5):
    add(fx, whoosh(.35), at - .3, .45); add(fx, impact()[:int(SR * .5)], at, .5)
    for i, n in enumerate([69, 72, 76, 81]): add(keys, pluck(n, .3), at + i * .06, .25)
# набор текста
for i in range(3): add(fx, tick(), 2.0 + i * .22 / 3, .55)          # «Нет»
for i in range(4): add(fx, tick(), 7.0 + i * .22 / 4, .55)          # «Пост»
for i in range(11): add(fx, tick(), 12.95 + i * .6 / 11, .5)        # trymaker.ru
# гигантские буквы и круг
for at in (2.5, 3.0, 7.5, 8.0): add(fx, thump(), at, .6)
# слова — плаки по долям
for at, n in [(0, 69), (3.5, 76), (5.0, 72), (8.5, 79), (11.5, 76), (12.0, 81)]: add(keys, pluck(n, .4), at, .4)
# панчлайны: один удар и хвост
for a, _ in PAUSES[:2]: add(fx, impact(), a, .35); add(keys, pluck(57, 1.0), a, .3)
# шлейф карточек
add(fx, whoosh(.8), 9.8, .4)
for i in range(8): add(keys, pluck([69, 72, 76, 79, 81, 84, 88, 91][i], .25), 10.0 + i * .125, .2)
# логотип
add(fx, impact(), 12.5, .7); add(fx, chime([69, 76, 81, 84]), 12.55, .3)
add(fx, chime([64, 69, 72, 76]), 14.0, .25)

duck = np.ones(N)
for b in range(int(DUR / BEAT)):
    s = b * BEAT
    if not quiet(s):
        i = int(s * SR); L = int(.16 * SR); duck[i:i + L] = np.minimum(duck[i:i + L], .45 + .55 * np.linspace(0, 1, L))
mus = reverb(pad * duck, .25) + reverb(keys, .3) + bass * duck ** .5 + drums + reverb(fx, .2)
tA = np.arange(N) / SR
mus *= np.clip((DUR - tA) / .3, 0, 1)
mus = np.tanh(mus * 1.4); mus = flt(mus, 30, 'high'); mus /= np.abs(mus).max() / .89
st = np.stack([mus, np.roll(mus, int(.0007 * SR))], 1)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music_reels.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print(out)

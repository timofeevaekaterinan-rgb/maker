"""Саундтрек промо-ролика Maker: 20 с, 120 BPM, без голоса.
Всё синтезировано кодом (нет вопросов с правами). Эффекты привязаны к таймлайну scene.html.
Запуск: python3 music.py  →  music.wav рядом.
"""
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
import wave, os

SR = 44100
DUR = 20.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

def buf(): return np.zeros(N)
def tt(d): return np.arange(int(SR * d)) / SR
def add(dst, x, at, g=1.0):
    i = int(at * SR)
    if i >= N: return
    x = x[: N - i]
    dst[i:i + len(x)] += x * g
def flt(x, f, kind='low', order=2):
    if kind == 'band':
        b, a = butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype='band')
    else:
        b, a = butter(order, f / (SR / 2), btype=kind)
    return lfilter(b, a, x)
def hz(n):  # midi → Гц
    return 440 * 2 ** ((n - 69) / 12)
def saw(f, d):
    t = tt(d); return 2 * ((t * f) % 1) - 1

# ---------- инструменты ----------
def kick():
    t = tt(.4); f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + .25 * np.sin(ph * 2) * np.exp(-t * 30)
def hat(open_=False):
    d = .18 if open_ else .05
    t = tt(d); return flt(rng.standard_normal(len(t)), 7000, 'high') * np.exp(-t * (18 if open_ else 70))
def clap():
    t = tt(.25); n = rng.standard_normal(len(t))
    env = np.exp(-t * 22) + .6 * np.exp(-np.maximum(t - .012, 0) * 40) * (t > .012) + .5 * np.exp(-np.maximum(t - .024, 0) * 30) * (t > .024)
    return flt(n, (900, 3200), 'band') * env
def pluck(n, d=.35):
    t = tt(d); f = hz(n)
    x = .6 * np.sign(np.sin(2 * np.pi * f * t)) + .4 * np.sin(2 * np.pi * f * 2 * t)
    return flt(x, 2600) * np.exp(-t * 9)
def bassnote(n, d):
    t = tt(d); x = saw(hz(n), d) + .5 * saw(hz(n) * 1.004, d)
    return flt(x, 520, order=3) * np.minimum(1, t * 200) * np.exp(-t * 3)
def padchord(notes, d):
    t = tt(d); x = sum(saw(hz(n) * (1 + dt), d) for n in notes for dt in (-.003, 0, .003))
    x = flt(x / (len(notes) * 3), 1600, order=2)
    return x * np.minimum(1, t / .25) * np.minimum(1, (d - t) / .3)
def tick():   # клавиша
    t = tt(.03); return (flt(rng.standard_normal(len(t)), 2500, 'high') * np.exp(-t * 260) + .4 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 200))
def uiclick():
    t = tt(.08); return np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 60) + .5 * tick()[:len(t)] if len(tick()) >= len(t) else np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 60)
def whoosh(d, up=True):
    t = tt(d); n = rng.standard_normal(len(t)); p = t / d
    lo, hi = flt(n, 700), flt(n, 2500, 'high')
    mix = lo * (1 - p) + hi * p if up else lo * p + hi * (1 - p)
    return mix * np.sin(np.pi * p) ** 2
def riser(d):
    t = tt(d); p = t / d
    f = 180 * (6 ** p); ph = 2 * np.pi * np.cumsum(f) / SR
    return (.35 * np.sin(ph) + .6 * flt(rng.standard_normal(len(t)), 3000, 'high') * p) * p ** 2
def impact():
    t = tt(2.2); f = 38 + 60 * np.exp(-t * 9); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 2.2) + .5 * flt(rng.standard_normal(len(t)), 1800) * np.exp(-t * 6)
def chime(notes):
    out = np.zeros(int(SR * 1.4))
    for i, n in enumerate(notes):
        t = tt(1.4 - i * .06); x = (np.sin(2 * np.pi * hz(n) * t) + .3 * np.sin(2 * np.pi * hz(n) * 3 * t)) * np.exp(-t * 3.5)
        o = int(i * .06 * SR); x = x[:len(out) - o]; out[o:o + len(x)] += x
    return out
def reverb(x, wet=.22, d=1.6):
    t = tt(d); ir = rng.standard_normal(len(t)) * np.exp(-t * 4.2); ir = flt(ir, 5000)
    ir /= np.sqrt((ir ** 2).sum())
    return x + wet * fftconvolve(x, ir)[:len(x)]

# ---------- гармония: F#m – D – A – E, такт = 2 с ----------
CH = [([54, 57, 61], 42), ([50, 54, 57], 38), ([57, 61, 64], 45), ([52, 56, 59], 40)]
def chord(bar): return CH[bar % 4]

drums, bass, pad, keys, fx = buf(), buf(), buf(), buf(), buf()

DRUMS_OFF = (14.5, 17.5)   # пауза ударных под логотип
def drums_on(t): return not (DRUMS_OFF[0] <= t < DRUMS_OFF[1])

for b in range(40):
    t = b * BEAT; bar = b // 4
    if not drums_on(t): continue
    add(drums, kick(), t, .95 if t >= 2 else .7)
    if t >= 2:
        add(drums, hat(), t + .25, .22)
        if b % 2 == 1: add(drums, clap(), t, .45)
    if t >= 4.5 and t < 13:
        add(drums, hat(), t + .125, .1); add(drums, hat(), t + .375, .1)
    if b % 8 == 7 and t >= 2: add(drums, hat(True), t + .25, .18)
# дробь клапов перед логотипом
for i in range(8): add(drums, clap(), 14.0 + i * .0625, .18 + i * .04)

for bar in range(10):
    t0 = bar * 2; notes, root = chord(bar)
    if DRUMS_OFF[0] <= t0 < DRUMS_OFF[1]: continue
    if t0 >= 2:
        for e in range(8):
            if e in (0, 3, 6) or t0 >= 4.5:
                add(bass, bassnote(root + (12 if e % 4 == 2 else 0), .24), t0 + e * .25, .55)
    add(pad, padchord(notes, 2.0), t0, .5 if t0 >= 4 else .35)
# долгий аккорд под логотип
add(pad, padchord([54, 57, 61, 66], 3.2), 14.5, .6)

# плаки на слова 0–2 с и 7–9 с, арпеджио 9–13 с
for b, n in enumerate([66, 69, 73, 78]): add(keys, pluck(n, .45), b * BEAT, .45)
for b, n in enumerate([69, 73, 76, 81]): add(keys, pluck(n, .4), 7 + b * BEAT, .4)
for i in range(32):
    t = 9 + i * .125; notes, _ = chord(int(t // 2))
    add(keys, pluck(notes[i % 3] + 12, .2), t, .16)

# эффекты по таймлайну сцены
for i in range(9): add(fx, tick(), 3.05 + i * .7 / 9, .5)          # «Одна идея»
add(fx, whoosh(.55), 3.95, .5)                                       # росчерк
add(fx, impact()[:int(SR * .6)], 4.5, .35)                           # стопка
add(fx, whoosh(.35, False), 5.45, .3); add(fx, whoosh(.4), 5.95, .3) # телефон → ноутбук
for i in range(5): add(fx, tick(), 9.02 + i * .45 / 5, .5)          # «Стиль»
add(fx, uiclick(), 10.5, .5)                                         # клик по цвету
for i in range(12): add(fx, tick(), 11.15 + i * .05, .14)           # ползунок
for i in range(4): add(fx, whoosh(.3), 11.95 + i * .08, .18)         # сетка
add(fx, riser(1.5), 13.0, .45)                                       # к логотипу
add(fx, impact(), 14.5, .8)
for i in range(11): add(fx, tick(), 15.1 + i * .7 / 11, .5)         # trymaker.ru
add(fx, chime([73, 78, 81, 85]), 16.0, .25)                          # кнопка
add(fx, whoosh(.6), 17.0, .45)                                       # облако возвращается
add(fx, chime([66, 69, 73, 78]), 18.0, .2)                           # логотип maker

# ---------- сведение ----------
t_all = np.arange(N) / SR
# вступление: пэд и плаки открываются фильтром
duck = np.ones(N)
for b in range(40):
    s = b * BEAT
    if drums_on(s):
        i = int(s * SR); L = int(.18 * SR); duck[i:i + L] = np.minimum(duck[i:i + L], .45 + .55 * np.linspace(0, 1, L))
mus = reverb(pad * duck, .25) + reverb(keys, .3) + bass * duck ** .5 + drums
mus = mus + reverb(fx, .2)
intro = np.clip(t_all / 1.5, 0, 1)
lo = flt(mus, 900); mus = lo * (1 - intro) + mus * intro                 # фильтр открывается за 1,5 с
mus *= np.clip((DUR - t_all) / .25, 0, 1)                                # хвост
mus = np.tanh(mus * 1.4)
mus = flt(mus, 30, 'high')
mus /= np.abs(mus).max() / .89
st = np.stack([mus, np.roll(mus, int(.0007 * SR))], 1)                   # чуть стерео
pcm = (st * 32767).astype(np.int16)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(out)

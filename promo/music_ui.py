"""Саундтрек ролика с интерфейсом (ui-reel.html): 15 с, 120 BPM, без голоса. Инструменты — из music.py.
Удары на склейках, тишина и подъём перед вспышкой (9,5–10,4 с), акцент на логотипе. Запуск: python3 music_ui.py → music_ui.wav.
"""
import numpy as np, wave, os
import music as m
from music import SR, BEAT, tt, flt, kick, hat, clap, pluck, bassnote, padchord, tick, whoosh, impact, chime, reverb

DUR = 15.0
N = int(SR * DUR)
def buf(): return np.zeros(N)
def add(dst, x, at, g=1.0):
    i = int(at * SR)
    if i >= N or i < 0: return
    x = x[: N - i]; dst[i:i + len(x)] += x * g
def riser(d):
    t = tt(d); f = 200 + 1800 * (t / d) ** 2; ph = 2 * np.pi * np.cumsum(f) / SR
    nz = np.random.default_rng(3).standard_normal(len(t))
    return (np.sin(ph) * .4 + flt(nz, 2000, 'high') * .5) * (t / d) ** 2
def sub(d=1.2):
    t = tt(d); f = 55 * np.exp(-t * .8); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 2.2)

CH = [([54, 57, 61], 42), ([50, 54, 57], 38), ([57, 61, 64], 45), ([52, 56, 59], 40)]   # F#m D A E
QUIET = [(9.5, 10.4), (14.2, 15.0)]
def quiet(t): return any(a <= t < b for a, b in QUIET)

drums, bass, pad, keys, fx = buf(), buf(), buf(), buf(), buf()
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if quiet(t) or t < 1.0: continue
    add(drums, kick(), t, .9)
    if b % 2 == 1: add(drums, clap(), t, .45)
    for s in (.125, .25, .375): add(drums, hat(), t + s, .14 if s == .25 else .07)
for bar in range(int(DUR // 2) + 1):
    t0 = bar * 2.0; notes, root = CH[bar % 4]
    for e in range(8):
        t = t0 + e * .25
        if t < DUR and not quiet(t) and t >= 1.0: add(bass, bassnote(root + (12 if e % 2 else 0), .2), t, .45)
    add(pad, padchord(notes, 2.0), t0, .32)

# печать по словам в начале
for at in (0.35, 0.75, 1.35, 1.67, 1.99, 2.31):
    for i in range(3): add(fx, tick(), at + i * .045, .5)
# склейки: свист перед, удар на
for at in (3.0, 4.0, 5.0, 6.5, 7.5, 8.5):
    add(fx, whoosh(.25), at - .22, .35); add(fx, impact()[:int(SR * .35)], at, .38)
for at in (5.0, 5.5, 6.0): add(keys, pluck(69 + (at - 5) * 6, .3), at, .3)          # план · посты · баннеры
for i, n in enumerate([64, 66, 69, 71, 73, 76, 78]): add(keys, pluck(n, .22), 8.5 + i * .07, .22)  # график растёт
# тишина → подъём → вспышка
add(fx, riser(.9), 9.5, .55); add(fx, sub(1.4), 10.4, .8); add(fx, impact(), 10.4, .45); add(fx, chime([66, 73, 78, 85]), 10.45, .25)
add(fx, impact(), 11.0, .5)
# логотип: полоса и акцент
add(fx, whoosh(.7), 12.5, .5); add(fx, impact(), 13.25, .65); add(fx, chime([69, 76, 81, 88]), 13.3, .32)
add(fx, chime([66, 73, 78, 81]), 14.05, .22)

duck = np.ones(N)
for b in range(int(DUR / BEAT)):
    s = b * BEAT
    if not quiet(s):
        i = int(s * SR); L = int(.16 * SR); duck[i:i + L] = np.minimum(duck[i:i + L], .45 + .55 * np.linspace(0, 1, L))
mus = reverb(pad * duck, .25) + reverb(keys, .3) + bass * duck ** .5 + drums + reverb(fx, .2)
tA = np.arange(N) / SR
mus *= np.clip(tA / .25, 0, 1) * np.clip((DUR - tA) / .6, 0, 1)
mus = np.tanh(mus * 1.4); mus = flt(mus, 30, 'high'); mus /= np.abs(mus).max() / .89
st = np.stack([mus, np.roll(mus, int(.0007 * SR))], 1)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music_ui.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print(out)

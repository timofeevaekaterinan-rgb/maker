# -*- coding: utf-8 -*-
# Типографика слайдов: предлоги и союзы не висят в конце строки, тире не переносится, число держится за слово.
# python3 typo.py deck.html b2b.html
import re, sys
SHORT=r'(?:в|во|и|с|со|к|ко|у|о|об|а|я|на|за|по|из|от|до|не|ни|но|да|для|без|под|над|при|про|что|как|или|же|чем|это|вы|мы|он|его|её|их|все|всё)'
NB=' '
def fix(t):
    for _ in range(3):
        t=re.sub(r'(^|[\s («"—])('+SHORT+r') (?=\S)', lambda m:m.group(1)+m.group(2)+NB, t, flags=re.I)
    t=re.sub(r' —', NB+'—', t)
    t=re.sub(r'(\d) (?=[А-Яа-яЁё])', r'\1'+NB, t)
    return t
for p in sys.argv[1:]:
    s=open(p,encoding='utf-8').read()
    head,body=s.split('<body>',1)
    parts=re.split(r'(<[^>]+>)', body)
    parts=[x if x.startswith('<') or not x.strip() else fix(x) for x in parts]
    open(p,'w',encoding='utf-8').write(head+'<body>'+''.join(parts))
    print(p,'ok')

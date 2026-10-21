from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from html.parser import HTMLParser
import re
import sys
from html import escape

root = Path(__file__).resolve().parents[1]
source = next((root / 'doc').glob('Рабочая*.docx'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(source) as archive:
    xml = ET.fromstring(archive.read('word/document.xml'))
    paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', ns)).strip()
                  for p in xml.findall('.//w:body//w:p', ns)]
paragraphs = [p for p in paragraphs if p]

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, value):
        self.parts.append(value)

def plain(html):
    parser = Text()
    parser.feed(html)
    return ' '.join(' '.join(parser.parts).split())

def norm(text):
    return ' '.join(text.split())

html = (root / 'index.html').read_text(encoding='utf-8')
bio_pattern = r'(<h[34]>([^<]+)</h[34]>\s*<p>)(.*?)(</p>)'
def source_bio(name, moderator=False):
    matches = [p.split(',', 1)[1].strip() for p in paragraphs if p.startswith(name + ',')]
    return (matches[-1] if moderator else matches[0]) if matches else None
if '--fix-bios' in sys.argv:
    vip_start = html.index('<details class="program-item" id="program-vip">')
    def align(match):
        expected = source_bio(match[2], match.start() >= vip_start and match[2] == 'Евгений Бойченко')
        return match[1] + escape(expected) + match[4] if expected else match[0]
    html = re.sub(bio_pattern, align, html, flags=re.S)
    (root / 'index.html').write_text(html, encoding='utf-8')
slots = [('09:00', '10:00', 'Аналитика', 'analytics'), ('10:30', '12:00', 'Экономика', 'economics'),
         ('12:30', '14:00', 'Маркетинг', 'marketing'), ('15:00', '16:30', 'Кадры', 'team'),
         ('17:00', '18:30', 'Стратегия управления', 'management'), ('19:00', '20:00', 'ВИП-сессия', 'vip')]
positions = [next(i for i,p in enumerate(paragraphs) if p.startswith(start) and label in p and '|' not in p)
             for start, end, label, key in slots]
print('Источник:', source.name)
failures = []
count = 0
for number, (start, end, label, key) in enumerate(slots):
    section = paragraphs[positions[number]+1:positions[number+1] if number < 5 else len(paragraphs)]
    title_end = next(i for i,p in enumerate(section) if ('|' in p if key != 'vip' else p.startswith('Сессия будет')))
    speaker_start = next(i for i,p in enumerate(section) if p in ('Спикер:', 'Планируемый спикер:', 'Приглашенный гость, спикер:'))
    expected = [norm(p) for p in section[title_end:speaker_start]]
    block = re.search(r'<details class="program-item" id="program-' + key + r'">(.*?)</details>', html, re.S).group(1)
    head = re.search(r'<summary>(.*?)</summary>', block, re.S).group(1)
    title = plain(re.search(r'<strong>(.*?)</strong>', head, re.S).group(1))
    if title != norm(' '.join(section[:title_end])): failures.append(key + ': заголовок')
    if plain(re.search(r'<span class="program-time">(.*?)</span></span>', head, re.S).group(1)) != start + ' ' + end:
        failures.append(key + ': время')
    body = block.split('<div class="program-body">',1)[1].split('<div class="program-speakers">',1)[0]
    actual = [plain(m[1]) for m in re.findall(r'<(h3|li|p)\b[^>]*>(.*?)</\1>', body, re.S)]
    if actual != expected:
        failures.append(key + ': содержание')
        print('Не совпали:', [p for p in expected if p not in actual])
        print('Лишние:', [p for p in actual if p not in expected])
    schedule = re.search(r'data-program="program-' + key + r'">(.*?)</a>', html, re.S).group(1)
    if plain(re.search(r'<strong>(.*?)</strong>', schedule, re.S).group(1)) != title: failures.append(key + ': сетка')
    if plain(re.search(r'<span>(.*?)</span>', schedule, re.S).group(1)) != start+'–'+end+' · '+label: failures.append(key + ': время в сетке')
    count += len(expected)
    print(label + ': ' + str(len(expected)) + ' абзацев/пунктов сверено')
assert not failures, failures
print('PASS: 6 заголовков, 6 интервалов в программе и сетке,', count, 'абзацев/пунктов — точное совпадение, кроме пробелов.')
vip_start = html.index('<details class="program-item" id="program-vip">')
bios = 0
for match in re.finditer(bio_pattern, html, re.S):
    expected = source_bio(match[2], match.start() >= vip_start and match[2] == 'Евгений Бойченко')
    if expected:
        assert plain(match[3]) == norm(expected), 'Должность/описание: ' + match[2]
        bios += 1
print('PASS: описания спикеров:', bios)
schedule_block = re.search(r'<section class="schedule content".*?</section>', html, re.S).group(0)
for paragraph in paragraphs:
    if re.match(r'^\d{2}:\d{2}', paragraph) and any(word in paragraph for word in ['Перерыв', 'Обед', 'Регистрация']):
        normalized = lambda s: norm(s).replace('–', '-').lower()
        assert normalized(paragraph) in normalized(plain(schedule_block)), paragraph
print('PASS: регистрация и все перерывы. Уточнения пользователя: Магерова — спикер; кадровый спикер на согласовании; фото Фомина — заглушка.')

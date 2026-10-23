"""Check the redesigned agenda against Word, independently of the old page."""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from html.parser import HTMLParser
import re
import sys

root = Path(__file__).resolve().parents[1]
source = next((root / 'Doc231026').glob('Рабочая*.docx'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(source) as archive:
    xml = ET.fromstring(archive.read('word/document.xml'))
paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', ns)).strip() for p in xml.findall('.//w:body//w:p', ns)]
paragraphs = [p for p in paragraphs if p]
class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
def plain(value):
    parser = Text()
    parser.feed(value)
    return ' '.join(' '.join(parser.parts).split())
def norm(value):
    return ' '.join(value.split())

html = (root / ('index.html' if '--root' in sys.argv else 'redesign/index.html')).read_text(encoding='utf-8')
agenda = re.search(r'<section class="club-program".*?</section>', html, re.S).group(0)
slots = [('analytics', '09:00', '09:45', 'Аналитика'), ('economics', '10:00', '11:30', 'Экономика'), ('marketing', '12:00', '13:30', 'Маркетинг'), ('team', '14:30', '16:00', 'Кадры'), ('management', '16:30', '18:00', 'Стратегия управления')]
count = 0
for key, start, end, label in slots:
    pos = next(i for i, p in enumerate(paragraphs) if p.startswith(start) and p.endswith(label) and '|' not in p)
    section = paragraphs[pos + 1:]
    title_end = next(i for i, p in enumerate(section) if '|' in p)
    speaker_start = next(i for i, p in enumerate(section) if p in ['Спикер:', 'Планируемый спикер:'])
    block = re.search(r'<(?:details|article) class="club-session" id="club-' + key + r'">.*?(?=<div class="club-break)', agenda, re.S).group(0)
    assert plain(re.search(r'(?:<h3 class="club-session-title">|<strong>)(.*?)(?:</h3>|</strong>)', block, re.S)[1]) .casefold() == norm(' '.join(section[:title_end])).casefold(), key
    assert plain(re.search(r'<span class="club-time">(.*?)</span>', block, re.S)[1]) == start + '–' + end, key
    body = block.split('<div class="club-session-body">', 1)[1].split('<div class="program-speakers">', 1)[0]
    actual = [plain(m[1]) for m in re.findall(r'<(h3|li|p)\b[^>]*>(.*?)</\1>', body, re.S)]
    expected = [norm(p) for p in section[title_end:speaker_start]]
    assert norm(' '.join(actual)) == norm(' '.join(expected)), key
    count += len(expected)
    name, bio = section[speaker_start + 1].split(',', 1)
    assert '<h4>' + name + '</h4>' in block, key
    assert norm(bio) in plain(block), key
breaks = [p for p in paragraphs if re.match(r'^\d{2}:\d{2}', p) and any(w in p for w in ['Регистрация', 'Перерыв', 'Обед', 'Вечерний коктейль'])]
for p in breaks:
    assert norm(p.replace(' | ', ' ')) in plain(agenda), p
assert len(re.findall(r'<(?:details|article) class="club-session"', agenda)) == 5
assert 'Фомин' not in agenda and 'Сизенцева' not in agenda
assert 'Планируемый спикер' not in agenda
assert plain(agenda).index('08:00') < plain(agenda).index('09:00')
assert all(agenda.index('id="club-' + slots[i][0]) < agenda.index('id="club-' + slots[i+1][0]) for i in range(4))
assert 'Спикер в процессе согласования' not in agenda
print(f'PASS: 5 titles and time slots; {count} exact paragraphs; 5 speaker biographies; {len(breaks)} breaks/registration/finale.')

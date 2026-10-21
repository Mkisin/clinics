"""Publish the isolated redesign to the root, preserving the hidden packages."""
from pathlib import Path
import re
import shutil

root = Path(__file__).resolve().parents[1]
preview = root / 'redesign'
current = (root / 'index.html').read_text(encoding='utf-8')
packages = re.search(r'<section class="packages".*?</section>', current, re.S)
html = (preview / 'index.html').read_text(encoding='utf-8')
html = html.replace('href="../index.html#registration"', 'href="#registration-dialog" data-open-registration aria-haspopup="dialog" aria-controls="registration-dialog"')
html = html.replace('src="assets/', 'src="assets/redesign/')
html = html.replace('../assets/', 'assets/').replace('../old/', 'old/').replace('../doc/', 'doc/')
html = html.replace('  <script src="registration.js"></script>', '').replace('  <script src="history.js"></script>', '')
if packages:
    html = html.replace('  </main>', packages[0] + '\n  </main>')
(root / 'index.html').write_text(html, encoding='utf-8')
(root / 'styles.css').write_text((preview / 'styles.css').read_text(encoding='utf-8').replace('../old/', 'old/'), encoding='utf-8')
js = '\n'.join((preview / name).read_text(encoding='utf-8') for name in ['script.js', 'registration.js', 'history.js'])
js = js.replace('../api/register', 'api/register').replace('../old/', 'old/')
(root / 'script.js').write_text(js, encoding='utf-8')
destination = root / 'assets/redesign'
destination.mkdir(exist_ok=True)
for asset in (preview / 'assets').iterdir():
    if asset.is_file():
        shutil.copy2(asset, destination / asset.name)
print('Built root page, CSS, JavaScript and assets. Hidden packages retained.')

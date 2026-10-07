"""Optional: bundle the project into one HTML file. No external Python packages."""
from pathlib import Path
import base64

ROOT=Path(__file__).resolve().parents[1]
text=(ROOT/'index.html').read_text(encoding='utf-8')
for name in ['hero', 'dot-art', 'writing']:
    text=text.replace(f'<link rel="stylesheet" href="./{name}.css">','<style>\n'+(ROOT/f'{name}.css').read_text(encoding='utf-8')+'\n</style>')
    text=text.replace(f'<script src="./{name}.js" defer></script>','')
    text=text.replace('</body>','<script>\n'+(ROOT/f'{name}.js').read_text(encoding='utf-8')+'\n</script>\n</body>')
text=text.replace('<script src="./writing-data.js" defer></script>','<script>\n'+(ROOT/'writing-data.js').read_text(encoding='utf-8')+'\n</script>')
for p in (ROOT/'assets').glob('*.*'):
    ext = p.suffix.lower()
    if ext == '.svg':
        mime = 'image/svg+xml'
    elif ext in ['.jpg', '.jpeg']:
        mime = 'image/jpeg'
    elif ext == '.png':
        mime = 'image/png'
    else:
        continue
    uri = f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode('ascii')
    text = text.replace('./assets/' + p.name, uri).replace('assets/' + p.name, uri)
(ROOT/'standalone.html').write_text(text,encoding='utf-8')
print('Wrote standalone.html (font remains an optional external Google Fonts request).')

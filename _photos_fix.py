from pathlib import Path
import json

root = Path(r"C:\Users\toque\OneDrive\Desktop\ZB Suites")
photo_root = root / "ZHONGKE BOLE PHOTOSHOOT"
paths = []
for p in photo_root.rglob('*'):
    if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
        rel = p.relative_to(root).as_posix()
        paths.append(rel)
paths.sort()
content = "window.PHOTO_PATHS = " + json.dumps(paths, indent=4) + ";\n"
(root / "photos.js").write_text(content, encoding="utf-8")

script_path = root / "script.js"
js = script_path.read_text(encoding="utf-8")
js = js.replace(
    '        const PHOTO_PATHS = ["ZHONGKE BOLE PHOTOSHOOT\\IMG_0346.JPG", ',
    '        const PHOTO_PATHS = window.PHOTO_PATHS || [];\n\n        // '
)
# remove stale huge literal block up to ending ];
start = js.find('        const PHOTO_PATHS = window.PHOTO_PATHS || [];\n\n        // ')
if start != -1:
    end = js.find('];', start)
    if end != -1:
        # keep only first line, remove old array remainder marker part
        line_end = js.find('\n', start)
        js = js[:line_end+1] + js[end+3:]
script_path.write_text(js, encoding="utf-8")

idx_path = root / "index.html"
html = idx_path.read_text(encoding="utf-8")
html = html.replace('    <script src="script.js"></script>', '    <script src="photos.js"></script>\n    <script src="script.js"></script>')
idx_path.write_text(html, encoding="utf-8")
print('ok')

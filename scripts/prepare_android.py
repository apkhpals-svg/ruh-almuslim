#!/usr/bin/env python3
"""يجهّز مشروع الأندرويد بعد `npx cap add android`:
- أيقونة التطبيق (عادية ودائرية وأمامية للأيقونة التكيّفية)
- أيقونة شريط الإشعارات ic_stat_icon (هلال ونجمة بيضاء على خلفية شفافة)
- صلاحيات الإشعارات والتنبيه الدقيق والموقع
- رقم الإصدار: versionCode = GITHUB_RUN_NUMBER و versionName = 1.0.<GITHUB_RUN_NUMBER>
- التوقيع بمفتاح ثابت (KS_PATH / KS_PASS / KS_ALIAS) كي يتحدّث التطبيق فوق القديم بدون حذف بياناته
- حقن رقم البناء داخل index.html ليعرف التطبيق نسخته عند فحص التحديثات
"""
import os, re, sys
from PIL import Image, ImageDraw

RES = 'android/app/src/main/res'
MANIFEST = 'android/app/src/main/AndroidManifest.xml'
if not os.path.isdir(RES):
    sys.exit('android project not found: run `npx cap add android` first')

def load(*names):
    for n in names:
        if os.path.exists(n):
            return Image.open(n).convert('RGBA')
    sys.exit('icon not found: ' + ', '.join(names))

icon = load('icon-512.png', 'www/icon-512.png')
maskable = load('icon-maskable-512.png', 'icon-512.png', 'www/icon-512.png')

def save(img, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path)

def circle(img, size):
    im = img.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

launcher = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
foreground = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d, s in launcher.items():
    base = os.path.join(RES, 'mipmap-' + d)
    save(icon, os.path.join(base, 'ic_launcher.png'), s)
    circle(icon, s).save(os.path.join(base, 'ic_launcher_round.png'))
    save(maskable, os.path.join(base, 'ic_launcher_foreground.png'), foreground[d])

os.makedirs(os.path.join(RES, 'values'), exist_ok=True)
with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0D10</color>\n</resources>\n')

# الأيقونة التكيّفية تشير صراحةً إلى صور mipmap التي كتبناها
os.makedirs(os.path.join(RES, 'mipmap-anydpi-v26'), exist_ok=True)
for n in ('ic_launcher', 'ic_launcher_round'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', n + '.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')
# حذف نسخة الأيقونة المتجهة الافتراضية كي لا يحدث تعارض بالأسماء
import glob
for p in glob.glob(os.path.join(RES, 'drawable*', 'ic_launcher_foreground.xml')):
    os.remove(p)

# أيقونة الإشعار: يجب أن تكون بيضاء على شفاف (أندرويد يلوّنها بـ iconColor)
# الهلال بقناع: قرص كبير ناقص قرص أصغر، مع نجمة
def crescent(size):
    S = 768
    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((90, 120, 90 + 540, 120 + 540), fill=255)
    cut = Image.new('L', (S, S), 0)
    ImageDraw.Draw(cut).ellipse((230, 60, 230 + 500, 60 + 500), fill=255)
    from PIL import ImageChops
    mask = ImageChops.subtract(mask, cut)
    import math
    sd = ImageDraw.Draw(mask)
    cx, cy, R, r = 560, 330, 110, 46
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = R if i % 2 == 0 else r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    sd.polygon(pts, fill=255)
    white = Image.new('RGBA', (S, S), (255, 255, 255, 255))
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(white, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)

for d, s in {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}.items():
    p = os.path.join(RES, 'drawable-' + d, 'ic_stat_icon.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    crescent(s).save(p)

# صلاحيات
perms = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.WAKE_LOCK',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
]
m = open(MANIFEST, encoding='utf-8').read()
add = ''.join('    <uses-permission android:name="%s" />\n' % p for p in perms if p not in m)
if add:
    m = re.sub(r'(\s*<application)', '\n' + add.rstrip('\n') + r'\n\1', m, count=1)
open(MANIFEST, 'w', encoding='utf-8').write(m)
print('prepared icons, notification icon and permissions')

# ---------- رقم الإصدار ----------
run = os.environ.get('GITHUB_RUN_NUMBER', '1')
if not run.isdigit():
    run = '1'
GRADLE = 'android/app/build.gradle'
g = open(GRADLE, encoding='utf-8').read()
g, n1 = re.subn(r'versionCode\s+\d+', 'versionCode ' + run, g, count=1)
g, n2 = re.subn(r'versionName\s+"[^"]*"', 'versionName "1.0.' + run + '"', g, count=1)
if not (n1 and n2):
    sys.exit('versionCode/versionName not found in build.gradle')

# ---------- التوقيع بمفتاح ثابت ----------
if os.environ.get('KS_PATH') and 'signingConfigs {' not in g:
    signing = (
        '    signingConfigs {\n'
        '        release {\n'
        '            storeFile file(System.getenv("KS_PATH"))\n'
        '            storePassword System.getenv("KS_PASS")\n'
        '            keyAlias System.getenv("KS_ALIAS")\n'
        '            keyPassword System.getenv("KS_PASS")\n'
        '        }\n'
        '    }\n'
    )
    g, n3 = re.subn(r'(\n\s*buildTypes\s*\{)', '\n' + signing + r'\1', g, count=1)
    g, n4 = re.subn(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', g, count=1)
    if not (n3 and n4):
        sys.exit('could not patch signing config into build.gradle')
open(GRADLE, 'w', encoding='utf-8').write(g)
print('versionCode', run, 'versionName 1.0.' + run)

# ---------- رقم البناء داخل التطبيق ----------
for page in ('www/index.html',):
    if os.path.exists(page):
        t = open(page, encoding='utf-8').read()
        if 'var APP_BUILD = 0;' in t:
            open(page, 'w', encoding='utf-8').write(t.replace('var APP_BUILD = 0;', 'var APP_BUILD = ' + run + ';', 1))
            print('APP_BUILD =', run)

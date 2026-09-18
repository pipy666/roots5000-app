import json, re, sys
from pathlib import Path

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/mnt/data/roots_app_work/IELTS_Roots_5000_Master_CURRENT.md')
OUT_DIR = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('/mnt/data/roots5000_app_framework/data')
OUT_DIR.mkdir(parents=True, exist_ok=True)
text = SRC.read_text(encoding='utf-8')

# ---------- 例句中文翻译（sidecar + 模板替换） ----------
SIDECAR = Path(__file__).parent.parent / 'data' / 'i18n' / 'example_zh.json'
TPL = Path(__file__).parent.parent / 'data' / 'i18n' / 'templates.json'
sidecar = json.loads(SIDECAR.read_text(encoding='utf-8')) if SIDECAR.exists() else {}
templates = json.loads(TPL.read_text(encoding='utf-8')) if TPL.exists() else {}

def mask_word(example, word):
    return re.sub(re.escape(word), 'X', example, flags=re.IGNORECASE)

def example_zh_for(entry):
    """sidecar 逐句翻译优先；模板句用槽位替换；都无 → 空串（例句被语料 QA 改写后翻译自动失效）。"""
    sid = sidecar.get(entry['id'])
    if sid and sid.get('en') == entry['example'] and sid.get('zh'):
        return sid['zh']
    masked = mask_word(entry['example'], entry['word'])
    tpl = templates.get(masked)
    if tpl:
        first_seg = re.split(r'[；;，,]', entry['meaning'])[0].strip()
        # 形容词性首段（"心理的"）接名词槽位时去掉"的"，避免"心理的因素"这类拗口表述
        if first_seg.endswith('的'):
            first_seg = first_seg.rstrip('的')
        return tpl.replace('{m}', first_seg or entry['meaning'])
    return ''

heading_re = re.compile(r'^##\s+(R\d+)\s+·\s+(.+?)\s+\[(Core|Reading)\]\s*$', re.M)
matches = list(heading_re.finditer(text))
words=[]

field_patterns = {
    'pos': re.compile(r'^- \*\*POS\*\*:\s*(.+)$', re.M),
    'meaning': re.compile(r'^- \*\*中文\*\*:\s*(.+)$', re.M),
    'ipa': re.compile(r'^- \*\*IPA \(draft\)\*\*:\s*(.+)$', re.M),
    'decomp': re.compile(r'^- \*\*拆解\*\*:\s*(.+)$', re.M),
    'prefixMeaning': re.compile(r'^- \*\*前缀\*\*:\s*(.+)$', re.M),
    'rootMeaning': re.compile(r'^- \*\*(?:词根|词根/母词)\*\*:\s*(.+)$', re.M),
    'suffixMeaning': re.compile(r'^- \*\*后缀\*\*:\s*(.+)$', re.M),
    'mnemonic': re.compile(r'^- \*\*具象/结构记忆\*\*:\s*(.+)$', re.M),
    'collocation': re.compile(r'^- \*\*搭配\*\*:\s*(.+)$', re.M),
    'example': re.compile(r'^- \*\*IELTS 阅读式例句\*\*:\s*(.+)$', re.M),
}

def field(block, name, default=''):
    m=field_patterns[name].search(block)
    return m.group(1).strip() if m else default

def clean_md(s):
    s=s.replace('`','')
    s=re.sub(r'\*\*(.*?)\*\*', r'\1', s)
    return s.strip()

def parse_decomp(raw):
    if not raw:
        return {'prefix':'','root':'','suffix':'','confidence':'○ 整体记忆'}
    left, *right = raw.split('·',1)
    bits=[clean_md(x.strip()) for x in left.split('|')]
    while len(bits)<3: bits.append('')
    p,r,s = bits[:3]
    normalize=lambda x: '' if x in {'—','-', 'whole-word'} else x
    return {
        'prefix': normalize(p),
        'root': normalize(r),
        'suffix': normalize(s),
        'confidence': clean_md(right[0].strip()) if right else ''
    }

for i,m in enumerate(matches):
    start=m.end(); end=matches[i+1].start() if i+1<len(matches) else len(text)
    block=text[start:end]
    rid, word, tier = m.group(1), m.group(2).strip(), m.group(3)
    d=parse_decomp(field(block,'decomp'))
    ipa=clean_md(field(block,'ipa'))
    if ipa in {'—','-'}: ipa=''
    first = next((c.upper() for c in word if c.isalpha()), '#')
    entry={
        'id': rid,
        'word': word,
        'tier': tier,
        'letter': first,
        'pos': clean_md(field(block,'pos')),
        'meaning': clean_md(field(block,'meaning')),
        'ipa': ipa,
        'prefix': d['prefix'],
        'root': d['root'],
        'suffix': d['suffix'],
        'confidence': d['confidence'] or '○ 整体记忆',
        'prefixMeaning': clean_md(field(block,'prefixMeaning')),
        'rootMeaning': clean_md(field(block,'rootMeaning')),
        'suffixMeaning': clean_md(field(block,'suffixMeaning')),
        'mnemonic': clean_md(field(block,'mnemonic')),
        'collocation': clean_md(field(block,'collocation')),
        'example': clean_md(field(block,'example')),
    }
    # lightweight family key for root-map UI
    if entry['root']:
        entry['family'] = entry['root'].upper()
    elif entry['prefix']:
        entry['family'] = entry['prefix'].lower()
    elif entry['suffix']:
        entry['family'] = entry['suffix'].lower()
    else:
        entry['family'] = 'whole-word'
    entry['exampleZh'] = example_zh_for(entry)
    words.append(entry)

meta={
    'title':'IELTS Roots 5000',
    'version':'v0.5',
    'count':len(words),
    'core':sum(w['tier']=='Core' for w in words),
    'reading':sum(w['tier']=='Reading' for w in words),
    'exampleZh': sum(1 for w in words if w.get('exampleZh')),
    'quality':'QA in progress — app framework uses the latest current mother lexicon snapshot',
    'source':SRC.name,
}

(OUT_DIR/'words.json').write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT_DIR/'meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT_DIR/'words.js').write_text('window.ROOTS_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\nwindow.ROOTS_WORDS='+json.dumps(words,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps(meta,ensure_ascii=False))

#!/usr/bin/env python3
"""Generate index.html for GAppProjects (Flutter/Dart) — Charcoal design, row-inline panels, tag filters."""
import json
import re
import html as html_lib
from pathlib import Path
from collections import Counter

NAV_LINKS = [
    ("Java",       "https://bigbrodyg.github.io/JavaProjects/"),
    ("JavaScript", "https://bigbrodyg.github.io/DIYJavaScript/"),
    ("Python",     "https://bigbrodyg.github.io/PythonAlmostSelfLearned/"),
    ("GApps",      "https://bigbrodyg.github.io/GAppProjects/"),
]

IGNORED_DIRS = {
    '.git', 'docs', '.github', '.remember', 'TestFolder', 'build',
    '.dart_tool', '.pub-cache', '.pub', '.idea', '.vscode',
    'android', 'ios', 'linux', 'macos', 'windows', 'web', 'test',
}
TYPE_TAGS: set = set()


# ── HELPERS ───────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def wrap_lines(highlighted: str) -> str:
    return '\n'.join(f'<span class="ln">{ln}</span>' for ln in highlighted.split('\n'))


# ── SYNTAX HIGHLIGHTING ───────────────────────────────────────────────────────

def highlight_dart(code: str) -> str:
    KEYWORDS = {
        'class', 'void', 'var', 'final', 'const', 'static', 'return', 'if',
        'else', 'for', 'while', 'new', 'import', 'export', 'extends', 'implements',
        'abstract', 'String', 'int', 'double', 'bool', 'List', 'Map', 'Set',
        'Future', 'Stream', 'async', 'await', 'true', 'false', 'null', 'this',
        'super', 'try', 'catch', 'throw', 'rethrow', 'in', 'is', 'as', 'late',
        'required', 'dynamic', 'Widget', 'BuildContext', 'override',
    }
    escaped = html_lib.escape(code)
    escaped = re.sub(r'(//[^\n]*)', r'<span class="cm">\1</span>', escaped)
    escaped = re.sub(r'(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;)',
                     r'<span class="str">\1</span>', escaped)
    escaped = re.sub(r'\b([A-Z][a-zA-Z0-9]+)\b(?![^<]*>)', r'<span class="cl">\1</span>', escaped)
    for kw in KEYWORDS:
        escaped = re.sub(rf'\b({re.escape(kw)})\b(?![^<]*>)', r'<span class="kw">\1</span>', escaped)
    return escaped


# ── TAG CLASSIFICATION ────────────────────────────────────────────────────────

def classify_tags(source: str, name: str) -> list:
    tags = []
    s = source

    # OOP / Dart patterns
    if re.search(r'\bclass\s+\w+', s):
        tags.append('OOP')
    if ' extends ' in s:
        tags.append('extends')
    if ' implements ' in s:
        tags.append('implements')
    if 'abstract ' in s:
        tags.append('abstract')
    if '@override' in s.lower():
        tags.append('@override')

    # Flutter widgets
    if 'StatefulWidget' in s:
        tags.append('StatefulWidget')
    if 'StatelessWidget' in s:
        tags.append('StatelessWidget')
    if re.search(r'ListView|GridView|Column|Row|Container|Scaffold', s):
        tags.append('UI')
    if re.search(r'Navigator|Route|MaterialPageRoute|go_router', s):
        tags.append('navigation')

    # Dart features
    if re.search(r'\basync\b|\bawait\b|Future<', s):
        tags.append('async')
    if re.search(r'List<|Map<|Set<', s):
        tags.append('collections')
    if re.search(r'http\.|dio\.|Dio\b', s):
        tags.append('HTTP')
    if re.search(r'SharedPreferences|sqflite|Hive\b|hive\b', s):
        tags.append('storage')

    return list(dict.fromkeys(tags))


# ── PROJECT DISCOVERY ─────────────────────────────────────────────────────────

def find_projects(base: Path) -> list:
    projects = []
    for top_dir in sorted(base.iterdir()):
        if not top_dir.is_dir() or top_dir.name in IGNORED_DIRS or top_dir.name.startswith('.'):
            continue
        # Flat project: top dir has dart files directly
        dart_top = list(top_dir.glob('*.dart'))
        if dart_top:
            primary = next((f for f in dart_top if f.name == 'main.dart'), dart_top[0])
            try:
                src = primary.read_text(encoding='utf-8', errors='replace')
            except Exception:
                src = ''
            tags = classify_tags(src, top_dir.name)
            projects.append({
                'name': top_dir.name,
                'slug': slugify(top_dir.name),
                'path': str(top_dir.relative_to(base)) + '/',
                'category': 'Projects',
                'source_file': primary.name,
                'source_content': src,
                'tags': tags,
            })
        else:
            # Category dir: scan subdirs as individual Flutter projects
            for proj_dir in sorted(top_dir.iterdir()):
                if not proj_dir.is_dir() or proj_dir.name.startswith('.'):
                    continue
                if proj_dir.name in IGNORED_DIRS:
                    continue
                lib_dir = proj_dir / 'lib'
                if lib_dir.is_dir():
                    dart_files = [
                        f for f in lib_dir.rglob('*.dart')
                        if not any(p.name.startswith('.') for p in f.parents)
                    ]
                else:
                    dart_files = [
                        f for f in proj_dir.rglob('*.dart')
                        if not any(
                            p.name in IGNORED_DIRS or p.name.startswith('.')
                            for p in f.relative_to(proj_dir).parents
                        )
                    ]
                if not dart_files:
                    continue
                primary = next((f for f in dart_files if f.name == 'main.dart'), dart_files[0])
                try:
                    src = primary.read_text(encoding='utf-8', errors='replace')
                except Exception:
                    src = ''
                # Use all dart files for tag detection
                all_src = '\n'.join(
                    f.read_text(encoding='utf-8', errors='replace')
                    for f in dart_files[:6]
                )
                tags = classify_tags(all_src, proj_dir.name)
                projects.append({
                    'name': proj_dir.name,
                    'slug': slugify(proj_dir.name),
                    'path': str(proj_dir.relative_to(base)) + '/',
                    'category': top_dir.name,
                    'source_file': primary.name,
                    'source_content': src,
                    'tags': tags,
                })
    return projects


# ── RENDERERS ─────────────────────────────────────────────────────────────────

def render_card(p: dict) -> str:
    slug = p['slug']
    cat = html_lib.escape(p['category'])
    tags_json = html_lib.escape(json.dumps(p['tags']))
    concept_chips = ''.join(
        f'<span class="ctag">{html_lib.escape(t)}</span>'
        for t in p['tags']
    )[:200]
    return f'''    <div class="project-card" data-id="{slug}" data-category="{cat}" data-tags="{tags_json}" onclick="togglePanel(this,'{slug}')">
      <div class="card-head">
        <div class="card-info">
          <div class="project-name">{html_lib.escape(p["name"])}</div>
          <div class="project-path">{html_lib.escape(p["path"])}</div>
        </div>
        <span class="expand-icon">›</span>
      </div>
      <div class="card-foot">{concept_chips}</div>
    </div>'''


def build_projects_json(projects: list) -> str:
    data = {}
    for p in projects:
        hl = wrap_lines(highlight_dart(p['source_content']))
        data[p['slug']] = {
            'source_file': p['source_file'],
            'highlighted': hl,
        }
    return json.dumps(data, ensure_ascii=False).replace('</', '<\\/')


# ── PAGE RENDER ───────────────────────────────────────────────────────────────

def render_page(repo_title: str, repo_desc: str, active_nav: str, projects: list) -> str:
    categories = sorted({p['category'] for p in projects})

    nav_parts = []
    for label, url in NAV_LINKS:
        attr = ' class="active"' if label == active_nav else ''
        nav_parts.append(f'    <li><a href="{url}"{attr}>{label}</a></li>')
    nav_items = '\n'.join(nav_parts)

    tab_all = f'<div class="tab active" onclick="setTab(this,\'all\')">All <span class="tab-count">{len(projects)}</span></div>'
    tab_cat_parts = []
    for cat in categories:
        cnt = sum(1 for p in projects if p['category'] == cat)
        tab_cat_parts.append(
            f'<div class="tab" onclick="setTab(this,\'{html_lib.escape(cat)}\')">'
            f'{html_lib.escape(cat)} <span class="tab-count">{cnt}</span></div>'
        )
    tab_cats = '\n      '.join(tab_cat_parts)

    tag_counts = Counter(t for p in projects for t in p['tags'])
    all_tags = sorted(tag_counts, key=lambda t: (-tag_counts[t], t))
    tag_bar_chips = ''.join(
        f'<span class="tag-chip" onclick="toggleTag(this,{json.dumps(t)})">'
        f'{html_lib.escape(t)} <span class="tc-n">{tag_counts[t]}</span></span>'
        for t in all_tags
    )
    tag_bar = f'  <div class="tag-bar">{tag_bar_chips}</div>' if all_tags else ''

    cards = '\n'.join(render_card(p) for p in projects)
    projects_json = build_projects_json(projects)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html_lib.escape(repo_title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg:#141414;--surface:#1d1d1d;--surface-hi:#252525;--surface-lo:#191919;
    --border:#2a2a2a;--border-hi:#383838;
    --text-1:#ededed;--text-2:#aaaaaa;--text-3:#666;--text-4:#444;
    --green:#22c55e;--green-dim:rgba(34,197,94,.08);--green-bd:rgba(34,197,94,.22);
    --font-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    --font-mono:'JetBrains Mono','Fira Code',monospace;
  }}
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:var(--bg);color:var(--text-1);font-family:var(--font-sans);min-height:100vh;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}}
  nav{{border-bottom:1px solid var(--border);padding:0 56px;height:50px;display:flex;align-items:center;justify-content:flex-end;position:sticky;top:0;background:rgba(20,20,20,.94);backdrop-filter:blur(16px);z-index:100}}
  .nav-links{{display:flex;gap:2px;list-style:none}}
  .nav-links a{{font-size:12px;color:var(--text-3);text-decoration:none;font-weight:500;padding:5px 11px;border-radius:5px;transition:color .12s,background .12s}}
  .nav-links a:hover{{color:var(--text-2);background:var(--surface)}}
  .nav-links a.active{{color:var(--text-1);background:var(--surface-hi)}}
  .hero{{padding:72px 56px 44px;border-bottom:1px solid var(--border)}}
  .hero-eyebrow{{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.13em;color:var(--text-3);margin-bottom:22px}}
  .hero-dot{{width:4px;height:4px;border-radius:50%;background:var(--green)}}
  .hero-title{{font-size:64px;font-weight:800;letter-spacing:-2.5px;line-height:1;color:#fff;margin-bottom:20px}}
  .hero-desc{{font-size:14px;color:var(--text-2);max-width:440px;line-height:1.75;margin-bottom:32px}}
  .hero-meta{{display:flex;align-items:center;gap:18px;flex-wrap:wrap}}
  .meta-stat{{font-size:12px;color:var(--text-3)}}.meta-stat strong{{color:var(--text-2);font-weight:600}}
  .meta-div{{width:1px;height:12px;background:var(--border-hi)}}
  .content{{padding:0 56px 80px}}
  .filter-row{{display:flex;align-items:center;justify-content:space-between;padding:22px 0 16px;border-bottom:1px solid var(--border)}}
  .tabs{{display:flex;gap:2px}}
  .tab{{font-size:12px;font-weight:500;padding:5px 12px;border-radius:5px;color:var(--text-3);cursor:pointer;transition:color .12s,background .12s;user-select:none}}
  .tab:hover{{color:var(--text-2);background:var(--surface)}}
  .tab.active{{color:var(--text-1);background:var(--surface-hi)}}
  .tab-count{{font-size:10px;color:var(--text-4);margin-left:3px}}
  .tab.active .tab-count{{color:var(--text-3)}}
  .filter-stat{{font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:6px}}
  .fstat-dot{{width:6px;height:6px;border-radius:50%;background:var(--green)}}
  .tag-bar{{display:flex;flex-wrap:wrap;gap:5px;padding:12px 0 16px;border-bottom:1px solid var(--border);margin-bottom:20px}}
  .tag-chip{{font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;border:1px solid var(--border-hi);color:var(--text-3);cursor:pointer;transition:all .12s;user-select:none;display:inline-flex;align-items:center;gap:4px}}
  .tag-chip:hover{{border-color:var(--green-bd);color:var(--text-2)}}
  .tag-chip.on{{border-color:var(--green);color:var(--green);background:var(--green-dim)}}
  .tc-n{{font-size:10px;opacity:.6}}
  .projects{{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden}}
  .project-card{{background:var(--bg);padding:20px 22px 16px;cursor:pointer;transition:background .1s;user-select:none}}
  .project-card:hover{{background:var(--surface)}}
  .project-card.active{{background:var(--surface-hi)}}
  .project-card.hidden{{display:none}}
  .card-head{{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}}
  .card-info{{flex:1;min-width:0}}
  .expand-icon{{font-size:18px;color:var(--text-4);transition:transform .15s;flex-shrink:0;line-height:1;margin-top:1px}}
  .project-card.active .expand-icon{{color:var(--text-3);transform:rotate(90deg)}}
  .project-card:hover .expand-icon{{color:var(--text-3)}}
  .project-name{{font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:3px;letter-spacing:-.1px}}
  .project-path{{font-family:var(--font-mono);font-size:10px;color:var(--text-4)}}
  .card-foot{{display:flex;flex-wrap:wrap;gap:4px;min-height:20px}}
  .ctag{{font-size:10px;font-weight:500;padding:2px 7px;border-radius:3px;background:var(--surface-hi);border:1px solid var(--border-hi);color:var(--text-4)}}
  .panel-anchor{{grid-column:1/-1;background:var(--surface-lo);border-top:2px solid var(--green)}}
  .panel-header{{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid var(--border);background:var(--surface)}}
  .ptabs{{display:flex;gap:3px}}
  .ptab{{background:none;border:none;cursor:pointer;font-family:var(--font-sans);font-size:12px;font-weight:500;color:var(--text-3);padding:5px 12px;border-radius:5px;transition:color .12s,background .12s}}
  .ptab:hover{{color:var(--text-2);background:var(--surface-hi)}}
  .ptab.active{{color:var(--text-1);background:var(--surface-hi)}}
  .ptab-fn{{font-family:var(--font-mono);font-size:11px}}
  .panel-close{{background:none;border:none;cursor:pointer;font-family:var(--font-sans);font-size:11px;font-weight:500;color:var(--text-4);padding:4px 8px;border-radius:4px;transition:color .12s,background .12s}}
  .panel-close:hover{{color:var(--text-1);background:var(--surface-hi)}}
  .panel-body{{max-height:540px;overflow:hidden}}
  .ppane{{display:none;height:540px;overflow:auto}}
  .ppane.vis{{display:block}}
  pre{{font-family:var(--font-mono);font-size:12px;line-height:1.8;color:#c9d1d9;background:#0d1117;counter-reset:line;padding:16px 0;overflow-x:auto;white-space:pre}}
  .ln{{display:block;counter-increment:line;position:relative;padding:0 20px 0 60px;min-height:1.8em}}
  .ln::before{{content:counter(line);position:absolute;left:0;width:46px;text-align:right;padding-right:14px;color:#3a3f4b;font-size:10.5px;user-select:none;border-right:1px solid #21262d;line-height:inherit}}
  .ln:hover{{background:rgba(255,255,255,.03)}}
  pre .kw{{color:#79c0ff}}pre .cl{{color:#ffa657}}pre .cm{{color:#8b949e;font-style:italic}}pre .str{{color:#a5d6ff}}
</style>
</head>
<body>
<nav>
  <ul class="nav-links">
{nav_items}
  </ul>
</nav>
<div class="hero">
  <div class="hero-eyebrow"><span class="hero-dot"></span>School projects · Giordano Fornari</div>
  <h1 class="hero-title">{html_lib.escape(repo_title)}</h1>
  <p class="hero-desc">{html_lib.escape(repo_desc)}</p>
  <div class="hero-meta">
    <span class="meta-stat"><strong>{len(projects)}</strong> projects</span>
  </div>
</div>
<div class="content">
  <div class="filter-row">
    <div class="tabs">
      {tab_all}
      {tab_cats}
    </div>
    <div class="filter-stat"><span class="fstat-dot"></span>Flutter · Dart</div>
  </div>
{tag_bar}
  <div class="projects" id="grid">
{cards}
  </div>
</div>
<script>
const PROJECTS = {projects_json};
let activeTags = new Set();
let activeCat = 'all';
let activePanel = null;

function applyFilters() {{
  document.querySelectorAll('.project-card').forEach(c => {{
    const tags = JSON.parse(c.dataset.tags || '[]');
    const catOk = activeCat === 'all' || c.dataset.category === activeCat;
    const tagOk = activeTags.size === 0 || [...activeTags].some(t => tags.includes(t));
    c.classList.toggle('hidden', !(catOk && tagOk));
  }});
}}
function setTab(el, cat) {{
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  activeCat = cat;
  closePanel();
  applyFilters();
}}
function toggleTag(el, tag) {{
  if (activeTags.has(tag)) {{ activeTags.delete(tag); el.classList.remove('on'); }}
  else {{ activeTags.add(tag); el.classList.add('on'); }}
  closePanel();
  applyFilters();
}}
function closePanel() {{
  document.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
  if (activePanel) {{ activePanel.remove(); activePanel = null; }}
}}
function getRowLast(card) {{
  const vis = [...document.querySelectorAll('.project-card:not(.hidden)')];
  const top = Math.round(card.getBoundingClientRect().top);
  const row = vis.filter(c => Math.abs(Math.round(c.getBoundingClientRect().top) - top) < 4);
  return row[row.length - 1] || card;
}}
function buildPanel(id) {{
  const p = PROJECTS[id];
  if (!p) return null;
  const w = document.createElement('div');
  w.className = 'panel-anchor';
  w.id = 'pa-' + id;
  w.innerHTML = `
    <div class="panel-header">
      <div class="ptabs">
        <button class="ptab active ptab-fn" onclick="switchTab(this,'src-${{id}}')">${{p.source_file}}</button>
      </div>
      <button class="panel-close" onclick="closePanel()">✕ close</button>
    </div>
    <div class="panel-body">
      <div class="ppane vis" id="src-${{id}}"><pre>${{p.highlighted}}</pre></div>
    </div>`;
  return w;
}}
function switchTab(btn, paneId) {{
  const hdr = btn.closest('.panel-header');
  const body = hdr.nextElementSibling;
  hdr.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  body.querySelectorAll('.ppane').forEach(p => p.classList.remove('vis'));
  btn.classList.add('active');
  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('vis');
}}
function togglePanel(card, id) {{
  const was = card.classList.contains('active');
  document.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
  if (activePanel) {{ activePanel.remove(); activePanel = null; }}
  if (was) return;
  card.classList.add('active');
  const panel = buildPanel(id);
  if (!panel) return;
  getRowLast(card).after(panel);
  activePanel = panel;
  setTimeout(() => panel.scrollIntoView({{behavior:'smooth',block:'nearest'}}), 50);
}}
</script>
</body>
</html>'''


if __name__ == '__main__':
    base = Path(__file__).parent.parent.parent
    projects = find_projects(base)
    html = render_page(
        repo_title='GAppProjects',
        repo_desc='Flutter and Dart school projects.',
        active_nav='GApps',
        projects=projects,
    )
    out = base / 'docs' / 'index.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print(f'Generated {out} ({len(projects)} projects)')

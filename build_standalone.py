import re

def clean_module_syntax(code):
    # Remove import statements
    code = re.sub(r'^\s*import\s+.*?from\s+[\'"].*?[\'"];?\s*$', '', code, flags=re.MULTILINE)
    code = re.sub(r'^\s*import\s+[\'"].*?[\'"];?\s*$', '', code, flags=re.MULTILINE)
    # Remove multiline imports
    code = re.sub(r'import\s*\{[\s\S]*?\}\s*from\s*[\'"].*?[\'"];?', '', code)
    # Replace export const / export function / export let / export var / export async function
    code = re.sub(r'^\s*export\s+(const|let|var|function|async function|class)\s+', r'\1 ', code, flags=re.MULTILINE)
    # Remove export default
    code = re.sub(r'^\s*export\s+default\s+.*?;?\s*$', '', code, flags=re.MULTILINE)
    # Remove export { ... }
    code = re.sub(r'export\s*\{[\s\S]*?\};?', '', code)
    return code

with open('css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

with open('js/calendar.js', 'r', encoding='utf-8') as f:
    cal = clean_module_syntax(f.read())

with open('js/database.js', 'r', encoding='utf-8') as f:
    db = clean_module_syntax(f.read())

with open('js/qimen.js', 'r', encoding='utf-8') as f:
    qm = clean_module_syntax(f.read())

with open('js/app.js', 'r', encoding='utf-8') as f:
    app_raw = f.read()
    # Deduplicate constants/functions already defined in qimen.js
    app_raw = re.sub(r'const HE_GAN_MAP = \{[\s\S]*?\};', '// HE_GAN_MAP in qimen.js', app_raw)
    app = clean_module_syntax(app_raw)

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import base64

with open('icons/icon.svg', 'rb') as f:
    svg_b64 = base64.b64encode(f.read()).decode('ascii')
svg_data_uri = f'data:image/svg+xml;base64,{svg_b64}'

# Replace icon references with data URI
html = html.replace('./icons/icon.svg', svg_data_uri)
html = html.replace('href="./favicon.ico"', f'href="{svg_data_uri}"')
html = html.replace('href="./icons/icon-192.png"', f'href="{svg_data_uri}"')
html = re.sub(r'<link\s+rel="manifest"\s+href="[^"]*"\s*>', '', html)

# Replace css link with inline style
html = re.sub(r'<link\s+rel="stylesheet"\s+href="(?:\./)?css/style\.css"\s*>', lambda m: f'<style>\n{css}\n</style>', html)

# Bundle JS in correct dependency order
bundled_js = f"""
// === 1. DATABASE ===
{db}

// === 2. CALENDAR ===
{cal}

// === 3. QIMEN ENGINE ===
{qm}

// === 4. APP LOGIC ===
{app}
"""

# Replace script tag with inline script
html = re.sub(r'<script\s+type="module"\s+src="(?:\./)?js/app\.js"\s*></script>', lambda m: f'<script>\n{bundled_js}\n</script>', html)

with open('qimen_offline_standalone.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Successfully generated qimen_offline_standalone.html with 100% self-contained assets!")

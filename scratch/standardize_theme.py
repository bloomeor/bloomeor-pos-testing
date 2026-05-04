import os
import re

directory = 'main/html'
files = [f for f in os.listdir(directory) if f.endswith('.html')]
files.append('index.html')

replacements = {
    r'background:\s*rgba\(0,\s*0,\s*0,\s*0\.4\)': 'background: var(--input-bg)',
    r'background:\s*rgba\(0,0,0,0.4\)': 'background: var(--input-bg)',
    r'color:\s*#d4af37': 'color: var(--primary)',
    r'color:\s*#D4AF37': 'color: var(--primary)',
    r'background:\s*#D4AF37': 'background: var(--primary)',
    r'border:\s*1px\s*solid\s*#333': 'border: 1px solid var(--border)',
    r'border:\s*1px\s*solid\s*#444': 'border: 1px solid var(--border)',
    r'background:\s*#1a1a1a': 'background: var(--bg-surface)',
    r'background:\s*#121212': 'background: var(--bg-base)',
    r'class="ph ': 'class="ph-bold ', # Double check
}

for filename in files:
    path = os.path.join(directory, filename) if filename != 'index.html' else filename
    if not os.path.exists(path): continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    new_content = content
    for pattern, replacement in replacements.items():
        new_content = re.sub(pattern, replacement, new_content)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Updated {filename}")

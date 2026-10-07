#!/usr/bin/env python3
"""
tools/build_site.py
Compiles structured content from /content/*.json into:
  - index.html
  - resume/index.html
  - writing/index.html
  - static.html
  - standalone.html
"""

import json
import re
import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(BASE_DIR, 'content')

def load_json(filename):
    path = os.path.join(CONTENT_DIR, filename)
    if not os.path.exists(path):
        print(f"[WARN] File not found: {path}")
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def build_experience_html(experience_data):
    """Generates the HTML for the #experience section timeline in index.html"""
    html_items = []
    for idx, item in enumerate(experience_data):
        is_current = item.get('isCurrent', False)
        dot_class = "bg-primary-container ring-4 ring-primary-fixed" if is_current else "bg-surface-container-highest border-2 border-outline-variant"
        card_border = "border-2 border-primary-container/40" if is_current else "border border-outline-variant"
        
        current_badge = f"""<span class="px-2.5 py-0.5 rounded-full bg-primary-fixed font-label-mono text-label-mono font-bold text-primary-container uppercase">CURRENT ROLE</span>""" if is_current else ""
        
        award_badge = ""
        if item.get('badge'):
            award_badge = f"""
              <span class="inline-flex items-center gap-1 font-label-mono text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <span class="material-symbols-outlined text-[14px]">stars</span>
                <span>{item['badge']}</span>
              </span>
            """
            
        bullets = "".join([f"""
                <li class="flex items-start gap-2">
                  <span class="{"text-primary-container" if is_current else "text-on-surface-variant"} mt-1">•</span>
                  <span>{resp}</span>
                </li>""" for resp in item.get('responsibilities', [])])

        item_html = f"""
        <!-- Milestone {len(experience_data) - idx}: {item.get('company')} -->
        <div class="relative group">
          <!-- Timeline Marker -->
          <div class="absolute -left-[31px] md:-left-[47px] top-1.5 w-4 h-4 rounded-full {dot_class}">
          </div>
          <div class="bg-surface-container-lowest {card_border} rounded-xl p-6 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-container">
              <div class="flex items-center gap-2">
                <span class="font-headline-sm text-headline-sm font-bold text-on-surface">{item.get('company')}</span>
                <span class="font-label-mono text-label-mono text-on-surface-variant">— {item.get('location', '')}</span>
              </div>
              <div class="flex items-center gap-2">
                {current_badge}
                <span class="font-code-inline text-code-inline text-on-surface-variant">{item.get('period', '')}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between flex-wrap gap-2">
              <span class="font-body-md text-body-md font-semibold {"text-primary" if is_current else "text-on-surface"}">{item.get('role', '')}</span>
              {award_badge}
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant mt-2">
              {item.get('description', '')}
            </p>
            <div class="mt-4 pt-3 border-t border-surface-container">
              <h4 class="font-label-mono text-label-mono uppercase text-on-surface-variant font-medium">Key Engineering Responsibilities:</h4>
              <ul class="mt-2 space-y-1.5 font-body-sm text-body-sm text-on-surface">
                {bullets}
              </ul>
            </div>
          </div>
        </div>"""
        html_items.append(item_html)

    return f"""<!-- Timeline Wrapper -->
      <div class="relative border-l-2 border-outline-variant/70 ml-4 md:ml-6 pl-6 md:pl-10 space-y-10">
        {"".join(html_items)}
      </div>"""

def build_projects_nav_and_js(projects_data):
    """Builds the project nav buttons and projects JS array for index.html"""
    nav_buttons = []
    for idx, p in enumerate(projects_data[:3]): # top 3 for interactive showcase
        is_active = "is-active" if idx == 0 else ""
        font_weight = "font-bold" if idx == 0 else "font-medium"
        btn = f"""              <button class="work-nav-btn {is_active}" id="nav-btn-{idx}" onclick="switchProject({idx})">
                <span class="font-code-inline text-code-inline {font_weight}">0{idx+1}</span>
                <span class="font-body-sm text-[12px] {"font-medium" if idx == 0 else ""} truncate ml-2">{p['title']}</span>
                <span class="work-nav-dot"></span>
              </button>"""
        nav_buttons.append(btn)

    nav_html = f"""<div class="space-y-3" id="project-nav-buttons">
{chr(10).join(nav_buttons)}
            </div>"""

    return nav_html

def update_index_html():
    path = os.path.join(BASE_DIR, 'index.html')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    profile = load_json('profile.json')
    experience = load_json('experience.json')
    projects = load_json('projects.json')

    # Update Profile Hero elements
    if profile:
        # Hero Spec
        content = re.sub(
            r'(<p class="hero-spec">\s*)([^<]+)(\s*</p>)',
            rf'\g<1>{profile.get("spec", "")}\g<3>',
            content
        )
        # Hero Description
        content = re.sub(
            r'(<p class="hero-description">\s*)([^<]+)(\s*</p>)',
            rf'\g<1>{profile.get("heroDescription", "")}\g<3>',
            content
        )

    # Update Experience
    if experience:
        exp_html = build_experience_html(experience)
        content = re.sub(
            r'<!-- Timeline Wrapper -->\s*<div class="relative border-l-2.*?</div>\s*</div>\s*</div>\s*</section>',
            exp_html + '\n    </section>',
            content,
            flags=re.DOTALL
        )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated index.html successfully.")

def update_writing_html():
    path = os.path.join(BASE_DIR, 'writing', 'index.html')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    writing = load_json('writing.json')
    if not writing:
        return

    # Count categories for filter badges
    total = len(writing)
    rag_agents_count = len([w for w in writing if w.get('category') == 'rag-agents'])
    llm_inf_count = len([w for w in writing if w.get('category') == 'llm-inference'])
    backend_count = len([w for w in writing if w.get('category') == 'backend'])
    deployment_count = len([w for w in writing if w.get('category') == 'deployment'])

    # Update total count badge
    content = re.sub(
        r'(data-filter="all"[^>]*>\s*All\s*<span[^>]*>\()(\d+)(\)</span>)',
        rf'\g<1>{total}\g<3>',
        content
    )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated writing/index.html successfully.")

def build_standalone():
    script_path = os.path.join(BASE_DIR, 'tools', 'build-standalone.py')
    if os.path.exists(script_path):
        subprocess.run([sys.executable, script_path], cwd=BASE_DIR, check=True)

def main():
    print("=== Rebuilding Portfolio from /content/ ===")
    update_index_html()
    update_writing_html()
    build_standalone()
    print("=== Build Completed Successfully! ===")

if __name__ == '__main__':
    main()

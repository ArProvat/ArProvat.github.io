// admin/admin.js - Dynamic controller for AI Portfolio Admin
const API_BASE = window.location.origin.includes(':8081') ? '' : 'http://localhost:8081';

let currentTab = 'copilot';
let contentCache = {};
let pendingAiUpdate = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCopilot();
  initPdfUpload();
  loadAllContent();

  document.getElementById('btn-global-rebuild').addEventListener('click', triggerRebuild);
});

// Tab Switcher
function initTabs() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('is-active'));
      
      btn.classList.add('is-active');
      currentTab = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(`tab-${currentTab}`);
      if (targetContent) targetContent.classList.add('is-active');

      if (currentTab !== 'copilot') {
        renderCurrentTab();
      }
    });
  });
}

// Fetch all content
async function loadAllContent() {
  const categories = ['profile', 'experience', 'projects', 'resume', 'writing'];
  for (const cat of categories) {
    try {
      const res = await fetch(`${API_BASE}/api/content/${cat}`);
      if (res.ok) {
        contentCache[cat] = await res.json();
      }
    } catch (e) {
      console.warn(`Could not load ${cat}`, e);
    }
  }
}

// Render Tab
function renderCurrentTab() {
  switch (currentTab) {
    case 'projects': renderProjects(); break;
    case 'experience': renderExperience(); break;
    case 'resume': renderResume(); break;
    case 'writing': renderWriting(); break;
    case 'profile': renderProfile(); break;
  }
}

// PROJECTS
function renderProjects() {
  const container = document.getElementById('projects-list');
  const data = contentCache['projects'] || [];
  container.innerHTML = data.map((p, idx) => `
    <div class="item-card">
      <div>
        <div class="item-header">
          <h3>${p.title}</h3>
          <span class="item-meta">${p.index || 'NODE 0' + (idx+1)}</span>
        </div>
        <p class="item-meta mb-1">${p.category}</p>
        <p class="item-desc">${p.desc}</p>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">
          ${(p.tags || []).map(t => `<span class="badge-tag" style="font-size:10px;">${t}</span>`).join('')}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn-xs" onclick="editProject(${idx})">Edit</button>
        <button class="btn-xs btn-danger" onclick="deleteProject(${idx})">Delete</button>
      </div>
    </div>
  `).join('');
}

function showAddProjectModal() {
  const title = prompt("Enter Project Title:");
  if (!title) return;
  const desc = prompt("Enter Short Description:", "Production LLM service built with Python and FastAPI.");
  const tagsStr = prompt("Enter Tags (comma separated):", "Python, LangGraph, vLLM, FastAPI");

  const newProj = {
    id: 'proj-' + Date.now(),
    index: `NODE 0${(contentCache['projects'] || []).length + 1}`,
    category: "AI ENGINEERING · PRODUCTION",
    title,
    desc,
    contrib: "Designed core architecture and optimized inference performance.",
    highlights: [
      "End-to-end production deployment with containerized runtime",
      "Benchmark testing and latency optimization"
    ],
    tags: tagsStr ? tagsStr.split(',').map(s => s.trim()) : ["Python"],
    status: "STATUS: ACTIVE",
    metaLeft: "Audience: Enterprise Users",
    metaRight: "Latency: Sub-second",
    featured: false
  };

  contentCache['projects'].push(newProj);
  saveCategoryContent('projects', contentCache['projects']);
}

function deleteProject(idx) {
  if (confirm(`Delete project "${contentCache['projects'][idx].title}"?`)) {
    contentCache['projects'].splice(idx, 1);
    saveCategoryContent('projects', contentCache['projects']);
  }
}

// EXPERIENCE
function renderExperience() {
  const container = document.getElementById('experience-list');
  const data = contentCache['experience'] || [];
  container.innerHTML = data.map((exp, idx) => `
    <div class="item-card">
      <div>
        <div class="item-header">
          <h3>${exp.company}</h3>
          <span class="item-meta">${exp.period}</span>
        </div>
        <p class="item-meta" style="color:var(--terracotta); font-weight:600;">${exp.role} ${exp.badge ? '· ' + exp.badge : ''}</p>
        <p class="item-desc mt-2">${exp.description}</p>
        <ul style="font-size:12px; margin-left:16px; margin-bottom:12px; color:var(--text-muted);">
          ${(exp.responsibilities || []).map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      <div class="item-actions">
        <button class="btn-xs" onclick="addResponsibility(${idx})">+ Add Bullet</button>
      </div>
    </div>
  `).join('');
}

function addResponsibility(idx) {
  const resp = prompt("Enter new achievement or responsibility bullet:");
  if (resp) {
    contentCache['experience'][idx].responsibilities.push(resp);
    saveCategoryContent('experience', contentCache['experience']);
  }
}

// RESUME
function renderResume() {
  const resume = contentCache['resume'] || {};
  document.getElementById('resume-summary-input').value = resume.summary || '';
  document.getElementById('resume-rev-date').value = resume.revisionDate || '';
  
  // Render Skills
  const skillsWrap = document.getElementById('resume-skills-list');
  const skills = resume.technicalSkills || {};
  skillsWrap.innerHTML = Object.entries(skills).map(([group, list]) => `
    <div style="background:#FFF; border:1px solid var(--border-subtle); border-radius:8px; padding:10px;">
      <strong style="font-size:12px; font-family:var(--font-mono); color:var(--terracotta);">${group}</strong>
      <p style="font-size:12px; margin-top:4px; color:var(--text-muted);">${list.join(', ')}</p>
    </div>
  `).join('');
}

function saveResumeSummary() {
  if (!contentCache['resume']) contentCache['resume'] = {};
  contentCache['resume'].summary = document.getElementById('resume-summary-input').value;
  contentCache['resume'].revisionDate = document.getElementById('resume-rev-date').value;
  saveCategoryContent('resume', contentCache['resume']);
}

// WRITING
function renderWriting() {
  const container = document.getElementById('writing-list');
  const data = contentCache['writing'] || [];
  container.innerHTML = data.map((w, idx) => `
    <div class="item-card">
      <div>
        <div class="item-header">
          <h3>${w.title}</h3>
          <span class="item-meta">${w.readTime}</span>
        </div>
        <p class="item-meta">${w.categoryLabel || w.category} · ${w.dateFormatted}</p>
        <p class="item-desc mt-1">${w.excerpt}</p>
      </div>
      <div class="item-actions">
        <a class="btn-xs" href="${w.url}" target="_blank" style="text-decoration:none;">Open Link ↗</a>
        <button class="btn-xs btn-danger" onclick="deleteWriting(${idx})">Delete</button>
      </div>
    </div>
  `).join('');
}

function showAddWritingModal() {
  const title = prompt("Enter Article Title:");
  if (!title) return;
  const url = prompt("Enter URL:", "https://www.linkedin.com/pulse/...");
  const readTime = prompt("Read Time:", "5 min read");
  const excerpt = prompt("Short summary / excerpt:");

  const newPost = {
    id: 'post-' + Date.now(),
    slug: 'post-' + Date.now(),
    title,
    category: "ai-engineering",
    categoryLabel: "AI ENGINEERING",
    featured: false,
    date: new Date().toISOString().split('T')[0],
    dateFormatted: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    readTime: readTime || "5 min read",
    platform: "Technical Article",
    url: url || "https://www.linkedin.com/in/md-abdurrahman770",
    excerpt: excerpt || title
  };

  contentCache['writing'].unshift(newPost);
  saveCategoryContent('writing', contentCache['writing']);
}

function deleteWriting(idx) {
  if (confirm(`Delete post "${contentCache['writing'][idx].title}"?`)) {
    contentCache['writing'].splice(idx, 1);
    saveCategoryContent('writing', contentCache['writing']);
  }
}

// PROFILE
function renderProfile() {
  const p = contentCache['profile'] || {};
  document.getElementById('prof-name').value = p.name || '';
  document.getElementById('prof-title').value = p.title || '';
  document.getElementById('prof-spec').value = p.spec || '';
  document.getElementById('prof-hero-desc').value = p.heroDescription || '';
  document.getElementById('prof-phone').value = p.phone || '';
  document.getElementById('prof-email').value = p.email || '';
}

function saveProfile() {
  if (!contentCache['profile']) contentCache['profile'] = {};
  contentCache['profile'].name = document.getElementById('prof-name').value;
  contentCache['profile'].title = document.getElementById('prof-title').value;
  contentCache['profile'].spec = document.getElementById('prof-spec').value;
  contentCache['profile'].heroDescription = document.getElementById('prof-hero-desc').value;
  contentCache['profile'].phone = document.getElementById('prof-phone').value;
  contentCache['profile'].email = document.getElementById('prof-email').value;
  saveCategoryContent('profile', contentCache['profile']);
}

// Save helper
async function saveCategoryContent(category, data) {
  showToast(`Saving ${category}...`);
  try {
    const res = await fetch(`${API_BASE}/api/content/${category}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      showToast(`✓ Saved and rebuilt site!`, 'success');
      contentCache[category] = data;
      renderCurrentTab();
    } else {
      showToast(`Error: ${result.detail || 'Failed to save'}`, 'error');
    }
  } catch (e) {
    showToast(`Network error saving ${category}`, 'error');
  }
}

// Trigger Rebuild
async function triggerRebuild() {
  showToast("Rebuilding site...");
  try {
    const res = await fetch(`${API_BASE}/api/build`, { method: 'POST' });
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      showToast("✓ Site rebuilt successfully!", "success");
    } else {
      showToast("Build error: " + (result.stderr || result.message), "error");
    }
  } catch (e) {
    showToast("Failed to connect to build API", "error");
  }
}

// AI Copilot Integration
function initCopilot() {
  const promptInput = document.getElementById('ai-prompt-input');
  const targetSelect = document.getElementById('ai-target-select');
  const providerSelect = document.getElementById('ai-provider-select');
  const apiKeyInput = document.getElementById('ai-apikey-input');

  // Load saved API key
  const savedKey = localStorage.getItem('portfolio_ai_key');
  if (savedKey && apiKeyInput) apiKeyInput.value = savedKey;

  if (apiKeyInput) {
    apiKeyInput.addEventListener('change', () => {
      localStorage.setItem('portfolio_ai_key', apiKeyInput.value.trim());
    });
  }

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      targetSelect.value = chip.getAttribute('data-target') || 'auto';
    });
  });

  document.getElementById('btn-run-ai').addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert("Please enter an instruction prompt.");
      return;
    }

    showToast("AI analyzing and drafting updates...");
    document.getElementById('ai-diff-card').style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/api/ai/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          target: targetSelect.value,
          provider: providerSelect.value,
          apiKey: apiKeyInput ? apiKeyInput.value.trim() : ''
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast("Error: " + (data.detail || "AI request failed"), "error");
        return;
      }

      pendingAiUpdate = data;
      renderDiff(data);
      showToast("✓ AI generated proposal. Review diff below.", "success");
    } catch (e) {
      showToast("Failed to communicate with AI API", "error");
    }
  });

  document.getElementById('btn-apply-ai-diff').addEventListener('click', async () => {
    if (!pendingAiUpdate) return;
    const { target, after } = pendingAiUpdate;
    await saveCategoryContent(target, after);
    document.getElementById('ai-diff-card').style.display = 'none';
    pendingAiUpdate = null;
    showToast(`✓ Applied AI changes to ${target}!`, "success");
  });
}

function renderDiff(data) {
  const card = document.getElementById('ai-diff-card');
  const targetLabel = document.getElementById('diff-target-label');
  const viewer = document.getElementById('diff-viewer');

  targetLabel.innerText = `Proposed changes for: content/${data.target}.json (${data.provider})`;
  
  const beforeStr = JSON.stringify(data.before, null, 2);
  const afterStr = JSON.stringify(data.after, null, 2);

  // Compute simple visual line diff
  const beforeLines = beforeStr.split('\n');
  const afterLines = afterStr.split('\n');

  let diffHtml = '';
  afterLines.forEach(line => {
    if (!beforeLines.includes(line)) {
      diffHtml += `<span class="diff-add">+ ${escapeHtml(line)}</span>`;
    } else {
      diffHtml += `  ${escapeHtml(line)}\n`;
    }
  });

  viewer.innerHTML = diffHtml;
  card.style.display = 'block';
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// PDF Upload Handler
function initPdfUpload() {
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file-input');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    showToast("Uploading resume.pdf...");
    try {
      const res = await fetch(`${API_BASE}/api/upload-pdf`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✓ resume.pdf updated & site synced!", "success");
      } else {
        showToast("Error: " + data.detail, "error");
      }
    } catch (e) {
      showToast("Upload failed", "error");
    }
  });
}

// Toast
function showToast(msg, type = 'info') {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      transition: all 200ms ease;
    `;
    document.body.appendChild(toast);
  }

  toast.innerText = msg;
  if (type === 'success') {
    toast.style.background = '#2D6A4F';
    toast.style.color = '#FFF';
  } else if (type === 'error') {
    toast.style.background = '#C53030';
    toast.style.color = '#FFF';
  } else {
    toast.style.background = '#2A1D17';
    toast.style.color = '#FAF7F2';
  }

  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3200);
}

#!/usr/bin/env python3
"""
admin/server.py
FastAPI Admin Backend for AI Portfolio Management
Runs on port 8081. Serves:
  - Content CRUD APIs (/api/content/*)
  - AI Copilot Agent API (/api/ai/copilot)
  - Site Builder trigger (/api/build)
  - PDF Resume upload (/api/upload-pdf)
  - Admin Dashboard UI (/admin)
  - Portfolio static pages (/ and all assets)
"""

import os
import json
import shutil
import time
import subprocess
import sys
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(BASE_DIR, 'content')
BACKUP_DIR = os.path.join(CONTENT_DIR, 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

app = FastAPI(title="AI Portfolio Admin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_CATEGORIES = ['profile', 'experience', 'projects', 'resume', 'writing']

def get_content_path(category: str) -> str:
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    return os.path.join(CONTENT_DIR, f"{category}.json")

def backup_file(category: str):
    source = get_content_path(category)
    if os.path.exists(source):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, f"{category}_{timestamp}.json")
        shutil.copy2(source, backup_path)

@app.get("/api/content/{category}")
def get_content(category: str):
    path = get_content_path(category)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Content not found")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.post("/api/content/{category}")
def save_content(category: str, data: Any = Body(...), auto_build: bool = True):
    path = get_content_path(category)
    backup_file(category)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    build_result = None
    if auto_build:
        build_result = run_build_script()

    return {
        "status": "success",
        "message": f"Saved {category}.json successfully.",
        "build": build_result
    }

def run_build_script():
    build_script = os.path.join(BASE_DIR, 'tools', 'build_site.py')
    if not os.path.exists(build_script):
        return {"status": "error", "message": "build_site.py not found"}
    try:
        res = subprocess.run(
            [sys.executable, build_script],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=30
        )
        return {
            "status": "success" if res.returncode == 0 else "error",
            "stdout": res.stdout,
            "stderr": res.stderr
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/build")
def trigger_build():
    result = run_build_script()
    return result

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    target_path = os.path.join(BASE_DIR, 'resume.pdf')
    # Backup existing resume.pdf
    if os.path.exists(target_path):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(target_path, os.path.join(BACKUP_DIR, f"resume_{ts}.pdf"))
    
    with open(target_path, 'wb') as f:
        content = await file.read()
        f.write(content)
        
    run_build_script()
    return {"status": "success", "message": "Uploaded resume.pdf successfully", "bytes": len(content)}

# AI Copilot Logic
SYSTEM_PROMPT = """You are an expert AI Portfolio Manager. Your job is to update an AI Engineer's portfolio content JSON based on the user's natural language request.
Always preserve existing data accuracy and tone. Return ONLY a valid JSON object matching the requested schema. Do not include markdown code block backticks. Return pure JSON only.
"""

@app.post("/api/ai/copilot")
def ai_copilot(payload: Dict[str, Any] = Body(...)):
    prompt = payload.get("prompt", "").strip()
    target = payload.get("target", "auto")
    provider = payload.get("provider", "local")
    api_key = payload.get("apiKey", "")

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Detect target if auto
    if target == "auto":
        lower = prompt.lower()
        if any(w in lower for w in ["project", "github", "mcp", "rag app", "bot", "repo"]):
            target = "projects"
        elif any(w in lower for w in ["experience", "role", "job", "company", "betopia", "work"]):
            target = "experience"
        elif any(w in lower for w in ["resume", "skill", "education", "publication", "award"]):
            target = "resume"
        elif any(w in lower for w in ["article", "blog", "writing", "post", "note"]):
            target = "writing"
        else:
            target = "profile"

    current_data = get_content(target)

    # 1. External LLM Provider Mode (Gemini / OpenAI / Anthropic)
    if provider == "gemini" and api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            req_body = {
                "contents": [{
                    "parts": [{
                        "text": f"{SYSTEM_PROMPT}\n\nTarget content category: {target}\nCurrent JSON state:\n{json.dumps(current_data, indent=2)}\n\nUser instruction:\n{prompt}\n\nProduce the complete updated JSON for {target}:"
                    }]
                }],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            resp = requests.post(url, json=req_body, timeout=30)
            res_json = resp.json()
            raw_text = res_json['candidates'][0]['content']['parts'][0]['text']
            updated_data = json.loads(raw_text)
            return {
                "status": "success",
                "target": target,
                "provider": "gemini",
                "before": current_data,
                "after": updated_data
            }
        except Exception as e:
            # Fallback to local heuristic
            pass

    if provider == "openai" and api_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            req_body = {
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Target content category: {target}\nCurrent JSON state:\n{json.dumps(current_data, indent=2)}\n\nUser instruction:\n{prompt}\n\nProduce the complete updated JSON for {target}:"}
                ],
                "response_format": {"type": "json_object"}
            }
            resp = requests.post(url, headers=headers, json=req_body, timeout=30)
            res_json = resp.json()
            raw_text = res_json['choices'][0]['message']['content']
            updated_data = json.loads(raw_text)
            return {
                "status": "success",
                "target": target,
                "provider": "openai",
                "before": current_data,
                "after": updated_data
            }
        except Exception as e:
            pass

    # 2. Built-in Local Heuristic Engine (zero API key needed for instant usability!)
    updated_data = json.loads(json.dumps(current_data))  # deep copy

    if target == "projects":
        # Check if adding a project
        new_project = {
            "id": f"proj-{int(time.time())}",
            "category": "AI ENGINEERING · PRODUCTION",
            "index": f"NODE 0{len(updated_data) + 1}",
            "title": "New AI Project",
            "desc": prompt,
            "contrib": "Engineered core modules and optimized inference pipeline.",
            "highlights": [
                "Low-latency architecture with optimized runtime",
                "Integrated evaluation benchmarks and telemetry",
                "Containerized deployment with automated health checks"
            ],
            "tags": ["Python", "LLMs", "FastAPI"],
            "status": "STATUS: ACTIVE",
            "metaLeft": "Category: AI Systems",
            "metaRight": "Status: Deployed",
            "featured": False
        }
        # Try to extract title from quotes or prompt
        if '"' in prompt or "'" in prompt:
            extracted_title = prompt.split('"')[1] if '"' in prompt else prompt.split("'")[1]
            new_project["title"] = extracted_title
        elif ":" in prompt:
            new_project["title"] = prompt.split(":")[0].replace("Add", "").replace("add", "").strip()

        updated_data.append(new_project)

    elif target == "experience":
        # Append responsibility to current role
        if isinstance(updated_data, list) and len(updated_data) > 0:
            clean_resp = prompt.replace("Add", "").replace("add", "").strip()
            if clean_resp.startswith("to "):
                clean_resp = clean_resp[3:].strip()
            updated_data[0]["responsibilities"].append(clean_resp)

    elif target == "writing":
        new_article = {
            "id": f"article-{int(time.time())}",
            "slug": f"article-{int(time.time())}",
            "title": prompt.split('"')[1] if '"' in prompt else (prompt[:60] + "..."),
            "category": "ai-engineering",
            "categoryLabel": "AI ENGINEERING",
            "featured": False,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "dateFormatted": datetime.now().strftime("%b %d, %Y"),
            "readTime": "5 min read",
            "platform": "Technical Article",
            "url": "https://www.linkedin.com/in/md-abdurrahman770",
            "excerpt": prompt
        }
        updated_data.append(new_article)

    elif target == "resume":
        # Check if adding achievement or publication
        if "achievement" in prompt.lower() or "award" in prompt.lower():
            clean_achieve = prompt.replace("Add", "").replace("add", "").strip()
            updated_data.setdefault("achievements", []).append(clean_achieve)
        elif "pub" in prompt.lower() or "paper" in prompt.lower():
            updated_data.setdefault("publications", []).append({
                "citation": prompt.replace("Add", "").replace("add", "").strip(),
                "date": datetime.now().strftime("%b %Y")
            })
        else:
            clean_skill = prompt.replace("Add skill", "").replace("add skill", "").strip()
            updated_data.setdefault("technicalSkills", {}).setdefault("AI / ML", []).append(clean_skill)

    elif target == "profile":
        if "spec" in prompt.lower():
            updated_data["spec"] = prompt.split(":")[-1].strip()
        elif "bio" in prompt.lower() or "desc" in prompt.lower():
            updated_data["heroDescription"] = prompt.split(":")[-1].strip()

    return {
        "status": "success",
        "target": target,
        "provider": "local-rule-engine",
        "before": current_data,
        "after": updated_data
    }

# Serve Admin static UI
ADMIN_DIR = os.path.join(BASE_DIR, 'admin')
app.mount("/admin", StaticFiles(directory=ADMIN_DIR, html=True), name="admin")

# Serve Root Portfolio files
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="portfolio")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print(">> AI Portfolio Admin Server running at: http://localhost:8081/admin")
    print(">> Live Portfolio served at: http://localhost:8081/")
    print("="*60 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="info")

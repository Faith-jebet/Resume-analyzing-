from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
import os
import io

MAIN_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(MAIN_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
AGENT_DIR = os.path.join(PROJECT_ROOT, "Agent")

if AGENT_DIR not in sys.path:
    sys.path.insert(0, AGENT_DIR)

print(f"Main.py location: {MAIN_DIR}")
print(f"Project root: {PROJECT_ROOT}")
print(f"Agent directory: {AGENT_DIR}")
print(f"Agent directory exists: {os.path.exists(AGENT_DIR)}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Text extraction helpers ──────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc).strip()
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs).strip()
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return ""


def extract_text(filename: str, file_bytes: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_bytes)
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    return ""


# ── Models ───────────────────────────────────────────────────────────────────

class GmailFetchRequest(BaseModel):
    subject: Optional[str] = "Resume Analyzing"


class GmailCandidate(BaseModel):
    candidate_name: str
    email: Optional[str] = ""
    resume_text: Optional[str] = ""
    source: Optional[str] = "gmail"
    years_experience: Optional[int] = 0
    education: Optional[dict] = {"degree": "Not specified", "university": "Not specified"}
    skills: Optional[list] = []
    tools: Optional[list] = []
    projects: Optional[list] = []
    soft_skills: Optional[list] = []


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "RecruitAI API is running"}


@app.post("/api/gmail/fetch")
def fetch_gmail_resumes(request: GmailFetchRequest):
    """Fetch resumes from Gmail using the agent's gmail tool"""
    try:
        from my_agent.tools.gmail_tool import fetch_resumes_from_gmail
        print("✅ Successfully imported gmail tool")

        resumes = fetch_resumes_from_gmail(subject=request.subject)
        print(f"📧 Fetched {len(resumes)} resumes from Gmail")

        candidates = []
        for resume in resumes:
            candidate = {
                "candidate_name": (
                    resume.get("filename", "Unknown")
                    .replace(".pdf", "").replace(".txt", "").replace(".docx", "")
                    .replace("_", " ").strip()
                ),
                "email": "",
                "resume_text": resume.get("resume_text", ""),
                "source": "gmail",
                "years_experience": 0,
                "education": {"degree": "Not specified", "university": "Not specified"},
                "skills": [],
                "tools": [],
                "projects": [],
                "soft_skills": [],
            }
            candidates.append(candidate)

        return {"success": True, "count": len(candidates), "candidates": candidates}

    except Exception as e:
        print(f"Gmail fetch error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/match")
async def match_candidates(
    job_title: str = Form(...),
    job_description: Optional[UploadFile] = File(None),
    resumes: List[UploadFile] = File(default=[]),
    gmail_candidates: Optional[str] = Form(None),   # JSON string
):
    """
    Match candidates against job requirements.
    Accepts:
      - job_title        : plain text form field
      - job_description  : optional JD file (PDF/DOCX/TXT)
      - resumes          : one or more resume files
      - gmail_candidates : JSON array of candidates already fetched from Gmail
    """
    try:
        from .services.agent_bridge import run_matching_pipeline

        # 1. Extract JD text
        jd_text = ""
        if job_description and job_description.filename:
            jd_bytes = await job_description.read()
            jd_text = extract_text(job_description.filename, jd_bytes)
            print(f"📄 JD extracted ({len(jd_text)} chars) from: {job_description.filename}")

        # 2. Extract text from uploaded resume files
        uploaded_candidates = []
        for resume_file in resumes:
            if not resume_file.filename:
                continue
            resume_bytes = await resume_file.read()
            resume_text = extract_text(resume_file.filename, resume_bytes)
            candidate_name = (
                resume_file.filename
                .rsplit(".", 1)[0]
                .replace("_", " ")
                .replace("-", " ")
                .strip()
            )
            uploaded_candidates.append({
                "candidate_name": candidate_name,
                "email": "",
                "resume_text": resume_text,
                "source": "upload",
                "years_experience": 0,
                "education": {"degree": "Not specified", "university": "Not specified"},
                "skills": [],
                "tools": [],
                "projects": [],
                "soft_skills": [],
            })
            print(f"📝 Resume extracted ({len(resume_text)} chars): {resume_file.filename}")

        # 3. Parse Gmail candidates from JSON string
        gmail_list = []
        if gmail_candidates:
            import json
            try:
                gmail_list = json.loads(gmail_candidates)
                print(f"📧 Gmail candidates received: {len(gmail_list)}")
            except json.JSONDecodeError as e:
                print(f"⚠️ Failed to parse gmail_candidates JSON: {e}")

        # 4. Combine all candidates
        all_candidates = uploaded_candidates + gmail_list
        print(f"🚀 Total candidates to rank: {len(all_candidates)}")

        if not all_candidates:
            raise HTTPException(status_code=400, detail="No candidates provided.")

        # 5. Run pipeline
        result = run_matching_pipeline(
            job_title=job_title,
            candidates=all_candidates,
            job_description_text=jd_text,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Matching error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
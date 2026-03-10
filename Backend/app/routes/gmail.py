from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional


router = APIRouter()

class GmailFetchRequest(BaseModel):
    subject: Optional[str] = "Resume Analyzing"
    
@router.post("/gmail/fetch")
def fetch_gmail_resumes(request: GmailFetchRequest):
    """Fetch resumes from gmail using the agent's gmail tool"""
    try: 
        from ....Agent.my_agent.tools import fetch_resumes_from_gmail
        
        # fetch resumes from gmail
        resumes = fetch_resumes_from_gmail(subject=request.subject)
        
        # transform to candidate format
        candidates = []
        for resume in resumes:
            candidate = {
                "candidate_name": resume.get("filename", "Unknown").replace(".pdf", "").replace(".txt", "").replace(".docx", "").replace("_", " ").strip(),
                "resume_text": resume.get("resume_text", ""),
                "source": "gmail",
                "years_experience": 0,
                "education": {},
                "skills": [],
                "tools": [],
                "projects": [],
                "soft_skills": []
            }
            candidates.append(candidate)
        
        # Return statement should be OUTSIDE the for loop
        return {
            "success": True,
            "count": len(candidates),
            "candidates": candidates
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
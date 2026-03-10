from fastapi import APIRouter
from pydantic import BaseModel
from app.services.agent_bridge import run_matching_pipeline

router = APIRouter()

# Request Schemas

class Candidate(BaseModel):
    candidate_name: str
    email: str
    years_experience: int
    education: dict
    skills: list
    tools: list
    projects: list
    soft_skills: list
    source: str = "upload"
    resume_text: str = ""
    attachement_name: str = ""
    
class MatchRequest(BaseModel):
    job_title: str
    candidates: list[Candidate]
    raw_candidates: list[Candidate]
    
    # API endpoint
@router.post("/match")
def match_candidates(request: MatchRequest):
    return run_matching_pipeline(
        job_title=request.job_title,
        candidates=[candidate.dict() for candidate in request.candidates]
     )
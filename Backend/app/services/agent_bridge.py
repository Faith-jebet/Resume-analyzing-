import os
import sys
import json
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# ── Load .env FIRST before anything else ─────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AGENT_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../../Agent"))

agent_env = Path(AGENT_PATH) / "my_agent" / ".env"
backend_env = Path(BASE_DIR).parents[1] / ".env"

if agent_env.exists():
    load_dotenv(dotenv_path=agent_env, override=True)
    print(f"✅ Loaded .env from: {agent_env}")
elif backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=True)
    print(f"✅ Loaded .env from: {backend_env}")
else:
    print(f"⚠️ No .env file found!")

api_key = os.environ.get("GOOGLE_API_KEY")
print(f"API KEY SET: {bool(api_key)}")
if not api_key:
    raise EnvironmentError(
        "❌ GOOGLE_API_KEY not found!\n"
        f"   Make sure it exists in: {agent_env}\n"
        "   Format: GOOGLE_API_KEY=AIzaSy..."
    )

# ── Path setup ────────────────────────────────────────────────────────────────
if AGENT_PATH not in sys.path:
    sys.path.insert(0, AGENT_PATH)

print(f"📂 Agent path: {AGENT_PATH}")

# ── Agent imports ─────────────────────────────────────────────────────────────
try:
    from my_agent.sub_agents.job_requirements import job_requirements_agent
    from my_agent.sub_agents.job_matcher import job_matcher_agent
    from my_agent.sub_agents.ranker import ranking_agent
    from my_agent.sub_agents.resume_parser import resume_parser_agent
    from my_agent.sub_agents.reporter import reporter_agent
    print("✅ All agents imported successfully")
except ImportError as e:
    print(f"❌ Failed to import agents: {e}")
    raise


# ── ADK import helper ─────────────────────────────────────────────────────────
def _get_adk():
    Runner = None
    InMemorySessionService = None

    for runner_path in [
        ("google.adk.runners", "Runner"),
        ("google.adk", "Runner"),
        ("google.adk.runner", "Runner"),
    ]:
        try:
            mod = __import__(runner_path[0], fromlist=[runner_path[1]])
            Runner = getattr(mod, runner_path[1])
            break
        except (ImportError, AttributeError):
            continue

    for session_path in [
        ("google.adk.sessions", "InMemorySessionService"),
        ("google.adk.memory", "InMemorySessionService"),
        ("google.adk", "InMemorySessionService"),
    ]:
        try:
            mod = __import__(session_path[0], fromlist=[session_path[1]])
            InMemorySessionService = getattr(mod, session_path[1])
            break
        except (ImportError, AttributeError):
            continue

    if Runner is None or InMemorySessionService is None:
        raise ImportError(
            "Could not import ADK Runner or InMemorySessionService. "
            "Run: pip show google-adk  to check your version."
        )

    from google.genai import types as genai_types
    return Runner, InMemorySessionService, genai_types


# ── Core ADK call helper ──────────────────────────────────────────────────────
async def call_agent_async(agent, prompt: str, retries: int = 3) -> str:
    """Run a Google ADK Agent. Each sub-agent is called directly — no tool calls."""
    Runner, InMemorySessionService, genai_types = _get_adk()

    for attempt in range(retries):
        try:
            session_service = InMemorySessionService()
            app_name = f"bridge_{agent.name}"
            user_id = "system"
            session_id = f"sess_{agent.name}_{abs(hash(prompt)) % 1_000_000}_{attempt}"

            await session_service.create_session(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id,
            )

            runner = Runner(
                agent=agent,
                app_name=app_name,
                session_service=session_service,
            )

            message = genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=prompt)],
            )

            full_text = ""
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message,
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    full_text = "".join(
                        part.text
                        for part in event.content.parts
                        if hasattr(part, "text") and part.text is not None
                    )

            return full_text.strip()

        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str

            if is_rate_limit and attempt < retries - 1:
                # Wait for quota window to reset (60s per minute window + buffer)
                wait = 65
                print(f"  ⏳ Rate limited (attempt {attempt + 1}/{retries}), retrying in {wait}s...")
                await asyncio.sleep(wait)
                continue
            else:
                raise

    return ""


def call_agent(agent, prompt: str) -> str:
    """Sync wrapper — safe inside FastAPI's running event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, call_agent_async(agent, prompt))
                return future.result(timeout=600)
        else:
            return loop.run_until_complete(call_agent_async(agent, prompt))
    except RuntimeError:
        return asyncio.run(call_agent_async(agent, prompt))


def parse_json_response(text: str) -> dict:
    """Extract and parse JSON from an agent response string."""
    if not text:
        return {}
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    print(f"⚠️ Could not parse JSON: {text[:300]}")
    return {}


# ── Default ranking criteria (fallback) ───────────────────────────────────────
DEFAULT_RANKING_CRITERIA = {
    "factors": [
        {"name": "Skill match",        "weight": 40, "description": "How closely the candidate's skills align with the job requirements."},
        {"name": "Years of experience","weight": 25, "description": "Whether the candidate's years of experience meets the role's expectations."},
        {"name": "Education",          "weight": 15, "description": "Relevance of the candidate's degree and field of study to the role."},
        {"name": "Cultural signals",   "weight": 20, "description": "Evidence of leadership, collaboration, and communication from the resume."},
    ],
    "summary": "",
}

# ── Inter-request delay to stay under free-tier 10 req/min limit ─────────────
# 10 requests/min = 1 request every 6s. We use 7s to be safe.
_REQUEST_DELAY_SECONDS = 7
_request_count = 0

def _throttle():
    """Call before every agent request to enforce rate limiting."""
    global _request_count
    _request_count += 1
    if _request_count > 1:
        import time
        time.sleep(_REQUEST_DELAY_SECONDS)


# ── Pipeline ──────────────────────────────────────────────────────────────────
def run_matching_pipeline(
    job_title: str,
    candidates: list,
    job_description_text: str = "",
) -> dict:
    global _request_count
    _request_count = 0  # reset counter for each pipeline run

    print(f"🚀 Starting pipeline for: {job_title}")
    print(f"📊 Candidates: {len(candidates)}")
    print(f"📄 JD provided: {'yes' if job_description_text else 'no'}")

    # ── Step 1: Job requirements ──────────────────────────────────────────────
    print("📋 Step 1: Generating job requirements...")
    try:
        if job_description_text:
            prompt = (
                f"Extract structured job requirements from the following.\n\n"
                f"Job Title: {job_title}\n\n"
                f"Job Description:\n{job_description_text}\n\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "title, required_skills, preferred_skills, experience_years, "
                "education, responsibilities.\n"
                "No explanation. No markdown. Raw JSON only."
            )
        else:
            prompt = (
                f"Generate realistic structured job requirements for this role.\n\n"
                f"Job Title: {job_title}\n\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "title, required_skills, preferred_skills, experience_years, "
                "education, responsibilities.\n"
                "No explanation. No markdown. Raw JSON only."
            )
        _throttle()
        response = call_agent(job_requirements_agent, prompt)
        job_req = parse_json_response(response)
        if not job_req:
            job_req = {"title": job_title, "job_description": job_description_text}
        print(f"✅ Job requirements ready: {list(job_req.keys())}")
    except Exception as e:
        print(f"❌ Job requirements error: {e}")
        job_req = {"title": job_title, "job_description": job_description_text}

    # ── Step 2: Parse resumes ─────────────────────────────────────────────────
    print("📝 Step 2: Parsing resumes...")
    parsed_candidates = []
    for idx, candidate in enumerate(candidates):
        resume_text = candidate.get("resume_text", "").strip()
        name = candidate.get("candidate_name", f"Candidate {idx + 1}")
        if resume_text:
            try:
                prompt = (
                    f"Parse this resume into structured data.\n\n"
                    f"Candidate name: {name}\n\n"
                    f"Resume:\n{resume_text}\n\n"
                    "Return ONLY a JSON object with these exact keys:\n"
                    "candidate_name, email, years_experience (integer), "
                    "education (object with degree and university), "
                    "skills (list), tools (list), projects (list), soft_skills (list).\n"
                    "No explanation. No markdown. Raw JSON only."
                )
                _throttle()
                response = call_agent(resume_parser_agent, prompt)
                parsed = parse_json_response(response)
                if parsed:
                    merged = {**candidate, **parsed}
                    merged["candidate_name"] = name
                    merged["source"] = candidate.get("source", "upload")
                    merged["resume_text"] = resume_text
                    parsed_candidates.append(merged)
                    print(f"  ✅ Parsed: {name}")
                else:
                    parsed_candidates.append(candidate)
            except Exception as e:
                print(f"  ⚠️ Parse error for {name}: {e}")
                parsed_candidates.append(candidate)
        else:
            parsed_candidates.append(candidate)
    print(f"✅ Parsed {len(parsed_candidates)} candidates")

    # ── Step 3: Match candidates ──────────────────────────────────────────────
    print("🔍 Step 3: Matching candidates...")
    matched_candidates = []
    for idx, candidate in enumerate(parsed_candidates):
        name = candidate.get("candidate_name", f"Candidate {idx + 1}")
        print(f"  Matching {idx + 1}/{len(parsed_candidates)}: {name}")
        try:
            profile = {k: v for k, v in candidate.items() if k != "resume_text"}
            prompt = (
                f"Score how well this candidate matches the job requirements.\n\n"
                f"Job Requirements:\n{json.dumps(job_req, indent=2)}\n\n"
                f"Candidate Profile:\n{json.dumps(profile, indent=2)}\n\n"
                "Return ONLY a JSON object with these exact keys:\n"
                "match_score (integer 0-100), justification (string).\n"
                "No explanation. No markdown. Raw JSON only."
            )
            _throttle()
            response = call_agent(job_matcher_agent, prompt)
            result = parse_json_response(response)
            matched_candidates.append({
                **candidate,
                "match_score": int(result.get("match_score", 0)),
                "match_details": {"justification": result.get("justification", "")},
            })
        except Exception as e:
            print(f"  ⚠️ Match error for {name}: {e}")
            matched_candidates.append({**candidate, "match_score": 0, "match_details": {"error": str(e)}})
    print(f"✅ Matched {len(matched_candidates)} candidates")

    # ── Step 4: Rank ──────────────────────────────────────────────────────────
    print("📊 Step 4: Ranking...")
    try:
        slim = [
            {"candidate_name": c.get("candidate_name"), "match_score": c.get("match_score", 0)}
            for c in matched_candidates
        ]
        prompt = (
            f"Rank these candidates by match_score from highest to lowest.\n\n"
            f"{json.dumps(slim, indent=2)}\n\n"
            'Return ONLY a JSON object: { "ranked_names": ["name1", "name2", ...] }\n'
            "No explanation. No markdown. Raw JSON only."
        )
        _throttle()
        response = call_agent(ranking_agent, prompt)
        result = parse_json_response(response)
        if result and "ranked_names" in result:
            order = {n: i for i, n in enumerate(result["ranked_names"])}
            matched_candidates.sort(key=lambda c: order.get(c.get("candidate_name"), 999))
        else:
            matched_candidates.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        print("✅ Ranking complete")
    except Exception as e:
        print(f"⚠️ Ranking error: {e} — sorting by score")
        matched_candidates.sort(key=lambda x: x.get("match_score", 0), reverse=True)

    # ── Step 5: Reporter ──────────────────────────────────────────────────────
    print("📝 Step 5: Generating ranking criteria report...")
    ranking_criteria = DEFAULT_RANKING_CRITERIA.copy()

    try:
        slim_ranked = [
            {
                "candidate_name": c.get("candidate_name"),
                "match_score": c.get("match_score", 0),
                "match_details": c.get("match_details", {}),
                "skills": c.get("skills", []),
                "years_experience": c.get("years_experience", 0),
            }
            for c in matched_candidates
        ]
        prompt = (
            f"Write a recruitment ranking report.\n\n"
            f"Job Title: {job_title}\n\n"
            f"Ranked candidates:\n{json.dumps(slim_ranked, indent=2)}\n\n"
            "Return ONLY a JSON object with these exact keys:\n"
            "{\n"
            '  "factors": [\n'
            '    { "name": "Skill match",        "weight": 40, "description": "..." },\n'
            '    { "name": "Years of experience","weight": 25, "description": "..." },\n'
            '    { "name": "Education",          "weight": 15, "description": "..." },\n'
            '    { "name": "Cultural signals",   "weight": 20, "description": "..." }\n'
            "  ],\n"
            '  "summary": "One sentence naming the top candidate and why they ranked first."\n'
            "}\n"
            "No explanation. No markdown. Raw JSON only."
        )
        _throttle()
        response = call_agent(reporter_agent, prompt)
        parsed_criteria = parse_json_response(response)

        if parsed_criteria and "factors" in parsed_criteria and "summary" in parsed_criteria:
            ranking_criteria = parsed_criteria
            print("✅ Ranking criteria generated by reporter_agent")
        else:
            if matched_candidates:
                top = matched_candidates[0]
                ranking_criteria["summary"] = (
                    f"{top.get('candidate_name', 'The top candidate')} ranked first with a match score of "
                    f"{top.get('match_score', 0)}%, demonstrating the strongest alignment with the job requirements."
                )
            print("⚠️ Reporter returned incomplete data — using default criteria")

    except Exception as e:
        print(f"⚠️ Reporter error: {e} — using default ranking criteria")
        if matched_candidates:
            top = matched_candidates[0]
            ranking_criteria["summary"] = (
                f"{top.get('candidate_name', 'The top candidate')} ranked first with a match score of "
                f"{top.get('match_score', 0)}%, demonstrating the strongest alignment with the job requirements."
            )

    print(f"✅ Pipeline complete — {len(matched_candidates)} candidates ranked")

    return {
        "candidates": matched_candidates,
        "ranking_criteria": ranking_criteria,
    }
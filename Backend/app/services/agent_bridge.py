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
            f"Could not import ADK Runner or InMemorySessionService. "
            f"Run: pip show google-adk  to check your version."
        )

    from google.genai import types as genai_types
    return Runner, InMemorySessionService, genai_types


# ── Core ADK call helper with retry on 429 ───────────────────────────────────
async def call_agent_async(agent, prompt: str, retries: int = 3) -> str:
    """Run a Google ADK Agent with automatic retry on 429 rate limit errors."""
    Runner, InMemorySessionService, genai_types = _get_adk()

    for attempt in range(retries):
        try:
            session_service = InMemorySessionService()
            app_name = f"bridge_{agent.name}"
            user_id = "system"
            # Unique session per attempt to avoid session reuse errors
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
                        part.text for part in event.content.parts if hasattr(part, "text")
                        and part.text is not None
                    )

            return full_text.strip()

        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str

            if is_rate_limit and attempt < retries - 1:
                wait = 65 * (attempt + 1)  # 65s → 130s → 195s
                print(f"  ⏳ Rate limited (attempt {attempt + 1}/{retries}), retrying in {wait}s...")
                await asyncio.sleep(1)
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
                return future.result(timeout=600)  # 10min to allow for retries
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


# ── Pipeline ──────────────────────────────────────────────────────────────────
def run_matching_pipeline(
    job_title: str,
    candidates: list,
    job_description_text: str = "",
) -> dict:
    print(f"🚀 Starting pipeline for: {job_title}")
    print(f"📊 Candidates: {len(candidates)}")
    print(f"📄 JD provided: {'yes' if job_description_text else 'no'}")

    # ── Step 1: Job requirements ──────────────────────────────────────────────
    print("📋 Step 1: Generating job requirements...")
    try:
        if job_description_text:
            prompt = (
                f"Job Title: {job_title}\n\n"
                f"Job Description:\n{job_description_text}\n\n"
                "Extract the key requirements from this job description. "
                "Return JSON only with keys: title, required_skills, preferred_skills, "
                "experience_years, education, responsibilities."
            )
        else:
            prompt = (
                f"Job Title: {job_title}\n\n"
                "Generate realistic job requirements for this role. "
                "Return JSON only with keys: title, required_skills, preferred_skills, "
                "experience_years, education, responsibilities."
            )
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
                    f"Parse this resume for {name}.\n\n"
                    f"Resume:\n{resume_text}\n\n"
                    "Return JSON only with keys: candidate_name, email, "
                    "years_experience (integer), education (object with degree and university), "
                    "skills (list), tools (list), projects (list), soft_skills (list)."
                )
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
                f"Job Requirements:\n{json.dumps(job_req, indent=2)}\n\n"
                f"Candidate Profile:\n{json.dumps(profile, indent=2)}\n\n"
                "Score how well this candidate matches the job requirements. "
                "Return JSON only with keys: match_score (integer 0-100), justification (string)."
            )
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

    # ── Step 4: Rank
    print("📊 Step 4: Ranking...")
    try:
        slim = [
            {"candidate_name": c.get("candidate_name"), "match_score": c.get("match_score", 0)}
            for c in matched_candidates
        ]
        prompt = (
            f"Rank these candidates by match_score from highest to lowest.\n\n"
            f"{json.dumps(slim, indent=2)}\n\n"
            'Return JSON only: { "ranked_names": [list of candidate_name strings, best first] }'
        )
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

    return {"candidates": matched_candidates}
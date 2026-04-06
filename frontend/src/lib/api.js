const API_BASE = import.meta.env.VITE_API_URL || "https://recruitai-backend-418779851337.us-central1.run.app";

/**
 * Send real resume files + JD file to the backend for AI ranking.
 *
 * @param {string}   jobTitle        - The job title entered by the user
 * @param {File[]}   resumeFiles     - Array of File objects (PDF/DOCX)
 * @param {File|null} jdFile         - Job description file (PDF/DOCX/TXT), optional
 * @param {object[]} gmailCandidates - Candidates already fetched from Gmail
 */
export async function matchCandidates(
  jobTitle,
  resumeFiles = [],
  jdFile = null,
  gmailCandidates = []
) {
  const formData = new FormData();

  // Job title (required)
  formData.append("job_title", jobTitle);

  // Resume files
  resumeFiles.forEach((file) => {
    formData.append("resumes", file);
  });

  // Job description file (optional)
  if (jdFile) {
    formData.append("job_description", jdFile);
  }

  // Gmail candidates as JSON string
  if (gmailCandidates.length > 0) {
    formData.append("gmail_candidates", JSON.stringify(gmailCandidates));
  }

  const response = await fetch(`${API_BASE}/api/match`, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type — browser sets it automatically with boundary
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch resumes from Gmail via the backend.
 *
 * @param {string} subject - Email subject filter
 */
export async function fetchGmailResumes(subject = "Resume Analyzing") {
  const response = await fetch(`${API_BASE}/api/gmail/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Server error: ${response.status}`);
  }

  return response.json();
}
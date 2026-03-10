import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUpload } from './components/FileUpload';
import { GmailImport } from './components/GmailImport';
import { CandidateTable } from './components/CandidateTable';
import { matchCandidates } from './lib/api';
import { LayoutList, FilePlus, Sparkles, UserCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { cn } from './lib/utils';

function App() {
  const [jobTitle, setJobTitle]       = useState('');
  const [activeTab, setActiveTab]     = useState('Dashboard');
  const [resumes, setResumes]         = useState([]);       // File objects
  const [jdFile, setJdFile]           = useState(null);     // Single JD File object
  const [isRanking, setIsRanking]     = useState(false);
  const [candidates, setCandidates]   = useState([]);
  const [gmailCandidates, setGmailCandidates] = useState([]);
  const [error, setError]             = useState(null);

  // ── Gmail import ──────────────────────────────────────────────────────────
  const handleGmailImport = (importedCandidates) => {
    if (importedCandidates && importedCandidates.length > 0) {
      setGmailCandidates(importedCandidates);
      setError(null);
    } else {
      setError('No resumes found in Gmail');
    }
  };

  // ── Rank handler ──────────────────────────────────────────────────────────
  const handleRank = async () => {
    if (!jobTitle.trim()) {
      setError('Please enter a job title');
      return;
    }
    if (resumes.length === 0 && gmailCandidates.length === 0) {
      setError('Please upload resumes or fetch them from Gmail first');
      return;
    }

    setIsRanking(true);
    setError(null);

    try {
      console.log('=== Starting Rank Process ===');
      console.log('Resume files:', resumes.length);
      console.log('JD file:', jdFile?.name ?? 'none');
      console.log('Gmail candidates:', gmailCandidates.length);

      // Send real files — no dummy data
      const results = await matchCandidates(
        jobTitle,
        resumes,          // File[]
        jdFile,           // File | null
        gmailCandidates   // already-fetched Gmail candidates
      );

      console.log('API Results:', results);

      if (!results || !results.candidates || !Array.isArray(results.candidates)) {
        throw new Error('Invalid response from API. Please try again.');
      }

      const rankedCandidates = results.candidates.map((c, idx) => ({
        name:         c.candidate_name  || `Candidate ${idx + 1}`,
        email:        c.email           || '—',
        score:        Math.round(c.match_score || c.score || 0),
        experience:   c.years_experience,
        skills:       c.skills          || [],
        education:    c.education       || {},
        matchDetails: c.match_details   || {},
        source:       c.source          || 'upload',
      }));

      setCandidates(rankedCandidates);
      setActiveTab('Candidates');
    } catch (err) {
      console.error('Ranking error:', err);
      setError(err.message || 'Failed to rank candidates. Please try again.');
    } finally {
      setIsRanking(false);
    }
  };

  // ── PDF report ────────────────────────────────────────────────────────────
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('RecruitAI Candidate Report', 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Job Title: ${jobTitle || 'General Position'}`, 14, 37);

    const tableData = candidates.map((c) => [
      c.name,
      c.email,
      `${c.score}%`,
      c.score >= 85 ? 'Strong Match' : c.score >= 70 ? 'Waitlist' : 'Rejected',
    ]);

    doc.autoTable({
      startY: 45,
      head: [['Name', 'Email', 'Match Score', 'Status']],
      body: tableData,
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save('candidate-ranking-report.pdf');
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 ml-64 p-10 space-y-8 max-w-7xl">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{activeTab}</h2>
            <p className="text-gray-400 mt-1">
              {activeTab === 'Dashboard'    ? 'Overview of your recruitment process.'        :
               activeTab === 'Candidates'  ? 'View and rank your potential hires.'           :
               activeTab === 'Jobs'        ? 'Configure job requirements for AI matching.'   :
                                             'Connect and sync with your Gmail account.'}
            </p>
          </div>
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-3 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">AI Agent Online</span>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg animate-in fade-in">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Dashboard */}
        {activeTab === 'Dashboard' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
            {/* Left column */}
            <div className="space-y-6">
              <GmailImport onImport={handleGmailImport} />
              <FileUpload
                title="Upload Resumes"
                description="Drag and drop candidate resumes (PDF, DOCX)"
                icon={LayoutList}
                onFilesSelected={(files) => setResumes((prev) => [...prev, ...files])}
                files={resumes}
              />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Job title */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-blue-400" size={24} />
                  <h3 className="text-xl font-bold">Job Title</h3>
                </div>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Full Stack Developer"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* JD upload — stores a single File object */}
              <FileUpload
                title="Job Description"
                description="Upload the JD file so AI matches against real requirements (PDF, DOCX, TXT)"
                icon={FilePlus}
                onFilesSelected={(files) => setJdFile(files[0] ?? null)}
                files={jdFile ? [jdFile] : []}
                maxFiles={1}
              />

              {/* Rank button */}
              <div className="glass-card flex flex-col items-center justify-center p-8 gap-6 text-center">
                <Sparkles size={32} className="text-blue-400" />
                <h3 className="text-xl font-bold">Ready to Rank?</h3>
                <p className="text-sm text-gray-400">
                  {resumes.length} uploaded resume(s) &bull; {gmailCandidates.length} Gmail resume(s) &bull; {jdFile ? '1 JD uploaded' : 'No JD'}
                </p>
                <button
                  onClick={handleRank}
                  disabled={isRanking || (resumes.length === 0 && gmailCandidates.length === 0)}
                  className={cn(
                    'w-full btn-primary justify-center',
                    (isRanking || (resumes.length === 0 && gmailCandidates.length === 0)) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isRanking ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing with AI...
                    </span>
                  ) : (
                    'Analyze & Rank Candidates'
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Candidates tab */}
        {(activeTab === 'Candidates' || candidates.length > 0) &&
          activeTab !== 'Jobs' && activeTab !== 'Gmail Inbox' && (
          <section className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <CandidateTable
              candidates={candidates}
              onDownloadReport={generatePDF}
            />
            {candidates.length === 0 && (
              <div className="p-20 text-center text-gray-400">
                <LayoutList size={48} className="mx-auto mb-4 opacity-20" />
                <p>No candidates ranked yet. Go to Dashboard to start.</p>
              </div>
            )}
          </section>
        )}

        {/* Jobs tab */}
        {activeTab === 'Jobs' && (
          <section className="animate-in fade-in duration-500 max-w-2xl">
            <FileUpload
              title="Job Description Management"
              description="Upload your job description file (PDF, DOCX, TXT)"
              icon={FilePlus}
              onFilesSelected={(files) => setJdFile(files[0] ?? null)}
              files={jdFile ? [jdFile] : []}
              maxFiles={1}
            />
          </section>
        )}

        {/* Gmail Inbox tab */}
        {activeTab === 'Gmail Inbox' && (
          <section className="animate-in fade-in duration-500">
            <GmailImport onImport={handleGmailImport} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
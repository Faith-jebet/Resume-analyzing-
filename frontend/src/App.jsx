import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUpload } from './components/FileUpload';
import { GmailImport } from './components/GmailImport';
import { CandidateTable } from './components/CandidateTable';
import { matchCandidates } from './lib/api';
import { LayoutList, FilePlus, Sparkles, UserCheck, Menu, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';

// ── CriteriaPanel (UI) 
function CriteriaPanel({ criteria }) {
  const [expanded, setExpanded] = useState(true);

  if (!criteria) return null;
}

// App 
function App() {
  const [jobTitle, setJobTitle]               = useState('');
  const [activeTab, setActiveTab]             = useState('Dashboard');
  const [resumes, setResumes]                 = useState([]);
  const [jdFile, setJdFile]                   = useState(null);
  const [isRanking, setIsRanking]             = useState(false);
  const [candidates, setCandidates]           = useState([]);
  const [rankingCriteria, setRankingCriteria] = useState(null);
  const [gmailCandidates, setGmailCandidates] = useState([]);
  const [error, setError]                     = useState(null);
  const [sidebarOpen, setSidebarOpen]         = useState(false);

  // ── Gmail import ────────────────────────────────────────────────────────────
  const handleGmailImport = (importedCandidates) => {
    if (importedCandidates && importedCandidates.length > 0) {
      setGmailCandidates(importedCandidates);
      setError(null);
    } else {
      setError('No resumes found in Gmail');
    }
  };

  // ── Rank handler ────────────────────────────────────────────────────────────
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
      const results = await matchCandidates(
        jobTitle,
        resumes,
        jdFile,
        gmailCandidates,
      );

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
      setRankingCriteria(results.ranking_criteria || null);
      setActiveTab('Candidates');
    } catch (err) {
      console.error('Ranking error:', err);
      setError(err.message || 'Failed to rank candidates. Please try again.');
    } finally {
      setIsRanking(false);
    }
  };

  // ── PDF report ──────────────────────────────────────────────────────────────
  const generatePDF = () => {
    const doc    = new jsPDF();
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = 14;
    const blue   = [59, 130, 246];
    const dark   = [30, 30, 30];
    const mid    = [80, 80, 80];
    const lightG = [150, 150, 150];

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.setFillColor(...blue);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('RecruitAI  —  Candidate Report', margin, 16);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(
      `Role: ${jobTitle || 'General Position'}   •   Generated: ${new Date().toLocaleDateString()}   •   Candidates: ${candidates.length}`,
      margin, 27,
    );

    let cursorY = 48;

    // ── Section title helper ──────────────────────────────────────────────────
    const drawSectionTitle = (label) => {
      if (cursorY > pageH - 60) { doc.addPage(); cursorY = 20; }
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...dark);
      doc.text(label, margin, cursorY);
      doc.setDrawColor(...blue);
      doc.setLineWidth(0.6);
      doc.line(margin, cursorY + 2, pageW - margin, cursorY + 2);
      cursorY += 10;
    };

    // 1. RANKING CRITERIA 
    if (rankingCriteria) {
      drawSectionTitle('Ranking Criteria');

      // Summary paragraph
      if (rankingCriteria.summary) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(...mid);
        const summaryLines = doc.splitTextToSize(rankingCriteria.summary, pageW - margin * 2);
        doc.text(summaryLines, margin, cursorY);
        cursorY += summaryLines.length * 5 + 6;
      }

      // Factor table — dynamic row height so descriptions never truncate
      if (Array.isArray(rankingCriteria.factors) && rankingCriteria.factors.length > 0) {
        const colFactor = margin;
        const colWeight = margin + 58;
        const colBar    = margin + 82;
        const barMaxW   = 28;
        const colDesc   = colBar + barMaxW + 6;
        const descMaxW  = pageW - colDesc - margin;   // remaining width for description
        const baseRowH  = 14;                          // minimum row height
        const lineH     = 4.5;                         // height per wrapped description line

        // Header row
        if (cursorY > pageH - 30) { doc.addPage(); cursorY = 20; }
        doc.setFillColor(235, 243, 255);
        doc.rect(margin, cursorY, pageW - margin * 2, baseRowH, 'F');
        doc.setDrawColor(190, 210, 235);
        doc.setLineWidth(0.3);
        doc.rect(margin, cursorY, pageW - margin * 2, baseRowH);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...dark);
        doc.text('Factor',      colFactor + 2, cursorY + 9);
        doc.text('Weight',      colWeight + 2, cursorY + 9);
        doc.text('Importance',  colBar    + 2, cursorY + 9);
        doc.text('Description', colDesc   + 2, cursorY + 9);
        cursorY += baseRowH;

        // ── Data rows — height expands to fit full description ─────────────
        rankingCriteria.factors.forEach((f, i) => {
          const descText  = String(f.description || '');
          // Split description into lines that fit the column width
          const descLines = doc.splitTextToSize(descText, descMaxW);
          // Row is tall enough for all description lines, minimum baseRowH
          const rowH = Math.max(baseRowH, descLines.length * lineH + 6);

          // New page guard
          if (cursorY + rowH > pageH - 20) { doc.addPage(); cursorY = 20; }

          // Row background
          const bg = i % 2 === 0 ? [255, 255, 255] : [248, 251, 255];
          doc.setFillColor(...bg);
          doc.rect(margin, cursorY, pageW - margin * 2, rowH, 'F');
          doc.setDrawColor(215, 228, 245);
          doc.setLineWidth(0.2);
          doc.rect(margin, cursorY, pageW - margin * 2, rowH);

          // Vertical centre for single-line items
          const midY = cursorY + rowH / 2;

          // Factor name
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...dark);
          doc.text(String(f.name || ''), colFactor + 2, midY, { baseline: 'middle' });

          // Weight %
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...blue);
          doc.text(`${f.weight}%`, colWeight + 2, midY, { baseline: 'middle' });

          // Bar track
          const barY = cursorY + rowH / 2 - 2;
          const barH = 4;
          doc.setFillColor(210, 225, 245);
          doc.roundedRect(colBar + 2, barY, barMaxW, barH, 1, 1, 'F');
          // Bar fill
          const fillW = Math.max(1, Math.round((Math.min(f.weight, 100) / 100) * barMaxW));
          doc.setFillColor(...blue);
          doc.roundedRect(colBar + 2, barY, fillW, barH, 1, 1, 'F');

          // Description — all lines, top-aligned inside the row
          doc.setFont(undefined, 'normal');
          doc.setTextColor(...mid);
          doc.setFontSize(7.5);
          const descStartY = cursorY + 5;   // small top padding inside row
          descLines.forEach((line, li) => {
            doc.text(line, colDesc + 2, descStartY + li * lineH);
          });

          cursorY += rowH;
        });

        cursorY += 10;
      }
    }

    // ── 2. CANDIDATE RANKINGS 
    drawSectionTitle('Candidate Rankings');

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['#', 'Name', 'Email', 'Match Score', 'Status']],
      body: candidates.map((c, i) => {
        const status =
          c.score >= 85 ? 'Strong Match'
          : c.score >= 70 ? 'Waitlist'
          : 'Rejected';
        return [i + 1, c.name, c.email, `${c.score}%`, status];
      }),
      headStyles: {
        fillColor: blue,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: dark },
      alternateRowStyles: { fillColor: [248, 251, 255] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell(data) {
        if (data.column.index === 4 && data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'Strong Match') {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fillColor = [220, 252, 231];
          } else if (val === 'Waitlist') {
            data.cell.styles.textColor = [120, 53, 15];
            data.cell.styles.fillColor = [254, 243, 199];
          } else {
            data.cell.styles.textColor = [127, 29, 29];
            data.cell.styles.fillColor = [254, 226, 226];
          }
        }
      },
    });

    //Footer on every page
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const fY = pageH - 8;
      doc.setFontSize(7);
      doc.setTextColor(...lightG);
      doc.setFont(undefined, 'normal');
      doc.text('RecruitAI  —  Confidential', margin, fY);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, fY, { align: 'right' });
    }

    doc.save('recruitai-candidate-report.pdf');
  };

  // Tab change 
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const tabSubtitle = {
    Dashboard:     'Overview of your recruitment process.',
    Candidates:    'View and rank your potential hires.',
    Jobs:          'Configure job requirements for AI matching.',
    'Gmail Inbox': 'Connect and sync with your Gmail account.',
  };

  return (
    <div className="flex min-h-screen">

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-10 space-y-6 lg:space-y-8 w-full min-w-0">

        <header className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden flex-shrink-0 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                {activeTab}
              </h2>
              <p className="text-gray-400 mt-1 text-sm sm:text-base hidden sm:block">
                {tabSubtitle[activeTab] || ''}
              </p>
            </div>
          </div>

          <div className="glass flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 sm:gap-3 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">AI Online</span>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg animate-in fade-in">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {activeTab === 'Dashboard' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 animate-in fade-in duration-500">
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

            <div className="space-y-6">
              <div className="glass-card p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-blue-400 flex-shrink-0" size={24} />
                  <h3 className="text-lg sm:text-xl font-bold">Job Title</h3>
                </div>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Full Stack Developer"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm sm:text-base"
                />
              </div>

              <FileUpload
                title="Job Description"
                description="Upload the JD file so AI matches against real requirements (PDF, DOCX, TXT)"
                icon={FilePlus}
                onFilesSelected={(files) => setJdFile(files[0] ?? null)}
                files={jdFile ? [jdFile] : []}
                maxFiles={1}
              />

              <div className="glass-card flex flex-col items-center justify-center p-6 sm:p-8 gap-4 sm:gap-6 text-center">
                <Sparkles size={28} className="text-blue-400" />
                <h3 className="text-lg sm:text-xl font-bold">Ready to Rank?</h3>
                <p className="text-xs sm:text-sm text-gray-400">
                  {resumes.length} uploaded resume(s)
                  &bull; {gmailCandidates.length} Gmail resume(s)
                  &bull; {jdFile ? '1 JD uploaded' : 'No JD'}
                </p>
                <button
                  onClick={handleRank}
                  disabled={isRanking || (resumes.length === 0 && gmailCandidates.length === 0)}
                  className={cn(
                    'w-full btn-primary justify-center',
                    (isRanking || (resumes.length === 0 && gmailCandidates.length === 0)) &&
                      'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isRanking ? (
                    <span className="flex items-center justify-center gap-2 text-sm sm:text-base">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Analyzing with AI...
                    </span>
                  ) : (
                    <span className="text-sm sm:text-base">Analyze &amp; Rank Candidates</span>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Candidates' && (
          <section className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6">
            <CriteriaPanel criteria={rankingCriteria} />
            <div className="overflow-x-auto">
              <CandidateTable candidates={candidates} onDownloadReport={generatePDF} />
              {candidates.length === 0 && (
                <div className="p-12 sm:p-20 text-center text-gray-400">
                  <LayoutList size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm sm:text-base">No candidates ranked yet. Go to Dashboard to start.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'Jobs' && (
          <section className="animate-in fade-in duration-500 w-full max-w-2xl">
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
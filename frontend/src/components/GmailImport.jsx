import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchGmailResumes } from '../lib/api';

export function GmailImport({ onImport }) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [subject, setSubject] = useState('');

  const handleSync = async () => {
    setIsLoading(true);
    setStatus(null);
    setErrorMessage('');

    try {
      const response = await fetchGmailResumes(subject);
      const resumes = response.resumes || response.candidates || response;

      if (!Array.isArray(resumes)) throw new Error('Invalid response format from Gmail API');

      if (resumes.length === 0) {
        setStatus('error');
        setErrorMessage(`No resumes found with subject "${subject}".`);
        setFetchedCount(0);
        return;
      }

      if (onImport && typeof onImport === 'function') {
        onImport(resumes);
        setFetchedCount(resumes.length);
        setStatus('success');
      } else {
        throw new Error('onImport callback not provided');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to fetch resumes from Gmail');
      setFetchedCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Gmail Integration</p>
          <p className="text-xs text-gray-500 mt-0.5">Scan your inbox for received resumes</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Subject filter</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., Resume Submission"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={isLoading}
        />
      </div>

      {status === 'success' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <CheckCircle className="text-green-400 flex-shrink-0" size={14} />
          <p className="text-xs text-green-400">Imported {fetchedCount} resume(s)</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={14} />
          <p className="text-xs text-red-400">{errorMessage || 'Failed to fetch resumes'}</p>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchGmailResumes } from '../lib/api';

export function GmailImport({ onImport }) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success', 'error', null
  const [fetchedCount, setFetchedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [subject, setSubject] = useState('');

  const handleSync = async () => {
    setIsLoading(true);
    setStatus(null);
    setErrorMessage('');
    
    try {
      console.log('🔄 Fetching resumes from Gmail...');
      
      // Call the actual API
      const response = await fetchGmailResumes(subject);
      
      console.log('Gmail API Response:', response);
      
      // The response should contain a 'resumes' or 'candidates' array
      const resumes = response.resumes || response.candidates || response;
      
      if (!Array.isArray(resumes)) {
        throw new Error('Invalid response format from Gmail API');
      }

      if (resumes.length === 0) {
        setStatus('error');
        setErrorMessage(`No resumes found with subject "${subject}". Try changing the subject line.`);
        setFetchedCount(0);
        return;
      }

      // Pass the fetched resumes to parent component
      if (onImport && typeof onImport === 'function') {
        onImport(resumes);
        setFetchedCount(resumes.length);
        setStatus('success');
        console.log(`✅ Successfully imported ${resumes.length} resumes`);
      } else {
        throw new Error('onImport callback not provided');
      }
      
    } catch (error) {
      console.error('❌ Gmail sync error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to fetch resumes from Gmail');
      setFetchedCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 rounded-xl">
            <Mail className="text-red-400" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Gmail Integration</h3>
            <p className="text-sm text-gray-400">Scan your inbox for received resumes</p>
          </div>
        </div>
        
        <button
          onClick={handleSync}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            isLoading 
              ? 'bg-gray-600/20 text-gray-400 cursor-not-allowed' 
              : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
          }`}
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Syncing...' : 'Sync Inbox'}
        </button>
      </div>

      {/* Subject Filter Input */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Email Subject Filter</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g., Resume Analyzing"
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
          disabled={isLoading}
        />
      </div>

      {/* Status Messages */}
      {status === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg animate-in fade-in">
          <CheckCircle className="text-green-400" size={20} />
          <p className="text-green-400 font-medium">
            Successfully fetched {fetchedCount} resume(s) from Gmail
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-400 font-medium">Failed to fetch resumes</p>
          </div>
          {errorMessage && (
            <p className="text-sm text-red-400/80 ml-8">{errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
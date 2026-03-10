import React from 'react';
import { Download, Star, TrendingUp, User } from 'lucide-react';
import { cn } from '../lib/utils';

export function CandidateTable({ candidates, onDownloadReport }) {
  return (
    <div className="glass-card overflow-hidden !p-0">
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-blue-400" size={20} />
          <h3 className="text-xl font-bold tracking-tight">Candidate Ranking</h3>
        </div>
        <button 
          onClick={onDownloadReport}
          className="btn-primary"
        >
          <Download size={18} />
          Export Report (PDF)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.05] border-b border-white/10">
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Candidate</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Match Score</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {candidates.map((candidate, idx) => (
              <tr 
                key={idx} 
                className="hover:bg-white/[0.02] transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
                      <User size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold">{candidate.name}</p>
                      <p className="text-xs text-gray-400">{candidate.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${candidate.score}%` }} 
                      />
                    </div>
                    <span className="font-bold text-blue-400">{candidate.score}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    candidate.score >= 85 ? "bg-green-500/10 text-green-400" :
                    candidate.score >= 70 ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-red-500/10 text-red-400"
                  )}>
                    {candidate.score >= 85 ? 'Strong Match' : candidate.score >= 70 ? 'Waitlist' : 'Rejected'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
                    <Star size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

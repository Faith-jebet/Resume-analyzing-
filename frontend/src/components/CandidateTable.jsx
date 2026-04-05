import React from 'react';
import { Download } from 'lucide-react';
import { cn } from '../lib/utils';

export function CandidateTable({ candidates, onDownloadReport }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-base font-medium text-gray-200">Candidate Ranking</h3>
        <button
          onClick={onDownloadReport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          <Download size={15} />
          Export PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-6 py-3 text-xs uppercase tracking-wider text-gray-500">Candidate</th>
              <th className="px-6 py-3 text-xs uppercase tracking-wider text-gray-500">Match</th>
              <th className="px-6 py-3 text-xs uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-xs uppercase tracking-wider text-gray-500 text-right">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {candidates.map((candidate, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-200">{candidate.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{candidate.email}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${candidate.score}%` }}
                      />
                    </div>
                    <span className="text-sm text-blue-400">{candidate.score}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs",
                    candidate.score >= 85 ? "bg-green-500/10 text-green-400" :
                    candidate.score >= 70 ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-red-500/10 text-red-400"
                  )}>
                    {candidate.score >= 85 ? 'Strong Match' : candidate.score >= 70 ? 'Waitlist' : 'Rejected'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded">
                    ★
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
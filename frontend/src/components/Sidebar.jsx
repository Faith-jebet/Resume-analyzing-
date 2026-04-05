import React from 'react';
import { BarChart3, Users } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: BarChart3, label: 'Dashboard' },
  { icon: Users, label: 'Candidates' },
];

export function Sidebar({ activeTab, onTabChange }) {
  return (
    <aside className="w-64 h-screen border-r border-white/10 bg-black/20 flex flex-col fixed left-0 top-0">
      <div className="px-6 py-7">
        <h1 className="text-base font-semibold tracking-tight text-white">RecruitAI</h1>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onTabChange?.(item.label)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              activeTab === item.label
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
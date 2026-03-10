import React from 'react';
import { 
  BarChart3, 
  Users, 
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: BarChart3, label: 'Dashboard' },
  { icon: Users, label: 'Candidates' },
];

export function Sidebar({ activeTab, onTabChange }) {
  return (
    <aside className="w-64 h-screen glass border-r border-white/10 flex flex-col fixed left-0 top-0">
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Sparkles className="text-white" size={24} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">RecruitAI</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onTabChange?.(item.label)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              activeTab === item.label 
                ? "bg-blue-600/10 text-blue-400" 
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-colors",
              activeTab === item.label ? "text-blue-400" : "group-hover:text-white"
            )} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

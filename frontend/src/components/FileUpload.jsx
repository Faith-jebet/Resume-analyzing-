import React, { useRef } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function FileUpload({ title, description, icon: Icon, onFilesSelected, files = [] }) {
  const inputRef = useRef(null);

  return (
    <div className="space-y-4">
      <div 
        onClick={() => inputRef.current?.click()}
        className="glass-card border-dashed border-2 border-white/10 hover:border-blue-500/50 cursor-pointer flex flex-col items-center justify-center p-10 gap-3 group transition-all duration-500"
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={inputRef}
          onChange={(e) => onFilesSelected(Array.from(e.target.files))}
        />
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:bg-blue-600/20">
          <Icon className="text-gray-400 group-hover:text-blue-400 transition-colors" size={32} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <File className="text-blue-400" size={18} />
                <span className="text-sm font-medium truncate max-w-[150px]">{file.name}</span>
              </div>
              <CheckCircle className="text-green-500" size={18} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

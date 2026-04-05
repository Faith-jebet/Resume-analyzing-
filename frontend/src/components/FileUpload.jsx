import React, { useRef } from 'react';
import { File, CheckCircle } from 'lucide-react';

export function FileUpload({ title, description, icon: Icon, onFilesSelected, files = [] }) {
  const inputRef = useRef(null);

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="border border-dashed border-white/10 hover:border-blue-500/40 cursor-pointer rounded-xl flex flex-col items-center justify-center p-8 gap-2 transition-colors"
      >
        <input
          type="file"
          multiple
          className="hidden"
          ref={inputRef}
          onChange={(e) => onFilesSelected(Array.from(e.target.files))}
        />
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2">
                <File className="text-gray-500" size={14} />
                <span className="text-xs text-gray-300 truncate max-w-[160px]">{file.name}</span>
              </div>
              <CheckCircle className="text-green-500 flex-shrink-0" size={14} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
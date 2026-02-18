
import React, { useState } from "react";

interface SmartOptionsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export default function SmartOptions({ options, onSelect, disabled }: SmartOptionsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 mb-1 animate-fade-in">
      {options.map((opt, i) => {
        const isSelected = selected === opt;
        return (
          <button
            key={i}
            onClick={() => {
              if (disabled || selected) return;
              setSelected(opt);
              onSelect(opt);
            }}
            disabled={disabled || !!selected}
            className={`
              px-3 py-2 rounded-xl text-sm text-left transition-all duration-200
              border shadow-sm flex-grow md:flex-grow-0
              ${isSelected 
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-500 font-medium" 
                : selected 
                  ? "bg-gray-800/30 border-gray-800 text-gray-500 cursor-default opacity-50"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-md cursor-pointer transform active:scale-95"
              }
            `}
          >
            {isSelected && <span className="mr-1">✓</span>}{opt}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Parser: extrai opções <<OPTION: texto>> do texto do bot
 * Retorna: { cleanText: string, options: string[] }
 */
export function parseSmartOptions(text: string): { cleanText: string; options: string[] } {
  const optionRegex = /<<OPTION:\s*(.+?)>>/g;
  const options: string[] = [];
  let match;
  
  // Extrai todas as ocorrências
  while ((match = optionRegex.exec(text)) !== null) {
    options.push(match[1].trim());
  }
  
  // Remove as tags do texto exibido
  const cleanText = text
    .replace(/<<OPTION:\s*.+?>>/g, '')
    .replace(/\n{3,}/g, '\n\n')  // Remove linhas vazias extras que podem sobrar
    .trim();
  
  return { cleanText, options };
}

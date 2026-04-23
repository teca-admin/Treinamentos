import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

export const CustomSelect = ({ options, value, onChange, placeholder }: { options: { label: string, value: string }[], value: string, onChange: (value: string) => void, placeholder?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative w-full md:w-auto" ref={ref}>
      <div 
        className="bg-slate-50 border-2 border-slate-100 focus:border-WFS Treinamentos-primary rounded-none px-9 py-2.5 text-sm cursor-pointer flex items-center justify-between min-w-[180px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-2 border-slate-200 shadow-lg z-50 mt-1">
          {options.map(option => (
            <div 
              key={option.value}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CustomDatePicker = ({ value, onChange, className, textClassName, style, textStyle }: { value: string, onChange: (value: string) => void, className?: string, textClassName?: string, style?: React.CSSProperties, textStyle?: React.CSSProperties }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (dateStr.includes("/") && dateStr.split("/")[0].length <= 2) return dateStr;
    
    // Se estiver no formato YYYY-MM-DD
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  return (
    <div className="relative w-full" ref={ref}>
      <div 
        className={`input-field bg-slate-50 focus:bg-white cursor-pointer flex items-center justify-between ${className || ''}`}
        style={style}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={textClassName} style={textStyle}>{value ? formatDate(value) : 'DD/MM/AAAA'}</span>
        <CalendarIcon className="w-4 h-4 text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-2 border-slate-200 shadow-lg z-50 mt-1 p-2">
          <input 
            type="date" 
            className="w-full p-2 border border-slate-200"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

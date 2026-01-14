
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, UIElement, ViewportSize, AIProvider } from './types';
import * as geminiService from './services/geminiService';
import QuotaAlert from './components/QuotaAlert';

interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

const HighlightedCode: React.FC<{ code: string }> = ({ code }) => {
  const highlighted = useMemo(() => {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;\/?[a-z0-9]+)/gi, '<span class="text-blue-400">$1</span>')
      .replace(/\s([a-z-]+)=/gi, ' <span class="text-purple-400">$1</span>=')
      .replace(/class="([^"]*)"/gi, '<span class="text-purple-400">class</span>="<span class="text-emerald-400">$1</span>"')
      .replace(/"([^"]*)"/gi, '"<span class="text-amber-500/80">$1</span>"');
  }, [code]);

  return (
    <pre className="absolute inset-0 p-4 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all pointer-events-none overflow-hidden select-none"
      dangerouslySetInnerHTML={{ __html: highlighted }} />
  );
};

const CodeEditor: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => (
  <div className="relative w-full h-[320px] bg-[#050505] rounded-xl border border-zinc-900 overflow-hidden group focus-within:border-blue-900/40 transition-all shadow-2xl">
    <HighlightedCode code={value} />
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="absolute inset-0 w-full h-full p-4 bg
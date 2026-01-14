
import React from 'react';

interface QuotaAlertProps {
  error?: string;
  onRetry: () => void;
}

const QuotaAlert: React.FC<QuotaAlertProps> = ({ error, onRetry }) => {
  if (!error) return null;

  const isQuotaError = error.toLowerCase().includes("quota") || error.includes("429") || error.includes("exhausted");
  const isAuthError = error.includes("not found") || error.includes("permission");

  return (
    <div className="bg-zinc-950/90 backdrop-blur-2xl border border-amber-900/40 rounded-2xl p-6 mb-8 shadow-2xl animate-in fade-in slide-in-from-top-4">
      <div className="flex items-start gap-5">
        <div className="w-12 h-12 bg-amber-900/20 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/20">
          <i className={`fas ${isQuotaError ? 'fa-battery-empty' : 'fa-shield-halved'} text-amber-500 text-lg`}></i>
        </div>
        <div className="flex-1">
          <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Protocol Warning: {isQuotaError ? 'Resource Exhausted' : 'Auth Failed'}</h3>
          <p className="text-[11px] leading-relaxed text-zinc-500 mb-5">
            {isQuotaError 
              ? "The current API Key has exhausted its throughput. Please wait 60 seconds or switch to a different Project Vault from the header."
              : isAuthError 
                ? "The selected Project Vault is invalid or missing required permissions. Please select another '钥匙' to continue."
                : error}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onRetry}
              className="px-5 py-2 bg-amber-500 text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all"
            >
              Retry Protocol
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              className="px-5 py-2 bg-zinc-900 text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-white transition-all border border-zinc-800"
            >
              Billing Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaAlert;

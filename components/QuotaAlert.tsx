
import React from 'react';

interface QuotaAlertProps {
  error?: string;
  onRetry: () => void;
}

const QuotaAlert: React.FC<QuotaAlertProps> = ({ error, onRetry }) => {
  if (!error) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 mb-8 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="bg-red-500 p-3 rounded-full">
          <i className="fas fa-exclamation-triangle text-white"></i>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-red-400 mb-2">Project Quota Issue Detected</h3>
          <p className="text-slate-300 mb-4">
            {error.includes("quota level not specified") 
              ? "Your Google Cloud Project has not been assigned a Quota Tier. This typically happens when billing is not linked or the project is in a restricted state."
              : error}
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href="https://aistudio.google.com/app/plan_management" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <i className="fas fa-external-link-alt"></i>
              Manage Quota Tier
            </a>
            <button 
              onClick={onRetry}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaAlert;


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, UIElement, LogEntry, ViewportSize } from './types';
import * as geminiService from './services/geminiService';

const STYLES = [
  { id: 'realistic', label: 'Realistic', prompt: 'photorealistic, high detail, cinematic lighting' },
  { id: 'sketch', label: 'Sketch', prompt: 'hand-drawn charcoal sketch, artistic, paper texture' },
  { id: 'pixel', label: 'Pixel Art', prompt: '8-bit pixel art, vibrant colors, retro game aesthetic' },
  { id: 'cyberpunk', label: 'Cyberpunk', prompt: 'neon lights, futuristic, dark rainy atmosphere, synthwave' },
  { id: 'watercolor', label: 'Watercolor', prompt: 'soft watercolor painting, bleeding colors, artistic' }
];

const ELITE_DEMOS: UIElement[] = [
  {
    id: 'demo-saas-1',
    name: 'Metric: Revenue Flow',
    type: 'custom',
    code: `<div class="bg-zinc-950 p-6 border border-zinc-900 rounded-[2rem] shadow-2xl">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h4 class="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Gross Volume</h4>
          <div class="text-4xl font-bold text-white tracking-tighter">$128,492.00</div>
        </div>
        <div class="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
          <i class="fas fa-arrow-trend-up text-emerald-500"></i>
        </div>
      </div>
      <div class="flex items-end gap-1 h-20 mb-6">
        ${[40, 70, 45, 90, 65, 80, 50, 95, 100].map(h => `<div class="flex-1 bg-blue-600/40 rounded-t-sm hover:bg-blue-500 transition-all cursor-pointer" style="height: ${h}%"></div>`).join('')}
      </div>
      <div class="flex justify-between items-center pt-4 border-t border-zinc-900">
        <span class="text-zinc-600 text-[10px] font-bold">JAN 01 - FEB 28</span>
        <button class="text-blue-500 text-[10px] font-black uppercase hover:text-blue-400">Detailed Analytics</button>
      </div>
    </div>`,
    prompt: 'Premium SaaS metrics dashboard',
    timestamp: new Date(),
    selected: false,
    visible: true
  },
  {
    id: 'demo-card-1',
    name: 'Product: Flux Vision',
    type: 'custom',
    code: `<div class="group relative w-full max-w-sm bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 transition-all hover:scale-[1.02] hover:shadow-3xl">
      <div class="aspect-square bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center p-12">
        <div class="w-full h-full bg-zinc-800 rounded-3xl shadow-2xl flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent"></div>
          <i class="fas fa-microchip text-5xl text-blue-500 group-hover:scale-110 transition-transform duration-500"></i>
        </div>
      </div>
      <div class="p-8">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-2xl font-black text-white tracking-tight">Flux Core v2</h3>
          <span class="px-3 py-1 bg-blue-600 text-[10px] font-black rounded-full text-white">NEW</span>
        </div>
        <p class="text-zinc-500 text-sm leading-relaxed mb-8 font-medium">Next-generation neural processor optimized for visual synthesis and real-time interface rendering.</p>
        <div class="flex gap-3">
          <button class="flex-1 py-4 bg-white text-black font-black uppercase text-[10px] rounded-2xl hover:bg-zinc-200 transition-all">Pre-order</button>
          <button class="w-14 h-14 border border-zinc-800 flex items-center justify-center rounded-2xl text-white hover:bg-zinc-800">
            <i class="far fa-heart"></i>
          </button>
        </div>
      </div>
    </div>`,
    prompt: 'Apple-style product card',
    timestamp: new Date(),
    selected: false,
    visible: true
  },
  {
    id: 'demo-nav-1',
    name: 'Navigation: Aero',
    type: 'custom',
    code: `<nav class="w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 px-8 py-4 rounded-3xl flex items-center justify-between">
      <div class="flex items-center gap-8">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><i class="fas fa-bolt text-white"></i></div>
        <div class="hidden md:flex gap-6">
          <a href="#" class="text-[11px] font-black text-white uppercase tracking-widest">Platform</a>
          <a href="#" class="text-[11px] font-black text-zinc-500 uppercase tracking-widest hover:text-blue-400">Solutions</a>
          <a href="#" class="text-[11px] font-black text-zinc-500 uppercase tracking-widest hover:text-blue-400">Pricing</a>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button class="text-zinc-500 text-[11px] font-black uppercase tracking-widest hover:text-white transition-colors">Sign In</button>
        <button class="px-6 py-2.5 bg-white text-black text-[11px] font-black uppercase rounded-xl hover:bg-blue-500 hover:text-white transition-all">Start Designing</button>
      </div>
    </nav>`,
    prompt: 'Floating blurred navbar',
    timestamp: new Date(),
    selected: false,
    visible: true
  }
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.CANVAS);
  const [elements, setElements] = useState<UIElement[]>(() => {
    const saved = localStorage.getItem('onlook_project_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((el: any) => ({ ...el, timestamp: new Date(el.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });

  const [templates, setTemplates] = useState<UIElement[]>(() => {
    const saved = localStorage.getItem('onlook_templates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length === 0) return ELITE_DEMOS;
        return parsed.map((el: any) => ({ ...el, timestamp: new Date(el.timestamp) }));
      } catch (e) { return ELITE_DEMOS; }
    }
    return ELITE_DEMOS;
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [tplSearch, setTplSearch] = useState('');
  
  // Drag and Drop
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const hierarchyRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    localStorage.setItem('onlook_project_v2', JSON.stringify(elements));
  }, [elements]);

  useEffect(() => {
    localStorage.setItem('onlook_templates', JSON.stringify(templates));
  }, [templates]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-19), { id: Math.random().toString(36), timestamp: new Date(), type, message }]);
  };

  const clearCanvas = () => {
    if (confirm('Nuke the entire canvas? This cannot be undone.')) {
      setElements([]);
      setSelectedId(null);
      addLog('info', 'Canvas wiped clean');
    }
  };

  const exportAllCode = () => {
    const allHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>body { background: #000; }</style>
</head>
<body class="p-12 space-y-12 flex flex-col items-center">
    ${elements.filter(e => e.visible).map(e => extractBody(e.code)).join('\n')}
</body>
</html>`;
    const blob = new Blob([allHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onlook-project-export.html';
    a.click();
    addLog('success', 'Production code exported');
  };

  const generateUI = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    addLog('request', `Compiling Flux Stream: "${prompt}"`);
    
    try {
      const finalCode = await geminiService.generateWebComponentStream(
        prompt,
        true,
        (chunk) => {} 
      );

      const newEl: UIElement = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Component ${elements.length + 1}`,
        type: 'custom',
        code: finalCode,
        prompt: prompt,
        timestamp: new Date(),
        selected: false,
        visible: true
      };

      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      setPrompt('');
      addLog('success', 'Interface synthesized successfully');
    } catch (err: any) {
      addLog('error', `Kernel panic: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newElements = [...elements];
    const [removed] = newElements.splice(draggedItemIndex, 1);
    newElements.splice(targetIndex, 0, removed);
    setElements(newElements);
    setDraggedItemIndex(null);
    setDragOverIndex(null);
    addLog('info', `Reordered stack: Moved ${removed.name}`);
  };

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(tplSearch.toLowerCase()));

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-[#fafafa] overflow-hidden selection:bg-blue-500/30">
      {/* Top Header */}
      <header className="h-14 border-b border-[#18181b] flex items-center justify-between px-6 bg-[#09090b]/80 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] rotate-3">
              <i className="fas fa-cube text-white text-xs"></i>
            </div>
            <span className="text-sm font-black tracking-tighter uppercase italic">Flux Core v4</span>
          </div>

          <nav className="flex items-center gap-1 bg-[#18181b] p-1 rounded-xl border border-[#27272a]">
             <button onClick={() => setView(AppView.CANVAS)} className={`px-5 py-1.5 text-[10px] font-black rounded-lg transition-all ${view === AppView.CANVAS ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}>
                STUDIO
             </button>
             <button onClick={() => setView(AppView.COMPONENTS)} className={`px-5 py-1.5 text-[10px] font-black rounded-lg transition-all ${view === AppView.COMPONENTS ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}>
                REPOS
                {templates.length > 0 && <span className="ml-2 bg-blue-400 text-blue-950 px-1.5 py-0.5 rounded-full text-[8px] font-bold">{templates.length}</span>}
             </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {!previewMode && (
            <div className="flex bg-[#18181b] rounded-xl p-1 border border-[#27272a]">
              {['mobile', 'tablet', 'desktop'].map((v) => (
                 <button key={v} onClick={() => setViewport(v as any)} className={`p-2 px-3 rounded-lg transition-all ${viewport === v ? 'bg-[#27272a] text-blue-400 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}>
                   <i className={`fas fa-${v === 'mobile' ? 'mobile-alt' : v === 'tablet' ? 'tablet-alt' : 'desktop'} text-[11px]`}></i>
                 </button>
              ))}
            </div>
          )}

          <div className="w-[1px] h-6 bg-zinc-800 mx-1"></div>

          <button onClick={() => setPreviewMode(!previewMode)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${previewMode ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'border-[#18181b] text-zinc-600 hover:text-white'}`}>
            <i className={`fas fa-${previewMode ? 'eye' : 'eye-slash'} text-xs`}></i>
          </button>
          
          <button onClick={() => setShowLogs(!showLogs)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${showLogs ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-[#18181b] text-zinc-600 hover:text-white'}`}>
            <i className="fas fa-terminal text-[11px]"></i>
          </button>
        </div>
      </header>

      {view === AppView.CANVAS ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Hierarchy */}
          {!previewMode && (
            <aside className="w-64 border-r border-[#18181b] flex flex-col shrink-0 bg-[#09090b]">
              <div className="p-4 border-b border-[#18181b] flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Layers</span>
                <div className="flex gap-2">
                   <button onClick={exportAllCode} title="Export Project" className="text-zinc-600 hover:text-emerald-400 transition-colors"><i className="fas fa-file-export text-[10px]"></i></button>
                   <button onClick={clearCanvas} title="Clear All" className="text-zinc-600 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-[10px]"></i></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar" onDragLeave={() => setDragOverIndex(null)}>
                {elements.map((el, index) => (
                  <div 
                    key={el.id} 
                    onClick={() => setSelectedId(el.id)}
                    draggable
                    onDragStart={() => setDraggedItemIndex(index)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={() => { setDraggedItemIndex(null); setDragOverIndex(null); }}
                    className={`flex items-center justify-between group px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all relative ${selectedId === el.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30' : 'hover:bg-[#18181b] text-zinc-400 border border-transparent'} ${draggedItemIndex === index ? 'opacity-30' : 'opacity-100'}`}
                  >
                    {/* Drag Line Indicator */}
                    {dragOverIndex === index && dragOverIndex !== draggedItemIndex && (
                      <div className={`absolute left-0 right-0 h-1 bg-blue-500 rounded-full z-10 ${draggedItemIndex! > index ? 'top-[-2px]' : 'bottom-[-2px]'}`} />
                    )}
                    
                    <div className="flex items-center gap-3 truncate flex-1 pointer-events-none">
                      <div onClick={(e) => { e.stopPropagation(); setElements(prev => prev.map(item => item.id === el.id ? {...item, visible: !item.visible} : item)); }} className={`w-3 h-3 rounded-full shrink-0 transition-colors border-2 pointer-events-auto ${el.visible ? 'bg-blue-500 border-blue-400' : 'bg-transparent border-zinc-800'}`}></div>
                      <span className={`text-[11px] font-bold truncate ${el.visible ? 'text-zinc-200' : 'text-zinc-600'}`}>{el.name}</span>
                    </div>
                    <i className="fas fa-grip-lines text-zinc-800 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* Canvas Area */}
          <main className={`flex-1 relative flex flex-col bg-[#0c0c0e] ${showGrid ? 'canvas-grid' : ''} overflow-hidden transition-all`}>
            {/* Context Header */}
            <div className="absolute top-4 left-4 z-40 flex gap-2">
               <button onClick={() => setShowGrid(!showGrid)} className="px-3 py-1.5 bg-[#18181b]/80 backdrop-blur border border-[#27272a] rounded-lg text-[9px] font-black uppercase text-zinc-500 hover:text-blue-400 transition-all">
                  <i className="fas fa-th-large mr-2"></i>Grid: {showGrid ? 'ON' : 'OFF'}
               </button>
            </div>

            <div className="flex-1 overflow-auto p-12 flex justify-center items-start custom-scrollbar">
              <div className={`w-full transition-all duration-700 ${previewMode ? 'max-w-7xl' : (viewport === 'mobile' ? 'max-w-[375px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'max-w-[1200px]')} space-y-16`}>
                 {elements.filter(e => e.visible).map(el => (
                   <div key={el.id} onClick={() => setSelectedId(el.id)} className={`relative group transition-all ${previewMode ? '' : (selectedId === el.id ? 'ring-2 ring-blue-500 ring-offset-8 ring-offset-[#0c0c0e] rounded-xl' : 'hover:ring-1 hover:ring-zinc-700 rounded-xl')}`}>
                      {!previewMode && (
                        <div className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                           <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-lg">{el.name}</span>
                        </div>
                      )}
                      <div className="bg-white rounded-2xl overflow-hidden text-black font-sans shadow-2xl">
                         <div dangerouslySetInnerHTML={{ __html: extractBody(el.code) }} />
                      </div>
                   </div>
                 ))}
                 
                 {loading && (
                   <div className="w-full h-48 bg-[#18181b] rounded-3xl flex items-center justify-center border border-[#27272a] animate-pulse">
                      <div className="flex flex-col items-center gap-5">
                        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em]">Flux Rendering...</span>
                      </div>
                   </div>
                 )}
                 
                 {elements.length === 0 && !loading && (
                    <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-zinc-800 rounded-[3rem]">
                       <i className="fas fa-layer-group text-6xl mb-8"></i>
                       <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Workspace Empty</h2>
                       <p className="max-w-xs text-xs font-bold leading-relaxed">Type a prompt below to synthesize your first production-ready UI component.</p>
                    </div>
                 )}
              </div>
            </div>

            {/* Floating Prompt Input */}
            {!previewMode && (
              <div className="h-32 flex items-center justify-center p-8 bg-gradient-to-t from-[#09090b] to-transparent shrink-0">
                <div className="w-full max-w-4xl flex items-center gap-4 bg-[#18181b] border border-[#27272a] rounded-[2rem] h-16 pl-8 pr-3 shadow-3xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <i className="fas fa-wand-magic-sparkles text-blue-500"></i>
                    <input 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && generateUI()}
                      placeholder="e.g. A sleek dark pricing table with glassmorphism effects"
                      className="flex-1 bg-transparent border-none focus:outline-none text-xs text-white font-medium"
                    />
                    <button 
                      onClick={generateUI} 
                      disabled={loading} 
                      className="h-10 px-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-2xl transition-all shadow-xl hover:scale-105 active:scale-95"
                    >
                      Initialize
                    </button>
                </div>
              </div>
            )}
          </main>

          {/* Inspector Panel */}
          {!previewMode && (
            <aside className="w-80 border-l border-[#18181b] flex flex-col shrink-0 bg-[#09090b]">
              <div className="p-4 border-b border-[#18181b]">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Configuration</span>
              </div>
              {selectedId ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar animate-panel">
                  <button 
                    onClick={() => {
                      const el = elements.find(e => e.id === selectedId);
                      if (el) {
                        setTemplates(prev => [...prev, {...el, timestamp: new Date(), id: Math.random().toString(36).substr(2, 9)}]);
                        addLog('success', 'Asset added to Repository');
                      }
                    }} 
                    className="w-full py-3.5 bg-blue-600/10 border border-blue-500/50 text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <i className="fas fa-plus-circle"></i> Save to Lattice
                  </button>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Layer ID</label>
                    <div className="p-4 bg-[#18181b] rounded-2xl border border-zinc-800 text-[10px] font-mono text-zinc-400">{selectedId}</div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Live Source</label>
                    <textarea 
                      value={elements.find(e => e.id === selectedId)?.code || ''}
                      onChange={(e) => setElements(prev => prev.map(el => el.id === selectedId ? {...el, code: e.target.value} : el))}
                      className="w-full h-[50vh] bg-[#0c0c0e] p-5 rounded-2xl border border-zinc-800 font-mono text-[10px] text-emerald-500 focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-30">
                   <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-6">
                      <i className="fas fa-mouse-pointer text-xs"></i>
                   </div>
                   <p className="text-[10px] font-black text-zinc-500 uppercase leading-relaxed tracking-widest">Select an element on canvas to modify parameters</p>
                </div>
              )}
            </aside>
          )}
        </div>
      ) : (
        /* Lattice Repository */
        <main className="flex-1 bg-[#09090b] overflow-y-auto custom-scrollbar p-12 animate-panel">
           <div className="max-w-7xl mx-auto">
              <header className="mb-16 flex flex-col md:flex-row justify-between items-end gap-8 border-b border-[#18181b] pb-8">
                 <div>
                    <h2 className="text-4xl font-black tracking-tighter text-white mb-3">Lattice Store</h2>
                    <p className="text-zinc-500 text-sm font-medium">Manage your production assets and UI templates.</p>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="relative w-80">
                       <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs"></i>
                       <input 
                          value={tplSearch}
                          onChange={(e) => setTplSearch(e.target.value)}
                          placeholder="Search repository..." 
                          className="w-full bg-[#18181b] border border-[#27272a] rounded-2xl py-3 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" 
                       />
                    </div>
                    <div className="text-right">
                       <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] block mb-1">Stock Level</span>
                       <span className="text-4xl font-black text-blue-500 font-mono leading-none">{filteredTemplates.length}</span>
                    </div>
                 </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                 {filteredTemplates.map(tpl => (
                    <div key={tpl.id} className="group relative bg-[#18181b]/30 border border-[#27272a] rounded-[2.5rem] overflow-hidden hover:border-blue-500/50 hover:shadow-3xl transition-all duration-700">
                       <div className="p-6 border-b border-[#27272a] flex justify-between items-center bg-[#1e1e20]/50">
                          <span className="text-[11px] font-black text-zinc-300 truncate tracking-tight uppercase">{tpl.name}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) setTemplates(prev => prev.filter(t => t.id !== tpl.id)); }} 
                            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all text-zinc-700"
                          >
                             <i className="fas fa-trash-alt text-[10px]"></i>
                          </button>
                       </div>
                       
                       <div className="h-64 relative overflow-hidden bg-[#0c0c0e] flex items-center justify-center">
                          <div className="scale-[0.45] origin-center pointer-events-none opacity-40 group-hover:opacity-100 transition-all duration-700 transform group-hover:scale-[0.5]">
                             <div className="bg-white rounded-3xl shadow-3xl overflow-hidden min-w-[900px]">
                                <div dangerouslySetInnerHTML={{ __html: extractBody(tpl.code) }} className="font-sans" />
                             </div>
                          </div>
                          <div className="absolute inset-0 bg-[#09090b]/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[6px]">
                             <button 
                                onClick={() => {
                                  const newEl = {...tpl, id: Math.random().toString(36).substr(2, 9), timestamp: new Date(), visible: true};
                                  setElements(prev => [...prev, newEl]);
                                  setSelectedId(newEl.id);
                                  setView(AppView.CANVAS);
                                  addLog('success', `Injected ${tpl.name} into Studio`);
                                }} 
                                className="px-10 py-4 bg-white text-black text-[11px] font-black uppercase rounded-[2rem] transform translate-y-6 group-hover:translate-y-0 transition-all shadow-3xl hover:bg-blue-600 hover:text-white active:scale-95"
                             >
                                Deploy to Studio
                             </button>
                          </div>
                       </div>

                       <div className="p-6 bg-[#18181b]/50 flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest mb-1">Versioned</span>
                             <span className="text-[11px] text-zinc-500 font-mono">ID: {tpl.id.slice(0, 8)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 text-[9px] font-black uppercase group-hover:text-blue-500 transition-colors">
                                View Code
                             </div>
                          </div>
                       </div>
                    </div>
                 ))}
                 
                 {filteredTemplates.length === 0 && (
                   <div className="col-span-full h-96 border-2 border-dashed border-zinc-900 rounded-[3rem] flex flex-col items-center justify-center opacity-30">
                      <i className="fas fa-search text-5xl mb-6"></i>
                      <p className="text-sm font-black uppercase tracking-widest">No matching assets found</p>
                   </div>
                 )}
              </div>
           </div>
        </main>
      )}

      {/* Terminal Overlay */}
      {showLogs && (
        <div className="absolute bottom-28 left-8 w-[450px] max-h-80 bg-[#09090b]/90 backdrop-blur-2xl border border-[#27272a] rounded-3xl shadow-3xl z-50 flex flex-col font-mono text-[10px] overflow-hidden scale-100 animate-panel">
           <div className="p-4 border-b border-[#27272a] flex justify-between items-center bg-[#18181b]/80">
             <div className="flex items-center gap-3">
               <div className="flex gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
               </div>
               <span className="text-zinc-500 font-bold uppercase tracking-wider ml-4">System Monitor</span>
             </div>
             <button onClick={() => setShowLogs(false)} className="text-zinc-600 hover:text-white transition-colors"><i className="fas fa-times text-xs"></i></button>
           </div>
           <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
             {logs.map(log => (
               <div key={log.id} className="flex gap-4 leading-loose group">
                 <span className="text-zinc-800 shrink-0 font-bold">[{log.timestamp.toLocaleTimeString()}]</span>
                 <span className={`font-black uppercase tracking-tighter ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-500' : 'text-blue-500'}`}>
                   {log.type}
                 </span>
                 <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">{log.message}</span>
               </div>
             ))}
             {logs.length === 0 && <div className="text-zinc-800 italic">Listening for system events...</div>}
           </div>
        </div>
      )}
    </div>
  );
};

function extractBody(html: string): string {
  if (!html) return '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

export default App;

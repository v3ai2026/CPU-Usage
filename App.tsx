
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppView, UIElement, ViewportSize, BackendMode, VariationRecord, CodeVariationRecord } from './types';
import * as geminiService from './services/geminiService';
import QuotaAlert from './components/QuotaAlert';

const INSPIRATION_CHIPS = [
  "SaaS Landing Page Hero",
  "Crypto Portfolio Grid",
  "AI Chat Interface",
  "Apple-style Pricing Card",
  "Modern Sidebar Navigation"
];

/**
 * High-performance Snow Overlay component using CSS animations
 * Now accepts density and speed props for customization
 */
const SnowOverlay: React.FC<{ density: number; speed: number }> = ({ density, speed }) => {
  const snowflakes = useMemo(() => {
    // Map 0-100 density to 0-120 particles
    const count = Math.floor((density / 100) * 120);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 3 + 1}px`,
      // Base duration 10-20s, divided by speed (1.0 is normal, 2.0 is fast)
      duration: `${(Math.random() * 10 + 10) / speed}s`,
      delay: `${Math.random() * -20}s`, // Negative delay for immediate start
      opacity: Math.random() * 0.3 + 0.05
    }));
  }, [density, speed]);

  if (density === 0) return null;

  return (
    <div className="snow-overlay">
      {snowflakes.map(sf => (
        <div 
          key={sf.id} 
          className="snowflake"
          style={{
            left: sf.left,
            width: sf.size,
            height: sf.size,
            animationDuration: sf.duration,
            animationDelay: sf.delay,
            opacity: sf.opacity
          }}
        />
      ))}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.CANVAS);
  const [backendMode] = useState<BackendMode>('cloud-api');
  const [useSearch, setUseSearch] = useState(false);
  
  // Scene Settings
  const [snowDensity, setSnowDensity] = useState(30);
  const [snowSpeed, setSnowSpeed] = useState(1.0);

  const [elements, setElements] = useState<UIElement[]>(() => {
    const saved = localStorage.getItem('flux_studio_v1.2');
    if (saved) {
      try {
        return JSON.parse(saved).map((el: any) => ({ 
            ...el, 
            timestamp: new Date(el.timestamp),
            codeVariations: el.codeVariations?.map((v: any) => ({ ...v, timestamp: new Date(v.timestamp) })) || []
        }));
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [variationLoading, setVariationLoading] = useState(false);
  const [remixLoading, setRemixLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [streamingCode, setStreamingCode] = useState<string>('');
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    scene: false,
    imaging: true,
    remix: true,
    variants: true,
    logic: true,
    timeline: false
  });

  const elementsRef = useRef(elements);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    elementsRef.current = elements;
    localStorage.setItem('flux_studio_v1.2', JSON.stringify(elements));
  }, [elements]);

  const selectedElement = elements.find(el => el.id === selectedId);

  const generateUI = async (isRefining: boolean = false, overridePrompt?: string) => {
    const targetPrompt = overridePrompt || prompt;
    if (!targetPrompt.trim() && !selectedElement?.imageData) return;
    
    setLoading(true);
    setError(null);
    setStreamingCode('');
    setCurrentSources([]);
    
    try {
      const result = await geminiService.generateWebComponentStream(
        targetPrompt || "Create a clean UI component based on this image",
        backendMode,
        (chunk, sources) => {
            setStreamingCode(chunk);
            if (sources) setCurrentSources(sources);
        },
        selectedElement?.imageData,
        useSearch
      );

      const finalCode = result.code;
      const finalSources = result.sources;

      if (isRefining && selectedId) {
        setElements(prev => prev.map(el => {
            if (el.id === selectedId) {
                const newVar: CodeVariationRecord = { code: el.code, style: 'Previous', timestamp: new Date() };
                return { 
                    ...el, 
                    code: finalCode, 
                    codeVariations: [newVar, ...(el.codeVariations || [])],
                    analysis: finalSources ? JSON.stringify(finalSources) : el.analysis
                };
            }
            return el;
        }));
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        const newEl: UIElement = {
          id: newId,
          name: `comp-${elements.length + 1}`,
          type: 'custom',
          code: finalCode,
          prompt: targetPrompt,
          timestamp: new Date(),
          selected: false,
          visible: true,
          codeVariations: [],
          imageData: selectedElement?.imageData,
          analysis: finalSources ? JSON.stringify(finalSources) : undefined
        };
        setElements(prev => [newEl, ...prev]);
        setSelectedId(newId);
      }
      setPrompt('');
      setStreamingCode('');
      setCurrentSources([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (selectedId) {
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, imageData: base64 } : el));
      } else {
        const newId = 'temp-' + Math.random().toString(36).substr(2, 9);
        const newEl: UIElement = {
          id: newId,
          name: 'Image Context',
          type: 'custom',
          code: '<div class="p-8 text-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-3xl">Waiting for prompt with image context...</div>',
          prompt: 'Image uploaded',
          timestamp: new Date(),
          selected: false,
          visible: true,
          imageData: base64,
          codeVariations: []
        };
        setElements(prev => [newEl, ...prev]);
        setSelectedId(newId);
      }
    };
    reader.readAsDataURL(file);
  };

  const runOCR = async () => {
    if (!selectedElement?.imageData) return;
    setOcrLoading(true);
    try {
      const text = await geminiService.performOCR(selectedElement.imageData);
      setPrompt(prev => prev ? `${prev}\n\nExtracted Text:\n${text}` : `Build a component using this text: ${text}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const runImageVariation = async () => {
    if (!selectedElement?.imageData) return;
    setVariationLoading(true);
    try {
      const newImage = await geminiService.generateImageVariation(selectedElement.imageData, prompt || "Creative variation");
      setElements(prev => prev.map(el => el.id === selectedId ? { ...el, imageData: newImage } : el));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVariationLoading(false);
    }
  };

  const copyCode = () => {
    if (selectedElement) {
      navigator.clipboard.writeText(selectedElement.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const InspectorSection: React.FC<{ 
    id: string; 
    title: string; 
    statusColor?: string; 
    children: React.ReactNode 
  }> = ({ id, title, statusColor, children }) => {
    const isOpen = openSections[id];
    return (
      <div className="border-b border-zinc-900 last:border-b-0">
        <button 
          onClick={() => setOpenSections(prev => ({...prev, [id]: !prev[id]}))}
          className="w-full flex items-center justify-between p-5 hover:bg-zinc-900/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor || 'bg-zinc-600'}`}></div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">{title}</span>
          </div>
          <i className={`fas fa-chevron-down text-[10px] text-zinc-700 transition-transform ${isOpen ? '' : '-rotate-90'}`}></i>
        </button>
        {isOpen && <div className="px-5 pb-6 space-y-5 animate-in fade-in slide-in-from-top-1">{children}</div>}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#020202] text-zinc-100 overflow-hidden selection:bg-blue-500/30">
      <header className="h-[68px] border-b border-zinc-900 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md z-[100] shrink-0">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-white rounded-[12px] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:rotate-12 transition-transform">
              <i className="fas fa-bolt text-black text-sm"></i>
            </div>
            <div>
              <span className="text-sm font-black tracking-tight block">GEMINI FLUX</span>
              <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">Studio v1.2</span>
            </div>
          </div>
          
          <nav className="flex p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
             <button onClick={() => setView(AppView.CANVAS)} className={`px-6 py-2 text-[10px] font-bold rounded-lg transition-all ${view === AppView.CANVAS ? 'bg-zinc-100 text-black shadow-lg shadow-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}>WORKSPACE</button>
             <button onClick={() => setView(AppView.COMPONENTS)} className={`px-6 py-2 text-[10px] font-bold rounded-lg transition-all ${view === AppView.COMPONENTS ? 'bg-zinc-100 text-black shadow-lg shadow-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}>BLUEPRINTS</button>
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
             <button onClick={() => setViewport('desktop')} className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewport === 'desktop' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}><i className="fas fa-desktop text-xs"></i></button>
             <button onClick={() => setViewport('mobile')} className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewport === 'mobile' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}><i className="fas fa-mobile-alt text-xs"></i></button>
          </div>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
            {previewMode ? 'Exit Preview' : 'Preview Build'}
          </button>
          <div className="w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center relative">
             <i className="fas fa-user-shield text-zinc-500 text-sm"></i>
             <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!previewMode && (
          <aside className="w-[280px] border-r border-zinc-900 flex flex-col shrink-0 bg-[#050505]">
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Layers</span>
              <button onClick={() => setElements([])} className="text-zinc-700 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {elements.length === 0 && (
                <div className="py-20 text-center">
                  <i className="fas fa-plus-circle text-zinc-800 text-3xl mb-4"></i>
                  <p className="text-[9px] uppercase font-black text-zinc-800 tracking-widest">Workspace Empty</p>
                </div>
              )}
              {elements.map(el => (
                <div key={el.id} onClick={() => setSelectedId(el.id)} className={`group px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${selectedId === el.id ? 'bg-zinc-900 border-zinc-700 shadow-xl' : 'hover:bg-zinc-900/30 border-transparent'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${selectedId === el.id ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-zinc-800'}`}></div>
                    <span className={`text-[11px] font-bold truncate ${selectedId === el.id ? 'text-white' : 'text-zinc-500'}`}>{el.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 relative bg-black canvas-grid overflow-auto custom-scrollbar flex flex-col items-center">
          {/* Background Snow Layer */}
          <SnowOverlay density={snowDensity} speed={snowSpeed} />
          
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none"></div>
          
          <div className={`relative z-10 transition-all duration-500 pt-12 pb-72 ${viewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-5xl px-12'}`}>
            <QuotaAlert error={error || undefined} onRetry={() => generateUI()} />

            {(loading || remixLoading) && streamingCode && (
              <div className="mb-16 opacity-70 scale-[0.98] blur-[0.5px] transition-all">
                <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl" dangerouslySetInnerHTML={{ __html: streamingCode }} />
              </div>
            )}

            {elements.map(el => (
              <div key={el.id} className="mb-16">
                <div 
                  onClick={() => setSelectedId(el.id)}
                  className={`group relative rounded-[2.5rem] bg-white text-black overflow-hidden transition-all duration-300 cursor-pointer ${selectedId === el.id ? 'ring-2 ring-blue-500 shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_40px_rgba(59,130,246,0.2)] scale-[1.01]' : 'hover:scale-[1.005] hover:ring-1 hover:ring-zinc-700'}`}
                >
                  <div dangerouslySetInnerHTML={{ __html: el.code }} />
                </div>
                {el.analysis && (
                  <div className="mt-6 flex flex-wrap gap-3 px-8">
                     <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block w-full mb-1">Citations & Grounding:</span>
                     {JSON.parse(el.analysis).map((src: any, i: number) => src.web && (
                        <a key={i} href={src.web.uri} target="_blank" className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded-lg text-[9px] text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">
                          <i className="fas fa-link text-[8px]"></i>
                          {src.web.title || 'Source Reference'}
                        </a>
                     ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!previewMode && (
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-[200]">
              <div className="flex flex-wrap justify-center gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
                {INSPIRATION_CHIPS.map(chip => (
                  <button 
                    key={chip} 
                    onClick={() => { setPrompt(chip); generateUI(false, chip); }}
                    className="px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-full text-[9px] font-bold text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
              <div className={`glass-panel rounded-3xl p-3 shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex items-center gap-4 transition-all ${selectedId ? 'border-blue-500/40 ring-8 ring-blue-500/5' : ''}`}>
                <button 
                  onClick={() => setUseSearch(!useSearch)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${useSearch ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 text-zinc-600 hover:text-zinc-400'}`}
                  title="Toggle Search Grounding"
                >
                  <i className={`fas fa-satellite-dish text-sm ${useSearch ? 'animate-pulse' : ''}`}></i>
                </button>
                <input 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && generateUI(!!selectedId)}
                  placeholder={selectedId ? `Refine ${selectedElement?.name}...` : "Command the AI to build something extraordinary..."} 
                  className="flex-1 bg-transparent border-none focus:outline-none text-[15px] text-zinc-100 font-medium py-2"
                />
                <button 
                  onClick={() => generateUI(!!selectedId)} 
                  disabled={loading || remixLoading || !prompt.trim()} 
                  className={`h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 disabled:opacity-20 ${selectedId ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                >
                  {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-chevron-right"></i>}
                  {selectedId ? 'Commit' : 'Deploy'}
                </button>
              </div>
            </div>
          )}
        </main>

        {!previewMode && selectedId && (
          <aside className="w-[360px] border-l border-zinc-900 bg-[#050505] flex flex-col z-50 overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-black">
              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Global Inspector</span>
              <button onClick={() => setSelectedId(null)} className="text-zinc-700 hover:text-white transition-colors"><i className="fas fa-times text-xs"></i></button>
            </div>
            
            <div className="flex-1 flex flex-col">
              <InspectorSection id="scene" title="Scene Engine" statusColor="bg-blue-400">
                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Snow Density</span>
                      <span className="text-[10px] font-mono text-blue-400">{snowDensity}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={snowDensity} 
                      onChange={(e) => setSnowDensity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Drift Speed</span>
                      <span className="text-[10px] font-mono text-blue-400">{snowSpeed.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" max="3" step="0.1"
                      value={snowSpeed} 
                      onChange={(e) => setSnowSpeed(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </InspectorSection>

              <InspectorSection id="imaging" title="Visual Context" statusColor="bg-amber-500">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  accept="image/*" 
                />
                
                {selectedElement?.imageData ? (
                  <div className="space-y-4">
                    <div className="relative group rounded-2xl overflow-hidden aspect-video bg-zinc-900 border border-zinc-800">
                      <img src={selectedElement.imageData} alt="Context" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-widest"
                      >
                        Change Image
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={runOCR}
                        disabled={ocrLoading}
                        className="py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        {ocrLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-font"></i>}
                        Scan Text
                      </button>
                      <button 
                        onClick={runImageVariation}
                        disabled={variationLoading}
                        className="py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        {variationLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                        Mutate
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-12 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-zinc-700 hover:bg-zinc-900/20 transition-all group"
                  >
                    <i className="fas fa-cloud-upload-alt text-2xl text-zinc-800 group-hover:text-zinc-600 transition-colors"></i>
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest group-hover:text-zinc-500">Upload Reference</span>
                  </button>
                )}
              </InspectorSection>

              <InspectorSection id="variants" title="AI Variation Engine" statusColor="bg-blue-500">
                <p className="text-[10px] text-zinc-600 mb-6 leading-relaxed uppercase font-bold tracking-tight">Experiment with automated visual mutations based on the primary prompt.</p>
                <button 
                  onClick={() => generateUI(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:border-zinc-700 border border-zinc-800 transition-all shadow-xl"
                >
                  {loading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-sync-alt"></i>}
                  Execute Mutation
                </button>
              </InspectorSection>

              <InspectorSection id="remix" title="Aesthetic Presets" statusColor="bg-purple-500">
                <div className="grid grid-cols-2 gap-3">
                    {['Glassmorphism', 'Neo-Brutalism', 'Bento Grid', 'Cyber-Noir'].map(vibe => (
                        <button
                          key={vibe}
                          onClick={() => { setPrompt(`Remix into ${vibe} style`); generateUI(true, `Remix this component into ${vibe} style`); }}
                          className="flex flex-col items-center gap-3 p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white hover:border-zinc-600 transition-all"
                        >
                          <i className="fas fa-palette text-zinc-800"></i>
                          {vibe}
                        </button>
                    ))}
                </div>
              </InspectorSection>

              <InspectorSection id="logic" title="Source & Control" statusColor="bg-emerald-500">
                <button onClick={copyCode} className="w-full py-5 bg-zinc-100 text-black rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-2xl active:scale-[0.98]">
                  {copied ? 'Copied to Buffer' : 'Export Component'}
                </button>
              </InspectorSection>

              <InspectorSection id="timeline" title="Version Snapshot">
                <div className="space-y-3">
                  {selectedElement?.codeVariations?.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-all">
                       <span className="text-[10px] font-bold text-zinc-600 uppercase">Snapshot v.{selectedElement.codeVariations!.length - i}</span>
                       <button onClick={() => setElements(prev => prev.map(el => el.id === selectedId ? {...el, code: v.code} : el))} className="text-[10px] font-black text-blue-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all">RESTORE</button>
                    </div>
                  ))}
                </div>
              </InspectorSection>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;

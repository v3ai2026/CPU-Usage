
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
 */
const SnowOverlay: React.FC<{ density: number; speed: number; enabled: boolean }> = ({ density, speed, enabled }) => {
  const snowflakes = useMemo(() => {
    if (!enabled) return [];
    const count = Math.floor((density / 100) * 120);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 3 + 1}px`,
      duration: `${(Math.random() * 10 + 10) / speed}s`,
      delay: `${Math.random() * -20}s`,
      opacity: Math.random() * 0.3 + 0.05
    }));
  }, [density, speed, enabled]);

  if (!enabled || density === 0) return null;

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
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  
  // Scene Settings
  const [snowEnabled, setSnowEnabled] = useState(true);
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
  
  // Drag and Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    scene: true,
    imaging: true,
    remix: true,
    variants: true,
    logic: true,
    timeline: false,
    grounding: true
  });

  const elementsRef = useRef(elements);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if API key is correctly configured via define plugin in vite.config.ts
    const key = process.env.API_KEY;
    if (!key || key === 'undefined' || key === '') {
      setIsApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    elementsRef.current = elements;
    localStorage.setItem('flux_studio_v1.2', JSON.stringify(elements));
  }, [elements]);

  const selectedElement = elements.find(el => el.id === selectedId);

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (previewMode) return;
    const el = elements.find(item => item.id === id);
    if (!el) return;

    setSelectedId(id);
    setDraggingId(id);
    
    const posX = el.position?.x || 0;
    const posY = el.position?.y || 0;
    
    setDragOffset({
      x: e.clientX - posX,
      y: e.clientY - posY
    });
    
    // Prevent text selection during drag
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingId) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      setElements(prev => prev.map(el => 
        el.id === draggingId 
          ? { ...el, position: { x: newX, y: newY } } 
          : el
      ));
    };

    const handleMouseUp = () => {
      setDraggingId(null);
    };

    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragOffset]);

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
            if (sources && sources.length > 0) setCurrentSources(sources);
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
        // Staggered positioning
        const spacing = 40;
        const initialX = spacing + (elements.length * 20);
        const initialY = 100 + (elements.length * 60);

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
          analysis: finalSources ? JSON.stringify(finalSources) : undefined,
          position: { x: initialX, y: initialY }
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
          codeVariations: [],
          position: { x: 100, y: 100 }
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
      <div className="border-b border-zinc-900/50 last:border-b-0">
        <button 
          onClick={() => setOpenSections(prev => ({...prev, [id]: !prev[id]}))}
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/30 transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-1 h-1 rounded-full ${statusColor || 'bg-zinc-800'}`}></div>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.15em] group-hover:text-zinc-400 transition-colors">{title}</span>
          </div>
          <i className={`fas fa-chevron-right text-[8px] text-zinc-800 transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
        </button>
        {isOpen && <div className="px-4 pb-5 space-y-4 animate-in fade-in slide-in-from-top-1">{children}</div>}
      </div>
    );
  };

  return (
    <div className={`h-screen w-screen flex flex-col bg-[#020202] text-zinc-100 overflow-hidden selection:bg-blue-500/30 ${draggingId ? 'cursor-grabbing' : ''}`}>
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
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${isApiKeyMissing ? 'bg-red-500/5 border-red-500/20 text-red-500/70' : 'bg-green-500/5 border-green-500/20 text-green-500/70'}`}>
             <i className={`fas ${isApiKeyMissing ? 'fa-unlink' : 'fa-link'}`}></i>
             {isApiKeyMissing ? 'Disconnected' : 'Engine Live'}
          </div>

          <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
             <button onClick={() => setViewport('desktop')} className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewport === 'desktop' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}><i className="fas fa-desktop text-xs"></i></button>
             <button onClick={() => setViewport('mobile')} className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${viewport === 'mobile' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}><i className="fas fa-mobile-alt text-xs"></i></button>
          </div>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${previewMode ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'}`}>
            {previewMode ? 'Exit Preview' : 'Preview'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!previewMode && (
          <aside className="w-[280px] border-r border-zinc-900/50 flex flex-col shrink-0 bg-[#050505]">
            <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Active Layers</span>
              <button onClick={() => setElements([])} className="text-zinc-800 hover:text-red-900 transition-colors"><i className="fas fa-trash-alt text-[10px]"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {elements.length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <i className="fas fa-plus-circle text-2xl mb-4"></i>
                  <p className="text-[9px] uppercase font-black tracking-widest">Empty</p>
                </div>
              )}
              {elements.map(el => (
                <div key={el.id} onClick={() => setSelectedId(el.id)} className={`group px-4 py-3 rounded-xl cursor-pointer transition-all border ${selectedId === el.id ? 'bg-zinc-900 border-zinc-800' : 'hover:bg-zinc-900/30 border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedId === el.id ? 'bg-blue-500' : 'bg-zinc-800'}`}></div>
                    <span className={`text-[10px] font-bold truncate ${selectedId === el.id ? 'text-zinc-100' : 'text-zinc-600'}`}>{el.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main 
          ref={canvasRef}
          className="flex-1 relative bg-black canvas-grid overflow-auto custom-scrollbar"
        >
          <SnowOverlay enabled={snowEnabled} density={snowDensity} speed={snowSpeed} />
          
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Draggable Components Container */}
          <div className={`relative min-h-[2000px] transition-all duration-500 ${viewport === 'mobile' ? 'max-w-[375px] mx-auto' : 'w-full'}`}>
            {isApiKeyMissing && (
               <div className="absolute top-8 left-12 right-12 p-5 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-500/60 text-[10px] font-bold flex items-center gap-3 z-50">
                 <i className="fas fa-shield-alt"></i>
                 VITE_API_KEY required in environment for deployment.
               </div>
            )}
            
            <div className="absolute top-24 left-12 right-12 z-40">
                <QuotaAlert error={error || undefined} onRetry={() => generateUI()} />
            </div>

            {(loading || remixLoading) && streamingCode && (
              <div className="absolute top-[300px] left-1/2 -translate-x-1/2 w-full max-w-4xl opacity-40 scale-[0.98] blur-[0.5px] transition-all z-30">
                <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl" dangerouslySetInnerHTML={{ __html: streamingCode }} />
              </div>
            )}

            {elements.map(el => (
              <div 
                key={el.id} 
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                style={{ 
                    position: 'absolute', 
                    left: el.position?.x || 48, 
                    top: el.position?.y || 100,
                    width: viewport === 'mobile' ? '375px' : 'auto',
                    maxWidth: viewport === 'mobile' ? '375px' : 'calc(100% - 96px)',
                    zIndex: selectedId === el.id ? 20 : 10,
                    opacity: draggingId === el.id ? 0.7 : 1,
                    transform: draggingId === el.id ? 'scale(1.02)' : 'scale(1)',
                    pointerEvents: loading || remixLoading ? 'none' : 'auto'
                }}
                className={`group rounded-[2.5rem] bg-white text-black overflow-hidden transition-transform duration-200 cursor-grab active:cursor-grabbing ${selectedId === el.id ? 'ring-2 ring-blue-500/50 shadow-[0_40px_80px_rgba(0,0,0,0.8)]' : 'hover:ring-1 hover:ring-zinc-800'}`}
              >
                <div dangerouslySetInnerHTML={{ __html: el.code }} />
                
                {/* Drag Handle Overlay (Visible on Hover) */}
                {!previewMode && (
                   <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-start justify-end p-6">
                      <div className="w-8 h-8 rounded-full bg-black/80 flex items-center justify-center text-white/50">
                         <i className="fas fa-arrows-alt text-xs"></i>
                      </div>
                   </div>
                )}
              </div>
            ))}
          </div>

          {!previewMode && (
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-[200]">
              <div className={`glass-panel rounded-[2rem] p-3 shadow-[0_30px_60px_rgba(0,0,0,0.9)] flex items-center gap-4 transition-all ${selectedId ? 'border-blue-500/20' : 'border-zinc-900/50'}`}>
                <button 
                  onClick={() => setUseSearch(!useSearch)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${useSearch ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-900/50 text-zinc-700 hover:text-zinc-500'}`}
                >
                  <i className="fas fa-globe text-sm"></i>
                </button>
                <input 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && generateUI(!!selectedId)}
                  placeholder={selectedId ? `Refine component...` : "Type to generate UI..."} 
                  className="flex-1 bg-transparent border-none focus:outline-none text-[14px] text-zinc-300 font-medium py-2"
                />
                <button 
                  onClick={() => generateUI(!!selectedId)} 
                  disabled={loading || remixLoading || !prompt.trim()} 
                  className={`h-12 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 disabled:opacity-20 ${selectedId ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-black hover:bg-white'}`}
                >
                  {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-arrow-right"></i>}
                  {selectedId ? 'Refine' : 'Generate'}
                </button>
              </div>
            </div>
          )}
        </main>

        {!previewMode && (
          <aside className="w-[340px] border-l border-zinc-900/50 bg-[#050505] flex flex-col z-50 overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between bg-black">
              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Inspector</span>
              {selectedId && <button onClick={() => setSelectedId(null)} className="text-zinc-800 hover:text-zinc-500"><i className="fas fa-times text-[10px]"></i></button>}
            </div>
            
            <div className="flex-1 flex flex-col divide-y divide-zinc-900/50">
              <InspectorSection id="scene" title="Atmosphere" statusColor="bg-blue-900">
                <div className="space-y-6 pt-1">
                  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-900/50">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Snow Field</span>
                    <button 
                      onClick={() => setSnowEnabled(!snowEnabled)}
                      className={`w-9 h-4.5 rounded-full transition-all relative ${snowEnabled ? 'bg-blue-600' : 'bg-zinc-900'}`}
                    >
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all ${snowEnabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <div className={`space-y-6 transition-all duration-300 ${snowEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">Density</span>
                        <span className="text-[9px] font-mono text-zinc-500">{snowDensity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={snowDensity} 
                        onChange={(e) => setSnowDensity(parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-700"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">Flow Speed</span>
                        <span className="text-[9px] font-mono text-zinc-500">{snowSpeed.toFixed(1)}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" max="3" step="0.1"
                        value={snowSpeed} 
                        onChange={(e) => setSnowSpeed(parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-700"
                      />
                    </div>
                  </div>
                </div>
              </InspectorSection>

              {selectedId ? (
                <>
                  <InspectorSection id="imaging" title="Vision Reference" statusColor="bg-zinc-900">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    {selectedElement?.imageData ? (
                      <div className="space-y-3">
                        <div className="relative group rounded-xl overflow-hidden aspect-video bg-zinc-950 border border-zinc-900/50">
                          <img src={selectedElement.imageData} alt="Context" className="w-full h-full object-cover opacity-50" />
                          <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-[8px] font-bold uppercase tracking-widest">Change</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={runOCR} disabled={ocrLoading} className="py-2.5 px-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-[8px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all flex items-center justify-center gap-2">
                            {ocrLoading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-font"></i>}
                            Scan
                          </button>
                          <button onClick={runImageVariation} disabled={variationLoading} className="py-2.5 px-3 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-[8px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all flex items-center justify-center gap-2">
                            {variationLoading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                            Vibe
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 border border-dashed border-zinc-900 rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-zinc-900/20 transition-all">
                        <i className="fas fa-camera text-zinc-800 text-lg"></i>
                        <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest">Upload Frame</span>
                      </button>
                    )}
                  </InspectorSection>

                  <InspectorSection id="variants" title="AI Mutator" statusColor="bg-zinc-900">
                    <button onClick={() => generateUI(true)} disabled={loading} className="w-full py-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 text-zinc-500 text-[9px] font-bold uppercase tracking-widest hover:text-zinc-300 hover:border-zinc-700 transition-all flex items-center justify-center gap-2">
                      {loading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-redo"></i>}
                      Mutate Code
                    </button>
                  </InspectorSection>

                  <InspectorSection id="remix" title="Aesthetics" statusColor="bg-zinc-900">
                    <div className="grid grid-cols-2 gap-2">
                        {['Glass', 'Bento', 'Minimal', 'Neon'].map(vibe => (
                            <button key={vibe} onClick={() => generateUI(true, `Remix into ${vibe} style`)} className="p-4 bg-zinc-950 border border-zinc-900/50 rounded-xl text-[8px] font-bold uppercase tracking-widest text-zinc-700 hover:text-zinc-300 hover:border-zinc-700 transition-all">
                              {vibe}
                            </button>
                        ))}
                    </div>
                  </InspectorSection>

                  {/* Rendering grounding sources to comply with mandatory search requirements */}
                  {(currentSources.length > 0 || (selectedElement?.analysis && JSON.parse(selectedElement.analysis).length > 0)) && (
                    <InspectorSection id="grounding" title="Research Sources" statusColor="bg-green-900">
                      <div className="space-y-2">
                        {(currentSources.length > 0 ? currentSources : JSON.parse(selectedElement?.analysis || '[]')).map((chunk: any, i: number) => {
                          const web = chunk.web;
                          if (!web) return null;
                          return (
                            <a 
                              key={i}
                              href={web.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-[8px] text-zinc-400 hover:text-blue-400 transition-colors truncate"
                            >
                              <i className="fas fa-external-link-alt mr-2 text-[6px]"></i>
                              {web.title || web.uri}
                            </a>
                          );
                        })}
                      </div>
                    </InspectorSection>
                  )}

                  <div className="p-4 mt-auto">
                    <div className="flex items-center justify-between mb-4 px-1">
                       <span className="text-[8px] font-bold text-zinc-700 uppercase">Coordinates</span>
                       <span className="text-[8px] font-mono text-zinc-500">
                         {Math.round(selectedElement?.position?.x || 0)}, {Math.round(selectedElement?.position?.y || 0)}
                       </span>
                    </div>
                    <button onClick={copyCode} className="w-full py-4 bg-zinc-900/50 border border-zinc-800 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 hover:text-white transition-all">
                      {copied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                   <i className="fas fa-box-open text-4xl mb-4"></i>
                   <p className="text-[8px] font-bold uppercase tracking-widest">Select Layer</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;

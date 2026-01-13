
import React, { useState, useEffect, useRef } from 'react';
import { AppView, UIElement, LogEntry, ViewportSize, BackendMode, CanvasMode } from './types';
import * as geminiService from './services/geminiService';
import QuotaAlert from './components/QuotaAlert';

const AESTHETIC_SEEDS = [
  { id: 'glass', name: 'Aurora Glass', prompt: 'modern glassmorphism design, translucent backgrounds, colorful blurs' },
  { id: 'neo', name: 'Neumorphic', prompt: 'soft shadows, extruded surfaces, minimal monochromatic' },
  { id: 'bento', name: 'Bento Grid', prompt: 'structured grid cells, rounded corners, information-dense layout' },
  { id: 'dark-pro', name: 'Enterprise Dark', prompt: 'deep black #050505, hairline borders, emerald accents, professional SaaS' }
];

const VARIATION_STYLES = [
  { id: 'photorealistic', label: 'Realistic', prompt: 'photorealistic, 8k resolution, cinematic lighting', icon: 'camera' },
  { id: 'cyberpunk', label: 'Cyberpunk', prompt: 'neon cyberpunk, synthwave aesthetic, dark moody lighting', icon: 'bolt' },
  { id: 'watercolor', label: 'Artistic', prompt: 'artistic watercolor painting, soft textures, bleeding colors', icon: 'palette' }
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.CANVAS);
  const [backendMode, setBackendMode] = useState<BackendMode>('cloud-api');
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('stack');
  const [elements, setElements] = useState<UIElement[]>(() => {
    const saved = localStorage.getItem('onlook_project_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((el: any) => ({ ...el, timestamp: new Date(el.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedElement = elements.find(el => el.id === selectedId);

  const [activeSeed, setActiveSeed] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [assetPrompt, setAssetPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [variationLoading, setVariationLoading] = useState(false);
  const [customVariationPrompt, setCustomVariationPrompt] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [quotaError, setQuotaError] = useState<string | undefined>(undefined);
  const [generatedAssets, setGeneratedAssets] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>(new Date().toLocaleTimeString());
  const [layerSearch, setLayerSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    localStorage.setItem('onlook_project_v3', JSON.stringify(elements));
  }, [elements]);

  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem('onlook_project_v3', JSON.stringify(elementsRef.current));
      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev.slice(-19), { id: Math.random().toString(36), timestamp: new Date(), type, message }]);
  };

  const injectAssetToCanvas = (assetUrl: string) => {
    const newEl: UIElement = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Asset ${elements.length + 1}`,
      type: 'custom',
      code: `<div class="p-8 flex items-center justify-center bg-transparent"><img src="${assetUrl}" class="max-w-full h-auto rounded-[2rem] shadow-2xl transition-transform hover:scale-[1.02]" /></div>`,
      prompt: 'Injected asset from generation',
      timestamp: new Date(),
      selected: false,
      visible: true,
      imageData: assetUrl,
      variations: [assetUrl],
      position: { x: 300 + Math.random() * 50, y: 150 + Math.random() * 50 }
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
    addLog('info', 'Asset successfully deployed to workspace');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (selectedId) {
        setElements(prev => prev.map(el => el.id === selectedId ? { 
          ...el, 
          imageData: base64,
          variations: [base64, ...(el.variations || [])]
        } : el));
        addLog('info', 'Local image seed attached to active layer');
      }
    };
    reader.readAsDataURL(file);
  };

  const generateUI = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setQuotaError(undefined);
    const seedContext = activeSeed ? AESTHETIC_SEEDS.find(s => s.id === activeSeed)?.prompt : '';
    const fullPrompt = seedContext ? `Style reference: ${seedContext}. Task: ${prompt}` : prompt;
    addLog('request', `Synthesizing context: "${fullPrompt}"`);
    try {
      const finalCode = await geminiService.generateWebComponentStream(
        fullPrompt,
        backendMode,
        () => {},
        selectedElement?.imageData
      );
      const newEl: UIElement = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Synth Layer ${elements.length + 1}`,
        type: 'custom',
        code: finalCode,
        prompt: prompt,
        timestamp: new Date(),
        selected: false,
        visible: true,
        position: { x: 300 + Math.random() * 50, y: 150 + Math.random() * 50 }
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      setPrompt('');
      addLog('success', 'Component deployed');
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('quota')) setQuotaError("Project quota tier not specified.");
      addLog('error', `Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateAsset = async () => {
    if (!assetPrompt.trim()) return;
    setAssetLoading(true);
    addLog('request', `Materializing: "${assetPrompt}"`);
    try {
      const imageUrl = await geminiService.generateImage(assetPrompt);
      setGeneratedAssets(prev => [imageUrl, ...prev]);
      addLog('success', 'Asset ready');
    } catch (err: any) {
      addLog('error', `Asset failed: ${err.message}`);
    } finally {
      setAssetLoading(false);
    }
  };

  const handleGenerateVariation = async (stylePrompt?: string) => {
    if (!selectedElement?.imageData || variationLoading) return;
    const promptToUse = stylePrompt || customVariationPrompt;
    if (!promptToUse.trim()) return;

    setVariationLoading(true);
    addLog('request', `Synthesizing variation: "${promptToUse}"`);
    try {
      const newImageUrl = await geminiService.generateImageVariation(
        selectedElement.imageData,
        promptToUse
      );
      setElements(prev => prev.map(el => el.id === selectedId ? { 
        ...el, 
        imageData: newImageUrl,
        variations: [newImageUrl, ...(el.variations || [])],
        // Update code if it contains the image
        code: el.code.replace(/src="[^"]*"/, `src="${newImageUrl}"`)
      } : el));
      setCustomVariationPrompt('');
      addLog('success', 'Visual DNA updated with new variation');
    } catch (err: any) {
      addLog('error', `Variation failed: ${err.message}`);
    } finally {
      setVariationLoading(false);
    }
  };

  const selectVariation = (imageUrl: string) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? {
      ...el,
      imageData: imageUrl,
      code: el.code.replace(/src="[^"]*"/, `src="${imageUrl}"`)
    } : el));
    addLog('info', 'Switched to variation');
  };

  const copyCodeToClipboard = () => {
    if (selectedElement) {
      navigator.clipboard.writeText(selectedElement.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const highlightHTML = (code: string) => {
    if (!code) return '';
    return code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/(".*?")/g, '<span class="syntax-string">$1</span>')
      .replace(/\b(class|id|src|href|alt|type|name|value|style)\b/g, '<span class="syntax-attr">$1</span>')
      .replace(/(&lt;\/?[a-z1-6]+)/gi, '<span class="syntax-tag">$1</span>')
      .replace(/(&gt;)/g, '<span class="syntax-tag">$1</span>');
  };

  const filteredElements = elements.filter(el => 
    el.name.toLowerCase().includes(layerSearch.toLowerCase())
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#030303] text-zinc-100 overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      
      <header className="h-[64px] border-b border-zinc-900 flex items-center justify-between px-8 bg-black/80 backdrop-blur-3xl shrink-0 z-[100]">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView(AppView.CANVAS)}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fas fa-microchip text-white text-[12px]"></i>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-white italic">FLUX STUDIO</span>
              <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-[0.3em] mt-0.5">Design Intelligence</span>
            </div>
          </div>
          <nav className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
             <button onClick={() => setView(AppView.CANVAS)} className={`px-4 py-1.5 text-[9px] font-bold rounded-md transition-all ${view === AppView.CANVAS ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>WORKSPACE</button>
             <button onClick={() => setView(AppView.ASSETS)} className={`px-4 py-1.5 text-[9px] font-bold rounded-md transition-all ${view === AppView.ASSETS ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}>ASSETS</button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.2em]">Auto-Save</span>
            <span className="text-[8px] font-bold text-emerald-500 opacity-60">Last saved: {lastSaved}</span>
          </div>
          <button onClick={() => setPreviewMode(!previewMode)} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${previewMode ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'}`}>
            <i className={`fas fa-${previewMode ? 'eye' : 'eye-slash'} text-[10px]`}></i>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {view === AppView.CANVAS ? (
          <>
            {!previewMode && (
              <aside className="w-[260px] border-r border-zinc-900 flex flex-col shrink-0 bg-[#050505] z-50">
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="p-4 border-b border-zinc-900 bg-black/20">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">Layer Tree</span>
                        <button onClick={() => setElements([])} className="text-zinc-700 hover:text-red-500 transition-colors p-1"><i className="fas fa-trash text-[8px]"></i></button>
                      </div>
                      <div className="relative">
                        <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[9px]"></i>
                        <input 
                          type="text"
                          placeholder="Search layers..."
                          value={layerSearch}
                          onChange={(e) => setLayerSearch(e.target.value)}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md py-1.5 pl-7 pr-2 text-[9px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {filteredElements.length > 0 ? filteredElements.map(el => (
                        <div key={el.id} onClick={() => setSelectedId(el.id)} className={`px-2.5 py-1.5 rounded-md cursor-pointer border transition-all ${selectedId === el.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' : 'hover:bg-zinc-900/50 text-zinc-500 border-transparent'}`}>
                          <div className="flex items-center gap-2">
                            <i className={`fas fa-${el.imageData ? 'image' : 'cube'} text-[8px] opacity-50`}></i>
                            <span className="text-[9px] font-bold truncate uppercase">{el.name}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-6 opacity-20">
                          <i className="fas fa-ghost text-sm mb-1.5"></i>
                          <span className="text-[7px] font-black uppercase">No results</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-y border-zinc-900 bg-black/40">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">Aesthetic Seeds</span>
                    </div>
                    <div className="p-2 grid grid-cols-2 gap-1.5 overflow-y-auto custom-scrollbar bg-black/20">
                        {AESTHETIC_SEEDS.map(seed => (
                            <button 
                                key={seed.id} 
                                onClick={() => setActiveSeed(activeSeed === seed.id ? null : seed.id)}
                                className={`px-1.5 py-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all text-center flex flex-col items-center justify-center gap-1.5 ${activeSeed === seed.id ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                            >
                                <i className={`fas fa-${seed.id === 'glass' ? 'wand-magic-sparkles' : seed.id === 'neo' ? 'circle-nodes' : seed.id === 'bento' ? 'table-cells' : 'shield-halved'} text-[10px] ${activeSeed === seed.id ? 'text-blue-100' : 'text-zinc-700'}`}></i>
                                <span>{seed.name.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>
              </aside>
            )}

            <main className="flex-1 relative bg-[#0a0a0a] canvas-grid overflow-auto custom-scrollbar flex flex-col">
              {!previewMode && (
                <div className="sticky top-0 w-full h-10 flex items-center justify-center gap-3 border-b border-zinc-900 bg-black/40 backdrop-blur-md z-[60]">
                  <div className="flex bg-zinc-900/50 p-0.5 rounded-md border border-zinc-800">
                    <button 
                      onClick={() => setViewport('mobile')} 
                      title="Mobile View"
                      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${viewport === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <i className="fas fa-mobile-alt text-[10px]"></i>
                    </button>
                    <button 
                      onClick={() => setViewport('tablet')} 
                      title="Tablet View"
                      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${viewport === 'tablet' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <i className="fas fa-tablet-alt text-[10px]"></i>
                    </button>
                    <button 
                      onClick={() => setViewport('desktop')} 
                      title="Desktop View"
                      className={`w-7 h-7 rounded flex items-center justify-center transition-all ${viewport === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <i className="fas fa-desktop text-[10px]"></i>
                    </button>
                  </div>
                  <div className="h-3 w-[1px] bg-zinc-800"></div>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                    {viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : 'Adaptive'}
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-auto custom-scrollbar">
                <div 
                  className={`mx-auto p-20 flex flex-col items-center gap-20 transition-all duration-500 ease-in-out ${
                    viewport === 'mobile' ? 'w-[375px]' : 
                    viewport === 'tablet' ? 'w-[768px]' : 
                    'w-full max-w-4xl'
                  }`}
                >
                  {elements.filter(e => e.visible).map(el => (
                    <div key={el.id} className="group relative w-full">
                      <div className={`relative rounded-[2rem] bg-white text-black overflow-hidden shadow-2xl transition-all ${selectedId === el.id ? 'ring-[4px] ring-blue-500/30 ring-offset-[8px] ring-offset-[#0a0a0a]' : 'hover:ring-1 hover:ring-zinc-800'}`}>
                        <div dangerouslySetInnerHTML={{ __html: el.code }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!previewMode && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[100]">
                  <div className="floating-dock glass-panel rounded-[1.5rem] h-14 pl-6 pr-1.5 shadow-2xl flex items-center gap-4 border border-zinc-800">
                    <div className="flex items-center gap-2 shrink-0">
                        <i className={`fas fa-wand-sparkles text-xs ${activeSeed ? 'text-blue-500' : 'text-zinc-700'}`}></i>
                        {activeSeed && <span className="text-[6px] font-black uppercase bg-blue-600 px-1.5 py-0.5 rounded-full text-white">SEED: {activeSeed}</span>}
                    </div>
                    <input 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && generateUI()}
                      placeholder="Synthesize component..."
                      className="flex-1 bg-transparent border-none focus:outline-none text-xs text-white font-medium placeholder:text-zinc-700"
                    />
                    <button onClick={generateUI} disabled={loading} className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-black uppercase rounded-[1rem] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50">
                        {loading ? <i className="fas fa-circle-notch animate-spin"></i> : 'Synthesize'}
                    </button>
                  </div>
                </div>
              )}
            </main>

            {!previewMode && (
              <aside className="w-[320px] border-l border-zinc-900 flex flex-col shrink-0 bg-[#050505] z-50 overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b border-zinc-900 bg-black/20 text-center">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Instrumentation</span>
                </div>
                {selectedElement ? (
                  <div className="p-6 space-y-10">
                    <section className="space-y-4">
                       <header className="flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                           <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Visual DNA</label>
                       </header>
                       <div className="relative group rounded-2xl overflow-hidden aspect-square bg-zinc-900/50 border border-zinc-800 shadow-inner">
                          {selectedElement.imageData ? (
                            <>
                              <img src={selectedElement.imageData} className={`w-full h-full object-cover transition-opacity duration-300 ${variationLoading ? 'opacity-30' : 'opacity-100'}`} />
                              {variationLoading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <i className="fas fa-circle-notch animate-spin text-blue-500 text-xl"></i>
                                </div>
                              )}
                              <button onClick={() => fileInputRef.current?.click()} className="absolute top-3 right-3 w-7 h-7 bg-black/60 backdrop-blur rounded-md flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                <i className="fas fa-exchange-alt text-[9px]"></i>
                              </button>
                            </>
                          ) : (
                            <button onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-700 hover:text-blue-400 transition-colors">
                                <i className="fas fa-plus text-lg"></i>
                                <span className="text-[9px] font-black uppercase tracking-widest">Add Seed</span>
                            </button>
                          )}
                       </div>

                       {selectedElement.imageData && (
                         <div className="space-y-4 pt-4 border-t border-zinc-900/50">
                           <div className="flex items-center justify-between">
                             <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Synthesis Engine</span>
                             {variationLoading && <span className="text-[6px] font-bold text-blue-500 animate-pulse uppercase">Processing...</span>}
                           </div>
                           
                           <div className="grid grid-cols-3 gap-1.5">
                             {VARIATION_STYLES.map(style => (
                               <button
                                 key={style.id}
                                 disabled={variationLoading}
                                 onClick={() => handleGenerateVariation(style.prompt)}
                                 className="flex flex-col items-center justify-center gap-1.5 py-2 px-1 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-blue-500/50 hover:bg-zinc-900 transition-all disabled:opacity-50 group"
                               >
                                 <i className={`fas fa-${style.icon} text-[10px] text-zinc-600 group-hover:text-blue-400`}></i>
                                 <span className="text-[7px] font-bold text-zinc-500 group-hover:text-white uppercase">{style.label}</span>
                               </button>
                             ))}
                           </div>

                           <div className="relative group">
                             <input
                               type="text"
                               disabled={variationLoading}
                               value={customVariationPrompt}
                               onChange={(e) => setCustomVariationPrompt(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleGenerateVariation()}
                               placeholder="Artistic direction..."
                               className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-[9px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-blue-500/50 transition-all"
                             />
                             <button 
                               onClick={() => handleGenerateVariation()}
                               disabled={variationLoading || !customVariationPrompt.trim()}
                               className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-blue-500 disabled:text-zinc-700 transition-colors"
                             >
                               <i className="fas fa-paper-plane text-[9px]"></i>
                             </button>
                           </div>

                           {selectedElement.variations && selectedElement.variations.length > 0 && (
                             <div className="space-y-2">
                               <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Heritage</span>
                               <div className="grid grid-cols-4 gap-1.5">
                                 {selectedElement.variations.map((v, i) => (
                                   <button 
                                     key={i} 
                                     onClick={() => selectVariation(v)}
                                     className={`relative aspect-square rounded-md overflow-hidden border transition-all ${selectedElement.imageData === v ? 'border-blue-500 shadow-sm shadow-blue-500/30' : 'border-zinc-800 hover:border-zinc-600'}`}
                                   >
                                     <img src={v} className="w-full h-full object-cover" />
                                   </button>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                    </section>

                    <section className="space-y-4">
                      <header className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                               <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                               <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Logic Kernel</label>
                           </div>
                           <button onClick={copyCodeToClipboard} className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}>
                             {copied ? 'Copied' : 'Copy'}
                           </button>
                       </header>
                      <div className="code-editor-container group">
                          <pre className="code-highlight custom-scrollbar !p-4 !h-64" dangerouslySetInnerHTML={{ __html: highlightHTML(selectedElement.code) + '\n' }} />
                          <textarea 
                            value={selectedElement.code}
                            onChange={(e) => setElements(prev => prev.map(el => el.id === selectedId ? {...el, code: e.target.value} : el))}
                            className="code-input custom-scrollbar !p-4 !h-64"
                          />
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-10 p-12 text-center h-full">
                     <i className="fas fa-mouse-pointer text-2xl mb-6"></i>
                     <p className="text-[9px] font-black uppercase tracking-[0.3em]">Select a layer</p>
                  </div>
                )}
              </aside>
            )}
          </>
        ) : (
          <main className="flex-1 bg-[#050505] p-12 animate-panel overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-12">
              <header className="space-y-2">
                <h2 className="text-4xl font-extrabold tracking-tight text-white italic">Synthetic Assets</h2>
                <p className="text-zinc-500 text-xs">Materialize visual elements using Gemini core.</p>
              </header>

              <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-zinc-800/50 shadow-3xl space-y-8">
                <div className="flex gap-3">
                  <input 
                    value={assetPrompt}
                    onChange={(e) => setAssetPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generateAsset()}
                    placeholder="Describe a material or object..."
                    className="flex-1 bg-black/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
                  />
                  <button onClick={generateAsset} disabled={assetLoading} className="px-8 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl transition-all hover:brightness-110 disabled:opacity-50">
                    {assetLoading ? <i className="fas fa-spinner animate-spin"></i> : 'Generate'}
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {generatedAssets.map((asset, idx) => (
                    <div key={idx} className="group relative rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-[4/5] hover:scale-[1.02] transition-all">
                      <img src={asset} className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <button onClick={() => {
                            injectAssetToCanvas(asset);
                            setView(AppView.CANVAS);
                        }} className="px-5 py-2.5 bg-white text-black text-[9px] font-black uppercase rounded-lg hover:bg-blue-600 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0">Deploy</button>
                      </div>
                    </div>
                  ))}
                  {generatedAssets.length === 0 && !assetLoading && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-10 border-2 border-dashed border-zinc-800 rounded-3xl">
                      <i className="fas fa-images text-4xl mb-4"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Workspace is empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default App;

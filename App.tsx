
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UIElement, AssetElement, AIProvider, TranscriptionMessage } from './types';
import * as geminiService from './services/geminiService';
import QuotaAlert from './components/QuotaAlert';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const STORAGE_KEY_UI = 'MODAMODA_UI_VAULT';
const STORAGE_KEY_ASSETS = 'MODAMODA_ASSET_VAULT';

const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
};

const HighlightedCode: React.FC<{ code: string; scrollRef: React.RefObject<HTMLPreElement | null> }> = ({ code, scrollRef }) => {
  const highlighted = useMemo(() => {
    // Escape HTML entities
    let h = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1. Highlight Comments
    h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-zinc-700 italic">$1</span>');

    // 2. Extract and protect values to avoid nested replacement issues
    const values: string[] = [];
    h = h.replace(/"([^"]*)"/g, (match, p1) => {
      values.push(p1);
      return `__VAL_${values.length - 1}__`;
    });

    // 3. Highlight Tags and Brackets
    h = h.replace(/(&lt;\/?[a-z0-9]+)/gi, '<span class="text-blue-400/80">$1</span>');
    h = h.replace(/(&gt;)/g, '<span class="text-blue-400/80">$1</span>');

    // 4. Highlight Attributes
    h = h.replace(/\s([a-z-]+)=/gi, ' <span class="text-purple-400/80">$1</span>=');

    // 5. Restore values with deep Tailwind class highlighting
    h = h.replace(/__VAL_(\d+)__/g, (match, index) => {
      const val = values[parseInt(index)];
      // Check if this value belongs to a class attribute
      const isClass = h.slice(0, h.indexOf(match)).trim().endsWith('class=');
      
      if (isClass) {
        // Break down Tailwind classes for individual utility highlighting
        const utilities = val.split(/\s+/).map(util => {
          if (!util) return '';
          // Highlight Modifiers (hover:, dark:, etc)
          let u = util.replace(/^([a-z0-9-]+:)/i, '<span class="text-amber-500/90">$1</span>');
          // Highlight Common Prefixes
          u = u.replace(/\b(bg|text|border|p|m|w|h|top|left|right|bottom|z|gap|rounded|shadow|flex|grid|opacity|duration|ease|scale|rotate|translate)-/g, '<span class="text-cyan-400/80">$1</span>-');
          return u;
        });
        return `"<span class="text-white">${utilities.join(' ')}</span>"`;
      }
      // General strings (links, IDs, etc)
      return `"<span class="text-emerald-400/80">${val}</span>"`;
    });

    return h;
  }, [code]);

  return (
    <pre 
      ref={scrollRef}
      className="absolute inset-0 p-6 font-mono text-[10px] leading-[1.6] whitespace-pre-wrap break-all pointer-events-none overflow-hidden select-none" 
      dangerouslySetInnerHTML={{ __html: highlighted }} 
    />
  );
};

const CollapsibleSection: React.FC<{ 
  title: string; 
  icon: string; 
  children: React.ReactNode; 
  isOpen: boolean; 
  onToggle: () => void;
  badge?: string | number;
}> = ({ title, icon, children, isOpen, onToggle, badge }) => (
  <div className={`border-b border-zinc-900/50 transition-all ${isOpen ? 'bg-zinc-900/10' : ''}`}>
    <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-900/40 transition-colors group">
      <div className="flex items-center gap-3">
        <i className={`fas ${icon} text-[10px] ${isOpen ? 'text-white' : 'text-zinc-700'} transition-colors`}></i>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isOpen ? 'text-zinc-100' : 'text-zinc-500'}`}>{title}</span>
        {badge && <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
      </div>
      <i className={`fas fa-chevron-down text-[8px] text-zinc-800 group-hover:text-zinc-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
    </button>
    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="px-6 pb-6 space-y-4">{children}</div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [elements, setElements] = useState<UIElement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_UI);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [assets, setAssets] = useState<AssetElement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ASSETS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [hasKey, setHasKey] = useState(true);
  const [streamingCode, setStreamingCode] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [libraryMode, setLibraryMode] = useState<'ui' | 'assets'>('ui');
  const [showLibrary, setShowLibrary] = useState(true); 

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ logic: true, analysis: false, live: true });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [isLiveActive, setIsLiveActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [logs, setLogs] = useState<string[]>(["Studio connected. Director mode engaged."]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const dragRef = useRef<{ id: string; offset: { x: number; y: number } } | null>(null);

  const codeScrollRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedElement = useMemo(() => elements.find(el => el.id === selectedId), [elements, selectedId]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(elements)); }, [elements]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets)); }, [assets]);

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const has = await aistudio.hasSelectedApiKey();
        setHasKey(has);
      }
    };
    checkKey();
  }, []);

  const addLog = (msg: string) => { 
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50)); 
  };

  const openKeyDialog = async () => { 
    addLog("Auth requested...");
    const aistudio = (window as any).aistudio;
    if (aistudio) { 
      try {
        await aistudio.openSelectKey(); 
        setHasKey(true); 
        addLog("Vault authorized.");
      } catch (e) {
        addLog("Auth failed.");
      }
    }
  };

  const clearVault = () => {
    if (window.confirm("Nuclear Wipe: Purge all digital editorials?")) {
      setElements([]);
      setAssets([]);
      setSelectedId(null);
      addLog("Vault cleared.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addLog(`Analyzing ref: ${file.name}`);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPendingImage(reader.result as string);
        addLog("Vision ref buffered.");
      };
      reader.readAsDataURL(file);
    }
  };

  const generateModel = async () => {
    if (!prompt.trim()) { addLog("Visual brief required."); return; }
    setImgLoading(true);
    addLog(`Synthesizing editorial visual...`);
    try {
      const url = await geminiService.generateImage(prompt);
      const newAsset: AssetElement = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        prompt,
        timestamp: new Date(),
        type: 'model'
      };
      setAssets(prev => [newAsset, ...prev]);
      setLibraryMode('assets');
      setShowLibrary(true);
      addLog("Visual asset generated.");
    } catch (err: any) {
      setError(err.message);
      addLog(`Visual Fault: ${err.message}`);
    } finally {
      setImgLoading(false);
    }
  };

  const generateUI = async (isRefine = false) => {
    if (!prompt.trim() && !pendingImage) { addLog("Brief required for synthesis."); return; }
    setLoading(true);
    setError(null);
    setStreamingCode('');
    addLog(`Synthesizing editorial via ${provider.toUpperCase()}...`);
    try {
      const currentPrompt = isRefine ? `Refine the current aesthetic: ${prompt}` : prompt;
      const res = await geminiService.generateWebComponentStream(
        currentPrompt, 'cloud-api', 
        (chunk) => setStreamingCode(chunk), 
        pendingImage || undefined, false, 'gemini-3-flash-preview', provider
      );
      if (isRefine && selectedId) {
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, code: res.code } : el));
        addLog("Editorial refined.");
      } else {
        const newEl: UIElement = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Editorial Unit ${elements.length + 1}`,
          type: 'custom',
          code: res.code,
          prompt: currentPrompt,
          timestamp: new Date(),
          selected: false,
          visible: true,
          position: { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 },
          imageData: pendingImage || undefined
        };
        setElements(prev => [...prev, newEl]);
        setSelectedId(newEl.id);
        addLog("Editorial deployed.");
      }
      setPrompt('');
      setPendingImage(null);
    } catch (err: any) {
      setError(err.message);
      addLog(`Synthesis Fault: ${err.message}`);
    } finally {
      setLoading(false);
      setStreamingCode('');
    }
  };

  const toggleLiveStylist = async () => {
    if (isLiveActive) { stopLive(); return; }
    addLog("Uplink secured...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let inBuffer = ''; let outBuffer = '';
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            addLog("Consultant active.");
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) inBuffer += msg.serverContent.inputTranscription.text;
            if (msg.serverContent?.outputTranscription) outBuffer += msg.serverContent.outputTranscription.text;
            if (msg.serverContent?.turnComplete) {
              if (inBuffer) setTranscriptions(prev => [...prev, { role: 'user', text: inBuffer, timestamp: new Date() }]);
              if (outBuffer) setTranscriptions(prev => [...prev, { role: 'model', text: outBuffer, timestamp: new Date() }]);
              inBuffer = ''; outBuffer = '';
            }
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsAiSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioData), outputCtx);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.onended = () => { 
                audioSourcesRef.current.delete(source); 
                if (audioSourcesRef.current.size === 0) setIsAiSpeaking(false); 
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }
          },
          onerror: (e) => { addLog(`Link Error: ${e}`); stopLive(); },
          onclose: () => { setIsLiveActive(false); addLog("Consultant offline."); }
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {} }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (e: any) { 
      setError(e.message || "Uplink Failed."); 
    }
  };

  const stopLive = () => {
    if (liveSessionRef.current) liveSessionRef.current.close();
    if (audioContextsRef.current) { audioContextsRef.current.input.close(); audioContextsRef.current.output.close(); }
    setIsLiveActive(false); setIsAiSpeaking(false);
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    if (previewMode) return;
    const el = elements.find(item => item.id === id);
    if (!el) return;
    setSelectedId(id);
    dragRef.current = { id, offset: { x: e.clientX - (el.position?.x || 0), y: e.clientY - (el.position?.y || 0) } };
    e.stopPropagation();
  };

  const handleEditorScroll = () => {
    if (textareaRef.current && codeScrollRef.current) {
      codeScrollRef.current.scrollTop = textareaRef.current.scrollTop;
      codeScrollRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { id, offset } = dragRef.current;
      setElements(prev => prev.map(el => el.id === id ? { ...el, position: { x: e.clientX - offset.x, y: e.clientY - offset.y } } : el));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#010101] text-zinc-100 overflow-hidden select-none font-sans">
      <header className="h-[64px] border-b border-zinc-900 bg-black/80 backdrop-blur-xl flex items-center justify-between px-6 z-[100] shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-crown text-amber-500 text-sm"></i></div>
            <div><span className="text-[11px] font-black tracking-widest uppercase block text-white">Editorial Lab</span><span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Aesthetic Protocol</span></div>
          </div>
          <div className="h-6 w-[1px] bg-zinc-900"></div>
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-900 text-[9px] font-bold">
            <button onClick={() => setProvider('gemini')} className={`px-4 py-1.5 rounded-md transition-all ${provider === 'gemini' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>GEMINI</button>
            <button onClick={() => setProvider('openai')} className={`px-4 py-1.5 rounded-md transition-all ${provider === 'openai' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>OPENAI</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowLibrary(!showLibrary)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${showLibrary ? 'bg-white text-black' : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-white'}`}>
            <i className="fas fa-book-open text-xs"></i>
          </button>
          <button onClick={toggleLiveStylist} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-3 ${isLiveActive ? 'bg-red-900/20 border-red-500 text-red-500 shadow-lg' : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:bg-zinc-900'}`}>
            <i className={`fas ${isLiveActive ? 'fa-microphone-slash' : 'fa-headset'} ${isAiSpeaking ? 'animate-bounce' : ''}`}></i>
            {isLiveActive ? 'Stop Consultant' : 'Style Consultant'}
          </button>
          <button onClick={openKeyDialog} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-3 ${hasKey ? 'bg-zinc-950 border-zinc-900 text-zinc-500' : 'bg-amber-900/20 border-amber-500/50 text-amber-500 animate-pulse'}`}>
            <i className="fas fa-key text-[10px]"></i>
            {hasKey ? 'Vault Secured' : 'Need Key'}
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${previewMode ? 'bg-white text-black' : 'bg-white text-black hover:bg-zinc-200'}`}>
            {previewMode ? 'Exit Portfolio' : 'Full Portfolio'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!previewMode && (
          <aside className={`w-[320px] border-r border-zinc-900 bg-zinc-950 flex flex-col transition-all duration-300 transform ${showLibrary ? 'translate-x-0' : '-translate-x-full fixed bottom-0 left-0 top-[64px] z-[100]'}`}>
            <div className="p-4 border-b border-zinc-900 flex gap-2">
              <button onClick={() => setLibraryMode('ui')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg border transition-all ${libraryMode === 'ui' ? 'bg-zinc-900 border-white/20 text-white shadow-md' : 'border-transparent text-zinc-600 hover:text-white'}`}>Editorials</button>
              <button onClick={() => setLibraryMode('assets')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg border transition-all ${libraryMode === 'assets' ? 'bg-zinc-900 border-white/20 text-white shadow-md' : 'border-transparent text-zinc-600 hover:text-white'}`}>Moodboard</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {libraryMode === 'ui' ? (
                elements.map(el => (
                  <div key={el.id} onClick={() => { setSelectedId(el.id); setShowLibrary(false); addLog(`Reviewing ${el.name}`); }} className={`group p-4 rounded-xl cursor-pointer border transition-all ${selectedId === el.id ? 'bg-zinc-900 border-white/20 text-white' : 'bg-zinc-900/40 border-zinc-900/50 text-zinc-500 hover:border-zinc-700'}`}>
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] font-black truncate pr-4">{el.name}</div>
                      <button onClick={(e) => { e.stopPropagation(); setElements(prev => prev.filter(i => i.id !== el.id)); if(selectedId === el.id) setSelectedId(null); }} className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-500 transition-all"><i className="fas fa-times text-[10px]"></i></button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {assets.map(asset => (
                    <div key={asset.id} onClick={() => { setPendingImage(asset.url); addLog("Ref mounted."); }} className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-zinc-900 hover:border-white/50 transition-all cursor-pointer bg-zinc-950">
                      <img src={asset.url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all scale-110 group-hover:scale-100 duration-1000" />
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-3 text-center transition-all">
                        <span className="text-[8px] font-black text-white uppercase tracking-widest mb-2">Mount Reference</span>
                        <button onClick={(e) => { e.stopPropagation(); setAssets(prev => prev.filter(a => a.id !== asset.id)); }} className="text-red-500 hover:text-red-400 text-[10px]"><i className="fas fa-trash-alt"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="h-[200px] border-t border-zinc-900 p-4 font-mono flex flex-col bg-black">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">Director Logs</span>
                <button onClick={clearVault} className="text-[8px] text-zinc-800 hover:text-red-500 uppercase font-black px-2 py-0.5">Purge</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
                {logs.map((log, i) => <div key={i} className="text-[8px] text-zinc-800 leading-tight border-l border-zinc-900 pl-3 py-0.5">{log}</div>)}
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 relative canvas-grid overflow-hidden bg-black">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-xl z-[200] px-6"><QuotaAlert error={error || undefined} onRetry={() => generateUI()} /></div>
          
          <div className="w-full h-full relative overflow-auto custom-scrollbar">
            {elements.map(el => (
              <div 
                key={el.id} 
                onMouseDown={(e) => handleDragStart(e, el.id)} 
                style={{ 
                  position: 'absolute', left: 0, top: 0, 
                  transform: `translate3d(${el.position?.x || 0}px, ${el.position?.y || 0}px, 0)`, 
                  zIndex: selectedId === el.id ? 50 : 10 
                }} 
                className={`group bg-white rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-500 ${selectedId === el.id ? 'ring-1 ring-white ring-offset-8 ring-offset-black scale-100' : 'opacity-40 scale-95'}`}
              >
                <div className="pointer-events-none min-w-[380px] min-h-[240px]" dangerouslySetInnerHTML={{ __html: el.code }} />
              </div>
            ))}
            
            {loading && streamingCode && (
              <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[85vw] opacity-10 pointer-events-none transition-all">
                <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl" dangerouslySetInnerHTML={{ __html: streamingCode }} />
              </div>
            )}
          </div>

          {!previewMode && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8">
              <div className="bg-zinc-950/90 backdrop-blur-3xl border border-zinc-900/80 p-3 rounded-[2.5rem] flex items-center gap-4 shadow-[0_40px_100px_rgba(0,0,0,1)]">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                <button title="Mood Ref" onClick={() => fileInputRef.current?.click()} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${pendingImage ? 'bg-white text-black shadow-xl' : 'bg-zinc-900 text-zinc-700 hover:text-white border border-zinc-900'}`}>
                  {pendingImage ? <img src={pendingImage} className="w-10 h-10 rounded-xl object-cover" /> : <i className="fas fa-camera-retro text-lg"></i>}
                </button>
                <button title="Synthesize Visual" onClick={generateModel} disabled={imgLoading} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${imgLoading ? 'bg-amber-900 text-amber-400' : 'bg-zinc-900 text-zinc-700 hover:text-amber-500 border border-zinc-900'}`}>
                  {imgLoading ? <i className="fas fa-spinner animate-spin text-sm"></i> : <i className="fas fa-wand-magic-sparkles text-lg"></i>}
                </button>
                <input 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && generateUI()} 
                  placeholder="The Creative Brief: 'A Jacquemus-style minimalist product landing' or 'Saint Laurent Noir lookbook'..." 
                  className="flex-1 bg-transparent border-none outline-none text-base text-zinc-500 placeholder-zinc-800 font-medium px-4 tracking-tight" 
                />
                <button onClick={() => generateUI()} disabled={loading} className="bg-white text-black h-14 px-10 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 hover:bg-zinc-200 shadow-xl transition-all">
                  {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-diamond"></i>}
                  {loading ? 'SYNTHESIZING' : 'DEPLOY'}
                </button>
              </div>
            </div>
          )}
        </main>

        {!previewMode && (
          <aside className="w-[380px] border-l border-zinc-900 bg-zinc-950/90 backdrop-blur-3xl flex flex-col z-[100] custom-scrollbar overflow-y-auto">
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50 sticky top-0 z-10 backdrop-blur-xl shrink-0">
              <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Studio Inspector</span>
              {selectedElement && <span className="text-[8px] text-zinc-600 font-black px-2 py-0.5 rounded border border-zinc-800 bg-black">UNIT: {selectedElement.id.toUpperCase()}</span>}
            </div>
            
            <div className="flex-1">
              {!selectedElement ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center opacity-5 px-12">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-8"><i className="fas fa-feather-pointed text-2xl text-white"></i></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] leading-loose">Awaiting editorial selection</p>
                </div>
              ) : (
                <>
                  <CollapsibleSection title="Aesthetic Logic" icon="fa-code" isOpen={openSections.logic} onToggle={() => toggleSection('logic')}>
                    <div className="space-y-4">
                      <div className="relative h-[420px] border border-zinc-900 rounded-2xl overflow-hidden bg-[#020202] group ring-1 ring-zinc-900 focus-within:ring-white/10 transition-all">
                        <HighlightedCode code={selectedElement.code} scrollRef={codeScrollRef} />
                        <textarea 
                          ref={textareaRef}
                          value={selectedElement.code} 
                          onScroll={handleEditorScroll}
                          onChange={e => {
                            const newCode = e.target.value;
                            setElements(prev => prev.map(el => el.id === selectedId ? {...el, code: newCode} : el));
                          }} 
                          spellCheck={false} 
                          className="absolute inset-0 w-full h-full bg-transparent p-6 text-transparent caret-white font-mono text-[10px] leading-[1.6] resize-none outline-none z-10 custom-scrollbar" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => generateUI(true)} className="py-4 bg-zinc-100 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white active:scale-95 transition-all">Refine Look</button>
                         <button onClick={() => { setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); addLog("Unit purged."); }} className="py-4 bg-zinc-900 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition-all border border-zinc-800">Discard</button>
                      </div>
                    </div>
                  </CollapsibleSection>
                  
                  <CollapsibleSection title="Visual Telemetry" icon="fa-eye" isOpen={openSections.analysis} onToggle={() => toggleSection('analysis')}>
                    <div className="space-y-4">
                      {selectedElement.imageData ? (
                        <div className="space-y-4">
                          <img src={selectedElement.imageData} className="w-full rounded-2xl border border-zinc-900 grayscale object-cover" />
                        </div>
                      ) : (
                        <div className="py-12 text-center bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800 text-[10px] text-zinc-900 font-black uppercase tracking-[0.2em]">NO_BRIEF</div>
                      )}
                    </div>
                  </CollapsibleSection>
                </>
              )}
              
              {isLiveActive && (
                <CollapsibleSection title="Mood Consultant" icon="fa-microphone" isOpen={openSections.live} onToggle={() => toggleSection('live')}>
                  <div className="max-h-[350px] overflow-y-auto space-y-5 custom-scrollbar pr-2">
                    {transcriptions.map((t, i) => (
                      <div key={i} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <span className="text-[8px] font-black text-zinc-800 uppercase mb-2 px-2 tracking-widest">{t.role === 'user' ? 'Local' : 'Consultant'}</span>
                        <p className={`px-5 py-4 rounded-2xl max-w-[92%] text-[11px] font-medium leading-relaxed ${t.role === 'user' ? 'bg-zinc-900/80 text-zinc-500 border border-zinc-800' : 'bg-white/5 text-zinc-300 border border-white/5 shadow-lg'}`}>
                          {t.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default App;

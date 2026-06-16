
import React, { useState, useRef, useEffect } from 'react';
import { SynthPatch } from '../types';

interface ControlBarProps {
  onGenerate: (prompt: string, imageBase64?: string) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  isGenerating: boolean;
  currentPatch: SynthPatch | null;
  error: string | null;
  onClearError?: () => void;
  // Mixer Props
  bpm: number;
  updateBpm: (val: number) => void;
  volume: number;
  updateVolume: (val: number) => void;
  filterFreq: number;
  updateFilter: (val: number) => void;
  // Library Props
  onSave: () => void;
  onUpdatePatch: (patch: SynthPatch, playOnLoad: boolean) => void;
  // Loop Props
  loopLength: number;
  setLoopLength: (val: number) => void;
}

const PARAM_DOCS = [
    { 
        section: "Global Settings", 
        items: [
            { key: "bpm", desc: "Tempo (Beats Per Minute). 60 is slow/chill, 120 is standard, 140+ is energetic." },
            { key: "totalSteps", desc: "Total length of the loop in 16th notes. Standard is 32 (2 bars). Use 64 or 128 for longer, evolving chord progressions." }
        ]
    },
    { 
        section: "Tone (Oscillator)", 
        items: [
            { key: "type", desc: "The character of the sound. Options: 'sine' (smooth/pure), 'triangle' (soft/hollow), 'square' (retro/gameboy), 'sawtooth' (sharp/buzzy)." },
            { key: "fmAmount", desc: "0 to 100. Frequency Modulation depth. 0 is clean. High values (50+) add metallic grit, bell-like tones, or noise." },
            { key: "detune", desc: "-50 to 50. Fine pitch offset in cents. Small amounts (5-10) make the sound thicker and warmer (analog feel)." }
        ]
    },
    { 
        section: "Shape (Envelope)", 
        items: [
            { key: "attack", desc: "Fade-in time (seconds). 0.01 is instant (percussive/plucky). 1.0+ is a slow swell (pads/strings)." },
            { key: "decay", desc: "Time (seconds) to drop from max volume to the Sustain level." },
            { key: "sustain", desc: "0.0 to 1.0. The volume level held while the note is playing. 1.0 is full volume, 0.0 is silence." },
            { key: "release", desc: "Fade-out time (seconds) after the note ends. Long release = dreamy atmosphere." }
        ]
    },
    { 
        section: "Color (Filter)", 
        items: [
            { key: "frequency", desc: "Cutoff (Hz). Controls brightness. Low (500) is muffled/dark, High (10000) is clear/sharp." },
            { key: "q", desc: "Resonance (0-20). Adds emphasis at the cutoff point. High values make it 'whistle' or sound squelchy (like a 303 bass)." },
            { key: "type", desc: "'lowpass' (cuts highs), 'highpass' (cuts lows), 'bandpass' (isolates middle)." }
        ]
    },
    { 
        section: "Space (Effects)", 
        items: [
            { key: "delay", desc: "Echo effect. 'time' is seconds between repeats. 'feedback' (0-0.9) is how many repeats. 'mix' (0-1) is volume." },
            { key: "reverb", desc: "Room simulation. 'decay' is room size (seconds). 'mix' (0-1) is wetness." }
        ]
    },
    { 
        section: "Composition", 
        items: [
            { key: "melody / bassline", desc: "Arrays of notes to play." },
            { key: "freq", desc: "Pitch in Hz. A4=440, C4=261.6, Low Bass=55 or 110." },
            { key: "startStep", desc: "When the note starts (0 to totalSteps-1)." },
            { key: "durationSteps", desc: "How long the note holds in steps." }
        ]
    }
];

export const ControlBar: React.FC<ControlBarProps> = ({
  onGenerate, onTogglePlay, isPlaying, isGenerating, currentPatch, error, onClearError,
  bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter,
  onSave, onUpdatePatch, loopLength, setLoopLength
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
      if (isEditing && currentPatch) {
          setJsonCode(JSON.stringify(currentPatch, null, 2));
      }
  }, [isEditing, currentPatch]);

  const handleApplyEdit = () => {
      try {
          // Remove comments (// or /* */)
          const jsonWithoutComments = jsonCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          const parsed = JSON.parse(jsonWithoutComments);
          // Pass current isPlaying state to preserve playback status
          onUpdatePatch(parsed, isPlaying);
          setIsEditing(false);
          setJsonError(null);
      } catch (e: any) {
          setJsonError("Invalid JSON: " + e.message);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() || selectedImage) {
      onGenerate(prompt, selectedImage || undefined);
      // Clear inputs after submit
      setPrompt('');
      setSelectedImage(null);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const clearImage = () => {
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Option 5: Tactile Analog Toggle Indicator Style
  const buttonClass = !currentPatch
    ? "border-zinc-800/80 bg-zinc-900/30 text-zinc-700 cursor-not-allowed"
    : isPlaying
      ? "border-emerald-500/70 bg-zinc-900 text-emerald-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_0_12px_rgba(16,185,129,0.15)] translate-y-[1.5px]"
      : "border-zinc-700/80 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-850 text-zinc-100 hover:text-white shadow-[0_4px_0_0_#18181b,0_6px_10px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.07)] active:translate-y-[2px] active:shadow-[0_2px_0_0_#18181b,0_3px_5px_rgba(0,0,0,0.6)]";

  const placeholderText = selectedImage 
      ? "Describe what the AI should hear in this image..." 
      : currentPatch 
        ? "Describe sound or refine current patch (e.g. 'Add more reverb', 'Make it darker')..." 
        : "Describe sound (e.g., 'Throbbing industrial techno', 'Ethereal ambient pad')";

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex flex-col gap-6 relative">
      {/* Modal Editor */}
      {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                      <div className="flex items-center gap-4">
                        <h3 className="text-white font-bold text-sm tracking-wide">Patch Source Editor</h3>
                      </div>
                      <button 
                          onClick={() => setIsEditing(false)}
                          className="text-zinc-400 hover:text-white transition-colors"
                      >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden">
                      {/* Editor Column */}
                      <div className="flex-1 relative border-r border-zinc-800">
                           <textarea
                              value={jsonCode}
                              onChange={e => setJsonCode(e.target.value)}
                              className={`w-full h-full bg-[#09090b] text-white font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed border-2 ${jsonError ? 'border-red-500/50' : 'border-transparent'}`}
                              spellCheck={false}
                              placeholder="// Edit your patch JSON here..."
                          />
                      </div>
                      
                      {/* Documentation Column */}
                      <div className="w-80 bg-zinc-950 p-6 overflow-y-auto hidden md:block border-l border-zinc-900">
                          <h4 className="text-zinc-300 text-xs font-bold uppercase tracking-widest mb-6 border-b border-zinc-800 pb-2">Reference Guide</h4>
                          
                          <div className="space-y-8">
                              {PARAM_DOCS.map((section, i) => (
                                  <div key={i}>
                                      <h5 className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider mb-3">{section.section}</h5>
                                      <div className="space-y-4">
                                          {section.items.map((item, j) => (
                                              <div key={j}>
                                                  <code className="text-blue-400 text-xs font-mono block mb-1 bg-blue-400/10 px-1 py-0.5 rounded w-fit">{item.key}</code>
                                                  <p className="text-zinc-400 text-[11px] leading-relaxed">{item.desc}</p>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                          
                          <div className="mt-8 pt-4 border-t border-zinc-800">
                             <p className="text-zinc-600 text-[10px] italic">
                                 Tip: You can add comments using // or /* */ in the editor. They will be removed automatically when you save.
                             </p>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                      <span className="text-red-400 text-xs font-mono truncate max-w-[60%]">{jsonError}</span>
                      <div className="flex gap-3">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleApplyEdit}
                            className="px-6 py-2 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 transition-colors uppercase tracking-wider"
                        >
                            Apply Changes
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Top Row: Info & Playback */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Play Button & Info Wrapper */}
        <div className="flex items-start gap-4 w-full flex-1">
            <button 
                onClick={onTogglePlay}
                disabled={!currentPatch}
                className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-between py-2 transition-all duration-150 shrink-0 border ${buttonClass} mt-0.5 group`}
                title={isPlaying ? "Pause Composition" : "Play Composition"}
            >
                {/* Physical Micro-LED Status Indicator */}
                <div className="flex items-center justify-center w-full">
                    <span 
                        className={`w-2 h-1 rounded-full transition-all duration-300 ${
                            !currentPatch
                                ? "bg-zinc-800"
                                : isPlaying
                                    ? "bg-emerald-400 shadow-[0_0_8px_#10b981,0_0_3px_#34d399] animate-pulse"
                                    : "bg-red-950 border border-red-500/30"
                        }`} 
                        title={isPlaying ? "Live LED Active" : "Standby"}
                    />
                </div>
                
                <div className="relative z-10 transition-transform duration-100 flex items-center justify-center mb-0.5">
                    {isPlaying ? (
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <rect x="5" y="5" width="14" height="14" rx="1.5" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 translate-x-[1px] fill-current" viewBox="0 0 24 24">
                            <path d="M8 5.5v13a1 1 0 0 0 1.55.83l9.4-6.5a1 1 0 0 0 0-1.66l-9.4-6.5A1 1 0 0 0 8 5.5z" />
                        </svg>
                    )}
                </div>
            </button>
            
            <div className="flex-1 min-w-0">
                {currentPatch ? (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-bold text-sm tracking-wide whitespace-normal leading-tight">{currentPatch.name}</h3>
                            <div className="flex gap-1 ml-2">
                                <button 
                                   onClick={onSave}
                                   className="p-1.5 text-zinc-500 hover:text-white bg-zinc-800 rounded hover:bg-zinc-700 transition-colors shrink-0"
                                   title="Save Patch to Library"
                                >
                                     {/* Floppy Disk Icon */}
                                     <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                                </button>
                                <button 
                                   onClick={() => setIsEditing(true)}
                                   className="p-1.5 text-zinc-500 hover:text-blue-400 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors shrink-0"
                                   title="View/Edit Patch Source"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                </button>
                            </div>
                        </div>
                        <p className="text-zinc-500 text-xs whitespace-normal break-words leading-relaxed w-full md:w-3/4">
                            <span className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider mr-1.5">{currentPatch.oscillator.type}</span>
                            {currentPatch.description}
                        </p>
                    </div>
                ) : (
                    <div className="text-zinc-500 text-sm italic py-3">Generative Audio Engine Ready</div>
                )}
            </div>
        </div>
        
        {/* Status Messages */}
        <div className="flex flex-col items-end gap-1 shrink-0">
            {isGenerating && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
                    Thinking & Composing...
                </div>
            )}
        </div>
      </div>

      {/* Embedded Full-Width Human-Readable Error Container */}
      {error && (
        <div className="w-full bg-red-950/20 border border-red-900/50 rounded-lg p-3.5 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5 min-w-0">
            <svg 
              className="w-4 h-4 text-red-500 shrink-0 mt-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-red-200 leading-relaxed font-sans break-words whitespace-normal">
              <span className="font-bold text-red-400 uppercase tracking-wider text-[10px] mr-1.5 bg-red-900/30 px-1.5 py-0.5 rounded">Error</span>
              {error}
            </div>
          </div>
          {onClearError && (
            <button 
              type="button"
              onClick={onClearError}
              className="text-red-400/70 hover:text-red-200 transition-colors p-1 hover:bg-red-950/30 rounded shrink-0 self-start"
              title="Dismiss error"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSubmit} className="flex gap-2 w-full items-center">
        {/* Hidden File Input */}
        <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden"
        />
        
        {/* Camera/Image Button */}
        <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-12 h-12 flex items-center justify-center rounded border transition-colors shrink-0 ${selectedImage ? 'bg-blue-900 border-blue-700 text-white' : 'bg-black/50 border-zinc-700 text-zinc-400 hover:text-white'}`}
            title="Upload Image for Sound Generation"
        >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
        
        {/* Input Wrapper with Preview */}
        <div className="flex-1 relative">
            <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholderText}
                className={`w-full h-12 bg-black/50 border border-zinc-700 rounded px-4 text-sm text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all min-w-0 ${selectedImage ? 'pl-16' : ''}`}
            />
            {selectedImage && (
                <div className="absolute top-2 left-2 w-10 h-8 rounded overflow-hidden border border-zinc-600 group">
                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                        type="button" 
                        onClick={clearImage}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                         <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
        
        <select
            value={loopLength}
            onChange={(e) => setLoopLength(Number(e.target.value))}
            className="w-auto h-12 bg-black/50 border border-zinc-700 rounded px-3 text-xs text-white focus:outline-none focus:border-white transition-all cursor-pointer shrink-0 hidden sm:block"
            title="Loop Length"
        >
            <option value="32">Short (32)</option>
            <option value="64">Medium (64)</option>
            <option value="128">Long (128)</option>
            <option value="256">Extended (256)</option>
        </select>

        <button 
            type="submit" 
            disabled={isGenerating || (!prompt.trim() && !selectedImage)}
            className="w-auto h-12 px-6 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider whitespace-nowrap shrink-0"
        >
            Generate
        </button>
      </form>

      {/* Performance Mixer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-zinc-800">
          
          {/* Volume */}
          <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  <span>Master Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={volume}
                onChange={(e) => updateVolume(Number(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
          </div>

          {/* BPM */}
          <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  <span>Tempo (BPM)</span>
                  <span>{Math.round(bpm)}</span>
              </div>
              <input 
                type="range" 
                min="60" max="240" step="1"
                value={bpm}
                onChange={(e) => updateBpm(Number(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
          </div>

          {/* Filter */}
          <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                  <span>Filter Sweep</span>
                  <span>{filterFreq < 1000 ? Math.round(filterFreq) + ' Hz' : (filterFreq/1000).toFixed(1) + ' kHz'}</span>
              </div>
              <input 
                type="range" 
                min="100" max="20000" step="100" 
                value={filterFreq}
                onChange={(e) => updateFilter(Number(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
          </div>

      </div>
    </div>
  );
};


import React, { useState, useRef } from 'react';
import { SynthPatch } from '../types';

interface ControlBarProps {
  onGenerate: (prompt: string, imageBase64?: string) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  isGenerating: boolean;
  currentPatch: SynthPatch | null;
  error: string | null;
  // Mixer Props
  bpm: number;
  updateBpm: (val: number) => void;
  volume: number;
  updateVolume: (val: number) => void;
  filterFreq: number;
  updateFilter: (val: number) => void;
  // Library Props
  onSave: () => void;
  // Loop Props
  loopLength: number;
  setLoopLength: (val: number) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  onGenerate, onTogglePlay, isPlaying, isGenerating, currentPatch, error,
  bpm, updateBpm, volume, updateVolume, filterFreq, updateFilter,
  onSave, loopLength, setLoopLength
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Pulse effect logic
  const buttonStyle = !currentPatch
    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
    : isPlaying
      ? 'bg-white text-black hover:scale-105'
      : 'bg-green-500 text-white hover:bg-green-400 ring-2 ring-green-500/50 animate-pulse';

  const placeholderText = selectedImage 
      ? "Describe what the AI should hear in this image..." 
      : currentPatch 
        ? "Describe sound or refine current patch (e.g. 'Add more reverb', 'Make it darker')..." 
        : "Describe sound (e.g., 'Throbbing industrial techno', 'Ethereal ambient pad')";

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex flex-col gap-6">
      {/* Top Row: Info & Playback */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Play Button & Info Wrapper */}
        <div className="flex items-start gap-4 w-full flex-1">
            <button 
                onClick={onTogglePlay}
                disabled={!currentPatch}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg shrink-0 ${buttonStyle} mt-0.5`}
            >
                {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                    <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
            </button>
            
            <div className="flex-1 min-w-0">
                {currentPatch ? (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-white font-bold text-sm tracking-wide whitespace-normal leading-tight">{currentPatch.name}</h3>
                            <button 
                               onClick={onSave}
                               className="p-1 text-zinc-500 hover:text-white bg-zinc-800 rounded hover:bg-zinc-700 transition-colors shrink-0"
                               title="Save Patch to Library"
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>
                            </button>
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
            {error && (
                 <div className="text-red-400 text-xs">{error}</div>
            )}
        </div>
      </div>

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
            className={`p-3 rounded border transition-colors ${selectedImage ? 'bg-blue-900 border-blue-700 text-white' : 'bg-black/50 border-zinc-700 text-zinc-400 hover:text-white'}`}
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
                className={`w-full bg-black/50 border border-zinc-700 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all min-w-0 ${selectedImage ? 'pl-16' : ''}`}
            />
            {selectedImage && (
                <div className="absolute top-1.5 left-2 w-10 h-8 rounded overflow-hidden border border-zinc-600 group">
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
            className="w-auto bg-black/50 border border-zinc-700 rounded px-2 py-3 text-xs text-white focus:outline-none focus:border-white transition-all cursor-pointer hidden sm:block"
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
            className="w-auto px-4 py-3 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider whitespace-nowrap"
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

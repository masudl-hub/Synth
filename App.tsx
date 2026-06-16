import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { Tile } from './components/Tile';
import { simulations } from './simulations/logic';
import { useGenerativeAudio } from './hooks/useGenerativeAudio';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import { ControlBar } from './components/ControlBar';

export default function App() {
  const [audioSource, setAudioSource] = useState<'synth' | 'mic'>('synth');
  // Allow multiple expanded tiles, default to Swarm (ID 7) expanded
  const [expandedIds, setExpandedIds] = useState<number[]>([7]);

  // AI Synth Hook
  const { 
      audioDataRef: synthAudioDataRef, 
      generatePatch, 
      togglePlay, 
      toggleMute,
      isPlaying, 
      isMuted,
      isGenerating, 
      currentPatch, 
      error,
      setError,
      // Mixer Controls
      bpm, updateBpm,
      volume, updateVolume,
      filterFreq, updateFilter,
      // Library
      savedPatches, saveCurrentPatch, deleteSavedPatch, loadPatch, PRESETS,
      // Loop Length
      loopLength, setLoopLength
  } = useGenerativeAudio();

  // Microphone Hook
  const { 
      audioDataRef: micAudioDataRef, 
      startAudio: startMic, 
      isAudioEnabled: isMicLive 
  } = useAudioAnalyzer();

  const activeAudioRef = audioSource === 'synth' ? synthAudioDataRef : micAudioDataRef;
  useDynamicFavicon(activeAudioRef);
  
  // Physics Time Logic: 
  // If Synth: Only advance time when playing.
  // If Mic: Always advance time (world is always moving).
  const shouldTimeAdvance = audioSource === 'mic' || isPlaying;

  const handleTileClick = (id: number) => {
      const updateState = () => {
        setExpandedIds(prev => 
            prev.includes(id) 
                ? prev.filter(pid => pid !== id) 
                : [...prev, id]
        );
      };

      // Use View Transitions API if available for smooth layout morphing
      if ((document as any).startViewTransition) {
          (document as any).startViewTransition(() => {
              flushSync(() => {
                  updateState();
              });
          });
      } else {
          updateState();
      }
  };

  return (
    <main className="min-h-screen w-full bg-[#09090b] text-white p-4 md:p-8 lg:p-12 flex flex-col items-center justify-center">
      
      {/* Header */}
      <header className="w-full max-w-[1600px] mb-8 flex flex-col md:flex-row gap-4 justify-between items-end border-b border-zinc-800 pb-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Audio Physics</h1>
          <p className="text-zinc-500 text-sm mt-1">AI-Native Generative Cymatics</p>
        </div>
        
        <div className="flex gap-4 items-center">
           {/* Source Toggle */}
           <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => setAudioSource('synth')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        audioSource === 'synth' 
                        ? 'bg-zinc-700 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    AI Synth
                </button>
                <button 
                    onClick={() => setAudioSource('mic')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        audioSource === 'mic' 
                        ? 'bg-zinc-700 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    Microphone
                </button>
           </div>

           {/* Synth Mute Toggle (Only show in synth mode) */}
           {audioSource === 'synth' && (
               <button 
                 onClick={toggleMute}
                 className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded-lg"
                 title={isMuted ? "Unmute" : "Mute"}
               >
                 {isMuted ? (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeMiterlimit="10"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                 ) : (
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                 )}
               </button>
           )}
           
           <div className="hidden">


           </div>
        </div>
      </header>

      {/* Controls Area */}
      <div className="w-full max-w-[1600px] mb-4">
          {audioSource === 'synth' ? (
              <ControlBar 
                  onGenerate={generatePatch}
                  onTogglePlay={togglePlay}
                  isPlaying={isPlaying}
                  isGenerating={isGenerating}
                  currentPatch={currentPatch}
                  error={error}
                  onClearError={() => setError(null)}
                  bpm={bpm} updateBpm={updateBpm}
                  volume={volume} updateVolume={updateVolume}
                  filterFreq={filterFreq} updateFilter={updateFilter}
                  onSave={saveCurrentPatch}
                  onUpdatePatch={loadPatch}
                  loopLength={loopLength}
                  setLoopLength={setLoopLength}
              />
          ) : (
              <div className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${isMicLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
                      <div>
                          <h3 className="text-white font-bold text-sm">Microphone Input</h3>
                          <p className="text-zinc-500 text-xs">
                              {isMicLive 
                                ? "Listening to ambient sound. Visuals are reacting to your environment." 
                                : "Enable microphone access to visualize external audio."}
                          </p>
                      </div>
                  </div>
                  {!isMicLive && (
                     <button 
                        onClick={startMic}
                        className="px-6 py-2 bg-white text-black text-xs font-bold rounded hover:bg-zinc-200 transition-colors uppercase tracking-wider"
                     >
                        Enable Microphone
                     </button>
                  )}
              </div>
          )}
      </div>

      {/* Grid */}
      <div className="w-full max-w-[1600px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-1 bg-zinc-800 border border-zinc-800 auto-rows-fr grid-flow-dense">
        {simulations.map((sim) => {
          const isExpanded = expandedIds.includes(sim.id);
          return (
            <div 
                key={sim.id}
                onClick={() => handleTileClick(sim.id)}
                // We use inline styles for the viewTransitionName to uniquely identify each tile
                style={{ viewTransitionName: `tile-${sim.id}` } as React.CSSProperties}
                className={`cursor-pointer hover:z-10 relative transition-all duration-1000 ease-in-out
                    ${isExpanded 
                        ? 'md:col-span-2 md:row-span-2 z-20 shadow-2xl ring-1 ring-zinc-700' 
                        : 'col-span-1 row-span-1'
                    }
                `}
            >
                <Tile 
                    sim={sim} 
                    audioDataRef={activeAudioRef} 
                    shouldTimeAdvance={shouldTimeAdvance}
                    resetTrigger={currentPatch} 
                />
            </div>
          );
        })}
      </div>
      
      {/* Library Section */}
      {audioSource === 'synth' && (
        <div className="w-full max-w-[1600px] mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Starter Presets */}
            <div>
                <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-4">Starter Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(PRESETS).map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => loadPatch(preset, true)}
                            className="bg-zinc-900 border border-zinc-800 p-3 rounded text-left hover:bg-zinc-800 transition-colors group"
                        >
                            <div className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{preset.name}</div>
                            <div className="text-[10px] text-zinc-500 truncate mt-1">{preset.description}</div>
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Saved Patches */}
            <div>
                <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-4">Saved Patches</h3>
                {savedPatches.length === 0 ? (
                    <div className="text-zinc-600 text-sm italic border border-dashed border-zinc-800 rounded p-4 text-center">
                        No saved patches yet. Create something and hit save!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {savedPatches.map((patch, index) => (
                            <div key={index} className="bg-zinc-900 border border-zinc-800 p-3 rounded flex justify-between items-center group hover:bg-zinc-800 transition-colors">
                                <button 
                                    onClick={() => loadPatch(patch, true)}
                                    className="text-left flex-1 min-w-0"
                                >
                                    <div className="font-bold text-sm text-white group-hover:text-green-400 transition-colors truncate">{patch.name}</div>
                                    <div className="text-[10px] text-zinc-500 truncate mt-1">{patch.description}</div>
                                </button>
                                <button 
                                    onClick={() => deleteSavedPatch(index)}
                                    className="ml-2 text-zinc-600 hover:text-red-400 p-1"
                                    title="Delete Patch"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      <footer className="w-full max-w-[1600px] mt-16 pb-8 text-center text-zinc-700 text-xs border-t border-zinc-800 pt-8">
        Formes inspirées des 36 formes vectorielles technologiques de Vanzyst
      </footer>
    </main>
  );
}
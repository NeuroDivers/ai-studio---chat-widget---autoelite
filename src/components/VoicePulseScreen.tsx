import React from 'react';
import { Mic, Activity } from 'lucide-react';

interface VoicePulseScreenProps {
  transcript: string;
  isConnecting?: boolean;
  volumeLevel?: number; // 0.0 to 1.0
  chunksSent?: number;
  language?: 'fr' | 'en';
}

export const VoicePulseScreen: React.FC<VoicePulseScreenProps> = ({
  transcript,
  isConnecting = false,
  volumeLevel = 0,
  chunksSent = 0,
  language = 'fr',
}) => {
  const isEn = language === 'en';
  // Normalize volume for dynamic pulse visualizer
  const clampedVolume = Math.min(1, Math.max(0, volumeLevel * 3.5));
  const hasVoice = volumeLevel > 0.015;

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col items-center justify-between p-6 sm:p-8 text-center select-none animate-in fade-in duration-150">
      {/* Dealer Name & Status */}
      <div className="pt-2">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          Automobile Lambert
        </h2>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-[#991b1e] border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            {isEn ? 'Listening...' : 'À l\'écoute...'}
          </span>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            {isEn ? 'Voice Advisor' : 'Conseiller Vocal'}
          </p>
        </div>
      </div>

      {/* Dynamic Red Pulsing Ring responding to real voice volume */}
      <div className="relative flex items-center justify-center my-auto">
        {/* Pulsing ring 1 */}
        <div
          className="absolute rounded-full bg-[#991b1e]/15 transition-all duration-75 ease-out"
          style={{
            width: `${160 + clampedVolume * 90}px`,
            height: `${160 + clampedVolume * 90}px`,
            opacity: 0.2 + clampedVolume * 0.6,
          }}
        />

        {/* Pulsing ring 2 */}
        <div
          className="absolute rounded-full bg-[#991b1e]/25 transition-all duration-75 ease-out"
          style={{
            width: `${120 + clampedVolume * 60}px`,
            height: `${120 + clampedVolume * 60}px`,
            opacity: 0.3 + clampedVolume * 0.7,
          }}
        />

        {/* Pulsing ring 3 */}
        <div
          className="absolute rounded-full border-2 border-[#991b1e]/50 transition-all duration-75 ease-out"
          style={{
            width: `${96 + clampedVolume * 30}px`,
            height: `${96 + clampedVolume * 30}px`,
          }}
        />

        {/* Center Mic Orb */}
        <div
          className="relative z-10 rounded-full bg-[#991b1e] shadow-xl shadow-[#991b1e]/30 flex items-center justify-center text-white transition-transform duration-75"
          style={{
            width: `${76 + clampedVolume * 16}px`,
            height: `${76 + clampedVolume * 16}px`,
          }}
        >
          <Mic className={`w-8 h-8 ${hasVoice ? 'scale-110 text-white' : 'text-white/90'}`} />
        </div>
      </div>

      {/* Live Audio Meter & Transcript Area */}
      <div className="w-full max-w-sm pb-4 space-y-3">
        {/* Live volume level meter */}
        <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 shrink-0 ${hasVoice ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                hasVoice ? 'bg-emerald-500' : 'bg-[#991b1e]'
              }`}
              style={{ width: `${Math.max(5, Math.min(100, clampedVolume * 100))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-500 w-9 text-right shrink-0">
            {Math.round(clampedVolume * 100)}%
          </span>
        </div>

        {/* Live transcript or status */}
        <div className="min-h-[4rem] flex items-center justify-center px-4 py-2 rounded-2xl bg-gray-50/90 border border-gray-200/80 shadow-xs">
          <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed italic">
            {transcript ? (
              `« ${transcript} »`
            ) : isConnecting ? (
              <span className="text-gray-400 not-italic">
                {isEn ? 'Connecting to live voice advisor...' : 'Connexion à la voix en direct...'}
              </span>
            ) : hasVoice ? (
              <span className="text-emerald-700 not-italic font-semibold">
                {isEn ? 'Voice detected, speak naturally...' : 'Voix détectée, parlez naturellement...'}
              </span>
            ) : (
              <span className="text-gray-400 not-italic">
                {isEn
                  ? "Listening... Try saying 'Do you have a red SUV?'"
                  : "À l'écoute... Dites par exemple « Avez-vous un VUS rouge ? »"}
              </span>
            )}
          </p>
        </div>

        {/* Helpful user cue */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium px-1">
          <span>{isEn ? 'Release or click to hear reply' : 'Relâchez pour écouter la réponse'}</span>
          <span className="text-[10px] font-mono opacity-70">
            {chunksSent > 0
              ? `${chunksSent} ${isEn ? 'audio packets' : 'paquets audio'}`
              : isEn ? 'Microphone active' : 'Microphone actif'}
          </span>
        </div>
      </div>
    </div>
  );
};

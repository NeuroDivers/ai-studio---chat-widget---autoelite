import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Send,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Loader2,
  Activity,
  Bug,
  AlertCircle,
  CheckCircle,
  Square,
  Radio,
  Globe,
} from 'lucide-react';
import { Vehicle } from '../types/inventory';
import { useDealer } from '../dealerContext';
import { VehicleCard } from './VehicleCard';
import { VehicleDetailView } from './VehicleDetailView';
import { VoicePulseScreen } from './VoicePulseScreen';
import {
  loadVehicles,
  startVoiceSession,
  isVehicleSearchQuery,
  answerDealer,
  directPlatform,
  LiveVoiceSession,
} from '../portalApi';
import { AudioCaptureController, AudioPlaybackController } from '../utils/audio';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  vehicles?: Vehicle[];
  isVoice?: boolean;
  isThinking?: boolean;
}

type Language = 'fr' | 'en';
type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking';

const STRINGS = {
  fr: {
    dealerName: 'Automobile Lambert',
    onlineAdvisor: 'Conseiller virtuel en ligne',
    greetingText: "Bonjour et bienvenue chez Automobile Lambert à Laval ! Je suis votre conseillère virtuelle. Comment puis-je vous aider aujourd'hui ?",
    listenGreeting: 'Écouter la présentation vocale',
    stopGreeting: 'Arrêter la présentation',
    listeningBadge: 'Listening...',
    listeningSub: "(À l'écoute)",
    thinkingBadge: 'Thinking...',
    thinkingSub: "Recherche dans l'inventaire et préparation de la réponse...",
    speaking: 'Réponse vocale en cours...',
    stopSpeaking: 'Arrêter',
    liveTranscriptLabel: 'Transcription en direct :',
    liveDetecting: '● Détection en temps réel',
    waitingVoice: 'En attente de voix...',
    micPrompt: 'Parlez dans votre microphone... (ex: « Avez-vous un VUS rouge ? »)',
    cancel: 'Annuler',
    sendToAi: "Envoyer à l'IA",
    clickOrRelease: 'Cliquez ou relâchez pour envoyer',
    inputPlaceholderListening: 'Listening... Parlez ou écrivez...',
    inputPlaceholder: 'Tapez votre recherche (ex: VUS rouge, AWD)...',
    speakBtn: 'Parler',
    sendBtn: 'Envoyer',
    quickRedSuv: 'VUS rouge',
    quickAwd: 'Traction AWD',
    quickBudget: 'Moins de 30 000 $',
    vehicleResults: (n: number) => `Résultats d'inventaire disponibles (${n})`,
    singleMatch: 'Voici le véhicule disponible correspondant à votre recherche :',
    multipleMatch: (n: number) => `Voici les ${n} véhicules disponibles correspondant à votre recherche :`,
    noMatch: 'Aucun véhicule disponible ne correspond à votre recherche. Souhaitez-vous explorer un autre type de véhicule comme un VUS, une berline ou un camion ?',
    testDriveRequest: (v: Vehicle) => `Je souhaite réserver un essai routier pour le ${v.year} ${v.make} ${v.model} (#${v.stock_number}).`,
    testDriveBooked: (v: Vehicle, phone: string) => `Excellente décision ! Notre équipe commerciale d'Automobile Lambert a bien noté votre demande pour le ${v.year} ${v.make} ${v.model} (Stock #${v.stock_number}). Un conseiller vous contactera dans les plus brefs délais.${phone ? ` Vous pouvez aussi nous appeler au ${phone}.` : ''}`,
    defaultAiFallback: "Bonjour ! Je suis à votre service chez Automobile Lambert. Cherchez-vous un VUS rouge, une berline ou un camion ?",
    micTestTitle: '🎙️ Tester micro 3s',
    micTestTesting: 'Test en cours...',
    simulateFr: '⚡ Simuler "VUS rouge"',
    simulateEn: '⚡ Simuler "Red SUV"',
    debugTitle: 'Diagnostic Audio & Voix Bilingue',
    voiceMessageBadge: 'Message vocal',
  },
  en: {
    dealerName: 'Automobile Lambert',
    onlineAdvisor: 'Virtual sales advisor online',
    greetingText: "Hello and welcome to Automobile Lambert in Laval! I'm your virtual advisor. How can I help you find your next vehicle today?",
    listenGreeting: 'Listen to spoken greeting',
    stopGreeting: 'Stop greeting',
    listeningBadge: 'Listening...',
    listeningSub: '(Mic active)',
    thinkingBadge: 'Thinking...',
    thinkingSub: 'Searching inventory and processing reply...',
    speaking: 'Voice response in progress...',
    stopSpeaking: 'Stop',
    liveTranscriptLabel: 'Live Transcription:',
    liveDetecting: '● Real-time voice detected',
    waitingVoice: 'Waiting for voice...',
    micPrompt: "Speak into your microphone... (e.g. 'Do you have a red SUV?')",
    cancel: 'Cancel',
    sendToAi: 'Send to AI',
    clickOrRelease: 'Click or release to send',
    inputPlaceholderListening: 'Listening... Speak or type...',
    inputPlaceholder: 'Type your search (e.g. red SUV, AWD)...',
    speakBtn: 'Speak',
    sendBtn: 'Send',
    quickRedSuv: 'Red SUV',
    quickAwd: 'AWD Drivetrain',
    quickBudget: 'Under $30,000',
    vehicleResults: (n: number) => `Available Inventory Results (${n})`,
    singleMatch: 'Here is the available vehicle matching your search:',
    multipleMatch: (n: number) => `Here are the ${n} available vehicles matching your search:`,
    noMatch: 'No available vehicles match your search. Would you like to explore another vehicle type such as an SUV, sedan, or truck?',
    testDriveRequest: (v: Vehicle) => `I would like to book a test drive for the ${v.year} ${v.make} ${v.model} (#${v.stock_number}).`,
    testDriveBooked: (v: Vehicle, phone: string) => `Great choice! Our sales team at Automobile Lambert has received your test drive request for the ${v.year} ${v.make} ${v.model} (Stock #${v.stock_number}). An advisor will contact you shortly.${phone ? ` You can also reach us at ${phone}.` : ''}`,
    defaultAiFallback: "Hello! I'm here to help at Automobile Lambert. Are you looking for a red SUV, a sedan, or a truck?",
    micTestTitle: '🎙️ Test Mic 3s',
    micTestTesting: 'Testing...',
    simulateFr: '⚡ Simulate "VUS rouge"',
    simulateEn: '⚡ Simulate "Red SUV"',
    debugTitle: 'Audio & Bilingual Voice Diagnostics',
    voiceMessageBadge: 'Voice message',
  },
};

function greetingFor(lang: Language, dealerName: string): string {
  return lang === 'en'
    ? `Hello and welcome to ${dealerName} in Laval! I'm your virtual advisor. How can I help you find your next vehicle today?`
    : `Bonjour et bienvenue chez ${dealerName} à Laval ! Je suis votre conseillère virtuelle. Comment puis-je vous aider aujourd'hui ?`;
}

export const ChatWidget: React.FC = () => {
  const dealer = useDealer();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [language, setLanguage] = useState<Language>('fr');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-greeting',
      sender: 'assistant',
      text: STRINGS.fr.greetingText,
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Real-time Voice States ('idle' | 'listening' | 'thinking' | 'speaking')
  const [voiceStatus, setVoiceStatus] = useState<VoiceMode>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [chunksSent, setChunksSent] = useState<number>(0);
  const [isPlayingIntro, setIsPlayingIntro] = useState<boolean>(false);
  const [showVoicePulseOverlay, setShowVoicePulseOverlay] = useState<boolean>(false);

  // Diagnostic / Debugging states
  const [selectedVoice, setSelectedVoice] = useState<'Kore' | 'Puck'>('Kore');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [micPermissionState, setMicPermissionState] = useState<string>('unknown');
  const [webSocketStatus, setWebSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [lastDebugEvent, setLastDebugEvent] = useState<string>('Prêt (Voix Kore HD activée)');
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micTestFeedback, setMicTestFeedback] = useState<string>('');

  // Audio & Live Session Refs
  const activeSessionRef = useRef<LiveVoiceSession | null>(null);
  const audioCaptureRef = useRef<AudioCaptureController | null>(null);
  const audioPlaybackRef = useRef<AudioPlaybackController | null>(null);
  const audioBufferQueueRef = useRef<string[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const activeTurnVehiclesRef = useRef<Vehicle[]>([]);
  const activeModelTranscriptRef = useRef<string>('');
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const hasReceivedModelAudioRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const holdStartTimeRef = useRef<number>(0);

  const t = STRINGS[language];

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === 'init-greeting'
          ? { ...message, text: greetingFor(language, dealer.name) }
          : message
      )
    );
  }, [dealer.name, language]);

  // Initialize audio playback and capture controllers
  useEffect(() => {
    audioPlaybackRef.current = new AudioPlaybackController();
    audioCaptureRef.current = new AudioCaptureController();

    // Check navigator permissions if available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((perm) => {
          setMicPermissionState(perm.state);
          perm.onchange = () => setMicPermissionState(perm.state);
        })
        .catch(() => {
          setMicPermissionState('disponible');
        });
    }

    return () => {
      audioCaptureRef.current?.destroy();
      audioPlaybackRef.current?.close();
      activeSessionRef.current?.close();
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  // Language switch handler
  const handleLanguageChange = useCallback((newLang: Language) => {
    if (newLang === language) return;
    setLanguage(newLang);

    if (isPlayingIntro) {
      audioPlaybackRef.current?.interrupt();
      setIsPlayingIntro(false);
    }

    // Update greeting message text if it hasn't been changed
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'init-greeting'
          ? { ...m, text: greetingFor(newLang, dealer.name) }
          : m
      )
    );

    // If active Live session is running, switch session language
    if (activeSessionRef.current) {
      activeSessionRef.current.setLanguage(newLang);
    }
    setLastDebugEvent(`Langue changée: ${newLang.toUpperCase()}`);
  }, [dealer.name, isPlayingIntro, language]);

  // Play the studio greeting recording. Kore is the default file for each language.
  const playGreetingIntro = useCallback(async () => {
    if (isPlayingIntro) {
      audioPlaybackRef.current?.interrupt();
      setIsPlayingIntro(false);
      return;
    }

    setIsPlayingIntro(true);
    await audioPlaybackRef.current?.resume();

    const voiceFile = selectedVoice === 'Puck' && language === 'en' ? 'puck-en' : language;
    const directWavUrl = `/audio/greeting-${voiceFile}.wav`;
    try {
      await audioPlaybackRef.current?.playAudioUrl(directWavUrl);
      setIsPlayingIntro(false);
      return;
    } catch (urlErr) {
      console.warn('Direct static WAV play error:', urlErr);
    }

    try {
      const res = await fetch(`/api/tts/greeting?lang=${language}`);
      if (res.ok) {
        const data = await res.json();
        if (data.wavUrl) {
          try {
            await audioPlaybackRef.current?.playAudioUrl(data.wavUrl);
            setIsPlayingIntro(false);
            return;
          } catch {}
        }
        if (data.audio) {
          await audioPlaybackRef.current?.playWavBase64(data.audio);
          setIsPlayingIntro(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Greeting fetch error:', err);
    }

    setIsPlayingIntro(false);
  }, [isPlayingIntro, language, selectedVoice]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !selectedVehicle) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, selectedVehicle, liveTranscript, voiceStatus]);

  // Lock body scroll on mobile
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Clean stop for recording session
  const cleanStopRecording = useCallback(() => {
    isListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    audioCaptureRef.current?.stop();
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
    setVolumeLevel(0);
  }, []);

  // Cancel voice interaction without sending
  const cancelListening = useCallback(() => {
    cleanStopRecording();
    setVoiceStatus('idle');
    setLiveTranscript('');
    setShowVoicePulseOverlay(false);
    activeSessionRef.current?.close();
    activeSessionRef.current = null;
    setLastDebugEvent('Écoute annulée');
  }, [cleanStopRecording]);

  // Start Voice Session (Listening Mode)
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    isListeningRef.current = true;
    holdStartTimeRef.current = Date.now();
    setVoiceStatus('listening');
    setLiveTranscript('');
    setVolumeLevel(0);
    setChunksSent(0);
    hasReceivedModelAudioRef.current = false;
    activeTurnVehiclesRef.current = [];
    activeModelTranscriptRef.current = '';
    audioBufferQueueRef.current = [];
    setLastDebugEvent(`Démarrage micro & session (${language.toUpperCase()})...`);

    // Interrupt any ongoing playback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    audioPlaybackRef.current?.interrupt();
    await audioPlaybackRef.current?.resume();
    setIsPlayingIntro(false);

    try {
      // 1. Instant speech recognition for real-time transcription feedback in selected language
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = language === 'en' ? 'en-US' : 'fr-CA';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (evt: any) => {
            let transcriptText = '';
            for (let i = 0; i < evt.results.length; i++) {
              transcriptText += evt.results[i][0].transcript;
            }
            if (transcriptText.trim()) {
              setLiveTranscript(transcriptText.trim());
              setLastDebugEvent(`Live SpeechRecognition: "${transcriptText.trim()}"`);
            }
          };
          recognition.onerror = () => {};
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition init warning:', e);
        }
      }

      // 2. Audio Capture Controller with Volume VU Meter feedback
      if (!audioCaptureRef.current) {
        audioCaptureRef.current = new AudioCaptureController();
      }

      await audioCaptureRef.current.start(
        (base64Audio) => {
          if (!isListeningRef.current) return;
          setChunksSent((prev) => prev + 1);
          if (activeSessionRef.current) {
            activeSessionRef.current.sendAudio(base64Audio);
          } else {
            audioBufferQueueRef.current.push(base64Audio);
          }
        },
        (rmsVolume) => {
          if (!isListeningRef.current) return;
          setVolumeLevel(rmsVolume);
        }
      );

      setMicPermissionState('granted');
      setLastDebugEvent('Micro actif. Enregistrement en cours...');

      // 3. Connect Gemini Live Session with selected language and Kore or Puck
      setWebSocketStatus('connecting');
      const session = await startVoiceSession({
        onReady: () => {
          setWebSocketStatus('connected');
          setLastDebugEvent(`Gemini Live connecté (${selectedVoice} - ${language.toUpperCase()})`);
        },
        onAudioChunk: (pcm24Base64) => {
          hasReceivedModelAudioRef.current = true;
          setVoiceStatus('speaking');
          setLastDebugEvent('Réception audio modèle 24kHz');
          audioPlaybackRef.current?.playChunk(pcm24Base64);
        },
        onUserTranscript: (transcript) => {
          if (transcript && transcript.trim()) {
            setLiveTranscript(transcript.trim());
            setLastDebugEvent(`Live transcript: "${transcript.trim()}"`);
          }
        },
        onModelTranscript: (transcript) => {
          setVoiceStatus('speaking');
          activeModelTranscriptRef.current += transcript;
          const currentText = activeModelTranscriptRef.current;
          if (currentAssistantMsgIdRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentAssistantMsgIdRef.current
                  ? { ...m, text: currentText, isThinking: false }
                  : m
              )
            );
          }
        },
        onVehiclesFound: (vehicles) => {
          activeTurnVehiclesRef.current = vehicles;
          if (currentAssistantMsgIdRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentAssistantMsgIdRef.current
                  ? { ...m, vehicles }
                  : m
              )
            );
          }
        },
        onTurnComplete: () => {
          audioPlaybackRef.current?.endStream();
          setVoiceStatus('idle');
          setLastDebugEvent('Tour IA terminé');
        },
        onInterrupted: () => {
          audioPlaybackRef.current?.interrupt();
          setVoiceStatus('idle');
          setLastDebugEvent('Interrompu');
        },
        onError: (err) => {
          setWebSocketStatus('disconnected');
          setLastDebugEvent(`Erreur: ${err.message}`);
          console.warn('Voice session error:', err);
        },
        onClose: () => {
          setWebSocketStatus('disconnected');
          setVoiceStatus((s) => (s === 'speaking' ? 'idle' : s));
          setLastDebugEvent('WebSocket fermé');
        },
      }, language, selectedVoice);

      if (!isListeningRef.current) {
        session.close();
        return;
      }

      activeSessionRef.current = session;
      setWebSocketStatus('connected');

      // Flush queued early audio packets
      if (audioBufferQueueRef.current.length > 0) {
        audioBufferQueueRef.current.forEach((chunk) => session.sendAudio(chunk));
        audioBufferQueueRef.current = [];
      }
    } catch (err: any) {
      cleanStopRecording();
      setVoiceStatus('idle');
      setMicPermissionState('denied');
      setLastDebugEvent(`Erreur micro: ${err.message}`);
      console.error('Failed to start voice capture:', err);
    }
  }, [cleanStopRecording, language, selectedVoice]);

  // Submit voice turn: Transitions from "Listening..." -> "Thinking..." -> Model reply
  const submitVoiceTurn = useCallback(() => {
    if (voiceStatus !== 'listening' && !isListeningRef.current) return;

    cleanStopRecording();
    setShowVoicePulseOverlay(false);

    const userQuery = liveTranscript.trim();
    const effectiveText = userQuery || (language === 'en' ? 'Voice query' : 'Requête vocale');

    // 1. Post user's voice message bubble with transcription
    const userMsgId = 'voice-u-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: effectiveText,
        isVoice: true,
      },
    ]);

    // 2. Set Status to "thinking" immediately with animated placeholder bubble
    setVoiceStatus('thinking');
    setLastDebugEvent(`Passage en 'Thinking...' pour: "${effectiveText}"`);

    const assistantMsgId = 'voice-a-' + Date.now();
    currentAssistantMsgIdRef.current = assistantMsgId;
    activeModelTranscriptRef.current = '';

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        isThinking: true,
      },
    ]);

    if (directPlatform) {
      answerDealer(effectiveText, language)
        .then((text) => {
          activeModelTranscriptRef.current = text;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMsgId ? { ...message, text, isThinking: false } : message
            )
          );
          setVoiceStatus('idle');
        })
        .catch(() => {
          const text =
            language === 'en'
              ? 'I could not reach the showroom just now. Please try again.'
              : 'Je ne peux pas joindre la concession pour le moment. Réessayez dans un instant.';
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMsgId ? { ...message, text, isThinking: false } : message
            )
          );
          setVoiceStatus('idle');
        });
      if (userQuery && isVehicleSearchQuery(userQuery)) {
        loadVehicles(userQuery).then((matched) => {
          if (matched.length > 0) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId ? { ...message, vehicles: matched } : message
              )
            );
          }
        });
      }
      setLiveTranscript('');
      return;
    }

    // 3. Notify Gemini Live bridge of audio completion with recognized text
    if (activeSessionRef.current) {
      activeSessionRef.current.stopAudio(userQuery || undefined);
    }

    // 4. Client-side fast path: if user query matches inventory directly
    if (userQuery && isVehicleSearchQuery(userQuery)) {
      loadVehicles(userQuery).then((matched) => {
        if (matched.length > 0) {
          activeTurnVehiclesRef.current = matched;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, vehicles: matched } : m
            )
          );
        }
      });
    }

    // Safety fallback: ensure thinking indicator resolves if model is slow
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId && m.isThinking
            ? {
                ...m,
                isThinking: false,
                text:
                  activeModelTranscriptRef.current ||
                  (language === 'en'
                    ? `Hello! I'm here to help at ${dealer.name}. Are you looking for a red SUV, a sedan, or a truck?`
                    : `Bonjour ! Je suis à votre service chez ${dealer.name}. Cherchez-vous un VUS rouge, une berline ou un camion ?`),
              }
            : m
        )
      );
      setVoiceStatus((s) => (s === 'thinking' ? 'idle' : s));
    }, 4500);

    setLiveTranscript('');
  }, [cleanStopRecording, dealer.name, language, liveTranscript, voiceStatus]);

  // Pointer Down on Mic button (supports press-and-hold OR simple click)
  const handleMicPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (voiceStatus === 'listening') {
      // If already listening in click-to-talk mode, clicking sends!
      submitVoiceTurn();
      return;
    }
    // Capture pointer so dragging cursor does NOT cancel
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}

    startListening();
  };

  // Pointer Up on Mic button
  const handleMicPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    const holdDuration = Date.now() - holdStartTimeRef.current;
    // If held for more than 450ms, release acts as "stop & send"
    // If quickly tapped (< 450ms), stay in listening mode so user can speak comfortably
    if (holdDuration > 450 && isListeningRef.current) {
      submitVoiceTurn();
    }
  };

  // Handle typed text messages
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query) return;

    const userMessage: ChatMessage = {
      id: 'msg-u-' + Date.now(),
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    if (isVehicleSearchQuery(query)) {
      const results = await loadVehicles(query);
      let replyText = '';
      if (results.length > 0) {
        replyText =
          results.length === 1
            ? t.singleMatch
            : t.multipleMatch(results.length);
      } else {
        replyText = t.noMatch;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-a-' + Date.now(),
          sender: 'assistant',
          text: replyText,
          vehicles: results.length > 0 ? results : undefined,
        },
      ]);
      return;
    }

    let text: string;
    try {
      text = await answerDealer(query, language);
    } catch {
      text =
        language === 'en'
          ? 'I could not reach the showroom just now. Please try again.'
          : 'Je ne peux pas joindre la concession pour le moment. Réessayez dans un instant.';
    }
    setMessages((prev) => [
      ...prev,
      {
        id: 'msg-a-' + Date.now(),
        sender: 'assistant',
        text,
      },
    ]);
  };

  // 3-second quick microphone test tool for diagnostics
  const runMicSelfTest = async () => {
    if (isTestingMic) return;
    setIsTestingMic(true);
    setMicTestFeedback(language === 'en' ? 'Microphone test running (3 seconds)... Speak now.' : 'Test micro en cours (3 secondes)... Parlez maintenant.');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxVol = 0;
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        if (avg > maxVol) maxVol = avg;

        if (Date.now() - startTime >= 3000) {
          clearInterval(checkInterval);
          stream.getTracks().forEach((trk) => trk.stop());
          ctx.close();
          setIsTestingMic(false);
          if (maxVol > 5) {
            setMicTestFeedback(
              language === 'en'
                ? `✅ Test passed! Peak volume detected: ${Math.round(maxVol)} / 128. Microphone is operating cleanly.`
                : `✅ Test réussi ! Volume crête détecté: ${Math.round(maxVol)} / 128. Le microphone fonctionne correctement.`
            );
          } else {
            setMicTestFeedback(
              language === 'en'
                ? `⚠️ Very low audio input (${Math.round(maxVol)}). Check microphone input volume in your system.`
                : `⚠️ Signal très faible (${Math.round(maxVol)}). Vérifiez le niveau sonore de votre micro dans votre système.`
            );
          }
        }
      }, 100);
    } catch (err: any) {
      setIsTestingMic(false);
      setMicTestFeedback(`❌ ${err.message}`);
    }
  };

  // Simulate synthetic voice query
  const runSimulatedVoiceQuery = (textToSimulate: string) => {
    setLiveTranscript(textToSimulate);
    setTimeout(() => {
      submitVoiceTurn();
    }, 400);
  };

  return (
    <>
      {/* 1. Launcher: Round red chat bubble, bottom right */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            playGreetingIntro();
          }}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#991b1e] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-[#991b1e]/40 cursor-pointer"
          aria-label={`Ouvrir le clavardage ${dealer.name}`}
        >
          <MessageSquare className="w-6 h-6 group-hover:rotate-6 transition-transform" />
          <span className="sr-only">Clavarder avec {dealer.name}</span>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
          </span>
        </button>
      )}

      {/* 2. Chat Panel */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-all duration-200 text-gray-900 border border-gray-200 overflow-hidden ${
            isExpanded
              ? 'inset-0 w-full h-[100dvh] rounded-none'
              : 'inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[440px] sm:h-[660px] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl w-full h-[100dvh]'
          }`}
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-3.5 py-3 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#991b1e] text-white flex items-center justify-center font-black text-sm shadow-xs">
                AL
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-gray-900 leading-tight">
                    {dealer.name}
                  </h3>
                  {/* Real-time Voice Status Pill in Header */}
                  {voiceStatus === 'listening' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-[#991b1e] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                      {t.listeningBadge}
                    </span>
                  )}
                  {voiceStatus === 'thinking' && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      {t.thinkingBadge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {dealer.agentName} · {dealer.agentRole}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-gray-500">
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5 text-xs font-bold mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVoice('Kore');
                    setLastDebugEvent('Voix: Kore (Féminine, naturelle)');
                  }}
                  className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer text-[11px] ${
                    selectedVoice === 'Kore'
                      ? 'bg-white text-[#991b1e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Voix Kore (Féminine, claire et naturelle)"
                >
                  Kore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVoice('Puck');
                    setLastDebugEvent('Voix: Puck (Masculine, dynamique)');
                  }}
                  className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer text-[11px] ${
                    selectedVoice === 'Puck'
                      ? 'bg-white text-[#991b1e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Voix Puck (Masculine, dynamique)"
                >
                  Puck
                </button>
              </div>

              {/* Bilingual Language Switcher [ FR | EN ] */}
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5 text-xs font-bold mr-1">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('fr')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    language === 'fr'
                      ? 'bg-white text-[#991b1e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Français"
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-white text-[#991b1e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="English"
                >
                  EN
                </button>
              </div>

              {/* Spoken voice introduction button */}
              <button
                type="button"
                onClick={playGreetingIntro}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-[#991b1e] cursor-pointer"
                title={isPlayingIntro ? t.stopGreeting : t.listenGreeting}
                aria-label={t.listenGreeting}
              >
                <Volume2 className={`w-4 h-4 ${isPlayingIntro ? 'animate-bounce text-[#991b1e]' : ''}`} />
              </button>

              {/* Debug / Diagnostic Toggle */}
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                  showDebug
                    ? 'bg-amber-100 text-amber-800 font-bold'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                title="Afficher les outils de diagnostic audio"
                aria-label="Diagnostic"
              >
                <Bug className="w-4 h-4" />
              </button>

              {/* Fullscreen Voice Visualizer Toggle */}
              {voiceStatus === 'listening' && (
                <button
                  type="button"
                  onClick={() => setShowVoicePulseOverlay(!showVoicePulseOverlay)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-[#991b1e] cursor-pointer"
                  title="Plein écran onde vocale"
                  aria-label="Plein écran onde vocale"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                </button>
              )}

              {/* Expand / Maximize toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors hover:text-gray-800 cursor-pointer"
                title={isExpanded ? 'Réduire' : 'Agrandir en plein écran'}
                aria-label={isExpanded ? 'Réduire' : 'Agrandir'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => {
                  cancelListening();
                  setIsOpen(false);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors hover:text-gray-800 cursor-pointer"
                title="Fermer"
                aria-label="Fermer le clavardage"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Diagnostic & Debug Bar */}
          {showDebug && (
            <div className="bg-amber-50/90 border-b border-amber-200 p-3 text-xs space-y-2 shrink-0 animate-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-700" />
                  {t.debugTitle}
                </span>
                <span className="font-mono text-[10px] text-amber-700">
                  WS: {webSocketStatus} | Lang: {language.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Micro:</span>
                  <span className={`font-semibold ${micPermissionState === 'granted' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {micPermissionState}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Voix IA:</span>
                  <span className="font-semibold text-emerald-700">{selectedVoice} 24kHz</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Paquets:</span>
                  <span className="font-mono font-bold text-gray-900">{chunksSent}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Volume:</span>
                  <span className="font-mono font-bold text-gray-900">{Math.round(volumeLevel * 100)}%</span>
                </div>
              </div>

              {/* Volume VU meter visualizer */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>VU-Mètre Direct</span>
                  <span className="font-mono">{Math.round(volumeLevel * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      volumeLevel > 0.05 ? 'bg-emerald-500' : 'bg-[#991b1e]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, volumeLevel * 300))}%` }}
                  />
                </div>
              </div>

              {lastDebugEvent && (
                <div className="text-[10px] text-gray-600 font-mono truncate">
                  Dernier état: {lastDebugEvent}
                </div>
              )}

              {micTestFeedback && (
                <div className="p-2 rounded-lg bg-white border border-amber-200 text-[11px] text-gray-800">
                  {micTestFeedback}
                </div>
              )}

              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                <button
                  type="button"
                  onClick={runMicSelfTest}
                  disabled={isTestingMic}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isTestingMic ? t.micTestTesting : t.micTestTitle}
                </button>
                <button
                  type="button"
                  onClick={() => runSimulatedVoiceQuery('Avez-vous un VUS rouge ?')}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 border border-amber-300 text-amber-900 font-semibold text-[11px] transition-all cursor-pointer"
                >
                  {t.simulateFr}
                </button>
                <button
                  type="button"
                  onClick={() => runSimulatedVoiceQuery('Do you have a red SUV?')}
                  className="px-2 py-1 rounded bg-white hover:bg-gray-100 border border-amber-300 text-amber-900 font-semibold text-[11px] transition-all cursor-pointer"
                >
                  {t.simulateEn}
                </button>
              </div>
            </div>
          )}

          {/* Full-screen VoicePulseScreen overlay if toggled */}
          {showVoicePulseOverlay && (
            <VoicePulseScreen
              transcript={liveTranscript}
              isConnecting={webSocketStatus === 'connecting'}
              volumeLevel={volumeLevel}
              chunksSent={chunksSent}
              language={language}
            />
          )}

          {/* Vehicle Detail View if a vehicle card was clicked */}
          {selectedVehicle && (
            <VehicleDetailView
              vehicle={selectedVehicle}
              onBack={() => setSelectedVehicle(null)}
              onRequestInfo={(v) => {
                setSelectedVehicle(null);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: 'req-' + Date.now(),
                    sender: 'user',
                    text: t.testDriveRequest(v),
                  },
                  {
                    id: 'rep-' + Date.now(),
                    sender: 'assistant',
                    text:
                      language === 'en'
                        ? `Great choice! ${dealer.name} has received your test drive request for the ${v.year} ${v.make} ${v.model}. An advisor will contact you shortly. You can also reach us at ${dealer.phone}.`
                        : `Excellente décision ! ${dealer.name} a bien noté votre demande d'essai pour le ${v.year} ${v.make} ${v.model}. Un conseiller vous contactera dans les plus brefs délais. Vous pouvez aussi nous appeler au ${dealer.phone}.`,
                  },
                ]);
              }}
            />
          )}

          {/* Scrollable Conversation messages list */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-gray-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Speech / Text Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-[#991b1e] text-white rounded-br-xs font-medium'
                      : 'bg-white text-gray-900 border border-gray-200/80 rounded-bl-xs'
                  }`}
                >
                  {msg.isVoice && (
                    <span className="inline-flex items-center gap-1 text-[11px] opacity-80 mb-1 font-semibold block">
                      <Mic className="w-3 h-3" /> {t.voiceMessageBadge}
                    </span>
                  )}

                  {/* Real-time Thinking text indicator inside pending turn */}
                  {msg.isThinking ? (
                    <div className="py-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#991b1e] uppercase tracking-wider">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Thinking...</span>
                        <span className="inline-flex gap-1 ml-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce" />
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 italic">
                        {t.thinkingSub}
                      </p>
                    </div>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {msg.id === 'init-greeting' && (
                    <button
                      type="button"
                      onClick={playGreetingIntro}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-[#991b1e] border border-red-200 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isPlayingIntro ? 'animate-bounce text-[#991b1e]' : ''}`} />
                      <span>{isPlayingIntro ? t.stopGreeting : t.listenGreeting}</span>
                    </button>
                  )}
                </div>

                {/* Render Vehicle Cards from search if present */}
                {msg.vehicles && msg.vehicles.length > 0 && (
                  <div className="mt-3 w-full space-y-3">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                      {t.vehicleResults(msg.vehicles.length)}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {msg.vehicles.map((v) => (
                        <VehicleCard
                          key={v.id}
                          vehicle={v}
                          onSelect={(car) => setSelectedVehicle(car)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* REAL-TIME "LISTENING..." CARD WITH LIVE TRANSCRIPTION PREVIEW */}
          {voiceStatus === 'listening' && (
            <div className="mx-3 my-2 p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl shadow-md space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 shrink-0">
              {/* Header with 'Listening...' Indicator + Audio Waveform */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-[#991b1e]">
                      {t.listeningBadge}
                    </span>
                    <span className="text-[11px] text-red-700/80 font-medium">
                      {t.listeningSub}
                    </span>
                  </div>
                </div>

                {/* Dynamic animated equalizer bars driven by mic volume level */}
                <div className="flex items-center gap-1 h-5 px-2 bg-white/70 rounded-full border border-red-100">
                  {[4, 12, 18, 10, 16, 6].map((baseH, idx) => {
                    const scaledH = Math.max(4, Math.min(20, baseH * (volumeLevel * 6 + 0.3)));
                    return (
                      <div
                        key={idx}
                        className="w-1 bg-[#991b1e] rounded-full transition-all duration-75"
                        style={{ height: `${scaledH}px` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* LIVE TRANSCRIPTION DISPLAY */}
              <div className="bg-white rounded-xl p-3 border border-red-200/80 shadow-xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  <span>{t.liveTranscriptLabel}</span>
                  <span className={liveTranscript ? 'text-emerald-600 font-semibold' : 'text-gray-400 font-normal'}>
                    {liveTranscript ? t.liveDetecting : t.waitingVoice}
                  </span>
                </div>
                <div className="min-h-[1.75rem] flex items-center">
                  {liveTranscript ? (
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      « {liveTranscript} »
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      {t.micPrompt}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons: Send to AI or Cancel */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={cancelListening}
                  className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-medium hidden xs:inline">
                    {t.clickOrRelease}
                  </span>
                  <button
                    type="button"
                    onClick={submitVoiceTurn}
                    className="inline-flex items-center gap-1.5 bg-[#991b1e] hover:bg-[#801618] active:scale-95 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <span>{t.sendToAi}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REAL-TIME "THINKING..." INDICATOR BANNER */}
          {voiceStatus === 'thinking' && (
            <div className="mx-3 my-2 p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-xs flex items-center justify-between text-xs text-amber-900 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-[#991b1e] animate-spin" />
                  <Sparkles className="w-2 h-2 text-amber-600 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <span className="font-bold text-[#991b1e] uppercase tracking-wider text-xs">
                    {t.thinkingBadge}
                  </span>
                  <span className="text-gray-600 ml-1.5">
                    {t.thinkingSub}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#991b1e] animate-bounce" />
              </div>
            </div>
          )}

          {/* Audio Speaking Indicator */}
          {voiceStatus === 'speaking' && (
            <div className="bg-red-50 border-t border-red-100 px-3 py-1.5 flex items-center justify-between text-xs text-[#991b1e] font-medium shrink-0 animate-pulse">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                {t.speaking}
              </span>
              <button
                type="button"
                onClick={() => {
                  audioPlaybackRef.current?.interrupt();
                  setVoiceStatus('idle');
                }}
                className="text-[11px] underline hover:text-red-900 cursor-pointer"
              >
                {t.stopSpeaking}
              </button>
            </div>
          )}

          {/* Footer Controls & Inputs */}
          <div className="bg-white border-t border-gray-200 p-3 space-y-2 shrink-0">
            {/* Quick search suggestions */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setInputText(t.quickRedSuv)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                {t.quickRedSuv}
              </button>
              <button
                type="button"
                onClick={() => setInputText(t.quickAwd)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                {t.quickAwd}
              </button>
              <button
                type="button"
                onClick={() => setInputText(t.quickBudget)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                {t.quickBudget}
              </button>
            </div>

            {/* Input + Send + Mic */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    voiceStatus === 'listening'
                      ? t.inputPlaceholderListening
                      : t.inputPlaceholder
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#991b1e]/30 focus:border-[#991b1e]"
                />
              </div>

              {/* Text Send Button */}
              {inputText.trim() && (
                <button
                  type="submit"
                  className="bg-[#991b1e] hover:bg-[#801618] active:scale-95 text-white p-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label={t.sendBtn}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}

              {/* Dual-Mode Mic Button: Click to toggle OR Hold to speak */}
              <button
                type="button"
                onPointerDown={handleMicPointerDown}
                onPointerUp={handleMicPointerUp}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs select-none touch-none shrink-0 transition-all shadow-xs cursor-pointer ${
                  voiceStatus === 'listening'
                    ? 'bg-red-700 text-white ring-4 ring-red-300 scale-95 animate-pulse'
                    : voiceStatus === 'thinking'
                    ? 'bg-amber-600 text-white opacity-80 cursor-wait'
                    : 'bg-[#991b1e] hover:bg-[#801618] active:bg-[#6b1214] text-white'
                }`}
                title={
                  voiceStatus === 'listening'
                    ? language === 'en' ? 'Recording active. Click to send.' : 'Enregistrement en cours. Cliquez pour envoyer.'
                    : language === 'en' ? 'Click or hold to speak' : 'Cliquez ou maintenez pour parler'
                }
                aria-label={
                  voiceStatus === 'listening'
                    ? 'Listening... Click to send'
                    : 'Hold to speak'
                }
              >
                {voiceStatus === 'listening' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{t.sendBtn}</span>
                  </>
                ) : voiceStatus === 'thinking' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.thinkingBadge}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" />
                    <span className="hidden xs:inline sm:inline">{t.speakBtn}</span>
                    <span className="inline xs:hidden sm:hidden">Mic</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

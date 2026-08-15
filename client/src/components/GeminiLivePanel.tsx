import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Volume2, X, AlertCircle } from 'lucide-react';

interface GeminiLivePanelProps {
  onClose: () => void;
  roomId: string;
  localStream?: MediaStream | null;
}

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string to Int16Array
function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export default function GeminiLivePanel({ onClose, roomId, localStream }: GeminiLivePanelProps) {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [aiText, setAiText] = useState('MeetMind AI is connected. Say hello or ask a question!');
  
  // Audio Refs
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Playback scheduler
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    connectLiveAI();
    return () => {
      disconnectLiveAI();
    };
  }, []);

  const connectLiveAI = async () => {
    try {
      setStatus('connecting');
      
      // 1. Establish WebSocket to Proxy
      const wsUrl = `ws://localhost:5000/live-ai-proxy`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('✅ Live AI WebSocket proxy connection opened');
        setStatus('listening');
        await startMicRecording(ws);
      };

      ws.onmessage = async (event) => {
        try {
          // Gemini Live returns JSON text payloads containing base64 audio and text parts
          const message = JSON.parse(event.data);
          
          if (message.serverContent?.modelTurn?.parts) {
            const parts = message.serverContent.modelTurn.parts;
            
            // Extract and display text caption parts
            const textPart = parts.find((p: any) => p.text);
            if (textPart) {
              setAiText(prev => {
                if (prev === 'MeetMind AI is connected. Say hello or ask a question!') {
                  return textPart.text;
                }
                return prev + ' ' + textPart.text;
              });
            }

            // Extract and play audio parts
            const audioPart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
            if (audioPart && audioPart.inlineData.data) {
              const base64Data = audioPart.inlineData.data;
              const pcmData = base64ToInt16Array(base64Data);
              playPcmAudioChunk(pcmData);
              setStatus('speaking');
              
              // Return to listening state after the audio chunk completes playing
              const duration = pcmData.length / 24000; // 24kHz output
              setTimeout(() => {
                setStatus(prev => prev === 'speaking' ? 'listening' : prev);
              }, duration * 1000);
            }
          }

          if (message.type === 'notification') {
            setAiText(message.text);
          }
        } catch (err) {
          console.error('Failed to parse incoming Gemini Live socket packet:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setStatus('error');
        setErrorMessage('Failed to connect to AI server WebSocket.');
      };

      ws.onclose = () => {
        console.log('🔌 Live AI WebSocket closed');
        setStatus('connecting');
      };

    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Microphone access denied.');
    }
  };

  const startMicRecording = async (ws: WebSocket) => {
    try {
      let micStream = localStream;
      if (!micStream) {
        console.log('🎙️ No active stream passed from meeting room. Requesting microphone access...');
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      } else {
        console.log('🎙️ Using shared meeting room localStream track for Gemini Live.');
      }
      micStreamRef.current = micStream;

      // 3. Audio Context resampler
      const audioContextIn = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextInRef.current = audioContextIn;

      const source = audioContextIn.createMediaStreamSource(micStream);
      
      // Buffer size 2048, 1 input channel, 1 output channel
      const processorNode = audioContextIn.createScriptProcessor(2048, 1, 1);
      processorNodeRef.current = processorNode;

      source.connect(processorNode);
      processorNode.connect(audioContextIn.destination);

      processorNode.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const inputFloats = e.inputBuffer.getChannelData(0);
        
        // Convert floating samples [-1.0, 1.0] to 16-bit Signed PCM Int16Array
        const pcmInt16 = new Int16Array(inputFloats.length);
        for (let i = 0; i < inputFloats.length; i++) {
          const s = Math.max(-1, Math.min(1, inputFloats[i]));
          pcmInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert PCM array to Base64
        const base64Audio = arrayBufferToBase64(pcmInt16.buffer);

        // Send base64 wrapped inside Gemini Live's realtimeInput structure
        const audioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm',
                data: base64Audio
              }
            ]
          }
        };

        ws.send(JSON.stringify(audioMessage));
      };

    } catch (err: any) {
      console.error('Microphone acquisition failed:', err.message);
      setStatus('error');
      setErrorMessage(err.message || 'Microphone access denied. Please verify your browser mic permissions.');
    }
  };

  // Playback scheduler for smooth stream audio stitching
  const playPcmAudioChunk = (pcmData: Int16Array) => {
    try {
      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        nextPlayTimeRef.current = audioContextOutRef.current.currentTime;
      }

      const ctx = audioContextOutRef.current;
      
      // Convert Int16 PCM back to Float32
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768;
      }

      // Create audio buffer for 24 kHz mono output
      const audioBuffer = ctx.createBuffer(1, floatData.length, 24000);
      audioBuffer.copyToChannel(floatData, 0);

      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now;
      }

      bufferSource.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
    } catch (err) {
      console.error('Audio playback failed', err);
    }
  };

  const disconnectLiveAI = () => {
    // Stop recording
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close();
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close();
      audioContextOutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return (
    <div className="absolute bottom-24 right-6 glass-card p-5 w-80 border-brand-500/30 flex flex-col gap-4 shadow-xl shadow-brand-500/10 animate-slide-up z-30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white leading-tight">MeetMind Voice Assistant</h4>
            
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'listening' ? 'bg-green-500 animate-pulse' :
                status === 'speaking' ? 'bg-brand-400 live-glow' :
                status === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'
              }`} />
              <span className="text-[9px] text-dark-400 uppercase font-extrabold tracking-wider">
                {status === 'connecting' ? 'Stitch link...' :
                 status === 'listening' ? 'Listening...' :
                 status === 'speaking' ? 'Speaking...' : 'Error'}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Voice Status Animation visualizer */}
      <div className="h-16 bg-dark-950/80 rounded-xl border border-dark-800 flex items-center justify-center gap-1 relative overflow-hidden">
        {status === 'speaking' && (
          <div className="flex gap-1 items-center justify-center">
            {[1.2, 2.5, 1.8, 2.8, 1.5, 2.2, 1.0].map((delay, i) => (
              <span 
                key={i} 
                className="w-1 bg-brand-500 rounded-full animate-bounce" 
                style={{ 
                  height: '24px', 
                  animationDelay: `${delay}s`,
                  animationDuration: '1s'
                }} 
              />
            ))}
          </div>
        )}
        
        {status === 'listening' && (
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Connected. Speak now...</span>
          </div>
        )}

        {status === 'connecting' && (
          <span className="text-xs text-dark-500 font-medium">Negotiating audio channels...</span>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-1 text-xs text-red-400 font-semibold px-4 text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Real-time Text Output Box */}
      <div className="bg-dark-950 rounded-xl p-3 border border-dark-800 text-xs text-dark-300 min-h-16 flex items-start justify-start text-left leading-relaxed max-h-32 overflow-y-auto">
        {status === 'speaking' ? (
          <span className="text-white flex gap-1.5 w-full">
            <Volume2 className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <span className="font-sans font-medium w-full">{aiText}</span>
          </span>
        ) : (
          <span className="italic w-full">{aiText}</span>
        )}
      </div>
    </div>
  );
}

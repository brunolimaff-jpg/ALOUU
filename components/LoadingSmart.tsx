
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMode } from '../constants';
import { getInsightPool, getLongWaitMessages, getNextFact, cleanFactPrefix } from '../utils/loadingHelpers';
import { generateLoadingCuriosities } from '../services/geminiService';

// ==========================================
// CONFIGURAÇÃO DE TEMPO (EM MS)
// ==========================================
const MIN_DISPLAY_MS_SHORT = 8000;
const MIN_DISPLAY_MS_MEDIUM = 10000;
const MIN_DISPLAY_MS_LONG = 12000;
const FADE_DURATION = 500;

interface LoadingSmartProps {
  isLoading: boolean;
  mode: ChatMode;
  isDarkMode: boolean;
  onStop?: () => void;
  processing?: {
    stage?: string; // Status real vindo do stream (ex: "Buscando dados...")
    stageIndex?: number;
    stageTotal?: number;
  };
  searchQuery?: string;
}

const LoadingSmart: React.FC<LoadingSmartProps> = ({ 
  isLoading, 
  mode, 
  isDarkMode,
  onStop,
  processing, // Recebe status real aqui
  searchQuery
}) => {
  // Estado Visual da Curiosidade
  const [currentInsight, setCurrentInsight] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // Timer para mostrar tempo decorrido
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef(0);

  // Refs de Controle
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongLoadingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  
  // Filas de conteúdo
  const fetchedCuriositiesRef = useRef<string[]>([]);
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ==================================================================================
  // 0. BUSCA DE CURIOSIDADES DINÂMICAS (API)
  // ==================================================================================
  useEffect(() => {
    if (isLoading && searchQuery && !hasFetchedRef.current) {
        hasFetchedRef.current = true; 
        generateLoadingCuriosities(searchQuery).then(facts => {
            if (facts && facts.length > 0) {
                const formattedFacts = facts.map(f => cleanFactPrefix(f));
                fetchedCuriositiesRef.current = formattedFacts;
            }
        });
    }
  }, [isLoading, searchQuery]);

  // ==================================================================================
  // 1. TIMER VISUAL (Contador de segundos)
  // ==================================================================================
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // ==================================================================================
  // 2. LÓGICA DE SELEÇÃO DE CURIOSIDADES (Non-Repeating)
  // ==================================================================================
  const getNextMessage = useCallback(() => {
     if (fetchedCuriositiesRef.current.length > 0) {
         return fetchedCuriositiesRef.current.shift() || "";
     }
     const currentMode = modeRef.current;
     // Usa pool GERAL por padrão ou tenta inferir do status se possível (opcional)
     let pool = getInsightPool(currentMode, 'GERAL');
     
     if (isLongLoadingRef.current) {
         pool = [...pool, ...getLongWaitMessages(currentMode)];
     }
     
     return getNextFact(pool);
  }, []);

  const calculateDuration = useCallback((text: string) => {
    if (!text) return MIN_DISPLAY_MS_SHORT;
    const len = text.length;
    if (len <= 70) return MIN_DISPLAY_MS_SHORT;
    if (len <= 120) return MIN_DISPLAY_MS_MEDIUM;
    return MIN_DISPLAY_MS_LONG;
  }, []);

  // ==================================================================================
  // 3. MOTOR DE ROTAÇÃO DE CURIOSIDADES
  // ==================================================================================
  const cycleMessages = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const nextText = getNextMessage();
    const duration = calculateDuration(nextText);

    setIsFadingOut(true);

    timerRef.current = setTimeout(() => {
        setCurrentInsight(nextText);
        setIsFadingOut(false); 
        timerRef.current = setTimeout(() => {
            cycleMessages();
        }, duration);
    }, FADE_DURATION);

  }, [getNextMessage, calculateDuration]);

  // ==================================================================================
  // 4. CICLO DE VIDA (START / STOP)
  // ==================================================================================
  useEffect(() => {
    let longLoadingTimer: ReturnType<typeof setTimeout>;

    if (isLoading) {
      setIsVisible(true);
      setIsFadingOut(false);
      isLongLoadingRef.current = false;
      hasFetchedRef.current = false;
      fetchedCuriositiesRef.current = [];

      // Mensagem inicial
      const initialText = getNextMessage();
      setCurrentInsight(initialText);
      
      const duration = calculateDuration(initialText);
      timerRef.current = setTimeout(cycleMessages, duration);

      longLoadingTimer = setTimeout(() => {
        isLongLoadingRef.current = true;
      }, 20000);

    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsFadingOut(true);
      const exitTimer = setTimeout(() => setIsVisible(false), FADE_DURATION);
      return () => clearTimeout(exitTimer);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(longLoadingTimer);
    };
  }, [isLoading, cycleMessages, getNextMessage, calculateDuration]); 

  // ==================================================================================
  // 5. RENDERIZAÇÃO
  // ==================================================================================
  if (!isVisible) return null;

  const theme = {
    container: isDarkMode 
      ? 'bg-slate-800/95 border-slate-700 shadow-slate-900/20'
      : 'bg-white border-slate-200 shadow-slate-200',
    iconColor: 'text-emerald-500',
    baseTextColor: isDarkMode ? 'text-slate-100' : 'text-slate-900',
    insightTextColor: isDarkMode ? 'text-slate-300' : 'text-slate-600',
    divider: isDarkMode ? 'border-white/5' : 'border-slate-900/5',
    timerColor: isDarkMode ? 'text-slate-500' : 'text-slate-400'
  };

  // Status Real do Stream (fallback para mensagem genérica)
  const currentRealStatus = processing?.stage || "Processando dados...";

  return (
    <div className={`
      flex flex-col w-full max-w-4xl mx-auto my-4 md:my-6
      relative rounded-xl border shadow-sm backdrop-blur-sm transition-all duration-300
      p-3 md:p-5
      ${theme.container}
    `}>
      
      {/* HEADER: Spinner + Status Base + Timer + Parar */}
      <div className="flex items-center justify-between gap-3 mb-2 md:mb-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className={`text-xl md:text-2xl select-none flex-none animate-spin`}>
                <div className={`w-4 h-4 md:w-5 md:h-5 border-2 border-current border-t-transparent rounded-full ${theme.iconColor}`}></div>
            </div>
            <div className="flex items-baseline gap-2 overflow-hidden">
                <span className={`font-bold text-sm md:text-lg ${theme.baseTextColor} tracking-tight truncate`}>
                    Processando dados...
                </span>
                <span className={`text-[10px] md:text-xs font-mono ${theme.timerColor}`}>
                    {formatTime(elapsedTime)}
                </span>
            </div>
          </div>

          {onStop && (
              <button 
                onClick={onStop} 
                className="flex-shrink-0 text-[10px] md:text-xs font-bold text-red-400 hover:text-red-500 border border-red-500/30 px-2 py-1 md:px-3 md:py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                  PARAR
              </button>
          )}
      </div>

      {/* BODY: Status Real (LIVE) */}
      <div className="flex flex-wrap items-center gap-2 mb-3 md:mb-4 animate-fade-in pl-1">
        <div className="flex items-center gap-2">
            {/* Pulsing Dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {/* Real Status Text */}
            <span className="text-xs md:text-sm font-medium text-emerald-500 uppercase tracking-wide animate-pulse">
                {currentRealStatus}
            </span>
        </div>
      </div>

      {/* FOOTER: Curiosidades */}
      <div className={`
        pt-2 md:pt-3 border-t ${theme.divider} transition-opacity duration-300 ease-in-out
        ${isFadingOut ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}
      `}>
        <p className={`
          text-xs md:text-[15px] leading-relaxed font-normal
          ${theme.insightTextColor}
          [overflow-wrap:anywhere] break-words line-clamp-3 md:line-clamp-none
        `}>
          {currentInsight && (
             <span className="text-xs md:text-sm opacity-60">
               {currentInsight}
             </span>
          )}
        </p>
      </div>
      
    </div>
  );
};

export default LoadingSmart;

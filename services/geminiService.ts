
import { GoogleGenAI, Chat, Content, GenerateContentResponse, GenerateContentStreamResult } from "@google/genai";
import { AppError, ReportType, Sender } from '../types';
import { ChatMode } from '../constants';
import { normalizeAppError } from '../utils/errorHelpers';
import { withAutoRetry } from '../utils/retry';
import { Message } from '../types';
import { stripMarkdown, cleanSuggestionText, cleanStatusMarkers, extractSources } from '../utils/textCleaners';
// Import relativo padrão, sem @
import { lookupCliente, formatarParaPrompt, benchmarkClientes, formatarBenchmarkParaPrompt } from './clientLookupService';
import { addInvestigation } from '../components/InvestigationDashboard';

export interface GeminiRequestOptions {
  useGrounding?: boolean;
  thinkingMode?: boolean;
  signal?: AbortSignal;
  onText?: (text: string) => void;
  onStatus?: (status: string) => void;
}

// CONSTANTE DO MELHOR MODELO DISPONÍVEL
const BEST_MODEL_ID = 'gemini-3-pro-preview';
const FAST_MODEL_ID = 'gemini-3-flash-preview';

// Singleton instances
let genAI: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
  if (!genAI) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is missing.");
    }
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

/**
 * Helper para melhorar títulos das fontes
 */
function getReadableTitle(source: { uri?: string; title?: string }): string {
  const title = source.title || '';
  const uri = source.uri || '';
  
  // Se o título já é descritivo (mais que só o domínio), use ele
  if (title && title.length > 20 && !title.match(/^[\w.-]+\.\w{2,4}$/)) {
    return title;
  }
  
  // Extrair domínio limpo da URL ou usar o título como domínio
  let domain = '';
  try {
    // Tentar pegar o domínio do título (que geralmente é o domínio real em Search Grounding)
    if (title && title.includes('.')) {
      domain = title;
    } else if (uri) {
      domain = new URL(uri).hostname.replace('www.', '');
    }
  } catch {
    domain = title || 'Fonte';
  }
  
  // Mapear domínios conhecidos para nomes legíveis
  const DOMAIN_NAMES: Record<string, string> = {
    'youtube.com': '📺 YouTube',
    'theagribiz.com': '🌾 The AgriBiz',
    'comprerural.com': '🐄 Compre Rural',
    'agfeed.com.br': '📰 AgFeed',
    'canalrural.com.br': '📺 Canal Rural',
    'globorural.globo.com': '📰 Globo Rural',
    'valoreconomico.globo.com': '📰 Valor Econômico',
    'reuters.com': '📰 Reuters',
    'bloomberg.com': '📰 Bloomberg',
    'forbes.com.br': '📰 Forbes Brasil',
    'senior.com.br': '🏢 Senior Sistemas',
    'gatec.com.br': '🌾 GAtec',
    'conab.gov.br': '🏛️ CONAB',
    'ibama.gov.br': '🏛️ IBAMA',
    'jusbrasil.com.br': '⚖️ JusBrasil',
    'reclameaqui.com.br': '⭐ Reclame Aqui',
    'linkedin.com': '💼 LinkedIn',
    'estadao.com.br': '📰 Estadão',
    'folha.uol.com.br': '📰 Folha de S.Paulo',
    'infomoney.com.br': '💰 InfoMoney',
    'gazetadigital.com.br': '📰 Gazeta Digital',
    'rdnews.com.br': '📰 RDNews',
    'imea.com.br': '📊 IMEA',
    'noticiasagricolas.com.br': '🌾 Notícias Agrícolas',
    'agrolink.com.br': '🔗 Agrolink',
    'embrapa.br': '🔬 Embrapa',
    'gov.br': '🇧🇷 Gov.br',
    'google.com': '🔍 Google',
    'g1.globo.com': '📰 G1',
    'cnnbrasil.com.br': '📰 CNN Brasil'
  };
  
  // Match exato
  if (DOMAIN_NAMES[domain]) return DOMAIN_NAMES[domain];
  
  // Match parcial
  const knownKey = Object.keys(DOMAIN_NAMES).find(key => domain.includes(key));
  if (knownKey) return DOMAIN_NAMES[knownKey];

  return domain || title || 'Fonte Externa';
}

/**
 * Cria uma sessão de chat configurada com o histórico fornecido
 */
export const createChatSession = (
  systemInstruction: string, 
  history: Message[],
  modelId: string = BEST_MODEL_ID,
  useGrounding: boolean = true,
  thinkingMode: boolean = true 
): Chat => {
  const ai = getGenAI();
  
  // Configuração de Ferramentas (Grounding)
  const tools: any[] = [];
  if (useGrounding) {
    tools.push({ googleSearch: {} });
  }

  // Converter histórico de Message[] (app) para Content[] (SDK)
  // Filtramos mensagens de erro e garantimos a alternância correta se necessário
  const sdkHistory: Content[] = history
    .filter(msg => !msg.isError) // Remove erros visuais do histórico do bot
    .map(msg => ({
      role: msg.sender === Sender.User ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

  // CONFIGURAÇÃO AVANÇADA (GEMINI 3 PRO)
  let config: any = {
    systemInstruction: systemInstruction,
    temperature: 0.2, // Baixo para garantir factualidade e evitar alucinações
    tools: tools.length > 0 ? tools : undefined,
  };

  // Configuração de Raciocínio (Thinking) para Gemini 3
  if (thinkingMode) {
    config.thinkingConfig = { 
        thinkingBudget: 24576, // Budget alto para garantir profundidade
        includeThoughts: false 
    }; 
  }

  // Cria nova sessão com o histórico injetado
  return ai.chats.create({
    model: modelId,
    config: config,
    history: sdkHistory
  });
};

export const resetChatSession = () => {
  // Mantido para compatibilidade, mas agora a sessão é stateless por request
};

/**
 * Extrai nome da empresa + detecta intenção de benchmark
 */
const extractCompanyName = async (msg: string): Promise<{ empresa: string | null; benchmark: boolean }> => {
  if (!msg || msg.trim().length < 5) return { empresa: null, benchmark: false };
  
  if (/^(oi|olá|hey|bom dia|boa tarde|boa noite|obrigado|valeu|sim|não|ok|tchau)\b/i.test(msg.trim())) {
    return { empresa: null, benchmark: false };
  }

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID, // Usando Gemini 3 Flash para rapidez e qualidade
      contents: `TAREFA: Analise a frase e extraia:
1. O nome da empresa mencionada (se houver)
2. Se o usuário quer encontrar clientes SIMILARES/PARECIDOS (benchmark)

REGRAS:
- Retorne em formato: EMPRESA|BENCHMARK
- EMPRESA = nome limpo da empresa (sem LTDA, S/A, localizações) ou NONE.
- Se o usuário disser "Blitz do [Nome]", "Blitz da [Nome]", "Investigar [Nome]", o nome deve ser extraído.
- BENCHMARK = SIM ou NAO
- Sem explicação, sem aspas extras

EXEMPLOS:
"Investigar Grupo Scheffer" → Scheffer|NAO
"Blitz do Bom Futuro" → Bom Futuro|NAO
"tem algum cliente parecido com a equipe assistência médica?" → equipe assistencia medica|SIM
"clientes do setor de saúde similares ao hospital vida" → hospital vida|SIM
"bom dia, como vai?" → NONE|NAO
"estou vendendo wiipo pra eles" → NONE|NAO
"compara a operação deles com algum cliente nosso" → NONE|SIM

FRASE: "${msg}"`,
      config: {
        temperature: 0,
        maxOutputTokens: 50,
        responseMimeType: 'text/plain',
      }
    });

    let text = '';
    try { text = response.text || ''; } catch {}
    if (!text && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    }
    
    text = text.trim().replace(/^["'`]+|["'`]+$/g, '');

    const parts = text.split('|');
    const empresaRaw = (parts[0] || '').trim();
    const benchmarkRaw = (parts[1] || '').trim().toUpperCase();
    
    const empresa = (!empresaRaw || empresaRaw === 'NONE' || empresaRaw.length < 2 || empresaRaw.length > 100)
      ? null
      : empresaRaw.replace(/\s+(ltda|s\/a|sa|eireli|me|epp)\.?$/i, '').replace(/[.!?,;:]+$/, '').trim();
    
    const benchmark = benchmarkRaw === 'SIM';
    
    return { empresa, benchmark };

  } catch (err: any) {
    console.warn("[Scout360-EXTRACT] Flash falhou:", err.message);
    return { empresa: null, benchmark: false };
  }
};

/**
 * Gera keywords de setor para benchmark via Flash
 */
const generateBenchmarkKeywords = async (empresaNome: string, contexto: string): Promise<string[]> => {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID, // Usando Gemini 3 Flash
      contents: `Dado o nome desta empresa: "${empresaNome}" e contexto: "${contexto}".
Gere 5-8 palavras-chave que identificam o SETOR para buscar similares.
Retorne APENAS palavras separadas por vírgula. Sem acentos.`,
      config: {
        temperature: 0.1,
        maxOutputTokens: 80,
        responseMimeType: 'text/plain',
      }
    });

    let text = '';
    try { text = response.text || ''; } catch {}
    if (!text && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    }
    
    const keywords = text.trim().split(',').map(k => k.trim()).filter(k => k.length > 1);
    return keywords;

  } catch (err: any) {
    console.warn("[Scout360-BENCH] Falha ao gerar keywords:", err.message);
    return [];
  }
};

/**
 * GERA CURIOSIDADES DINÂMICAS PARA O LOADING (Smart Loading v2.0)
 * Prompt ENDURECIDO contra alucinações.
 */
export const generateLoadingCuriosities = async (context: string): Promise<string[]> => {
  const ai = getGenAI();
  const randomSeed = Date.now(); 
  
  const prompt = `
  Gere 4 curiosidades INÉDITAS, ESTRATÉGICAS e POUCO ÓBVIAS (máx 120 chars) sobre este tema.
  CONTEXTO DA PESQUISA: "${context}"
  SEED ALEATÓRIA: ${randomSeed}
  
  REGRAS DE FORMATAÇÃO E ESTILO:
  1. NÃO inicie todas as frases com "Você sabia?". VARIE os prefixos.
  2. Use prefixos como: "Fato:", "Insight:", "Dado:", "Contexto:", "Radar:", "Nota:".
  3. Seja direto e profissional.
  
  REGRAS CRÍTICAS DE SEGURANÇA (ZERO ALUCINAÇÃO):
  1. PROIBIDO citar "Case Senior" ou "Case GAtec" de empresas específicas (ex: Scheffer, Petrovina), a menos que seja um fato amplamente público (ex: Correios, Magazine Luiza).
  2. PROIBIDO INVENTAR MÉTRICAS. Nunca diga "Empresa X aumentou 30% a produtividade". Se não tiver o dado real, não invente.
  3. PROIBIDO usar nomes de empresas clientes no formato "Você sabia? A [Empresa] usa Senior".
  4. PREFIRA DADOS DE MERCADO: Use dados do IBGE, CONAB, USDA, Forbes Agro sobre o SETOR ou REGIÃO.
  5. EXEMPLO SEGURO: "Fato: O Mato Grosso exportou 40mi tons de soja em 2024 — Fonte: CONAB."
  6. Formato OBRIGATÓRIO: JSON Array de strings.
  `;

  try {
    const response = await ai.models.generateContent({
      model: FAST_MODEL_ID, // Usando Gemini 3 Flash
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const text = response.text || "[]";
    const curiosities = JSON.parse(text);
    
    if (Array.isArray(curiosities) && curiosities.length > 0) {
      // Retorna as frases diretamente, pois o prompt agora controla os prefixos
      return curiosities.map(c => String(c)); 
    }
    return [];
  } catch (e) {
    console.warn("Falha ao gerar curiosidades dinâmicas", e);
    return []; 
  }
};

/**
 * Helper: Gera sugestões de fallback via chamada lateral 
 */
const generateFallbackSuggestions = async (
    lastUserText: string, 
    botResponseText: string,
    isOperacao: boolean
): Promise<string[]> => {
    const ai = getGenAI();
    
    const contextPrompt = `
    CONTEXTO DA CONVERSA:
    Última pergunta do usuário: "${lastUserText}"
    Última resposta do Senior Scout 360: "${botResponseText.substring(0, 2000)}..." (truncado)

    TAREFA:
    Gere 3 sugestões de próximos passos CURTAS (max 10-15 palavras).
    Use verbos de ação. Sem perguntas.
    Exemplo:
    * Investigar a estrutura societária
    * Checar se o RH usa Senior
    `;

    try {
        const response = await ai.models.generateContent({
            model: BEST_MODEL_ID, // Mantém Pro para sugestões contextuais
            contents: contextPrompt,
            config: { temperature: 0.2 }
        });
        
        const text = response.text || "";
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('*') || line.startsWith('-'))
            .map(line => cleanSuggestionText(line.replace(/^[\*\-]\s*/, '').trim()))
            .filter(l => l.length > 0)
            .slice(0, 3);
            
    } catch (e) {
        return [];
    }
};

/**
 * Envia mensagem ao Gemini com Retry Automático
 * **AGORA ACEITA HISTÓRICO PARA MANTER CONTEXTO E CALLBACKS DE STREAMING**
 */
export const sendMessageToGemini = async (
  message: string, 
  history: Message[],
  systemInstruction: string, 
  options: GeminiRequestOptions = {}
): Promise<{ text: string; sources: Array<{title: string, url: string}>, suggestions: string[] }> => {
  
  const { 
    useGrounding = true, 
    thinkingMode = true, 
    signal,
    onText,
    onStatus
  } = options;

  // Wrapper function for the API call to be passed to auto-retry
  const apiCall = async () => {
    // CRÍTICO: Recria a sessão de chat com o histórico completo + system prompt atual
    const chatSession = createChatSession(systemInstruction, history, BEST_MODEL_ID, useGrounding, thinkingMode);

    if (signal?.aborted) {
      throw new Error("Request aborted by user");
    }

    // --- ENRICHMENT LAYER ---
    let messageToSend = message;
    let enrichments: string[] = [];
    
    // Extrai nome da empresa para enriquecer prompt
    const { empresa, benchmark } = await extractCompanyName(message);
    
    // 1. Lookup direto na base
    if (empresa) {
      try {
        const lookup = await lookupCliente(empresa);
        if (lookup.encontrado) {
          enrichments.push(formatarParaPrompt(lookup));
          console.log("[Scout360] Lookup:", empresa, "→ ENCONTRADO ✅");
        } else {
          enrichments.push(`\n\n---\n## 🔍 BASE INTERNA SENIOR\n**Status:** Empresa "${empresa}" NÃO encontrada na base de clientes Senior (Lookup realizado).\n**Implicação:** Trate como prospect NOVO.\n---\n`);
        }
      } catch (err) {
        console.warn("[Scout360] Lookup falhou:", err);
      }
    }
    
    // 2. Benchmark
    const shouldBenchmark = benchmark || 
      /(?:investigar?|analisar?|levantar?|dossie|dossiê|capivara|modo deus|investigacao completa)/i.test(message);
    
    if (shouldBenchmark && empresa) {
      try {
        const keywords = await generateBenchmarkKeywords(empresa, message);
        if (keywords.length > 0) {
          const bench = await benchmarkClientes(keywords);
          if (bench.ok && bench.results.length > 0) {
            enrichments.push(formatarBenchmarkParaPrompt(bench, empresa));
          }
        }
      } catch (err) {
        console.warn("[Scout360] Benchmark falhou:", err);
      }
    }
    
    // Injetar enrichments na mensagem
    if (enrichments.length > 0) {
      messageToSend = enrichments.join('\n') + `\n\n---\nMENSAGEM DO USUÁRIO: ${message}`;
    }

    // STREAMING CALL
    const result = await chatSession.sendMessageStream({ message: messageToSend });
    
    let rawAccumulator = '';
    let lastEmittedStatus = '';
    let groundingChunks: any[] = [];

    for await (const chunk of result) {
      if (signal?.aborted) break;

      const chunkText = chunk.text || "";
      if (!chunkText) continue;

      // Collect grounding metadata
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          groundingChunks = [...groundingChunks, ...chunk.candidates[0].groundingMetadata.groundingChunks];
      }

      // ACCUMULATE AND CLEAN
      rawAccumulator += chunkText;

      // Clean the entire accumulated text at every step.
      // This is less efficient than chunk-parsing but 100% robust against token splitting.
      const { cleanText, lastStatus } = cleanStatusMarkers(rawAccumulator);

      if (lastStatus && lastStatus !== lastEmittedStatus) {
        onStatus?.(lastStatus);
        lastEmittedStatus = lastStatus;
      }

      // Anti-flicker: if the clean text ends with a partial marker like "[[", 
      // do not emit that part yet to the UI.
      const displaySafeText = cleanText.replace(/\[\[?S?T?A?T?U?S?:?.*$/, '');
      
      onText?.(displaySafeText);
    }

    // Final clean pass to ensure everything is returned
    const finalClean = cleanStatusMarkers(rawAccumulator);

    // --- FIX SOURCES EXTRACTION ---
    // 1. Get structured sources from Gemini metadata
    let extractedSources: Array<{title: string, url: string}> = 
        groundingChunks
            .filter(c => c.web?.uri)
            .map(c => ({ title: getReadableTitle(c.web), url: c.web.uri }));

    // 2. Fallback: extract sources from text text if metadata missed them
    const textSources = extractSources(finalClean.cleanText);
    const existingUrls = new Set(extractedSources.map(s => s.url));
    
    textSources.forEach(s => {
        if (!existingUrls.has(s.url)) {
            extractedSources.push({ title: s.title || `Fonte ${s.id}`, url: s.url });
            existingUrls.add(s.url);
        }
    });

    // Return structured response matching legacy format for compatibility
    return {
        text: finalClean.cleanText,
        sources: extractedSources,
        suggestions: [], // Will extract later
    };
  };

  try {
    const responseData = await withAutoRetry('Gemini:sendMessageStream', apiCall, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000
    });
    
    if (signal?.aborted) throw new Error("Request aborted");

    // Extract sources if not populated correctly in stream loop (sometimes comes in final chunk metadata)
    const uniqueSources = responseData.sources.filter((value, index, self) =>
      index === self.findIndex((t) => (t.url === value.url))
    );

    // Extract Suggestions from final text
    let suggestions: string[] = [];
    let text = responseData.text;
    const suggestionHeaderRegex = /(?:---|___|\*\*\*)\s*[\r\n]+(?:\*\*|##|###)?\s*(?:🔎|⚡|🤠)?\s*(?:O que você quer descobrir agora|E aí, onde a gente joga o adubo agora|E aí, qual desses você quer cavucar|Próximos passos|Sugestões de perguntas)(?:.*?)[\r\n]+/i;
    const splitText = text.split(suggestionHeaderRegex);
    
    if (splitText.length > 1) {
      text = splitText[0].trim(); // Clean text for UI
      const suggestionsBlock = splitText[splitText.length - 1];
      const lines = suggestionsBlock.split('\n');
      suggestions = lines
        .map(line => line.trim())
        .filter(line => /^[\*\-•\+]\s/.test(line) || /^\d+\./.test(line))
        .map(line => {
            const clean = line
                .replace(/^[\*\-•\+\d\.]+\s*/, '')
                .replace(/^"|"$/g, '')
                .replace(/^'|'$/g, '')
                .replace(/\*+$/, '')
                .trim();
            return cleanSuggestionText(clean);
        })
        .filter(line => line.length > 0)
        .slice(0, 3);
    }

    // Fallback Suggestions
    if (suggestions.length === 0 && text.length > 150) {
        const isOperacao = systemInstruction.includes("Operação");
        suggestions = await generateFallbackSuggestions(message, text, isOperacao);
    }
    
    // Auto-save logic
    const { empresa } = await extractCompanyName(message);
    if (empresa && text) {
        try {
            const scoreMatch = text.match(/SCORE.*?(\d{1,3})\/100/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
            const scoreLabel = score >= 80 ? "QUENTE" : score >= 60 ? "MORNA" : score >= 40 ? "FRIA" : "BAIXA";
            const isCliente = text.includes("É cliente Senior:** ✅ SIM");
            const gapsMatch = text.match(/gap[s]?.*?:(.*?)(?:\n|$)/gi);
            const gaps: string[] = gapsMatch 
                ? (gapsMatch.flatMap(g => g.match(/GATec|ERP|HCM|Logística|Acesso|Plataforma/gi) || []) as string[])
                : [];

            addInvestigation({
                id: Date.now().toString(),
                empresa: empresa,
                score,
                scoreLabel,
                gaps: [...new Set(gaps)],
                familias: [],
                isCliente,
                modo: systemInstruction.includes("Operação") ? "Operação" : "Diretoria",
                data: new Date().toLocaleDateString("pt-BR"),
                resumo: text.substring(0, 200).replace(/[#*\n]/g, ' ').trim(),
            });
        } catch (e) { console.error("Auto-save failed", e); }
    }

    return { text, sources: uniqueSources, suggestions };

  } catch (error: any) {
    throw normalizeAppError(error, 'GEMINI');
  }
};

/**
 * Gera novas sugestões - Precisa do chat atual (não implementado full history aqui pois é secundário)
 * TODO: Se necessário, passar histórico aqui também.
 */
export const generateNewSuggestions = async (): Promise<string[]> => {
    // Esta função precisaria receber o histórico ou o chatSession recriado.
    // Como simplificação, retornamos vazio se chamado sem contexto.
    return ["Investigar concorrentes", "Verificar dados fiscais", "Mapear decisores"];
};

export const generateConsolidatedDossier = async (
  history: Message[], 
  systemInstruction: string, 
  mode: ChatMode, 
  reportType: ReportType = 'full'
): Promise<string> => {
  const ai = getGenAI();
  
  let conversationContext = "HISTÓRICO DA CONVERSA PARA ANÁLISE:\n\n";
  history.forEach(msg => {
    if (!msg.isError) {
      const role = msg.sender === Sender.User ? "USUÁRIO" : "SENIOR SCOUT 360";
      conversationContext += `${role}: ${msg.text}\n\n`;
    }
  });

  const toneInstruction = mode === 'operacao' 
    ? "TOM: Mantenha o estilo 'Operação' (direto, linguagem do campo, leve humor), mas EXTREMAMENTE ORGANIZADO na estrutura."
    : "TOM: Mantenha o estilo 'Diretoria' (profissional, consultivo, executivo).";

  let formatInstruction = "";
  if (reportType === 'executive') {
      formatInstruction = "FORMATO DE SAÍDA: RESUMO EXECUTIVO (1 PÁGINA)\n...";
  } else if (reportType === 'tech') {
      formatInstruction = "FORMATO DE SAÍDA: FICHA TÉCNICA DE DADOS\n...";
  } else {
      formatInstruction = "FORMATO DE SAÍDA: DOSSIÊ COMPLETO\n...";
  }

  const prompt = `
  ${conversationContext}
  ---
  COMANDO FINAL DE GERAÇÃO:
  ETAPA 1: CONCILIAÇÃO DE DADOS...
  ETAPA 2: GERAÇÃO DO RELATÓRIO...
  ${toneInstruction}
  ${formatInstruction}
  Diretrizes Finais: NÃO inclua o histórico. NÃO mostre raciocínio. Apenas Markdown final.
  `;

  const apiCall = async () => {
    const response = await ai.models.generateContent({
      model: BEST_MODEL_ID,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, 
        thinkingConfig: { thinkingBudget: 24576 },
      }
    });
    return response.text || "Não foi possível gerar o dossiê consolidado.";
  };

  try {
    return await withAutoRetry('Gemini:GenerateDossier', apiCall, { maxRetries: 3 });
  } catch (error) {
    throw normalizeAppError(error, 'GEMINI');
  }
};

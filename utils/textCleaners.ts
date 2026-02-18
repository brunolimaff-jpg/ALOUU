
import { isFakeUrl } from '../services/apiConfig';

/**
 * Remove formatação Markdown básica de uma string para exibição em texto puro.
 * Remove: Negrito, Itálico, Links, Code blocks inline.
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;

  return text
    // Remove Headers (## Titulo -> Titulo)
    .replace(/^#+\s+/gm, '')
    // Remove Negrito (**texto** ou __texto__)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    // Remove Itálico (*texto* ou _texto_)
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove Links ([texto](url) -> texto)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove Inline Code (`texto` -> texto)
    .replace(/`([^`]+)`/g, '$1')
    // Remove Blockquotes (> texto)
    .replace(/^>\s+/gm, '')
    // Remove espaços extras gerados
    .trim();
}

/**
 * Limpa títulos de sessão removendo asteriscos, hashtags e formatação markdown.
 */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return '';
  return title
    .replace(/\*\*/g, '') // Remove asteriscos duplos
    .replace(/\*/g, '')   // Remove asteriscos simples
    .replace(/^#+\s*/g, '') // Remove hashtags de header
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links mantendo texto
    .replace(/`/g, '') // Remove backticks
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
}

/**
 * Limpa e padroniza o texto das sugestões de follow-up (Chips).
 */
export function cleanSuggestionText(text: string): string {
  let cleaned = stripMarkdown(text);
  
  // Remove pontuação de pergunta ou dois pontos no final
  cleaned = cleaned.replace(/[?:.]+$/, '');
  
  // Lista de inícios de pergunta para remover (case insensitive)
  const startersToRemove = [
    /^quer\s+/i,
    /^você quer\s+/i,
    /^você gostaria de\s+/i,
    /^gostaria de\s+/i,
    /^podemos\s+/i,
    /^seria bom\s+/i,
    /^que tal\s+/i,
    /^vamos\s+/i,
    /^bora\s+/i,
    /^posso\s+/i,
    /^dá pra\s+/i
  ];
  
  for (const regex of startersToRemove) {
    cleaned = cleaned.replace(regex, '');
  }
  
  // Remove espaços extras
  cleaned = cleaned.trim();

  // Capitaliza a primeira letra
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
}

/**
 * Remove marcadores [[STATUS:...]] do texto e retorna o último status encontrado.
 * Usar em DOIS lugares:
 * 1. No processamento do stream (para atualizar o loading em tempo real)
 * 2. No MarkdownRenderer como fallback (para nunca exibir marcadores)
 */
export function cleanStatusMarkers(text: string): { cleanText: string; lastStatus: string | null } {
  let lastStatus: string | null = null;
  
  if (!text) return { cleanText: '', lastStatus: null };

  const cleanText = text.replace(
    /\[\[STATUS:(.*?)\]\]\n?/g, 
    (_, status) => {
      lastStatus = status.trim();
      return '';
    }
  );
  
  return { cleanText: cleanText.trim(), lastStatus };
}

export interface SourceRef {
  id: string;
  title: string;
  url: string;
}

export function extractSources(text: string): SourceRef[] {
  const sources: SourceRef[] = [];
  const seen = new Set<string>();
  
  if (!text) return sources;

  // 1. Markdown Footnotes: [^1]: https://url (Optional Title)
  const footnoteRegex = /\[\^(\d+)\]:\s*(https?:\/\/[^\s\n]+)(?:\s+(.*))?/g;
  let match;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const [_, id, url, title] = match;
    if (!isFakeUrl(url) && !seen.has(url)) {
      sources.push({ id, url, title: title?.trim() || `Fonte ${id}` });
      seen.add(url);
    }
  }

  // 2. Inline Links with citations: [1](https://url) or [①](https://url)
  const inlineRegex = /\[(?:\^?(\d+)|[①-⑨❶-❾])\]\((https?:\/\/[^)]+)\)/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const [_, idRaw, url] = match;
    const id = idRaw || (sources.length + 1).toString();
    if (!isFakeUrl(url) && !seen.has(url)) {
      sources.push({ id, url, title: `Fonte ${id}` });
      seen.add(url);
    }
  }

  // 3. Text based citations: [1] https://url or [①] https://url
  const textRegex = /\[\^?(\d+|[①-⑨❶-❾])\]\s*(https?:\/\/[^\s\n]+)/g;
  while ((match = textRegex.exec(text)) !== null) {
      const [_, id, url] = match;
      if (!isFakeUrl(url) && !seen.has(url)) {
          sources.push({ id, url, title: `Fonte ${id}` });
          seen.add(url);
      }
  }

  // 4. Capture ^1, ^2 citations style used by newer Gemini models
  // Matches " ^1" or ".^1" etc at end of sentence or standalone
  const caretRegex = /(?:^|\s|[.,;!?])\^(\d+)(?=$|\s|[.,;!?])/g;
  // This helps identify *that* sources exist, but linking them to a URL relies 
  // on a corresponding list at the bottom or metadata.
  // Since we rely on metadata mostly, we don't extract URL here, but we acknowledge the footnote exists.
  // However, often the model lists them at bottom like "^1 URL".
  const caretSourceListRegex = /^\^(\d+)\s+(https?:\/\/\S+)/gm; 
  while ((match = caretSourceListRegex.exec(text)) !== null) {
      const [_, id, url] = match;
      if (!isFakeUrl(url) && !seen.has(url)) {
          sources.push({ id, url, title: `Fonte ${id}` });
          seen.add(url);
      }
  }

  // 5. Numbered list at bottom (Legacy/Fallback)
  // e.g. 1. Google - https://google.com
  const lines = text.split('\n');
  let inSourcesBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect start of sources block
    if (/^(?:\*\*)?(?:Fontes?|Referências?|Sources?|Referencias)(?:\*\*)?:?$/i.test(trimmed)) {
      inSourcesBlock = true;
      continue;
    }

    if (inSourcesBlock) {
      // 1. Title - https://url
      const simpleUrlMatch = /^(\d+)\.\s+(?:.*?)(https?:\/\/\S+)/.exec(trimmed);
      if (simpleUrlMatch) {
        const [_, id, url] = simpleUrlMatch;
        if (!isFakeUrl(url) && !seen.has(url)) {
          sources.push({id, url, title: `Fonte ${id}`});
          seen.add(url);
        }
      }
    }
  }

  return sources;
}

export function removeSourcesBlock(text: string): string {
  // Remove tudo após "**Fontes:**" ou "Fontes:" ou "Referências:" até o fim
  // e também remove notas de rodapé estilo markdown
  return text
    .replace(/\n\*?\*?(?:Fontes?|Referências?|Sources?)\*?\*?:?\s*\n[\s\S]*$/i, '')
    .replace(/\n\[\^\d+\]:[\s\S]*$/i, '')
    .trim();
}

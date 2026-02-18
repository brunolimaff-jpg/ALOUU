
// utils/linkFixer.ts
// Intercepta e corrige links falsos gerados pelo Gemini

import { findSeniorProductUrl, isFakeUrl, FAKE_DOMAINS } from '../services/apiConfig';

/**
 * Corrige links no texto MARKDOWN (antes de renderizar)
 * Intercepta: [Texto](google.com/search?...), [Texto](aistudio.google.com/...), etc.
 */
export function fixFakeLinks(markdownText: string): string {
  if (!markdownText) return markdownText;

  // 1. Links markdown: [texto](url_fake) → **texto** (negrito, sem link)
  // Agora usando isFakeUrl que contém a lista completa de domínios proibidos
  let clean = markdownText.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
    (match, linkText, url) => {
      // Verificar se a URL é falsa
      if (isFakeUrl(url)) {
        // Tenta recuperar URL real senior se for produto
        const realUrl = findSeniorProductUrl(linkText);
        if (realUrl) {
          return `[${linkText}](${realUrl})`;
        }
        // Se não encontrou mapeamento → transformar em texto bold (sem link falso)
        return `**${linkText}**`;
      }
      return match; // URL real → manter
    }
  );

  // 2. URLs soltas no texto (https://ai.studio/...) → remover
  // Constroi regex baseado nos domínios falsos conhecidos para remover URLs raw
  const domainsRegexPart = FAKE_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|');
  const fakeStandaloneRegex = new RegExp(`https?:\\/\\/(?:www\\.)?(?:${domainsRegexPart})[^\\s)>]*`, 'gi');
  
  clean = clean.replace(fakeStandaloneRegex, '');

  return clean;
}

/**
 * Corrige links no HTML JÁ RENDERIZADO
 * Intercepta: <a href="google.com/search?...">Texto</a>, etc.
 */
export function fixFakeLinksHTML(html: string): string {
  if (!html) return html;

  return html.replace(
    /<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi,
    (match, url, linkText) => {
      if (!isFakeUrl(url)) return match; // URL real → manter

      const realUrl = findSeniorProductUrl(linkText);
      if (realUrl) {
        return `<a href="${realUrl}" target="_blank" rel="noopener noreferrer" style="color:#059669;text-decoration:none;border-bottom:1px dotted #059669;">${linkText}</a>`;
      }

      // Sem mapeamento → texto em bold (remove link falso)
      return `<strong style="color:#059669;">${linkText}</strong>`;
    }
  );
}

/**
 * Remove bloco de "Fontes" que contém apenas URLs fake do Gemini
 * Mantém fontes com URLs reais
 */
export function cleanFakeSourcesBlock(text: string): string {
  if (!text) return text;

  // Encontrar bloco de fontes
  const sourcesMatch = text.match(/(\n\*?\*?(?:Fontes?|Referências?|Sources?)[\s\S]*$)/i);
  if (!sourcesMatch) return text;

  const sourcesBlock = sourcesMatch[1];
  const lines = sourcesBlock.split('\n');
  const cleanedLines: string[] = [];
  let hasRealSources = false;

  for (const line of lines) {
    // Checar se a linha contém URL fake
    const urlMatch = line.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch && isFakeUrl(urlMatch[1])) {
      // Linha com URL fake → pular
      continue;
    }
    if (urlMatch && !isFakeUrl(urlMatch[1])) {
      hasRealSources = true;
    }
    cleanedLines.push(line);
  }

  // Se sobrou só o header "Fontes:" sem fontes reais → remover tudo
  const cleaned = cleanedLines.join('\n').trim();
  if (!hasRealSources || cleaned.replace(/\*?\*?(?:Fontes?|Referências?|Sources?)\*?\*?:?\s*/i, '').trim().length < 10) {
    // Remover bloco inteiro
    return text.replace(sourcesMatch[1], '').trim();
  }

  // Manter fontes reais
  return text.replace(sourcesMatch[1], '\n' + cleaned);
}

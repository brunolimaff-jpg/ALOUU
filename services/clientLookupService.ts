
// ============================================================================
// services/clientLookupService.ts
// Scout 360 — Lookup + Formatação (extração movida pro geminiService)
// ============================================================================

import { LOOKUP_URL } from "./apiConfig";

const LOOKUP_API_URL = LOOKUP_URL;

export interface ClienteResult {
  grupo: string;
  razoes_sociais: string[];
  linhas_produto: string[];
  familias_presentes: string[];
  modulos_por_familia: Record<string, string[]>;
  gaps_crosssell: string[];
  total_modulos: number;
  eh_cliente_senior: boolean;
  tem_gatec: boolean;
  tem_erp: boolean;
  tem_hcm: boolean;
  tem_logistica: boolean;
}

export interface LookupResponse {
  ok: boolean;
  query: string;
  encontrado: boolean;
  total: number;
  results: ClienteResult[];
  error?: string;
}

export async function lookupCliente(nomeEmpresa: string): Promise<LookupResponse> {
  console.log("[Scout360-LOOKUP] === INÍCIO ===");
  
  let nomeLimpo = nomeEmpresa
    .replace(/^(grupo|empresa|fazenda|usina|cia)\s+/i, '')
    .replace(/\s+(ltda|s\/a|sa|eireli|me|epp)\.?$/i, '')
    .replace(/[.,;:!?]+$/, '')
    .trim();
  
  console.log("[Scout360-LOOKUP] Query:", nomeLimpo);
  
  try {
    // Tentativa 1: nome completo
    let data = await fetchLookup(nomeLimpo);
    
    // Tentativa 2: primeira palavra (se >1 palavra e não achou)
    if (!data.encontrado && nomeLimpo.includes(' ')) {
      const p1 = nomeLimpo.split(/\s+/).filter(p => p.length > 2)[0];
      if (p1) {
        console.log("[Scout360-LOOKUP] Retry 1 (First Word):", p1);
        data = await fetchLookup(p1);
      }
    }

    // Tentativa 3: Palavra chave principal (mais longa > 3 chars)
    if (!data.encontrado) {
       const words = nomeLimpo.split(/\s+/).filter(w => w.length > 3);
       if (words.length > 0) {
           // Encontra a maior palavra que não seja "Agro" ou "Agricola" se possível, ou just largest
           const strongest = words.sort((a, b) => b.length - a.length)[0];
           
           // Se for diferente da query original e diferente da p1 já tentada
           const p1 = nomeLimpo.split(/\s+/).filter(p => p.length > 2)[0];
           if (strongest !== nomeLimpo && strongest !== p1) {
               console.log("[Scout360-LOOKUP] Retry 2 (Strongest Keyword):", strongest);
               data = await fetchLookup(strongest);
           }
       }
    }
    
    console.log("[Scout360-LOOKUP] Resultado Final:", data.encontrado ? "ENCONTRADO ✅" : "NÃO ENCONTRADO", "| Total:", data.total);
    return data;
  } catch (err: any) {
    console.error("[Scout360-LOOKUP] ERRO:", err.message);
    return { ok: false, query: nomeEmpresa, encontrado: false, total: 0, results: [], error: String(err) };
  }
}

async function fetchLookup(query: string): Promise<LookupResponse> {
  const url = `${LOOKUP_API_URL}?q=${encodeURIComponent(query)}`;
  console.log("[Scout360-LOOKUP] Fetch:", url);
  
  const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!resp.ok) return { ok: false, query, encontrado: false, total: 0, results: [], error: `HTTP ${resp.status}` };
  
  const text = await resp.text();
  console.log("[Scout360-LOOKUP] Response (150ch):", text.substring(0, 150));
  
  try { return JSON.parse(text); }
  catch { return { ok: false, query, encontrado: false, total: 0, results: [], error: "JSON parse error" }; }
}

export function formatarParaPrompt(lookup: LookupResponse): string {
  if (!lookup?.ok || !lookup.encontrado || !lookup.results?.length) {
    return `\n\n---\n## 🔍 BASE INTERNA SENIOR\n**Status:** Empresa "${lookup?.query || ''}" NÃO encontrada na base de clientes Senior.\n**Implicação:** Provável prospect novo (não é cliente atual).\n---\n`;
  }

  const r = lookup.results[0];
  console.log("[Scout360-FORMAT] Grupo:", r.grupo, "| Famílias:", r.familias_presentes);
  
  let md = `\n\n---\n## 🔍 BASE INTERNA SENIOR [🟢 CONFIRMADO — dados CRM interno Senior]\n`;
  md += `**Grupo Cliente:** ${r.grupo}\n`;
  md += `**É cliente Senior:** ✅ SIM — CONFIRMADO na base interna\n`;
  md += `**Total módulos contratados:** ${r.total_modulos}\n\n`;
  
  md += `### Soluções Senior contratadas:\n`;
  if (r.modulos_por_familia) {
    const icons: Record<string, string> = { "GATec": "🌾", "ERP": "💼", "HCM": "👥", "Logística": "🚛", "Acesso": "🔐", "Plataforma": "📚", "Hypnobox": "🏠" };
    for (const [fam, mods] of Object.entries(r.modulos_por_familia)) {
      if (fam === "Infra" || fam === "Outros") continue;
      md += `${icons[fam] || "📦"} **${fam}:** ${Array.isArray(mods) ? mods.join(", ") : mods}\n`;
    }
  }
  
  if (r.gaps_crosssell?.length) {
    md += `\n### ⚡ GAPS — Oportunidade de cross-sell:\n`;
    const dicas: Record<string, string> = {
      "GATec": "SEM gestão agrícola Senior — oportunidade QUENTE se for agro",
      "ERP": "SEM ERP Senior — possível consolidação",
      "HCM": "SEM gestão de pessoas Senior — verificar porte",
      "Logística": "SEM WMS/TMS Senior — verificar operação",
      "Acesso": "SEM Ronda/controle de acesso",
      "Plataforma": "SEM Konviva/Painel",
      "Hypnobox": "SEM CRM imobiliário"
    };
    for (const gap of r.gaps_crosssell) {
      md += `- **${gap}:** ${dicas[gap] || `Não possui ${gap}`}\n`;
    }
  } else {
    md += `\n### ✅ FULL STACK — cliente possui todas as famílias Senior\n`;
  }
  
  if (lookup.results.length > 1) {
    md += `\n### 🏢 Grupos relacionados:\n`;
    for (let i = 1; i < Math.min(lookup.results.length, 5); i++) {
      const o = lookup.results[i];
      md += `- **${o.grupo}** — ${o.familias_presentes.join(", ")} (${o.total_modulos} mód.)\n`;
    }
  }
  
  md += `\n**⚠️ INSTRUÇÃO CRÍTICA:** Estes dados são 🟢 CONFIRMADO (CRM interno). NÃO contradiga com vagas ou inferências. Os GAPS DEVEM guiar a FASE 8.\n---\n`;
  return md;
}

// ============================================================
// BENCHMARK — Busca clientes Senior similares por setor
// ============================================================

export interface BenchmarkResponse {
  ok: boolean;
  mode: string;
  keywords: string[];
  total: number;
  results: ClienteResult[];
  error?: string;
}

export async function benchmarkClientes(keywords: string[]): Promise<BenchmarkResponse> {
  console.log("[Scout360-BENCH] Keywords:", keywords);
  
  try {
    const kw = keywords.join(',');
    const url = `${LOOKUP_API_URL}?mode=benchmark&keywords=${encodeURIComponent(kw)}`;
    console.log("[Scout360-BENCH] Fetch:", url);
    
    const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!resp.ok) {
      return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: `HTTP ${resp.status}` };
    }
    
    const text = await resp.text();
    console.log("[Scout360-BENCH] Response (200ch):", text.substring(0, 200));
    
    try { return JSON.parse(text); }
    catch { return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: "JSON parse" }; }
  } catch (err: any) {
    console.error("[Scout360-BENCH] ERRO:", err.message);
    return { ok: false, mode: 'benchmark', keywords, total: 0, results: [], error: String(err) };
  }
}

export function formatarBenchmarkParaPrompt(bench: BenchmarkResponse, empresaAlvo: string): string {
  if (!bench?.ok || !bench.results?.length) {
    return `\n\n---\n## 🏭 BENCHMARK SENIOR\nNenhum cliente Senior encontrado com operação similar a "${empresaAlvo}". Keywords buscadas: ${bench?.keywords?.join(', ') || 'N/A'}\n---\n`;
  }

  let md = `\n\n---\n## 🏭 BENCHMARK SENIOR [🟢 CONFIRMADO — clientes reais da base CRM]\n`;
  md += `**Buscando similares a:** ${empresaAlvo}\n`;
  md += `**Keywords:** ${bench.keywords.join(', ')}\n`;
  md += `**Encontrados:** ${bench.total} clientes Senior com operação similar\n\n`;
  
  const top = bench.results.slice(0, 5);
  for (const r of top) {
    md += `### 📌 ${r.grupo}\n`;
    md += `- **Soluções:** ${r.familias_presentes.join(', ')}\n`;
    md += `- **Módulos:** ${r.total_modulos}\n`;
    if (r.modulos_por_familia) {
      const icons: Record<string, string> = { "GATec": "🌾", "ERP": "💼", "HCM": "👥", "Logística": "🚛", "Acesso": "🔐", "Plataforma": "📚" };
      for (const [fam, mods] of Object.entries(r.modulos_por_familia)) {
        if (fam === "Infra" || fam === "Outros") continue;
        md += `  - ${icons[fam] || "📦"} ${fam}: ${Array.isArray(mods) ? mods.join(', ') : mods}\n`;
      }
    }
    md += `\n`;
  }
  
  md += `**⚠️ INSTRUÇÃO:** Use estes clientes como REFERÊNCIA de cross-sell. Se um cliente similar tem ERP+HCM e o prospect só tem HCM, o ERP é oportunidade validada por benchmark real.\n---\n`;
  return md;
}

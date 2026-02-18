
import { ChatMode } from "../constants";

// ==========================================
// 1. TIPOS E ESTRUTURAS
// ==========================================

export type Pillar = 'GATEC' | 'ERP' | 'HCM' | 'INTEGRACAO' | 'CONCILIACAO' | 'GERAL';

interface InsightDatabase {
  diretoria: string[];
  operacao: string[];
}

// Rastreamento global de fatos mostrados para evitar repetição
const shownFacts = new Set<string>();

export function resetShownFacts() {
  shownFacts.clear();
}

/**
 * Remove prefixos comuns (Você sabia?, Fato:, etc) para deixar a frase limpa.
 */
export function cleanFactPrefix(fact: string): string {
  return fact
    .replace(/^(Você sabia\?|Dado:|Fato:|Insight:|Radar:|Nota:|Contexto:|Tendência:)\s*/i, '')
    .trim();
}

/**
 * Obtém o próximo fato de um pool, garantindo não-repetição até esgotar o pool.
 */
export function getNextFact(pool: string[]): string {
  // Filtra apenas os que ainda não foram mostrados
  const available = pool.filter(f => !shownFacts.has(f));
  
  // Se todos foram mostrados, limpa o histórico DESSES itens (ou global) para recomeçar
  // Para simplicidade e UX contínua, se esgotar, permitimos repetir qualquer um do pool atual
  if (available.length === 0) {
    const random = pool[Math.floor(Math.random() * pool.length)];
    return random; 
  }

  // Escolhe aleatório entre os disponíveis
  const fact = available[Math.floor(Math.random() * available.length)];
  shownFacts.add(fact);
  
  return fact;
}

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// ==========================================
// 2. BANCO DE FATOS INSTITUCIONAIS (LIMPO)
// ==========================================

const SENIOR_FACTS = [
  "A Senior Sistemas foi fundada em 1988 em Blumenau-SC e hoje atende mais de 13.000 grupos econômicos.",
  "A Senior é uma das maiores empresas de tecnologia para gestão do Brasil, com atuação em 6 setores econômicos.",
  "Em 2025, a Senior adquiriu a CIGAM Software por R$ 162,5 milhões, ampliando sua base de clientes no Sul.",
  "A Senior possui parceria com o BTG Pactual através da Senior Capital, oferecendo soluções financeiras integradas.",
  "O ERP Senior consolida múltiplos CNPJs de um grupo econômico em uma única visão contábil e fiscal.",
  "O módulo fiscal do ERP Senior é atualizado automaticamente para mudanças na legislação tributária brasileira.",
  "A Senior oferece integração nativa com SPED Fiscal, SPED Contábil, eSocial e EFD-Reinf.",
  "O ERP Senior suporta regimes especiais de apuração como diferimento de ICMS e crédito presumido — essenciais no agro.",
  "O HCM Senior gerencia contratos de safra com admissão e demissão em lote para trabalhadores temporários.",
  "O módulo de SST do HCM controla todas as NRs obrigatórias para operações rurais e industriais.",
  "O HCM Senior automatiza o envio do eSocial, reduzindo risco de multas trabalhistas por inconsistência.",
  "A gestão de turnos do HCM é projetada para operações 24/7 como frigoríficos, usinas e confinamentos.",
  "A Senior integra agro (GAtec) + corporativo (ERP) + pessoas (HCM) em uma plataforma única.",
  "O CEO da Senior é Carlênio Castelo Branco, e a sede fica na Rua São Paulo, 825 em Blumenau-SC.",
  "A Senior adquiriu a Mega Sistemas em 2018, unindo portfólios complementares de ERP.",
  "A Senior atende setores como Agronegócio, Atacado/Distribuição, Construção, Indústria, Logística e Serviços.",
  "A Senior Capital, joint venture com BTG Pactual, oferece antecipação de recebíveis integrada ao ERP.",
  "O Senior Flow é a plataforma de hiperautomação da Senior que integra BPM, assinatura digital, GED e integrador de sistemas em um único cockpit.",
  "O CONNECT do Senior Flow cria APIs REST e automações com agentes de IA, conectando sistemas heterogêneos sem desenvolvimento pesado.",
  "O Senior SIGN permite assinatura eletrônica e digital com certificado ICP-Brasil e reconhecimento facial.",
  "O Senior Flow atende mais de 1.500 empresas de médio e grande porte com suas ferramentas de automação.",
  "O BPM do Senior Flow automatiza fluxos de aprovação, compras e contratos com indicadores de desempenho em tempo real.",
  "O GED do Senior Flow organiza documentos com busca inteligente por IA — contratos, laudos e certificações encontrados em segundos.",
  "O Senior Flow é low-code: permite expandir automações para toda a empresa sem depender de equipe de desenvolvimento pesada."
].map(cleanFactPrefix);

const GATEC_FACTS = [
  "O SimpleFarm da GAtec permite gestão completa de talhões, planejamento de safra e rastreabilidade lote-a-lote.",
  "O Mapfy da GAtec oferece análise geoespacial com sobreposição de mapas de produtividade, aplicação e colheita.",
  "O GAtec Industrial gerencia o beneficiamento de algodão, café e grãos com controle de qualidade por lote.",
  "A integração balança-campo do GAtec elimina digitação manual no recebimento de grãos, reduzindo erros operacionais.",
  "O GAtec suporta agricultura de precisão com importação de mapas de taxa variável para plantio e aplicação.",
  "O módulo de rastreabilidade do GAtec atende exigências de certificações como RTRS, GlobalGAP e RainForest Alliance.",
  "O GAtec controla operações de algodoeira — entrada de algodão em caroço, beneficiamento, classificação HVI e expedição de pluma.",
  "O SimpleFarm permite o acompanhamento de custos por talhão, safra e cultura, com visão consolidada ou detalhada.",
  "O GAtec oferece gestão de contratos de compra e venda de commodities com rastreamento de fixações e entregas.",
  "O módulo de armazenagem do GAtec controla recebimento, secagem, limpeza, expedição e estoque de grãos em silos.",
  "O GAtec se integra nativamente ao ERP Senior, eliminando retrabalho entre a operação de campo e o financeiro/fiscal.",
  "O Mapfy permite cruzar dados de múltiplas safras para análise de tendência de produtividade por talhão.",
  "O GAtec gerencia o planejamento de insumos por talhão — sementes, fertilizantes e defensivos — com controle de estoque.",
  "A gestão de colheita do GAtec conecta dados da colhedora (monitor de rendimento) ao sistema em tempo real.",
  "O GAtec suporta operações multi-fazenda e multi-cultura em uma única instância, ideal para grandes grupos.",
  "O módulo de pesagem do GAtec integra balanças rodoviárias com emissão automática de ticket e romaneio.",
  "O GAtec oferece dashboards operacionais com indicadores de custo/ha, produtividade/ha e margem por cultura.",
  "O controle de abastecimento do GAtec rastreia consumo de diesel por máquina e por operação agrícola."
].map(cleanFactPrefix);

const FALLBACK_CURIOSITIES = [
  "O Mato Grosso responde por 17% do VBP do agro brasileiro — Fonte: IBGE",
  "A GAtec by Senior gerencia mais de 5 milhões de hectares no Brasil — Fonte: Senior",
  "O Brasil exportou mais de 100 milhões de toneladas de soja em 2024 — Fonte: CONAB",
  "A Senior adquiriu a Novasoft em 2021 para atender o mercado colombiano — Fonte: Senior",
  "O setor agropecuário brasileiro cresceu 15,1% em 2023 — Fonte: IBGE",
  "A safra brasileira de grãos deve atingir 298 milhões de toneladas — Fonte: CONAB",
  "A Senior adquiriu a CIGAM Software em 2025, ampliando sua força no Sul — Fonte: Senior",
  "O ERP Senior consolida contabilidade de múltiplos CNPJs automaticamente — Fonte: Senior",
  "O Senior Flow integra sistemas heterogêneos via APIs sem código complexo — Fonte: Senior",
  "O Senior SIGN valida assinaturas digitais com reconhecimento facial e ICP-Brasil — Fonte: Senior"
].map(cleanFactPrefix);

// ==========================================
// 3. BANCO DE STATUS E CURIOSIDADES
// ==========================================

// As mensagens de status técnico misturadas com curiosidades de fallback
export const INSIGHTS: Record<Pillar, InsightDatabase> = {
  GATEC: {
    diretoria: [
      "Consultando dados de rastreabilidade agrícola...",
      "Verificando certificações (RTRS, GlobalGAP)...",
      "Mapeando tecnologias de campo e maquinário...",
      "O agro brasileiro bateu recorde de exportação em 2024...",
      ...GATEC_FACTS
    ].map(cleanFactPrefix),
    operacao: [
      "Contando os alqueires da fazenda...",
      "Vendo se tem tecnologia ou só caderno de campo...",
      "Checando se o trator é novo ou tá no arame...",
      "Olhando a qualidade da semente...",
      "Vendo se eles usam mapa de produtividade ou só olhômetro..."
    ]
  },
  ERP: {
    diretoria: [
      "Consultando situação fiscal e tributária...",
      "Verificando compliance e obrigações acessórias...",
      "Cruzando dados de faturamento e porte...",
      ...SENIOR_FACTS.filter(f => f.includes('ERP') || f.includes('Senior'))
    ].map(cleanFactPrefix),
    operacao: [
      "Vendo se o Leão tá mordendo...",
      "Caçando nota fiscal perdida...",
      "Olhando se o sistema atual é gambiarra...",
      "Conferindo o caixa e os boletos...",
      "Checando se eles consolidam balanço no Excel (perigo)..."
    ]
  },
  HCM: {
    diretoria: [
      "Estimando quadro de colaboradores...",
      "Verificando passivos trabalhistas e sindicais...",
      "Analisando estrutura de RH e segurança...",
      ...SENIOR_FACTS.filter(f => f.includes('HCM') || f.includes('eSocial') || f.includes('RH'))
    ].map(cleanFactPrefix),
    operacao: [
      "Contando a peãozada...",
      "Vendo se tem processo no TRT...",
      "Olhando se o RH funciona ou é bagunça...",
      "Checando se pagam insalubridade...",
      "Vendo quem manda de verdade..."
    ]
  },
  INTEGRACAO: {
    diretoria: [
      "Verificando conectividade e infraestrutura...",
      "Analisando APIs e integrações bancárias...",
      "A Plataforma Senior X integra campo e escritório...",
      "Checando maturidade digital...",
      "Avaliando arquitetura de sistemas...",
      "O Senior Flow automatiza fluxos de aprovação com IA...",
      "O Senior CONNECT elimina silos de dados entre sistemas...",
      "Verificando assinatura digital de contratos com Senior SIGN...",
      "O Senior GED organiza milhões de documentos com busca cognitiva..."
    ].map(cleanFactPrefix),
    operacao: [
      "Vendo se os sistemas conversam ou brigam...",
      "Caçando planilha de Excel solta...",
      "Olhando se tem sinal de internet na sede...",
      "Vendo se a tecnologia é moderna ou a lenha...",
      "Testando a conexão...",
      "Vendo se eles ainda assinam papel na caneta..."
    ]
  },
  CONCILIACAO: {
    diretoria: [
      "Analisando logística e escoamento...",
      "Verificando frota e custos de transporte...",
      "Mapeando armazéns e silos...",
      "O Brasil é o maior exportador de soja do mundo...",
      "Cruzando rotas e fretes...",
      "A Senior possui WMS e TMS integrados ao ERP..."
    ].map(cleanFactPrefix),
    operacao: [
      "Olhando os caminhões no pátio...",
      "Vendo se a soja escoa ou empaca...",
      "Contando os silos cheios...",
      "Checando o preço do frete...",
      "Vendo pra onde vai a carga..."
    ]
  },
  GERAL: {
    diretoria: [
      ...FALLBACK_CURIOSITIES,
      "Gerando inteligência competitiva...",
      "Consolidando informações do grupo...",
      ...SENIOR_FACTS.slice(0, 8),
      ...GATEC_FACTS.slice(0, 3)
    ].map(cleanFactPrefix),
    operacao: [
      "Ligando o radar...",
      "Puxando a capivara completa...",
      "Sabia que o MT produz 17% do agro nacional?",
      "Aquecendo os motores...",
      "Buscando as 'capivaras' jurídicas e fiscais..."
    ]
  }
};

// ==========================================
// 4. LÓGICA DE SELEÇÃO
// ==========================================

function detectPillarFromStage(stage: string): Pillar {
  const s = stage.toLowerCase();
  
  if (s.match(/field|farm|crop|harvest|planting|machine|operational|campo|lavoura|safra|plantio|colheita/)) return 'GATEC';
  if (s.match(/fiscal|tax|accounting|finance|procurement|stock|inventory|contabil|financeiro|imposto|compra|estoque/)) return 'ERP';
  if (s.match(/hr|people|employee|workforce|payroll|rh|gente|folha|ponto|colaborador/)) return 'HCM';
  if (s.match(/integration|api|connect|platform|fintech|bank|integracao|plataforma|banco|flow|bpm|ged/)) return 'INTEGRACAO';
  if (s.match(/logistics|wms|tms|freight|delivery|supply|logistica|frete|transporte/)) return 'CONCILIACAO';
  
  return 'GERAL';
}

export function getInsightPool(mode: ChatMode, stage?: string): string[] {
  const pillar = stage ? detectPillarFromStage(stage) : 'GERAL';
  // Retorna os fatos limpos diretamente, sem adicionar prefixos aqui
  return INSIGHTS[pillar][mode];
}

export function getLongWaitMessages(mode: ChatMode): string[] {
  const messages = {
    diretoria: [
      "A análise está profunda. Buscando dados específicos no IBGE...",
      "Cruzando informações de filiais e grupo econômico...",
      "Verificando múltiplas fontes para garantir precisão...",
      "Estamos consultando bases de dados de compliance e risco..."
    ],
    operacao: [
      "Eita que o buraco é mais embaixo. Tô cavucando fundo aqui.",
      "A fazenda é grande, hein? Tô rodando os pastos tudo.",
      "O sistema tá pensando mais que filósofo. Mas vai sair coisa boa.",
      "Tô peneirando a informação pra não vir cascalho."
    ]
  };
  return messages[mode];
}

export function humanizeStage(stage: string): string {
    const map: Record<string, string> = {
        'search': 'Buscando Dados',
        'analysis': 'Analisando',
        'generation': 'Gerando Relatório',
        'consolidation': 'Consolidando',
        'init': 'Iniciando',
        'saving': 'Salvando'
    };
    
    const lowerStage = stage.toLowerCase();
    for (const key of Object.keys(map)) {
        if (lowerStage.includes(key)) return map[key];
    }

    return stage.charAt(0).toUpperCase() + stage.slice(1);
}

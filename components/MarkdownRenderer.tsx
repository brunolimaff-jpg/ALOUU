
import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { autoLinkSeniorTerms } from '../utils/seniorLinks';
import { rewriteMarkdownLinksToGoogle } from '../utils/markdownLinks';
import { cleanStatusMarkers, removeSourcesBlock } from '../utils/textCleaners';
import { fixFakeLinks, cleanFakeSourcesBlock } from '../utils/linkFixer';
import { isFakeUrl } from '../services/apiConfig';

interface MarkdownRendererProps {
  content: string;
  isDarkMode: boolean;
  groundingSources?: Array<{ title: string; url: string }>;
}

// --- Componente de Tooltip Inline Simplificado ---
interface FootnoteTooltipProps {
  number: string;
  sources: Array<{ title: string; url: string }>;
  isDarkMode: boolean;
}

const FootnoteTooltip: React.FC<FootnoteTooltipProps> = ({ number, sources }) => {
  const numIndex = parseInt(number, 10);
  const sourceIndex = isNaN(numIndex) ? -1 : numIndex - 1;
  const source = sources && sources[sourceIndex];

  // Estilo base do badge
  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    color: '#fff',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    fontSize: '10px',
    fontWeight: 600,
    textDecoration: 'none',
    verticalAlign: 'super',
    marginLeft: '2px',
    marginRight: '1px',
    lineHeight: 1,
    cursor: 'help' // Cursor help indica que tem tooltip mas talvez não clique
  };

  if (!source) {
    return <span style={{ ...badgeStyle, backgroundColor: '#9ca3af', cursor: 'default' }}>{number}</span>;
  }

  // Verifica se é URL fake (ai.studio, google search, etc)
  const isFake = !source.url || isFakeUrl(source.url);
  const title = source.title || `Fonte ${number}`;

  if (!isFake) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={title} // Tooltip nativo do navegador
        style={{ ...badgeStyle, cursor: 'pointer' }}
      >
        {number}
      </a>
    );
  }

  // Se URL é fake, renderiza span (não clicável)
  return (
    <span
      title={`${title} (Link indisponível)`}
      style={badgeStyle}
    >
      {number}
    </span>
  );
};

// --- Componente PORTA Score (Visual) ---
interface PortaScoreProps {
  score: number;
  p: number;
  o: number;
  r: number;
  t: number;
  a: number;
  isDarkMode: boolean;
}

const PortaScoreBadge: React.FC<PortaScoreProps> = ({ score, p, o, r, t, a, isDarkMode }) => {
  // Determinar faixa e cor
  const isAlta = score >= 71;
  const isMedia = score >= 41 && score < 71;
  
  const barColor = isAlta ? '#059669' : isMedia ? '#eab308' : '#ef4444';
  const barBg = isAlta ? 'rgba(5,150,105,0.15)' : isMedia ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  const label = isAlta ? 'Alta Compatibilidade' : isMedia ? 'Média Compatibilidade' : 'Baixa Compatibilidade';
  const emoji = isAlta ? '🟢' : isMedia ? '🟡' : '🔴';
  const percentage = Math.min(score, 100);

  const pillars = [
    { letter: 'P', value: p },
    { letter: 'O', value: o },
    { letter: 'R', value: r },
    { letter: 'T', value: t },
    { letter: 'A', value: a },
  ];

  return (
    <div style={{
      margin: '20px 0 12px',
      padding: '16px 20px',
      borderRadius: '12px',
      border: `1.5px solid ${barColor}40`,
      background: isDarkMode ? '#0f172a' : '#ffffff',
    }}>
      {/* Header: emoji + PORTA + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 700, 
            letterSpacing: '1.5px', 
            textTransform: 'uppercase' as const,
            color: isDarkMode ? '#94a3b8' : '#64748b'
          }}>
            PORTA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ 
            fontSize: '28px', 
            fontWeight: 800, 
            color: barColor,
            lineHeight: 1 
          }}>
            {score}
          </span>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: 600, 
            color: isDarkMode ? '#475569' : '#94a3b8' 
          }}>
            /100
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{
        width: '100%',
        height: '8px',
        borderRadius: '4px',
        background: barBg,
        marginBottom: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          borderRadius: '4px',
          background: barColor,
          transition: 'width 0.8s ease-out',
        }} />
      </div>

      {/* Label de compatibilidade */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 600, 
          color: barColor 
        }}>
          {emoji} {label}
        </span>
      </div>

      {/* Pilares individuais */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap' as const 
      }}>
        {pillars.map(({ letter, value }) => (
          <div key={letter} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '20px',
            background: isDarkMode ? '#1e293b' : '#f1f5f9',
            fontSize: '12px',
          }}>
            <span style={{ 
              fontWeight: 700, 
              color: '#059669',
              fontSize: '11px' 
            }}>
              {letter}
            </span>
            <span style={{ 
              fontWeight: 600, 
              color: isDarkMode ? '#e2e8f0' : '#334155' 
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Pré-processamento ---

function preprocessFootnotes(text: string): string {
  // Substitui:
  // [^N] e [N] -> <footnote data-num="N"></footnote>
  // ^N -> <footnote data-num="N"></footnote>
  return text
    .replace(/\[\^(\d+)\]/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\[(\d+)\](?!\()/g, '<footnote data-num="$1"></footnote>')
    .replace(/(?<!\[)\^(\d+)/g, '<footnote data-num="$1"></footnote>');
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isDarkMode, groundingSources }) => {
  // Define styles based on theme to ensure contrast
  const theme = {
    textNormal: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    textBold: isDarkMode ? 'text-white' : 'text-slate-900',
    h1: isDarkMode ? 'text-white' : 'text-slate-900',
    h2: isDarkMode ? 'text-emerald-500' : 'text-emerald-600',
    h3: isDarkMode ? 'text-emerald-400' : 'text-emerald-600',
    listMarker: isDarkMode ? 'marker:text-slate-500' : 'marker:text-slate-400',
    code: isDarkMode 
      ? 'bg-slate-800 text-emerald-300' 
      : 'bg-slate-100 text-emerald-700 border border-slate-200',
    tableBorder: isDarkMode ? 'border-slate-700' : 'border-slate-300',
    tableHeadBg: isDarkMode ? 'bg-slate-800' : 'bg-slate-100',
    tableHeadText: isDarkMode ? 'text-slate-400' : 'text-slate-600',
    tableRowBg: isDarkMode ? 'bg-slate-900' : 'bg-white',
    tableRowHover: isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50',
    tableText: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    hr: isDarkMode ? 'border-slate-700' : 'border-slate-200',
    citation: 'text-emerald-500 font-bold hover:text-emerald-400 no-underline',
    footnoteSection: isDarkMode ? 'border-slate-700/50 text-slate-400' : 'border-slate-200 text-slate-600',
  };

  // Process content pipeline
  const processedContent = useMemo(() => {
    // 0. Safety: Remove potential [[STATUS:...]] markers
    const cleaned = content.replace(/\[\[STATUS:.*?\]\]\n?/g, '');
    let text = cleanStatusMarkers(cleaned).cleanText;
    
    // 1. Clean fake sources block first (Google Search links etc)
    text = cleanFakeSourcesBlock(text);

    // 2. Fix fake links in Markdown (e.g. ai.studio.google)
    // This turns [Label](fake) into **Label**
    text = fixFakeLinks(text);

    // 3. Remove sources block (it will be shown in the UI panel)
    text = removeSourcesBlock(text);

    // 4. Fix double dashes to horizontal rule
    text = text.replace(/^--+$/gm, `<hr class="${theme.hr} my-8" />`);

    // 5. Rewrite existing links to Google Search if needed
    text = rewriteMarkdownLinksToGoogle(text);
    
    // 6. Auto-link terms
    text = autoLinkSeniorTerms(text);

    // 7. Explicit fix for **bold** markers that might have been messed up or escaped
    // Replace **text** with <strong>text</strong> to ensure proper rendering by rehype-raw
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 7.5. Convert [[PORTA:...]] to <porta-score> tags
    text = text.replace(
      /\[\[PORTA:(\d+):P(\d+):O(\d+):R(\d+):T(\d+):A(\d+)\]\]/g,
      '<porta-score data-score="$1" data-p="$2" data-o="$3" data-r="$4" data-t="$5" data-a="$6"></porta-score>'
    );

    // 8. Convert [^N], [N], ^N to <footnote> tags
    // Now explicitly catches bare carets e.g. "text ^1" which Gemini sometimes outputs
    text = preprocessFootnotes(text);

    return text;
  }, [content, theme.hr]);

  return (
    <div className={`markdown-body ${theme.textNormal} w-full max-w-full overflow-visible text-base md:text-lg text-justify`}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]} 
        rehypePlugins={[rehypeRaw]} 
        components={{
          // Mapeamento da tag customizada <porta-score>
          // @ts-ignore
          'porta-score': (props: any) => {
            const score = parseInt(props['data-score'] || props.node?.properties?.dataScore || '0', 10);
            const p = parseInt(props['data-p'] || props.node?.properties?.dataP || '0', 10);
            const o = parseInt(props['data-o'] || props.node?.properties?.dataO || '0', 10);
            const r = parseInt(props['data-r'] || props.node?.properties?.dataR || '0', 10);
            const t = parseInt(props['data-t'] || props.node?.properties?.dataT || '0', 10);
            const a = parseInt(props['data-a'] || props.node?.properties?.dataA || '0', 10);
            return (
              <PortaScoreBadge 
                score={score} p={p} o={o} r={r} t={t} a={a} 
                isDarkMode={isDarkMode} 
              />
            );
          },
          // Mapeamento da tag customizada <footnote>
          // @ts-ignore
          footnote: (props: any) => {
             const num = props['data-num'] || props.node?.properties?.dataNum || '?';
             return (
               <FootnoteTooltip 
                 number={num} 
                 sources={groundingSources || []} 
                 isDarkMode={isDarkMode} 
               />
             );
          },

          h1: ({node, ...props}) => <h1 className={`text-2xl md:text-3xl font-bold ${theme.h1} mt-10 mb-6 break-words tracking-tight text-left`} {...props} />,
          h2: ({node, ...props}) => <h2 className={`text-xl md:text-2xl font-bold ${theme.h2} mt-10 mb-5 border-b ${isDarkMode ? 'border-emerald-500/30' : 'border-emerald-500/20'} pb-3 break-words text-left`} {...props} />,
          h3: ({node, ...props}) => <h3 className={`text-lg md:text-xl font-bold ${theme.h3} mt-8 mb-3 break-words text-left`} {...props} />,
          h4: ({node, ...props}) => <h4 className={`text-base md:text-lg font-bold ${theme.h3} mt-6 mb-2 break-words text-left`} {...props} />,
          h5: ({node, ...props}) => <h5 className={`text-sm md:text-base font-bold ${theme.h3} mt-4 mb-2 break-words text-left`} {...props} />,
          h6: ({node, ...props}) => <h6 className={`text-sm md:text-base font-bold ${theme.h3} mt-4 mb-2 uppercase break-words text-left`} {...props} />,
          
          p: ({node, ...props}) => <p className={`mb-4 leading-relaxed break-words`} {...props} />,
          
          ul: ({node, ...props}) => <ul className={`list-disc pl-5 mb-5 space-y-2 ${theme.listMarker} text-left`} {...props} />,
          ol: ({node, ...props}) => <ol className={`list-decimal pl-5 mb-5 space-y-2 ${theme.listMarker} text-left`} {...props} />,
          li: ({node, ...props}) => <li className="pl-1 break-words my-1 leading-relaxed" {...props} />,
          
          hr: ({node, ...props}) => <hr className={`${theme.hr} my-8`} {...props} />,
          
          a: ({href, children, className, ...props}) => {
            // Se URL é fake (ai.studio, vertexai, google search), renderizar como texto bold
            if (!href || isFakeUrl(href)) {
              return (
                <strong className="text-emerald-500 font-semibold">
                  {children}
                </strong>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  text-[length:inherit] leading-[inherit] 
                  text-emerald-500 hover:text-emerald-400 
                  hover:underline decoration-emerald-500/50 
                  font-medium transition-colors inline-flex items-baseline gap-0.5
                `}
                {...props}
              >
                {children}
              </a>
            );
          },
          
          strong: ({node, ...props}) => <strong className={`${theme.textBold} font-bold`} {...props} />,
          
          code: ({node, ...props}) => {
             const isBlock = String(props.children).includes('\n');
             if (isBlock) {
                 return <pre className={`block p-4 rounded-lg overflow-x-auto my-4 text-sm ${theme.code} text-left`}><code {...props} /></pre>;
             }
             return <code className={`${theme.code} px-1.5 py-0.5 rounded text-[0.9em] font-mono break-all`} {...props} />;
          },
          
          table: ({node, ...props}) => (
            <div className={`overflow-x-auto mb-6 border ${theme.tableBorder} rounded-lg`}>
              <table className={`min-w-full text-sm text-left ${theme.tableText}`} {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className={`text-xs uppercase ${theme.tableHeadText} ${theme.tableHeadBg}`} {...props} />,
          tbody: ({node, ...props}) => <tbody {...props} />,
          tr: ({node, ...props}) => <tr className={`border-b ${theme.tableBorder} ${theme.tableRowHover} ${theme.tableRowBg} last:border-0`} {...props} />,
          th: ({node, ...props}) => <th className="px-4 py-3 font-semibold whitespace-nowrap" {...props} />,
          td: ({node, ...props}) => <td className="px-4 py-3 align-top" {...props} />,
          
          // Esconde a seção original de footnotes do remark-gfm se ela aparecer
          section: ({node, ...props}) => {
              if (props['data-footnotes']) {
                  return null; // Oculta footnotes padrão, pois usamos tooltips
              }
              return <section {...props} />;
          }
        }}
      >
        {processedContent}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer;

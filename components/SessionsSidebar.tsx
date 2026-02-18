
import React, { useState } from 'react';
import { ChatSession } from '../types';
import { cleanTitle } from '../utils/textCleaners';
import { APP_NAME } from '../constants';

interface SessionsSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void; // Para fechar em mobile ao selecionar
  isDarkMode: boolean;
}

const SessionsSidebar: React.FC<SessionsSidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onCloseMobile,
  isDarkMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Delete Confirmation Modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  // Lógica de limpeza de título
  const getDisplayName = (session: ChatSession): string => {
    // 1. Se tem empresaAlvo explícita, usa ela
    if (session.empresaAlvo) {
        return cleanTitle(session.empresaAlvo);
    }
    
    // 2. Tenta limpar o título removendo palavras comuns de comando
    const clean = session.title
        ?.replace(/^(investigar|analisar|pesquisar|dossiê\s*de\s*)/i, '')
        ?.replace(/de\s*cuiabá.*/i, '')
        ?.replace(/-\s*mt.*/i, '')
        ?.replace('Nova Investigação', 'Novo Plano de Voo')
        ?.trim();
        
    return cleanTitle(clean || "Sessão sem nome");
  };

  // Filtragem e Ordenação
  const filteredSessions = sessions
    .filter((session) => {
        const term = searchTerm.toLowerCase();
        const empresa = (session.empresaAlvo || '').toLowerCase();
        const cnpj = (session.cnpj || '').toLowerCase();
        const titulo = (session.title || '').toLowerCase();
        const display = getDisplayName(session).toLowerCase();
        
        return empresa.includes(term) || 
               cnpj.includes(term) || 
               titulo.includes(term) ||
               display.includes(term);
    })
    .sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const theme = {
    bg: isDarkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-slate-50 border-r border-slate-200',
    textPrimary: isDarkMode ? 'text-slate-200' : 'text-slate-700',
    textSecondary: isDarkMode ? 'text-slate-500' : 'text-slate-500',
    itemHover: isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200',
    itemActive: isDarkMode ? 'bg-slate-800 border-l-2 border-emerald-500' : 'bg-white border-l-2 border-emerald-500 shadow-sm',
    newChatBtn: isDarkMode 
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
      : 'bg-emerald-600 hover:bg-emerald-500 text-white',
    inputBg: isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      onDeleteSession(pendingDelete.id);
      setPendingDelete(null);
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop (só aparece no mobile quando aberto) */}
      <div 
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`border rounded-xl p-6 max-w-sm w-full shadow-2xl ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Excluir Plano de Voo
            </h3>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Você está prestes a excluir o Plano de Voo: <b>{pendingDelete.name}</b>.
              <br/><br/>
              Esta ação não pode ser desfeita.
              {pendingDelete.id === currentSessionId && (
                <span className="block mt-2 text-yellow-500 font-medium">Este é o Plano atual. Após excluir, outro Plano será aberto automaticamente.</span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setIsDeleteOpen(false); setPendingDelete(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={`
        /* Layout Base e Cores */
        fixed inset-y-0 left-0 z-30 h-full border-r flex flex-col
        ${theme.bg}
        transition-all duration-300 ease-in-out

        /* Mobile: Gaveta deslizante (Off-canvas) */
        w-72
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}

        /* Desktop: Fluxo relativo (Collapsible) */
        /* No desktop, removemos o translate e controlamos a largura */
        md:static md:translate-x-0
        ${isOpen ? 'md:w-72' : 'md:w-0 md:border-none md:overflow-hidden'}
      `}>
        
        {/* Container Interno com largura fixa para evitar que o conteúdo "esprema" durante a animação de largura no desktop */}
        <div className="w-72 flex flex-col h-full min-w-[18rem]">
            {/* Header da Sidebar */}
            <div className="p-4 flex-none space-y-3">
                <button
                onClick={() => {
                    onNewSession();
                    if (window.innerWidth < 768) onCloseMobile();
                }}
                className={`w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-md ${theme.newChatBtn}`}
                >
                <span>✨</span>
                <span>Novo Plano de Voo</span>
                </button>
                
                {/* Campo de Busca */}
                <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs opacity-50">🔍</span>
                    <input 
                    type="text" 
                    placeholder="Buscar empresa ou CNPJ..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors ${theme.inputBg}`}
                    />
                </div>
            </div>

            {/* Lista de Sessões */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-2 mt-2 ${theme.textSecondary}`}>
                Histórico ({filteredSessions.length})
                </div>
                
                {filteredSessions.length === 0 ? (
                <div className={`text-center py-8 px-4 text-xs ${theme.textSecondary}`}>
                    {searchTerm ? 'Nenhuma empresa encontrada.' : 'Nenhum Plano de Voo salvo.'}
                </div>
                ) : (
                <div className="space-y-1">
                    {filteredSessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    const date = new Date(session.updatedAt);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const displayName = getDisplayName(session);
                    
                    return (
                        <div
                        key={session.id}
                        className={`
                            group relative flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all
                            ${isActive ? theme.itemActive : theme.itemHover}
                        `}
                        onClick={() => {
                            onSelectSession(session.id);
                            if (window.innerWidth < 768) onCloseMobile();
                        }}
                        >
                        <div className={`flex-none text-lg opacity-80`}>
                            🏢
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                            <h3 className={`text-sm font-medium truncate ${isActive ? 'text-emerald-500' : theme.textPrimary}`}>
                            {displayName}
                            </h3>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className={`text-[10px] ${theme.textSecondary}`}>
                                {isToday 
                                ? date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                : date.toLocaleDateString([], {day: '2-digit', month: '2-digit'})}
                            </span>
                            {session.scoreOportunidade && (
                                <span className={`text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20`}>
                                Score: {session.scoreOportunidade}
                                </span>
                            )}
                            </div>
                        </div>

                        {/* Botão de Excluir */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ id: session.id, name: displayName });
                                setIsDeleteOpen(true);
                            }}
                            className={`
                            absolute right-2 top-1/2 transform -translate-y-1/2
                            p-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all shadow-sm z-10
                            opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto
                            md:pointer-events-none md:group-hover:pointer-events-auto
                            `}
                            title="Excluir Plano de Voo"
                        >
                            🗑️
                        </button>
                        </div>
                    );
                    })}
                </div>
                )}
            </div>

            {/* Footer da Sidebar */}
            <div className={`p-4 border-t flex-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <p className={`text-[10px] text-center ${theme.textSecondary}`}>
                {APP_NAME} · v4.3
                </p>
            </div>
        </div>
      </aside>
    </>
  );
};

export default SessionsSidebar;

import { useState, useMemo, useEffect } from "react";

// Tipagem
export interface Investigation {
  id: string;
  empresa: string;
  score: number;
  scoreLabel: string;
  gaps: string[];
  familias: string[];
  isCliente: boolean;
  modo: string;
  data: string;
  resumo: string;
}

const STORAGE_KEY = 'scout360_investigations';

// Helper para carregar do localStorage
function loadInvestigations(): Investigation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper para salvar no localStorage
function saveInvestigations(invs: Investigation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invs));
  } catch (e) {
    console.error('Erro ao salvar investigações:', e);
  }
}

// Inicializa store com dados persistidos
let investigationsStore: Investigation[] = loadInvestigations();

// Função pública para outros componentes adicionarem investigações
export function addInvestigation(inv: Investigation) {
  // Evita duplicatas por empresa (atualiza se já existe)
  const idx = investigationsStore.findIndex(i => 
    i.empresa.toUpperCase() === inv.empresa.toUpperCase()
  );
  
  if (idx >= 0) {
    // Mantém o ID original se atualizar
    investigationsStore[idx] = { ...inv, id: investigationsStore[idx].id };
  } else {
    // Adiciona no topo
    investigationsStore = [inv, ...investigationsStore];
  }
  
  // Persiste
  saveInvestigations(investigationsStore);
}

export function getInvestigations(): Investigation[] {
  return [...investigationsStore];
}

// Componente Dashboard
export default function InvestigationDashboard({ 
  onClose, 
  onSelectEmpresa 
}: { 
  onClose: () => void; 
  onSelectEmpresa: (nome: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"data" | "score">("data");
  
  // Estado local sincronizado com store
  const [items, setItems] = useState<Investigation[]>([]);

  useEffect(() => {
    setItems(getInvestigations());
  }, []);

  const investigations = useMemo(() => {
    let filtered = [...items];
    if (filter) {
      const f = filter.toUpperCase();
      filtered = filtered.filter(i => i.empresa.toUpperCase().includes(f));
    }
    if (sortBy === "score") {
      filtered.sort((a, b) => b.score - a.score);
    }
    return filtered;
  }, [filter, sortBy, items]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      quentes: items.filter(i => i.score >= 80).length,
      mornas: items.filter(i => i.score >= 60 && i.score < 80).length,
      frias: items.filter(i => i.score < 60).length,
      clientes: items.filter(i => i.isCliente).length,
    };
  }, [items]);

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-green-400";
    if (s >= 60) return "text-yellow-400";
    if (s >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📊</span> Histórico de Investigações
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-colors">&times;</button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
            <div className="bg-gray-800 rounded-lg p-2 text-center border border-gray-700">
              <div className="text-white font-bold text-lg">{stats.total}</div>
              <div className="text-gray-400">Total</div>
            </div>
            <div className="bg-green-900/20 border border-green-900 rounded-lg p-2 text-center">
              <div className="text-green-400 font-bold text-lg">{stats.quentes}</div>
              <div className="text-gray-400">Quentes</div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900 rounded-lg p-2 text-center">
              <div className="text-yellow-400 font-bold text-lg">{stats.mornas}</div>
              <div className="text-gray-400">Mornas</div>
            </div>
            <div className="bg-red-900/20 border border-red-900 rounded-lg p-2 text-center">
              <div className="text-orange-400 font-bold text-lg">{stats.frias}</div>
              <div className="text-gray-400">Frias</div>
            </div>
            <div className="bg-blue-900/20 border border-blue-900 rounded-lg p-2 text-center">
              <div className="text-blue-400 font-bold text-lg">{stats.clientes}</div>
              <div className="text-gray-400">Clientes</div>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar empresa..." 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-white placeholder-gray-500 transition-all" 
            />
            <button 
              onClick={() => setSortBy(sortBy === "data" ? "score" : "data")}
              className={`border border-gray-700 rounded-lg px-3 py-2 text-sm transition-colors text-white flex items-center gap-2 ${sortBy === "data" ? "bg-gray-800 hover:bg-gray-700" : "bg-green-900/30 border-green-700 text-green-100"}`}
            >
              {sortBy === "data" ? "📅 Recentes" : "🎯 Por Score"}
            </button>
          </div>
        </div>
        
        {/* Lista */}
        <div className="overflow-auto flex-1 p-4 space-y-2 custom-scrollbar bg-gray-900">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 opacity-60">
              <span className="text-4xl mb-2">🕵️</span>
              <p>Nenhuma investigação salva.</p>
              <p className="text-xs">Pesquise uma empresa para começar.</p>
            </div>
          )}
          {investigations.map(inv => (
            <div 
              key={inv.id}
              onClick={() => { onSelectEmpresa(inv.empresa); onClose(); }}
              className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 hover:border-green-500/50 hover:bg-gray-800 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-xl font-bold w-10 text-center ${scoreColor(inv.score)}`}>
                    {inv.score}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors">{inv.empresa}</h3>
                    <p className="text-gray-500 text-xs flex items-center gap-2">
                      <span>{inv.data}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span>{inv.modo}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span className={inv.isCliente ? "text-blue-400" : "text-gray-400"}>
                        {inv.isCliente ? "✅ Cliente" : "🆕 Prospect"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {inv.familias.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1 mb-1">
                      {inv.familias.slice(0, 3).map(f => (
                        <span key={f} className="text-[10px] bg-gray-700 rounded px-1.5 py-0.5 text-gray-300">{f}</span>
                      ))}
                      {inv.familias.length > 3 && (
                        <span className="text-[10px] bg-gray-700 rounded px-1.5 py-0.5 text-gray-300">+{inv.familias.length - 3}</span>
                      )}
                    </div>
                  )}
                  {inv.gaps.length > 0 ? (
                    <div className="text-yellow-500 text-[10px] font-medium bg-yellow-900/10 px-1.5 py-0.5 rounded border border-yellow-900/30 inline-block">
                      {inv.gaps.length} GAPS
                    </div>
                  ) : (
                    <div className="text-gray-600 text-[10px]">-</div>
                  )}
                </div>
              </div>
              {inv.resumo && (
                <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed border-t border-gray-700/50 pt-2">
                  {inv.resumo}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
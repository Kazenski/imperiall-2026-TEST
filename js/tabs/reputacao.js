import { db, doc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

const COLET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos

// 1. Controle das Abas e Seleção
window.switchRepTab = function(tabName) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null };
    globalState.repUI.tab = tabName;
    globalState.repUI.selectedId = null; 
    window.renderReputacaoTab();
};

window.selectRepItem = function(tab, id) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null };
    globalState.repUI.selectedId = id;
    window.renderReputacaoTab();
};

// 2. Renderizador Principal
export function renderReputacaoTab() {
    // CORREÇÃO: O ID correto gerado pelo main.js é 'recursos-reputacao-content'
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

    try {
        const charData = globalState.selectedCharacterData;
        if (!charData) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null };
        const activeTab = globalState.repUI.tab;
        
        const ficha = charData.ficha;
        const repUsage = calculateReputationUsage(ficha);
        const repDetails = calculateReputationDetails(ficha);

        // INJEÇÃO DO ESQUELETO DE 2 COLUNAS
        if (!document.getElementById('rep-layout-wrapper')) {
            container.innerHTML = `
                <div id="rep-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                    
                    <div class="flex-1 flex flex-col min-w-0 h-full">
                        
                        <div class="bg-slate-900/80 p-5 rounded-xl border border-slate-700 mb-4 shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4 shrink-0">
                            <div class="flex items-center gap-4 w-full xl:w-auto">
                                <div class="w-14 h-14 rounded-full bg-slate-950 border-2 border-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0">
                                    <i class="fas fa-chess-rook text-2xl text-amber-500"></i>
                                </div>
                                <div class="min-w-0">
                                    <h2 class="text-2xl font-cinzel text-amber-400 font-bold leading-none mb-1 truncate">Império & Influência</h2>
                                    <div class="text-[9px] text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-1">
                                        <span title="Nível + Profissões"><i class="fas fa-arrow-up text-emerald-400"></i> ${repDetails.level} + ${repDetails.profissoes}</span>
                                        <span title="Enciclopédia"><i class="fas fa-book text-sky-400"></i> ${repUsage.colecao}</span>
                                        ${repDetails.gmBonus ? `<span title="Bônus GM"><i class="fas fa-gift text-purple-400"></i> ${repDetails.gmBonus}</span>` : ''}
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-3 w-full xl:w-auto shrink-0">
                                <div class="bg-slate-950 px-4 py-2 rounded-lg border border-slate-700 flex-1 text-center xl:w-28">
                                    <div class="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Total</div>
                                    <div class="text-xl font-cinzel text-amber-400 leading-none">${repUsage.total}</div>
                                </div>
                                <div class="bg-slate-950 px-4 py-2 rounded-lg border border-slate-700 flex-1 text-center xl:w-28 shadow-inner">
                                    <div class="text-[9px] uppercase font-bold text-slate-500 mb-0.5">Disponível</div>
                                    <div id="rep-available-display" class="text-xl font-cinzel ${repUsage.available >= 0 ? 'text-emerald-400' : 'text-red-400'} leading-none">${repUsage.available}</div>
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2 mb-4 shrink-0" id="rep-nav-tabs">
                            </div>

                        <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                            <div id="rep-grid-container" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start"></div>
                        </div>
                    </div>

                    <div class="w-80 md:w-96 shrink-0 flex flex-col h-full pt-16">
                        <div id="rep-inspect-panel" class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden">
                            </div>
                    </div>

                </div>
                
                <div id="building-modal-area"></div>
            `;
        } else {
            const availEl = document.getElementById('rep-available-display');
            if (availEl) {
                availEl.textContent = repUsage.available;
                availEl.className = `text-xl font-cinzel ${repUsage.available >= 0 ? 'text-emerald-400' : 'text-red-400'} leading-none`;
            }
        }

        // Atualiza botões
        const navTabs = document.getElementById('rep-nav-tabs');
        if (navTabs) {
            navTabs.innerHTML = `
                <button onclick="window.switchRepTab('buildings')" class="px-5 py-2.5 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'buildings' ? 'bg-amber-600 text-black font-bold border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}">
                    <i class="fas fa-store mr-1"></i> Estabelecimentos
                </button>
                <button onclick="window.switchRepTab('allies')" class="px-5 py-2.5 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === 'allies' ? 'bg-sky-600 text-white font-bold border-sky-500 shadow-[0_0_10px_rgba(2,132,199,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}">
                    <i class="fas fa-users mr-1"></i> Aliados
                </button>
            `;
        }

        renderRepGrid(ficha);
        renderRepRightPanel(ficha, repUsage);

    } catch (error) {
        console.error("Erro na aba de Reputação:", error);
        container.innerHTML = `<div class="p-6 text-red-500 bg-red-900/20 border border-red-500/50 rounded-xl m-6 shadow-inner"><h3 class="font-bold uppercase"><i class="fas fa-exclamation-triangle"></i> Erro Crítico</h3><p class="font-mono text-xs">${error.message}</p></div>`;
    }
}

// 3. Renderiza o Grid de Itens
function renderRepGrid(ficha) {
    const grid = document.getElementById('rep-grid-container');
    if (!grid) return;
    grid.innerHTML = '';

    const activeTab = globalState.repUI.tab;
    const selectedId = globalState.repUI.selectedId;

    if (activeTab === 'buildings') {
        const cache = globalState.cache.buildings;
        const myBuildings = ficha.recursos?.estabelecimentos || [];
        const myIds = new Set(myBuildings.map(b => b.templateId));

        if (cache.size === 0) {
            grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-10 italic">Nenhum estabelecimento cadastrado no mundo.</div>';
            return;
        }

        // Ordena: Seus prédios primeiro, os à venda depois (ordem alfabética)
        const sorted = [...cache.entries()].sort((a, b) => {
            const aOwn = myIds.has(a[0]) ? -1 : 1;
            const bOwn = myIds.has(b[0]) ? -1 : 1;
            if (aOwn !== bOwn) return aOwn - bOwn;
            return a[1].nome.localeCompare(b[1].nome);
        });

        sorted.forEach(([id, tpl]) => {
            const isOwned = myIds.has(id);
            const isSelected = selectedId === id;
            const bData = isOwned ? myBuildings.find(b => b.templateId === id) : null;
            
            let borderClass = isOwned ? 'border-amber-500 opacity-100 grayscale-0' : 'border-slate-700 opacity-50 grayscale hover:opacity-90 hover:grayscale-0';
            if (isSelected) borderClass = 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] opacity-100 grayscale-0';

            let badge = isOwned 
                ? `<div class="absolute top-1 right-1 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10"><i class="fas fa-key"></i></div>`
                : `<div class="absolute top-1 right-1 bg-slate-900 text-slate-400 text-[9px] font-mono border border-slate-700 px-1.5 py-0.5 rounded shadow z-10">${tpl.reputacaoCusto || 0} REP</div>`;

            let readyPing = '';
            if (isOwned && bData) {
                const canCollect = (Date.now() - (bData.lastCollect || 0)) >= COLET_COOLDOWN_MS;
                if (canCollect) readyPing = '<div class="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 rounded-full border border-black z-20 animate-pulse shadow-[0_0_10px_#10b981]" title="Pronto para Coleta!"></div>';
            }

            const el = document.createElement('div');
            el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
            el.onclick = () => window.selectRepItem('buildings', id);
            
            el.innerHTML = `
                <div class="w-full aspect-square bg-slate-950 rounded-xl border-2 ${borderClass} overflow-hidden relative transition-all">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-1 px-1 text-center flex flex-col items-center">
                        <span class="text-[9px] font-bold ${isOwned ? 'text-amber-400' : 'text-slate-300'} uppercase tracking-widest truncate w-full px-1">${tpl.nome}</span>
                    </div>
                    ${badge}
                    ${readyPing}
                </div>
            `;
            grid.appendChild(el);
        });
    } 
    else if (activeTab === 'allies') {
        const cache = globalState.cache.allies;
        const myAllies = ficha.recursos?.aliados || [];
        const myIds = new Set(myAllies.map(a => a.templateId));

        if (cache.size === 0) {
            grid.innerHTML = '<div class="col-span-full text-slate-500 text-center py-10 italic">Nenhum aliado cadastrado no mundo.</div>';
            return;
        }

        const sorted = [...cache.entries()].sort((a, b) => {
            const aOwn = myIds.has(a[0]) ? -1 : 1;
            const bOwn = myIds.has(b[0]) ? -1 : 1;
            if (aOwn !== bOwn) return aOwn - bOwn;
            return a[1].nome.localeCompare(b[1].nome);
        });

        sorted.forEach(([id, tpl]) => {
            const isOwned = myIds.has(id);
            const isSelected = selectedId === id;
            
            let borderClass = isOwned ? 'border-sky-500 opacity-100 grayscale-0' : 'border-slate-700 opacity-50 grayscale hover:opacity-90 hover:grayscale-0';
            if (isSelected) borderClass = 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] opacity-100 grayscale-0';

            let badge = isOwned 
                ? `<div class="absolute top-1 right-1 bg-sky-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow z-10"><i class="fas fa-handshake"></i></div>`
                : `<div class="absolute top-1 right-1 bg-slate-900 text-slate-400 text-[9px] font-mono border border-slate-700 px-1.5 py-0.5 rounded shadow z-10">${tpl.reputacaoCustoBase || 0} REP</div>`;

            const el = document.createElement('div');
            el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
            el.onclick = () => window.selectRepItem('allies', id);
            
            el.innerHTML = `
                <div class="w-full aspect-square bg-slate-950 rounded-full border-2 ${borderClass} overflow-hidden relative transition-all">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-2 px-1 text-center flex flex-col items-center">
                        <span class="text-[8.5px] font-bold ${isOwned ? 'text-sky-400' : 'text-slate-300'} uppercase tracking-widest truncate w-full px-2">${tpl.nome}</span>
                    </div>
                    ${badge}
                </div>
            `;
            grid.appendChild(el);
        });
    }
}

// 4. Renderiza Painel Inspetor da Direita
function renderRepRightPanel(ficha, repUsage) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const activeTab = globalState.repUI.tab;
    const selectedId = globalState.repUI.selectedId;

    if (!selectedId) {
        panel.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                <i class="fas fa-search-location text-6xl mb-4"></i>
                <p class="text-sm text-center px-6">Selecione uma propriedade ou aliado na lista para inspecionar.</p>
            </div>
        `;
        return;
    }

    if (activeTab === 'buildings') {
        const tpl = globalState.cache.buildings.get(selectedId);
        if (!tpl) return;

        const myBuildings = ficha.recursos?.estabelecimentos || [];
        const bData = myBuildings.find(b => b.templateId === selectedId);
        const isOwned = !!bData;
        
        let statusHtml = '';
        let actionHtml = '';

        // Preview da Produção
        let prodHtml = '';
        if (tpl.producao && tpl.producao.length > 0) {
            prodHtml = `<div class="mb-4"><h4 class="text-[10px] text-slate-500 uppercase tracking-widest font-bold border-b border-slate-700 pb-1 mb-2"><i class="fas fa-box-open mr-1"></i> Produção Estimada</h4><div class="grid grid-cols-2 gap-2">`;
            tpl.producao.forEach(prod => {
                const item = globalState.cache.itens.get(prod.itemId);
                prodHtml += `
                    <div class="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1.5 rounded">
                        <img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 rounded bg-black object-cover border border-slate-800 shrink-0">
                        <div class="text-[9px] text-slate-300 truncate font-bold leading-tight w-full">${item?.nome || '???'} <br><span class="text-emerald-400 font-mono">x${prod.quantidadeBase || 1}</span></div>
                    </div>
                `;
            });
            prodHtml += `</div></div>`;
        } else {
            prodHtml = `<p class="text-[10px] italic text-slate-500 mb-4 border-l-2 border-slate-600 pl-2">Este local não produz itens periodicamente.</p>`;
        }

        if (isOwned) {
            const now = Date.now();
            const timeDiff = now - (bData.lastCollect || 0);
            const canCollect = timeDiff >= COLET_COOLDOWN_MS;
            const remainingMin = Math.max(0, Math.ceil((COLET_COOLDOWN_MS - timeDiff) / 60000));
            
            const storageItems = Object.keys(bData.armazem || {});
            const hasItems = storageItems.length > 0;

            statusHtml = `<span class="bg-amber-900/50 text-amber-400 border border-amber-500/50 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest mt-2 shadow-inner"><i class="fas fa-key mr-1"></i> Sua Propriedade</span>`;

            actionHtml = `
                <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] flex flex-col gap-2">
                    ${canCollect 
                        ? `<button onclick="window.collectBuilding('${selectedId}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest text-[11px] py-3 rounded shadow-md transition-transform hover:scale-[1.02] animate-pulse"><i class="fas fa-coins mr-2 text-sm"></i> Coletar Produção</button>`
                        : `<button class="w-full bg-slate-800 text-slate-500 border border-slate-700 font-bold uppercase tracking-widest text-[10px] py-3 rounded cursor-not-allowed"><i class="fas fa-hourglass-half mr-2"></i> Coleta em ${remainingMin}m</button>`
                    }
                    <div class="flex gap-2">
                        <button onclick="window.openBuildingStorage('${selectedId}')" class="flex-1 ${hasItems ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700'} font-bold uppercase text-[10px] py-2.5 rounded transition">
                            <i class="fas fa-warehouse mr-1"></i> Armazém ${hasItems ? '<span class="text-white font-mono ml-1">(!)</span>' : ''}
                        </button>
                        <button onclick="window.sellBuilding('${selectedId}')" class="flex-1 bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 font-bold uppercase text-[10px] py-2.5 rounded transition">
                            <i class="fas fa-store-slash mr-1"></i> Vender
                        </button>
                    </div>
                </div>
            `;
        } else {
            const cost = tpl.reputacaoCusto || 0;
            const canAfford = repUsage.available >= cost;
            
            statusHtml = `<span class="bg-slate-900 text-slate-400 border border-slate-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest mt-2 shadow-inner"><i class="fas fa-tag mr-1"></i> À Venda</span>`;
            
            actionHtml = `
                <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                    <div class="flex justify-between items-center mb-3 px-2">
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Preço:</span>
                        <span class="text-lg font-cinzel font-bold ${canAfford ? 'text-amber-400' : 'text-red-400'}">${cost} REP</span>
                    </div>
                    <button onclick="window.buyBuilding('${selectedId}', ${cost})" class="w-full ${canAfford ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-bold uppercase tracking-widest text-[11px] py-3.5 rounded transition-transform ${canAfford ? 'hover:scale-[1.02]' : ''}" ${!canAfford ? 'disabled' : ''}>
                        <i class="fas fa-file-signature mr-2 text-sm"></i> Adquirir Propriedade
                    </button>
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="flex flex-col h-full animate-fade-in">
                <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                    <div class="w-32 h-32 rounded-xl bg-black border-2 ${isOwned ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-slate-600'} overflow-hidden mb-3 relative">
                        <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                    </div>
                    <h3 class="font-cinzel text-2xl ${isOwned ? 'text-amber-400' : 'text-slate-300'} text-center leading-tight mb-1 drop-shadow-md px-2">${tpl.nome}</h3>
                    ${statusHtml}
                </div>
                <div class="flex-1 overflow-y-auto custom-scroll p-5 bg-slate-900/20">
                    <h4 class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 border-b border-slate-700 pb-1"><i class="fas fa-info-circle mr-1"></i> Detalhes</h4>
                    <p class="text-[11px] text-slate-300 leading-relaxed mb-5 italic border-l-2 border-slate-700 pl-3">${escapeHTML(tpl.descricao)}</p>
                    ${prodHtml}
                </div>
                ${actionHtml}
            </div>
        `;
    } 
    else if (activeTab === 'allies') {
        const tpl = globalState.cache.allies.get(selectedId);
        if (!tpl) return;

        const myAllies = ficha.recursos?.aliados || [];
        const aData = myAllies.find(a => a.templateId === selectedId);
        const isOwned = !!aData;

        let statusHtml = '';
        let actionHtml = '';

        if (isOwned) {
            statusHtml = `<span class="bg-sky-900/50 text-sky-400 border border-sky-500/50 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest mt-2 shadow-inner"><i class="fas fa-handshake mr-1"></i> Em seu Grupo</span>`;
            actionHtml = `
                <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                    <button onclick="window.fireAlly('${selectedId}')" class="w-full bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 font-bold uppercase tracking-widest text-[11px] py-3.5 rounded transition">
                        <i class="fas fa-user-minus mr-2 text-sm"></i> Dispensar Aliado
                    </button>
                </div>
            `;
        } else {
            const cost = tpl.reputacaoCustoBase || 0;
            const canAfford = repUsage.available >= cost;
            
            statusHtml = `<span class="bg-slate-900 text-slate-400 border border-slate-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest mt-2 shadow-inner"><i class="fas fa-users mr-1"></i> Disponível</span>`;
            actionHtml = `
                <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                    <div class="flex justify-between items-center mb-3 px-2">
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Custo de Influência:</span>
                        <span class="text-lg font-cinzel font-bold ${canAfford ? 'text-sky-400' : 'text-red-400'}">${cost} REP</span>
                    </div>
                    <button onclick="window.hireAlly('${selectedId}', ${cost})" class="w-full ${canAfford ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_15px_rgba(2,132,199,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-bold uppercase tracking-widest text-[11px] py-3.5 rounded transition-transform ${canAfford ? 'hover:scale-[1.02]' : ''}" ${!canAfford ? 'disabled' : ''}>
                        <i class="fas fa-user-plus mr-2 text-sm"></i> Recrutar
                    </button>
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="flex flex-col h-full animate-fade-in">
                <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                    <div class="w-32 h-32 rounded-full bg-black border-4 ${isOwned ? 'border-sky-500 shadow-[0_0_15px_rgba(2,132,199,0.3)]' : 'border-slate-600'} overflow-hidden mb-3 relative">
                        <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                    </div>
                    <h3 class="font-cinzel text-2xl ${isOwned ? 'text-sky-400' : 'text-slate-300'} text-center leading-tight mb-1 drop-shadow-md px-2">${tpl.nome}</h3>
                    <div class="text-[10px] text-amber-500 font-bold uppercase tracking-widest">${tpl.funcao || 'Aventureiro'}</div>
                    ${statusHtml}
                </div>
                <div class="flex-1 overflow-y-auto custom-scroll p-5 bg-slate-900/20">
                    <h4 class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 border-b border-slate-700 pb-1"><i class="fas fa-scroll mr-1"></i> Biografia / Vantagens</h4>
                    <p class="text-[11px] text-slate-300 leading-relaxed italic border-l-2 border-slate-700 pl-3">${escapeHTML(tpl.descricao)}</p>
                </div>
                ${actionHtml}
            </div>
        `;
    }
}

// ==========================================
// FUNÇÕES DE TRANSAÇÃO (FIREBASE)
// ==========================================
window.buyBuilding = async function(templateId, cost) {
    if (!confirm("Adquirir este estabelecimento? (Utiliza Reputação Disponível)")) return;
    const charId = globalState.selectedCharacterId;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const usage = calculateReputationUsage(d);
            
            if (usage.available < cost) throw "Reputação insuficiente.";
            
            const recursos = d.recursos || {};
            const estab = recursos.estabelecimentos || [];
            
            if (estab.find(e => e.templateId === templateId)) throw "Você já possui este local.";
            
            estab.push({ templateId: templateId, level: 1, lastCollect: Date.now(), armazem: {} });
            recursos.estabelecimentos = estab;
            
            t.update(ref, { recursos: recursos });
        });
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

window.sellBuilding = async function(templateId) {
    if (!confirm("Vender este estabelecimento? Você irá recuperar a reputação investida, mas PERDERÁ todos os itens no armazém.")) return;
    const charId = globalState.selectedCharacterId;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const recursos = d.recursos || {};
            let estab = recursos.estabelecimentos || [];
            
            recursos.estabelecimentos = estab.filter(e => e.templateId !== templateId);
            t.update(ref, { recursos: recursos });
        });
        
        globalState.repUI.selectedId = null; // Limpa seleção
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

window.collectBuilding = async function(templateId) {
    const charId = globalState.selectedCharacterId;
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const recursos = d.recursos || {};
            const estab = recursos.estabelecimentos || [];
            const b = estab.find(e => e.templateId === templateId);
            
            if (!b) throw "Estabelecimento não encontrado.";
            
            const now = Date.now();
            const timeDiff = now - (b.lastCollect || 0);
            if (timeDiff < COLET_COOLDOWN_MS) throw "Ainda não está pronto para coleta.";

            const tpl = globalState.cache.buildings.get(templateId);
            if (!tpl || !tpl.producao || tpl.producao.length === 0) throw "Este local não produz itens.";

            const armazem = b.armazem || {};
            
            // Adiciona itens gerados ao armazém
            tpl.producao.forEach(prod => {
                const itemId = prod.itemId;
                const qtd = prod.quantidadeBase || 1;
                armazem[itemId] = (armazem[itemId] || 0) + qtd;
            });

            b.lastCollect = now;
            b.armazem = armazem;
            t.update(ref, { recursos: recursos });
        });
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

window.hireAlly = async function(templateId, cost) {
    if (!confirm("Recrutar este aliado? (Utiliza Reputação Disponível)")) return;
    const charId = globalState.selectedCharacterId;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const usage = calculateReputationUsage(d);
            
            if (usage.available < cost) throw "Reputação insuficiente.";
            
            const recursos = d.recursos || {};
            const aliados = recursos.aliados || [];
            
            if (aliados.find(a => a.templateId === templateId)) throw "Este aliado já está com você.";
            
            aliados.push({ templateId: templateId, active: true });
            recursos.aliados = aliados;
            
            t.update(ref, { recursos: recursos });
        });
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

window.fireAlly = async function(templateId) {
    if (!confirm("Dispensar aliado? Ele sairá do grupo e você recuperará a reputação investida.")) return;
    const charId = globalState.selectedCharacterId;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const recursos = d.recursos || {};
            let aliados = recursos.aliados || [];
            
            recursos.aliados = aliados.filter(a => a.templateId !== templateId);
            t.update(ref, { recursos: recursos });
        });
        
        globalState.repUI.selectedId = null; // Limpa seleção
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

// ==========================================
// ARMAZÉM DO PRÉDIO (MODAL)
// ==========================================
window.openBuildingStorage = function(templateId) {
    const charData = globalState.selectedCharacterData;
    const estabs = charData.ficha.recursos?.estabelecimentos || [];
    const b = estabs.find(e => e.templateId === templateId);
    if (!b) return;

    const tpl = globalState.cache.buildings.get(templateId);
    const armazem = b.armazem || {};
    const itemIds = Object.keys(armazem);

    let itemsHtml = '';
    if (itemIds.length === 0) {
        itemsHtml = '<div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-8"><i class="fas fa-box-open text-4xl mb-3 opacity-30"></i><p class="text-xs uppercase tracking-widest font-bold">Armazém Vazio</p></div>';
    } else {
        itemsHtml = `<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">`;
        itemIds.forEach(itemId => {
            const item = globalState.cache.itens.get(itemId);
            if (!item) return;
            const qtd = armazem[itemId];

            itemsHtml += `
                <div onclick="window.withdrawBuildingItem('${templateId}', '${itemId}')" class="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center cursor-pointer hover:border-amber-500 hover:shadow-[0_0_10px_rgba(245,158,11,0.3)] transition group relative overflow-hidden">
                    <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-12 h-12 object-cover rounded bg-black border border-slate-800 mb-1 group-hover:scale-105 transition">
                    <div class="text-[9px] text-slate-300 font-bold truncate w-full text-center">${escapeHTML(item.nome)}</div>
                    <div class="absolute bottom-6 right-2 text-[10px] text-amber-400 font-mono font-bold bg-black/80 px-1 rounded shadow">x${qtd}</div>
                    
                    <div class="absolute inset-0 bg-sky-600/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-lg transition-opacity duration-200">
                        <i class="fas fa-hand-holding-box text-white text-xl mb-1 drop-shadow-md"></i>
                        <span class="text-[10px] text-white font-bold uppercase tracking-wider drop-shadow-md">Sacar Item</span>
                    </div>
                </div>
            `;
        });
        itemsHtml += `</div>`;
    }

    const modalArea = document.getElementById('building-modal-area');
    modalArea.innerHTML = `
        <div class="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-lg w-full shadow-2xl relative">
                <button onclick="document.getElementById('building-modal-area').innerHTML = ''" class="absolute top-3 right-4 text-slate-400 hover:text-red-400 transition"><i class="fas fa-times text-xl"></i></button>
                
                <h3 class="text-xl font-cinzel text-amber-400 mb-1"><i class="fas fa-warehouse mr-2"></i>Armazém Local</h3>
                <p class="text-[10px] text-slate-400 mb-4 uppercase tracking-widest border-b border-slate-700 pb-3">${escapeHTML(tpl.nome)}</p>
                
                <div class="max-h-80 overflow-y-auto custom-scroll pr-2 bg-slate-900/30 p-2 rounded border border-slate-700/50">
                    ${itemsHtml}
                </div>
                
                <p class="text-center text-[9px] text-slate-500 mt-4 italic">Clique em um item para transferi-lo para sua mochila principal.</p>
            </div>
        </div>
    `;
};

window.withdrawBuildingItem = async function(templateId, itemId) {
    const charId = globalState.selectedCharacterId;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            
            const recursos = d.recursos || {};
            const estab = recursos.estabelecimentos || [];
            const bIndex = estab.findIndex(e => e.templateId === templateId);
            
            if (bIndex === -1) throw "Prédio não encontrado.";
            
            const b = estab[bIndex];
            const armazem = b.armazem || {};
            const qtd = armazem[itemId];
            
            if (!qtd || qtd < 1) throw "Item não está no armazém.";
            
            // Remove do armazém
            delete armazem[itemId];
            b.armazem = armazem;
            estab[bIndex] = b;
            recursos.estabelecimentos = estab;

            // Adiciona na Mochila
            const mochila = d.mochila || {};
            mochila[itemId] = (mochila[itemId] || 0) + qtd;

            t.update(ref, { recursos: recursos, mochila: mochila });
        });
        
        // Atualiza UI sem fechar o modal
        window.openBuildingStorage(templateId); 
        renderReputacaoTab(); // Atualiza fundo para mostrar alerta (!) sumindo se for o caso
        
    } catch (e) { alert("Erro: " + e); }
};
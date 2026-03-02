// ARQUIVO: js/tabs/reputacao.js

import { db, doc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

const COLET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos por ciclo

// --- GESTÃO DE ESTADO DA INTERFACE ---
window.switchRepTab = function(tabName) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details' };
    globalState.repUI.tab = tabName;
    globalState.repUI.selectedId = null; 
    window.renderReputacaoTab();
};

window.selectRepItem = function(tab, id) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details' };
    globalState.repUI.selectedId = id;
    globalState.repUI.innerTab = 'details';
    window.renderReputacaoTab();
};

window.switchRepInnerTab = function(tabName) {
    if (!globalState.repUI) return;
    globalState.repUI.innerTab = tabName;
    window.renderReputacaoTab();
};

// --- CÁLCULO DE CAPACIDADE DO ARMAZÉM ---
function calculateStorageCapacity(ficha) {
    let armazemCap = 50; // Base
    const mochilaForCap = ficha.mochila || {};
    Object.entries(mochilaForCap).forEach(([id, qty]) => {
        const tpl = globalState.cache.itens.get(id);
        if (tpl && (tpl.tipoItem === 'Armazenamento' || tpl.categoria === 'Armazenamento' || tpl.slot_equipavel_id === 'bau')) {
            armazemCap += (Number(tpl.bonusCapacidadeMochila) || 0) * qty;
        }
    });
    return armazemCap;
}

// --- RENDERIZADOR PRINCIPAL ---
export function renderReputacaoTab() {
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

    window.renderReputacaoTab = renderReputacaoTab;

    try {
        const charData = globalState.selectedCharacterData;
        if (!charData || !charData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details' };
        const activeTab = globalState.repUI.tab;
        
        const ficha = charData.ficha;
        const repUsage = calculateReputationUsage(ficha);
        const repDetails = calculateReputationDetails(ficha);
        const maxStorage = calculateStorageCapacity(ficha);

        // Define a área da esquerda baseada na aba ativa
        let leftContentHtml = '';
        if (activeTab === 'storage') {
            leftContentHtml = `<div id="storage-mochila-container" class="flex-1 overflow-y-auto custom-scroll bg-slate-950/50 border border-slate-700 rounded-xl p-4 shadow-inner"></div>`;
        } else {
            leftContentHtml = `<div id="rep-grid-container" class="flex-1 overflow-y-auto custom-scroll bg-slate-950/50 border border-slate-700 rounded-xl p-4 shadow-inner grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start"></div>`;
        }

        container.innerHTML = `
            <div id="rep-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                
                <div class="flex-1 flex flex-col min-w-0 h-full">
                    
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 shrink-0">
                        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-lg relative overflow-hidden">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-slate-950 border-2 border-amber-500 flex items-center justify-center text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                                    <i class="fas fa-crown text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Influência Total</h3>
                                    <div class="flex gap-3 mt-1.5">
                                        <span class="text-[9px] text-slate-400 font-mono" title="Nível + Profissões"><i class="fas fa-arrow-up text-emerald-500"></i> ${repDetails.level + repDetails.profissoes}</span>
                                        <span class="text-[9px] text-slate-400 font-mono" title="Enciclopédia"><i class="fas fa-book text-sky-500"></i> ${repUsage.colecao}</span>
                                        ${repDetails.gmBonus ? `<span class="text-[9px] text-slate-400 font-mono" title="Bônus GM"><i class="fas fa-gift text-purple-500"></i> ${repDetails.gmBonus}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right border-l border-slate-800 pl-4">
                                <div class="text-2xl font-cinzel text-amber-400 leading-none">${repUsage.total}</div>
                                <div class="text-[10px] ${repUsage.available >= 0 ? 'text-emerald-400' : 'text-red-400'} font-bold mt-1">Livre: ${repUsage.available}</div>
                            </div>
                        </div>

                        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700 grid grid-cols-3 gap-2 text-center shadow-inner">
                            <div class="flex flex-col justify-center border-r border-slate-700">
                                <span class="text-[8px] text-slate-500 uppercase font-black">Propriedades</span>
                                <strong class="text-lg text-white font-cinzel">${(ficha.recursos?.estabelecimentos || []).length}</strong>
                            </div>
                            <div class="flex flex-col justify-center border-r border-slate-700">
                                <span class="text-[8px] text-slate-500 uppercase font-black">Aliados</span>
                                <strong class="text-lg text-white font-cinzel">${(ficha.recursos?.aliados || []).length}</strong>
                            </div>
                            <div class="flex flex-col justify-center">
                                <span class="text-[8px] text-slate-500 uppercase font-black">Carga Max</span>
                                <strong class="text-lg text-sky-400 font-cinzel">${maxStorage}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2 mb-4 shrink-0 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                        <button onclick="window.switchRepTab('buildings')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'buildings' ? 'bg-amber-600 text-black shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-store mr-1"></i> Estabelecimentos
                        </button>
                        <button onclick="window.switchRepTab('allies')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'allies' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-users mr-1"></i> Aliados
                        </button>
                        <button onclick="window.switchRepTab('storage')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'storage' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-boxes mr-1"></i> Armazenamento
                        </button>
                    </div>

                    ${leftContentHtml}
                </div>

                <div class="w-80 md:w-96 shrink-0 flex flex-col h-full relative">
                    <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden" id="rep-inspect-panel">
                        </div>
                </div>

            </div>
        `;

        if (activeTab === 'storage') {
            renderStorageMochila(ficha);
            renderStorageVault(ficha, maxStorage);
        } else {
            renderRepGrid(ficha);
            renderRepRightPanel(ficha, repUsage);
        }

    } catch (error) {
        console.error("Erro Fatal na Aba Reputação:", error);
    }
}

// 3. RENDERIZADORES DE GRID E INSPETOR (Para Estabelecimentos e Aliados)
function renderRepGrid(ficha) {
    const grid = document.getElementById('rep-grid-container');
    if (!grid) return;
    
    const activeTab = globalState.repUI.tab;
    const selectedId = globalState.repUI.selectedId;

    let itemsToDisplay = activeTab === 'buildings' ? [...globalState.cache.buildings.values()] : [...globalState.cache.allies.values()];
    let myResources = activeTab === 'buildings' ? (ficha.recursos?.estabelecimentos || []) : (ficha.recursos?.aliados || []);
    const myIds = new Set(myResources.map(r => r.templateId));
    
    itemsToDisplay.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(tpl => {
        const isOwned = myIds.has(tpl.id);
        const isSelected = selectedId === tpl.id;
        
        const el = document.createElement('div');
        el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
        el.onclick = () => window.selectRepItem(activeTab, tpl.id);
        
        let border = isOwned ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-slate-800 opacity-50 grayscale hover:opacity-100 hover:grayscale-0';
        if (isSelected) border = 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)] opacity-100 grayscale-0';

        el.innerHTML = `
            <div class="w-full aspect-square bg-slate-950 rounded-xl border-2 ${border} overflow-hidden relative transition-all">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black pt-4 pb-1 text-center px-1">
                    <span class="text-[8.5px] font-black uppercase truncate block text-slate-200">${tpl.nome}</span>
                </div>
                ${isOwned ? '<div class="absolute top-1 right-1 bg-emerald-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] shadow-lg border border-black"><i class="fas fa-check"></i></div>' : ''}
            </div>
        `;
        grid.appendChild(el);
    });
}

function renderRepRightPanel(ficha, repUsage) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const selectedId = globalState.repUI.selectedId;
    const activeTab = globalState.repUI.tab;
    const innerTab = globalState.repUI.innerTab || 'details';

    if (!selectedId) {
        panel.innerHTML = `
            <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Manual: Adquirir estabelecimentos consome Influência e exige Materiais Físicos. Após a compra, basta ter os itens de consumo na mochila para poder Iniciar o Ciclo de Produção e gerar loots.">
                <i class="fas fa-question-circle text-xl"></i>
            </div>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-40 p-10 text-center">
                <i class="fas fa-fingerprint text-6xl mb-4"></i>
                <p class="font-cinzel text-sm uppercase tracking-widest leading-none">Inspecionar Recurso</p>
                <p class="text-[10px] mt-3 italic text-center px-4">Selecione uma propriedade ou aliado na lista para gerenciar o seu Império.</p>
            </div>`;
        return;
    }

    const tpl = (activeTab === 'buildings' ? globalState.cache.buildings.get(selectedId) : globalState.cache.allies.get(selectedId));
    if (!tpl) return;

    const myBuildings = ficha.recursos?.estabelecimentos || [];
    const bData = myBuildings.find(b => b.templateId === selectedId);
    const isOwned = activeTab === 'buildings' ? !!bData : !!(ficha.recursos?.aliados || []).find(a => a.templateId === selectedId);

    // VALIDAÇÃO DE CUSTOS (Reputação + Itens Físicos da Mochila)
    let canAffordRep = repUsage.available >= (tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0);
    let canAffordMats = true;
    let purchaseMatsHtml = '';

    const buyRequirements = tpl.custoMateriais || tpl.requisitos || [];
    if (buyRequirements.length > 0) {
        purchaseMatsHtml = `<div class="mt-4"><h4 class="text-[9px] uppercase font-black text-amber-500 mb-2 border-b border-amber-500/20 pb-1">Materiais Necessários p/ Adquirir:</h4><div class="grid grid-cols-2 gap-2">`;
        buyRequirements.forEach(req => {
            const itemReq = globalState.cache.itens.get(req.itemId);
            const has = (ficha.mochila || {})[req.itemId] || 0;
            const enough = has >= req.quantidade;
            if (!enough) canAffordMats = false;
            purchaseMatsHtml += `
                <div class="flex items-center gap-2 bg-slate-900 border ${enough ? 'border-emerald-900/40' : 'border-red-900/40'} p-2 rounded relative group/tip" title="${itemReq?.nome || 'Recurso'}">
                    <img src="${itemReq?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-6 h-6 rounded shrink-0">
                    <span class="text-[10px] font-bold font-mono ${enough ? 'text-emerald-400' : 'text-red-400'}">${has}/${req.quantidade}</span>
                </div>`;
        });
        purchaseMatsHtml += `</div></div>`;
    }

    // PRODUÇÃO E CONSUMO POR CICLO (Visualização nítida)
    let opsBox = '';
    if ((tpl.producao?.length || 0) > 0 || (tpl.consumo?.length || 0) > 0) {
        opsBox = `<div class="space-y-4 mt-2">`;
        if (tpl.consumo?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-red-500 mb-2 border-b border-red-900/20 pb-1">Materiais Consumidos p/ Ciclo:</h4>`;
            tpl.consumo.forEach(c => {
                const item = globalState.cache.itens.get(c.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-red-900/10 p-1.5 rounded mb-1 border border-red-900/20" title="${item?.nome}">
                    <span class="flex items-center gap-2 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-bold text-red-500">-${c.quantidade || c.quantidadeBase} / ciclo</span>
                </div>`;
            });
            opsBox += `</div>`;
        }
        if (tpl.producao?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-emerald-500 mb-2 border-b border-emerald-900/20 pb-1">Loots Gerados p/ Ciclo:</h4>`;
            tpl.producao.forEach(p => {
                const item = globalState.cache.itens.get(p.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-emerald-900/10 p-1.5 rounded mb-1 border border-emerald-900/20" title="${item?.nome}">
                    <span class="flex items-center gap-2 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-bold text-emerald-400">+${p.quantidade || p.quantidadeBase} / ciclo</span>
                </div>`;
            });
            opsBox += `</div>`;
        }
        opsBox += `</div>`;
    }

    // CONTEÚDO DINÂMICO (Abas Internas: Dados vs Inventário do Prédio)
    let dynamicBody = '';
    if (activeTab === 'buildings' && isOwned && innerTab === 'inventory') {
        const armazem = bData.armazem || {};
        const armazemIds = Object.keys(armazem);
        if (armazemIds.length === 0) {
            dynamicBody = `<div class="flex flex-col items-center justify-center py-16 opacity-30 italic text-slate-500 text-xs"><i class="fas fa-box-open text-4xl mb-2"></i> Sem loots para coletar.</div>`;
        } else {
            dynamicBody = `<div class="grid grid-cols-2 gap-3">`;
            armazemIds.forEach(id => {
                const it = globalState.cache.itens.get(id);
                dynamicBody += `
                    <div class="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center group relative overflow-hidden">
                        <img src="${it?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 object-cover rounded bg-black mb-1">
                        <div class="text-[8px] text-slate-400 font-bold truncate w-full text-center uppercase">${it?.nome}</div>
                        <div class="text-xs text-amber-500 font-black">x${armazem[id]}</div>
                        <div class="absolute inset-0 bg-sky-900/95 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-lg transition-opacity gap-1">
                            <span class="text-[8px] text-sky-300 font-bold uppercase mb-1">Puxar p/ Mochila</span>
                            <div class="flex gap-1 w-full px-2">
                                <button onclick="window.withdrawLocalBuildingItem('${selectedId}', '${id}', 1)" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold py-1 rounded shadow">< 1</button>
                                <button onclick="window.withdrawLocalBuildingItem('${selectedId}', '${id}', 'all')" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold py-1 rounded shadow"><< Tudo</button>
                            </div>
                        </div>
                    </div>`;
            });
            dynamicBody += `</div>`;
        }
    } else {
        dynamicBody = `
            <p class="text-[11px] text-slate-300 leading-relaxed italic border-l-2 border-slate-600 pl-3 mb-6">${escapeHTML(tpl.descricao)}</p>
            ${opsBox}
            ${!isOwned ? purchaseMatsHtml : ''}
            
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center shadow-inner" title="Reputação reservada para este recurso.">
                    <span class="block text-[8px] text-slate-500 uppercase font-black">Influência Exigida</span>
                    <strong class="${canAffordRep ? 'text-white' : 'text-red-500'} font-cinzel text-lg leading-none">${tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0}</strong>
                </div>
                <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                    <span class="block text-[8px] text-slate-500 uppercase font-black">Status</span>
                    <strong class="${isOwned ? 'text-emerald-400' : 'text-amber-500'} font-cinzel text-sm uppercase">${isOwned ? 'Adquirido' : 'Disponível'}</strong>
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        <div class="flex flex-col h-full animate-fade-in">
            <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Manual Imperial: Adquira propriedades pagando Reputação e Materiais. Em 'Produção', veja os custos para operar. Clique em 'Iniciar Ciclo' para gerar loot, que ficará no 'Armazém' aguardando o seu saque.">
                <i class="fas fa-question-circle text-xl"></i>
            </div>

            <div class="p-8 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                <div class="w-32 h-32 rounded-2xl bg-black border-2 ${isOwned ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-600'} overflow-hidden mb-4 transition-transform hover:scale-105">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                </div>
                <h3 class="font-cinzel text-2xl ${isOwned ? 'text-amber-400' : 'text-slate-300'} text-center leading-tight mb-1 drop-shadow-md px-4">${tpl.nome}</h3>
                <p class="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">${tpl.funcao || 'Recurso Imperial'}</p>
            </div>

            ${activeTab === 'buildings' && isOwned ? `
            <div class="flex p-2 bg-slate-950 border-b border-slate-700 shrink-0 gap-2">
                <button onclick="window.switchRepInnerTab('details')" class="flex-1 py-1.5 text-[9px] uppercase font-black rounded-lg transition-colors ${innerTab === 'details' ? 'bg-slate-800 text-amber-500 border border-amber-500/30 shadow-md' : 'text-slate-500 hover:bg-slate-900'}">
                    <i class="fas fa-industry mr-1"></i> Produção
                </button>
                <button onclick="window.switchRepInnerTab('inventory')" class="flex-1 py-1.5 text-[9px] uppercase font-black rounded-lg transition-colors relative ${innerTab === 'inventory' ? 'bg-slate-800 text-sky-400 border border-sky-400/30 shadow-md' : 'text-slate-500 hover:bg-slate-900'}">
                    <i class="fas fa-box-open mr-1"></i> Estoque Local 
                    ${Object.keys(bData.armazem || {}).length > 0 ? '<span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow"></span>' : ''}
                </button>
            </div>` : ''}

            <div class="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-900/20">
                ${dynamicBody}
            </div>

            <div class="p-4 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                ${isOwned 
                    ? `<div class="flex flex-col gap-2">
                        ${(activeTab === 'buildings' && (Date.now() - (bData.lastCollect || 0)) >= COLET_COOLDOWN_MS) ? 
                            `<button onclick="window.collectBuilding('${selectedId}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-[11px] uppercase shadow-lg transition-transform hover:scale-[1.02] animate-pulse">
                                <i class="fas fa-hammer mr-2 text-sm"></i> Iniciar Ciclo de Produção
                             </button>` : ''}
                        <button onclick="window.sellBuilding('${selectedId}', '${activeTab}')" class="w-full bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all">
                            <i class="fas fa-times-circle mr-1 text-sm"></i> ${activeTab === 'allies' ? 'Dispensar Aliado' : 'Vender Propriedade'}
                        </button>
                       </div>`
                    : `<button onclick="window.buyRepItem('${selectedId}', '${activeTab}', ${tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0})" 
                        class="w-full ${canAffordRep && canAffordMats ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-lg hover:scale-[1.02]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} py-3.5 rounded-xl text-[11px] font-black uppercase transition-all"
                        ${!(canAffordRep && canAffordMats) ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart mr-2 text-sm"></i> Adquirir Recurso
                       </button>`
                }
            </div>
        </div>
    `;
}

// 5. RENDERIZADORES DO ARMAZÉM GLOBAL (Nova Aba de Sincronização)
function renderStorageMochila(ficha) {
    const container = document.getElementById('storage-mochila-container');
    const mochila = ficha.mochila || {};
    const itemIds = Object.keys(mochila).filter(id => mochila[id] > 0);

    let html = `
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
            <h3 class="text-amber-400 font-cinzel font-bold text-lg"><i class="fas fa-briefcase mr-2"></i> Sua Mochila</h3>
            <span class="text-[10px] font-mono text-slate-500">Itens em Mãos</span>
        </div>
        <div class="space-y-2">
    `;

    if (itemIds.length === 0) {
        html += `<p class="text-slate-500 italic text-center py-10 text-xs">A sua mochila está vazia.</p>`;
    } else {
        itemIds.forEach(id => {
            const item = globalState.cache.itens.get(id);
            if (!item) return;
            html += `
                <div class="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-amber-500 transition-colors">
                    <div class="flex items-center gap-3">
                        <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 rounded bg-black object-cover border border-slate-700">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-slate-300 font-bold uppercase truncate max-w-[120px] sm:max-w-xs">${item.nome}</span>
                            <span class="text-amber-500 font-mono text-[9px] font-bold">Em mãos: ${mochila[id]}</span>
                        </div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="window.transferGlobalStorage('mochila', 'armazem', '${id}', 1)" class="bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white px-2.5 py-1.5 rounded text-[9px] font-black transition-colors shadow" title="Guardar 1 item no cofre">1 <i class="fas fa-angle-right ml-1"></i></button>
                        <button onclick="window.transferGlobalStorage('mochila', 'armazem', '${id}', 'all')" class="bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white px-2.5 py-1.5 rounded text-[9px] font-black transition-colors shadow" title="Guardar todos no cofre">All <i class="fas fa-angle-double-right ml-1"></i></button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderStorageVault(ficha, maxStorage) {
    const panel = document.getElementById('rep-inspect-panel');
    const armazemGeral = ficha.recursos?.armazemGeral || {};
    const itemIds = Object.keys(armazemGeral).filter(id => armazemGeral[id] > 0);
    
    let currentOccupied = 0;
    itemIds.forEach(id => currentOccupied += armazemGeral[id]);

    let vaultHtml = `
        <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Cofre Central: Utilize as setas direcionais para mover itens da sua Mochila para o Armazém Imperial e vice-versa. O botão inferior recolhe automaticamente todos os loots que estão presos nas suas propriedades.">
            <i class="fas fa-question-circle text-xl"></i>
        </div>

        <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-cinzel text-xl text-sky-400 leading-tight mb-1"><i class="fas fa-warehouse mr-2"></i>Armazém Imperial</h3>
                <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest">Estoque Central da Facção</p>
            </div>
            <div class="text-right">
                <span class="text-[9px] text-slate-400 uppercase font-bold">Capacidade Máx</span>
                <div class="text-lg font-mono ${currentOccupied > maxStorage ? 'text-red-400' : 'text-sky-400'} font-bold">${currentOccupied} <span class="text-xs text-slate-500">/ ${maxStorage}</span></div>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-scroll p-4 bg-slate-900/20 space-y-2">
    `;

    if (itemIds.length === 0) {
        vaultHtml += `<div class="flex flex-col items-center justify-center h-full text-slate-500 opacity-40"><i class="fas fa-box-open text-5xl mb-3"></i><p class="text-xs uppercase font-bold tracking-widest">Cofre Vazio</p></div>`;
    } else {
        itemIds.forEach(id => {
            const item = globalState.cache.itens.get(id);
            if (!item) return;
            vaultHtml += `
                <div class="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 hover:border-sky-500 transition-colors">
                    <div class="flex gap-1 shrink-0">
                        <button onclick="window.transferGlobalStorage('armazem', 'mochila', '${id}', 'all')" class="bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded text-[9px] font-black transition-colors shadow" title="Puxar tudo para a mochila"><i class="fas fa-angle-double-left mr-1"></i> All</button>
                        <button onclick="window.transferGlobalStorage('armazem', 'mochila', '${id}', 1)" class="bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded text-[9px] font-black transition-colors shadow" title="Puxar 1 para a mochila"><i class="fas fa-angle-left mr-1"></i> 1</button>
                    </div>
                    <div class="flex items-center gap-3 text-right">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-slate-300 font-bold uppercase truncate max-w-[120px] sm:max-w-[150px]">${item.nome}</span>
                            <span class="text-sky-400 font-mono text-[9px] font-bold">Guardado: ${armazemGeral[id]}</span>
                        </div>
                        <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 rounded bg-black object-cover border border-slate-700">
                    </div>
                </div>
            `;
        });
    }

    vaultHtml += `
        </div>
        <div class="p-4 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            <button onclick="window.collectAllToVault()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg hover:scale-[1.02]">
                <i class="fas fa-truck-loading mr-2 text-sm"></i> Recolher Todas Produções Locais
            </button>
        </div>
    `;

    panel.innerHTML = vaultHtml;
}


// --- LÓGICA DO FIREBASE (TRANSAÇÕES) ---

window.buyRepItem = async function(templateId, type, costRep) {
    const charId = globalState.selectedCharacterId;
    const tpl = (type === 'buildings' ? globalState.cache.buildings.get(templateId) : 
                (type === 'allies' ? globalState.cache.allies.get(templateId) : 
                globalState.cache.itens.get(templateId)));

    if (!confirm(`Desejas adquirir "${tpl.nome}"?\nReputação e materiais da mochila serão consumidos.`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const usage = calculateReputationUsage(d);
            
            if (usage.available < costRep) throw "Reputação insuficiente.";
            
            const mochila = d.mochila || {};
            const reqs = tpl.custoMateriais || tpl.requisitos || [];
            
            // Valida materiais da mochila
            for (let req of reqs) {
                if ((mochila[req.itemId] || 0) < req.quantidade) {
                    const info = globalState.cache.itens.get(req.itemId);
                    throw `Materiais físicos insuficientes: falta ${req.quantidade}x ${info?.nome || req.itemId} na Mochila.`;
                }
            }

            // Consome materiais
            reqs.forEach(req => {
                mochila[req.itemId] -= req.quantidade;
                if (mochila[req.itemId] <= 0) delete mochila[req.itemId];
            });

            const recursos = d.recursos || {};
            if (type === 'buildings') {
                const list = recursos.estabelecimentos || [];
                list.push({ templateId: templateId, lastCollect: Date.now(), armazem: {} });
                recursos.estabelecimentos = list;
            } else if (type === 'allies') {
                const list = recursos.aliados || [];
                list.push({ templateId: templateId, active: true });
                recursos.aliados = list;
            } else if (type === 'storage') {
                // Expansões de carga viram itens de posse
                mochila[templateId] = (mochila[templateId] || 0) + 1;
            }

            t.update(ref, { recursos, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert("Falha na Aquisição: " + e); }
};

window.collectBuilding = async function(templateId) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const estabs = d.recursos?.estabelecimentos || [];
            const b = estabs.find(e => e.templateId === templateId);
            const tpl = globalState.cache.buildings.get(templateId);

            const mochila = d.mochila || {};
            const consumos = tpl.consumo || [];
            
            // Valida Manutenção
            for (let c of consumos) {
                if ((mochila[c.itemId] || 0) < (c.quantidade || c.quantidadeBase)) throw "Falta de recursos de manutenção na mochila para iniciar o ciclo de operação.";
            }

            // Consome Manutenção
            consumos.forEach(c => {
                mochila[c.itemId] -= (c.quantidade || c.quantidadeBase);
                if (mochila[c.itemId] <= 0) delete mochila[c.itemId];
            });

            // Gera Loots no Armazém Local
            const armazem = b.armazem || {};
            (tpl.producao || []).forEach(p => {
                armazem[p.itemId] = (armazem[p.itemId] || 0) + (p.quantidade || p.quantidadeBase);
            });

            b.lastCollect = Date.now();
            b.armazem = armazem;
            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
        alert("Ciclo de produção concluído com sucesso!");
    } catch (e) { alert(e); }
};

window.sellBuilding = async function(templateId, type) {
    if (!confirm("Confirmar remoção? Loots não sacados do armazém local serão perdidos e a influência será liberada.")) return;
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const rec = d.recursos || {};
            if (type === 'buildings') rec.estabelecimentos = (rec.estabelecimentos || []).filter(e => e.templateId !== templateId);
            else rec.aliados = (rec.aliados || []).filter(a => a.templateId !== templateId);
            t.update(ref, { recursos: rec });
        });
        globalState.repUI.selectedId = null;
        window.renderReputacaoTab();
    } catch (e) { console.error(e); }
};

// Funções Exclusivas de Sincronização de Cofre
window.withdrawLocalBuildingItem = async function(templateId, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const estabs = d.recursos?.estabelecimentos || [];
            const b = estabs.find(e => e.templateId === templateId);
            
            const available = b.armazem[itemId] || 0;
            if (available <= 0) return;

            const amount = amountRaw === 'all' ? available : Math.min(amountRaw, available);

            b.armazem[itemId] -= amount;
            if (b.armazem[itemId] <= 0) delete b.armazem[itemId];
            
            const mochila = d.mochila || {};
            mochila[itemId] = (mochila[itemId] || 0) + amount;

            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert("Erro ao sacar loot local."); }
};

window.transferGlobalStorage = async function(from, to, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            
            const mochila = d.mochila || {};
            const recursos = d.recursos || {};
            const armazem = recursos.armazemGeral || {};
            
            let sourceObj = from === 'mochila' ? mochila : armazem;
            let destObj = to === 'mochila' ? mochila : armazem;
            
            const available = sourceObj[itemId] || 0;
            if (available <= 0) return;
            
            const amount = amountRaw === 'all' ? available : Math.min(amountRaw, available);

            // Se for mover PARA o Armazém, valida capacidade
            if (to === 'armazem') {
                const maxCap = calculateStorageCapacity(d);
                let currentOcc = 0;
                Object.values(armazem).forEach(v => currentOcc += v);
                if (currentOcc + amount > maxCap) {
                    throw `Espaço insuficiente no Armazém Imperial. (Máx: ${maxCap})`;
                }
            }
            
            sourceObj[itemId] -= amount;
            if (sourceObj[itemId] <= 0) delete sourceObj[itemId];
            destObj[itemId] = (destObj[itemId] || 0) + amount;
            
            if (from === 'mochila') t.update(ref, { mochila: sourceObj, "recursos.armazemGeral": destObj });
            else t.update(ref, { mochila: destObj, "recursos.armazemGeral": sourceObj });
        });
        window.renderReputacaoTab();
    } catch(e) { alert(typeof e === 'string' ? e : "Falha na transferência."); }
};

window.collectAllToVault = async function() {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const recursos = d.recursos || {};
            const estabs = recursos.estabelecimentos || [];
            const armazemGeral = recursos.armazemGeral || {};
            let collectedSomething = false;
            
            const maxCap = calculateStorageCapacity(d);
            let currentOcc = 0;
            Object.values(armazemGeral).forEach(v => currentOcc += v);

            estabs.forEach(b => {
                const localVault = b.armazem || {};
                for (let [itemId, qty] of Object.entries(localVault)) {
                    if (currentOcc + qty > maxCap) {
                        throw `Espaço insuficiente no Armazém Central para recolher todos os itens! Aumente a sua capacidade.`;
                    }
                    armazemGeral[itemId] = (armazemGeral[itemId] || 0) + qty;
                    currentOcc += qty;
                    collectedSomething = true;
                }
                b.armazem = {}; 
            });
            
            if (!collectedSomething) throw "Não existem produções prontas nas suas propriedades locais.";
            
            recursos.armazemGeral = armazemGeral;
            recursos.estabelecimentos = estabs;
            t.update(ref, { recursos });
        });
        window.renderReputacaoTab();
        alert("Excelente Gestão Imperial! Todos os itens foram centralizados no seu Cofre.");
    } catch(e) { alert(typeof e === 'string' ? e : "Erro logístico ao coletar."); }
};
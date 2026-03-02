import { db, doc, getDoc, setDoc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

const COLET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos para demonstração (pode ajustar)

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

// Leitores de Inputs
window.transferWithInput = function(from, to, itemId, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let val = parseInt(inputEl.value);
    if (isNaN(val) || val <= 0) return alert("Insira um valor numérico válido.");
    window.transferGlobalStorage(from, to, itemId, val);
};

window.withdrawLocalWithInput = function(templateId, itemId, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let val = parseInt(inputEl.value);
    if (isNaN(val) || val <= 0) return alert("Insira um valor numérico válido.");
    window.withdrawLocalBuildingItem(templateId, itemId, val);
};


// --- RENDERIZADOR PRINCIPAL ---
export async function renderReputacaoTab() {
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

    window.renderReputacaoTab = renderReputacaoTab;

    try {
        const charId = globalState.selectedCharacterId;
        const charData = globalState.selectedCharacterData;
        
        if (!charId || !charData || !charData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro na barra lateral.</div>';
            return;
        }

        if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details' };
        const activeTab = globalState.repUI.tab;
        
        const ficha = charData.ficha;
        const repUsage = calculateReputationUsage(ficha);
        const repDetails = calculateReputationDetails(ficha);

        // EXTRAÇÃO SEGURA DO ID DO ARMAZÉM
        let storageId = String(charId); 
        if (ficha.recursos && typeof ficha.recursos.armazemGeral === 'string' && ficha.recursos.armazemGeral.trim() !== '') {
            storageId = ficha.recursos.armazemGeral.trim();
        }

        let armazemGeral = {};
        if (storageId && storageId !== "undefined" && storageId !== "null") {
            try {
                const storageRef = doc(db, "rpg_armazenamentos", storageId);
                const storageSnap = await getDoc(storageRef);
                if (storageSnap.exists()) {
                    const snapData = storageSnap.data();
                    armazemGeral = snapData.itens !== undefined ? snapData.itens : snapData;
                }
            } catch (e) {
                console.error("Erro ao carregar coleção rpg_armazenamentos:", e);
            }
        }

        let totalGuardado = 0;
        Object.values(armazemGeral).forEach(v => { if (typeof v === 'number') totalGuardado += v; });

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
                                <span class="text-[8px] text-slate-500 uppercase font-black" title="Armazém Infinito">Itens Cofre</span>
                                <strong class="text-lg text-sky-400 font-cinzel">${totalGuardado} <i class="fas fa-infinity text-[10px] ml-1 opacity-50"></i></strong>
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
                    <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden" id="rep-inspect-panel"></div>
                </div>

            </div>
        `;

        if (activeTab === 'storage') {
            renderStorageMochila(ficha);
            renderStorageVault(armazemGeral);
        } else {
            renderRepGrid(ficha);
            renderRepRightPanel(ficha, repUsage);
        }

    } catch (error) {
        console.error("Erro Fatal na Aba Reputação:", error);
    }
}

// 3. RENDERIZA GRID DE CATEGORIAS (Estabelecimentos / Aliados)
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

// 4. PAINEL DE INSPEÇÃO COM VALIDAÇÃO RIGOROSA
function renderRepRightPanel(ficha, repUsage) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const selectedId = globalState.repUI.selectedId;
    const activeTab = globalState.repUI.tab;
    const innerTab = globalState.repUI.innerTab || 'details';

    if (!selectedId) {
        panel.innerHTML = `
            <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Manual: Adquirir estabelecimentos consome Influência e exige Materiais Físicos. Após a compra, basta ter os itens de consumo na mochila para poder Iniciar a Produção e gerar loots.">
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

    // VALIDAÇÃO DE CUSTOS 
    let canAffordRep = repUsage.available >= (tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0);
    let canAffordMats = true;
    let purchaseMatsHtml = '';

    const buyRequirements = tpl.custoMateriais || tpl.requisitos || [];
    if (buyRequirements.length > 0) {
        purchaseMatsHtml = `<div class="mt-4"><h4 class="text-[9px] uppercase font-black text-amber-500 mb-2 border-b border-amber-500/20 pb-1">Materiais para Aquisição Única:</h4><div class="grid grid-cols-2 gap-2">`;
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

    // PRODUÇÃO E CONSUMO POR HORA (Conforme Solicitado)
    let opsBox = '';
    if ((tpl.producao?.length || 0) > 0 || (tpl.consumo?.length || 0) > 0) {
        opsBox = `<div class="space-y-4 mt-2">`;
        
        if (tpl.consumo?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-red-500 mb-2 border-b border-red-900/30 pb-1"><i class="fas fa-fire mr-1"></i> Recursos Necessários (por hora):</h4>`;
            tpl.consumo.forEach(c => {
                const item = globalState.cache.itens.get(c.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-red-950 p-2 rounded mb-1 border border-red-900/50" title="${item?.nome}">
                    <span class="flex items-center gap-2 font-bold text-slate-300 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-5 h-5 rounded"> ${item?.nome}</span>
                    <span class="font-black text-red-500 bg-red-900/20 px-2 py-0.5 rounded">-${c.quantidade || c.quantidadeBase}</span>
                </div>`;
            });
            opsBox += `</div>`;
        }
        
        if (tpl.producao?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-emerald-500 mb-2 border-b border-emerald-900/30 pb-1"><i class="fas fa-box-open mr-1"></i> Recursos Gerados (por hora):</h4>`;
            tpl.producao.forEach(p => {
                const item = globalState.cache.itens.get(p.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-emerald-950 p-2 rounded mb-1 border border-emerald-900/50" title="${item?.nome}">
                    <span class="flex items-center gap-2 font-bold text-slate-300 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-5 h-5 rounded"> ${item?.nome}</span>
                    <span class="font-black text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">+${p.quantidade || p.quantidadeBase}</span>
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
            dynamicBody = `<div class="flex flex-col items-center justify-center py-16 opacity-30 italic text-slate-500 text-xs"><i class="fas fa-box-open text-4xl mb-2"></i> Sem loots gerados para coletar.</div>`;
        } else {
            dynamicBody = `<div class="grid grid-cols-2 gap-3">`;
            armazemIds.forEach(id => {
                const it = globalState.cache.itens.get(id);
                dynamicBody += `
                    <div class="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center">
                        <img src="${it?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 object-cover rounded bg-black mb-1">
                        <span class="text-[9px] text-slate-300 font-bold truncate w-full text-center uppercase">${it?.nome}</span>
                        <span class="text-xs text-amber-500 font-black mb-2">Qtd: ${armazem[id]}</span>
                        
                        <div class="flex w-full gap-1 items-center">
                            <input type="number" id="loc_wit_${id}" value="1" min="1" max="${armazem[id]}" class="w-10 bg-slate-800 text-white text-center text-[10px] rounded border border-slate-600 outline-none p-1">
                            <button onclick="window.withdrawLocalWithInput('${selectedId}', '${id}', 'loc_wit_${id}')" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold py-1.5 rounded">Sacar</button>
                            <button onclick="window.withdrawLocalBuildingItem('${selectedId}', '${id}', 'all')" class="bg-sky-700 hover:bg-sky-500 text-white text-[9px] font-bold py-1.5 px-2 rounded">All</button>
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
            <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Estabelecimentos geram recursos por hora caso tenha as manutenções pagas.">
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
                    <i class="fas fa-industry mr-1"></i> Info / Produção
                </button>
                <button onclick="window.switchRepInnerTab('inventory')" class="flex-1 py-1.5 text-[9px] uppercase font-black rounded-lg transition-colors relative ${innerTab === 'inventory' ? 'bg-slate-800 text-sky-400 border border-sky-400/30 shadow-md' : 'text-slate-500 hover:bg-slate-900'}">
                    <i class="fas fa-box-open mr-1"></i> Armazém Local 
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
                                <i class="fas fa-hammer mr-2 text-sm"></i> Simular 1 Hora de Produção
                             </button>` : ''}
                        <button onclick="window.sellBuilding('${selectedId}', '${activeTab}')" class="w-full bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all">
                            <i class="fas fa-times-circle mr-1 text-sm"></i> ${activeTab === 'allies' ? 'Dispensar Aliado' : 'Destruir Propriedade'}
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

// 5. RENDERIZADORES DO ARMAZÉM GLOBAL (rpg_armazenamentos) - Layout em Cards
function renderStorageMochila(ficha) {
    const container = document.getElementById('storage-mochila-container');
    if (!container) return;
    const mochila = ficha.mochila || {};
    const itemIds = Object.keys(mochila).filter(id => mochila[id] > 0);

    let html = `
        <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
            <h3 class="text-amber-400 font-cinzel font-bold text-lg"><i class="fas fa-briefcase mr-2"></i> Sua Mochila</h3>
            <span class="text-[10px] font-mono text-slate-500">Enviar para o Cofre</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    `;

    if (itemIds.length === 0) {
        html += `<div class="col-span-full text-slate-500 italic text-center py-10 text-xs">A sua mochila está vazia.</div>`;
    } else {
        itemIds.forEach(id => {
            const item = globalState.cache.itens.get(id);
            if (!item) return;
            html += `
                <div class="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center">
                    <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 object-cover rounded bg-black mb-1 border border-slate-800">
                    <span class="text-[9px] text-slate-300 font-bold truncate w-full text-center uppercase">${item.nome}</span>
                    <span class="text-xs text-amber-500 font-black mb-2">Qtd: ${mochila[id]}</span>
                    
                    <div class="flex w-full gap-1 items-center">
                        <input type="number" id="dep_${id}" value="1" min="1" max="${mochila[id]}" class="w-10 bg-slate-800 text-white text-center text-[10px] rounded border border-slate-600 outline-none p-1">
                        <button onclick="window.transferWithInput('mochila', 'armazem', '${id}', 'dep_${id}')" class="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold py-1.5 rounded">Guardar</button>
                        <button onclick="window.transferGlobalStorage('mochila', 'armazem', '${id}', 'all')" class="bg-sky-700 hover:bg-sky-500 text-white text-[9px] font-bold py-1.5 px-2 rounded">All</button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderStorageVault(armazemGeral) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;
    
    const itemIds = Object.keys(armazemGeral).filter(id => typeof armazemGeral[id] === 'number' && armazemGeral[id] > 0);

    let vaultHtml = `
        <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Cofre Central sem limites. Utilize os inputs para sacar a quantidade exata de volta para a sua Mochila.">
            <i class="fas fa-question-circle text-xl"></i>
        </div>

        <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-cinzel text-xl text-sky-400 leading-tight mb-1"><i class="fas fa-warehouse mr-2"></i>Cofre Infinito</h3>
                <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest">Estoque Central do Personagem</p>
            </div>
            <div class="text-right">
                <i class="fas fa-infinity text-2xl text-slate-700"></i>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-scroll p-4 bg-slate-900/20">
            <div class="grid grid-cols-2 sm:grid-cols-2 gap-3">
    `;

    if (itemIds.length === 0) {
        vaultHtml += `<div class="col-span-full flex flex-col items-center justify-center h-full text-slate-500 opacity-40 py-10"><i class="fas fa-box-open text-5xl mb-3"></i><p class="text-xs uppercase font-bold tracking-widest">Cofre Vazio</p></div>`;
    } else {
        itemIds.forEach(id => {
            const item = globalState.cache.itens.get(id);
            if (!item) return;
            vaultHtml += `
                <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center shadow-inner">
                    <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 object-cover rounded bg-black mb-1 border border-slate-700">
                    <span class="text-[9px] text-slate-300 font-bold truncate w-full text-center uppercase">${item.nome}</span>
                    <span class="text-xs text-sky-400 font-black mb-2">Cofre: ${armazemGeral[id]}</span>
                    
                    <div class="flex w-full gap-1 items-center">
                        <input type="number" id="wit_${id}" value="1" min="1" max="${armazemGeral[id]}" class="w-10 bg-slate-800 text-white text-center text-[10px] rounded border border-slate-600 outline-none p-1">
                        <button onclick="window.transferWithInput('armazem', 'mochila', '${id}', 'wit_${id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold py-1.5 rounded">Sacar</button>
                        <button onclick="window.transferGlobalStorage('armazem', 'mochila', '${id}', 'all')" class="bg-emerald-700 hover:bg-emerald-500 text-white text-[9px] font-bold py-1.5 px-2 rounded">All</button>
                    </div>
                </div>
            `;
        });
    }

    vaultHtml += `
            </div>
        </div>
        <div class="p-4 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            <button onclick="window.collectAllToVault()" class="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-3.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg hover:scale-[1.02]">
                <i class="fas fa-truck-loading mr-2 text-sm"></i> Puxar Todas Produções Locais p/ Cofre
            </button>
        </div>
    `;

    panel.innerHTML = vaultHtml;
}

// --- LÓGICA DO FIREBASE E TRANSAÇÕES MULTI-COLEÇÃO ---

window.buyRepItem = async function(templateId, type, costRep) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return alert("Personagem não selecionado.");

    const tpl = (type === 'buildings' ? globalState.cache.buildings.get(templateId) : 
                (type === 'allies' ? globalState.cache.allies.get(templateId) : 
                globalState.cache.itens.get(templateId)));

    if (!confirm(`Desejas adquirir "${tpl.nome}"?\nReputação e materiais físicos serão consumidos da sua mochila.`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const usage = calculateReputationUsage(d);
            
            if (usage.available < costRep) throw "Reputação insuficiente.";
            
            const mochila = d.mochila || {};
            const reqs = tpl.custoMateriais || tpl.requisitos || [];
            
            for (let req of reqs) {
                if ((mochila[req.itemId] || 0) < req.quantidade) {
                    const info = globalState.cache.itens.get(req.itemId);
                    throw `Materiais físicos insuficientes: falta ${req.quantidade}x ${info?.nome || req.itemId} na Mochila.`;
                }
            }

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
                mochila[templateId] = (mochila[templateId] || 0) + 1;
            }

            t.update(ref, { recursos, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert("Falha na Aquisição: " + e); }
};

window.collectBuilding = async function(templateId) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

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
            
            for (let c of consumos) {
                if ((mochila[c.itemId] || 0) < (c.quantidade || c.quantidadeBase)) throw "Falta de recursos de manutenção na mochila para gerar a produção por hora.";
            }

            consumos.forEach(c => {
                mochila[c.itemId] -= (c.quantidade || c.quantidadeBase);
                if (mochila[c.itemId] <= 0) delete mochila[c.itemId];
            });

            const armazem = b.armazem || {};
            (tpl.producao || []).forEach(p => {
                armazem[p.itemId] = (armazem[p.itemId] || 0) + (p.quantidade || p.quantidadeBase);
            });

            b.lastCollect = Date.now();
            b.armazem = armazem;
            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
        alert("Produção gerada com sucesso! Itens no armazém da propriedade.");
    } catch (e) { alert(e); }
};

window.sellBuilding = async function(templateId, type) {
    if (!confirm("Confirmar remoção? Loots não sacados do armazém local serão perdidos e a influência será liberada.")) return;
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

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

window.withdrawLocalBuildingItem = async function(templateId, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

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

// Sincronização infinita com rpg_armazenamentos
window.transferGlobalStorage = async function(from, to, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return alert("Personagem não selecionado.");

    try {
        await runTransaction(db, async (t) => {
            const refFicha = doc(db, "rpg_fichas", charId);
            const fichaSnap = await t.get(refFicha);
            const d = fichaSnap.data();
            
            let storageId = String(charId);
            if (d.recursos && typeof d.recursos.armazemGeral === 'string' && d.recursos.armazemGeral.trim() !== '') {
                storageId = d.recursos.armazemGeral.trim();
            }

            const storageRef = doc(db, "rpg_armazenamentos", storageId);
            const storageSnap = await t.get(storageRef);
            
            const mochila = d.mochila || {};
            let storageData = storageSnap.exists() ? storageSnap.data() : {};
            
            const isNested = storageData.itens !== undefined;
            let actualArmazem = isNested ? storageData.itens : storageData;
            
            let sourceObj = from === 'mochila' ? mochila : actualArmazem;
            let destObj = to === 'mochila' ? mochila : actualArmazem;
            
            const available = sourceObj[itemId] || 0;
            if (available <= 0) return;
            
            const amount = amountRaw === 'all' ? available : Math.min(amountRaw, available);

            // Sem validação de limite de capacidade pois agora é infinito.

            sourceObj[itemId] -= amount;
            if (sourceObj[itemId] <= 0) delete sourceObj[itemId];
            destObj[itemId] = (destObj[itemId] || 0) + amount;
            
            if (isNested) storageData.itens = actualArmazem; else storageData = actualArmazem;

            t.update(refFicha, { mochila: d.mochila });
            t.set(storageRef, storageData, { merge: true });
        });
        window.renderReputacaoTab();
    } catch(e) { alert(typeof e === 'string' ? e : "Falha na transferência para o armazém."); }
};

window.collectAllToVault = async function() {
    const charId = globalState.selectedCharacterId;
    if(!charId) return alert("Personagem não selecionado.");

    try {
        await runTransaction(db, async (t) => {
            const refFicha = doc(db, "rpg_fichas", charId);
            const fichaSnap = await t.get(refFicha);
            const d = fichaSnap.data();
            const recursos = d.recursos || {};
            const estabs = recursos.estabelecimentos || [];
            
            let storageId = String(charId);
            if (recursos && typeof recursos.armazemGeral === 'string' && recursos.armazemGeral.trim() !== '') {
                storageId = recursos.armazemGeral.trim();
            }

            const storageRef = doc(db, "rpg_armazenamentos", storageId);
            const storageSnap = await t.get(storageRef);
            
            let storageData = storageSnap.exists() ? storageSnap.data() : {};
            const isNested = storageData.itens !== undefined;
            let actualArmazem = isNested ? storageData.itens : storageData;

            let collectedSomething = false;

            estabs.forEach(b => {
                const localVault = b.armazem || {};
                for (let [itemId, qty] of Object.entries(localVault)) {
                    actualArmazem[itemId] = (actualArmazem[itemId] || 0) + qty;
                    collectedSomething = true;
                }
                b.armazem = {}; 
            });
            
            if (!collectedSomething) throw "Não existem produções prontas nas propriedades.";
            
            if (isNested) storageData.itens = actualArmazem; else storageData = actualArmazem;

            recursos.estabelecimentos = estabs;
            t.update(refFicha, { recursos });
            t.set(storageRef, storageData, { merge: true });
        });
        window.renderReputacaoTab();
        alert("Todos os itens locais foram enviados ao Cofre Imperial infinito.");
    } catch(e) { alert(typeof e === 'string' ? e : "Erro ao recolher loots."); }
};
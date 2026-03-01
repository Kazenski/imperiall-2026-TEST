// ARQUIVO: js/tabs/reputacao.js

import { db, doc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

const COLET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos (padrão do sistema)

// --- GESTÃO DE ESTADO E NAVEGAÇÃO ---
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

// --- RENDERIZADOR PRINCIPAL ---
window.renderReputacaoTab = function() {
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

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
                                    <h3 class="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Influência Imperial</h3>
                                    <div class="flex gap-3 mt-1.5">
                                        <span class="text-[9px] text-slate-400 font-mono" title="Nível + Profissões"><i class="fas fa-arrow-up text-emerald-500"></i> ${repDetails.level + repDetails.profissoes}</span>
                                        <span class="text-[9px] text-slate-400 font-mono" title="Enciclopédia"><i class="fas fa-book text-sky-500"></i> ${repUsage.colecao}</span>
                                        ${repDetails.gmBonus ? `<span class="text-[9px] text-slate-400 font-mono" title="Bônus GM"><i class="fas fa-gift text-purple-500"></i> ${repDetails.gmBonus}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right border-l border-slate-800 pl-4">
                                <div class="text-2xl font-cinzel text-amber-400 leading-none">${repUsage.total}</div>
                                <div class="text-[10px] ${repUsage.available >= 0 ? 'text-emerald-400' : 'text-red-400'} font-bold mt-1">Disp: ${repUsage.available}</div>
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
                                <span class="text-[8px] text-slate-500 uppercase font-black">Cap. Carga</span>
                                <strong class="text-lg text-sky-400 font-cinzel">${ficha.recursos?.maxStorage || 50}</strong>
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

                    <div class="flex-1 overflow-y-auto custom-scroll bg-slate-950/50 border border-slate-700 rounded-xl p-4 shadow-inner">
                        <div id="rep-grid-container" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start"></div>
                    </div>
                </div>

                <div class="w-80 md:w-96 shrink-0 flex flex-col h-full relative">
                    <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col h-full relative overflow-hidden" id="rep-inspect-panel">
                        </div>
                </div>

            </div>
        `;

        renderRepGrid(ficha);
        renderRepRightPanel(ficha, repUsage);

    } catch (error) {
        console.error("Erro Fatal na Reputação:", error);
    }
};

// 3. RENDERIZA O GRID DE ÍCONES (Filtra por categoria)
function renderRepGrid(ficha) {
    const grid = document.getElementById('rep-grid-container');
    if (!grid) return;
    grid.innerHTML = '';

    const activeTab = globalState.repUI.tab;
    const selectedId = globalState.repUI.selectedId;

    let itemsToDisplay = [];
    let myResources = [];

    if (activeTab === 'buildings') {
        itemsToDisplay = [...globalState.cache.buildings.values()];
        myResources = ficha.recursos?.estabelecimentos || [];
    } else if (activeTab === 'allies') {
        itemsToDisplay = [...globalState.cache.allies.values()];
        myResources = ficha.recursos?.aliados || [];
    } else if (activeTab === 'storage') {
        // Filtra itens do cache que expandem armazenamento ou têm o slot de baú
        itemsToDisplay = [...globalState.cache.itens.values()].filter(i => i.tipoItem === 'Armazenamento' || i.categoria === 'Armazenamento' || i.slot_equipavel_id === 'bau');
    }

    const myIds = new Set(myResources.map(r => r.templateId));
    
    itemsToDisplay.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(tpl => {
        const isOwned = activeTab === 'storage' ? ((ficha.mochila || {})[tpl.id] > 0) : myIds.has(tpl.id);
        const isSelected = selectedId === tpl.id;
        
        const el = document.createElement('div');
        el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
        el.onclick = () => window.selectRepItem(activeTab, tpl.id);
        
        let border = isOwned ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-slate-800 opacity-50 grayscale hover:opacity-100 hover:grayscale-0';
        if (isSelected) border = 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)] opacity-100 grayscale-0';

        el.innerHTML = `
            <div class="w-full aspect-square bg-slate-950 rounded-xl border-2 ${border} overflow-hidden relative transition-all">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black pt-4 pb-1 text-center">
                    <span class="text-[8.5px] font-black uppercase truncate px-2 block text-slate-200">${tpl.nome}</span>
                </div>
                ${isOwned ? '<div class="absolute top-1 right-1 bg-emerald-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] shadow-lg border border-black"><i class="fas fa-check"></i></div>' : ''}
            </div>
        `;
        grid.appendChild(el);
    });
}

// 4. PAINEL DE INSPEÇÃO (Inspeciona o item selecionado e valida compras)
function renderRepRightPanel(ficha, repUsage) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const selectedId = globalState.repUI.selectedId;
    const activeTab = globalState.repUI.tab;
    const innerTab = globalState.repUI.innerTab || 'details';

    if (!selectedId) {
        panel.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-40 p-10 text-center">
                <i class="fas fa-fingerprint text-6xl mb-4"></i>
                <p class="font-cinzel text-sm uppercase tracking-widest leading-none">Inspecionar Recurso</p>
                <p class="text-[10px] mt-3 italic">Selecione um estabelecimento, aliado ou expansão de carga para gerir o seu Império.</p>
            </div>`;
        return;
    }

    const tpl = (activeTab === 'buildings' ? globalState.cache.buildings.get(selectedId) : 
                (activeTab === 'allies' ? globalState.cache.allies.get(selectedId) : 
                globalState.cache.itens.get(selectedId)));
    
    if (!tpl) return;

    const myBuildings = ficha.recursos?.estabelecimentos || [];
    const bData = myBuildings.find(b => b.templateId === selectedId);
    const isOwned = (activeTab === 'buildings' ? !!bData :
                    (activeTab === 'allies' ? !!(ficha.recursos?.aliados || []).find(a => a.templateId === selectedId) :
                    (ficha.mochila || {})[selectedId] > 0));

    // VALIDAÇÃO DE CUSTOS (Reputação + Itens Físicos)
    let canAffordRep = repUsage.available >= (tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0);
    let canAffordMats = true;
    let matsHtml = '';

    const requirements = tpl.custoMateriais || tpl.requisitos || [];
    if (requirements.length > 0) {
        matsHtml = `<div class="mt-4"><h4 class="text-[9px] uppercase font-black text-slate-500 mb-2 border-b border-slate-700 pb-1">Recursos para Aquisição:</h4><div class="grid grid-cols-2 gap-2">`;
        requirements.forEach(req => {
            const itemReq = globalState.cache.itens.get(req.itemId);
            const has = (ficha.mochila || {})[req.itemId] || 0;
            const enough = has >= req.quantidade;
            if (!enough) canAffordMats = false;
            matsHtml += `
                <div class="flex items-center gap-2 bg-slate-900 border ${enough ? 'border-emerald-900/40' : 'border-red-900/40'} p-2 rounded relative" title="Você tem ${has} / Necessita de ${req.quantidade}x ${itemReq?.nome || 'Material'}">
                    <img src="${itemReq?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-6 h-6 rounded shrink-0">
                    <span class="text-[10px] font-bold font-mono ${enough ? 'text-emerald-400' : 'text-red-400'}">${has}/${req.quantidade}</span>
                </div>`;
        });
        matsHtml += `</div></div>`;
    }

    // PRODUÇÃO E CONSUMO POR DIA (Visualização nítida)
    let prodBox = '';
    if ((tpl.producao?.length || 0) > 0 || (tpl.consumo?.length || 0) > 0) {
        prodBox = `<div class="space-y-4 mt-2">`;
        
        if (tpl.consumo?.length > 0) {
            prodBox += `<div><h4 class="text-[9px] uppercase font-black text-red-500 mb-2 border-b border-red-900/20 pb-1">Materiais Necessários p/ Operar:</h4>`;
            tpl.consumo.forEach(c => {
                const item = globalState.cache.itens.get(c.itemId);
                prodBox += `<div class="flex justify-between items-center text-[10px] bg-red-900/10 p-1.5 rounded mb-1 border border-red-900/20" title="${item?.nome}">
                    <span class="flex items-center gap-2 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-bold text-red-500">-${c.quantidade || c.quantidadeBase} / dia</span>
                </div>`;
            });
            prodBox += `</div>`;
        }

        if (tpl.producao?.length > 0) {
            prodBox += `<div><h4 class="text-[9px] uppercase font-black text-emerald-500 mb-2 border-b border-emerald-900/20 pb-1">Materiais Produzidos p/ Ciclo:</h4>`;
            tpl.producao.forEach(p => {
                const item = globalState.cache.itens.get(p.itemId);
                prodBox += `<div class="flex justify-between items-center text-[10px] bg-emerald-900/10 p-1.5 rounded mb-1 border border-emerald-900/20" title="${item?.nome}">
                    <span class="flex items-center gap-2 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-bold text-emerald-400">+${p.quantidade || p.quantidadeBase} / ciclo</span>
                </div>`;
            });
            prodBox += `</div>`;
        }
        prodBox += `</div>`;
    }

    const costRep = tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0;

    // CONTEÚDO DINÂMICO CENTRAL (Abas de Dados vs Armazém)
    let centralContent = '';
    if (activeTab === 'buildings' && isOwned && innerTab === 'inventory') {
        const armazem = bData.armazem || {};
        const ids = Object.keys(armazem);
        if (ids.length === 0) {
            centralContent = `<div class="flex flex-col items-center justify-center py-16 opacity-30 italic text-slate-500 text-xs"><i class="fas fa-box-open text-4xl mb-2"></i> O armazém está vazio.</div>`;
        } else {
            centralContent = `<div class="grid grid-cols-2 gap-3">`;
            ids.forEach(id => {
                const it = globalState.cache.itens.get(id);
                centralContent += `
                    <div onclick="window.withdrawBuildingItem('${selectedId}', '${id}')" class="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col items-center cursor-pointer group hover:border-sky-500 transition relative overflow-hidden">
                        <img src="${it?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-12 h-12 object-cover rounded bg-black mb-2 group-hover:scale-110 transition">
                        <div class="text-[8px] text-slate-400 font-bold truncate w-full text-center uppercase">${it?.nome}</div>
                        <div class="text-xs text-amber-500 font-black">x${armazem[id]}</div>
                        <div class="absolute inset-0 bg-sky-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity"><span class="text-[10px] text-white font-black uppercase tracking-wider">Sacar Item</span></div>
                    </div>`;
            });
            centralContent += `</div>`;
        }
    } else {
        centralContent = `
            <p class="text-[11px] text-slate-300 leading-relaxed italic border-l-2 border-slate-600 pl-3 mb-6">${escapeHTML(tpl.descricao)}</p>
            ${prodBox}
            ${!isOwned ? matsHtml : ''}
            
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center" title="Reputação reservada para este recurso.">
                    <span class="block text-[8px] text-slate-500 uppercase font-black">Custo Rep.</span>
                    <strong class="${canAffordRep ? 'text-white' : 'text-red-500'} font-cinzel text-lg leading-none">${costRep}</strong>
                </div>
                <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center" title="Bônus concedido de armazenamento.">
                    <span class="block text-[8px] text-slate-500 uppercase font-black">Carga Extra</span>
                    <strong class="text-sky-400 font-cinzel text-lg leading-none">${tpl.bonusCapacidadeMochila || 0}</strong>
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        <div class="flex flex-col h-full animate-fade-in">
            <div class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-help z-10" title="Informações de Gestão: Estabelecimentos e Aliados expandem o seu poder econômico. Adquirir novos recursos consome sua Reputação disponível e exige materiais físicos da mochila principal.">
                <i class="fas fa-question-circle text-xl"></i>
            </div>

            <div class="p-8 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                <div class="w-32 h-32 rounded-2xl bg-black border-2 ${isOwned ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-600'} overflow-hidden mb-4 transition-transform hover:scale-105">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                </div>
                <h3 class="font-cinzel text-2xl ${isOwned ? 'text-amber-400' : 'text-slate-300'} text-center leading-tight mb-1 drop-shadow-md px-4">${tpl.nome}</h3>
                <p class="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">${tpl.funcao || (activeTab === 'storage' ? 'Expansão de Carga' : 'Recurso Imperial')}</p>
            </div>

            ${activeTab === 'buildings' && isOwned ? `
            <div class="flex p-2 bg-slate-950 border-b border-slate-700 shrink-0 gap-2">
                <button onclick="window.switchRepInnerTab('details')" class="flex-1 py-2 text-[9px] uppercase font-black rounded-lg transition-colors ${innerTab === 'details' ? 'bg-slate-800 text-amber-500 border border-amber-500/30' : 'text-slate-500 hover:bg-slate-900'}">
                    <i class="fas fa-industry mr-1"></i> Produção
                </button>
                <button onclick="window.switchRepInnerTab('inventory')" class="flex-1 py-2 text-[9px] uppercase font-black rounded-lg transition-colors relative ${innerTab === 'inventory' ? 'bg-slate-800 text-sky-400 border border-sky-400/30' : 'text-slate-500 hover:bg-slate-900'}">
                    <i class="fas fa-warehouse mr-1"></i> Armazém 
                    ${Object.keys(bData.armazem || {}).length > 0 ? '<span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow"></span>' : ''}
                </button>
            </div>` : ''}

            <div class="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-900/20">
                ${centralContent}
            </div>

            <div class="p-4 bg-slate-900 border-t border-slate-700 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                ${isOwned 
                    ? `<div class="flex flex-col gap-2">
                        ${(activeTab === 'buildings' && (Date.now() - (bData.lastCollect || 0)) >= COLET_COOLDOWN_MS) ? 
                            `<button onclick="window.collectBuilding('${selectedId}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-[11px] uppercase shadow-lg transition-transform hover:scale-[1.02] animate-pulse">
                                <i class="fas fa-hammer mr-2 text-sm"></i> Iniciar Produção
                             </button>` : ''}
                        <button onclick="window.sellBuilding('${selectedId}', '${activeTab}')" class="w-full bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all">
                            <i class="fas fa-times-circle mr-1"></i> ${activeTab === 'allies' ? 'Dispensar Aliado' : 'Vender Propriedade'}
                        </button>
                       </div>`
                    : `<button onclick="window.buyRepItem('${selectedId}', '${activeTab}', ${costRep})" 
                        class="w-full ${canAffordRep && canAffordMats ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-lg hover:scale-[1.02]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} py-3.5 rounded-xl text-[11px] font-black uppercase transition-all"
                        ${!(canAffordRep && canAffordMats) ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart mr-1"></i> Adquirir Recurso
                       </button>`
                }
            </div>
        </div>
    `;
}

// --- FUNÇÕES DE BANCO DE DADOS (TRANSAÇÕES) ---

window.buyRepItem = async function(templateId, type, costRep) {
    const charId = globalState.selectedCharacterId;
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
            
            if (usage.available < costRep) throw "Reputação insuficiente para esta aquisição.";
            
            const mochila = d.mochila || {};
            const requirements = tpl.custoMateriais || tpl.requisitos || [];
            
            // Validação de itens na mochila
            for (let req of requirements) {
                if ((mochila[req.itemId] || 0) < req.quantidade) {
                    const itemInfo = globalState.cache.itens.get(req.itemId);
                    throw `Materiais insuficientes: falta ${req.quantidade}x ${itemInfo?.nome || req.itemId}`;
                }
            }

            // Executa o consumo de materiais
            requirements.forEach(req => {
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
                // Para itens de armazenamento, apenas garante a posse do item na mochila
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
            
            // Valida materiais de manutenção para o ciclo de produção
            for (let c of consumos) {
                if ((mochila[c.itemId] || 0) < (c.quantidade || c.quantidadeBase)) {
                    const info = globalState.cache.itens.get(c.itemId);
                    throw `Manutenção insuficiente: você precisa de ${c.quantidade || c.quantidadeBase}x ${info?.nome || c.itemId} na mochila para operar.`;
                }
            }

            // Executa consumo de manutenção
            consumos.forEach(c => {
                mochila[c.itemId] -= (c.quantidade || c.quantidadeBase);
                if (mochila[c.itemId] <= 0) delete mochila[c.itemId];
            });

            // Gera Itens no Armazém Temporário do Prédio
            const armazem = b.armazem || {};
            (tpl.producao || []).forEach(p => {
                armazem[p.itemId] = (armazem[p.itemId] || 0) + (p.quantidade || p.quantidadeBase);
            });

            b.lastCollect = Date.now();
            b.armazem = armazem;
            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
        alert("Recursos produzidos com sucesso e enviados ao armazém da propriedade!");
    } catch (e) { alert(e); }
};

window.withdrawBuildingItem = async function(templateId, itemId) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const estabs = d.recursos?.estabelecimentos || [];
            const b = estabs.find(e => e.templateId === templateId);
            const qtd = b.armazem[itemId];

            if (!qtd) return;

            // Transfere do armazém para a mochila principal
            delete b.armazem[itemId];
            const mochila = d.mochila || {};
            mochila[itemId] = (mochila[itemId] || 0) + qtd;

            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert("Erro ao transferir item."); }
};

window.sellBuilding = async function(templateId, type) {
    if (!confirm("Confirmar remoção? Todos os recursos no armazém desta propriedade serão PERDIDOS e a reputação será liberada.")) return;
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const rec = d.recursos || {};
            if (type === 'buildings') rec.estabelecimentos = (rec.estabelecimentos || []).filter(e => e.templateId !== templateId);
            else rec.aliados = (rec.aliados || []).filter(a => a.templateId !== templateId);
            t.update(ref, { recursos: rec });
        });
        globalState.repUI.selectedId = null;
        window.renderReputacaoTab();
    } catch (e) { console.error(e); }
};
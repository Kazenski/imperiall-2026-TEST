import { db, doc, getDoc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

const COLET_COOLDOWN_MS = 10 * 60 * 1000;

// --- GESTÃO DE ESTADO DA INTERFACE ---
window.switchRepTab = function(tabName) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details', shopCategory: 'buildings', showHelp: false };
    globalState.repUI.tab = tabName;
    globalState.repUI.selectedId = null; 
    globalState.repUI.showHelp = false;
    
    if (tabName === 'shop' && !globalState.repUI.shopCategory) globalState.repUI.shopCategory = 'buildings';

    window.renderReputacaoTab();
};

window.selectRepItem = function(tab, id) {
    if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details', showHelp: false };
    globalState.repUI.selectedId = id;
    globalState.repUI.innerTab = 'details';
    globalState.repUI.showHelp = false;
    window.renderReputacaoTab();
};

window.switchRepInnerTab = function(tabName) {
    if (!globalState.repUI) return;
    globalState.repUI.innerTab = tabName;
    window.renderReputacaoTab();
};

window.switchShopCategory = function(category) {
    if (!globalState.repUI) return;
    globalState.repUI.shopCategory = category;
    globalState.repUI.selectedId = null;
    globalState.repUI.showHelp = false;
    window.renderReputacaoTab();
};

window.toggleRepHelp = function() {
    if (!globalState.repUI) return;
    globalState.repUI.showHelp = !globalState.repUI.showHelp;
    window.renderReputacaoTab();
}

window.transferWithInput = function(from, to, itemId, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let val = parseInt(inputEl.value);
    if (isNaN(val) || val <= 0) return alert("Insira um valor numérico válido.");
    window.transferGlobalStorage(from, to, itemId, val);
};

window.withdrawLocalWithInput = function(instanceId, itemId, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let val = parseInt(inputEl.value);
    if (isNaN(val) || val <= 0) return alert("Insira um valor numérico válido.");
    window.withdrawLocalBuildingItem(instanceId, itemId, val);
};

// --- CÁLCULO DE CAPACIDADE DO ARMAZÉM ---
function calculateStorageCapacity(ficha) {
    let armazemCap = 50; 
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
export async function renderReputacaoTab() {
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) return;

    window.renderReputacaoTab = renderReputacaoTab;

    try {
        const charId = globalState.selectedCharacterId;
        const charData = globalState.selectedCharacterData;
        
        if (!charId || !charData || !charData.ficha) {
            container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
            return;
        }

        if (!globalState.repUI) globalState.repUI = { tab: 'buildings', selectedId: null, innerTab: 'details', shopCategory: 'buildings', showHelp: false };
        const activeTab = globalState.repUI.tab;
        
        const ficha = charData.ficha;
        const repUsage = calculateReputationUsage(ficha);
        const repDetails = calculateReputationDetails(ficha);
        const maxStorage = calculateStorageCapacity(ficha);

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
            } catch (e) { console.error("Erro cofre:", e); }
        }

        let totalGuardado = 0;
        Object.values(armazemGeral).forEach(v => { if (typeof v === 'number') totalGuardado += v; });

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
                                <span class="text-[8px] text-slate-500 uppercase font-black">Exército/Aliados</span>
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
                            <i class="fas fa-city mr-1"></i> Meu Império
                        </button>
                        <button onclick="window.switchRepTab('allies')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'allies' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-users mr-1"></i> Meu Exército
                        </button>
                        <button onclick="window.switchRepTab('storage')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'storage' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-boxes mr-1"></i> Cofre Imperial
                        </button>
                        <button onclick="window.switchRepTab('shop')" class="flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${activeTab === 'shop' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}">
                            <i class="fas fa-shopping-cart mr-1"></i> Loja & Aluguel
                        </button>
                    </div>

                    ${activeTab === 'shop' ? `
                        <div class="flex gap-2 mb-2">
                            <button onclick="window.switchShopCategory('buildings')" class="flex-1 py-1 text-[9px] uppercase font-bold rounded ${globalState.repUI.shopCategory === 'buildings' ? 'bg-slate-700 text-amber-400' : 'bg-slate-900 text-slate-500'}">Terrenos & Propriedades</button>
                            <button onclick="window.switchShopCategory('allies')" class="flex-1 py-1 text-[9px] uppercase font-bold rounded ${globalState.repUI.shopCategory === 'allies' ? 'bg-slate-700 text-sky-400' : 'bg-slate-900 text-slate-500'}">Contratos & Mercenários</button>
                            <button onclick="window.switchShopCategory('storage')" class="flex-1 py-1 text-[9px] uppercase font-bold rounded ${globalState.repUI.shopCategory === 'storage' ? 'bg-slate-700 text-purple-400' : 'bg-slate-900 text-slate-500'}">Expansões de Carga</button>
                        </div>
                    ` : ''}

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
        } else if (activeTab === 'shop') {
            renderShopGrid();
            renderShopInspector(ficha, repUsage);
        } else {
            renderMyEmpireGrid(ficha);
            renderMyEmpireInspector(ficha);
        }

    } catch (error) {
        console.error("Erro na Aba Reputação:", error);
    }
}

// ------------------------------------------------------------------
// 1. MEU IMPÉRIO E EXÉRCITO
// ------------------------------------------------------------------
function renderMyEmpireGrid(ficha) {
    const grid = document.getElementById('rep-grid-container');
    if (!grid) return;
    grid.innerHTML = '';
    
    const activeTab = globalState.repUI.tab;
    const selectedId = globalState.repUI.selectedId;

    let myResources = activeTab === 'buildings' ? (ficha.recursos?.estabelecimentos || []) : (ficha.recursos?.aliados || []);
    
    if (myResources.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 italic">Nenhum registro encontrado. Vá à loja para adquirir.</div>`;
        return;
    }

    myResources.forEach((inst, index) => {
        const cacheMap = activeTab === 'buildings' ? globalState.cache.buildings : globalState.cache.allies;
        const tpl = cacheMap.get(inst.templateId);
        if (!tpl) return;

        const isSelected = selectedId === index.toString(); 
        const border = isSelected ? 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)]' : 'border-slate-700 hover:border-slate-500';

        let extraBadge = '';
        if (activeTab === 'buildings') {
            const workers = inst.trabalhadores || [];
            extraBadge = `<div class="absolute top-1 right-1 bg-black/80 border border-slate-700 text-slate-300 text-[8px] font-mono px-1 rounded shadow"><i class="fas fa-users mr-1 text-sky-400"></i>${workers.length}/${tpl.vagas || 0}</div>`;
        }

        const el = document.createElement('div');
        el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
        el.onclick = () => window.selectRepItem(activeTab, index.toString());
        
        el.innerHTML = `
            <div class="w-full aspect-square bg-slate-950 rounded-xl border-2 ${border} overflow-hidden relative transition-all">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100">
                <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black pt-4 pb-1 text-center px-1">
                    <span class="text-[8.5px] font-black uppercase truncate block text-amber-400">ID: #${index+1}</span>
                    <span class="text-[8px] font-bold uppercase truncate block text-slate-300">${tpl.nome}</span>
                </div>
                ${extraBadge}
            </div>
        `;
        grid.appendChild(el);
    });
}

function renderMyEmpireInspector(ficha) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const activeTab = globalState.repUI.tab;
    const selectedIdx = globalState.repUI.selectedId;
    const innerTab = globalState.repUI.innerTab || 'details';
    const showHelp = globalState.repUI.showHelp;

    if (showHelp) {
        panel.innerHTML = renderHelpPanel();
        return;
    }

    if (!selectedIdx) {
        panel.innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-40 p-10 text-center"><i class="fas fa-chess-rook text-6xl mb-4"></i><p class="font-cinzel text-sm uppercase tracking-widest">Gestão de Instância</p></div>
        <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10 p-2"><i class="fas fa-question-circle text-xl"></i></button>`;
        return;
    }

    const resourcesArray = activeTab === 'buildings' ? (ficha.recursos?.estabelecimentos || []) : (ficha.recursos?.aliados || []);
    const inst = resourcesArray[parseInt(selectedIdx)];
    if (!inst) return;

    const cacheMap = activeTab === 'buildings' ? globalState.cache.buildings : globalState.cache.allies;
    const tpl = cacheMap.get(inst.templateId);
    if (!tpl) return;

    if (activeTab === 'buildings') {
        const vagasTotal = tpl.vagas || 0;
        const trabalhadores = inst.trabalhadores || []; 
        
        let opsBox = `<div class="bg-slate-950/80 p-3 rounded-xl border border-slate-700 shadow-inner mb-4">
            <h4 class="text-[9px] uppercase font-black text-slate-500 mb-2 border-b border-slate-800 pb-1">Operação (Por Hora)</h4>`;
        
        if (tpl.consumo?.length > 0) {
            tpl.consumo.forEach(c => {
                const i = globalState.cache.itens.get(c.itemId);
                opsBox += `<div class="flex justify-between text-[10px] mb-1"><span class="text-slate-400">${i?.nome}</span><span class="text-red-500 font-bold">-${c.quantidadeBase}</span></div>`;
            });
        } else { opsBox += `<p class="text-[9px] text-slate-500 italic">Nenhum custo de manutenção.</p>`; }

        if (tpl.producao?.length > 0) {
            opsBox += `<div class="mt-2 pt-2 border-t border-slate-800">`;
            tpl.producao.forEach(p => {
                const i = globalState.cache.itens.get(p.itemId);
                opsBox += `<div class="flex justify-between text-[10px] mb-1"><span class="text-slate-300">${i?.nome}</span><span class="text-emerald-400 font-bold">+${p.quantidadeBase}</span></div>`;
            });
            opsBox += `</div>`;
        }
        opsBox += `</div>`;

        let workersHtml = `<div class="mb-4"><h4 class="text-[9px] uppercase font-black text-sky-400 mb-2 border-b border-sky-900/50 pb-1"><i class="fas fa-users mr-1"></i> Trabalhadores Alocados (${trabalhadores.length}/${vagasTotal})</h4>`;
        
        if (vagasTotal === 0) {
            workersHtml += `<p class="text-[9px] italic text-slate-500">Este local não suporta trabalhadores.</p>`;
        } else {
            workersHtml += `<div class="space-y-2">`;
            for (let i = 0; i < vagasTotal; i++) {
                const allyIdx = trabalhadores[i];
                if (allyIdx !== undefined) {
                    const allyInst = ficha.recursos.aliados[allyIdx];
                    const allyTpl = allyInst ? globalState.cache.allies.get(allyInst.templateId) : null;
                    workersHtml += `
                        <div class="flex justify-between items-center bg-slate-900 border border-slate-700 p-1.5 rounded">
                            <div class="flex items-center gap-2">
                                <img src="${allyTpl?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-6 h-6 rounded-full object-cover">
                                <span class="text-[9px] text-slate-200 font-bold">${allyTpl?.nome || 'Desconhecido'}</span>
                            </div>
                            <button onclick="window.unassignWorker('${selectedIdx}', ${allyIdx})" class="text-red-500 hover:text-red-400 text-[10px]"><i class="fas fa-user-minus"></i></button>
                        </div>
                    `;
                } else {
                    let options = `<option value="">-- Escalar Aliado Livre --</option>`;
                    const allAllies = ficha.recursos?.aliados || [];
                    allAllies.forEach((a, aIdx) => {
                        let isWorking = false;
                        (ficha.recursos?.estabelecimentos || []).forEach(est => {
                            if (est.trabalhadores && est.trabalhadores.includes(aIdx)) isWorking = true;
                        });
                        if (!isWorking) {
                            const aTpl = globalState.cache.allies.get(a.templateId);
                            options += `<option value="${aIdx}">#${aIdx+1} - ${aTpl?.nome}</option>`;
                        }
                    });

                    workersHtml += `
                        <div class="flex gap-1">
                            <select id="assign_sel_${i}" class="flex-1 bg-slate-950 border border-slate-700 text-[9px] text-slate-400 rounded outline-none p-1">${options}</select>
                            <button onclick="window.assignWorker('${selectedIdx}', 'assign_sel_${i}')" class="bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded text-[9px] font-bold">Alocar</button>
                        </div>
                    `;
                }
            }
            workersHtml += `</div>`;
        }
        workersHtml += `</div>`;

        let centerContent = '';
        if (innerTab === 'inventory') {
            const armazem = inst.armazem || {};
            const keys = Object.keys(armazem);
            if (keys.length === 0) {
                centerContent = `<div class="text-center text-slate-500 opacity-50 py-10"><i class="fas fa-box-open text-4xl mb-2 block"></i><span class="text-[10px] uppercase font-bold">Armazém Local Vazio</span></div>`;
            } else {
                centerContent = `<div class="grid grid-cols-2 gap-2">`;
                keys.forEach(k => {
                    const it = globalState.cache.itens.get(k);
                    centerContent += `
                        <div class="bg-slate-900 border border-slate-700 rounded p-2 text-center relative group">
                            <img src="${it?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 mx-auto object-cover rounded mb-1">
                            <div class="text-[8px] font-bold text-slate-300 truncate">${it?.nome}</div>
                            <div class="text-[10px] text-amber-500 font-black mb-1">x${armazem[k]}</div>
                            <div class="flex gap-1 w-full mt-1">
                                <input type="number" id="loc_wit_${k}" value="1" min="1" max="${armazem[k]}" class="w-8 bg-slate-950 text-white text-[9px] text-center border border-slate-600 rounded">
                                <button onclick="window.withdrawLocalWithInput('${selectedIdx}', '${k}', 'loc_wit_${k}')" class="flex-1 bg-sky-600 text-white text-[9px] rounded">Sacar</button>
                            </div>
                        </div>
                    `;
                });
                centerContent += `</div>`;
            }
        } else {
            centerContent = `${opsBox}${workersHtml}`;
        }

        panel.innerHTML = `
            <div class="flex flex-col h-full relative">
                <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10 p-2"><i class="fas fa-question-circle text-xl"></i></button>
                <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                    <div class="w-24 h-24 rounded-xl bg-black border-2 border-amber-500 overflow-hidden mb-2 relative">
                        <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                        <div class="absolute top-0 right-0 bg-amber-500 text-black font-black text-[9px] px-1 rounded-bl">#${parseInt(selectedIdx)+1}</div>
                    </div>
                    <h3 class="font-cinzel text-xl text-amber-400 text-center leading-tight mb-1">${tpl.nome}</h3>
                    <p class="text-[9px] text-slate-500 uppercase font-black">${tpl.funcao || 'Estabelecimento'}</p>
                </div>
                
                <div class="flex p-2 bg-slate-950 border-b border-slate-700 shrink-0 gap-2">
                    <button onclick="window.switchRepInnerTab('details')" class="flex-1 py-1.5 text-[9px] uppercase font-black rounded-lg transition-colors ${innerTab === 'details' ? 'bg-slate-800 text-amber-500 border border-amber-500/30 shadow-md' : 'text-slate-500 hover:bg-slate-900'}">Gestão</button>
                    <button onclick="window.switchRepInnerTab('inventory')" class="flex-1 py-1.5 text-[9px] uppercase font-black rounded-lg transition-colors ${innerTab === 'inventory' ? 'bg-slate-800 text-sky-400 border border-sky-400/30 shadow-md' : 'text-slate-500 hover:bg-slate-900'}">Armazém Local</button>
                </div>

                <div class="flex-1 overflow-y-auto custom-scroll p-4 bg-slate-900/20">
                    ${centerContent}
                </div>

                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <button onclick="window.collectBuilding('${selectedIdx}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg text-[10px] uppercase shadow-lg animate-pulse mb-2"><i class="fas fa-hammer mr-1"></i> Simular 1 Hora de Produção</button>
                    <button onclick="window.sellInstance('buildings', '${selectedIdx}')" class="w-full bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-2 rounded-lg text-[9px] font-black uppercase transition-all"><i class="fas fa-bomb mr-1"></i> Destruir Propriedade</button>
                </div>
            </div>
        `;
    } 
    else if (activeTab === 'allies') {
        let isWorkingAt = null;
        (ficha.recursos?.estabelecimentos || []).forEach((est, eIdx) => {
            if (est.trabalhadores && est.trabalhadores.includes(parseInt(selectedIdx))) {
                const estTpl = globalState.cache.buildings.get(est.templateId);
                isWorkingAt = `Trabalhando em: ${estTpl?.nome} #${eIdx+1}`;
            }
        });

        panel.innerHTML = `
            <div class="flex flex-col h-full relative">
                <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10 p-2"><i class="fas fa-question-circle text-xl"></i></button>
                <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                    <div class="w-24 h-24 rounded-full bg-black border-4 border-sky-500 overflow-hidden mb-2 relative">
                        <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                    </div>
                    <h3 class="font-cinzel text-xl text-sky-400 text-center leading-tight mb-1">${tpl.nome} <span class="text-xs text-slate-500 ml-1">#${parseInt(selectedIdx)+1}</span></h3>
                    <p class="text-[9px] text-amber-500 uppercase font-black">${tpl.funcao || 'Mercenário'}</p>
                </div>

                <div class="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-900/20">
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center mb-4">
                        <span class="block text-[9px] text-slate-500 uppercase font-black mb-1">Status de Alocação</span>
                        <strong class="text-xs ${isWorkingAt ? 'text-amber-400' : 'text-emerald-400'} font-mono">${isWorkingAt || 'Livre / Aguardando Ordens'}</strong>
                    </div>
                    <p class="text-[10px] text-slate-300 italic leading-relaxed border-l-2 border-slate-600 pl-3">${escapeHTML(tpl.descricao)}</p>
                </div>

                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <button onclick="window.sellInstance('allies', '${selectedIdx}')" class="w-full bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 py-3 rounded-lg text-[10px] font-black uppercase transition-all"><i class="fas fa-user-times mr-1"></i> Dispensar Aliado</button>
                </div>
            </div>
        `;
    }
}

// ------------------------------------------------------------------
// 2. LOJA IMPERIAL (COMPRA CLARA DE PRODUÇÃO E CONSUMO)
// ------------------------------------------------------------------
function renderShopGrid() {
    const grid = document.getElementById('rep-grid-container');
    if (!grid) return;
    grid.innerHTML = '';

    const cat = globalState.repUI.shopCategory || 'buildings';
    const selectedId = globalState.repUI.selectedId;

    let itemsToDisplay = [];
    if (cat === 'buildings') itemsToDisplay = [...globalState.cache.buildings.values()];
    else if (cat === 'allies') itemsToDisplay = [...globalState.cache.allies.values()];
    else if (cat === 'storage') itemsToDisplay = [...globalState.cache.itens.values()].filter(i => i.tipoItem === 'Armazenamento' || i.categoria === 'Armazenamento' || i.slot_equipavel_id === 'bau');

    itemsToDisplay.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(tpl => {
        const isSelected = selectedId === tpl.id;
        const border = isSelected ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-slate-700 hover:border-slate-500';

        const el = document.createElement('div');
        el.className = 'relative group cursor-pointer hover:-translate-y-1 transition-transform';
        el.onclick = () => {
            globalState.repUI.selectedId = tpl.id;
            window.renderReputacaoTab();
        };

        el.innerHTML = `
            <div class="w-full aspect-square bg-slate-950 rounded-xl border-2 ${border} overflow-hidden relative transition-all">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity">
                <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black pt-4 pb-1 text-center px-1">
                    <span class="text-[8px] font-black uppercase truncate block text-slate-200">${tpl.nome}</span>
                </div>
                <div class="absolute top-1 right-1 bg-black/80 border border-slate-700 text-amber-400 text-[8px] font-mono px-1.5 py-0.5 rounded shadow">${tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0} REP</div>
            </div>
        `;
        grid.appendChild(el);
    });
}

function renderShopInspector(ficha, repUsage) {
    const panel = document.getElementById('rep-inspect-panel');
    if (!panel) return;

    const cat = globalState.repUI.shopCategory;
    const selectedId = globalState.repUI.selectedId;
    const showHelp = globalState.repUI.showHelp;

    if (showHelp) {
        panel.innerHTML = renderHelpPanel();
        return;
    }

    if (!selectedId) {
        panel.innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-40 p-10 text-center"><i class="fas fa-shopping-cart text-6xl mb-4"></i><p class="font-cinzel text-sm uppercase tracking-widest">Loja Imperial</p></div>
        <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10 p-2"><i class="fas fa-question-circle text-xl"></i></button>`;
        return;
    }

    let tpl;
    if (cat === 'buildings') tpl = globalState.cache.buildings.get(selectedId);
    else if (cat === 'allies') tpl = globalState.cache.allies.get(selectedId);
    else tpl = globalState.cache.itens.get(selectedId);

    if (!tpl) return;

    const costRep = tpl.reputacaoCusto || tpl.reputacaoCustoBase || 0;
    
    let qtdPosse = 0;
    if (cat === 'buildings') qtdPosse = (ficha.recursos?.estabelecimentos || []).filter(e => e.templateId === selectedId).length;
    else if (cat === 'allies') qtdPosse = (ficha.recursos?.aliados || []).filter(a => a.templateId === selectedId).length;
    else qtdPosse = (ficha.mochila || {})[selectedId] || 0;

    let canAffordRep = repUsage.available >= costRep;
    let canAffordMats = true;
    let purchaseMatsHtml = '';

    const buyRequirements = tpl.custoMateriais || tpl.requisitos || [];
    if (buyRequirements.length > 0) {
        purchaseMatsHtml = `<div class="mt-4"><h4 class="text-[9px] uppercase font-black text-amber-500 mb-2 border-b border-amber-500/20 pb-1">Custo de Construção/Contrato (Requerido na Mochila):</h4><div class="grid grid-cols-2 gap-2">`;
        buyRequirements.forEach(req => {
            const itemReq = globalState.cache.itens.get(req.itemId);
            const has = (ficha.mochila || {})[req.itemId] || 0;
            const enough = has >= req.quantidade;
            if (!enough) canAffordMats = false;
            purchaseMatsHtml += `
                <div class="flex items-center gap-2 bg-slate-900 border ${enough ? 'border-emerald-900/40' : 'border-red-900/40'} p-2 rounded">
                    <img src="${itemReq?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-6 h-6 rounded shrink-0">
                    <span class="text-[10px] font-bold font-mono ${enough ? 'text-emerald-400' : 'text-red-400'}">${has} / ${req.quantidade}</span>
                </div>`;
        });
        purchaseMatsHtml += `</div></div>`;
    }

    let opsBox = '';
    if ((tpl.producao?.length || 0) > 0 || (tpl.consumo?.length || 0) > 0) {
        opsBox = `<div class="space-y-4 mt-4">`;
        if (tpl.consumo?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-red-500 mb-2 border-b border-red-900/30 pb-1"><i class="fas fa-fire mr-1"></i> Custo de Operação (Gasto p/ Hora):</h4>`;
            tpl.consumo.forEach(c => {
                const item = globalState.cache.itens.get(c.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-red-950 p-1.5 rounded mb-1 border border-red-900/50">
                    <span class="flex items-center gap-2 font-bold text-slate-300 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-black text-red-500">-${c.quantidade || c.quantidadeBase}</span>
                </div>`;
            });
            opsBox += `</div>`;
        }
        if (tpl.producao?.length > 0) {
            opsBox += `<div><h4 class="text-[9px] uppercase font-black text-emerald-500 mb-2 border-b border-emerald-900/30 pb-1"><i class="fas fa-box-open mr-1"></i> Produção Diária (Gerado p/ Hora):</h4>`;
            tpl.producao.forEach(p => {
                const item = globalState.cache.itens.get(p.itemId);
                opsBox += `<div class="flex justify-between items-center text-[10px] bg-emerald-950 p-1.5 rounded mb-1 border border-emerald-900/50">
                    <span class="flex items-center gap-2 font-bold text-slate-300 truncate"><img src="${item?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-4 h-4 rounded"> ${item?.nome}</span>
                    <span class="font-black text-emerald-400">+${p.quantidade || p.quantidadeBase}</span>
                </div>`;
            });
            opsBox += `</div>`;
        }
        opsBox += `</div>`;
    }

    panel.innerHTML = `
        <div class="flex flex-col h-full relative animate-fade-in">
            <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10 p-2"><i class="fas fa-question-circle text-xl"></i></button>

            <div class="p-8 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                <div class="w-24 h-24 rounded-2xl bg-black border-2 border-slate-600 overflow-hidden mb-4">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                </div>
                <h3 class="font-cinzel text-xl text-slate-200 text-center leading-tight mb-1">${tpl.nome}</h3>
                <p class="text-[9px] text-emerald-500 uppercase font-black bg-emerald-900/20 px-2 py-0.5 rounded">Em posse: ${qtdPosse}</p>
            </div>

            <div class="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-900/20">
                <p class="text-[10px] text-slate-300 leading-relaxed italic border-l-2 border-slate-600 pl-3 mb-4">${escapeHTML(tpl.descricao)}</p>
                
                <div class="grid grid-cols-2 gap-4 mt-2">
                    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center shadow-inner">
                        <span class="block text-[8px] text-slate-500 uppercase font-black">Reputação/Influência</span>
                        <strong class="${canAffordRep ? 'text-white' : 'text-red-500'} font-cinzel text-lg">${costRep}</strong>
                    </div>
                    ${cat === 'buildings' ? `<div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center shadow-inner"><span class="block text-[8px] text-slate-500 uppercase font-black">Vagas de Trab.</span><strong class="text-sky-400 font-cinzel text-lg">${tpl.vagas || 0}</strong></div>` : ''}
                    ${cat === 'storage' ? `<div class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center shadow-inner"><span class="block text-[8px] text-slate-500 uppercase font-black">Carga Adicional</span><strong class="text-purple-400 font-cinzel text-lg">+${tpl.bonusCapacidadeMochila || 0}</strong></div>` : ''}
                </div>
                
                ${purchaseMatsHtml}
                ${opsBox}
            </div>

            <div class="p-4 bg-slate-900 border-t border-slate-700">
                <div class="flex gap-2 items-center">
                    <div class="flex flex-col w-20">
                        <span class="text-[8px] text-slate-400 uppercase font-bold text-center mb-1">Qtd</span>
                        <input type="number" id="shop_qty" value="1" min="1" class="bg-slate-950 text-white text-center text-sm font-bold border border-slate-600 rounded outline-none py-2">
                    </div>
                    <button onclick="window.buyInstance('${selectedId}', '${cat}', ${costRep}, 'shop_qty')" 
                        class="flex-1 ${canAffordRep && canAffordMats ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} py-3 rounded-xl text-[11px] font-black uppercase transition-all"
                        ${!(canAffordRep && canAffordMats) ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart mr-2"></i> Adquirir Novas
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------
// MENU DE INFORMAÇÕES EXPLICATIVO (O HELP)
// ------------------------------------------------------------------
function renderHelpPanel() {
    return `
        <div class="flex flex-col h-full animate-fade-in relative bg-slate-900 text-slate-300">
            <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-red-400 hover:text-red-300 cursor-pointer z-10"><i class="fas fa-times text-xl"></i></button>
            
            <div class="p-6 border-b border-slate-700 shrink-0">
                <h3 class="font-cinzel text-2xl text-amber-400"><i class="fas fa-book-open mr-2"></i> Manual Imperial</h3>
                <p class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Como gerir o seu Império</p>
            </div>

            <div class="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
                
                <div>
                    <h4 class="text-sky-400 font-bold mb-2 uppercase text-xs border-b border-slate-700 pb-1"><i class="fas fa-shopping-cart mr-1"></i> 1. Adquirindo Bens</h4>
                    <p class="text-xs leading-relaxed">Vá até a aba <strong class="text-white">Loja Imperial</strong>. Lá você poderá usar a sua <strong class="text-amber-400">Reputação Livre</strong> e os materiais físicos da sua <strong class="text-white">Mochila</strong> para construir Propriedades ou contratar Aliados.</p>
                </div>

                <div>
                    <h4 class="text-emerald-400 font-bold mb-2 uppercase text-xs border-b border-slate-700 pb-1"><i class="fas fa-industry mr-1"></i> 2. Produção e Consumo</h4>
                    <p class="text-xs leading-relaxed mb-2">Cada propriedade tem um <strong>Custo de Operação</strong>. Para que ela gere loots (produza), você deve ter os materiais exigidos na sua mochila. Ao clicar em <strong>Simular 1 Hora de Produção</strong>, os materiais são descontados da mochila e o loot gerado vai direto para o <strong>Armazém Local</strong> do prédio.</p>
                </div>

                <div>
                    <h4 class="text-purple-400 font-bold mb-2 uppercase text-xs border-b border-slate-700 pb-1"><i class="fas fa-users mr-1"></i> 3. Aliados e Trabalhadores</h4>
                    <p class="text-xs leading-relaxed">Você pode possuir inúmeros aliados. Propriedades possuem <strong>Vagas</strong>. Ao inspecionar uma de suas propriedades na aba "Meu Império", você pode selecionar um de seus aliados e atribuí-lo a trabalhar lá, o que garantirá bônus ou a execução da tarefa.</p>
                </div>

                <div>
                    <h4 class="text-amber-400 font-bold mb-2 uppercase text-xs border-b border-slate-700 pb-1"><i class="fas fa-warehouse mr-1"></i> 4. Cofre Central</h4>
                    <p class="text-xs leading-relaxed">O <strong>Cofre Imperial</strong> tem espaço infinito. Você pode usar a aba Armazenamento para enviar itens da sua mochila para o cofre, poupando espaço. O botão <strong>Puxar Todas Produções</strong> coleta automaticamente os loots que estão em todas as suas propriedades (Armazém Local) e os centraliza no Cofre.</p>
                </div>

            </div>
        </div>
    `;
}

// ------------------------------------------------------------------
// 3. ABA ARMAZENAMENTO (MOCHILA VS COFRE)
// ------------------------------------------------------------------
function renderStorageMochila(ficha) {
    const container = document.getElementById('storage-mochila-container');
    if (!container) return;
    const mochila = ficha.mochila || {};
    const itemIds = Object.keys(mochila).filter(id => mochila[id] > 0);

    let html = `
        <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
            <h3 class="text-amber-400 font-cinzel font-bold text-lg"><i class="fas fa-briefcase mr-2"></i> Sua Mochila</h3>
            <span class="text-[10px] font-mono text-slate-500">Enviar p/ Cofre</span>
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
                <div class="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center group">
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
    
    const showHelp = globalState.repUI.showHelp;
    if (showHelp) {
        panel.innerHTML = renderHelpPanel();
        return;
    }
    
    const itemIds = Object.keys(armazemGeral).filter(id => typeof armazemGeral[id] === 'number' && armazemGeral[id] > 0);

    let vaultHtml = `
        <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0 relative">
            <button onclick="window.toggleRepHelp()" class="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer z-10"><i class="fas fa-question-circle text-xl"></i></button>
            <div>
                <h3 class="font-cinzel text-xl text-sky-400 leading-tight mb-1"><i class="fas fa-warehouse mr-2"></i>Cofre Imperial</h3>
                <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest">Estoque Sem Limites</p>
            </div>
            <div class="text-right mr-6">
                <i class="fas fa-infinity text-2xl text-slate-700"></i>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-scroll p-4 bg-slate-900/20">
            <div class="grid grid-cols-2 gap-3">
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

// ------------------------------------------------------------------
// 4. FUNÇÕES DE BANCO DE DADOS 
// ------------------------------------------------------------------

window.buyInstance = async function(templateId, cat, costRep, qtyInputId) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

    const input = document.getElementById(qtyInputId);
    let qty = parseInt(input?.value || 1);
    if(isNaN(qty) || qty <= 0) return alert("Quantidade inválida.");

    const tpl = (cat === 'buildings' ? globalState.cache.buildings.get(templateId) : globalState.cache.allies.get(templateId));

    if (!confirm(`Comprar ${qty}x "${tpl.nome}"?\nCustará ${costRep * qty} Reputação e os materiais físicos serão consumidos da sua mochila.`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const usage = calculateReputationUsage(d);
            
            const totalRepCost = costRep * qty;
            if (usage.available < totalRepCost) throw `Reputação insuficiente para comprar ${qty}.`;
            
            const mochila = d.mochila || {};
            const reqs = tpl.custoMateriais || tpl.requisitos || [];
            
            // Valida e Consome
            for (let req of reqs) {
                const totalReq = req.quantidade * qty;
                if ((mochila[req.itemId] || 0) < totalReq) {
                    const info = globalState.cache.itens.get(req.itemId);
                    throw `Materiais insuficientes: falta ${totalReq}x ${info?.nome || req.itemId} na Mochila.`;
                }
            }
            reqs.forEach(req => {
                mochila[req.itemId] -= (req.quantidade * qty);
                if (mochila[req.itemId] <= 0) delete mochila[req.itemId];
            });

            const recursos = d.recursos || {};
            if (cat === 'buildings') {
                const list = recursos.estabelecimentos || [];
                for(let i=0; i<qty; i++) list.push({ templateId: templateId, lastCollect: Date.now(), armazem: {}, trabalhadores: [] });
                recursos.estabelecimentos = list;
            } else if (cat === 'allies') {
                const list = recursos.aliados || [];
                for(let i=0; i<qty; i++) list.push({ templateId: templateId });
                recursos.aliados = list;
            }

            t.update(ref, { recursos, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert(typeof e === 'string' ? e : "Falha na transação."); }
};

window.sellInstance = async function(category, idxStr) {
    if (!confirm("Vender/Destruir esta instância ESPECÍFICA? Loots/Alocações atreladas serão perdidos.")) return;
    const charId = globalState.selectedCharacterId;
    const idx = parseInt(idxStr);

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const rec = d.recursos || {};

            if (category === 'buildings') {
                const arr = rec.estabelecimentos || [];
                arr.splice(idx, 1);
                rec.estabelecimentos = arr;
            } else {
                const arr = rec.aliados || [];
                arr.splice(idx, 1);
                rec.aliados = arr;
                
                // Remove aliado destruído de qualquer vaga em prédios
                if (rec.estabelecimentos) {
                    rec.estabelecimentos.forEach(est => {
                        if (est.trabalhadores) {
                            est.trabalhadores = est.trabalhadores.filter(wId => wId !== idx);
                            // Corrige índices deslocados
                            est.trabalhadores = est.trabalhadores.map(wId => wId > idx ? wId - 1 : wId);
                        }
                    });
                }
            }
            t.update(ref, { recursos: rec });
        });
        globalState.repUI.selectedId = null;
        window.renderReputacaoTab();
    } catch (e) { console.error(e); }
};

window.assignWorker = async function(buildingIdxStr, selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || sel.value === "") return;
    
    const charId = globalState.selectedCharacterId;
    const bIdx = parseInt(buildingIdxStr);
    const allyIdx = parseInt(sel.value);

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const ests = d.recursos?.estabelecimentos || [];
            if (!ests[bIdx]) throw "Estabelecimento não encontrado.";
            
            const tpl = globalState.cache.buildings.get(ests[bIdx].templateId);
            const vagas = tpl.vagas || 0;
            
            if (!ests[bIdx].trabalhadores) ests[bIdx].trabalhadores = [];
            if (ests[bIdx].trabalhadores.length >= vagas) throw "Capacidade máxima de trabalhadores atingida.";
            if (ests[bIdx].trabalhadores.includes(allyIdx)) throw "Aliado já está aqui.";

            ests[bIdx].trabalhadores.push(allyIdx);
            t.update(ref, { "recursos.estabelecimentos": ests });
        });
        window.renderReputacaoTab();
    } catch (e) { alert(e); }
};

window.unassignWorker = async function(buildingIdxStr, allyIdx) {
    const charId = globalState.selectedCharacterId;
    const bIdx = parseInt(buildingIdxStr);

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const ests = d.recursos?.estabelecimentos || [];
            if (!ests[bIdx] || !ests[bIdx].trabalhadores) return;
            
            ests[bIdx].trabalhadores = ests[bIdx].trabalhadores.filter(id => id !== allyIdx);
            t.update(ref, { "recursos.estabelecimentos": ests });
        });
        window.renderReputacaoTab();
    } catch (e) { console.error(e); }
};

window.collectBuilding = async function(idxStr) {
    const charId = globalState.selectedCharacterId;
    const idx = parseInt(idxStr);

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const estabs = d.recursos?.estabelecimentos || [];
            const b = estabs[idx];
            if (!b) throw "Instância inválida.";

            const tpl = globalState.cache.buildings.get(b.templateId);
            const mochila = d.mochila || {};
            const consumos = tpl.consumo || [];
            
            // Consumo
            for (let c of consumos) {
                if ((mochila[c.itemId] || 0) < (c.quantidade || c.quantidadeBase)) {
                    const info = globalState.cache.itens.get(c.itemId);
                    throw `Falta de ${info?.nome || c.itemId} na mochila para realizar a operação.`;
                }
            }
            consumos.forEach(c => {
                mochila[c.itemId] -= (c.quantidade || c.quantidadeBase);
                if (mochila[c.itemId] <= 0) delete mochila[c.itemId];
            });

            // Produção Local
            const armazem = b.armazem || {};
            (tpl.producao || []).forEach(p => {
                armazem[p.itemId] = (armazem[p.itemId] || 0) + (p.quantidade || p.quantidadeBase);
            });

            b.lastCollect = Date.now();
            b.armazem = armazem;
            t.update(ref, { "recursos.estabelecimentos": estabs, mochila });
        });
        window.renderReputacaoTab();
    } catch (e) { alert(e); }
};

window.withdrawLocalBuildingItem = async function(idxStr, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    const idx = parseInt(idxStr);
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const estabs = d.recursos?.estabelecimentos || [];
            const b = estabs[idx];
            
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
    } catch (e) {}
};

window.transferGlobalStorage = async function(from, to, itemId, amountRaw) {
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

    try {
        await runTransaction(db, async (t) => {
            const refFicha = doc(db, "rpg_fichas", charId);
            const d = (await t.get(refFicha)).data();
            
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

            sourceObj[itemId] -= amount;
            if (sourceObj[itemId] <= 0) delete sourceObj[itemId];
            destObj[itemId] = (destObj[itemId] || 0) + amount;
            
            if (isNested) storageData.itens = actualArmazem; else storageData = actualArmazem;

            t.update(refFicha, { mochila: d.mochila });
            t.set(storageRef, storageData, { merge: true });
        });
        window.renderReputacaoTab();
    } catch(e) { alert(typeof e === 'string' ? e : "Falha na transferência."); }
};

window.collectAllToVault = async function() {
    const charId = globalState.selectedCharacterId;
    if(!charId) return;

    try {
        await runTransaction(db, async (t) => {
            const refFicha = doc(db, "rpg_fichas", charId);
            const d = (await t.get(refFicha)).data();
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
            
            if (!collectedSomething) throw "Não existem produções prontas nas propriedades locais.";
            
            if (isNested) storageData.itens = actualArmazem; else storageData = actualArmazem;

            recursos.estabelecimentos = estabs;
            t.update(refFicha, { recursos });
            t.set(storageRef, storageData, { merge: true });
        });
        window.renderReputacaoTab();
        alert("Todos os itens locais foram enviados ao Cofre Imperial infinito.");
    } catch(e) { alert(typeof e === 'string' ? e : "Erro logístico ao coletar."); }
};
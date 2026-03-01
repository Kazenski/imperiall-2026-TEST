import { db, doc, updateDoc, runTransaction, deleteField } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { calculateReputationUsage, calculateReputationDetails } from '../core/calculos.js';
import { escapeHTML } from '../core/utils.js';

let currentRepTab = 'buildings'; // 'buildings' ou 'allies'
const COLET_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos

export function renderReputacaoTab() {
    // CORREÇÃO APLICADA AQUI: O ID correto conforme o index.html e main.js
    const container = document.getElementById('recursos-reputacao-content');
    if (!container) {
        console.warn("Elemento 'recursos-reputacao-content' não encontrado no DOM.");
        return;
    }

    try {
        const charData = globalState.selectedCharacterData;
        if (!charData) {
            container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
            return;
        }

        const ficha = charData.ficha;
        const repUsage = calculateReputationUsage(ficha);
        const repDetails = calculateReputationDetails(ficha);

        container.innerHTML = `
            <div class="flex flex-col h-full animate-fade-in">
                <div class="bg-slate-900/80 p-6 rounded-xl border border-slate-700 mb-6 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="flex items-center gap-6">
                        <div class="w-20 h-20 rounded-full bg-slate-800 border-4 border-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            <i class="fas fa-crown text-4xl text-amber-500"></i>
                        </div>
                        <div>
                            <h2 class="text-2xl font-cinzel text-amber-400 font-bold leading-none mb-2">Reputação e Influência</h2>
                            <div class="text-xs text-slate-400 font-mono space-y-1">
                                <div><i class="fas fa-arrow-up text-emerald-400 mr-1"></i> Nível + Profissões: <span class="text-white">${repDetails.level} + ${repDetails.profissoes}</span></div>
                                <div><i class="fas fa-book text-sky-400 mr-1"></i> Bônus Enciclopédia: <span class="text-white">${repUsage.colecao}</span></div>
                                ${repDetails.gmBonus ? `<div><i class="fas fa-gift text-purple-400 mr-1"></i> Bônus GM: <span class="text-white">${repDetails.gmBonus}</span></div>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-4">
                        <div class="bg-slate-950 p-4 rounded-lg border border-slate-700 text-center min-w-[120px]">
                            <div class="text-[10px] uppercase font-bold text-slate-500 mb-1">Reputação Total</div>
                            <div class="text-3xl font-cinzel text-amber-400">${repUsage.total}</div>
                        </div>
                        <div class="bg-slate-950 p-4 rounded-lg border border-slate-700 text-center min-w-[120px]">
                            <div class="text-[10px] uppercase font-bold text-slate-500 mb-1">Disponível</div>
                            <div class="text-3xl font-cinzel ${repUsage.available >= 0 ? 'text-emerald-400' : 'text-red-400'}">${repUsage.available}</div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 mb-6 border-b border-slate-700 pb-2">
                    <button onclick="window.switchRepTab('buildings')" class="btn ${currentRepTab === 'buildings' ? 'btn-primary shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400'} px-6 py-2">
                        <i class="fas fa-store mr-2"></i> Estabelecimentos
                    </button>
                    <button onclick="window.switchRepTab('allies')" class="btn ${currentRepTab === 'allies' ? 'btn-primary shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400'} px-6 py-2">
                        <i class="fas fa-users mr-2"></i> Aliados
                    </button>
                </div>

                <div id="rep-dynamic-content" class="flex-grow overflow-y-auto custom-scroll pr-2"></div>
            </div>
        `;

        if (currentRepTab === 'buildings') renderBuildings(ficha, repUsage);
        else renderAllies(ficha, repUsage);

    } catch (e) {
        console.error("Erro na aba de Reputação:", e);
        container.innerHTML = `<div class="p-6 text-red-500 bg-red-900/20 border border-red-500/50 rounded-xl m-6 shadow-inner">
            <h3 class="font-bold uppercase tracking-widest mb-2"><i class="fas fa-exclamation-triangle"></i> Erro Crítico</h3>
            <p class="font-mono text-xs">${e.message}</p>
        </div>`;
    }
}

window.switchRepTab = function(tabName) {
    currentRepTab = tabName;
    renderReputacaoTab();
};

// ==========================================
// ABA: ESTABELECIMENTOS
// ==========================================
function renderBuildings(ficha, repUsage) {
    const container = document.getElementById('rep-dynamic-content');
    const myBuildings = ficha.recursos?.estabelecimentos || [];
    const myBuildingIds = new Set(myBuildings.map(b => b.templateId));
    
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

    // 1. MEUS ESTABELECIMENTOS
    html += `<div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 class="text-lg font-cinzel text-amber-400 mb-4 border-b border-slate-700 pb-2">Meus Estabelecimentos</h3>
        <div class="space-y-4">`;

    if (myBuildings.length === 0) {
        html += `<p class="text-slate-500 text-sm italic text-center py-6">Você não possui propriedades.</p>`;
    } else {
        myBuildings.forEach((b, index) => {
            const tpl = globalState.cache.buildings.get(b.templateId);
            if (!tpl) return;

            const now = Date.now();
            const lastCollect = b.lastCollect || 0;
            const timeDiff = now - lastCollect;
            const canCollect = timeDiff >= COLET_COOLDOWN_MS;
            
            let collectBtn = '';
            if (canCollect) {
                collectBtn = `<button onclick="window.collectBuilding('${b.templateId}')" class="btn btn-green text-xs py-2 w-full mt-3 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse"><i class="fas fa-box-open mr-2"></i> Coletar Recursos</button>`;
            } else {
                const remainingMin = Math.ceil((COLET_COOLDOWN_MS - timeDiff) / 60000);
                collectBtn = `<button class="btn bg-slate-800 text-slate-500 border border-slate-700 text-xs py-2 w-full mt-3 cursor-not-allowed" disabled><i class="fas fa-hourglass-half mr-2"></i> Coleta em ${remainingMin}m</button>`;
            }

            // Checar Armazém
            const storageItems = Object.keys(b.armazem || {});
            const hasItems = storageItems.length > 0;

            html += `
                <div class="bg-slate-800 border border-amber-500/30 p-4 rounded-lg shadow-lg relative overflow-hidden group">
                    <div class="absolute top-0 right-0 bg-amber-500/20 text-amber-500 text-[9px] font-bold px-2 py-1 rounded-bl border-b border-l border-amber-500/30">CUSTO: ${tpl.reputacaoCusto} REP</div>
                    
                    <div class="flex gap-4">
                        <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-16 h-16 rounded bg-black border border-slate-600 object-cover shrink-0">
                        <div class="flex-grow">
                            <h4 class="font-bold text-slate-200 text-sm">${escapeHTML(tpl.nome)}</h4>
                            <p class="text-[10px] text-slate-400 line-clamp-2 mt-1 mb-2">${escapeHTML(tpl.descricao)}</p>
                            
                            <div class="flex gap-2">
                                <button onclick="window.openBuildingStorage('${b.templateId}')" class="btn ${hasItems ? 'bg-sky-900/40 text-sky-400 border border-sky-500/50 hover:bg-sky-900/60' : 'bg-slate-900 border-slate-700 text-slate-500'} text-[10px] py-1 px-3 rounded flex-1 transition">
                                    <i class="fas fa-warehouse mr-1"></i> Armazém ${hasItems ? '<span class="w-2 h-2 bg-red-500 rounded-full inline-block ml-1 animate-ping"></span>' : ''}
                                </button>
                                <button onclick="window.sellBuilding('${b.templateId}')" class="btn bg-red-900/20 border border-red-900/50 text-red-500 hover:bg-red-900/40 text-[10px] py-1 px-3 rounded transition">
                                    <i class="fas fa-store-slash mr-1"></i> Vender
                                </button>
                            </div>
                        </div>
                    </div>
                    ${collectBtn}
                </div>
            `;
        });
    }
    html += `</div></div>`;

    // 2. COMPRAR ESTABELECIMENTOS
    html += `<div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 class="text-lg font-cinzel text-slate-300 mb-4 border-b border-slate-700 pb-2">Propriedades à Venda</h3>
        <div class="space-y-4">`;

    let availableCount = 0;
    globalState.cache.buildings.forEach((tpl, id) => {
        if (myBuildingIds.has(id)) return;
        availableCount++;

        const canAfford = repUsage.available >= (tpl.reputacaoCusto || 0);

        html += `
            <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex items-center gap-4 transition hover:border-slate-500">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-12 h-12 rounded bg-black border border-slate-600 object-cover shrink-0 grayscale opacity-70">
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-slate-300 text-sm">${escapeHTML(tpl.nome)}</h4>
                        <span class="text-[10px] font-mono ${canAfford ? 'text-amber-400' : 'text-red-400'} font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            Custo: ${tpl.reputacaoCusto || 0} REP
                        </span>
                    </div>
                    <p class="text-[10px] text-slate-500 line-clamp-1 mt-1">${escapeHTML(tpl.descricao)}</p>
                </div>
                <button onclick="window.buyBuilding('${id}', ${tpl.reputacaoCusto || 0})" class="btn ${canAfford ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500' : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'} shrink-0 text-xs px-4 py-2" ${!canAfford ? 'disabled' : ''}>
                    Adquirir
                </button>
            </div>
        `;
    });

    if (availableCount === 0) html += `<p class="text-slate-500 text-sm italic text-center py-6">Não há propriedades disponíveis.</p>`;

    html += `</div></div></div>`;
    
    // Área Modal para Armazém
    html += `<div id="building-modal-area"></div>`;
    
    container.innerHTML = html;
}

// ==========================================
// ABA: ALIADOS
// ==========================================
function renderAllies(ficha, repUsage) {
    const container = document.getElementById('rep-dynamic-content');
    const myAllies = ficha.recursos?.aliados || [];
    const myAllyIds = new Set(myAllies.map(a => a.templateId));
    
    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

    // 1. MEUS ALIADOS
    html += `<div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 class="text-lg font-cinzel text-sky-400 mb-4 border-b border-slate-700 pb-2">Meus Aliados</h3>
        <div class="space-y-4">`;

    if (myAllies.length === 0) {
        html += `<p class="text-slate-500 text-sm italic text-center py-6">Você viaja sozinho.</p>`;
    } else {
        myAllies.forEach((a) => {
            const tpl = globalState.cache.allies.get(a.templateId);
            if (!tpl) return;

            html += `
                <div class="bg-slate-800 border border-sky-500/30 p-4 rounded-lg shadow-lg relative flex items-center gap-4">
                    <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-16 h-16 rounded-full bg-black border-2 border-sky-500 object-cover shrink-0">
                    <div class="flex-grow">
                        <h4 class="font-bold text-slate-200 text-sm">${escapeHTML(tpl.nome)}</h4>
                        <div class="text-[10px] text-sky-400 font-bold mb-1 uppercase tracking-widest">${escapeHTML(tpl.funcao || 'Aventureiro')}</div>
                        <p class="text-[10px] text-slate-400 line-clamp-2">${escapeHTML(tpl.descricao)}</p>
                    </div>
                    <div class="flex flex-col items-center justify-center shrink-0 border-l border-slate-700 pl-4">
                        <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">Custo</span>
                        <span class="text-amber-400 font-cinzel font-bold text-lg leading-none">${tpl.reputacaoCustoBase}</span>
                        <button onclick="window.fireAlly('${a.templateId}')" class="mt-2 text-[10px] text-red-500 hover:text-red-400 underline transition">Dispensar</button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div></div>`;

    // 2. RECRUTAR ALIADOS
    html += `<div class="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 class="text-lg font-cinzel text-slate-300 mb-4 border-b border-slate-700 pb-2">Quadro de Recrutamento</h3>
        <div class="space-y-4">`;

    let availableCount = 0;
    globalState.cache.allies.forEach((tpl, id) => {
        if (myAllyIds.has(id)) return;
        availableCount++;

        const canAfford = repUsage.available >= (tpl.reputacaoCustoBase || 0);

        html += `
            <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg flex items-center gap-4 transition hover:border-slate-500">
                <img src="${tpl.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-12 h-12 rounded-full bg-black border border-slate-600 object-cover shrink-0 grayscale opacity-70">
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-slate-300 text-sm">${escapeHTML(tpl.nome)}</h4>
                        <span class="text-[10px] font-mono ${canAfford ? 'text-amber-400' : 'text-red-400'} font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            Custo: ${tpl.reputacaoCustoBase || 0} REP
                        </span>
                    </div>
                    <p class="text-[10px] text-slate-500 line-clamp-1 mt-1">${escapeHTML(tpl.descricao)}</p>
                </div>
                <button onclick="window.hireAlly('${id}', ${tpl.reputacaoCustoBase || 0})" class="btn ${canAfford ? 'bg-sky-900/50 hover:bg-sky-800 text-sky-400 border-sky-700' : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'} shrink-0 text-xs px-4 py-2" ${!canAfford ? 'disabled' : ''}>
                    Recrutar
                </button>
            </div>
        `;
    });

    if (availableCount === 0) html += `<p class="text-slate-500 text-sm italic text-center py-6">Nenhum aliado disponível no momento.</p>`;

    html += `</div></div></div>`;
    container.innerHTML = html;
}

// ==========================================
// FUNÇÕES DE TRANSAÇÃO (FIREBASE)
// ==========================================
window.buyBuilding = async function(templateId, cost) {
    if (!confirm("Adquirir este estabelecimento? (Utiliza Reputação Máxima Disponível)")) return;
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
    if (!confirm("Vender este estabelecimento? Você irá recuperar a reputação investida, mas perderá os itens no armazém.")) return;
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
            
            // Adiciona itens gerados ao armazém do prédio
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
    if (!confirm("Recrutar este aliado?")) return;
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
    if (!confirm("Dispensar aliado? Ele sairá do grupo e você recuperará a reputação.")) return;
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
        renderReputacaoTab();
    } catch (e) { alert("Erro: " + e); }
};

// ==========================================
// ARMAZÉM DO PRÉDIO
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
        itemsHtml = '<p class="text-slate-500 italic text-center py-8">O armazém está vazio.</p>';
    } else {
        itemsHtml = `<div class="grid grid-cols-4 gap-3">`;
        itemIds.forEach(itemId => {
            const item = globalState.cache.itens.get(itemId);
            if (!item) return;
            const qtd = armazem[itemId];

            itemsHtml += `
                <div onclick="window.withdrawBuildingItem('${templateId}', '${itemId}')" class="bg-slate-900 border border-slate-700 rounded p-2 text-center cursor-pointer hover:border-amber-500 hover:bg-slate-800 transition group relative">
                    <img src="${item.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 mx-auto object-cover rounded bg-black mb-1">
                    <div class="text-[9px] text-slate-300 font-bold truncate">${escapeHTML(item.nome)}</div>
                    <div class="text-xs text-amber-400 font-bold">x${qtd}</div>
                    
                    <div class="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition">
                        <span class="text-[10px] text-white font-bold uppercase tracking-wider">Sacar</span>
                    </div>
                </div>
            `;
        });
        itemsHtml += `</div>`;
    }

    const modalArea = document.getElementById('building-modal-area');
    modalArea.innerHTML = `
        <div class="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-6 rounded-xl animate-fade-in">
            <div class="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full shadow-2xl relative">
                <button onclick="document.getElementById('building-modal-area').innerHTML = ''" class="absolute top-3 right-3 text-slate-400 hover:text-white transition"><i class="fas fa-times text-xl"></i></button>
                <h3 class="text-xl font-cinzel text-amber-400 mb-2 border-b border-slate-700 pb-2"><i class="fas fa-warehouse mr-2"></i>Armazém: ${escapeHTML(tpl.nome)}</h3>
                <p class="text-[10px] text-slate-400 mb-4 uppercase tracking-widest">Clique em um item para enviar para a mochila principal.</p>
                <div class="max-h-64 overflow-y-auto custom-scroll pr-2">
                    ${itemsHtml}
                </div>
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
        
        // Atualiza UI
        window.openBuildingStorage(templateId); 
        renderReputacaoTab(); // Atualiza fundo
        
    } catch (e) { alert("Erro: " + e); }
};
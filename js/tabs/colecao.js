import { db, doc, updateDoc, runTransaction, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// 1. Controle das Sub-Abas do Diário
window.switchCollectionTab = function(tabId) {
    if (!globalState.collectionUI) globalState.collectionUI = { activeTab: 'crafts', selectedItem: null };
    globalState.collectionUI.activeTab = tabId;
    globalState.collectionUI.selectedItem = null; 
    window.renderCollectionTab(); 
};

// 2. Renderizador Principal da Aba
export function renderCollectionTab() {
    const container = document.getElementById('colecao-craft-content');
    if (!container) return;
    
    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500 italic">Selecione um personagem primeiro.</div>';
        return;
    }

    if (!globalState.collectionUI) globalState.collectionUI = { activeTab: 'crafts', selectedItem: null };
    const active = globalState.collectionUI.activeTab;

    // 1. INJEÇÃO DO ESQUELETO DE 2 COLUNAS
    if (!document.getElementById('collection-layout-wrapper')) {
        container.innerHTML = `
            <div id="collection-layout-wrapper" class="flex w-full h-full gap-6 animate-fade-in pb-4">
                
                <div class="flex-1 flex flex-col min-w-0 h-full">
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <div>
                            <h2 class="font-cinzel text-3xl text-amber-500 m-0"><i class="fas fa-book-atlas mr-3 text-slate-600"></i> Enciclopédia & Coleções</h2>
                            <p class="text-xs text-slate-400 mt-1">Seu diário pessoal de conquistas, mapas e bestiário.</p>
                        </div>
                    </div>

                    <div class="flex gap-2 overflow-x-auto hide-scroll pb-2 mb-2 border-b border-slate-700 shrink-0" id="collection-nav-tabs">
                        </div>

                    <div class="flex-1 overflow-y-auto custom-scroll bg-slate-900/50 border border-slate-700 rounded-xl p-4 shadow-inner relative">
                        <div id="collection-grid-container" class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start"></div>
                    </div>
                </div>

                <div class="w-80 md:w-96 shrink-0 flex flex-col h-full pt-16 gap-4">
                    
                    <div class="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl shrink-0" id="collection-progress-panel">
                        </div>

                    <div class="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col flex-1 min-h-0 relative overflow-hidden" id="collection-inspect-panel">
                        </div>
                </div>

            </div>
        `;
    }

    // 2. Renderizar os Botões de Abas
    const navTabs = document.getElementById('collection-nav-tabs');
    if (navTabs) {
        const getTabClass = (id) => active === id 
            ? 'bg-sky-600 text-white font-bold border-sky-500 shadow-[0_0_10px_rgba(2,132,199,0.5)]' 
            : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200';

        navTabs.innerHTML = `
            <button onclick="window.switchCollectionTab('crafts')" class="px-4 py-2 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getTabClass('crafts')}"><i class="fas fa-hammer mr-1"></i> Crafts Feitos</button>
            <button onclick="window.switchCollectionTab('players')" class="px-4 py-2 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getTabClass('players')}"><i class="fas fa-users mr-1"></i> Aventureiros</button>
            <button onclick="window.switchCollectionTab('npcs')" class="px-4 py-2 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getTabClass('npcs')}"><i class="fas fa-user-tie mr-1"></i> NPCs</button>
            <button onclick="window.switchCollectionTab('monsters')" class="px-4 py-2 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getTabClass('monsters')}"><i class="fas fa-dragon mr-1"></i> Bestiário</button>
            <button onclick="window.switchCollectionTab('cities')" class="px-4 py-2 rounded-lg border text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${getTabClass('cities')}"><i class="fas fa-city mr-1"></i> Locais</button>
        `;
    }

    // 3. Renderizar o Conteúdo da Aba Ativa
    const gridContainer = document.getElementById('collection-grid-container');
    if (active === 'crafts') renderCollectionCrafts(gridContainer, charData);
    else if (active === 'players') renderCollectionEntities(gridContainer, charData, 'colecao_jogadores', 'Aventureiros');
    else if (active === 'npcs') renderCollectionEntities(gridContainer, charData, 'colecao_npcs', 'NPCs');
    else if (active === 'monsters') renderCollectionEntities(gridContainer, charData, 'colecao_monstros', 'Bestiário');
    else if (active === 'cities') renderCollectionCities(gridContainer, charData);

    // Atualiza Painel Direito
    renderCollectionRightPanel(charData);
}
window.renderCollectionTab = renderCollectionTab;

// ----------------------------------------------------
// GERADORES DE GRID POR CATEGORIA
// ----------------------------------------------------

function renderCollectionCrafts(gridContainer, charData) {
    gridContainer.innerHTML = '';
    const progresso = charData.ficha.livro_receitas || {};
    const recipesByProf = {};
    
    globalState.cache.receitas.forEach(rec => {
        const profId = rec.profissaoId || 'geral'; 
        if (!recipesByProf[profId]) recipesByProf[profId] = [];
        recipesByProf[profId].push(rec);
    });

    Object.keys(recipesByProf).sort().forEach(profId => {
        const recipes = recipesByProf[profId];
        const profInfo = globalState.cache.profissoes.get(profId);
        const profName = profInfo ? profInfo.nome : (profId === 'geral' ? 'Geral' : profId);
        
        const header = document.createElement('div');
        header.className = "col-span-full text-amber-500 font-cinzel font-bold text-lg border-b border-slate-700 pb-1 mt-4 mb-2 flex items-center";
        header.innerHTML = `<i class="fas fa-book text-slate-500 mr-2 text-sm"></i> ${profName}`;
        gridContainer.appendChild(header);

        recipes.forEach(rec => {
            const itemInfo = globalState.cache.itens.get(rec.itemId);
            const status = progresso[rec.id] || { craftado: false, resgatado: false };
            
            const isKnown = status.craftado;
            const isClaimed = status.resgatado;
            const canClaim = isKnown && !isClaimed;

            const slot = buildSlotElement(
                rec.id, 
                itemInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL, 
                rec.nome, 
                isKnown, isClaimed, canClaim, 
                () => window.selectCollectionItem('crafts', rec, itemInfo, isKnown, isClaimed, canClaim)
            );
            gridContainer.appendChild(slot);
        });
    });
}

function renderCollectionEntities(gridContainer, charData, collectionKey, title) {
    gridContainer.innerHTML = '';
    const colecao = charData.ficha[collectionKey] || {};
    const knownIds = Object.keys(colecao);
    
    let allEntities = [];
    
    if (collectionKey === 'colecao_jogadores') {
        const cacheToUse = globalState.cache.players || new Map();
        knownIds.forEach(id => { const p = cacheToUse.get(id); if(p) allEntities.push(p); });
    } 
    else if (collectionKey === 'colecao_npcs') {
        // Busca apenas no cache de NPCs
        const cacheNpcs = globalState.cache.npcs || new Map();
        cacheNpcs.forEach(n => allEntities.push(n));
        
        // Fallback: se algum ficou preso no cache de mobs com a collection certa
        const cacheMobs = globalState.cache.mobs || new Map();
        cacheMobs.forEach(m => {
            if (m.collection === 'rpg_Npcs' && !allEntities.some(e => e.id === m.id)) {
                allEntities.push(m);
            }
        });
    } 
    else if (collectionKey === 'colecao_monstros') {
        // Busca apenas no cache de Monstros
        const cacheMobs = globalState.cache.mobs || new Map();
        cacheMobs.forEach(m => {
            if (m.collection !== 'rpg_Npcs') {
                allEntities.push(m);
            }
        });
    }

    allEntities.sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));

    if (allEntities.length === 0) {
        gridContainer.innerHTML = `<div class="col-span-full text-slate-500 text-center py-10 italic">Nenhum registro encontrado no banco de dados para esta categoria.</div>`;
        return;
    }

    allEntities.forEach(ent => {
        const status = colecao[ent.id];
        const isKnown = status !== undefined;
        const isClaimed = typeof status === 'object' && status.resgatado === true;
        const canClaim = isKnown && !isClaimed;

        const img = ent.imageUrls?.imagem1 || ent.imagemUrl || PLACEHOLDER_IMAGE_URL;
        const name = ent.nome || 'Desconhecido';

        const slot = buildSlotElement(
            ent.id, img, name, 
            isKnown, isClaimed, canClaim,
            () => window.selectCollectionItem(collectionKey, ent, ent, isKnown, isClaimed, canClaim)
        );
        gridContainer.appendChild(slot);
    });
}

function renderCollectionCities(gridContainer, charData) {
    gridContainer.innerHTML = '';
    const collectionKey = 'colecao_cidades';
    const colecao = charData.ficha[collectionKey] || {};
    const allLocations = globalState.world.locations || [];
    
    allLocations.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    if (allLocations.length === 0) {
        gridContainer.innerHTML = `<div class="col-span-full text-slate-500 text-center py-10 italic">Nenhum local cadastrado no mundo.</div>`;
        return;
    }

    allLocations.forEach(loc => {
        const status = colecao[loc.id];
        const isKnown = status !== undefined;
        const isClaimed = typeof status === 'object' && status.resgatado === true;
        const canClaim = isKnown && !isClaimed;

        const name = loc.name || 'Local Desconhecido';
        const img = loc.imagemUrl || PLACEHOLDER_IMAGE_URL;

        const slot = buildSlotElement(
            loc.id, img, name, 
            isKnown, isClaimed, canClaim,
            () => window.selectCollectionItem(collectionKey, loc, loc, isKnown, isClaimed, canClaim)
        );
        gridContainer.appendChild(slot);
    });
}

function buildSlotElement(id, imgUrl, name, isKnown, isClaimed, canClaim, onClickCallback) {
    const el = document.createElement('div');
    
    let borderClass = 'border-slate-800 opacity-40 grayscale hover:opacity-70 hover:grayscale-0'; 
    let iconHtml = '<i class="fas fa-question absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl text-slate-700 drop-shadow-md z-10"></i>';
    let badgeHtml = '';

    if (isClaimed) {
        borderClass = 'border-slate-600 opacity-100';
        iconHtml = '';
        badgeHtml = '<div class="absolute top-1 right-1 bg-black/80 text-emerald-500 rounded-full w-5 h-5 flex items-center justify-center border border-slate-700 z-10 shadow"><i class="fas fa-check text-[10px]"></i></div>';
    } else if (canClaim) {
        borderClass = 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-500/50 opacity-100 animate-pulse';
        iconHtml = '';
        badgeHtml = '<div class="absolute top-1 right-1 bg-amber-500 text-black rounded-full w-5 h-5 flex items-center justify-center z-10 shadow border border-amber-300"><i class="fas fa-exclamation text-[10px] font-bold"></i></div>';
    }

    const isSelected = globalState.collectionUI?.selectedItem?.id === id;
    if (isSelected) {
        borderClass = borderClass.replace('border-slate-800', 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.5)]');
        borderClass = borderClass.replace('border-slate-600', 'border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.5)]');
    }

    el.className = `flex flex-col items-center cursor-pointer group hover:-translate-y-1 transition-transform`;
    el.onclick = onClickCallback;

    el.innerHTML = `
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-black border-2 ${borderClass} overflow-hidden relative transition-all">
            <img src="${imgUrl}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
            ${iconHtml}
            ${badgeHtml}
        </div>
        <div class="text-[9px] sm:text-[10px] mt-2 font-bold text-center w-full truncate ${isKnown ? 'text-slate-300 group-hover:text-sky-400' : 'text-slate-600'}">
            ${isKnown ? name : '???'}
        </div>
    `;
    return el;
}

// ----------------------------------------------------
// PAINEL FIXO DA DIREITA (INSPEÇÃO E PROGRESSO)
// ----------------------------------------------------

window.selectCollectionItem = function(category, mainObj, infoObj, isKnown, isClaimed, canClaim) {
    globalState.collectionUI.selectedItem = {
        id: mainObj.id,
        category: category,
        mainObj: mainObj,
        infoObj: infoObj,
        isKnown: isKnown,
        isClaimed: isClaimed,
        canClaim: canClaim
    };
    renderCollectionTab(); // Re-renderiza para atualizar seleções
};

function renderCollectionRightPanel(charData) {
    const progPanel = document.getElementById('collection-progress-panel');
    const inspectPanel = document.getElementById('collection-inspect-panel');
    const active = globalState.collectionUI.activeTab;
    const selected = globalState.collectionUI.selectedItem;

    if (!progPanel || !inspectPanel) return;

    let total = 0, discovered = 0, claimed = 0;
    let rewardHint = "";

    if (active === 'crafts') {
        const progresso = charData.ficha.livro_receitas || {};
        total = globalState.cache.receitas.size;
        discovered = Object.values(progresso).filter(p => p.craftado).length;
        claimed = Object.values(progresso).filter(p => p.resgatado).length;
        rewardHint = "Recompensa: +200 XP por item. A cada 5 itens resgatados ganhe +20 AP.";
    } 
    else if (active === 'players') {
        const colecao = charData.ficha.colecao_jogadores || {};
        total = globalState.cache.players.size;
        discovered = Object.keys(colecao).length;
        claimed = Object.values(colecao).filter(s => typeof s === 'object' && s.resgatado).length;
        rewardHint = "Recompensa: +20 EXP e +2 Reputação por aventureiro.";
    }
    else if (active === 'npcs') {
        const colecao = charData.ficha.colecao_npcs || {};
        
        let allNpcs = [];
        const cacheNpcs = globalState.cache.npcs || new Map();
        const cacheMobs = globalState.cache.mobs || new Map();
        
        cacheNpcs.forEach(n => allNpcs.push(n));
        cacheMobs.forEach(m => {
            if (m.collection === 'rpg_Npcs' && !allNpcs.some(e => e.id === m.id)) allNpcs.push(m);
        });

        total = allNpcs.length;
        discovered = Object.keys(colecao).length;
        claimed = Object.values(colecao).filter(s => typeof s === 'object' && s.resgatado).length;
        rewardHint = "Recompensa: +5 de Reputação por NPC.";
    }
    else if (active === 'monsters') {
        const colecao = charData.ficha.colecao_monstros || {};
        
        const cacheMobs = globalState.cache.mobs || new Map();
        let allMonsters = [];
        cacheMobs.forEach(m => {
            if (m.collection !== 'rpg_Npcs') allMonsters.push(m);
        });
        
        total = allMonsters.length;
        discovered = Object.keys(colecao).length;
        claimed = Object.values(colecao).filter(s => typeof s === 'object' && s.resgatado).length;
        rewardHint = "Recompensa: +25 EXP e +1 AP por monstro.";
    }
    else if (active === 'cities') {
        const colecao = charData.ficha.colecao_cidades || {};
        total = globalState.world.locations?.length || 0;
        discovered = Object.keys(colecao).length;
        claimed = Object.values(colecao).filter(s => typeof s === 'object' && s.resgatado).length;
        rewardHint = "Recompensa: +10 de Reputação por local mapeado.";
    }

    const pctDesc = total > 0 ? Math.floor((discovered / total) * 100) : 0;

    progPanel.innerHTML = `
        <div class="flex justify-between items-end mb-2">
            <div>
                <div class="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Progresso de Descoberta</div>
                <div class="text-sm font-bold text-slate-300 mt-1">${discovered} <span class="text-[10px] text-slate-500">/ ${total}</span></div>
            </div>
            <div class="text-right">
                <div class="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Total Resgatado</div>
                <div class="text-2xl font-cinzel text-amber-500 font-bold leading-none mt-1">${claimed}</div>
            </div>
        </div>
        <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-700 mb-2">
            <div class="h-full bg-sky-500 transition-all duration-1000" style="width: ${pctDesc}%"></div>
        </div>
        <p class="text-[8.5px] text-slate-400 italic text-center leading-tight opacity-80">${rewardHint}</p>
    `;

    // 2. PAINEL DE INSPEÇÃO DO ITEM SELECIONADO
    if (!selected) {
        inspectPanel.innerHTML = `
            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-50 z-10 bg-slate-800">
                <i class="fas fa-search text-5xl mb-4"></i>
                <p class="text-sm text-center px-6">Selecione um ícone na lista ao lado para inspecionar e resgatar recompensas.</p>
            </div>
        `;
        return;
    }

    const { category, mainObj, infoObj, isKnown, isClaimed, canClaim } = selected;
    
    let nome = mainObj.nome || mainObj.name || 'Desconhecido';
    let img = infoObj?.imagemUrl || infoObj?.imageUrls?.imagem1 || PLACEHOLDER_IMAGE_URL;
    let descricao = infoObj?.descricao || infoObj?.historia || infoObj?.description || infoObj?.lore || 'Nenhum registro adicional nos arquivos.';
    
    if (!isKnown) {
        nome = "Registro Bloqueado";
        img = PLACEHOLDER_IMAGE_URL;
        descricao = "Você ainda não descobriu esta entrada. Continue explorando o mundo para revelar seus segredos.";
    }

    let statusBadge = '';
    if (isClaimed) statusBadge = '<span class="bg-emerald-900/50 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest"><i class="fas fa-check mr-1"></i> Resgatado</span>';
    else if (canClaim) statusBadge = '<span class="bg-amber-900/50 text-amber-400 border border-amber-500/50 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest animate-pulse"><i class="fas fa-gift mr-1"></i> Aguardando Resgate</span>';
    else statusBadge = '<span class="bg-slate-900 text-slate-500 border border-slate-700 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest"><i class="fas fa-lock mr-1"></i> Desconhecido</span>';

    let actionButtonHtml = '';
    if (canClaim) {
        let fnCall = `window.claimCollectionReward('${category}', '${mainObj.id}', '${escapeHTML(nome)}')`;
        if (category === 'crafts') {
            fnCall = `window.claimReward('${mainObj.id}', '${escapeHTML(nome)}')`;
        }
        actionButtonHtml = `
            <div class="p-4 bg-slate-900 border-t border-slate-700 shrink-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                <button onclick="${fnCall}" class="w-full bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-widest text-[11px] py-3.5 rounded shadow-lg transition-transform hover:scale-[1.02]">
                    <i class="fas fa-box-open mr-2 text-sm"></i> Resgatar Recompensa
                </button>
            </div>
        `;
    }

    inspectPanel.innerHTML = `
        <div class="flex flex-col h-full animate-fade-in">
            
            <div class="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col items-center shrink-0">
                <div class="w-28 h-28 rounded-xl bg-black border-2 ${isKnown ? 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'border-slate-700 opacity-50'} overflow-hidden mb-4 relative">
                    <img src="${img}" class="w-full h-full object-cover ${!isKnown ? 'grayscale' : ''}">
                </div>
                <h3 class="font-cinzel text-xl ${isKnown ? 'text-sky-400' : 'text-slate-500'} text-center leading-tight mb-3 drop-shadow-md px-2">${nome}</h3>
                ${statusBadge}
            </div>

            <div class="flex-1 overflow-y-auto custom-scroll p-5 bg-slate-900/20">
                <h4 class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 border-b border-slate-700 pb-1"><i class="fas fa-scroll mr-1"></i> Arquivos do Diário</h4>
                <p class="text-[11px] text-slate-300 leading-relaxed italic ${!isKnown ? 'opacity-50' : ''}">${descricao.replace(/\n/g, '<br>')}</p>
            </div>

            ${actionButtonHtml}
        </div>
    `;
}

// ----------------------------------------------------
// FUNÇÕES DE RESGATE E LÓGICA DE BANCO DE DADOS
// ----------------------------------------------------

window.claimCollectionReward = async function(collectionKey, entityId, entityName) {
    if (!confirm(`Resgatar recompensa por descobrir "${entityName}"?`)) return;

    const charId = globalState.selectedCharacterId;
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            
            const colecao = d[collectionKey] || {};
            const status = colecao[entityId];

            if (!status || (typeof status === 'object' && status.resgatado)) {
                throw "Recompensa já resgatada ou inválida.";
            }

            const dataDescoberta = typeof status === 'object' ? status.dataDescoberta : status;

            const updates = {
                [`${collectionKey}.${entityId}`]: {
                    dataDescoberta: dataDescoberta,
                    dataResgate: Date.now(),
                    resgatado: true
                }
            };

            let msgExtra = "";
            if (collectionKey === 'colecao_jogadores') {
                updates.experienciapersonagemBase = increment(20);
                msgExtra = "Você recebeu +20 EXP e +2 de Reputação!";
            } else if (collectionKey === 'colecao_npcs') {
                msgExtra = "Você recebeu +5 de Reputação!";
            } else if (collectionKey === 'colecao_monstros') {
                updates.experienciapersonagemBase = increment(25);
                updates.apBonusColecao = increment(1); 
                updates.apPersonagemBase = increment(1);
                msgExtra = "Você recebeu +25 EXP e +1 AP!";
            } else if (collectionKey === 'colecao_cidades') {
                msgExtra = "Você mapeou este local e recebeu +10 de Reputação!";
            }

            t.update(ref, updates);
            return msgExtra;
            
        }).then(msg => {
            alert(`Recompensa resgatada com sucesso!\n${msg}`);
            globalState.collectionUI.selectedItem = null; 
            window.renderCollectionTab();
        });
        
    } catch(e) {
        console.error(e);
        alert("Erro ao resgatar: " + e);
    }
};

window.claimReward = async function(recipeId, recipeName) {
    const charId = globalState.selectedCharacterId;
    if (!confirm(`Resgatar recompensa de "${recipeName}"?\n(+200 XP)`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            const d = sf.data();
            const livro = d.livro_receitas || {};

            if (!livro[recipeId]?.craftado || livro[recipeId]?.resgatado) throw "Inválido.";

            let count = 0;
            for (let k in livro) { if (livro[k].resgatado) count++; }
            const novoTotal = count + 1;

            const updates = {
                [`livro_receitas.${recipeId}.resgatado`]: true,
                [`livro_receitas.${recipeId}.dataResgate`]: Date.now(),
                experienciapersonagemBase: increment(200)
            };

            let msgExtra = "";
            if (novoTotal % 5 === 0) {
                updates.apBonusColecao = increment(20); 
                updates.apPersonagemBase = increment(20);
                msgExtra = "\nBÔNUS: +20 AP por completar 5 resgates!";
            }

            t.update(ref, updates);
            return msgExtra;
        }).then(msg => {
            alert("Recompensa resgatada com sucesso! (+200 XP)" + msg);
            globalState.collectionUI.selectedItem = null;
            window.renderCollectionTab();
        });
    } catch (e) {
        console.error(e);
        alert("Erro: " + e);
    }
};

export async function checkAndDiscoverCities(revealedHexes) {
    if (!revealedHexes || revealedHexes.length === 0) return;
    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    const ficha = globalState.selectedCharacterData.ficha;
    const colecaoCidades = ficha.colecao_cidades || {};
    let hasNewDiscoveries = false;
    const updates = {};

    const HEX_RADIUS = 10;
    const R = HEX_RADIUS;
    const H = R * 2;
    const W = Math.sqrt(3) * R;
    const VERT_DIST = H * 0.75;
    const revealedSet = new Set(revealedHexes);

    globalState.world.locations.forEach(loc => {
        if (loc.x && loc.y) {
            const lx = Number(loc.x);
            const ly = Number(loc.y);
            
            const row = Math.round((ly + (H/2)) / VERT_DIST);
            const xOffset = (row % 2 === 1) ? W / 2 : 0;
            const col = Math.round((lx + (W/2) - xOffset) / W);
            const hexId = `${row}-${col}`;

            if (revealedSet.has(hexId) && !colecaoCidades[loc.id]) {
                updates[`colecao_cidades.${loc.id}`] = Date.now();
                hasNewDiscoveries = true;
            }
        }
    });

    if (hasNewDiscoveries) {
        try {
            await updateDoc(doc(db, "rpg_fichas", charId), updates);
            console.log("Novos locais registrados automaticamente no diário!");
        } catch (e) {
            console.error("Erro ao salvar novos locais:", e);
        }
    }
}
window.checkAndDiscoverCities = checkAndDiscoverCities;
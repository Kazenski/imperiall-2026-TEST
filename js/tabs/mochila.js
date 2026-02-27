import { db, doc, updateDoc, runTransaction, deleteField, getDoc, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML, getRankWeight } from '../core/utils.js';
import { calculateWeightStats } from '../core/calculos.js';

const IMG_FALLBACK = PLACEHOLDER_IMAGE_URL;

export function renderMochila(isJustFiltering = false) {
    let grid = document.getElementById('inventory-grid'); 
    if (!grid) return;

    if (!globalState.mochilaUI) {
        globalState.mochilaUI = { abaAtiva: 'todos', ordenacao: 'rank_desc', busca: '' };
    }

    let charData = globalState.selectedCharacterData;
    if (!charData || !charData.ficha) {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-500 italic py-4">Selecione um personagem primeiro.</p>';
        return;
    }

    let controls = document.getElementById('mochila-advanced-controls');
    let justCreatedControls = false;
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'mochila-advanced-controls';
        grid.parentNode.insertBefore(controls, grid);
        justCreatedControls = true;
        
        const oldHeader = document.querySelector('#mochila-content > .flex.justify-between.items-center.mb-6');
        const oldFilter = document.querySelector('#mochila-content > .form-field.mb-4');
        if(oldHeader) oldHeader.style.display = 'none';
        if(oldFilter) oldFilter.style.display = 'none';
    }

    let mochilaRaw = charData.ficha.mochila || {};
    let materiaisSet = new Set();
    
    if (globalState.cache.receitas) {
        globalState.cache.receitas.forEach(function(receita) {
            if (receita.materiais && Array.isArray(receita.materiais)) {
                receita.materiais.forEach(function(mat) {
                    if (mat.itemId) materiaisSet.add(mat.itemId); 
                });
            }
        });
    }

    let itensArray = [];
    for (let [id, qtd] of Object.entries(mochilaRaw)) {
        if (qtd <= 0) continue;
        
        let itemInfo = globalState.cache.itens.get(id) || (globalState.cache.allItems ? globalState.cache.allItems.get(id) : null);
        if (!itemInfo) continue;

        let configInfo = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(id) : null;
        let rankReal = itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfo ? configInfo.tierId : null) || "F";

        let tipoStr = (itemInfo.tipoItem || itemInfo.categoria || "").toLowerCase();
        
        let isUsavel = itemInfo.itemUsavel === true;
        let isConsumivel = isUsavel || tipoStr.includes('consumível') || tipoStr.includes('consumivel') || tipoStr.includes('poção') || tipoStr.includes('pocao');
        
        let isEquip = tipoStr.includes('arma') || tipoStr.includes('armadura') || tipoStr.includes('equipamento') || tipoStr.includes('acessorio') || itemInfo.slot_equipavel_id != null;
        let isMaterial = materiaisSet.has(id) || tipoStr.includes('material') || tipoStr.includes('minério') || tipoStr.includes('ingrediente');
        let isDiversos = tipoStr.includes('diverso') || tipoStr.includes('quest') || tipoStr.includes('outro');

        itensArray.push({
            id: id,
            qtd: qtd,
            nome: itemInfo.nome || "Item Desconhecido",
            rank: rankReal,
            img: itemInfo.imagemUrl || IMG_FALLBACK, 
            isEquip: isEquip, 
            isConsumivel: isConsumivel,
            isMaterial: isMaterial,
            isDiversos: isDiversos,
            isUsavel: isUsavel,
            rawInfo: itemInfo
        });
    }

    let ui = globalState.mochilaUI;
    let filtered = itensArray.filter(function(item) {
        if (ui.busca && !item.nome.toLowerCase().includes(ui.busca)) return false;
        
        if (ui.abaAtiva === 'equipamentos' && !item.isEquip) return false;
        if (ui.abaAtiva === 'consumiveis' && !item.isConsumivel) return false;
        if (ui.abaAtiva === 'materiais' && !item.isMaterial) return false;
        if (ui.abaAtiva === 'diversos' && !item.isDiversos) return false;
        return true;
    });

    filtered.sort(function(a, b) {
        switch(ui.ordenacao) {
            case 'name_asc': return a.nome.localeCompare(b.nome);
            case 'name_desc': return b.nome.localeCompare(a.nome);
            case 'qtd_desc': return b.qtd - a.qtd;
            case 'qtd_asc': return a.qtd - b.qtd;
            case 'rank_desc': return getRankWeight(b.rank) - getRankWeight(a.rank);
            case 'rank_asc': return getRankWeight(a.rank) - getRankWeight(b.rank);
            default: return getRankWeight(b.rank) - getRankWeight(a.rank);
        }
    });

    function getRankColor(r) {
        let c = { 'SS': 'text-amber-400 border-amber-400 bg-black', 'S': 'text-rose-400 border-rose-500 bg-rose-900/30', 'A': 'text-amber-400 border-amber-500 bg-amber-900/30', 'B': 'text-purple-400 border-purple-500 bg-purple-900/30', 'C': 'text-blue-400 border-blue-500 bg-blue-900/30', 'D': 'text-emerald-400 border-emerald-500 bg-emerald-900/30', 'E': 'text-slate-400 border-slate-500 bg-slate-800' };
        return c[r?.toUpperCase()] || 'text-slate-500 border-slate-700 bg-slate-800';
    }

    function getBtnClass(abaName) {
        return ui.abaAtiva === abaName 
            ? 'bg-sky-600 text-white font-bold border-sky-500 shadow-[0_0_10px_rgba(2,132,199,0.5)]' 
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200';
    }

    if (justCreatedControls) {
        controls.innerHTML = `
            <div class="flex flex-col animate-fade-in">
                <div class="flex flex-col md:flex-row gap-4 mb-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 shadow-inner">
                    <div class="relative flex-grow w-full">
                        <i class="fas fa-search absolute left-3 top-3 text-slate-500"></i>
                        <input type="text" placeholder="Filtrar por Nome..." class="w-full bg-slate-950 border border-slate-700 rounded py-2 pl-10 pr-4 text-sm text-white focus:border-amber-500 outline-none" value="${ui.busca}" onkeyup="window.filtrarBuscaMochila(this.value)">
                    </div>
                    
                    <div class="flex items-center gap-2 w-full md:w-auto shrink-0">
                        <span class="text-xs text-slate-400 font-bold uppercase"><i class="fas fa-sort-amount-down"></i> Ordem:</span>
                        <select class="bg-slate-950 border border-slate-700 rounded py-2 px-3 text-sm text-slate-200 outline-none focus:border-sky-500" onchange="window.mudarOrdemMochila(this.value)">
                            <option value="rank_desc" ${ui.ordenacao === 'rank_desc' ? 'selected' : ''}>Rank (Maior > Menor)</option>
                            <option value="rank_asc" ${ui.ordenacao === 'rank_asc' ? 'selected' : ''}>Rank (Menor > Maior)</option>
                            <option value="qtd_desc" ${ui.ordenacao === 'qtd_desc' ? 'selected' : ''}>Quantidade (Mais > Menos)</option>
                            <option value="qtd_asc" ${ui.ordenacao === 'qtd_asc' ? 'selected' : ''}>Quantidade (Menos > Mais)</option>
                            <option value="name_asc" ${ui.ordenacao === 'name_asc' ? 'selected' : ''}>Nome (A-Z)</option>
                            <option value="name_desc" ${ui.ordenacao === 'name_desc' ? 'selected' : ''}>Nome (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div class="flex justify-between items-center mb-4 gap-4">
                    <div class="flex gap-2 overflow-x-auto custom-scroll pb-2 flex-grow">
                        <button id="btn-aba-todos" onclick="window.mudarAbaMochila('todos')" class="px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('todos')}"><i class="fas fa-th-large mr-1"></i> Geral</button>
                        <button id="btn-aba-equipamentos" onclick="window.mudarAbaMochila('equipamentos')" class="px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('equipamentos')}"><i class="fas fa-shield-alt mr-1"></i> Equipamentos</button>
                        <button id="btn-aba-consumiveis" onclick="window.mudarAbaMochila('consumiveis')" class="px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('consumiveis')}"><i class="fas fa-flask mr-1"></i> Consumíveis</button>
                        <button id="btn-aba-materiais" onclick="window.mudarAbaMochila('materiais')" class="px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('materiais')}"><i class="fas fa-box-open mr-1"></i> Materiais Base</button>
                        <button id="btn-aba-diversos" onclick="window.mudarAbaMochila('diversos')" class="px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass('diversos')}"><i class="fas fa-star mr-1"></i> Diversos</button>
                    </div>

                    <div id="mochila-weight-tracker" class="shrink-0 flex items-center px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg shadow-inner transition-colors duration-300">
                        <i class="fas fa-weight-hanging text-slate-500 mr-2"></i>
                        <span class="text-xs font-bold font-mono tracking-widest text-slate-300">
                            <span id="weight-current">0.0</span> / <span id="weight-max">50.0</span> kg
                        </span>
                    </div>
                </div>
            </div>
        `;
    } else {
        ['todos', 'equipamentos', 'consumiveis', 'materiais', 'diversos'].forEach(aba => {
            let btn = document.getElementById(`btn-aba-${aba}`);
            if (btn) btn.className = `px-4 py-2 rounded border text-xs uppercase tracking-wider transition-all whitespace-nowrap ${getBtnClass(aba)}`;
        });
    }

    grid.className = "grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 content-start bg-slate-900 border border-slate-700 rounded-xl p-4 flex-grow overflow-y-auto custom-scroll shadow-inner min-h-[300px]";

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full h-full flex flex-col items-center justify-center text-slate-500 py-10"><i class="fas fa-wind text-4xl mb-3 opacity-50"></i><p>Nenhum item listado.</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(function(item) {
        let rankStyle = getRankColor(item.rank);
        const isEquipped = Object.values(charData.ficha.equipamentos || charData.ficha.equipamento || {}).includes(item.id);
        const isEgo = charData.ficha.armaEspiritual && charData.ficha.armaEspiritual.itemBaseId === item.id && charData.ficha.armaEspiritual.ativo;

        let equipClass = 'border-slate-600';
        if (isEgo) {
            equipClass = 'item-rainbow shadow-[0_0_10px_rgba(255,255,255,0.3)]';
        } else if (isEquipped) {
            equipClass = 'equipped shadow-[0_0_8px_rgba(16,185,129,0.5)] border-emerald-500';
        }

        return `
            <div class="inventory-slot relative group cursor-pointer hover:-translate-y-1 transition-transform ${isEquipped || isEgo ? 'equipped' : ''}" 
                 data-item-id="${item.id}" 
                 data-quantity="${item.qtd}" 
                 data-item-name="${item.nome.toLowerCase()}" 
                 title="${item.nome}">
                
                <div class="w-full aspect-square bg-slate-950 rounded-lg border ${equipClass} overflow-hidden relative shadow-md group-hover:border-amber-400 group-hover:shadow-[0_0_10px_rgba(245,158,11,0.5)] pointer-events-none">
                    
                    <div class="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${rankStyle} z-10 shadow-sm backdrop-blur-sm">
                        ${item.rank?.toUpperCase() || 'F'}
                    </div>
                    
                    ${item.isEquip ? '<div class="absolute top-1 right-1 text-[10px] text-sky-400 z-10 drop-shadow-md"><i class="fas fa-tshirt"></i></div>' : ''}
                    ${item.isConsumivel ? '<div class="absolute top-1 right-1 text-[10px] text-pink-400 z-10 drop-shadow-md"><i class="fas fa-flask"></i></div>' : ''}
                    ${item.isDiversos ? '<div class="absolute top-1 right-1 text-[10px] text-slate-300 z-10 drop-shadow-md"><i class="fas fa-star"></i></div>' : ''}
                    ${item.isMaterial && !item.isEquip && !item.isConsumivel && !item.isDiversos ? '<div class="absolute top-1 right-1 text-[10px] text-emerald-500 z-10 drop-shadow-md"><i class="fas fa-leaf"></i></div>' : ''}

                    <img src="${item.img}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    
                    ${isEquipped && !isEgo ? '<div class="equipped-overlay">E</div>' : ''}
                    ${isEgo ? '<div class="equipped-overlay" style="background-color: rgba(0,0,0,0.4); text-shadow: 0 0 5px white;">EGO</div>' : ''}

                    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent"></div>
                    <div class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 shadow">
                        ${item.qtd}
                    </div>
                </div>
                
                <div class="slot-actions" style="pointer-events: auto;">
                    ${item.isUsavel ? `<button class="btn-action-icon btn-use" title="Consumir / Usar Item"><i class="fas fa-utensils pointer-events-none text-emerald-400"></i></button>` : ''}
                    <button class="btn-action-icon btn-share" title="Enviar Item"><i class="fas fa-share pointer-events-none"></i></button>
                    <button class="btn-action-icon btn-delete" title="Destruir Item"><i class="fas fa-trash pointer-events-none text-red-400"></i></button>
                </div>
            </div>
        `;
    }).join('');

    const weightStats = calculateWeightStats(charData.ficha, charData.ficha.levelPersonagemBase || 1);
    const wCurrentEl = document.getElementById('weight-current');
    const wMaxEl = document.getElementById('weight-max');
    const wTracker = document.getElementById('mochila-weight-tracker');

    if (wCurrentEl && wMaxEl && wTracker) {
        wCurrentEl.textContent = weightStats.current.toFixed(1);
        wMaxEl.textContent = weightStats.max.toFixed(1);
        
        const pct = weightStats.current / weightStats.max;
        
        wTracker.classList.remove('border-red-500', 'border-amber-500', 'border-slate-700', 'shadow-[0_0_10px_rgba(239,68,68,0.3)]');
        
        if (pct > 1) {
            wTracker.classList.add('border-red-500', 'shadow-[0_0_10px_rgba(239,68,68,0.3)]');
            wCurrentEl.className = 'text-red-500 animate-pulse font-bold';
        } 
        else if (pct >= 0.8) {
            wTracker.classList.add('border-amber-500');
            wCurrentEl.className = 'text-amber-400 font-bold';
        } 
        else {
            wTracker.classList.add('border-slate-700');
            wCurrentEl.className = 'text-slate-300';
        }
    }
}

function toggleMochilaItemDetails(itemId) {
    const detailsPanel = document.getElementById('item-details-panel');
    if(!detailsPanel) return;

    document.querySelectorAll('#mochila-content .inventory-slot.selected').forEach(el => el.classList.remove('selected'));

    if (!detailsPanel.classList.contains('hidden') && globalState.mochila.lastSelectedItem === itemId) {
        detailsPanel.classList.add('hidden');
        globalState.mochila.lastSelectedItem = null;
        return;
    }
    
    const item = globalState.cache.itens.get(itemId);
    if (!item) return;

    document.querySelector(`#mochila-content .inventory-slot[data-item-id="${itemId}"]`)?.classList.add('selected');
    globalState.mochila.lastSelectedItem = itemId;

    detailsPanel.innerHTML = `
        <div id="item-details-content">
            <img id="details-image" src="${item.imagemUrl || ''}" class="${!item.imagemUrl ? 'hidden' : ''}">
            <div id="details-info">
                <h3 class="font-cinzel !text-left !border-none !mb-2">${item.nome || 'Item sem nome'}</h3>
                <p>${item.descricao?.replace(/\n/g, '<br>') || 'Sem descrição.'}</p>
                <div id="details-stats" class="mt-4"></div>
            </div>
        </div>
    `;

    const statsContainer = detailsPanel.querySelector('#details-stats');
    let hasStats = false;
    ['atk_base', 'def_base', 'eva_base', 'hp_base', 'mp_base', 'iniciativa_base', 'movimento_base', 'ap_base'].forEach(key => {
         if (item[key] && item[key] !== 0) {
            const p = document.createElement('p');
            const statName = key.replace('_base', '').toUpperCase();
            p.innerHTML = `<strong>${statName}:</strong> ${item[key] > 0 ? '+' : ''}${item[key]}`;
            statsContainer.appendChild(p);
            hasStats = true;
         }
    });
    Object.keys(item).forEach(key => {
        if (key.startsWith('bonus') && item[key] !== 0) {
            const p = document.createElement('p');
            const statName = key.replace('bonus', '').replace('ItemBase', '').replace(/([A-Z])/g, ' $1').trim();
            p.innerHTML = `<strong>${statName}:</strong> ${item[key] > 0 ? '+' : ''}${item[key]}`;
            statsContainer.appendChild(p);
            hasStats = true;
        }
    });
    
    if (item.efeitos_especiais && Object.keys(item.efeitos_especiais).length > 0) {
        if (hasStats) statsContainer.appendChild(document.createElement('hr'));
        
        const effectNames = Object.keys(item.efeitos_especiais).map(effectId => {
            const effectData = globalState.cache.efeitos.get(effectId);
            return effectData ? effectData.nome : `ID:${effectId}`;
        }).join(', ');

        const p = document.createElement('p');
        p.innerHTML = `<strong>Efeitos Especiais:</strong> ${effectNames}`;
        statsContainer.appendChild(p);
    }

    detailsPanel.classList.remove('hidden');
}

function createMochilaActionPanel(itemId, currentQuantity, actionType) {
    const container = document.getElementById('action-panel-container');
    if(!container) return;

    const itemDetails = globalState.cache.itens.get(itemId);
    
    let title = '';
    let buttonText = '';
    let quantityLabel = 'Quantidade';
    const isUse = actionType === 'use';
    const isShare = actionType === 'share';

    const isBackpack = itemDetails.nome.startsWith('Mochila');
    const efeitoVal = itemDetails.efeitoItemUsavel || 0;
    let effectHtml = '';
    
    if (isBackpack) {
        effectHtml = `<i class="fas fa-weight-hanging mr-2"></i> Aumenta +${efeitoVal}kg de Capacidade Máxima`;
    } else {
        effectHtml = `<i class="fas fa-heartbeat mr-2"></i> Recupera +${efeitoVal} de Fome`;
    }

    if (isShare) {
        title = `ENVIAR "${itemDetails.nome}"`;
        buttonText = 'Enviar';
        quantityLabel = 'Quantidade a Enviar';
    } else if (actionType === 'delete') {
        title = `JOGAR FORA "${itemDetails.nome}"`;
        buttonText = 'Jogar Fora';
        quantityLabel = 'Quantidade a Jogar Fora';
    } else if (isUse) {
        title = isBackpack ? `EQUIPAR "${itemDetails.nome}"` : `CONSUMIR "${itemDetails.nome}"`;
        buttonText = isBackpack ? 'Utilizar Mochila' : 'Consumir 1x';
    }

    container.innerHTML = `
        <div id="action-panel" class="animate-fade-in">
            <h3 class="font-cinzel uppercase ${isUse ? (isBackpack ? 'text-sky-400' : 'text-emerald-400') : ''}">${title}</h3>
            <hr class="border-slate-700 my-4">
            <div class="form-grid">
                
                ${!isUse ? `
                    <div class="form-field">
                        <label for="action-quantity">${quantityLabel}</label>
                        <input type="number" id="action-quantity" value="1" min="1" max="${currentQuantity}">
                    </div>
                ` : `
                    <div class="form-field">
                        <label>Efeito do Consumível</label>
                        <div class="std-height flex items-center px-4 bg-slate-900 border ${isBackpack ? 'border-sky-500/50 text-sky-400' : 'border-emerald-500/50 text-emerald-400'} rounded text-sm font-bold shadow-inner">
                            ${effectHtml}
                        </div>
                    </div>
                `}

                <div class="form-field ${isShare ? '' : 'hidden'}" id="target-character-field">
                    <label for="share-character-select">Para</label>
                    <select id="share-character-select"></select>
                </div>

                <div class="form-field flex items-end">
                    <button id="btn-action-confirm" class="btn ${isUse ? (isBackpack ? 'btn-info shadow-[0_0_15px_rgba(2,132,199,0.3)]' : 'btn-green shadow-[0_0_15px_rgba(22,163,74,0.3)]') : 'btn-primary'} w-full">
                        ${isUse ? (isBackpack ? '<i class="fas fa-shopping-bag mr-2"></i>' : '<i class="fas fa-utensils mr-2"></i>') : ''}${buttonText}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    if (isShare) {
        const targetField = container.querySelector('#target-character-field');
        targetField.classList.remove('hidden');
        const select = container.querySelector('#share-character-select');
        select.innerHTML = '';
        const currentCharId = globalState.selectedCharacterId;
        
        globalState.cache.all_personagens.forEach((char, id) => {
            if (id !== currentCharId) {
                select.add(new Option(`${char.nome} (${char.jogador || '???'})`, id));
            }
        });
        
        if (select.options.length === 0) {
            select.add(new Option('Nenhum outro personagem', ''));
            select.disabled = true;
        }
    }

    container.querySelector('#btn-action-confirm').addEventListener('click', () => {
        if (isUse) {
            confirmUseItem(itemId);
        } else {
            const qty = parseInt(container.querySelector('#action-quantity').value);
            if (isShare) confirmShareItem(itemId, qty);
            else confirmDeleteItem(itemId, qty);
        }
    });
}

async function confirmUseItem(itemId) {
    const charId = globalState.selectedCharacterId;
    const itemDetails = globalState.cache.itens.get(itemId);
    const efeitoVal = Number(itemDetails.efeitoItemUsavel) || 0;
    
    const isBackpack = itemDetails.nome.startsWith('Mochila');
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const docSnap = await t.get(ref);
            if (!docSnap.exists()) throw "Ficha não encontrada.";
            
            const data = docSnap.data();
            const mochila = data.mochila || {};
            
            if (!mochila[itemId] || mochila[itemId] < 1) {
                throw "Você não possui este item na mochila.";
            }
            
            mochila[itemId] -= 1;
            if (mochila[itemId] <= 0) delete mochila[itemId];
            
            if (isBackpack) {
                const currentBonus = Number(data.bonusPesoMochilas || 0);
                const currentUses = Number(data.qtdMochilasUsadas || 0);
                
                t.update(ref, { 
                    mochila: mochila,
                    bonusPesoMochilas: currentBonus + efeitoVal,
                    qtdMochilasUsadas: currentUses + 1
                });
            } else {
                const atributos = data.atributosBasePersonagem || {};
                const fomeExtra = Number(atributos.pontosFomeExtraTotal || 0);
                const fomeMax = Math.floor(100 + fomeExtra);
                
                let fomeAtual = data.fomeAtual !== undefined ? Number(data.fomeAtual) : fomeMax;
                const novaFome = Number(Math.min(fomeMax, fomeAtual + efeitoVal).toFixed(1));
                
                t.update(ref, { 
                    mochila: mochila,
                    fomeAtual: novaFome
                });
            }
        });
        
        const actionPanel = document.getElementById('action-panel-container');
        if(actionPanel) actionPanel.innerHTML = '';
        
        if (isBackpack) {
            alert(`Equipado com sucesso!\nVocê utilizou "${itemDetails.nome}" e sua capacidade máxima de carga aumentou em +${efeitoVal}kg permanentemente.`);
        } else {
            alert(`Nham nham! Você consumiu 1x ${itemDetails.nome} e recuperou ${efeitoVal} de Fome.`);
        }
        
        renderMochila(); 
        
    } catch (e) {
        console.error("Erro ao usar item:", e);
        alert("Erro ao usar item: " + e);
    }
}

async function confirmDeleteItem(itemId, quantityToDelete) {
    const charId = globalState.selectedCharacterId;
    const sourceQuantity = parseInt(globalState.selectedCharacterData.ficha.mochila?.[itemId] || 0);

    if (isNaN(quantityToDelete) || quantityToDelete <= 0 || quantityToDelete > sourceQuantity) {
        return alert("Por favor, insira uma quantidade válida.");
    }
    
    const newQuantity = sourceQuantity - quantityToDelete;
    const updateData = {};
    updateData[`mochila.${itemId}`] = (newQuantity > 0) ? newQuantity : deleteField();

    try {
        await updateDoc(doc(db, "rpg_fichas", charId), updateData);
        const updatedCharData = (await getDoc(doc(db, "rpg_fichas", charId))).data();
        const updatedCharWithId = { id: charId, ...updatedCharData };
        globalState.cache.personagens.set(charId, updatedCharWithId);
        globalState.cache.all_personagens.set(charId, updatedCharWithId);
        globalState.selectedCharacterData.ficha = updatedCharWithId;
        
        const actionPanel = document.getElementById('action-panel-container');
        if(actionPanel) actionPanel.innerHTML = '';
        
        renderMochila();
    } catch(e) {
        console.error("Erro ao deletar item:", e);
        alert("Erro ao deletar item.");
    }
}

async function confirmShareItem(itemId, quantityToSend) {
    const sourceCharId = globalState.selectedCharacterId;
    const destCharId = document.getElementById('action-panel-container').querySelector('#share-character-select').value;
    const sourceQuantity = parseInt(globalState.selectedCharacterData.ficha.mochila?.[itemId] || 0);

    if (!destCharId || isNaN(quantityToSend) || quantityToSend <= 0 || quantityToSend > sourceQuantity) {
        return alert("Verifique os dados: selecione um personagem e uma quantidade válida.");
    }

    try {
        await runTransaction(db, async (transaction) => {
            const sourceRef = doc(db, "rpg_fichas", sourceCharId);
            const destRef = doc(db, "rpg_fichas", destCharId);
            
            const sourceDoc = await transaction.get(sourceRef);
            if (!sourceDoc.exists() || (sourceDoc.data().mochila?.[itemId] || 0) < quantityToSend) {
                throw new Error("Quantidade insuficiente!");
            }
            
            const newSourceQuantity = sourceDoc.data().mochila[itemId] - quantityToSend;
            const updateSource = {};
            updateSource[`mochila.${itemId}`] = (newSourceQuantity > 0) ? newSourceQuantity : deleteField();
            
            transaction.update(sourceRef, updateSource);
            transaction.update(destRef, { [`mochila.${itemId}`]: increment(quantityToSend) });
        });

        alert("Item enviado com sucesso!");
        
        const [updatedSource, updatedDest] = await Promise.all([    
            getDoc(doc(db, "rpg_fichas", sourceCharId)),    
            getDoc(doc(db, "rpg_fichas", destCharId))    
        ]);
        
        if(updatedSource.exists()) {
            const updatedData = updatedSource.data();
            const updatedWithId = { id: sourceCharId, ...updatedData };
            globalState.cache.personagens.set(sourceCharId, updatedWithId);
            globalState.cache.all_personagens.set(sourceCharId, updatedWithId);
            globalState.selectedCharacterData.ficha = updatedWithId;
        }
        if(updatedDest.exists()) {
            const updatedData = updatedDest.data();
            const updatedWithId = {id: destCharId, ...updatedData};
            globalState.cache.personagens.set(destCharId, updatedWithId);
            globalState.cache.all_personagens.set(destCharId, updatedWithId);
        }
        
        const actionPanel = document.getElementById('action-panel-container');
        if(actionPanel) actionPanel.innerHTML = '';
        
        renderMochila();

    } catch (error) {
        console.error("Falha na transação:", error);
        alert("Erro ao enviar o item: " + error.message);
    }
}

// Funções globais que precisam ser acessadas pelo HTML diretamente
window.mudarAbaMochila = function(aba) {
    globalState.mochilaUI.abaAtiva = aba;
    renderMochila(); 
};

window.mudarOrdemMochila = function(ordem) {
    globalState.mochilaUI.ordenacao = ordem;
    renderMochila(); 
};

window.filtrarBuscaMochila = function(texto) {
    globalState.mochilaUI.busca = texto.toLowerCase();
    renderMochila(true); 
};

// Listeners estáticos que não devem ser recriados a cada renderização
export function setupMochilaListeners() {
    const grid = document.getElementById('inventory-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const slot = e.target.closest('.inventory-slot');
            if (!slot || !globalState.selectedCharacterData) return;
            
            const { itemId, quantity } = slot.dataset;
            
            if (e.target.classList.contains('btn-action-icon')) {
                e.stopPropagation();
                const charData = globalState.selectedCharacterData.ficha;
                const equippedItemIds = new Set(Object.values(charData.equipamento || charData.equipamentos || {}));

                if (e.target.classList.contains('btn-use')) {
                    createMochilaActionPanel(itemId, quantity, 'use');
                }
                else if (e.target.classList.contains('btn-delete')) {
                    if (equippedItemIds.has(itemId)) {
                        alert('Você precisa desequipar este item antes de jogá-lo fora.');
                        return;
                    }
                    createMochilaActionPanel(itemId, quantity, 'delete');
                } 
                else if (e.target.classList.contains('btn-share')) {
                     if (equippedItemIds.has(itemId)) {
                        alert('Você precisa desequipar este item antes de enviá-lo.');
                        return;
                    }
                    createMochilaActionPanel(itemId, quantity, 'share');
                }
            } else {
                toggleMochilaItemDetails(itemId);
            }
        });
    }

    const filtroInput = document.getElementById('mochila-filtro');
    if (filtroInput) {
        filtroInput.addEventListener('input', (e) => {
            const filterText = e.target.value.toLowerCase();
            const itemSlots = grid.querySelectorAll('.inventory-slot');
            
            itemSlots.forEach(slot => {
                const itemName = slot.dataset.itemName;
                if (itemName.includes(filterText)) {
                    slot.style.display = '';
                } else {
                    slot.style.display = 'none';
                }
            });
        });
    }
}
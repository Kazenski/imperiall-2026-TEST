import { db, doc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

const PAPER_DOLL_CONFIG = {
    left: [
        { id: 'cabeca', label: 'Cabeça', icon: 'fa-helmet-safety' },
        { id: 'ombros', label: 'Ombros', icon: 'fa-user-shield' },
        { id: 'peitoral', label: 'Peitoral', icon: 'fa-shirt' },
        { id: 'cinturao', label: 'Cinturão', icon: 'fa-grip-lines' },
        { id: 'pernas', label: 'Pernas', icon: 'fa-socks' },
        { id: 'botas', label: 'Botas', icon: 'fa-boot' },
        { id: 'colar', label: 'Colar', icon: 'fa-gem' },
        { id: 'brinco', label: 'Brinco', icon: 'fa-lightbulb' } 
    ],
    right: [
        { id: 'arma_primaria', label: 'Arma Prim.', icon: 'fa-gavel' },
        { id: 'arma_secundaria', label: 'Arma Sec.', icon: 'fa-shield-halved' },
        { id: 'arma_2_maos', label: 'Duas Mãos', icon: 'fa-hammer' },
        { id: 'bracadeiras', label: 'Braçadeiras', icon: 'fa-hands-bound' },
        { id: 'pulseira_1', label: 'Pulseira 1', icon: 'fa-ring' },
        { id: 'pulseira_2', label: 'Pulseira 2', icon: 'fa-ring' },
        { id: 'anel_1', label: 'Anel 1', icon: 'fa-circle-notch' },
        { id: 'anel_2', label: 'Anel 2', icon: 'fa-circle-notch' }
    ]
};

export async function renderItensEquipados() {
    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    const bgLayer = document.getElementById('paper-doll-bg-layer');
    if (!bgLayer) return;

    const charData = globalState.cache.all_personagens.get(charId) || globalState.selectedCharacterData || {};
    const ficha = charData.ficha || charData; 
    
    // Lê o campo plural 'equipamentos'
    const equipados = ficha.equipamentos || {}; 

    // 1. LÓGICA DO BACKGROUND
    let bgUrl = "";
    const mainKey = ficha.imagemPrincipal || charData.imagemPrincipal; 
    const urls = ficha.imageUrls || charData.imageUrls || {};

    if (mainKey && urls[mainKey]) {
        bgUrl = urls[mainKey];
    } else if (ficha.imagemUrl && ficha.imagemUrl.startsWith('http')) {
        bgUrl = ficha.imagemUrl;
    } else if (charData.imagemUrl && charData.imagemUrl.startsWith('http')) {
        bgUrl = charData.imagemUrl;
    }

    if (bgUrl) {
        bgLayer.style.backgroundImage = `url('${bgUrl}')`;
        bgLayer.style.backgroundColor = "transparent";
    } else {
        bgLayer.style.backgroundImage = "none";
        bgLayer.style.backgroundColor = "#0f172a";
    }

    // 2. RENDERIZAR GRIDS
    _renderGrid('doll-grid-left', PAPER_DOLL_CONFIG.left, equipados);
    _renderGrid('doll-grid-right', PAPER_DOLL_CONFIG.right, equipados);

    // 3. CALCULAR STATUS
    _updateTotalStats(equipados);
}

function _renderGrid(containerId, slots, equipados) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    slots.forEach(slot => {
        const itemId = equipados[slot.id];
        let contentHtml = '';
        let borderClass = 'border-slate-600';

        if (itemId) {
            const item = globalState.cache.itens.get(itemId);
            if (item) {
                const raridade = (item.raridade || 'comum').toLowerCase();
                borderClass = `border-${raridade}`; 
                const itemImg = item.imagemUrl || item.imageUrl || "";

                if (itemImg) {
                    contentHtml = `<img src="${itemImg}" class="equipped-item-img" title="${item.nome}" onerror="this.style.display='none'">`;
                } else {
                    contentHtml = `<i class="fas ${slot.icon} text-amber-500 text-3xl drop-shadow-md"></i>`;
                }
            } else {
                contentHtml = `<i class="fas fa-exclamation-triangle text-red-500" title="Item não encontrado"></i>`;
            }
        } else {
            contentHtml = `<i class="fas ${slot.icon} slot-placeholder-icon"></i>`;
        }

        const div = document.createElement('div');
        div.className = `equip-slot-card ${borderClass}`;
        div.onclick = () => window.openEquipModal(slot.id, slot.label);
        
        div.innerHTML = `
            ${contentHtml}
            <div class="slot-label">${slot.label}</div>
        `;
        container.appendChild(div);
    });
}

function _updateTotalStats(equipados) {
    let atk = 0, def = 0, eva = 0;
    
    Object.values(equipados).forEach(itemId => {
        const item = globalState.cache.itens.get(itemId);
        if (item) {
            atk += Number(item.atk_base || 0);
            def += Number(item.def_base || 0);
            eva += Number(item.eva_base || 0);
        }
    });

    const set = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) el.textContent = val > 0 ? `+${val}` : val; 
    };
    
    set('doll-total-atk', atk); 
    set('doll-total-def', def); 
    set('doll-total-eva', eva);
}

window.openEquipModal = function(slotTargetId, slotLabel) {
    const modal = document.getElementById('equipment-selector-modal');
    const listContainer = document.getElementById('modal-item-list'); 
    const title = document.getElementById('modal-slot-name');
    const btnUnequip = document.getElementById('btn-unequip-current');

    if (!modal || !listContainer || !title) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    listContainer.innerHTML = ''; 
    title.textContent = slotLabel;

    const charData = globalState.selectedCharacterData;
    const ficha = charData.ficha || charData;
    const mochila = ficha.mochila || {};
    const equipados = ficha.equipamentos || {}; 
    
    const itemAtualId = equipados[slotTargetId];
    if (itemAtualId && btnUnequip) {
        btnUnequip.classList.remove('hidden');
        const newBtn = btnUnequip.cloneNode(true);
        btnUnequip.parentNode.replaceChild(newBtn, btnUnequip);
        newBtn.onclick = () => window.handleUnequip(slotTargetId, itemAtualId);
        newBtn.classList.remove('hidden');
    } else if (btnUnequip) {
        btnUnequip.classList.add('hidden');
    }

    let foundCount = 0;

    for (const [itemId, qtd] of Object.entries(mochila)) {
        const item = globalState.cache.itens.get(itemId);
        
        if (item && item.slot_equipavel_id === slotTargetId) {
            foundCount++;
            
            const itemImg = item.imagemUrl || item.imageUrl || "";
            let imgTag = itemImg 
                ? `<img src="${itemImg}" class="w-full h-full object-contain drop-shadow-md">` 
                : `<i class="fas fa-box text-slate-600 text-3xl"></i>`;

            const card = document.createElement('div');
            card.className = "bg-slate-800 p-2 rounded border border-slate-600 item-select-card cursor-pointer relative group flex flex-col items-center gap-2 hover:border-amber-500 transition-all";
            card.onclick = () => window.handleEquip(slotTargetId, itemId);

            card.innerHTML = `
                <div class="w-16 h-16 bg-slate-900/50 rounded flex items-center justify-center overflow-hidden border border-slate-700 relative">
                    ${imgTag}
                    <div class="absolute bottom-0 right-0 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded-tl font-bold border-t border-l border-slate-600">${qtd}</div>
                </div>
                <div class="text-[10px] text-center text-slate-300 leading-tight font-bold w-full truncate">
                    ${item.nome}
                </div>
                <div class="text-[9px] text-slate-500 uppercase tracking-widest">${item.raridade || 'Comum'}</div>
            `;
            listContainer.appendChild(card);
        }
    }

    if (foundCount === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center text-slate-500 py-12 h-full">
                <i class="fas fa-ghost text-5xl mb-4 opacity-20"></i>
                <p class="text-sm font-cinzel text-amber-500/50">Mochila vazia para este slot</p>
                <p class="text-[10px] mt-1 opacity-50">Esperando ID: ${slotTargetId}</p>
            </div>
        `;
    }
};

window.handleEquip = async function(slotId, itemId) {
    const charId = globalState.selectedCharacterId;
    document.getElementById('equipment-selector-modal').classList.add('hidden');
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            
            let dataRoot = d.ficha ? d.ficha : d; 
            const moch = dataRoot.mochila || {};
            const equip = dataRoot.equipamentos || {}; 

            // 1. Devolve item antigo
            if (equip[slotId]) {
                const oldItem = equip[slotId];
                moch[oldItem] = (moch[oldItem] || 0) + 1;
            }

            // 2. REGRA DE 2 MÃOS
            if (slotId === 'arma_2_maos') {
                ['arma_primaria', 'arma_secundaria'].forEach(conflict => {
                    if (equip[conflict]) {
                        const itemRemovido = equip[conflict];
                        moch[itemRemovido] = (moch[itemRemovido] || 0) + 1;
                        delete equip[conflict];
                    }
                });
            }
            if (slotId === 'arma_primaria' || slotId === 'arma_secundaria') {
                if (equip['arma_2_maos']) {
                    const twoHandItem = equip['arma_2_maos'];
                    moch[twoHandItem] = (moch[twoHandItem] || 0) + 1;
                    delete equip['arma_2_maos'];
                }
            }

            // 3. Remove novo e equipa
            if (moch[itemId] > 1) moch[itemId]--; else delete moch[itemId];
            equip[slotId] = itemId;

            // 4. SALVA
            const updates = {};
            if(d.ficha) {
                updates["ficha.mochila"] = moch;
                updates["ficha.equipamentos"] = equip;
            } else {
                updates["mochila"] = moch;
                updates["equipamentos"] = equip;
            }
            t.update(ref, updates);
        });
        
        await renderItensEquipados();

    } catch (e) { alert("Erro ao equipar: " + e.message); }
};

window.handleUnequip = async function(slotId, itemId) {
    const charId = globalState.selectedCharacterId;
    document.getElementById('equipment-selector-modal').classList.add('hidden');
    
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            
            let dataRoot = d.ficha ? d.ficha : d;
            const moch = dataRoot.mochila || {};
            const equip = dataRoot.equipamentos || {}; 

            moch[itemId] = (moch[itemId] || 0) + 1;
            delete equip[slotId];

            const updates = {};
            if(d.ficha) {
                updates["ficha.mochila"] = moch;
                updates["ficha.equipamentos"] = equip;
            } else {
                updates["mochila"] = moch;
                updates["equipamentos"] = equip;
            }
            t.update(ref, updates);
        });

        await renderItensEquipados();

    } catch (e) { alert("Erro ao desequipar: " + e.message); }
};

// Legado: renderizador antigo de slots de select (mantido caso ainda exista em alguma parte do painel admin)
export function renderSlotsEquipamento() {
    const grid = document.querySelector('.equipamento-grid');
    if(!grid) return;
    grid.innerHTML = '';
    [...globalState.cache.tiposItens.values()].sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t => {
        const slots = (t.id === 'anel') ? ['anel_1','anel_2'] : ((t.id === 'pulseira') ? ['pulseira_1','pulseira_2'] : [t.id]);
        slots.forEach(sid => {
            const d = document.createElement('div');
            d.className = 'slot-equipamento';
            d.innerHTML = `
                <i class="fas ${t.icone} slot-icon"></i>
                <div class="slot-info w-full">
                    <label>${t.nome} ${slots.length>1 ? (sid.includes('1')?'1':'2') : ''}</label>
                    <select id="equip-${sid}" data-type="${t.id}" disabled></select>
                </div>`;
            grid.appendChild(d);
            d.querySelector('select').addEventListener('change', e => {
                const btnSalvar = document.getElementById('btn-salvar-equipamento');
                if(btnSalvar) btnSalvar.disabled = false;
                d.classList.add('changed');
                globalState.selectedCharacterData.ficha.equipamento[sid] = e.target.value;
            });
        });
    });
}
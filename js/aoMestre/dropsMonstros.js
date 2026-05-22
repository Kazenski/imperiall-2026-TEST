import { db, doc, updateDoc, increment, collection, getDocs } from '../core/firebase.js';
import { globalState } from '../core/state.js';

export function renderDropsMonstrosTab() {
    const container = document.getElementById('drops-monstros-content');
    if (!container) return;


    // Estrutura Base - Ocupando 100% (w-full) e removendo scroll (overflow-hidden) ok
    container.innerHTML = `
        <div class="w-full h-full flex flex-col overflow-hidden animate-fade-in">
            
            <div class="flex flex-col lg:flex-row justify-between items-center bg-slate-800/50 p-4 sm:px-6 lg:px-8 border-b-2 border-amber-500/30 shrink-0 gap-4">
                <div class="flex-grow">
                    <h1 class="text-2xl sm:text-3xl font-bold font-cinzel text-amber-400 tracking-wider">Compêndio de Monstros</h1>
                    <p class="text-slate-400 mt-1 uppercase tracking-widest text-[10px]">Consulte e role os drops</p>
                </div>
                <div class="w-full lg:w-[450px] shrink-0">
                    <select id="drops-monster-select" class="block w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-md text-amber-500 font-bold focus:outline-none focus:border-amber-500 transition-colors text-sm shadow-inner">
                        <option value="">-- Carregando Monstros... --</option>
                    </select>
                </div>
            </div>

            <div id="drops-monster-display" class="w-full flex-grow p-4 sm:p-6 lg:p-8 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
                <div class="flex flex-col items-center justify-center h-full bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-lg">
                    <i class="fas fa-dragon text-6xl text-slate-700 mb-4"></i>
                    <p class="text-xl text-slate-500 font-cinzel">Selecione um monstro acima para acessar seus drops.</p>
                </div>
            </div>
        </div>
    `;

    const selectEl = container.querySelector('#drops-monster-select');

    // Popula o seletor lendo do cache global
    const mobsArray = Array.from(globalState.cache.mobs.values()).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    if (mobsArray.length === 0) {
        selectEl.innerHTML = '<option value="">Nenhum monstro cadastrado no sistema</option>';
        selectEl.disabled = true;
    } else {
        selectEl.innerHTML = '<option value="">-- Selecione o Monstro --</option>';
        mobsArray.forEach(mob => {
            selectEl.add(new Option(mob.nome, mob.id));
        });
    }

    // Lida com a seleção
    selectEl.addEventListener('change', (e) => {
        const mobId = e.target.value;
        if (!mobId) {
            container.querySelector('#drops-monster-display').innerHTML = `
                <div class="flex flex-col items-center justify-center h-full bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-lg">
                    <i class="fas fa-dragon text-6xl text-slate-700 mb-4"></i>
                    <p class="text-xl text-slate-500 font-cinzel">Selecione um monstro acima para acessar seus drops.</p>
                </div>`;
            return;
        }

        const mob = globalState.cache.mobs.get(mobId);
        if (mob) renderMonsterCard(mob, container.querySelector('#drops-monster-display'));
    });
}

function renderMonsterCard(mob, displayContainer) {
    const drops = mob.drops || {};
    const dropIds = Object.keys(drops);
    let dropsHtml = '';

    if (dropIds.length === 0) {
        dropsHtml = '<p class="text-slate-400 text-sm italic py-2">O criador não definiu nenhum drop para este monstro.</p>';
    } else {
        // Agora os ícones preenchem lado a lado usando flex-wrap
        dropsHtml = `<div class="flex flex-wrap gap-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700">`;
        dropIds.forEach(itemId => {
            const itemCache = globalState.cache.itens.get(itemId);
            const qtyMax = drops[itemId];
            const imgUrl = itemCache?.imagemUrl || 'https://placehold.co/100x100/1e293b/d4af37?text=Sem+Foto';
            const itemName = itemCache?.nome || 'Item Desconhecido';

            dropsHtml += `
                <div class="relative w-20 h-20 bg-[#cdc1b0] border-2 border-[#5c4033] rounded-lg bg-contain bg-no-repeat bg-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] shrink-0 group hover:border-amber-500 transition-colors cursor-help" title="${itemName} (Max: ${qtyMax})" style="background-image: url('${imgUrl}');">
                    <div class="absolute bottom-1 right-1 min-w-[20px] text-center px-1 bg-black/90 text-white text-[11px] font-bold rounded shadow">
                        x${qtyMax}
                    </div>
                </div>
            `;
        });
        dropsHtml += `</div>`;
    }

    const fotoUrl = (mob.imageUrls && mob.imageUrls.imagem1) ? mob.imageUrls.imagem1 : 'https://placehold.co/600x600/1e293b/d4af37?text=Monstro';

    displayContainer.innerHTML = `
        <div class="bg-slate-800/70 rounded-xl border border-slate-700 shadow-2xl flex flex-col md:flex-row h-full min-h-0">
            
            <div class="flex-shrink-0 w-full md:w-80 lg:w-96 flex flex-col p-6 bg-slate-900/40 border-r border-slate-700">
                <div class="flex-grow flex items-center justify-center mb-6">
                    <img src="${fotoUrl}" alt="Foto ${mob.nome}" class="w-full max-w-[280px] aspect-square rounded-2xl object-cover border-4 border-slate-600 shadow-2xl" />
                </div>
                
                <button id="btn-abrir-drop" class="w-full py-4 px-6 bg-yellow-600 text-black font-black uppercase tracking-widest text-[11px] rounded-lg hover:bg-yellow-500 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(202,138,4,0.4)] hover:shadow-[0_0_20px_rgba(202,138,4,0.6)] shrink-0">
                    <i class="fas fa-dice text-lg mr-2"></i> Rolar Drops do Monstro
                </button>
            </div>

            <div class="flex-grow flex flex-col p-6 min-w-0 overflow-y-auto custom-scrollbar">
                
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-600 pb-3 mb-6 shrink-0 gap-2">
                    <h3 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-400 leading-none drop-shadow-md">${mob.nome}</h3>
                    <p class="text-xs text-slate-400 uppercase tracking-widest sm:text-right shrink-0">Nível: <strong class="text-amber-500">${mob.levelPersonagemBase || '?'}</strong> &bull; EXP: <strong class="text-blue-400">${mob.experiencia || 0}</strong></p>
                </div>
                
                <h4 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 shrink-0">Atributos de Combate Base</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 shrink-0">
                    <div class="bg-slate-900/50 p-3 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fas fa-heart text-red-500 text-xl mb-1 drop-shadow"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">HP Max</span>
                        <span class="text-lg font-black text-white">${mob.hpMaxPersonagemBase || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fas fa-star text-blue-400 text-xl mb-1 drop-shadow"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">MP Max</span>
                        <span class="text-lg font-black text-white">${mob.mpMaxPersonagemBase || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fas fa-swords text-orange-400 text-xl mb-1 drop-shadow"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Ataque</span>
                        <span class="text-lg font-black text-white">${mob.atk_base || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fas fa-shield text-sky-400 text-xl mb-1 drop-shadow"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Defesa</span>
                        <span class="text-lg font-black text-white">${mob.def_base || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-3 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                        <i class="fas fa-wind text-green-400 text-xl mb-1 drop-shadow"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Evasão</span>
                        <span class="text-lg font-black text-white">${mob.eva_base || 0}</span>
                    </div>
                </div>

                <h4 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 shrink-0">Possíveis Drops</h4>
                <div class="shrink-0 mb-6">
                    ${dropsHtml}
                </div>
                
                <details class="group bg-slate-900/50 rounded-lg border border-slate-700 shrink-0 mt-auto">
                    <summary class="cursor-pointer p-4 text-xs font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 hover:bg-slate-800/50 transition-colors list-none flex justify-between items-center rounded-lg">
                        <div class="flex items-center"><i class="fas fa-scroll text-base mr-3 text-slate-400"></i> Descrição e Lore do Monstro</div>
                        <i class="fas fa-chevron-down text-slate-500 group-open:rotate-180 transition-transform duration-300"></i>
                    </summary>
                    <div class="p-4 pt-0 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed border-t border-slate-700/50 mt-2">
                        ${mob.descricao || '<i class="text-slate-500">Nenhum registro encontrado nos tomos do império...</i>'}
                    </div>
                </details>
            </div>
        </div>
    `;

    displayContainer.querySelector('#btn-abrir-drop').addEventListener('click', () => {
        if (dropIds.length === 0) return alert("Este monstro não possui drops configurados.");
        abrirModalDrop(mob);
    });
}

async function abrirModalDrop(mob) {
    const existing = document.getElementById('modal-drop-monstro');
    if (existing) existing.remove();

    // 1. Prepara as opções de Personagens do Cache
    const charArray = Array.from(globalState.cache.all_personagens.values()).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    let optionsHtml = '<option value="">-- Selecione o Aventureiro --</option>';
    charArray.forEach(char => {
        optionsHtml += `<option value="${char.id}">${char.nome} (${char.jogador || '???'})</option>`;
    });

    // NOVO: 2. Busca as Sessões direto da coleção rpg_sessions
    let sessoesOptionsHtml = '<option value="">-- Ou Selecione uma Sessão --</option>';
    const sessoesCache = {}; // Guardamos na memória para usar na hora de distribuir o loot

    try {
        const querySnapshot = await getDocs(collection(db, "rpg_sessions"));
        querySnapshot.forEach((docSnap) => {
            const sess = docSnap.data();
            sessoesCache[docSnap.id] = sess;
            sessoesOptionsHtml += `<option value="${docSnap.id}">${sess.nome || sess.name || 'Sessão Sem Nome'}</option>`;
        });
    } catch (error) {
        console.error("Erro ao buscar sessões do Fog of War:", error);
        sessoesOptionsHtml = '<option value="">-- Erro ao carregar sessões --</option>';
    }

    const modalHTML = `
        <div id="modal-drop-monstro" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-fade-in p-4">
            <div class="bg-slate-800 text-gray-200 p-6 rounded-lg shadow-2xl w-full max-w-md border border-slate-600 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 class="text-2xl font-bold font-cinzel text-amber-400 mb-4 tracking-wider border-b border-slate-700 pb-3">Dropar de ${mob.nome}</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2" for="drop-target-char">Conceder para o inventário de:</label>
                        <select id="drop-target-char" class="block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-md text-amber-500 font-bold focus:outline-none focus:border-amber-500 shadow-inner mb-3">
                            ${optionsHtml}
                        </select>

                        <div class="flex items-center gap-2 mb-3">
                            <hr class="flex-grow border-slate-600"><span class="text-[10px] font-bold text-slate-500 uppercase">OU DISTRIBUIR PARA</span><hr class="flex-grow border-slate-600">
                        </div>

                        <label class="block text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2" for="drop-target-session">Todos os jogadores da Sessão:</label>
                        <select id="drop-target-session" class="block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-md text-purple-400 font-bold focus:outline-none focus:border-purple-500 shadow-inner">
                            ${sessoesOptionsHtml}
                        </select>
                    </div>
                    
                    <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-700 leading-relaxed mb-4">
                        <label class="flex justify-between items-center text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-3" for="drop-chance-slider">
                            <span><i class="fas fa-sliders-h text-sky-400 mr-1"></i> Chance de Drop (Por Item)</span>
                            <span id="drop-chance-display" class="text-amber-500 text-lg font-black">70%</span>
                        </label>
                        <input type="range" id="drop-chance-slider" min="1" max="100" value="70" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 shadow-inner">
                        <p class="text-[10px] text-slate-500 mt-3 leading-tight">
                            A engine usará essa porcentagem para tentar validar cada item no pool. Se passar, a quantidade será sorteada entre <strong class="text-white">0 e a Máxima</strong>.
                            <br><br><span class="text-purple-400"><i class="fas fa-users"></i> Na distribuição por sessão, o drop total é rolado UMA vez e dividido.</span>
                        </p>
                    </div>

                    <div class="flex gap-4 mt-8">
                        <button id="btn-confirm-drop" class="flex-grow py-3 px-6 bg-green-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-md hover:bg-green-500 shadow-md transition-colors">
                            <i class="fas fa-check mr-2"></i> Confirmar Rolar Drops
                        </button>
                        <button id="btn-cancel-drop" class="py-3 px-6 bg-slate-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-md hover:bg-slate-500 transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('modal-drop-monstro');
    const selectChar = modal.querySelector('#drop-target-char');
    const selectSession = modal.querySelector('#drop-target-session');

    const chanceSlider = modal.querySelector('#drop-chance-slider');
    const chanceDisplay = modal.querySelector('#drop-chance-display');
    chanceSlider.addEventListener('input', (e) => {
        chanceDisplay.textContent = e.target.value + '%';
    });

    // Exclusão visual: Se escolher um char, zera a sessão e vice-versa
    selectChar.addEventListener('change', () => { if (selectChar.value) selectSession.value = ""; });
    selectSession.addEventListener('change', () => { if (selectSession.value) selectChar.value = ""; });

    modal.querySelector('#btn-cancel-drop').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-confirm-drop').addEventListener('click', async () => {
        const charId = selectChar.value;
        const sessionId = selectSession.value;

        if (!charId && !sessionId) return alert("Selecione um personagem ou uma sessão para receber os drops.");

        const btnConf = modal.querySelector('#btn-confirm-drop');
        btnConf.disabled = true;
        btnConf.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Rolando...';

        const drops = mob.drops || {};
        const itemsToGrantTotal = {};

        const chanceValue = parseInt(chanceSlider.value, 10);
        const DROP_CHANCE = chanceValue / 100;

        // 1. ROLA O DROP TOTAL 
        for (const [itemId, maxQuantity] of Object.entries(drops)) {
            if (Math.random() <= DROP_CHANCE) {
                const quantityToDrop = Math.floor(Math.random() * (Number(maxQuantity) + 1));
                if (quantityToDrop > 0) {
                    itemsToGrantTotal[itemId] = (itemsToGrantTotal[itemId] || 0) + quantityToDrop;
                }
            }
        }

        if (Object.keys(itemsToGrantTotal).length === 0) {
            alert(`O Monstro ${mob.nome} não dropou absolutamente nada desta vez. Falha nas rolagens.`);
            modal.remove();
            return;
        }

        try {
            // 2. VERIFICA O ALVO E APLICA A LÓGICA (Personagem vs Sessão)
            if (sessionId) {
                // MODO SESSÃO
                const sessionObj = sessoesCache[sessionId];

                // Mapeia onde você pode ter salvo os IDs dos personagens na sessão
                const charsInSession = sessionObj?.personagens || sessionObj?.playerIds || sessionObj?.personagensPresentes || sessionObj?.jogadores || [];

                if (charsInSession.length === 0) {
                    throw new Error("Esta sessão não possui personagens vinculados no banco de dados.");
                }

                const dist = {};
                charsInSession.forEach(id => dist[id] = {});
                const distribLog = {};

                for (const [itemId, totalQty] of Object.entries(itemsToGrantTotal)) {
                    const itemData = globalState.cache.itens.get(itemId);
                    const itemName = itemData?.nome || 'Item Desconhecido';

                    for (let i = 0; i < totalQty; i++) {
                        const randomCharId = charsInSession[Math.floor(Math.random() * charsInSession.length)];
                        dist[randomCharId][itemId] = (dist[randomCharId][itemId] || 0) + 1;

                        if (!distribLog[randomCharId]) distribLog[randomCharId] = [];
                        distribLog[randomCharId].push(itemName);
                    }
                }

                const promises = [];
                for (const cId of charsInSession) {
                    if (Object.keys(dist[cId]).length > 0) {
                        const updates = {};
                        for (const [iId, q] of Object.entries(dist[cId])) {
                            updates[`mochila.${iId}`] = typeof increment !== 'undefined' ? increment(q) : q;
                        }
                        promises.push(updateDoc(doc(db, "rpg_fichas", cId), updates));
                    }
                }
                await Promise.all(promises);

                let successMsg = `SUCESSO! O loot de ${mob.nome} foi dividido entre a Sessão:\n\n`;
                for (const cId of charsInSession) {
                    const charName = globalState.cache.all_personagens.get(cId)?.nome || 'Desconhecido';
                    if (distribLog[cId] && distribLog[cId].length > 0) {
                        const counts = {};
                        distribLog[cId].forEach(name => counts[name] = (counts[name] || 0) + 1);
                        const dropsString = Object.entries(counts).map(([name, qty]) => `${name} (x${qty})`).join(', ');
                        successMsg += `> ${charName}: ${dropsString}\n`;
                    } else {
                        successMsg += `> ${charName}: Não pegou nada.\n`;
                    }
                }
                alert(successMsg);

            } else {
                // MODO PERSONAGEM ÚNICO
                const updates = {};
                const dropLog = [];
                for (const [itemId, quantity] of Object.entries(itemsToGrantTotal)) {
                    updates[`mochila.${itemId}`] = typeof increment !== 'undefined' ? increment(quantity) : quantity;
                    const itemData = globalState.cache.itens.get(itemId);
                    dropLog.push(`- ${itemData?.nome || 'Item Desconhecido'} (x${quantity})`);
                }

                await updateDoc(doc(db, "rpg_fichas", charId), updates);
                const charName = globalState.cache.all_personagens.get(charId)?.nome || 'o Personagem';
                alert(`SUCESSO! Os itens foram enviados para a mochila de ${charName}:\n\n${dropLog.join('\n')}`);
            }

            modal.remove();

        } catch (error) {
            console.error("Erro ao conceder drops:", error);
            alert("Erro do Sistema ao enviar items: " + error.message);
            btnConf.disabled = false;
            btnConf.innerHTML = '<i class="fas fa-check mr-2"></i> Confirmar Rolar Drops';
        }
    });
}
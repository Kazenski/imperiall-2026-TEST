import { db, doc, updateDoc, increment } from '../core/firebase.js';
import { globalState } from '../core/state.js';

export function renderDropsMonstrosTab() {
    const container = document.getElementById('drops-monstros-content');
    if (!container) return;

    // Estrutura Base
    container.innerHTML = `
        <div class="max-w-7xl mx-auto h-full flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto animate-fade-in">
            <header class="relative text-center mb-8 border-b-2 border-amber-500/30 pb-4 shrink-0">
                <h1 class="text-3xl sm:text-4xl font-bold font-cinzel text-amber-400 tracking-wider">Compêndio de Monstros</h1>
                <p class="text-slate-400 mt-2 uppercase tracking-widest text-sm">Consulte monstros e gere seus drops diretos</p>
            </header>

            <div class="max-w-xl mx-auto mb-8 w-full p-6 bg-slate-800/70 border border-slate-700 rounded-lg shrink-0">
                <label class="block text-slate-400 mb-2 font-bold uppercase text-xs tracking-widest" for="drops-monster-select">Selecione um Monstro ou NPC:</label>
                <select id="drops-monster-select" class="block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-md text-amber-500 font-bold focus:outline-none focus:border-amber-500 transition-colors">
                    <option value="">-- Carregando Monstros... --</option>
                </select>
            </div>

            <div id="drops-monster-display" class="relative w-full flex-grow">
                <div class="flex items-center justify-center min-h-[200px] bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg">
                    <p class="text-xl text-slate-500 font-cinzel">Selecione um monstro acima para ver os detalhes e rolar drops.</p>
                </div>
            </div>
        </div>
    `;

    const selectEl = container.querySelector('#drops-monster-select');

    // Popula o seletor lendo do cache global (já carregado no início da aplicação)
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
                <div class="flex items-center justify-center min-h-[200px] bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg">
                    <p class="text-xl text-slate-500 font-cinzel">Selecione um monstro acima para ver os detalhes e rolar drops.</p>
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
        dropsHtml = '<p class="text-slate-400 text-sm italic">O criador não definiu nenhum drop para este monstro.</p>';
    } else {
        dropsHtml = `<div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700 max-h-[250px] overflow-y-auto">`;
        dropIds.forEach(itemId => {
            const itemCache = globalState.cache.itens.get(itemId);
            const qtyMax = drops[itemId];
            const imgUrl = itemCache?.imagemUrl || 'https://placehold.co/100x100/1e293b/d4af37?text=Sem+Foto';
            const itemName = itemCache?.nome || 'Item Desconhecido';

            dropsHtml += `
                <div class="relative aspect-square bg-[#cdc1b0] border-2 border-[#5c4033] rounded-lg bg-contain bg-no-repeat bg-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" title="${itemName} (Max: ${qtyMax})" style="background-image: url('${imgUrl}');">
                    <div class="absolute bottom-1 right-1 min-w-[20px] text-center px-1 bg-black/80 text-white text-[10px] font-bold rounded">
                        x${qtyMax}
                    </div>
                </div>
            `;
        });
        dropsHtml += `</div>`;
    }

    const fotoUrl = (mob.imageUrls && mob.imageUrls.imagem1) ? mob.imageUrls.imagem1 : 'https://placehold.co/400x400/1e293b/d4af37?text=Monstro';

    displayContainer.innerHTML = `
        <div class="bg-slate-800/70 p-6 rounded-lg border border-slate-700 shadow-lg animate-fade-in flex flex-col md:flex-row gap-6">
            <div class="flex-shrink-0 w-full md:w-56 flex flex-col items-center">
                <img src="${fotoUrl}" alt="Foto ${mob.nome}" class="w-48 h-48 rounded-full object-cover border-4 border-amber-500 shadow-xl mb-4" />
                
                <button id="btn-abrir-drop" class="w-full py-3 px-6 bg-yellow-600 text-black font-black uppercase tracking-widest text-xs rounded-md hover:bg-yellow-500 flex items-center justify-center transition-colors shadow-lg">
                    <i class="fas fa-dice mr-2"></i> Rolar Drops do Monstro
                </button>
            </div>

            <div class="flex-grow w-full overflow-hidden">
                <h3 class="text-3xl font-bold font-cinzel text-amber-400 mb-2">${mob.nome}</h3>
                <p class="text-xs text-slate-500 uppercase tracking-widest mb-4">Nível: <strong class="text-amber-500">${mob.levelPersonagemBase || '?'}</strong> | EXP: <strong class="text-blue-400">${mob.experiencia || 0}</strong></p>
                
                <h4 class="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3 mt-4 border-b border-slate-600 pb-1">Atributos de Combate Base</h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div class="bg-slate-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-700">
                        <i class="fas fa-heart text-red-500 text-lg mb-1"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">HP Max</span>
                        <span class="text-base font-black text-white">${mob.hpMaxPersonagemBase || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-700">
                        <i class="fas fa-star text-blue-400 text-lg mb-1"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">MP Max</span>
                        <span class="text-base font-black text-white">${mob.mpMaxPersonagemBase || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-700">
                        <i class="fas fa-swords text-orange-400 text-lg mb-1"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Ataque</span>
                        <span class="text-base font-black text-white">${mob.atk_base || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-700">
                        <i class="fas fa-shield text-sky-400 text-lg mb-1"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Defesa</span>
                        <span class="text-base font-black text-white">${mob.def_base || 0}</span>
                    </div>
                    <div class="bg-slate-900/50 p-2 rounded-lg flex flex-col items-center justify-center border border-slate-700">
                        <i class="fas fa-wind text-green-400 text-lg mb-1"></i>
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Evasão</span>
                        <span class="text-base font-black text-white">${mob.eva_base || 0}</span>
                    </div>
                </div>

                <h4 class="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3 mt-6 border-b border-slate-600 pb-1">Possíveis Drops</h4>
                ${dropsHtml}
                
                <h4 class="text-sm font-bold uppercase tracking-widest text-slate-300 mb-3 mt-6 border-b border-slate-600 pb-1">Descrição e Log</h4>
                <div class="bg-slate-900/50 p-4 rounded-md border border-slate-700 text-sm text-slate-300 whitespace-pre-wrap max-h-[150px] overflow-y-auto leading-relaxed">
                    ${mob.descricao || 'Sem descrição cadastrada.'}
                </div>
            </div>
        </div>
    `;

    displayContainer.querySelector('#btn-abrir-drop').addEventListener('click', () => {
        if (dropIds.length === 0) return alert("Este monstro não possui drops configurados.");
        abrirModalDrop(mob);
    });
}

function abrirModalDrop(mob) {
    const existing = document.getElementById('modal-drop-monstro');
    if (existing) existing.remove();

    const charArray = Array.from(globalState.cache.all_personagens.values()).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    let optionsHtml = '<option value="">-- Selecione o Aventureiro --</option>';
    charArray.forEach(char => {
        optionsHtml += `<option value="${char.id}">${char.nome} (${char.jogador || '???'})</option>`;
    });

    const modalHTML = `
        <div id="modal-drop-monstro" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-fade-in p-4">
            <div class="bg-slate-800 text-gray-200 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-600 relative">
                <h2 class="text-2xl font-bold font-cinzel text-amber-400 mb-4 tracking-wider">Dropar de ${mob.nome}</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2" for="drop-target-char">Conceder para o inventário de:</label>
                        <select id="drop-target-char" class="block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-md text-amber-500 font-bold focus:outline-none focus:border-amber-500">
                            ${optionsHtml}
                        </select>
                    </div>
                    <p class="text-xs text-slate-400 bg-slate-900/50 p-3 rounded border border-slate-700">
                        <i class="fas fa-info-circle text-sky-400 mr-1"></i> A engine possui <strong class="text-amber-500">70% de chance</strong> de validar cada item no pool. A quantidade rolada será entre <strong class="text-white">0 e a Máxima definida</strong> no cadastro.
                    </p>
                    <div class="flex gap-4 mt-6">
                        <button id="btn-confirm-drop" class="flex-grow py-3 px-6 bg-green-600 text-white font-bold uppercase tracking-widest text-xs rounded-md hover:bg-green-500 shadow-md transition-colors">
                            <i class="fas fa-check mr-2"></i> Confirmar Rolar Drops
                        </button>
                        <button id="btn-cancel-drop" class="py-3 px-6 bg-slate-600 text-white font-bold uppercase tracking-widest text-xs rounded-md hover:bg-slate-500 transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('modal-drop-monstro');

    modal.querySelector('#btn-cancel-drop').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-confirm-drop').addEventListener('click', async () => {
        const charId = modal.querySelector('#drop-target-char').value;
        if (!charId) return alert("Selecione um personagem para receber os drops.");

        const btnConf = modal.querySelector('#btn-confirm-drop');
        btnConf.disabled = true;
        btnConf.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Rolando...';

        const drops = mob.drops || {};
        const itemsToGrant = {};
        const dropLog = [];
        const DROP_CHANCE = 0.70; // 70% de sucesso

        for (const [itemId, maxQuantity] of Object.entries(drops)) {
            if (Math.random() <= DROP_CHANCE) {
                // Sorteia a quantidade de 0 até maxQuantity
                const quantityToDrop = Math.floor(Math.random() * (Number(maxQuantity) + 1));

                if (quantityToDrop > 0) {
                    itemsToGrant[itemId] = (itemsToGrant[itemId] || 0) + quantityToDrop;
                    const itemData = globalState.cache.itens.get(itemId);
                    dropLog.push(`- ${itemData?.nome || 'Item Desconhecido'} (x${quantityToDrop})`);
                }
            }
        }

        if (Object.keys(itemsToGrant).length === 0) {
            alert(`O Monstro ${mob.nome} não dropou absolutamente nada desta vez. Falha nas rolagens.`);
            modal.remove();
            return;
        }

        try {
            const updates = {};
            for (const [itemId, quantity] of Object.entries(itemsToGrant)) {
                updates[`mochila.${itemId}`] = increment(quantity);
            }

            await updateDoc(doc(db, "rpg_fichas", charId), updates);

            const charName = globalState.cache.all_personagens.get(charId)?.nome || 'o Personagem';
            alert(`SUCESSO! Os itens foram enviados para a mochila de ${charName}:\n\n${dropLog.join('\n')}`);
            modal.remove();

        } catch (error) {
            console.error("Erro ao conceder drops:", error);
            alert("Erro do Sistema ao enviar items para a mochila: " + error.message);
            btnConf.disabled = false;
            btnConf.innerHTML = '<i class="fas fa-check mr-2"></i> Confirmar Rolar Drops';
        }
    });
}
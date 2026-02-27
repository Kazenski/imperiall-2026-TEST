import { db, doc, updateDoc, runTransaction } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

export function renderExtracaoTab() {
    const container = document.getElementById('extracao-grid');
    if (!container) return;

    container.innerHTML = '';
    
    // Limpa painel da direita
    const detalhesPanel = document.getElementById('extracao-detalhes-panel');
    const emptyState = document.getElementById('extracao-empty-state');
    
    if (detalhesPanel) detalhesPanel.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    globalState.extracao.selectedItem = null;

    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="col-span-full text-center">Selecione um personagem.</p>';
        return;
    }

    // Filtrar Itens: Deve estar na mochila E NÃO deve estar equipado
    const mochila = charData.ficha.mochila || {};
    const equipadosIds = new Set(Object.values(charData.ficha.equipamento || charData.ficha.equipamentos || {}).filter(Boolean));
    
    // --- BLOQUEIO DE LOOP: ID DA ESSÊNCIA MÁGICA (FRAGMENTO) ---
    const ID_ESSENCIA_BLOQUEADA = 'JwZDdYnOtEjvJuQLaB4f';

    // O filtro agora remove itens equipados E a própria essência mágica
    const itemIds = Object.keys(mochila).filter(id => !equipadosIds.has(id) && id !== ID_ESSENCIA_BLOQUEADA);

    // Filtro de texto
    const searchInput = document.getElementById('extracao-filtro');
    const termo = searchInput ? searchInput.value.toLowerCase() : '';

    if (itemIds.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-slate-500">Nenhum item elegível na mochila.</p>';
        return;
    }

    itemIds.forEach(itemId => {
        const itemInfo = globalState.cache.itens.get(itemId);
        if (!itemInfo) return;
        if (termo && !itemInfo.nome.toLowerCase().includes(termo)) return;

        const qtd = mochila[itemId];
        const slot = document.createElement('div');
        slot.className = 'grid-slot inventory-slot';
        slot.style.backgroundImage = `url('${itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}')`;
        slot.title = itemInfo.nome;
        
        // Overlay de quantidade
        if(qtd > 1) {
            slot.innerHTML = `<span class="grid-slot-quantity">${qtd}</span>`;
        }

        slot.onclick = () => selectExtractionItem(itemId, itemInfo, qtd);
        container.appendChild(slot);
    });
}

// 1. Função de Seleção (Busca a Receita PRIMEIRO para usar como referência)
function selectExtractionItem(itemId, itemInfo, qtd) {
    globalState.extracao.selectedItem = { id: itemId, info: itemInfo, qtd: qtd };
    
    // Atualiza Visual Básico
    document.getElementById('extracao-empty-state')?.classList.add('hidden');
    const panel = document.getElementById('extracao-detalhes-panel');
    if (panel) panel.classList.remove('hidden');

    // Preenche dados visuais
    const imgEl = document.getElementById('ext-img');
    const nomeEl = document.getElementById('ext-nome');
    const tipoEl = document.getElementById('ext-tipo');
    const qtdEl = document.getElementById('ext-qtd');

    if(imgEl) imgEl.src = itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL;
    if(nomeEl) nomeEl.textContent = itemInfo.nome;
    
    const tipo = globalState.cache.tiposItens.get(itemInfo.slot_equipavel_id || itemInfo.tipoId);
    if(tipoEl) tipoEl.textContent = tipo ? tipo.nome : 'Item';
    
    if(qtdEl) qtdEl.innerHTML = `Quantidade na Mochila: <span class="font-bold text-white">${qtd}</span>`;

    // --- ENCONTRAR A RECEITA ---
    // A receita define qual profissão é exigida.
    const idParaBuscar = itemInfo.itemBaseId || itemId;
    let recipe = null;
    
    for (const [rId, rec] of globalState.cache.receitas.entries()) {
        if (rec.itemId === idParaBuscar) {
            recipe = rec;
            break;
        }
    }
    
    globalState.extracao.recipe = recipe;

    // Passa a receita encontrada para as validações
    calculateEssenceValues(itemInfo, recipe);
    checkRecycleAvailability(recipe);
}

// 2. Cálculo de Essência (Skill * Profissão OU 0)
function calculateEssenceValues(itemInfo, recipe) {
    const char = globalState.selectedCharacterData.ficha;
    const itemBaseVal = itemInfo.valorEssencias || 0;
    
    let skillLevel = 0;
    let profLevel = 0;

    // Só calcula bônus se houver receita para identificar a profissão correta
    if (recipe) {
        // A. Nível da Profissão Específica
        if (recipe.profissaoId) {
            // Se o char tem a profissão exigida, pega o nível. Se não, é 0.
            if (char.profissoes && char.profissoes[recipe.profissaoId]) {
                profLevel = char.profissoes[recipe.profissaoId].nivel || 0;
            } else {
                profLevel = 0; // Não tem a profissão -> Nível 0
            }
        } else {
            profLevel = 1; // Receita sem profissão (Geral)
        }

        // B. Nível da Habilidade Específica
        if (recipe.habilidadeId && char.habilidades && char.habilidades[recipe.habilidadeId]) {
            skillLevel = char.habilidades[recipe.habilidadeId].nivel || 0;
        }
    }

    // Fórmula: Skill * Profissão
    const bonus = skillLevel * profLevel;
    const total = itemBaseVal + bonus;

    // Atualiza UI
    const elBase = document.getElementById('ext-val-base');
    const elBonus = document.getElementById('ext-val-bonus');
    const elTotal = document.getElementById('ext-val-total');
    
    if(elBase) elBase.textContent = itemBaseVal;
    
    if (elBonus) {
        if (bonus > 0) {
            elBonus.textContent = `+${bonus} (Skill ${skillLevel} x Prof ${profLevel})`;
            elBonus.className = "font-bold text-green-400";
        } else {
            elBonus.textContent = "+0";
            elBonus.className = "font-bold text-slate-500";
        }
    }

    if(elTotal) elTotal.textContent = total;

    // Botão de Extrair (Independente de profissão, apenas valor > 0)
    const btnExt = document.getElementById('btn-confirmar-extracao');
    if (btnExt) {
        if (total <= 0) {
            btnExt.disabled = true;
            btnExt.textContent = "Item sem valor de essência";
            btnExt.classList.add('opacity-50');
        } else {
            btnExt.disabled = false;
            btnExt.textContent = "Extrair Essências (Destrói Item)";
            btnExt.classList.remove('opacity-50');
            btnExt.onclick = () => performExtraction(total);
        }
    }
}

function checkRecycleAvailability(recipe) {
    const panel = document.getElementById('panel-desfazer-craft');
    const btn = document.getElementById('btn-confirmar-reciclagem');
    const list = document.getElementById('recycle-materials-list');
    const warning = document.getElementById('recipe-warning');
    const reqProfNameEl = document.getElementById('req-prof-name');
    const chanceEl = document.getElementById('recycle-chance');

    if (!panel || !btn || !list) return;

    // 1. ESTADO INICIAL: VISÍVEL, MAS BLOQUEADO (Escuro)
    panel.classList.remove('hidden');   
    panel.classList.add('opacity-50');  
    btn.disabled = true;                
    list.innerHTML = '';
    if(warning) warning.classList.add('hidden');

    // Se não tem receita, avisa e sai (mantém travado e escuro)
    if (!recipe) {
        list.innerHTML = '<span class="text-slate-500 text-xs">Este item não possui receita conhecida.</span>';
        return;
    }

    const char = globalState.selectedCharacterData.ficha;
    const profIdRequerida = recipe.profissaoId;
    
    // Mostra o nome da profissão necessária
    const profInfo = globalState.cache.profissoes.get(profIdRequerida);
    const profNome = profInfo ? profInfo.nome : (profIdRequerida || 'Geral');
    if(reqProfNameEl) reqProfNameEl.textContent = profNome;

    // -- VERIFICA PERMISSÃO --
    let hasProfession = false;

    if (!profIdRequerida) {
        hasProfession = true;
    } 
    else if (char.profissoes && char.profissoes[profIdRequerida]) {
        hasProfession = true;
    }

    // SE NÃO TIVER PERMISSÃO (E não for admin):
    if (!hasProfession && !globalState.isAdmin) {
        if(warning) warning.classList.remove('hidden'); 
        
        list.innerHTML = `
            <div class="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-center">
                <p class="text-red-400 text-xs font-bold"><i class="fas fa-lock"></i> Conhecimento Insuficiente</p>
                <p class="text-slate-400 text-[10px] mt-1">Necessário: ${profNome}</p>
            </div>
        `;
        return; 
    }

    // --- SE CHEGOU AQUI, TEM PERMISSÃO ---
    panel.classList.remove('opacity-50');
    btn.disabled = false;

    // Calcula Bônus de Reciclagem (Prof * Skill)
    let profLvl = (profIdRequerida && char.profissoes && char.profissoes[profIdRequerida]) ? char.profissoes[profIdRequerida].nivel : 1;
    let skillLvl = (recipe.habilidadeId && char.habilidades && char.habilidades[recipe.habilidadeId]) ? char.habilidades[recipe.habilidadeId].nivel : 0;
    
    const bonusPct = profLvl * skillLvl;
    if(chanceEl) chanceEl.textContent = `${bonusPct}%`;

    // Lista os Materiais
    if (recipe.materiais) {
        recipe.materiais.forEach(mat => {
            const matInfo = globalState.cache.itens.get(mat.itemId);
            const el = document.createElement('div');
            el.className = "flex items-center gap-2 bg-slate-800 p-1 pr-2 rounded border border-slate-600";
            el.innerHTML = `
                <img src="${matInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-6 h-6 rounded bg-black object-contain">
                <span class="text-xs text-slate-300">${matInfo?.nome || '???'} x${mat.quantidade}</span>
            `;
            list.appendChild(el);
        });
    }

    // Define ação do botão
    btn.onclick = () => performDecraft(bonusPct);
}

async function performExtraction(amount) {
    if(!confirm(`Confirma a extração? O item será destruído e você receberá ${amount} Essências.`)) return;

    const charId = globalState.selectedCharacterId;
    const itemId = globalState.extracao.selectedItem.id;
    const ESSENCE_ID = 'JwZDdYnOtEjvJuQLaB4f'; 

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            if (!sf.exists()) throw "Ficha não existe";

            const currentMochila = sf.data().mochila || {};
            if (!currentMochila[itemId] || currentMochila[itemId] < 1) throw "Item não existe mais na mochila";
            
            const newQtdItem = currentMochila[itemId] - 1;
            if (newQtdItem <= 0) delete currentMochila[itemId];
            else currentMochila[itemId] = newQtdItem;

            if (!globalState.cache.itens.has(ESSENCE_ID)) {
                console.warn("Aviso: O ID da Essência Mágica não foi encontrado no cache local, mas será gravado no banco.");
            }

            const currentEssence = currentMochila[ESSENCE_ID] || 0;
            currentMochila[ESSENCE_ID] = currentEssence + amount;

            t.update(charRef, { mochila: currentMochila });
        });

        alert("Extração concluída com sucesso!");
        // O listener onSnapshot vai atualizar a tela automaticamente
    } catch (e) {
        console.error(e);
        alert("Erro na extração: " + e);
    }
}

async function performDecraft(bonusPct) {
    if(!confirm(`Confirma desfazer o craft? O item será destruído e os materiais devolvidos.`)) return;

    const charId = globalState.selectedCharacterId;
    const itemId = globalState.extracao.selectedItem.id;
    const recipe = globalState.extracao.recipe;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            const data = sf.data();
            const currentMochila = data.mochila || {};

            // 1. Remover Item
            if (!currentMochila[itemId] || currentMochila[itemId] < 1) throw "Item sumiu";
            const newQtd = currentMochila[itemId] - 1;
            if (newQtd <= 0) delete currentMochila[itemId];
            else currentMochila[itemId] = newQtd;

            // 2. Adicionar Materiais com Bônus
            recipe.materiais.forEach(mat => {
                let qtdBase = mat.quantidade;
                let extra = Math.floor(qtdBase * (bonusPct / 100));
                let finalQtd = qtdBase + extra;

                const have = currentMochila[mat.itemId] || 0;
                currentMochila[mat.itemId] = have + finalQtd;
            });

            t.update(charRef, { mochila: currentMochila });
        });
        
        alert("Item reciclado com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao reciclar: " + e);
    }
}

// Configura o ouvinte do filtro de texto
export function setupExtracaoListeners() {
    const searchInput = document.getElementById('extracao-filtro');
    if (searchInput) {
        searchInput.addEventListener('input', renderExtracaoTab);
    }
}
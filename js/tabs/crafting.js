import { db, doc, updateDoc, runTransaction, increment } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';

let selectedCraftingProfId = 'geral'; // Estado local da sub-aba de craft

export function renderCraftingTab() {
    const charData = globalState.selectedCharacterData;
    if (!charData) return;

    const ficha = charData.ficha;
    const profissoes = ficha.profissoes || {};
    const tabsContainer = document.getElementById('craft-profession-tabs');
    const recipeContainer = document.getElementById('craft-recipe-list');
    
    if(!tabsContainer || !recipeContainer) return;

    // Renderiza as Sub-Abas na horizontal
    let tabsHtml = `
        <button onclick="window.switchCraftProf('geral')" 
            class="sub-tab-btn ${selectedCraftingProfId === 'geral' ? 'active' : ''}">
            Geral
        </button>
    `;

    Object.keys(profissoes).forEach(profId => {
        const profInfo = globalState.cache.profissoes.get(profId);
        const level = profissoes[profId].nivel || 1;
        const nome = profInfo ? profInfo.nome : 'Profissão';
        
        tabsHtml += `
            <button onclick="window.switchCraftProf('${profId}')" 
                class="sub-tab-btn ${selectedCraftingProfId === profId ? 'active' : ''}">
                ${nome} <span class="ml-2 text-[10px] opacity-60">Lv.${level}</span>
            </button>
        `;
    });

    tabsContainer.innerHTML = tabsHtml;

    // Chama a listagem de receitas filtrada
    const searchInput = document.getElementById('craft-search');
    const searchTerm = searchInput ? searchInput.value : '';
    renderRecipeList(recipeContainer, searchTerm);
}

// Exposta para o HTML chamar no onclick das sub-abas
window.switchCraftProf = function(profId) {
    selectedCraftingProfId = profId;
    globalState.crafting.selectedRecipe = null;
    globalState.crafting.step = 'prepare';
    
    renderCraftingTab();
    const bench = document.getElementById('craft-bench');
    if (bench) {
        bench.innerHTML = '<p class="text-slate-500 italic">Selecione uma receita para começar a trabalhar.</p>';
    }
};

function renderRecipeList(container, filter = '') {
    container.innerHTML = '';
    const term = filter.toLowerCase();

    // Filtra as receitas pela profissão selecionada na sub-aba
    const recipes = [...globalState.cache.receitas.values()].filter(r => {
        const nameMatch = r.nome.toLowerCase().includes(term);
        // Se a aba for 'geral', mostra receitas sem profissão. Se for ID, mostra apenas as dela.
        const profMatch = selectedCraftingProfId === 'geral' 
            ? (!r.profissaoId || r.profissaoId === "") 
            : (r.profissaoId === selectedCraftingProfId);
            
        return nameMatch && profMatch;
    }).sort((a,b) => a.nome.localeCompare(b.nome));

    if (recipes.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-10 italic">Nenhuma receita encontrada.</p>';
        return;
    }

    recipes.forEach(rec => {
        const itemInfo = globalState.cache.itens.get(rec.itemId);
        const isSelected = globalState.crafting.selectedRecipe?.id === rec.id;
        
        const el = document.createElement('div');
        el.className = `recipe-item ${isSelected ? 'selected' : ''}`;
        el.innerHTML = `
            <img src="${itemInfo?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 rounded bg-slate-800 object-contain">
            <div class="flex-grow overflow-hidden text-left">
                <h4 class="text-sm font-bold truncate ${isSelected ? 'text-amber-400' : 'text-slate-300'}">${rec.nome}</h4>
                <span class="text-[9px] text-slate-500 uppercase font-mono">Sucesso: ${rec.chanceSucessoBase || 0}%</span>
            </div>
        `;
        el.onclick = () => selectRecipe(rec);
        container.appendChild(el);
    });
}

function selectRecipe(recipe) {
    // Reseta estado
    globalState.crafting = {
        selectedRecipe: recipe,
        step: 'prepare',
        rollResult: 0,
        quality: 0,
        finalChance: 0
    };
    
    const recipeContainer = document.getElementById('craft-recipe-list');
    const searchInput = document.getElementById('craft-search');
    if(recipeContainer) renderRecipeList(recipeContainer, searchInput ? searchInput.value : '');
    
    renderWorkbench();
}

function renderWorkbench() {
    const bench = document.getElementById('craft-bench');
    const state = globalState.crafting;
    const recipe = state.selectedRecipe;
    const charData = globalState.selectedCharacterData;

    if (!bench || !recipe || !charData) return;

    const itemResult = globalState.cache.itens.get(recipe.itemId);
    const mochila = charData.ficha.mochila || {};
    const profissoes = charData.ficha.profissoes || {};
    const habilidades = charData.ficha.habilidades || {};

    // 1. Verificar Materiais
    let hasAllMaterials = true;
    const materialsHtml = recipe.materiais.map(mat => {
        const matInfo = globalState.cache.itens.get(mat.itemId) || { nome: 'Desconhecido', imagemUrl: '' };
        const owned = mochila[mat.itemId] || 0;
        const enough = owned >= mat.quantidade;
        if (!enough) hasAllMaterials = false;

        return `
            <div class="craft-material-badge ${enough ? 'ok' : 'missing'}">
                <img src="${matInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-10 h-10 mb-1 rounded bg-black object-contain">
                <span class="text-[10px] truncate w-full text-center" title="${matInfo.nome}">${matInfo.nome}</span>
                <span class="text-xs font-bold ${enough ? 'text-green-400' : 'text-red-400'}">${owned}/${mat.quantidade}</span>
            </div>
        `;
    }).join('');

    // 2. Calcular Chances
    let baseChance = recipe.chanceSucessoBase || 0;
    let profBonus = 0;
    let skillBonus = 0;
    let rarityPenalty = 0;
    let hasReqProf = true;

    // Profissão
    if (recipe.profissaoId) {
        const pLvl = profissoes[recipe.profissaoId]?.nivel || 0;
        if (pLvl >= (recipe.profissaoLevel || 0)) {
            profBonus = pLvl; 
        } else {
            hasReqProf = false;
        }
    }

    // Habilidade
    if (recipe.habilidadeId) {
        const hLvl = habilidades[recipe.habilidadeId]?.nivel || 1;
        const habInfo = globalState.cache.habilidades.get(recipe.habilidadeId);
        let baseEff = habInfo?.efeitoDanoBaseUsoHabilidade || 0;
        if(hLvl > 1 && habInfo?.niveis?.[hLvl]) baseEff = habInfo.niveis[hLvl].danoBaseHabilidade || baseEff;
        skillBonus = baseEff;
    }

    // Raridade (Penalidade) omitida ou calculada aqui se houver cache
    const finalChance = Math.max(0, Math.min(100, baseChance + profBonus + skillBonus - rarityPenalty));
    globalState.crafting.finalChance = finalChance;

    // 3. Renderizar Interface Baseada no Passo
    let actionArea = '';

    if (state.step === 'prepare') {
        const btnDisabled = !hasAllMaterials || !hasReqProf;
        const btnText = !hasReqProf ? "Profissão Insuficiente" : (!hasAllMaterials ? "Materiais Insuficientes" : "Iniciar Criação");
        
        actionArea = `
            <div class="grid grid-cols-2 gap-4 text-sm text-slate-300 bg-slate-900/50 p-3 rounded mb-4">
                <div class="flex justify-between"><span>Base:</span> <span>${baseChance}%</span></div>
                <div class="flex justify-between"><span>Profissão:</span> <span class="text-sky-400">+${profBonus}%</span></div>
                <div class="flex justify-between"><span>Habilidade:</span> <span class="text-purple-400">+${skillBonus}%</span></div>
                <div class="flex justify-between border-t border-slate-600 col-span-2 pt-1 mt-1">
                    <span class="font-bold text-white">Chance Total:</span> 
                    <span class="font-bold text-amber-400 text-lg">${finalChance}%</span>
                </div>
            </div>
            <button id="btn-craft-start" class="btn btn-primary w-full py-3" ${btnDisabled ? 'disabled' : ''}>
                ${btnText}
            </button>
        `;
    } else if (state.step === 'roll') {
        actionArea = `
            <div class="flex flex-col items-center animate-fade-in">
                <p class="mb-4 text-amber-400 font-bold">Role o D20 para definir a qualidade!</p>
                <button id="btn-craft-d20" class="d20-btn"><i class="fas fa-dice-d20"></i></button>
            </div>
        `;
    } else if (state.step === 'confirm') {
        actionArea = `
            <div class="bg-slate-900/80 p-4 rounded border border-amber-500/50 mb-4 animate-fade-in">
                <div class="flex justify-between text-lg mb-2"><span>Chance Sucesso:</span> <span class="text-white">${finalChance}%</span></div>
                <div class="flex justify-between text-lg mb-2"><span>Dado:</span> <span class="text-amber-400 font-bold">+${state.rollResult}</span></div>
                <div class="flex justify-between text-xl border-t border-slate-600 pt-2">
                    <span>Qualidade Final:</span> 
                    <span class="text-green-400 font-bold">${state.quality}%</span>
                </div>
            </div>
            <button id="btn-craft-confirm" class="btn btn-green w-full py-3">Confirmar e Criar (Consome Itens)</button>
            <button id="btn-craft-cancel" class="btn btn-danger w-full py-2 mt-2 text-xs">Cancelar</button>
        `;
    } else if (state.step === 'loading') {
        actionArea = `<div class="flex justify-center p-6"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>`;
    }

    bench.innerHTML = `
        <div class="flex flex-col items-center w-full max-w-md mx-auto">
            <img src="${itemResult?.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-24 h-24 mb-2 object-contain bg-slate-900 border-2 border-slate-600 rounded-lg">
            <h2 class="text-2xl font-cinzel text-amber-400 mb-6">${itemResult?.nome || recipe.nome}</h2>
            
            <div class="flex flex-wrap justify-center gap-3 mb-6 w-full">
                ${materialsHtml}
            </div>

            <div class="w-full">
                ${actionArea}
            </div>
        </div>
    `;

    // Bind Events
    const btnStart = document.getElementById('btn-craft-start');
    if (btnStart) btnStart.onclick = () => {
        globalState.crafting.step = 'roll';
        renderWorkbench();
    };

    const btnD20 = document.getElementById('btn-craft-d20');
    if (btnD20) btnD20.onclick = handleCraftRoll;

    const btnConfirm = document.getElementById('btn-craft-confirm');
    if (btnConfirm) btnConfirm.onclick = executeCraftTransaction;

    const btnCancel = document.getElementById('btn-craft-cancel');
    if (btnCancel) btnCancel.onclick = () => selectRecipe(recipe); 
}

function handleCraftRoll() {
    const roll = Math.floor(Math.random() * 20) + 1;
    const state = globalState.crafting;
    
    state.rollResult = roll;
    state.quality = Math.min(100, state.finalChance + roll);
    state.step = 'confirm';
    
    // Animação simples
    const btn = document.getElementById('btn-craft-d20');
    if (btn) btn.style.transform = 'rotate(360deg) scale(1.2)';
    setTimeout(() => renderWorkbench(), 500);
}

async function executeCraftTransaction() {
    globalState.crafting.step = 'loading';
    renderWorkbench();

    const recipe = globalState.crafting.selectedRecipe;
    const state = globalState.crafting;
    const charId = globalState.selectedCharacterId;
    const charData = globalState.selectedCharacterData.ficha;

    const successRoll = Math.floor(Math.random() * 100) + 1;
    const isSuccess = successRoll <= state.finalChance;

    let lossFactor = 1;
    if (!isSuccess) {
        lossFactor = (Math.floor(Math.random() * (50 - 20 + 1)) + 20) / 100;
    }

    const profLevel = charData.profissoes?.[recipe.profissaoId]?.nivel || 1;
    const qtdCriada = isSuccess ? (Math.floor(Math.random() * profLevel) + 1) : 0;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await t.get(charRef);
            if (!sf.exists()) throw "Ficha não encontrada";

            const currentMochila = sf.data().mochila || {};
            
            // Consumir Materiais
            for (const mat of recipe.materiais) {
                const qtdNecessaria = mat.quantidade;
                const qtdConsumir = Math.ceil(qtdNecessaria * lossFactor);
                const emMaos = currentMochila[mat.itemId] || 0;

                if (emMaos < qtdNecessaria) throw `Falta material: ${mat.itemId}`;

                const novaQtd = emMaos - qtdConsumir;
                if (novaQtd <= 0) delete currentMochila[mat.itemId]; 
                else currentMochila[mat.itemId] = novaQtd;
            }

            if (isSuccess) {
                const currentQtdItem = currentMochila[recipe.itemId] || 0;
                currentMochila[recipe.itemId] = currentQtdItem + qtdCriada;

                if (recipe.expProducao) {
                    t.update(charRef, { 
                        mochila: currentMochila,
                        experienciapersonagemBase: increment(recipe.expProducao)
                    });
                } else {
                    t.update(charRef, { mochila: currentMochila });
                }
            } else {
                t.update(charRef, { mochila: currentMochila });
            }
        });

        if (isSuccess) {
            const itemBase = globalState.cache.itens.get(recipe.itemId);
            const nomeItem = itemBase ? itemBase.nome : 'Item Desconhecido';
            
            // Atualiza livro de receitas
            updateDoc(doc(db, "rpg_fichas", charId), {
                [`livro_receitas.${recipe.id}.craftado`]: true
            }).catch(e => console.warn("Erro ao atualizar livro de receitas:", e));

            alert(`SUCESSO GLORIOSO!\nVocê criou: ${qtdCriada}x ${nomeItem}\n(Item adicionado à pilha existente na mochila)`);
        } else {
            alert(`FALHA CATASTRÓFICA!\nO processo falhou e você perdeu ${(lossFactor*100).toFixed(0)}% dos materiais.`);
        }

        selectRecipe(recipe);

    } catch (e) {
        console.error(e);
        alert("Erro no processo de criação: " + (e.message || e));
        globalState.crafting.step = 'confirm';
        renderWorkbench();
    }
}

// Configura evento de busca da aba
export function setupCraftingListeners() {
    const searchInput = document.getElementById('craft-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const recipeContainer = document.getElementById('craft-recipe-list');
            if (recipeContainer) renderRecipeList(recipeContainer, e.target.value);
        });
    }
}
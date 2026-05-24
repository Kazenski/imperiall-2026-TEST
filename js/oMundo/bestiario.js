import { globalState } from '../core/state.js';

export function renderBestiarioTab() {
    const container = document.getElementById('bestiario-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950 animate-fade-in">
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full shrink-0">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Bestiário Imperial</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">Consulte as criaturas, seus atributos e descubra onde encontrar seus itens</p>
            </header>

            <div class="w-full max-w-4xl mx-auto mb-10 p-6 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl relative z-20 flex flex-col gap-4 shrink-0">
                <div class="flex flex-col md:flex-row gap-4">
                    <div class="flex-1">
                        <label class="block text-xs font-cinzel font-bold text-slate-400 mb-2 tracking-widest uppercase"><i class="fas fa-search text-amber-500 mr-1"></i> Nome do Monstro:</label>
                        <input type="text" id="bestiario-search-name" placeholder="Ex: Dragão..." class="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors">
                    </div>
                    <div class="flex-1">
                        <label class="block text-xs font-cinzel font-bold text-slate-400 mb-2 tracking-widest uppercase"><i class="fas fa-gem text-amber-500 mr-1"></i> Item Dropado:</label>
                        <input type="text" id="bestiario-search-item" placeholder="Ex: Escama..." class="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors">
                    </div>
                </div>

                <div class="mt-2">
                    <label class="block text-xs font-cinzel font-bold text-slate-400 mb-2 tracking-widest uppercase">Resultados Encontrados:</label>
                    <div class="relative">
                        <select id="bestiario-select" class="appearance-none w-full px-5 py-3 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-base">
                            <option value="">-- Carregando Bestiário... --</option>
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-amber-500">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div id="bestiario-display" class="w-full relative z-10 flex-grow flex flex-col">
                <div class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                    <i class="fas fa-book-dead text-6xl text-slate-700 mb-4"></i>
                    <p class="text-xl text-slate-500 font-cinzel tracking-widest text-center">Selecione uma criatura acima<br>para revelar seus segredos.</p>
                </div>
            </div>
        </div>
    `;

    setupFilters(container);
}

function setupFilters(container) {
    const searchNameInput = container.querySelector('#bestiario-search-name');
    const searchItemInput = container.querySelector('#bestiario-search-item');
    const selectEl = container.querySelector('#bestiario-select');
    const displayEl = container.querySelector('#bestiario-display');

    // Carrega do cache global igual ao dropsMonstros.js
    const allMobs = Array.from(globalState.cache.mobs.values()).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    function filterMobs() {
        const nameFilter = searchNameInput.value.toLowerCase().trim();
        const itemFilter = searchItemInput.value.toLowerCase().trim();

        const filtered = allMobs.filter(mob => {
            const matchName = mob.nome?.toLowerCase().includes(nameFilter);

            let matchItem = false;
            if (itemFilter === '') {
                matchItem = true;
            } else {
                // Checa nos drops do monstro se o nome do item bate com a pesquisa
                if (mob.drops) {
                    for (const itemId of Object.keys(mob.drops)) {
                        const itemCache = globalState.cache.itens.get(itemId);
                        if (itemCache && itemCache.nome?.toLowerCase().includes(itemFilter)) {
                            matchItem = true;
                            break;
                        }
                    }
                }
            }

            return matchName && matchItem;
        });

        populateSelect(filtered);
    }

    function populateSelect(mobsList) {
        if (mobsList.length === 0) {
            selectEl.innerHTML = '<option value="">Nenhuma criatura encontrada com esses filtros</option>';
            selectEl.disabled = true;
            displayEl.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                    <i class="fas fa-ghost text-6xl text-slate-700 mb-4"></i>
                    <p class="text-xl text-slate-500 font-cinzel tracking-widest text-center">Nenhum registro nos tomos.</p>
                </div>`;
        } else {
            selectEl.disabled = false;
            selectEl.innerHTML = '<option value="">-- Selecione a Criatura --</option>';
            mobsList.forEach(mob => {
                selectEl.add(new Option(mob.nome, mob.id));
            });
        }
    }

    // Listeners para os inputs dispararem os filtros
    searchNameInput.addEventListener('input', filterMobs);
    searchItemInput.addEventListener('input', filterMobs);

    // Listener do select para exibir os detalhes
    selectEl.addEventListener('change', (e) => {
        const mobId = e.target.value;
        if (!mobId) {
            displayEl.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                    <i class="fas fa-book-dead text-6xl text-slate-700 mb-4"></i>
                    <p class="text-xl text-slate-500 font-cinzel tracking-widest text-center">Selecione uma criatura acima<br>para revelar seus segredos.</p>
                </div>`;
            return;
        }

        const mob = globalState.cache.mobs.get(mobId);
        if (mob) renderMonsterCard(mob, displayEl);
    });

    // Popula inicialmente com todos
    populateSelect(allMobs);
}

function renderMonsterCard(mob, displayContainer) {
    const drops = mob.drops || {};
    const dropIds = Object.keys(drops);
    let dropsHtml = '';

    if (dropIds.length === 0) {
        dropsHtml = '<p class="text-slate-400 text-sm italic py-2">Não há registros de itens coletáveis para esta criatura.</p>';
    } else {
        dropsHtml = `<div class="flex flex-wrap gap-3 bg-slate-900/50 p-4 rounded-lg border border-slate-700">`;
        dropIds.forEach(itemId => {
            const itemCache = globalState.cache.itens.get(itemId);
            // Ignoramos qtyMax aqui se quiser, ou mostramos para lore. Vou manter para saberem o limite.
            const qtyMax = drops[itemId];
            const imgUrl = itemCache?.imagemUrl || 'https://placehold.co/100x100/1e293b/d4af37?text=Sem+Foto';
            const itemName = itemCache?.nome || 'Item Desconhecido';

            dropsHtml += `
                <div class="relative w-20 h-20 bg-[#cdc1b0] border-2 border-[#5c4033] rounded-lg bg-contain bg-no-repeat bg-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] shrink-0 group hover:border-amber-500 transition-colors cursor-help" title="${itemName} (Possível queda máx: ${qtyMax})" style="background-image: url('${imgUrl}');">
                </div>
            `;
        });
        dropsHtml += `</div>`;
    }

    const fotoUrl = (mob.imageUrls && mob.imageUrls.imagem1) ? mob.imageUrls.imagem1 : 'https://placehold.co/600x600/1e293b/d4af37?text=Monstro';

    displayContainer.innerHTML = `
        <div class="w-full bg-slate-800/40 border border-slate-700 rounded-[2rem] p-6 md:p-10 shadow-2xl flex flex-col gap-8 animate-fade-in">
            
            <div class="flex flex-col xl:flex-row gap-8 items-start">
                <div class="flex-shrink-0 w-full xl:w-auto flex justify-center xl:justify-start">
                    <div class="relative">
                        <div class="absolute inset-0 bg-red-900 rounded-2xl blur-lg opacity-20"></div>
                        <img src="${fotoUrl}" alt="Foto ${mob.nome}" class="w-64 h-64 md:w-80 md:h-80 rounded-2xl object-cover border-4 border-slate-600 shadow-2xl relative z-10" />
                    </div>
                </div>

                <div class="flex-grow w-full">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-600 pb-3 mb-6 gap-2">
                        <h3 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-400 leading-none drop-shadow-md">${mob.nome}</h3>
                        <p class="text-xs text-slate-400 uppercase tracking-widest sm:text-right shrink-0">Nível: <strong class="text-amber-500">${mob.levelPersonagemBase || '?'}</strong> &bull; EXP Média: <strong class="text-blue-400">${mob.experiencia || 0}</strong></p>
                    </div>
                    
                    <h4 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Atributos Base (Estimativa)</h4>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                        <div class="bg-slate-900/80 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                            <i class="fas fa-heart text-red-500 text-2xl mb-2 drop-shadow"></i>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">HP Max</span>
                            <span class="text-xl font-black text-white">${mob.hpMaxPersonagemBase || 0}</span>
                        </div>
                        <div class="bg-slate-900/80 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                            <i class="fas fa-star text-blue-400 text-2xl mb-2 drop-shadow"></i>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">MP Max</span>
                            <span class="text-xl font-black text-white">${mob.mpMaxPersonagemBase || 0}</span>
                        </div>
                        <div class="bg-slate-900/80 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                            <i class="fas fa-khanda text-orange-400 text-2xl mb-2 drop-shadow"></i>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">Ataque</span>
                            <span class="text-xl font-black text-white">${mob.atk_base || 0}</span>
                        </div>
                        <div class="bg-slate-900/80 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                            <i class="fas fa-shield text-sky-400 text-2xl mb-2 drop-shadow"></i>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">Defesa</span>
                            <span class="text-xl font-black text-white">${mob.def_base || 0}</span>
                        </div>
                        <div class="bg-slate-900/80 p-4 rounded-xl flex flex-col items-center justify-center border border-slate-700 shadow-inner">
                            <i class="fas fa-wind text-green-400 text-2xl mb-2 drop-shadow"></i>
                            <span class="text-[10px] text-slate-400 font-bold uppercase">Evasão</span>
                            <span class="text-xl font-black text-white">${mob.eva_base || 0}</span>
                        </div>
                    </div>

                    <h4 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Espólios Conhecidos (Drops)</h4>
                    <div class="mb-6">
                        ${dropsHtml}
                    </div>
                </div>
            </div>

            <div class="bg-slate-800/60 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-lg relative w-full">
                <h3 class="text-xl md:text-2xl font-bold font-cinzel text-amber-400 mb-5 border-b border-slate-700/80 pb-3 flex items-center gap-3">
                    <i class="fas fa-scroll text-slate-500"></i> Descrição e Lore
                </h3>
                <p class="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${mob.descricao || '<i class="text-slate-500">Nenhum registro encontrado nos tomos do império...</i>'}</p>
            </div>
        </div>
    `;
}
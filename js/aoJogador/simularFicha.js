import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// Estado local do Simulador (Agora com histórico de atributos!)
const simState = {
    tab: 'race', // 'race', 'class', 'ability', 'profession'
    indices: { race: 0, class: 0, ability: 0, profession: 0 },
    data: { races: [], classes: [], abilities: [], professions: [] },
    previousStats: {} 
};

export function renderSimularFichaTab() {
    const container = document.getElementById('simular-ficha-content');
    if (!container) return;

    // Carrega e ordena os dados a partir do cache global
    simState.data.races = Array.from(globalState.cache.racas.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    simState.data.classes = Array.from(globalState.cache.classes.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    simState.data.professions = Array.from(globalState.cache.profissoes.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    
    updateAbilitiesForCurrentClass();

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-8 overflow-y-auto custom-scroll relative pb-24">
            
            <header class="mb-10 w-full flex flex-col xl:flex-row items-center xl:items-start justify-between border-b border-slate-700 pb-8 gap-8">
                
                <div class="flex-1 w-full text-center xl:text-left">
                    <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel mb-4 text-blue-400 drop-shadow-lg">
                        Forja do Aventureiro
                    </h1>
                    <p class="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed mx-auto xl:mx-0">
                        Simule diferentes combinações de Raças e Classes, acompanhe o impacto nos seus atributos e visualize o poder do seu próximo herói.
                    </p>
                </div>

                <div id="simulador-summary" class="w-full xl:w-auto shrink-0 flex justify-center"></div>
            </header>

            <div class="flex justify-center border-b border-slate-600 mb-10 flex-wrap w-full gap-2 md:gap-4">
                <button onclick="window.simulador.setTab('race')" id="sim-tab-race" class="sim-tab font-cinzel text-base md:text-xl px-6 md:px-10 py-4 transition-colors duration-300 border-b-4 border-blue-500 text-blue-400 font-bold tracking-widest outline-none">1. Raça</button>
                <button onclick="window.simulador.setTab('class')" id="sim-tab-class" class="sim-tab font-cinzel text-base md:text-xl px-6 md:px-10 py-4 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">2. Classe</button>
                <button onclick="window.simulador.setTab('ability')" id="sim-tab-ability" class="sim-tab font-cinzel text-base md:text-xl px-6 md:px-10 py-4 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">3. Habilidades</button>
                <button onclick="window.simulador.setTab('profession')" id="sim-tab-profession" class="sim-tab font-cinzel text-base md:text-xl px-6 md:px-10 py-4 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">4. Profissões</button>
            </div>

            <div id="simulador-carousel-area" class="w-full flex-grow flex flex-col items-center"></div>
        </div>

        <div id="simulador-image-modal" class="fixed inset-0 bg-black/95 hidden items-center justify-center z-[100] p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
            <img id="simulador-modal-img" src="" class="max-w-[95vw] max-h-[95vh] rounded-2xl border-4 border-slate-700 shadow-2xl object-contain">
        </div>
    `;

    renderUI();
}

function updateAbilitiesForCurrentClass() {
    const currentClass = simState.data.classes[simState.indices.class];
    if (currentClass && currentClass.id) {
        simState.data.abilities = Array.from(globalState.cache.habilidades.values())
            .filter(hab => hab.restricaoClasses && hab.restricaoClasses.includes(currentClass.id))
            .sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    } else {
        simState.data.abilities = [];
    }
    simState.indices.ability = 0;
}

function renderUI() {
    renderSummary();
    renderTabs();
    renderCarousel();
}

function renderSummary() {
    const summaryContainer = document.getElementById('simulador-summary');
    if (!summaryContainer) return;

    const race = simState.data.races[simState.indices.race] || {};
    const cls = simState.data.classes[simState.indices.class] || {};

    const newStats = {
        hp: (Number(race.hpRacialBase) || 0) + (Number(cls.bonusHpClasseBase) || 0),
        mp: (Number(race.mpRacialBase) || 0) + (Number(cls.bonusMpClasseBase) || 0),
        atk: (Number(race.bonusAtkRacaBase) || 0) + (Number(cls.poderAtaque) || 0),
        def: (Number(race.bonusDefRacaBase) || 0) + (Number(cls.capacidadeDefesa) || 0),
        eva: (Number(race.bonusEvaRacaBase) || 0)
    };

    const oldStats = simState.previousStats || {};

    const attrHTML = (key, label, val) => {
        let diffHTML = '';
        // Efeito RPG de Número Flutuante
        if (oldStats[key] !== undefined && oldStats[key] !== val) {
            const diff = val - oldStats[key];
            const color = diff > 0 ? 'text-emerald-400' : 'text-red-500';
            const icon = diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            
            // O span animado
            diffHTML = `<div class="absolute -top-6 right-0 left-0 flex justify-center ${color} font-black text-2xl animate-float-up pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-50">
                            <span class="flex items-center gap-1"><i class="fas ${icon} text-sm"></i> ${Math.abs(diff)}</span>
                        </div>`;
        }

        return `
            <div class="relative bg-slate-800/90 p-4 md:p-5 rounded-2xl text-center shadow-lg border border-slate-700/50 flex-1 min-w-[80px] lg:min-w-[100px]">
                ${diffHTML}
                <div class="text-[10px] md:text-xs font-cinzel text-blue-400 tracking-widest font-bold mb-1">${label}</div>
                <div class="text-2xl md:text-4xl font-black text-white">${val}</div>
            </div>
        `;
    };

    summaryContainer.innerHTML = `
        <div class="bg-slate-900/80 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-slate-700/60 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center gap-6">
            <h2 class="font-cinzel text-slate-400 tracking-widest uppercase md:border-r border-slate-700 md:pr-6 text-sm font-bold">Status</h2>
            <div class="flex gap-2 sm:gap-4 w-full overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                ${attrHTML('hp', 'HP', newStats.hp)}
                ${attrHTML('mp', 'MP', newStats.mp)}
                ${attrHTML('atk', 'ATK', newStats.atk)}
                ${attrHTML('def', 'DEF', newStats.def)}
                ${attrHTML('eva', 'EVA', newStats.eva)}
            </div>
        </div>
    `;

    // Atualiza o estado com os novos valores para a próxima comparação
    simState.previousStats = { ...newStats };
}

function renderTabs() {
    document.querySelectorAll('.sim-tab').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-400', 'font-bold');
        btn.classList.add('border-transparent', 'text-slate-400');
    });
    const activeBtn = document.getElementById(`sim-tab-${simState.tab}`);
    if (activeBtn) {
        activeBtn.classList.add('border-blue-500', 'text-blue-400', 'font-bold');
        activeBtn.classList.remove('border-transparent', 'text-slate-400');
    }
}

function renderCarousel() {
    const area = document.getElementById('simulador-carousel-area');
    if (!area) return;

    let items = [];
    let placeholder = '';
    let extraHeader = '';

    if (simState.tab === 'race') items = simState.data.races;
    if (simState.tab === 'class') items = simState.data.classes;
    if (simState.tab === 'ability') {
        items = simState.data.abilities;
        const clsName = simState.data.classes[simState.indices.class]?.nome || 'Nenhuma';
        extraHeader = `
            <div class="text-center mb-10 w-full">
                <h4 class="font-cinzel text-xl text-slate-400 mb-1">Habilidades para a Classe</h4>
                <p class="text-4xl font-bold text-amber-500 mb-4 drop-shadow-md">${escapeHTML(clsName)}</p>
                <div class="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl max-w-4xl mx-auto">
                    <p class="text-base text-slate-300 italic leading-relaxed">
                        Sua habilidade será definida por <strong class="text-amber-400">1d6</strong> para quantidade inicial e <strong class="text-amber-400">1d20</strong> para nível máximo de escolha.
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-16 w-full bg-slate-800/50 rounded-[2rem] border border-slate-700 border-dashed text-xl">Nenhuma habilidade encontrada para esta classe.</div>`;
    }
    if (simState.tab === 'profession') {
        items = simState.data.professions;
        extraHeader = `
            <div class="text-center mb-10 w-full">
                <div class="bg-amber-900/20 border border-amber-500/30 p-6 rounded-xl max-w-4xl mx-auto">
                    <p class="text-base md:text-lg text-slate-300 italic leading-relaxed">
                        Para obter uma profissão, encontre uma Guilda. <strong class="text-amber-500">Permitido registrar apenas a partir do Nível 5.</strong>
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-16 w-full bg-slate-800/50 rounded-[2rem] border border-slate-700 border-dashed text-xl">Nenhuma profissão encontrada.</div>`;
    }

    if (items.length === 0) {
        area.innerHTML = extraHeader + placeholder;
        return;
    }

    const currentIndex = simState.indices[simState.tab];
    const currentItem = items[currentIndex];

    // Nav Buttons
    const navHTML = `
        <div class="flex items-center justify-center mb-8 gap-8 w-full">
            <button onclick="window.simulador.prev()" class="p-4 bg-slate-800 text-white rounded-full hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-xl focus:outline-none group">
                <i class="fas fa-chevron-left text-2xl group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div class="font-mono text-3xl text-slate-200 font-bold min-w-[120px] text-center bg-slate-900/80 px-6 py-3 rounded-xl border border-slate-700 shadow-inner">
                ${currentIndex + 1} <span class="text-slate-500 text-2xl mx-1">/</span> ${items.length}
            </div>
            <button onclick="window.simulador.next()" class="p-4 bg-slate-800 text-white rounded-full hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-xl focus:outline-none group">
                <i class="fas fa-chevron-right text-2xl group-hover:translate-x-1 transition-transform"></i>
            </button>
        </div>
    `;

    const cardHTML = generateCardHTML(currentItem, simState.tab);

    area.innerHTML = `
        ${extraHeader}
        ${navHTML}
        <div class="w-full animate-fade-in flex justify-center">
            ${cardHTML}
        </div>
    `;
}

function generateCardHTML(item, type) {
    const isAbility = type === 'ability';
    const isClass = type === 'class';
    const isRace = type === 'race';
    const desc = (isAbility ? (item.descricaoEfeito || item.efeito) : (item.descricao || item.habilidadeEspecialClasse)) || 'Não informado.';
    
    let leftImgHTML = '';
    if (!isAbility && item.imagemUrl) {
        // Imagem Expandida (xl:w-[26rem] = 416px!)
        leftImgHTML = `
            <div class="w-full sm:w-[22rem] xl:w-[26rem] shrink-0 mx-auto xl:mx-0 simulador-img-wrapper cursor-pointer group" onclick="window.simulador.openImage('${item.imagemUrl}')">
                <div class="simulador-img-glow"></div>
                <img src="${item.imagemUrl}" alt="${escapeHTML(item.nome)}" class="simulador-img aspect-[4/5]">
                <div class="absolute bottom-4 right-4 bg-black/70 p-3 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm">
                    <i class="fas fa-expand-arrows-alt"></i>
                </div>
            </div>
        `;
    }

    let specificContentHTML = '';

    if (isRace) {
        const hasLendas = !!item.lendasConhecidas;
        const cultColSpan = hasLendas ? "col-span-1" : "md:col-span-2"; // Expande se não houver lendas

        specificContentHTML += `
            <div class="${cultColSpan} bg-slate-900/40 p-6 md:p-8 rounded-3xl border border-slate-700/50 flex flex-col shadow-inner h-full">
                <h4 class="font-cinzel text-xl md:text-2xl mb-4 text-blue-400 flex items-center gap-3 border-b border-slate-700/50 pb-4"><i class="fas fa-landmark text-slate-500"></i> Cultura e Sociedade</h4>
                <p class="text-slate-300 text-base leading-relaxed flex-grow">${escapeHTML(item.culturaSociedade || '').replace(/\n/g, '<br>')}</p>
            </div>
        `;
        if (hasLendas) {
            specificContentHTML += `
                <div class="col-span-1 bg-amber-900/10 p-6 md:p-8 rounded-3xl border border-amber-900/30 flex flex-col shadow-inner h-full">
                    <h4 class="font-cinzel text-xl md:text-2xl mb-4 text-amber-500 flex items-center gap-3 border-b border-amber-900/40 pb-4"><i class="fas fa-book-dead text-slate-500"></i> Lendas Conhecidas</h4>
                    <p class="text-amber-100/80 text-base leading-relaxed italic flex-grow">${escapeHTML(item.lendasConhecidas).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
    }

    if (isAbility) {
        specificContentHTML += `
            <div class="col-span-full flex justify-center">
                <div class="bg-slate-900 p-8 rounded-3xl border border-slate-700 shadow-inner inline-flex flex-col items-center min-w-[300px]">
                    <h4 class="font-cinzel text-sm text-slate-400 uppercase tracking-widest mb-2 block">Valor do D20 Necessário</h4>
                    <p class="text-6xl font-black text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">${escapeHTML(item.efeitoDanoBaseUsoHabilidade || 'N/A')}</p>
                </div>
            </div>
        `;
    }

    if (!isRace) {
        specificContentHTML += `
            <div class="${isClass ? 'md:col-span-1' : 'col-span-full'} bg-slate-900/40 p-6 md:p-8 rounded-3xl border border-slate-700/50 shadow-inner h-full">
                <h4 class="font-cinzel text-xl md:text-2xl mb-4 text-blue-400 border-b border-slate-700/50 pb-4 flex items-center gap-3"><i class="fas fa-scroll text-slate-500"></i> Descrição</h4>
                <p class="text-slate-300 text-base leading-loose">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }

    if (isClass) {
        const attrs = [
            { k: 'Ataque', v: item.poderAtaque },
            { k: 'Defesa', v: item.capacidadeDefesa },
            { k: 'Controle', v: item.controleGrupo },
            { k: 'Escalabilidade', v: item.escalabilidade },
            { k: 'Utilidade', v: item.utilidadeGrupo },
            { k: 'Facilidade', v: item.facilidade }
        ].filter(a => a.v >= 2);

        if (attrs.length > 0) {
            specificContentHTML += `
                <div class="col-span-full md:col-span-1 bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-slate-700 shadow-inner h-full flex flex-col">
                    <h4 class="font-cinzel text-xl md:text-2xl mb-5 text-emerald-400 flex items-center gap-3 border-b border-slate-700/50 pb-4"><i class="fas fa-chart-radar text-slate-500"></i> Atributos em Foco</h4>
                    <div class="flex flex-wrap gap-3 mt-2">
                        ${attrs.map(a => `<span class="bg-slate-950 border border-emerald-900/50 text-slate-200 px-4 py-2.5 rounded-full text-sm shadow-xl font-medium tracking-wide hover:border-emerald-500 transition-colors cursor-default">${a.k} <span class="text-amber-400 font-bold ml-2 text-base">(${a.v})</span></span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    return `
        <div class="simulador-card w-full p-6 md:p-10 lg:p-12 rounded-[2.5rem] border border-slate-600/50 shadow-2xl flex flex-col gap-10 items-start">
            
            <h3 class="font-cinzel text-4xl sm:text-5xl font-bold text-white border-b-2 border-slate-700/80 pb-4 tracking-wider w-full drop-shadow-md text-center xl:text-left">${escapeHTML(item.nome || 'Desconhecido')}</h3>
            
            <div class="w-full flex flex-col xl:flex-row gap-10 xl:gap-14 items-stretch">
                ${leftImgHTML}
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    ${specificContentHTML}
                </div>
            </div>

        </div>
    `;
}

// Funções Globais de Controle do Simulador
window.simulador = {
    setTab: function(tabName) {
        simState.tab = tabName;
        renderUI();
    },
    next: function() {
        const max = simState.data[simState.tab === 'ability' ? 'abilities' : simState.tab === 'profession' ? 'professions' : simState.tab === 'race' ? 'races' : 'classes'].length;
        if(max <= 1) return;
        simState.indices[simState.tab] = (simState.indices[simState.tab] + 1) % max;
        if(simState.tab === 'class') updateAbilitiesForCurrentClass();
        renderUI();
    },
    prev: function() {
        const max = simState.data[simState.tab === 'ability' ? 'abilities' : simState.tab === 'profession' ? 'professions' : simState.tab === 'race' ? 'races' : 'classes'].length;
        if(max <= 1) return;
        simState.indices[simState.tab] = (simState.indices[simState.tab] - 1 + max) % max;
        if(simState.tab === 'class') updateAbilitiesForCurrentClass();
        renderUI();
    },
    openImage: function(src) {
        const modal = document.getElementById('simulador-image-modal');
        const img = document.getElementById('simulador-modal-img');
        if(modal && img) {
            img.src = src;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
};
import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// Estado local do Simulador (Com histórico de atributos)
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
        <div class="w-full h-full fade-in flex flex-col p-4 md:p-6 overflow-y-auto custom-scroll relative pb-10">
            
            <header class="mb-4 w-full flex flex-col xl:flex-row items-center xl:items-center justify-between border-b border-slate-700 pb-4 gap-4">
                <div class="flex-1 w-full text-center xl:text-left">
                    <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold font-cinzel mb-1 text-blue-400 drop-shadow-md">
                        Forja do Aventureiro
                    </h1>
                    <p class="text-slate-400 text-xs md:text-sm max-w-2xl leading-snug mx-auto xl:mx-0">
                        Simule combinações de Raças e Classes, acompanhe o impacto nos atributos e visualize seu próximo herói.
                    </p>
                </div>
                <div id="simulador-summary" class="w-full xl:w-auto shrink-0 flex justify-center relative mt-4 xl:mt-0 z-40"></div>
            </header>

            <div class="flex justify-center border-b border-slate-600 mb-4 flex-wrap w-full gap-1 md:gap-2">
                <button onclick="window.simulador.setTab('race')" id="sim-tab-race" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-6 py-2 transition-colors duration-200 border-b-4 border-blue-500 text-blue-400 font-bold tracking-widest outline-none">1. Raça</button>
                <button onclick="window.simulador.setTab('class')" id="sim-tab-class" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-6 py-2 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">2. Classe</button>
                <button onclick="window.simulador.setTab('ability')" id="sim-tab-ability" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-6 py-2 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">3. Habilidades</button>
                <button onclick="window.simulador.setTab('profession')" id="sim-tab-profession" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-6 py-2 transition-colors duration-200 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">4. Profissões</button>
            </div>

            <div id="simulador-carousel-area" class="w-full flex-grow flex flex-col items-center"></div>
        </div>

        <div id="simulador-image-modal" class="fixed inset-0 bg-black/95 hidden items-center justify-center z-[100] p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-4xl transition-colors outline-none">&times;</button>
            <img id="simulador-modal-img" src="" class="max-w-[95vw] max-h-[95vh] rounded-xl border-4 border-slate-700 shadow-2xl object-contain">
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
        // Efeito RPG de Número Flutuante com altura ajustada (-top-10 para ficar bem acima da caixa)
        if (oldStats[key] !== undefined && oldStats[key] !== val) {
            const diff = val - oldStats[key];
            const color = diff > 0 ? 'text-emerald-400' : 'text-red-500';
            const icon = diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const signal = diff > 0 ? '+' : '';
            
            diffHTML = `<div class="absolute -top-12 right-0 left-0 flex justify-center ${color} font-black text-3xl animate-float-up pointer-events-none z-[100]">
                            <span class="flex items-center gap-1"><i class="fas ${icon} text-xl"></i> ${signal}${diff}</span>
                        </div>`;
        }

        return `
            <div class="relative bg-slate-800/90 p-2 md:p-3 rounded-xl text-center shadow-lg border border-slate-700/50 flex-1 min-w-[70px] lg:min-w-[80px]">
                ${diffHTML}
                <div class="text-[9px] md:text-[10px] font-cinzel text-blue-400 tracking-widest font-bold mb-0.5">${label}</div>
                <div class="text-xl md:text-2xl font-black text-white">${val}</div>
            </div>
        `;
    };

    summaryContainer.innerHTML = `
        <div class="bg-slate-900/80 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-slate-700/60 shadow-xl flex flex-col md:flex-row items-center gap-4 relative">
            <h2 class="font-cinzel text-slate-400 tracking-widest uppercase md:border-r border-slate-700 md:pr-4 text-xs font-bold shrink-0">Status</h2>
            <div class="flex gap-2 sm:gap-3 w-full overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                ${attrHTML('hp', 'HP', newStats.hp)}
                ${attrHTML('mp', 'MP', newStats.mp)}
                ${attrHTML('atk', 'ATK', newStats.atk)}
                ${attrHTML('def', 'DEF', newStats.def)}
                ${attrHTML('eva', 'EVA', newStats.eva)}
            </div>
        </div>
    `;

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
            <div class="text-center mb-4 w-full">
                <h4 class="font-cinzel text-base text-slate-400 mb-0.5">Habilidades para a Classe</h4>
                <p class="text-2xl font-bold text-amber-500 mb-2 drop-shadow-sm">${escapeHTML(clsName)}</p>
                <div class="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg max-w-2xl mx-auto">
                    <p class="text-xs text-slate-300 italic leading-snug">
                        Sua habilidade será definida por <strong class="text-amber-400">1d6</strong> para quantidade inicial e <strong class="text-amber-400">1d20</strong> para nível máximo de escolha.
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-10 w-full bg-slate-800/50 rounded-xl border border-slate-700 border-dashed text-base">Nenhuma habilidade encontrada para esta classe.</div>`;
    }
    if (simState.tab === 'profession') {
        items = simState.data.professions;
        extraHeader = `
            <div class="text-center mb-4 w-full">
                <div class="bg-amber-900/20 border border-amber-500/30 p-3 rounded-lg max-w-2xl mx-auto">
                    <p class="text-xs md:text-sm text-slate-300 italic leading-snug">
                        Para obter uma profissão, encontre uma Guilda. <strong class="text-amber-500">Permitido registrar apenas a partir do Nível 5.</strong>
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-10 w-full bg-slate-800/50 rounded-xl border border-slate-700 border-dashed text-base">Nenhuma profissão encontrada.</div>`;
    }

    if (items.length === 0) {
        area.innerHTML = extraHeader + placeholder;
        return;
    }

    const currentIndex = simState.indices[simState.tab];
    const currentItem = items[currentIndex];

    // Nav Buttons muito mais discretos
    const navHTML = `
        <div class="flex items-center justify-center mb-4 gap-4 w-full">
            <button onclick="window.simulador.prev()" class="p-2 px-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-sm focus:outline-none">
                <i class="fas fa-chevron-left text-sm"></i>
            </button>
            <div class="font-mono text-lg text-slate-200 font-bold min-w-[80px] text-center bg-slate-900 px-4 py-1 rounded-lg border border-slate-700 shadow-inner">
                ${currentIndex + 1} <span class="text-slate-500 text-base mx-1">/</span> ${items.length}
            </div>
            <button onclick="window.simulador.next()" class="p-2 px-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-sm focus:outline-none">
                <i class="fas fa-chevron-right text-sm"></i>
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
        // Imagem Menor (w-[18rem]) e mais enxuta
        leftImgHTML = `
            <div class="w-full sm:w-[16rem] xl:w-[18rem] shrink-0 mx-auto xl:mx-0 simulador-img-wrapper cursor-pointer group" onclick="window.simulador.openImage('${item.imagemUrl}')">
                <div class="simulador-img-glow"></div>
                <img src="${item.imagemUrl}" alt="${escapeHTML(item.nome)}" class="simulador-img aspect-[4/5]">
                <div class="absolute bottom-2 right-2 bg-black/70 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm text-xs">
                    <i class="fas fa-expand-arrows-alt"></i>
                </div>
            </div>
        `;
    }

    let specificContentHTML = '';

    if (isRace) {
        const hasLendas = !!item.lendasConhecidas;
        const cultColSpan = hasLendas ? "col-span-1" : "col-span-full"; 

        specificContentHTML += `
            <div class="${cultColSpan} bg-slate-900/40 p-4 md:p-5 rounded-2xl border border-slate-700/50 flex flex-col shadow-inner h-full">
                <h4 class="font-cinzel text-lg mb-2 text-blue-400 flex items-center gap-2 border-b border-slate-700/50 pb-2"><i class="fas fa-landmark text-slate-500 text-sm"></i> Cultura e Sociedade</h4>
                <p class="text-slate-300 text-sm leading-snug flex-grow">${escapeHTML(item.culturaSociedade || '').replace(/\n/g, '<br>')}</p>
            </div>
        `;
        if (hasLendas) {
            specificContentHTML += `
                <div class="col-span-1 bg-amber-900/10 p-4 md:p-5 rounded-2xl border border-amber-900/30 flex flex-col shadow-inner h-full">
                    <h4 class="font-cinzel text-lg mb-2 text-amber-500 flex items-center gap-2 border-b border-amber-900/40 pb-2"><i class="fas fa-book-dead text-slate-500 text-sm"></i> Lendas Conhecidas</h4>
                    <p class="text-amber-100/80 text-sm leading-snug italic flex-grow">${escapeHTML(item.lendasConhecidas).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
    }

    if (isAbility) {
        specificContentHTML += `
            <div class="col-span-full flex justify-center">
                <div class="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner inline-flex flex-col items-center min-w-[200px]">
                    <h4 class="font-cinzel text-xs text-slate-400 uppercase tracking-widest mb-1 block">Valor do D20 Necessário</h4>
                    <p class="text-4xl font-black text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">${escapeHTML(item.efeitoDanoBaseUsoHabilidade || 'N/A')}</p>
                </div>
            </div>
        `;
    }

    if (!isRace) {
        specificContentHTML += `
            <div class="${isClass ? 'md:col-span-1' : 'col-span-full'} bg-slate-900/40 p-4 md:p-5 rounded-2xl border border-slate-700/50 shadow-inner h-full">
                <h4 class="font-cinzel text-lg mb-2 text-blue-400 border-b border-slate-700/50 pb-2 flex items-center gap-2"><i class="fas fa-scroll text-slate-500 text-sm"></i> Descrição</h4>
                <p class="text-slate-300 text-sm leading-snug">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
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
                <div class="col-span-full md:col-span-1 bg-slate-900/60 p-4 md:p-5 rounded-2xl border border-slate-700 shadow-inner h-full flex flex-col">
                    <h4 class="font-cinzel text-lg mb-3 text-emerald-400 flex items-center gap-2 border-b border-slate-700/50 pb-2"><i class="fas fa-chart-radar text-slate-500 text-sm"></i> Atributos em Foco</h4>
                    <div class="flex flex-wrap gap-2 mt-1">
                        ${attrs.map(a => `<span class="bg-slate-950 border border-emerald-900/50 text-slate-200 px-3 py-1.5 rounded-lg text-xs shadow-md font-medium tracking-wide cursor-default">${a.k} <span class="text-amber-400 font-bold ml-1 text-sm">(${a.v})</span></span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    return `
        <div class="simulador-card w-full p-4 md:p-6 lg:p-8 rounded-2xl border border-slate-600/50 shadow-2xl flex flex-col gap-6 items-start">
            
            <h3 class="font-cinzel text-2xl sm:text-3xl font-bold text-white border-b-2 border-slate-700/80 pb-2 tracking-wider w-full drop-shadow-md text-center xl:text-left">${escapeHTML(item.nome || 'Desconhecido')}</h3>
            
            <div class="w-full flex flex-col xl:flex-row gap-6 xl:gap-8 items-stretch">
                ${leftImgHTML}
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
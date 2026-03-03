import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// Estado local do Simulador
const simState = {
    tab: 'race', // 'race', 'class', 'ability', 'profession'
    indices: { race: 0, class: 0, ability: 0, profession: 0 },
    data: { races: [], classes: [], abilities: [], professions: [] }
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
        <div class="w-full h-full fade-in flex flex-col p-6 overflow-y-auto custom-scroll relative pb-24">
            <header class="mb-8 w-full flex flex-col items-center justify-center border-b border-slate-700 pb-6">
                <h1 class="text-3xl sm:text-4xl text-center font-bold font-cinzel mb-3 text-blue-400 drop-shadow-md">
                    Forja do Aventureiro
                </h1>
                <p class="text-slate-400 text-sm text-center max-w-3xl leading-relaxed">
                    Simule diferentes combinações de Raças e Classes para visualizar os atributos totais resultantes antes de trilhar o seu caminho no mundo de Imperiall.
                </p>
            </header>

            <div id="simulador-summary" class="w-full mb-8"></div>

            <div class="flex justify-center border-b border-slate-600 mb-8 flex-wrap w-full gap-2 md:gap-4">
                <button onclick="window.simulador.setTab('race')" id="sim-tab-race" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-8 py-3 transition-colors duration-300 border-b-4 border-blue-500 text-blue-400 font-bold tracking-widest outline-none">1. Raça</button>
                <button onclick="window.simulador.setTab('class')" id="sim-tab-class" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">2. Classe</button>
                <button onclick="window.simulador.setTab('ability')" id="sim-tab-ability" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">3. Habilidades</button>
                <button onclick="window.simulador.setTab('profession')" id="sim-tab-profession" class="sim-tab font-cinzel text-sm md:text-base px-4 md:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200 tracking-widest outline-none">4. Profissões</button>
            </div>

            <div id="simulador-carousel-area" class="w-full flex-grow flex flex-col items-center"></div>
        </div>

        <div id="simulador-image-modal" class="fixed inset-0 bg-black/95 hidden items-center justify-center z-[100] p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-4xl transition-colors outline-none">&times;</button>
            <img id="simulador-modal-img" src="" class="max-w-[90vw] max-h-[90vh] rounded-xl border-2 border-slate-500 shadow-2xl object-contain">
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

    const hp = (Number(race.hpRacialBase) || 0) + (Number(cls.bonusHpClasseBase) || 0);
    const mp = (Number(race.mpRacialBase) || 0) + (Number(cls.bonusMpClasseBase) || 0);
    const atk = (Number(race.bonusAtkRacaBase) || 0) + (Number(cls.poderAtaque) || 0);
    const def = (Number(race.bonusDefRacaBase) || 0) + (Number(cls.capacidadeDefesa) || 0);
    const eva = (Number(race.bonusEvaRacaBase) || 0);

    const attrHTML = (label, val) => `
        <div class="bg-slate-800/80 p-3 md:p-4 rounded-xl text-center shadow-lg border border-slate-700/50 hover:border-blue-500/50 transition-colors duration-300 group">
            <div class="text-xs md:text-sm font-cinzel text-blue-400 tracking-widest font-bold mb-1 group-hover:text-amber-400 transition-colors">${label}</div>
            <div class="text-2xl md:text-3xl font-bold text-white">${val}</div>
        </div>
    `;

    summaryContainer.innerHTML = `
        <div class="bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/60 shadow-xl w-full max-w-5xl mx-auto">
            <h2 class="text-center text-xl font-cinzel mb-4 text-slate-300 tracking-widest">Resumo de Atributos</h2>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                ${attrHTML('HP', hp)}
                ${attrHTML('MP', mp)}
                ${attrHTML('ATAQUE', atk)}
                ${attrHTML('DEFESA', def)}
                ${attrHTML('EVASÃO', eva)}
            </div>
        </div>
    `;
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
            <div class="text-center mb-6 w-full">
                <h4 class="font-cinzel text-lg text-slate-300 mb-1">Habilidades para a Classe</h4>
                <p class="text-2xl font-bold text-amber-500 mb-3 drop-shadow-sm">${escapeHTML(clsName)}</p>
                <div class="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl max-w-3xl mx-auto">
                    <p class="text-sm text-slate-300 italic leading-relaxed">
                        Sua habilidade será definida por 2 quesitos: <strong class="text-amber-400">1d6</strong> para a quantidade de habilidades iniciais e <strong class="text-amber-400">1d20</strong> para o nível máximo.
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-12 w-full bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed text-lg max-w-3xl mx-auto">Nenhuma habilidade encontrada para esta classe.</div>`;
    }
    if (simState.tab === 'profession') {
        items = simState.data.professions;
        extraHeader = `
            <div class="text-center mb-6 w-full">
                <div class="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl max-w-3xl mx-auto">
                    <p class="text-sm text-slate-300 italic leading-relaxed">
                        Para obter uma profissão, você precisa encontrar uma guild ou profissional. <strong class="text-amber-500">Permitido registrar na ficha apenas a partir do Nível 5.</strong>
                    </p>
                </div>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-12 w-full bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed text-lg max-w-3xl mx-auto">Nenhuma profissão encontrada.</div>`;
    }

    if (items.length === 0) {
        area.innerHTML = extraHeader + placeholder;
        return;
    }

    const currentIndex = simState.indices[simState.tab];
    const currentItem = items[currentIndex];

    // Nav Buttons Sutis
    const navHTML = `
        <div class="flex items-center justify-center mb-6 gap-6 w-full">
            <button onclick="window.simulador.prev()" class="p-3 bg-slate-800 text-white rounded-full hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-md focus:outline-none group">
                <i class="fas fa-chevron-left text-lg group-hover:-translate-x-0.5 transition-transform"></i>
            </button>
            <div class="font-mono text-xl text-slate-200 font-bold min-w-[100px] text-center bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-700 shadow-inner">
                ${currentIndex + 1} <span class="text-slate-500 text-lg mx-1">/</span> ${items.length}
            </div>
            <button onclick="window.simulador.next()" class="p-3 bg-slate-800 text-white rounded-full hover:bg-amber-500 hover:text-black border border-slate-600 transition-all shadow-md focus:outline-none group">
                <i class="fas fa-chevron-right text-lg group-hover:translate-x-0.5 transition-transform"></i>
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
        // Imagem dimensionada elegantemente
        leftImgHTML = `
            <div class="w-full md:w-[20rem] xl:w-[24rem] shrink-0 mx-auto md:mx-0 simulador-img-wrapper cursor-pointer group" onclick="window.simulador.openImage('${item.imagemUrl}')">
                <div class="simulador-img-glow"></div>
                <img src="${item.imagemUrl}" alt="${escapeHTML(item.nome)}" class="simulador-img aspect-[4/5]">
                <div class="absolute bottom-3 right-3 bg-black/70 p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm text-xs">
                    <i class="fas fa-expand-arrows-alt"></i>
                </div>
            </div>
        `;
    }

    let specificContentHTML = '';

    if (isRace) {
        specificContentHTML += `
            <div class="mt-5 bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
                <h4 class="font-cinzel text-lg mb-2 text-blue-400 flex items-center gap-2"><i class="fas fa-landmark text-slate-500 text-sm"></i> Cultura e Sociedade</h4>
                <p class="text-slate-300 text-sm leading-relaxed">${escapeHTML(item.culturaSociedade || '').replace(/\n/g, '<br>')}</p>
            </div>
        `;
        if (item.lendasConhecidas) {
            specificContentHTML += `
                <div class="mt-4 bg-amber-900/10 p-5 rounded-xl border border-amber-900/30">
                    <h4 class="font-cinzel text-lg mb-2 text-amber-500 flex items-center gap-2"><i class="fas fa-book-dead text-slate-500 text-sm"></i> Lendas Conhecidas</h4>
                    <p class="text-amber-100/80 text-sm leading-relaxed italic">${escapeHTML(item.lendasConhecidas).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
    }

    if (isAbility) {
        specificContentHTML += `
            <div class="mt-4 bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner inline-block min-w-[200px]">
                <h4 class="font-cinzel text-xs text-slate-400 uppercase tracking-widest mb-1 block">Valor do D20 Necessário</h4>
                <p class="text-3xl font-black text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">${escapeHTML(item.efeitoDanoBaseUsoHabilidade || 'N/A')}</p>
            </div>
        `;
    }

    if (!isRace) {
        specificContentHTML += `
            <div class="mt-5">
                <h4 class="font-cinzel text-lg mb-2 text-blue-400 border-b border-slate-700 pb-1 flex items-center gap-2"><i class="fas fa-scroll text-slate-500 text-sm"></i> Descrição</h4>
                <p class="text-slate-300 text-sm leading-relaxed">${escapeHTML(desc).replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }

    if (isClass) {
        const attrs = [
            { k: 'Poder de Ataque', v: item.poderAtaque },
            { k: 'Capacidade de Defesa', v: item.capacidadeDefesa },
            { k: 'Controle de Grupo', v: item.controleGrupo },
            { k: 'Escalabilidade', v: item.escalabilidade },
            { k: 'Utilidade de Grupo', v: item.utilidadeGrupo },
            { k: 'Facilidade', v: item.facilidade }
        ].filter(a => a.v >= 2);

        if (attrs.length > 0) {
            specificContentHTML += `
                <div class="mt-6 bg-slate-900/60 p-5 rounded-xl border border-slate-700">
                    <h4 class="font-cinzel text-lg mb-3 text-emerald-400 flex items-center gap-2"><i class="fas fa-chart-radar text-slate-500 text-sm"></i> Atributos em Foco</h4>
                    <div class="flex flex-wrap gap-2">
                        ${attrs.map(a => `<span class="bg-slate-950 border border-emerald-900/50 text-slate-200 px-3 py-1.5 rounded-full text-xs shadow-sm font-medium tracking-wide hover:border-emerald-500 transition-colors cursor-default">${a.k} <span class="text-amber-400 font-bold ml-1">(${a.v})</span></span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    return `
        <div class="simulador-card w-full max-w-6xl p-6 md:p-8 rounded-2xl border border-slate-600/50 shadow-2xl flex flex-col md:flex-row gap-8 items-start">
            ${leftImgHTML}
            <div class="flex-1 w-full text-left flex flex-col justify-start">
                <h3 class="font-cinzel text-2xl sm:text-3xl font-bold text-white border-b border-slate-700/80 pb-3 tracking-wide">${escapeHTML(item.nome || 'Desconhecido')}</h3>
                <div class="mt-2 space-y-2 flex-grow">
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
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
        <div class="w-full h-full fade-in flex flex-col p-6 overflow-y-auto custom-scroll relative pb-20">
            <header class="mb-8 w-full flex flex-col items-center justify-center border-b border-slate-700 pb-6">
                <h1 class="text-4xl sm:text-5xl text-center font-bold font-cinzel mb-2 text-blue-400 drop-shadow-md">
                    Criação de Personagem
                </h1>
                <p class="text-slate-400 text-sm text-center max-w-2xl">
                    Simule diferentes combinações de Raças e Classes para ver os atributos totais resultantes antes de forjar o seu destino.
                </p>
            </header>

            <div id="simulador-summary" class="w-full mb-8"></div>

            <div class="flex justify-center border-b border-slate-600 mb-8 flex-wrap w-full gap-2">
                <button onclick="window.simulador.setTab('race')" id="sim-tab-race" class="sim-tab font-cinzel text-base sm:text-lg px-4 sm:px-8 py-3 transition-colors duration-300 border-b-4 border-blue-500 text-blue-400 font-bold">1. Raça</button>
                <button onclick="window.simulador.setTab('class')" id="sim-tab-class" class="sim-tab font-cinzel text-base sm:text-lg px-4 sm:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200">2. Classe</button>
                <button onclick="window.simulador.setTab('ability')" id="sim-tab-ability" class="sim-tab font-cinzel text-base sm:text-lg px-4 sm:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200">3. Habilidades</button>
                <button onclick="window.simulador.setTab('profession')" id="sim-tab-profession" class="sim-tab font-cinzel text-base sm:text-lg px-4 sm:px-8 py-3 transition-colors duration-300 border-b-4 border-transparent text-slate-400 hover:text-slate-200">4. Profissões</button>
            </div>

            <div id="simulador-carousel-area" class="w-full flex-grow flex flex-col items-center"></div>
        </div>

        <div id="simulador-image-modal" class="fixed inset-0 bg-black/90 hidden items-center justify-center z-[100] p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-4 right-6 text-white text-4xl hover:text-blue-400 transition-colors">&times;</button>
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
    simState.indices.ability = 0; // Reseta o índice sempre que a classe muda
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
        <div class="bg-slate-800 p-4 rounded-lg text-center shadow-lg border border-slate-700">
            <div class="text-xs font-cinzel text-blue-400 tracking-widest font-bold mb-1">${label}</div>
            <div class="text-3xl font-bold text-white">${val}</div>
        </div>
    `;

    summaryContainer.innerHTML = `
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-xl max-w-5xl mx-auto w-full">
            <h2 class="text-center text-xl font-cinzel mb-6 text-slate-300 tracking-widest">Atributos Base da Combinação</h2>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div class="text-center mb-6">
                <h4 class="font-cinzel text-xl text-slate-300">Habilidades para a Classe</h4>
                <p class="text-2xl font-bold text-blue-400 mb-2">${escapeHTML(clsName)}</p>
                <p class="text-sm text-slate-400 max-w-2xl mx-auto italic">Sua habilidade será definida por 2 quesitos: 1d6 para a quantidade de habilidades iniciais aprendidas e 1d20 para saber o nível máximo destas habilidades que você pode escolher.</p>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-10 w-full max-w-3xl mx-auto bg-slate-800/50 p-8 rounded-xl border border-slate-700">Nenhuma habilidade encontrada para esta classe.</div>`;
    }
    if (simState.tab === 'profession') {
        items = simState.data.professions;
        extraHeader = `
            <div class="text-center mb-6">
                <p class="text-sm text-slate-400 max-w-2xl mx-auto italic">Para obter uma profissão, você precisa encontrar uma guild de Profissões ou um profissional para iniciar seus treinamentos. Permitido apenas a partir do level 5.</p>
            </div>
        `;
        placeholder = `<div class="text-center text-slate-400 py-10 w-full max-w-3xl mx-auto bg-slate-800/50 p-8 rounded-xl border border-slate-700">Nenhuma profissão encontrada.</div>`;
    }

    if (items.length === 0) {
        area.innerHTML = extraHeader + placeholder;
        return;
    }

    const currentIndex = simState.indices[simState.tab];
    const currentItem = items[currentIndex];

    // Renderiza Botões de Navegação
    const navHTML = `
        <div class="flex items-center justify-center mb-6 gap-6 w-full">
            <button onclick="window.simulador.prev()" class="p-3 bg-slate-800 text-white rounded-full hover:bg-blue-600 border border-slate-600 transition-colors shadow-lg focus:outline-none disabled:opacity-50">
                <i class="fas fa-chevron-left text-xl"></i>
            </button>
            <div class="font-mono text-xl text-slate-300 font-bold min-w-[80px] text-center bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                ${currentIndex + 1} <span class="text-slate-500">/</span> ${items.length}
            </div>
            <button onclick="window.simulador.next()" class="p-3 bg-slate-800 text-white rounded-full hover:bg-blue-600 border border-slate-600 transition-colors shadow-lg focus:outline-none disabled:opacity-50">
                <i class="fas fa-chevron-right text-xl"></i>
            </button>
        </div>
    `;

    // Renderiza Card
    const cardHTML = generateCardHTML(currentItem, simState.tab);

    area.innerHTML = `
        ${extraHeader}
        ${navHTML}
        <div class="w-full flex justify-center animate-fade-in">
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
        leftImgHTML = `
            <div class="w-full md:w-64 flex-shrink-0 mx-auto md:mx-0">
                <img src="${item.imagemUrl}" alt="${escapeHTML(item.nome)}" 
                     onclick="window.simulador.openImage('${item.imagemUrl}')"
                     class="w-full aspect-[3/4] object-cover rounded-xl border-2 border-slate-600 shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer hover:border-blue-400 hover:scale-105 transition-all duration-300">
            </div>
        `;
    }

    let specificContentHTML = '';

    if (isRace) {
        specificContentHTML += `
            <div class="mt-4">
                <h4 class="font-cinzel text-lg mb-1 text-blue-400 border-b border-slate-700 pb-1">Cultura e Sociedade</h4>
                <p class="text-slate-300 text-sm leading-relaxed">${escapeHTML(item.culturaSociedade || '').replace(/\n/g, '<br>')}</p>
            </div>
        `;
        if (item.lendasConhecidas) {
            specificContentHTML += `
                <div class="mt-4">
                    <h4 class="font-cinzel text-lg mb-1 text-amber-500 border-b border-slate-700 pb-1">Lendas Conhecidas</h4>
                    <p class="text-slate-300 text-sm leading-relaxed">${escapeHTML(item.lendasConhecidas).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
    }

    if (isAbility) {
        specificContentHTML += `
            <div class="mt-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center">
                <h4 class="font-cinzel text-sm text-slate-400 uppercase tracking-widest mb-1">Valor do D20 Necessário</h4>
                <p class="text-3xl font-bold text-amber-400">${escapeHTML(item.efeitoDanoBaseUsoHabilidade || 'N/A')}</p>
            </div>
        `;
    }

    if (!isRace) {
        specificContentHTML += `
            <div class="mt-4">
                <h4 class="font-cinzel text-lg mb-1 text-blue-400 border-b border-slate-700 pb-1">Descrição</h4>
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
                <div class="mt-6">
                    <h4 class="font-cinzel text-lg mb-3 text-emerald-400">Atributos em Foco</h4>
                    <div class="flex flex-wrap gap-2">
                        ${attrs.map(a => `<span class="bg-slate-900 border border-slate-600 text-slate-300 px-3 py-1 rounded-full text-xs shadow-sm">${a.k} <span class="text-amber-400 font-bold ml-1">(${a.v})</span></span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    return `
        <div class="bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-600 w-full max-w-5xl shadow-2xl flex flex-col md:flex-row gap-8 items-start">
            ${leftImgHTML}
            <div class="flex-1 w-full text-left flex flex-col">
                <h3 class="font-cinzel text-3xl sm:text-4xl font-bold text-white border-b border-slate-700 pb-3">${escapeHTML(item.nome || 'Desconhecido')}</h3>
                <div class="mt-4 space-y-4">
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
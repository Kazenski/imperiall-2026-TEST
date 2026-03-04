import { db } from '../core/firebase.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

let allClasses = [];
let allSubclasses = [];
let allSkills = [];

let selectedClassId = '';
let selectedSkills = [];
let currentSortKey = 'nome';
let currentSortDirection = 'asc';

export async function renderHabilidadesTab() {
    const container = document.getElementById('habilidades-content');
    if (!container) return;

    // Reset de estado
    selectedClassId = '';
    selectedSkills = [];

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-10 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md">Compêndio de Habilidades</h1>
                <p class="text-slate-400 mt-3 text-sm md:text-base italic">O grimório definitivo das artes e magias de combate</p>
            </header>

            <div class="w-full flex-grow flex flex-col gap-6">
                <div class="w-full max-w-2xl mx-auto p-6 bg-slate-800/80 border border-slate-700 rounded-2xl shadow-xl relative z-20">
                    <label htmlFor="habilidade-class-select" class="block text-sm md:text-base font-cinzel font-bold text-slate-300 mb-3 tracking-widest uppercase">
                        Filtrar Origem do Poder:
                    </label>
                    <div class="relative">
                        <select id="habilidade-class-select" class="appearance-none w-full px-5 py-4 bg-slate-900 text-white border-2 border-slate-600 rounded-xl shadow-inner focus:outline-none focus:border-amber-500 transition-colors cursor-pointer text-base md:text-lg" onchange="window.habilidadesCompendio.handleClassSelect(this.value)">
                            <option value="" class="bg-slate-900 text-slate-400">Vasculhando Grimórios...</option>
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-amber-500">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>

                <div id="habilidades-table-container" class="w-full relative z-10 hidden mt-4">
                    <div class="w-full overflow-x-auto pb-4 custom-scroll">
                        <table class="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr class="bg-slate-800/80 text-amber-500 font-cinzel tracking-widest border-b-2 border-amber-600">
                                    <th class="py-4 px-4 font-bold text-sm uppercase cursor-pointer hover:text-amber-300" onclick="window.habilidadesCompendio.handleSort('nome')">Técnica <i class="fas fa-sort ml-1 opacity-50"></i></th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase w-1/3">Descrição</th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase">Duração</th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase">Custo MP</th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase">Dano Base</th>
                                    <th class="py-4 px-4 font-bold text-sm uppercase text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="habilidades-table-body" class="text-slate-300">
                                </tbody>
                        </table>
                    </div>
                </div>

                <div id="habilidades-feedback-container" class="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-2xl w-full">
                    <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" id="habilidade-loading-spinner"></div>
                    <p class="text-xl text-slate-400 font-cinzel tracking-widest animate-pulse" id="habilidade-loading-text">Reunindo pergaminhos...</p>
                </div>
            </div>
            
        </div>

        <div id="habilidade-modal" class="fixed inset-0 z-[100] bg-black/95 hidden flex-col items-center justify-center p-4 md:p-10 animate-fade-in">
            <div class="w-full max-w-4xl bg-slate-900 border-2 border-amber-600 rounded-2xl shadow-2xl relative flex flex-col max-h-full">
                <button class="absolute top-4 right-6 text-slate-400 hover:text-red-500 text-3xl font-bold transition-colors outline-none z-10" onclick="document.getElementById('habilidade-modal').classList.add('hidden'); document.getElementById('habilidade-modal').classList.remove('flex');">&times;</button>
                
                <div class="p-6 md:p-10 overflow-y-auto custom-scroll" id="habilidade-modal-content">
                    </div>
            </div>
        </div>
    `;

    await fetchInitialData();
}

async function fetchInitialData() {
    const selectEl = document.getElementById('habilidade-class-select');
    const spinner = document.getElementById('habilidade-loading-spinner');
    const textEl = document.getElementById('habilidade-loading-text');

    try {
        const [classSnap, subClassSnap, skillSnap] = await Promise.all([
            getDocs(query(collection(db, 'rpg_classes'), orderBy("nome"))),
            getDocs(query(collection(db, 'rpg_subclasses'), orderBy("nome"))),
            getDocs(collection(db, 'rpg_habilidades'))
        ]);

        allClasses = classSnap.docs.map(doc => ({ id: doc.id, name: doc.data().nome }));
        allSubclasses = subClassSnap.docs.map(doc => ({ id: doc.id, name: doc.data().nome }));
        allSkills = skillSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Popula Dropdown agrupado
        if (selectEl) {
            let optionsHTML = `<option value="" class="bg-slate-900">-- Selecione a Origem --</option>`;
            
            optionsHTML += `<optgroup label="Classes" class="bg-slate-900 text-sky-400">`;
            allClasses.forEach(c => optionsHTML += `<option value="${c.id}" class="text-white">${c.name}</option>`);
            optionsHTML += `</optgroup>`;

            optionsHTML += `<optgroup label="Subclasses" class="bg-slate-900 text-purple-400">`;
            allSubclasses.forEach(s => optionsHTML += `<option value="${s.id}" class="text-white">${s.name}</option>`);
            optionsHTML += `</optgroup>`;

            selectEl.innerHTML = optionsHTML;
        }

        if (spinner) spinner.classList.add('hidden');
        if (textEl) {
            textEl.textContent = "Selecione uma Classe ou Subclasse para revelar suas habilidades.";
            textEl.classList.remove('animate-pulse');
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        if (selectEl) selectEl.innerHTML = `<option value="">Erro Crítico.</option>`;
        if (spinner) spinner.classList.add('hidden');
        if (textEl) {
            textEl.textContent = "Os grimórios foram selados (Erro de conexão).";
            textEl.classList.replace('text-slate-400', 'text-red-500');
        }
    }
}

function processSkillsForSelection(classId) {
    const tableContainer = document.getElementById('habilidades-table-container');
    const feedbackContainer = document.getElementById('habilidades-feedback-container');
    const feedbackText = document.getElementById('habilidade-loading-text');

    if (!classId) {
        tableContainer.classList.add('hidden');
        feedbackContainer.classList.remove('hidden');
        feedbackText.textContent = "Selecione uma Classe ou Subclasse para revelar suas habilidades.";
        return;
    }

    // Filtra habilidades que pertencem à classe/subclasse (lembrando que são arrays no banco)
    selectedSkills = allSkills.filter(skill => {
        const inClass = skill.restricaoClasses && skill.restricaoClasses.includes(classId);
        const inSubclass = skill.restricaoSubclasses && skill.restricaoSubclasses.includes(classId);
        return inClass || inSubclass;
    });

    if (selectedSkills.length === 0) {
        tableContainer.classList.add('hidden');
        feedbackContainer.classList.remove('hidden');
        feedbackText.textContent = "Nenhuma habilidade registrada para esta seleção.";
        return;
    }

    // Prepara para mostrar tabela
    feedbackContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    
    // Força a primeira ordenação
    sortSkills('nome');
}

function formatLvlMap(data) {
    if (!data) return '<span class="text-slate-500">N/A</span>';
    if (typeof data === 'number') return `<span class="text-amber-400 font-bold">${data}</span>`;
    
    if (typeof data === 'object') {
        const firstKey = Object.keys(data).sort()[0];
        if (firstKey) {
            return `<span class="text-amber-400 font-bold">${data[firstKey]}</span> <span class="text-xs text-slate-500">(${firstKey})</span>`;
        }
    }
    return '<span class="text-slate-500">N/A</span>';
}

// Utilizado para extrair o valor real numérico para ordenação
function getSortValue(skill, key) {
    if (key === 'nome') return skill.nome || '';
    
    const data = skill[key];
    if (typeof data === 'number') return data;
    if (typeof data === 'object' && data !== null) {
        const firstKey = Object.keys(data).sort()[0];
        return Number(data[firstKey]) || 0;
    }
    return 0;
}

function sortSkills(key) {
    if (currentSortKey === key) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortKey = key;
        currentSortDirection = 'asc';
    }

    selectedSkills.sort((a, b) => {
        const valA = getSortValue(a, key);
        const valB = getSortValue(b, key);

        if (typeof valA === 'string') {
            return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
    });

    renderTableRows();
}

function renderTableRows() {
    const tbody = document.getElementById('habilidades-table-body');
    if (!tbody) return;

    let html = '';
    selectedSkills.forEach((skill, idx) => {
        // Truncar descrição
        const desc = skill.descricaoEfeito || '';
        const shortDesc = desc.length > 80 ? desc.substring(0, 80) + '...' : desc;

        html += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors group">
                <td class="py-4 px-4 font-bold text-white align-top">${escapeHTML(skill.nome || 'Desconhecida')}</td>
                <td class="py-4 px-4 text-sm align-top leading-relaxed text-slate-300 pr-8">
                    ${escapeHTML(shortDesc)}
                </td>
                <td class="py-4 px-4 text-sm align-top">${escapeHTML(skill.duracaoHabilidade || 'N/A')}</td>
                <td class="py-4 px-4 text-sm align-top font-mono bg-slate-900/30">${formatLvlMap(skill.gastoMpUso)}</td>
                <td class="py-4 px-4 text-sm align-top font-mono bg-slate-900/30">${formatLvlMap(skill.efeitoDanoBaseUsoHabilidade)}</td>
                <td class="py-4 px-4 text-center align-top">
                    <button onclick="window.habilidadesCompendio.openModal('${skill.id}')" class="px-4 py-2 bg-slate-700 hover:bg-amber-600 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-md">
                        Detalhes
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Modal Detalhado
function openSkillModal(skillId) {
    const modal = document.getElementById('habilidade-modal');
    const content = document.getElementById('habilidade-modal-content');
    if (!modal || !content) return;

    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return;

    // Constrói o HTML dos mapas (MP, Dano) com formatação rica
    const renderFullMap = (data, unit) => {
        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return '<span class="text-slate-500">N/A</span>';
        if (typeof data === 'number') return `<span class="bg-slate-800 px-3 py-1 rounded text-amber-400 font-mono border border-slate-700">${data} ${unit}</span>`;
        
        const sortedKeys = Object.keys(data).sort();
        return `<div class="flex flex-wrap gap-2">` + 
            sortedKeys.map(k => `<span class="bg-slate-800 px-3 py-1 rounded border border-slate-700 font-mono text-sm"><span class="text-slate-400 mr-2">${k}:</span><span class="text-amber-400 font-bold">${data[k]}</span> ${unit}</span>`).join('') +
        `</div>`;
    };

    content.innerHTML = `
        <div class="flex items-center gap-4 border-b border-slate-700 pb-6 mb-6">
            <div class="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-amber-500/50 text-amber-500 text-3xl shrink-0 shadow-lg">
                <i class="fas fa-book-sparkles"></i>
            </div>
            <div>
                <h2 class="text-3xl md:text-4xl font-black font-cinzel text-white">${escapeHTML(skill.nome)}</h2>
                <p class="text-amber-500 font-bold tracking-widest text-sm uppercase mt-1">Técnica Registrada</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div class="space-y-6">
                <div>
                    <h4 class="text-slate-400 font-cinzel font-bold text-sm tracking-widest mb-3 uppercase border-b border-slate-800 pb-1">Custo de Poder (MP)</h4>
                    ${renderFullMap(skill.gastoMpUso, 'MP')}
                </div>
                <div>
                    <h4 class="text-slate-400 font-cinzel font-bold text-sm tracking-widest mb-3 uppercase border-b border-slate-800 pb-1">Potência Base</h4>
                    ${renderFullMap(skill.efeitoDanoBaseUsoHabilidade, 'Dano')}
                </div>
            </div>
            <div class="space-y-6">
                <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 class="text-slate-400 font-cinzel text-xs tracking-widest uppercase mb-1">Duração</h4>
                    <p class="text-xl text-white">${escapeHTML(skill.duracaoHabilidade || 'Instantânea')}</p>
                </div>
                <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 class="text-slate-400 font-cinzel text-xs tracking-widest uppercase mb-1">Área de Efeito</h4>
                    <p class="text-xl text-white">${escapeHTML(skill.areaHabilidade || 'Alvo Único')}</p>
                </div>
            </div>
        </div>

        <div class="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/80 shadow-inner">
            <h4 class="text-xl font-cinzel font-bold text-amber-400 mb-4 flex items-center gap-2"><i class="fas fa-scroll"></i> Efeito da Habilidade</h4>
            <p class="text-slate-300 text-base md:text-lg leading-relaxed whitespace-pre-wrap">${escapeHTML(skill.descricaoEfeito || 'O manual encontra-se ilegível neste trecho.')}</p>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Funções Globais da Página
window.habilidadesCompendio = {
    handleClassSelect: function(val) {
        processSkillsForSelection(val);
    },
    handleSort: function(key) {
        sortSkills(key);
    },
    openModal: function(id) {
        openSkillModal(id);
    }
};
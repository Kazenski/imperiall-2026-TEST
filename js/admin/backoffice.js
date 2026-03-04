import { db, storage } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { escapeHTML, compressImage } from '../core/utils.js';
import { BONUS_LIST } from '../core/state.js';

let boState = {
    activeTab: 'habilidades',
    subAbaBal: 'habilidades',
    cache: null,
    selectedItem: null,
    pendingImage: null,
    edits: {},
    filter: ''
};

// Map das coleções do Firebase vs as chaves que usamos no Cache
const COLL_MAP = {
    atributos: { c: 'rpg_atributos', name: 'Atributos' },
    habilidades: { c: 'rpg_habilidades', name: 'Habilidades' },
    racas: { c: 'rpg_racas', name: 'Raças' },
    classes: { c: 'rpg_classes', name: 'Classes' },
    subclasses: { c: 'rpg_subclasses', name: 'Subclasses' },
    profissoes: { c: 'rpg_profissoes', name: 'Profissões' },
    terrenos: { c: 'rpg_terrenosBonus', name: 'Terrenos' },
    efeitos: { c: 'rpg_efeitosGerais', name: 'Efeitos' },
    tiposEfeito: { c: 'rpg_efeitoTipos', name: 'Tipos Efeito' },
    vantagens: { c: 'rpg_vantagensHabilidadesNaturais', name: 'Vantagens' },
    sessoes: { c: 'rpg_sessoes', name: 'Sessões', sort: 'desc', sortKey: 'dataRegistro' },
    personagens: { c: 'rpg_fichas', name: 'Personagens' }
};

export async function renderBackofficeTab() {
    const container = document.getElementById('backoffice-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md"><i class="fas fa-database mr-3"></i> Backoffice Mestre</h1>
                <p class="text-slate-400 mt-2 text-sm italic">O núcleo de dados absolutos de Imperiall</p>
            </header>

            <nav class="flex flex-wrap gap-2 mb-8 border-b border-slate-800 pb-4" id="bo-tabs-nav">
                ${Object.keys(COLL_MAP).filter(k => !['atributos','tiposEfeito','personagens'].includes(k)).map(k => `
                    <button class="bo-tab-btn ${boState.activeTab === k ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'} px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-colors" data-tab="${k}">${COLL_MAP[k].name}</button>
                `).join('')}
                <button class="bo-tab-btn ${boState.activeTab === 'balanceamento' ? 'bg-purple-600 text-white' : 'bg-purple-900/50 text-purple-300 hover:bg-purple-700 hover:text-white'} px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-colors ml-auto" data-tab="balanceamento"><i class="fas fa-balance-scale mr-1"></i> Balanceamento</button>
            </nav>

            <div id="bo-dynamic-content" class="w-full relative min-h-[400px]">
                <div id="bo-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-500 mb-4"></div>
                    <p class="text-amber-500 font-cinzel tracking-widest">Sincronizando Matrizes...</p>
                </div>
                <div id="bo-view" class="w-full hidden"></div>
            </div>
        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('bo-tabs-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.bo-tab-btn');
        if (btn) {
            boState.activeTab = btn.dataset.tab;
            boState.selectedItem = null;
            boState.pendingImage = null;
            boState.filter = '';
            renderBackofficeTab(); // Re-renderiza toda a aba para atualizar o visual dos botões
        }
    });
}

async function loadAllData() {
    try {
        const newCache = {};
        const promises = Object.entries(COLL_MAP).map(async ([key, info]) => {
            const q = query(collection(db, info.c), orderBy(info.sortKey || 'nome', info.sort || 'asc'));
            const snap = await getDocs(q);
            newCache[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        });
        
        await Promise.all(promises);
        boState.cache = newCache;
        
        document.getElementById('bo-loading').classList.add('hidden');
        document.getElementById('bo-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('bo-loading').innerHTML = '<p class="text-red-500">Erro crítico ao carregar Banco de Dados.</p>';
    }
}

function renderActiveView() {
    const view = document.getElementById('bo-view');
    if (!view) return;

    if (boState.activeTab === 'balanceamento') {
        view.innerHTML = renderBalanceamento();
        attachBalanceamentoListeners();
        return;
    }

    if (boState.selectedItem !== null || boState.activeTab === 'new') {
        view.innerHTML = renderForm(boState.activeTab, boState.selectedItem);
        attachFormListeners();
    } else {
        view.innerHTML = renderList(boState.activeTab);
    }
}

// ------------------------------------------------------------------------------------
// UI DE LISTAGEM GENÉRICA
// ------------------------------------------------------------------------------------
function renderList(tab) {
    const data = boState.cache[tab] || [];
    const term = boState.filter.toLowerCase();
    const filtered = data.filter(i => (i.nome||'').toLowerCase().includes(term));

    const showImages = ['habilidades', 'racas', 'classes', 'subclasses', 'profissoes'].includes(tab);

    let listHtml = '';
    
    if (showImages) {
        listHtml = `
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-[600px] overflow-y-auto custom-scroll p-2">
                ${filtered.map(i => `
                    <div class="aspect-square bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-colors" onclick="window.boTools.editItem('${i.id}')">
                        <img src="${i.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=X'}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100">
                        <div class="absolute bottom-0 w-full bg-black/80 text-white text-[9px] text-center p-1 truncate font-bold">${escapeHTML(i.nome)}</div>
                        <button onclick="event.stopPropagation(); window.boTools.deleteItem('${tab}', '${i.id}', '${escapeHTML(i.nome)}')" class="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        listHtml = `
            <div class="space-y-2 max-h-[600px] overflow-y-auto custom-scroll pr-2">
                ${filtered.map(i => `
                    <div class="flex justify-between items-center bg-slate-800 p-3 rounded-lg border-l-4 border-amber-500 hover:bg-slate-700 transition-colors">
                        <span class="font-bold text-slate-200">${escapeHTML(i.nome || i.id)}</span>
                        <div class="flex gap-2">
                            <button onclick="window.boTools.editItem('${i.id}')" class="w-8 h-8 rounded bg-sky-700 hover:bg-sky-600 text-white flex items-center justify-center"><i class="fas fa-pen text-xs"></i></button>
                            <button onclick="window.boTools.deleteItem('${tab}', '${i.id}', '${escapeHTML(i.nome || i.id)}')" class="w-8 h-8 rounded bg-red-700 hover:bg-red-600 text-white flex items-center justify-center"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 animate-fade-in">
            <div class="flex justify-between items-center mb-6">
                <input type="text" placeholder="Filtrar por nome..." value="${boState.filter}" onkeyup="window.boTools.setFilter(this.value)" class="w-1/2 bg-slate-900 border border-slate-600 px-4 py-2 rounded-lg text-white outline-none focus:border-amber-500">
                <button onclick="window.boTools.newItem()" class="btn bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg"><i class="fas fa-plus mr-2"></i> Adicionar</button>
            </div>
            ${filtered.length === 0 ? '<p class="text-slate-500 text-center py-10 italic">Nenhum registro encontrado.</p>' : listHtml}
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// UI DE FORMULÁRIOS DINÂMICOS
// ------------------------------------------------------------------------------------
function renderForm(tab, item) {
    const isEdit = !!item;
    const title = isEdit ? `Editando: ${escapeHTML(item.nome)}` : `Novo Registro: ${COLL_MAP[tab].name}`;

    let specificHtml = '';
    
    // --- HABILIADES ---
    if (tab === 'habilidades') {
        specificHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item?.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                    <div class="form-field"><label class="text-xs text-slate-400">Tipo de Efeito</label><select id="f-tipoEf" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"><option ${item?.tipoEfeitoHabildiade==='Ofensivo'?'selected':''}>Ofensivo</option><option ${item?.tipoEfeitoHabildiade==='Defensivo'?'selected':''}>Defensivo</option><option ${item?.tipoEfeitoHabildiade==='BUFF'?'selected':''}>BUFF</option><option ${item?.tipoEfeitoHabildiade==='DEBUFF'?'selected':''}>DEBUFF</option><option ${item?.tipoEfeitoHabildiade==='Utilidade'?'selected':''}>Utilidade</option><option ${item?.tipoEfeitoHabildiade==='Neutro'?'selected':''}>Neutro</option></select></div>
                    <div class="form-field"><label class="text-xs text-slate-400">Tipo de Ação</label><select id="f-tipoAc" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"><option ${item?.tipoAcaoHabildiade==='Ação'?'selected':''}>Ação</option><option ${item?.tipoAcaoHabildiade==='Reação'?'selected':''}>Reação</option><option ${item?.tipoAcaoHabildiade==='Livre'?'selected':''}>Livre</option></select></div>
                    <div class="form-field"><label class="text-xs text-slate-400">Descrição</label><textarea id="f-desc" rows="3" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item?.descricaoEfeito||'')}</textarea></div>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-field"><label class="text-xs text-slate-400">Custo MP</label><input type="number" id="f-mp" value="${item?.gastoMpUso||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                        <div class="form-field"><label class="text-xs text-slate-400">Dano Base</label><input type="number" id="f-dano" value="${item?.efeitoDanoBaseUsoHabilidade||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                        <div class="form-field"><label class="text-xs text-slate-400">Movimentação</label><input type="number" id="f-mov" value="${item?.movimentacaoHabilidade||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                        <div class="form-field"><label class="text-xs text-slate-400">Duração</label><input type="text" id="f-dur" value="${escapeHTML(item?.duracaoHabilidade||'Instantâneo')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                        <div class="form-field"><label class="text-xs text-slate-400">Qtd Alvos</label><input type="number" id="f-alvos" value="${item?.quantidadeAlvos||1}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                        <div class="form-field"><label class="text-xs text-slate-400">Custo (Aprender)</label><input type="number" id="f-ap" value="${item?.custoAprendizado||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    </div>
                </div>
                <div class="md:col-span-2">
                    ${renderCheckboxGroup('Restrição de Classes', 'rpg_classes', boState.cache.classes, item?.restricaoClasses || [])}
                </div>
            </div>
        `;
    }
    // --- RAÇAS E CLASSES ---
    else if (tab === 'racas' || tab === 'classes' || tab === 'subclasses') {
        const isRaca = tab === 'racas';
        const isSub = tab === 'subclasses';
        specificHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item?.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="grid grid-cols-5 gap-2">
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">HP Bônus</label><input type="number" id="f-hp" value="${item?.[isRaca?'bonusHpRacaBase':(isSub?'bonusHpSubclasseBase':'bonusHpClasseBase')]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">MP Bônus</label><input type="number" id="f-mp" value="${item?.[isRaca?'bonusMpRacaBase':(isSub?'bonusMpSubclasseBase':'bonusMpClasseBase')]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">ATK Bônus</label><input type="number" id="f-atk" value="${item?.[isRaca?'bonusAtkRacaBase':(isSub?'bonusAtaqueSubclasseBase':'bonusAtaqueClasseBase')]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">DEF Bônus</label><input type="number" id="f-def" value="${item?.[isRaca?'bonusDefRacaBase':(isSub?'bonusDefesaSubclasseBase':'bonusDefesaClasseBase')]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                    <div class="form-field"><label class="text-[10px] text-slate-400 uppercase">EVA Bônus</label><input type="number" id="f-eva" value="${item?.[isRaca?'bonusEvaRacaBase':(isSub?'bonusEvasaoSubclasseBase':'bonusEvasaoClasseBase')]||0}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white"></div>
                </div>
                ${!isRaca ? renderCheckboxGroup('Habilidades Iniciais', 'rpg_habilidades', boState.cache.habilidades, item?.habilidadesDisponiveis || []) : ''}
            </div>
        `;
    }
    // --- VANTAGENS ---
    else if (tab === 'vantagens') {
        specificHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item?.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field"><label class="text-xs text-slate-400">Descrição</label><textarea id="f-desc" rows="4" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item?.descricao||'')}</textarea></div>
                <div class="form-field"><label class="text-xs text-slate-400">Anotações do Mestre (Segredo)</label><textarea id="f-notas" rows="2" class="w-full p-2 rounded bg-slate-900 border border-amber-900 text-amber-500">${escapeHTML(item?.anotacoesMestre||'')}</textarea></div>
            </div>
        `;
    }
    // --- GENÉRICO TEXTO SIMPLES ---
    else {
        specificHtml = `
            <div class="space-y-4">
                <div class="form-field"><label class="text-xs text-slate-400">Nome</label><input type="text" id="f-nome" value="${escapeHTML(item?.nome||'')}" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white" required></div>
                <div class="form-field"><label class="text-xs text-slate-400">Descrição / Efeito</label><textarea id="f-desc" rows="4" class="w-full p-2 rounded bg-slate-900 border border-slate-600 text-white">${escapeHTML(item?.descricao||item?.efeito||'')}</textarea></div>
            </div>
        `;
    }

    const hasImage = ['habilidades', 'racas', 'classes', 'subclasses', 'profissoes'].includes(tab);

    return `
        <div class="bg-slate-800 p-8 rounded-2xl border border-amber-500/50 shadow-2xl max-w-4xl mx-auto animate-fade-in relative">
            <h2 class="text-2xl font-bold font-cinzel text-amber-400 mb-6 border-b border-slate-600 pb-4">${title}</h2>
            <form id="bo-main-form" class="space-y-6">
                <input type="hidden" id="f-id" value="${item?.id || ''}">
                <input type="hidden" id="f-oldImg" value="${item?.imagemUrl || ''}">

                ${hasImage ? `
                    <div class="flex items-center gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                        <img id="bo-img-preview" src="${item?.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=Img'}" class="w-24 h-24 rounded-lg object-cover border border-slate-600">
                        <div class="flex-grow">
                            <label class="text-xs text-slate-400 block mb-2">Ícone da Entidade</label>
                            <input type="file" id="f-img" accept="image/*" onchange="window.boTools.previewImage(this)" class="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700">
                        </div>
                    </div>
                ` : ''}

                ${specificHtml}

                <div class="flex gap-4 mt-8 pt-6 border-t border-slate-700">
                    <button type="submit" id="btn-save-bo" class="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors shadow-lg"><i class="fas fa-save mr-2"></i> Salvar Registro</button>
                    <button type="button" onclick="window.boTools.cancelEdit()" class="px-8 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors">Cancelar</button>
                </div>
            </form>
        </div>
    `;
}

function renderCheckboxGroup(title, name, cacheList, selectedIds) {
    return `
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <h4 class="text-sm font-bold text-amber-500 mb-3">${title}</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto custom-scroll pr-2">
                ${cacheList.map(c => `
                    <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white bg-slate-800 p-1.5 rounded border border-slate-600 hover:border-slate-400">
                        <input type="checkbox" name="${name}" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''} class="rounded bg-slate-900 border-slate-500 text-amber-500">
                        <span class="truncate">${escapeHTML(c.nome)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// UI DE BALANCEAMENTO (MATRIZ INTERATIVA)
// ------------------------------------------------------------------------------------
function renderBalanceamento() {
    const isHab = boState.subAbaBal === 'habilidades';
    
    return `
        <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 animate-fade-in h-[700px] flex flex-col">
            <header class="flex justify-between items-end mb-6 border-b border-slate-700 pb-4">
                <div>
                    <h2 class="text-2xl font-bold font-cinzel text-purple-400">Matriz de Balanceamento</h2>
                    <p class="text-xs text-slate-400 mt-1">Edição em lote rápida e perigosa.</p>
                </div>
                <div class="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                    <button onclick="window.boTools.switchBalAba('habilidades')" class="px-6 py-2 rounded-md font-bold text-sm transition-colors ${isHab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}">Habilidades</button>
                    <button onclick="window.boTools.switchBalAba('atributos')" class="px-6 py-2 rounded-md font-bold text-sm transition-colors ${!isHab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}">Atributos Base</button>
                </div>
            </header>

            <div class="flex-grow relative overflow-hidden flex flex-col bg-slate-900 rounded-xl border border-slate-700">
                <div class="flex justify-between items-center p-3 bg-slate-800 border-b border-slate-700">
                    <input type="text" id="bal-filter" placeholder="Filtrar nesta matriz..." onkeyup="window.boTools.filterMatriz()" class="w-1/3 bg-slate-900 border border-slate-600 px-3 py-1.5 rounded text-sm text-white outline-none focus:border-purple-500">
                    <button id="btn-save-bal" onclick="window.boTools.saveMatriz()" class="btn bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 px-4 rounded shadow-lg hidden">💾 Salvar Modificações</button>
                </div>
                
                <div class="flex-grow overflow-auto custom-scroll relative" id="matriz-container">
                    ${isHab ? generateHabMatriz() : generateAttrMatriz()}
                </div>
            </div>
        </div>
    `;
}

function generateHabMatriz() {
    const list = boState.cache.habilidades;
    return `
        <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 bg-slate-950 text-purple-400 z-10 shadow-md">
                <tr>
                    <th class="p-3 border-b border-r border-slate-700 min-w-[150px]">Nome da Magia</th>
                    <th class="p-3 border-b border-r border-slate-700 text-center w-20">MP</th>
                    <th class="p-3 border-b border-r border-slate-700 text-center w-20">AP (Aprender)</th>
                    <th class="p-3 border-b border-r border-slate-700 text-center w-20">Dano Base</th>
                    <th class="p-3 border-b border-slate-700 text-center w-20">Alvos</th>
                </tr>
            </thead>
            <tbody id="matriz-tbody">
                ${list.map(h => `
                    <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800 matriz-row" data-id="${h.id}" data-name="${h.nome.toLowerCase()}">
                        <td class="p-2 border-r border-slate-700 font-bold text-slate-300 truncate" title="${h.nome}">${escapeHTML(h.nome)}</td>
                        <td class="p-0 border-r border-slate-700"><input type="number" data-field="gastoMpUso" value="${h.gastoMpUso||0}" class="matriz-input w-full bg-transparent border-0 text-center text-white py-2 focus:bg-slate-700 outline-none"></td>
                        <td class="p-0 border-r border-slate-700"><input type="number" data-field="custoAprendizado" value="${h.custoAprendizado||0}" class="matriz-input w-full bg-transparent border-0 text-center text-white py-2 focus:bg-slate-700 outline-none"></td>
                        <td class="p-0 border-r border-slate-700"><input type="number" data-field="efeitoDanoBaseUsoHabilidade" value="${h.efeitoDanoBaseUsoHabilidade||0}" class="matriz-input w-full bg-transparent border-0 text-center text-white py-2 focus:bg-slate-700 outline-none"></td>
                        <td class="p-0"><input type="number" data-field="quantidadeAlvos" value="${h.quantidadeAlvos||1}" class="matriz-input w-full bg-transparent border-0 text-center text-white py-2 focus:bg-slate-700 outline-none"></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function generateAttrMatriz() {
    return `<div class="p-10 text-center text-slate-500 italic">Módulo de Intersecção de Atributos será ativado em futura atualização.</div>`;
}

function attachBalanceamentoListeners() {
    const inputs = document.querySelectorAll('.matriz-input');
    inputs.forEach(inp => {
        inp.addEventListener('input', (e) => {
            const tr = e.target.closest('tr');
            const id = tr.dataset.id;
            const field = e.target.dataset.field;
            const val = Number(e.target.value) || 0;

            if(!boState.edits[id]) boState.edits[id] = {};
            boState.edits[id][field] = val;

            e.target.classList.add('text-amber-400', 'font-bold', 'bg-amber-900/20');
            document.getElementById('btn-save-bal').classList.remove('hidden');
        });
    });
}

// ------------------------------------------------------------------------------------
// LISTENERS DE FORMULÁRIO (SALVAR)
// ------------------------------------------------------------------------------------
function attachFormListeners() {
    const form = document.getElementById('bo-main-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-bo');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processando...';
        btn.disabled = true;

        const id = document.getElementById('f-id').value;
        const oldImg = document.getElementById('f-oldImg').value;
        const tab = boState.activeTab;
        const collectionName = COLL_MAP[tab].c;

        const getVal = elId => document.getElementById(elId)?.value || '';
        const getNum = elId => Number(document.getElementById(elId)?.value) || 0;

        let payload = {
            nome: getVal('f-nome'),
            atualizadoEm: serverTimestamp()
        };

        if (tab === 'habilidades') {
            payload.tipoEfeitoHabildiade = getVal('f-tipoEf');
            payload.tipoAcaoHabildiade = getVal('f-tipoAc');
            payload.descricaoEfeito = getVal('f-desc');
            payload.gastoMpUso = getNum('f-mp');
            payload.efeitoDanoBaseUsoHabilidade = getNum('f-dano');
            payload.movimentacaoHabilidade = getNum('f-mov');
            payload.duracaoHabilidade = getVal('f-dur');
            payload.quantidadeAlvos = getNum('f-alvos');
            payload.custoAprendizado = getNum('f-ap');

            payload.restricaoClasses = Array.from(document.querySelectorAll('input[name="rpg_classes"]:checked')).map(cb => cb.value);
        } 
        else if (['racas', 'classes', 'subclasses'].includes(tab)) {
            const prefix = tab === 'racas' ? 'Raca' : (tab === 'classes' ? 'Classe' : 'Subclasse');
            payload[`bonusHp${prefix}Base`] = getNum('f-hp');
            payload[`bonusMp${prefix}Base`] = getNum('f-mp');
            payload[`bonusAtk${prefix}Base`] = getNum('f-atk');
            payload[`bonusDef${prefix}Base`] = getNum('f-def');
            payload[`bonusEva${prefix}Base`] = getNum('f-eva');
            
            if (tab !== 'racas') {
                payload.habilidadesDisponiveis = Array.from(document.querySelectorAll('input[name="rpg_habilidades"]:checked')).map(cb => cb.value);
            }
        }
        else if (tab === 'vantagens') {
            payload.descricao = getVal('f-desc');
            payload.anotacoesMestre = getVal('f-notas');
        }
        else {
            payload.descricao = getVal('f-desc');
        }

        // UPLOAD IMAGEM
        let finalUrl = oldImg;
        if (boState.pendingImage) {
            try {
                if (oldImg && oldImg.includes('firebasestorage')) {
                    try { await deleteObject(ref(storage, oldImg)); } catch(err){}
                }
                const blob = await compressImage(boState.pendingImage, 150, 150, 0.6); // Ícones
                const refName = `imagens_rpg/${tab}/${Date.now()}_icone.jpg`;
                const storageRef = ref(storage, refName);
                await uploadBytes(storageRef, blob);
                finalUrl = await getDownloadURL(storageRef);
            } catch(imgErr) {
                console.error(imgErr);
            }
        }
        if (finalUrl) payload.imagemUrl = finalUrl;

        try {
            if (id) {
                await updateDoc(doc(db, collectionName, id), payload);
            } else {
                payload.criadoEm = serverTimestamp();
                await setDoc(doc(collection(db, collectionName)), payload);
            }
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Matriz Gravada';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            setTimeout(() => {
                boState.selectedItem = null;
                boState.pendingImage = null;
                loadAllData(); // Recarrega tudo e volta à lista
            }, 1000);

        } catch (e) {
            console.error(e);
            alert("Erro: " + e.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    });
}

// ------------------------------------------------------------------------------------
// FUNÇÕES EXPOSTAS PARA O HTML (window.boTools)
// ------------------------------------------------------------------------------------
window.boTools = {
    setFilter: function(val) {
        boState.filter = val;
        renderActiveView();
    },
    newItem: function() {
        boState.selectedItem = null;
        boState.activeTab = 'new'; // Força o form vazio
        renderActiveView();
    },
    editItem: function(id) {
        const list = boState.cache[boState.activeTab];
        boState.selectedItem = list.find(i => i.id === id);
        renderActiveView();
    },
    cancelEdit: function() {
        boState.selectedItem = null;
        boState.pendingImage = null;
        if(boState.activeTab === 'new') boState.activeTab = document.querySelector('.bo-tab-btn.active').dataset.tab;
        renderActiveView();
    },
    previewImage: function(input) {
        if (input.files && input.files[0]) {
            boState.pendingImage = input.files[0];
            document.getElementById('bo-img-preview').src = URL.createObjectURL(input.files[0]);
        }
    },
    deleteItem: async function(tab, id, nome) {
        if (!confirm(`APAGAR PERMANENTEMENTE: ${nome}?\nIsso pode quebrar fichas que usam este registro!`)) return;
        try {
            await deleteDoc(doc(db, COLL_MAP[tab].c, id));
            alert("Registro obliterado.");
            loadAllData();
        } catch(e) { alert("Erro ao apagar: " + e.message); }
    },
    switchBalAba: function(aba) {
        boState.subAbaBal = aba;
        renderActiveView();
    },
    filterMatriz: function() {
        const term = document.getElementById('bal-filter').value.toLowerCase();
        document.querySelectorAll('.matriz-row').forEach(row => {
            if(row.dataset.name.includes(term)) row.style.display = '';
            else row.style.display = 'none';
        });
    },
    saveMatriz: async function() {
        const btn = document.getElementById('btn-save-bal');
        btn.innerHTML = 'Salvando...';
        btn.disabled = true;

        try {
            const batch = writeBatch(db);
            Object.entries(boState.edits).forEach(([id, fields]) => {
                const docRef = doc(db, 'rpg_habilidades', id);
                batch.update(docRef, { ...fields, atualizadoEm: serverTimestamp() });
            });
            await batch.commit();
            alert("Balanceamento aplicado em lote!");
            boState.edits = {};
            loadAllData();
        } catch(e) {
            alert("Falha no lote: " + e.message);
            btn.innerHTML = '💾 Salvar Modificações';
            btn.disabled = false;
        }
    }
};
import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';

const RECIPE_COLLECTION_NAME = 'rpg_itensCraftados';

let craftState = {
    activeTab: 'listagem', // 'listagem' ou 'cadastro'
    cache: { recipes: [], items: [], materials: [], professions: [], habilities: [] },
    selectedRecipeId: null,
    
    // Dados do Formulário Atual
    form: {
        itemId: '',
        profissaoId: '',
        profissaoLevel: 1,
        habilidadeId: '',
        itemFinalizadorId: '',
        expProducao: 100,
        chanceSucessoBase: 50,
        materialsMap: {} // { itemId: quantidade }
    },
    
    filterList: '',
    filterMat: ''
};

export async function renderCadastroCraftTab() {
    const container = document.getElementById('cadastro-craft-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="relative text-center mb-8 border-b border-slate-700 pb-8 w-full">
                <h1 class="text-4xl sm:text-5xl font-bold font-cinzel text-amber-600 tracking-widest drop-shadow-md"><i class="fas fa-hammer mr-3"></i> Engenharia de Receitas</h1>
                <p class="text-slate-400 mt-2 text-sm italic">Defina os componentes para a criação de artefatos</p>
            </header>

            <nav class="flex gap-2 mb-6 border-b border-slate-800 pb-px" id="craft-tabs-nav">
                <button class="craft-tab-btn active" data-tab="listagem">Listagem & Edição</button>
                <button class="craft-tab-btn" data-tab="cadastro">Nova Receita</button>
            </nav>

            <div id="craft-dynamic-content" class="w-full relative min-h-[400px]">
                <div id="craft-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-50 rounded-xl">
                    <div class="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-600 mb-4"></div>
                    <p class="text-amber-500 font-cinzel tracking-widest">Carregando Oficinas...</p>
                </div>
                <div id="craft-view" class="w-full hidden"></div>
            </div>

        </div>
    `;

    setupTabs();
    await loadAllData();
}

function setupTabs() {
    const nav = document.getElementById('craft-tabs-nav');
    if (!nav) return;

    const baseClasses = ['bg-slate-900', 'text-slate-400', 'border-t', 'border-x', 'border-slate-800', 'hover:bg-slate-800', 'rounded-t-lg', 'px-6', 'py-3', 'font-bold', 'text-sm', 'uppercase', 'tracking-widest', 'transition-colors', '-mb-px'];
    const activeClasses = ['bg-slate-800', 'text-amber-500', 'border-slate-700', 'border-b-0'];

    nav.querySelectorAll('.craft-tab-btn').forEach(btn => {
        btn.className = `craft-tab-btn ${baseClasses.join(' ')}`;
        if (btn.dataset.tab === craftState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
        }
    });

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.craft-tab-btn');
        if (btn) {
            craftState.activeTab = btn.dataset.tab;
            craftState.selectedRecipeId = null;
            resetForm();
            setupTabs(); // Re-render tabs styles
            renderActiveView();
        }
    });
}

async function loadAllData() {
    try {
        const [recipesSnap, itemsSnap, materialsSnap, profSnap, habSnap] = await Promise.all([
            getDocs(query(collection(db, RECIPE_COLLECTION_NAME), orderBy("nome"))),
            getDocs(collection(db, 'rpg_itensCadastrados')),
            getDocs(collection(db, 'rpg_itensMochila')),
            getDocs(query(collection(db, 'rpg_profissoes'), orderBy('nome'))),
            getDocs(query(collection(db, 'rpg_habilidades'), orderBy('nome')))
        ]);
        
        const itemsData = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const materialsData = materialsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        craftState.cache = {
            recipes: recipesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            items: [...itemsData, ...materialsData].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
            materials: materialsData.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
            professions: profSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            habilities: habSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        document.getElementById('craft-loading').classList.add('hidden');
        document.getElementById('craft-view').classList.remove('hidden');
        renderActiveView();

    } catch (e) {
        console.error(e);
        document.getElementById('craft-loading').innerHTML = '<p class="text-red-500 font-bold p-10">Erro fatal ao carregar Banco de Receitas.</p>';
    }
}

function resetForm() {
    craftState.form = {
        itemId: '', profissaoId: '', profissaoLevel: 1, habilidadeId: '',
        itemFinalizadorId: '', expProducao: 100, chanceSucessoBase: 50, materialsMap: {}
    };
    craftState.filterMat = '';
}

function populateFormFromRecipe(recipe) {
    if (!recipe) return resetForm();
    
    const matMap = {};
    (recipe.materiais || []).forEach(m => { matMap[m.itemId] = m.quantidade; });

    craftState.form = {
        itemId: recipe.itemId || '',
        profissaoId: recipe.profissaoId || '',
        profissaoLevel: recipe.profissaoLevel || 1,
        habilidadeId: recipe.habilidadeId || '',
        itemFinalizadorId: recipe.itemFinalizadorId || '',
        expProducao: recipe.expProducao || 100,
        chanceSucessoBase: recipe.chanceSucessoBase || 50,
        materialsMap: matMap
    };
}

// ------------------------------------------------------------------------------------
// ROUTER DE VIEWS
// ------------------------------------------------------------------------------------
function renderActiveView() {
    const view = document.getElementById('craft-view');
    if (!view) return;

    if (craftState.activeTab === 'listagem') {
        if (craftState.selectedRecipeId) {
            view.innerHTML = renderForm();
        } else {
            view.innerHTML = renderList();
        }
    } else if (craftState.activeTab === 'cadastro') {
        view.innerHTML = renderForm();
    }
}

// ------------------------------------------------------------------------------------
// UI DE LISTAGEM
// ------------------------------------------------------------------------------------
function renderList() {
    const term = craftState.filterList.toLowerCase();
    const filtered = craftState.cache.recipes.filter(r => (r.nome||'').toLowerCase().includes(term));

    let html = `
        <div class="bg-slate-800/40 p-6 rounded-2xl border border-slate-700 animate-fade-in rounded-tl-none">
            <div class="mb-6">
                <input type="text" placeholder="Buscar receita pelo nome do item..." value="${escapeHTML(craftState.filterList)}" onkeyup="window.craftTools.filterList(this.value)" class="w-full sm:w-1/2 bg-slate-900 border border-slate-600 px-4 py-3 rounded-xl text-white outline-none focus:border-amber-600">
            </div>
            
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-[600px] overflow-y-auto custom-scroll p-2">
    `;

    if (filtered.length === 0) {
        html += `<div class="col-span-full text-center py-10 text-slate-500 italic">Nenhuma receita catalogada.</div>`;
    } else {
        filtered.forEach(recipe => {
            const itemData = craftState.cache.items.find(i => i.id === recipe.itemId);
            const img = itemData?.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=X';
            
            html += `
                <div class="aspect-square bg-slate-900 rounded-xl border border-slate-700 relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-colors" onclick="window.craftTools.editRecipe('${recipe.id}')">
                    <img src="${img}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 w-full bg-black/80 text-white text-[9px] text-center p-1 truncate font-bold">${escapeHTML(recipe.nome)}</div>
                    <button onclick="event.stopPropagation(); window.craftTools.deleteRecipe('${recipe.id}', '${escapeHTML(recipe.nome)}')" class="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
    }

    html += `</div></div>`;
    return html;
}

// ------------------------------------------------------------------------------------
// UI DO FORMULÁRIO DE RECEITA (BANCADA)
// ------------------------------------------------------------------------------------
function renderForm() {
    const f = craftState.form;
    const isEdit = craftState.activeTab === 'listagem' && craftState.selectedRecipeId !== null;
    const title = isEdit ? `Editando Receita` : 'Forjar Nova Receita';
    const itemFinalData = craftState.cache.items.find(i => i.id === f.itemId);
    const imgFinal = itemFinalData?.imagemUrl || 'https://placehold.co/150x150/1e293b/a1a1aa?text=?';
    
    // MATERIAIS DISPONÍVEIS
    const termMat = craftState.filterMat.toLowerCase();
    const availableMats = craftState.cache.materials.filter(m => (m.nome||'').toLowerCase().includes(termMat));

    let availableHtml = availableMats.length === 0 ? '<p class="text-xs text-slate-500 text-center col-span-full">Nenhum encontrado.</p>' : availableMats.map(mat => {
        const isSel = f.materialsMap.hasOwnProperty(mat.id);
        return `
            <div onclick="window.craftTools.toggleMaterial('${mat.id}')" class="aspect-square bg-slate-900 rounded border cursor-pointer relative overflow-hidden group transition-all transform hover:scale-105 ${isSel ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] z-10' : 'border-slate-700 hover:border-slate-500'}">
                <img src="${mat.imagemUrl || ''}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100">
                <div class="absolute bottom-0 w-full bg-black/90 text-white text-[8px] text-center p-0.5 truncate">${escapeHTML(mat.nome)}</div>
            </div>
        `;
    }).join('');

    // MATERIAIS SELECIONADOS
    const selIds = Object.keys(f.materialsMap);
    let selectedHtml = selIds.length === 0 ? '<p class="text-xs text-slate-500 text-center col-span-full mt-4">Nenhum material na bancada.</p>' : selIds.map(id => {
        const mat = craftState.cache.materials.find(m => m.id === id);
        if(!mat) return '';
        const qtd = f.materialsMap[id];
        return `
            <div class="aspect-square bg-slate-900 rounded border border-green-600 relative overflow-hidden">
                <img src="${mat.imagemUrl || ''}" class="w-full h-full object-cover opacity-60">
                <button onclick="window.craftTools.toggleMaterial('${id}')" class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[8px] z-10 shadow-lg border border-white hover:bg-red-500"><i class="fas fa-times"></i></button>
                <div class="absolute bottom-0 w-full flex justify-center">
                    <input type="number" min="1" value="${qtd}" onchange="window.craftTools.updateMaterialQtd('${id}', this.value)" class="w-full text-center text-xs font-bold text-black bg-white/90 outline-none border-t border-slate-700">
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="bg-slate-800/40 p-6 rounded-2xl border border-slate-700 animate-fade-in ${isEdit ? '' : 'rounded-tl-none'}">
            
            <header class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h2 class="text-2xl font-bold font-cinzel text-amber-500">${title}</h2>
                ${isEdit ? `<button onclick="window.craftTools.closeEditor()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm transition-colors"><i class="fas fa-times mr-2"></i> Fechar Editor</button>` : ''}
            </header>

            <div class="space-y-8">
                <div class="bg-slate-900/50 p-6 rounded-xl border border-slate-600 shadow-inner grid grid-cols-1 lg:grid-cols-[1fr_auto_250px] gap-8 items-center">
                    
                    <div class="flex flex-col h-full">
                        <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">1. Materiais</label>
                        <input type="text" placeholder="Filtrar ingredientes..." value="${escapeHTML(craftState.filterMat)}" onkeyup="window.craftTools.filterMat(this.value)" class="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-white outline-none focus:border-amber-600 mb-3 text-sm">
                        
                        <div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 p-2 bg-slate-950 rounded-lg border border-slate-700 max-h-[140px] overflow-y-auto custom-scroll mb-4">
                            ${availableHtml}
                        </div>
                        
                        <label class="text-[10px] text-green-500 font-bold uppercase tracking-widest mb-2">Na Bancada (Qtd. Necessária)</label>
                        <div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 p-2 bg-green-950/20 rounded-lg border border-green-900/50 min-h-[80px] overflow-y-auto custom-scroll">
                            ${selectedHtml}
                        </div>
                    </div>

                    <div class="hidden lg:flex text-amber-600 text-4xl animate-pulse">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                    <div class="flex lg:hidden text-amber-600 text-4xl justify-center animate-pulse">
                        <i class="fas fa-arrow-down"></i>
                    </div>

                    <div class="flex flex-col items-center h-full justify-center">
                        <label class="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 text-center">2. Artefato Gerado</label>
                        <select onchange="window.craftTools.updateForm('itemId', this.value)" class="w-full bg-slate-950 border border-amber-600/50 p-2 rounded text-slate-200 outline-none focus:border-amber-500 mb-4 text-sm">
                            <option value="">-- Selecione o Item --</option>
                            ${craftState.cache.items.map(i => `<option value="${i.id}" ${f.itemId === i.id ? 'selected' : ''}>${escapeHTML(i.nome)}</option>`).join('')}
                        </select>
                        <div class="w-32 h-32 rounded-xl border-2 border-amber-500 bg-slate-900 relative overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            <img src="${imgFinal}" class="w-full h-full object-cover opacity-90">
                            <div class="absolute bottom-0 w-full bg-black/80 text-white text-[10px] text-center p-1 truncate font-bold">${escapeHTML(itemFinalData?.nome || '?')}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-slate-900/50 p-6 rounded-xl border border-slate-600 shadow-inner">
                    <h3 class="text-sm font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">3. Exigências de Forja</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">Profissão Exigida</label>
                            <select onchange="window.craftTools.updateForm('profissaoId', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500">
                                <option value="">Sem Profissão (Qualquer um)</option>
                                ${craftState.cache.professions.map(p => `<option value="${p.id}" ${f.profissaoId === p.id ? 'selected' : ''}>${escapeHTML(p.nome)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">Nível de Profissão</label>
                            <input type="number" min="1" value="${f.profissaoLevel}" onchange="window.craftTools.updateForm('profissaoLevel', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500">
                        </div>
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">Habilidade Extra (Opcional)</label>
                            <select onchange="window.craftTools.updateForm('habilidadeId', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500">
                                <option value="">Nenhuma</option>
                                ${craftState.cache.habilities.map(h => `<option value="${h.id}" ${f.habilidadeId === h.id ? 'selected' : ''}>${escapeHTML(h.nome)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">Item Finalizador (Catalisador)</label>
                            <select onchange="window.craftTools.updateForm('itemFinalizadorId', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500">
                                <option value="">Nenhum</option>
                                ${craftState.cache.materials.map(m => `<option value="${m.id}" ${f.itemFinalizadorId === m.id ? 'selected' : ''}>${escapeHTML(m.nome)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">EXP de Profissão Ganho</label>
                            <input type="number" value="${f.expProducao}" onchange="window.craftTools.updateForm('expProducao', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500 font-mono text-amber-500">
                        </div>
                        <div>
                            <label class="text-xs text-slate-400 block mb-1">Chance de Sucesso (%)</label>
                            <input type="number" min="0" max="100" value="${f.chanceSucessoBase}" onchange="window.craftTools.updateForm('chanceSucessoBase', this.value)" class="w-full bg-slate-950 border border-slate-700 p-2 rounded text-white outline-none focus:border-sky-500 font-mono text-emerald-400">
                        </div>
                    </div>
                </div>

                <div class="flex gap-4 pt-4">
                    <button id="btn-save-craft" onclick="window.craftTools.saveRecipe()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors uppercase tracking-widest shadow-lg flex items-center justify-center">
                        <i class="fas fa-save mr-2"></i> ${isEdit ? 'Salvar Modificações' : 'Gravar Receita no Sistema'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------------------------------
// AÇÕES EXPOSTAS NO WINDOW (CRAFT_TOOLS)
// ------------------------------------------------------------------------------------
window.craftTools = {
    filterList: (val) => { craftState.filterList = val; renderActiveView(); },
    filterMat: (val) => { craftState.filterMat = val; renderActiveView(); },
    
    updateForm: (field, val) => {
        craftState.form[field] = ['expProducao','chanceSucessoBase','profissaoLevel'].includes(field) ? Number(val) : val;
        if(field === 'itemId') renderActiveView(); // Força update da imagem
    },
    
    toggleMaterial: (id) => {
        if(craftState.form.materialsMap[id] !== undefined) {
            delete craftState.form.materialsMap[id];
        } else {
            craftState.form.materialsMap[id] = 1;
        }
        renderActiveView();
    },

    updateMaterialQtd: (id, val) => {
        craftState.form.materialsMap[id] = parseInt(val, 10) || 1;
    },

    editRecipe: (id) => {
        const recipe = craftState.cache.recipes.find(r => r.id === id);
        if(recipe) {
            craftState.selectedRecipeId = id;
            populateFormFromRecipe(recipe);
            renderActiveView();
        }
    },

    closeEditor: () => {
        craftState.selectedRecipeId = null;
        resetForm();
        renderActiveView();
    },

    deleteRecipe: async (id, nome) => {
        if(!confirm(`Apagar definitivamente a receita de "${nome}"?`)) return;
        try {
            await deleteDoc(doc(db, RECIPE_COLLECTION_NAME, id));
            alert("Receita deletada com sucesso.");
            await loadAllData();
        } catch(e) { alert("Erro ao apagar: " + e.message); }
    },

    saveRecipe: async () => {
        const f = craftState.form;
        if (!f.itemId) return alert("Você precisa escolher qual item esta receita irá gerar!");
        
        const matIds = Object.keys(f.materialsMap);
        if (matIds.length === 0) return alert("A bancada não pode estar vazia. Adicione materiais.");

        const btn = document.getElementById('btn-save-craft');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Forjando...';
        btn.disabled = true;

        const itemFinal = craftState.cache.items.find(i => i.id === f.itemId);
        const materiaisArray = matIds.map(id => ({ itemId: id, quantidade: f.materialsMap[id] }));

        const docId = craftState.selectedRecipeId || f.itemId; // O ID da receita é preferencialmente o ID do item gerado

        const payload = {
            itemId: f.itemId,
            nome: itemFinal.nome, // Cache do nome para buscas
            profissaoId: f.profissaoId,
            profissaoLevel: f.profissaoLevel,
            habilidadeId: f.habilidadeId,
            itemFinalizadorId: f.itemFinalizadorId,
            expProducao: f.expProducao,
            chanceSucessoBase: f.chanceSucessoBase,
            materiais: materiaisArray,
            atualizadoEm: serverTimestamp()
        };

        if(!craftState.selectedRecipeId) payload.criadoEm = serverTimestamp();

        try {
            await setDoc(doc(db, RECIPE_COLLECTION_NAME, docId), payload, { merge: true });
            
            btn.innerHTML = '<i class="fas fa-check mr-2"></i> Registrado!';
            btn.classList.replace('bg-emerald-600', 'bg-green-500');
            
            setTimeout(() => {
                if(craftState.activeTab === 'listagem') craftState.selectedRecipeId = null;
                else resetForm();
                
                loadAllData();
            }, 1000);

        } catch(e) {
            console.error(e);
            alert("Erro na forja: " + e.message);
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
};
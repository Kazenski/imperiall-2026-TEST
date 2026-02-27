import { db, doc, updateDoc, setDoc, deleteDoc, runTransaction, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, deleteObject } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { calculateMainStats, calculateDynamicAttributes, calculateWeightStats, getFomeDebuffMultiplier } from '../core/calculos.js';

// --- ABA 1: PAINEL ---
export function renderPainelFichas() {
    const container = document.getElementById('painel-fichas-content');
    if (!container) return;

    const adminHTML = globalState.isAdmin ? `
        <div class="bg-slate-900/50 p-4 rounded-md border border-slate-700 mb-6">
            <h3 class="text-xl font-semibold text-slate-300 mb-3">Painel do Mestre</h3>
            <div>
                <label for="admin-busca">Buscar ficha de qualquer jogador</label>
                <input type="text" id="admin-busca" placeholder="Digite o nome do personagem..." class="w-full bg-slate-800 border border-slate-600 rounded text-slate-200 px-3 py-2 focus:border-amber-500 outline-none">
            </div>
        </div>` : '';
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto animate-fade-in">
            <h2 class="font-cinzel text-2xl text-amber-500 border-b border-slate-700 pb-2 mb-6">Seu Painel de Fichas</h2>
            ${adminHTML}
            <h3 class="text-xl font-semibold text-slate-300 mb-3 mt-4 border-b border-slate-600 pb-1">Minhas Fichas</h3>
            <div id="character-list" class="space-y-3"><p>Carregando fichas...</p></div>
            <button id="btn-create-new" class="btn btn-green w-full mt-6 py-3 shadow-lg"><i class="fas fa-plus mr-2"></i> Criar Nova Ficha</button>
        </div>`;
    
    container.querySelector('#btn-create-new').addEventListener('click', () => renderFichaEditor(null));
    
    // Busca dinâmica para Admin
    if(globalState.isAdmin) {
        container.querySelector('#admin-busca').addEventListener('input', (e) => {
            renderListaPersonagens(container, e.target.value);
        });
    }

    renderListaPersonagens(container, '');
}

function renderListaPersonagens(container, filtro) {
    const listEl = container.querySelector('#character-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    const termo = filtro.toLowerCase();
    const source = globalState.isAdmin ? globalState.cache.all_personagens : globalState.cache.personagens;
    
    const filtered = [];
    source.forEach(char => {
        if(char.nome?.toLowerCase().includes(termo)) filtered.push(char);
    });

    if(filtered.length === 0) {
        listEl.innerHTML = '<p class="text-slate-400 italic py-4">Nenhum personagem encontrado.</p>';
        return;
    }

    filtered.sort((a,b)=>(a.nome||'').localeCompare(b.nome)).forEach(data => {
        const item = document.createElement('div');
        item.className = 'bg-slate-800/80 p-4 rounded-lg flex items-center justify-between space-x-2 border border-slate-600 hover:border-amber-500 hover:bg-slate-800 cursor-pointer transition-all shadow-md';
        const date = data.lastAccessed?.toDate ? data.lastAccessed.toDate().toLocaleDateString('pt-BR') : 'Nunca';
        const delBtn = globalState.isAdmin ? `<button class="btn btn-danger btn-delete-char py-2 px-3 text-sm flex items-center justify-center" data-id="${data.id}"><i class="fas fa-trash pointer-events-none"></i></button>` : '';

        item.innerHTML = `
            <div class="flex items-center gap-4 w-full">
                <div class="w-12 h-12 rounded-full border-2 border-slate-500 overflow-hidden bg-black shrink-0">
                    <img src="${(data.imagemPrincipal && data.imageUrls && data.imageUrls[data.imagemPrincipal]) ? data.imageUrls[data.imagemPrincipal] : PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow overflow-hidden">
                    <h4 class="text-lg font-bold text-amber-400 truncate">${data.nome || 'Sem Nome'}</h4>
                    <p class="text-slate-400 text-xs truncate">Jogador: ${data.jogador || '???'}</p>
                    <p class="text-slate-500 text-[10px] mt-1 font-mono">Modificado: ${date}</p>
                </div>
                ${delBtn}
            </div>`;
        
        item.addEventListener('click', e => {
            if(!e.target.closest('.btn-delete-char')) renderFichaEditor(data.id);
        });
        
        if(globalState.isAdmin) {
            item.querySelector('.btn-delete-char')?.addEventListener('click', e => {
                e.stopPropagation();
                if(confirm(`Excluir permanentemente ${data.nome}? Isso não pode ser desfeito.`)) {
                    deleteDoc(doc(db,"rpg_fichas",data.id)).then(() => {
                        globalState.cache.personagens.delete(data.id);
                        globalState.cache.all_personagens.delete(data.id);
                        renderPainelFichas();
                        // Se excluiu o ativo, reseta
                        if (globalState.selectedCharacterId === data.id) {
                            const sel = document.getElementById('character-select');
                            if(sel) sel.value = "";
                            if(window.handleCharacterSelect) window.handleCharacterSelect("");
                        }
                    });
                }
            });
        }
        listEl.appendChild(item);
    });
}

async function renderFichaEditor(fichaId) {
    const container = document.getElementById('painel-fichas-content');
    if(!container) return;
    
    // 1. DETECTAR ABA ATIVA ANTES DO RENDER (Persistência)
    let activeBottomTab = 'historia'; 
    const currentActiveBtn = container.querySelector('.bottom-tab-btn.active');
    if (currentActiveBtn) {
        if (currentActiveBtn.textContent.toLowerCase().includes('anotações')) activeBottomTab = 'anotacoes';
        else if (currentActiveBtn.textContent.toLowerCase().includes('objetivos')) activeBottomTab = 'objetivos';
    }

    container.innerHTML = `<div class="flex justify-center items-center h-64"><div class="animate-spin rounded-full h-16 w-16 border-t-4 border-amber-500"></div></div>`;
    
    globalState.painelFichas.pontos = { disponiveis: 0, baseAtk: 0, baseDef: 0, baseEva: 0, tempAtk: 0, tempDef: 0, tempEva: 0 };
    globalState.painelFichas.bonusBase = { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 };

    let fichaData = {};
    let fullData = { bonusItens: { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 } };

    if (fichaId) {
        // Assume-se que gatherAllCharacterData estará no main.js e acessível globalmente
        if(window.gatherAllCharacterData) {
            fullData = await window.gatherAllCharacterData(fichaId);
            fichaData = fullData.ficha;
        }
    }

    const inputClass = "std-height w-full bg-slate-800 border border-slate-600 rounded text-slate-200 px-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition outline-none text-base font-medium";

    container.innerHTML = `
        <div class="bg-slate-800/90 p-4 sm:p-6 rounded-lg border border-slate-700 shadow-2xl max-w-7xl mx-auto animate-fade-in">
            
            <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-800 mb-4 shadow-inner">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div class="md:col-span-4 space-y-1">
                        <label class="text-xs text-slate-500 font-bold uppercase">Nome</label>
                        <input type="text" id="editor-nome" class="${inputClass}">
                    </div>
                    <div class="md:col-span-3 space-y-1">
                        <label class="text-xs text-slate-500 font-bold uppercase">Raça</label>
                        <select id="editor-racaId" class="${inputClass} appearance-none"></select>
                    </div>
                    <div class="md:col-span-3 space-y-1">
                        <label class="text-xs text-slate-500 font-bold uppercase">Classe</label>
                        <select id="editor-classeId" class="${inputClass} appearance-none"></select>
                    </div>
                    <div class="md:col-span-2 space-y-1">
                        <label class="text-xs text-slate-500 font-bold uppercase">XP Total</label>
                        <input type="number" id="editor-experiencia" class="${inputClass} text-center font-bold text-amber-400">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-center shadow-inner">
                <div><label class="text-sky-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">Nível</label><input type="text" id="view-level" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
                <div><label class="text-emerald-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">HP Max</label><input type="text" id="view-hp" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
                <div><label class="text-blue-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">MP Max</label><input type="text" id="view-mp" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
                <div><label class="text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">Iniciativa</label><input type="text" id="view-iniciativa" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
                <div><label class="text-purple-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">Movimento</label><input type="text" id="view-movimento" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
                <div><label class="text-rose-500 text-[10px] uppercase font-bold tracking-wider mb-1 block">AP</label><input type="text" id="view-ap" class="w-full bg-transparent border-none text-white text-2xl font-cinzel font-bold p-0 text-center focus:ring-0" disabled></div>
            </div>

            <div class="bg-slate-900/30 p-4 rounded-lg border border-slate-800 mb-6 hidden" id="extra-fields">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label class="text-slate-500 text-xs font-bold uppercase mb-1 block">Jogador</label><input type="text" id="editor-jogador" class="${inputClass}"></div>
                    <div><label class="text-slate-500 text-xs font-bold uppercase mb-1 block">Subclasse</label><select id="editor-subclasseId" class="${inputClass} appearance-none"></select></div>
                    <div><label class="text-slate-500 text-xs font-bold uppercase mb-1 block">Pontos Extras (Mestre)</label><input type="number" id="editor-pontosExtrasMestre" class="${inputClass}"></div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                <div class="lg:col-span-5 flex flex-col gap-4">
                    <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-700 shadow-lg">
                        <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                            <span class="text-xs text-slate-400 uppercase tracking-widest font-bold">PONTOS DISPONÍVEIS</span>
                            <div id="pontos-disponiveis" class="text-3xl font-bold text-emerald-400 font-cinzel">0</div>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            ${['atk','def','eva'].map(stat => `
                            <div class="bg-slate-950/50 rounded-lg p-2 border border-slate-800 flex flex-col shadow-inner">
                                <h4 class="font-bold text-slate-400 text-center text-[10px] uppercase mb-1 tracking-wider">${stat}</h4>
                                <div class="bg-slate-900 border-t border-slate-800 pt-1 mb-2 text-center rounded-t">
                                    <div id="display-total-${stat}" class="text-2xl font-bold text-amber-400 font-cinzel drop-shadow-sm">0</div>
                                </div>
                                
                                <div class="flex justify-between items-center bg-slate-900 px-1 rounded py-1 mb-2 border border-slate-800 select-none">
                                    <button id="btn-${stat}-menos" class="w-8 h-8 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center font-bold text-lg shadow transition active:scale-95"
                                        title="Clique: -1 | Shift: -10 | Ctrl: -50 (Até a base)">
                                        -
                                    </button>
                                    <span id="display-${stat}" class="font-bold text-white text-lg mx-2 w-12 text-center">0</span>
                                    <button id="btn-${stat}-mais" class="w-8 h-8 rounded bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow transition active:scale-95"
                                        title="Clique: +1 | Shift: +10 | Ctrl: +50 (Até o limite)">
                                        +
                                    </button>
                                </div>

                                <div class="space-y-1 text-[9px] text-slate-500 font-mono px-1">
                                    <div class="flex justify-between"><span>Base:</span><span id="detail-${stat}-base" class="text-slate-400">0</span></div>
                                    <div class="flex justify-between"><span>Equip:</span><span id="detail-${stat}-equip" class="text-sky-400">0</span></div>
                                    <div class="flex justify-between"><span>Const:</span><span id="detail-${stat}-const" class="text-purple-400">0</span></div>
                                    <div class="flex justify-between"><span>Ego:</span><span id="detail-${stat}-ego" class="text-pink-400">0</span></div>
                                </div>
                            </div>`
                        ).join('')}
                        </div>
                    </div>
                    <div class="bg-slate-900/30 p-4 rounded-lg border border-slate-800 flex-grow">
                        <h4 class="text-xs text-slate-400 uppercase mb-3 font-bold flex items-center gap-2"><i class="fas fa-images"></i> Galeria</h4>
                        <div id="image-upload-grid" class="grid grid-cols-4 gap-2"></div>
                    </div>
                </div>

                <div class="lg:col-span-7">
                    <div class="main-image-container w-full bg-black rounded-xl border-2 border-slate-700 overflow-hidden relative group shadow-2xl h-[600px]"> 
                        
                        <div id="main-image-placeholder-icon" class="placeholder-icon-container ${fichaData.imagemPrincipal ? 'hidden' : ''} flex flex-col items-center justify-center h-full text-slate-600">
                            <i class="fas fa-image text-6xl mb-2 opacity-50"></i>
                            <span class="font-cinzel text-lg opacity-50">Sem Imagem Principal</span>
                        </div>
                        <img id="main-image-display" src="" class="hidden w-full h-full object-cover transition duration-700 group-hover:scale-105">
                        <div class="absolute inset-0 border-[1px] border-white/5 pointer-events-none rounded-t-xl z-10"></div>

                        <div class="xp-container absolute bottom-0 left-0 w-full z-30 !mt-0 !border-t border-slate-700 !rounded-none" id="xp-bar-container" title="Experiência">
                            <div class="xp-label-badge">XP</div>
                            <div class="xp-track">
                                <div id="xp-bar-fill" class="xp-fill"></div>
                                <div id="xp-bar-text" class="xp-text font-mono">0 / 0</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div class="mt-8">
                <div class="flex border-b border-slate-700 mb-0">
                    <button class="bottom-tab-btn active" onclick="window.switchBottomTab('historia')">História</button>
                    <button class="bottom-tab-btn" onclick="window.switchBottomTab('anotacoes')">Anotações & Inventário</button>
                    <button class="bottom-tab-btn flex items-center gap-2" onclick="window.switchBottomTab('objetivos')">
                        <i class="fas fa-bullseye text-amber-500"></i> Objetivos
                    </button>
                </div>
                
                <div class="bg-slate-900/50 border border-slate-700 border-t-0 p-6 rounded-b-lg shadow-inner">
                    <div id="tab-bottom-historia" class="bottom-tab-content animate-fade-in">
                        <textarea id="editor-historia" rows="15" class="w-full bg-slate-800 border border-slate-600 rounded p-3 text-slate-300 text-sm leading-relaxed resize-none focus:border-amber-500 transition focus:outline-none placeholder-slate-600" placeholder="Escreva a história do seu personagem..."></textarea>
                    </div>

                    <div id="tab-bottom-anotacoes" class="bottom-tab-content hidden animate-fade-in">
                        <textarea id="editor-anotacoes" rows="15" class="w-full bg-slate-800 border border-slate-600 rounded p-3 text-slate-300 text-sm leading-relaxed resize-none focus:border-amber-500 transition focus:outline-none placeholder-slate-600" placeholder="Inventário extra, anotações de campanha, etc..."></textarea>
                    </div>

                    <div id="tab-bottom-objetivos" class="bottom-tab-content hidden animate-fade-in">
                        <div id="objectives-root"></div>
                    </div>
                </div>
            </div>
            <div class="flex gap-4 pt-6 border-t border-slate-700 mt-6">
                <button id="btn-voltar-painel" class="btn bg-slate-800 hover:bg-slate-700 text-slate-300 w-1/3 py-3 font-bold uppercase tracking-wider border border-slate-600 transition">Voltar</button>
                <button id="btn-salvar-ficha" class="btn bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white w-2/3 py-3 font-bold uppercase tracking-widest shadow-lg transform hover:-translate-y-1 transition"><i class="fas fa-save mr-2"></i> Salvar Alterações</button>
            </div>
        </div>`;

    // PREENCHIMENTO DOS DADOS
    const populate = (id, map) => { 
        const sel = container.querySelector('#'+id); 
        [...map.values()].sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(d => sel.add(new Option(d.nome, d.id))); 
        sel.value = fichaData[id.replace('editor-','')] || ''; 
    };
    
    populate('editor-racaId', globalState.cache.racas); 
    populate('editor-classeId', globalState.cache.classes); 
    populate('editor-subclasseId', globalState.cache.subclasses);
    
    const getEl = id => container.querySelector('#'+id);
    getEl('editor-jogador').value = fichaData.jogador || '';
    getEl('editor-nome').value = fichaData.nome || '';
    getEl('editor-experiencia').value = fichaData.experienciapersonagemBase || 0;
    getEl('editor-pontosExtrasMestre').value = fichaData.pontosExtrasMestre || 0;
    getEl('editor-historia').value = fichaData.historia || '';
    getEl('editor-anotacoes').value = fichaData.anotacoes || '';
    
    setupImageGallery(container, fichaData.imageUrls || {}, fichaData.imagemPrincipal);
    
    const areaCamposExtras = container.querySelector('#extra-fields');
    if(areaCamposExtras) areaCamposExtras.classList.remove('hidden');

    // BLOQUEIO DE EDIÇÃO DO MESTRE
    const fichaJaExiste = !!fichaId;
    const usuarioEhJogador = !globalState.isAdmin;
    const bloquearGeral = fichaJaExiste && usuarioEhJogador;
    const bloquearApenasMestre = usuarioEhJogador; 

    ['editor-nome', 'editor-racaId', 'editor-classeId', 'editor-jogador'].forEach(id => {
        const el = container.querySelector('#' + id);
        if(el) {
            el.disabled = bloquearGeral;
            if(bloquearGeral) el.classList.add('opacity-60', 'cursor-not-allowed');
        }
    });

    ['editor-subclasseId', 'editor-pontosExtrasMestre'].forEach(id => {
        const el = container.querySelector('#' + id);
        if(el) {
            el.disabled = bloquearApenasMestre;
            if(bloquearApenasMestre) {
                el.classList.add('opacity-60', 'cursor-not-allowed');
                el.title = "Apenas o Mestre pode alterar este campo.";
            }
        }
    });

    const elXP = container.querySelector('#editor-experiencia');
    if(elXP) elXP.disabled = usuarioEhJogador;

    // LISTENERS DE BOTÃO
    getEl('btn-salvar-ficha').addEventListener('click', () => salvarFicha(fichaId, container));
    getEl('btn-voltar-painel').addEventListener('click', renderPainelFichas);
    
    ['editor-racaId','editor-classeId','editor-experiencia'].forEach(id => getEl(id).addEventListener('change', () => recalculateEditor(container, fichaData, fullData)));
    
    ['atk','def','eva'].forEach(stat => {
        const btnMais = container.querySelector(`#btn-${stat}-mais`);
        const btnMenos = container.querySelector(`#btn-${stat}-menos`);

        if (btnMais) {
            btnMais.onclick = (e) => changePoints(stat, 1, container, e);
        }
        if (btnMenos) {
            btnMenos.onclick = (e) => changePoints(stat, -1, container, e);
        }
    });

    if (fichaId) {
        renderObjectivesManager(fichaData);
        switchBottomTab(activeBottomTab); 
    } else {
        document.getElementById('objectives-root').innerHTML = '<p class="text-slate-500 italic">Salve a ficha primeiro para adicionar objetivos.</p>';
    }

    await recalculateEditor(container, fichaData, fullData);
}

// Lógica de Abas Inferiores
window.switchBottomTab = function(tabName) {
    const container = document.getElementById('painel-fichas-content');
    if(!container) return;

    const btns = container.querySelectorAll('.bottom-tab-btn');
    btns.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName === 'anotacoes' ? 'anotações' : (tabName === 'historia' ? 'história' : 'objetivos'))) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    container.querySelectorAll('.bottom-tab-content').forEach(el => el.classList.add('hidden'));
    const target = container.querySelector(`#tab-bottom-${tabName}`);
    if(target) target.classList.remove('hidden');
};

function setupImageGallery(container, urls, mainKey) {
    const grid = container.querySelector('#image-upload-grid');
    const mainDisplay = container.querySelector('#main-image-display');
    const placeholderIcon = container.querySelector('#main-image-placeholder-icon');
    
    const updateMainDisplay = (src) => {
        if (src && src !== '' && src !== PLACEHOLDER_IMAGE_URL) {
            mainDisplay.src = src;
            mainDisplay.classList.remove('hidden');
            placeholderIcon.classList.add('hidden');
        } else {
            mainDisplay.src = '';
            mainDisplay.classList.add('hidden');
            placeholderIcon.classList.remove('hidden');
        }
    };

    const initialUrl = (mainKey && urls[mainKey]) ? urls[mainKey] : null;
    updateMainDisplay(initialUrl);

    grid.innerHTML = '';
    
    for (let i = 1; i <= 12; i++) {
        const key = `imagem${i}`;
        const rawUrl = urls[key];
        
        const hasImage = rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('http') || rawUrl.startsWith('blob:'));
        const imageUrl = hasImage ? rawUrl : '';
        const isMain = (mainKey === key);
        
        const slot = document.createElement('div');
        
        let classes = 'upload-slot ';
        if (isMain) classes += 'is-main ';
        classes += hasImage ? 'has-image' : 'empty';

        slot.className = classes;
        if(isMain) slot.dataset.isMain = "true";

        slot.innerHTML = `
            <button type="button" class="star-btn" title="Definir como Principal">
                <i class="fas fa-star"></i>
            </button>
            
            <div class="slot-view w-full h-full pointer-events-none relative flex items-center justify-center overflow-hidden rounded-xl">
                <img src="${imageUrl}" class="user-img ${hasImage ? '' : 'hidden'} w-full h-full object-cover">
                
                <div class="slot-placeholder ${hasImage ? 'hidden' : 'flex'} w-full h-full items-center justify-center bg-slate-800">
                     <img src="${PLACEHOLDER_IMAGE_URL}" class="w-8 h-8 opacity-50 object-contain">
                </div>
            </div>
            
            <input type="file" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" title="${hasImage ? 'Alterar imagem' : 'Adicionar imagem'}">
        `;
        
        grid.appendChild(slot);

        const input = slot.querySelector('input');
        const userImg = slot.querySelector('.user-img');
        const placeholderDiv = slot.querySelector('.slot-placeholder');
        const starBtn = slot.querySelector('.star-btn');

        userImg.onerror = () => {
            userImg.classList.add('hidden'); 
            userImg.src = ''; 
            placeholderDiv.classList.remove('hidden'); 
            placeholderDiv.classList.add('flex');
            slot.classList.remove('has-image'); 
            slot.classList.add('empty'); 
        };

        input.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const blobUrl = URL.createObjectURL(file);
                
                userImg.src = blobUrl;
                userImg.classList.remove('hidden');
                placeholderDiv.classList.remove('flex');
                placeholderDiv.classList.add('hidden');
                
                slot.classList.remove('empty');
                slot.classList.add('has-image');
                
                if (slot.dataset.isMain === "true") updateMainDisplay(blobUrl);
                
                if (!grid.querySelector('.is-main')) starBtn.click();
            }
        });

        starBtn.addEventListener('click', e => {
            e.stopPropagation(); e.preventDefault();
            grid.querySelectorAll('.upload-slot').forEach(s => {
                s.classList.remove('is-main');
                delete s.dataset.isMain;
            });
            slot.classList.add('is-main');
            slot.dataset.isMain = "true";

            if (!userImg.classList.contains('hidden') && userImg.src) {
                updateMainDisplay(userImg.src);
            } else {
                updateMainDisplay(null);
            }
        });
    }
}

function changePoints(stat, direction, container, event) {
    const p = globalState.painelFichas.pontos;
    const capKey = stat.charAt(0).toUpperCase() + stat.slice(1);
    const tempKey = `temp${capKey}`; 
    const baseKey = `base${capKey}`; 

    let amount = 1;
    if (event) {
        if (event.ctrlKey || event.metaKey) amount = 50; 
        else if (event.shiftKey) amount = 10;            
    }

    const currentVal = p[tempKey];

    if (direction > 0) {
        if (p.disponiveis <= 0) return;
        const actualAdd = Math.min(amount, p.disponiveis);
        p[tempKey] += actualAdd;
        p.disponiveis -= actualAdd;
    } 
    else {
        const distanceToBase = currentVal - p[baseKey];
        if (distanceToBase <= 0) return; 
        const actualRemove = Math.min(amount, distanceToBase);
        p[tempKey] -= actualRemove;
        p.disponiveis += actualRemove;
    }
    updateEditorUI(container);
}

async function recalculateEditor(container, originalFicha, fullData) {
    const getElVal = id => container.querySelector('#'+id).value;
    const fakeFicha = { 
        ...originalFicha, 
        racaId: getElVal('editor-racaId'), 
        classeId: getElVal('editor-classeId'), 
        subclasseId: getElVal('editor-subclasseId'), 
        experienciapersonagemBase: Number(getElVal('editor-experiencia')) 
    };
    
    const simulado = {
        ficha: fakeFicha,
        raca: globalState.cache.racas.get(fakeFicha.racaId)||{},
        classe: globalState.cache.classes.get(fakeFicha.classeId)||{},
        subclasse: globalState.cache.subclasses.get(fakeFicha.subclasseId)||{},
        bonusItens: fullData.bonusItens,
        constellationTemplate: fullData.constellationTemplate
    };

    const stats = calculateMainStats(simulado, {atk:0,def:0,eva:0});
    
    container.querySelector('#view-level').value = stats.level;
    container.querySelector('#view-hp').value = stats.hpMax;
    container.querySelector('#view-mp').value = stats.mpMax;
    container.querySelector('#view-iniciativa').value = stats.iniciativa;
    container.querySelector('#view-ap').value = stats.ap;
    
    const movEl = container.querySelector('#view-movimento');
    movEl.value = Math.max(0, stats.movimento - stats.weightPenalty); 
    
    if (stats.weightPenalty > 0) {
        movEl.classList.remove('text-white');
        movEl.classList.add('text-red-500', 'font-bold');
        movEl.title = `Sobrecarga! Penalidade de Peso: -${stats.weightPenalty}`;
    } else {
        movEl.classList.remove('text-red-500', 'font-bold');
        movEl.classList.add('text-white');
        movEl.title = '';
    }
    
    const p = globalState.painelFichas.pontos;
    p.breakdowns = stats.breakdowns; 

    const extra = Number(getElVal('editor-pontosExtrasMestre') || originalFicha.pontosExtrasMestre || 0);
    const totalPoints = ((stats.level - 1) * 3) + extra;
    
    if(p.tempAtk === 0 && p.tempDef === 0 && p.tempEva === 0 && originalFicha.pontosDistribuidosAtk !== undefined) {
        p.tempAtk = originalFicha.pontosDistribuidosAtk || 0;
        p.tempDef = originalFicha.pontosDistribuidosDef || 0;
        p.tempEva = originalFicha.pontosDistribuidosEva || 0;
    }
    
    const gastos = p.tempAtk + p.tempDef + p.tempEva;
    p.disponiveis = Math.max(0, totalPoints - gastos);
    
    updateEditorUI(container);
}

function updateEditorUI(container) {
    const p = globalState.painelFichas.pontos;
    const bd = p.breakdowns; 

    const dispEl = container.querySelector('#pontos-disponiveis');
    dispEl.textContent = p.disponiveis;
    if(p.disponiveis === 0) dispEl.classList.add('text-slate-600'); else dispEl.classList.remove('text-slate-600');

    ['atk','def','eva'].forEach(stat => {
        const capKey = stat.charAt(0).toUpperCase() + stat.slice(1);
        const tempVal = p[`temp${capKey}`]; 
        const statBd = bd[stat]; 

        container.querySelector(`#detail-${stat}-base`).textContent = statBd.base;
        container.querySelector(`#detail-${stat}-equip`).textContent = statBd.equip;
        container.querySelector(`#detail-${stat}-const`).textContent = statBd.const;
        
        const elEgo = container.querySelector(`#detail-${stat}-ego`);
        if(elEgo) elEgo.textContent = statBd.ego || 0; 
        
        container.querySelector(`#display-${stat}`).textContent = tempVal;
        
        let total = statBd.base + statBd.equip + statBd.const + tempVal + (statBd.ego || 0);

        const charFicha = globalState.selectedCharacterData.ficha;
        const debuffFome = getFomeDebuffMultiplier(charFicha);
        total = Math.floor(total * debuffFome);

        const displayTotalEl = container.querySelector(`#display-total-${stat}`);
        displayTotalEl.textContent = total;

        if (debuffFome < 1) {
            displayTotalEl.classList.remove('text-amber-400');
            displayTotalEl.classList.add('text-red-500');
        } else {
            displayTotalEl.classList.remove('text-red-500');
            displayTotalEl.classList.add('text-amber-400');
        }
        
        const btnMais = container.querySelector(`#btn-${stat}-mais`);
        const btnMenos = container.querySelector(`#btn-${stat}-menos`);
        if(btnMais) { btnMais.disabled = (p.disponiveis <= 0); btnMais.classList.toggle('opacity-50', p.disponiveis <= 0); }
        if(btnMenos) { btnMenos.disabled = (tempVal <= 0); btnMenos.classList.toggle('opacity-50', tempVal <= 0); }
    });

    const xpInput = container.querySelector('#editor-experiencia');
    const currentXp = Number(xpInput.value) || 0;
    const tabela = globalState.cache.tabela_xp;
    
    if (tabela && tabela.niveis) {
        const levels = Object.keys(tabela.niveis).map(Number).sort((a,b)=>a-b);
        let currentLevel = 1;
        let xpFloor = 0;        
        let xpCeiling = 1000;   
        let isMaxLevel = false;

        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const reqProximo = tabela.niveis[lvl].experienciaParaProximoNivel;
            
            if (currentXp < reqProximo) {
                currentLevel = lvl;
                xpFloor = (i === 0) ? 0 : tabela.niveis[levels[i-1]].experienciaParaProximoNivel;
                xpCeiling = reqProximo;
                break;
            }
            
            if (i === levels.length - 1) {
                currentLevel = lvl; 
                isMaxLevel = true;
            }
        }

        const xpTextElement = container.querySelector('#xp-bar-text');
        const xpFillElement = container.querySelector('#xp-bar-fill');
        const xpContainer = container.querySelector('#xp-bar-container'); 

        if (isMaxLevel) {
            if(xpTextElement) xpTextElement.textContent = `Nível ${currentLevel} (Máx)`;
            if(xpFillElement) xpFillElement.style.width = "100%";
        } else {
            const xpRelativo = currentXp - xpFloor;
            const xpNecessario = xpCeiling - xpFloor;
            const pct = Math.min(100, Math.max(0, (xpRelativo / xpNecessario) * 100));
            
            if(xpTextElement) xpTextElement.textContent = `Nível ${currentLevel}`;
            if(xpFillElement) xpFillElement.style.width = `${pct}%`;
            if(xpContainer) xpContainer.title = `XP Atual: ${currentXp}\nProgresso do Nível: ${xpRelativo} / ${xpNecessario} (${pct.toFixed(1)}%)`;
        }
    }
}

async function salvarFicha(id, container) {
    const user = globalState.currentUser;
    if(!user) return;
    
    const getVal = i => container.querySelector('#'+i).value;
    const fichaOriginal = id ? globalState.cache.all_personagens.get(id) : {};
    
    const urls = {};
    const slots = container.querySelectorAll('.upload-slot');
    let mainKey = null;

    for(let i=0; i<slots.length; i++) {
        const idx = i+1;
        const file = slots[i].querySelector('input').files[0];
        const key = `imagem${idx}`;
        if(slots[i].dataset.isMain === "true") mainKey = key;

        if(file) {
            try {
                if(window.compressImage) {
                    const compressedBlob = await window.compressImage(file, 800, 800, 0.7);
                    if (fichaOriginal.imageUrls && fichaOriginal.imageUrls[key]) {
                        const oldUrl = fichaOriginal.imageUrls[key];
                        if (oldUrl.includes('firebasestorage')) {
                            try {
                                await deleteObject(ref(storage, oldUrl));
                                console.log(`[Otimização] Imagem antiga (${key}) deletada.`);
                            } catch(err) {
                                console.warn(`Aviso: Não foi possível deletar a imagem antiga (${key}).`);
                            }
                        }
                    }
                    const refImg = ref(storage, `imagens_rpg/${id||'temp'}/${key}_${Date.now()}.jpg`);
                    urls[key] = await getDownloadURL((await uploadBytes(refImg, compressedBlob)).ref);
                }
            } catch (imgError) {
                console.error("Erro ao processar imagem:", imgError);
                alert(`Erro ao fazer upload da ${key}. A imagem antiga será mantida.`);
                urls[key] = fichaOriginal.imageUrls?.[key] || "";
            }
        } else {
            const prevSrc = slots[i].querySelector('img')?.src;
            if(prevSrc && !prevSrc.startsWith('blob:') && !prevSrc.includes('placeholder')) urls[key] = prevSrc;
        }
    }

    const fakeFicha = { 
        ...fichaOriginal,
        racaId: getVal('editor-racaId'), 
        classeId: getVal('editor-classeId'), 
        subclasseId: getVal('editor-subclasseId'), 
        experienciapersonagemBase: Number(getVal('editor-experiencia')), 
    };

    let bonusItens = { hpMax:0, mpMax:0, iniciativa:0, movimento:0, apMax:0, atk:0, def:0, eva:0 };
    let constellationTemplate = null;

    if (id && window.gatherAllCharacterData) {
        try {
            const fullData = await window.gatherAllCharacterData(id);
            bonusItens = fullData.bonusItens;
            constellationTemplate = fullData.constellationTemplate;
        } catch (e) {
            console.warn("Ficha nova ou erro ao buscar dados extras:", e);
        }
    }
    
    const stats = calculateMainStats({
        ficha: fakeFicha,
        raca: globalState.cache.racas.get(fakeFicha.racaId)||{},
        classe: globalState.cache.classes.get(fakeFicha.classeId)||{},
        subclasse: globalState.cache.subclasses.get(fakeFicha.subclasseId)||{},
        bonusItens: bonusItens,
        constellationTemplate: constellationTemplate
    }, { 
        atk: globalState.painelFichas.pontos.tempAtk, 
        def: globalState.painelFichas.pontos.tempDef, 
        eva: globalState.painelFichas.pontos.tempEva 
    });

    const oldMaxAP = Number(fichaOriginal.apMaxPersonagemBase || 0);
    const oldCurrentAP = (fichaOriginal.apPersonagemBase !== undefined) ? Number(fichaOriginal.apPersonagemBase) : oldMaxAP;
    const newMaxAP = Number(stats.ap);
    let finalCurrentAP = newMaxAP; 

    if (id) { 
        const diff = newMaxAP - oldMaxAP; 
        finalCurrentAP = Math.max(0, oldCurrentAP + diff);
    }

    const racaFinal = globalState.cache.racas.get(fakeFicha.racaId) || {};
    const classeFinal = globalState.cache.classes.get(fakeFicha.classeId) || {};
    const subclasseFinal = globalState.cache.subclasses.get(fakeFicha.subclasseId) || {};
    
    const novosAtributosDinamicos = calculateDynamicAttributes(fichaOriginal, racaFinal, classeFinal, subclasseFinal);

    const hpShieldMult = Number(novosAtributosDinamicos.defesaCorporalNativaTotal) || 0;
    const hpExtraMult  = Number(novosAtributosDinamicos.pontosHPExtraTotal) || 0;
    const mpShieldMult = Number(novosAtributosDinamicos.defesaMagicaNativaTotal) || 0;
    const mpExtraMult  = Number(novosAtributosDinamicos.pontosMPExtraTotal) || 0;

    const hpShieldMax = Math.floor(stats.hpMax * hpShieldMult);
    const hpExtraMax  = Math.floor(stats.hpMax * hpExtraMult);
    const mpShieldMax = Math.floor(stats.mpMax * mpShieldMult);
    const mpExtraMax  = Math.floor(stats.mpMax * mpExtraMult);

    novosAtributosDinamicos.defesaCorporalNativaTotal = hpShieldMax;
    novosAtributosDinamicos.pontosHPExtraTotal = hpExtraMax;
    novosAtributosDinamicos.defesaMagicaNativaTotal = mpShieldMax;
    novosAtributosDinamicos.pontosMPExtraTotal = mpExtraMax;

    const hpShieldAtual = Math.min(fichaOriginal.hpShieldAtual !== undefined ? Number(fichaOriginal.hpShieldAtual) : hpShieldMax, hpShieldMax);
    const hpExtraAtual  = Math.min(fichaOriginal.hpExtraAtual !== undefined ? Number(fichaOriginal.hpExtraAtual) : hpExtraMax, hpExtraMax);
    const mpShieldAtual = Math.min(fichaOriginal.mpShieldAtual !== undefined ? Number(fichaOriginal.mpShieldAtual) : mpShieldMax, mpShieldMax);
    const mpExtraAtual  = Math.min(fichaOriginal.mpExtraAtual !== undefined ? Number(fichaOriginal.mpExtraAtual) : mpExtraMax, mpExtraMax);

    const weightStats = calculateWeightStats(fakeFicha, stats.level);
    
    const data = {
        jogadorUid: fichaOriginal.jogadorUid || user.uid,
        jogador: getVal('editor-jogador'),
        nome: getVal('editor-nome'),
        imageUrls: { ...fichaOriginal.imageUrls, ...urls },
        imagemPrincipal: mainKey || fichaOriginal.imagemPrincipal,
        historia: getVal('editor-historia'),
        anotacoes: getVal('editor-anotacoes'),
        
        racaId: fakeFicha.racaId,
        classeId: fakeFicha.classeId,
        subclasseId: fakeFicha.subclasseId,
        
        experienciapersonagemBase: fakeFicha.experienciapersonagemBase,
        pontosExtrasMestre: Number(getVal('editor-pontosExtrasMestre')),
        
        pontosDistribuidosAtk: globalState.painelFichas.pontos.tempAtk,
        pontosDistribuidosDef: globalState.painelFichas.pontos.tempDef,
        pontosDistribuidosEva: globalState.painelFichas.pontos.tempEva,
        
        levelPersonagemBase: stats.level,
        hpMaxPersonagemBase: stats.hpMax,
        mpMaxPersonagemBase: stats.mpMax,
        
        pesoMaximoPersonagemBase: weightStats.max,
        
        hpPersonagemBase: Math.min(fichaOriginal.hpPersonagemBase !== undefined ? Number(fichaOriginal.hpPersonagemBase) : stats.hpMax, stats.hpMax),
        mpPersonagemBase: Math.min(fichaOriginal.mpPersonagemBase !== undefined ? Number(fichaOriginal.mpPersonagemBase) : stats.mpMax, stats.mpMax),
        
        hpShieldAtual: hpShieldAtual,
        hpExtraAtual: hpExtraAtual,
        mpShieldAtual: mpShieldAtual,
        mpExtraAtual: mpExtraAtual,

        iniciativaPersonagemBase: stats.iniciativa,
        movimentoPersonagemBase: stats.movimento,
        
        apMaxPersonagemBase: newMaxAP,
        apPersonagemBase: finalCurrentAP, 
        
        atkPersonagemBase: stats.atk,
        defPersonagemBase: stats.def,
        evaPersonagemBase: stats.eva,

        atributosBasePersonagem: novosAtributosDinamicos,
        
        lastAccessed: serverTimestamp()
    };

    try {
        if(id) {
            await updateDoc(doc(db,"rpg_fichas",id), data);
        } else {
            await setDoc(doc(collection(db,"rpg_fichas")), {
                ...data, 
                createdAt: serverTimestamp(), 
                equipamento:{}, 
                mochila:{}, 
                rolagens:{},
                constelacao_unlocked: []
            });
        }
        
        alert("Ficha salva com sucesso!");
        
        if(window.preencherCacheTodosPersonagens) await window.preencherCacheTodosPersonagens();
        if(!id && window.carregarPersonagensNoSeletor) await window.carregarPersonagensNoSeletor(user); 
    } catch(e) { 
        console.error(e); 
        alert("Erro ao salvar: " + e.message); 
    }
}

// --- GESTÃO DE OBJETIVOS ---
function renderObjectivesManager(ficha) {
    const container = document.getElementById('objectives-root');
    if(!container) return;

    const objetivos = ficha.objetivos || []; 
    const logs = ficha.log_objetivos || []; 

    objetivos.sort((a,b) => {
        if (a.adminHidden !== b.adminHidden) return a.adminHidden ? 1 : -1;
        const aDone = a.checks >= 3;
        const bDone = b.checks >= 3;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return 0;
    });

    const isMaster = globalState.isAdmin;

    let html = `
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-2">
                <h3 class="font-cinzel text-amber-400 text-lg border-none m-0">Lista de Objetivos</h3>
                <div class="mechanics-tooltip-container relative inline-block ml-2">
                    <i class="fas fa-question-circle text-slate-500 hover:text-white cursor-help"></i>
                    <div class="mechanics-tooltip-body tooltip-down" style="width: 320px;">
                        <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">Gerenciamento</h4>
                        <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside">
                            <li><i class="fas fa-pen text-sky-400"></i> <strong>Editar:</strong> Corrige o texto.</li>
                            <li><i class="fas fa-trash text-red-400"></i> <strong>Excluir:</strong> Remove o card.</li>
                            <li><strong>Mestre:</strong> Pode desmarcar checks clicando novamente neles.</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <input type="text" id="new-obj-text" maxlength="150" placeholder="Novo objetivo..." class="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm w-64 focus:border-amber-500 outline-none">
                <button onclick="window.addNewObjective()" class="btn btn-primary py-1 px-3 text-xs font-bold uppercase"><i class="fas fa-plus mr-1"></i> Adicionar</button>
            </div>
        </div>
    `;

    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">`;
    
    if (objetivos.length === 0) {
        html += `<p class="col-span-full text-center text-slate-500 italic py-8 border-2 border-dashed border-slate-700 rounded-lg">Lista vazia.</p>`;
    } else {
        objetivos.forEach(obj => {
            if (obj.adminHidden && !isMaster) return;

            const isCompleted = obj.checks >= 3;
            
            let checksHtml = '';
            for(let i=1; i<=3; i++) {
                const checked = obj.checks >= i;
                const isNext = (i === obj.checks + 1);
                const isCurrent = (i === obj.checks);
                
                const canInteract = isMaster && (isNext || isCurrent);
                const action = isCurrent ? 'uncheck' : 'check';
                
                let cursorClass = canInteract ? 'cursor-pointer hover:border-white hover:bg-white/10' : 'cursor-default';
                let colorClass = checked ? 'checked' : 'opacity-30';
                
                checksHtml += `
                    <div onclick="${canInteract ? `window.toggleObjCheck('${obj.id}', ${i}, '${action}')` : ''}" 
                         class="obj-check-btn ${colorClass} ${cursorClass}"
                         title="${canInteract ? (action==='check'?'Marcar (+Rep)':'Desmarcar (-Rep)') : ''}">
                        <i class="fas fa-check text-xs"></i>
                    </div>
                `;
            }

            let borderClass = isCompleted ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]' : (obj.adminHidden ? 'border-purple-500 border-dashed opacity-70' : 'border-slate-600');
            
            html += `
                <div class="objective-card ${borderClass} relative group bg-slate-800/40">
                    <div class="absolute top-2 right-2 flex gap-2 opacity-100 transition-opacity">
                         <button onclick="window.editObjective('${obj.id}', '${escapeHTML(obj.text)}')" class="text-slate-500 hover:text-sky-400" title="Editar Texto">
                            <i class="fas fa-pen text-[10px]"></i>
                        </button>
                        <button onclick="window.deleteObjective('${obj.id}')" class="text-slate-500 hover:text-red-500" title="Excluir (Limpar da lista)">
                            <i class="fas fa-trash text-[10px]"></i>
                        </button>
                        ${isMaster ? `<button onclick="window.toggleObjAdminHide('${obj.id}')" class="text-slate-500 hover:text-purple-400" title="Admin: Ocultar/Banir"><i class="fas ${obj.adminHidden ? 'fa-eye' : 'fa-ban'} text-[10px]"></i></button>` : ''}
                    </div>

                    ${isCompleted ? '<div class="absolute top-8 right-2 text-amber-500 text-lg drop-shadow-md z-0"><i class="fas fa-medal"></i></div>' : ''}
                    
                    <p class="text-sm text-slate-200 font-medium leading-relaxed break-words mb-4 mt-4 pr-4">
                        "${escapeHTML(obj.text)}"
                    </p>
                    
                    <div class="flex justify-between items-end border-t border-slate-700/50 pt-3 mt-auto">
                        <div class="flex gap-2">
                            ${checksHtml}
                        </div>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;

    html += `
        <div class="bg-black/20 rounded-lg border border-slate-700 p-4">
            <h4 class="text-xs font-bold text-slate-500 uppercase mb-2">Histórico Completo</h4>
            <div class="max-h-40 overflow-y-auto custom-scroll space-y-1 text-xs font-mono text-slate-400">
                ${logs.length > 0 ? logs.map(l => `<div><span class="text-slate-600">[${l.date}]</span> ${l.text}</div>`).join('') : '<span class="italic opacity-50">Nenhum registro.</span>'}
            </div>
        </div>
    `;
    container.innerHTML = html;
} 

window.addNewObjective = async function() {
    const input = document.getElementById('new-obj-text');
    const text = input.value.trim();
    if (!text) return alert("Digite o objetivo.");
    
    const charId = globalState.selectedCharacterId;
    if (!confirm("Confirmar objetivo? Após criar, você não poderá editar o texto.")) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];

            const newObj = {
                id: Date.now().toString(36),
                text: text,
                checks: 0,
                hidden: false,
                created: Date.now()
            };

            const newLog = {
                date: new Date().toLocaleString('pt-BR'),
                text: `Objetivo criado: "${text}"`
            };

            t.update(ref, { 
                objetivos: [newObj, ...objs],
                log_objetivos: [newLog, ...logs]
            });
        });
    } catch(e) { alert("Erro: " + e); }
};

window.toggleObjCheck = async function(objId, checkIndex, action) {
    if (!globalState.isAdmin) return alert("Apenas o Mestre pode alterar o progresso.");

    const charId = globalState.selectedCharacterId;
    const isUncheck = action === 'uncheck';
    const verb = isUncheck ? "REVERTER" : "CONFIRMAR";
    
    if(!confirm(`Mestre: ${verb} etapa ${checkIndex}/3?\n${isUncheck ? 'A Reputação será removida.' : 'A Reputação será concedida.'}`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];
            const recursos = d.recursos || {};
            
            const objIndex = objs.findIndex(o => o.id === objId);
            if(objIndex === -1) throw "Objetivo não encontrado.";

            let repChange = 2; 
            if (checkIndex === 3) repChange += 4; 

            let logText = "";
            
            if (isUncheck) {
                if (objs[objIndex].checks !== checkIndex) throw "Sincronia incorreta. Recarregue.";
                objs[objIndex].checks = checkIndex - 1; 
                
                recursos.reputacaoObjetivos = (recursos.reputacaoObjetivos || 0) - repChange;
                logText = `Mestre reverteu etapa ${checkIndex} de "${objs[objIndex].text}" (-${repChange} Rep)`;
            } else {
                if (objs[objIndex].checks !== checkIndex - 1) throw "Marque na ordem correta.";
                objs[objIndex].checks = checkIndex;
                
                recursos.reputacaoObjetivos = (recursos.reputacaoObjetivos || 0) + repChange;
                logText = `Mestre validou etapa ${checkIndex}/3 em "${objs[objIndex].text}" (+${repChange} Rep)`;
                if (checkIndex === 3) logText += " - CONCLUÍDO!";
            }

            const newLog = { date: new Date().toLocaleString('pt-BR'), text: logText };
            t.update(ref, { 
                objetivos: objs,
                log_objetivos: [newLog, ...logs],
                recursos: recursos
            });
        });
    } catch(e) { alert("Erro: " + e); }
}; 

window.editObjective = async function(objId, currentText) {
    const newText = prompt("Editar objetivo:", currentText);
    if (newText === null || newText.trim() === "") return;
    if (newText === currentText) return;

    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            
            const idx = objs.findIndex(o => o.id === objId);
            if (idx === -1) throw "Não encontrado.";
            
            objs[idx].text = newText;
            t.update(ref, { objetivos: objs });
        });
    } catch(e) { alert("Erro ao editar: " + e); }
};

window.deleteObjective = async function(objId) {
    if (!confirm("Excluir este objetivo?\n\nUse isso para limpar objetivos já concluídos da tela.\nA reputação ganha e o histórico serão mantidos no Log.")) return;

    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const logs = d.log_objetivos || [];
            
            const deletedObj = objs.find(o => o.id === objId);
            if (!deletedObj) throw "Já excluído.";

            const newObjs = objs.filter(o => o.id !== objId);
            
            const newLog = { 
                date: new Date().toLocaleString('pt-BR'), 
                text: `Objetivo removido da lista: "${deletedObj.text}" (Progresso: ${deletedObj.checks}/3)` 
            };

            t.update(ref, { 
                objetivos: newObjs,
                log_objetivos: [newLog, ...logs]
            });
        });
    } catch(e) { alert("Erro ao excluir: " + e); }
};

window.toggleObjAdminHide = async function(objId) {
    if (!globalState.isAdmin) return; 

    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            
            const objIndex = objs.findIndex(o => o.id === objId);
            if(objIndex === -1) throw "Objetivo não encontrado";

            const newState = !objs[objIndex].adminHidden;
            objs[objIndex].adminHidden = newState;

            t.update(ref, { objetivos: objs });
        });
    } catch(e) { 
        console.error(e);
        alert("Erro ao alterar visibilidade administrativa: " + e.message); 
    }
};

window.toggleObjHide = async function(objId) {
    const charId = globalState.selectedCharacterId;
    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const objs = d.objetivos || [];
            const objIndex = objs.findIndex(o => o.id === objId);
            
            if(objIndex === -1) return;
            
            const newState = !objs[objIndex].hidden;
            objs[objIndex].hidden = newState;

            const logs = d.log_objetivos || [];
            logs.unshift({
                date: new Date().toLocaleString('pt-BR'),
                text: newState ? `Arquivou: "${objs[objIndex].text}"` : `Restaurou: "${objs[objIndex].text}"`
            });

            t.update(ref, { objetivos: objs, log_objetivos: logs });
        });
    } catch(e) { console.error(e); }
};
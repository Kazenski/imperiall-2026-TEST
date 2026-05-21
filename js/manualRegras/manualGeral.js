import { db, doc, updateDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, deleteObject } from '../core/firebase.js';
import { globalState } from '../core/state.js';

const COLLECTION_NAME = "rpg_manual_regras";

export async function renderManualGeralTab() {
    const container = document.getElementById('manual-geral-content');
    if (!container) return;

    // Determina se o usuário logado possui privilégios administrativos
    const isAdmin = globalState.currentUser?.email === 'kazenski.developer@gmail.com' || globalState.currentUser?.role === 'admin';

    // Renderização da casca estrutural
    container.innerHTML = `
        <div class="w-full h-full flex flex-col overflow-hidden animate-fade-in text-gray-200">
            <div class="bg-slate-800/60 border-b border-slate-700 shrink-0 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-md sm:px-6 lg:px-8">
                <div>
                    <h1 class="text-2xl sm:text-3xl font-bold font-cinzel text-amber-400 tracking-wider">Manual Geral do Universo</h1>
                    <p class="text-[11px] text-slate-400 uppercase tracking-widest mt-0.5">Bases do RPG, Diretrizes de Campanha e Lore</p>
                </div>
                ${isAdmin ? `
                    <button id="btn-nova-regra" class="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md shrink-0 flex items-center gap-2">
                        <i class="fas fa-plus"></i> Adicionar Nova Regra
                    </button>
                ` : ''}
            </div>

            <div id="manual-rules-feed" class="flex-grow w-full overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 space-y-4 bg-slate-900/20 min-h-0">
                <div class="text-center py-12 text-slate-500">
                    <i class="fas fa-spinner fa-spin text-3xl text-amber-500 mb-3"></i>
                    <p class="font-mono text-xs uppercase tracking-wider">Sincronizando Tomos de Regras...</p>
                </div>
            </div>
        </div>
    `;

    if (isAdmin) {
        container.querySelector('#btn-nova-regra').addEventListener('click', () => abrirModalFormRegra(null, null));
    }

    await carregarRegrasDoManual(isAdmin);
}

async function carregarRegrasDoManual(isAdmin) {
    const feed = document.getElementById('manual-rules-feed');
    if (!feed) return;

    try {
        const snap = await getDocs(collection(db, COLLECTION_NAME));
        let listaRegras = [];

        snap.forEach(d => {
            listaRegras.push({ id: d.id, ...d.data() });
        });

        // Ordena por data de criação ou modificação mais recente
        listaRegras.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        if (listaRegras.length === 0) {
            feed.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 bg-slate-800/20 border-2 border-dashed border-slate-700 rounded-xl max-w-4xl mx-auto">
                    <i class="fas fa-book text-5xl text-slate-600 mb-3"></i>
                    <p class="text-slate-500 font-cinzel text-center">Nenhum capítulo ou regra foi cadastrado no manual dinâmico.</p>
                </div>
            `;
            return;
        }

        feed.innerHTML = '';

        listaRegras.forEach(regra => {
            // Se a regra estiver oculta e o usuário não for Admin, ela não aparece na página
            if (regra.oculto && !isAdmin) return;

            // Transforma a casca em um elemento expansível (<details>)
            const card = document.createElement('details');
            card.className = `group w-full bg-slate-800/50 border ${regra.oculto ? 'border-dashed border-red-500/40 opacity-60' : 'border-slate-700'} rounded-xl shadow-lg overflow-hidden transition-all duration-300`;

            // Renderiza grade de imagens se houver
            let imagensGrid = '';
            if (regra.imageUrls && Object.keys(regra.imageUrls).length > 0) {
                imagensGrid = `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">`;
                Object.values(regra.imageUrls).forEach(url => {
                    if (url) {
                        imagensGrid += `
                            <div class="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700 cursor-zoom-in relative group/img">
                                <img src="${url}" class="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300 img-preview-trigger" />
                            </div>
                        `;
                    }
                });
                imagensGrid += `</div>`;
            }

            const dataFormatada = regra.updatedAt?.seconds
                ? new Date(regra.updatedAt.seconds * 1000).toLocaleDateString('pt-BR')
                : new Date().toLocaleDateString('pt-BR');

            // O <summary> é o cabeçalho clicável, o restante fica oculto até o click
            card.innerHTML = `
                <summary class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 cursor-pointer p-5 bg-slate-900/40 hover:bg-slate-800/80 transition-colors list-none outline-none [&::-webkit-details-marker]:hidden">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-xl sm:text-2xl font-bold font-cinzel text-white group-hover:text-amber-400 transition-colors">${regra.titulo}</h2>
                            ${regra.oculto ? '<span class="text-[9px] bg-red-600/20 text-red-400 font-black uppercase border border-red-500/30 px-2 py-0.5 rounded shadow">Oculto</span>' : ''}
                        </div>
                        <p class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Modificado em: <strong class="text-slate-400">${dataFormatada}</strong> por <strong class="text-amber-500/90">${regra.autorNome || 'Mestre/Admin'}</strong></p>
                    </div>
                    
                    <div class="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        ${isAdmin ? `
                            <div class="flex gap-2">
                                <button data-id="${regra.id}" class="btn-editar-regra px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase rounded transition-colors shadow"><i class="fas fa-edit sm:mr-1"></i><span class="hidden sm:inline">Editar</span></button>
                                <button data-id="${regra.id}" class="btn-deletar-regra px-3 py-2 bg-red-600/30 border border-red-500/50 hover:bg-red-600 text-red-200 hover:text-white font-bold text-xs uppercase rounded transition-all shadow"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        ` : ''}
                        <div class="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-600">
                            <i class="fas fa-chevron-down text-amber-500 text-lg transition-transform duration-300 group-open:rotate-180"></i>
                        </div>
                    </div>
                </summary>
                
                <div class="p-6 pt-5 border-t border-slate-700/60 bg-slate-900/20">
                    <div class="text-slate-300 text-sm sm:text-base whitespace-pre-wrap leading-relaxed">
                        ${regra.descricao}
                    </div>
                    ${imagensGrid}
                </div>
            `;

            feed.appendChild(card);
        });

        // Eventos de visualização de imagem
        feed.querySelectorAll('.img-preview-trigger').forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                abrirLightboxImagem(img.src);
            });
        });

        // Eventos Admin com trava de propagação para não abrir a sanfona ao clicar em editar
        if (isAdmin) {
            feed.querySelectorAll('.btn-editar-regra').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Impede o clique de vazar pro <summary> e abrir a aba
                    const rFound = listaRegras.find(r => r.id === btn.dataset.id);
                    if (rFound) abrirModalFormRegra(btn.dataset.id, rFound);
                });
            });

            feed.querySelectorAll('.btn-deletar-regra').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deletarRegraDoManual(btn.dataset.id);
                });
            });
        }

    } catch (err) {
        console.error(err);
        feed.innerHTML = `<p class="text-red-400 text-center font-mono text-xs">Erro ao renderizar feed estrutural: ${err.message}</p>`;
    }
}

// Modal Form para Criação e Edição (CRUD Completo)
function abrirModalFormRegra(id, dados) {
    const isEdit = !!id;
    const existing = document.getElementById('modal-form-regra');
    if (existing) existing.remove();

    const modalHTML = `
        <div id="modal-form-regra" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 animate-fade-in overflow-y-auto">
            <div class="bg-slate-800 text-gray-200 p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-600 my-auto">
                <h3 class="text-xl font-bold font-cinzel text-amber-400 mb-6 tracking-wider border-b border-slate-700 pb-3">
                    <i class="fas fa-scroll mr-2"></i>${isEdit ? 'Atualizar Capítulo do Manual' : 'Cadastrar Nova Diretriz / Regra'}
                </h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Título Explicativo:</label>
                        <input id="form-regra-titulo" type="text" class="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-amber-500 font-bold focus:outline-none focus:border-amber-500 text-sm shadow-inner" value="${isEdit ? dados.titulo : ''}" required />
                    </div>
                    
                    <div>
                        <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Descrição Textual Completa (Aceita HTML):</label>
                        <textarea id="form-regra-desc" rows="6" class="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500 custom-scrollbar leading-relaxed">${isEdit ? dados.descricao : ''}</textarea>
                    </div>

                    <div class="bg-slate-900/40 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                        <div>
                            <span class="text-xs font-bold block text-white">Ocultar regra do site?</span>
                            <span class="text-[10px] text-slate-500">Se marcado, jogadores e mestres não visualizarão este card.</span>
                        </div>
                        <input id="form-regra-oculto" type="checkbox" class="w-5 h-5 accent-amber-500 rounded cursor-pointer" ${isEdit && dados.oculto ? 'checked' : ''} />
                    </div>

                    <div>
                        <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Anexar Imagens Explicativas (Máx: 3 - Compressão Ativa):</label>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-center">
                                <span class="text-[10px] text-slate-500 block mb-1">Imagem 1</span>
                                <input type="file" id="form-regra-img1" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300" />
                            </div>
                            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-center">
                                <span class="text-[10px] text-slate-500 block mb-1">Imagem 2</span>
                                <input type="file" id="form-regra-img2" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300" />
                            </div>
                            <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-center">
                                <span class="text-[10px] text-slate-500 block mb-1">Imagem 3</span>
                                <input type="file" id="form-regra-img3" accept="image/*" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-300" />
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-4 pt-4 border-t border-slate-700/60 mt-6">
                        <button id="btn-salvar-modal-regra" class="flex-grow py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs rounded-lg transition-all shadow-md">
                            <i class="fas fa-save mr-1"></i> Gravar Alterações
                        </button>
                        <button id="btn-cancelar-modal-regra" class="px-6 bg-slate-600 hover:bg-slate-500 text-white font-bold uppercase tracking-wider text-xs rounded-lg transition-all">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('modal-form-regra');

    modal.querySelector('#btn-cancelar-modal-regra').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-salvar-modal-regra').addEventListener('click', async () => {
        const titulo = modal.querySelector('#form-regra-titulo').value.trim();
        const descricao = modal.querySelector('#form-regra-desc').value.trim();
        const oculto = modal.querySelector('#form-regra-oculto').checked;

        if (!titulo || !descricao) return alert("Por favor, preencha o título e o corpo descritivo da regra.");

        const btnSave = modal.querySelector('#btn-salvar-modal-regra');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Processando Mídias...';

        try {
            const compressImage = async (file) => {
                return new Promise((resolve) => {
                    if (!file || !file.type.match(/image.*/)) return resolve(null);
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = (e) => {
                        const img = new Image();
                        img.src = e.target.result;
                        img.onload = () => {
                            let w = img.width; let h = img.height; const max = 800;
                            if (w > h && w > max) { h = Math.round((h * max) / w); w = max; }
                            else if (h > max) { w = Math.round((w * max) / h); h = max; }
                            const canvas = document.createElement('canvas');
                            canvas.width = w; canvas.height = h;
                            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                            canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file), 'image/jpeg', 0.7);
                        };
                    };
                });
            };

            const urls = isEdit ? { ...(dados.imageUrls || {}) } : {};
            const docId = isEdit ? id : doc(collection(db, COLLECTION_NAME)).id;

            for (let i = 1; i <= 3; i++) {
                const file = modal.querySelector(`#form-regra-img${i}`).files[0];
                if (file) {
                    const compFile = await compressImage(file);
                    if (compFile) {
                        if (urls[`img${i}`] && urls[`img${i}`].includes('firebasestorage')) {
                            try { await deleteObject(ref(storage, urls[`img${i}`])); } catch (e) { }
                        }
                        const refImg = ref(storage, `manual_geral/${docId}/img_${i}_${Date.now()}.jpg`);
                        urls[`img${i}`] = await getDownloadURL((await uploadBytes(refImg, compFile)).ref);
                    }
                }
            }

            const payload = {
                titulo: titulo,
                descricao: descricao,
                oculto: oculto,
                imageUrls: urls,
                updatedAt: serverTimestamp(),
                autorNome: globalState.currentUser?.displayName || 'Administrador',
                autorUid: globalState.currentUser?.uid || 'system'
            };

            if (isEdit) {
                await updateDoc(doc(db, COLLECTION_NAME, docId), payload);
            } else {
                await setDoc(doc(db, COLLECTION_NAME, docId), { ...payload, createdAt: serverTimestamp() });
            }

            modal.remove();
            renderManualGeralTab();

        } catch (err) {
            console.error(err);
            alert("Erro fatal ao salvar registro: " + err.message);
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fas fa-save mr-1"></i> Gravar Alterações';
        }
    });
}

async function deletarRegraDoManual(id) {
    if (!confirm("Tem certeza absoluta que deseja remover este capítulo permanentemente?")) return;

    try {
        const snap = await getDocs(collection(db, COLLECTION_NAME));
        const docTarget = snap.docs.find(d => d.id === id);

        if (docTarget) {
            const data = docTarget.data();
            if (data.imageUrls) {
                for (const url of Object.values(data.imageUrls)) {
                    if (url && url.includes('firebasestorage')) {
                        try { await deleteObject(ref(storage, url)); } catch (e) { }
                    }
                }
            }
        }

        await deleteDoc(doc(db, COLLECTION_NAME, id));
        renderManualGeralTab();
    } catch (e) {
        alert("Erro ao excluir documento: " + e.message);
    }
}

function abrirLightboxImagem(src) {
    const existing = document.getElementById('lightbox-manual-overlay');
    if (existing) existing.remove();

    const lightboxHTML = `
        <div id="lightbox-manual-overlay" class="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 cursor-zoom-out animate-fade-in">
            <div class="relative max-w-5xl max-h-[90vh] flex items-center justify-center">
                <img src="${src}" class="w-full h-full object-contain rounded-lg shadow-2xl border border-slate-800" />
                <button class="absolute top-4 right-4 bg-black/70 border border-slate-600 w-10 h-10 flex items-center justify-center text-white rounded-full text-lg hover:bg-slate-800 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', lightboxHTML);
    const lightbox = document.getElementById('lightbox-manual-overlay');
    lightbox.addEventListener('click', () => lightbox.remove());
}
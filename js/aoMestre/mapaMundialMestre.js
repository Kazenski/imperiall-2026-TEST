import { db, doc, updateDoc, setDoc, collection, getDocs, serverTimestamp } from '../core/firebase.js';
import { globalState } from '../core/state.js';

export async function renderMapaMundialMestreTab() {
    const container = document.getElementById('mapa-mundial-mestre-content');
    if (!container) return;

    // Layout principal sem barras de rolagem externas redundantes
    container.innerHTML = `
        <div class="w-full h-full flex flex-col overflow-hidden animate-fade-in text-gray-200">
            <div class="bg-slate-800/60 border-b border-slate-700 shrink-0 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 class="text-xl font-bold font-cinzel text-amber-400 tracking-wide">Controle de Campanhas e FOW</h1>
                    <p class="text-[10px] text-slate-400 uppercase tracking-widest">Módulo de gerenciamento tático do mestre</p>
                </div>
                <div class="flex flex-wrap gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-700 text-xs">
                    <button data-subtab="global" class="subtab-btn px-4 py-2 rounded-md font-bold text-slate-400 hover:text-white transition-colors">Global</button>
                    <button data-subtab="sessoes" class="subtab-btn px-4 py-2 rounded-md font-bold text-slate-400 hover:text-white transition-colors active bg-amber-600 text-white">Sessões</button>
                    <button data-subtab="mapas" class="subtab-btn px-4 py-2 rounded-md font-bold text-slate-400 hover:text-white transition-colors">Mapa Sessões</button>
                    <button data-subtab="tempo" class="subtab-btn px-4 py-2 rounded-md font-bold text-slate-400 hover:text-white transition-colors">Tempo</button>
                </div>
            </div>

            <div id="subtab-content-viewport" class="flex-grow w-full overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0 bg-slate-900/20"></div>
        </div>
    `;

    const viewport = container.querySelector('#subtab-content-viewport');
    const buttons = container.querySelectorAll('.subtab-btn');

    // Gerenciador de cliques nas sub-abas internas
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('bg-amber-600', 'text-white'));
            btn.classList.add('bg-amber-600', 'text-white');
            switchTab(btn.dataset.subtab, viewport);
        });
    });

    // Inicializa carregando a sub-aba padrão (Sessões)
    switchTab('sessoes', viewport);
}

async function switchTab(subtab, viewport) {
    viewport.innerHTML = '<div class="text-center py-10 text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando dados dos tomos...</div>';
    const user = globalState.currentUser;

    if (subtab === 'global') {
        // Aba Global: Apenas visualização das configurações gerais do mundo
        try {
            const snap = await getDocs(collection(db, "rpg_configuracao_global"));
            let config = {};
            snap.forEach(d => config = d.data());

            viewport.innerHTML = `
                <div class="max-w-4xl mx-auto bg-slate-800/40 border border-slate-700 p-6 rounded-xl animate-fade-in">
                    <h3 class="text-xl font-bold font-cinzel text-amber-500 border-b border-slate-700 pb-2 mb-4"><i class="fas fa-globe mr-2"></i>Status do Servidor Global</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-700/60">
                            <span class="text-slate-400 block font-bold text-xs uppercase tracking-wider">Fog of War Padrão</span>
                            <span class="text-lg font-bold text-white">${config.fowPadraoAtivo ? 'Ativado Permanente' : 'Desativado'}</span>
                        </div>
                        <div class="bg-slate-900/50 p-4 rounded-lg border border-slate-700/60">
                            <span class="text-slate-400 block font-bold text-xs uppercase tracking-wider">Modo de Jogo Atual</span>
                            <span class="text-lg font-bold text-amber-400">${config.modoJogo || 'Modo Campanha'}</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 mt-6 italic"><i class="fas fa-lock mr-1"></i>Alterações globais de infraestrutura do mapa são restritas apenas à mesa do Administrador Técnico.</p>
                </div>
            `;
        } catch (e) {
            viewport.innerHTML = `<p class="text-red-400">Erro ao ler dados globais.</p>`;
        }
    }

    else if (subtab === 'sessoes') {
        // Aba Sessões: Ver todas, Criar novas, Editar SOMENTE as suas
        try {
            const snap = await getDocs(collection(db, "rpg_sessoes"));
            let listHtml = '';

            snap.forEach(docSnap => {
                const s = docSnap.data();
                const id = docSnap.id;
                const eDono = s.criadoPorUid === user.uid;

                listHtml += `
                    <div class="bg-slate-800/60 border ${eDono ? 'border-amber-500/40' : 'border-slate-700'} p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="text-lg font-bold text-white font-cinzel">${s.nome}</h4>
                                ${eDono ? '<span class="text-[9px] bg-amber-600/20 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/30">Sua Sessão</span>' : '<span class="text-[9px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded">Outro Mestre</span>'}
                            </div>
                            <p class="text-xs text-slate-400 mt-1">${s.descricao || 'Sem descrição cadastrada para esta mesa.'}</p>
                            <span class="text-[10px] text-slate-500 block mt-2">Mestre ID: ${s.criadoPorUid || 'Desconhecido'}</span>
                        </div>
                        <div class="shrink-0 w-full sm:w-auto">
                            <button data-id="${id}" data-dono="${eDono}" class="btn-editar-sessao w-full sm:w-auto px-4 py-2 ${eDono ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} text-xs font-bold uppercase rounded transition-colors">
                                ${eDono ? '<i class="fas fa-edit mr-1"></i> Configurar' : '<i class="fas fa-eye mr-1"></i> Bloqueado'}
                            </button>
                        </div>
                    </div>
                `;
            });

            viewport.innerHTML = `
                <div class="space-y-6 max-w-6xl mx-auto animate-fade-in">
                    <div class="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/60">
                        <p class="text-xs text-slate-400"><i class="fas fa-info-circle text-amber-500 mr-1"></i>Como Mestre cadastrado, você pode abrir novas frentes de sessões e alterar apenas as mesas criadas pela sua assinatura.</p>
                        <button id="btn-nova-sessao" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors shadow">
                            <i class="fas fa-plus mr-1"></i> Nova Sessão
                        </button>
                    </div>
                    <div class="space-y-3">
                        ${listHtml || '<p class="text-slate-500 text-center py-6">Nenhuma crônica ativa registrada no banco.</p>'}
                    </div>
                </div>
            `;

            // Evento Criar Nova
            viewport.querySelector('#btn-nova-sessao').addEventListener('click', () => modalFormSessao(null, null));

            // Eventos Editar com verificação rigorosa de ID
            viewport.querySelectorAll('.btn-editar-sessao').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.dono !== "true") {
                        return alert("Acesso negado. Você não possui autoridade de criador sobre a sessão deste mestre.");
                    }
                    const sessaoId = btn.dataset.id;
                    const dadosOriginais = snap.docs.find(d => d.id === sessaoId).data();
                    modalFormSessao(sessaoId, dadosOriginais);
                });
            });

        } catch (err) {
            viewport.innerHTML = `<p class="text-red-400">Falha ao sincronizar cache de sessões.</p>`;
        }
    }

    else if (subtab === 'mapas') {
        // Aba Mapa Sessões: Ver todos, Criar novos, Editar SOMENTE as suas
        try {
            const snap = await getDocs(collection(db, "rpg_mapas_sessoes"));
            let gridHtml = '';

            snap.forEach(docSnap => {
                const m = docSnap.data();
                const id = docSnap.id;
                const eDono = m.criadoPorUid === user.uid;

                gridHtml += `
                    <div class="bg-slate-800/50 rounded-lg border ${eDono ? 'border-amber-500/50' : 'border-slate-700'} overflow-hidden flex flex-col">
                        <div class="aspect-video bg-slate-950 w-full relative">
                            <img src="${m.urlMapa || 'https://placehold.co/300x150/111827/d4af37?text=Sem+Mapa'}" class="w-full h-full object-cover opacity-60" />
                            <div class="absolute inset-0 p-3 flex flex-col justify-between bg-gradient-to-t from-slate-900 via-transparent to-black/50">
                                <span class="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-slate-900/80 px-2 py-0.5 rounded self-start">${m.gridAtivo ? 'Grid ON' : 'Grid OFF'}</span>
                                <h5 class="text-base font-bold font-cinzel text-white leading-tight drop-shadow-md">${m.nomeMapa}</h5>
                            </div>
                        </div>
                        <div class="p-3 bg-slate-900/40 flex-grow flex flex-col justify-between gap-3">
                            <p class="text-[11px] text-slate-400 line-clamp-2">${m.regiaoContexto || 'Nenhum contexto de região atrelado.'}</p>
                            <button data-id="${id}" data-dono="${eDono}" class="btn-editar-mapa w-full py-2 ${eDono ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} text-[11px] font-bold uppercase rounded tracking-wider transition-colors">
                                ${eDono ? '<i class="fas fa-sliders-h mr-1"></i> Ajustar Névoa' : '<i class="fas fa-lock mr-1"></i> Protegido'}
                            </button>
                        </div>
                    </div>
                `;
            });

            viewport.innerHTML = `
                <div class="space-y-6 max-w-7xl mx-auto animate-fade-in">
                    <div class="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/60">
                        <p class="text-xs text-slate-400"><i class="fas fa-layer-group text-amber-500 mr-1"></i>Vincule mapas de batalhas específicos para as suas sessões e regule as barreiras de Grid.</p>
                        <button id="btn-novo-mapa" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors shadow">
                            <i class="fas fa-plus mr-1"></i> Adicionar Mapa
                        </button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${gridHtml || '<p class="text-slate-500 text-center col-span-full py-6">Nenhum mapa tático anexado.</p>'}
                    </div>
                </div>
            `;

            viewport.querySelector('#btn-novo-mapa').addEventListener('click', () => modalFormMapa(null, null));

            viewport.querySelectorAll('.btn-editar-mapa').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.dataset.dono !== "true") return alert("Ação bloqueada. Este mapa pertence à crônica de outro narrador.");
                    const mapaId = btn.dataset.id;
                    const dadosOriginais = snap.docs.find(d => d.id === mapaId).data();
                    modalFormMapa(mapaId, dadosOriginais);
                });
            });

        } catch (e) {
            viewport.innerHTML = `<p class="text-red-400">Erro ao puxar dados dos mapas territoriais.</p>`;
        }
    }

    else if (subtab === 'tempo') {
        // Aba Tempo: View-only sobre as variáveis climáticas e horários
        try {
            const snap = await getDocs(collection(db, "rpg_tempo_cronologico"));
            let tempo = { hora: 12, clima: "Ensolarado", dia: 1, mes: "Primeiro Sol" };
            snap.forEach(d => tempo = d.data());

            viewport.innerHTML = `
                <div class="max-w-2xl mx-auto bg-slate-800/40 border border-slate-700 p-6 rounded-xl text-center animate-fade-in">
                    <i class="fas fa-hourglass-half text-amber-500 text-4xl mb-3"></i>
                    <h3 class="text-xl font-bold font-cinzel text-white mb-6">Linha do Tempo e Clima Global</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Horário do Mundo</span>
                            <span class="text-2xl font-black text-amber-400">${tempo.hora}:00h</span>
                        </div>
                        <div class="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
                            <span class="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Condição Climática</span>
                            <span class="text-xl font-black text-sky-400">${tempo.clima}</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 mt-8 italic"><i class="fas fa-lock mr-1"></i>O avanço oficial dos ponteiros e mudança das estações do ano permanecem unificados sob comando central do Admin.</p>
                </div>
            `;
        } catch (e) {
            viewport.innerHTML = `<p class="text-red-400">Erro ao carregar cronômetro global.</p>`;
        }
    }
}

// Modal Form para criar/editar Sessões
function modalFormSessao(id, dados) {
    const isEdit = !!id;
    const modalHtml = `
        <div id="modal-form-sessao" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 animate-fade-in">
            <div class="bg-slate-800 text-gray-200 p-6 rounded-lg shadow-2xl w-full max-w-md border border-slate-600">
                <h3 class="text-xl font-bold font-cinzel text-amber-400 mb-4 tracking-wider">${isEdit ? 'Atualizar Detalhes' : 'Criar Nova Sessão'}</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs text-slate-400 font-bold uppercase mb-1" Ly=nome>Nome da Mesa:</label>
                        <input id="input-sessao-nome" type="text" class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-amber-500 font-bold focus:outline-none focus:border-amber-500 text-sm" value="${isEdit ? dados.nome : ''}" required />
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 font-bold uppercase mb-1">Breve Descrição / Foco:</label>
                        <textarea id="input-sessao-desc" rows="3" class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-amber-500">${isEdit ? dados.descricao : ''}</textarea>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button id="btn-confirmar-salvar-sessao" class="flex-grow py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs rounded transition-all">Salvar Cronica</button>
                        <button id="btn-fechar-modal-sessao" class="px-5 bg-slate-600 hover:bg-slate-500 text-white font-bold uppercase tracking-wider text-xs rounded transition-all">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('modal-form-sessao');

    modal.querySelector('#btn-fechar-modal-sessao').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-confirmar-salvar-sessao').addEventListener('click', async () => {
        const nome = modal.querySelector('#input-sessao-nome').value.trim();
        const descricao = modal.querySelector('#input-sessao-desc').value.trim();
        if (!nome) return alert("Dê um nome para a sua mesa de RPG.");

        try {
            const dataPayload = {
                nome: nome,
                descricao: descricao,
                atualizadoEm: serverTimestamp()
            };

            if (isEdit) {
                await updateDoc(doc(db, "rpg_sessoes", id), dataPayload);
            } else {
                // Injeta obrigatoriamente a flag do criador no documento novo
                await setDoc(doc(collection(db, "rpg_sessoes")), {
                    ...dataPayload,
                    criadoPorUid: globalState.currentUser.uid,
                    criadoEm: serverTimestamp()
                });
            }

            modal.remove();
            // Dá refresh direto no viewport tático
            renderMapaMundialMestreTab();
        } catch (e) {
            alert("Erro ao gravar dados no Firestore: " + e.message);
        }
    });
}

// Modal Form para criar/editar Mapas de Sessões
function modalFormMapa(id, dados) {
    const isEdit = !!id;
    const modalHtml = `
        <div id="modal-form-mapa" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 animate-fade-in">
            <div class="bg-slate-800 text-gray-200 p-6 rounded-lg shadow-2xl w-full max-w-md border border-slate-600">
                <h3 class="text-xl font-bold font-cinzel text-amber-400 mb-4 tracking-wider">${isEdit ? 'Editar Configurações de Mapa' : 'Anexar Novo Mapa Territorial'}</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs text-slate-400 font-bold uppercase mb-1">Título do Campo de Batalha:</label>
                        <input id="input-mapa-nome" type="text" class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-amber-500 font-bold" value="${isEdit ? dados.nomeMapa : ''}" required />
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 font-bold uppercase mb-1">URL da Imagem:</label>
                        <input id="input-mapa-url" type="url" class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-300" value="${isEdit ? dados.urlMapa : ''}" placeholder="https://..." />
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 font-bold uppercase mb-1">Contexto Geográfico:</label>
                        <input id="input-mapa-regiao" type="text" class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-300" value="${isEdit ? dados.regiaoContexto : ''}" placeholder="Ex: Floresta Proibida" />
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button id="btn-confirmar-salvar-mapa" class="flex-grow py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs rounded transition-all">Salvar Mapa</button>
                        <button id="btn-fechar-modal-mapa" class="px-5 bg-slate-600 hover:bg-slate-500 text-white font-bold uppercase tracking-wider text-xs rounded transition-all">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('modal-form-mapa');

    modal.querySelector('#btn-fechar-modal-mapa').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-confirmar-salvar-mapa').addEventListener('click', async () => {
        const nomeMapa = modal.querySelector('#input-mapa-nome').value.trim();
        const urlMapa = modal.querySelector('#input-mapa-url').value.trim();
        const regiaoContexto = modal.querySelector('#input-mapa-regiao').value.trim();

        if (!nomeMapa) return alert("O mapa necessita de uma designação identificável.");

        try {
            const payload = {
                nomeMapa: nomeMapa,
                urlMapa: urlMapa || 'https://placehold.co/600x400/111827/d4af37?text=Mundo+Sem+Foto',
                regiaoContexto: regiaoContexto,
                atualizadoEm: serverTimestamp()
            };

            if (isEdit) {
                await updateDoc(doc(db, "rpg_mapas_sessoes", id), payload);
            } else {
                await setDoc(doc(collection(db, "rpg_mapas_sessoes")), {
                    ...payload,
                    criadoPorUid: globalState.currentUser.uid,
                    gridAtivo: false,
                    criadoEm: serverTimestamp()
                });
            }

            modal.remove();
            renderMapaMundialMestreTab();
        } catch (e) {
            alert("Erro ao salvar documento do mapa: " + e.message);
        }
    });
}
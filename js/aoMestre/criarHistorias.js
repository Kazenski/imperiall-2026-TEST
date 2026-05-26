import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { globalState } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

const COLLECTION_HISTORIAS = 'historias_mestre';

// Estado Isolado da Aba
const historiasState = {
    sincronizado: false,
    campanhas: [],
    idCampanhaAtiva: null,
    idCapituloAtivo: null,
    draggingCard: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    modoConexao: false,
    notaOrigemId: null
};

export async function renderCriarHistoriasTab() {
    const container = document.getElementById('criar-historias-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 overflow-hidden bg-slate-950">
            
            <header class="text-left mb-6 border-b border-slate-700 pb-4 shrink-0 flex justify-between items-end">
                <div>
                    <h1 class="text-3xl font-bold font-cinzel text-amber-500 tracking-widest drop-shadow-md"><i class="fas fa-project-diagram mr-2"></i> Criar Histórias</h1>
                    <p class="text-slate-400 mt-1 text-xs italic">Crie campanhas, capítulos e interligue anotações num mural digital.</p>
                </div>
            </header>

            <div id="historias-sync-screen" class="${historiasState.sincronizado ? 'hidden' : 'flex'} flex-1 flex-col items-center justify-center p-6 text-center">
                <div class="max-w-md bg-slate-900 border border-amber-500/30 p-8 rounded-xl shadow-2xl space-y-6">
                    <div class="text-amber-500 text-5xl mb-2"><i class="fas fa-scroll animate-pulse"></i></div>
                    <h3 class="font-cinzel text-2xl text-slate-200 tracking-wide">Crônicas do Mestre</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Para poupar performance, o mural e seus arquivos de história são carregados apenas quando você decidir trabalhar neles.
                    </p>
                    <button onclick="window.criarHistorias.sincronizar()" id="btn-sync-historias" class="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest py-3 px-6 rounded transition-all shadow-lg text-xs">
                        <i class="fas fa-cloud-download-alt mr-2"></i> Sincronizar Minhas Campanhas
                    </button>
                </div>
            </div>

            <div id="historias-workspace" class="${historiasState.sincronizado ? 'flex' : 'hidden'} flex-1 h-full w-full overflow-hidden border border-slate-700 rounded-xl shadow-2xl">
                
                <aside class="w-64 bg-[#0a0f18] border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
                    <div class="p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
                        <span class="font-cinzel text-[10px] font-bold text-amber-500 tracking-wider uppercase">Minhas Gavetas</span>
                        <button onclick="window.criarHistorias.novaCampanha()" class="bg-amber-600/10 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-black w-6 h-6 flex items-center justify-center rounded transition-all text-[10px]" title="Nova Campanha">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    
                    <div class="p-2 bg-slate-900 border-b border-slate-700 shrink-0">
                        <select id="select-campanha-ativa" onchange="window.criarHistorias.selecionarCampanha(this.value)" class="w-full bg-slate-950 border border-slate-600 rounded text-slate-200 text-[10px] p-2 focus:border-amber-500 outline-none font-bold uppercase tracking-widest">
                            <option value="">-- Selecione a Campanha --</option>
                        </select>
                    </div>

                    <div class="p-3 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Capítulos / Seções</span>
                        <button id="btn-novo-capitulo" onclick="window.criarHistorias.novoCapitulo()" class="text-slate-400 hover:text-amber-400 text-xs transition-colors hidden" title="Novo Capítulo">
                            <i class="fas fa-folder-plus"></i>
                        </button>
                    </div>
                    
                    <div id="lista-capitulos-container" class="flex-1 overflow-y-auto custom-scroll p-2 space-y-1 bg-slate-950/40">
                        <p class="text-[10px] text-slate-500 italic text-center mt-4 px-2">Selecione uma campanha acima para gerenciar.</p>
                    </div>
                </aside>

                <section class="flex-1 flex flex-col overflow-hidden bg-[#070b12] relative">
                    <div class="h-12 bg-slate-900/95 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 z-20 shadow-md">
                        <h4 id="txt-capitulo-titulo-atual" class="font-cinzel text-sm font-bold text-slate-400 tracking-wide">Área de Trabalho</h4>
                        
                        <div id="mural-toolbar-actions" class="hidden items-center gap-2">
                            <button onclick="window.criarHistorias.adicionarNota('post-it')" class="bg-amber-900/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-400 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all">
                                <i class="fas fa-sticky-note mr-1"></i> Nova Nota
                            </button>
                            <button onclick="window.criarHistorias.adicionarNota('dialogo')" class="bg-sky-900/20 hover:bg-sky-600/30 border border-sky-500/50 text-sky-400 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all">
                                <i class="fas fa-comment-alt mr-1"></i> Foco / NPC
                            </button>
                            <button id="btn-toggle-conexao" onclick="window.criarHistorias.alternarModoConexao()" class="bg-slate-800 border border-slate-600 text-slate-400 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ml-4">
                                <i class="fas fa-project-diagram mr-1"></i> Conectar
                            </button>
                        </div>
                    </div>

                    <div id="mural-canvas-container" class="flex-1 relative overflow-auto custom-scroll bg-slate-950/20" onscroll="window.criarHistorias.renderizarLinhas()">
                        <svg id="mural-svg-connections" class="absolute inset-0 pointer-events-none w-[4000px] h-[4000px] min-w-full min-h-full z-0"></svg>
                        <div id="mural-notes-grid" class="absolute inset-0 w-[4000px] h-[4000px] pointer-events-none z-10"></div>
                    </div>
                </section>
            </div>
        </div>
    `;

    if (historiasState.sincronizado) {
        window.criarHistorias.atualizarSelectCampanhas();
        if (historiasState.idCampanhaAtiva) {
            document.getElementById('select-campanha-ativa').value = historiasState.idCampanhaAtiva;
            window.criarHistorias.selecionarCampanha(historiasState.idCampanhaAtiva);
        }
    }
}

// ----------------------------------------------------------------------------------
// AÇÕES GLOBAIS (O ESCRITORIO DO MESTRE)
// ----------------------------------------------------------------------------------
window.criarHistorias = {

    sincronizar: async function () {
        const uidMestre = globalState.userId || (globalState.currentUser && globalState.currentUser.uid);
        if (!uidMestre) return alert("Usuário não identificado.");

        const btn = document.getElementById('btn-sync-historias');
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Puxando Pergaminhos...`;
        btn.disabled = true;

        try {
            let q;
            // Admin vê todas as campanhas cadastradas, Mestre vê apenas as suas
            if (globalState.isAdmin || globalState.userRole === 'admin') {
                q = query(collection(db, COLLECTION_HISTORIAS));
            } else {
                q = query(collection(db, COLLECTION_HISTORIAS), where("idMestre", "==", uidMestre));
            }

            const snap = await getDocs(q);

            historiasState.campanhas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            historiasState.sincronizado = true;

            document.getElementById('historias-sync-screen').classList.replace('flex', 'hidden');
            document.getElementById('historias-workspace').classList.replace('hidden', 'flex');

            this.atualizarSelectCampanhas();
        } catch (e) {
            console.error("Erro no Sync Historias:", e);
            alert("Erro ao buscar as campanhas do servidor.");
            btn.innerHTML = `<i class="fas fa-cloud-download-alt mr-2"></i> Sincronizar Minhas Campanhas`;
            btn.disabled = false;
        }
    },

    atualizarSelectCampanhas: function () {
        const sel = document.getElementById('select-campanha-ativa');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Selecione a Campanha --</option>';
        historiasState.campanhas.forEach(c => {
            sel.add(new Option(c.nomeCampanha, c.id));
        });
    },

    novaCampanha: async function () {
        const nome = prompt("Nome da Nova Campanha / Gaveta:");
        if (!nome || !nome.trim()) return;

        const uidMestre = globalState.userId || globalState.currentUser.uid;
        const nova = {
            idMestre: uidMestre,
            nomeCampanha: nome.trim(),
            dataCriacao: serverTimestamp(),
            capitulos: [
                { idCapitulo: "cap_" + Date.now(), titulo: "Anotações Gerais", notas: [], conexoes: [] }
            ]
        };

        try {
            const docRef = doc(collection(db, COLLECTION_HISTORIAS));
            await setDoc(docRef, nova);
            nova.id = docRef.id;
            historiasState.campanhas.push(nova);
            this.atualizarSelectCampanhas();
            document.getElementById('select-campanha-ativa').value = nova.id;
            this.selecionarCampanha(nova.id);
        } catch (e) {
            console.error(e); alert("Erro ao criar campanha.");
        }
    },

    selecionarCampanha: function (idCampanha) {
        historiasState.idCampanhaAtiva = idCampanha;
        historiasState.idCapituloAtivo = null;
        this.limparMural();

        const btnNovoCap = document.getElementById("btn-novo-capitulo");
        const listaCaps = document.getElementById("lista-capitulos-container");

        if (!idCampanha) {
            btnNovoCap.classList.add("hidden");
            listaCaps.innerHTML = '<p class="text-[10px] text-slate-500 italic text-center mt-4 px-2">Selecione uma campanha acima para gerenciar.</p>';
            return;
        }

        btnNovoCap.classList.remove("hidden");
        this.renderizarListaCapitulos();
    },

    renderizarListaCapitulos: function () {
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const container = document.getElementById("lista-capitulos-container");
        container.innerHTML = "";

        if (!camp || !camp.capitulos || camp.capitulos.length === 0) return;

        camp.capitulos.forEach(cap => {
            const isActive = historiasState.idCapituloAtivo === cap.idCapitulo;
            const classes = isActive
                ? 'bg-amber-600/20 text-amber-400 border-amber-500/30 font-bold'
                : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200';

            container.innerHTML += `
                <button onclick="window.criarHistorias.selecionarCapitulo('${cap.idCapitulo}')" class="w-full text-left text-[10px] px-3 py-2 rounded border transition-all flex items-center gap-2 ${classes} uppercase tracking-widest truncate">
                    <i class="fas ${isActive ? 'fa-folder-open' : 'fa-folder'} shrink-0"></i> 
                    <span class="truncate">${escapeHTML(cap.titulo)}</span>
                </button>
            `;
        });
    },

    novoCapitulo: async function () {
        if (!historiasState.idCampanhaAtiva) return;
        const titulo = prompt("Nome do Capítulo / Sessão:");
        if (!titulo || !titulo.trim()) return;

        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const novoCap = {
            idCapitulo: "cap_" + Date.now(),
            titulo: titulo.trim(),
            notas: [],
            conexoes: []
        };

        camp.capitulos.push(novoCap);
        await this.salvarNoFirebase(camp);
        this.renderizarListaCapitulos();
        this.selecionarCapitulo(novoCap.idCapitulo);
    },

    selecionarCapitulo: function (idCapitulo) {
        historiasState.idCapituloAtivo = idCapitulo;
        this.renderizarListaCapitulos();

        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === idCapitulo);

        document.getElementById("txt-capitulo-titulo-atual").innerHTML = `<span class="text-amber-500 mr-2">${escapeHTML(camp.nomeCampanha)}</span> > <span class="ml-2">${escapeHTML(cap.titulo)}</span>`;
        document.getElementById("mural-toolbar-actions").classList.remove("hidden");
        document.getElementById("mural-toolbar-actions").classList.add("flex");

        this.renderizarMural();
    },

    renderizarMural: function () {
        const grid = document.getElementById("mural-notes-grid");
        grid.innerHTML = "";

        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);

        cap.notas.forEach(nota => {
            const isDialogo = nota.tipo === 'dialogo';
            const corBorda = isDialogo ? 'border-sky-500' : 'border-amber-500';
            const icon = isDialogo ? 'fa-comment-alt text-sky-400' : 'fa-sticky-note text-amber-400';

            const card = document.createElement('div');
            card.id = `mural-card-${nota.idNota}`;
            card.className = `mural-note-card rounded-lg border border-slate-700 bg-slate-900 shadow-xl flex flex-col absolute border-t-4 ${corBorda}`;
            card.style.left = `${nota.posicao?.x || 100}px`;
            card.style.top = `${nota.posicao?.y || 100}px`;

            card.innerHTML = `
                <div class="drag-handle bg-slate-950/50 border-b border-slate-700 p-2 flex items-center justify-between shrink-0" onmousedown="window.criarHistorias.startDrag(event, '${nota.idNota}')">
                    <div class="flex items-center gap-2 flex-grow overflow-hidden">
                        <i class="fas ${icon} text-[10px]"></i>
                        <input type="text" value="${escapeHTML(nota.titulo || '')}" onchange="window.criarHistorias.atualizarNota('${nota.idNota}', 'titulo', this.value)" class="bg-transparent font-bold text-[10px] uppercase tracking-widest text-slate-200 outline-none w-full focus:border-b focus:border-slate-500 truncate" placeholder="Título..."/>
                    </div>
                    <div class="flex items-center gap-1.5 ml-2 shrink-0">
                        <button onclick="window.criarHistorias.abrirFocoNota('${nota.idNota}')" class="text-slate-400 hover:text-sky-400 transition-colors" title="Modo Foco (Expandir)"><i class="fas fa-expand text-[10px]"></i></button>
                        <button onclick="window.criarHistorias.conectarNota('${nota.idNota}')" class="text-slate-500 hover:text-emerald-400 transition-colors" title="Criar Conexão"><i class="fas fa-link text-[10px]"></i></button>
                        <button onclick="window.criarHistorias.apagarNota('${nota.idNota}')" class="text-slate-600 hover:text-red-500 transition-colors" title="Apagar"><i class="fas fa-trash text-[10px]"></i></button>
                    </div>
                </div>
                <div class="flex-grow p-2 pb-0 flex flex-col">
                    <textarea onchange="window.criarHistorias.atualizarNota('${nota.idNota}', 'conteudo', this.value)" class="bg-transparent text-[11px] text-slate-300 resize-y outline-none flex-grow custom-scroll min-h-[60px] max-h-[300px] placeholder-slate-600" placeholder="Anotações...">${escapeHTML(nota.conteudo || '')}</textarea>
                </div>
                <div class="p-1.5 border-t border-slate-800 bg-slate-950/80 rounded-b-lg flex justify-between gap-1 shrink-0">
                    <select onchange="window.criarHistorias.atualizarNota('${nota.idNota}', 'npc', this.value)" class="sel-npc bg-transparent text-[9px] text-slate-400 font-bold uppercase outline-none w-1/2 overflow-hidden text-ellipsis border-r border-slate-800"><option value="">+ NPC</option></select>
                    <select onchange="window.criarHistorias.atualizarNota('${nota.idNota}', 'monstro', this.value)" class="sel-mob bg-transparent text-[9px] text-slate-400 font-bold uppercase outline-none w-1/2 overflow-hidden text-ellipsis pl-1"><option value="">+ BESTIÁRIO</option></select>
                </div>
            `;

            grid.appendChild(card);

            // Popula os Selects com os caches globais do sistema de forma segura contra undefined
            const selNpc = card.querySelector('.sel-npc');
            const selMob = card.querySelector('.sel-mob');

            if (globalState.cache.npcs) {
                Array.from(globalState.cache.npcs.values())
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                    .forEach(n => {
                        const opt = new Option(n.nome || 'NPC Sem Nome', n.id);
                        if (nota.vinculos?.npc === n.id) opt.selected = true;
                        selNpc.add(opt);
                    });
            }
            if (globalState.cache.mobs) {
                Array.from(globalState.cache.mobs.values())
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                    .forEach(m => {
                        const opt = new Option(m.nome || 'Monstro Sem Nome', m.id);
                        if (nota.vinculos?.monstro === m.id) opt.selected = true;
                        selMob.add(opt);
                    });
            }
        });

        this.renderizarLinhas();
    },

    adicionarNota: async function (tipo) {
        if (!historiasState.idCapituloAtivo) return;
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);
        const scrollBox = document.getElementById("mural-canvas-container");

        cap.notas.push({
            idNota: "nota_" + Date.now(),
            tipo: tipo,
            titulo: tipo === "dialogo" ? "Interação" : "Nota",
            conteudo: "",
            posicao: { x: scrollBox.scrollLeft + 100, y: scrollBox.scrollTop + 100 },
            vinculos: { npc: "", monstro: "" }
        });

        this.renderizarMural();
        await this.salvarNoFirebase(camp);
    },

    atualizarNota: async function (idNota, campo, valor) {
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);
        const nota = cap.notas.find(n => n.idNota === idNota);

        if (!nota.vinculos) nota.vinculos = {};

        if (campo === 'npc') nota.vinculos.npc = valor;
        else if (campo === 'monstro') nota.vinculos.monstro = valor;
        else nota[campo] = valor;

        await this.salvarNoFirebase(camp);
    },

    apagarNota: async function (idNota) {
        if (!confirm("Deletar nota?")) return;
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);

        cap.notas = cap.notas.filter(n => n.idNota !== idNota);
        cap.conexoes = cap.conexoes.filter(c => c.origem !== idNota && c.destino !== idNota);

        this.renderizarMural();
        await this.salvarNoFirebase(camp);
    },

    limparMural: function () {
        document.getElementById("txt-capitulo-titulo-atual").innerHTML = "Área de Trabalho Vazia";
        document.getElementById("mural-toolbar-actions").classList.replace("flex", "hidden");
        document.getElementById("mural-notes-grid").innerHTML = "";
        document.getElementById("mural-svg-connections").innerHTML = "";
    },

    // --- ARRASTE NATIVO ---
    startDrag: function (e, idNota) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        const card = document.getElementById(`mural-card-${idNota}`);
        historiasState.draggingCard = { idNota, card };

        // Coordenadas relativas onde o click ocorreu no card
        const rect = card.getBoundingClientRect();
        historiasState.dragOffsetX = e.clientX - rect.left;
        historiasState.dragOffsetY = e.clientY - rect.top;

        document.onmousemove = window.criarHistorias.doDrag;
        document.onmouseup = window.criarHistorias.stopDrag;
    },

    doDrag: function (e) {
        if (!historiasState.draggingCard) return;
        const { card } = historiasState.draggingCard;
        const container = document.getElementById("mural-canvas-container");
        const boxRect = container.getBoundingClientRect();

        let x = e.clientX - boxRect.left - historiasState.dragOffsetX + container.scrollLeft;
        let y = e.clientY - boxRect.top - historiasState.dragOffsetY + container.scrollTop;

        if (x < 10) x = 10;
        if (y < 10) y = 10;

        card.style.left = `${x}px`;
        card.style.top = `${y}px`;

        window.criarHistorias.renderizarLinhas();
    },

    stopDrag: async function () {
        if (!historiasState.draggingCard) return;
        const { idNota, card } = historiasState.draggingCard;

        document.onmousemove = null;
        document.onmouseup = null;
        historiasState.draggingCard = null;

        const x = parseInt(card.style.left);
        const y = parseInt(card.style.top);

        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);
        const nota = cap.notas.find(n => n.idNota === idNota);

        nota.posicao = { x, y };
        await window.criarHistorias.salvarNoFirebase(camp);
    },

    // --- LINHAS E CONEXÕES SVG ---
    alternarModoConexao: function () {
        historiasState.modoConexao = !historiasState.modoConexao;
        const btn = document.getElementById('btn-toggle-conexao');
        if (historiasState.modoConexao) {
            btn.classList.replace('bg-slate-800', 'bg-amber-600');
            btn.classList.replace('text-slate-400', 'text-black');
            historiasState.notaOrigemId = null;
        } else {
            btn.classList.replace('bg-amber-600', 'bg-slate-800');
            btn.classList.replace('text-black', 'text-slate-400');
            this.limparDestaqueOrigem();
        }
    },

    conectarNota: function (idNota) {
        if (!historiasState.modoConexao) this.alternarModoConexao();

        if (!historiasState.notaOrigemId) {
            historiasState.notaOrigemId = idNota;
            document.getElementById(`mural-card-${idNota}`).classList.add('modo-vinculo-origem');
        } else {
            if (historiasState.notaOrigemId === idNota) {
                this.limparDestaqueOrigem();
                return;
            }

            const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
            const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);

            const jaExiste = cap.conexoes.some(con => con.origem === historiasState.notaOrigemId && con.destino === idNota);
            if (!jaExiste) {
                cap.conexoes.push({ idConexao: "con_" + Date.now(), origem: historiasState.notaOrigemId, destino: idNota });
                this.salvarNoFirebase(camp);
            }

            this.limparDestaqueOrigem();
            this.renderizarLinhas();
        }
    },

    limparDestaqueOrigem: function () {
        if (historiasState.notaOrigemId) {
            const el = document.getElementById(`mural-card-${historiasState.notaOrigemId}`);
            if (el) el.classList.remove('modo-vinculo-origem');
        }
        historiasState.notaOrigemId = null;
    },

    renderizarLinhas: function () {
        const svg = document.getElementById("mural-svg-connections");
        if (!svg || !historiasState.idCapituloAtivo) return;

        svg.innerHTML = "";
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);

        if (!cap || !cap.conexoes) return;

        cap.conexoes.forEach(con => {
            const cO = document.getElementById(`mural-card-${con.origem}`);
            const cD = document.getElementById(`mural-card-${con.destino}`);

            if (cO && cD) {
                const x1 = cO.offsetLeft + (cO.offsetWidth / 2);
                const y1 = cO.offsetTop + (cO.offsetHeight / 2);
                const x2 = cD.offsetLeft + (cD.offsetWidth / 2);
                const y2 = cD.offsetTop + (cD.offsetHeight / 2);

                const dx = Math.abs(x2 - x1) * 0.4;
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
                path.setAttribute("stroke", "#f59e0b"); // amber-500
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                svg.appendChild(path);
            }
        });
    },

    salvarNoFirebase: async function (camp) {
        try {
            await setDoc(doc(db, COLLECTION_HISTORIAS, camp.id), { capitulos: camp.capitulos }, { merge: true });
        } catch (e) {
            console.error("Erro DB Historias:", e);
        }
    },

    // --- MODO FOCO (LEITURA E ESCRITA EXPANDIDA) ---
    abrirFocoNota: function (idNota) {
        const camp = historiasState.campanhas.find(c => c.id === historiasState.idCampanhaAtiva);
        const cap = camp.capitulos.find(c => c.idCapitulo === historiasState.idCapituloAtivo);
        const nota = cap.notas.find(n => n.idNota === idNota);

        if (!nota) return;

        // Se já houver um modal aberto, remove para não duplicar
        const existing = document.getElementById('modal-foco-nota');
        if (existing) existing.remove();

        const isDialogo = nota.tipo === 'dialogo';
        const corTema = isDialogo ? 'text-sky-400' : 'text-amber-400';
        const borderTema = isDialogo ? 'border-sky-500/50' : 'border-amber-500/50';

        const modalHTML = `
            <div id="modal-foco-nota" class="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] animate-fade-in p-4 md:p-10">
                <div class="bg-slate-900 border ${borderTema} rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-5xl flex flex-col h-[85vh]">
                    
                    <div class="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-950/80 rounded-t-2xl shrink-0">
                        <div class="flex-grow flex items-center gap-4">
                            <i class="fas ${isDialogo ? 'fa-comment-alt' : 'fa-sticky-note'} ${corTema} text-2xl drop-shadow-md"></i>
                            <input type="text" value="${escapeHTML(nota.titulo || '')}" 
                                onchange="
                                    window.criarHistorias.atualizarNota('${idNota}', 'titulo', this.value); 
                                    document.getElementById('mural-card-${idNota}').querySelector('input').value = this.value;
                                " 
                                class="bg-transparent font-cinzel font-bold text-xl md:text-3xl tracking-widest text-slate-100 outline-none w-full focus:border-b focus:border-slate-500 transition-colors" 
                                placeholder="Título da Anotação..."/>
                        </div>
                        <button onclick="document.getElementById('modal-foco-nota').remove()" class="text-slate-500 hover:text-red-500 transition-colors text-3xl ml-6">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="flex-grow p-6 md:p-10 flex flex-col min-h-0 bg-[#0a0f18]">
                        <textarea 
                            onchange="
                                window.criarHistorias.atualizarNota('${idNota}', 'conteudo', this.value); 
                                document.getElementById('mural-card-${idNota}').querySelector('textarea').value = this.value;
                            " 
                            class="w-full h-full bg-transparent text-base md:text-lg text-slate-300 resize-none outline-none custom-scroll placeholder-slate-600 leading-relaxed font-medium" 
                            placeholder="Escreva a lore, acontecimentos ou o discurso do NPC aqui...">${escapeHTML(nota.conteudo || '')}</textarea>
                    </div>

                    <div class="p-4 border-t border-slate-800 bg-slate-950/80 rounded-b-2xl flex items-center justify-between shrink-0">
                        <span class="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
                            <i class="fas fa-save mr-2 ${corTema}"></i> Salvo automaticamente ao digitar
                        </span>
                        <button onclick="document.getElementById('modal-foco-nota').remove()" class="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors shadow-lg">
                            Concluir Leitura
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
};
import { auth, db, storage, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, getDocs, doc, getDoc, onSnapshot, query, where, orderBy, writeBatch, runTransaction, deleteField, increment, updateDoc } from './core/firebase.js';
import { globalState, ADMIN_EMAIL, PLACEHOLDER_IMAGE_URL, COINS } from './core/state.js';
import { createBonusObject } from './core/calculos.js';
import { renderPainelFichas, renderFichaEditor } from './tabs/painelFichas.js';
window.renderFichaEditor = renderFichaEditor;
import { renderRolagemDados } from './tabs/rolagemDados.js';
import { renderCalculadoraCombate } from './tabs/calcCombate.js';
import { renderMinhasHabilidades } from './tabs/habilidades.js';
import { renderMochila, setupMochilaListeners } from './tabs/mochila.js';
import { renderItensEquipados, renderSlotsEquipamento } from './tabs/itensEquipados.js';
import { renderCalculadoraAtributos } from './tabs/calcAtributos.js';
import { renderConstelacaoTab, setupConstelacaoListeners } from './tabs/constelacao.js';
import { renderCraftingTab, setupCraftingListeners } from './tabs/crafting.js';
import { renderExtracaoTab, setupExtracaoListeners } from './tabs/extracao.js';
import { renderCollectionTab, checkAndDiscoverCities } from './tabs/colecao.js';
import { renderArmaEspiritualTab } from './tabs/armaEspiritual.js';
import { renderPetsTab } from './tabs/pets.js';
import { renderReputacaoTab } from './tabs/reputacao.js';
import { renderComercioTab } from './tabs/comercio.js';
import { renderMapaTab } from './tabs/mapa.js';
import './tabs/arena.js';

const dom = {};
document.querySelectorAll('[id]').forEach(el => dom[el.id.replace(/-/g, '_')] = el);
window.gatherAllCharacterData = gatherAllCharacterData;
window.preencherCacheTodosPersonagens = preencherCacheTodosPersonagens;
window.carregarPersonagensNoSeletor = carregarPersonagensNoSeletor;
window.handleCharacterSelect = handleCharacterSelect;
window.renderMapTab = renderMapaTab;
window.checkAndDiscoverCities = checkAndDiscoverCities;

// --- AUTENTICAÇÃO E INICIALIZAÇÃO ---
dom.btn_login?.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, dom.auth_email.value, dom.auth_password.value)
        .catch(err => alert("Erro no login: " + err.message));
});

const MASTER_ARCHITECTURE = {
    'Início': [
        { id: 'blank', icon: 'fa-home', label: 'Página Inicial', render: () => window.renderBlankPage('Página Inicial') }
    ],
    'O Mundo': [
        { id: 'blank', icon: 'fa-globe', label: 'Conheça o mundo', render: () => window.renderBlankPage('Conheça o mundo') },
        { id: 'blank', icon: 'fa-bolt', label: 'Os Deuses', render: () => window.renderBlankPage('Os Deuses') },
        { id: 'blank', icon: 'fa-book-dead', label: 'Lendas do Mundo', render: () => window.renderBlankPage('Lendas do Mundo') },
        { id: 'blank', icon: 'fa-users', label: 'NPCs Importantes', render: () => window.renderBlankPage('NPCs Importantes') }
    ],
    'Manual e Regras': [
        { id: 'blank', icon: 'fa-book', label: 'Manual', render: () => window.renderBlankPage('Manual') },
        { id: 'blank', icon: 'fa-dna', label: 'Raças', render: () => window.renderBlankPage('Raças') },
        { id: 'blank', icon: 'fa-theater-masks', label: 'Classes', render: () => window.renderBlankPage('Classes') },
        { id: 'blank', icon: 'fa-mask', label: 'Subclasses', render: () => window.renderBlankPage('Subclasses') },
        { id: 'blank', icon: 'fa-fire', label: 'Habilidades', render: () => window.renderBlankPage('Habilidades') },
        { id: 'blank', icon: 'fa-hammer', label: 'Profissões', render: () => window.renderBlankPage('Profissões') }
    ],
    'Ao Mestre': [
        { id: 'blank', icon: 'fa-terminal', label: 'Comandos de jogo', render: () => window.renderBlankPage('Comandos de jogo') },
        { id: 'blank', icon: 'fa-user-plus', label: 'Cad. NPCs', render: () => window.renderBlankPage('Cad. NPCs') },
        { id: 'blank', icon: 'fa-tools', label: 'Cad. Crafts', render: () => window.renderBlankPage('Cad. Crafts') },
        { id: 'blank', icon: 'fa-dragon', label: 'Cad. Monstros/Seres', render: () => window.renderBlankPage('Cad. Monstros/Seres') },
        { id: 'blank', icon: 'fa-gem', label: 'Cad. Itens', render: () => window.renderBlankPage('Cad. Itens') },
        { id: 'blank', icon: 'fa-scroll', label: 'Lore personagens', render: () => window.renderBlankPage('Lore personagens (Tem conteúdo)') }
    ],
    'Ao Jogador': [
        { id: 'blank', icon: 'fa-flask', label: 'Simular Ficha', render: () => window.renderBlankPage('Simular Ficha') },
        { id: 'ficha-menu', icon: 'fa-id-card', label: 'Ficha de Personagem', render: () => {
            // 1. Puxa as 16 abas para a barra lateral esquerda (passando true para criar o botão "Voltar")
            populateSidebar(FICHA_TABS, true);
            
            // 2. Aguarda um milissegundo para o HTML renderizar e clica na primeira aba ("Painel de Ficha")
            // Usamos o índice [1] porque o índice [0] agora é o botão de "Voltar"
            setTimeout(() => {
                const botoesSidebar = document.querySelectorAll('#sub-menu-bar button');
                if(botoesSidebar[1]) botoesSidebar[1].click();
            }, 10);
        }},
        { id: 'blank', icon: 'fa-images', label: 'Galeria de Imagens', render: () => window.renderBlankPage('Galeria de Imagens') }
    ],
    'Atualizações': [
        { id: 'blank', icon: 'fa-bullhorn', label: 'Novidades', render: () => window.renderBlankPage('Novidades') }
    ]
};

window.setMasterContext = function(menuName) {
    document.querySelectorAll('.master-nav-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === menuName);
    });

    if (MASTER_ARCHITECTURE[menuName]) {
        populateSidebar(MASTER_ARCHITECTURE[menuName], false);
        const firstBtn = document.querySelector('#sub-menu-bar button');
        if (firstBtn) firstBtn.click();
    }
};

window.openFichaPersonagemMenu = function() {
    populateSidebar(FICHA_TABS, true);
    // Clica no "Painel de Ficha" (o segundo botão, pois o primeiro é o Voltar)
    const secondBtn = document.querySelectorAll('#sub-menu-bar button')[1]; 
    if(secondBtn) secondBtn.click();
};

const FICHA_TABS = [
    { id: 'painel-fichas', icon: 'fa-user', label: 'Painel de Ficha', render: () => window.showTab('painel-fichas') },
    { id: 'rolagem-dados', icon: 'fa-dice-d20', label: 'Rolagem de Dados', render: () => window.showTab('rolagem-dados') },
    { id: 'minhas-habilidades', icon: 'fa-fire', label: 'Minhas Habilidades', render: () => window.showTab('minhas-habilidades') },
    { id: 'mochila', icon: 'fa-briefcase', label: 'Mochila', render: () => window.showTab('mochila') },
    { id: 'itens-equipados', icon: 'fa-tshirt', label: 'Itens Equipados', render: () => window.showTab('itens-equipados') },
    { id: 'calculadora-atributos', icon: 'fa-chart-bar', label: 'Calculadora de atributos', render: () => window.showTab('calculadora-atributos') },
    { id: 'constelacao', icon: 'fa-star', label: 'Constelação', render: () => window.showTab('constelacao') },
    { id: 'crafting', icon: 'fa-hammer', label: 'Oficina de Criação', render: () => window.showTab('crafting') },
    { id: 'extracao', icon: 'fa-recycle', label: 'Extração e Reciclagem', render: () => window.showTab('extracao') },
    { id: 'colecao-craft', icon: 'fa-book-atlas', label: 'Diário de Coleção', render: () => window.showTab('colecao-craft') },
    { id: 'arma-espiritual', icon: 'fa-ghost', label: 'Arma Espiritual', render: () => window.showTab('arma-espiritual') },
    { id: 'meus-pets', icon: 'fa-dragon', label: 'Meus Pets', render: () => window.showTab('meus-pets') },
    { id: 'recursos-reputacao', icon: 'fa-crown', label: 'Recursos e Reputação', render: () => window.showTab('recursos-reputacao') },
    { id: 'comercio', icon: 'fa-coins', label: 'Comércio', render: () => window.showTab('comercio') },
    { id: 'mapa-movimento', icon: 'fa-map-marked-alt', label: 'Mapa e Movimento', render: () => window.showTab('mapa-movimento') },
    { id: 'arena-combate', icon: 'fa-chess-board', label: 'Arena de Combate', render: () => window.showTab('arena-combate') }
];

// 3. FUNÇÃO QUE DESENHA OS BOTÕES NA ÁREA VERMELHA LATERAL
function populateSidebar(subAbaArray, isFichaMenu = false) {
    const sidebar = document.getElementById('sub-menu-bar');
    sidebar.innerHTML = '';

    if (isFichaMenu) {
        const backBtn = document.createElement('button');
        backBtn.className = "flex items-center h-12 w-full hover:bg-slate-800 transition-all border-l-4 border-transparent hover:border-red-500 overflow-hidden group bg-[#0f172a] mb-2";
        backBtn.innerHTML = `
            <div class="w-[64px] flex items-center justify-center shrink-0"><i class="fas fa-arrow-left text-xl text-red-500 group-hover:text-red-400 transition-colors"></i></div>
            <span class="ml-1 text-[11px] font-bold uppercase tracking-widest text-red-400 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300">Voltar</span>
        `;
        backBtn.onclick = () => window.setMasterContext('Ao Jogador');
        sidebar.appendChild(backBtn);
    }

    subAbaArray.forEach(subAba => {
        const btn = document.createElement('button');
        btn.className = "flex items-center h-12 w-full hover:bg-[#1e293b] transition-all border-l-4 border-transparent hover:border-amber-500 overflow-hidden group";
        btn.innerHTML = `
            <div class="w-[64px] flex items-center justify-center shrink-0">
                <i class="fas ${subAba.icon} text-xl text-slate-500 group-hover:text-amber-500 transition-colors"></i>
            </div>
            <span class="ml-1 text-[11px] font-bold uppercase tracking-widest text-slate-300 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300 text-left">
                ${subAba.label}
            </span>
        `;

        btn.onclick = () => {
            document.querySelectorAll('#sub-menu-bar button').forEach(b => {
                b.classList.remove('bg-[#1e293b]', 'border-amber-500');
                const i = b.querySelector('i');
                if (i && !i.classList.contains('fa-arrow-left')) i.classList.replace('text-amber-500', 'text-slate-500');
            });
            btn.classList.add('bg-[#1e293b]', 'border-amber-500');
            btn.querySelector('i').classList.replace('text-slate-500', 'text-amber-500');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById('default-view')?.classList.add('hidden');
            
            if (subAba.id !== 'blank' && subAba.id !== 'ficha-menu') {
                const targetDiv = document.getElementById(`${subAba.id}-content`);
                if (targetDiv) targetDiv.classList.remove('hidden');
            }

            subAba.render();
        };
        sidebar.appendChild(btn);
    });
}

window.renderBlankPage = function(title) {
    // Esconde as abas ativas
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    
    // Procura a div de tela em branco. Se não existir (foi apagada), recria ela na hora.
    let target = document.getElementById('default-view');
    if (!target) {
        target = document.createElement('div');
        target.id = 'default-view';
        target.className = "h-full w-full flex flex-col items-center justify-center opacity-20 pointer-events-none select-none overflow-y-auto p-6";
        document.getElementById('content-container').appendChild(target);
    }
    
    target.classList.remove('hidden');
    target.innerHTML = `
        <i class="fas fa-tools text-[8rem] mb-6 text-slate-700"></i>
        <h2 class="font-cinzel text-4xl tracking-widest uppercase text-slate-500">${title}</h2>
        <p class="mt-4 text-xl uppercase tracking-tighter text-slate-600">Página em construção</p>
    `;
};

// --- ROLAGEM DE DADOS NA SIDEBAR LATERAL ---
window.rollDiceSidebar = async function(id, sides, label) {
    const charId = globalState.selectedCharacterId;
    if (!charId) return alert("Selecione um personagem primeiro!");

    const result = id === 'moeda' ? (Math.random() < 0.5 ? 'Cara' : 'Coroa') : Math.floor(Math.random() * sides) + 1;
    const novoLog = { dado: label, valor: result, timestamp: Date.now() };

    const ficha = globalState.selectedCharacterData.ficha;
    const logsAtuais = ficha.log_rolagens || [];
    logsAtuais.unshift(novoLog);
    if (logsAtuais.length > 50) logsAtuais.pop();
    ficha.log_rolagens = logsAtuais;

    window.renderSidebarDiceLog();

    try {
        await updateDoc(doc(db, "rpg_fichas", charId), {
            [`rolagens.${id}`]: result,
            log_rolagens: logsAtuais
        });
    } catch(e) { console.error("Erro ao rolar:", e); }
};

window.renderSidebarDiceLog = function() {
    const container = document.getElementById('sidebar-dice-log');
    if (!container) return;
    const logs = globalState.selectedCharacterData?.ficha?.log_rolagens || [];
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="text-slate-600 italic text-center text-[9px] py-4">Nenhuma rolagem.</div>';
        return;
    }
    
    container.innerHTML = logs.slice(0, 15).map(log => `
        <div class="flex justify-between items-center border-b border-slate-800 pb-1 mb-1">
            <span class="text-[8px] text-slate-500">${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
            <span class="text-slate-300 font-bold text-[9px]">${log.dado}</span>
            <span class="text-amber-400 font-black text-xs">${log.valor}</span>
        </div>
    `).join('');
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        globalState.currentUser = user;
        globalState.isAdmin = user.email === ADMIN_EMAIL;
        
        if (dom.auth_view) dom.auth_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('hidden');
        
        await loadCache();
        await preencherCachesEstaticos();
        initWorldHeader();
        await preencherCacheTodosPersonagens();
        await carregarPersonagensNoSeletor(user);
        
        setupMochilaListeners();
        setupConstelacaoListeners();
        setupCraftingListeners();
        setupExtracaoListeners();

        // Inicializa na aba "Ao Jogador" e abre a "Ficha de Personagem"
        window.setMasterContext('Ao Jogador');
        setTimeout(() => window.openFichaPersonagemMenu(), 200);

    } else {
        globalState.currentUser = null;
        globalState.isAdmin = false;
        if (dom.auth_view) dom.auth_view.classList.remove('hidden');
        if (dom.app_view) dom.app_view.classList.add('hidden');
        globalState.selectedCharacterId = null;
        globalState.selectedCharacterData = null;
        globalState.cache.personagens.clear();
        globalState.cache.all_personagens.clear();
    }
});

// --- GERENCIAMENTO DE CACHES ---
async function loadCache() {
    console.log("Iniciando carregamento do cache...");
    ['players', 'mobs', 'personagens', 'all_personagens'].forEach(key => {
        if (!globalState.cache[key]) globalState.cache[key] = new Map();
        else globalState.cache[key].clear();
    });

    try {
        const qP = query(collection(db, "rpg_fichas"));
        const snapP = await getDocs(qP);
        snapP.forEach(d => {
            const data = {id: d.id, type: 'player', collection: 'rpg_fichas', ...d.data()};
            globalState.cache.players.set(d.id, data);
            globalState.cache.all_personagens.set(d.id, data);
            if(globalState.isAdmin || data.jogadorUid === globalState.currentUser?.uid) {
                globalState.cache.personagens.set(d.id, data);
            }
        });
        
        const qM = query(collection(db, "rpg_fichasNPCMonstros"));
        const snapM = await getDocs(qM);
        snapM.forEach(d => globalState.cache.mobs.set(d.id, {id: d.id, type: 'monster', collection: 'rpg_fichasNPCMonstros', ...d.data()}));
    } catch(e) { console.error("Erro no loadCache:", e); }
}

document.addEventListener('DOMContentLoaded', () => {
    if(globalState.currentUser) window.setMasterContext('Início');
});

function renderMasterMenu() {
    const nav = document.getElementById('master-tabs');
    nav.innerHTML = '';
    
    Object.keys(MASTER_ARCHITECTURE).forEach(key => {
        const btn = document.createElement('button');
        btn.className = "px-6 py-2 rounded-md font-bold uppercase text-xs transition-all border border-slate-700 hover:border-amber-500 text-slate-400 hover:text-white";
        btn.textContent = key;
        btn.onclick = () => setContext(key);
        nav.appendChild(btn);
    });
}

window.setContext = function(masterKey) {
    const sidebar = document.getElementById('sub-menu-bar');
    sidebar.innerHTML = '';
    
    // Destacar botão master
    document.querySelectorAll('#master-tabs button').forEach(b => {
        b.classList.toggle('bg-amber-600', b.textContent === masterKey);
        b.classList.toggle('text-black', b.textContent === masterKey);
    });

    const config = MASTER_ARCHITECTURE[masterKey];
    if (config) {
        config.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = "group flex items-center h-12 px-4 w-full hover:bg-slate-800 transition-all border-l-4 border-transparent hover:border-amber-500 overflow-hidden";
            btn.innerHTML = `
                <i class="fas ${tab.icon} w-8 text-center text-lg text-slate-500 group-hover:text-amber-400 shrink-0"></i>
                <span class="ml-4 text-[10px] uppercase font-bold tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">${tab.label}</span>
            `;
            btn.onclick = () => {
                // Proteção extra: Só adiciona 'hidden' se o elemento existir no HTML
                const defaultView = document.getElementById('default-view');
                if(defaultView) defaultView.classList.add('hidden');
                
                tab.render();
            };
            sidebar.appendChild(btn);
        });
    }
};

// A função que faz a mágica das sub abas acontecer
window.setCategory = function(category) {
    const sidebar = document.getElementById('sub-menu-bar');
    if (!sidebar) return;

    // Limpa a barra lateral para injetar os novos ícones
    sidebar.innerHTML = '';
    
    // Esconde a tela de "boas-vindas"
    document.getElementById('default-view')?.classList.add('hidden');

    // Cria os botões para a categoria selecionada
    if (SIDEBAR_CONFIG[category]) {
        SIDEBAR_CONFIG[category].forEach(aba => {
            const btn = document.createElement('button');
            btn.className = 'sub-menu-btn group relative flex items-center h-12 w-full hover:bg-slate-800 transition-all border-l-4 border-transparent hover:border-amber-500';
            
            btn.innerHTML = `
                <div class="w-[60px] flex items-center justify-center shrink-0">
                    <i class="fas ${aba.icon} text-lg text-slate-400 group-hover:text-amber-400 transition-colors"></i>
                </div>
                <span class="sidebar-text opacity-0 group-hover:opacity-100 ml-2 font-bold text-[10px] uppercase tracking-widest text-slate-200 whitespace-nowrap transition-opacity duration-300">
                    ${aba.label}
                </span>
            `;
            
            btn.onclick = () => {
                // Estilo visual de "Ativo"
                document.querySelectorAll('.sub-menu-btn').forEach(b => b.classList.remove('active-aba'));
                btn.classList.add('active-aba');
                
                // Esconde todos os conteúdos antes de renderizar o novo
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                
                // Abre o container específico e chama o renderizador do arquivo .js correspondente
                const contentId = aba.id + '-content';
                document.getElementById(contentId)?.classList.remove('hidden');
                aba.render();
            };
            
            sidebar.appendChild(btn);
        });
    }

    // Marca o botão do menu superior como ativo
    document.querySelectorAll('.nav-context-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${category}'`));
    });
};

// Login Listeners
document.getElementById('btn-login').onclick = () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

async function preencherCachesEstaticos() {
    console.log(">>> [DEBUG] Iniciando preenchimento de caches...");
    
    const mapasNecessarios = [
        'profissoes', 'receitas', 'armasEspirituais', 'habilidadesEspirito',
        'pets', 'habilidadesPet', 'mobs', 'lojas', 'buildings', 'allies', 'allItems',
        'itemConfig', 'shopTiers', 'itemTiers', 'racas', 'classes', 'subclasses', 
        'habilidades', 'efeitos', 'tiposItens'
    ];
    
    mapasNecessarios.forEach(key => {
        if (!globalState.cache[key]) globalState.cache[key] = new Map();
    });

    const cargas = [
        { nome: 'rpg_item_tiers', mapa: globalState.cache.itemTiers },
        { nome: 'rpg_racas', mapa: globalState.cache.racas },
        { nome: 'rpg_classes', mapa: globalState.cache.classes },
        { nome: 'rpg_subclasses', mapa: globalState.cache.subclasses },
        { nome: 'rpg_habilidades', mapa: globalState.cache.habilidades },
        { nome: 'rpg_efeitosGerais', mapa: globalState.cache.efeitos },
        { nome: 'rpg_itemTipos', mapa: globalState.cache.tiposItens },
        { nome: 'rpg_itensCraftados', mapa: globalState.cache.receitas },
        { nome: 'rpg_profissoes', mapa: globalState.cache.profissoes },   
        { nome: 'rpg_armasEspirituais', mapa: globalState.cache.armasEspirituais },
        { nome: 'rpg_habilidadesEspirito', mapa: globalState.cache.habilidadesEspirito },
        { nome: 'rpg_pets', mapa: globalState.cache.pets },
        { nome: 'rpg_habilidadesPet', mapa: globalState.cache.habilidadesPet },
        { nome: 'rpg_fichasNPCMonstros', mapa: globalState.cache.mobs },
        { nome: 'rpg_estabelecimentos_templates', mapa: globalState.cache.buildings },
        { nome: 'rpg_aliados_templates', mapa: globalState.cache.allies },
        { nome: 'rpg_itensCadastrados', mapa: globalState.cache.allItems },
        { nome: 'rpg_lojas', mapa: globalState.cache.lojas },
        { nome: 'rpg_balanceamento_itens_precos_geral', mapa: globalState.cache.itemConfig },
        { nome: 'rpg_shop_tiers', mapa: globalState.cache.shopTiers }
    ];
    
    await Promise.all(cargas.map(async (item) => {
        if(item.mapa.size > 0) return; 
        try {
            const q = query(collection(db, item.nome));
            const snap = await getDocs(q);
            snap.forEach(d => item.mapa.set(d.id, {id: d.id, ...d.data()}));
        } catch (e) {
            console.error(`!!! ERRO ao carregar ${item.nome}:`, e);
        }
    }));

    if(globalState.cache.itens.size === 0) {
        const loadItens = async (col) => (await getDocs(query(collection(db, col)))).forEach(d => {
            if(!globalState.cache.itens.has(d.id)) globalState.cache.itens.set(d.id, {id: d.id, ...d.data()});
        });
        await Promise.all([loadItens('rpg_itensCadastrados'), loadItens('rpg_itensMochila')]);
    }

    if (!globalState.cache.tabela_xp) {
        const d = await getDoc(doc(db, "rpg_configuracoes", "tabela_xp"));
        if(d.exists()) globalState.cache.tabela_xp = d.data();
    }
    
    if (!globalState.cache.tabelaXpEspirito) {
        try {
            const d = await getDoc(doc(db, "rpg_tabelaXpEspirito", "padrao"));
            if(d.exists()) globalState.cache.tabelaXpEspirito = d.data();
        } catch(e) { }
    }

    if (!globalState.cache.tabelaXpPet) {
        try {
            const d = await getDoc(doc(db, "rpg_tabelaXpPet", "padrao"));
            if(d.exists()) globalState.cache.tabelaXpPet = d.data();
        } catch(e) { }
    }
    
    renderSlotsEquipamento();
    console.log(">>> [DEBUG] Caches preenchidos.");
}

async function preencherCacheTodosPersonagens() {
    if(globalState.cache.all_personagens.size > 0) return;
    (await getDocs(query(collection(db, "rpg_fichas"), orderBy("nome")))).forEach(d => globalState.cache.all_personagens.set(d.id, {id: d.id, ...d.data()}));
}

async function gatherAllCharacterData(charId) {
    const data = { 
        ficha: null, raca: {}, classe: {}, subclasse: {}, 
        itensEquipados: [], bonusItens: createBonusObject(), 
        tabelaXP: globalState.cache.tabela_xp || {}, constellationTemplate: null 
    };

    const charFullData = globalState.cache.all_personagens.get(charId);
    if(!charFullData) throw new Error("Ficha não encontrada");
    
    data.ficha = charFullData;

    if(charFullData.racaId) data.raca = globalState.cache.racas.get(charFullData.racaId) || {};
    if(charFullData.classeId) data.classe = globalState.cache.classes.get(charFullData.classeId) || {};
    if(charFullData.subclasseId) data.subclasse = globalState.cache.subclasses.get(charFullData.subclasseId) || {};

    if(charFullData.classeId) {
        try {
            const snap = await getDoc(doc(db, "rpg_constelacoes_templates", charFullData.classeId));
            if(snap.exists()) data.constellationTemplate = snap.data();
        } catch(e) { }
    }

    const equipMap = (charFullData.ficha && charFullData.ficha.equipamentos) ? charFullData.ficha.equipamentos : (charFullData.equipamentos || {});
    
    Object.values(equipMap).filter(id => id).forEach(id => {
        const item = globalState.cache.itens.get(id);
        if(item) {
            data.itensEquipados.push(item);
            
            data.bonusItens.atk += Number(item.atk_base || 0);
            data.bonusItens.def += Number(item.def_base || 0);
            data.bonusItens.eva += Number(item.eva_base || 0);

            ['hpMax','mpMax','iniciativa','movimento','apMax'].forEach(k => {
                const baseKey = k === 'apMax' ? 'ap_base' : (k === 'hpMax' ? 'hp_base' : (k === 'mpMax' ? 'mp_base' : `${k}_base`));
                data.bonusItens[k] += Number(item[baseKey] || 0);
            });

            if(item.efeitos_especiais) {
                for(const eid in item.efeitos_especiais) {
                    const val = Number(item.efeitos_especiais[eid] || 0);
                    const eff = globalState.cache.efeitos.get(eid);
                    if(eff) {
                        const map = {hp:'hpMax', mp:'mpMax', iniciativa:'iniciativa', velocidade:'movimento', movimento:'movimento', ap:'apMax', atk:'atk', def:'def', eva:'eva'};
                        const k = map[eff.tipoNome?.toLowerCase()];
                        if(k) data.bonusItens[k] += val;
                    }
                }
            }
        }
    });
    return data;
}

// --- NAVEGAÇÃO DE ABAS ---
let unsubscribeChar = null;
let unsubscribeSessions = null;

if (dom.tab_container) {
    dom.tab_container.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-button');
        if(btn) showTab(btn.dataset.tab);
    });
}

function showTab(tabId) {
    dom.tab_container.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    dom.content_container.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tabId}-content`));
    
    if (tabId === 'constelacao') {
        dom.content_container.style.padding = '0';
        dom.content_container.style.overflow = 'hidden'; 
        dom.content_container.style.height = '800px';
    } else {
        dom.content_container.style.padding = '1.5rem';
        dom.content_container.style.overflow = 'visible';
        dom.content_container.style.height = 'auto';
    }

    if(globalState.selectedCharacterId) {
        if(tabId === 'rolagem-dados') renderRolagemDados();
        else if(tabId === 'calculadora-combate') renderCalculadoraCombate();
        else if(tabId === 'minhas-habilidades') renderMinhasHabilidades();
        else if(tabId === 'mochila') renderMochila();
        else if(tabId === 'itens-equipados') renderItensEquipados();
        else if(tabId === 'calculadora-atributos') renderCalculadoraAtributos();
        else if(tabId === 'crafting') renderCraftingTab();
        else if(tabId === 'constelacao') renderConstelacaoTab(); 
        else if(tabId === 'extracao') renderExtracaoTab();
        else if(tabId === 'colecao-craft') renderCollectionTab();
        else if(tabId === 'arma-espiritual') renderArmaEspiritualTab();
        else if(tabId === 'meus-pets') renderPetsTab();
        else if(tabId === 'recursos-reputacao') renderReputacaoTab();
        else if (tabId === 'arena-combate') { if (window.arena && window.arena.init) window.arena.init(); }
        else if (tabId === 'mapa-movimento') setTimeout(() => window.renderMapTab(), 100);
        else if (tabId === 'comercio') {
            if(globalState.commerce) globalState.commerce.sellableCache = null;
            renderComercioTab();
        }
    }
}

// --- SELETOR DE PERSONAGEM E SINC ---
async function carregarPersonagensNoSeletor(user) {
    const select = dom.character_select;
    if(!select) return;
    
    select.innerHTML = '<option value="">-- Carregando... --</option>';
    globalState.cache.personagens.clear();

    globalState.cache.all_personagens.forEach((char, id) => {
         if (globalState.isAdmin || char.jogadorUid === user.uid) {
            globalState.cache.personagens.set(id, char);
         }
    });

    select.innerHTML = '<option value="">-- Selecione um Personagem --</option>';
    [...globalState.cache.personagens.values()].sort((a,b)=>(a.nome||'').localeCompare(b.nome)).forEach(c => {
        select.add(new Option(`${c.nome} (${c.jogador||'???'})`, c.id));
    });

    const lastId = localStorage.getItem('personagemAtivoId');
    if(lastId && globalState.cache.personagens.has(lastId)) {
        select.value = lastId;
        await handleCharacterSelect(lastId);
    } else {
        handleCharacterSelect("");
    }
}

if (dom.character_select) {
    dom.character_select.addEventListener('change', (e) => handleCharacterSelect(e.target.value));
}

function handleCharacterSelect(id) {
    window.listenToStorage(id);
    
    if(unsubscribeChar) {
        unsubscribeChar();
        unsubscribeChar = null;
    }
    
    updateCharacterSessions(id);

    if(!id) {
        globalState.selectedCharacterId = null;
        globalState.selectedCharacterData = null;
        localStorage.removeItem('personagemAtivoId');
        renderHeaderWidget();
        window.updateSidebarUI(); // Limpa a interface
        window.updateGlobalBars();
        if(window.renderSidebarDiceLog) window.renderSidebarDiceLog();
        
        // Descobre qual aba está visível no momento olhando as divs de conteúdo
        let activeTab = 'painel-fichas';
        document.querySelectorAll('.tab-content').forEach(c => {
            if (!c.classList.contains('hidden')) activeTab = c.id.replace('-content', '');
        });
        
        if(activeTab === 'painel-fichas') renderPainelFichas();
        return;
    }

    globalState.selectedCharacterId = id;
    localStorage.setItem('personagemAtivoId', id);

    unsubscribeChar = onSnapshot(doc(db, "rpg_fichas", id), async (docSnap) => {
        if(docSnap.exists()) {
            const fichaAtualizada = { id: docSnap.id, ...docSnap.data() };
            globalState.cache.all_personagens.set(id, fichaAtualizada);
            
            globalState.selectedCharacterData = await gatherAllCharacterData(id);
            window.updateSidebarUI(); // Puxa e exibe dados (Foto, Nome, ATK, DEF, EVA)
            window.updateGlobalBars();
            
            if(window.renderSidebarDiceLog) window.renderSidebarDiceLog();
            
            // Descobre qual aba está visível no momento
            let activeTab = 'painel-fichas';
            document.querySelectorAll('.tab-content').forEach(c => {
                if (!c.classList.contains('hidden')) activeTab = c.id.replace('-content', '');
            });
            
            if(activeTab === 'painel-fichas') {
                // Se o editor de ficha JÁ ESTIVER ABERTO, não recarrega a tela para não perder o que você está digitando
                if (!document.getElementById('editor-nome')) {
                    renderPainelFichas(); 
                }
            } 
            else if(activeTab === 'constelacao') renderConstelacaoTab();
            else if(activeTab === 'arma-espiritual') renderArmaEspiritualTab();
            else if(activeTab === 'meus-pets') renderPetsTab();
            else if(activeTab === 'itens-equipados') renderItensEquipados();
            else if(activeTab === 'calculadora-atributos') renderCalculadoraAtributos();
            else if(activeTab === 'mochila') renderMochila();
            else if(activeTab === 'minhas-habilidades') {
                renderMinhasHabilidades();
                if(window.renderSkillUsageLogs) window.renderSkillUsageLogs(); 
            }
            else if(activeTab === 'calculadora-combate') renderCalculadoraCombate();
            else if(activeTab === 'recursos-reputacao') renderReputacaoTab();
            else if(activeTab === 'comercio') {
                if(globalState.commerce) globalState.commerce.sellableCache = null;
                renderComercioTab();
            }
        }
    });
}

// NOVA FUNÇÃO: Preenche Foto, Nome, Classe e Subclasse na Lateral
window.updateSidebarUI = function() {
    const data = globalState.selectedCharacterData;
    
    if (!data || !data.ficha) {
        document.getElementById('sidebar-char-name').textContent = '---';
        document.getElementById('sidebar-char-class').textContent = '---';
        document.getElementById('sidebar-char-subclass').textContent = '---';
        document.getElementById('sidebar-char-img').src = 'https://placehold.co/400x400/0f172a/d4af37?text=Sem+Foto';
        document.getElementById('sidebar-stat-atk').textContent = '0';
        document.getElementById('sidebar-stat-def').textContent = '0';
        document.getElementById('sidebar-stat-eva').textContent = '0';
        return;
    }

    const f = data.ficha;
    document.getElementById('sidebar-char-name').textContent = f.nome || 'Sem Nome';
    document.getElementById('sidebar-char-class').textContent = data.classe?.nome || 'Sem Classe';
    document.getElementById('sidebar-char-subclass').textContent = data.subclasse?.nome || 'Sem Subc.';

    const imgKey = f.imagemPrincipal;
    const imgUrl = (imgKey && f.imageUrls && f.imageUrls[imgKey]) ? f.imageUrls[imgKey] : (f.imagemUrl || 'https://placehold.co/400x400/0f172a/d4af37?text=Sem+Foto');
    document.getElementById('sidebar-char-img').src = imgUrl;

    // ATK, DEF e EVA (Puxa o valor total já calculado salvo na ficha)
    document.getElementById('sidebar-stat-atk').textContent = f.atkPersonagemBase || 0;
    document.getElementById('sidebar-stat-def').textContent = f.defPersonagemBase || 0;
    document.getElementById('sidebar-stat-eva').textContent = f.evaPersonagemBase || 0;
};

// --- BARRAS GLOBAIS DE STATUS (LATERAL) ---
window.updateGlobalBars = function() {
    const charId = globalState.selectedCharacterId;
    const containerHdr = document.getElementById('header-bars-container');
    
    if (!charId || !globalState.selectedCharacterData) {
        if(containerHdr) containerHdr.classList.add('hidden');
        return;
    }
    if(containerHdr) containerHdr.classList.remove('hidden');

    const ficha = globalState.selectedCharacterData.ficha;
    const atributos = ficha.atributosBasePersonagem || {};
    
    const hpMax = Number(ficha.hpMaxPersonagemBase) || 1; 
    const hpShieldMax = Number(atributos.defesaCorporalNativaTotal) || 0; 
    const hpAtual = ficha.hpPersonagemBase !== undefined ? Number(ficha.hpPersonagemBase) : hpMax;
    const hpShieldAtual = ficha.hpShieldAtual !== undefined ? Number(ficha.hpShieldAtual) : hpShieldMax;

    const mpMax = Number(ficha.mpMaxPersonagemBase) || 1; 
    const mpShieldMax = Number(atributos.defesaMagicaNativaTotal) || 0; 
    const mpAtual = ficha.mpPersonagemBase !== undefined ? Number(ficha.mpPersonagemBase) : mpMax;
    const mpShieldAtual = ficha.mpShieldAtual !== undefined ? Number(ficha.mpShieldAtual) : mpShieldMax;

    const pctHpBase = Math.min(100, Math.max(0, (hpAtual / hpMax) * 100));
    const pctHpShield = hpShieldMax > 0 ? Math.min(100, Math.max(0, (hpShieldAtual / hpShieldMax) * 100)) : 0;
    const pctMpBase = Math.min(100, Math.max(0, (mpAtual / mpMax) * 100));
    const pctMpShield = mpShieldMax > 0 ? Math.min(100, Math.max(0, (mpShieldAtual / mpShieldMax) * 100)) : 0;

    const setWidth = (id, pct) => { const el = document.getElementById(id); if(el) el.style.width = `${pct}%`; };
    setWidth('hdr-hp-base', pctHpBase);
    setWidth('hdr-hp-shield', pctHpShield);
    setWidth('hdr-mp-base', pctMpBase);
    setWidth('hdr-mp-shield', pctMpShield);

    const txtHpHdr = document.getElementById('hdr-hp-text');
    if(txtHpHdr) txtHpHdr.textContent = `${Math.max(0, hpAtual + hpShieldAtual)}/${hpMax + hpShieldMax}`;

    const txtMpHdr = document.getElementById('hdr-mp-text');
    if(txtMpHdr) txtMpHdr.textContent = `${Math.max(0, mpAtual + mpShieldAtual)}/${mpMax + mpShieldMax}`;
    
    const fomeExtra = Number(atributos.pontosFomeExtraTotal) || 0;
    const fomeMax = Math.floor(100 + fomeExtra);
    let fomeAtual = ficha.fomeAtual !== undefined ? Number(ficha.fomeAtual) : fomeMax;
    if (fomeAtual > fomeMax) fomeAtual = fomeMax;

    setWidth('bar-fome-fill', Math.max(0, Math.min(100, (fomeAtual / fomeMax) * 100)));
    
    const fomeText = document.getElementById('hdr-fome-text');
    if (fomeText) {
        fomeText.textContent = `${Math.floor(fomeAtual)}/${fomeMax}`;
        if (fomeAtual < 50) {
            fomeText.classList.replace('text-white', 'text-red-400');
            fomeText.classList.add('animate-pulse');
        } else {
            fomeText.classList.replace('text-red-400', 'text-white');
            fomeText.classList.remove('animate-pulse');
        }
    }
};

// --- GESTÃO DE SESSÕES ---
async function updateCharacterSessions(charId) {
    const sessionSelect = document.getElementById('session-select');
    const container = document.getElementById('session-selector-container');
    
    if (unsubscribeSessions) {
        unsubscribeSessions();
        unsubscribeSessions = null;
    }

    if (!charId) {
        if(container) container.classList.add('hidden');
        return;
    }

    const lastSavedSession = localStorage.getItem(`sessaoAtiva_${charId}`) || "world";
    globalState.activeSessionId = lastSavedSession;

    const q = query(collection(db, "rpg_sessions"), where("playerIds", "array-contains", charId));

    unsubscribeSessions = onSnapshot(q, (snap) => {
        globalState.userSessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (globalState.userSessions.length > 0) {
            if(container) container.classList.remove('hidden');
            
            if(sessionSelect) {
                sessionSelect.innerHTML = '<option value="world">🌍 Horário Mundial</option>';
                globalState.userSessions.forEach(sess => {
                    sessionSelect.add(new Option(`👥 ${sess.name}`, sess.id));
                });

                sessionSelect.value = globalState.activeSessionId;

                if (globalState.activeSessionId !== "world" && !globalState.userSessions.find(s => s.id === globalState.activeSessionId)) {
                    sessionSelect.value = "world";
                    globalState.activeSessionId = "world";
                    localStorage.setItem(`sessaoAtiva_${charId}`, "world");
                }
            }
        } else {
            if(container) container.classList.add('hidden');
            globalState.activeSessionId = "world";
        }
        
        renderHeaderWidget();
    });
}

document.addEventListener('change', (e) => {
    if(e.target && e.target.id === 'session-select') {
        const charId = globalState.selectedCharacterId;
        const selectedValue = e.target.value;
        
        globalState.activeSessionId = selectedValue;
        if(charId) localStorage.setItem(`sessaoAtiva_${charId}`, selectedValue);
        
        renderHeaderWidget();
        
        const arenaTab = document.getElementById('arena-combate-content');
        if (arenaTab && !arenaTab.classList.contains('hidden') && arenaTab.style.display !== 'none') {
            if (window.arena && window.arena.init) window.arena.init();
        }
    }
});

// --- HEADER DO MUNDO ---
window.getSessionTimeAndPeriod = function() {
    let w = globalState.world.data || { time: "12:00" };
    
    if (globalState.activeSessionId && globalState.activeSessionId !== 'world') {
        const sess = globalState.userSessions.find(s => s.id === globalState.activeSessionId);
        if (sess && sess.customTime) {
            w = { time: sess.customTime };
        }
    }

    const time = w.time || "12:00";
    const h = parseInt(time.split(':')[0]);
    
    let period = "Madrugada";
    if (h >= 6 && h < 12) period = "Manhã";
    else if (h >= 12 && h < 18) period = "Tarde";
    else if (h >= 18) period = "Noite";

    return { time, period };
}

function initWorldHeader() {
    onSnapshot(doc(db, 'rpg_world_state', 'main'), (snap) => {
        if (snap.exists()) {
            globalState.world.data = snap.data();
            renderHeaderWidget();
        }
    });

    onSnapshot(query(collection(db, 'rpg_locations'), orderBy('name')), (snap) => {
        globalState.world.locations = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (!globalState.world.selectedLocId && globalState.world.locations.length > 0) {
            globalState.world.selectedLocId = globalState.world.locations[0].id;
        }
        renderHeaderWidget();
    });

    onSnapshot(collection(db, 'rpg_events'), (snap) => {
        globalState.world.events = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderHeaderWidget();
    });

    onSnapshot(collection(db, 'rpg_seasons'), (snap) => {
        globalState.world.seasons = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderHeaderWidget();
    });
}

function renderHeaderWidget() {
    const container = document.getElementById('header-world-widget');
    if (!container || !globalState.world.data) return;

    const w = globalState.world.data;
    let timeDisplay = w.time || "12:00";
    let dayDisplay = w.day || "1";
    let monthDisplay = w.month || "1";
    let yearDisplay = w.year || "1000";
    let isCustomSession = false;

    if (globalState.activeSessionId && globalState.activeSessionId !== "world") {
        const session = globalState.userSessions.find(s => s.id === globalState.activeSessionId);
        if (session) {
            timeDisplay = session.customTime || timeDisplay;
            dayDisplay = session.customDay || dayDisplay;
            isCustomSession = true;
        }
    }

    const MOON_PHASES = [
        { name: "Lua Nova", icon: "fa-circle", color: "#334155" },
        { name: "Lua Crescente", icon: "fa-moon", color: "#94a3b8" }, 
        { name: "Quarto Crescente", icon: "fa-moon", color: "#cbd5e1" },
        { name: "Lua Gibosa", icon: "fa-circle", color: "#e2e8f0" },
        { name: "Lua Cheia", icon: "fa-circle", color: "#ffffff" },
        { name: "Lua Disseminadora", icon: "fa-circle", color: "#e2e8f0" },
        { name: "Quarto Minguante", icon: "fa-moon", color: "#cbd5e1" },
        { name: "Lua Minguante", icon: "fa-moon", color: "#94a3b8" },
        { name: "Eclipse", icon: "fa-circle", color: "#ef4444" },
        { name: "Convergência", icon: "fa-star", color: "#a855f7" }
    ];
    const totalDays = (Number(yearDisplay) * 360) + (Number(monthDisplay) * 30) + Number(dayDisplay);
    let moon = MOON_PHASES[Math.floor((totalDays % 28) / 3.5)] || MOON_PHASES[0];
    const seasonName = globalState.world.seasons?.find(s => s.id === w.seasonId)?.name || "---";

    // Widget compacto focado no Top Nav
    container.innerHTML = `
        <div class="flex items-center gap-4 animate-fade-in mr-4">
            <div class="text-right">
                <div class="text-lg font-mono font-bold ${isCustomSession ? 'text-indigo-400' : 'text-white'} leading-none">${timeDisplay}</div>
                <div class="text-[9px] ${isCustomSession ? 'text-indigo-500' : 'text-amber-500'} font-bold uppercase tracking-widest mt-0.5">
                    ${isCustomSession ? '<i class="fas fa-users"></i> SESSÃO' : 'MUNDIAL'} • ${dayDisplay}/${monthDisplay}/${yearDisplay}
                </div>
            </div>
            <div class="h-6 w-[1px] bg-slate-700"></div>
            <div class="text-center w-16">
                <div class="text-sm" title="${moon.name}"><i class="fas ${moon.icon}" style="color: ${moon.color}"></i></div>
                <div class="text-[8px] text-slate-400 uppercase font-bold">${seasonName}</div>
            </div>
        </div>
    `;
}

window.updateHeaderLoc = function(id) {
    globalState.world.selectedLocId = id;
    renderHeaderWidget();
};

// --- ARMAZENAMENTO CENTRAL DA REPUTAÇÃO ---
window.listenToStorage = function(charId) {
    if (globalState.storageUnsubscribe) {
        globalState.storageUnsubscribe();
        globalState.storageUnsubscribe = null;
    }
    if (!charId) return;

    globalState.storageUnsubscribe = onSnapshot(doc(db, "rpg_armazenamentos", charId), (docSnap) => {
        if (docSnap.exists()) {
            globalState.currentStorage = docSnap.data().itens || {};
        } else {
            globalState.currentStorage = {};
        }
        if (globalState.recursosUI && globalState.recursosUI.abaAtiva === 'armazenamento') {
            if (window.renderStorageTab) window.renderStorageTab();
        }
    });
};

window.migrateTempToStorage = async function(charId, estoqueTemporario) {
    if (!estoqueTemporario || Object.keys(estoqueTemporario).length === 0) return;
    
    try {
        const batch = writeBatch(db);
        const charRef = doc(db, "rpg_fichas", charId);
        const storageRef = doc(db, "rpg_armazenamentos", charId);
        
        batch.update(charRef, { "recursos.estoqueTemporario": {} });
        
        const storageSnap = await getDoc(storageRef);
        let storageItens = storageSnap.exists() ? (storageSnap.data().itens || {}) : {};
        
        for (let [itemId, qtd] of Object.entries(estoqueTemporario)) {
            storageItens[itemId] = (storageItens[itemId] || 0) + qtd;
        }
        
        batch.set(storageRef, { itens: storageItens }, { merge: true });
        await batch.commit();
        
        console.log("Migração de itens temporários para o Armazenamento Central concluída!");
        alert("Seus itens do inventário temporário foram movidos para o Armazenamento Central!");
    } catch (e) {
        console.error("Erro na migração:", e);
    }
};

window.syncStorage = async function() {
    const charId = globalState.selectedCharacterId;
    const cart = globalState.transferCart;
    
    if (Object.keys(cart.toStorage).length === 0 && Object.keys(cart.toMochila).length === 0) {
        return alert("Nenhum item selecionado para transferência.");
    }

    const btn = document.getElementById('btn-sync-storage');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando...'; }
 
    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const storageRef = doc(db, "rpg_armazenamentos", charId);
            
            const [charSnap, storageSnap] = await Promise.all([t.get(charRef), t.get(storageRef)]);
            if (!charSnap.exists()) throw "Personagem não encontrado.";
            
            const fichaData = charSnap.data();
            let mochila = fichaData.mochila || {};
            let storageItens = storageSnap.exists() ? (storageSnap.data().itens || {}) : {};

            for (let [id, qty] of Object.entries(cart.toStorage)) {
                if (!mochila[id] || mochila[id] < qty) throw `Você não tem quantidade suficiente na mochila.`;
                mochila[id] -= qty;
                if (mochila[id] <= 0) delete mochila[id];
                storageItens[id] = (storageItens[id] || 0) + qty;
            }

            for (let [id, qty] of Object.entries(cart.toMochila)) {
                if (!storageItens[id] || storageItens[id] < qty) throw `Você não tem quantidade suficiente no armazenamento.`;
                storageItens[id] -= qty;
                if (storageItens[id] <= 0) delete storageItens[id];
                mochila[id] = (mochila[id] || 0) + qty;
            }

            t.update(charRef, { mochila: mochila });
            t.set(storageRef, { itens: storageItens }, { merge: true });
        });

        globalState.transferCart = { toStorage: {}, toMochila: {} };
        alert("Sincronização concluída com sucesso!");
        if (window.renderStorageTab) window.renderStorageTab();
        if (window.renderMochila) window.renderMochila();

    } catch(e) {
        console.error(e);
        alert("Erro na transferência: " + e);
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Tudo'; }
    }
}; 

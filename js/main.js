// ARQUIVO: js/main.js

import { auth, db, storage, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, getDocs, doc, getDoc, onSnapshot, query, where, orderBy, writeBatch, runTransaction, deleteField, increment, updateDoc } from './core/firebase.js';
import { globalState, ADMIN_EMAIL, PLACEHOLDER_IMAGE_URL, COINS } from './core/state.js';
import { createBonusObject } from './core/calculos.js';

import { renderPainelFichas, renderFichaEditor } from './tabs/painelFichas.js';
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

// --- FUNÇÃO GLOBAL DE RENDERIZAÇÃO DE ABAS ---
window.showTab = function(tabId) {
    // Esconde todas as abas
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    
    // Esconde a div de página em construção
    const defaultView = document.getElementById('default-view');
    if (defaultView) defaultView.classList.add('hidden');

    // Mostra a aba alvo
    const target = document.getElementById(`${tabId}-content`);
    if (target) target.classList.remove('hidden');

    // Executa a lógica da aba correta
    if (tabId === 'painel-fichas') {
        if (globalState.selectedCharacterId) {
            renderFichaEditor(globalState.selectedCharacterId);
        } else {
            renderPainelFichas();
        }
    } else if (globalState.selectedCharacterId) {
        if(tabId === 'rolagem-dados') renderRolagemDados();
        else if(tabId === 'calculadora-combate') renderCalculadoraCombate();
        else if(tabId === 'minhas-habilidades') { renderMinhasHabilidades(); if(window.renderSkillUsageLogs) window.renderSkillUsageLogs(); }
        else if(tabId === 'mochila') renderMochila();
        else if(tabId === 'itens-equipados') renderItensEquipados();
        else if(tabId === 'calculadora-atributos') renderCalculadoraAtributos();
        else if(tabId === 'constelacao') renderConstelacaoTab(); 
        else if(tabId === 'crafting') renderCraftingTab();
        else if(tabId === 'extracao') renderExtracaoTab();
        else if(tabId === 'colecao-craft') renderCollectionTab();
        else if(tabId === 'arma-espiritual') renderArmaEspiritualTab();
        else if(tabId === 'meus-pets') renderPetsTab();
        else if(tabId === 'recursos-reputacao') renderReputacaoTab();
        else if(tabId === 'comercio') { if(globalState.commerce) globalState.commerce.sellableCache = null; renderComercioTab(); }
        else if(tabId === 'mapa-movimento') { setTimeout(() => window.renderMapTab(), 100); }
        else if(tabId === 'arena-combate') { if (window.arena && window.arena.init) window.arena.init(); }
    } else {
        if (target) target.innerHTML = '<div class="flex h-full items-center justify-center text-slate-500"><p>Selecione um personagem na barra lateral.</p></div>';
    }
};

window.renderBlankPage = function(title) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    
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

// --- AUTENTICAÇÃO ---
dom.btn_login?.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, dom.auth_email.value, dom.auth_password.value)
        .catch(err => alert("Erro no login: " + err.message));
});

dom.btn_logout?.addEventListener('click', () => signOut(auth));

// --- MENUS LATERAIS E MASTER ARCHITECTURE ---
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
        { id: 'blank', icon: 'fa-scroll', label: 'Lore personagens', render: () => window.renderBlankPage('Lore personagens') }
    ],
    'Ao Jogador': [
        { id: 'blank', icon: 'fa-flask', label: 'Simular Ficha', render: () => window.renderBlankPage('Simular Ficha') },
        { id: 'ficha-menu', icon: 'fa-id-card', label: 'Ficha de Personagem', render: () => {
            populateSidebar(FICHA_TABS, true);
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

const FICHA_TABS = [
    { id: 'painel-fichas', icon: 'fa-user', label: 'Painel de Ficha', render: () => window.showTab('painel-fichas') },
    { id: 'rolagem-dados', icon: 'fa-dice-d20', label: 'Rolagem de Dados', render: () => window.showTab('rolagem-dados') },
    { id: 'minhas-habilidades', icon: 'fa-fire', label: 'Minhas Habilidades', render: () => window.showTab('minhas-habilidades') },
    { id: 'mochila', icon: 'fa-briefcase', label: 'Mochila', render: () => window.showTab('mochila') },
    { id: 'itens-equipados', icon: 'fa-tshirt', label: 'Itens Equipados', render: () => window.showTab('itens-equipados') },
    { id: 'calculadora-atributos', icon: 'fa-chart-bar', label: 'Status Base', render: () => window.showTab('calculadora-atributos') },
    { id: 'constelacao', icon: 'fa-star', label: 'Constelação', render: () => window.showTab('constelacao') },
    { id: 'crafting', icon: 'fa-hammer', label: 'Oficina de Criação', render: () => window.showTab('crafting') },
    { id: 'extracao', icon: 'fa-recycle', label: 'Extração e Reciclagem', render: () => window.showTab('extracao') },
    { id: 'colecao-craft', icon: 'fa-book-atlas', label: 'Diário de Coleção', render: () => window.showTab('colecao-craft') },
    { id: 'arma-espiritual', icon: 'fa-ghost', label: 'Arma Espiritual', render: () => window.showTab('arma-espiritual') },
    { id: 'meus-pets', icon: 'fa-dragon', label: 'Meus Pets', render: () => window.showTab('meus-pets') },
    { id: 'recursos-reputacao', icon: 'fa-crown', label: 'Império (Recursos)', render: () => window.showTab('recursos-reputacao') },
    { id: 'comercio', icon: 'fa-coins', label: 'Comércio Local', render: () => window.showTab('comercio') },
    { id: 'mapa-movimento', icon: 'fa-map-marked-alt', label: 'Mapa Mundi', render: () => window.showTab('mapa-movimento') },
    { id: 'arena-combate', icon: 'fa-chess-board', label: 'Arena de Combate', render: () => window.showTab('arena-combate') }
];

window.setMasterContext = function(menuName) {
    document.querySelectorAll('#global-top-nav button').forEach(b => {
        b.classList.toggle('border-amber-500', b.textContent.trim().startsWith(menuName));
        b.classList.toggle('text-amber-500', b.textContent.trim().startsWith(menuName));
        b.classList.toggle('border-transparent', !b.textContent.trim().startsWith(menuName));
        b.classList.toggle('text-slate-300', !b.textContent.trim().startsWith(menuName));
    });

    if (MASTER_ARCHITECTURE[menuName]) {
        populateSidebar(MASTER_ARCHITECTURE[menuName], false);
        const firstBtn = document.querySelector('#sub-menu-bar button');
        if (firstBtn) firstBtn.click();
    }
};

function populateSidebar(subAbaArray, isFichaMenu = false) {
    const sidebar = document.getElementById('sub-menu-bar');
    if(!sidebar) return;
    sidebar.innerHTML = '';

    if (isFichaMenu) {
        const backBtn = document.createElement('button');
        backBtn.className = "flex items-center w-full px-4 py-3 hover:bg-slate-800 transition-all border-l-4 border-red-500 overflow-hidden group bg-slate-900/50 mb-2";
        backBtn.innerHTML = `
            <div class="w-6 flex items-center justify-center shrink-0"><i class="fas fa-arrow-left text-lg text-red-500 group-hover:text-red-400 transition-colors"></i></div>
            <span class="ml-3 text-[10px] font-bold uppercase tracking-widest text-red-400 opacity-80 group-hover:opacity-100 transition-opacity text-left">Voltar ao Menu</span>
        `;
        backBtn.onclick = () => window.setMasterContext('Ao Jogador');
        sidebar.appendChild(backBtn);
    }

    subAbaArray.forEach(subAba => {
        const btn = document.createElement('button');
        btn.className = "flex items-center w-full px-4 py-2.5 hover:bg-slate-800 transition-all border-l-4 border-transparent hover:border-amber-500 overflow-hidden group";
        btn.innerHTML = `
            <div class="w-6 flex items-center justify-center shrink-0">
                <i class="fas ${subAba.icon} text-lg text-slate-500 group-hover:text-amber-400 transition-colors"></i>
            </div>
            <span class="ml-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 opacity-80 group-hover:opacity-100 transition-opacity text-left">
                ${subAba.label}
            </span>
        `;

        btn.onclick = () => {
            document.querySelectorAll('#sub-menu-bar button').forEach(b => {
                if(!b.classList.contains('border-red-500')) {
                    b.classList.remove('bg-slate-800', 'border-amber-500');
                    b.classList.add('border-transparent');
                    const icon = b.querySelector('i');
                    if (icon) icon.classList.replace('text-amber-500', 'text-slate-500');
                }
            });
            btn.classList.add('bg-slate-800', 'border-amber-500');
            btn.classList.remove('border-transparent');
            const clickedIcon = btn.querySelector('i');
            if (clickedIcon) clickedIcon.classList.replace('text-slate-500', 'text-amber-500');
            
            subAba.render();
        };
        sidebar.appendChild(btn);
    });
}

// Vincula os cliques do menu superior do HTML à função de contexto
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#global-top-nav button').forEach(btn => {
        if(btn.id !== 'btn-logout') {
            btn.addEventListener('click', (e) => {
                const text = e.target.textContent.trim();
                let targetContext = 'Início';
                if(text.includes('O Mundo')) targetContext = 'O Mundo';
                if(text.includes('Manual')) targetContext = 'Manual e Regras';
                if(text.includes('Ao Mestre')) targetContext = 'Ao Mestre';
                if(text.includes('Ao Jogador')) targetContext = 'Ao Jogador';
                if(text.includes('Atualizações')) targetContext = 'Atualizações';
                
                window.setMasterContext(targetContext);
            });
        }
    });
});

// Inicialização Principal
onAuthStateChanged(auth, async (user) => {
    if (user) {
        globalState.currentUser = user;
        globalState.isAdmin = user.email === ADMIN_EMAIL;
        
        if (dom.auth_view) dom.auth_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('hidden');
        if (dom.app_view) dom.app_view.classList.add('flex');
        
        await loadCache();
        await preencherCachesEstaticos();
        initWorldHeader();
        await preencherCacheTodosPersonagens();
        await carregarPersonagensNoSeletor(user);
        
        if (typeof setupMochilaListeners === 'function') setupMochilaListeners();
        if (typeof setupConstelacaoListeners === 'function') setupConstelacaoListeners();
        if (typeof setupCraftingListeners === 'function') setupCraftingListeners();
        if (typeof setupExtracaoListeners === 'function') setupExtracaoListeners();

        // Inicia
        window.setMasterContext('Ao Jogador');
        setTimeout(() => window.openFichaPersonagemMenu(), 200);
    } else {
        globalState.currentUser = null;
        globalState.isAdmin = false;
        if (dom.auth_view) dom.auth_view.classList.remove('hidden');
        if (dom.app_view) dom.app_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('flex');
        globalState.selectedCharacterId = null;
        globalState.selectedCharacterData = null;
        globalState.cache.personagens.clear();
        globalState.cache.all_personagens.clear();
    }
});

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
    
    if (typeof renderSlotsEquipamento === 'function') renderSlotsEquipamento();
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

// --- SELETOR DE PERSONAGEM E SINC ---
async function carregarPersonagensNoSeletor(user) {
    const select = document.getElementById('character-select');
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

if (document.getElementById('character-select')) {
    document.getElementById('character-select').addEventListener('change', (e) => handleCharacterSelect(e.target.value));
}

let unsubscribeChar = null;
let unsubscribeSessions = null;

function handleCharacterSelect(id) {
    if (window.listenToStorage) window.listenToStorage(id);
    
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
        if (window.updateSidebarUI) window.updateSidebarUI(); 
        if (window.updateGlobalBars) window.updateGlobalBars();
        if(window.renderSidebarDiceLog) window.renderSidebarDiceLog();
        
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
            if (window.updateSidebarUI) window.updateSidebarUI();
            if (window.updateGlobalBars) window.updateGlobalBars();
            
            if(window.renderSidebarDiceLog) window.renderSidebarDiceLog();
            
            let activeTab = 'painel-fichas';
            document.querySelectorAll('.tab-content').forEach(c => {
                if (!c.classList.contains('hidden')) activeTab = c.id.replace('-content', '');
            });
            
            if(activeTab === 'painel-fichas') {
                if (!document.getElementById('editor-nome')) renderFichaEditor(id); 
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
    const w = globalState.world.data;
    if (!w) return;

    let timeDisplay = w.time || "12:00";
    let dayDisplay = w.day || "1";
    let monthDisplay = w.month || "1";
    let yearDisplay = w.year || "1000";

    if (globalState.activeSessionId && globalState.activeSessionId !== "world") {
        const session = globalState.userSessions.find(s => s.id === globalState.activeSessionId);
        if (session) {
            timeDisplay = session.customTime || timeDisplay;
            dayDisplay = session.customDay || dayDisplay;
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

    const activeLocId = globalState.world.selectedLocId;
    const location = globalState.world.locations?.find(l => l.id === activeLocId);
    let weather = 'Céu Limpo';
    let isDanger = false;

    if (location && location.x !== undefined && location.y !== undefined) {
        const localEvents = (globalState.world.events || []).filter(ev => {
            const distance = Math.sqrt(Math.pow(Number(location.x) - Number(ev.x), 2) + Math.pow(Number(location.y) - Number(ev.y), 2));
            return distance <= (ev.radius || 0);
        });
        if (localEvents.length > 0) {
            weather = localEvents[0].name;
            isDanger = true;
        }
    }

    const tEl = document.getElementById('sidebar-world-time');
    if(tEl) tEl.textContent = timeDisplay;
    
    const lEl = document.getElementById('sidebar-location');
    if(lEl) lEl.textContent = location ? location.name : "Desconhecido";
    
    const wEl = document.getElementById('sidebar-weather');
    if(wEl) {
        wEl.textContent = weather;
        wEl.className = `text-[9px] font-mono truncate block mt-0.5 ${isDanger ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`;
    }
}
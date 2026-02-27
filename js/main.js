import { auth, db, storage, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, getDocs, doc, getDoc, onSnapshot, query, where, orderBy, writeBatch, runTransaction, deleteField, increment } from './core/firebase.js';
import { globalState, ADMIN_EMAIL, PLACEHOLDER_IMAGE_URL, COINS } from './core/state.js';
import { createBonusObject } from './core/calculos.js';

// --- IMPORTAÇÃO DE TODAS AS ABAS ---
import { renderPainelFichas } from './tabs/painelFichas.js';
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
import './tabs/arena.js'; // Apenas importa para instanciar window.arena

// --- SETUP DO DOM ---
const dom = {};
document.querySelectorAll('[id]').forEach(el => dom[el.id.replace(/-/g, '_')] = el);

// --- EXPORTAÇÕES GLOBAIS PARA AS ABAS ---
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

dom.btn_logout?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        globalState.currentUser = user;
        globalState.isAdmin = user.email === ADMIN_EMAIL;
        
        if (dom.auth_view) dom.auth_view.classList.add('hidden');
        if (dom.app_view) dom.app_view.classList.remove('hidden');
        
        const navAoMestre = document.getElementById('nav-ao-mestre');
        if (navAoMestre) {
            if (globalState.isAdmin) {
                navAoMestre.classList.remove('hidden');
            } else {
                navAoMestre.classList.add('hidden');
            }
        }
        
        await loadCache();
        await preencherCachesEstaticos();
        initWorldHeader();
        await preencherCacheTodosPersonagens();
        await carregarPersonagensNoSeletor(user);
        
        // Inicializa listeners estáticos das abas que precisam
        setupMochilaListeners();
        setupConstelacaoListeners();
        setupCraftingListeners();
        setupExtracaoListeners();

        renderPainelFichas();
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
    
    // Garante que os objetos de cache existam antes de tentar limpar
    const keysToClear = ['players', 'mobs', 'personagens', 'all_personagens'];
    keysToClear.forEach(key => {
        if (!globalState.cache[key]) {
            globalState.cache[key] = new Map();
        } else {
            globalState.cache[key].clear();
        }
    });

    try {
        const qP = query(collection(db, "rpg_fichas"));
        const snapP = await getDocs(qP);
        // ... restante da lógica de preenchimento do cache
    } catch (error) {
        console.error("Erro ao carregar cache:", error);
    }
}

// Lógica para alternar a barra lateral baseada no menu superior
const SIDEBAR_CONFIG = {
    'inicio': [
        { id: 'painel-fichas', icon: 'fa-id-card', label: 'Gestão de Fichas', render: () => renderPainelFichas() },
        { id: 'rolagem-dados', icon: 'fa-dice-d20', label: 'Log de Dados', render: () => renderRolagemDados() }
    ],
    'mundo': [
        { id: 'mapa-movimento', icon: 'fa-map-marked-alt', label: 'Mapa Mundi', render: () => renderMapaTab() },
        { id: 'colecao-craft', icon: 'fa-book-atlas', label: 'Enciclopédia', render: () => renderCollectionTab() },
        { id: 'recursos-reputacao', icon: 'fa-crown', label: 'Império', render: () => renderReputacaoTab() }
    ],
    'personagem': [
        { id: 'itens-equipados', icon: 'fa-tshirt', label: 'Equipamentos', render: () => renderItensEquipados() },
        { id: 'mochila', icon: 'fa-briefcase', label: 'Mochila', render: () => renderMochila() },
        { id: 'minhas-habilidades', icon: 'fa-fire', label: 'Habilidades', render: () => renderMinhasHabilidades() },
        { id: 'arma-espiritual', icon: 'fa-ghost', label: 'Arma Espiritual', render: () => renderArmaEspiritualTab() },
        { id: 'meus-pets', icon: 'fa-dragon', label: 'Mascotes', render: () => renderPetsTab() },
        { id: 'calculadora-atributos', icon: 'fa-calculator', label: 'Status Totais', render: () => renderCalculadoraAtributos() },
        { id: 'constelacao', icon: 'fa-star', label: 'Constelação', render: () => renderConstelacaoTab() }
    ],
    'mestre': [
        { id: 'arena-combate', icon: 'fa-chess-board', label: 'Arena Tática', render: () => window.arena?.init() }
    ]
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
        window.updateGlobalBars();
        
        const activeTab = dom.tab_container?.querySelector('.active')?.dataset.tab || 'painel-fichas';
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
            window.updateGlobalBars();
            
            const activeTab = dom.tab_container?.querySelector('.active')?.dataset.tab || 'painel-fichas';
            
            if(activeTab === 'painel-fichas') renderPainelFichas(); // FichaEditor trata internamente o ID
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
        }
    });
}

// --- BARRAS GLOBAIS DE STATUS (HEADER) ---
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
    const hpExtraMax = Number(atributos.pontosHPExtraTotal) || 0; 
    
    const mpMax = Number(ficha.mpMaxPersonagemBase) || 1; 
    const mpShieldMax = Number(atributos.defesaMagicaNativaTotal) || 0; 
    const mpExtraMax = Number(atributos.pontosMPExtraTotal) || 0; 

    const hpAtual = ficha.hpPersonagemBase !== undefined ? Number(ficha.hpPersonagemBase) : hpMax;
    const hpShieldAtual = ficha.hpShieldAtual !== undefined ? Number(ficha.hpShieldAtual) : hpShieldMax;
    const hpExtraAtual = ficha.hpExtraAtual !== undefined ? Number(ficha.hpExtraAtual) : hpExtraMax;

    const mpAtual = ficha.mpPersonagemBase !== undefined ? Number(ficha.mpPersonagemBase) : mpMax;
    const mpShieldAtual = ficha.mpShieldAtual !== undefined ? Number(ficha.mpShieldAtual) : mpShieldMax;
    const mpExtraAtual = ficha.mpExtraAtual !== undefined ? Number(ficha.mpExtraAtual) : mpExtraMax;

    const pctHpBase = Math.min(100, Math.max(0, (hpAtual / hpMax) * 100));
    const pctHpShield = hpShieldMax > 0 ? Math.min(100, Math.max(0, (hpShieldAtual / hpShieldMax) * 100)) : 0;
    const pctHpExtra = hpExtraMax > 0 ? Math.min(100, Math.max(0, (hpExtraAtual / hpExtraMax) * 100)) : 0;

    const pctMpBase = Math.min(100, Math.max(0, (mpAtual / mpMax) * 100));
    const pctMpShield = mpShieldMax > 0 ? Math.min(100, Math.max(0, (mpShieldAtual / mpShieldMax) * 100)) : 0;
    const pctMpExtra = mpExtraMax > 0 ? Math.min(100, Math.max(0, (mpExtraAtual / mpExtraMax) * 100)) : 0;

    const setWidth = (id, pct) => { const el = document.getElementById(id); if(el) el.style.width = `${pct}%`; };
    setWidth('hdr-hp-base', pctHpBase);
    setWidth('hdr-hp-shield', pctHpShield);
    setWidth('hdr-hp-extra', pctHpExtra);
    setWidth('hdr-mp-base', pctMpBase);
    setWidth('hdr-mp-shield', pctMpShield);
    setWidth('hdr-mp-extra', pctMpExtra);

    const hpTotalAtual = Math.max(0, hpAtual + hpShieldAtual + hpExtraAtual);
    const hpTotalMax = hpMax + hpShieldMax + hpExtraMax;
    const txtHpHdr = document.getElementById('hdr-hp-text');
    if(txtHpHdr) txtHpHdr.textContent = `${hpTotalAtual} / ${hpTotalMax}`;

    const mpTotalAtual = Math.max(0, mpAtual + mpShieldAtual + mpExtraAtual);
    const mpTotalMax = mpMax + mpShieldMax + mpExtraMax;
    const txtMpHdr = document.getElementById('hdr-mp-text');
    if(txtMpHdr) txtMpHdr.textContent = `${mpTotalAtual} / ${mpTotalMax}`;
    
    const fomeExtra = Number(atributos.pontosFomeExtraTotal) || 0;
    const fomeMax = Math.floor(100 + fomeExtra);
    let fomeAtual = ficha.fomeAtual !== undefined ? Number(ficha.fomeAtual) : fomeMax;
    if (fomeAtual > fomeMax) fomeAtual = fomeMax;

    const fomePct = Math.max(0, Math.min(100, (fomeAtual / fomeMax) * 100));
    const fomeBar = document.getElementById('bar-fome-fill');
    const fomeText = document.getElementById('hdr-fome-text');
    const fomeTrack = document.getElementById('bar-fome-track');

    if (fomeBar) fomeBar.style.width = `${fomePct}%`;
    
    if (fomeText) {
        fomeText.textContent = `${Math.floor(fomeAtual)} / ${fomeMax}`;
        if (fomeAtual < 50) {
            fomeText.classList.remove('text-white');
            fomeText.classList.add('text-red-400', 'animate-pulse');
        } else {
            fomeText.classList.remove('text-red-400', 'animate-pulse');
            fomeText.classList.add('text-white');
        }
    }

    if (fomeTrack) {
        if (fomeAtual < 50) {
            fomeTrack.classList.remove('bg-slate-950', 'border-slate-700');
            fomeTrack.classList.add('bg-black', 'border-red-900'); 
        } else {
            fomeTrack.classList.remove('bg-black', 'border-red-900');
            fomeTrack.classList.add('bg-slate-950', 'border-slate-700');
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
    const locations = globalState.world.locations;
    const events = globalState.world.events || [];

    let timeDisplay = w.time;
    let dayDisplay = w.day;
    let monthDisplay = w.month;
    let yearDisplay = w.year;
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
    const seasonName = globalState.world.seasons.find(s => s.id === w.seasonId)?.name || "---";

    const activeLocId = globalState.world.selectedLocId;
    const location = locations.find(l => l.id === activeLocId);
    let localEvents = [];
    let isDanger = false;

    if (location && location.x !== undefined && location.y !== undefined) {
        localEvents = events.filter(ev => {
            const locX = Number(location.x);
            const locY = Number(location.y);
            const evX = Number(ev.x);
            const evY = Number(ev.y);
            const radius = Number(ev.radius || 0);
            const distance = Math.sqrt(Math.pow(locX - evX, 2) + Math.pow(locY - evY, 2));
            return distance <= radius;
        });
        isDanger = localEvents.length > 0;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 w-full items-stretch animate-fade-in">
            <div class="md:col-span-3 flex items-center justify-center md:justify-start gap-3 py-1">
                <div class="text-right">
                    <div class="text-2xl font-mono font-bold ${isCustomSession ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-white'} leading-none">${timeDisplay}</div>
                    <div class="text-[10px] ${isCustomSession ? 'text-indigo-500' : 'text-amber-500'} font-bold uppercase tracking-widest">
                        ${isCustomSession ? '<i class="fas fa-users mr-1"></i> SESSÃO' : 'MUNDIAL'} • Dia ${dayDisplay}/${monthDisplay}/${yearDisplay}
                    </div>
                </div>
                <div class="h-8 w-[1px] bg-slate-700 mx-2"></div>
                <div class="text-center">
                    <div class="text-lg" title="${moon.name}"><i class="fas ${moon.icon}" style="color: ${moon.color}"></i></div>
                    <div class="text-[9px] text-slate-400 uppercase font-bold">${seasonName}</div>
                </div>
            </div>

            <div class="md:col-span-4">
                <div class="flex items-center bg-slate-900/50 border ${isDanger ? 'world-danger-border border-red-500' : 'border-slate-600'} rounded-lg px-3 py-1 h-full">
                    <i class="fas fa-map-marker-alt ${isDanger ? 'text-red-500 animate-bounce' : 'text-slate-400'} mr-3 text-lg"></i>
                    <div class="flex-grow">
                        <select onchange="window.updateHeaderLoc(this.value)" class="w-full bg-transparent text-white font-bold text-sm outline-none border-none cursor-pointer p-0">
                            ${locations.map(loc => `<option value="${loc.id}" ${loc.id === activeLocId ? 'selected' : ''} class="bg-slate-800 text-white">${loc.name}</option>`).join('')}
                        </select>
                        <div class="text-[10px] text-slate-500 flex justify-between mt-0.5 font-mono">
                            <span>X:${Math.round(location?.x || 0)} Y:${Math.round(location?.y || 0)}</span>
                            <span>Pop: ${(location?.pop || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="md:col-span-5">
                ${localEvents.length === 0 ? `
                    <div class="world-stat-box justify-center bg-emerald-900/20 border-emerald-500/30 h-full">
                        <i class="fas fa-sun text-emerald-400 text-lg"></i>
                        <span class="text-emerald-200 text-xs font-bold ml-2">Céu Limpo.</span>
                    </div>
                ` : localEvents.map(ev => `
                    <div class="world-stat-box bg-red-900/40 border-l-4 border-red-500 mb-1 last:mb-0">
                        <i class="fas ${ev.icon === 'Droplets' ? 'fa-cloud-showers-heavy' : 'fa-exclamation-triangle'} text-red-400 text-lg"></i>
                        <div class="flex-grow overflow-hidden ml-2 text-left">
                            <div class="text-red-200 text-xs font-bold truncate">${ev.name}</div>
                            <div class="text-red-400/80 text-[9px] truncate">Efeito Ativo no local.</div>
                        </div>
                    </div>
                `).join('')}
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
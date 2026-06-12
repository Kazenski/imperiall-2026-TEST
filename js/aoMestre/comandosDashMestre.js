import { db } from '../core/firebase.js';
import { collection, getDocs, doc, onSnapshot, updateDoc, deleteDoc, increment, deleteField, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { escapeHTML } from '../core/utils.js';
import { COINS } from '../core/state.js'; // Moedas puxadas diretamente do seu state!

let gmState = { 
    targetId: null, 
    targetData: null, 
    unsubscribe: null, 
    caches: { items: [], skills: [], races: [], classes: [], subs: [] },
    selectedItemId: null,
    selectedSkillId: null,
    dashboard: { sessionId: null, characters: [], selectedChars: new Set(), unsubscribeListener: null }
};

export async function renderComandosDashMestreTab() {
    const container = document.getElementById('comandos-dash-mestre-content');
    if (!container) return;

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
            
            <header class="bg-slate-900 border-2 border-red-900/50 p-6 rounded-2xl mb-8 shadow-[0_0_20px_rgba(220,38,38,0.1)] flex flex-col md:flex-row justify-between items-center gap-6">
                <h1 class="font-cinzel text-red-500 text-3xl font-black drop-shadow-md"><i class="fas fa-crown mr-3"></i> Grimório do Criador</h1>
                
                <div class="flex-grow w-full max-w-md bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <label for="gm-target-select" class="text-xs font-cinzel text-slate-400 uppercase tracking-widest block mb-1">Foco Divino (Alvo)</label>
                    <select id="gm-target-select" class="w-full bg-transparent text-amber-500 font-bold focus:outline-none cursor-pointer" onchange="window.gmDashTools.selectTarget(this.value)">
                        <option value="" class="bg-slate-900 text-slate-400">-- Carregando Personagens --</option>
                    </select>
                </div>
            </header>

            <nav class="flex flex-wrap gap-2 mb-8 border-b-2 border-slate-800" id="gm-tab-container">
                <button class="gm-tab-btn active bg-slate-800 text-amber-500 border-t-2 border-l-2 border-r-2 border-amber-500/50 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors" data-tab="gm-status">Editor de Status</button>
                <button class="gm-tab-btn bg-slate-900 text-slate-400 border-t-2 border-l-2 border-r-2 border-transparent hover:bg-slate-800 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors" data-tab="gm-itens">Injetor de Itens</button>
                <button class="gm-tab-btn bg-slate-900 text-slate-400 border-t-2 border-l-2 border-r-2 border-transparent hover:bg-slate-800 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors" data-tab="gm-skills">Ensinar Habilidades</button>
                <button class="gm-tab-btn bg-slate-900 text-slate-400 border-t-2 border-l-2 border-r-2 border-transparent hover:bg-slate-800 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors" data-tab="gm-economia">Economia & Rep.</button>
                <button class="gm-tab-btn bg-slate-900 text-slate-400 border-t-2 border-l-2 border-r-2 border-transparent hover:bg-slate-800 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors" data-tab="gm-dashboard"><i class="fas fa-users mr-2"></i> Painel da Sessão</button>
                <button class="gm-tab-btn bg-red-950/20 text-red-500 border-t-2 border-l-2 border-r-2 border-transparent hover:bg-red-900/30 rounded-t-lg px-6 py-3 font-bold text-sm uppercase tracking-widest transition-colors ml-auto" data-tab="gm-perigo"><i class="fas fa-skull mr-2"></i> Zona de Perigo</button>
            </nav>

            <div id="gm-content-wrapper" class="relative min-h-[500px] opacity-50 pointer-events-none transition-opacity duration-500">
                
                <div class="absolute inset-0 flex items-center justify-center z-50 pointer-events-none" id="gm-no-target-msg">
                    <p class="bg-slate-900/90 text-amber-500 px-6 py-4 rounded-xl border border-amber-500/30 font-cinzel text-xl tracking-widest shadow-2xl backdrop-blur-sm"><i class="fas fa-eye mr-2"></i> Selecione um Alvo Acima</p>
                </div>

                <div id="gm-status-content" class="gm-tab-content block">
                    <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                        <h2 class="text-2xl font-cinzel text-amber-400 m-0"><i class="fas fa-user-edit mr-2"></i> Editar Ficha</h2>
                        <button onclick="window.gmDashTools.saveStats()" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg transition-colors uppercase text-sm tracking-widest"><i class="fas fa-save mr-2"></i> Salvar Ficha</button>
                    </div>
                    
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 class="font-cinzel text-xl text-white mb-6 border-b border-slate-600 pb-2">Dados Vitais</h3>
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <div><label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">HP Atual</label><input type="number" id="gm-hp" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-white font-mono text-lg outline-none focus:border-amber-500"></div>
                                <div><label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">MP Atual</label><input type="number" id="gm-mp" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-white font-mono text-lg outline-none focus:border-amber-500"></div>
                            </div>
                            <div class="mb-6"><label class="block text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Experiência Total (XP)</label><input type="number" id="gm-xp" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-amber-300 font-mono text-xl text-center outline-none focus:border-amber-500"></div>
                            <div><label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Pontos de Atributo Bônus (Mestre)</label><input type="number" id="gm-pts" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-white font-mono text-lg outline-none focus:border-amber-500"></div>
                        </div>

                        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 class="font-cinzel text-xl text-white mb-6 border-b border-slate-600 pb-2">Origem</h3>
                            <div class="space-y-6">
                                <div><label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Raça do Personagem</label><select id="gm-raca" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-slate-300 outline-none focus:border-amber-500"></select></div>
                                <div><label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Classe Principal</label><select id="gm-classe" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-slate-300 outline-none focus:border-amber-500"></select></div>
                                <div><label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Especialização (Subclasse)</label><select id="gm-subclasse" class="w-full bg-slate-900 border border-slate-600 p-3 rounded text-slate-300 outline-none focus:border-amber-500"></select></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="gm-itens-content" class="gm-tab-content hidden">
                    <h2 class="text-2xl font-cinzel text-emerald-400 mb-6 pb-4 border-b border-slate-700"><i class="fas fa-gift mr-2"></i> Injetor de Itens</h2>
                    <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 grid grid-cols-1 lg:grid-cols-4 gap-6">
                        
                        <div class="lg:col-span-3 flex flex-col gap-4">
                            <input type="text" id="gm-item-search" placeholder="Procurar item pelo nome..." class="w-full bg-slate-900 border border-slate-600 p-4 rounded-xl text-white focus:border-emerald-500 focus:outline-none" onkeyup="window.gmDashTools.renderItems()">
                            
                            <div id="gm-item-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scroll p-4 bg-slate-950 rounded-xl border border-slate-800">
                                </div>
                        </div>
                        
                        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col h-full">
                            <h4 class="text-xs font-cinzel font-bold text-slate-400 uppercase tracking-widest mb-2">Alvo Selecionado</h4>
                            <div id="gm-item-preview-name" class="text-emerald-400 font-bold text-lg mb-6 min-h-[28px] border-b border-slate-700 pb-2">Nenhum Item</div>
                            <input type="hidden" id="gm-selected-item-id">
                            
                            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-auto">Quantidade a Injetar</label>
                            <input type="number" id="gm-item-qtd" value="1" min="1" class="w-full bg-slate-950 border border-slate-600 p-3 rounded text-center text-white font-mono text-xl mb-6 outline-none focus:border-emerald-500">
                            
                            <button onclick="window.gmDashTools.injectItem()" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg transition-colors uppercase tracking-widest">
                                <i class="fas fa-paper-plane mr-2"></i> Enviar
                            </button>
                        </div>
                    </div>
                </div>

                <div id="gm-skills-content" class="gm-tab-content hidden">
                    <h2 class="text-2xl font-cinzel text-purple-400 mb-6 pb-4 border-b border-slate-700"><i class="fas fa-magic mr-2"></i> Mestre dos Saberes</h2>
                    <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 grid grid-cols-1 lg:grid-cols-4 gap-6">
                        
                        <div class="lg:col-span-3 flex flex-col gap-4">
                            <div class="flex gap-4">
                                <input type="text" id="gm-skill-search" placeholder="Procurar técnica..." class="flex-grow bg-slate-900 border border-slate-600 p-4 rounded-xl text-white focus:border-purple-500 focus:outline-none" onkeyup="window.gmDashTools.renderSkills()">
                                <select id="gm-skill-class-filter" class="w-1/3 bg-slate-900 border border-slate-600 p-4 rounded-xl text-slate-300 focus:border-purple-500 focus:outline-none" onchange="window.gmDashTools.renderSkills()">
                                    <option value="" class="bg-slate-900 text-slate-300">Todas as Classes</option>
                                </select>
                            </div>
                            
                            <div id="gm-skill-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scroll p-4 bg-slate-950 rounded-xl border border-slate-800">
                                </div>
                        </div>
                        
                        <div class="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col h-full">
                            <h4 class="text-xs font-cinzel font-bold text-slate-400 uppercase tracking-widest mb-2">Técnica Alvo</h4>
                            <div id="gm-skill-preview-name" class="text-purple-400 font-bold text-lg mb-6 min-h-[56px] border-b border-slate-700 pb-2">Nenhuma Magia</div>
                            <input type="hidden" id="gm-selected-skill-id">
                            
                            <button onclick="window.gmDashTools.injectSkill()" class="w-full py-4 mt-auto bg-purple-600 hover:bg-purple-500 text-white font-bold rounded shadow-lg transition-colors uppercase tracking-widest">
                                <i class="fas fa-bolt mr-2"></i> Ensinar
                            </button>
                        </div>
                    </div>
                </div>

                <div id="gm-economia-content" class="gm-tab-content hidden">
                    <h2 class="text-2xl font-cinzel text-amber-500 mb-6 pb-4 border-b border-slate-700"><i class="fas fa-coins mr-2"></i> Controle Econômico & Social</h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                            <h3 class="font-cinzel text-xl text-white mb-6 border-b border-slate-600 pb-2">Bolsa de Moedas</h3>
                            <div class="space-y-4">
                                <div class="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
                                    <span class="text-yellow-500 font-bold font-cinzel tracking-widest uppercase">Ouro</span>
                                    <div class="flex gap-3 items-center">
                                        <button onclick="window.gmDashTools.modMoney('gold', -10)" class="px-3 py-1 bg-slate-700 hover:bg-red-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">-10</button>
                                        <span id="disp-gold" class="font-mono w-20 text-center text-white font-black text-xl">0</span>
                                        <button onclick="window.gmDashTools.modMoney('gold', 10)" class="px-3 py-1 bg-slate-700 hover:bg-emerald-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">+10</button>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
                                    <span class="text-slate-300 font-bold font-cinzel tracking-widest uppercase">Prata</span>
                                    <div class="flex gap-3 items-center">
                                        <button onclick="window.gmDashTools.modMoney('silver', -10)" class="px-3 py-1 bg-slate-700 hover:bg-red-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">-10</button>
                                        <span id="disp-silver" class="font-mono w-20 text-center text-white font-black text-xl">0</span>
                                        <button onclick="window.gmDashTools.modMoney('silver', 10)" class="px-3 py-1 bg-slate-700 hover:bg-emerald-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">+10</button>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner">
                                    <span class="text-orange-600 font-bold font-cinzel tracking-widest uppercase">Bronze</span>
                                    <div class="flex gap-3 items-center">
                                        <button onclick="window.gmDashTools.modMoney('bronze', -50)" class="px-3 py-1 bg-slate-700 hover:bg-red-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">-50</button>
                                        <span id="disp-bronze" class="font-mono w-20 text-center text-white font-black text-xl">0</span>
                                        <button onclick="window.gmDashTools.modMoney('bronze', 50)" class="px-3 py-1 bg-slate-700 hover:bg-emerald-900/50 rounded font-mono border border-slate-600 text-sm transition-colors">+50</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-8">
                            <div class="bg-purple-900/10 border border-purple-900/50 p-6 rounded-2xl shadow-inner">
                                <h3 class="font-cinzel text-xl text-purple-400 mb-6 border-b border-purple-900/50 pb-2">Moedas Místicas</h3>
                                <div class="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-purple-900 shadow-inner">
                                    <span class="text-purple-300 font-bold font-cinzel tracking-widest uppercase">Orbes da Ascensão</span>
                                    <div class="flex gap-3 items-center">
                                        <button onclick="window.gmDashTools.modMoney('orbs', -1)" class="px-4 py-2 bg-slate-800 hover:bg-red-900/50 rounded font-mono border border-slate-700 text-sm transition-colors">-1</button>
                                        <span id="disp-orbs" class="font-mono w-16 text-center text-white font-black text-2xl">0</span>
                                        <button onclick="window.gmDashTools.modMoney('orbs', 1)" class="px-4 py-2 bg-slate-800 hover:bg-emerald-900/50 rounded font-mono border border-slate-700 text-sm transition-colors">+1</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-sky-900/10 border border-sky-900/50 p-6 rounded-2xl shadow-inner">
                                <h3 class="font-cinzel text-xl text-sky-400 mb-4 border-b border-sky-900/50 pb-2">Glória & Fama</h3>
                                <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bônus de Reputação Imputado (Oculto)</label>
                                <div class="flex gap-2">
                                    <input type="number" id="gm-rep-bonus" class="flex-grow bg-slate-950 border border-sky-900 p-3 rounded text-white font-mono text-center text-xl outline-none focus:border-sky-500">
                                    <button onclick="window.gmDashTools.saveReputation()" class="px-6 py-3 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded uppercase tracking-widest transition-colors shadow-lg">Aplicar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="gm-dashboard-content" class="gm-tab-content hidden">
                    <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                        <h2 class="text-2xl font-cinzel text-sky-400 m-0"><i class="fas fa-chess-board mr-2"></i> Painel Interativo da Sessão</h2>
                        <select id="gm-sessao-select" class="bg-slate-900 border border-slate-600 p-3 rounded-xl text-slate-300 font-bold focus:outline-none focus:border-sky-500 shadow-inner" onchange="window.gmDashTools.loadDashboardSession(this.value)">
                            <option value="">-- Carregando Sessões --</option>
                        </select>
                    </div>
                    
                    <div class="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 mb-6 flex flex-wrap gap-4 items-center justify-between">
                        <div class="flex items-center gap-4 flex-wrap">
                            <select id="gm-mass-attr" class="bg-slate-950 border border-slate-600 p-3 rounded text-slate-300 focus:outline-none focus:border-sky-500">
                                <option value="hpPersonagemBase">HP Atual</option>
                                <option value="mpPersonagemBase">MP Atual</option>
                                <option value="fomeAtual">Fome</option>
                                <option value="pontosDistribuidosAtk">ATK Base</option>
                                <option value="pontosDistribuidosDef">DEF Base</option>
                                <option value="pontosDistribuidosEva">EVA Base</option>
                            </select>
                            <input type="number" id="gm-mass-value" placeholder="Valor (ex: 10 ou -5)" class="w-40 bg-slate-950 border border-slate-600 p-3 rounded text-center text-white font-mono focus:outline-none focus:border-sky-500">
                            <button onclick="window.gmDashTools.applyMassAttribute()" class="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg uppercase tracking-widest text-xs transition-colors shadow-lg border border-sky-400/50"><i class="fas fa-bolt mr-2"></i> Aplicar em Massa</button>
                        </div>
                        <div class="text-xs text-slate-400 font-mono italic">
                            <i class="fas fa-info-circle text-sky-400 mr-1"></i> Selecione os aventureiros abaixo para manipular.
                        </div>
                    </div>

                    <div id="gm-dashboard-grid" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scroll p-2">
                        <div class="col-span-full text-center text-slate-500 mt-10">
                            <i class="fas fa-users text-5xl mb-4 opacity-30"></i>
                            <p class="font-cinzel text-lg uppercase tracking-widest">Selecione uma sessão acima para ver os aventureiros.</p>
                        </div>
                    </div>
                </div>

                <div id="gm-perigo-content" class="gm-tab-content hidden">
                    <h2 class="text-2xl font-cinzel text-red-500 mb-6 pb-4 border-b border-red-900/50"><i class="fas fa-exclamation-triangle mr-2"></i> Zona de Perigo</h2>
                    <div class="bg-red-950/10 border border-red-900/50 p-8 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.1)] text-center">
                        <p class="text-slate-400 mb-8 text-lg">Ações executadas aqui são <strong class="text-red-500">irreversíveis</strong>. Exigem o código divino.</p>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            <button onclick="window.gmDashTools.resetConstellation()" class="py-6 px-4 bg-red-900 hover:bg-red-800 text-white border-2 border-red-500 rounded-xl font-cinzel font-bold text-lg uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all transform hover:scale-105">
                                <i class="fas fa-star-half-alt mb-2 text-3xl block"></i> Resetar Constelação
                            </button>
                            <button onclick="window.gmDashTools.deleteCharacter()" class="py-6 px-4 bg-black hover:bg-red-950 text-red-500 hover:text-white border-2 border-red-900 hover:border-red-500 rounded-xl font-cinzel font-bold text-lg uppercase tracking-widest shadow-xl transition-all transform hover:scale-105">
                                <i class="fas fa-skull mb-2 text-3xl block"></i> Aniquilar Ficha
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    await loadGMCaches();
    startPlayerListener();
    setupGMTabs();
    renderGMItems(); 
    renderGMSkills();
    window.gmDashTools.loadDashboardSessions();
}

async function loadGMCaches() {
    const load = async (col) => {
        const snap = await getDocs(query(collection(db, col), orderBy('nome')));
        return snap.docs.map(d => ({id: d.id, ...d.data()}));
    };
    
    try {
        const [it, crafted, sk, rc, cl, sb] = await Promise.all([
            load('rpg_itensCadastrados'),
            load('rpg_itensCraftados'),
            load('rpg_habilidades'),
            load('rpg_racas'),
            load('rpg_classes'),
            load('rpg_subclasses')
        ]);
        
        gmState.caches.items = [...it, ...crafted].sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        gmState.caches.skills = sk;
        gmState.caches.classes = cl;
        
        const fill = (id, list) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="" class="bg-slate-900 text-slate-500">-- Indefinido --</option>';
            list.forEach(i => {
                const opt = new Option(i.nome, i.id);
                opt.className = "bg-slate-900 text-slate-200"; // FIX DA COR BRANCA
                el.add(opt);
            });
        };
        fill('gm-raca', rc);
        fill('gm-classe', cl);
        fill('gm-subclasse', sb);

        const skillFilter = document.getElementById('gm-skill-class-filter');
        if (skillFilter) {
            skillFilter.innerHTML = '<option value="" class="bg-slate-900 text-slate-500">Todas as Classes</option>';
            cl.forEach(c => {
                const opt = new Option(c.nome, c.id);
                opt.className = "bg-slate-900 text-slate-200"; // FIX DA COR BRANCA
                skillFilter.add(opt);
            });
        }
    } catch(e) {
        console.error("Erro carregando caches do Mestre:", e);
    }
}

function startPlayerListener() {
    const sel = document.getElementById('gm-target-select');
    if (!sel) return;

    onSnapshot(query(collection(db, "rpg_fichas"), orderBy("nome")), (snap) => {
        const oldVal = sel.value;
        sel.innerHTML = '<option value="" class="bg-slate-900 text-slate-500">-- Selecione o Jogador Alvo --</option>';
        snap.forEach(d => {
            const data = d.data();
            const opt = new Option(`${data.nome} (${data.jogador || '?'})`, d.id);
            opt.className = "bg-slate-900 text-amber-400"; // FIX DA COR BRANCA
            sel.add(opt);
        });
        if(oldVal) sel.value = oldVal;
    });
}

function selectGMTarget(id) {
    if(gmState.unsubscribe) gmState.unsubscribe();
    
    const wrapper = document.getElementById('gm-content-wrapper');
    const msg = document.getElementById('gm-no-target-msg');

    if(!id) { 
        gmState.targetId = null; 
        if (wrapper) { wrapper.classList.add('opacity-50', 'pointer-events-none'); }
        if (msg) msg.classList.remove('hidden');
        return; 
    }
    
    gmState.targetId = id;
    
    if (wrapper) { wrapper.classList.remove('opacity-50', 'pointer-events-none'); }
    if (msg) msg.classList.add('hidden');

    gmState.unsubscribe = onSnapshot(doc(db, "rpg_fichas", id), (docSnap) => {
        if(!docSnap.exists()) return;
        gmState.targetData = docSnap.data();
        renderTargetData();
    });
}

function renderTargetData() {
    const d = gmState.targetData;
    if (!d) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setVal('gm-hp', d.hpPersonagemBase || 0);
    setVal('gm-mp', d.mpPersonagemBase || 0);
    setVal('gm-xp', d.experienciapersonagemBase || 0);
    setVal('gm-pts', d.pontosExtrasMestre || 0);
    setVal('gm-raca', d.racaId || '');
    setVal('gm-classe', d.classeId || '');
    setVal('gm-subclasse', d.subclasseId || '');
    
    const m = d.mochila || {};
    setText('disp-gold', m[COINS.GOLD] || 0);
    setText('disp-silver', m[COINS.SILVER] || 0);
    setText('disp-bronze', m[COINS.BRONZE] || 0);
    setText('disp-orbs', m[COINS.ORB] || 0);
    setVal('gm-rep-bonus', d.recursos?.reputacaoBonusGM || 0);
}

function setupGMTabs() {
    const nav = document.getElementById('gm-tab-container');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.gm-tab-btn');
        if(btn) {
            document.querySelectorAll('.gm-tab-btn').forEach(b => {
                b.classList.remove('active', 'text-amber-500', 'border-amber-500/50', 'bg-slate-800');
                b.classList.add('text-slate-400', 'border-transparent', 'bg-slate-900');
                if (b.dataset.tab === 'gm-perigo') {
                     b.classList.remove('bg-red-950/20', 'text-red-500');
                }
            });
            document.querySelectorAll('.gm-tab-content').forEach(c => c.classList.add('hidden'));
            
            const isDanger = btn.dataset.tab === 'gm-perigo';
            btn.classList.add('active');
            btn.classList.remove('text-slate-400', 'border-transparent', 'bg-slate-900');
            
            if (isDanger) {
                btn.classList.add('text-red-500', 'border-red-500/50', 'bg-red-950/20');
            } else {
                btn.classList.add('text-amber-500', 'border-amber-500/50', 'bg-slate-800');
            }

            document.getElementById(btn.dataset.tab + '-content').classList.remove('hidden');
        }
    });
}

function renderGMItems() {
    const container = document.getElementById('gm-item-grid');
    const searchEl = document.getElementById('gm-item-search');
    if (!container || !searchEl) return;

    const search = searchEl.value.toLowerCase();
    container.innerHTML = '';

    const filtered = gmState.caches.items.filter(i => (i.nome||'').toLowerCase().includes(search));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs p-4 col-span-full">Nenhum item encontrado.</p>';
        return;
    }

    filtered.forEach(item => {
        const isSelected = gmState.selectedItemId === item.id;
        const imgUrl = item.imagemUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/atualizacoes_sistema%2Fenvio.png?alt=media";
        
        const div = document.createElement('div');
        div.className = `flex items-center gap-4 bg-slate-900 border p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-emerald-500 bg-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-[1.02]' : 'border-slate-700 hover:border-emerald-400 hover:bg-slate-800'}`;
        div.title = item.nome;
        
        div.innerHTML = `
            <div class="w-12 h-12 shrink-0 bg-black rounded-lg border border-slate-600 overflow-hidden relative shadow-inner">
                <img src="${imgUrl}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100">
            </div>
            <div class="flex-1 min-w-0 pr-2">
                <div class="text-sm font-bold text-white truncate drop-shadow-md">${escapeHTML(item.nome)}</div>
                <div class="text-[10px] text-emerald-400 uppercase tracking-widest mt-0.5">Rank: ${item.tierId || 'F'}</div>
            </div>
        `;

        div.onclick = () => {
            gmState.selectedItemId = item.id;
            document.getElementById('gm-item-preview-name').textContent = item.nome;
            document.getElementById('gm-selected-item-id').value = item.id;
            renderGMItems(); 
        };

        container.appendChild(div);
    });
}

function renderGMSkills() {
    const container = document.getElementById('gm-skill-grid');
    const searchEl = document.getElementById('gm-skill-search');
    const filterEl = document.getElementById('gm-skill-class-filter');
    if (!container || !searchEl || !filterEl) return;

    const search = searchEl.value.toLowerCase();
    const classFilter = filterEl.value;
    container.innerHTML = '';

    const filtered = gmState.caches.skills.filter(s => {
        if (!(s.nome || '').toLowerCase().includes(search)) return false;
        if (!classFilter) return true;

        const directMatch = s.classeId === classFilter;
        const arrayMatch = Array.isArray(s.classesPermitidas) && s.classesPermitidas.includes(classFilter);
        const legacyArrayMatch = Array.isArray(s.classes) && s.classes.includes(classFilter);
        const stringMatch = s.classe === classFilter;

        let nameMatchLegacy = false;
        const classObj = gmState.caches.classes.find(c => c.id === classFilter);
        if (classObj && s.classe === classObj.nome) nameMatchLegacy = true;

        const restrictionClassMatch = Array.isArray(s.restricaoClasses) && s.restricaoClasses.includes(classFilter);

        return directMatch || arrayMatch || legacyArrayMatch || stringMatch || nameMatchLegacy || restrictionClassMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-xs p-4 col-span-full">Nenhuma técnica encontrada.</p>';
        return;
    }

    filtered.forEach(skill => {
        const isSelected = gmState.selectedSkillId === skill.id;
        const imgUrl = skill.imagemUrl || "https://placehold.co/400x400/1e293b/a1a1aa?text=Skill";
        
        const div = document.createElement('div');
        div.className = `flex items-center gap-4 bg-slate-900 border p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-purple-500 bg-slate-800 shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-[1.02]' : 'border-slate-700 hover:border-purple-400 hover:bg-slate-800'}`;
        div.title = `${skill.nome}\n(Custo: ${skill.gastoMpUso?.lvl1 || 0} MP)`;
        
        div.innerHTML = `
            <div class="w-12 h-12 shrink-0 bg-black rounded-full border border-slate-600 overflow-hidden relative shadow-inner">
                <img src="${imgUrl}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100">
            </div>
            <div class="flex-1 min-w-0 pr-2">
                <div class="text-sm font-bold text-amber-400 truncate drop-shadow-md">${escapeHTML(skill.nome)}</div>
                <div class="text-[10px] text-purple-400 uppercase tracking-widest mt-0.5">Custo Base: ${skill.gastoMpUso?.lvl1 || 0} MP</div>
            </div>
        `;

        div.onclick = () => {
            gmState.selectedSkillId = skill.id;
            document.getElementById('gm-skill-preview-name').textContent = skill.nome;
            document.getElementById('gm-selected-skill-id').value = skill.id;
            renderGMSkills(); 
        };

        container.appendChild(div);
    });
}

// -------------------------------------------------------------
// FUNÇÕES DE AÇÃO DO MESTRE (Expostas no window)
// -------------------------------------------------------------

window.gmDashTools = {
    selectTarget: selectGMTarget,
    renderItems: renderGMItems,
    renderSkills: renderGMSkills,

    saveStats: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo primeiro.");
        try {
            await updateDoc(doc(db, "rpg_fichas", gmState.targetId), {
                hpPersonagemBase: Number(document.getElementById('gm-hp').value),
                mpPersonagemBase: Number(document.getElementById('gm-mp').value),
                experienciapersonagemBase: Number(document.getElementById('gm-xp').value),
                pontosExtrasMestre: Number(document.getElementById('gm-pts').value),
                racaId: document.getElementById('gm-raca').value,
                classeId: document.getElementById('gm-classe').value,
                subclasseId: document.getElementById('gm-subclasse').value
            });
            alert("A Ficha foi reescrita com sucesso!");
        } catch(e) { alert("Falha na magia: " + e.message); }
    },

    injectItem: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        const itemId = document.getElementById('gm-selected-item-id').value;
        const qtd = Number(document.getElementById('gm-item-qtd').value);
        
        if(!itemId) return alert("Selecione um item na galeria.");
        if(qtd < 1) return alert("Quantidade inválida.");

        try {
            await updateDoc(doc(db, "rpg_fichas", gmState.targetId), {
                [`mochila.${itemId}`]: increment(qtd)
            });
            alert("Item materializado na mochila do jogador!");
        } catch(e) { alert("Falha: " + e.message); }
    },

    injectSkill: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        const skillId = document.getElementById('gm-selected-skill-id').value;
        
        if(!skillId) return alert("Selecione uma magia na galeria.");

        // PROMPT DE NÍVEL
        const levelInput = prompt(`Em que NÍVEL deseja conceder esta habilidade ao personagem?\n(Apenas números. Se cancelar, usará nível 1)`, "1");
        
        if (levelInput === null) return;

        let skillLevel = parseInt(levelInput, 10);
        if (isNaN(skillLevel) || skillLevel < 1) {
            skillLevel = 1;
        }

        try {
            await updateDoc(doc(db, "rpg_fichas", gmState.targetId), {
                [`habilidades.${skillId}`]: { nivel: skillLevel, status: 'Concedido pelo Mestre' }
            });
            alert(`Conhecimento infundido! A habilidade agora está no Nível ${skillLevel}.`);
        } catch(e) { alert("Falha: " + e.message); }
    },

    modMoney: async (type, val) => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        let id = COINS.BRONZE; 
        if(type==='gold') id = COINS.GOLD; 
        if(type==='silver') id = COINS.SILVER; 
        if(type==='orbs') id = COINS.ORB;

        try {
            const ref = doc(db, "rpg_fichas", gmState.targetId);
            const cur = gmState.targetData.mochila?.[id] || 0;
            if(cur + val < 0 && val < 0) {
                await updateDoc(ref, { [`mochila.${id}`]: deleteField() });
            } else {
                await updateDoc(ref, { [`mochila.${id}`]: increment(val) });
            }
        } catch(e) { alert(e.message); }
    },

    saveReputation: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        try { 
            await updateDoc(doc(db, "rpg_fichas", gmState.targetId), { 
                "recursos.reputacaoBonusGM": Number(document.getElementById('gm-rep-bonus').value) 
            }); 
            alert("Fama alterada!"); 
        } catch(e) { alert(e.message); }
    },

    resetConstellation: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        if(confirm("ATENÇÃO: Deseja apagar o progresso estelar deste jogador?")) {
            await updateDoc(doc(db, "rpg_fichas", gmState.targetId), { constelacao_unlocked: [] });
            alert("Estrelas apagadas.");
        }
    },

    deleteCharacter: async () => {
        if(!gmState.targetId) return alert("Selecione um alvo.");
        const n = gmState.targetData.nome;
        if(prompt(`ALERTA CRÍTICO: Para apagar permanentemente, digite "${n}" :`) === n) {
            await deleteDoc(doc(db, "rpg_fichas", gmState.targetId));
            alert("Personagem Aniquilado do Multiverso."); 
            document.getElementById('gm-target-select').value = ""; 
            selectGMTarget("");
        } else {
            alert("Exclusão abortada. Nome incorreto.");
        }
    },

    // === NOVOS MÉTODOS DO DASHBOARD DA SESSÃO ===
    loadDashboardSessions: async () => {
        try {
            const snap = await getDocs(collection(db, "rpg_sessions"));
            const select = document.getElementById('gm-sessao-select');
            if(!select) return;
            select.innerHTML = '<option value="">-- Selecione uma Sessão --</option>';
            snap.forEach(d => {
                select.add(new Option(`Sessão: ${d.data().name || d.id}`, d.id));
            });
        } catch(e) { console.error("Erro ao buscar sessões: ", e); }
    },

    loadDashboardSession: async (sessionId) => {
        if(gmState.dashboard.unsubscribeListener) {
            gmState.dashboard.unsubscribeListener();
            gmState.dashboard.unsubscribeListener = null;
        }

        const grid = document.getElementById('gm-dashboard-grid');
        if(!sessionId) {
            grid.innerHTML = '<div class="col-span-full text-center text-slate-500 mt-10"><i class="fas fa-users text-5xl mb-4 opacity-30"></i><p class="font-cinzel text-lg uppercase tracking-widest">Selecione uma sessão acima para ver os aventureiros.</p></div>';
            return;
        }

        grid.innerHTML = '<div class="col-span-full text-center text-sky-400 mt-10 animate-pulse"><i class="fas fa-spinner fa-spin text-3xl mb-2"></i><p>Conectando ao multiverso...</p></div>';
        gmState.dashboard.sessionId = sessionId;
        gmState.dashboard.selectedChars.clear();

        // Busca o documento da sessão para pegar os IDs dos jogadores ativos
        const sessionDoc = await getDocs(query(collection(db, "rpg_sessions")));
        const sessionData = sessionDoc.docs.find(d => d.id === sessionId)?.data();
        
        if(!sessionData || !sessionData.playerIds || sessionData.playerIds.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-red-500 mt-10"><p>Nenhum aventureiro nesta sessão.</p></div>';
            return;
        }

        // Fica ouvindo alterações apenas nas fichas que pertencem à sessão
        const q = query(collection(db, "rpg_fichas"), orderBy("nome"));
        gmState.dashboard.unsubscribeListener = onSnapshot(q, (snap) => {
            gmState.dashboard.characters = [];
            grid.innerHTML = '';
            
            snap.forEach(docSnap => {
                if(sessionData.playerIds.includes(docSnap.id)) {
                    const char = { id: docSnap.id, ...docSnap.data() };
                    gmState.dashboard.characters.push(char);
                    window.gmDashTools.renderDashboardCard(char);
                }
            });
        });
    },

    renderDashboardCard: (char) => {
        const grid = document.getElementById('gm-dashboard-grid');
        const isSelected = gmState.dashboard.selectedChars.has(char.id);
        
        const card = document.createElement('div');
        // Define o visual de cartão com estilo imperial e destaque se selecionado
        card.className = `relative p-4 rounded-xl border-2 transition-all cursor-pointer overflow-hidden shadow-lg ${isSelected ? 'border-sky-500 bg-sky-900/20 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`;
        card.onclick = (e) => {
            if(e.target.tagName !== 'INPUT') { window.gmDashTools.toggleDashboardCharSelection(char.id); }
        };

        const imgUrl = (char.imagemPrincipal && char.imageUrls && char.imageUrls[char.imagemPrincipal]) ? char.imageUrls[char.imagemPrincipal] : char.imagemUrl || "https://placehold.co/400x400/0f172a/d4af37?text=Sem+Foto";

        card.innerHTML = `
            <div class="absolute top-3 right-3 z-10 pointer-events-auto">
                <input type="checkbox" class="w-5 h-5 accent-sky-500 cursor-pointer" ${isSelected ? 'checked' : ''} onclick="window.gmDashTools.toggleDashboardCharSelection('${char.id}'); event.stopPropagation();">
            </div>
            
            <div class="flex items-center gap-4 mb-4 border-b border-slate-700/50 pb-3">
                <img src="${imgUrl}" class="w-14 h-14 rounded-full object-cover border-2 border-slate-600 shadow-inner">
                <div>
                    <h4 class="font-cinzel font-bold text-amber-400 text-lg leading-none mb-1">${escapeHTML(char.nome)}</h4>
                    <p class="text-[10px] text-slate-400 uppercase tracking-widest">${char.jogador || '???'}</p>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-emerald-500 font-bold uppercase mb-0.5">HP</div>
                    <div class="font-mono text-white text-sm">${char.hpPersonagemBase || 0}</div>
                </div>
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-blue-500 font-bold uppercase mb-0.5">MP</div>
                    <div class="font-mono text-white text-sm">${char.mpPersonagemBase || 0}</div>
                </div>
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-orange-500 font-bold uppercase mb-0.5">Fome</div>
                    <div class="font-mono text-white text-sm">${char.fomeAtual || 100}</div>
                </div>
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-rose-500 font-bold uppercase mb-0.5">ATK</div>
                    <div class="font-mono text-slate-300 text-sm">${char.pontosDistribuidosAtk || 0}</div>
                </div>
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-sky-500 font-bold uppercase mb-0.5">DEF</div>
                    <div class="font-mono text-slate-300 text-sm">${char.pontosDistribuidosDef || 0}</div>
                </div>
                <div class="bg-slate-950 p-2 rounded border border-slate-800 text-center shadow-inner">
                    <div class="text-[9px] text-amber-500 font-bold uppercase mb-0.5">EVA</div>
                    <div class="font-mono text-slate-300 text-sm">${char.pontosDistribuidosEva || 0}</div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    },

    toggleDashboardCharSelection: (charId) => {
        if(gmState.dashboard.selectedChars.has(charId)) {
            gmState.dashboard.selectedChars.delete(charId);
        } else {
            gmState.dashboard.selectedChars.add(charId);
        }
        // Força re-renderização suave da grid recriando-a a partir dos dados em cache
        const grid = document.getElementById('gm-dashboard-grid');
        grid.innerHTML = '';
        gmState.dashboard.characters.forEach(char => window.gmDashTools.renderDashboardCard(char));
    },

    applyMassAttribute: async () => {
        if(gmState.dashboard.selectedChars.size === 0) return alert("Selecione pelo menos um aventureiro na lista abaixo clicando no card.");
        
        const atributo = document.getElementById('gm-mass-attr').value;
        const inputVal = document.getElementById('gm-mass-value').value;
        const valorNum = parseFloat(inputVal);

        if(isNaN(valorNum)) return alert("Digite um valor numérico válido (ex: 10 ou -5).");

        try {
            const batch = writeBatch(db);

            gmState.dashboard.selectedChars.forEach(charId => {
                const charData = gmState.dashboard.characters.find(c => c.id === charId);
                if(charData) {
                    const charRef = doc(db, "rpg_fichas", charId);
                    // Pega o valor atual, ou 0 se não existir, e soma ao valor numérico imputado
                    let valorAtual = charData[atributo] !== undefined ? Number(charData[atributo]) : 0;
                    
                    // No caso de fomeAtual, se o atributo original não existir, setamos o padrão como 100 antes da alteração
                    if(atributo === 'fomeAtual' && charData[atributo] === undefined) valorAtual = 100;
                    
                    let novoValor = valorAtual + valorNum;
                    
                    // Tratamento seguro para nunca negativar Vitais
                    if (novoValor < 0 && (atributo === 'hpPersonagemBase' || atributo === 'mpPersonagemBase' || atributo === 'fomeAtual')) {
                        novoValor = 0;
                    }
                    
                    const updateObj = {};
                    updateObj[atributo] = novoValor;
                    batch.update(charRef, updateObj);
                }
            });

            await batch.commit();
            document.getElementById('gm-mass-value').value = '';
            
            // Um pequeno feedback visual antes da tela atualizar sozinha (pelo onSnapshot)
            alert(`Ação em massa executada com Sucesso em ${gmState.dashboard.selectedChars.size} personagens!`);

            // Limpa as seleções (Opcional, mas recomendado após um apply)
            gmState.dashboard.selectedChars.clear();

        } catch (error) {
            console.error("Falha ao aplicar manipulação em massa:", error);
            alert("Falha na Magia do Mestre: " + error.message);
        }
    }
    // === FIM DOS MÉTODOS DO DASHBOARD ===
};
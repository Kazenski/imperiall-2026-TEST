import { db, storage, doc, updateDoc, setDoc, onSnapshot, runTransaction, arrayUnion, arrayRemove, deleteField, ref, uploadBytes, getDownloadURL, deleteObject } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { calculateStatCascade, getFomeDebuffMultiplier } from '../core/calculos.js';

const IMG_PLACEHOLDER_BASE64 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const HEX_SIZE = 17;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;
const GRID_ROWS = 40; 
const GRID_COLS = 40;

window.arena = {
    data: null, 
    sessionDocId: null, 
    unsub: null,
    scale: 1,
    tool: 'select',
    spawnTarget: null,
    selectedTokenId: null,
    isMaster: false,
    gridRendered: false,
    eventsAttached: false,
    drag: { active: false, startX: 0, startY: 0, panX: 0, panY: 0 },
    targeting: null,
    turnActions: { movement: false, action: false, free: false },
    
    hexDistance: function(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    },
    
    // --- INICIALIZAÇÃO ---
    init: function() {
        if (this.unsub) { 
            this.unsub(); 
            this.unsub = null; 
        }

        const activeSessionId = globalState.activeSessionId;
        if (!activeSessionId || activeSessionId === 'world') {
            this.showError("Selecione uma Sessão de Jogo no topo da página para carregar a Arena.");
            return;
        }

        this.sessionDocId = activeSessionId;
        this.gridRendered = false;
        this.data = null;
        this.selectedTokenId = null;
        
        // Injeta a interface completa antes de fazer qualquer outra coisa
        this.renderLayout();

        const svg = document.getElementById('arena-svg');
        if (svg && !this.eventsAttached) {
            svg.addEventListener('mousedown', e => {
                if(e.target.closest('#arena-ctx-menu')) return;
                if (e.target.tagName !== 'image' && !e.target.closest('.token')) {
                    this.drag.active = true;
                    this.drag.startX = e.clientX - this.drag.panX;
                    this.drag.startY = e.clientY - this.drag.panY;
                    svg.style.cursor = 'grabbing';
                }
            });
            window.addEventListener('mousemove', e => {
                if (this.drag.active) {
                    e.preventDefault();
                    this.drag.panX = e.clientX - this.drag.startX;
                    this.drag.panY = e.clientY - this.drag.startY;
                    this.updateTransform();
                }
                if (this.targeting) {
                    const pt = this.getSVGPoint(e);
                    const hex = this.pixelToHex(pt.x, pt.y);
                    this.renderAoEPreview(hex.q, hex.r);
                }
            });
            window.addEventListener('mouseup', () => {
                this.drag.active = false;
                if(svg) svg.style.cursor = 'grab';
            });
            this.eventsAttached = true;
        }

        // Listener do Firebase (Usa arrow function para manter o 'this')
        this.unsub = onSnapshot(doc(db, "rpg_sessions", this.sessionDocId), (snap) => {
            if (!snap.exists()) return this.showError("Sessão não encontrada.");
            
            const sessionData = snap.data();
            const arenaState = sessionData.arena_state || { 
                rodada: 1, turnoIndex: 0, tokens: {}, obstaculos: {}, auras: {}, ordemIniciativa: [], freeMovement: false 
            };

            if (this.data && this.data.turnoIndex !== arenaState.turnoIndex) {
                this.resetLocalActions();
            }
            
            if (this.data && this.data.mapaUrl !== arenaState.mapaUrl) {
                this.gridRendered = false;
            }
            
            this.data = arenaState;
            this.checkMasterRole(sessionData);
            this.renderCombatLog(sessionData.combat_log);
            this.updateFreeMoveButton();

            // Renderiza Grid e Obstáculos
            if (!this.gridRendered) this.renderGrid();
            else this.updateObstacles(); 
            
            // Renderiza Tokens, Auras e HUD
            this.renderAuras();
            this.renderTokens();
            this.renderTurnOrder();
            this.updateActionHUD();
            
            // Renderiza Lista de Spawn se for Mestre
            if (this.isMaster) this.renderSpawnList();
            
            const msg = document.getElementById('arena-overlay-msg');
            if(msg) msg.remove();
        });
    },

    renderLayout: function() {
        const container = document.getElementById('arena-combate-content');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-slate-950 p-2 rounded border border-slate-800 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <h2 class="text-amber-500 font-cinzel font-bold text-lg m-0 inline-block mr-2"><i class="fas fa-chess-board"></i> Arena Tática</h2>
                        <span id="arena-status-msg" class="text-[10px] uppercase font-bold"></span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <span id="arena-round-display" class="bg-slate-800 px-3 py-1 rounded text-xs border border-slate-700 font-bold text-white">Rodada 1</span>
                        <div id="player-action-hud" class="hidden flex gap-2">
                            <button id="btn-act-move" class="action-btn" onclick="window.arena.toggleAction('movement')" title="Mover"><i class="fas fa-walking"></i></button>
                            <button id="btn-act-main" class="action-btn" onclick="window.arena.toggleAction('action')" title="Ação"><i class="fas fa-fist-raised"></i></button>
                            <button id="btn-act-free" class="action-btn" onclick="window.arena.toggleAction('free')" title="Livre"><i class="fas fa-comment"></i></button>
                            <button class="action-btn bg-red-900/30 border-red-800 text-red-400" onclick="window.arena.endTurn()"><i class="fas fa-hourglass-end"></i></button>
                        </div>
                    </div>
                </div>
                <div id="arena-turn-list" class="turn-order-strip custom-scroll relative z-10 min-h-[70px]"></div>
                <div id="arena-skill-tray" class="hidden p-2 bg-slate-900 border-t border-slate-700 rounded-b-lg">
                    <div class="flex justify-between items-center mb-2">
                        <span id="arena-skill-instruction" class="text-[10px] text-amber-400 font-bold uppercase animate-pulse"></span>
                        <button onclick="window.arena.cancelTargeting()" class="text-red-400 text-xs px-2 py-1 rounded bg-red-900/20 border border-red-900">Cancelar</button>
                    </div>
                    <div id="arena-skill-list" class="flex gap-4 overflow-x-auto pb-2 min-h-[60px]"></div>
                </div>
            </div>

            <div class="hex-grid-container relative" id="arena-viewport" style="height: 600px; overflow: hidden; background: #000;">
                <svg id="arena-svg" width="100%" height="100%" style="overflow: visible; transition: transform 0.1s ease-out; cursor: grab;">
                    <g id="arena-layer-map"></g>
                    <g id="arena-layer-grid"></g>
                    <g id="arena-layer-preview"></g> 
                    <g id="arena-layer-auras"></g>
                    <g id="arena-layer-tokens"></g>
                </svg>
                <div class="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto">
                    <button onclick="window.arena.zoom(1.1)" class="w-8 h-8 rounded bg-slate-800 text-white font-bold border border-slate-600 shadow">+</button>
                    <button onclick="window.arena.zoom(0.9)" class="w-8 h-8 rounded bg-slate-800 text-white font-bold border border-slate-600 shadow">-</button>
                </div>
            </div>

            <div id="arena-combat-log" class="mt-2 h-32 overflow-y-auto font-mono text-[10px] bg-slate-950/80 p-2 rounded border border-slate-700 custom-scroll shadow-inner"></div>

            <div id="arena-gm-panel" class="hidden mt-4 bg-slate-900/90 rounded-xl border border-amber-600/30 shadow-2xl overflow-hidden">
                <div class="p-3 border-b border-slate-700 bg-slate-800 flex flex-wrap gap-2 items-center justify-between">
                    <div class="flex gap-2">
                        <button onclick="window.arena.setTool('select')" class="btn bg-blue-900/40 text-blue-200 text-[10px] uppercase font-bold border border-blue-700">Seleção</button>
                        <button onclick="window.arena.setTool('wall_hard')" class="btn bg-red-900/40 text-red-200 text-[10px] uppercase font-bold border border-red-700">Muro</button>
                        <button onclick="window.arena.setTool('wall_soft')" class="btn bg-orange-900/40 text-orange-200 text-[10px] uppercase font-bold border border-orange-700">Transp.</button>
                        <button onclick="window.arena.setTool('erase')" class="btn bg-slate-700 text-slate-300 text-[10px] uppercase font-bold">Borracha</button>
                        <button id="btn-arena-freemove" onclick="window.arena.toggleFreeMode()" class="btn bg-slate-700 text-slate-300 text-[10px] uppercase font-bold border border-slate-500 transition-all ml-2">Modo Livre</button>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="window.arena.clearArena()" class="btn bg-red-600 text-white text-[10px] font-bold uppercase">Limpar Tudo</button>
                        <div class="w-px h-6 bg-slate-600 mx-1"></div>
                        <button onclick="window.arena.nextTurn()" class="btn bg-emerald-600 text-white text-[10px] font-bold uppercase">Próx. Turno</button>
                    </div>
                </div>
                <div class="p-3 border-b border-slate-700 bg-slate-800/50 flex gap-2 items-center justify-between w-full">
                    <span id="arena-tool-display" class="text-[10px] text-amber-500 font-mono font-bold uppercase">Ferramenta: SELECIONAR</span>
                    <div class="flex items-center gap-2 border border-slate-700 p-1 rounded bg-slate-900/50">
                        <input type="text" id="arena-map-url" class="text-[10px] bg-slate-950 border-slate-700 w-32 rounded px-2 py-1 text-slate-300" placeholder="URL direta...">
                        <button onclick="window.arena.updateMap()" class="btn btn-secondary py-1 px-2 text-[10px]">URL</button>
                        <div class="w-px h-4 bg-slate-600 mx-1"></div>
                        <input type="file" id="arena-map-upload" accept="image/*" class="hidden" onchange="window.arena.uploadMap(this)">
                        <label for="arena-map-upload" class="btn btn-primary py-1 px-2 text-[10px] cursor-pointer flex items-center gap-1 m-0 shadow-lg transition hover:scale-105"><i class="fas fa-upload"></i> Upar</label>
                    </div>
                </div>
                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs text-slate-400 font-bold uppercase">Spawn Rápido</span>
                        <input type="text" id="arena-spawn-filter" placeholder="Buscar..." class="text-xs bg-slate-800 border border-slate-700 w-48 rounded px-2 py-1 outline-none focus:border-amber-500" onkeyup="window.arena.renderSpawnList()">
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-emerald-400 p-2 bg-emerald-900/20 text-center border-b border-emerald-900/30">Jogadores</div>
                            <div id="spawn-list-players" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-sky-400 p-2 bg-blue-900/20 text-center border-b border-blue-900/30">NPCs</div>
                            <div id="spawn-list-npcs" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-rose-400 p-2 bg-red-900/20 text-center border-b border-red-900/30">Monstros</div>
                            <div id="spawn-list-monsters" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="arena-ctx-menu" class="fixed z-[9999] hidden bg-slate-900 border-2 border-amber-500 rounded shadow-2xl min-w-[220px] overflow-hidden"></div>

            <div id="arena-attack-modal" class="fixed inset-0 z-[10000] bg-black/80 hidden items-center justify-center backdrop-blur-sm">
                <div class="bg-slate-900 border-2 border-amber-500 rounded-xl p-6 max-w-sm w-full shadow-2xl transform transition-all">
                    <h3 class="text-xl font-cinzel text-white text-center mb-4">Confirmar Ação</h3>
                    <div class="bg-slate-800 p-4 rounded mb-6 text-center border border-slate-700">
                        <div class="text-xs text-slate-400 uppercase mb-1">Habilidade</div>
                        <div id="modal-skill-name" class="text-amber-400 font-bold text-lg mb-2">---</div>
                        <div class="text-xs text-slate-400 uppercase mb-1">Alvo</div>
                        <div id="modal-target-name" class="text-red-400 font-bold text-lg mb-2">---</div>
                        <div class="mt-2 text-xs bg-blue-900/30 text-blue-300 py-1 px-2 rounded inline-block border border-blue-800">
                            Custo: <span id="modal-skill-cost">0</span> MP
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="window.arena.closeAttackModal()" class="btn bg-slate-700 hover:bg-slate-600 text-slate-300">Cancelar</button>
                        <button id="btn-confirm-attack" class="btn bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse">ATACAR!</button>
                    </div>
                </div>
            </div>
        `;
    },

    showError: function(text) {
        const container = document.getElementById('arena-viewport');
        if(container) container.innerHTML = `<div id="arena-overlay-msg" class="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-50 text-amber-500 font-cinzel text-xl font-bold p-10 text-center">${text}</div>`;
    },

    renderCombatLog: function(logs = []) {
        const logContainer = document.getElementById('arena-combat-log');
        if (!logContainer) return;
        logContainer.classList.remove('hidden'); 
        
        if (logs.length > 0) {
            const recentLogs = logs.slice(-20).reverse(); 
            logContainer.innerHTML = recentLogs.map(l => 
                `<div class="border-b border-slate-800 pb-1 mb-1 last:border-0 last:mb-0 leading-tight">
                    <span class="text-slate-500 font-bold">[${new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span> 
                    <span class="text-slate-300">${l.text}</span>
                </div>`
            ).join('');
        } else {
            logContainer.innerHTML = '<div class="text-slate-600 italic p-2">Aguardando combate...</div>';
        }
    },

    updateFreeMoveButton: function() {
        const btnFree = document.getElementById('btn-arena-freemove');
        if (!btnFree || !this.data) return;
        if (this.data.freeMovement) {
            btnFree.className = "btn bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] uppercase font-bold border border-emerald-400 transition-all ml-2 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
            btnFree.innerHTML = '<i class="fas fa-wind mr-1 animate-pulse"></i> Modo Livre (ON)';
        } else {
            btnFree.className = "btn bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] uppercase font-bold border border-slate-500 transition-all ml-2";
            btnFree.innerHTML = '<i class="fas fa-lock mr-1"></i> Modo Livre (OFF)';
        }
    },

    resetLocalActions: function() {
        this.turnActions = { movement: false, action: false, free: false };
        this.updateActionHUD();
    },

    checkMasterRole: function(sessionData) {
        const user = globalState.currentUser;
        const isAdmin = globalState.isAdmin;
        const isOwner = sessionData.ownerUid === user.uid;
        const isPlayer = (sessionData.playerIds || []).includes(globalState.selectedCharacterId);

        this.isMaster = isAdmin || isOwner;

        if (!this.isMaster && !isPlayer) {
             this.showError("Você não participa desta sessão.");
             return;
        }

        const container = document.getElementById('arena-combate-content');
        const panel = document.getElementById('arena-gm-panel');
        const statusMsg = document.getElementById('arena-status-msg');

        if (this.isMaster) {
            if(container) { container.classList.add('is-master'); container.classList.remove('is-player'); }
            if(panel) panel.classList.remove('hidden');
            if(statusMsg) {
                statusMsg.textContent = "MODO MESTRE";
                statusMsg.className = "text-[10px] text-amber-500 uppercase font-bold ml-2";
            }
        } else {
            if(container) { container.classList.add('is-player'); container.classList.remove('is-master'); }
            if(panel) panel.classList.add('hidden');
            if(statusMsg) {
                statusMsg.textContent = "MODO JOGADOR";
                statusMsg.className = "text-[10px] text-emerald-500 uppercase font-bold ml-2";
            }
        }
        
        const roundDisplay = document.getElementById('arena-round-display');
        if(roundDisplay) roundDisplay.textContent = `Rodada ${this.data.rodada || 1}`;
    },

    clearArena: async function() {
        if(!confirm("TEM CERTEZA? Isso removerá TODOS os tokens e muros desta sessão.")) return;
        await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), {
            arena_state: {
                tokens: {},
                obstaculos: {},
                auras: {},
                ordemIniciativa: [],
                rodada: 1,
                turnoIndex: 0,
                mapaUrl: this.data.mapaUrl || "" 
            }
        });
    },

    // --- ATUALIZAÇÃO DE STATUS (CASCATA) ---
    modStat: async function(tokenId, field, multiplier, inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const val = parseInt(input.value);
        if (isNaN(val) || val <= 0) return;

        const change = val * multiplier;
        const t = this.data.tokens[tokenId];
        if (!t) return;

        const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
        let newTotal = 0;
        let cascadeUpdates = null;
        let charIdToUpdate = null;

        if (t.type === 'player' && t.originId) {
            const charId = t.originId;
            const fichaData = globalState.cache.all_personagens.get(charId); 
            
            if (fichaData) {
                const cascade = calculateStatCascade(fichaData.ficha || fichaData, field, change);
                newTotal = cascade.total;
                cascadeUpdates = cascade.updates;
                charIdToUpdate = charId;
            }
        } 
        else {
            const currentVal = parseInt(t[field] || 0);
            newTotal = Math.max(0, currentVal + change);
        }

        try {
            await updateDoc(sessionRef, { [`arena_state.tokens.${tokenId}.${field}`]: newTotal });
            
            if (cascadeUpdates && charIdToUpdate) {
                try {
                    await updateDoc(doc(db, "rpg_fichas", charIdToUpdate), cascadeUpdates);
                } catch(e) {
                    console.warn(`Aviso: Falha ao salvar dano/cura na ficha raiz do jogador ${charIdToUpdate}.`, e);
                }
            }
            this.showFloatingText(change > 0 ? `+${val}` : `-${val}`, tokenId, change > 0 ? '#4ade80' : '#ef4444');
        } catch (err) {
            console.error("Erro sync:", err);
        }
    },
    
    // --- MAGIAS E COMBATE (TARGETING) ---
    renderArenaSkills: function() {
        const container = document.getElementById('arena-skill-list');
        const instruction = document.getElementById('arena-skill-instruction');
        if(!container) return;
        container.innerHTML = '';
        
        let skillsSource = {};
        let actorName = "Personagem";
        let currentMp = 0;

        if (this.isMaster && this.selectedTokenId) {
            const token = this.data.tokens[this.selectedTokenId];
            if (token && token.originId) {
                let cached = globalState.cache.mobs.get(token.originId) || globalState.cache.all_personagens.get(token.originId);
                if (cached) {
                    skillsSource = cached.habilidades || {};
                    actorName = cached.nome;
                    currentMp = Number(token.mp) || 0;
                    
                    const allIds = Object.keys(skillsSource);
                    if (allIds.length > 0 && !allIds.some(k => skillsSource[k].isFavorite)) {
                        allIds.forEach(k => skillsSource[k].isFavorite = true);
                    }
                }
            }
        } else {
            const charData = globalState.selectedCharacterData;
            if (charData && charData.ficha) {
                skillsSource = charData.ficha.habilidades || {};
                actorName = charData.ficha.nome;
            }
            const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === globalState.selectedCharacterId);
            if (myTokenEntry) currentMp = Number(myTokenEntry[1].mp) || 0;
            else currentMp = Number(charData?.ficha?.mpPersonagemBase) || 0;
        }

        const favs = Object.keys(skillsSource).filter(id => skillsSource[id].isFavorite === true);

        if (favs.length === 0) {
            container.innerHTML = `<span class="text-[10px] text-slate-500 italic p-2">Nenhuma habilidade favorita encontrada.</span>`;
            return;
        }

        if(instruction) {
            instruction.innerHTML = `<i class="fas fa-hand-pointer mr-1"></i> Passo 1: Escolha a Habilidade de <strong>${actorName}</strong>`;
            instruction.className = "text-[10px] text-amber-400 uppercase font-bold animate-pulse";
        }

        favs.forEach(id => {
            const master = globalState.cache.habilidades.get(id);
            if (!master) return;
            
            const userSkill = skillsSource[id];
            let dano = Number(master.efeitoDanoBaseUsoHabilidade) || 0;
            if (master.niveis && master.niveis[userSkill.nivel]) {
                dano = Number(master.niveis[userSkill.nivel].danoBaseHabilidade) || dano;
            }
            
            const custoMp = Number(master.gastoMpUso) || 0;
            const canCast = this.isMaster || currentMp >= custoMp;

            const btn = document.createElement('div');
            btn.className = `arena-skill-btn ${!canCast ? 'grayscale opacity-50 cursor-not-allowed border-red-900' : ''}`;
            btn.style.backgroundImage = `url('${master.imagemUrl || PLACEHOLDER_IMAGE_URL}')`;
            btn.title = `${master.nome}\nCusto: ${custoMp} MP\nDano Base: ${dano}`;
            
            if (canCast) {
                btn.onclick = () => this.enterTargetMode(id, master.nome, custoMp, dano, btn);
            } else {
                btn.onclick = () => alert(`Falta Mana!\n\nVocê tem: ${currentMp} MP\nA magia exige: ${custoMp} MP`);
            }
            container.appendChild(btn);
        });
    },

    enterTargetMode: function(skillId, name, mp, dmg, btnElement) {
        document.querySelectorAll('.arena-skill-btn').forEach(b => b.classList.remove('selected'));
        if(btnElement) btnElement.classList.add('selected');

        const masterSkill = globalState.cache.habilidades.get(skillId);
        const aoeRadius = parseInt(masterSkill.movimentacaoHabilidade) || 0;
        let duration = parseInt(masterSkill.duracaoHabilidade);
        if(isNaN(duration) || duration <= 0) duration = 1;

        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === globalState.selectedCharacterId);
        const myColor = myTokenEntry ? (myTokenEntry[1].color || "#f59e0b") : "#f59e0b";

        this.targeting = { skillId, skillName: name, mpCost: mp, damage: dmg, radius: aoeRadius, duration: duration, color: myColor };
        
        if (myTokenEntry) this.selectedTokenId = myTokenEntry[0];
        this.renderTokens(); 
        
        const instruction = document.getElementById('arena-skill-instruction');
        if(instruction) {
            instruction.innerHTML = `PASSO 2: CLIQUE EM QUALQUER ÁREA VERDE PARA ATIRAR!`;
            instruction.className = "text-[10px] text-red-400 uppercase font-bold animate-pulse";
        }
    },

    cancelTargeting: function() {
        this.targeting = null;
        const tray = document.getElementById('arena-skill-tray');
        if (tray) tray.classList.add('hidden');
        document.querySelectorAll('.arena-skill-btn').forEach(b => b.classList.remove('selected'));
        
        const previewLayer = document.getElementById('arena-layer-preview');
        if (previewLayer) previewLayer.innerHTML = ''; 

        const statusMsg = document.getElementById('arena-status-msg');
        if(statusMsg) {
            statusMsg.textContent = this.isMaster ? "MODO MESTRE" : "MODO JOGADOR";
            statusMsg.className = `text-[10px] ${this.isMaster ? 'text-amber-500' : 'text-emerald-500'} uppercase font-bold ml-2`;
        }
        this.renderTokens();
    },

    requestAttack: function(targetTokenId) {
        if (!this.targeting) return;
        
        const skill = this.targeting;
        const charId = globalState.selectedCharacterId;
        const targetToken = this.data.tokens[targetTokenId];
        
        if (!targetToken) return;

        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
        if (myTokenEntry) {
            const myToken = myTokenEntry[1];
            if ((myToken.mp || 0) < skill.mpCost && !this.isMaster) {
                alert(`MP Insuficiente! (Tem: ${myToken.mp}, Precisa: ${skill.mpCost})`);
                this.cancelTargeting();
                return;
            }
        } else if (!this.isMaster) {
            alert("Seu token não está na arena.");
            return;
        }

        const mName = document.getElementById('modal-skill-name');
        const mTarget = document.getElementById('modal-target-name');
        const mCost = document.getElementById('modal-skill-cost');
        if (mName) mName.textContent = skill.skillName;
        if (mTarget) mTarget.textContent = targetToken.name;
        if (mCost) mCost.textContent = skill.mpCost;
        
        const btnConfirm = document.getElementById('btn-confirm-attack');
        if (btnConfirm) btnConfirm.onclick = () => this.confirmAttack(targetTokenId, targetToken.name);
        
        const modal = document.getElementById('arena-attack-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeAttackModal: function() {
        const modal = document.getElementById('arena-attack-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    confirmAttack: async function(targetTokenId, targetName) {
        this.closeAttackModal(); 
        
        const skill = this.targeting;
        const charId = globalState.selectedCharacterId;
        
        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
        const myToken = myTokenEntry ? myTokenEntry[1] : { name: "Mestre/Oculto" };
        const myTokenId = myTokenEntry ? myTokenEntry[0] : null;

        const charData = globalState.cache.all_personagens.get(charId);
        const ficha = charData ? (charData.ficha || charData) : {};

        const costToDeduct = Number(skill.mpCost) || 0;

        const masterSkill = globalState.cache.habilidades.get(skill.skillId);
        let statName = "ATK";
        let rawStatVal = Number(ficha.atkPersonagemBase) || 0;

        if (masterSkill && masterSkill.atributoInfluenciaHabilidade) {
            const inf = Array.isArray(masterSkill.atributoInfluenciaHabilidade) ? masterSkill.atributoInfluenciaHabilidade[0] : masterSkill.atributoInfluenciaHabilidade;
            if (inf && inf.includes('Defesa')) {
                statName = "DEF";
                rawStatVal = Number(ficha.defPersonagemBase) || 0;
            } else if (inf && inf.includes('Evasao')) {
                statName = "EVA";
                rawStatVal = Number(ficha.evaPersonagemBase) || 0;
            }
        }

        const debuffFome = getFomeDebuffMultiplier(ficha);
        const statTotal = Math.floor(rawStatVal * debuffFome);
        const isDebuffed = debuffFome < 1;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const totalDano = d20 + Number(skill.damage) + statTotal;

        let statIcon = "⚔️";
        if(statName === "DEF") statIcon = "🛡️";
        if(statName === "EVA") statIcon = "🏃";
        const hungerWarn = isDebuffed ? ` <span class="text-[10px] text-red-500" title="Debuff de Fome Ativo!"><i class="fas fa-drumstick-bite"></i></span>` : '';

        const logMsg = `⚔️ <strong class="text-emerald-400">${myToken.name}</strong> lançou <span class="text-amber-400">${skill.skillName}</span> em <strong class="text-red-400">${targetName}</strong>.<br>Rolagem: [D20: ${d20}] + 💥${skill.damage} + ${statIcon}${statTotal}${hungerWarn} = <span class="text-xl font-bold text-white border-b border-red-500">${totalDano}</span>`;

        try {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            let cascadeUpdates = null;
            
            if (myTokenId && charId && charData) {
                const cascade = calculateStatCascade(charData.ficha || charData, 'mp', -costToDeduct);
                cascadeUpdates = cascade.updates;
            }

            const newLogEntry = { text: logMsg, timestamp: Date.now(), type: 'attack' };
            const sessionUpdates = { combat_log: arrayUnion(newLogEntry) };

            if (myTokenId && cascadeUpdates) {
                sessionUpdates[`arena_state.tokens.${myTokenId}.mp`] = cascadeUpdates.mpPersonagemBase || 0;
            }

            await updateDoc(sessionRef, sessionUpdates);

            if (cascadeUpdates && charId) {
                try {
                    await updateDoc(doc(db, "rpg_fichas", charId), cascadeUpdates);
                } catch(e) {
                    console.warn(`Aviso de Sync Ficha:`, e);
                }
            }

            this.showFloatingText(`-${costToDeduct} MP`, myTokenId, '#60a5fa');
            this.showFloatingText(`HIT! ${totalDano}`, targetTokenId, '#ef4444');

            this.turnActions.action = true;
            this.updateActionHUD();
            this.cancelTargeting();

        } catch(e) {
            console.error(e);
            alert("Erro ao processar ataque.");
        }
    },

    executeAreaSkill: async function(targetQ, targetR) {
        if (!this.targeting) return;
        const skill = this.targeting;
        const charId = globalState.selectedCharacterId;
        
        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
        if(!myTokenEntry && !this.isMaster) return alert("Seu token não está na arena!");
        
        const myTokenId = myTokenEntry ? myTokenEntry[0] : null;
        const myToken = myTokenEntry ? myTokenEntry[1] : { name: "O Mestre", color: "#f59e0b" };

        const charData = globalState.cache.all_personagens.get(charId);
        const ficha = charData ? (charData.ficha || charData) : {};

        const costToDeduct = Number(skill.mpCost) || 0;
        let totalCurrentMp = Number(myToken.mp) || 0;

        if (charData && myToken.type === 'player') {
            const attrs = ficha.atributosBasePersonagem || {};
            const mpShield = ficha.mpShieldAtual !== undefined ? Number(ficha.mpShieldAtual) : Number(attrs.defesaMagicaNativaTotal||0);
            const mpExtra = ficha.mpExtraAtual !== undefined ? Number(ficha.mpExtraAtual) : Number(attrs.pontosMPExtraTotal||0);
            const mpBase = ficha.mpPersonagemBase !== undefined ? Number(ficha.mpPersonagemBase) : Number(ficha.mpMaxPersonagemBase || 1);
            totalCurrentMp = mpBase + mpExtra + mpShield;
        }

        if (myTokenId && !this.isMaster) {
            if (totalCurrentMp < costToDeduct) {
                alert(`MP Insuficiente!\n\nVocê tem: ${totalCurrentMp} MP\nA magia exige: ${costToDeduct} MP`);
                this.cancelTargeting();
                return;
            }
        }

        const masterSkill = globalState.cache.habilidades.get(skill.skillId);
        let statName = "ATK";
        let rawStatVal = Number(ficha.atkPersonagemBase) || 0;

        if (masterSkill && masterSkill.atributoInfluenciaHabilidade) {
            const inf = Array.isArray(masterSkill.atributoInfluenciaHabilidade) ? masterSkill.atributoInfluenciaHabilidade[0] : masterSkill.atributoInfluenciaHabilidade;
            if (inf && inf.includes('Defesa')) { statName = "DEF"; rawStatVal = Number(ficha.defPersonagemBase) || 0; } 
            else if (inf && inf.includes('Evasao')) { statName = "EVA"; rawStatVal = Number(ficha.evaPersonagemBase) || 0; }
        }

        const debuffFome = getFomeDebuffMultiplier(ficha);
        const statTotal = Math.floor(rawStatVal * debuffFome);
        const isDebuffed = debuffFome < 1;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const totalDano = d20 + Number(skill.damage) + statTotal;

        let statIcon = statName === "DEF" ? "🛡️" : (statName === "EVA" ? "🏃" : "⚔️");
        const hungerWarn = isDebuffed ? ` <span class="text-[10px] text-red-500" title="Debuff de Fome Ativo!"><i class="fas fa-drumstick-bite"></i></span>` : '';

        const hitTokensIds = [];
        const hitTokensNames = [];
        Object.entries(this.data.tokens).forEach(([tid, tok]) => {
            if (this.hexDistance(targetQ, targetR, tok.q, tok.r) <= skill.radius) {
                hitTokensIds.push(tid);
                hitTokensNames.push(tok.name);
            }
        });
        
        const hitString = hitTokensNames.length > 0 ? `💥 Atingiu: ${hitTokensNames.join(', ')}` : `Atingiu apenas o chão.`;

        const auraId = `aura_${Date.now()}`;
        const newAura = {
            skillName: skill.skillName,
            q: targetQ,
            r: targetR,
            radius: skill.radius,
            color: skill.color || "#f59e0b",
            duration: skill.duration,
            casterName: myToken.name,
            casterTokenId: myTokenId 
        };

        const logMsg = `🌀 <strong style="color:${newAura.color}">${myToken.name}</strong> conjurou <span class="text-amber-400">${skill.skillName}</span>!<br>Rolagem: [D20: ${d20}] + Base:${skill.damage} + ${statIcon}${statTotal}${hungerWarn} = <span class="text-xl font-bold text-white border-b border-red-500">${totalDano}</span><br><span class="text-xs text-sky-300 block mt-1">${hitString}</span>`;

        try {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            let cascadeUpdates = null;
            
            if (myTokenId && charId && charData) {
                const cascade = calculateStatCascade(charData.ficha || charData, 'mp', -Math.abs(costToDeduct));
                cascadeUpdates = cascade.updates;
            }

            const newLogEntry = { text: logMsg, timestamp: Date.now(), type: 'attack' };
            const sessionUpdates = {
                combat_log: arrayUnion(newLogEntry),
                [`arena_state.auras.${auraId}`]: newAura
            };

            if (myTokenId && cascadeUpdates) {
                sessionUpdates[`arena_state.tokens.${myTokenId}.mp`] = cascadeUpdates.mpPersonagemBase || 0;
            }

            await updateDoc(sessionRef, sessionUpdates);

            if (cascadeUpdates && charId) {
                try {
                    await updateDoc(doc(db, "rpg_fichas", charId), cascadeUpdates);
                } catch(e) {
                    console.warn(`Aviso de Sync Ficha:`, e);
                }
            }

            this.showFloatingText(`-${costToDeduct} MP`, myTokenId, '#60a5fa');
            hitTokensIds.forEach(id => this.showFloatingText(`HIT! ${totalDano}`, id, '#ef4444'));

            this.turnActions.action = true;
            this.updateActionHUD();
            this.cancelTargeting();

        } catch(e) {
            console.error(e);
            alert("Erro ao processar magia em área.");
        }
    },

    // --- MOVIMENTAÇÃO ---
    handleHexClick: async function(q, r) {
        const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);

        if (this.targeting) {
            const hexEl = document.querySelector(`.hex[data-q="${q}"][data-r="${r}"]`);
            if (!hexEl || !hexEl.classList.contains('reachable')) {
                return alert("Fora do seu alcance! Clique num hexágono verde.");
            }
            this.executeAreaSkill(q, r);
            return;
        }

        if (this.isMaster && this.tool !== 'select') {
            const key = `${q},${r}`;
            const updateKey = `arena_state.obstaculos.${key}`;
            if (this.tool === 'erase') await updateDoc(sessionRef, { [updateKey]: deleteField() });
            else if (this.tool === 'spawn' && this.spawnTarget) await this.spawnTokenAt(q, r);
            else await updateDoc(sessionRef, { [updateKey]: this.tool.replace('wall_', '') });
            this.updateObstacles(); 
            return;
        }

        if (this.selectedTokenId) {
            const t = this.data.tokens[this.selectedTokenId];
            if (!this.isMaster) {
                if (t.originId !== globalState.selectedCharacterId) return alert("Você só controla seu personagem.");
                if (!this.data.freeMovement) {
                    const turnId = this.data.ordemIniciativa?.[this.data.turnoIndex];
                    if (this.selectedTokenId !== turnId) return alert("Não é seu turno!");
                    if (this.turnActions.movement) return alert("Movimento já realizado.");
                }
                const hexEl = document.querySelector(`.hex[data-q="${q}"][data-r="${r}"]`);
                if (!hexEl || !hexEl.classList.contains('reachable')) return alert("Movimento inválido.");
            }

            await updateDoc(sessionRef, {
                [`arena_state.tokens.${this.selectedTokenId}.q`]: q,
                [`arena_state.tokens.${this.selectedTokenId}.r`]: r
            });
            
            if(!this.isMaster && !this.data.freeMovement) {
                this.turnActions.movement = true;
                this.updateActionHUD();
            }
            
            this.selectedTokenId = null;
            this.renderTokens();
        }
    },

    spawnTokenAt: async function(q, r) {
        const originId = this.spawnTarget.id;
        const type = this.spawnTarget.data.type;
        const collectionKey = type === 'player' ? 'colecao_jogadores' : (type === 'npc' ? 'colecao_npcs' : 'colecao_monstros');

        const id = `${originId}_${Date.now()}`;
        
        const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#eab308'];
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

        const token = { ...this.spawnTarget.data, q, r, originId: originId, originCollection: this.spawnTarget.collection, color: randomColor };
        
        try {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            await updateDoc(sessionRef, {
                [`arena_state.tokens.${id}`]: token,
                [`arena_state.ordemIniciativa`]: arrayUnion(id)
            });

            const sessionData = globalState.userSessions.find(s => s.id === this.sessionDocId);
            if (sessionData && sessionData.playerIds && sessionData.playerIds.length > 0) {
                const updatePath = `${collectionKey}.${originId}`;
                
                sessionData.playerIds.forEach(async (playerId) => {
                    if (playerId !== originId) {
                        const pFicha = globalState.cache.all_personagens.get(playerId);
                        if (pFicha && pFicha[collectionKey] && pFicha[collectionKey][originId]) return;

                        try {
                            const playerRef = doc(db, "rpg_fichas", playerId);
                            await updateDoc(playerRef, { [updatePath]: Date.now() });
                        } catch(e) {
                            console.warn(`Aviso: Falha ao adicionar à coleção.`);
                        }
                    }
                });
            }

            this.setTool('select'); 
            document.body.style.cursor = 'default';
        } catch (e) {
            console.error("Erro ao inserir token:", e);
        }
    },

    nextTurn: async function() {
        const order = this.data.ordemIniciativa || [];
        if (order.length === 0) return alert("Adicione combatentes à iniciativa antes de iniciar.");
        
        const currentIdx = this.data.turnoIndex || 0;
        let next = (currentIdx + 1) % order.length;
        let round = this.data.rodada || 1; 
        const updates = {};

        if (next === 0) round++;

        const nextTokenId = order[next]; 
        const auras = this.data.auras || {};
        
        for (let [aId, aura] of Object.entries(auras)) {
            let shouldTick = false;
            
            if (aura.casterTokenId === nextTokenId) {
                shouldTick = true;
            } 
            else if (!order.includes(aura.casterTokenId) && next === 0) {
                shouldTick = true;
            }

            if (shouldTick) {
                if (aura.duration > 0) {
                    const newDur = aura.duration - 1;
                    if (newDur <= 0) {
                        updates[`arena_state.auras.${aId}`] = deleteField(); 
                    } else {
                        updates[`arena_state.auras.${aId}.duration`] = newDur;
                    }
                }
            }
        }
        
        updates["arena_state.turnoIndex"] = next;
        updates["arena_state.rodada"] = round;

        try {
            await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), updates);
        } catch (e) {
            console.error("Erro ao passar turno:", e);
        }
    },

    toggleAction: function(type) {
        if(this.turnActions[type]) return; 
        
        if (type !== 'action') {
            if(confirm(`Usar ação ${type}?`)) {
                this.turnActions[type] = true;
                this.updateActionHUD();
                if(type === 'movement') this.renderTokens();
            }
            return;
        }

        const tray = document.getElementById('arena-skill-tray');
        if (tray.classList.contains('hidden')) {
            this.renderArenaSkills();
            tray.classList.remove('hidden');
        } else {
            this.cancelTargeting();
        }
    },

    // --- RENDERIZADORES DE CAMADAS DO SVG ---
    renderGrid: function() {
        const gridLayer = document.getElementById('arena-layer-grid');
        const mapLayer = document.getElementById('arena-layer-map');
        if(!gridLayer) return;

        gridLayer.innerHTML = '';
        mapLayer.innerHTML = '';

        if (window.arena.data && window.arena.data.mapaUrl) {
            const width = (GRID_COLS + 0.5) * HEX_WIDTH;
            const height = (GRID_ROWS * 1.5 * HEX_SIZE) + HEX_SIZE;
            mapLayer.innerHTML = `<image href="${window.arena.data.mapaUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" style="opacity: 0.6;" />`;
        }

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let q = 0; q < GRID_COLS; q++) {
                const qAxial = q - Math.floor(r / 2);
                const pos = window.arena.hexToPixel(qAxial, r);
                
                const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                hex.setAttribute("points", window.arena.getHexPoints(pos.x, pos.y));
                hex.setAttribute("class", "hex");
                hex.dataset.q = qAxial;
                hex.dataset.r = r;
                
                hex.onclick = () => window.arena.handleHexClick(qAxial, r);
                hex.onmouseenter = () => {
                    if (window.arena.targeting) window.arena.renderAoEPreview(qAxial, r);
                };
                
                gridLayer.appendChild(hex);
            }
        }
        window.arena.gridRendered = true;
        window.arena.updateObstacles();
        window.arena.renderAuras(); 
    },

    renderAoEPreview: function(q, r) {
        const previewLayer = document.getElementById('arena-layer-preview');
        if (!previewLayer) return;
        previewLayer.innerHTML = '';
        
        const skill = window.arena.targeting;
        if (!skill) return;
        
        const hexEl = document.querySelector(`.hex[data-q="${q}"][data-r="${r}"]`);
        if (!hexEl || !hexEl.classList.contains('reachable')) return; 

        for (let tr = 0; tr < GRID_ROWS; tr++) {
            for (let tq = 0; tq < GRID_COLS; tq++) {
                const tqAxial = tq - Math.floor(tr / 2);
                
                if (window.arena.hexDistance(q, r, tqAxial, tr) <= skill.radius) {
                    const pos = window.arena.hexToPixel(tqAxial, tr);
                    const ghost = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    ghost.setAttribute("points", window.arena.getHexPoints(pos.x, pos.y));
                    ghost.setAttribute("fill", skill.color);
                    ghost.setAttribute("fill-opacity", "0.4");
                    ghost.setAttribute("stroke", "#ffffff");
                    ghost.style.pointerEvents = "none";
                    previewLayer.appendChild(ghost);
                }
            }
        }
    },

    renderAuras: function() {
        const aurasLayer = document.getElementById('arena-layer-auras');
        if (!aurasLayer) return;
        aurasLayer.innerHTML = '';

        const auras = window.arena.data?.auras || {};
        
        Object.values(auras).forEach(aura => {
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let q = 0; q < GRID_COLS; q++) {
                    const qAxial = q - Math.floor(r / 2);
                    
                    if (window.arena.hexDistance(aura.q, aura.r, qAxial, r) <= aura.radius) {
                        const pos = window.arena.hexToPixel(qAxial, r);
                        const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                        hex.setAttribute("points", window.arena.getHexPoints(pos.x, pos.y));
                        hex.setAttribute("fill", aura.color);
                        hex.setAttribute("fill-opacity", "0.2"); 
                        hex.setAttribute("stroke", aura.color);
                        hex.setAttribute("stroke-opacity", "0.2");
                        hex.style.pointerEvents = "none";
                        aurasLayer.appendChild(hex);
                    }
                }
            }
        });
    },

    updateObstacles: function() {
        const hexes = document.querySelectorAll('#arena-layer-grid .hex');
        hexes.forEach(hex => {
            const key = `${hex.dataset.q},${hex.dataset.r}`;
            const obs = this.data.obstaculos?.[key];
            let cls = "hex";
            if (obs) cls += ` wall-${obs}`;
            if (hex.classList.contains('reachable')) cls += " reachable";
            hex.setAttribute("class", cls);
        });
    },

    renderTokens: function() {
        const layer = document.getElementById('arena-layer-tokens');
        if(!layer) return;
        layer.innerHTML = '';
        const turnId = this.data.ordemIniciativa?.[this.data.turnoIndex];
        let reachableSet = new Set();
        const activeAuras = this.data.auras || {}; 

        if (this.selectedTokenId && this.data.tokens[this.selectedTokenId]) {
            const t = this.data.tokens[this.selectedTokenId];
            if (!this.isMaster || this.targeting) { 
                let realMove = 5;
                if(t.originCollection === 'rpg_fichas') {
                    const cached = globalState.cache?.all_personagens?.get(t.originId) || globalState.cache?.players?.get(t.originId);
                    if(cached) {
                        const baseMove = parseInt(cached.movimentoPersonagemBase || 5);
                        // Chama window pq não importamos a calculateWeightStats diretamente se ela estiver fora do escopo, 
                        // mas para evitar erros vamos garantir q existe. Usualmente 5 é fallback.
                        let penalty = 0;
                        if(window.calculateWeightStats) {
                            penalty = window.calculateWeightStats(cached, cached.levelPersonagemBase || 1).penalty;
                        }
                        realMove = Math.max(0, baseMove - penalty);
                    }
                } else {
                    const cached = globalState.cache?.mobs?.get(t.originId);
                    if(cached) realMove = parseInt(cached.explorixMovimento || 5);
                }
                reachableSet = this.getReachableHexes(t.q, t.r, realMove);
            }
        }

        const isTargeting = !!this.targeting;

        const hexes = document.querySelectorAll('#arena-layer-grid .hex');
        hexes.forEach(hex => {
            const key = `${hex.dataset.q},${hex.dataset.r}`;
            const obs = this.data.obstaculos?.[key];
            
            const canShow = this.selectedTokenId && reachableSet.has(key) && (isTargeting || (!this.isMaster && !this.turnActions.movement));
            
            if (canShow && !obs) hex.classList.add('reachable');
            else hex.classList.remove('reachable');
            if(obs) hex.classList.add(`wall-${obs}`);
        });

        Object.entries(this.data.tokens || {}).forEach(([id, t]) => {
            if (!this.isMaster && !t.visivel) return;

            let maxHP = Number(t.hpMax) || 10;
            let maxMP = Number(t.mpMax) || 10;
            let currentHP = Number(t.hp);
            let currentMP = Number(t.mp);
            let imgUrl = t.img;

            if (t.originId && globalState.cache) {
                let cached = null;
                if (t.originCollection === 'rpg_fichas' && globalState.cache.players) {
                    cached = globalState.cache.players.get(t.originId) || globalState.cache.all_personagens.get(t.originId);
                    
                    if (cached) {
                        const attrs = cached.atributosBasePersonagem || {};
                        const hpShieldMax = Number(attrs.defesaCorporalNativaTotal) || 0;
                        const hpExtraMax = Number(attrs.pontosHPExtraTotal) || 0;
                        maxHP = (Number(cached.hpMaxPersonagemBase) || 1) + hpShieldMax + hpExtraMax;

                        const mpShieldMax = Number(attrs.defesaMagicaNativaTotal) || 0;
                        const mpExtraMax = Number(attrs.pontosMPExtraTotal) || 0;
                        maxMP = (Number(cached.mpMaxPersonagemBase) || 1) + mpShieldMax + mpExtraMax;

                        const hpShieldAtual = cached.hpShieldAtual !== undefined ? Number(cached.hpShieldAtual) : hpShieldMax;
                        const hpExtraAtual = cached.hpExtraAtual !== undefined ? Number(cached.hpExtraAtual) : hpExtraMax;
                        const hpBaseAtual = cached.hpPersonagemBase !== undefined ? Number(cached.hpPersonagemBase) : (Number(cached.hpMaxPersonagemBase) || 1);
                        currentHP = Math.max(0, hpBaseAtual + hpShieldAtual + hpExtraAtual);

                        const mpShieldAtual = cached.mpShieldAtual !== undefined ? Number(cached.mpShieldAtual) : mpShieldMax;
                        const mpExtraAtual = cached.mpExtraAtual !== undefined ? Number(cached.mpExtraAtual) : mpExtraMax;
                        const mpBaseAtual = cached.mpPersonagemBase !== undefined ? Number(cached.mpPersonagemBase) : (Number(cached.mpMaxPersonagemBase) || 1);
                        currentMP = Math.max(0, mpBaseAtual + mpShieldAtual + mpExtraAtual);
                    }
                } else if (globalState.cache.mobs) {
                    cached = globalState.cache.mobs.get(t.originId);
                    if(cached) {
                        maxHP = Number(cached.hpMaxPersonagemBase) || maxHP;
                        maxMP = Number(cached.mpMaxPersonagemBase) || maxMP;
                    }
                }

                if (cached && cached.imagemPrincipal && cached.imageUrls?.[cached.imagemPrincipal]) {
                    imgUrl = cached.imageUrls[cached.imagemPrincipal];
                } else if (cached && cached.imageUrls?.imagem1) {
                    imgUrl = cached.imageUrls.imagem1;
                }
            }

            if (isNaN(currentHP)) currentHP = maxHP;
            if (isNaN(currentMP)) currentMP = maxMP;

            const dispHp = document.getElementById(`ctx-disp-hp-${id}`);
            const dispMp = document.getElementById(`ctx-disp-mp-${id}`);
            if (dispHp) dispHp.textContent = currentHP;
            if (dispMp) dispMp.textContent = currentMP;

            const pos = this.hexToPixel(t.q, t.r);
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
            
            let tokenClass = "token";
            if (id === turnId) tokenClass += " active-turn";
            if (id === this.selectedTokenId) tokenClass += " selected";
            if (this.targeting) tokenClass += " targetable"; 
            if (!t.visivel) tokenClass += " gm-ghost";
            group.setAttribute("class", tokenClass);

            const hpPct = Math.max(0, Math.min(1, currentHP / maxHP));
            const mpPct = Math.max(0, Math.min(1, currentMP / maxMP));
            let barColor = hpPct < 0.25 ? '#ef4444' : (hpPct < 0.5 ? '#f59e0b' : '#22c55e');

            let statusTooltip = "";
            let isAffected = false;
            let auraGlowColor = "";

            Object.values(activeAuras).forEach(aura => {
                if (this.hexDistance(aura.q, aura.r, t.q, t.r) <= aura.radius) {
                    isAffected = true;
                    auraGlowColor = aura.color; 
                    statusTooltip += `☢️ ${aura.skillName} (${aura.duration} rodada(s) restantes)\n`;
                }
            });

            const affectedFilter = isAffected && !this.targeting ? `filter="drop-shadow(0 0 10px ${auraGlowColor})"` : "";
            const safeImgUrl = (imgUrl && imgUrl.startsWith('http')) ? imgUrl : IMG_PLACEHOLDER_BASE64;

            group.innerHTML = `
                <defs><clipPath id="clip-${id}"><circle r="${HEX_SIZE * 0.85}" cx="0" cy="0"/></clipPath></defs>
                ${isAffected ? `<title>Sob Efeito Mágico:\n${statusTooltip}</title>` : `<title>${t.name}</title>`}
                
                <circle r="${HEX_SIZE * 0.92}" fill="#050505" stroke="${id === turnId ? '#f59e0b' : (t.type === 'player' ? (t.color || '#34d399') : '#ef4444')}" stroke-width="${id === turnId ? 4 : 2}" ${affectedFilter}/>
                
                <image href="${safeImgUrl}" x="-${HEX_SIZE}" y="-${HEX_SIZE}" width="${HEX_SIZE*2}" height="${HEX_SIZE*2}" 
                       clip-path="url(#clip-${id})" preserveAspectRatio="xMidYMid slice" style="pointer-events:none" />
                
                <rect x="-20" y="${HEX_SIZE * 0.5}" width="40" height="5" fill="#000" rx="1" stroke="#000" stroke-width="0.5"/>
                <rect x="-20" y="${HEX_SIZE * 0.5}" width="${hpPct * 40}" height="5" fill="${barColor}" rx="1"/>
                
                <rect x="-20" y="${HEX_SIZE * 0.5 + 7}" width="40" height="5" fill="#000" rx="1" stroke="#000" stroke-width="0.5"/>
                <rect x="-20" y="${HEX_SIZE * 0.5 + 7}" width="${mpPct * 40}" height="5" fill="#3b82f6" rx="1"/>

                <text y="-${HEX_SIZE + 5}" text-anchor="middle" class="token-label" fill="white" font-weight="bold" font-size="11" style="text-shadow: 0 2px 4px black; letter-spacing: 0.5px;">${t.name.substring(0,12)}</text>
            `;

            group.onclick = (e) => { 
                e.stopPropagation(); 
                if (this.targeting) {
                    this.executeAreaSkill(t.q, t.r);
                } else {
                    this.selectedTokenId = (this.selectedTokenId === id) ? null : id; 
                    this.renderTokens(); 
                }
            };
            
            group.oncontextmenu = (e) => { 
                e.preventDefault(); 
                const liveData = { ...t, hp: currentHP, hpMax: maxHP, mp: currentMP, mpMax: maxMP };
                this.openContextMenu(e, id, liveData); 
            };

            layer.appendChild(group);
        });
    },

    renderTurnOrder: function() {
        const container = document.getElementById('arena-turn-list');
        if(!container) return;
        container.innerHTML = '';
        
        const order = this.data.ordemIniciativa || [];
        
        order.forEach((tokenId, idx) => {
            const token = this.data.tokens[tokenId];
            if(!token) return;
            
            const img = token.img || IMG_PLACEHOLDER_BASE64;
            const isActive = idx === this.data.turnoIndex;
            
            const isTargetable = !!this.targeting;

            const card = document.createElement('div');
            card.className = `turn-card ${isActive ? 'active' : ''} ${isTargetable ? 'targetable-card' : ''}`;
            
            card.innerHTML = `
                <div class="relative">
                    <img src="${img}" onerror="this.src='${IMG_PLACEHOLDER_BASE64}'">
                    ${isTargetable ? '<div class="absolute inset-0 bg-red-500/20 rounded-full flex items-center justify-center"><i class="fas fa-crosshairs text-white text-xs drop-shadow-md"></i></div>' : ''}
                </div>
                <span class="text-[8px] font-bold text-white mt-1 truncate w-full text-center">${token.name.substring(0,6)}</span>
            `;
            
            if(isActive) setTimeout(() => card.scrollIntoView({behavior: 'smooth', inline: 'center'}), 100);
            
            card.onclick = (e) => {
                e.stopPropagation();
                if (this.targeting) {
                    this.requestAttack(tokenId); 
                } else {
                    this.selectedTokenId = (this.selectedTokenId === tokenId) ? null : tokenId; 
                    this.renderTokens(); 
                }
            };

            container.appendChild(card);
        });
    },

    renderSpawnList: function() {
        const filterEl = document.getElementById('arena-spawn-filter');
        const filter = filterEl ? filterEl.value.toLowerCase() : "";
        
        const listPlayers = document.getElementById('spawn-list-players');
        const listNPCs = document.getElementById('spawn-list-npcs');
        const listMonsters = document.getElementById('spawn-list-monsters');
        
        if(listPlayers) listPlayers.innerHTML = '';
        if(listNPCs) listNPCs.innerHTML = '';
        if(listMonsters) listMonsters.innerHTML = '';

        // Lista de Jogadores
        if(globalState.cache.players || globalState.cache.personagens) {
            const playersMap = globalState.cache.players || globalState.cache.personagens;
            playersMap.forEach((p, id) => {
                if ((p.nome || "").toLowerCase().includes(filter)) {
                    window.arena.createSpawnItem(listPlayers, p.nome || "Sem Nome", id, 'player', p.imageUrls?.imagem1 || p.imagemUrl, p.hpPersonagemBase, p.mpPersonagemBase, p.movimentoPersonagemBase || 5, 'rpg_fichas');
                }
            });
        }
        
        // Lista de NPCs e Monstros
        if(globalState.cache.mobs) {
            globalState.cache.mobs.forEach((m, id) => {
                if ((m.nome || "").toLowerCase().includes(filter)) {
                    const isNpc = m.type === 'npc' || (m.collection === 'rpg_Npcs');
                    const targetList = isNpc ? listNPCs : listMonsters;
                    const type = isNpc ? 'npc' : 'monster';
                    const hp = m.hpPersonagemBase || m.hpMaxPersonagemBase || 10;
                    const mp = m.mpPersonagemBase || m.mpMaxPersonagemBase || 10;
                    const move = m.explorixMovimento || m.movimentoPersonagemBase || 5; 
                    window.arena.createSpawnItem(targetList, m.nome || "Mob", id, type, m.imageUrls?.imagem1 || m.imagemUrl, hp, mp, move, m.collection);
                }
            });
        }
    },

    createSpawnItem: function(container, name, id, type, img, hp, mp, move, col) {
        if(!container) return;
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 bg-slate-900 p-1 rounded hover:bg-slate-800 cursor-pointer border border-transparent hover:border-amber-500/30";
        div.innerHTML = `<img src="${img||IMG_PLACEHOLDER_BASE64}" class="w-6 h-6 rounded bg-black object-cover"><span class="text-[10px] truncate text-slate-300">${escapeHTML(name)}</span>`;
        div.onclick = () => window.arena.prepareSpawn(id, name, img, hp, mp, move, type, col);
        container.appendChild(div);
    },

    prepareSpawn: function(id, name, img, hp, mp, move, type, collection) {
        window.arena.tool = 'spawn';
        window.arena.spawnTarget = { id, collection, data: { name, img, hp, hpMax: hp, mp, mpMax: mp, movimento: move, type, visivel: (type === 'player') } };
        const display = document.getElementById('arena-tool-display');
        if(display) display.textContent = `Spawn: ${name}`; 
        document.body.style.cursor = 'copy';
    },

    // --- MÉTODOS VISUAIS EXTRAS (Context Menu, Map URLs, Floating Text) ---
    openContextMenu: function(e, tokenId, token) {
        const menu = document.getElementById('arena-ctx-menu');
        const isOwner = token.originId === globalState.selectedCharacterId;
        
        if (!this.isMaster && !isOwner) { this.closeContextMenu(); return; }

        let left = e.clientX;
        let top = e.clientY;
        if (left + 240 > window.innerWidth) left -= 240;
        if (top + 250 > window.innerHeight) top -= 250;

        menu.style.display = 'block';
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.dataset.currentToken = tokenId;

        const maxHP = token.hpMax || 1;
        const maxMP = token.mpMax || 1;

        if (!this.isMaster) {
            menu.innerHTML = `
                <div class="bg-slate-900 p-2 rounded border border-slate-600">
                    <div class="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                        <span class="text-xs font-bold text-emerald-400">${token.name}</span>
                        <button onclick="window.arena.closeContextMenu()" class="text-slate-500 hover:text-white"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between text-slate-300">
                            <span>HP:</span> 
                            <span class="font-mono text-white"><span id="ctx-disp-hp-${tokenId}">${token.hp}</span> / ${maxHP}</span>
                        </div>
                        <div class="flex justify-between text-slate-300">
                            <span>MP:</span> 
                            <span class="font-mono text-white"><span id="ctx-disp-mp-${tokenId}">${token.mp}</span> / ${maxMP}</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        menu.innerHTML = `
            <div id="arena-ctx-header" class="flex justify-between items-center bg-slate-900 p-2 border-b border-slate-700">
                <span class="text-xs font-bold text-amber-500 truncate max-w-[150px]">${token.name}</span>
                <button onclick="window.arena.closeContextMenu()" class="text-slate-400 hover:text-white px-2"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-3 space-y-3 bg-slate-900">
                <div>
                    <div class="flex justify-between text-[10px] mb-1 font-bold text-slate-400">
                        <span>HP (<span id="ctx-disp-hp-${tokenId}" class="text-white">${token.hp}</span>/${maxHP})</span>
                    </div>
                    <div class="ctx-stat-input-group">
                        <button class="w-8 h-8 bg-red-900/50 text-red-400 hover:bg-red-800 rounded text-sm font-bold border border-red-800" 
                                onclick="window.arena.modStat('${tokenId}', 'hp', -1, 'val-hp-${tokenId}')">-</button>
                        <input type="number" id="val-hp-${tokenId}" class="bg-transparent text-white text-center w-full text-sm font-bold focus:outline-none" value="1" min="1" onclick="this.select()">
                        <button class="w-8 h-8 bg-green-900/50 text-green-400 hover:bg-green-800 rounded text-sm font-bold border border-green-800" 
                                onclick="window.arena.modStat('${tokenId}', 'hp', 1, 'val-hp-${tokenId}')">+</button>
                    </div>
                </div>
                <div>
                    <div class="flex justify-between text-[10px] mb-1 font-bold text-slate-400">
                        <span>MP (<span id="ctx-disp-mp-${tokenId}" class="text-white">${token.mp}</span>/${maxMP})</span>
                    </div>
                    <div class="ctx-stat-input-group">
                        <button class="w-8 h-8 bg-blue-900/50 text-blue-400 hover:bg-blue-800 rounded text-sm font-bold border border-blue-800" 
                                onclick="window.arena.modStat('${tokenId}', 'mp', -1, 'val-mp-${tokenId}')">-</button>
                        <input type="number" id="val-mp-${tokenId}" class="bg-transparent text-white text-center w-full text-sm font-bold focus:outline-none" value="1" min="1" onclick="this.select()">
                        <button class="w-8 h-8 bg-blue-900/50 text-blue-300 hover:bg-blue-800 rounded text-sm font-bold border border-blue-800" 
                                onclick="window.arena.modStat('${tokenId}', 'mp', 1, 'val-mp-${tokenId}')">+</button>
                    </div>
                </div>
                <div class="h-px bg-slate-700 my-2"></div>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="window.arena.toggleVis('${tokenId}', ${!token.visivel})" class="btn bg-slate-800 border border-slate-600 text-[10px] py-2 flex items-center justify-center gap-1 hover:text-amber-400">
                        <i class="fas fa-eye${token.visivel ? '-slash' : ''}"></i> ${token.visivel ? 'Ocultar' : 'Revelar'}
                    </button>
                    <button onclick="window.arena.removeToken('${tokenId}')" class="btn bg-slate-800 border border-red-900/50 text-red-400 hover:bg-red-900/20 text-[10px] py-2 flex items-center justify-center gap-1">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            </div>
        `;
    },

    closeContextMenu: function() {
        document.getElementById('arena-ctx-menu').style.display = 'none';
    },

    removeToken: async function(id) {
        if(!confirm("Remover este token?")) return;
        this.closeContextMenu();
        await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), {
            [`arena_state.tokens.${id}`]: deleteField(),
            [`arena_state.ordemIniciativa`]: arrayRemove(id)
        });
    },

    toggleVis: async function(id, val) {
        await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), { [`arena_state.tokens.${id}.visivel`]: val });
    },

    updateMap: async function() { 
        const url = document.getElementById('arena-map-url').value; 
        if(url) {
            await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), { "arena_state.mapaUrl": url }); 
            this.gridRendered = false; 
        }
    },
    
    toggleFreeMode: async function() {
        if (!this.isMaster) return;
        const newState = !this.data.freeMovement;
        try {
            await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), { "arena_state.freeMovement": newState });
        } catch(e) {
            await setDoc(doc(db, "rpg_sessions", this.sessionDocId), { arena_state: { freeMovement: true } }, { merge: true });
        }
    },

    uploadMap: async function(inputElement) {
        const file = inputElement.files[0];
        if (!file) return;

        const sessionId = this.sessionDocId;
        if (!sessionId) return alert("Sessão inválida.");

        const label = inputElement.nextElementSibling;
        const originalHTML = label.innerHTML;
        label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upar';
        label.classList.add('opacity-50', 'pointer-events-none');

        try {
            // Usa compressor do global
            const compressedBlob = await window.compressImage(file, 1920, 1080, 0.7);

            const currentMapUrl = this.data.mapaUrl;
            if (currentMapUrl && currentMapUrl.includes('firebasestorage')) {
                try {
                    await deleteObject(ref(storage, currentMapUrl));
                } catch(err) {
                    console.warn("[Arena] Erro ao deletar antigo", err);
                }
            }

            const fileName = `mapa_${Date.now()}.jpg`;
            const mapRef = ref(storage, `mapas_arena/${sessionId}/${fileName}`);
            const snapshot = await uploadBytes(mapRef, compressedBlob);
            const newUrl = await getDownloadURL(snapshot.ref);

            await updateDoc(doc(db, "rpg_sessions", sessionId), { "arena_state.mapaUrl": newUrl });

            inputElement.value = '';
            document.getElementById('arena-map-url').value = '';

        } catch (e) {
            console.error(e);
            alert("Erro ao enviar o mapa.");
        } finally {
            label.innerHTML = originalHTML;
            label.classList.remove('opacity-50', 'pointer-events-none');
        }
    },

    getReachableHexes: function(sq, sr, range) {
        const visited = new Set([`${sq},${sr}`]); 
        const fringes = [[{q:sq, r:sr}]];
        
        for (let k = 1; k <= range; k++) {
            fringes.push([]);
            for (const h of fringes[k-1]) {
                const dirs = [{q:1, r:0}, {q:1, r:-1}, {q:0, r:-1}, {q:-1, r:0}, {q:-1, r:1}, {q:0, r:1}];
                
                dirs.forEach(d => {
                    const nQ = h.q + d.q;
                    const nR = h.r + d.r;
                    const nK = `${nQ},${nR}`;
                    if (!this.data.obstaculos?.[nK] && !visited.has(nK)) { 
                        visited.add(nK); 
                        fringes[k].push({q: nQ, r: nR}); 
                    }
                });
            }
        }
        return visited;
    },

    showFloatingText: function(text, tokenId, color) {
        const t = this.data.tokens[tokenId];
        if(!t) return;
        const pos = this.hexToPixel(t.q, t.r);
        const div = document.createElement('div');
        div.className = `absolute pointer-events-none font-bold text-lg animate-float-up z-[500]`;
        div.style.left = `${pos.x}px`; div.style.top = `${pos.y - 20}px`;
        div.style.color = color; div.textContent = text;
        document.getElementById('arena-viewport').appendChild(div);
        setTimeout(() => div.remove(), 2000);
    },

    // --- HTML INJECTOR ---
    renderLayout: function() {
        const container = document.getElementById('arena-combate-content');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-slate-950 p-2 rounded border border-slate-800 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <h2 class="text-amber-500 font-cinzel font-bold text-lg m-0 inline-block mr-2"><i class="fas fa-chess-board"></i> Arena Tática</h2>
                        <span id="arena-status-msg" class="text-[10px] uppercase font-bold"></span>
                    </div>
                    <div class="flex gap-2 items-center">
                        <span id="arena-round-display" class="bg-slate-800 px-3 py-1 rounded text-xs border border-slate-700 font-bold text-white">Rodada 1</span>
                        <div id="player-action-hud" class="hidden gap-2">
                            <button id="btn-act-move" class="action-btn" onclick="window.arena.toggleAction('movement')"><i class="fas fa-walking"></i></button>
                            <button id="btn-act-main" class="action-btn" onclick="window.arena.toggleAction('action')"><i class="fas fa-fist-raised"></i></button>
                            <button id="btn-act-free" class="action-btn" onclick="window.arena.toggleAction('free')"><i class="fas fa-comment"></i></button>
                            <button class="action-btn bg-red-900/30 border-red-800 text-red-400" onclick="window.arena.endTurn()"><i class="fas fa-hourglass-end"></i></button>
                        </div>
                    </div>
                </div>
                <div id="arena-turn-list" class="turn-order-strip custom-scroll relative z-10 min-h-[70px]"></div>
                <div id="arena-skill-tray" class="hidden p-2 bg-slate-900 border-t border-slate-700 rounded-b-lg">
                    <div class="flex justify-between items-center mb-2">
                        <span id="arena-skill-instruction" class="text-[10px] text-amber-400 font-bold uppercase animate-pulse"></span>
                        <button onclick="window.arena.cancelTargeting()" class="text-red-400 text-xs px-2 py-1 rounded bg-red-900/20 border border-red-900">Cancelar</button>
                    </div>
                    <div id="arena-skill-list" class="flex gap-4 overflow-x-auto pb-2 min-h-[60px]"></div>
                </div>
            </div>

            <div class="hex-grid-container relative" id="arena-viewport" style="height: 600px; overflow: hidden; background: #000;">
                <svg id="arena-svg" width="100%" height="100%" style="overflow: visible; transition: transform 0.1s ease-out; cursor: grab;">
                    <g id="arena-layer-map"></g>
                    <g id="arena-layer-grid"></g>
                    <g id="arena-layer-preview"></g> 
                    <g id="arena-layer-auras"></g>
                    <g id="arena-layer-tokens"></g>
                </svg>
                <div class="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto">
                    <button onclick="window.arena.zoom(1.1)" class="w-8 h-8 rounded bg-slate-800 text-white font-bold border border-slate-600 shadow">+</button>
                    <button onclick="window.arena.zoom(0.9)" class="w-8 h-8 rounded bg-slate-800 text-white font-bold border border-slate-600 shadow">-</button>
                </div>
            </div>

            <div id="arena-combat-log" class="mt-2 h-32 overflow-y-auto font-mono text-[10px] bg-slate-950/80 p-2 rounded border border-slate-700 custom-scroll shadow-inner"></div>

            <div id="arena-gm-panel" class="hidden mt-4 bg-slate-900/90 rounded-xl border border-amber-600/30 shadow-2xl overflow-hidden">
                <div class="p-3 border-b border-slate-700 bg-slate-800 flex flex-wrap gap-2 items-center justify-between">
                    <div class="flex gap-2">
                        <button onclick="window.arena.setTool('select')" class="btn bg-blue-900/40 text-blue-200 text-[10px] uppercase font-bold border border-blue-700">Seleção</button>
                        <button onclick="window.arena.setTool('wall_hard')" class="btn bg-red-900/40 text-red-200 text-[10px] uppercase font-bold border border-red-700">Muro</button>
                        <button onclick="window.arena.setTool('wall_soft')" class="btn bg-orange-900/40 text-orange-200 text-[10px] uppercase font-bold border border-orange-700">Transp.</button>
                        <button onclick="window.arena.setTool('erase')" class="btn bg-slate-700 text-slate-300 text-[10px] uppercase font-bold">Borracha</button>
                        <button id="btn-arena-freemove" onclick="window.arena.toggleFreeMode()" class="btn bg-slate-700 text-slate-300 text-[10px] uppercase font-bold border border-slate-500 transition-all ml-2">Modo Livre</button>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button onclick="window.arena.clearArena()" class="btn bg-red-600 text-white text-[10px] font-bold uppercase">Limpar Tudo</button>
                        <div class="w-px h-6 bg-slate-600 mx-1"></div>
                        <button onclick="window.arena.nextTurn()" class="btn bg-emerald-600 text-white text-[10px] font-bold uppercase">Próx. Turno</button>
                    </div>
                </div>
                <div class="p-3 border-b border-slate-700 bg-slate-800/50 flex gap-2 items-center justify-between w-full">
                    <span id="arena-tool-display" class="text-[10px] text-amber-500 font-mono font-bold uppercase">Ferramenta: SELECIONAR</span>
                    <div class="flex items-center gap-2 border border-slate-700 p-1 rounded bg-slate-900/50">
                        <input type="text" id="arena-map-url" class="text-[10px] bg-slate-950 border-slate-700 w-32 rounded px-2 py-1 text-slate-300" placeholder="URL direta...">
                        <button onclick="window.arena.updateMap()" class="btn btn-secondary py-1 px-2 text-[10px]">URL</button>
                        <div class="w-px h-4 bg-slate-600 mx-1"></div>
                        <input type="file" id="arena-map-upload" accept="image/*" class="hidden" onchange="window.arena.uploadMap(this)">
                        <label for="arena-map-upload" class="btn btn-primary py-1 px-2 text-[10px] cursor-pointer flex items-center gap-1 m-0 shadow-lg transition hover:scale-105"><i class="fas fa-upload"></i> Upar</label>
                    </div>
                </div>
                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs text-slate-400 font-bold uppercase">Spawn Rápido</span>
                        <input type="text" id="arena-spawn-filter" placeholder="Buscar..." class="text-xs bg-slate-800 border border-slate-700 w-48 rounded px-2 py-1 outline-none focus:border-amber-500" onkeyup="window.arena.renderSpawnList()">
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-emerald-400 p-2 bg-emerald-900/20 text-center border-b border-emerald-900/30">Jogadores</div>
                            <div id="spawn-list-players" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-sky-400 p-2 bg-blue-900/20 text-center border-b border-blue-900/30">NPCs</div>
                            <div id="spawn-list-npcs" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                        <div class="bg-slate-950/50 rounded border border-slate-800 overflow-hidden">
                            <div class="text-[9px] uppercase font-bold text-rose-400 p-2 bg-red-900/20 text-center border-b border-red-900/30">Monstros</div>
                            <div id="spawn-list-monsters" class="spawn-list-container p-2 custom-scroll" style="height: 180px; overflow-y: auto;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="arena-ctx-menu" class="fixed z-[9999] hidden bg-slate-900 border-2 border-amber-500 rounded shadow-2xl min-w-[220px] overflow-hidden"></div>

            <div id="arena-attack-modal" class="fixed inset-0 z-[10000] bg-black/80 hidden items-center justify-center backdrop-blur-sm">
                <div class="bg-slate-900 border-2 border-amber-500 rounded-xl p-6 max-w-sm w-full shadow-2xl transform transition-all">
                    <h3 class="text-xl font-cinzel text-white text-center mb-4">Confirmar Ação</h3>
                    <div class="bg-slate-800 p-4 rounded mb-6 text-center border border-slate-700">
                        <div class="text-xs text-slate-400 uppercase mb-1">Habilidade</div>
                        <div id="modal-skill-name" class="text-amber-400 font-bold text-lg mb-2">---</div>
                        <div class="text-xs text-slate-400 uppercase mb-1">Alvo</div>
                        <div id="modal-target-name" class="text-red-400 font-bold text-lg mb-2">---</div>
                        <div class="mt-2 text-xs bg-blue-900/30 text-blue-300 py-1 px-2 rounded inline-block border border-blue-800">
                            Custo: <span id="modal-skill-cost">0</span> MP
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="window.arena.closeAttackModal()" class="btn bg-slate-700 hover:bg-slate-600 text-slate-300">Cancelar</button>
                        <button id="btn-confirm-attack" class="btn bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse">ATACAR!</button>
                    </div>
                </div>
            </div>
        `;
    }

    // --- FUNÇÕES UTILITÁRIAS E MATEMÁTICAS ---
    hexToPixel: function(q, r) { 
        return { 
            x: HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r) + 60, 
            y: HEX_SIZE * (3/2 * r) + 60 
        }; 
    },
    getHexPoints: function(x, y) {
        let p = ""; 
        for(let i=0; i<6; i++) { 
            const rad = Math.PI/180*(60*i-30); 
            p+=`${x+(HEX_SIZE-1)*Math.cos(rad)},${y+(HEX_SIZE-1)*Math.sin(rad)} `; 
        } 
        return p;
    },
    pixelToHex: function(x, y) {
        let q = (Math.sqrt(3)/3 * (x - 60) - 1/3 * (y - 60)) / HEX_SIZE;
        let r = (2/3 * (y - 60)) / HEX_SIZE;
        return window.arena.hexRound(q, r);
    },
    hexRound: function(q, r) {
        let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
        let q_diff = Math.abs(rq - q), r_diff = Math.abs(rr - r), s_diff = Math.abs(rs - (-q - r));
        if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
        else if (r_diff > s_diff) rr = -rq - rs;
        return { q: rq, r: rr };
    },
    getSVGPoint: function(e) {
        const svg = document.getElementById('arena-svg');
        if(!svg) return {x:0, y:0};
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    },
    updateTransform: function() { 
        const svg = document.getElementById('arena-svg');
        if(svg) svg.style.transform = `translate(${window.arena.drag.panX}px, ${window.arena.drag.panY}px) scale(${window.arena.scale})`; 
    },
    zoom: function(f) { 
        window.arena.scale *= f; 
        window.arena.updateTransform(); 
    },
    setTool: function(t) { 
        window.arena.tool = t; 
        const d = document.getElementById('arena-tool-display'); 
        if(d) d.textContent = `Ferramenta: ${t.toUpperCase()}`; 
    }
};
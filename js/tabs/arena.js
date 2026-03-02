import { db, doc, onSnapshot, updateDoc, runTransaction, increment, deleteField, arrayUnion, arrayRemove, writeBatch, getDoc } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';

// --- CONFIGURAÇÕES DO GRID ---
const IMG_PLACEHOLDER_BASE64 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const HEX_SIZE = 17;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;
const GRID_ROWS = 40; 
const GRID_COLS = 40;

// O Objeto Global arena (exatamente como no código antigo)
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
    drag: { active: false, startX: 0, startY: 0, panX: 0, panY: 0 },
    targeting: null,
    turnActions: { movement: false, action: false, free: false },

    // --- INICIALIZAÇÃO ---
    init: function() {
        if (this.unsub) { 
            this.unsub(); 
            this.unsub = null; 
        }

        const activeSessionId = globalState.activeSessionId;
        if (!activeSessionId || activeSessionId === 'world') {
            this.showError("Selecione uma Sessão de Jogo no topo para carregar a Arena.");
            return;
        }

        this.sessionDocId = activeSessionId;
        this.renderLayout(); // Injeta o HTML base da aba
        this.gridRendered = false;

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
            this.eventsAttached = true;
        }

        // Listener em Tempo Real
        this.unsub = onSnapshot(doc(db, "rpg_sessions", this.sessionDocId), (snap) => {
            if (!snap.exists()) return this.showError("Sessão não encontrada.");
            
            const sessionData = snap.data();
            const arenaState = sessionData.arena_state || { 
                rodada: 1, turnoIndex: 0, tokens: {}, obstaculos: {}, ordemIniciativa: [], freeMovement: false 
            };

            if (this.data && this.data.turnoIndex !== arenaState.turnoIndex) {
                this.resetLocalActions();
            }
            
            if (this.data && this.data.mapaUrl !== arenaState.mapaUrl) {
                this.gridRendered = false;
            }
            
            this.data = arenaState;
            this.checkMasterRole(sessionData);

            // Log de Combate
            const logContainer = document.getElementById('arena-combat-log');
            if (logContainer) {
                const logs = sessionData.combat_log || [];
                logContainer.innerHTML = logs.slice(-20).reverse().map(l => 
                    `<div class="border-b border-slate-800 pb-1 mb-1 last:border-0 text-slate-300">
                        <span class="text-slate-500 font-bold">[${new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span> ${l.text}
                    </div>`
                ).join('');
            }

            if (!this.gridRendered) this.renderGrid();
            else this.updateObstacles(); 
            
            this.renderTokens();
            this.renderTurnOrder();
            this.updateActionHUD();
            
            if (this.isMaster) this.renderSpawnList();
        });
    },

    // --- RENDERIZAÇÃO DE LAYOUT ---
    renderLayout: function() {
        const container = document.getElementById('arena-combate-content');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-slate-950 p-2 rounded border border-slate-800 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <h2 class="text-amber-500 font-cinzel font-bold text-lg m-0 inline-block mr-2"><i class="fas fa-chess-board"></i> Arena Tática</h2>
                        <span id="arena-status-msg" class="text-[10px] text-slate-500 uppercase font-bold"></span>
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

            <div class="hex-grid-container relative" id="arena-viewport">
                <svg id="arena-svg" width="100%" height="100%" style="overflow: visible;">
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
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.arena.clearArena()" class="btn bg-red-600 text-white text-[10px] font-bold uppercase">Limpar Tudo</button>
                        <button onclick="window.arena.nextTurn()" class="btn bg-emerald-600 text-white text-[10px] font-bold uppercase">Próx. Turno</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="text" id="arena-map-url" class="text-[10px] bg-slate-950 border border-slate-700 rounded px-2 py-1 w-32" placeholder="URL do Mapa...">
                        <button onclick="window.arena.updateMap()" class="btn bg-slate-700 text-xs px-2 py-1">Usar URL</button>
                    </div>
                </div>
                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs text-slate-400 font-bold uppercase">Spawn Rápido</span>
                        <input type="text" id="arena-spawn-filter" placeholder="Buscar..." class="text-xs bg-slate-800 border border-slate-700 w-48 rounded px-2" onkeyup="window.arena.renderSpawnList()">
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-slate-950/50 p-2 rounded border border-slate-800"><div class="text-[9px] uppercase font-bold text-emerald-400 mb-2">Jogadores</div><div id="spawn-list-players" class="spawn-list-container custom-scroll"></div></div>
                        <div class="bg-slate-950/50 p-2 rounded border border-slate-800"><div class="text-[9px] uppercase font-bold text-sky-400 mb-2">NPCs</div><div id="spawn-list-npcs" class="spawn-list-container custom-scroll"></div></div>
                        <div class="bg-slate-950/50 p-2 rounded border border-slate-800"><div class="text-[9px] uppercase font-bold text-rose-400 mb-2">Monstros</div><div id="spawn-list-monsters" class="spawn-list-container custom-scroll"></div></div>
                    </div>
                </div>
            </div>

            <div id="arena-ctx-menu" class="absolute z-[9999] hidden bg-slate-900 border-2 border-amber-500 rounded shadow-2xl min-w-[200px]"></div>

            <div id="arena-attack-modal" class="fixed inset-0 z-[10000] bg-black/80 hidden items-center justify-center backdrop-blur-sm">
                <div class="bg-slate-900 border-2 border-amber-500 rounded-xl p-6 max-w-sm w-full">
                    <h3 class="text-xl font-cinzel text-white text-center mb-4">Confirmar Ação</h3>
                    <div class="bg-slate-800 p-4 rounded mb-6 text-center">
                        <div id="modal-skill-name" class="text-amber-400 font-bold text-lg mb-2"></div>
                        <div class="text-xs text-slate-400 uppercase">Alvo</div>
                        <div id="modal-target-name" class="text-red-400 font-bold text-lg"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="window.arena.closeAttackModal()" class="btn bg-slate-700 text-slate-300">Cancelar</button>
                        <button id="btn-confirm-attack" class="btn bg-red-600 text-white font-bold">ATACAR!</button>
                    </div>
                </div>
            </div>
        `;
    },

    // --- LÓGICA DE TURNOS E TURN ACTIONS ---
    toggleAction: function(type) {
        if(this.turnActions[type]) return; 
        
        if (type !== 'action') {
            if(confirm(`Usar ação ${type === 'movement' ? 'de movimento' : 'livre'}?`)) {
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

    // --- CÁLCULOS HEXAGONAIS ---
    hexDistance: function(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    },

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

    // --- REGRAS DE COMBATE ---
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
                let cached = globalState.cache.mobs.get(token.originId) || globalState.cache.personagens.get(token.originId);
                if (cached) {
                    skillsSource = cached.habilidades || {};
                    actorName = cached.nome;
                    currentMp = Number(token.mp) || 0;
                }
            }
        } else {
            const charId = globalState.selectedCharacterId;
            const charData = globalState.selectedCharacterData;
            if (charData) {
                skillsSource = charData.ficha.habilidades || {};
                actorName = charData.ficha.nome;
                const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
                currentMp = myTokenEntry ? Number(myTokenEntry[1].mp) : (charData.ficha.mpPersonagemBase || 0);
            }
        }

        const favs = Object.keys(skillsSource).filter(id => skillsSource[id].isFavorite === true);
        if (favs.length === 0) {
            container.innerHTML = `<span class="text-[10px] text-slate-500 italic p-2">Nenhuma habilidade favorita.</span>`;
            return;
        }

        if(instruction) instruction.innerHTML = `<i class="fas fa-hand-pointer mr-1"></i> Passo 1: Escolha a Habilidade de <strong>${actorName}</strong>`;

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
            instruction.className = "text-[10px] text-red-400 font-bold uppercase animate-pulse";
        }
    },

    cancelTargeting: function() {
        this.targeting = null;
        const tray = document.getElementById('arena-skill-tray');
        if(tray) tray.classList.add('hidden');
        this.renderTokens();
    },

    requestAttack: function(targetTokenId) {
        if (!this.targeting) return;
        const skill = this.targeting;
        const targetToken = this.data.tokens[targetTokenId];
        if (!targetToken) return;

        document.getElementById('modal-skill-name').textContent = skill.skillName;
        document.getElementById('modal-target-name').textContent = targetToken.name;
        
        const btnConfirm = document.getElementById('btn-confirm-attack');
        btnConfirm.onclick = () => this.confirmAttack(targetTokenId, targetToken.name);
        
        document.getElementById('arena-attack-modal').classList.remove('hidden');
        document.getElementById('arena-attack-modal').classList.add('flex');
    },

    closeAttackModal: function() {
        const modal = document.getElementById('arena-attack-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    confirmAttack: async function(targetTokenId, targetName) {
        this.closeAttackModal(); 
        const skill = this.targeting;
        const charId = globalState.selectedCharacterId;
        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
        const myTokenId = myTokenEntry ? myTokenEntry[0] : null;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const totalDano = d20 + Number(skill.damage);
        const logMsg = `⚔️ <strong>${myTokenEntry?.[1].name || "Mestre"}</strong> lançou ${skill.skillName} em ${targetName}. Total: ${totalDano}`;

        try {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            const updates = { 
                combat_log: arrayUnion({ text: logMsg, timestamp: Date.now(), type: 'attack' }) 
            };

            if (myTokenId && !this.isMaster) {
                updates[`arena_state.tokens.${myTokenId}.mp`] = increment(-skill.mpCost);
            }

            await updateDoc(sessionRef, updates);
            this.turnActions.action = true;
            this.updateActionHUD();
            this.cancelTargeting();
        } catch(e) { console.error(e); }
    },

    // --- UTILITÁRIOS INTERNOS ---
    showError: function(msg) {
        const container = document.getElementById('arena-viewport');
        if(container) container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-amber-500 font-cinzel p-10 text-center">${msg}</div>`;
    },

    updateActionHUD: function() {
        const hud = document.getElementById('player-action-hud');
        if(!hud) return;
        const turnId = this.data.ordemIniciativa?.[this.data.turnoIndex];
        const isMyTurn = this.isMaster || (turnId && turnId.startsWith(globalState.selectedCharacterId));

        if(isMyTurn) {
            hud.classList.remove('hidden');
            const updateBtn = (id, used) => {
                const btn = document.getElementById(id);
                if(btn) btn.classList.toggle('used', used);
            };
            updateBtn('btn-act-move', this.turnActions.movement);
            updateBtn('btn-act-main', this.turnActions.action);
            updateBtn('btn-act-free', this.turnActions.free);
        } else {
            hud.classList.add('hidden');
        }
    },

    // --- RENDERIZADORES DE CAMADAS ---
    renderGrid: function() {
        const gridLayer = document.getElementById('arena-layer-grid');
        const mapLayer = document.getElementById('arena-layer-map');
        if(!gridLayer) return;

        gridLayer.innerHTML = '';
        mapLayer.innerHTML = '';

        if (this.data.mapaUrl) {
            const width = (GRID_COLS + 0.5) * HEX_WIDTH;
            const height = (GRID_ROWS * 1.5 * HEX_SIZE) + HEX_SIZE;
            mapLayer.innerHTML = `<image href="${this.data.mapaUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" style="opacity: 0.6;" />`;
        }

        for (let r = 0; r < GRID_ROWS; r++) {
            for (let q = 0; q < GRID_COLS; q++) {
                const qAxial = q - Math.floor(r / 2);
                const pos = this.hexToPixel(qAxial, r);
                const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                hex.setAttribute("points", this.getHexPoints(pos.x, pos.y));
                hex.setAttribute("class", "hex");
                hex.dataset.q = qAxial;
                hex.dataset.r = r;
                hex.onclick = () => this.handleHexClick(qAxial, r);
                gridLayer.appendChild(hex);
            }
        }
        this.gridRendered = true;
        this.updateObstacles();
    },

    updateObstacles: function() {
        const hexes = document.querySelectorAll('#arena-layer-grid .hex');
        hexes.forEach(hex => {
            const key = `${hex.dataset.q},${hex.dataset.r}`;
            const obs = this.data.obstaculos?.[key];
            hex.setAttribute("class", `hex ${obs ? 'wall-' + obs : ''}`);
        });
    },

    renderTokens: function() {
        const layer = document.getElementById('arena-layer-tokens');
        if(!layer) return;
        layer.innerHTML = '';

        const turnId = this.data.ordemIniciativa?.[this.data.turnoIndex];

        Object.entries(this.data.tokens || {}).forEach(([id, t]) => {
            if (!this.isMaster && !t.visivel) return;

            const pos = this.hexToPixel(t.q, t.r);
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
            group.setAttribute("class", `token ${id === turnId ? 'active-turn' : ''} ${id === this.selectedTokenId ? 'selected' : ''}`);

            const hpPct = Math.max(0, Math.min(1, (t.hp || 0) / (t.hpMax || 1)));

            group.innerHTML = `
                <circle r="${HEX_SIZE * 0.9}" fill="#050505" stroke="${t.color || '#3b82f6'}" stroke-width="2"/>
                <image href="${t.img || IMG_PLACEHOLDER_BASE64}" x="-${HEX_SIZE-2}" y="-${HEX_SIZE-2}" width="${(HEX_SIZE-2)*2}" height="${(HEX_SIZE-2)*2}" style="clip-path: circle(50%);" />
                <rect x="-15" y="${HEX_SIZE * 0.5}" width="30" height="3" fill="#000" rx="1"/>
                <rect x="-15" y="${HEX_SIZE * 0.5}" width="${hpPct * 30}" height="3" fill="#ef4444" rx="1"/>
                <text y="-${HEX_SIZE + 2}" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${t.name.substring(0,8)}</text>
            `;

            group.onclick = (e) => {
                e.stopPropagation();
                if(this.targeting) this.requestAttack(id);
                else {
                    this.selectedTokenId = (this.selectedTokenId === id) ? null : id;
                    this.renderTokens();
                }
            };

            layer.appendChild(group);
        });
    },

    renderTurnOrder: function() {
        const container = document.getElementById('arena-turn-list');
        if(!container) return;
        container.innerHTML = '';
        const order = this.data.ordemIniciativa || [];
        order.forEach((id, idx) => {
            const t = this.data.tokens[id];
            if(!t) return;
            const card = document.createElement('div');
            card.className = `turn-card ${idx === this.data.turnoIndex ? 'active' : ''}`;
            card.innerHTML = `<img src="${t.img || PLACEHOLDER_IMAGE_URL}"><span class="text-[8px] font-bold text-white mt-1">${t.name.substring(0,6)}</span>`;
            container.appendChild(card);
        });
    },

    // --- FERRAMENTAS MESTRE ---
    setTool: function(t) { 
        this.tool = t; 
        document.getElementById('arena-tool-display').textContent = `Ferramenta: ${t.toUpperCase()}`; 
    },

    handleHexClick: async function(q, r) {
        if(this.isMaster && this.tool !== 'select') {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            const key = `${q},${r}`;
            if(this.tool === 'erase') await updateDoc(sessionRef, { [`arena_state.obstaculos.${key}`]: deleteField() });
            else await updateDoc(sessionRef, { [`arena_state.obstaculos.${key}`]: this.tool.replace('wall_','') });
            return;
        }

        if(this.selectedTokenId) {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            await updateDoc(sessionRef, {
                [`arena_state.tokens.${this.selectedTokenId}.q`]: q,
                [`arena_state.tokens.${this.selectedTokenId}.r`]: r
            });
            this.selectedTokenId = null;
            this.renderTokens();
        }
    },

    zoom: function(f) { this.scale *= f; this.updateTransform(); },
    updateTransform: function() { 
        const svg = document.getElementById('arena-svg');
        if(svg) svg.style.transform = `translate(${this.drag.panX}px, ${this.drag.panY}px) scale(${this.scale})`; 
    },

    renderSpawnList: function() {
        const filter = document.getElementById('arena-spawn-filter').value.toLowerCase();
        const fill = (containerId, sourceMap) => {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.innerHTML = '';
            sourceMap.forEach((m, id) => {
                if((m.nome || "").toLowerCase().includes(filter)) {
                    const div = document.createElement('div');
                    div.className = "flex items-center gap-2 bg-slate-900 p-1 rounded hover:bg-slate-800 cursor-pointer text-[10px]";
                    div.innerHTML = `<img src="${m.imageUrls?.imagem1 || PLACEHOLDER_IMAGE_URL}" class="w-5 h-5 rounded">${m.nome}`;
                    div.onclick = () => this.spawnToken(id, m);
                    container.appendChild(div);
                }
            });
        };
        fill('spawn-list-players', globalState.cache.personagens);
        fill('spawn-list-monsters', globalState.cache.mobs);
    },

    spawnToken: async function(originId, data) {
        const id = `token_${Date.now()}`;
        const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
        await updateDoc(sessionRef, {
            [`arena_state.tokens.${id}`]: { 
                name: data.nome, img: data.imageUrls?.imagem1, q: 0, r: 0, 
                hp: data.hpMaxPersonagemBase || 10, hpMax: data.hpMaxPersonagemBase || 10,
                mp: data.mpMaxPersonagemBase || 10, mpMax: data.mpMaxPersonagemBase || 10,
                visivel: true, originId
            },
            "arena_state.ordemIniciativa": arrayUnion(id)
        });
    }
};
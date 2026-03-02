import { db, doc, onSnapshot, updateDoc, runTransaction, increment, deleteField, arrayUnion, arrayRemove } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { calculateStatCascade } from '../core/calculos.js';

// --- CONFIGURAÇÕES TÉCNICAS DO GRID ---
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
    targeting: null, // Armazena a skill em uso { skillId, radius, damage, mpCost, etc }
    turnActions: { movement: false, action: false, free: false },

    // --- INICIALIZAÇÃO E SINCRONIZAÇÃO ---
    init: function() {
        if (this.unsub) { this.unsub(); this.unsub = null; }

        const activeSessionId = globalState.activeSessionId;
        if (!activeSessionId || activeSessionId === 'world') {
            this.showError("Selecione uma Sessão de Jogo no topo para carregar a Arena.");
            return;
        }

        this.sessionDocId = activeSessionId;
        this.renderLayout(); 
        this.gridRendered = false;

        const svg = document.getElementById('arena-svg');
        if (svg && !this.eventsAttached) {
            // Eventos de Pan (Arraste) do Mapa
            svg.addEventListener('mousedown', e => {
                if(e.target.closest('#arena-ctx-menu')) return;
                if (e.target.tagName !== 'image' && !e.target.closest('.token')) {
                    window.arena.drag.active = true;
                    window.arena.drag.startX = e.clientX - window.arena.drag.panX;
                    window.arena.drag.startY = e.clientY - window.arena.drag.panY;
                    svg.style.cursor = 'grabbing';
                }
            });
            window.addEventListener('mousemove', e => {
                if (window.arena.drag.active) {
                    window.arena.drag.panX = e.clientX - window.arena.drag.startX;
                    window.arena.drag.panY = e.clientY - window.arena.drag.startY;
                    window.arena.updateTransform();
                }
                // Preview de Magia em Área (AoE)
                if (window.arena.targeting) {
                    const pt = window.arena.getSVGPoint(e);
                    const hex = window.arena.pixelToHex(pt.x, pt.y);
                    window.arena.renderAoEPreview(hex.q, hex.r);
                }
            });
            window.addEventListener('mouseup', () => {
                window.arena.drag.active = false;
                if(svg) svg.style.cursor = 'grab';
            });
            this.eventsAttached = true;
        }

        // Listener Principal da Sessão
        this.unsub = onSnapshot(doc(db, "rpg_sessions", this.sessionDocId), (snap) => {
            if (!snap.exists()) return;
            const sessionData = snap.data();
            const arenaState = sessionData.arena_state || { rodada: 1, turnoIndex: 0, tokens: {}, obstaculos: {}, auras: {}, ordemIniciativa: [], freeMovement: false };

            // Reseta ações locais se o turno mudar globalmente
            if (window.arena.data && window.arena.data.turnoIndex !== arenaState.turnoIndex) window.arena.resetLocalActions();
            
            // Força re-render do grid se o mapa mudar
            if (window.arena.data && window.arena.data.mapaUrl !== arenaState.mapaUrl) window.arena.gridRendered = false;
            
            window.arena.data = arenaState;
            window.arena.checkMasterRole(sessionData);
            window.arena.renderLog(sessionData.combat_log);

            if (!window.arena.gridRendered) window.arena.renderGrid();
            else window.arena.updateObstacles(); 

            window.arena.renderAuras();
            window.arena.renderTokens();
            window.arena.renderTurnOrder();
            window.arena.updateActionHUD();
            
            if (window.arena.isMaster) window.arena.renderSpawnList();
        });
    },

    // --- LÓGICA DE CÁLCULO DE DANO (CASCATA) ---
    modStat: async function(tokenId, field, multiplier, inputId) {
        const input = document.getElementById(inputId);
        const val = parseInt(input?.value || 0);
        if (isNaN(val) || val <= 0) return;

        const change = val * multiplier;
        const t = this.data.tokens[tokenId];
        if (!t) return;

        try {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            
            if (t.type === 'player' && t.originId) {
                const fichaData = globalState.cache.all_personagens.get(t.originId);
                if (fichaData) {
                    // Lógica de Cascata: Escudo > Extra > Base
                    const cascade = calculateStatCascade(fichaData, field, change);
                    
                    // Atualiza a arena (valor total somado) e a ficha raiz (campos separados)
                    await updateDoc(sessionRef, { [`arena_state.tokens.${tokenId}.${field}`]: cascade.total });
                    await updateDoc(doc(db, "rpg_fichas", t.originId), cascade.updates);
                    this.showFloatingText(change > 0 ? `+${val}` : `-${val}`, tokenId, change > 0 ? '#4ade80' : '#ef4444');
                    return;
                }
            }

            // Fallback para tokens sem ficha (NPCs genéricos)
            const current = Number(t[field]) || 0;
            const newVal = Math.max(0, current + change);
            await updateDoc(sessionRef, { [`arena_state.tokens.${tokenId}.${field}`]: newVal });
            this.showFloatingText(change > 0 ? `+${val}` : `-${val}`, tokenId, change > 0 ? '#4ade80' : '#ef4444');
        } catch(e) { console.error("Erro no modStat:", e); }
    },

    // --- SISTEMA DE MAGIA EM ÁREA (AoE) ---
    renderArenaSkills: function() {
        const container = document.getElementById('arena-skill-list');
        const instruction = document.getElementById('arena-skill-instruction');
        if(!container) return;
        container.innerHTML = '';
        
        let skillsSource = {};
        let actorName = "Personagem";
        let currentMp = 0;

        // Puxa as skills dependendo de quem é o dono do turno
        if (this.isMaster && this.selectedTokenId) {
            const token = this.data.tokens[this.selectedTokenId];
            const cached = globalState.cache.mobs.get(token?.originId) || globalState.cache.all_personagens.get(token?.originId);
            skillsSource = cached?.habilidades || {};
            actorName = cached?.nome || "Mob";
            currentMp = Number(token?.mp) || 0;
        } else {
            const charData = globalState.selectedCharacterData;
            if (charData) {
                skillsSource = charData.ficha.habilidades || {};
                actorName = charData.ficha.nome;
                const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === globalState.selectedCharacterId);
                currentMp = myTokenEntry ? Number(myTokenEntry[1].mp) : (charData.ficha.mpPersonagemBase || 0);
            }
        }

        const favs = Object.keys(skillsSource).filter(id => skillsSource[id].isFavorite === true);
        if (favs.length === 0) {
            container.innerHTML = `<span class="text-[10px] text-slate-500 italic p-2">Nenhuma habilidade favorita disponível.</span>`;
            return;
        }

        if(instruction) instruction.innerHTML = `<i class="fas fa-hand-pointer mr-1"></i> PASSO 1: ESCOLHA A HABILIDADE DE <strong>${actorName.toUpperCase()}</strong>`;

        favs.forEach(id => {
            const master = globalState.cache.habilidades.get(id);
            if (!master) return;
            const userSkill = skillsSource[id];
            let dano = Number(master.efeitoDanoBaseUsoHabilidade) || 0;
            if (master.niveis && master.niveis[userSkill.nivel]) dano = Number(master.niveis[userSkill.nivel].danoBaseHabilidade) || dano;
            
            const custoMp = Number(master.gastoMpUso) || 0;
            const canCast = this.isMaster || currentMp >= custoMp;

            const btn = document.createElement('div');
            btn.className = `arena-skill-btn ${!canCast ? 'grayscale opacity-50 cursor-not-allowed border-red-900' : ''}`;
            btn.style.backgroundImage = `url('${master.imagemUrl || PLACEHOLDER_IMAGE_URL}')`;
            btn.title = `${master.nome} (Custo: ${custoMp} MP)`;
            
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
        let duration = parseInt(masterSkill.duracaoHabilidade) || 1;

        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === globalState.selectedCharacterId);
        const myColor = myTokenEntry ? (myTokenEntry[1].color || "#f59e0b") : "#f59e0b";

        this.targeting = { skillId, skillName: name, mpCost: mp, damage: dmg, radius: aoeRadius, duration: duration, color: myColor };
        
        const instruction = document.getElementById('arena-skill-instruction');
        if(instruction) {
            instruction.innerHTML = `PASSO 2: CLIQUE NO MAPA PARA DEFINIR O ALVO`;
            instruction.className = "text-[10px] text-red-400 font-bold uppercase animate-pulse";
        }
    },

    executeAreaSkill: async function(targetQ, targetR) {
        if (!this.targeting) return;
        const skill = this.targeting;
        const charId = globalState.selectedCharacterId;
        const myTokenEntry = Object.entries(this.data.tokens).find(([,t]) => t.originId === charId);
        const myTokenId = myTokenEntry ? myTokenEntry[0] : null;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const totalDano = d20 + Number(skill.damage);
        
        const hitTargets = [];
        Object.entries(this.data.tokens).forEach(([tid, tok]) => {
            if (this.hexDistance(targetQ, targetR, tok.q, tok.r) <= skill.radius) {
                hitTargets.push(tok.name);
            }
        });

        const logMsg = `🌀 <strong>${myTokenEntry?.[1].name || "Mestre"}</strong> usou ${skill.skillName}! Dano: ${totalDano}. Alvos: ${hitTargets.join(', ') || 'Nenhum'}`;

        try {
            const auraId = `aura_${Date.now()}`;
            const updates = {
                combat_log: arrayUnion({ text: logMsg, timestamp: Date.now(), type: 'attack' }),
                [`arena_state.auras.${auraId}`]: {
                    skillName: skill.skillName, q: targetQ, r: targetR,
                    radius: skill.radius, color: skill.color, duration: skill.duration,
                    casterTokenId: myTokenId
                }
            };

            if (myTokenId && !this.isMaster) updates[`arena_state.tokens.${myTokenId}.mp`] = increment(-skill.mpCost);

            await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), updates);
            this.turnActions.action = true;
            this.cancelTargeting();
        } catch(e) { console.error(e); }
    },

    // --- GESTÃO DE TURNOS E AURAS ---
    nextTurn: async function() {
        const order = this.data.ordemIniciativa || [];
        if (order.length === 0) return;

        const nextIdx = (this.data.turnoIndex + 1) % order.length;
        const nextTokenId = order[nextIdx];
        const updates = { "arena_state.turnoIndex": nextIdx };
        if (nextIdx === 0) updates["arena_state.rodada"] = increment(1);

        // Auras perdem duração apenas no turno de quem as criou
        Object.entries(this.data.auras || {}).forEach(([aid, aura]) => {
            if (aura.casterTokenId === nextTokenId) {
                const newDur = aura.duration - 1;
                if (newDur <= 0) updates[`arena_state.auras.${aid}`] = deleteField();
                else updates[`arena_state.auras.${aid}.duration`] = newDur;
            }
        });

        await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), updates);
    },

    // --- RENDERIZAÇÃO DO GRID E TOKENS ---
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
            const mpPct = Math.max(0, Math.min(1, (t.mp || 0) / (t.mpMax || 1)));

            group.innerHTML = `
                <circle r="${HEX_SIZE * 0.95}" fill="#000" stroke="${t.color || '#3b82f6'}" stroke-width="2" />
                <image href="${t.img || IMG_PLACEHOLDER_BASE64}" x="-${HEX_SIZE-2}" y="-${HEX_SIZE-2}" width="${(HEX_SIZE-2)*2}" height="${(HEX_SIZE-2)*2}" style="clip-path: circle(50%);" />
                <rect x="-15" y="10" width="30" height="3" fill="#000" />
                <rect x="-15" y="10" width="${hpPct * 30}" height="3" fill="#ef4444" />
                <rect x="-15" y="14" width="30" height="2" fill="#000" />
                <rect x="-15" y="14" width="${mpPct * 30}" height="2" fill="#3b82f6" />
                <text y="-22" text-anchor="middle" fill="white" font-size="8" font-weight="bold" style="text-shadow: 1px 1px 2px #000">${t.name.substring(0,10)}</text>
            `;
            group.onclick = (e) => {
                e.stopPropagation();
                if(window.arena.targeting) window.arena.executeAreaSkill(t.q, t.r);
                else { window.arena.selectedTokenId = id; window.arena.renderTokens(); }
            };
            group.oncontextmenu = (e) => { e.preventDefault(); window.arena.openContextMenu(e, id, t); };
            layer.appendChild(group);
        });
    },

    // --- AUXILIARES MATEMÁTICOS ---
    hexDistance: function(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    },

    pixelToHex: function(x, y) {
        let q = (Math.sqrt(3)/3 * (x - 60) - 1/3 * (y - 60)) / HEX_SIZE;
        let r = (2/3 * (y - 60)) / HEX_SIZE;
        return this.hexRound(q, r);
    },

    hexRound: function(q, r) {
        let s = -q - r;
        let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
        let q_diff = Math.abs(rq - q), r_diff = Math.abs(rr - r), s_diff = Math.abs(rs - s);
        if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
        else if (r_diff > s_diff) rr = -rq - rs;
        return { q: rq, r: rr };
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

    getSVGPoint: function(e) {
        const svg = document.getElementById('arena-svg');
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    },

    // --- UI E HUD ---
    checkMasterRole: function(sessionData) {
        const user = globalState.currentUser;
        this.isMaster = globalState.isAdmin || (sessionData.ownerUid === user.uid);
        const statusMsg = document.getElementById('arena-status-msg');
        if (statusMsg) {
            statusMsg.textContent = this.isMaster ? "MODO MESTRE" : "MODO JOGADOR";
            statusMsg.className = `text-[10px] font-bold ml-2 ${this.isMaster ? 'text-amber-500' : 'text-emerald-500'}`;
        }
    },

    renderLayout: function() {
        const container = document.getElementById('arena-combate-content');
        if (!container) return;
        // Injeção completa do HTML da Aba conforme versão Premium
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
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.arena.clearArena()" class="btn bg-red-600 text-white text-[10px] font-bold uppercase">Limpar Tudo</button>
                        <button onclick="window.arena.nextTurn()" class="btn bg-emerald-600 text-white text-[10px] font-bold uppercase">Próx. Turno</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <span id="arena-tool-display" class="text-[9px] text-amber-500 font-bold uppercase">Ferramenta: Seleção</span>
                    </div>
                </div>
                <div class="p-4 bg-slate-900 border-t border-slate-700">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs text-slate-400 font-bold uppercase">Spawn Rápido</span>
                        <input type="text" id="arena-spawn-filter" placeholder="Buscar..." class="text-xs bg-slate-800 border border-slate-700 w-48 rounded px-2" onkeyup="window.arena.renderSpawnList()">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-slate-950/50 p-2 rounded border border-slate-800"><div class="text-[9px] uppercase font-bold text-emerald-400 mb-2">Aliados</div><div id="spawn-list-players" class="spawn-list-container custom-scroll" style="height: 150px; overflow-y: auto;"></div></div>
                        <div class="bg-slate-950/50 p-2 rounded border border-slate-800"><div class="text-[9px] uppercase font-bold text-rose-400 mb-2">Monstros</div><div id="spawn-list-monsters" class="spawn-list-container custom-scroll" style="height: 150px; overflow-y: auto;"></div></div>
                    </div>
                </div>
            </div>

            <div id="arena-ctx-menu" class="fixed z-[9999] hidden bg-slate-900 border-2 border-amber-500 rounded shadow-2xl min-w-[220px] overflow-hidden"></div>
        `;
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

    renderLog: function(logs) {
        const c = document.getElementById('arena-combat-log');
        if(c) c.innerHTML = (logs || []).slice(-20).reverse().map(l => `<div><span class="text-slate-500">[${new Date(l.timestamp).toLocaleTimeString()}]</span> ${l.text}</div>`).join('');
    },

    updateTransform: function() { 
        const svg = document.getElementById('arena-svg');
        if(svg) svg.style.transform = `translate(${this.drag.panX}px, ${this.drag.panY}px) scale(${this.scale})`; 
    },

    zoom: function(f) { this.scale *= f; this.updateTransform(); },

    setTool: function(t) { 
        this.tool = t; 
        const d = document.getElementById('arena-tool-display');
        if(d) d.textContent = `Ferramenta: ${t.toUpperCase()}`; 
    },

    handleHexClick: async function(q, r) {
        if(this.isMaster && this.tool !== 'select') {
            const sessionRef = doc(db, "rpg_sessions", this.sessionDocId);
            const key = `${q},${r}`;
            const updates = {};
            if(this.tool === 'erase') updates[`arena_state.obstaculos.${key}`] = deleteField();
            else updates[`arena_state.obstaculos.${key}`] = this.tool.replace('wall_','');
            await updateDoc(sessionRef, updates);
            return;
        }

        if(this.selectedTokenId) {
            await updateDoc(doc(db, "rpg_sessions", this.sessionDocId), {
                [`arena_state.tokens.${this.selectedTokenId}.q`]: q,
                [`arena_state.tokens.${this.selectedTokenId}.r`]: r
            });
            this.selectedTokenId = null;
            this.renderTokens();
        }
    },

    showError: function(m) { 
        document.getElementById('arena-viewport').innerHTML = `<div class="absolute inset-0 flex items-center justify-center bg-slate-900/90 text-amber-500 p-10 text-center font-cinzel">${m}</div>`; 
    },

    resetLocalActions: function() { this.turnActions = { movement: false, action: false, free: false }; },

    updateActionHUD: function() {
        const hud = document.getElementById('player-action-hud');
        if(!hud) return;
        const turnId = this.data.ordemIniciativa?.[this.data.turnoIndex];
        const isMyTurn = this.isMaster || (turnId && turnId.startsWith(globalState.selectedCharacterId));
        hud.classList.toggle('hidden', !isMyTurn);
    }
};
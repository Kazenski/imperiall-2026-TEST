// js/admin/mapaArquiteto.js
// Substitui mapa-original.html — Vanilla JS ES Module, zero Babel, zero React, zero iframe
// Leaflet com L.Canvas nativo + Fog of War via OffscreenCanvas

import {
    db, auth, onAuthStateChanged, signOut,
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    onSnapshot, setDoc, increment, serverTimestamp, deleteField,
    query, orderBy, writeBatch
} from '../core/firebase.js';
import { globalState, ADMIN_EMAIL } from '../core/state.js';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const WORLD_MAP_URL = "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media";
const MAP_W = 2048;
const MAP_H = 1536;
const HEX_RADIUS = 10;
const HEX_H = HEX_RADIUS * 2;
const HEX_W = Math.sqrt(3) * HEX_RADIUS;
const VERT_DIST = HEX_H * 0.75;
const HEX_COLS = Math.ceil(MAP_W / HEX_W) + 2;
const HEX_ROWS = Math.ceil(MAP_H / VERT_DIST) + 2;

const COLS = {
    LOCATIONS: 'rpg_locations', ROUTES: 'rpg_routes', ROUTE_TYPES: 'rpg_route_types',
    EVENTS: 'rpg_events', ISOLATED: 'rpg_isolated_encounters', SEASONS: 'rpg_seasons',
    WORLD: 'rpg_world_state', NPCS: 'rpg_Npcs', GROUPS: 'rpg_group_locations',
    DUNGEONS: 'rpg_dungeons', MONSTERS: 'rpg_fichasNPCMonstros',
    ITEMS: 'rpg_itensCadastrados', ITEMS_BAG: 'rpg_itensMochila',
    PLAYERS: 'rpg_fichas', SESSIONS: 'rpg_sessions'
};

const EVENT_ICONS = ['zap','skull','flame','droplets','wind','snowflake','sun','moon',
    'star','cloud','cloud-rain','cloud-lightning','tornado','waves','mountain',
    'tent','flag','sword','shield','anchor'];

const ROUTE_ICONS_PRESETS = [
    { id:'npc', name:'NPC / Personagem', icon:'user' },
    { id:'guild', name:'Rota da Guilda', icon:'shield' },
    { id:'ship', name:'Transporte Marítimo', icon:'anchor' },
    { id:'cargo', name:'Comércio/Caravana', icon:'package' },
    { id:'wagon', name:'Carroça Padrão', icon:'truck' },
    { id:'magic', name:'Fluxo Mágico', icon:'sparkles' },
    { id:'beast', name:'Trilha de Feras', icon:'paw-print' },
    { id:'royal', name:'Rota Real', icon:'crown' },
    { id:'scout', name:'Batedores', icon:'binoculars' },
    { id:'religion', name:'Peregrinação', icon:'star' },
    { id:'military', name:'Patrulha Militar', icon:'swords' },
    { id:'messenger', name:'Mensageiro', icon:'mail' },
    { id:'border', name:'Fronteira', icon:'map-pin' },
    { id:'nature', name:'Trilha Natural', icon:'leaf' },
    { id:'underground', name:'Túneis', icon:'mountain' },
    { id:'flight', name:'Rota Aérea', icon:'wind' },
    { id:'watch', name:'Vigília', icon:'eye' },
    { id:'camp', name:'Acampamento', icon:'tent' },
    { id:'hidden', name:'Trilha Oculta', icon:'ghost' },
    { id:'danger', name:'Rota Perigosa', icon:'skull' }
];

const MOON_PHASES = [
    { name:"Lua Nova", icon:"circle", color:"#1e293b" },
    { name:"Lua Crescente", icon:"moon", color:"#94a3b8" },
    { name:"Quarto Crescente", icon:"moon", color:"#cbd5e1" },
    { name:"Lua Gibosa", icon:"circle", color:"#e2e8f0" },
    { name:"Lua Cheia", icon:"circle", color:"#ffffff" },
    { name:"Lua Disseminadora", icon:"circle", color:"#e2e8f0" },
    { name:"Quarto Minguante", icon:"moon", color:"#cbd5e1" },
    { name:"Lua Minguante", icon:"moon", color:"#94a3b8" },
    { name:"Eclipse", icon:"eclipse", color:"#ef4444" },
    { name:"Convergência Lunar", icon:"sparkles", color:"#a855f7" }
];

// ─── ESTADO DO MÓDULO ─────────────────────────────────────────────────────────
const state = {
    page: 'map',
    mapInstance: null,
    layers: {
        locations: null, dungeons: null, routes: null,
        events: null, isolated: null, groups: null, npcs: null
    },
    fogCanvas: null,  // FogOfWar canvas layer
    fogCtx: null,
    fogRevealedSet: new Set(),
    fogToolMode: 'reveal',
    fogSelectedSession: null,
    fogLocalRevealed: new Set(),
    unsubscribers: [],
    data: {
        locations: [], dungeons: [], routes: [], routeTypes: {},
        events: [], isolated: [], groups: [], npcs: [],
        worldState: {}, seasons: [], sessions: [], players: [],
        monsters: [], items: []
    },
    editing: null,
    tempPoints: [],
    filters: { locations:true, dungeons:true, routes:true, events:true, npcs:true, isolated:true },
    editorTab: 'general',
    activeRewardTier: 'basic',
    dungeonTab: 'create',
    manageSelection: null,
    selectedPlayers: [],
    searchTerm: '',
    modal: null,
    sessionEditing: null,
};

// ─── PONTO DE ENTRADA ─────────────────────────────────────────────────────────
export function renderMapaMundialTab() {
    const container = document.getElementById('mapa-mundial-content');
    if (!container) return;

    // Limpa listeners antigos
    _destroyAll();

    container.innerHTML = _shellHTML();
    _applyInlineStyles();
    _bindNav();
    _initLeaflet();
    _setupFirebaseListeners();
    _renderPage('map');
}

// ─── HTML SHELL ───────────────────────────────────────────────────────────────
function _shellHTML() {
    return `
<div id="arq-root" style="display:flex;flex-direction:column;height:100%;background:#020617;color:#e2e8f0;font-family:Inter,sans-serif;overflow:hidden;">
  <header id="arq-header" style="display:flex;align-items:center;background:#0f172a;border-bottom:1px solid #1e293b;height:3.5rem;padding:0 1rem;flex-shrink:0;overflow-x:auto;gap:4px;z-index:900;">
    <span style="color:#f59e0b;font-weight:700;font-family:'Cinzel',serif;margin-right:1rem;white-space:nowrap;font-size:0.9rem;">⚔ ARCHITECT</span>
    <nav id="arq-nav" style="display:flex;height:100%;gap:2px;overflow-x:auto;"></nav>
  </header>
  <main id="arq-main" style="flex:1;display:flex;overflow:hidden;position:relative;min-height:0;"></main>
  <div id="arq-modal-root"></div>

</div>`;
}

function _applyInlineStyles() {
    const style = document.createElement('style');
    style.id = 'arq-styles';
    style.textContent = `
#arq-root .arq-input { width:100%;background:#1e293b;border:1px solid #334155;color:white;padding:0.6rem 0.75rem;border-radius:6px;font-size:0.875rem;outline:none;transition:border-color 0.2s;box-sizing:border-box; }
#arq-root .arq-input:focus { border-color:#f59e0b; }
#arq-root .arq-label { display:block;font-size:0.65rem;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:0.25rem;letter-spacing:0.05em; }
#arq-root .arq-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0.5rem 1rem;border:none;border-radius:6px;font-weight:700;font-size:0.8rem;cursor:pointer;transition:all 0.2s; }
#arq-root .arq-btn-primary { background:#f59e0b;color:#000; } #arq-root .arq-btn-primary:hover { background:#fbbf24; }
#arq-root .arq-btn-green { background:#16a34a;color:white; } #arq-root .arq-btn-green:hover { background:#15803d; }
#arq-root .arq-btn-red { background:#991b1b;color:white; } #arq-root .arq-btn-red:hover { background:#ef4444; }
#arq-root .arq-btn-blue { background:#1d4ed8;color:white; } #arq-root .arq-btn-blue:hover { background:#3b82f6; }
#arq-root .arq-btn-purple { background:#7c3aed;color:white; } #arq-root .arq-btn-purple:hover { background:#8b5cf6; }
#arq-root .arq-btn-gray { background:#334155;color:#e2e8f0; } #arq-root .arq-btn-gray:hover { background:#475569; }
#arq-root .arq-btn-cyan { background:#0e7490;color:white; } #arq-root .arq-btn-cyan:hover { background:#0891b2; }
#arq-root .arq-btn-sm { padding:0.3rem 0.6rem;font-size:0.72rem; }
#arq-root .arq-sidebar { width:19rem;background:#0f172a;border-right:1px solid #1e293b;display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0; }
#arq-root .arq-panel { flex:1;overflow-y:auto; }
#arq-root .arq-map-wrap { position:relative;flex:1;min-height:0; }
#arq-root .arq-floating { position:absolute;top:1rem;left:1rem;z-index:800;background:rgba(15,23,42,0.97);border:1px solid #334155;border-radius:8px;padding:1.25rem;box-shadow:0 8px 32px rgba(0,0,0,0.7);max-height:85vh;overflow-y:auto;backdrop-filter:blur(4px); }
#arq-root .arq-list-item { padding:0.6rem 0.75rem;border-radius:6px;cursor:pointer;border-left:3px solid transparent;margin-bottom:4px;transition:all 0.15s;background:#0f172a; }
#arq-root .arq-list-item:hover { background:#1e293b; }
#arq-root .arq-list-item.active { background:#1e293b;border-left-color:#f59e0b; }
#arq-root .arq-nav-btn { display:flex;align-items:center;gap:5px;padding:0 0.85rem;height:100%;border:none;background:transparent;color:#94a3b8;font-weight:700;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:all 0.2s; }
#arq-root .arq-nav-btn:hover { color:white;background:#1e293b; }
#arq-root .arq-nav-btn.active { color:#f59e0b;border-bottom-color:#f59e0b;background:#1e293b; }
#arq-root .arq-tab-bar { display:flex;border-bottom:1px solid #1e293b;overflow-x:auto;flex-shrink:0; }
#arq-root .arq-etab { padding:0.5rem 1rem;background:transparent;border:none;color:#64748b;font-weight:700;font-size:0.72rem;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap; }
#arq-root .arq-etab.active { color:#f59e0b;border-bottom-color:#f59e0b; }
#arq-root .arq-section { padding:1.25rem;border-bottom:1px solid #1e293b; }
#arq-root .arq-grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:0.75rem; }
#arq-root .arq-icon-grid { display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;max-height:8rem;overflow-y:auto; }
#arq-root .arq-icon-opt { display:flex;align-items:center;justify-content:center;padding:0.4rem;border:1px solid #334155;border-radius:4px;cursor:pointer;transition:all 0.15s;background:#0f172a; }
#arq-root .arq-icon-opt:hover,.arq-icon-opt.active { border-color:#f59e0b;background:#1e293b;color:#f59e0b; }
#arq-root .arq-master-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.5rem;max-height:280px;overflow-y:auto;padding:0.5rem;background:#020617;border:1px solid #334155;border-radius:6px; }
#arq-root .arq-master-item { background:#1e293b;border:1px solid #334155;border-radius:6px;padding:0.4rem;display:flex;flex-direction:column;align-items:center;gap:0.3rem;transition:all 0.15s; }
#arq-root .arq-master-item.selected { border-color:#f59e0b;background:#334155; }
#arq-root .arq-master-img { width:44px;height:44px;background-size:cover;background-position:center;border-radius:4px;background-color:#000;border:1px solid #475569; }
#arq-root .arq-ctrl { display:flex;align-items:center;gap:4px; }
#arq-root .arq-ctrl-btn { width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;font-weight:700;cursor:pointer;font-size:13px;border:none; }
#arq-root .arq-ctrl-minus { background:#991b1b;color:white; } #arq-root .arq-ctrl-minus:hover { background:#ef4444; }
#arq-root .arq-ctrl-plus { background:#166534;color:white; } #arq-root .arq-ctrl-plus:hover { background:#22c55e; }
#arq-root .arq-ctrl-qty { width:36px;text-align:center;background:#020617;border:1px solid #475569;color:#fbbf24;font-family:monospace;font-weight:700;font-size:13px;border-radius:4px;outline:none;padding:0 2px; }
#arq-root .arq-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px); }
#arq-root .arq-modal-box { background:#0f172a;border:1px solid #475569;border-radius:10px;padding:1.5rem;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.9); }
#arq-root .arq-modal-picker { max-width:760px;width:95%;max-height:80vh;display:flex;flex-direction:column; }
#arq-root .arq-picker-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:0.6rem;max-height:350px;overflow-y:auto;padding:0.5rem;background:#020617;border-radius:6px;border:1px solid #334155; }
#arq-root .arq-picker-item { aspect-ratio:1;background:#1e293b;border:1px solid #334155;border-radius:6px;cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;background-size:cover;background-position:center;transition:all 0.15s; }
#arq-root .arq-picker-item:hover { border-color:#f59e0b;transform:scale(1.05); }
#arq-root .arq-picker-name { font-size:9px;text-align:center;background:rgba(0,0,0,0.8);width:100%;padding:3px 2px;position:absolute;bottom:0;border-radius:0 0 5px 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.leaflet-container { background:#020617; }
.leaflet-popup-content-wrapper { background:#1e293b;color:white;border:1px solid #f59e0b; }
.leaflet-popup-tip { background:#f59e0b; }
.custom-div-icon { background:transparent;border:none; }
.arq-fog-canvas { position:absolute;top:0;left:0;pointer-events:none;z-index:400; }
`;
    const old = document.getElementById('arq-styles');
    if (old) old.remove();
    document.head.appendChild(style);
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────────────────────
const PAGES = [
    { id:'map', label:'Global', icon:'map' },
    { id:'sessions', label:'Sessões', icon:'users' },
    { id:'sessionMap', label:'Mapa Sessão', icon:'eye' },
    { id:'dungeons', label:'Dungeons', icon:'castle' },
    { id:'locations', label:'Locais', icon:'map-pin' },
    { id:'routes', label:'Rotas', icon:'route' },
    { id:'events', label:'Eventos', icon:'zap' },
    { id:'isolated', label:'Encontros', icon:'sword' },
    { id:'time', label:'Tempo', icon:'clock' },
];

function _bindNav() {
    const nav = document.getElementById('arq-nav');
    if (!nav) return;
    nav.innerHTML = PAGES.map(p => `
        <button class="arq-nav-btn${state.page===p.id?' active':''}" data-page="${p.id}">
            ${_icon(p.icon,14)} ${p.label}
        </button>`).join('');
    nav.querySelectorAll('.arq-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => _renderPage(btn.dataset.page));
    });
}

function _renderPage(pageId) {
    state.page = pageId;
    state.editing = null;
    state.tempPoints = [];
    document.querySelectorAll('.arq-nav-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.page === pageId));
    const main = document.getElementById('arq-main');
    if (!main) return;

    // Salvar o host antes de limpar (ele é filho de main e seria destruído)
    const host = document.getElementById('arq-leaflet-host');
    if (host) main.removeChild(host);  // remove temporariamente sem destruir

    main.innerHTML = '';

    // Recolocar o host no main (mas oculto — a aba decide se quer mostrar)
    if (host) {
        host.style.display = 'none';
        main.appendChild(host);
    }

    const renderers = {
        map: _renderGlobalMap, sessions: _renderSessions,
        sessionMap: _renderSessionMap, dungeons: _renderDungeons,
        locations: _renderLocations, routes: _renderRoutes,
        events: _renderEvents, isolated: _renderIsolated,
        time: _renderTime,
    };
    if (renderers[pageId]) renderers[pageId](main);
}

// ─── LEAFLET ──────────────────────────────────────────────────────────────────
function _initLeaflet() {
    if (state.mapInstance) {
        try { state.mapInstance.remove(); } catch(e) {}
        state.mapInstance = null;
    }

    const main = document.getElementById('arq-main');
    if (!main) return;

    // Host fixo no main — nunca sai daqui, apenas reposicionado
    const host = document.createElement('div');
    host.id = 'arq-leaflet-host';
    host.style.cssText = 'position:absolute;z-index:1;background:#020617;';
    main.appendChild(host);

    const bounds = [[0,0],[MAP_H,MAP_W]];
    const map = L.map(host, {
        crs: L.CRS.Simple,
        minZoom: -2, maxZoom: 3,
        zoomControl: false, attributionControl: false,
        preferCanvas: true
    });

    L.imageOverlay(WORLD_MAP_URL, bounds).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    state.mapInstance = map;

    state.layers.locations = L.layerGroup().addTo(map);
    state.layers.dungeons  = L.layerGroup().addTo(map);
    state.layers.routes    = L.layerGroup().addTo(map);
    state.layers.events    = L.layerGroup().addTo(map);
    state.layers.isolated  = L.layerGroup().addTo(map);
    state.layers.groups    = L.layerGroup().addTo(map);
    state.layers.npcs      = L.layerGroup().addTo(map);
    state.layers.temp      = L.layerGroup().addTo(map);

    // Inicia oculto; _positionMapHost irá posicioná-lo ao abrir a primeira aba
    host.style.display = 'none';
}



// Posiciona o host Leaflet sobre o elemento alvo e torna visível
function _positionMapHost(targetId) {
    const host = document.getElementById('arq-leaflet-host');
    const main = document.getElementById('arq-main');
    if (!host || !main || !state.mapInstance) return;

    // Garantir que o host está no main (pode ter sido movido)
    if (host.parentNode !== main) main.appendChild(host);

    const isFirstTime = !state._mapEverFitBounds;

    const doPosition = () => {
        const target = document.getElementById(targetId);
        if (!target) return;
        const mainRect = main.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        // Usar fallback se getBoundingClientRect retornar zero (elemento ainda sem layout)
        const left   = targetRect.left - mainRect.left;
        const top    = targetRect.top  - mainRect.top;
        const width  = targetRect.width  || mainRect.width;
        const height = targetRect.height || mainRect.height;
        if (width < 10 || height < 10) {
            // Container sem dimensão ainda — tentar de novo em 100ms
            setTimeout(() => doPosition(), 100);
            return;
        }
        host.style.cssText = `position:absolute;z-index:1;left:${left}px;top:${top}px;width:${width}px;height:${height}px;display:block;`;
        state.mapInstance.invalidateSize({ animate: false });
        if (isFirstTime) {
            state._mapEverFitBounds = true;
            state.mapInstance.fitBounds([[0,0],[MAP_H,MAP_W]]);
        }
    };

    // rAF duplo para garantir que o layout foi calculado
    requestAnimationFrame(() => requestAnimationFrame(doPosition));
}

function _hideMapHost() {
    const host = document.getElementById('arq-leaflet-host');
    if (host) host.style.display = 'none';
}

function _attachMapToContainer(wrapperId) {
    _positionMapHost(wrapperId);
}

// ─── FOG OF WAR CANVAS ────────────────────────────────────────────────────────
function _initFogCanvas() {
    const host = document.getElementById('arq-leaflet-host');
    if (!host) return;
    const old = host.querySelector('.arq-fog-canvas');
    if (old) old.remove();

    const canvas = document.createElement('canvas');
    canvas.className = 'arq-fog-canvas';
    canvas.width = host.clientWidth || 800;
    canvas.height = host.clientHeight || 600;
    host.appendChild(canvas);
    state.fogCanvas = canvas;
    state.fogCtx = canvas.getContext('2d');

    // Atualizar tamanho no resize
    new ResizeObserver(() => {
        if (state.fogCanvas) {
            state.fogCanvas.width = host.clientWidth;
            state.fogCanvas.height = host.clientHeight;
            _redrawFog();
        }
    }).observe(host);

    _redrawFog();
}

function _destroyFogCanvas() {
    if (state.fogCanvas) { state.fogCanvas.remove(); state.fogCanvas = null; state.fogCtx = null; }
}

function _hexCenter(r, c) {
    const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
    return {
        x: (c * HEX_W) + xOffset - (HEX_W / 2),
        y: (r * VERT_DIST) - (HEX_H / 2)
    };
}

function _hexId(r, c) { return `${r}-${c}`; }

function _pixelToHexId(mapLat, mapLng) {
    // mapLat = y, mapLng = x no CRS.Simple do Leaflet
    const x = mapLng, y = mapLat;
    const r = Math.round(y / VERT_DIST);
    const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
    const c = Math.round((x + HEX_W / 2 - xOffset) / HEX_W);
    return _hexId(r, c);
}

function _redrawFog() {
    if (!state.fogCtx || !state.mapInstance) return;
    const ctx = state.fogCtx;
    const map = state.mapInstance;
    ctx.clearRect(0, 0, state.fogCanvas.width, state.fogCanvas.height);

    const revealed = state.fogLocalRevealed;

    for (let r = 0; r < HEX_ROWS; r++) {
        for (let c = 0; c < HEX_COLS; c++) {
            const { x: cx, y: cy } = _hexCenter(r, c);
            if (cx < -HEX_RADIUS || cx > MAP_W + HEX_RADIUS) continue;
            if (cy < -HEX_RADIUS || cy > MAP_H + HEX_RADIUS) continue;

            const id = _hexId(r, c);
            const isRevealed = revealed.has(id);

            // Converter coordenada do mapa para pixel do canvas
            const screenPt = map.latLngToContainerPoint([cy, cx]);

            const hexCorners = _getHexScreenCorners(map, cx, cy);
            ctx.beginPath();
            ctx.moveTo(hexCorners[0].x, hexCorners[0].y);
            for (let i = 1; i < 6; i++) ctx.lineTo(hexCorners[i].x, hexCorners[i].y);
            ctx.closePath();

            if (isRevealed) {
                ctx.fillStyle = 'rgba(74,222,128,0.18)';
                ctx.strokeStyle = 'rgba(74,222,128,0.35)';
            } else {
                ctx.fillStyle = 'rgba(2,6,23,0.72)';
                ctx.strokeStyle = 'rgba(30,41,59,0.4)';
            }
            ctx.lineWidth = 0.5;
            ctx.fill();
            ctx.stroke();
        }
    }
}

function _getHexScreenCorners(map, cx, cy) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const lx = cx + HEX_RADIUS * Math.cos(angle);
        const ly = cy + HEX_RADIUS * Math.sin(angle);
        const pt = map.latLngToContainerPoint([ly, lx]);
        corners.push(pt);
    }
    return corners;
}

// ─── FIREBASE LISTENERS ───────────────────────────────────────────────────────
function _setupFirebaseListeners() {
    _destroyListeners();
    const unsubs = [
        onSnapshot(collection(db, COLS.LOCATIONS), s => {
            state.data.locations = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('locations');
        }),
        onSnapshot(collection(db, COLS.DUNGEONS), s => {
            state.data.dungeons = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('dungeons');
        }),
        onSnapshot(collection(db, COLS.ROUTES), s => {
            state.data.routes = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('routes');
        }),
        onSnapshot(collection(db, COLS.ROUTE_TYPES), s => {
            const t = {}; s.docs.forEach(d => t[d.id] = d.data());
            state.data.routeTypes = t;
            _rebuildLayer('routes');
        }),
        onSnapshot(collection(db, COLS.EVENTS), s => {
            state.data.events = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('events');
        }),
        onSnapshot(collection(db, COLS.ISOLATED), s => {
            state.data.isolated = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('isolated');
        }),
        onSnapshot(collection(db, COLS.GROUPS), s => {
            state.data.groups = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('groups');
        }),
        onSnapshot(collection(db, COLS.NPCS), s => {
            state.data.npcs = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _rebuildLayer('npcs');
        }),
        onSnapshot(doc(db, COLS.WORLD, 'main'), d => {
            state.data.worldState = d.data() || {};
            _refreshTimeUI();
        }),
        onSnapshot(collection(db, COLS.SEASONS), s => {
            state.data.seasons = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _refreshTimeUI();
        }),
        onSnapshot(collection(db, COLS.SESSIONS), s => {
            state.data.sessions = s.docs.map(d => ({ id: d.id, ...d.data() }));
            _refreshSessionsUI();
        }),
        onSnapshot(query(collection(db, COLS.PLAYERS), orderBy('nome')), s => {
            state.data.players = s.docs.map(d => ({ id: d.id, ...d.data() }));
        }),
        onSnapshot(query(collection(db, COLS.MONSTERS), orderBy('nome')), s => {
            state.data.monsters = s.docs.map(d => ({ id: d.id, ...d.data() }));
        }),
    ];
    state.unsubscribers = unsubs;

    // Itens: busca única (não precisam de listener em tempo real no mapa)
    _loadItems();
}

async function _loadItems() {
    const [s1, s2] = await Promise.all([
        getDocs(collection(db, COLS.ITEMS)),
        getDocs(collection(db, COLS.ITEMS_BAG))
    ]);
    const map = new Map();
    s1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    s2.docs.forEach(d => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data() }); });
    state.data.items = Array.from(map.values()).sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
}

function _destroyListeners() {
    state.unsubscribers.forEach(u => u && u());
    state.unsubscribers = [];
}

function _destroyAll() {
    _destroyListeners();
    _destroyFogCanvas();
    if (state.mapInstance) { state.mapInstance.remove(); state.mapInstance = null; }
    const old = document.getElementById('arq-styles');
    if (old) old.remove();
}

// ─── LAYER REBUILD (PARCIAL - SÓ A CAMADA AFETADA) ───────────────────────────
function _rebuildLayer(name) {
    const map = state.mapInstance;
    const layer = state.layers[name];
    if (!map || !layer) return;
    layer.clearLayers();

    switch (name) {
        case 'locations': _buildLocationsLayer(layer); break;
        case 'dungeons':  _buildDungeonsLayer(layer);  break;
        case 'routes':    _buildRoutesLayer(layer);    break;
        case 'events':    _buildEventsLayer(layer);    break;
        case 'isolated':  _buildIsolatedLayer(layer);  break;
        case 'groups':    _buildGroupsLayer(layer);    break;
        case 'npcs':      _buildNpcsLayer(layer);      break;
    }

    // Aplica visibilidade do filtro
    _applyFilters();
}

function _applyFilters() {
    const map = state.mapInstance;
    if (!map) return;
    const f = state.filters;
    const toggle = (layerName, visible) => {
        const lg = state.layers[layerName];
        if (!lg) return;
        if (visible) { if (!map.hasLayer(lg)) map.addLayer(lg); }
        else { if (map.hasLayer(lg)) map.removeLayer(lg); }
    };
    toggle('locations', f.locations);
    toggle('dungeons',  f.dungeons);
    toggle('routes',    f.routes);
    toggle('events',    f.events);
    toggle('isolated',  f.isolated);
    toggle('groups',    true);
    toggle('npcs',      f.npcs);
}

function _buildLocationsLayer(layer) {
    state.data.locations.forEach(loc => {
        if (!loc.y || !loc.x) return;
        const html = `<div style="background:#d97706;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.6);cursor:pointer;"></div>`;
        const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[14,14] });
        const pop = `<b>${loc.name}</b><br><span style="color:#94a3b8;font-size:11px">${loc.type||''}</span>${loc.pop?`<br><span style="color:#fbbf24">Pop: ${loc.pop}</span>`:''}`;
        L.marker([loc.y, loc.x], { icon, zIndexOffset:10000 }).bindPopup(pop).addTo(layer);
    });
}

function _buildDungeonsLayer(layer) {
    const diffColors = { 1:'#94a3b8', 2:'#4ade80', 3:'#60a5fa', 4:'#c084fc', 5:'#fbbf24' };
    state.data.dungeons.forEach(d => {
        if (!d.y || !d.x) return;
        const color = diffColors[d.difficulty||1] || '#94a3b8';
        const isActive = d.isActive !== false;
        const svg = _getIconSvg('door-open', '#000', 16);
        const html = `<div style="opacity:${isActive?1:0.5};background:${color};width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;border:2px solid #000;box-shadow:0 4px 8px rgba(0,0,0,0.6);">${svg}</div>`;
        const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[30,30] });
        const pop = `<b>${d.name}</b><hr style="border-color:#334155;margin:4px 0"><span style="color:#fbbf24">Dific: ${d.difficulty||1}</span><br><span style="color:#94a3b8">Andares: ${d.floors||1}</span>`;
        L.marker([d.y, d.x], { icon, zIndexOffset:9000 }).bindPopup(pop).addTo(layer);
    });
}

function _buildRoutesLayer(layer) {
    const types = state.data.routeTypes;
    state.data.routes.forEach(r => {
        if (!r.points || r.points.length < 2) return;
        const rType = r.typeId ? types[r.typeId] : null;
        const lineColor = rType?.color || '#ffffff';
        L.polyline(r.points.map(p => [p.lat, p.lng]), {
            color: lineColor, weight: 2, opacity: 0.55, dashArray: '6,10'
        }).addTo(layer);
        const mid = r.points[Math.floor(r.points.length / 2)];
        const svg = rType ? _getIconSvg(rType.icon || 'route', lineColor, 16) : _getIconSvg('route','white',16);
        const html = `<div style="background:#0f172a;border:2px solid ${lineColor};border-radius:50%;padding:4px;box-shadow:0 0 8px rgba(0,0,0,0.7);">${svg}</div>`;
        const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[28,28] });
        const pop = `<b>${r.name}</b><br><span style="color:${lineColor}">${rType?.name||'Rota'}</span>`;
        L.marker([mid.lat, mid.lng], { icon }).bindPopup(pop).addTo(layer);
    });
}

function _buildEventsLayer(layer) {
    state.data.events.forEach(ev => {
        if (!ev.y || !ev.x || ev.isActive === false) return;
        L.circle([ev.y, ev.x], { radius: ev.radius||100, color: ev.color||'purple', fillColor: ev.color||'purple', fillOpacity:0.12 }).addTo(layer);
        const svg = _getIconSvg(ev.icon||'zap','white',18);
        const html = `<div style="background:${ev.color||'purple'};border-radius:50%;padding:5px;box-shadow:0 0 12px ${ev.color||'purple'};border:2px solid #fff;">${svg}</div>`;
        const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[34,34] });
        const pop = `<b>${ev.name}</b><br><span style="color:#fbbf24">${ev.chance||0}%</span>`;
        L.marker([ev.y, ev.x], { icon, zIndexOffset:8000 }).bindPopup(pop).addTo(layer);
    });
}

function _buildIsolatedLayer(layer) {
    state.data.isolated.forEach(iso => {
        if (!iso.spots) return;
        iso.spots.forEach(spot => {
            const svg = _getIconSvg('sword','#94a3b8',14);
            const html = `<div style="background:#1e293b;border:2px solid #94a3b8;border-radius:50%;padding:4px;opacity:0.65;">${svg}</div>`;
            const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[28,28] });
            L.marker([spot.lat, spot.lng], { icon }).bindPopup(`<b>${iso.name}</b>`).addTo(layer);
        });
    });
}

function _buildGroupsLayer(layer) {
    state.data.groups.forEach(g => {
        if (!g.locations || g.locations.length < 2) return;
        L.polyline(g.locations.map(p => [p.lat, p.lng]), {
            color: g.color||'#06b6d4', weight:2, opacity:0.5, dashArray:'4,8'
        }).addTo(layer);
    });
}

function _buildNpcsLayer(layer) {
    if (!state.filters.npcs) return;
    const types = state.data.routeTypes;
    const routes = state.data.routes;
    // NPCs com posição fixa
    state.data.npcs.forEach(npc => {
        if (!npc.posY || !npc.posX) return;
        const html = `<div style="background:#7c3aed;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.6);"></div>`;
        const icon = L.divIcon({ className:'custom-div-icon', html, iconSize:[12,12] });
        L.marker([npc.posY, npc.posX], { icon }).bindPopup(`<b>${npc.nome||npc.name}</b>`).addTo(layer);
    });
}

// ─── ICON HELPER ─────────────────────────────────────────────────────────────
// Dicionário de SVG paths inline para os ícones usados em markers Leaflet e UI.
// Independente do formato interno do Lucide (compatível com qualquer versão UMD).
const _SVG_PATHS = {
    'map':          '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7"/><path d="M9 4v13"/><path d="M15 7v13"/>',
    'users':        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'eye':          '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off':      '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    'castle':       '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M2 11h20"/><path d="M6 7H4"/><path d="M10 7H8"/><path d="M14 7h-2"/><path d="M18 7h-2"/><path d="M6 11V4"/><path d="M18 11V4"/>',
    'map-pin':      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'route':        '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    'zap':          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'skull':        '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
    'flame':        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    'droplets':     '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
    'wind':         '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    'snowflake':    '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
    'sun':          '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'moon':         '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'star':         '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    'cloud':        '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    'cloud-rain':   '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
    'cloud-lightning':'<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
    'tornado':      '<path d="M21 4H3"/><path d="M18 8H6"/><path d="M19 12H9"/><path d="M16 16h-6"/><path d="M11 20H9"/>',
    'waves':        '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    'mountain':     '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    'tent':         '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
    'flag':         '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    'sword':        '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/>',
    'shield':       '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'anchor':       '<path d="M12 22V12"/><path d="M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M17 12H7"/><path d="M3 19a9 9 0 0 0 18 0"/>',
    'user':         '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'package':      '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'truck':        '<path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect width="7" height="7" x="14" y="10" rx="1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    'sparkles':     '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
    'paw-print':    '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    'crown':        '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>',
    'binoculars':   '<path d="M10 10H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h6"/><circle cx="7" cy="16" r="2"/><path d="M14 10h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-6"/><circle cx="17" cy="16" r="2"/><path d="M10 15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z"/><path d="M10 10V7a2 2 0 0 1 4 0v3"/>',
    'swords':       '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="9.5 6.5 6 3 3 6 6.5 9.5"/><line x1="6.5" x2="13" y1="9.5" y2="16"/>',
    'mail':         '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'leaf':         '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    'ghost':        '<path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
    'door-open':    '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
    'plus':         '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'x':            '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'trash':        '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    'settings':     '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'copy':         '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'clock':        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'hourglass':    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    'key':          '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    'gem':          '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    'layers':       '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.82l-3.5-1.59"/><path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.82l-3.5-1.59"/>',
    'rotate-cw':    '<path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>',
    'globe':        '<circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'refresh-cw':   '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'info':         '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'land-plot':    '<path d="m12 8 6-3-6-3v10"/><path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16.5 12"/><path d="m6.49 12.85L12 16l5.51-3.15"/><path d="M12 22v-6"/>',
    'castle2':      '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/>',
    'log-out':      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'rotate-ccw':   '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'circle':       '<circle cx="12" cy="12" r="10"/>',
    'eclipse':      '<circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 1 0 10 10"/>',
};

// Converte PascalCase/CamelCase (legado Firebase) para kebab-case
// Ex: 'CloudRain' → 'cloud-rain', 'Zap' → 'zap', 'zap' → 'zap'
function _normalizeIconName(name) {
    if (!name) return 'circle';
    // Já está em kebab-case (minúsculo)
    if (name === name.toLowerCase()) return name;
    // PascalCase/CamelCase → inserir hífen antes de cada maiúscula (exceto a primeira)
    return name
        .replace(/([A-Z])/g, (m, l, offset) => offset === 0 ? l.toLowerCase() : '-' + l.toLowerCase());
}

function _svgFromName(name, stroke, size, forUI=false) {
    const key = _normalizeIconName(name);
    const paths = _SVG_PATHS[key] || _SVG_PATHS['circle'];
    const style = forUI ? ' style="display:inline-block;vertical-align:middle;"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${style}>${paths}</svg>`;
}

function _icon(name, size=16) {
    return _svgFromName(name, 'currentColor', size, true);
}

function _getIconSvg(name, color, size=20) {
    return _svgFromName(name, color, size, false);
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function _showAlert(msg, title='Aviso') {
    return new Promise(res => {
        _renderModal(`
            <div class="arq-modal-overlay" id="arq-modal">
              <div class="arq-modal-box">
                <h3 style="color:#f59e0b;font-family:'Cinzel',serif;margin:0 0 1rem">${title}</h3>
                <p style="color:#cbd5e1;margin:0 0 1.5rem;white-space:pre-wrap">${msg}</p>
                <button class="arq-btn arq-btn-primary" onclick="document.getElementById('arq-modal').remove();">OK</button>
              </div>
            </div>`);
        document.getElementById('arq-modal').addEventListener('click', e => {
            if (e.target.id === 'arq-modal') { e.target.remove(); res(); }
        });
        document.querySelector('#arq-modal .arq-btn').addEventListener('click', () => res());
    });
}

function _showConfirm(msg, onConfirm) {
    _renderModal(`
        <div class="arq-modal-overlay" id="arq-modal">
          <div class="arq-modal-box">
            <h3 style="color:#60a5fa;font-family:'Cinzel',serif;margin:0 0 1rem">Confirmação</h3>
            <p style="color:#cbd5e1;margin:0 0 1.5rem">${msg}</p>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end">
              <button class="arq-btn arq-btn-gray" id="arq-modal-cancel">Cancelar</button>
              <button class="arq-btn arq-btn-primary" id="arq-modal-ok">Confirmar</button>
            </div>
          </div>
        </div>`);
    document.getElementById('arq-modal-cancel').onclick = () => document.getElementById('arq-modal').remove();
    document.getElementById('arq-modal-ok').onclick = () => { document.getElementById('arq-modal').remove(); onConfirm(); };
}

function _showPicker(items, onSelect) {
    const searchId = 'arq-picker-search';
    _renderModal(`
        <div class="arq-modal-overlay" id="arq-modal">
          <div class="arq-modal-box arq-modal-picker">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
              <h3 style="color:#22d3ee;margin:0">Selecionar Item</h3>
              <button class="arq-btn arq-btn-gray arq-btn-sm" onclick="document.getElementById('arq-modal').remove()">✕</button>
            </div>
            <input id="${searchId}" class="arq-input" placeholder="Buscar..." style="margin-bottom:0.75rem" />
            <div class="arq-picker-grid" id="arq-picker-grid"></div>
          </div>
        </div>`);

    const grid = document.getElementById('arq-picker-grid');
    const renderItems = (filter='') => {
        const filtered = filter ? items.filter(i => (i.nome||'').toLowerCase().includes(filter.toLowerCase())) : items;
        grid.innerHTML = filtered.map(item => `
            <div class="arq-picker-item" data-id="${item.id}" ${item.imagemUrl?`style="background-image:url('${item.imagemUrl}')"`:''}>
                ${!item.imagemUrl?`<span style="font-size:10px;color:#64748b;text-align:center;padding:4px">${(item.nome||'').substring(0,8)}</span>`:''}
                <span class="arq-picker-name">${item.nome||''}</span>
            </div>`).join('');
        grid.querySelectorAll('.arq-picker-item').forEach(el => {
            el.addEventListener('click', () => {
                const found = items.find(i => i.id === el.dataset.id);
                if (found) { document.getElementById('arq-modal').remove(); onSelect(found); }
            });
        });
    };
    renderItems();
    document.getElementById(searchId).addEventListener('input', e => renderItems(e.target.value));
}

function _renderModal(html) {
    const root = document.getElementById('arq-modal-root');
    if (root) { root.innerHTML = html; }
    else { document.getElementById('arq-root').insertAdjacentHTML('beforeend', html); }
}

// ─── PÁGINA: MAPA GLOBAL ──────────────────────────────────────────────────────
function _renderGlobalMap(main) {
    // main é display:flex — o mapa precisa ser um filho flex que ocupa todo o espaço
    main.style.cssText += ';position:relative;';
    main.innerHTML = `
        <div id="arq-map-global" style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;"></div>
        <div style="position:absolute;top:0.75rem;right:0.75rem;z-index:800;background:rgba(15,23,42,0.95);padding:0.75rem 1rem;border-radius:8px;border:1px solid #334155;width:11rem;backdrop-filter:blur(4px);">
            <div style="font-size:0.65rem;font-weight:700;color:#f59e0b;text-transform:uppercase;margin-bottom:0.5rem">Camadas</div>
            ${[['locations','Locais'],['dungeons','Dungeons'],['routes','Rotas'],['events','Eventos'],['npcs','Viajantes'],['isolated','Encontros']].map(([k,l])=>`
            <label style="display:flex;align-items:center;gap:0.5rem;color:#cbd5e1;font-size:0.8rem;cursor:pointer;margin-bottom:4px">
                <input type="checkbox" ${state.filters[k]?'checked':''} data-filter="${k}" style="accent-color:#f59e0b" /> ${l}
            </label>`).join('')}
            <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #1e293b;font-size:0.6rem;color:#475569;font-family:monospace;text-align:center">
                ${state.data.worldState.day||1}/${state.data.worldState.month||1}/${state.data.worldState.year||1} · ${state.data.worldState.time||'--:--'}
            </div>
        </div>`;

    _attachMapToContainer('arq-map-global');

    main.querySelectorAll('[data-filter]').forEach(cb => {
        cb.addEventListener('change', e => {
            state.filters[e.target.dataset.filter] = e.target.checked;
            _applyFilters();
        });
    });
}

// ─── PÁGINA: SESSÕES ──────────────────────────────────────────────────────────
function _renderSessions(main) {
    main.innerHTML = `
        <div class="arq-sidebar">
            <div class="arq-section" style="flex-shrink:0">
                <button class="arq-btn arq-btn-blue" style="width:100%" id="arq-sess-new">${_icon('plus',14)} Nova Sessão</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.5rem" id="arq-sess-list"></div>
        </div>
        <div class="arq-panel" style="overflow-y:auto" id="arq-sess-panel">
            <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#334155;gap:1rem">
                ${_icon('clock',48)}<p style="font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.2em">Linhas Temporais</p>
            </div>
        </div>`;

    document.getElementById('arq-sess-new').onclick = () => _openSessionEditor({ name:'', playerIds:[], customTime:'12:00', customDay:1, customMonth:1, customYear:1, paused:true, timeScale:1 });
    _refreshSessionsUI();
}

function _refreshSessionsUI() {
    const list = document.getElementById('arq-sess-list');
    if (!list) return;
    list.innerHTML = state.data.sessions.map(s => {
        const isRun = s.paused === false;
        return `<div class="arq-list-item${state.sessionEditing?.id===s.id?' active':''}" data-sessid="${s.id}">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:600;font-size:0.85rem">${s.name}</span>
                ${isRun?`<span style="font-size:0.65rem;color:#4ade80;font-weight:700;animation:pulse 1s infinite">● ${s.timeScale||1}x</span>`:''}
            </div>
            <div style="font-size:0.7rem;color:#64748b;font-family:monospace;margin-top:2px">${s.customTime||'--:--'} · Dia ${s.customDay||1}</div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-sessid]').forEach(el => {
        el.addEventListener('click', () => {
            const s = state.data.sessions.find(x => x.id === el.dataset.sessid);
            if (s) _openSessionEditor(s);
        });
    });
}

function _openSessionEditor(sess) {
    state.sessionEditing = { ...sess };
    const panel = document.getElementById('arq-sess-panel');
    if (!panel) return;

    const speeds = [1,2,5,10,20,60];
    const isRunning = sess.paused === false;
    const [h] = (sess.customTime||'12:00').split(':').map(Number);
    const isNight = h >= 19 || h < 6;
    const sky = isNight ? 'border-indigo-900 bg-slate-950' : 'border-sky-600 bg-sky-950';

    panel.innerHTML = `
        <div style="max-width:720px;margin:0 auto;padding:2rem">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #1e293b">
              <h2 style="color:#818cf8;font-family:'Cinzel',serif;margin:0">Gerenciar Sessão</h2>
              <div style="display:flex;gap:0.5rem">
                <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-sess-sync">${_icon('globe',13)} Sync Mundo</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem">
              <div>
                <label class="arq-label">Nome da Sessão</label>
                <input class="arq-input" id="arq-sess-name" value="${sess.name||''}" style="margin-bottom:1rem" />
                <label class="arq-label">Membros (${(sess.playerIds||[]).length})</label>
                <div style="background:#020617;border:1px solid #1e293b;border-radius:6px;max-height:260px;overflow-y:auto;padding:0.5rem">
                    ${state.data.players.map(p => {
                        const sel = (sess.playerIds||[]).includes(p.id);
                        return `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem;border-radius:4px;cursor:pointer;border:1px solid ${sel?'rgba(99,102,241,0.4)':'transparent'};background:${sel?'rgba(99,102,241,0.1)':'transparent'};margin-bottom:2px">
                            <input type="checkbox" data-pid="${p.id}" ${sel?'checked':''} style="accent-color:#6366f1" />
                            <span style="font-size:0.85rem;color:${sel?'#c7d2fe':'#94a3b8'}">${p.nome||p.name||p.id}</span>
                        </label>`;
                    }).join('')}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;background:rgba(15,23,42,0.5);border:1px solid #1e293b;border-radius:8px;padding:1.5rem">
                <div style="width:10rem;height:10rem;border-radius:50%;border:4px solid ${isNight?'#3730a3':'#0ea5e9'};background:${isNight?'#020617':'#0c4a6e'};display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:1.5rem;position:relative">
                    <div style="font-size:1.8rem;font-family:monospace;font-weight:700;color:white" id="arq-sess-clock">${sess.customTime||'12:00'}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;text-transform:uppercase;margin-top:4px">Dia ${sess.customDay||1}</div>
                    <div style="position:absolute;bottom:12px;font-size:0.6rem;font-weight:700;color:${isRunning?'#4ade80':'#ef4444'}" id="arq-sess-status">
                        ${isRunning?`● ${sess.timeScale||1}x Vel.`:'● Pausado'}
                    </div>
                </div>
                <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
                    <div><label class="arq-label">Hora</label><input type="time" class="arq-input" id="arq-sess-time" value="${sess.customTime||'12:00'}" /></div>
                    <div><label class="arq-label">Dia</label><input type="number" class="arq-input" id="arq-sess-day" value="${sess.customDay||1}" /></div>
                </div>
                <label style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;border-radius:6px;cursor:pointer;width:100%;border:1px solid ${isRunning?'rgba(74,222,128,0.3)':'#334155'};background:${isRunning?'rgba(74,222,128,0.05)':'#1e293b'};margin-bottom:1rem">
                    <input type="checkbox" id="arq-sess-running" ${isRunning?'checked':''} style="accent-color:#22c55e;width:18px;height:18px" />
                    <span style="font-weight:700;font-size:0.8rem;color:${isRunning?'#4ade80':'#94a3b8'}">${isRunning?'TEMPO CORRENDO (SERVER)':'TEMPO PAUSADO'}</span>
                </label>
                <div style="width:100%">
                    <label class="arq-label" style="text-align:center;display:block;margin-bottom:0.5rem">Velocidade do Tempo</label>
                    <div style="display:flex;gap:4px;justify-content:center">
                        ${speeds.map(sp=>`<button class="arq-btn arq-btn-sm${(sess.timeScale||1)===sp?' arq-btn-blue':' arq-btn-gray'}" data-speed="${sp}">${sp}x</button>`).join('')}
                    </div>
                    <p style="font-size:0.65rem;color:#475569;text-align:center;margin-top:0.5rem">* 5x+ ativa Regeneração automática de HP/MP</p>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:0.75rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #1e293b">
                <button class="arq-btn arq-btn-green" style="flex:1" id="arq-sess-save">Salvar Sessão</button>
                ${sess.id?`<button class="arq-btn arq-btn-red" id="arq-sess-del">Excluir</button>`:''}
            </div>
          </div>
        </div>`;

    document.getElementById('arq-sess-sync').onclick = async () => {
        const d = await getDoc(doc(db, COLS.WORLD, 'main'));
        if (d.exists()) {
            const w = d.data();
            document.getElementById('arq-sess-time').value = w.time||'12:00';
            document.getElementById('arq-sess-day').value = w.day||1;
        }
    };
    document.getElementById('arq-sess-save').onclick = async () => {
        const name = document.getElementById('arq-sess-name').value.trim();
        const playerIds = [...panel.querySelectorAll('[data-pid]:checked')].map(x=>x.dataset.pid);
        if (!name || !playerIds.length) { _showAlert('Defina um nome e escolha personagens.'); return; }
        const isRunning = document.getElementById('arq-sess-running').checked;
        const data = {
            name, playerIds,
            customTime: document.getElementById('arq-sess-time').value,
            customDay: parseInt(document.getElementById('arq-sess-day').value)||1,
            customMonth: state.sessionEditing.customMonth||1,
            customYear: state.sessionEditing.customYear||1,
            paused: !isRunning,
            timeScale: state.sessionEditing.timeScale||1,
            lastUpdate: serverTimestamp()
        };
        if (sess.id) await updateDoc(doc(db, COLS.SESSIONS, sess.id), data);
        else await addDoc(collection(db, COLS.SESSIONS), data);
        _showAlert('Sessão salva!');
    };
    if (sess.id) {
        document.getElementById('arq-sess-del').onclick = () =>
            _showConfirm('Excluir esta sessão?', async () => {
                await deleteDoc(doc(db, COLS.SESSIONS, sess.id));
                state.sessionEditing = null;
                document.getElementById('arq-sess-panel').innerHTML = '';
            });
    }
    // Speed buttons
    panel.querySelectorAll('[data-speed]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const sp = parseInt(btn.dataset.speed);
            state.sessionEditing.timeScale = sp;
            if (sess.id) await updateDoc(doc(db, COLS.SESSIONS, sess.id), { timeScale: sp });
            panel.querySelectorAll('[data-speed]').forEach(b => {
                b.className = `arq-btn arq-btn-sm ${parseInt(b.dataset.speed)===sp?'arq-btn-blue':'arq-btn-gray'}`;
            });
        });
    });
    document.getElementById('arq-sess-running').onchange = async e => {
        const isPaused = !e.target.checked;
        if (sess.id) await updateDoc(doc(db, COLS.SESSIONS, sess.id), { paused: isPaused });
    };
}

// ─── PÁGINA: MAPA DA SESSÃO (FOG OF WAR) ─────────────────────────────────────
function _renderSessionMap(main) {
    main.innerHTML = `
        <div class="arq-sidebar" style="padding:1.5rem;gap:1rem">
            <h3 style="color:#22c55e;font-family:'Cinzel',serif;margin:0 0 1rem;display:flex;align-items:center;gap:0.5rem">${_icon('map',18)} Mapa da Sessão</h3>
            <div>
                <label class="arq-label">Selecionar Sessão</label>
                <select class="arq-input" id="arq-fogmap-sess">
                    <option value="">-- Escolher --</option>
                    ${state.data.sessions.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
            </div>
            <div id="arq-fogmap-tools" style="display:none;flex-direction:column;gap:1rem">
                <div>
                    <label class="arq-label">Ferramenta</label>
                    <div style="display:flex;gap:0.5rem">
                        <button class="arq-btn arq-btn-green arq-btn-sm" style="flex:1" id="arq-fog-reveal">${_icon('eye',14)} Revelar</button>
                        <button class="arq-btn arq-btn-gray arq-btn-sm" style="flex:1" id="arq-fog-hide">${_icon('eye-off',14)} Ocultar</button>
                    </div>
                </div>
                <button class="arq-btn arq-btn-primary" style="width:100%" id="arq-fog-sync">${_icon('refresh-cw',14)} Sincronizar Jogadores</button>
                <p style="font-size:0.65rem;color:#475569;text-align:center;margin:0">Pinte o mapa e clique Sincronizar para salvar.</p>
                <div style="border-top:1px solid #1e293b;padding-top:1rem;font-size:0.72rem;color:#64748b">
                    <p style="margin:0 0 4px"><b>Legenda:</b></p>
                    <p style="margin:0 0 2px">⬛ Escuro = Não explorado</p>
                    <p style="margin:0">🟩 Verde = Visível aos jogadores</p>
                </div>
                <button class="arq-btn arq-btn-red arq-btn-sm" id="arq-fog-reset">Redefinir Buffer</button>
            </div>
        </div>
        <div style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;background:#020617;cursor:crosshair;" id="arq-fogmap-area">
            <div id="arq-map-fog" style="position:absolute;inset:0;"></div>
        </div>`;

    _attachMapToContainer('arq-map-fog');
    _destroyFogCanvas();

    const revealBtn = document.getElementById('arq-fog-reveal');
    const hideBtn   = document.getElementById('arq-fog-hide');

    const updateToolUI = () => {
        revealBtn.className = `arq-btn arq-btn-sm ${state.fogToolMode==='reveal'?'arq-btn-green':'arq-btn-gray'}`;
        revealBtn.style.flex = '1';
        hideBtn.className = `arq-btn arq-btn-sm ${state.fogToolMode==='hide'?'arq-btn-red':'arq-btn-gray'}`;
        hideBtn.style.flex = '1';
    };

    revealBtn.onclick = () => { state.fogToolMode = 'reveal'; updateToolUI(); };
    hideBtn.onclick   = () => { state.fogToolMode = 'hide';   updateToolUI(); };

    document.getElementById('arq-fogmap-sess').onchange = e => {
        const sess = state.data.sessions.find(s => s.id === e.target.value);
        state.fogSelectedSession = sess || null;
        if (sess) {
            state.fogLocalRevealed = new Set(sess.revealedHexes || []);
            document.getElementById('arq-fogmap-tools').style.display = 'flex';
            _initFogCanvas();
            _setupFogMouseEvents();
        } else {
            _destroyFogCanvas();
            document.getElementById('arq-fogmap-tools').style.display = 'none';
        }
    };

    document.getElementById('arq-fog-sync').onclick = async () => {
        if (!state.fogSelectedSession) return;
        try {
            await setDoc(doc(db, COLS.SESSIONS, state.fogSelectedSession.id),
                { revealedHexes: Array.from(state.fogLocalRevealed) }, { merge: true });
            _showAlert('Visão dos jogadores sincronizada!');
        } catch (e) { _showAlert('Erro: ' + e.message); }
    };

    document.getElementById('arq-fog-reset').onclick = () =>
        _showConfirm('Ocultar todo o mapa novamente?', () => {
            state.fogLocalRevealed.clear();
            _redrawFog();
        });
}

function _setupFogMouseEvents() {
    const map = state.mapInstance;
    if (!map) return;
    let painting = false;

    const paint = (e) => {
        if (!painting || !state.fogSelectedSession) return;
        const ll = e.latlng;
        const hexId = _pixelToHexId(ll.lat, ll.lng);
        let changed = false;
        if (state.fogToolMode === 'reveal') {
            if (!state.fogLocalRevealed.has(hexId)) { state.fogLocalRevealed.add(hexId); changed = true; }
        } else {
            if (state.fogLocalRevealed.has(hexId)) { state.fogLocalRevealed.delete(hexId); changed = true; }
        }
        if (changed) _redrawFog();
    };

    map.on('mousedown', e => { painting = true; paint(e); });
    map.on('mousemove', paint);
    map.on('mouseup', () => { painting = false; });
    map.getContainer().addEventListener('mouseleave', () => { painting = false; });
}

// ─── PÁGINA: LOCAIS ───────────────────────────────────────────────────────────
function _renderLocations(main) {
    const tabs = ['basic','infra','society','conflicts'];
    main.innerHTML = `
        <div class="arq-sidebar">
            <div class="arq-section" style="flex-shrink:0">
                <button class="arq-btn arq-btn-green" style="width:100%" id="arq-loc-new">${_icon('plus',14)} Novo Local</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.5rem" id="arq-loc-list"></div>
        </div>
        <div style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;">
            <div id="arq-map-locations" style="position:absolute;inset:0;"></div>
            <div id="arq-loc-form-wrap"></div>
        </div>`;

    _attachMapToContainer('arq-map-locations');

    const renderList = () => {
        const list = document.getElementById('arq-loc-list');
        list.innerHTML = state.data.locations.map(l=>`
            <div class="arq-list-item${state.editing?.id===l.id?' active':''}" data-locid="${l.id}">
                <div style="font-weight:600;font-size:0.85rem">${l.name||'Sem nome'}</div>
                <div style="font-size:0.7rem;color:#64748b">${l.type||''}</div>
            </div>`).join('');
        list.querySelectorAll('[data-locid]').forEach(el =>
            el.addEventListener('click', () => {
                state.editing = state.data.locations.find(x=>x.id===el.dataset.locid)||null;
                renderList(); renderForm();
            }));
    };

    const renderForm = () => {
        const wrap = document.getElementById('arq-loc-form-wrap');
        if (!state.editing) { wrap.innerHTML=''; return; }
        const ed = state.editing;
        const curTab = state.editorTab || 'basic';

        wrap.innerHTML = `
            <div class="arq-floating" style="width:26rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                    <h3 style="color:#f59e0b;font-family:'Cinzel',serif;margin:0;font-size:1.1rem">${ed.id?'Editar':'Criar'} Local</h3>
                    <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-loc-close">✕</button>
                </div>
                <div style="display:flex;gap:2px;border-bottom:1px solid #1e293b;margin-bottom:1rem">
                    ${tabs.map(t=>`<button class="arq-etab${curTab===t?' active':''}" data-tab="${t}">${t}</button>`).join('')}
                </div>
                ${curTab==='basic'?`
                <div style="display:flex;flex-direction:column;gap:0.75rem">
                    <div><label class="arq-label">Nome</label><input class="arq-input" id="arq-loc-name" value="${ed.name||''}" /></div>
                    <div><label class="arq-label">Tipo</label>
                        <select class="arq-input" id="arq-loc-type">
                            ${['Cidade','Vila','Ruína','Capital','Ponto de Interesse'].map(t=>`<option${ed.type===t?' selected':''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div><label class="arq-label">População</label><input type="number" class="arq-input" id="arq-loc-pop" value="${ed.pop||''}" /></div>
                    <div><label class="arq-label">Descrição</label><textarea class="arq-input" id="arq-loc-desc" rows="4" style="resize:vertical">${ed.desc||''}</textarea></div>
                    <div style="font-size:0.72rem;color:#475569">📍 Clique no mapa para posicionar. Pos: ${ed.x?`${(ed.x).toFixed(0)}, ${(ed.y).toFixed(0)}`:'não definida'}</div>
                </div>`:`
                <textarea class="arq-input" id="arq-loc-extra" rows="18" style="resize:vertical">${ed[curTab]||''}</textarea>`}
                <div style="display:flex;gap:0.5rem;margin-top:1rem">
                    <button class="arq-btn arq-btn-green" style="flex:1" id="arq-loc-save">Salvar</button>
                    ${ed.id?`<button class="arq-btn arq-btn-red arq-btn-sm" id="arq-loc-del">${_icon('trash',14)}</button>`:''}
                </div>
            </div>`;

        wrap.querySelectorAll('.arq-etab').forEach(btn =>
            btn.addEventListener('click', () => { state.editorTab = btn.dataset.tab; _saveFormToState('loc'); renderForm(); }));

        document.getElementById('arq-loc-close').onclick = () => { state.editing=null; renderList(); renderForm(); };

        document.getElementById('arq-loc-save').onclick = async () => {
            _saveFormToState('loc');
            const ed = state.editing;
            const data = { name:ed.name||'', type:ed.type||'Cidade', pop:parseInt(ed.pop)||0,
                desc:ed.desc||'', infra:ed.infra||'', society:ed.society||'', conflicts:ed.conflicts||'',
                x:ed.x||0, y:ed.y||0 };
            if (ed.id) await updateDoc(doc(db, COLS.LOCATIONS, ed.id), data);
            else { const r = await addDoc(collection(db, COLS.LOCATIONS), data); state.editing.id = r.id; }
            _showAlert('Local salvo!');
        };

        if (ed.id) {
            document.getElementById('arq-loc-del').onclick = () =>
                _showConfirm('Excluir local?', async () => {
                    await deleteDoc(doc(db, COLS.LOCATIONS, ed.id));
                    state.editing = null; renderList(); renderForm();
                });
        }
    };

    // Clique no mapa define posição
    const clickHandler = (e) => {
        if (state.editing) {
            state.editing.x = e.latlng.lng; state.editing.y = e.latlng.lat;
            renderForm();
        }
    };
    state.mapInstance.on('click', clickHandler);

    document.getElementById('arq-loc-new').onclick = () => {
        state.editing = {}; state.editorTab = 'basic'; renderList(); renderForm();
    };
    renderList(); renderForm();
}

function _saveFormToState(prefix) {
    if (prefix === 'loc') {
        const name = document.getElementById('arq-loc-name');
        const type = document.getElementById('arq-loc-type');
        const pop  = document.getElementById('arq-loc-pop');
        const desc = document.getElementById('arq-loc-desc');
        const extra = document.getElementById('arq-loc-extra');
        const curTab = state.editorTab || 'basic';
        if (name) state.editing.name = name.value;
        if (type) state.editing.type = type.value;
        if (pop)  state.editing.pop  = pop.value;
        if (desc) state.editing.desc = desc.value;
        if (extra) state.editing[curTab] = extra.value;
    }
}

// ─── PÁGINA: ROTAS ────────────────────────────────────────────────────────────
function _renderRoutes(main) {
    main.innerHTML = `
        <div class="arq-sidebar">
            <div class="arq-section" style="flex-shrink:0;display:flex;gap:0.5rem">
                <button class="arq-btn arq-btn-primary" style="flex:1" id="arq-route-new">${_icon('plus',14)} Nova Rota</button>
                <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-route-types">${_icon('settings',14)}</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.5rem" id="arq-route-list"></div>
        </div>
        <div style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;">
            <div id="arq-map-routes" style="position:absolute;inset:0;"></div>
            <div id="arq-route-form-wrap"></div>
        </div>`;

    _attachMapToContainer('arq-map-routes');

    const types = () => Object.entries(state.data.routeTypes).map(([id,t])=>({id,...t}));

    const renderList = () => {
        const list = document.getElementById('arq-route-list');
        list.innerHTML = state.data.routes.map(r => {
            const t = state.data.routeTypes[r.typeId];
            return `<div class="arq-list-item${state.editing?.id===r.id?' active':''}" data-rid="${r.id}" style="border-left-color:${t?.color||'#fff'}">
                <div style="font-weight:600;font-size:0.85rem">${r.name||'Sem nome'}</div>
                <div style="font-size:0.7rem;color:#64748b">${r.duration||0}h · ${r.points?.length||0} pts</div>
            </div>`;
        }).join('');
        list.querySelectorAll('[data-rid]').forEach(el => el.addEventListener('click', () => {
            const r = state.data.routes.find(x=>x.id===el.dataset.rid);
            state.editing = r ? {...r} : null;
            state.tempPoints = r?.points ? [...r.points] : [];
            renderList(); renderTempLayer(); renderForm();
        }));
    };

    const renderTempLayer = () => {
        const tl = state.layers.temp; tl.clearLayers();
        if (state.tempPoints.length > 0) {
            L.polyline(state.tempPoints.map(p=>[p.lat,p.lng]),{color:'yellow',dashArray:'5,5',weight:2.5}).addTo(tl);
            state.tempPoints.forEach(p => L.circleMarker([p.lat,p.lng],{radius:4,color:'yellow',fillColor:'black',fillOpacity:1}).addTo(tl));
        }
    };

    const renderForm = () => {
        const wrap = document.getElementById('arq-route-form-wrap');
        if (!state.editing) { wrap.innerHTML=''; return; }
        const ed = state.editing;
        const typesList = types();
        wrap.innerHTML = `
            <div class="arq-floating" style="width:22rem">
                <h4 style="color:#f59e0b;margin:0 0 1rem">Rota</h4>
                <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1rem">
                    <div><label class="arq-label">Nome</label><input class="arq-input" id="arq-route-name" value="${ed.name||''}" /></div>
                    <div><label class="arq-label">Tipo de Rota</label>
                        <select class="arq-input" id="arq-route-type">
                            <option value="">Selecione...</option>
                            ${typesList.map(t=>`<option value="${t.id}"${ed.typeId===t.id?' selected':''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div><label class="arq-label">Duração (min reais)</label><input type="number" class="arq-input" id="arq-route-dur" value="${ed.duration||''}" /></div>
                    <div><label class="arq-label">NPC Associado</label>
                        <select class="arq-input" id="arq-route-npc">
                            <option value="">Nenhum</option>
                            ${state.data.npcs.map(n=>`<option value="${n.id}"${ed.npcId===n.id?' selected':''}>${n.nome||n.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;background:#1e293b;padding:0.5rem 0.75rem;border-radius:6px;margin-bottom:1rem">
                    <span style="font-size:0.75rem;color:#94a3b8">Pontos: <b style="color:white">${state.tempPoints.length}</b></span>
                    <button class="arq-btn arq-btn-red arq-btn-sm" id="arq-route-clear">Limpar</button>
                </div>
                <div style="display:flex;gap:0.5rem">
                    <button class="arq-btn arq-btn-green" style="flex:1" id="arq-route-save">Salvar</button>
                    <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-route-cancel">✕</button>
                </div>
                ${ed.id?`<button class="arq-btn arq-btn-red arq-btn-sm" style="width:100%;margin-top:0.5rem" id="arq-route-del">Excluir</button>`:''}
            </div>`;

        document.getElementById('arq-route-cancel').onclick = () => { state.editing=null; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); };
        document.getElementById('arq-route-clear').onclick = () => { state.tempPoints=[]; renderTempLayer(); renderForm(); };
        document.getElementById('arq-route-save').onclick = async () => {
            if (state.tempPoints.length < 2) { _showAlert('Mínimo 2 pontos na rota.'); return; }
            const data = {
                name: document.getElementById('arq-route-name').value,
                typeId: document.getElementById('arq-route-type').value,
                duration: parseInt(document.getElementById('arq-route-dur').value)||0,
                npcId: document.getElementById('arq-route-npc').value,
                points: state.tempPoints
            };
            if (ed.id) await updateDoc(doc(db, COLS.ROUTES, ed.id), data);
            else await addDoc(collection(db, COLS.ROUTES), data);
            state.editing=null; state.tempPoints=[];
            renderTempLayer(); renderList(); renderForm();
        };
        if (ed.id) document.getElementById('arq-route-del').onclick = () =>
            _showConfirm('Excluir rota?', async() => { await deleteDoc(doc(db, COLS.ROUTES, ed.id)); state.editing=null; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); });
    };

    const clickH = (e) => { if (state.editing) { state.tempPoints.push({lat:e.latlng.lat,lng:e.latlng.lng}); renderTempLayer(); renderForm(); } };
    state.mapInstance.on('click', clickH);

    document.getElementById('arq-route-new').onclick = () => { state.editing={}; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); };
    document.getElementById('arq-route-types').onclick = () => _renderRouteTypesModal();
    renderList();
}

function _renderRouteTypesModal() {
    const types = Object.entries(state.data.routeTypes).map(([id,t])=>({id,...t}));
    _renderModal(`
        <div class="arq-modal-overlay" id="arq-modal">
          <div class="arq-modal-box" style="max-width:640px;width:95%;max-height:80vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                <h3 style="color:#f59e0b;margin:0">Tipos de Rota</h3>
                <button class="arq-btn arq-btn-gray arq-btn-sm" onclick="document.getElementById('arq-modal').remove()">✕</button>
            </div>
            <div id="arq-rtypes-list">
                ${types.map(t=>`
                <div style="background:#1e293b;padding:0.75rem;border-radius:6px;margin-bottom:0.5rem;border:1px solid #334155">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
                        <div style="width:20px;height:20px;border-radius:50%;background:${t.color||'#fff'};flex-shrink:0"></div>
                        <span style="font-weight:600;flex:1">${t.name}</span>
                        <button class="arq-btn arq-btn-red arq-btn-sm" onclick="(async()=>{await import('../core/firebase.js').then(f=>f.deleteDoc(f.doc(f.db,'rpg_route_types','${t.id}')))})()">🗑</button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${ROUTE_ICONS_PRESETS.map(p=>`<div style="padding:4px 8px;border:1px solid ${t.icon===p.icon?'#f59e0b':'#334155'};border-radius:4px;cursor:pointer;background:${t.icon===p.icon?'#1c1400':'#0f172a'};font-size:0.7rem;color:${t.icon===p.icon?'#f59e0b':'#64748b'}" onclick="(async()=>{const {db,doc,updateDoc}=await import('../core/firebase.js');await updateDoc(doc(db,'rpg_route_types','${t.id}'),{icon:'${p.icon}'});})()" title="${p.name}">${p.id}</div>`).join('')}
                    </div>
                </div>`).join('')}
            </div>
            <form style="display:flex;gap:0.5rem;margin-top:1rem;background:#1e293b;padding:0.75rem;border-radius:6px" id="arq-rtype-form">
                <input name="name" class="arq-input" placeholder="Novo Tipo" required style="flex:1" />
                <input name="color" type="color" value="#ffffff" style="width:40px;height:38px;border:none;background:none;cursor:pointer;border-radius:4px" />
                <button class="arq-btn arq-btn-green">Adicionar</button>
            </form>
          </div>
        </div>`);
    document.getElementById('arq-rtype-form').onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await addDoc(collection(db, COLS.ROUTE_TYPES), { name:fd.get('name'), color:fd.get('color'), icon:'route' });
        e.target.reset();
        _renderRouteTypesModal();
    };
}

// ─── PÁGINA: EVENTOS ──────────────────────────────────────────────────────────
function _renderEvents(main) {
    main.innerHTML = `
        <div class="arq-sidebar" style="overflow-y:auto">
            <div class="arq-section" style="flex-shrink:0">
                <button class="arq-btn arq-btn-purple" style="width:100%" id="arq-ev-new">${_icon('plus',14)} Novo Evento</button>
            </div>
            <div style="padding:0.5rem" id="arq-ev-list"></div>
        </div>
        <div style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;">
            <div id="arq-map-events" style="position:absolute;inset:0;"></div>
            <div id="arq-ev-form-wrap"></div>
        </div>`;

    _attachMapToContainer('arq-map-events');

    const renderList = () => {
        const list = document.getElementById('arq-ev-list');
        list.innerHTML = state.data.events.map(ev=>`
            <div class="arq-list-item${state.editing?.id===ev.id?' active':''}" data-evid="${ev.id}" style="border-left-color:${ev.color||'purple'}">
                <div style="font-weight:600;font-size:0.85rem">${ev.name||'Sem nome'}</div>
                <div style="font-size:0.7rem;color:#64748b">${ev.chance||0}% · ${ev.minDuration||1}-${ev.maxDuration||1} dias</div>
            </div>`).join('');
        list.querySelectorAll('[data-evid]').forEach(el => el.addEventListener('click', () => {
            state.editing = state.data.events.find(x=>x.id===el.dataset.evid) || null;
            renderList(); renderForm();
        }));
    };

    const renderForm = () => {
        const wrap = document.getElementById('arq-ev-form-wrap');
        if (!state.editing) { wrap.innerHTML=''; return; }
        const ed = state.editing;
        wrap.innerHTML = `
            <div class="arq-floating" style="width:22rem;max-height:80vh;overflow-y:auto">
                <h4 style="color:#a855f7;margin:0 0 1rem">Configurar Evento</h4>
                <div style="display:flex;flex-direction:column;gap:0.6rem">
                    <div><label class="arq-label">Nome</label><input class="arq-input" id="arq-ev-name" value="${ed.name||''}" /></div>
                    <div class="arq-grid-2">
                        <div><label class="arq-label">Chance (%)</label><input type="number" class="arq-input" id="arq-ev-chance" value="${ed.chance||10}" /></div>
                        <div><label class="arq-label">Cor</label><input type="color" class="arq-input" id="arq-ev-color" value="${ed.color||'#ef4444'}" style="padding:2px;height:38px" /></div>
                    </div>
                    <div class="arq-grid-2">
                        <div><label class="arq-label">Min Dias</label><input type="number" class="arq-input" id="arq-ev-min" value="${ed.minDuration||1}" /></div>
                        <div><label class="arq-label">Max Dias</label><input type="number" class="arq-input" id="arq-ev-max" value="${ed.maxDuration||1}" /></div>
                    </div>
                    <div><label class="arq-label">Raio</label><input type="range" min="50" max="2000" id="arq-ev-radius" value="${ed.radius||150}" style="width:100%;accent-color:#a855f7" /></div>
                    <div><label class="arq-label">Ícone</label>
                        <div class="arq-icon-grid">
                            ${EVENT_ICONS.map(ic=>`<div class="arq-icon-opt${ed.icon===ic?' active':''}" data-eicon="${ic}" title="${ic}">${_icon(ic,15)}</div>`).join('')}
                        </div>
                    </div>
                    <div><label class="arq-label">Descrição</label><textarea class="arq-input" id="arq-ev-desc" rows="3" style="resize:vertical">${ed.desc||''}</textarea></div>
                    <div style="font-size:0.72rem;color:#475569">📍 Clique no mapa para posicionar</div>
                </div>
                <div style="display:flex;gap:0.5rem;margin-top:1rem">
                    <button class="arq-btn arq-btn-green" style="flex:1" id="arq-ev-save">Salvar</button>
                    <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-ev-cancel">✕</button>
                </div>
                ${ed.id?`<button class="arq-btn arq-btn-red arq-btn-sm" style="width:100%;margin-top:0.5rem" id="arq-ev-del">Excluir</button>`:''}
            </div>`;

        wrap.querySelectorAll('[data-eicon]').forEach(el =>
            el.addEventListener('click', () => { state.editing.icon = el.dataset.eicon; renderForm(); }));
        document.getElementById('arq-ev-cancel').onclick = () => { state.editing=null; renderList(); renderForm(); };
        document.getElementById('arq-ev-save').onclick = async () => {
            const data = {
                name: document.getElementById('arq-ev-name').value,
                chance: parseInt(document.getElementById('arq-ev-chance').value)||0,
                color: document.getElementById('arq-ev-color').value,
                minDuration: parseInt(document.getElementById('arq-ev-min').value)||1,
                maxDuration: parseInt(document.getElementById('arq-ev-max').value)||1,
                radius: parseInt(document.getElementById('arq-ev-radius').value)||150,
                icon: state.editing.icon||'zap',
                desc: document.getElementById('arq-ev-desc').value,
                x: state.editing.x||0, y: state.editing.y||0, isActive: true
            };
            if (ed.id) await updateDoc(doc(db, COLS.EVENTS, ed.id), data);
            else await addDoc(collection(db, COLS.EVENTS), data);
            state.editing=null; renderList(); renderForm();
        };
        if (ed.id) document.getElementById('arq-ev-del').onclick = () =>
            _showConfirm('Excluir evento?', async()=>{ await deleteDoc(doc(db,COLS.EVENTS,ed.id)); state.editing=null; renderList(); renderForm(); });
    };

    state.mapInstance.on('click', e => { if (state.editing) { state.editing.x=e.latlng.lng; state.editing.y=e.latlng.lat; renderForm(); } });
    document.getElementById('arq-ev-new').onclick = () => { state.editing={radius:150,color:'#ef4444',icon:'zap',chance:10}; renderList(); renderForm(); };
    renderList();
}

// ─── PÁGINA: ENCONTROS ISOLADOS ───────────────────────────────────────────────
function _renderIsolated(main) {
    main.innerHTML = `
        <div class="arq-sidebar">
            <div class="arq-section" style="flex-shrink:0">
                <button class="arq-btn arq-btn-red" style="width:100%" id="arq-iso-new">${_icon('plus',14)} Novo Encontro</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.5rem" id="arq-iso-list"></div>
        </div>
        <div style="flex:1;min-height:0;min-width:0;position:relative;overflow:hidden;">
            <div id="arq-map-isolated" style="position:absolute;inset:0;"></div>
            <div id="arq-iso-form-wrap"></div>
        </div>`;

    _attachMapToContainer('arq-map-isolated');

    const renderList = () => {
        const list = document.getElementById('arq-iso-list');
        list.innerHTML = state.data.isolated.map(i=>`
            <div class="arq-list-item${state.editing?.id===i.id?' active':''}" data-isoid="${i.id}" style="border-left-color:#ef4444">
                <div style="font-weight:600;font-size:0.85rem">${i.name||'Sem nome'}</div>
                <div style="font-size:0.7rem;color:#64748b">${i.spots?.length||0} locais</div>
            </div>`).join('');
        list.querySelectorAll('[data-isoid]').forEach(el => el.addEventListener('click', () => {
            const found = state.data.isolated.find(x=>x.id===el.dataset.isoid);
            state.editing = found ? {...found} : null;
            state.tempPoints = found?.spots ? [...found.spots] : [];
            renderList(); renderTempLayer(); renderForm();
        }));
    };

    const renderTempLayer = () => {
        const tl = state.layers.temp; tl.clearLayers();
        state.tempPoints.forEach(p => {
            const svg = _getIconSvg('sword','#ef4444',18);
            const html = `<div style="background:#450a0a;border:2px solid #ef4444;border-radius:50%;padding:5px;box-shadow:0 0 16px rgba(239,68,68,0.7)">${svg}</div>`;
            L.marker([p.lat,p.lng],{icon:L.divIcon({className:'custom-div-icon',html,iconSize:[32,32]})}).addTo(tl);
        });
    };

    const renderForm = () => {
        const wrap = document.getElementById('arq-iso-form-wrap');
        if (!state.editing) { wrap.innerHTML=''; return; }
        const ed = state.editing;
        wrap.innerHTML = `
            <div class="arq-floating" style="width:22rem">
                <h4 style="color:#ef4444;margin:0 0 1rem">Encontro Isolado</h4>
                <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:0.75rem">
                    <div><label class="arq-label">Nome</label><input class="arq-input" id="arq-iso-name" value="${ed.name||''}" /></div>
                    <div><label class="arq-label">Descrição</label><textarea class="arq-input" id="arq-iso-desc" rows="2">${ed.desc||''}</textarea></div>
                    <div><label class="arq-label">Frequência (h)</label><input type="number" class="arq-input" id="arq-iso-freq" value="${ed.frequency||''}" /></div>
                    <div><label class="arq-label">NPC (Opcional)</label>
                        <select class="arq-input" id="arq-iso-npc">
                            <option value="">Nenhum</option>
                            ${state.data.npcs.map(n=>`<option value="${n.id}"${ed.npcId===n.id?' selected':''}>${n.nome||n.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="background:#1e293b;padding:0.5rem;border-radius:6px;max-height:8rem;overflow-y:auto;margin-bottom:0.75rem">
                    <div style="font-size:0.65rem;color:#64748b;font-weight:600;margin-bottom:4px">Locais (${state.tempPoints.length}) — clique no mapa</div>
                    ${state.tempPoints.map((p,i)=>`
                        <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.72rem;margin-bottom:2px">
                            <span style="color:#94a3b8;width:16px">${i+1}</span>
                            <input type="number" value="${p.chance||10}" style="width:3rem;background:#020617;border:1px solid #475569;color:#fbbf24;border-radius:4px;padding:1px 4px;text-align:center" data-idx="${i}" class="arq-iso-chance" />%
                            <button style="margin-left:auto;color:#ef4444;background:none;border:none;cursor:pointer;font-size:12px" data-del="${i}">✕</button>
                        </div>`).join('')}
                </div>
                <div style="display:flex;gap:0.5rem">
                    <button class="arq-btn arq-btn-green" style="flex:1" id="arq-iso-save">Salvar</button>
                    <button class="arq-btn arq-btn-gray arq-btn-sm" id="arq-iso-cancel">✕</button>
                </div>
                ${ed.id?`<button class="arq-btn arq-btn-red arq-btn-sm" style="width:100%;margin-top:0.5rem" id="arq-iso-del">Excluir</button>`:''}
            </div>`;

        wrap.querySelectorAll('.arq-iso-chance').forEach(inp =>
            inp.addEventListener('change', e => { state.tempPoints[+e.target.dataset.idx].chance = parseInt(e.target.value)||10; }));
        wrap.querySelectorAll('[data-del]').forEach(btn =>
            btn.addEventListener('click', e => { state.tempPoints.splice(+e.target.dataset.del,1); renderTempLayer(); renderForm(); }));
        document.getElementById('arq-iso-cancel').onclick = () => { state.editing=null; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); };
        document.getElementById('arq-iso-save').onclick = async () => {
            if (!state.tempPoints.length) { _showAlert('Mínimo 1 local.'); return; }
            const data = { name:document.getElementById('arq-iso-name').value, desc:document.getElementById('arq-iso-desc').value,
                frequency:parseInt(document.getElementById('arq-iso-freq').value)||0, npcId:document.getElementById('arq-iso-npc').value,
                spots: state.tempPoints.map(p=>({lat:p.lat,lng:p.lng,chance:p.chance||10})) };
            if (ed.id) await updateDoc(doc(db,COLS.ISOLATED,ed.id),data);
            else await addDoc(collection(db,COLS.ISOLATED),data);
            state.editing=null; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm();
        };
        if (ed.id) document.getElementById('arq-iso-del').onclick = () =>
            _showConfirm('Excluir encontro?', async()=>{ await deleteDoc(doc(db,COLS.ISOLATED,ed.id)); state.editing=null; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); });
    };

    state.mapInstance.on('click', e => { if (state.editing) { state.tempPoints.push({lat:e.latlng.lat,lng:e.latlng.lng,chance:10}); renderTempLayer(); renderForm(); } });
    document.getElementById('arq-iso-new').onclick = () => { state.editing={}; state.tempPoints=[]; renderTempLayer(); renderList(); renderForm(); };
    renderList();
}

// ─── PÁGINA: DUNGEONS ─────────────────────────────────────────────────────────
function _renderDungeons(main) {
    main.innerHTML = `
        <div class="arq-sidebar">
            <div class="arq-tab-bar">
                <button class="arq-etab${state.dungeonTab==='create'?' active':''}" data-dtab="create">Criar/Editar</button>
                <button class="arq-etab${state.dungeonTab==='manage'?' active':''}" data-dtab="manage">Gerenciar</button>
            </div>
            <div class="arq-section" style="flex-shrink:0">
                ${state.dungeonTab==='create'?`<button class="arq-btn arq-btn-primary" style="width:100%" id="arq-dun-new">${_icon('plus',14)} Nova Dungeon</button>`:''}
            </div>
            <div style="flex:1;overflow-y:auto;padding:0.5rem" id="arq-dun-list"></div>
        </div>
        <div style="flex:1;position:relative;overflow-y:auto;min-height:0;" id="arq-dun-panel">
            <div id="arq-map-dungeons" style="position:absolute;inset:0;"></div>
        </div>`;

    main.querySelectorAll('[data-dtab]').forEach(btn => btn.addEventListener('click', () => {
        state.dungeonTab = btn.dataset.dtab; state.editing=null; state.manageSelection=null;
        _renderDungeons(main);
    }));

    _attachMapToContainer('arq-map-dungeons');

    const renderList = () => {
        const list = document.getElementById('arq-dun-list');
        list.innerHTML = state.data.dungeons.map(d=>`
            <div class="arq-list-item${(state.editing?.id===d.id||state.manageSelection?.id===d.id)?' active':''}" data-dunid="${d.id}">
                <div style="font-weight:600;font-size:0.85rem">${d.name||'Sem nome'}</div>
                <div style="font-size:0.7rem;color:#64748b">${d.floors||1} andares · Runs: ${d.runCount||0}</div>
            </div>`).join('');
        list.querySelectorAll('[data-dunid]').forEach(el => el.addEventListener('click', () => {
            const d = state.data.dungeons.find(x=>x.id===el.dataset.dunid);
            if (state.dungeonTab==='create') { state.editing=d?{...d}:null; _renderDungeonEditor(); }
            else { state.manageSelection=d?{...d}:null; _renderDungeonManager(); }
            renderList();
        }));
    };

    if (state.dungeonTab==='create') {
        document.getElementById('arq-dun-new').onclick = () => {
            state.editing={difficulty:1,floors:1,rewards:{basic:{},int:{},adv:{}},passes:[]};
            state.editorTab='general';
            _renderDungeonEditor(); renderList();
        };
    }
    if (state.editing) _renderDungeonEditor();
    if (state.manageSelection) _renderDungeonManager();
    renderList();
}

function _renderDungeonEditor() {
    const panel = document.getElementById('arq-dun-panel');
    if (!panel || !state.editing) return;
    const ed = state.editing;
    const curTab = state.editorTab || 'general';
    const mapDiv = document.getElementById('arq-map-dungeons');

    panel.innerHTML = `
        <div style="padding:1.5rem;max-width:860px;margin:0 auto" id="arq-dun-editor">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1.5rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #1e293b">
                <h2 style="color:#f59e0b;font-family:'Cinzel',serif;margin:0">${ed.id?'Editar':'Criar'} Dungeon</h2>
                <div style="display:flex;gap:0.5rem">
                    <span style="font-size:0.7rem;color:${ed.x?'#4ade80':'#f59e0b'};align-self:center">${ed.x?`📍 ${(ed.x).toFixed(0)},${(ed.y).toFixed(0)}`:'Clique no mapa para posicionar'}</span>
                </div>
            </div>
            ${!ed.x?`<div style="height:200px;border:2px dashed #334155;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.85rem;margin-bottom:1.5rem" id="arq-dun-mini-map">
                Clique no mapa para posicionar
            </div>`:''}
            <div style="display:flex;gap:4px;border-bottom:1px solid #1e293b;margin-bottom:1.5rem;overflow-x:auto">
                ${['general','monsters','passes','rewards'].map(t=>`<button class="arq-etab${curTab===t?' active':''}" data-detab="${t}">${t}</button>`).join('')}
            </div>
            <div id="arq-dun-tab-content" style="min-height:250px"></div>
            <div style="display:flex;gap:0.75rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #1e293b">
                <button class="arq-btn arq-btn-green" style="flex:1" id="arq-dun-save">Salvar Dungeon</button>
                <button class="arq-btn arq-btn-cyan arq-btn-sm" id="arq-dun-clone">${_icon('copy',13)} Clonar</button>
                ${ed.id?`<button class="arq-btn arq-btn-red arq-btn-sm" id="arq-dun-del">Excluir</button>`:''}
            </div>
          </div>
        </div>`;

    panel.querySelectorAll('[data-detab]').forEach(btn => btn.addEventListener('click', () => {
        state.editorTab = btn.dataset.detab; _renderDungeonEditorTab();
    }));

    _renderDungeonEditorTab();

    document.getElementById('arq-dun-save').onclick = async () => {
        if (!ed.name) { _showAlert('Nome obrigatório.'); return; }
        const data = {...ed, x:ed.x||0, y:ed.y||0, createdDay: ed.createdDay||state.data.worldState.day||1};
        delete data.id;
        if (ed.id) await updateDoc(doc(db,COLS.DUNGEONS,ed.id), data);
        else await addDoc(collection(db,COLS.DUNGEONS), data);
        _showAlert('Dungeon salva!');
    };
    document.getElementById('arq-dun-clone').onclick = () => {
        state.editing = {...ed, id:undefined, name:`${ed.name||''} (Cópia)`, x:null, y:null, runCount:0};
        _renderDungeonEditor();
    };
    if (ed.id) document.getElementById('arq-dun-del').onclick = () =>
        _showConfirm('Excluir dungeon?', async()=>{ await deleteDoc(doc(db,COLS.DUNGEONS,ed.id)); state.editing=null; _renderDungeons(document.getElementById('arq-main')); });

    // Clique no mapa
    state.mapInstance.on('click', e => { if (state.editing) { state.editing.x=e.latlng.lng; state.editing.y=e.latlng.lat; _renderDungeonEditor(); } });
}

function _renderDungeonEditorTab() {
    const content = document.getElementById('arq-dun-tab-content');
    if (!content) return;
    const ed = state.editing;
    const curTab = state.editorTab || 'general';

    if (curTab==='general') {
        content.innerHTML = `
            <div class="arq-grid-2" style="gap:1rem">
                <div style="display:flex;flex-direction:column;gap:0.75rem">
                    <div><label class="arq-label">Nome da Dungeon</label><input class="arq-input" id="arq-dun-name" value="${ed.name||''}" /></div>
                    <div class="arq-grid-2">
                        <div><label class="arq-label">Andares</label><input type="number" class="arq-input" id="arq-dun-floors" value="${ed.floors||1}" /></div>
                        <div><label class="arq-label">Dificuldade (1–5)</label><input type="number" min="1" max="5" class="arq-input" id="arq-dun-diff" value="${ed.difficulty||1}" /></div>
                    </div>
                    <div><label class="arq-label">Inimigos Base/Andar</label><input type="number" class="arq-input" id="arq-dun-enemies" value="${ed.baseEnemies||5}" /></div>
                </div>
                <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1rem;font-size:0.8rem;color:#64748b">
                    <p>Use <b style="color:#e2e8f0">Monstros</b> para os inimigos.</p>
                    <p>Use <b style="color:#e2e8f0">Passes</b> para itens de entrada.</p>
                    <p>Use <b style="color:#e2e8f0">Recompensas</b> para o loot dos baús.</p>
                </div>
            </div>`;
        content.querySelectorAll('input').forEach(inp => inp.addEventListener('change', e => {
            const field = {name:'name',floors:'floors',diff:'difficulty',enemies:'baseEnemies'}[e.target.id.replace('arq-dun-','')];
            if (field) state.editing[field] = ['floors','diff','enemies'].includes(e.target.id.replace('arq-dun-','')) ? parseInt(e.target.value)||1 : e.target.value;
        }));
    }
    else if (curTab==='monsters') {
        content.innerHTML = `
            <div style="max-height:380px;overflow-y:auto;border:1px solid #334155;border-radius:6px;background:#020617">
                ${state.data.monsters.map(m=>`
                <label style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #1e293b;hover:bg:#1e293b">
                    <input type="checkbox" data-mid="${m.id}" ${(ed.selectedMonsters||[]).includes(m.id)?'checked':''} style="accent-color:#f59e0b;width:16px;height:16px" />
                    <img src="${m.imageUrls?.imagem1||''}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;background:#000;border:1px solid #334155" onerror="this.style.display='none'" />
                    <div>
                        <div style="font-weight:600;font-size:0.85rem">${m.nome||'?'}</div>
                        <div style="font-size:0.7rem;color:#94a3b8"><span style="color:#f87171">ATK ${m.atk_base||0}</span> · <span style="color:#60a5fa">DEF ${m.def_base||0}</span></div>
                    </div>
                </label>`).join('')}
            </div>`;
        content.querySelectorAll('[data-mid]').forEach(inp => inp.addEventListener('change', e => {
            const list = ed.selectedMonsters || [];
            if (e.target.checked) state.editing.selectedMonsters = [...list, e.target.dataset.mid];
            else state.editing.selectedMonsters = list.filter(id=>id!==e.target.dataset.mid);
        }));
    }
    else if (curTab==='passes') {
        content.innerHTML = `
            <h3 style="color:#22d3ee;margin:0 0 1rem;display:flex;align-items:center;gap:0.5rem">${_icon('key',18)} Itens de Acesso</h3>
            <button class="arq-btn arq-btn-cyan" style="width:100%;margin-bottom:1rem" id="arq-dun-add-pass">Adicionar Item de Acesso</button>
            <div id="arq-dun-passes">
                ${(ed.passes||[]).map((p,i)=>{
                    const item = state.data.items.find(x=>x.id===p.itemId);
                    return `<div style="background:#1e293b;padding:0.6rem 0.75rem;border-radius:6px;display:flex;align-items:center;gap:0.75rem;margin-bottom:0.4rem;border:1px solid #334155">
                        <div style="width:36px;height:36px;border-radius:4px;background:#020617;border:1px solid #475569;background-size:cover;background-position:center;flex-shrink:0" ${item?.imagemUrl?`style="background-image:url('${item.imagemUrl}')"`:''}></div>
                        <input class="arq-input" value="${p.name||''}" placeholder="Nome do Passe" data-pidx="${i}" style="flex:1" />
                        <button style="color:#ef4444;background:none;border:none;cursor:pointer" data-pdel="${i}">✕</button>
                    </div>`;
                }).join('')}
                ${!(ed.passes||[]).length?`<div style="text-align:center;color:#475569;font-size:0.8rem;padding:1rem">Nenhum passe — acesso livre.</div>`:''}
            </div>`;
        document.getElementById('arq-dun-add-pass').onclick = () =>
            _showPicker(state.data.items, item => {
                const passes = [...(ed.passes||[]), {itemId:item.id, name:item.nome, qty:1}];
                state.editing.passes = passes;
                _renderDungeonEditorTab();
            });
        content.querySelectorAll('[data-pidx]').forEach(inp => inp.addEventListener('change', e => {
            state.editing.passes[+e.target.dataset.pidx].name = e.target.value;
        }));
        content.querySelectorAll('[data-pdel]').forEach(btn => btn.addEventListener('click', e => {
            state.editing.passes.splice(+e.target.dataset.pdel, 1);
            _renderDungeonEditorTab();
        }));
    }
    else if (curTab==='rewards') {
        const tier = state.activeRewardTier || 'basic';
        const passKeys = (ed.passes||[]).map((_,i)=>`pass_${i}`);
        const allTiers = ['basic','int','adv',...passKeys];
        const items = state.data.items.filter(i=>!state.searchTerm||((i.nome||'').toLowerCase().includes(state.searchTerm.toLowerCase())));
        content.innerHTML = `
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:1rem">
                ${allTiers.map(t=>`<button class="arq-etab${tier===t?' active':''}" data-rtier="${t}">${t.startsWith('pass_')?`Loot: ${(ed.passes||[])[+t.replace('pass_','')]?.name||t}`:t}</button>`).join('')}
            </div>
            <input class="arq-input" placeholder="Buscar item..." id="arq-dun-search" value="${state.searchTerm||''}" style="margin-bottom:0.75rem" />
            <div class="arq-master-grid">
                ${items.map(item=>{
                    const qty = ed.rewards?.[tier]?.[item.id]||0;
                    return `<div class="arq-master-item${qty>0?' selected':''}">
                        <div class="arq-master-img" ${item.imagemUrl?`style="background-image:url('${item.imagemUrl}')"`:''}></div>
                        <div style="font-size:0.65rem;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;padding:0 2px" title="${item.nome||''}">${item.nome||''}</div>
                        <div class="arq-ctrl">
                            <button class="arq-ctrl-btn arq-ctrl-minus" data-iid="${item.id}" data-q="${qty-1}">−</button>
                            <input type="number" class="arq-ctrl-qty" value="${qty}" data-iid="${item.id}" />
                            <button class="arq-ctrl-btn arq-ctrl-plus" data-iid="${item.id}" data-q="${qty+1}">+</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        const setQty = (iid, q) => {
            if (!state.editing.rewards) state.editing.rewards = {};
            if (!state.editing.rewards[tier]) state.editing.rewards[tier] = {};
            if (q <= 0) delete state.editing.rewards[tier][iid];
            else state.editing.rewards[tier][iid] = q;
            _renderDungeonEditorTab();
        };
        content.querySelectorAll('[data-rtier]').forEach(b => b.addEventListener('click', () => { state.activeRewardTier=b.dataset.rtier; _renderDungeonEditorTab(); }));
        document.getElementById('arq-dun-search').addEventListener('input', e => { state.searchTerm=e.target.value; _renderDungeonEditorTab(); });
        content.querySelectorAll('.arq-ctrl-minus,.arq-ctrl-plus').forEach(b => b.addEventListener('click', () => setQty(b.dataset.iid, parseInt(b.dataset.q)||0)));
        content.querySelectorAll('.arq-ctrl-qty').forEach(inp => inp.addEventListener('change', e => setQty(e.target.dataset.iid, parseInt(e.target.value)||0)));
    }
}

function _renderDungeonManager() {
    const panel = document.getElementById('arq-dun-panel');
    if (!panel || !state.manageSelection) return;
    const d = state.manageSelection;
    const ws = state.data.worldState;
    const tier = _getDungeonTier(d.createdDay, ws.day||1);
    const tierKey = ['basic','int','adv'][tier];
    const tierName = ['Básica','Intermediária','Avançada'][tier];
    const tierColor = ['#cd7f32','#e2e8f0','#fbbf24'][tier];
    const rewards = d.rewards?.[tierKey]||{};

    panel.innerHTML = `
        <div style="padding:2rem;max-width:700px;margin:0 auto">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1.5rem">
            <div style="text-align:center;margin-bottom:2rem">
                <h2 style="color:#f59e0b;font-family:'Cinzel',serif;margin:0 0 0.5rem">${d.name}</h2>
                <div style="display:flex;justify-content:center;gap:1.5rem;font-size:0.8rem;color:#64748b">
                    <span>${d.floors} Andares</span><span>Dific. ${d.difficulty}</span><span>Runs: ${d.runCount||0}</span>
                </div>
            </div>
            <div style="background:#1e293b;padding:1rem;border-radius:8px;margin-bottom:1.5rem">
                <h4 style="color:#64748b;font-size:0.7rem;text-transform:uppercase;margin:0 0 0.75rem">Status Atual (Dia ${ws.day||1})</h4>
                <div class="arq-grid-2">
                    <div style="text-align:center"><div style="color:#64748b;font-size:0.72rem">Dificuldade</div><div style="font-size:1.4rem;font-weight:700;color:${tierColor}">${tierName}</div></div>
                    <div style="text-align:center"><div style="color:#64748b;font-size:0.72rem">Inimigos/Andar</div><div style="font-size:1.4rem;font-weight:700;color:#f87171">${Math.floor((d.baseEnemies||5)*0.5)}–${Math.floor((d.baseEnemies||5)*1.2)}</div></div>
                </div>
            </div>
            <h3 style="font-weight:600;margin:0 0 0.75rem">Recompensas do Tier Atual</h3>
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;background:#020617;padding:0.75rem;border-radius:6px;margin-bottom:1.5rem;min-height:3rem">
                ${Object.entries(rewards).map(([iid,qty])=>{
                    const item = state.data.items.find(i=>i.id===iid);
                    return `<div style="background:#1e293b;border:1px solid #334155;border-radius:4px;padding:4px 8px;font-size:0.72rem;display:flex;align-items:center;gap:4px">
                        ${item?.imagemUrl?`<img src="${item.imagemUrl}" style="width:20px;height:20px;border-radius:2px;object-fit:cover" />`:''}
                        ${item?.nome||iid} <span style="color:#f59e0b;font-weight:700">×${qty}</span>
                    </div>`;
                }).join('') || '<span style="color:#475569;font-size:0.8rem">Nenhum drop cadastrado.</span>'}
            </div>
            <h3 style="font-weight:600;margin:0 0 0.75rem">Gerar Recompensas</h3>
            <div style="background:#020617;border:1px solid #1e293b;border-radius:6px;padding:1rem">
                <p style="font-size:0.75rem;color:#64748b;margin:0 0 0.75rem">Selecione os jogadores que participaram:</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;max-height:200px;overflow-y:auto;margin-bottom:1rem">
                    ${state.data.players.map(p=>{
                        const sel = (state.selectedPlayers||[]).includes(p.id);
                        return `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem;border-radius:4px;cursor:pointer;background:${sel?'rgba(245,158,11,0.1)':'transparent'};border:1px solid ${sel?'rgba(245,158,11,0.4)':'transparent'}">
                            <input type="checkbox" data-plid="${p.id}" ${sel?'checked':''} style="accent-color:#f59e0b" />
                            <span style="font-size:0.82rem">${p.nome||p.id}</span>
                        </label>`;
                    }).join('')}
                </div>
                <button class="arq-btn arq-btn-primary" style="width:100%" id="arq-dun-loot">⚔ Saquear Baú</button>
            </div>
          </div>
        </div>`;

    panel.querySelectorAll('[data-plid]').forEach(inp => inp.addEventListener('change', e => {
        const list = state.selectedPlayers||[];
        if (e.target.checked) state.selectedPlayers=[...list,e.target.dataset.plid];
        else state.selectedPlayers=list.filter(x=>x!==e.target.dataset.plid);
    }));

    document.getElementById('arq-dun-loot').onclick = async () => {
        if (!state.selectedPlayers?.length) { _showAlert('Selecione pelo menos um jogador.'); return; }
        const lootTable = d.rewards?.[tierKey]||{};
        const batch = writeBatch(db);
        const log = [];
        Object.entries(lootTable).forEach(([iid,qty]) => {
            const q = parseInt(qty);
            if (q<=0) return;
            const lucky = state.selectedPlayers[Math.floor(Math.random()*state.selectedPlayers.length)];
            const pRef = doc(db, COLS.PLAYERS, lucky);
            batch.update(pRef, {[`mochila.${iid}`]: increment(q)});
            const pName = state.data.players.find(p=>p.id===lucky)?.nome||lucky;
            const iName = state.data.items.find(i=>i.id===iid)?.nome||iid;
            log.push(`${pName} recebeu ${q}× ${iName}`);
        });
        batch.update(doc(db,COLS.DUNGEONS,d.id), {runCount: increment(1)});
        await batch.commit();
        _showAlert(`Saque realizado!\n\n${log.join('\n')}`);
    };
}

function _getDungeonTier(createdDay, currentDay) {
    const diff = Math.max(0, currentDay - (createdDay||0));
    return Math.floor(diff/2) % 3;
}

// ─── PÁGINA: TEMPO (CRONOLOGIA) ───────────────────────────────────────────────
function _renderTime(main) {
    const ws = state.data.worldState;
    const [h] = (ws.time||'12:00').split(':').map(Number);
    const isNight = h>=19||h<6;
    const moonState = _getLunarState(ws.day||1, ws.month||1, ws.year||1);

    main.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;overflow-y:auto" id="arq-time-main">
            <div style="position:relative;width:22rem;height:22rem;border-radius:50%;border:6px solid ${isNight?'#3730a3':'#0ea5e9'};background:${isNight?'#020617':'#0c4a6e'};display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:2rem;box-shadow:0 0 40px rgba(0,0,0,0.5);">
                <div style="font-size:0.8rem;color:${isNight?'#818cf8':'#7dd3fc'};text-transform:uppercase;letter-spacing:0.3em;margin-bottom:0.5rem">${isNight?'Noite':'Dia'}</div>
                <div style="font-size:4rem;font-family:monospace;font-weight:700;color:white" id="arq-time-display">${ws.time||'12:00'}</div>
                <div style="font-size:1rem;color:#94a3b8;margin-top:0.5rem">${ws.day||1} / ${ws.month||1} / ${ws.year||1}</div>
            </div>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1.25rem;width:100%;max-width:540px;display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
                <div style="width:64px;height:64px;border-radius:50%;background:${moonState.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid rgba(255,255,255,0.2)">${_icon(moonState.icon,32)}</div>
                <div style="flex:1">
                    <div style="font-weight:700;text-transform:uppercase;letter-spacing:0.1em">${moonState.name}</div>
                    <div style="height:6px;background:#1e293b;border-radius:3px;margin:0.5rem 0;overflow:hidden"><div style="height:100%;background:#6366f1;width:${((1-(moonState.daysToNext/28))*100).toFixed(0)}%"></div></div>
                    <div style="font-size:0.75rem;color:#64748b">Próxima fase em <b style="color:white">${moonState.daysToNext} dias</b></div>
                </div>
            </div>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1.25rem;width:100%;max-width:540px;display:flex;align-items:center;gap:1rem">
                ${_icon('wind',28)}
                <div style="flex:1">
                    <div style="font-size:0.65rem;text-transform:uppercase;color:#64748b;font-weight:600">Estação Vigente</div>
                    <select class="arq-input" id="arq-time-season" style="background:transparent;border:none;font-size:1.2rem;font-family:'Cinzel',serif;color:#f59e0b;padding:0;outline:none;cursor:pointer">
                        <option value="">Selecione...</option>
                        ${state.data.seasons.map(s=>`<option value="${s.id}"${ws.seasonId===s.id?' selected':''}>${s.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
        <div style="width:22rem;background:#0f172a;border-left:1px solid #1e293b;padding:1.5rem;overflow-y:auto;flex-shrink:0">
            <h3 style="color:#f59e0b;font-family:'Cinzel',serif;margin:0 0 1.5rem;border-bottom:1px solid #1e293b;padding-bottom:0.75rem">Intervenção Divina</h3>
            <div class="arq-grid-2" style="margin-bottom:1.5rem">
                <div><label class="arq-label">Hora</label><input type="time" class="arq-input" id="arq-time-h" value="${ws.time||'12:00'}" /></div>
                <div><label class="arq-label">Dia</label><input type="number" class="arq-input" id="arq-time-d" value="${ws.day||1}" /></div>
                <div><label class="arq-label">Mês</label><input type="number" class="arq-input" id="arq-time-m" value="${ws.month||1}" /></div>
                <div><label class="arq-label">Ano</label><input type="number" class="arq-input" id="arq-time-y" value="${ws.year||1}" /></div>
            </div>
            <h4 style="color:#64748b;font-size:0.75rem;text-transform:uppercase;margin:0 0 1rem;padding-top:1rem;border-top:1px solid #1e293b">Gerenciar Estações</h4>
            <form id="arq-season-form" style="background:#1e293b;padding:0.75rem;border-radius:6px;margin-bottom:1rem;display:flex;flex-direction:column;gap:0.4rem">
                <input name="name" class="arq-input" placeholder="Nome da Estação" required />
                <textarea name="desc" class="arq-input" placeholder="Efeitos..." rows="2" style="resize:none"></textarea>
                <button class="arq-btn arq-btn-green arq-btn-sm">Criar Estação</button>
            </form>
            <div style="display:flex;flex-direction:column;gap:0.4rem">
                ${state.data.seasons.map(s=>`
                <div style="background:#1e293b;padding:0.6rem 0.75rem;border-radius:6px;border:1px solid #334155;position:relative;group">
                    <div style="font-weight:600;font-size:0.85rem">${s.name}</div>
                    <div style="font-size:0.72rem;color:#64748b;margin-top:2px">${(s.desc||'').substring(0,60)}${(s.desc||'').length>60?'...':''}</div>
                    <button style="position:absolute;top:0.4rem;right:0.4rem;color:#ef4444;background:none;border:none;cursor:pointer;font-size:12px" data-sdel="${s.id}">✕</button>
                </div>`).join('')}
            </div>
        </div>`;

    const save = (key, val) => updateDoc(doc(db, COLS.WORLD, 'main'), {[key]: val});
    document.getElementById('arq-time-h').addEventListener('change', e => save('time', e.target.value));
    document.getElementById('arq-time-d').addEventListener('change', e => save('day', parseInt(e.target.value)||1));
    document.getElementById('arq-time-m').addEventListener('change', e => save('month', parseInt(e.target.value)||1));
    document.getElementById('arq-time-y').addEventListener('change', e => save('year', parseInt(e.target.value)||1));
    document.getElementById('arq-time-season').addEventListener('change', e => save('seasonId', e.target.value));
    document.getElementById('arq-season-form').onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await addDoc(collection(db, COLS.SEASONS), {name:fd.get('name'), desc:fd.get('desc')});
        e.target.reset();
    };
    main.querySelectorAll('[data-sdel]').forEach(btn => btn.addEventListener('click', () =>
        _showConfirm('Excluir estação?', ()=>deleteDoc(doc(db,COLS.SEASONS,btn.dataset.sdel)))));
}

function _getLunarState(day, month, year) {
    const total = (year*360)+(month*30)+day;
    if (total%360===0) return {...MOON_PHASES[9], daysToNext:360};
    if (total%180===0) return {...MOON_PHASES[8], daysToNext:180};
    const cycle = total%28;
    const phaseIdx = Math.floor(cycle/3.5);
    const nextPhase = (phaseIdx+1)*3.5;
    return {...MOON_PHASES[Math.min(phaseIdx,7)], daysToNext:Math.ceil(nextPhase-cycle)};
}

function _refreshTimeUI() {
    if (state.page !== 'time') return;
    // Re-render só se a aba de tempo estiver ativa
    const main = document.getElementById('arq-main');
    if (main) _renderTime(main);
}

function _refreshSessionsUI_noop() {} // alias para evitar chamada desnecessária

// ─── CLEANUP ──────────────────────────────────────────────────────────────────
// Exporta também uma função de cleanup para main.js poder chamar ao trocar de aba
export function destroyMapaMundialTab() {
    _destroyAll();
}
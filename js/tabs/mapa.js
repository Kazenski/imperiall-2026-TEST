import { db, doc, onSnapshot, updateDoc } from '../core/firebase.js';
import { globalState } from '../core/state.js';

// Instâncias do Leaflet
let playerMapInstance = null;
let mapOverlay = null;
let partyMarker = null;
let fogLayerGroup = null;
let locationMarkersGroup = null;
let sessionUnsubscribe = null;

// Constantes do Mapa (Padrão 2048x1536)
const MAP_CONSTANTS = {
    URL: "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media",
    W: 2048,
    H: 1536,
    HEX_RADIUS: 10 
};

const R = MAP_CONSTANTS.HEX_RADIUS;
const H = R * 2;
const W = Math.sqrt(3) * R;
const VERT_DIST = H * 0.75;

export function renderMapaTab() {
    const container = document.getElementById('mapa-movimento-content');
    if (!container) return;

    const sessionId = globalState.activeSessionId;

    if (!sessionId || sessionId === 'world') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-700 shadow-inner">
                <i class="fas fa-map-marked-alt text-6xl text-slate-600 mb-4 opacity-50"></i>
                <h2 class="text-2xl font-cinzel text-slate-400">Modo Global (Sem Sessão)</h2>
                <p class="text-slate-500 mt-2 text-sm text-center max-w-md px-4">Selecione uma Sessão de Jogo no topo da página para carregar o mapa de exploração e a névoa de guerra.</p>
            </div>
        `;
        limparInstanciaMapa();
        return;
    }

    // Estrutura HTML do Mapa
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
            <div>
                <h2 class="font-cinzel text-2xl text-amber-500 m-0 border-none p-0">Exploração do Continente</h2>
                <p class="text-xs text-slate-400 mt-1">Sincronizado com a posição do grupo em tempo real.</p>
            </div>
            <div id="map-session-info" class="text-xs font-bold text-emerald-400 uppercase bg-slate-900 px-3 py-1.5 rounded border border-emerald-900 shadow-lg">
                <i class="fas fa-sync fa-spin mr-2"></i> Conectando...
            </div>
        </div>
        
        <div class="relative w-full h-[700px] bg-slate-950 rounded-lg border border-slate-700 overflow-hidden shadow-2xl">
            <div id="map-player-container" class="w-full h-full z-0"></div>

            <div class="absolute top-4 right-4 z-[400] bg-slate-900/90 p-3 rounded-lg border border-slate-700 shadow-xl backdrop-blur-md text-[10px] text-slate-300 pointer-events-none">
                <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 font-cinzel uppercase tracking-wider">Status</h4>
                <div class="flex items-center gap-2 mt-2"><div class="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-[0_0_8px_blue]"></div> Posição do Grupo</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-[0_0_5px_orange]"></div> Cidade Descoberta</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 bg-black border border-slate-800"></div> Território Oculto</div>
            </div>
        </div>
    `;

    setTimeout(inicializarMapaLeaflet, 100);
}

function inicializarMapaLeaflet() {
    const mapDiv = document.getElementById('map-player-container');
    if (!mapDiv) return;

    if (playerMapInstance) playerMapInstance.remove();

    playerMapInstance = L.map('map-player-container', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true
    });

    const bounds = [[0, 0], [MAP_CONSTANTS.H, MAP_CONSTANTS.W]];
    mapOverlay = L.imageOverlay(MAP_CONSTANTS.URL, bounds).addTo(playerMapInstance);
    playerMapInstance.fitBounds(bounds);

    fogLayerGroup = L.layerGroup().addTo(playerMapInstance);
    locationMarkersGroup = L.layerGroup().addTo(playerMapInstance);

    // Marcador do Grupo
    const groupIcon = L.divIcon({
        className: 'custom-party-marker',
        html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_15px_blue] flex items-center justify-center animate-bounce text-white"><i class="fas fa-users text-sm"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    partyMarker = L.marker([-9999, -9999], { icon: groupIcon, zIndexOffset: 20000 }).addTo(playerMapInstance);

    conectarDadosSessao();
}

function conectarDadosSessao() {
    const sessionId = globalState.activeSessionId;
    if (!sessionId || sessionId === 'world') return;

    const infoBadge = document.getElementById('map-session-info');

    sessionUnsubscribe = onSnapshot(doc(db, "rpg_sessions", sessionId), (docSnap) => {
        if (!docSnap.exists()) return;

        const sessionData = docSnap.data();
        if(infoBadge) infoBadge.textContent = `Sessão: ${sessionData.name}`;

        // LÊ DO LOCAL CORRETO: revealedHexes e groupLocation estão na raiz do documento
        const revealed = sessionData.revealedHexes || [];
        const groupLoc = sessionData.groupLocation || null;

        // 1. Desenha a Névoa Totalmente Escura
        drawFogOfWar(revealed);

        // 2. Posiciona o Grupo
        if (groupLoc) {
            // Converte coordenadas de hexágono para pixels para o Leaflet
            const xOffset = (groupLoc.row % 2 === 1) ? W / 2 : 0;
            const centerX = (groupLoc.col * W) + xOffset - (W / 2);
            const centerY = (groupLoc.row * VERT_DIST) - (H / 2);
            partyMarker.setLatLng([centerY, centerX]);
        }

        // 3. Renderiza Cidades Baseadas na Visão
        renderRevealedLocations(revealed);

        // 4. Integração com Radar de Descoberta Automática
        if (window.checkAndDiscoverCities) {
            window.checkAndDiscoverCities(revealed);
        }

        // 5. Permissão de Mestre para mover grupo clicando
        const isMaster = globalState.isAdmin || (globalState.currentUser && sessionData.ownerUid === globalState.currentUser.uid);
        playerMapInstance.off('click');
        if (isMaster) {
            document.getElementById('map-player-container').style.cursor = 'crosshair';
            playerMapInstance.on('click', (e) => {
                handleSetGroupPosition(e.latlng, sessionId);
            });
        } else {
            document.getElementById('map-player-container').style.cursor = 'default';
        }
    });
}

// Lógica para o Mestre teletransportar o grupo (Pixel -> Hex -> DB)
async function handleSetGroupPosition(latlng, sessionId) {
    const lx = latlng.lng;
    const ly = latlng.lat;

    // Matemática Inversa para identificar o hexágono
    const row = Math.round((ly + (H / 2)) / VERT_DIST);
    const xOffset = (row % 2 === 1) ? W / 2 : 0;
    const col = Math.round((lx + (W / 2) - xOffset) / W);

    if (!confirm(`Definir localização do grupo aqui?\nCoordenadas: ${lx.toFixed(0)}, ${ly.toFixed(0)}`)) return;

    try {
        await updateDoc(doc(db, "rpg_sessions", sessionId), {
            groupLocation: { row, col, hexId: `${row}-${col}`, updatedAt: Date.now() }
        });
    } catch (e) {
        console.error("Erro ao mover grupo:", e);
    }
}

function drawFogOfWar(revealedIds) {
    if (!fogLayerGroup) return;
    fogLayerGroup.clearLayers();

    const revealedSet = new Set(revealedIds);
    const cols = Math.ceil(MAP_CONSTANTS.W / W) + 2;
    const rows = Math.ceil(MAP_CONSTANTS.H / VERT_DIST) + 2;
    const renderer = L.canvas({ padding: 0.5 });

    const fogStyle = {
        renderer: renderer,
        color: '#000000',      
        weight: 1,             
        fillColor: '#020617',  
        fillOpacity: 1,        // TOTALMENTE ESCURO
        interactive: false     
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const hexId = `${r}-${c}`;
            if (!revealedSet.has(hexId)) {
                const xOffset = (r % 2 === 1) ? W / 2 : 0;
                const cx = (c * W) + xOffset - (W / 2);
                const cy = (r * VERT_DIST) - (H / 2);

                if (cx >= -W && cx <= MAP_CONSTANTS.W + W && cy >= -H && cy <= MAP_CONSTANTS.H + H) {
                    const corners = [];
                    for (let i = 0; i < 6; i++) {
                        const rad = Math.PI / 180 * (60 * i - 30);
                        corners.push([cy + R * Math.sin(rad), cx + R * Math.cos(rad)]);
                    }
                    L.polygon(corners, fogStyle).addTo(fogLayerGroup);
                }
            }
        }
    }
}

function renderRevealedLocations(revealedIds) {
    if (!locationMarkersGroup) return;
    locationMarkersGroup.clearLayers();

    const revealedSet = new Set(revealedIds);
    const locations = globalState.world?.locations || [];
    const charFicha = globalState.selectedCharacterData?.ficha || {};
    const descobertasNoDiario = charFicha.colecao_cidades || {};

    const cityIcon = L.divIcon({
        className: 'city-marker',
        html: `<div class="w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    locations.forEach(loc => {
        if (!loc.x || !loc.y) return;
        const lx = Number(loc.x);
        const ly = Number(loc.y);

        // Descobre em qual hex esta cidade mora
        const row = Math.round((ly + (H / 2)) / VERT_DIST);
        const xOffset = (row % 2 === 1) ? W / 2 : 0;
        const col = Math.round((lx + (W / 2) - xOffset) / W);
        const hexId = `${row}-${col}`;

        // Só mostra se estiver revelado pelo mapa ou já resgatado no diário
        if (revealedSet.has(hexId) || descobertasNoDiario[loc.id]) {
            L.marker([ly, lx], { icon: cityIcon })
                .bindTooltip(`<div class="font-cinzel font-bold text-amber-500 text-xs px-1">${loc.name}</div>`, {
                    direction: 'top', offset: [0, -5], className: 'bg-slate-900 border border-slate-700 text-white rounded p-1 shadow-lg'
                })
                .addTo(locationMarkersGroup);
        }
    });
}

function limparInstanciaMapa() {
    if (sessionUnsubscribe) { sessionUnsubscribe(); sessionUnsubscribe = null; }
    if (playerMapInstance) { playerMapInstance.remove(); playerMapInstance = null; }
}
import { db, doc, onSnapshot, updateDoc } from '../core/firebase.js';
import { globalState } from '../core/state.js';

let mapInstance = null;
let mapOverlay = null;
let partyMarker = null;
let fogLayerGroup = null;
let locationMarkersGroup = null;
let sessionUnsubscribe = null;

// Constantes da Malha Hexagonal (Calibradas para a imagem de 2048x1536)
const HEX_RADIUS = 10;
const R = HEX_RADIUS;
const H = R * 2;
const W = Math.sqrt(3) * R;
const VERT_DIST = H * 0.75;

export function renderMapaTab() {
    // ID corrigido para bater com seu index.html
    const container = document.getElementById('mapa-movimento-content');
    if (!container) return;

    const sessionId = globalState.activeSessionId;

    if (!sessionId || sessionId === 'world') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-slate-900/50 rounded-xl border border-slate-700 shadow-inner">
                <i class="fas fa-map-marked-alt text-6xl text-slate-600 mb-4 opacity-50"></i>
                <h2 class="text-2xl font-cinzel text-slate-400">Cartografia Indisponível</h2>
                <p class="text-slate-500 mt-2 text-sm text-center max-w-md px-4">É necessário entrar numa sessão ativa para visualizar sua localização e a névoa de guerra.</p>
            </div>
        `;
        limparMapa();
        return;
    }

    // Reinjetamos o container do Leaflet para garantir que ele esteja limpo
    container.innerHTML = `
        <div class="relative w-full h-full bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col">
            <div id="map-leaflet-container" class="flex-grow z-0 bg-[#020617]"></div>
            
            <div class="absolute top-4 right-4 z-[400] bg-slate-900/95 p-3 rounded-lg border border-slate-700 shadow-lg backdrop-blur-md text-[10px] text-slate-300 pointer-events-none">
                <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 font-cinzel uppercase tracking-wider">Legenda</h4>
                <div class="flex items-center gap-2 mt-2"><div class="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"></div> Grupo</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"></div> Local</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-2.5 h-2.5 bg-black border border-slate-800"></div> Terra Desconhecida</div>
            </div>
        </div>
    `;

    setTimeout(inicializarLeaflet, 100);
}

function inicializarLeaflet() {
    const mapDiv = document.getElementById('map-leaflet-container');
    if (!mapDiv) return;

    if (mapInstance) mapInstance.remove();

    mapInstance = L.map('map-leaflet-container', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    fogLayerGroup = L.layerGroup().addTo(mapInstance);
    locationMarkersGroup = L.layerGroup().addTo(mapInstance);

    const groupIcon = L.divIcon({
        className: 'custom-party-marker',
        html: `<div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_20px_rgba(37,99,235,0.8)] flex items-center justify-center animate-bounce text-white"><i class="fas fa-users text-sm"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    partyMarker = L.marker([-9999, -9999], { icon: groupIcon, zIndexOffset: 20000 }).addTo(mapInstance);

    conectarMapaAoFirebase();
}

function conectarMapaAoFirebase() {
    const sessionId = globalState.activeSessionId;
    if (!sessionId || sessionId === 'world') return;

    sessionUnsubscribe = onSnapshot(doc(db, "rpg_sessions", sessionId), (docSnap) => {
        if (!docSnap.exists()) return;

        const sessionData = docSnap.data();
        const mapData = sessionData.map_state || {};
        
        const imgUrl = mapData.mapUrl || "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media";
        const imgWidth = mapData.width || 2048;
        const imgHeight = mapData.height || 1536;

        const bounds = [[0, 0], [imgHeight, imgWidth]];
        if (!mapOverlay || mapOverlay._url !== imgUrl) {
            if (mapOverlay) mapInstance.removeLayer(mapOverlay);
            mapOverlay = L.imageOverlay(imgUrl, bounds).addTo(mapInstance);
            mapInstance.fitBounds(bounds);
            mapOverlay.bringToBack();
        }

        if (mapData.partyPosition) {
            partyMarker.setLatLng([mapData.partyPosition.y, mapData.partyPosition.x]);
        }

        const revealed = mapData.revealedHexes || [];
        desenharNevoaDeGuerra(imgWidth, imgHeight, revealed);
        renderizarLocaisDescobertos(revealed);

        if (window.checkAndDiscoverCities) {
            window.checkAndDiscoverCities(revealed);
        }

        // Lógica de Mestre para mover o grupo
        const isMaster = globalState.isAdmin || (globalState.currentUser && sessionData.ownerUid === globalState.currentUser.uid);
        mapInstance.off('click');
        if (isMaster) {
            document.getElementById('map-leaflet-container').style.cursor = 'crosshair';
            mapInstance.on('click', (e) => handleMasterMapClick(e.latlng, sessionId));
        }
    });
}

function desenharNevoaDeGuerra(imgWidth, imgHeight, revealedHexes) {
    if (!fogLayerGroup) return;
    fogLayerGroup.clearLayers();
    
    const revealedSet = new Set(revealedHexes);
    const cols = Math.ceil(imgWidth / W) + 1;
    const rows = Math.ceil(imgHeight / VERT_DIST) + 1;

    // Estilo totalmente escuro para hexágonos ocultos
    const fogStyle = {
        color: '#000000', 
        weight: 0.8,
        fillColor: '#000000',
        fillOpacity: 1.0, // Totalmente opaco
        interactive: false
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const hexId = `${r}-${c}`;
            if (!revealedSet.has(hexId)) {
                const xOffset = (r % 2 === 1) ? W / 2 : 0;
                const cx = (c * W) + (W / 2) - xOffset;
                const cy = (r * VERT_DIST) - (H / 2);

                if (cx >= -W && cx <= imgWidth + W && cy >= -H && cy <= imgHeight + H) {
                    const latlngs = [];
                    for (let i = 0; i < 6; i++) {
                        const angulo_rad = Math.PI / 180 * (60 * i - 30);
                        latlngs.push([cy + R * Math.sin(angulo_rad), cx + R * Math.cos(angulo_rad)]);
                    }
                    L.polygon(latlngs, fogStyle).addTo(fogLayerGroup);
                }
            }
        }
    }
}

async function handleMasterMapClick(latlng, sessionId) {
    const lx = latlng.lng;
    const ly = latlng.lat;
    const row = Math.round((ly + (H / 2)) / VERT_DIST);
    const xOffset = (row % 2 === 1) ? W / 2 : 0;
    const col = Math.round((lx + (W / 2) - xOffset) / W);

    if (!confirm(`Mover grupo para coordenadas ${lx.toFixed(0)}, ${ly.toFixed(0)}?`)) return;

    try {
        await updateDoc(doc(db, "rpg_sessions", sessionId), {
            "map_state.partyPosition": { x: lx, y: ly, row: row, col: col }
        });
    } catch (e) {
        console.error("Erro ao mover grupo:", e);
    }
}

function renderizarLocaisDescobertos(revealedHexes) {
    if (!locationMarkersGroup) return;
    locationMarkersGroup.clearLayers();

    const revealedSet = new Set(revealedHexes);
    const charData = globalState.selectedCharacterData;
    if (!charData || !globalState.world?.locations) return;

    const colecaoCidades = charData.ficha.colecao_cidades || {};

    const cityIcon = L.divIcon({
        className: 'custom-city-marker',
        html: `<div class="w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(245,158,11,1)]"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    globalState.world.locations.forEach(loc => {
        if (!loc.x || !loc.y) return;

        const lx = Number(loc.x);
        const ly = Number(loc.y);
        const row = Math.round((ly + (H/2)) / VERT_DIST);
        const xOffset = (row % 2 === 1) ? W / 2 : 0;
        const col = Math.round((lx + (W/2) - xOffset) / W);
        const hexId = `${row}-${col}`;

        if (colecaoCidades[loc.id] || revealedSet.has(hexId)) {
            const marker = L.marker([ly, lx], { icon: cityIcon }).addTo(locationMarkersGroup);
            marker.bindTooltip(`<div class="font-cinzel font-bold text-amber-400 text-xs">${loc.name}</div>`, {
                direction: 'top', className: 'bg-slate-900 border border-slate-700 text-white rounded p-1 shadow-lg'
            });
        }
    });
}

function limparMapa() {
    if (sessionUnsubscribe) { sessionUnsubscribe(); sessionUnsubscribe = null; }
    if (mapInstance) { mapInstance.remove(); mapInstance = null; mapOverlay = null; }
}
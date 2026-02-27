import { db, doc, onSnapshot } from '../core/firebase.js';
import { globalState } from '../core/state.js';

// Variáveis locais para controlar as instâncias do Leaflet
let mapInstance = null;
let mapOverlay = null;
let partyMarker = null;
let fogLayerGroup = null;
let locationMarkersGroup = null;
let sessionUnsubscribe = null;

// Constantes da Malha Hexagonal (Mesmas do colecao.js)
const HEX_RADIUS = 10;
const R = HEX_RADIUS;
const H = R * 2;
const W = Math.sqrt(3) * R;
const VERT_DIST = H * 0.75;

export function renderMapaTab() {
    const container = document.getElementById('mapa-content');
    if (!container) return;

    const sessionId = globalState.activeSessionId;

    // Se o jogador não estiver em uma sessão, o mapa global não carrega a posição
    if (!sessionId || sessionId === 'world') {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[600px] bg-slate-900/50 rounded-xl border border-slate-700 shadow-inner">
                <i class="fas fa-map-marked-alt text-6xl text-slate-600 mb-4 opacity-50"></i>
                <h2 class="text-2xl font-cinzel text-slate-400">Cartografia Indisponível</h2>
                <p class="text-slate-500 mt-2 text-sm text-center max-w-md">Você precisa estar em uma sessão ativa com o Mestre para visualizar sua localização no mundo.</p>
            </div>
        `;
        limparMapa();
        return;
    }

    container.innerHTML = `
        <div class="relative w-full h-[700px] bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shadow-2xl animate-fade-in">
            <div id="leaflet-map-container" class="w-full h-full z-0 bg-[#0a0f18]"></div>
            
            <div class="absolute top-4 right-4 z-[400] bg-slate-900/90 p-3 rounded-lg border border-slate-600 shadow-lg backdrop-blur text-xs text-slate-300 pointer-events-none">
                <h4 class="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 font-cinzel tracking-wider"><i class="fas fa-compass mr-1"></i> Legenda</h4>
                <div class="flex items-center gap-2 mt-2"><div class="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-[0_0_5px_blue]"></div> Sua Posição (Grupo)</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 rounded-full bg-amber-500 border border-white"></div> Local Descoberto</div>
                <div class="flex items-center gap-2 mt-1"><div class="w-3 h-3 bg-black/80 border border-slate-700"></div> Névoa de Guerra</div>
            </div>
            
            <div class="absolute bottom-4 left-4 z-[400] pointer-events-none">
                <div id="map-status-badge" class="bg-emerald-900/80 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-2 backdrop-blur hidden">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Sincronizado com o Mestre
                </div>
            </div>
        </div>
    `;

    // O Leaflet precisa que a div exista no DOM com altura/largura definidas antes de iniciar
    setTimeout(inicializarLeaflet, 100);
}

function limparMapa() {
    if (sessionUnsubscribe) {
        sessionUnsubscribe();
        sessionUnsubscribe = null;
    }
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
        mapOverlay = null;
        partyMarker = null;
        fogLayerGroup = null;
        locationMarkersGroup = null;
    }
}

function inicializarLeaflet() {
    const mapDiv = document.getElementById('leaflet-map-container');
    if (!mapDiv) return;

    // Se já existe um mapa, limpa para evitar vazamento de memória
    if (mapInstance) {
        mapInstance.remove();
    }

    // Usamos CRS.Simple pois é um mapa de imagem customizada (não geográfico como Google Maps)
    mapInstance = L.map('leaflet-map-container', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: false,
        attributionControl: false
    });

    L.control.zoom({ position: 'topleft' }).addTo(mapInstance);

    fogLayerGroup = L.layerGroup().addTo(mapInstance);
    locationMarkersGroup = L.layerGroup().addTo(mapInstance);

    // Ícone personalizado para o Grupo
    const groupIcon = L.divIcon({
        className: 'custom-party-marker',
        html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] flex items-center justify-center animate-bounce"><i class="fas fa-users text-white text-[10px]"></i></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    partyMarker = L.marker([0, 0], { icon: groupIcon }).addTo(mapInstance);

    conectarMapaAoFirebase();
}

function conectarMapaAoFirebase() {
    const sessionId = globalState.activeSessionId;
    if (!sessionId || sessionId === 'world') return;

    const badge = document.getElementById('map-status-badge');

    sessionUnsubscribe = onSnapshot(doc(db, "rpg_sessions", sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        
        if (badge) badge.classList.remove('hidden');

        const data = docSnap.data();
        const mapData = data.map_state || {};
        
        // 1. Atualizar Imagem de Fundo (Se mudou)
        const imgUrl = mapData.mapUrl || globalState.world?.data?.mapaUrl;
        const imgWidth = mapData.width || 2000;
        const imgHeight = mapData.height || 1500;

        if (imgUrl) {
            const bounds = [[0, 0], [imgHeight, imgWidth]];
            
            if (!mapOverlay || mapOverlay._url !== imgUrl) {
                if (mapOverlay) mapInstance.removeLayer(mapOverlay);
                mapOverlay = L.imageOverlay(imgUrl, bounds).addTo(mapInstance);
                mapInstance.fitBounds(bounds);
                // Move a imagem para trás de tudo
                mapOverlay.bringToBack(); 
            }
        }

        // 2. Atualizar Posição do Grupo
        if (mapData.partyPosition) {
            partyMarker.setLatLng([mapData.partyPosition.y, mapData.partyPosition.x]);
        } else {
            partyMarker.setLatLng([-9999, -9999]); // Esconde se não houver
        }

        // 3. Atualizar Névoa de Guerra (Fog of War)
        desenharNevoaDeGuerra(imgWidth, imgHeight, mapData.revealedHexes || []);

        // 4. Checar se alguma cidade foi descoberta com essa nova névoa
        if (window.checkAndDiscoverCities) {
            window.checkAndDiscoverCities(mapData.revealedHexes || []);
        }

        // 5. Renderizar Marcadores de Locais Conhecidos (Cidades)
        renderizarLocaisDescobertos(mapData.revealedHexes || []);
    });
}

function desenharNevoaDeGuerra(imgWidth, imgHeight, revealedHexes) {
    if (!fogLayerGroup) return;
    
    fogLayerGroup.clearLayers();
    const revealedSet = new Set(revealedHexes);

    const cols = Math.ceil(imgWidth / W);
    const rows = Math.ceil(imgHeight / VERT_DIST);

    // Otimização: Em vez de desenhar a névoa um por um, o ideal num sistema em produção
    // é desenhar um grande retângulo escuro e recortar/mascarar os hexágonos revelados.
    // Como o Leaflet puro sem plugins tem dificuldade com máscaras invertidas, 
    // desenhamos hexágonos escuros APENAS onde NÃO foi revelado.
    
    const hexStyle = {
        color: '#1e293b',   // Borda escura
        weight: 1,
        fillColor: '#000000', // Preenchimento preto
        fillOpacity: 0.85,    // Quase totalmente escuro
        interactive: false
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const hexId = `${r}-${c}`;
            
            // Se o hexágono FOI revelado, NÃO desenha névoa nele.
            if (!revealedSet.has(hexId)) {
                const xOffset = (r % 2 === 1) ? W / 2 : 0;
                const cx = (c * W) + (W / 2) - xOffset;
                const cy = (r * VERT_DIST) - (H / 2);

                // Desenha apenas se estiver dentro dos limites práticos da imagem
                if (cx >= -W && cx <= imgWidth + W && cy >= -H && cy <= imgHeight + H) {
                    const latlngs = gerarPontosHexagono(cx, cy);
                    L.polygon(latlngs, hexStyle).addTo(fogLayerGroup);
                }
            }
        }
    }
}

function gerarPontosHexagono(cx, cy) {
    const pontos = [];
    for (let i = 0; i < 6; i++) {
        const angulo_deg = 60 * i - 30; // Ponta para cima
        const angulo_rad = Math.PI / 180 * angulo_deg;
        const px = cx + R * Math.cos(angulo_rad);
        const py = cy + R * Math.sin(angulo_rad);
        pontos.push([py, px]); // Leaflet usa [Lat(Y), Lng(X)]
    }
    return pontos;
}

function renderizarLocaisDescobertos(revealedHexes) {
    if (!locationMarkersGroup) return;
    
    locationMarkersGroup.clearLayers();
    const revealedSet = new Set(revealedHexes);
    const charData = globalState.selectedCharacterData;
    
    if (!charData || !globalState.world?.locations) return;

    const colecaoCidades = charData.ficha.colecao_cidades || {};

    // Ícone para cidades
    const cityIcon = L.divIcon({
        className: 'custom-city-marker',
        html: `<div class="w-4 h-4 bg-amber-500 rounded-full border border-white shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    globalState.world.locations.forEach(loc => {
        // Se a cidade não tem coordenadas, ignora
        if (!loc.x || !loc.y) return;

        // Só mostra a cidade no mapa se o jogador já tiver descoberto ELA no diário,
        // OU se o hexágono onde ela está estiver revelado (nesse caso o diário atualiza no mesmo milisegundo)
        const lx = Number(loc.x);
        const ly = Number(loc.y);
        
        const row = Math.round((ly + (H/2)) / VERT_DIST);
        const xOffset = (row % 2 === 1) ? W / 2 : 0;
        const col = Math.round((lx + (W/2) - xOffset) / W);
        const hexId = `${row}-${col}`;

        if (colecaoCidades[loc.id] || revealedSet.has(hexId)) {
            const marker = L.marker([ly, lx], { icon: cityIcon }).addTo(locationMarkersGroup);
            marker.bindTooltip(`<div class="font-cinzel font-bold text-amber-400">${loc.name}</div>`, {
                direction: 'top',
                offset: [0, -10],
                className: 'bg-slate-900 border border-slate-700 text-white p-1 rounded shadow-lg'
            });
        }
    });
}
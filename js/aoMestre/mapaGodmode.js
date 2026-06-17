import { db } from '../core/firebase.js';
import { collection, getDocs, onSnapshot, doc, updateDoc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- CONFIGURAÇÕES ---
const WORLD_MAP_URL = "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media";
const MAP_W = 2048; 
const MAP_H = 1536; 
const HEX_RADIUS = 10;

// Estado local do módulo
let mapInstance = null;
let currentUnsubscribe = null;
let mapLayers = { markers: [], canvasFog: null };
let godmodeState = {
    activeTab: 'global',
    sessions: [],
    selectedSession: null,
    localRevealed: [],
    toolMode: 'reveal' // 'reveal' ou 'hide'
};

export async function renderMapaGodmodeTab() {
    const container = document.getElementById('mapa-godmode-content');
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col h-full w-full bg-slate-950 text-slate-200">
            <header class="flex items-center bg-slate-900 border-b border-slate-800 h-14 shrink-0 z-50 shadow-xl px-4 overflow-x-auto no-scrollbar">
                <div class="flex items-center gap-2 text-amber-600 font-cinzel font-bold text-lg mr-6 shrink-0">
                    <i class="fas fa-crown"></i> ARCHITECT
                </div>
                <nav class="flex h-full gap-1" id="godmode-nav">
                    <button class="godmode-tab-btn active" data-tab="global"><i class="fas fa-globe mr-2"></i> Global</button>
                    <button class="godmode-tab-btn" data-tab="sessionMap"><i class="fas fa-map mr-2"></i> Fog of War</button>
                    </nav>
            </header>

            <main class="flex-1 relative overflow-hidden flex" id="godmode-workspace">
                
                <aside id="godmode-sidebar" class="absolute lg:relative top-0 left-0 h-full w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700 z-[1000] flex flex-col transition-transform transform -translate-x-full lg:translate-x-0 shadow-2xl p-6">
                    <div id="sidebar-dynamic-content" class="flex-1 overflow-y-auto custom-scroll space-y-6">
                        </div>
                </aside>

                <div class="flex-1 bg-black relative" id="godmode-map-area">
                    <div id="godmode-leaflet-container" class="w-full h-full"></div>
                </div>

            </main>
        </div>
    `;

    setupTabs();
    initLeafletMap();
    loadTabContent('global'); // Carrega a aba padrão
}

function setupTabs() {
    const nav = document.getElementById('godmode-nav');
    const baseClasses = ['flex', 'items-center', 'px-6', 'h-full', 'text-[10px]', 'font-bold', 'uppercase', 'transition-all', 'whitespace-nowrap', 'text-slate-500', 'hover:text-slate-300', 'hover:bg-slate-800/30'];
    const activeClasses = ['text-amber-500', 'bg-slate-800', 'border-b-2', 'border-amber-500', 'shadow-inner'];

    nav.querySelectorAll('.godmode-tab-btn').forEach(btn => {
        btn.className = '';
        btn.classList.add(...baseClasses);
        if (btn.dataset.tab === godmodeState.activeTab) {
            btn.classList.add(...activeClasses);
            btn.classList.remove('text-slate-500');
        }

        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.dataset.tab;
            if (targetTab === godmodeState.activeTab) return;

            // Atualiza UI dos botões
            nav.querySelectorAll('.godmode-tab-btn').forEach(b => {
                b.classList.remove(...activeClasses);
                b.classList.add('text-slate-500');
            });
            e.currentTarget.classList.add(...activeClasses);
            e.currentTarget.classList.remove('text-slate-500');

            // Troca de aba real
            godmodeState.activeTab = targetTab;
            loadTabContent(targetTab);
        });
    });
}

function initLeafletMap() {
    if (mapInstance) {
        mapInstance.remove();
    }

    mapInstance = L.map('godmode-leaflet-container', { 
        crs: L.CRS.Simple, 
        minZoom: -1, 
        maxZoom: 2, 
        zoomControl: true, 
        preferCanvas: true 
    });

    const bounds = [[0, 0], [MAP_H, MAP_W]];
    
    // SOLUÇÃO DE PERFORMANCE 2: O MAP TILING
    // Quando você fatiar seu mapa (usando gdal2tiles ou MapTiler), comente a linha do imageOverlay e descomente a linha abaixo:
    // L.tileLayer('url_dos_seus_tiles/{z}/{x}/{y}.png', { bounds: bounds, noWrap: true }).addTo(mapInstance);
    
    L.imageOverlay(WORLD_MAP_URL, bounds).addTo(mapInstance);
    mapInstance.fitBounds(bounds);

    // Evento de clique no mapa (Usado para o Fog of War)
    mapInstance.on('mousedown', handleMapClick);
    mapInstance.on('mousemove', (e) => {
        // Permite "pintar" o Fog of war arrastando o mouse
        if (e.originalEvent.buttons === 1 && godmodeState.activeTab === 'sessionMap') {
            handleMapClick(e);
        }
    });
}

function clearMapLayers() {
    mapLayers.markers.forEach(m => mapInstance.removeLayer(m));
    mapLayers.markers = [];
    if (mapLayers.canvasFog) {
        mapInstance.removeLayer(mapLayers.canvasFog);
        mapLayers.canvasFog = null;
    }
}

// ============================================================================
// LAZY LOADING: GERENCIAMENTO DE DADOS POR ABA
// ============================================================================
async function loadTabContent(tab) {
    clearMapLayers();
    const sidebar = document.getElementById('sidebar-dynamic-content');
    
    // Desliga qualquer listener em tempo real antigo para poupar memória
    if (currentUnsubscribe) {
        currentUnsubscribe();
        currentUnsubscribe = null;
    }

    if (tab === 'global') {
        sidebar.innerHTML = `
            <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase border-b border-slate-800 pb-2"><i class="fas fa-globe mr-2"></i> Visão Global</h3>
            <p class="text-xs text-slate-400">Carregando todos os pontos do mundo (Leitura Única)...</p>
        `;
        
        // SOLUÇÃO DE PERFORMANCE 3: Leitura Única (getDocs) em vez de onSnapshot para a visão geral
        try {
            const locSnap = await getDocs(collection(db, 'rpg_locations'));
            const dungeonsSnap = await getDocs(collection(db, 'rpg_dungeons'));
            
            sidebar.innerHTML = `
                <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase border-b border-slate-800 pb-2"><i class="fas fa-globe mr-2"></i> Visão Global</h3>
                <div class="space-y-2 mt-4">
                    <div class="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-300">Cidades/Locais</span>
                        <span class="text-xs text-amber-500">${locSnap.size}</span>
                    </div>
                    <div class="bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-300">Dungeons</span>
                        <span class="text-xs text-red-500">${dungeonsSnap.size}</span>
                    </div>
                </div>
            `;

            // Renderiza Marcadores
            locSnap.forEach(doc => {
                const data = doc.data();
                const m = L.circleMarker([data.y, data.x], { radius: 5, color: '#f59e0b', fillColor: '#020617', fillOpacity: 1, weight: 2 })
                    .bindPopup(`<b class="font-cinzel text-amber-500">${data.name}</b><br><span class="text-xs text-slate-400">${data.type}</span>`)
                    .addTo(mapInstance);
                mapLayers.markers.push(m);
            });

        } catch(e) {
            console.error("Erro ao carregar mapa global", e);
        }

    } else if (tab === 'sessionMap') {
        sidebar.innerHTML = `
            <h3 class="font-cinzel text-sky-400 text-sm font-bold uppercase border-b border-slate-800 pb-2"><i class="fas fa-map mr-2"></i> Névoa de Guerra</h3>
            <div class="mt-4">
                <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">Mesa Ativa</label>
                <select id="fog-session-select" class="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs font-bold text-slate-200 outline-none focus:border-sky-500 cursor-pointer">
                    <option value="">Carregando sessões...</option>
                </select>
            </div>
            
            <div id="fog-tools-container" class="space-y-6 mt-6 hidden animate-fade-in">
                <div class="flex gap-2">
                    <button id="btn-tool-reveal" class="flex-1 py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 transition bg-sky-600 border border-sky-400 text-white shadow-lg">
                        <i class="fas fa-eye"></i> REVELAR
                    </button>
                    <button id="btn-tool-hide" class="flex-1 py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 transition bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
                        <i class="fas fa-eye-slash"></i> OCULTAR
                    </button>
                </div>
                
                <div class="text-[10px] text-slate-400 bg-slate-950 p-3 rounded border border-slate-800 italic">
                    <p class="mb-1 text-amber-500 font-bold"><i class="fas fa-info-circle mr-1"></i>Pinta o mapa (Buffer Local).</p>
                    Quando terminares, clica abaixo para validar as alterações no Firebase.
                </div>

                <div class="pt-4 border-t border-slate-700">
                    <button id="btn-sync-fog" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-4 rounded shadow-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-wider transition border border-amber-400">
                        <i class="fas fa-sync-alt"></i> SINCRONIZAR JOGADORES
                    </button>
                </div>
            </div>
        `;

        // SOLUÇÃO DE PERFORMANCE: Ouve apenas a coleção que o mestre está operando agora
        currentUnsubscribe = onSnapshot(collection(db, 'rpg_sessions'), (snap) => {
            godmodeState.sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const select = document.getElementById('fog-session-select');
            if (select) {
                const currentVal = select.value;
                select.innerHTML = '<option value="">Selecione uma Sessão...</option>' + 
                    godmodeState.sessions.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                
                if(currentVal && godmodeState.sessions.find(s => s.id === currentVal)) {
                    select.value = currentVal;
                }

                select.onchange = (e) => {
                    const sess = godmodeState.sessions.find(s => s.id === e.target.value);
                    godmodeState.selectedSession = sess;
                    godmodeState.localRevealed = sess ? (sess.revealedHexes || []) : [];
                    
                    document.getElementById('fog-tools-container').classList.toggle('hidden', !sess);
                    renderCanvasFogOfWar();
                };
            }
        });

        // Eventos dos botões de ferramentas
        setTimeout(() => {
            const btnReveal = document.getElementById('btn-tool-reveal');
            const btnHide = document.getElementById('btn-tool-hide');
            const btnSync = document.getElementById('btn-sync-fog');

            if(btnReveal && btnHide) {
                const updateToolUI = () => {
                    btnReveal.className = `flex-1 py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 transition ${godmodeState.toolMode === 'reveal' ? 'bg-sky-600 border border-sky-400 text-white shadow-lg scale-105' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`;
                    btnHide.className = `flex-1 py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 transition ${godmodeState.toolMode === 'hide' ? 'bg-red-900 border border-red-700 text-white shadow-lg scale-105' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`;
                    
                    const mapEl = document.getElementById('godmode-map-area');
                    mapEl.style.cursor = godmodeState.toolMode === 'reveal' ? 'crosshair' : 'not-allowed';
                };

                btnReveal.onclick = () => { godmodeState.toolMode = 'reveal'; updateToolUI(); };
                btnHide.onclick = () => { godmodeState.toolMode = 'hide'; updateToolUI(); };
            }

            if(btnSync) {
                btnSync.onclick = async () => {
                    if(!godmodeState.selectedSession) return;
                    btnSync.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SINCRONIZANDO...';
                    try {
                        await updateDoc(doc(db, 'rpg_sessions', godmodeState.selectedSession.id), {
                            revealedHexes: godmodeState.localRevealed
                        });
                        btnSync.innerHTML = '<i class="fas fa-check"></i> SINCRONIZADO!';
                        btnSync.classList.replace('bg-amber-600', 'bg-emerald-600');
                        setTimeout(() => {
                            btnSync.innerHTML = '<i class="fas fa-sync-alt"></i> SINCRONIZAR JOGADORES';
                            btnSync.classList.replace('bg-emerald-600', 'bg-amber-600');
                        }, 2000);
                    } catch(e) {
                        alert("Erro: " + e.message);
                        btnSync.innerHTML = '<i class="fas fa-times"></i> ERRO';
                    }
                };
            }
        }, 100);
    }
}


// ============================================================================
// SOLUÇÃO DE PERFORMANCE 1: CANVAS FOG OF WAR (Substitui 5000 polígonos)
// ============================================================================
function renderCanvasFogOfWar() {
    if (!mapInstance || godmodeState.activeTab !== 'sessionMap') return;

    if (mapLayers.canvasFog) {
        mapInstance.removeLayer(mapLayers.canvasFog);
    }

    // Cria uma camada Leaflet customizada usando HTML5 Canvas
    const CanvasOverlay = L.Layer.extend({
        onAdd: function (map) {
            this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
            // Tamanho fixo do mundo
            this._canvas.width = MAP_W;
            this._canvas.height = MAP_H;
            
            // Posiciona o canvas exatamente em cima das coordenadas da imagem
            const topLeft = map.latLngToLayerPoint([MAP_H, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);

            map.getPanes().overlayPane.appendChild(this._canvas);
            map.on('zoomanim', this._animateZoom, this);
            map.on('zoomend viewreset moveend', this._updatePosition, this);
            
            this._draw();
        },
        onRemove: function (map) {
            L.DomUtil.remove(this._canvas);
            map.off('zoomanim', this._animateZoom, this);
            map.off('zoomend viewreset moveend', this._updatePosition, this);
        },
        _updatePosition: function() {
            const topLeft = mapInstance.latLngToLayerPoint([MAP_H, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);
        },
        _animateZoom: function (e) {
            const scale = mapInstance.getZoomScale(e.zoom);
            const offset = mapInstance._latLngBoundsToNewLayerBounds([[0,0], [MAP_H, MAP_W]], e.zoom, e.center).min;
            L.DomUtil.setTransform(this._canvas, offset, scale);
        },
        _draw: function () {
            const ctx = this._canvas.getContext('2d');
            ctx.clearRect(0, 0, MAP_W, MAP_H);

            // Pinta o mundo inteiro de preto (Névoa)
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; // Slate-950 com opacidade
            ctx.fillRect(0, 0, MAP_W, MAP_H);

            // "Perfura" o canvas para revelar o mapa onde tem hexágonos
            ctx.globalCompositeOperation = 'destination-out';
            
            const HEX_W = Math.sqrt(3) * HEX_RADIUS;
            const VERT_DIST = HEX_RADIUS * 2 * 0.75;

            godmodeState.localRevealed.forEach(hexId => {
                const [rStr, cStr] = hexId.split('-');
                const r = parseInt(rStr);
                const c = parseInt(cStr);

                const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
                // Atenção: no canvas nativo, X e Y crescem da esquerda pra direita e topo pra baixo
                // A imagem do leaflet começa [0,0] em baixo-esquerda (coordenadas LatLng). 
                // Precisamos inverter o Y no desenho do canvas interno
                const centerX = (c * HEX_W) + xOffset;
                const centerY = MAP_H - (r * VERT_DIST); 

                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (60 * i - 30) * Math.PI / 180;
                    const hx = centerX + HEX_RADIUS * Math.cos(angle);
                    const hy = centerY + HEX_RADIUS * Math.sin(angle);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
            });
        }
    });

    mapLayers.canvasFog = new CanvasOverlay().addTo(mapInstance);
}

// Ação de Clique para Revelar/Ocultar
function handleMapClick(e) {
    if (godmodeState.activeTab !== 'sessionMap' || !godmodeState.selectedSession) return;

    // Converte o LatLng do Leaflet para o índice R, C do Grid
    const HEX_W = Math.sqrt(3) * HEX_RADIUS;
    const VERT_DIST = HEX_RADIUS * 2 * 0.75;
    
    const lat = e.latlng.lat; // Eixo Y no seu mapa CRS.Simple
    const lng = e.latlng.lng; // Eixo X
    
    // Acha a linha mais próxima
    const r = Math.round(lat / VERT_DIST);
    
    // Acha a coluna considerando o offset da linha (ziguezague)
    const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
    const c = Math.round((lng - xOffset) / HEX_W);

    const hexId = `${r}-${c}`;

    const isRevealed = godmodeState.localRevealed.includes(hexId);

    if (godmodeState.toolMode === 'reveal' && !isRevealed) {
        godmodeState.localRevealed.push(hexId);
        renderCanvasFogOfWar(); // Redesenha rápido o canvas
    } else if (godmodeState.toolMode === 'hide' && isRevealed) {
        godmodeState.localRevealed = godmodeState.localRevealed.filter(id => id !== hexId);
        renderCanvasFogOfWar();
    }
}
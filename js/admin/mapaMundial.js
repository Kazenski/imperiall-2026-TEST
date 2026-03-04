import { db } from '../core/firebase.js';
import { 
    collection, 
    doc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Atalho para React.createElement (Obrigatório para arquivos .js sem build)
const e = React.createElement;

// --- CONFIGURAÇÕES TÉCNICAS ---
const WORLD_MAP_URL = "https://firebasestorage.googleapis.com/v0/b/kazenski-a1bb2.firebasestorage.app/o/imagens_rpg%2FJna1SPdTpRYoo5jGrzZUem.jpg?alt=media";
const MAP_W = 2048;
const MAP_H = 1536;

const COLS = {
    LOCATIONS: 'rpg_locations',
    ROUTES: 'rpg_routes',
    ROUTE_TYPES: 'rpg_route_types',
    EVENTS: 'rpg_events',
    DUNGEONS: 'rpg_dungeons',
    WORLD: 'rpg_world_state'
};

// --- COMPONENTE DE ÍCONE (Sem JSX) ---
const Icon = ({ name, size = 18, className = "" }) => {
    const iconRef = React.useRef(null);
    React.useEffect(() => {
        if (window.lucide && iconRef.current) {
            iconRef.current.innerHTML = '';
            const i = document.createElement('i');
            i.setAttribute('data-lucide', name);
            i.style.width = `${size}px`;
            i.style.height = `${size}px`;
            if (className) i.className = className;
            iconRef.current.appendChild(i);
            window.lucide.createIcons({ nodes: [i] });
        }
    }, [name, size, className]);
    return e('span', { ref: iconRef, className: "inline-flex items-center justify-center" });
};

// --- MOTOR DE RENDERIZAÇÃO DO MAPA ---
const RPGMap = ({ mode, locations, revealedHexes, onHexClick, onMapClick, filters, dungeons, routes, routeTypes, events, isolated, tempPoints, tempPoint, tempRadius }) => {
    const mapRef = React.useRef(null);
    const mapInstance = React.useRef(null);
    const layersRef = React.useRef({ markers: [], hexes: [], lines: [], circles: [] });

    const HEX_W = Math.sqrt(3) * HEX_RADIUS;
    const VERT_DIST = HEX_RADIUS * 2 * 0.75;

    React.useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        const map = L.map(mapRef.current, { 
            crs: L.CRS.Simple, 
            minZoom: -1, 
            maxZoom: 2, 
            preferCanvas: true, 
            zoomControl: false,
            attributionControl: false 
        });
        const bounds = [[0, 0], [MAP_H, MAP_W]];
        L.imageOverlay(WORLD_MAP_URL, bounds).addTo(map);
        map.fitBounds(bounds);
        mapInstance.current = map;

        map.on('click', (ev) => { 
            if (onMapClick) onMapClick({ lat: ev.latlng.lat, lng: ev.latlng.lng }); 
        });
        
        return () => { map.remove(); mapInstance.current = null; };
    }, []);

    React.useEffect(() => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;
        Object.values(layersRef.current).forEach(group => group.forEach(l => map.removeLayer(l)));
        layersRef.current = { markers: [], hexes: [], lines: [], circles: [] };

        // Renderização da Névoa (Hexágonos)
        if (revealedHexes) {
            const hexRenderer = L.canvas({ padding: 0.5 });
            for (let r = 0; r < Math.ceil(MAP_H / VERT_DIST) + 1; r++) {
                for (let c = 0; c < Math.ceil(MAP_W / HEX_W) + 1; c++) {
                    const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
                    const centerX = (c * HEX_W) + xOffset;
                    const centerY = r * VERT_DIST;
                    const hexId = `${r}-${c}`;
                    const isRevealed = revealedHexes.includes(hexId);

                    const corners = [];
                    for (let i = 0; i < 6; i++) {
                        const angle = (60 * i - 30) * Math.PI / 180;
                        corners.push([centerY + HEX_RADIUS * Math.sin(angle), centerX + HEX_RADIUS * Math.cos(angle)]);
                    }

                    const poly = L.polygon(corners, {
                        renderer: hexRenderer,
                        color: isRevealed ? 'rgba(74, 222, 128, 0.1)' : 'rgba(15, 23, 42, 0.8)',
                        fillColor: isRevealed ? '#4ade80' : '#020617',
                        fillOpacity: isRevealed ? 0.1 : 0.8,
                        weight: 1,
                        interactive: !!onHexClick
                    }).addTo(map);

                    if (onHexClick) {
                        poly.on('mousedown', () => onHexClick(hexId));
                    }
                    layersRef.current.hexes.push(poly);
                }
            }
        }

        // Renderizar Cidades/Locais
        if (filters?.locations && locations) {
            locations.forEach(loc => {
                const m = L.circleMarker([loc.y, loc.x], { radius: 6, color: '#f59e0b', weight: 2, fillOpacity: 1, fillColor: '#0f172a' })
                    .bindPopup(`<b>${loc.name}</b>`)
                    .addTo(map);
                layersRef.current.markers.push(m);
            });
        }
    }, [revealedHexes, locations, filters]);

    return e('div', { ref: mapRef, className: "w-full h-full bg-slate-950" });
};

// --- COMPONENTE PRINCIPAL DO MÓDULO ---
const GlobalTab = () => {
    const [data, setData] = React.useState({ locations: [], routes: [], dungeons: [], types: {}, world: {} });
    const [filters, setFilters] = React.useState({ locations: true, dungeons: true, routes: true, events: true });

    React.useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, COLS.LOCATIONS), s => setData(p => ({...p, locations: s.docs.map(d => d.data())}))),
            onSnapshot(collection(db, COLS.DUNGEONS), s => setData(p => ({...p, dungeons: s.docs.map(d => d.data())}))),
            onSnapshot(collection(db, COLS.ROUTES), s => setData(p => ({...p, routes: s.docs.map(d => d.data())}))),
            onSnapshot(collection(db, COLS.ROUTE_TYPES), s => {
                const t = {}; s.docs.forEach(d => t[d.id] = d.data());
                setData(p => ({...p, types: t}));
            }),
            onSnapshot(doc(db, COLS.WORLD, 'main'), d => setData(p => ({...p, world: d.data() || {}})))
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    return (
        <div className="flex w-full h-full bg-slate-950 relative overflow-hidden fade-in">
            {/* Mapa (Camada Base) */}
            <div className="absolute inset-0 z-0">
                <RPGMap data={data} filters={filters} />
            </div>

            {/* Interface Overlay: Camadas */}
            <div className="absolute top-6 right-6 z-10 w-64 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg p-4 shadow-2xl">
                <h3 className="font-cinzel text-amber-500 text-xs font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                    <Icon name="layers" size={14} /> Filtros de Visão
                </h3>
                <div className="space-y-3">
                    {Object.keys(filters).map(f => (
                        <label key={f} className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input 
                                    type="checkbox" 
                                    checked={filters[f]} 
                                    onChange={e => setFilters(prev => ({...prev, [f]: e.target.checked}))}
                                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-800 checked:bg-amber-600 transition-all"
                                />
                                <Icon name="check" size={10} className="absolute left-0.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                            </div>
                            <span className="text-xs text-slate-400 group-hover:text-slate-200 capitalize">
                                {f === 'locations' ? 'Cidades e Vilas' : f}
                            </span>
                        </label>
                    ))}
                </div>
                
                {/* Status do Tempo em Tempo Real */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
                        <span>Tempo Mundial</span>
                        <span className="text-amber-500/80 animate-pulse">Live</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <Icon name="clock" size={12} className="text-slate-500" />
                        <span className="text-sm font-bold text-slate-200">{data.world.time || '00:00'}</span>
                        <span className="text-[10px] text-slate-500">Dia {data.world.day || 1}</span>
                    </div>
                </div>
            </div>

            {/* Legenda de Navegação no Canto Inferior */}
            <div className="absolute bottom-6 left-6 z-10 bg-slate-900/60 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-800 text-[10px] text-slate-400 font-medium">
                <span className="text-amber-500">Botão Esquerdo:</span> Arrastar • <span className="text-amber-500">Scroll:</span> Zoom
            </div>
        </div>
    );
};

// // --- EXPORTAÇÃO DO MÓDULO ---
// export async function renderMapaMundialTab() {
//     const container = document.getElementById('tab-content');
//     if (!container) return;
    
//     // Renderiza a aba Global
//     const root = ReactDOM.createRoot(container);
//     root.render(<GlobalTab />);
// }

// --- MÓDULO: SESSÕES (Geral) ---
const SessionsModule = ({ showAlert }) => {
    const [sessions, setSessions] = React.useState([]);
    const [players, setPlayers] = React.useState([]);
    const [editing, setEditing] = React.useState(null);

    React.useEffect(() => {
        const unsubS = onSnapshot(collection(db, COLS.SESSIONS), s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubP = onSnapshot(query(collection(db, COLS.PLAYERS), orderBy('nome')), s => setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubS(); unsubP(); };
    }, []);

    const saveSession = async () => {
        if (!editing.name) return showAlert("Nome obrigatório.");
        const data = { ...editing, lastUpdate: serverTimestamp() };
        if (editing.id) await updateDoc(doc(db, COLS.SESSIONS, editing.id), data);
        else await addDoc(collection(db, COLS.SESSIONS), data);
        setEditing(null);
        showAlert("Sessão guardada.");
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 p-4 overflow-y-auto" },
            e('button', { 
                onClick: () => setEditing({ name: '', playerIds: [], customTime: '12:00', customDay: 1, paused: true }),
                className: "w-full bg-indigo-600 text-white py-2 rounded font-bold text-xs mb-4"
            }, "+ NOVA SESSÃO"),
            sessions.map(s => e('div', {
                key: s.id,
                onClick: () => setEditing(s),
                className: `p-3 rounded cursor-pointer border-l-4 mb-2 ${editing?.id === s.id ? 'bg-slate-800 border-indigo-500' : 'bg-slate-900/30 border-transparent'}`
            }, 
                e('div', { className: "text-sm font-bold" }, s.name),
                e('div', { className: "text-[10px] text-slate-500" }, `${s.customTime} | Dia ${s.customDay}`)
            ))
        ),
        e('div', { className: "flex-1 p-8 overflow-y-auto" },
            editing ? e('div', { className: "max-w-2xl mx-auto bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6" },
                e('h3', { className: "font-cinzel text-indigo-400 text-xl" }, "Configurar Sessão"),
                e('div', null, 
                    e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Nome"),
                    e('input', { value: editing.name, onChange: ev => setEditing({...editing, name: ev.target.value}), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white mt-1" })
                ),
                e('div', { className: "grid grid-cols-2 gap-4" },
                    e('div', null, 
                        e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Hora"),
                        e('input', { type: "time", value: editing.customTime, onChange: ev => setEditing({...editing, customTime: ev.target.value}), className: "w-full bg-slate-800 p-2 rounded text-white" })
                    ),
                    e('div', null, 
                        e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Dia"),
                        e('input', { type: "number", value: editing.customDay, onChange: ev => setEditing({...editing, customDay: parseInt(ev.target.value)}), className: "w-full bg-slate-800 p-2 rounded text-white" })
                    )
                ),
                e('button', { onClick: saveSession, className: "w-full bg-green-700 py-3 rounded font-bold text-sm" }, "SALVAR SESSÃO")
            ) : e('div', { className: "flex h-full items-center justify-center opacity-10" }, e(Icon, { name: "users", size: 64 }))
        )
    );
};

// --- MÓDULO: MAPA DE SESSÕES (Fog of War) ---
const SessionMapModule = ({ showAlert }) => {
    const [sessions, setSessions] = React.useState([]);
    const [selectedSession, setSelectedSession] = React.useState(null);
    const [toolMode, setToolMode] = React.useState('reveal'); 
    const [localRevealed, setLocalRevealed] = React.useState([]);

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.SESSIONS), s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const syncToFirebase = async () => {
        if (!selectedSession) return;
        await updateDoc(doc(db, COLS.SESSIONS, selectedSession.id), { revealedHexes: localRevealed });
        showAlert("Mapa sincronizado!");
    };

    return e('div', { className: "flex h-full relative" },
        e('div', { className: "absolute top-6 left-6 z-[1001] w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-lg shadow-2xl space-y-4" },
            e('h3', { className: "font-cinzel text-sky-400 text-xs font-bold uppercase border-b border-slate-800 pb-2" }, "Controle de Névoa"),
            e('select', { 
                className: "w-full bg-slate-800 p-2 rounded text-xs text-white",
                onChange: ev => {
                    const s = sessions.find(sess => sess.id === ev.target.value);
                    setSelectedSession(s);
                    setLocalRevealed(s?.revealedHexes || []);
                }
            }, 
                e('option', { value: "" }, "Escolher Sessão..."),
                sessions.map(s => e('option', { key: s.id, value: s.id }, s.name))
            ),
            selectedSession && e('div', { className: "space-y-2" },
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: () => setToolMode('reveal'), className: `flex-1 py-2 rounded text-[10px] font-bold border ${toolMode === 'reveal' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}` }, "REVELAR"),
                    e('button', { onClick: () => setToolMode('hide'), className: `flex-1 py-2 rounded text-[10px] font-bold border ${toolMode === 'hide' ? 'bg-red-900 border-red-700 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}` }, "OCULTAR")
                ),
                e('button', { onClick: syncToFirebase, className: "w-full bg-amber-600 text-white py-3 rounded font-bold text-xs shadow-xl" }, "SINCRONIZAR AGORA")
            )
        ),
        e('div', { className: "flex-1 bg-slate-950" },
            e(RPGMap, { 
                revealedHexes: localRevealed,
                onHexClick: (id) => setLocalRevealed(prev => toolMode === 'reveal' ? [...new Set([...prev, id])] : prev.filter(x => x !== id)),
                filters: { locations: true }
            })
        )
    );
};

// --- MÓDULO: DUNGEONS (Exploração e Loot) ---
const DungeonsModule = ({ showAlert }) => {
    const [dungeons, setDungeons] = React.useState([]);
    const [editing, setEditing] = React.useState(null);

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.DUNGEONS), s => setDungeons(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => setEditing({ name: '', difficulty: 1 }),
                    className: "w-full bg-red-800 text-white py-2 rounded font-bold text-xs"
                }, "+ NOVA DUNGEON")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-1" },
                dungeons.map(d => e('div', {
                    key: d.id,
                    onClick: () => setEditing(d),
                    className: `p-3 rounded cursor-pointer border-l-4 ${editing?.id === d.id ? 'bg-slate-800 border-red-500' : 'border-transparent'}`
                }, d.name))
            )
        ),
        e('div', { className: "flex-1 p-8" },
            editing ? e('div', { className: "max-w-md bg-slate-900 p-6 rounded border border-slate-700 shadow-2xl" },
                e('h3', { className: "font-cinzel text-red-500 mb-4" }, "Configurar Dungeon"),
                e('input', { 
                    value: editing.name, 
                    onChange: ev => setEditing({...editing, name: ev.target.value}),
                    className: "w-full bg-slate-800 p-2 rounded text-white mb-4" 
                }),
                e('button', { onClick: () => showAlert("Dungeon Salva"), className: "w-full bg-red-800 py-2 rounded font-bold" }, "SALVAR")
            ) : e('div', { className: "flex h-full items-center justify-center opacity-20" }, e(Icon, { name: "castle", size: 64 }))
        )
    );
};

// --- MÓDULO: LOCAIS (Cidades e Vilas) ---
const LocationsModule = ({ showAlert }) => {
    const [list, setList] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('basic');

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.LOCATIONS), (s) => {
            setList(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, []);

    const handleSave = async (e_event) => {
        e_event.preventDefault();
        const fd = new FormData(e_event.target);
        const formData = Object.fromEntries(fd.entries());
        const finalData = {
            ...formData,
            pop: parseInt(formData.pop) || 0,
            x: editing.x || 0,
            y: editing.y || 0
        };
        await addDoc(collection(db, COLS.LOCATIONS), finalData);
        setEditing(null);
        showAlert("Local salvo!");
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => setEditing({ name: '', type: 'Cidade', x: 0, y: 0 }),
                    className: "w-full bg-emerald-700 text-white py-2 rounded font-bold text-xs"
                }, "+ NOVO LOCAL")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-1" },
                list.map(i => e('div', {
                    key: i.id,
                    onClick: () => setEditing(i),
                    className: `p-3 rounded cursor-pointer border ${editing?.id === i.id ? 'bg-slate-800 border-emerald-500' : 'border-transparent'}`
                }, e('div', { className: "text-sm font-bold" }, i.name)))
            )
        ),
        e('div', { className: "flex-1 relative bg-slate-950" },
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-80 bg-slate-900 p-6 rounded-lg border border-slate-700 shadow-2xl" },
                e('h3', { className: "font-cinzel text-emerald-400 mb-4" }, "Editor de Local"),
                e('form', { onSubmit: handleSave, className: "space-y-4" },
                    e('input', { name: "name", defaultValue: editing.name, placeholder: "Nome", className: "w-full bg-slate-800 p-2 rounded text-sm text-white" }),
                    e('button', { type: "submit", className: "w-full bg-emerald-700 py-2 rounded font-bold text-xs" }, "GUARDAR")
                )
            )
        )
    );
};

// --- MÓDULO: ROTAS (Caminhos e Logística) ---
const RoutesModule = ({ showAlert }) => {
    const [routes, setRoutes] = React.useState([]);
    const [types, setTypes] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [tempPoints, setTempPoints] = React.useState([]);

    React.useEffect(() => {
        const unsubR = onSnapshot(collection(db, COLS.ROUTES), s => setRoutes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubT = onSnapshot(collection(db, COLS.ROUTE_TYPES), s => setTypes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubR(); unsubT(); };
    }, []);

    const saveRoute = async () => {
        if (!editing.name || tempPoints.length < 2) return showAlert("A rota precisa de nome e 2 pontos.");
        const data = { ...editing, points: tempPoints };
        if (editing.id) await updateDoc(doc(db, COLS.ROUTES, editing.id), data);
        else await addDoc(collection(db, COLS.ROUTES), data);
        setEditing(null);
        setTempPoints([]);
        showAlert("Rota guardada!");
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => { setEditing({name: '', typeId: '', duration: 60}); setTempPoints([]); },
                    className: "w-full bg-amber-600 text-white py-2 rounded font-bold text-xs shadow-lg"
                }, "+ NOVA ROTA")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-2 custom-scroll" },
                routes.map(r => {
                    const type = types.find(t => t.id === r.typeId);
                    return e('div', {
                        key: r.id,
                        onClick: () => { setEditing(r); setTempPoints(r.points || []); },
                        className: `p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === r.id ? 'bg-slate-800 border-amber-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`,
                        style: { borderLeftColor: type?.color || '#475569' }
                    }, 
                        e('div', { className: "text-sm font-bold text-slate-200" }, r.name),
                        e('div', { className: "text-[10px] text-slate-500 mt-1 uppercase" }, `${type?.name || 'Estrada'} | ${r.duration} min`)
                    );
                })
            )
        ),
        e('div', { className: "flex-1 relative bg-slate-950" },
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-80 bg-slate-900/95 p-6 rounded-lg border border-slate-700 shadow-2xl space-y-4" },
                e('h3', { className: "font-cinzel text-amber-500 text-lg" }, "Editor de Rota"),
                e('input', { 
                    value: editing.name, 
                    onChange: ev => setEditing({...editing, name: ev.target.value}),
                    placeholder: "Nome da Rota",
                    className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none" 
                }),
                e('select', {
                    value: editing.typeId,
                    onChange: ev => setEditing({...editing, typeId: ev.target.value}),
                    className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white"
                }, 
                    e('option', { value: "" }, "Tipo de Caminho..."),
                    types.map(t => e('option', { key: t.id, value: t.id }, t.name))
                ),
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: saveRoute, className: "flex-1 bg-amber-700 py-2 rounded font-bold text-xs" }, "GUARDAR"),
                    e('button', { onClick: () => setEditing(null), className: "px-4 bg-slate-800 text-slate-400 rounded text-xs" }, "X")
                )
            )
        )
    );
};

// --- MÓDULO: EVENTOS (Efeitos de Área) ---
const EventsModule = ({ showAlert }) => {
    const [events, setEvents] = React.useState([]);
    const [editing, setEditing] = React.useState(null);

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.EVENTS), s => setEvents(s.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    const saveEvent = async () => {
        if (!editing.name) return showAlert("Nome obrigatório.");
        if (editing.id) await updateDoc(doc(db, COLS.EVENTS, editing.id), editing);
        else await addDoc(collection(db, COLS.EVENTS), editing);
        setEditing(null);
        showAlert("Evento guardado!");
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => setEditing({name: '', radius: 150, chance: 10, color: '#9333ea', icon: 'zap'}),
                    className: "w-full bg-purple-700 text-white py-2 rounded font-bold text-xs"
                }, "+ NOVO EVENTO")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-2" },
                events.map(ev => e('div', {
                    key: ev.id,
                    onClick: () => setEditing(ev),
                    className: `p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === ev.id ? 'bg-slate-800 border-purple-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`,
                    style: { borderLeftColor: ev.color }
                }, e('div', { className: "text-sm font-bold text-slate-200" }, ev.name)))
            )
        ),
        e('div', { className: "flex-1 relative bg-slate-950" },
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-80 bg-slate-900/95 p-6 rounded-lg border border-slate-700 shadow-2xl space-y-4" },
                e('h3', { className: "font-cinzel text-purple-400 text-lg" }, "Configurar Evento"),
                e('input', { 
                    value: editing.name, 
                    onChange: ev => setEditing({...editing, name: ev.target.value}),
                    className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white" 
                }),
                e('input', { 
                    type: "range", min: "50", max: "1000", value: editing.radius,
                    onChange: ev => setEditing({...editing, radius: parseInt(ev.target.value)}),
                    className: "w-full accent-purple-500"
                }),
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: saveEvent, className: "flex-1 bg-purple-700 py-2 rounded font-bold text-xs" }, "SALVAR"),
                    e('button', { onClick: () => setEditing(null), className: "px-4 bg-slate-800 text-slate-400 rounded text-xs" }, "X")
                )
            )
        )
    );
};

// --- MÓDULO: CRONOLOGIA (Tempo e Mundo) ---
const ChronologyModule = () => {
    const [state, setState] = React.useState({ year:1, month:1, day:1, time:'12:00', seasonId:'' });
    const [seasons, setSeasons] = React.useState([]);

    React.useEffect(() => {
        onSnapshot(doc(db, COLS.WORLD, 'main'), d => setState(d.data() || {}));
        onSnapshot(collection(db, COLS.SEASONS), s => setSeasons(s.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    const updateWorld = (key, val) => updateDoc(doc(db, COLS.WORLD, 'main'), { [key]: val });
    const moon = getLunarState(state.day, state.month, state.year);

    return e('div', { className: "flex h-full animate-fade-in bg-slate-950" },
        e('div', { className: "flex-1 flex flex-col items-center justify-center p-10" },
            e('div', { className: "w-96 h-96 rounded-full border-8 border-slate-800 flex flex-col items-center justify-center shadow-2xl bg-slate-900/20" },
                e(Icon, { name: "sun", size: 48, className: "text-amber-400 mb-4" }),
                e('div', { className: "text-6xl font-mono font-bold text-white tracking-widest" }, state.time),
                e('div', { className: "text-sm font-cinzel text-slate-500 mt-4 tracking-[0.2em]" }, `DIA ${state.day} • MÊS ${state.month} • ANO ${state.year}`)
            ),
            e('div', { className: "mt-12 w-full max-w-md bg-slate-900/50 border border-slate-700 p-6 rounded-xl flex items-center gap-6" },
                e('div', { className: "w-16 h-16 rounded-full", style: { backgroundColor: moon.color } }),
                e('div', { className: "flex-1" },
                    e('h4', { className: "font-cinzel text-slate-200 text-lg uppercase" }, moon.name),
                    e('p', { className: "text-[10px] text-slate-500 mt-1" }, `PRÓXIMA FASE EM ${moon.daysToNext} DIAS`)
                )
            )
        ),
        e('div', { className: "w-80 bg-slate-900 border-l border-slate-800 p-6 space-y-6" },
            e('h3', { className: "font-cinzel text-amber-500 text-xl border-b border-slate-800 pb-2" }, "Controlo do Tempo"),
            e('div', { className: "grid grid-cols-2 gap-4" },
                e('input', { type: "time", value: state.time, onChange: ev => updateWorld('time', ev.target.value), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono" }),
                e('input', { type: "number", value: state.day, onChange: ev => updateWorld('day', parseInt(ev.target.value)), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" })
            ),
            e('select', { 
                value: state.seasonId, 
                onChange: ev => updateWorld('seasonId', ev.target.value),
                className: "w-full bg-slate-800 border border-slate-700 p-3 rounded text-amber-500 font-cinzel text-sm"
            }, 
                e('option', { value: "" }, "Estação Vigente..."),
                seasons.map(s => e('option', { key: s.id, value: s.id }, s.name))
            )
        )
    );
};

const MapaMundialApp = () => {
    const [page, setPage] = React.useState('view'); 
    const [modal, setModal] = React.useState(null);

    const showAlert = (message) => setModal({ type: 'alert', message });

    const navItems = [
        { id: 'view', icon: 'globe', label: 'Global', color: 'text-amber-500' },
        { id: 'sessions', icon: 'users', label: 'Sessões', color: 'text-indigo-400' },
        { id: 'sessionMap', icon: 'map', label: 'Fog of War', color: 'text-sky-400' },
        { id: 'dungeons', icon: 'castle', label: 'Dungeons', color: 'text-red-500' },
        { id: 'locations', icon: 'land-plot', label: 'Locais', color: 'text-emerald-500' },
        { id: 'routes', icon: 'route', label: 'Rotas', color: 'text-amber-600' },
        { id: 'events', icon: 'zap', label: 'Eventos', color: 'text-purple-400' },
        { id: 'isolated', icon: 'sword', label: 'Encontros', color: 'text-red-400' },
        { id: 'time', icon: 'hourglass', label: 'Tempo', color: 'text-slate-400' },
    ];

    return e('div', { className: "flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-hidden" },
        // HEADER COM TODOS OS BOTÕES
        e('header', { className: "flex items-center bg-slate-900 border-b border-slate-800 h-14 shrink-0 z-50 overflow-x-auto no-scrollbar shadow-xl" },
            navItems.map(item => (
                e('button', {
                    key: item.id,
                    onClick: () => setPage(item.id),
                    className: `flex items-center gap-2 px-6 h-full text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        page === item.id 
                        ? `${item.color} bg-slate-800 border-b-2 border-current shadow-inner` 
                        : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                    }`
                }, 
                    e(Icon, { name: item.icon, size: 14 }),
                    e('span', { className: "hidden sm:inline tracking-widest font-cinzel" }, item.label)
                )
            ))
        ),

        // ÁREA DE CONTEÚDO
        e('main', { className: "flex-1 relative overflow-hidden" },
            page === 'view' && e(GlobalTab, { data: {}, filters: {} }), // Exemplo de chamada
            // Outras abas serão chamadas da mesma forma: e(SessionsModule, { showAlert }), etc.
        ),

        // MODAL DE AVISO
        modal && e('div', { 
            className: "fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in",
            onClick: () => setModal(null)
        },
            e('div', { 
                className: "bg-slate-900 border border-slate-700 p-8 rounded-lg max-w-sm w-full shadow-2xl relative",
                onClick: e => e.stopPropagation()
            },
                e('div', { className: "absolute top-0 left-0 w-full h-1 bg-amber-600" }),
                e('h4', { className: "font-cinzel text-amber-500 mb-4 tracking-widest uppercase text-xs font-bold" }, "Aviso do Sistema"),
                e('p', { className: "text-slate-300 text-sm mb-8 leading-relaxed" }, modal.message),
                e('button', { 
                    onClick: () => setModal(null),
                    className: "w-full bg-slate-800 hover:bg-amber-700 py-3 rounded font-bold text-white text-[10px] uppercase tracking-widest transition-all"
                }, "Fechar")
            )
        )
    );
};

export async function renderMapaMundialTab() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    const root = ReactDOM.createRoot(container);
    root.render(e(MapaMundialApp));
}
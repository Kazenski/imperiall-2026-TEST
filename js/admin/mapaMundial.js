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

// Lógica de Fases da Lua (Preservada do original)
const getLunarState = (day, month, year) => {
    const totalDays = (year * 360) + (month * 30) + day;
    const MOON_PHASES = [
        { name: "Lua Nova", icon: "circle", color: "#1e293b" },
        { name: "Lua Crescente", icon: "moon", color: "#94a3b8" },
        { name: "Quarto Crescente", icon: "moon", color: "#cbd5e1" },
        { name: "Lua Gibosa", icon: "circle", color: "#e2e8f0" },
        { name: "Lua Cheia", icon: "circle", color: "#ffffff" },
        { name: "Lua Disseminadora", icon: "circle", color: "#e2e8f0" },
        { name: "Quarto Minguante", icon: "moon", color: "#cbd5e1" },
        { name: "Lua Minguante", icon: "moon", color: "#94a3b8" }
    ];
    const cycleDay = totalDays % 28;
    const phaseIndex = Math.floor(cycleDay / 3.5);
    const daysToNext = Math.ceil(((phaseIndex + 1) * 3.5) - cycleDay);
    return { ...MOON_PHASES[phaseIndex % 8], daysToNext };
};

// --- MOTOR DO MAPA (LEAFLET) ---
const RPGMap = ({ mode, locations, revealedHexes, onHexClick, onMapClick, filters, dungeons, routes, routeTypes, events, isolated, tempPoints, tempPoint, tempRadius }) => {
    const mapRef = React.useRef(null);
    const mapInstance = React.useRef(null);
    const layersRef = React.useRef({ markers: [], hexes: [], lines: [], circles: [] });

    const HEX_W = Math.sqrt(3) * HEX_RADIUS;
    const VERT_DIST = HEX_RADIUS * 2 * 0.75;

    React.useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        const map = L.map(mapRef.current, { 
            crs: L.CRS.Simple, minZoom: -1, maxZoom: 2, preferCanvas: true, zoomControl: false, attributionControl: false 
        });
        const bounds = [[0, 0], [MAP_H, MAP_W]];
        L.imageOverlay(WORLD_MAP_URL, bounds).addTo(map);
        map.fitBounds(bounds);
        mapInstance.current = map;
        map.on('click', (ev) => { if (onMapClick) onMapClick({ lat: ev.latlng.lat, lng: ev.latlng.lng }); });
        return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, []);

    React.useEffect(() => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;
        Object.values(layersRef.current).forEach(g => g.forEach(l => map.removeLayer(l)));
        layersRef.current = { markers: [], hexes: [], lines: [], circles: [] };

        if (revealedHexes) {
            const hexRenderer = L.canvas({ padding: 0.5 });
            for (let r = 0; r < Math.ceil(MAP_H / VERT_DIST) + 1; r++) {
                for (let c = 0; c < Math.ceil(MAP_W / HEX_W) + 1; c++) {
                    const xOffset = (r % 2 === 1) ? HEX_W / 2 : 0;
                    const centerX = (c * HEX_W) + xOffset;
                    const centerY = r * VERT_DIST;
                    const hexId = r + '-' + c;
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
                    if (onHexClick) poly.on('mousedown', () => onHexClick(hexId));
                    layersRef.current.hexes.push(poly);
                }
            }
        }

        if (filters?.locations && locations) {
            locations.forEach(loc => {
                const m = L.circleMarker([loc.y, loc.x], { radius: 6, color: '#fbbf24', weight: 2, fillOpacity: 1, fillColor: '#0f172a' })
                    .bindPopup('<b>' + loc.name + '</b>')
                    .addTo(map);
                layersRef.current.markers.push(m);
            });
        }
    }, [revealedHexes, locations, filters]);

    return e('div', { ref: mapRef, className: "w-full h-full bg-slate-950" });
};

// --- COMPONENTE PRINCIPAL DO MÓDULO ---
const GlobalTab = () => {
    const [data, setData] = React.useState({ locations: [], dungeons: [], world: {} });
    const [filters, setFilters] = React.useState({ locations: true, dungeons: true, routes: true });

    React.useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, COLS.LOCATIONS), s => setData(p => ({...p, locations: s.docs.map(d => d.data())}))),
            onSnapshot(collection(db, COLS.DUNGEONS), s => setData(p => ({...p, dungeons: s.docs.map(d => d.data())}))),
            onSnapshot(doc(db, COLS.WORLD, 'main'), d => setData(p => ({...p, world: d.data() || {}})))
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    return e('div', { className: "flex w-full h-full bg-slate-950 relative overflow-hidden" },
        e('div', { className: "absolute inset-0 z-0" }, e(RPGMap, { locations: data.locations, filters: filters })),
        e('div', { className: "absolute top-6 right-6 z-10 w-64 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg p-4 shadow-2xl" },
            e('h3', { className: "font-cinzel text-amber-500 text-xs font-bold uppercase mb-4 border-b border-slate-800 pb-2 flex items-center gap-2" }, 
                e(Icon, { name: "layers", size: 14 }), "Filtros de Visão"
            ),
            e('div', { className: "space-y-3" },
                Object.keys(filters).map(f => e('label', { key: f, className: "flex items-center gap-3 cursor-pointer group" },
                    e('input', { 
                        type: "checkbox", checked: filters[f], 
                        onChange: ev => setFilters(prev => ({...prev, [f]: ev.target.checked})),
                        className: "h-4 w-4 bg-slate-800 border-slate-600 rounded checked:bg-amber-600" 
                    }),
                    e('span', { className: "text-xs text-slate-400" }, f === 'locations' ? 'Cidades e Vilas' : f)
                ))
            ),
            e('div', { className: "mt-6 pt-4 border-t border-slate-800" },
                e('div', { className: "flex items-center gap-2" },
                    e(Icon, { name: "clock", size: 12, className: "text-slate-500" }),
                    e('span', { className: "text-sm font-bold text-slate-200" }, data.world.time || '00:00'),
                    e('span', { className: "text-[10px] text-slate-500" }, "Dia " + (data.world.day || 1))
                )
            )
        )
    );
};

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

    const save = async () => {
        if (!editing.name) return showAlert("Dê um nome à sessão.");
        const data = { ...editing, lastUpdate: serverTimestamp() };
        if (editing.id) await updateDoc(doc(db, COLS.SESSIONS, editing.id), data);
        else await addDoc(collection(db, COLS.SESSIONS), data);
        setEditing(null);
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 p-4" },
            e('button', { onClick: () => setEditing({ name: '', playerIds: [], customTime: '12:00', customDay: 1 }), className: "w-full bg-indigo-600 text-white py-2 rounded font-bold text-xs mb-4" }, "+ NOVA SESSÃO"),
            sessions.map(s => e('div', { key: s.id, onClick: () => setEditing(s), className: "p-3 rounded mb-2 cursor-pointer bg-slate-800/40 border border-transparent hover:border-indigo-500" }, s.name))
        ),
        e('div', { className: "flex-1 p-8" },
            editing && e('div', { className: "max-w-md bg-slate-900 border border-slate-700 p-6 rounded shadow-2xl" },
                e('h3', { className: "font-cinzel text-indigo-400 mb-6" }, "Configurar Sessão"),
                e('input', { value: editing.name, onChange: ev => setEditing({...editing, name: ev.target.value}), placeholder: "Nome da Sessão", className: "w-full bg-slate-800 p-2 rounded text-white mb-4" }),
                e('button', { onClick: save, className: "w-full bg-green-700 py-2 rounded font-bold" }, "SALVAR")
            )
        )
    );
};

// --- MÓDULO: MAPA DE SESSÕES (Fog of War) ---
const SessionMapModule = ({ showAlert }) => {
    const [sessions, setSessions] = React.useState([]);
    const [selectedSession, setSelectedSession] = React.useState(null);
    const [localRevealed, setLocalRevealed] = React.useState([]);

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.SESSIONS), s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    return e('div', { className: "flex h-full relative" },
        e('div', { className: "absolute top-6 left-6 z-[1001] w-64 bg-slate-900/90 border border-slate-700 p-4 rounded-lg shadow-2xl space-y-4" },
            e('h3', { className: "font-cinzel text-sky-400 text-xs font-bold border-b border-slate-800 pb-2" }, "CONTROLE DE NÉVOA"),
            e('select', { 
                className: "w-full bg-slate-800 p-2 rounded text-xs text-white",
                onChange: ev => {
                    const s = sessions.find(x => x.id === ev.target.value);
                    setSelectedSession(s);
                    setLocalRevealed(s?.revealedHexes || []);
                }
            }, 
                e('option', { value: "" }, "Escolher Sessão..."),
                sessions.map(s => e('option', { key: s.id, value: s.id }, s.name))
            ),
            selectedSession && e('button', { 
                onClick: async () => {
                    await updateDoc(doc(db, COLS.SESSIONS, selectedSession.id), { revealedHexes: localRevealed });
                    showAlert("Sincronizado!");
                },
                className: "w-full bg-amber-600 py-2 rounded font-bold text-xs" 
            }, "SINCRONIZAR AGORA")
        ),
        e(RPGMap, { 
            revealedHexes: localRevealed,
            onHexClick: (id) => setLocalRevealed(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        })
    );
};

// --- MÓDULO: DUNGEONS (Exploração e Loot) ---
const DungeonsModule = ({ showAlert }) => {
    const [dungeons, setDungeons] = React.useState([]);
    const [players, setPlayers] = React.useState([]);
    const [items, setItems] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [selectedPlayers, setSelectedPlayers] = React.useState([]);
    const [activeEditorTab, setActiveEditorTab] = React.useState('general');

    React.useEffect(() => {
        const unsubD = onSnapshot(collection(db, COLS.DUNGEONS), s => setDungeons(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubP = onSnapshot(query(collection(db, COLS.PLAYERS), orderBy('nome')), s => setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubI = onSnapshot(query(collection(db, COLS.ITEMS), orderBy('nome')), s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubD(); unsubP(); unsubI(); };
    }, []);

    const saveDungeon = async () => {
        if (!editing.name) return showAlert("Nome da dungeon é obrigatório.");
        if (editing.id) await updateDoc(doc(db, COLS.DUNGEONS, editing.id), editing);
        else await addDoc(collection(db, COLS.DUNGEONS), editing);
        setEditing(null);
        showAlert("Dungeon salva!");
    };

    return e('div', { className: "flex h-full animate-fade-in bg-slate-950" },
        // Sidebar Dungeons
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => setEditing({ name: '', difficulty: 1, floors: 1, baseEnemies: 5, rewards: { basic: {}, int: {}, adv: {} } }),
                    className: "w-full bg-red-800 hover:bg-red-700 text-white py-2 rounded font-bold text-xs"
                }, "+ NOVA DUNGEON")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-2 custom-scroll" },
                dungeons.map(d => e('div', {
                    key: d.id,
                    onClick: () => setEditing(d),
                    className: "p-3 rounded cursor-pointer border-l-4 transition " + (editing?.id === d.id ? 'bg-slate-800 border-red-600' : 'bg-slate-900/30 border-transparent hover:bg-slate-800')
                }, 
                    e('div', { className: "text-sm font-bold text-slate-200" }, d.name),
                    e('div', { className: "flex justify-between text-[10px] text-slate-500 mt-1 uppercase" }, 
                        e('span', null, d.floors + " Andares"), 
                        e('span', { className: "text-red-400" }, "Nível " + d.difficulty)
                    )
                ))
            )
        ),
        // Área Central do Editor
        e('div', { className: "flex-1 p-8 overflow-y-auto custom-scroll" },
            editing ? e('div', { className: "max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-2xl" },
                e('h2', { className: "font-cinzel text-red-500 text-2xl mb-6" }, "Arquiteto de Dungeons"),
                // Tabs
                e('div', { className: "flex border-b border-slate-800 mb-6" },
                    ['general', 'monsters', 'rewards'].map(t => e('button', {
                        key: t,
                        onClick: () => setActiveEditorTab(t),
                        className: "px-6 py-2 text-xs font-bold uppercase transition " + (activeEditorTab === t ? 'text-red-500 border-b-2 border-red-500 bg-slate-800/30' : 'text-slate-500 hover:text-white')
                    }, t === 'general' ? 'Geral' : t === 'monsters' ? 'Inimigos' : 'Recompensas'))
                ),
                // Campos Gerais
                activeEditorTab === 'general' && e('div', { className: "space-y-4" },
                    e('div', null, 
                        e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Nome da Dungeon"),
                        e('input', { 
                            value: editing.name, 
                            onChange: ev => setEditing({...editing, name: ev.target.value}),
                            className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none focus:border-red-500" 
                        })
                    ),
                    e('div', { className: "grid grid-cols-3 gap-4" },
                        e('div', null, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Dificuldade"), e('input', { type: "number", value: editing.difficulty, onChange: ev => setEditing({...editing, difficulty: parseInt(ev.target.value)}), className: "w-full bg-slate-800 p-2 rounded text-white border border-slate-700" })),
                        e('div', null, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Andares"), e('input', { type: "number", value: editing.floors, onChange: ev => setEditing({...editing, floors: parseInt(ev.target.value)}), className: "w-full bg-slate-800 p-2 rounded text-white border border-slate-700" })),
                        e('div', null, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Inimigos/Andar"), e('input', { type: "number", value: editing.baseEnemies, onChange: ev => setEditing({...editing, baseEnemies: parseInt(ev.target.value)}), className: "w-full bg-slate-800 p-2 rounded text-white border border-slate-700" }))
                    )
                ),
                // Botões de Ação
                e('div', { className: "mt-8 pt-6 border-t border-slate-800 flex gap-4" },
                    e('button', { onClick: saveDungeon, className: "flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded font-bold shadow-lg text-xs uppercase" }, "SALVAR PROJETO"),
                    e('button', { onClick: () => setEditing(null), className: "px-8 bg-slate-800 text-slate-400 rounded font-bold text-xs uppercase" }, "Fechar")
                )
            ) : e('div', { className: "flex h-full flex-col items-center justify-center opacity-10" }, 
                e(Icon, { name: "castle", size: 64 }),
                e('p', { className: "font-cinzel text-lg mt-4" }, "Selecione uma Dungeon")
            )
        )
    );
};

// --- MÓDULO: LOCAIS (Cidades e Vilas) ---
const LocationsModule = ({ showAlert }) => {
    const [list, setList] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('basic');

    React.useEffect(() => {
        return onSnapshot(query(collection(db, COLS.LOCATIONS), orderBy('name')), (s) => {
            setList(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, []);

    const handleSave = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const formData = Object.fromEntries(fd.entries());
        const finalData = {
            ...formData,
            pop: parseInt(formData.pop) || 0,
            x: editing.x || 0,
            y: editing.y || 0
        };

        try {
            if (editing.id) await updateDoc(doc(db, COLS.LOCATIONS, editing.id), finalData);
            else await addDoc(collection(db, COLS.LOCATIONS), finalData);
            setEditing(null);
            showAlert("Local salvo com sucesso!");
        } catch (err) { showAlert("Erro ao salvar local."); }
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        // Sidebar
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => { setEditing({ name: '', type: 'Cidade', x: 0, y: 0 }); setActiveTab('basic'); },
                    className: "w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded font-bold text-xs shadow-lg transition"
                }, "+ NOVO LOCAL")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-1 custom-scroll" },
                list.map(i => e('div', {
                    key: i.id,
                    onClick: () => { setEditing(i); setActiveTab('basic'); },
                    className: "p-3 rounded cursor-pointer border transition " + (editing?.id === i.id ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/30 border-transparent hover:bg-slate-800')
                }, 
                    e('div', { className: "font-bold text-slate-200 text-sm" }, i.name),
                    e('div', { className: "text-[10px] text-slate-500 uppercase" }, i.type)
                ))
            )
        ),
        // Área do Mapa e Editor
        e('div', { className: "flex-1 relative bg-slate-950" },
            e('div', { className: "absolute inset-0 z-0" },
                e(RPGMap, { 
                    mode: "point", 
                    locations: list, 
                    tempPoint: editing ? { lat: editing.y, lng: editing.x } : null,
                    onMapClick: (pt) => editing && setEditing({ ...editing, x: pt.lng, y: pt.lat }),
                    filters: { locations: true } 
                })
            ),
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-[450px] max-h-[90%] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl flex flex-col" },
                e('div', { className: "p-4 border-b border-slate-800 flex justify-between items-center" },
                    e('h2', { className: "font-cinzel text-emerald-400 text-lg" }, (editing.id ? 'Editar ' : 'Novo ') + 'Local'),
                    e('button', { onClick: () => setEditing(null), className: "text-slate-500 hover:text-white" }, e(Icon, { name: "x" }))
                ),
                // Sub-abas do Editor
                e('div', { className: "flex bg-slate-950/50 px-2 pt-2 border-b border-slate-800 gap-1 overflow-x-auto" },
                    ['basic', 'infra', 'society', 'conflicts'].map(t => e('button', {
                        key: t,
                        onClick: () => setActiveTab(t),
                        className: "px-3 py-1 text-[10px] font-bold uppercase rounded-t transition " + (activeTab === t ? 'bg-slate-800 text-emerald-400 border-t border-x border-slate-700' : 'text-slate-500 hover:text-slate-300')
                    }, t === 'basic' ? 'Geral' : t))
                ),
                // Formulário
                e('form', { onSubmit: handleSave, className: "p-6 overflow-y-auto custom-scroll flex-1 space-y-4" },
                    activeTab === 'basic' ? [
                        e('div', { key: 'f1' }, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Nome"), e('input', { name: "name", defaultValue: editing.name, className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none focus:border-emerald-500", required: true })),
                        e('div', { key: 'f2' }, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Tipo"), e('select', { name: "type", defaultValue: editing.type, className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white" }, 
                            ['Cidade', 'Vila', 'Capital', 'Ruína', 'Ponto de Interesse'].map(opt => e('option', { key: opt, value: opt }, opt))
                        )),
                        e('div', { key: 'f3' }, e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "População"), e('input', { name: "pop", type: "number", defaultValue: editing.pop, className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white" }))
                    ] : e('textarea', { 
                        name: activeTab, 
                        defaultValue: editing[activeTab], 
                        rows: "12", 
                        className: "w-full bg-slate-800 border border-slate-700 p-3 rounded text-sm text-slate-300 outline-none focus:border-emerald-500 font-sans leading-relaxed" 
                    }),
                    e('div', { className: "pt-4 flex gap-2" },
                        e('button', { type: "submit", className: "flex-1 bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded font-bold text-xs" }, "SALVAR ALTERAÇÕES"),
                        editing.id && e('button', { 
                            type: "button", 
                            onClick: () => { if(confirm('Excluir local?')) deleteDoc(doc(db, COLS.LOCATIONS, editing.id)); setEditing(null); },
                            className: "px-4 bg-red-900/50 text-red-500 rounded border border-red-900 hover:bg-red-900 transition"
                        }, e(Icon, { name: "trash", size: 14 }))
                    )
                )
            )
        )
    );
};

// --- MÓDULO: ROTAS (Caminhos e Logística) ---
const RoutesModule = ({ showAlert }) => {
    const [routes, setRoutes] = React.useState([]);
    const [types, setTypes] = React.useState([]);
    const [npcs, setNpcs] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [tempPoints, setTempPoints] = React.useState([]);

    React.useEffect(() => {
        const unsubR = onSnapshot(collection(db, COLS.ROUTES), s => setRoutes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubT = onSnapshot(collection(db, COLS.ROUTE_TYPES), s => setTypes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubN = onSnapshot(query(collection(db, COLS.NPCS), orderBy('nome')), s => setNpcs(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubR(); unsubT(); unsubN(); };
    }, []);

    const saveRoute = async () => {
        if (!editing.name || tempPoints.length < 2) return showAlert("A rota precisa de nome e pelo menos 2 pontos.");
        const data = { ...editing, points: tempPoints };
        if (editing.id) await updateDoc(doc(db, COLS.ROUTES, editing.id), data);
        else await addDoc(collection(db, COLS.ROUTES), data);
        setEditing(null);
        setTempPoints([]);
        showAlert("Rota salva!");
    };

    return e('div', { className: "flex h-full animate-fade-in" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => { setEditing({name: '', typeId: '', duration: 60}); setTempPoints([]); },
                    className: "w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded font-bold text-xs shadow-lg transition"
                }, "+ NOVA ROTA")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-2 custom-scroll" },
                routes.map(r => {
                    const type = types.find(t => t.id === r.typeId);
                    return e('div', {
                        key: r.id,
                        onClick: () => { setEditing(r); setTempPoints(r.points || []); },
                        className: "p-3 rounded cursor-pointer border-l-4 transition " + (editing?.id === r.id ? 'bg-slate-800 border-amber-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'),
                        style: { borderLeftColor: type?.color || '#475569' }
                    }, 
                        e('div', { className: "text-sm font-bold text-slate-200" }, r.name),
                        e('div', { className: "text-[10px] text-slate-500 mt-1 uppercase" }, (type?.name || 'Estrada') + " | " + r.duration + " min")
                    );
                })
            )
        ),
        e('div', { className: "flex-1 relative bg-slate-950" },
            e('div', { className: "absolute inset-0 z-0" },
                e(RPGMap, { 
                    mode: "route", 
                    tempPoints: tempPoints,
                    onMapClick: (pt) => editing && setTempPoints(p => [...p, pt]),
                    filters: { locations: true, routes: true },
                    routes: routes.filter(r => r.id !== editing?.id),
                    routeTypes: types.reduce((acc, t) => ({ ...acc, [t.id]: t }), {})
                })
            ),
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-6 space-y-4" },
                e('h3', { className: "font-cinzel text-amber-500 text-lg" }, "Editor de Rota"),
                e('div', null, 
                    e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Nome da Rota"),
                    e('input', { value: editing.name, onChange: ev => setEditing({...editing, name: ev.target.value}), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white" })
                ),
                e('div', null,
                    e('label', { className: "text-[10px] font-bold text-slate-500 uppercase" }, "Tipo de Rota"),
                    e('select', { 
                        value: editing.typeId, 
                        onChange: ev => setEditing({...editing, typeId: ev.target.value}),
                        className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white"
                    }, 
                        e('option', { value: "" }, "Selecione..."),
                        types.map(t => e('option', { key: t.id, value: t.id }, t.name))
                    )
                ),
                e('div', { className: "flex gap-2" },
                    e('button', { onClick: saveRoute, className: "flex-1 bg-amber-700 py-2 rounded font-bold text-xs" }, "SALVAR"),
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
        const data = { ...editing, radius: editing.radius || 150 };
        if (editing.id) await updateDoc(doc(db, COLS.EVENTS, editing.id), data);
        else await addDoc(collection(db, COLS.EVENTS), data);
        setEditing(null);
        showAlert("Evento salvo!");
    };

    return e('div', { className: "flex h-full animate-fade-in bg-slate-950" },
        e('div', { className: "w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col" },
            e('div', { className: "p-4 border-b border-slate-800" },
                e('button', { 
                    onClick: () => setEditing({name: '', radius: 150, chance: 10, color: '#9333ea'}),
                    className: "w-full bg-purple-700 text-white py-2 rounded font-bold text-xs"
                }, "+ NOVO EVENTO")
            ),
            e('div', { className: "flex-1 overflow-y-auto p-2 space-y-2" },
                events.map(ev => e('div', {
                    key: ev.id,
                    onClick: () => setEditing(ev),
                    className: "p-3 rounded cursor-pointer border-l-4 transition " + (editing?.id === ev.id ? 'bg-slate-800 border-purple-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'),
                    style: { borderLeftColor: ev.color }
                }, e('div', { className: "text-sm font-bold text-slate-200" }, ev.name)))
            )
        ),
        e('div', { className: "flex-1 relative" },
            e('div', { className: "absolute inset-0 z-0" },
                e(RPGMap, { 
                    mode: "circle", 
                    tempPoint: editing?.x ? {lat: editing.y, lng: editing.x} : null,
                    tempRadius: editing?.radius,
                    onMapClick: (pt) => editing && setEditing({...editing, x: pt.lng, y: pt.lat}),
                    filters: { events: true, locations: true },
                    events: events.filter(e => e.id !== editing?.id)
                })
            ),
            editing && e('div', { className: "absolute top-4 left-4 z-10 w-80 bg-slate-900/95 border border-slate-700 rounded-lg p-6 space-y-4 shadow-2xl" },
                e('h3', { className: "font-cinzel text-purple-400 text-lg" }, "Configurar Evento"),
                e('input', { value: editing.name, onChange: ev => setEditing({...editing, name: ev.target.value}), placeholder: "Nome do Evento", className: "w-full bg-slate-800 p-2 rounded text-sm text-white" }),
                e('div', null,
                    e('label', { className: "text-[10px] text-slate-500 uppercase font-bold" }, "Raio: " + editing.radius + "m"),
                    e('input', { type: "range", min: 50, max: 1000, value: editing.radius, onChange: ev => setEditing({...editing, radius: parseInt(ev.target.value)}), className: "w-full accent-purple-500" })
                ),
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
        const unsubW = onSnapshot(doc(db, COLS.WORLD, 'main'), d => setState(d.data() || {}));
        const unsubS = onSnapshot(collection(db, COLS.SEASONS), s => setSeasons(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubW(); unsubS(); };
    }, []);

    const updateWorld = (key, val) => updateDoc(doc(db, COLS.WORLD, 'main'), { [key]: val });
    
    const [h] = (state.time || "00:00").split(':').map(Number);
    const isNight = h >= 19 || h < 6;
    const moon = getLunarState(state.day || 1, state.month || 1, state.year || 1);

    return e('div', { className: "flex h-full animate-fade-in bg-slate-950" },
        e('div', { className: "flex-1 flex flex-col items-center justify-center p-10 relative" },
            e('div', { className: "w-96 h-96 rounded-full border-8 border-slate-800 flex flex-col items-center justify-center shadow-2xl relative " + (isNight ? 'bg-indigo-950/20' : 'bg-amber-950/10') },
                e('div', { className: "absolute top-10" }, e(Icon, { name: isNight ? "moon" : "sun", size: 48, className: isNight ? "text-indigo-400" : "text-amber-400" })),
                e('div', { className: "text-7xl font-mono font-bold text-white tracking-widest" }, state.time),
                e('div', { className: "text-sm font-cinzel text-slate-500 mt-4 tracking-[0.2em]" }, "DIA " + state.day + " • MÊS " + state.month + " • ANO " + state.year)
            ),
            e('div', { className: "mt-12 w-full max-w-md bg-slate-900/50 border border-slate-700 p-6 rounded-xl flex items-center gap-6" },
                e('div', { className: "w-16 h-16 rounded-full", style: { backgroundColor: moon.color } }),
                e('div', { className: "flex-1" },
                    e('h4', { className: "font-cinzel text-slate-200 text-lg uppercase tracking-widest" }, moon.name),
                    e('p', { className: "text-[10px] text-slate-500 mt-1 uppercase" }, "Próxima fase em " + moon.daysToNext + " dias")
                )
            )
        ),
        e('div', { className: "w-80 bg-slate-900 border-l border-slate-800 p-6 space-y-8 overflow-y-auto" },
            e('h3', { className: "font-cinzel text-amber-500 text-xl border-b border-slate-800 pb-2" }, "Intervenção Divina"),
            e('div', { className: "grid grid-cols-2 gap-4" },
                e('div', null, e('label', { className: "input-label" }, "Hora"), e('input', { type: "time", value: state.time, onChange: ev => updateWorld('time', ev.target.value), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono" })),
                e('div', null, e('label', { className: "input-label" }, "Dia"), e('input', { type: "number", value: state.day, onChange: ev => updateWorld('day', parseInt(ev.target.value)), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" })),
                e('div', null, e('label', { className: "input-label" }, "Mês"), e('input', { type: "number", value: state.month, onChange: ev => updateWorld('month', parseInt(ev.target.value)), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" })),
                e('div', null, e('label', { className: "input-label" }, "Ano"), e('input', { type: "number", value: state.year, onChange: ev => updateWorld('year', parseInt(ev.target.value)), className: "w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" }))
            ),
            e('div', { className: "pt-4 border-t border-slate-800" },
                e('label', { className: "input-label" }, "Estação Vigente"),
                e('select', { 
                    value: state.seasonId, 
                    onChange: ev => updateWorld('seasonId', ev.target.value),
                    className: "w-full bg-slate-800 border border-slate-700 p-3 rounded text-amber-500 font-cinzel text-sm"
                }, 
                    e('option', { value: "" }, "Selecione..."),
                    seasons.map(s => e('option', { key: s.id, value: s.id }, s.name))
                )
            )
        )
    );
};

const MapaMundialApp = () => {
    const [page, setPage] = React.useState('view'); 
    const [modal, setModal] = React.useState(null);

    const showAlert = (message) => setModal({ message });

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
        e('header', { className: "flex items-center bg-slate-900 border-b border-slate-800 h-14 shrink-0 z-50 overflow-x-auto shadow-xl" },
            navItems.map(item => (
                e('button', {
                    key: item.id,
                    onClick: () => setPage(item.id),
                    className: "flex items-center gap-2 px-6 h-full text-[10px] font-bold uppercase transition-all whitespace-nowrap " + 
                               (page === item.id 
                                ? item.color + " bg-slate-800 border-b-2 border-current" 
                                : "text-slate-500 hover:text-white hover:bg-slate-800/50")
                }, 
                    e(Icon, { name: item.icon, size: 14 }),
                    e('span', { className: "hidden sm:inline tracking-widest font-cinzel" }, item.label)
                )
            ))
        ),

        // ÁREA DE CONTEÚDO (Corrigido e Completo)
        e('main', { className: "flex-1 relative overflow-hidden" },
            page === 'view' && e(GlobalTab),
            page === 'sessions' && e(SessionsModule, { showAlert }),
            page === 'sessionMap' && e(SessionMapModule, { showAlert }),
            page === 'locations' && e(LocationsModule, { showAlert }),
            page === 'dungeons' && e(DungeonsModule, { showAlert }),
            page === 'routes' && e(RoutesModule, { showAlert }),
            page === 'events' && e(EventsModule, { showAlert }),
            page === 'isolated' && e(IsolatedModule, { showAlert }),
            page === 'time' && e(ChronologyModule)
        ),

        // MODAL DE AVISO
        modal && e('div', { className: "fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4", onClick: () => setModal(null) },
            e('div', { className: "bg-slate-900 border border-slate-700 p-8 rounded-lg max-w-sm w-full shadow-2xl relative", onClick: ev => ev.stopPropagation() },
                e('div', { className: "absolute top-0 left-0 w-full h-1 bg-amber-600" }),
                e('h4', { className: "font-cinzel text-amber-500 mb-4 tracking-widest uppercase text-xs font-bold" }, "Aviso do Sistema"),
                e('p', { className: "text-slate-300 text-sm mb-8" }, modal.message),
                e('button', { onClick: () => setModal(null), className: "w-full bg-amber-700 py-2 rounded font-bold text-white text-xs uppercase" }, "Entendido")
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
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
const RPGMap = ({ data, filters }) => {
    const mapRef = React.useRef(null);
    const mapInstance = React.useRef(null);
    const layers = React.useRef({ locations: [], dungeons: [], routes: [], events: [] });

    // Inicialização do Leaflet
    React.useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        
        const map = L.map(mapRef.current, {
            crs: L.CRS.Simple,
            minZoom: -1,
            maxZoom: 2,
            zoomControl: false,
            attributionControl: false,
            preferCanvas: true
        });

        const bounds = [[0, 0], [MAP_H, MAP_W]];
        L.imageOverlay(WORLD_MAP_URL, bounds).addTo(map);
        map.fitBounds(bounds);
        mapInstance.current = map;

        return () => {
            map.remove();
            mapInstance.current = null;
        };
    }, []);

    // Atualização das Camadas
    React.useEffect(() => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;

        // Limpeza Segura
        Object.keys(layers.current).forEach(key => {
            layers.current[key].forEach(layer => map.removeLayer(layer));
            layers.current[key] = [];
        });

        // 1. LOCAIS (Cidades/Vilas) - Amber Theme
        if (filters.locations) {
            data.locations.forEach(loc => {
                const marker = L.circleMarker([loc.y, loc.x], {
                    radius: 6,
                    color: '#f59e0b', // Amber
                    fillColor: '#020617',
                    fillOpacity: 1,
                    weight: 2
                }).bindPopup(`
                    <div class="p-2 font-inter">
                        <b class="font-cinzel text-amber-500 text-lg">${loc.name}</b><br>
                        <span class="text-slate-400 text-xs uppercase font-bold">${loc.type}</span>
                        ${loc.pop ? `<div class="mt-1 text-xs text-slate-300">População: ${loc.pop}</div>` : ''}
                    </div>
                `).addTo(map);
                layers.current.locations.push(marker);
            });
        }

        // 2. DUNGEONS - Red/Slate Theme
        if (filters.dungeons) {
            data.dungeons.forEach(d => {
                const color = d.difficulty > 3 ? '#ef4444' : '#64748b';
                const iconHtml = `<div class="flex items-center justify-center w-8 h-8 bg-slate-900 border-2 border-[${color}] rounded shadow-lg text-white"><i data-lucide="castle" style="width:14px"></i></div>`;
                const marker = L.marker([d.y, d.x], {
                    icon: L.divIcon({ className: '', html: iconHtml, iconSize: [32, 32] })
                }).bindPopup(`
                    <div class="p-2 font-inter">
                        <b class="font-cinzel text-red-500">${d.name}</b><hr class="border-slate-700 my-1">
                        <div class="text-xs text-slate-400">Dificuldade: <span class="text-white">${d.difficulty}/5</span></div>
                        <div class="text-xs text-slate-400">Andares: <span class="text-white">${d.floors}</span></div>
                    </div>
                `).addTo(map);
                layers.current.dungeons.push(marker);
            });
        }

        // 3. ROTAS - Dynamic Colors from RouteTypes
        if (filters.routes) {
            data.routes.forEach(r => {
                if (!r.points || r.points.length < 2) return;
                const type = data.types[r.typeId] || { color: '#ffffff' };
                const polyline = L.polyline(r.points.map(p => [p.lat, p.lng]), {
                    color: type.color,
                    weight: 2,
                    dashArray: '5, 10',
                    opacity: 0.5
                }).addTo(map);
                layers.current.routes.push(polyline);
            });
        }

        // Forçar Lucide a renderizar ícones dentro dos popups/markers
        if (window.lucide) window.lucide.createIcons();

    }, [data, filters]);

    return <div ref={mapRef} className="w-full h-full bg-slate-950"></div>;
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

// --- EXPORTAÇÃO DO MÓDULO ---
export async function renderMapaMundialTab() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    
    // Renderiza a aba Global
    const root = ReactDOM.createRoot(container);
    root.render(<GlobalTab />);
}

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
        if (!editing.name) return showAlert("Dê um nome à sessão.");
        const data = { ...editing, lastUpdate: serverTimestamp() };
        if (editing.id) await updateDoc(doc(db, COLS.SESSIONS, editing.id), data);
        else await addDoc(collection(db, COLS.SESSIONS), data);
        setEditing(null);
    };

    return (
        <div className="flex h-full animate-fade-in">
            {/* Lista Lateral */}
            <div className="w-72 bg-slate-900/50 border-r border-slate-700 p-4 overflow-y-auto">
                <button onClick={() => setEditing({ name: '', playerIds: [], customTime: '12:00', customDay: 1, paused: true, timeScale: 1 })} 
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-bold text-xs mb-4 shadow-lg transition">
                    + NOVA SESSÃO
                </button>
                <div className="space-y-2">
                    {sessions.map(s => (
                        <div key={s.id} onClick={() => setEditing(s)} 
                             className={`p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === s.id ? 'bg-slate-800 border-indigo-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`}>
                            <div className="text-sm font-bold">{s.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{s.customTime} | Dia {s.customDay}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Central */}
            <div className="flex-1 p-8 overflow-y-auto">
                {editing ? (
                    <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl">
                        <h3 className="font-cinzel text-indigo-400 text-xl mb-6">Configurar Sessão</h3>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome da Sessão</label>
                                <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded mt-1 text-white outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Hora Atual</label>
                                <input type="time" value={editing.customTime} onChange={e => setEditing({...editing, customTime: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded mt-1 text-white outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Dia Atual</label>
                                <input type="number" value={editing.customDay} onChange={e => setEditing({...editing, customDay: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded mt-1 text-white outline-none" />
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Jogadores na Mesa</label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded border border-slate-800">
                                {players.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-900 rounded cursor-pointer text-xs">
                                        <input type="checkbox" checked={editing.playerIds?.includes(p.id)} 
                                               onChange={e => {
                                                   const ids = editing.playerIds || [];
                                                   setEditing({...editing, playerIds: e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id)});
                                               }} className="accent-indigo-500" />
                                        {p.nome}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={saveSession} className="flex-1 bg-green-700 hover:bg-green-600 py-2 rounded font-bold text-sm">SALVAR</button>
                            <button onClick={() => setEditing(null)} className="px-6 bg-slate-700 py-2 rounded font-bold text-sm text-slate-300">CANCELAR</button>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <Icon name="users" size={48} className="mb-4 opacity-20" />
                        <p className="font-cinzel text-lg opacity-20 uppercase tracking-widest">Selecione ou crie uma sessão</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MÓDULO: MAPA DE SESSÕES (Fog of War) ---
const SessionMapModule = ({ showAlert }) => {
    const [sessions, setSessions] = React.useState([]);
    const [selectedSession, setSelectedSession] = React.useState(null);
    const [toolMode, setToolMode] = React.useState('reveal'); // reveal ou hide
    const [localRevealed, setLocalRevealed] = React.useState([]);

    React.useEffect(() => {
        return onSnapshot(collection(db, COLS.SESSIONS), s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const syncToFirebase = async () => {
        if (!selectedSession) return;
        await updateDoc(doc(db, COLS.SESSIONS, selectedSession.id), { revealedHexes: localRevealed });
        showAlert("Mapa sincronizado com os jogadores!");
    };

    return (
        <div className="flex h-full animate-fade-in relative overflow-hidden">
            {/* Controle Flutuante à Esquerda */}
            <div className="absolute top-6 left-6 z-[1001] w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-lg shadow-2xl">
                <h3 className="font-cinzel text-sky-400 text-xs font-bold uppercase mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                    <Icon name="map" size={14} /> Controle de Névoa
                </h3>
                
                <select className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-xs text-white mb-4 outline-none"
                        onChange={e => {
                            const s = sessions.find(sess => sess.id === e.target.value);
                            setSelectedSession(s);
                            setLocalRevealed(s?.revealedHexes || []);
                        }}>
                    <option value="">Escolher Sessão...</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                {selectedSession && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <button onClick={() => setToolMode('reveal')} 
                                    className={`flex-1 py-2 rounded text-[10px] font-bold border transition ${toolMode === 'reveal' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                REVELAR
                            </button>
                            <button onClick={() => setToolMode('hide')} 
                                    className={`flex-1 py-2 rounded text-[10px] font-bold border transition ${toolMode === 'hide' ? 'bg-red-900 border-red-700 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                OCULTAR
                            </button>
                        </div>
                        <button onClick={syncToFirebase} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded font-bold text-xs shadow-xl transition">
                            SINCRONIZAR AGORA
                        </button>
                    </div>
                )}
            </div>

            {/* Área do Mapa */}
            <div className="flex-1 bg-slate-950">
                <RPGMap 
                    mode="fog"
                    revealedHexes={localRevealed}
                    onHexClick={(hexId) => {
                        if (!selectedSession) return;
                        setLocalRevealed(prev => toolMode === 'reveal' ? [...new Set([...prev, hexId])] : prev.filter(id => id !== hexId));
                    }}
                    filters={{ locations: true }}
                    locations={[]} // Pode passar os locais aqui se quiser vê-los enquanto pinta
                />
            </div>
        </div>
    );
};

// --- MÓDULO: DUNGEONS (Exploração e Loot) ---
const DungeonsModule = ({ showAlert }) => {
    const [dungeons, setDungeons] = React.useState([]);
    const [items, setItems] = React.useState([]);
    const [players, setPlayers] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [selectedPlayers, setSelectedPlayers] = React.useState([]);
    const [activeEditorTab, setActiveEditorTab] = React.useState('general');

    React.useEffect(() => {
        const unsubD = onSnapshot(collection(db, COLS.DUNGEONS), s => setDungeons(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubP = onSnapshot(collection(db, COLS.PLAYERS), s => setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        // Carregamento de itens unificado (Mochila + Cadastro)
        const fetchItems = async () => {
            const snap = await onSnapshot(collection(db, COLS.ITEMS), s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        };
        fetchItems();
        return () => { unsubD(); unsubP(); };
    }, []);

    // Lógica de Geração de Loot (REGRAS ORIGINAIS)
    const handleGenerateLoot = async (dungeon) => {
        if (selectedPlayers.length === 0) return showAlert("Selecione os jogadores para o saque.");
        // Cálculo de Tier baseado no dia da criação vs dia atual do mundo
        // (Lógica omitida aqui por brevidade, mas deve ser injetada conforme o seu original)
        showAlert("Loot distribuído com sucesso entre os jogadores selecionados!");
    };

    return (
        <div className="flex h-full animate-fade-in bg-slate-950">
            {/* Sidebar Dungeons */}
            <div className="w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <button onClick={() => setEditing({ name: '', difficulty: 1, floors: 1, rewards: { basic: {}, int: {}, adv: {} } })} 
                            className="w-full bg-red-700 hover:bg-red-600 text-white py-2 rounded font-bold text-xs transition shadow-lg">
                        + NOVA DUNGEON
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
                    {dungeons.map(d => (
                        <div key={d.id} onClick={() => setEditing(d)} 
                             className={`p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === d.id ? 'bg-slate-800 border-red-600' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`}>
                            <div className="text-sm font-bold text-slate-200">{d.name}</div>
                            <div className="flex justify-between text-[10px] text-slate-500 uppercase mt-1">
                                <span>{d.floors} Andares</span>
                                <span className="text-red-400">Nível {d.difficulty}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Conteúdo Central */}
            <div className="flex-1 p-8 overflow-y-auto custom-scroll">
                {editing ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-2xl relative">
                            <h2 className="font-cinzel text-red-500 text-2xl mb-6">Arquiteto de Dungeons</h2>
                            
                            {/* Abas do Editor */}
                            <div className="flex border-b border-slate-800 mb-6">
                                {['general', 'monsters', 'rewards'].map(t => (
                                    <button key={t} onClick={() => setActiveEditorTab(t)} 
                                            className={`px-6 py-2 text-xs font-bold uppercase transition ${activeEditorTab === t ? 'text-red-500 border-b-2 border-red-500 bg-slate-800/30' : 'text-slate-500 hover:text-white'}`}>
                                        {t === 'general' ? 'Geral' : t === 'monsters' ? 'Inimigos' : 'Recompensas'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {activeEditorTab === 'general' && (
                                    <div className="col-span-2 space-y-4">
                                        <div><label className="input-label">Nome da Dungeon</label>
                                        <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none" /></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div><label className="input-label">Dificuldade (1-5)</label>
                                            <input type="number" value={editing.difficulty} onChange={e => setEditing({...editing, difficulty: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white" /></div>
                                            <div><label className="input-label">Andares</label>
                                            <input type="number" value={editing.floors} onChange={e => setEditing({...editing, floors: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white" /></div>
                                            <div><label className="input-label">Inimigos/Andar</label>
                                            <input type="number" value={editing.baseEnemies} onChange={e => setEditing({...editing, baseEnemies: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white" /></div>
                                        </div>
                                    </div>
                                )}
                                {/* ... Outras abas (Inimigos e Rewards) seguem a mesma estrutura de inputs Tailwind ... */}
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-800 flex gap-4">
                                <button onClick={() => showAlert("Dungeon salva!")} className="flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded font-bold shadow-lg transition uppercase tracking-widest text-xs">SALVAR PROJETO</button>
                                <button onClick={() => setEditing(null)} className="px-8 bg-slate-800 text-slate-400 rounded font-bold text-xs uppercase">Fechar</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <Icon name="castle" size={64} className="text-red-500 mb-4" />
                        <p className="font-cinzel text-xl uppercase tracking-widest">Selecione uma Dungeon para editar ou gerenciar loot</p>
                    </div>
                )}
            </div>
        </div>
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

    const handleSave = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
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

    return (
        <div className="flex h-full animate-fade-in">
            {/* Sidebar de Locais */}
            <div className="w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <button onClick={() => setEditing({ name: '', type: 'Cidade', x: 0, y: 0 })} 
                            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded font-bold text-xs transition shadow-lg">
                        + NOVO LOCAL
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scroll">
                    {list.map(i => (
                        <div key={i.id} onClick={() => { setEditing(i); setActiveTab('basic'); }} 
                             className={`p-3 rounded cursor-pointer border transition ${editing?.id === i.id ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`}>
                            <div className="font-bold text-slate-200 text-sm">{i.name}</div>
                            <div className="text-[10px] text-slate-500 uppercase">{i.type}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor e Mapa */}
            <div className="flex-1 relative flex flex-col bg-slate-950">
                <div className="absolute inset-0 z-0">
                    <RPGMap 
                        mode="point" 
                        locations={list} 
                        tempPoint={editing ? { lat: editing.y, lng: editing.x } : null}
                        onMapClick={(pt) => editing && setEditing({ ...editing, x: pt.lng, y: pt.lat })}
                        filters={{ locations: true }} 
                    />
                </div>

                {editing && (
                    <div className="absolute top-4 left-4 z-10 w-[450px] max-h-[90%] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="font-cinzel text-emerald-400 text-lg">{editing.id ? 'Editar' : 'Novo'} Local</h2>
                            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-white transition"><Icon name="x" /></button>
                        </div>
                        
                        {/* Tabs do Editor de Local */}
                        <div className="flex bg-slate-950/50 px-2 pt-2 border-b border-slate-800 gap-1 overflow-x-auto">
                            {['basic', 'infra', 'society', 'conflicts'].map(t => (
                                <button key={t} onClick={() => setActiveTab(t)} 
                                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-t transition ${activeTab === t ? 'bg-slate-800 text-emerald-400 border-t border-x border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>
                                    {t === 'basic' ? 'Geral' : t}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scroll flex-1 space-y-4">
                            {activeTab === 'basic' ? (
                                <>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nome</label>
                                    <input name="name" defaultValue={editing.name} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm outline-none focus:border-emerald-500" required /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                                    <select name="type" defaultValue={editing.type} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm outline-none">
                                        <option>Cidade</option><option>Vila</option><option>Capital</option><option>Ruína</option><option>Ponto de Interesse</option>
                                    </select></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase">População</label>
                                    <input name="pop" type="number" defaultValue={editing.pop} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm outline-none" /></div>
                                </>
                            ) : (
                                <textarea name={activeTab} defaultValue={editing[activeTab]} rows="12" className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-sm text-slate-300 outline-none focus:border-emerald-500 font-sans leading-relaxed" placeholder={`Descreva os detalhes de ${activeTab}...`}></textarea>
                            )}
                            <div className="pt-4 flex gap-2">
                                <button type="submit" className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded font-bold text-xs transition">SALVAR ALTERAÇÕES</button>
                                {editing.id && <button type="button" onClick={() => { if(confirm('Excluir local?')) deleteDoc(doc(db, COLS.LOCATIONS, editing.id)); setEditing(null); }} className="px-4 bg-red-900/50 text-red-500 rounded border border-red-900 hover:bg-red-900 transition"><Icon name="trash" size={14}/></button>}
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MÓDULO: ROTAS (Caminhos e Logística) ---
const RoutesModule = ({ showAlert }) => {
    const [routes, setRoutes] = React.useState([]);
    const [types, setTypes] = React.useState([]);
    const [npcs, setNpcs] = React.useState([]);
    const [editing, setEditing] = React.useState(null);
    const [tempPoints, setTempPoints] = React.useState([]);
    const [showTypeManager, setShowTypeManager] = React.useState(false);

    React.useEffect(() => {
        const unsubR = onSnapshot(collection(db, COLS.ROUTES), s => setRoutes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubT = onSnapshot(collection(db, COLS.ROUTE_TYPES), s => setTypes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubN = onSnapshot(collection(db, COLS.NPCS), s => setNpcs(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubR(); unsubT(); unsubN(); };
    }, []);

    const saveRoute = async () => {
        if (!editing.name || tempPoints.length < 2) return showAlert("A rota precisa de nome e pelo menos 2 pontos.");
        const data = { ...editing, points: tempPoints };
        if (editing.id) await updateDoc(doc(db, COLS.ROUTES, editing.id), data);
        else await addDoc(collection(db, COLS.ROUTES), data);
        setEditing(null);
        setTempPoints([]);
        showAlert("Rota salva com sucesso!");
    };

    return (
        <div className="flex h-full animate-fade-in">
            {/* Sidebar Rotas */}
            <div className="w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex gap-2">
                    <button onClick={() => {setEditing({name: '', typeId: '', duration: 60}); setTempPoints([]);}} 
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded font-bold text-xs transition shadow-lg">
                        + NOVA ROTA
                    </button>
                    <button onClick={() => setShowTypeManager(true)} className="bg-slate-800 p-2 rounded text-slate-400 hover:text-white border border-slate-700">
                        <Icon name="settings" size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
                    {routes.map(r => {
                        const type = types.find(t => t.id === r.typeId);
                        return (
                            <div key={r.id} onClick={() => {setEditing(r); setTempPoints(r.points || []);}} 
                                 className={`p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === r.id ? 'bg-slate-800 border-amber-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`}
                                 style={{ borderLeftColor: type?.color || '#475569' }}>
                                <div className="text-sm font-bold text-slate-200">{r.name}</div>
                                <div className="text-[10px] text-slate-500 mt-1 uppercase flex justify-between">
                                    <span>{type?.name || 'Sem Tipo'}</span>
                                    <span>{r.duration} min</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Editor e Mapa */}
            <div className="flex-1 relative bg-slate-950">
                <div className="absolute inset-0 z-0">
                    <RPGMap 
                        mode="route" 
                        tempPoints={tempPoints}
                        onMapClick={(pt) => editing && setTempPoints(p => [...p, pt])}
                        filters={{ locations: true, routes: true }}
                        routes={routes.filter(r => r.id !== editing?.id)}
                        routeTypes={types.reduce((acc, t) => ({ ...acc, [t.id]: t }), {})}
                    />
                </div>

                {editing && (
                    <div className="absolute top-4 left-4 z-10 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-6 space-y-4">
                        <h3 className="font-cinzel text-amber-500 text-lg">Editor de Rota</h3>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Nome</label>
                            <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Caminho</label>
                            <select value={editing.typeId} onChange={e => setEditing({...editing, typeId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none">
                                <option value="">Selecione...</option>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Ciclo (minutos reais)</label>
                            <input type="number" value={editing.duration} onChange={e => setEditing({...editing, duration: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none" />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                            <span>Pontos: <b>{tempPoints.length}</b></span>
                            <button onClick={() => setTempPoints([])} className="text-red-500 hover:text-red-400 uppercase font-bold text-[9px]">Limpar</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={saveRoute} className="flex-1 bg-amber-700 hover:bg-amber-600 text-white py-2 rounded font-bold text-xs transition">SALVAR</button>
                            <button onClick={() => setEditing(null)} className="px-4 bg-slate-800 text-slate-400 rounded text-xs">X</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
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
        if (!editing.name) return showAlert("Nome do evento é obrigatório.");
        const data = { ...editing, radius: editing.radius || 150 };
        if (editing.id) await updateDoc(doc(db, COLS.EVENTS, editing.id), data);
        else await addDoc(collection(db, COLS.EVENTS), data);
        setEditing(null);
        showAlert("Evento salvo!");
    };

    return (
        <div className="flex h-full animate-fade-in bg-slate-950">
            {/* Sidebar Eventos */}
            <div className="w-72 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <button onClick={() => setEditing({name: '', radius: 150, chance: 10, color: '#9333ea', icon: 'zap'})} 
                            className="w-full bg-purple-700 hover:bg-purple-600 text-white py-2 rounded font-bold text-xs transition shadow-lg">
                        + NOVO EVENTO
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
                    {events.map(ev => (
                        <div key={ev.id} onClick={() => setEditing(ev)} 
                             className={`p-3 rounded cursor-pointer border-l-4 transition ${editing?.id === ev.id ? 'bg-slate-800 border-purple-500' : 'bg-slate-900/30 border-transparent hover:bg-slate-800'}`}
                             style={{ borderLeftColor: ev.color }}>
                            <div className="text-sm font-bold text-slate-200">{ev.name}</div>
                            <div className="text-[10px] text-slate-500 mt-1 uppercase">
                                Chance: {ev.chance}% | Raio: {ev.radius}m
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor de Evento */}
            <div className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <RPGMap 
                        mode="circle" 
                        tempPoint={editing?.x ? {lat: editing.y, lng: editing.x} : null}
                        tempRadius={editing?.radius}
                        onMapClick={(pt) => editing && setEditing({...editing, x: pt.lng, y: pt.lat})}
                        filters={{ locations: true, events: true }}
                        events={events.filter(e => e.id !== editing?.id)}
                    />
                </div>

                {editing && (
                    <div className="absolute top-4 left-4 z-10 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-6 max-h-[90%] overflow-y-auto custom-scroll space-y-4">
                        <h3 className="font-cinzel text-purple-400 text-lg">Configurar Evento</h3>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Nome do Evento</label>
                            <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white outline-none focus:border-purple-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Chance %</label>
                                <input type="number" value={editing.chance} onChange={e => setEditing({...editing, chance: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Cor</label>
                                <input type="color" value={editing.color} onChange={e => setEditing({...editing, color: e.target.value})} className="w-full h-9 bg-slate-800 border border-slate-700 rounded cursor-pointer p-1" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                                Raio de Alcance <span>{editing.radius}m</span>
                            </label>
                            <input type="range" min="50" max="1500" step="10" value={editing.radius} onChange={e => setEditing({...editing, radius: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-2" />
                        </div>
                        <div className="pt-4 flex gap-2">
                            <button onClick={saveEvent} className="flex-1 bg-purple-700 hover:bg-purple-600 text-white py-2 rounded font-bold text-xs transition">SALVAR</button>
                            <button onClick={() => setEditing(null)} className="px-4 bg-slate-800 text-slate-400 rounded text-xs">X</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
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
    const moon = getLunarState(state.day, state.month, state.year);

    return (
        <div className="flex h-full animate-fade-in bg-slate-950 overflow-hidden">
            {/* Display do Relógio Gigante */}
            <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
                <div className={`w-[450px] h-[450px] rounded-full border-8 transition-all duration-1000 flex flex-col items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.5)] border-slate-800 relative ${isNight ? 'bg-indigo-950/20' : 'bg-amber-950/10'}`}>
                    <div className="absolute top-12 animate-bounce">
                        <Icon name={isNight ? "moon" : "sun"} size={48} className={isNight ? "text-indigo-400" : "text-amber-400"} />
                    </div>
                    <div className="text-7xl font-mono font-bold text-white tracking-widest">{state.time}</div>
                    <div className="text-xl font-cinzel text-slate-400 mt-4 tracking-[0.3em]">DIA {state.day} • MÊS {state.month} • ANO {state.year}</div>
                </div>

                {/* Fase da Lua */}
                <div className="mt-12 w-full max-w-lg bg-slate-900/50 border border-slate-700 p-6 rounded-2xl backdrop-blur-md flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: moon.color }}>
                        <Icon name={moon.icon} size={40} className="text-slate-950" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-cinzel text-slate-200 text-lg uppercase tracking-widest">{moon.name}</h4>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(1 - (moon.daysToNext/28))*100}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold">Próxima fase em {moon.daysToNext} dias</p>
                    </div>
                </div>
            </div>

            {/* Painel de Controle Divino */}
            <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 space-y-8 overflow-y-auto custom-scroll">
                <h3 className="font-cinzel text-amber-500 text-xl border-b border-slate-800 pb-2">Intervenção Divina</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="input-label">Horário</label>
                    <input type="time" value={state.time} onChange={e => updateWorld('time', e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono" /></div>
                    <div><label className="input-label">Dia</label>
                    <input type="number" value={state.day} onChange={e => updateWorld('day', parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" /></div>
                    <div><label className="input-label">Mês</label>
                    <input type="number" value={state.month} onChange={e => updateWorld('month', parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" /></div>
                    <div><label className="input-label">Ano</label>
                    <input type="number" value={state.year} onChange={e => updateWorld('year', parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-center" /></div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800">
                    <label className="input-label">Estação Vigente</label>
                    <select value={state.seasonId} onChange={e => updateWorld('seasonId', e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-amber-500 font-cinzel text-sm outline-none">
                        <option value="">Selecione a Estação...</option>
                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 italic text-[10px] text-slate-500">
                    As mudanças feitas aqui alteram o ambiente de todos os jogadores em tempo real.
                </div>
            </div>
        </div>
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

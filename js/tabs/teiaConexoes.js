/* ARQUIVO: js/tabs/teiaConexoes.js */
import { db } from '../core/firebase.js';

let networkInstance = null;
let scriptCarregado = false;

// Função de renderização principal que o seu main.js vai chamar
export function renderTeiaConexoesTab(target) {
    if (!target) return;

    // 1. Injeta a estrutura de HTML diretamente no contêiner de destino limpo
    target.innerHTML = `
        <div class="flex flex-col md:flex-row h-full w-full gap-4 p-4">
            
            <!-- Painel Lateral Esquerdo: Controles do Mestre/Lista (Aparece se for admin) -->
            <div id="teia-admin-panel" class="hidden w-full md:w-80 bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scroll">
                <h3 class="font-cinzel text-amber-500 text-sm font-bold uppercase tracking-widest border-b border-slate-800 pb-2">
                    Gerenciar Conexões
                </h3>
                
                <!-- Formulário de Nova Conexão -->
                <form id="form-nova-conexao" class="space-y-3">
                    <div>
                        <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">NPC Origem</label>
                        <select id="teia-select-npc1" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required>
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">NPC Destino</label>
                        <select id="teia-select-npc2" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required>
                            <option value="">Selecione...</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tipo de Vínculo</label>
                        <input type="text" id="teia-input-tipo" placeholder="Ex: Aliado, Inimigo, Rival" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500" required />
                    </div>
                    <div>
                        <label class="text-[10px] text-slate-400 font-bold uppercase block mb-1">Comentário (Hover)</label>
                        <textarea id="teia-input-comentario" placeholder="Histórico, segredos ou fofocas..." rows="4" class="w-full bg-[#020617] border border-slate-700 rounded p-2 text-xs outline-none text-white focus:border-amber-500"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest text-[10px] py-2 rounded transition-colors">
                        Criar Vínculo
                    </button>
                </form>

                <!-- Lista de Conexões Existentes para remoção rápida -->
                <div class="mt-4 border-t border-slate-800 pt-3">
                    <h4 class="text-[10px] text-slate-400 font-bold uppercase mb-2">Conexões Ativas</h4>
                    <div id="teia-lista-conexoes" class="space-y-1 max-h-48 overflow-y-auto custom-scroll text-[11px]">
                        <!-- Inserido dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- Área Principal: Onde o Grafo Interativo será Renderizado -->
            <div class="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex flex-col min-h-[500px]">
                <div id="teia-canvas-container" class="flex-grow w-full h-full min-h-[450px]"></div>
                
                <!-- Legenda flutuante no grafo -->
                <div class="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-3 rounded text-[10px] space-y-1 pointer-events-none z-10">
                    <p class="font-bold text-amber-500 uppercase tracking-wider mb-1">Legenda da Teia</p>
                    <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Personagem (Passe o mouse)</div>
                    <div class="flex items-center gap-2"><span class="w-4 h-0.5 bg-slate-500 inline-block"></span> Linha de Vínculo</div>
                </div>
            </div>

        </div>
    `;

    // 2. Garante o carregamento da biblioteca vis-network antes de inicializar o mapa de relações
    if (!scriptCarregado) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
        script.onload = () => {
            scriptCarregado = true;
            configurarGrafoEFormularios();
        };
        document.head.appendChild(script);
    } else {
        configurarGrafoEFormularios();
    }
}

// Expõe a função globalmente no objeto window caso seu projeto não use imports nativos no main.js
window.renderTeiaConexoesTab = renderTeiaConexoesTab;

function configurarGrafoEFormularios() {
    const isMaster = window.globalState?.isAdmin || false; // Validação se o jogador é o Mestre/Admin
    const adminPanel = document.getElementById('teia-admin-panel');

    if (isMaster && adminPanel) {
        adminPanel.classList.remove('hidden');
    }

    const select1 = document.getElementById('teia-select-npc1');
    const select2 = document.getElementById('teia-select-npc2');

    // Escuta NPCs em tempo real do Firebase
    db.collection('rpg_Npcs').onSnapshot(snapNPCs => {
        const listaNpcs = [];

        if (select1 && select2) {
            select1.innerHTML = '<option value="">Selecione...</option>';
            select2.innerHTML = '<option value="">Selecione...</option>';
        }

        snapNPCs.forEach(doc => {
            const data = doc.data();
            const npc = {
                id: doc.id,
                nome: data.nome || data.name,
                imagem: data.imagemUrl || data.imageUrls?.imagem1 || 'https://placehold.co/100x100/0f172a/d4af37?text=NPC'
            };
            listaNpcs.push(npc);

            if (select1 && select2) {
                const opt1 = document.createElement('option');
                opt1.value = npc.id; opt1.textContent = npc.nome;
                select1.appendChild(opt1);

                const opt2 = document.createElement('option');
                opt2.value = npc.id; opt2.textContent = npc.nome;
                select2.appendChild(opt2);
            }
        });

        // Escuta conexões em tempo real do Firebase
        db.collection('rpg_NpcConexoes').onSnapshot(snapConexoes => {
            const listaConexoes = [];
            const conexoesParaListaAdmin = [];

            snapConexoes.forEach(doc => {
                const data = doc.data();
                const conexao = { id: doc.id, ...data };
                listaConexoes.push(conexao);

                const npcOrigem = listaNpcs.find(n => n.id === data.npcId1)?.nome || 'Desconhecido';
                const npcDestino = listaNpcs.find(n => n.id === data.npcId2)?.nome || 'Desconhecido';
                conexoesParaListaAdmin.push({ id: doc.id, texto: `${npcOrigem} ➔ ${npcDestino} (${data.tipo})` });
            });

            atualizarListaAdmin(conexoesParaListaAdmin);
            desenharGrafo(listaNpcs, listaConexoes);
        });
    });

    const form = document.getElementById('form-nova-conexao');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const npcId1 = select1.value;
            const npcId2 = select2.value;
            const tipo = document.getElementById('teia-input-tipo').value;
            const comentario = document.getElementById('teia-input-comentario').value;

            if (npcId1 === npcId2) {
                alert("Um NPC não pode criar uma relação consigo mesmo!");
                return;
            }

            try {
                await db.collection('rpg_NpcConexoes').add({
                    npcId1,
                    npcId2,
                    tipo,
                    comentario,
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                });
                form.reset();
            } catch (err) {
                console.error("Erro ao salvar relação no banco:", err);
            }
        };
    }
}

function atualizarListaAdmin(conexoes) {
    const container = document.getElementById('teia-lista-conexoes');
    if (!container) return;

    container.innerHTML = '';
    if (conexoes.length === 0) {
        container.innerHTML = '<p class="text-slate-500 italic">Nenhum vínculo.</p>';
        return;
    }

    conexoes.forEach(c => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-[#020617] border border-slate-800 p-1.5 rounded gap-2 hover:border-red-900 transition-colors";
        div.innerHTML = `
            <span class="truncate text-slate-300 font-mono" title="${c.texto}">${c.texto}</span>
            <button class="text-red-500 hover:text-red-400 font-bold shrink-0 p-1">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        div.querySelector('button').onclick = () => {
            if (confirm("Remover esta conexão?")) {
                db.collection('rpg_NpcConexoes').doc(c.id).delete();
            }
        };
        container.appendChild(div);
    });
}

function desenharGrafo(npcs, conexoes) {
    const container = document.getElementById('teia-canvas-container');
    if (!container) return;

    const nodes = npcs.map(npc => {
        return {
            id: npc.id,
            label: npc.nome,
            shape: 'circularImage',
            image: npc.imagem,
            size: 24,
            borderWidth: 3,
            color: {
                border: '#d97706',
                background: '#0f172a',
                highlight: { border: '#fbbf24', background: '#1e293b' }
            },
            font: { color: '#e2e8f0', size: 12, face: 'Cinzel' }
        };
    });

    const edges = conexoes.map(c => {
        return {
            id: c.id,
            from: c.npcId1,
            to: c.npcId2,
            label: c.tipo,
            title: c.comentario || 'Sem comentários.',
            width: 2,
            color: {
                color: '#475569',
                highlight: '#fbbf24',
                hover: '#fbbf24'
            },
            font: { color: '#94a3b8', size: 10, align: 'horizontal' },
            arrows: {
                to: { enabled: true, scaleFactor: 0.5 }
            }
        };
    });

    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const options = {
        physics: {
            stabilization: true,
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.3,
                springLength: 150
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100
        }
    };

    if (networkInstance) {
        networkInstance.destroy();
    }
    networkInstance = new vis.Network(container, data, options);
}
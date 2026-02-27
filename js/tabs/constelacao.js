import { db, doc, runTransaction } from '../core/firebase.js';
import { globalState, CURRENCY_ID, RESET_ID } from '../core/state.js';

export function renderConstelacaoTab() {
    const data = globalState.selectedCharacterData;
    if (!data || !data.ficha) return;

    // 1. Atualizar Sidebar da Constelação
    const orbes = data.ficha.mochila?.[CURRENCY_ID] || 0;
    const currencyDisplay = document.getElementById('const-currency-display');
    if(currencyDisplay) currencyDisplay.textContent = orbes;

    renderConstellationBonuses(data);
    renderConstellationCanvas(data);
}

function renderConstellationBonuses(data) {
    const unlocked = new Set(data.ficha.constelacao_unlocked || []);
    const template = data.constellationTemplate;
    const bonuses = {};

    if (template && template.nodes) {
        template.nodes.forEach(n => {
            if (unlocked.has(n.id) && n.data.bonuses) {
                for (let [k, v] of Object.entries(n.data.bonuses)) {
                    if (bonuses[k] !== undefined) bonuses[k] += v;
                    else bonuses[k] = v;
                }
            }
        });
    }

    const list = document.getElementById('const-bonuses-list');
    if(!list) return;
    
    list.innerHTML = '';
    let hasBonus = false;
    
    for (let [k, v] of Object.entries(bonuses)) {
        if (v !== 0) {
            hasBonus = true;
            const row = document.createElement('div');
            row.className = 'stat-badge-const text-slate-300';
            row.innerHTML = `<span class="uppercase font-bold text-[10px]">${k}</span> <span class="text-amber-400 font-bold">+${v}</span>`;
            list.appendChild(row);
        }
    }
    if (!hasBonus) list.innerHTML = '<p class="text-xs text-slate-600 italic text-center py-2">Nenhum poder ativo.</p>';

    // Barra de Progresso
    const totalNodes = template?.nodes?.length || 1;
    const pct = Math.round((unlocked.size / totalNodes) * 100);
    const progressBar = document.getElementById('const-progress-bar');
    const progressText = document.getElementById('const-progress-text');
    
    if(progressBar) progressBar.style.width = `${pct}%`;
    if(progressText) progressText.textContent = `${pct}%`;
}

function renderConstellationCanvas(data) {
    const container = document.getElementById('nodes-container');
    const svg = document.getElementById('connections-svg');
    const layer = document.getElementById('constellation-layer');
    const template = data.constellationTemplate;

    if(!container || !svg || !layer) return;

    layer.style.width = "800px"; 
    layer.style.height = "800px";
    updateConstellationTransform();
    
    container.innerHTML = '';
    svg.innerHTML = '';

    if (!template || !template.nodes || template.nodes.length === 0) {
        container.innerHTML = '<div class="absolute top-1/2 left-1/2 -translate-x-1/2 text-slate-500 whitespace-nowrap text-sm">Esta classe não possui constelação.</div>';
        return;
    }

    const unlockedIds = new Set(data.ficha.constelacao_unlocked || []);
    const nodes = template.nodes;
    const drawn = new Set();

    // Desenhar Linhas
    nodes.forEach(node => {
        node.connections.forEach(targetId => {
            const key = [node.id, targetId].sort().join('-');
            if (drawn.has(key)) return;
            const target = nodes.find(n => n.id === targetId);
            if (target) {
                const active = unlockedIds.has(node.id) && unlockedIds.has(targetId);
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", `${node.x}%`); line.setAttribute("y1", `${node.y}%`);
                line.setAttribute("x2", `${target.x}%`); line.setAttribute("y2", `${target.y}%`);
                line.setAttribute("class", `c-line ${active ? 'active' : ''}`);
                svg.appendChild(line);
                drawn.add(key);
            }
        });
    });

    // Desenhar Nós
    nodes.forEach(node => {
        const el = document.createElement('div');
        const isUnlocked = unlockedIds.has(node.id);
        const isNeighbor = node.connections.some(id => unlockedIds.has(id));
        const isStart = (node.id === 0);
        const isAccessible = !isUnlocked && (isStart || isNeighbor);
        const customColor = node.data.color || "#0ea5e9";

        el.className = `c-node ${isUnlocked?'unlocked':''} ${isAccessible?'accessible':''} ${(!isUnlocked && !isAccessible)?'locked':''}`;
        el.style.left = `${node.x}%`; el.style.top = `${node.y}%`;
        
        if (isAccessible) el.style.borderColor = customColor;

        if (isUnlocked) el.innerHTML = '<i class="fas fa-check"></i>';
        else if (isAccessible) el.innerHTML = `<span class="text-xs">${node.data.cost}</span>`;
        else el.innerHTML = '<i class="fas fa-lock text-[10px]"></i>';

        // Eventos
        el.onmouseenter = (e) => showConstellationTooltip(e, node, isAccessible, isUnlocked);
        el.onmouseleave = () => {
            const tooltip = document.getElementById('constellation-tooltip');
            if(tooltip) tooltip.style.display = 'none';
        };
        
        if (isAccessible) {
            el.onclick = (e) => {
                e.stopPropagation(); // Evita drag ao clicar
                buyConstellationNode(node);
            };
        }
        container.appendChild(el);
    });
}

function updateConstellationTransform() {
    const layer = document.getElementById('constellation-layer');
    if(!layer) return;
    const t = globalState.constelacao.transform;
    layer.style.transform = `translate(calc(-50% + ${t.x}px), calc(-50% + ${t.y}px)) scale(${t.scale})`;
}

function showConstellationTooltip(e, node, accessible, unlocked) {
    const t = document.getElementById('constellation-tooltip');
    if(!t) return;

    t.style.display = 'block';
    
    const rect = document.getElementById('canvas-wrapper').getBoundingClientRect();
    let x = e.clientX - rect.left + 15;
    let y = e.clientY - rect.top + 15;
    
    t.style.left = x + 'px'; 
    t.style.top = y + 'px';

    let bonusHtml = '';
    if (node.data.bonuses) {
        for (let [k, v] of Object.entries(node.data.bonuses)) {
            if (v !== 0) bonusHtml += `<div class="text-sky-400 text-xs font-bold">+${v} ${k.toUpperCase()}</div>`;
        }
    }
    const status = unlocked ? '<span class="text-green-400">DESBLOQUEADO</span>' : (accessible ? '<span class="text-amber-400">DISPONÍVEL</span>' : '<span class="text-slate-500">BLOQUEADO</span>');
    
    t.innerHTML = `
        <h4 class="text-amber-400 font-cinzel text-sm border-b border-slate-700 pb-1 mb-2">${node.data.title}</h4>
        <div class="mb-2 space-y-1">${bonusHtml || '<span class="text-slate-500 text-xs">Sem bônus</span>'}</div>
        <div class="flex justify-between text-xs border-t border-slate-700 pt-1">
            <span class="text-slate-300">Custo: ${node.data.cost} Orbes</span>
            <span class="font-bold text-[10px]">${status}</span>
        </div>
    `;
}

async function buyConstellationNode(node) {
    const charId = globalState.selectedCharacterId;
    const data = globalState.selectedCharacterData.ficha;
    const cost = node.data.cost || 0;
    const current = data.mochila?.[CURRENCY_ID] || 0;

    if (current < cost) return alert(`Saldo insuficiente. Custo: ${cost} | Você tem: ${current}`);
    if (!confirm(`Desbloquear "${node.data.title}" por ${cost} Orbes?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            if (!sf.exists()) throw "Ficha não existe!";
            
            const d = sf.data();
            const money = d.mochila?.[CURRENCY_ID] || 0;
            
            if (money < cost) throw "Saldo insuficiente no servidor.";

            const newMochila = { ...d.mochila };
            newMochila[CURRENCY_ID] = money - cost;
            if (newMochila[CURRENCY_ID] <= 0) delete newMochila[CURRENCY_ID];

            const unlocked = [...(d.constelacao_unlocked || []), node.id];
            
            t.update(ref, { 
                mochila: newMochila, 
                constelacao_unlocked: unlocked 
            });
        });
    } catch (e) {
        console.error(e);
        alert("Erro ao comprar nó: " + (e.message || e));
    }
}

// Configura os Listeners Estáticos da Constelação (Drag, Drop, Zoom, Reset)
export function setupConstelacaoListeners() {
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (!canvasWrapper) return;
    
    canvasWrapper.addEventListener('mousedown', e => {
        if (e.target.closest('.c-node')) return; // Não arrasta se clicar no nó
        globalState.constelacao.isDragging = true;
        globalState.constelacao.startPos = { 
            x: e.clientX - globalState.constelacao.transform.x, 
            y: e.clientY - globalState.constelacao.transform.y 
        };
        canvasWrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        if (!globalState.constelacao.isDragging) return;
        e.preventDefault();
        globalState.constelacao.transform.x = e.clientX - globalState.constelacao.startPos.x;
        globalState.constelacao.transform.y = e.clientY - globalState.constelacao.startPos.y;
        updateConstellationTransform();
    });

    window.addEventListener('mouseup', () => {
        globalState.constelacao.isDragging = false;
        canvasWrapper.style.cursor = 'grab';
    });

    document.getElementById('const-zoom-in')?.addEventListener('click', () => {
        globalState.constelacao.transform.scale *= 1.2;
        updateConstellationTransform();
    });

    document.getElementById('const-zoom-out')?.addEventListener('click', () => {
        globalState.constelacao.transform.scale *= 0.8;
        updateConstellationTransform();
    });

    document.getElementById('btn-const-reset')?.addEventListener('click', async () => {
        const charId = globalState.selectedCharacterId;
        const qtd = globalState.selectedCharacterData?.ficha?.mochila?.[RESET_ID] || 0;
        
        if (qtd < 1) return alert("Você precisa de uma 'Lágrima do Destino' para resetar a constelação.");
        if (!confirm("ATENÇÃO: Isso irá resetar toda sua constelação. Os Orbes gastos NÃO SERÃO DEVOLVIDOS. Deseja continuar?")) return;

        try {
            await runTransaction(db, async (t) => {
                const ref = doc(db, "rpg_fichas", charId);
                const sf = await t.get(ref);
                const d = sf.data();
                
                const newMochila = { ...d.mochila };
                newMochila[RESET_ID] = (d.mochila[RESET_ID] || 0) - 1;
                if (newMochila[RESET_ID] <= 0) delete newMochila[RESET_ID];

                t.update(ref, { constelacao_unlocked: [], mochila: newMochila });
            });
            alert("Constelação resetada com sucesso.");
        } catch (e) {
            console.error(e);
            alert("Erro ao resetar.");
        }
    });
}
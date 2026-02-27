import { globalState } from '../core/state.js';
import { calculateDetailedStats } from '../core/calculos.js';

export function renderCalculadoraAtributos() {
    const content = document.getElementById('calculator-content');
    const charData = globalState.selectedCharacterData;
    
    // Se não tiver personagem selecionado, esconde
    if (!charData) {
        if(content) content.classList.add('hidden');
        return;
    }
    
    if(content) content.classList.remove('hidden');

    // 1. Realiza os cálculos chamando a função centralizada
    const stats = calculateDetailedStats(charData);

    // 2. Mapeamento dos containers HTML da aba
    const map = [
        { id: 'atk-container', data: stats.Ataque },
        { id: 'def-container', data: stats.Defesa },
        { id: 'eva-container', data: stats.Evasao }
    ];

    // 3. Renderiza cada coluna (Ataque, Defesa, Evasão)
    map.forEach(group => {
        const el = document.getElementById(group.id);
        if(!el) return;
        el.innerHTML = '';

        // Itera sobre os tipos (Fisico, Magico, Espiritual...)
        Object.keys(group.data).forEach(typeName => {
            const val = group.data[typeName];
            
            const div = document.createElement('div');
            div.className = "bg-slate-900/80 p-3 rounded mb-3 border border-slate-700 shadow-sm hover:border-amber-500/50 transition-colors";
            
            div.innerHTML = `
                <div class="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                    <span class="text-amber-500 font-bold text-xs uppercase tracking-wider">${typeName}</span>
                    <span class="text-white font-cinzel font-bold text-xl">${val.total.toFixed(0)}</span>
                </div>
                <div class="grid grid-cols-2 gap-y-1 gap-x-4 text-[10px] text-slate-500 font-mono">
                    <div class="flex justify-between"><span>Base:</span> <span class="text-slate-300">${val.base}</span></div>
                    <div class="flex justify-between"><span>Nível:</span> <span class="text-slate-300">+${val.progressao.toFixed(0)}</span></div>
                    <div class="flex justify-between"><span>Equip:</span> <span class="text-sky-400">+${val.equipamentos}</span></div>
                    <div class="flex justify-between"><span>Distrib:</span> <span class="text-emerald-400">+${val.distribuidos}</span></div>
                    <div class="flex justify-between"><span>Constel:</span> <span class="text-purple-400">+${val.constelacao}</span></div>
                    <div class="flex justify-between"><span>Ego:</span> <span class="text-pink-400">+${val.ego || 0}</span></div>
                </div>
            `;
            el.appendChild(div);
        });
    });
}
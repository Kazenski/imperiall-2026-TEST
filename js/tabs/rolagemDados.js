import { rtdb, rtdbRef, push, set, rtdbServerTimestamp } from '../core/firebase.js';
import { globalState } from '../core/state.js';

const DICE_TYPES = [
    { id: 'moeda', sides: 2, icon: 'fa-coins', label: 'Moeda' },
    { id: 'd4', sides: 4, icon: 'fa-dice-d6', label: 'D4' },
    { id: 'd6', sides: 6, icon: 'fa-dice-d6', label: 'D6' },
    { id: 'd8', sides: 8, icon: 'fa-dice-d20', label: 'D8' },
    { id: 'd10', sides: 10, icon: 'fa-dice-d20', label: 'D10' },
    { id: 'd12', sides: 12, icon: 'fa-dice-d20', label: 'D12' },
    { id: 'd20', sides: 20, icon: 'fa-dice-d20', label: 'D20' },
    { id: 'd100', sides: 100, icon: 'fa-dice-d20', label: 'D100' },
];

window.rollDiceSidebar = async function(id, sides, label) {
    const die = DICE_TYPES.find(d => d.id === id);
    if(die) handleRoll(die);
};

export function renderRolagemDados() {
    const container = document.getElementById('dice-container');
    if (container) {
        container.innerHTML = '';
        DICE_TYPES.forEach(die => {
            const btn = document.createElement('div');
            btn.className = `die-button ${!globalState.selectedCharacterId && !globalState.isAdmin ? 'disabled' : ''}`;
            btn.innerHTML = `
                <span class="die-label">${die.label}</span>
                <i class="fas ${die.icon} die-icon"></i>
                <span class="die-result" id="result-${die.id}">--</span>`;
            
            btn.addEventListener('click', () => handleRoll(die));
            container.appendChild(btn);
        });
    }
    renderLogRolagens();
}

async function handleRoll(die) {
    const charId = globalState.selectedCharacterId;
    if (!charId && !globalState.isAdmin) return alert("Selecione um personagem primeiro para rolar dados!");
    if (!globalState.activeSessionId || globalState.activeSessionId === 'world') return alert("Selecione uma Mesa de Sessão primeiro!");

    const result = die.id === 'moeda' ? (Math.random() < 0.5 ? 'Cara' : 'Coroa') : Math.floor(Math.random() * die.sides) + 1;
    
    const resEl = document.querySelector(`#result-${die.id}`);
    if (resEl) {
        resEl.textContent = result;
        resEl.classList.remove('rolled');
        void resEl.offsetWidth; 
        resEl.classList.add('rolled');
    }

    let remetenteId = "master"; let remetenteNome = "Mestre";
    if (globalState.selectedCharacterData && globalState.selectedCharacterData.ficha) {
        remetenteId = charId;
        remetenteNome = globalState.selectedCharacterData.ficha.nome;
    }

    const payload = {
        tipo: 'dice',
        remetenteId: remetenteId,
        remetenteNome: remetenteNome,
        dado: die.label,
        valor: result,
        timestamp: rtdbServerTimestamp() // Timestamp do Realtime Database
    };

    try {
        // Grava no Realtime Database!
        const chatRef = rtdbRef(rtdb, `session_chats/${globalState.activeSessionId}`);
        const newMsgRef = push(chatRef);
        await set(newMsgRef, payload);
    } catch(e) { 
        console.error("Erro ao enviar rolagem:", e); 
    }
}

export function renderLogRolagens() {
    const logContainerWrapper = document.getElementById('log-rolagens-container');
    if (!logContainerWrapper) return;
    
    const container = logContainerWrapper.querySelector('#log-lista');
    if (!container) return;

    container.innerHTML = '';
    
    const allLogs = globalState.currentChatLogs || [];
    const diceLogs = allLogs.filter(log => log.tipo === 'dice');
    
    if (diceLogs.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm italic">Nenhuma rolagem registrada nesta sessão.</p>';
        return;
    }

    diceLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-item bg-slate-900 border border-slate-700 rounded p-3 mb-2 shadow-sm flex justify-between items-center';
        
        // RTDB lida com timestamps diferentemente (são milisegundos inteiros)
        const dataStr = log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '...';
        
        div.innerHTML = `
            <div>
                <span class="text-sky-400 font-bold mr-2">${log.remetenteNome}</span>
                <span class="text-slate-300">Rolou <strong>${log.dado}</strong></span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-amber-400 font-black text-xl">${log.valor}</span>
                <span class="log-timestamp text-xs text-slate-500">${dataStr}</span>
            </div>
        `;
        container.appendChild(div);
    });
}
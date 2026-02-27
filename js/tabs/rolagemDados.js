import { db, updateDoc, doc } from '../core/firebase.js';
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

export function renderRolagemDados() {
    const container = document.getElementById('dice-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    DICE_TYPES.forEach(die => {
        const btn = document.createElement('div');
        btn.className = `die-button ${!globalState.selectedCharacterId ? 'disabled' : ''}`;
        btn.innerHTML = `
            <span class="die-label">${die.label}</span>
            <i class="fas ${die.icon} die-icon"></i>
            <span class="die-result" id="result-${die.id}">--</span>`;
        
        if (globalState.selectedCharacterData?.ficha?.rolagens?.[die.id]) {
            btn.querySelector('.die-result').textContent = globalState.selectedCharacterData.ficha.rolagens[die.id];
        }

        btn.addEventListener('click', () => handleRoll(die));
        container.appendChild(btn);
    });
    
    renderLogRolagens();
}

async function handleRoll(die) {
    const charId = globalState.selectedCharacterId;
    if (!charId) return;

    const result = die.id === 'moeda' ? (Math.random() < 0.5 ? 'Cara' : 'Coroa') : Math.floor(Math.random() * die.sides) + 1;
    
    // Animação UI
    const resEl = document.querySelector(`#result-${die.id}`);
    if (resEl) {
        resEl.textContent = result;
        resEl.classList.remove('rolled');
        void resEl.offsetWidth; // Trigger reflow
        resEl.classList.add('rolled');
    }

    // Atualiza Dados no Cache Local
    const ficha = globalState.selectedCharacterData.ficha;
    if (!ficha.rolagens) ficha.rolagens = {};
    ficha.rolagens[die.id] = result;
    
    // Atualiza Log
    const novoLog = {
        dado: die.label,
        valor: result,
        timestamp: Date.now()
    };
    
    const logsAtuais = ficha.log_rolagens || [];
    logsAtuais.unshift(novoLog); // Adiciona no início
    if (logsAtuais.length > 50) logsAtuais.pop(); // Mantém 50
    ficha.log_rolagens = logsAtuais;

    renderLogRolagens(); // Atualiza UI Log imediatamente

    // Atualiza no Banco
    try {
        await updateDoc(doc(db, "rpg_fichas", charId), {
            [`rolagens.${die.id}`]: result,
            log_rolagens: logsAtuais
        });
    } catch(e) { 
        console.error("Erro ao salvar rolagem:", e); 
    }
}

function renderLogRolagens() {
    const logContainerWrapper = document.getElementById('log-rolagens-container');
    if (!logContainerWrapper) return;
    
    const container = logContainerWrapper.querySelector('#log-lista');
    if (!container) return;

    container.innerHTML = '';
    const logs = globalState.selectedCharacterData?.ficha?.log_rolagens || [];
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm italic">Nenhuma rolagem registrada.</p>';
        return;
    }

    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-item';
        const dataStr = new Date(log.timestamp).toLocaleString('pt-BR');
        div.innerHTML = `
            <span class="log-timestamp">${dataStr}</span>
            <span>Rolou <strong>${log.dado}</strong></span>
            <span class="log-value">${log.valor}</span>
        `;
        container.appendChild(div);
    });
}
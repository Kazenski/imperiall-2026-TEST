import { db, doc, updateDoc, runTransaction, writeBatch, arrayUnion, getDoc } from '../core/firebase.js';
import { globalState, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML } from '../core/utils.js';
import { getFomeDebuffMultiplier, calculateStatCascade } from '../core/calculos.js';

// Estado interno da aba
let skillTabState = 'learned'; // 'learned' ou 'possible'

export function renderMinhasHabilidades() {
    const charData = globalState.selectedCharacterData;
    
    // Atualiza o visor de AP
    const ap = charData ? (charData.ficha.apPersonagemBase || 0) : 0;
    const apDisplay = document.getElementById('skill-ap-display');
    if(apDisplay) apDisplay.textContent = ap;

    // Fecha painel de detalhes anterior
    const details = document.getElementById('skill-details-panel');
    if(details) details.classList.add('hidden');

    // Renderiza a sub-aba ativa e o histórico logo abaixo
    setTimeout(() => {
        window.switchSkillTab(skillTabState);
        window.renderSkillUsageLogs(); 
    }, 0);
}

window.switchSkillTab = function(tab) {
    skillTabState = tab;
    const learnedGrid = document.getElementById('grid-learned');
    const possibleGrid = document.getElementById('grid-possible');
    const btnLearned = document.getElementById('btn-tab-learned');
    const btnPossible = document.getElementById('btn-tab-possible');

    if(!btnLearned || !learnedGrid) return;

    if (tab === 'learned') {
        btnLearned.classList.add('active');
        btnPossible.classList.remove('active');
        learnedGrid.classList.remove('hidden');
        possibleGrid.classList.add('hidden');
        renderLearnedList();
    } else {
        btnPossible.classList.add('active');
        btnLearned.classList.remove('active');
        possibleGrid.classList.remove('hidden');
        learnedGrid.classList.add('hidden');
        renderPossibleList();
    }
    
    const detailsPanel = document.getElementById('skill-details-panel');
    if (detailsPanel) detailsPanel.classList.add('hidden');
};

function renderLearnedList() {
    const grid = document.getElementById('grid-learned');
    const charData = globalState.selectedCharacterData;
    if (!charData) return;

    const mySkills = charData.ficha.habilidades || {};
    const ids = Object.keys(mySkills);
    
    grid.innerHTML = '';
    if (ids.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-500 italic py-10">Nenhuma habilidade aprendida.</p>';
        return;
    }

    ids.sort((a,b) => {
        const nA = globalState.cache.habilidades.get(a)?.nome || '';
        const nB = globalState.cache.habilidades.get(b)?.nome || '';
        return nA.localeCompare(nB);
    });

    ids.forEach(id => {
        const master = globalState.cache.habilidades.get(id);
        if (!master) return;
        const userSkill = mySkills[id];
        const isFav = userSkill.isFavorite === true;

        const slot = createSkillSlotHTML(id, master, userSkill.nivel, true, isFav);
        grid.appendChild(slot);
    });
}

function renderPossibleList() {
    const grid = document.getElementById('grid-possible');
    const charData = globalState.selectedCharacterData;
    if (!charData) return;

    const mySkills = charData.ficha.habilidades || {};
    const myClass = charData.ficha.classeId;
    const mySubclass = charData.ficha.subclasseId;

    grid.innerHTML = '';
    const possible = [];

    globalState.cache.habilidades.forEach((skill, id) => {
        if (mySkills[id]) return;

        let allowed = true;
        
        if (skill.restricaoClasses && Array.isArray(skill.restricaoClasses) && skill.restricaoClasses.length > 0) {
            if (!skill.restricaoClasses.includes(myClass)) allowed = false;
        }
        
        if (skill.restricaoSubclasses && Array.isArray(skill.restricaoSubclasses) && skill.restricaoSubclasses.length > 0) {
            if (skill.restricaoSubclasses.includes(mySubclass)) allowed = true;
            else if (!allowed) allowed = false;
        }

        if (allowed) possible.push({ id, ...skill });
    });

    if (possible.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-500 italic py-10">Nenhuma habilidade disponível para compra.</p>';
        return;
    }

    possible.sort((a,b) => a.nome.localeCompare(b.nome));

    possible.forEach(skill => {
        const slot = createSkillSlotHTML(skill.id, skill, 0, false);
        grid.appendChild(slot);
    });
}

function createSkillSlotHTML(id, master, level, isLearned, isFavorite = false) {
    const div = document.createElement('div');
    div.className = `grid-slot skill-slot ${isLearned ? '' : 'unlearned'}`;
    div.dataset.name = (master.nome || '').toLowerCase();
    div.title = master.nome;
    
    if (master.imagemUrl) {
        div.style.backgroundImage = `url('${master.imagemUrl}')`;
    }

    if (isLearned) {
        div.innerHTML = `<span class="grid-slot-quantity">Nvl ${level}</span>`;

        const starBtn = document.createElement('div');
        starBtn.className = `skill-fav-btn ${isFavorite ? 'is-fav' : ''}`;
        starBtn.innerHTML = isFavorite ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>'; 
        
        starBtn.onclick = (e) => window.toggleSkillFavorite(e, id);
        div.appendChild(starBtn);
    }

    div.onclick = (e) => {
        if(e.target.closest('.skill-fav-btn')) return;
        window.openSkillDetails(id, isLearned);
    };
    
    return div;
}

window.toggleSkillFavorite = async function(e, skillId) {
    e.stopPropagation(); 
    
    const charId = globalState.selectedCharacterId;
    const btn = e.currentTarget;
    const isFav = btn.classList.contains('is-fav');
    const newState = !isFav; 

    if (newState) {
        btn.classList.add('is-fav');
        btn.innerHTML = '<i class="fas fa-star"></i>';
    } else {
        btn.classList.remove('is-fav');
        btn.innerHTML = '<i class="far fa-star"></i>';
    }

    if (globalState.selectedCharacterData && globalState.selectedCharacterData.ficha.habilidades[skillId]) {
        globalState.selectedCharacterData.ficha.habilidades[skillId].isFavorite = newState;
    }

    try {
        await updateDoc(doc(db, "rpg_fichas", charId), {
            [`habilidades.${skillId}.isFavorite`]: newState
        });
    } catch(err) {
        console.error("Erro ao favoritar habilidade:", err);
        alert("Erro ao salvar favorito. Verifique sua conexão.");
        
        if (!newState) {
            btn.classList.add('is-fav');
            btn.innerHTML = '<i class="fas fa-star"></i>';
        } else {
            btn.classList.remove('is-fav');
            btn.innerHTML = '<i class="far fa-star"></i>';
        }
    }
};

window.filterSkills = function(term) {
    term = term.toLowerCase();
    const activeGrid = skillTabState === 'learned' ? document.getElementById('grid-learned') : document.getElementById('grid-possible');
    const slots = activeGrid.querySelectorAll('.grid-slot');
    slots.forEach(s => {
        s.style.display = s.dataset.name.includes(term) ? '' : 'none';
    });
};

window.openSkillDetails = function(skillId, isLearned) {
    const panel = document.getElementById('skill-details-panel');
    const master = globalState.cache.habilidades.get(skillId);
    const char = globalState.selectedCharacterData.ficha;
    const ap = char.apPersonagemBase || 0;
    const mpAtual = char.mpPersonagemBase || 0;

    if(!master || !panel) return;

    document.querySelectorAll('.skill-slot').forEach(s => s.classList.remove('selected'));
    const slots = document.querySelectorAll(`.skill-slot`);
    slots.forEach(s => {
        if(s.onclick.toString().includes(skillId)) s.classList.add('selected');
    });

    let displayLevel = 1;
    let damageVal = master.efeitoDanoBaseUsoHabilidade || 0;
    let mpCost = master.gastoMpUso || 0; 
    let nextLevelHtml = '';
    let actionHtml = '';

    if (isLearned) {
        displayLevel = char.habilidades[skillId].nivel;
        if (master.niveis && master.niveis[displayLevel]?.danoBaseHabilidade !== undefined) {
            damageVal = master.niveis[displayLevel].danoBaseHabilidade;
        }

        const nextLevel = displayLevel + 1;
        const nextLevelData = master.niveis ? master.niveis[nextLevel] : null;
        if (nextLevelData) {
            const nextDamage = nextLevelData.danoBaseHabilidade || 0;
            nextLevelHtml = `
                <div class="mt-3 p-3 bg-amber-900/10 border border-amber-500/20 rounded-lg">
                    <div class="text-[10px] text-amber-500 uppercase font-bold mb-1">Preview Próximo Nível (Nvl ${nextLevel})</div>
                    <div class="grid grid-cols-2 gap-4 text-xs">
                        <div><strong class="text-slate-500">Dano/Efeito:</strong> <span class="text-emerald-400 font-bold">${nextDamage}</span></div>
                        <div><strong class="text-slate-500">Custo MP:</strong> <span class="text-blue-400 font-bold">${mpCost}</span></div>
                    </div>
                </div>`;
        }

        const costAP = (displayLevel + 1) + 5;
        const canUpgrade = ap >= costAP;

        actionHtml = `
            <div class="mt-4 p-4 bg-slate-900 rounded border border-slate-700 flex flex-wrap gap-4 justify-between items-center">
                <div class="flex flex-col">
                    <div class="text-xs text-slate-400 uppercase font-bold">Evoluir para Nível ${displayLevel+1}</div>
                    <div class="text-rose-400 font-bold text-lg">Custo: ${costAP} AP</div>
                </div>
                <button onclick="window.executeSkillUsage('${skillId}', ${damageVal}, ${mpCost})" 
                    class="btn bg-sky-500 hover:bg-sky-400 text-black font-black px-6 py-3 shadow-lg flex flex-col items-center leading-none transform active:scale-95 transition-all">
                    <span class="text-xs mb-1 uppercase tracking-tighter">Usar Habilidade</span>
                    <span class="text-sm">MP: ${mpAtual} / ${char.mpMaxPersonagemBase || 0}</span>
                </button>
                <button onclick="window.processSkillAction('upgrade', '${skillId}', ${costAP})" 
                    class="btn ${canUpgrade ? 'btn-primary' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} py-2 px-4 shadow-lg">
                    <i class="fas fa-arrow-up"></i> Upar
                </button>
            </div>
            <div id="skill-roll-result" class="hidden mt-3 p-4 bg-slate-950/80 border border-sky-500/30 rounded-lg text-center shadow-inner"></div>`;
    } else {
        const costToLearn = master.custoAprendizado || 10; 
        const canLearn = ap >= costToLearn;

        actionHtml = `
            <div class="mt-4 p-4 bg-slate-900/80 rounded border border-emerald-500/30 flex flex-wrap gap-4 justify-between items-center animate-fade-in">
                <div class="flex flex-col">
                    <div class="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Nova Habilidade</div>
                    <div class="text-white font-bold text-lg">Custo: ${costToLearn} AP</div>
                </div>
                <button onclick="window.processSkillAction('buy', '${skillId}', ${costToLearn})" 
                    class="btn ${canLearn ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} px-8 py-3 shadow-lg font-bold uppercase tracking-wider transition-all">
                    <i class="fas fa-book-open mr-2"></i> Aprender
                </button>
            </div>`;
    }

    const influencia = Array.isArray(master.atributoInfluenciaHabilidade) ? master.atributoInfluenciaHabilidade.join(', ') : (master.atributoInfluenciaHabilidade || '-');

    panel.innerHTML = `
        <div class="flex flex-col md:flex-row gap-6 items-start">
            <img src="${master.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-24 h-24 rounded-full border-4 border-slate-600 bg-black object-cover shrink-0">
            <div class="flex-grow w-full">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-cinzel text-xl text-amber-400 m-0">${master.nome}</h3>
                    <span class="text-xs bg-emerald-900 text-emerald-400 px-2 py-1 rounded border border-emerald-700 font-bold">${isLearned ? 'NÍVEL ' + displayLevel : 'DISPONÍVEL'}</span>
                </div>
                <p class="text-sm text-slate-300 italic mb-4 border-l-2 border-slate-600 pl-3">${master.descricaoEfeito || 'Sem descrição.'}</p>
                <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-400 border-t border-slate-700 pt-3">
                    <div><strong class="text-slate-500 block">Influência</strong> ${influencia}</div>
                    <div><strong class="text-slate-500 block">Custo MP</strong> <span class="text-blue-400 font-bold">${mpCost}</span></div>
                    <div><strong class="text-slate-500 block">Dano/Efeito Base</strong> <span class="text-red-400 font-bold">${damageVal}</span></div>
                    <div><strong class="text-slate-500 block">Ação</strong> ${master.tipoAcaoHabildiade || '-'}</div>
                </div>
                ${nextLevelHtml}
                ${actionHtml}
            </div>
        </div>`;
    panel.classList.remove('hidden');
};

window.renderSkillUsageLogs = function() {
    const container = document.getElementById('skill-log-list');
    const adminArea = document.getElementById('admin-skill-log-actions');
    if (!container) return;

    if (adminArea) {
        if (globalState.isAdmin) adminArea.classList.remove('hidden');
        else adminArea.classList.add('hidden');
    }

    const logs = globalState.selectedCharacterData?.ficha?.log_habilidades || [];
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="text-slate-600 italic text-xs text-center py-4">Nenhum registro.</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const statIcon = log.statName === 'DEF' ? '🛡️' : (log.statName === 'EVA' ? '🏃' : '⚔️');
        const hungerWarn = log.isDebuffed ? `<span class="text-red-500 ml-1" title="Debuff de Fome Ativo!"><i class="fas fa-drumstick-bite"></i></span>` : '';
        
        return `
        <div class="bg-slate-800/60 border-l-4 border-amber-600 p-2 rounded flex justify-between items-center animate-fade-in mb-1">
            <div class="overflow-hidden">
                <div class="text-[10px] font-bold text-slate-200 uppercase truncate">${log.skillNome}</div>
                <div class="text-[8px] text-slate-500 font-mono">${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</div>
            </div>
            <div class="text-right shrink-0">
                <div class="text-[9px] text-slate-400 font-mono">🎲${log.d20} + 💥${log.damageBase} + ${statIcon}${log.atkTotal}${hungerWarn}</div>
                <div class="text-sm font-cinzel font-bold text-amber-500 leading-none">Total: ${log.total}</div>
            </div>
        </div>
        `;
    }).join('');
};

window.clearSkillLogs = async function() {
    if(!confirm("Deseja limpar o histórico de uso?")) return;
    const charId = globalState.selectedCharacterId;
    try {
        await updateDoc(doc(db, "rpg_fichas", charId), { log_habilidades: [] });
    } catch(e) { console.error(e); }
};

window.executeSkillUsage = async function(skillId, damageBase, mpCost) {
    const resultArea = document.getElementById('skill-roll-result');
    const charId = globalState.selectedCharacterId;
    
    const charFullData = globalState.cache.all_personagens.get(charId); 
    if (!charId || !charFullData) return;
    const charData = charFullData.ficha || charFullData;

    const attrs = charData.atributosBasePersonagem || {};
    const mpShieldMax = Number(attrs.defesaMagicaNativaTotal) || 0;
    const mpExtraMax = Number(attrs.pontosMPExtraTotal) || 0;
    const mpBaseMax = Number(charData.mpMaxPersonagemBase) || 1;

    const mpShield = charData.mpShieldAtual !== undefined ? Number(charData.mpShieldAtual) : mpShieldMax;
    const mpExtra = charData.mpExtraAtual !== undefined ? Number(charData.mpExtraAtual) : mpExtraMax;
    const mpBase = charData.mpPersonagemBase !== undefined ? Number(charData.mpPersonagemBase) : mpBaseMax;
    
    const totalMP = Math.max(0, mpBase + mpExtra + mpShield);
    const safeCost = Number(mpCost) || 0;

    if (totalMP < safeCost) {
        if(resultArea) {
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = `<div class="text-red-500 font-bold uppercase text-xs">MP Insuficiente! (Você tem ${totalMP})</div>`;
        } else {
            alert(`MP Insuficiente!\nVocê tem: ${totalMP}\nCusto: ${safeCost}`);
        }
        return;
    }

    try {
        const cascade = calculateStatCascade(charData, 'mp', -Math.abs(safeCost));
        let newMpValue = cascade.total;

        Object.assign(charData, cascade.updates);

        const masterSkill = globalState.cache.habilidades.get(skillId);
        const skillName = masterSkill ? masterSkill.nome : "Habilidade";
        
        let statName = "ATK";
        let rawStatVal = charData.atkPersonagemBase || 0;

        if (masterSkill && masterSkill.atributoInfluenciaHabilidade) {
            const inf = Array.isArray(masterSkill.atributoInfluenciaHabilidade) ? masterSkill.atributoInfluenciaHabilidade[0] : masterSkill.atributoInfluenciaHabilidade;
            if (inf && inf.includes('Defesa')) { statName = "DEF"; rawStatVal = charData.defPersonagemBase || 0; } 
            else if (inf && inf.includes('Evasao')) { statName = "EVA"; rawStatVal = charData.evaPersonagemBase || 0; }
        }

        const debuffFome = getFomeDebuffMultiplier(charData);
        const statTotal = Math.floor(rawStatVal * debuffFome);
        const isDebuffed = debuffFome < 1;

        const d20 = Math.floor(Math.random() * 20) + 1;
        const finalPower = d20 + damageBase + statTotal;

        const novoLog = {
            skillNome: skillName,
            d20: d20,
            damageBase: damageBase,
            atkTotal: statTotal,
            statName: statName,
            isDebuffed: isDebuffed,
            total: finalPower,
            timestamp: Date.now()
        };

        const logsAntigos = charData.log_habilidades || [];
        const novosLogs = [novoLog, ...logsAntigos].slice(0, 50);

        await runTransaction(db, async (transaction) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const sf = await transaction.get(charRef);
            if (!sf.exists()) throw "Ficha não encontrada.";
            
            transaction.update(charRef, {
                ...cascade.updates,
                log_habilidades: novosLogs
            });
        });

        const sessionId = globalState.activeSessionId;
        if (sessionId && sessionId !== 'world') {
            const sessionRef = doc(db, "rpg_sessions", sessionId);
            const sessionSnap = await getDoc(sessionRef); 
            if (sessionSnap.exists()) {
                const sData = sessionSnap.data();
                const tokens = sData.arena_state?.tokens || {};
                const batch = writeBatch(db);
                let tokenFound = false;

                Object.entries(tokens).forEach(([tid, token]) => {
                    if (token.originId === charId && token.originCollection === 'rpg_fichas') {
                        batch.update(sessionRef, { [`arena_state.tokens.${tid}.mp`]: newMpValue });
                        tokenFound = true;
                    }
                });
                if (tokenFound) await batch.commit();
            }
        }

        if(resultArea) {
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-pulse text-sky-400 font-bold text-sm uppercase">Habilidade Usada!</div>
                    <div class="text-xs text-slate-400 mt-1">MP Restante Total: <span class="text-white font-bold">${newMpValue}</span></div>
                </div>`;
        }

        if(window.renderSkillUsageLogs) window.renderSkillUsageLogs();

    } catch (e) {
        console.error(e);
        alert(typeof e === 'string' ? e : "Erro desconhecido");
    }
};

window.processSkillAction = async function(action, skillId, cost) {
    const charId = globalState.selectedCharacterId;
    const verb = action === 'upgrade' ? 'evoluir' : 'aprender';
    
    if(!confirm(`Deseja gastar ${cost} AP para ${verb} esta habilidade?`)) return;

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const sf = await t.get(ref);
            if (!sf.exists()) throw "Ficha não encontrada.";
            
            const data = sf.data();
            const ap = data.apPersonagemBase || 0;
            const skills = data.habilidades || {};

            if (ap < cost) throw "AP insuficiente no servidor.";

            const newAP = ap - cost;
            
            if (action === 'upgrade') {
                if (!skills[skillId]) throw "Você não tem esta habilidade.";
                skills[skillId].nivel = (skills[skillId].nivel || 1) + 1;
            } else if (action === 'buy') {
                if (skills[skillId]) throw "Você já tem esta habilidade.";
                skills[skillId] = { nivel: 1, status: "Ativo", dataAquisicao: Date.now() };
            }

            t.update(ref, { apPersonagemBase: newAP, habilidades: skills });
        });

        alert("Sucesso!");
        if (action === 'buy') window.switchSkillTab('learned');
        
    } catch (e) {
        console.error(e);
        alert("Erro: " + e);
    }
};
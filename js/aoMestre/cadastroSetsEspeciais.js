// Arquivo: js/aoMestre/cadastroSetsEspeciais.js

import { db, collection, getDocs, doc, deleteDoc, addDoc } from '../core/firebase.js';

export function renderCadastroSetsEspeciaisTab() {
    const content = document.getElementById('cadastro-sets-especiais-content');
    if (!content) return console.error("Div do cadastro de sets não encontrada!");

    content.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
            
            <div class="flex items-center justify-between border-b border-slate-700 pb-4">
                <h2 class="font-cinzel text-3xl text-amber-500 drop-shadow-md">
                    <i class="fas fa-layer-group text-slate-500 mr-3"></i> Forja de Sets Especiais
                </h2>
                <div class="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-slate-900 border border-slate-700 px-3 py-1 rounded shadow-inner">
                    Sinergia de Equipamentos
                </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-amber-400"></div>
                
                <h3 class="font-cinzel text-xl text-amber-400 mb-6 border-b border-slate-800 pb-2">
                    <i class="fas fa-hammer mr-2 text-slate-500"></i> Configurações do Set
                </h3>
                
                <form id="form-cadastro-set" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Sufixo do Set <span class="text-red-500">*</span></label>
                            <input type="text" id="set-sufixo" placeholder="Ex: de Thorin, Melancólico, Corrompido..." required
                                class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-amber-500 transition-colors shadow-inner">
                            <p class="text-[9px] text-slate-500 mt-1 italic">Qualquer item que contenha este texto ativará o set.</p>
                        </div>
                        
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Peças Necessárias <span class="text-red-500">*</span></label>
                            <select id="set-pecas" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-amber-400 outline-none focus:border-amber-500 transition-colors shadow-inner font-bold">
                                <option value="2">2 Peças</option>
                                <option value="3">3 Peças</option>
                                <option value="4">4 Peças</option>
                                <option value="5">5 Peças</option>
                                <option value="6">6 Peças</option>
                                <option value="8">8 Peças</option>
                                <option value="16">16 Peças</option>
                            </select>
                        </div>
                    </div>

                    <h3 class="font-cinzel text-xl text-amber-400 mb-6 border-b border-slate-800 pb-2 mt-8">
                        <i class="fas fa-chart-pie mr-2 text-slate-500"></i> Bônus de Atributos Base
                    </h3>
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Bônus HP Max</label>
                            <input type="number" id="set-bonus-hp" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-red-400 font-bold outline-none focus:border-red-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Bônus MP Max</label>
                            <input type="number" id="set-bonus-mp" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-blue-400 font-bold outline-none focus:border-blue-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Ataque (ATK)</label>
                            <input type="number" id="set-bonus-atk" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-amber-400 font-bold outline-none focus:border-amber-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Defesa (DEF)</label>
                            <input type="number" id="set-bonus-def" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sky-400 font-bold outline-none focus:border-sky-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Evasão (EVA)</label>
                            <input type="number" id="set-bonus-eva" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-emerald-400 font-bold outline-none focus:border-emerald-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">AP Máximo</label>
                            <input type="number" id="set-bonus-ap" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-purple-400 font-bold outline-none focus:border-purple-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Movimento (Vel.)</label>
                            <input type="number" id="set-bonus-mov" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-bold outline-none focus:border-slate-500 shadow-inner text-center">
                        </div>
                        <div class="form-group">
                            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Iniciativa</label>
                            <input type="number" id="set-bonus-ini" value="0" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-bold outline-none focus:border-slate-500 shadow-inner text-center">
                        </div>
                    </div>

                    <div class="pt-6 border-t border-slate-800 flex justify-end">
                        <button type="submit" class="bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest py-3 px-10 rounded transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            <i class="fas fa-save mr-2"></i> Forjar Set Especial
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl">
                <h3 class="font-cinzel text-xl text-slate-300 mb-6 border-b border-slate-800 pb-2">
                    <i class="fas fa-list mr-2 text-slate-500"></i> Sets Forjados
                </h3>
                <div id="lista-sets-cadastrados" class="space-y-3 max-h-[500px] overflow-y-auto custom-scroll pr-2">
                    <p class="text-slate-500 italic text-center py-4">Buscando na biblioteca...</p>
                </div>
            </div>

        </div>
    `;

    document.getElementById('form-cadastro-set').addEventListener('submit', salvarSetEspecial);
    listarSetsCadastrados();
}

async function salvarSetEspecial(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const btnOriginalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Forjando...';
    btn.disabled = true;

    const sufixo = document.getElementById('set-sufixo').value.trim();
    const pecasNecessarias = parseInt(document.getElementById('set-pecas').value);

    const novoSet = {
        sufixo: sufixo,
        pecasNecessarias: pecasNecessarias,
        bonus: {
            hp: parseInt(document.getElementById('set-bonus-hp').value) || 0,
            mp: parseInt(document.getElementById('set-bonus-mp').value) || 0,
            atk: parseInt(document.getElementById('set-bonus-atk').value) || 0,
            def: parseInt(document.getElementById('set-bonus-def').value) || 0,
            eva: parseInt(document.getElementById('set-bonus-eva').value) || 0,
            apMax: parseInt(document.getElementById('set-bonus-ap').value) || 0,
            movimento: parseInt(document.getElementById('set-bonus-mov').value) || 0,
            iniciativa: parseInt(document.getElementById('set-bonus-ini').value) || 0
        }
    };

    try {
        await addDoc(collection(db, "setsEspeciais"), novoSet);
        alert("Set especial forjado com sucesso!");
        document.getElementById('form-cadastro-set').reset();
        listarSetsCadastrados();
    } catch (error) {
        console.error("Erro ao cadastrar set: ", error);
        alert("Erro ao forjar o Set.");
    } finally {
        btn.innerHTML = btnOriginalText;
        btn.disabled = false;
    }
}

async function listarSetsCadastrados() {
    const listaDiv = document.getElementById('lista-sets-cadastrados');

    try {
        const snapshot = await getDocs(collection(db, "setsEspeciais"));
        if (snapshot.empty) {
            listaDiv.innerHTML = '<p class="text-slate-500 italic text-center py-4 text-xs uppercase tracking-widest">Nenhum set forjado ainda.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const set = docSnap.data();
            const id = docSnap.id;

            // Gerar badges de atributos visualmente ricas
            let statsHtml = [];
            if (set.bonus.hp) statsHtml.push(`<span class="bg-red-900/30 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.hp} HP</span>`);
            if (set.bonus.mp) statsHtml.push(`<span class="bg-blue-900/30 text-blue-400 border border-blue-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.mp} MP</span>`);
            if (set.bonus.atk) statsHtml.push(`<span class="bg-amber-900/30 text-amber-400 border border-amber-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.atk} ATK</span>`);
            if (set.bonus.def) statsHtml.push(`<span class="bg-sky-900/30 text-sky-400 border border-sky-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.def} DEF</span>`);
            if (set.bonus.eva) statsHtml.push(`<span class="bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.eva} EVA</span>`);
            if (set.bonus.apMax) statsHtml.push(`<span class="bg-purple-900/30 text-purple-400 border border-purple-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.apMax} AP</span>`);
            if (set.bonus.movimento) statsHtml.push(`<span class="bg-slate-800 text-slate-300 border border-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.movimento} MOV</span>`);
            if (set.bonus.iniciativa) statsHtml.push(`<span class="bg-slate-800 text-slate-300 border border-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold">+${set.bonus.iniciativa} INI</span>`);

            html += `
                <div class="bg-slate-950 border border-slate-700 rounded-lg p-3 flex justify-between items-center group hover:border-amber-500 transition-colors">
                    <div>
                        <div class="text-amber-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                            <i class="fas fa-layer-group text-slate-500"></i> ${set.sufixo}
                            <span class="text-[9px] bg-amber-900/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/30 ml-2">Req: ${set.pecasNecessarias} Peças</span>
                        </div>
                        <div class="flex flex-wrap gap-1.5 mt-2.5">
                            ${statsHtml.length > 0 ? statsHtml.join('') : '<span class="text-[9px] text-slate-500 italic">Nenhum bônus atrelado.</span>'}
                        </div>
                    </div>
                    <button onclick="window.deletarSet('${id}')" class="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 w-8 h-8 flex items-center justify-center rounded transition-colors shadow-sm shrink-0">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            `;
        });
        listaDiv.innerHTML = html;
    } catch (error) {
        console.error("Erro ao buscar sets: ", error);
        listaDiv.innerHTML = '<p class="text-red-500 text-center py-4">Erro ao carregar a lista de sets.</p>';
    }
}

window.deletarSet = async function (id) {
    if (confirm("Os deuses exigem confirmação: Deseja realmente obliterar este Set Especial?")) {
        try {
            await deleteDoc(doc(db, "setsEspeciais", id));
            listarSetsCadastrados();
        } catch (e) {
            console.error("Erro ao deletar: ", e);
            alert("Erro ao excluir o Set.");
        }
    }
}
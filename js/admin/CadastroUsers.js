import { db } from '../core/firebase.js';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { escapeHTML } from '../core/utils.js';

let usersCache = [];
let secAuthInstance = null;

// Inicialização segura e sob demanda da instância secundária para evitar travamentos no carregamento do módulo
function getSecondaryAuth() {
    if (secAuthInstance) return secAuthInstance;
    const firebaseConfig = {
        apiKey: "AIzaSyDLvrHJrPvmqR5PTbn4B9FZO2nIt0iTTU0",
        authDomain: "kazenski-a1bb2.firebaseapp.com",
        projectId: "kazenski-a1bb2",
        storageBucket: "kazenski-a1bb2.firebasestorage.app"
    };
    try {
        const app = getApp("SecondaryAdminUsers");
        secAuthInstance = getAuth(app);
    } catch (e) {
        const app = initializeApp(firebaseConfig, "SecondaryAdminUsers");
        secAuthInstance = getAuth(app);
    }
    return secAuthInstance;
}

export async function renderCadastroUsersTab() {
    const container = document.getElementById('cadastro-users-content');
    if (!container) return;

    try {
        container.innerHTML = `
            <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16 bg-slate-950">
                <header class="relative text-center mb-8 border-b border-slate-700 pb-6 w-full">
                    <h1 class="text-4xl font-bold font-cinzel text-purple-500 tracking-widest drop-shadow-md">
                        <i class="fas fa-users-cog mr-3"></i> Controle de Usuários
                    </h1>
                    <p class="text-slate-400 mt-2 text-sm italic">Gestão de acessos e criação de credenciais em lote</p>
                </header>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    <div class="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl lg:col-span-1">
                        <h2 class="text-xl font-bold font-cinzel text-amber-400 mb-4 flex items-center gap-2">
                            <i class="fas fa-file-import"></i> Cadastro em Lote
                        </h2>
                        <p class="text-xs text-slate-400 mb-4 leading-relaxed">
                            Insira um usuário por linha no formato abaixo de forma exata:<br>
                            <strong class="text-purple-400">email@dominio.com,senha123</strong>
                        </p>
                        
                        <textarea id="bulk-users-input" rows="8" placeholder="jogador1@email.com,senha123&#10;jogador2@email.com,senha456" 
                            class="w-full bg-slate-950 border border-slate-700 rounded p-3 text-xs text-slate-200 outline-none focus:border-purple-500 font-mono resize-none"></textarea>
                        
                        <button onclick="window.userAdminTools.executeBulkRegister()" id="btn-run-bulk"
                            class="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded uppercase tracking-wider text-xs transition-colors shadow-md flex items-center justify-center gap-2">
                            <i class="fas fa-user-plus"></i> Processar Cadastro
                        </button>

                        <div id="bulk-log-area" class="mt-4 p-3 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono h-32 overflow-y-auto custom-scroll hidden text-slate-400 space-y-1">
                        </div>
                    </div>

                    <div class="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl lg:col-span-2 flex flex-col min-h-[450px]">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold font-cinzel text-amber-400 flex items-center gap-2">
                                <i class="fas fa-list"></i> Usuários no Sistema
                            </h2>
                            <span id="users-count" class="text-xs font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-400">Carregando...</span>
                        </div>

                        <div class="overflow-x-auto border border-slate-800 rounded-lg bg-slate-950 flex-grow max-h-[500px] custom-scroll">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="sticky top-0 bg-slate-900 text-purple-400 z-10 border-b border-slate-800 shadow-sm">
                                    <tr>
                                        <th class="p-3">Email do Usuário</th>
                                        <th class="p-3">UID Firebase</th>
                                        <th class="p-3 text-center w-36">Cargo (Role)</th>
                                    </tr>
                                </thead>
                                <tbody id="table-users-body" class="divide-y divide-slate-900 text-slate-300">
                                    <tr>
                                        <td colspan="3" class="text-center p-8 text-slate-500 italic">Buscando registros na base...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        `;

        await loadUsersList();
    } catch (err) {
        container.innerHTML = `
            <div class="p-6 text-red-500 bg-red-950/20 border border-red-900 rounded-xl m-6">
                <h3 class="font-bold font-cinzel text-lg mb-2">Erro de Renderização</h3>
                <p class="text-sm">${err.message}</p>
            </div>
        `;
    }
}

async function loadUsersList() {
    const tbody = document.getElementById('table-users-body');
    const countBadge = document.getElementById('users-count');
    if (!tbody) return;

    try {
        const snap = await getDocs(query(collection(db, "rpg_users")));
        usersCache = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

        if (countBadge) countBadge.textContent = `${usersCache.length} Usuários`;

        if (usersCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center p-8 text-slate-500 italic">Nenhum usuário encontrado na coleção rpg_users.</td></tr>`;
            return;
        }

        usersCache.sort((a, b) => (a.email || '').localeCompare(b.email || ''));

        tbody.innerHTML = usersCache.map(u => {
            const role = u.role || 'jogador';
            return `
                <tr class="hover:bg-slate-900/40 transition-colors">
                    <td class="p-3 font-bold text-slate-200">${escapeHTML(u.email || 'Sem Email')}</td>
                    <td class="p-3 font-mono text-slate-500 text-[10px]">${u.uid}</td>
                    <td class="p-2 text-center">
                        <select onchange="window.userAdminTools.updateRole('${u.uid}', this.value)" 
                            class="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs outline-none focus:border-purple-500 font-bold ${role === 'admin' ? 'text-purple-400' : (role === 'mestre' ? 'text-red-400' : 'text-sky-400')}">
                            <option value="jogador" ${role === 'jogador' ? 'selected' : ''}>Jogador</option>
                            <option value="mestre" ${role === 'mestre' ? 'selected' : ''}>Mestre</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center p-8 text-red-500">Erro ao listar usuários da coleção.</td></tr>`;
    }
}

window.userAdminTools = {
    updateRole: async function (uid, newRole) {
        try {
            await updateDoc(doc(db, "rpg_users", uid), {
                role: newRole,
                atualizadoEm: serverTimestamp()
            });
            loadUsersList();
        } catch (err) {
            alert("Erro ao atualizar cargo: " + err.message);
        }
    },

    executeBulkRegister: async function () {
        const input = document.getElementById('bulk-users-input');
        const btn = document.getElementById('btn-run-bulk');
        const logArea = document.getElementById('bulk-log-area');

        if (!input || !input.value.trim()) return alert("Insira ao menos uma linha de dados.");

        const lines = input.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;

        if (!confirm(`Deseja iniciar o processamento de ${lines.length} registros em lote?`)) return;

        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Cadastrando...`;
        logArea.classList.remove('hidden');
        logArea.innerHTML = `<div class="text-purple-400 font-bold mb-1">> OBTENDO INSTÂNCIA DE AUTENTICAÇÃO...</div>`;

        let successCount = 0;
        let failCount = 0;

        try {
            const authInstance = getSecondaryAuth();

            for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length < 2) {
                    logArea.innerHTML += `<div class="text-red-500">[LINHA ${i + 1}] Ignorada: Formato incorreto (Falta vírgula)</div>`;
                    failCount++;
                    continue;
                }

                const email = parts[0].trim();
                const password = parts[1].trim();

                if (password.length < 6) {
                    logArea.innerHTML += `<div class="text-red-500">[FALHA] ${email}: Senha deve conter no mínimo 6 caracteres.</div>`;
                    failCount++;
                    continue;
                }

                try {
                    let credential;
                    try {
                        // 1. Tenta criar a conta normalmente (para novos alunos)
                        credential = await createUserWithEmailAndPassword(authInstance, email, password);
                    } catch (err) {
                        // 2. Se o aluno já existir no Firebase Auth (do seu outro site), o Firebase recusa a criação.
                        // Então interceptamos o erro e fazemos apenas o LOGIN para resgatar o UID existente!
                        if (err.code === 'auth/email-already-in-use') {
                            credential = await signInWithEmailAndPassword(authInstance, email, password);
                        } else {
                            throw err; // Se for erro de senha fraca ou formato, repassa o erro para fora
                        }
                    }

                    const userUid = credential.user.uid;

                    // Salva o registro na coleção rpg_users usando o UID correto do aluno
                    // Adicionado registroAtivo e merge: true para não sobrescrever caso o jogador já exista
                    await setDoc(doc(db, "rpg_users", userUid), {
                        email: email,
                        role: "jogador",
                        registroAtivo: true,
                        atualizadoEm: serverTimestamp()
                    }, { merge: true });

                    // Desloga da instância secundária imediatamente
                    await signOut(authInstance);

                    logArea.innerHTML += `<div class="text-emerald-400">[SUCESSO] ${email} processado e vinculado na base!</div>`;
                    successCount++;
                } catch (error) {
                    console.error(error);

                    let msgErro = error.message;
                    if (error.code === 'auth/invalid-credential') msgErro = 'Senha incorreta para aluno já existente.';
                    if (error.code === 'auth/too-many-requests') msgErro = 'Bloqueio temporário (Too many requests).';

                    logArea.innerHTML += `<div class="text-red-400">[ERRO] ${email}: ${msgErro}</div>`;
                    failCount++;

                    // Se a API bloqueou por excesso, interrompe o loop para proteger a conta
                    if (error.code === 'auth/too-many-requests') {
                        logArea.innerHTML += `<div class="text-amber-400 font-bold mt-2">> Processamento pausado por segurança. Aguarde alguns minutos e processe os que faltaram.</div>`;
                        break;
                    }
                }

                logArea.scrollTop = logArea.scrollHeight;

                // Atraso artificial de 1.8 segundos entre cada usuário para evitar bloqueio do Firebase
                await new Promise(resolve => setTimeout(resolve, 1800));
            }

            logArea.innerHTML += `<div class="text-amber-400 font-bold mt-2">> Fim do lote. Sucessos: ${successCount} | Falhas: ${failCount}</div>`;
        } catch (globalAuthErr) {
            logArea.innerHTML += `<div class="text-red-500 font-bold">[ERRO CRÍTICO DE AUTENTICAÇÃO]: ${globalAuthErr.message}</div>`;
        }

        logArea.scrollTop = logArea.scrollHeight;
        input.value = '';
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-user-plus"></i> Processar Cadastro`;

        await loadUsersList();
    }
};
// Arquivo: js/aoMestre/cadastroSetsEspeciais.js

// Função para renderizar a tela de cadastro de Sets
function renderCadastroSetsEspeciais() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="cadastro-container">
            <h2>Cadastrar Novo Set de Equipamento</h2>
            <form id="form-cadastro-set">
                <div class="form-group">
                    <label for="set-sufixo">Sufixo do Set (Ex: 'de Thorin', 'Melancólico'):</label>
                    <input type="text" id="set-sufixo" required>
                </div>
                
                <div class="form-group">
                    <label for="set-pecas">Quantidade de Peças Necessárias (Ex: 2):</label>
                    <input type="number" id="set-pecas" min="1" max="16" required>
                </div>

                <h3>Bônus do Set</h3>
                <div class="form-group">
                    <label for="set-bonus-hp">Bônus de HP:</label>
                    <input type="number" id="set-bonus-hp" value="0">
                </div>
                <div class="form-group">
                    <label for="set-bonus-atk">Bônus de Ataque (ATK):</label>
                    <input type="number" id="set-bonus-atk" value="0">
                </div>
                <div class="form-group">
                    <label for="set-bonus-def">Bônus de Defesa (DEF):</label>
                    <input type="number" id="set-bonus-def" value="0">
                </div>
                <button type="submit" class="btn-salvar">Salvar Set</button>
            </form>
            <hr>
            <h3>Sets Cadastrados</h3>
            <div id="lista-sets-cadastrados"></div>
        </div>
    `;

    document.getElementById('form-cadastro-set').addEventListener('submit', salvarSetEspecial);
    listarSetsCadastrados();
}

// Função para salvar no Firebase
async function salvarSetEspecial(e) {
    e.preventDefault();

    const sufixo = document.getElementById('set-sufixo').value.trim();
    const pecasNecessarias = parseInt(document.getElementById('set-pecas').value);

    const novoSet = {
        sufixo: sufixo,
        pecasNecessarias: pecasNecessarias,
        bonus: {
            hp: parseInt(document.getElementById('set-bonus-hp').value) || 0,
            atk: parseInt(document.getElementById('set-bonus-atk').value) || 0,
            def: parseInt(document.getElementById('set-bonus-def').value) || 0
        }
    };

    try {
        await db.collection("setsEspeciais").add(novoSet);
        alert("Set especial cadastrado com sucesso!");
        document.getElementById('form-cadastro-set').reset();
        listarSetsCadastrados();
    } catch (error) {
        console.error("Erro ao cadastrar set: ", error);
        alert("Erro ao salvar o Set.");
    }
}

// Função para listar os sets já salvos
async function listarSetsCadastrados() {
    const listaDiv = document.getElementById('lista-sets-cadastrados');
    listaDiv.innerHTML = '<p>Carregando sets...</p>';

    try {
        const snapshot = await db.collection("setsEspeciais").get();
        if (snapshot.empty) {
            listaDiv.innerHTML = '<p>Nenhum set cadastrado.</p>';
            return;
        }

        let html = '<ul>';
        snapshot.forEach(doc => {
            const set = doc.data();
            html += `<li><strong>${set.sufixo}</strong> (${set.pecasNecessarias} peças) -> HP: +${set.bonus.hp} | ATK: +${set.bonus.atk} | DEF: +${set.bonus.def} 
            <button onclick="deletarSet('${doc.id}')">Excluir</button></li>`;
        });
        html += '</ul>';
        listaDiv.innerHTML = html;
    } catch (error) {
        console.error("Erro ao buscar sets: ", error);
        listaDiv.innerHTML = '<p>Erro ao carregar a lista.</p>';
    }
}

async function deletarSet(id) {
    if (confirm("Tem certeza que deseja excluir este set?")) {
        await db.collection("setsEspeciais").doc(id).delete();
        listarSetsCadastrados();
    }
}
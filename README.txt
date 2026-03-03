Árvore de Arquivos.

Dividi a pasta js em duas subpastas: core (para o "motor" do sistema) e tabs (onde cada aba terá seu próprio arquivo isolado).
Aqui está a visão geral da nossa futura arquitetura:

📦 seu-projeto-rpg
 ┣ 📜 index.html              (Apenas a estrutura HTML limpa e a importação do main.js)
 ┣ 📜 style.css               (Todas as classes, variáveis :root e animações)
 ┗ 📂 js
 ┃  ┃ 
 ┃  ┗ 📜 main.js               (O Cérebro Central: Escuta o Login, Inicia os Caches, controla o Menu Superior, Relógio do Mundo e Troca as Abas)
 ┃  ┃
 ┃  ┣ 📂 core
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 firebase.js         (Conexões, Auth e importações de métodos do Firestore/Storage)
 ┃  ┃  ┣ 📜 state.js            (Onde mora o 'globalState', Constantes e Dicionários como COINS)
 ┃  ┃  ┣ 📜 utils.js            (Funções soltas como: compressImage, escapeHTML, formatadores)
 ┃  ┃  ┗ 📜 calculos.js         (A matemática pesada: calculateMainStats, statCascade, peso, fome)
 ┃  ┃
 ┃  ┣ 📂 tabs
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 painelFichas.js     (Aba 1: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 rolagemDados.js     (Aba 2: D20, Moedas e Log de Rolagens)
 ┃  ┃  ┣ 📜 calcCombate.js      (Aba 3: Projeção de Dano Final Base + Atributos)
 ┃  ┃  ┣ 📜 habilidades.js      (Aba 4: Comprar/Upar Skills, Log de Uso, Gasto de AP)
 ┃  ┃  ┣ 📜 mochila.js          (Aba 5: Grid do inventário, Consumir, Jogar Fora, Enviar)
 ┃  ┃  ┣ 📜 itensEquipados.js   (Aba 6: Paper Doll, Lógica de Equipar/Desequipar, 2 Mãos)
 ┃  ┃  ┣ 📜 calcAtributos.js    (Aba 7: Visualização detalhada de fontes de status)
 ┃  ┃  ┣ 📜 constelacao.js      (Aba 8: O Canvas SVG, Drag/Zoom, Compra de Nós)
 ┃  ┃  ┣ 📜 crafting.js         (Aba 9: Lista de Receitas, Rolagem de Qualidade, Consumo)
 ┃  ┃  ┣ 📜 extracao.js         (Aba 10: Transformar em Essências e Reciclagem)
 ┃  ┃  ┣ 📜 colecao.js          (Aba 11: Diário de Descobertas e Resgate de Recompensas)
 ┃  ┃  ┣ 📜 armaEspiritual.js   (Aba 12: Ritual de Fusão, Alimentação do EGO, Skills)
 ┃  ┃  ┣ 📜 pets.js             (Aba 13: Minigame de Doma, Gestão, XP Share)
 ┃  ┃  ┣ 📜 reputacao.js        (Aba 14: Prédios, Aliados, Timer de Coleta 10min, Armazém)
 ┃  ┃  ┣ 📜 comercio.js         (Aba 15: Loja, Câmbio de Moedas, Venda por Rank)
 ┃  ┃  ┣ 📜 mapa.js             (Aba 16: Leaflet, Fog of War, Marcador do Grupo)
 ┃  ┃  ┗ 📜 arena.js            (Aba 17: Motor do Grid Hexagonal, Turnos, Magias em Área)
 ┃  ┃
 ┃  ┣ 📂 backoffice
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 cadastrosAdmin.js     (Aba 1: Usado para o Admin registrar todo sistema)
 ┃  ┃  ┣ 📜 balanceamento.js     (Aba 2: O admin configura o balanceamento do sistema olhando o todo)
 ┃  ┃  ┗ 📜 backupGeral.js     (Aba 3: O Admin consegue fazer backup manual e selecionar quais elementos estão ativos ou não no sistema)
 ┃  ┃  
 ┃  ┣ 📂 manualRegras
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 manual.js     (Aba 1: Manual de regras do sistema)
 ┃  ┃  ┣ 📜 racas.js     (Aba 2: Raças cadastradas)
 ┃  ┃  ┣ 📜 classes.js     (Aba 3: Classes cadastradas)
 ┃  ┃  ┣ 📜 subclasses.js     (Aba 4: Subclasses cadastradas)
 ┃  ┃  ┣ 📜 habilidades.js     (Aba 5: Habilidades cadastradas)
 ┃  ┃  ┗ 📜 profissoes.js     (Aba 6: Sistema de Profissões cadastradas)
 ┃  ┃   
 ┃  ┣ 📂 aoMestre
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 comandos.js     (Aba 1: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 cadastroNpcs.js     (Aba 2: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 cadastroCrafts.js     (Aba 3: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 cadastroMonstrosSeres.js     (Aba 4: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 cadastroItens.js     (Aba 5: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┗ 📜 lorePersonagens.js     (Aba 6: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃   
 ┃  ┣ 📂 aoJogador 
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 simularFicha.js     (Aba 1: Aqui o jogador pode simular seu personagem antes de criá-lo)
 ┃  ┃  ┣ 📜 fichaPersonagem.js     (Aba 2: Aqui abre toda lógica das tabs "📂 tabs" citada acima)
 ┃  ┃  ┗ 📜 galeriaImagens.js     (Aba 3: Compendium de imagens do sistema/mestres)
 ┃  ┃  
 ┃  ┣ 📂 atualizacoes
 ┃  ┃  ┃
 ┃  ┃  ┗ 📜 atualizacoes.js     (Aba 1: Aqui teremos as atualizações do sistema)
 ┃  ┃
 ┃  ┣ 📂 inicio
 ┃  ┃  ┃
 ┃  ┃  ┗ 📜 inicio.js     (Aba 1: Página de abertura oficial do site)
 ┃  ┃
 ┗ 📂 imagens
    ┃
    ┣ 📂 backgroungInicio     (Aba 1: Página de abertura oficial do site)
    ┃  ┃
    ┃  ┗ 📜 background-inicio.png    (Imagem padrão esperada para o background da página inicial)
    ┃ 
    ┣ 📂 trash     (a ser implementado)
    ┃
Árvore de Arquivos.

Dividi a pasta js em duas subpastas: core (para o "motor" do sistema) e tabs (onde cada aba terá seu próprio arquivo isolado).
Aqui está a visão geral da nossa futura arquitetura:

📦 seu-projeto-rpg
 ┣ 📜 index.html              (Apenas a estrutura HTML limpa e a importação do main.js)
 ┣ 📜 style.css               (Todas as classes, variáveis :root e animações)
 ┗ 📂 js
 ┃  ┃ 
 ┃  ┣ 📜 main.js               (O Cérebro Central: Escuta o Login, Inicia os Caches, controla o Menu Superior, Relógio do Mundo e Troca as Abas)
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
 ┃  ┃  ┣ 📜 teiaConexoes.js     (Aba 17: Visão gráfica das conexões entre NPCs, Famílias, Clãs, etc)
 ┃  ┃  ┗ 📜 arena.js            (Aba 18: Motor do Grid Hexagonal, Turnos, Magias em Área)
 ┃  ┃
 ┃  ┣ 📂 backoffice
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 cadastrosAdmin.js     (Aba 1: Usado para o Admin registrar todo sistema)
 ┃  ┃  ┣ 📜 balanceamento.js      (Aba 2: O admin configura o balanceamento do sistema olhando o todo)
 ┃  ┃  ┗ 📜 backupGeral.js        (Aba 3: O Admin consegue fazer backup manual e selecionar quais elementos estão ativos ou não no sistema)
 ┃  ┃  
 ┃  ┣ 📂 manualRegras
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 manual.js          (Aba 1: a ser implementado)
 ┃  ┃  ┣ 📜 manualGeral.js     (Aba 2: Manual de regras detalhadas do sistema)
 ┃  ┃  ┣ 📜 racas.js           (Aba 3: Raças cadastradas)
 ┃  ┃  ┣ 📜 classes.js         (Aba 4: Classes cadastradas)
 ┃  ┃  ┣ 📜 subclasses.js      (Aba 5: Subclasses cadastradas)
 ┃  ┃  ┣ 📜 habilidades.js     (Aba 6: Habilidades cadastradas)
 ┃  ┃  ┗ 📜 profissoes.js      (Aba 7: Sistema de Profissões cadastradas)
 ┃  ┃   
 ┃  ┣ 📂 aoMestre
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 comandos.js                  (Aba 1: Editor da Ficha, Uploads de Imagem, Objetivos, História)
 ┃  ┃  ┣ 📜 cadastroNpcs.js              (Aba 2: Cadastro de NPCS no jogo)
 ┃  ┃  ┣ 📜 cadastroCrafts.js            (Aba 3: Cadastro de Crafts, ou itens possíveis de ser construídos por profissões no jogo)
 ┃  ┃  ┣ 📜 cadastroMonstrosSeres.js     (Aba 4: Cadastro de monstros/inimigos no jogo)
 ┃  ┃  ┣ 📜 cadastroItens.js             (Aba 5: Cadastro de itens gerais e equipamentos prontos no jogo)
 ┃  ┃  ┣ 📜 dropsMonstros.js             (Aba 6: Listagem e cadastro de monstros para o Mestre usar em campanhas, incluindo drop automatizado)
 ┃  ┃  ┗ 📜 lorePersonagens.js           (Aba 7: Visão geral dos personagens da campanha, com imagem, descrição, história, etc)
 ┃  ┃   
 ┃  ┣ 📂 aoJogador  
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 simularFicha.js        (Aba 1: Aqui o jogador pode simular seu personagem antes de criá-lo)
 ┃  ┃  ┣ 📜 fichaPersonagem.js     (Aba 2: Aqui abre toda lógica das tabs "📂 tabs" citada acima)
 ┃  ┃  ┗ 📜 galeriaImagens.js      (Aba 3: Compendium de imagens do sistema/mestres)
 ┃  ┃ 
 ┃  ┣ 📂 oMundo 
 ┃  ┃  ┃
 ┃  ┃  ┣ 📜 conhecaMundo.js    (Aba 1: Aqui terá a história hardcoded do mundo e mapas da pasta mapas)
 ┃  ┃  ┣ 📜 osDeuses.js        (Aba 2: Aqui teremos o compendium das entidades do mundo)
 ┃  ┃  ┣ 📜 lendasMundo.js     (Aba 3: Ctema/mestres)
 ┃  ┃  ┣ 📜 npcsGeral.js       (Aba 4: Ctema/mestres)
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
    ┣ 📂 backgroungInicio     (pasta para APENAS salvar a imagem de background separada)
    ┃  ┃
    ┃  ┗ 📜 background-inicio.png    (Imagem padrão esperada para o background da página inicial)
    ┃ 
    ┣ 📂 favicon     (pasta para o favicon do site)
    ┃  ┃
    ┃  ┗ 📜 faviconKazenski.png    (Imagem padrão favicon)
    ┃ 
    ┣ 📂 mapas     (pasta de imagens dos mapas usados na página do Mundo)
    ┃  ┃
    ┃  ┣ 📜 mapas1.webp   
    ┃  ┣ 📜 mapas2.webp 
    ┃  ┣ 📜 mapas3.webp 
    ┃  ┣ 📜 mapas4.webp 
    ┃  ┣ 📜 mapas5.webp 
    ┃  ┣ 📜 mapas6.webp 
    ┃  ┣ 📜 mapas7.webp 
    ┃  ┣ 📜 mapas8.webp 
    ┃  ┣ 📜 mapas9.webp 
    ┃  ┣ 📜 mapas10.webp 
    ┃  ┣ 📜 mapas11.webp 
    ┃  ┣ 📜 mapas12.webp 
    ┃  ┗ 📜 mapas13.webp 
    ┃ 
    ┗ 📂 usoGeralSite     (pasta de imagens gerais) 
       ┃
       ┗ 📜 bardo-conheca-o-mundo.png


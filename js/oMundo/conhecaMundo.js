// Lista explícita das imagens dos mapas
const mapasDoMundo = [
    "imagens/mapas/mapas1.webp",
    "imagens/mapas/mapas2.webp",
    "imagens/mapas/mapas3.webp",
    "imagens/mapas/mapas4.webp",
    "imagens/mapas/mapas5.webp",
    "imagens/mapas/mapas6.webp",
    "imagens/mapas/mapas7.webp",
    "imagens/mapas/mapas8.webp",
    "imagens/mapas/mapas9.webp",
    "imagens/mapas/mapas10.webp",
    "imagens/mapas/mapas11.webp",
    "imagens/mapas/mapas12.webp",
    "imagens/mapas/mapas13.webp"
];

// Lista de Mídias dos Bardos com letras embutidas para performance no GitHub Pages
const cancoesDoBardo = [
    {
        id: 1, tipo: 'musica', titulo: 'A Dança dos Três Continentes', src: 'audios/A Dança dos Três Continentes.mp3',
        letra: `No sopro primeiro que o vento entoou,\nOs três continentes, enfim, despertou.\nLegina rugia, moldando o mar profundo,\nRenstenci florescia, dando cores ao mundo.\n\nImperiall, altiva, erguia torres ao céu,\nCom lâminas de prata e ambição como véu.\nE os Leviatãs, guardiões da criação,\nSeguiam seus rumos, guiados pela canção.\n\nMas Gallandra, sorrindo, ao destino brincar,\nSemeou o acaso no tecido do ar.\nE Chronarion, atento, ao tempo vigiar,\nViu que o mundo nascente começava a pulsar.\n\nAs águas dançavam ao toque de Legina,\nFlorestas brotavam sob a luz cristalina.\nE o ferro de Imperiall, em brilho cortante,\nMarcava o futuro em seu passo constante.\n\nAssim se erguia o palco da vida,\nCom força, magia e alma unida.\nE o bardo cantava, com voz a ecoar:\n“Do caos e da luz, o mundo há de despertar.”`
    },
    {
        id: 2, tipo: 'musica', titulo: 'O Sopro dos Oito', src: 'audios/O Sopro dos Oito (A Vida e a Ordem).mp3',
        letra: `Sobre a terra moldada, a Entidade chamou,\nOito Deuses Maiores… e o mundo despertou.\nEsthalion deu o pulso, o primeiro respirar,\nFinbetur abriu os véus, onde as almas vão morar.\n\nArpen ergueu as matas, onde as fadas hoje dançam,\nGauir criou os mares, que nas luas sempre balançam.\nBalum fez as montanhas, coroando o firmamento,\nReyhan soprou desertos, num dourado movimento.\n\nE as raças caminharam, buscando seu lugar:\nOuro para os humanos, folhas para o elfo caçar.\nAnões moldaram rochas, sob a terra a ressoar,\nE os halflings, sorridentes, só queriam festejar.\n\nO equilíbrio era doce, sob o céu de Androa,\nCada canto tinha vida, cada vida tinha proa.\nMas no fundo do silêncio, onde o tempo ecoa,\nA sombra antiga despertou… e tirou sua coroa.`
    },
    {
        id: 3, tipo: 'musica', titulo: 'A Sombra dos Quatro', src: 'audios/A Sombra dos Quatro.mp3',
        letra: `Cem anos de trevas, a terra a queimar,\nQuatro cavaleiros-magos surgem para reinar.\nTomaram os grandes dragões, de mente acorrentada,\nE a paz de mil eras foi ao pó, despedaçada.\n\nA Praga cegou os homens, sem rumo a caminhar,\nA Escassez secou o grão, nada mais a germinar.\nO Caos rasgou o céu, em trovões a retumbar,\nE o Abismo abriu o chão, pronto a tudo devorar.\n\nMetade do mundo em cinzas, o pranto a ecoar,\nCidades em ruína, mares prontos a sangrar.\nE os povos, ajoelhados, sem forças pra lutar,\nJuravam que os Deuses haviam deixado de olhar.\n\nMas no coração da noite, onde a esperança é mortal,\nUm sussurro despertava… prenúncio do final.\nPois quando a sombra cresce e ameaça o astral,\nÉ no peito dos mortais que nasce o fogo imortal.`
    },
    {
        id: 4, tipo: 'musica', titulo: 'O Sacrifício', src: 'audios/O Sacrifício (A Prisão de Cristal).mp3',
        letra: `Mas Gallandra chorou, e do pranto fez luz,\nTrês Templários ergueu sob a sua sagrada cruz.\nEles marcharam no fogo, com a Deusa a guiar,\nPara os quatro dragões no abismo selar.\n\nO Dragão de Cristal, no gelo adormeceu,\nThaldrin, na montanha, de vista se perdeu.\nE Seraphis, nas tormentas da Ilha Perdida, ficou,\nTrês heróis tombaram… mas o mundo se salvou.\n\nE o canto das eras guardou seu valor,\nPois cada passo ecoou em coragem e dor.\nNa prisão cintilante, o mal se calou,\nE o sangue dos justos a terra abençoou.\n\nAssim o bardo canta, para nunca esquecer,\nQue a luz às vezes nasce do ato de morrer.\nE enquanto houver noite, e o medo a rondar,\nO sacrifício dos três continuará a brilhar.`
    },
    {
        id: 5, tipo: 'musica', titulo: 'A Balada de Androa', src: 'audios/A Balada de Androa.mp3',
        letra: `Do vazio adormecido, onde o tempo não ousava andar,\nChronarion abriu os olhos… e a luz veio a brilhar.\nGallandra, em seu sorriso, moldou o caos em chão,\nE três Leviatãs surgiram, guardiões da criação.\n\nLegina fez os mares, Renstenci fez brotar,\nImperiall ergueu reinos, prontos para guerrear.\nE o palco do mundo, enfim, repousou em harmonia,\nSem saber que o destino já tecia outra sinfonia.\n\nEntão a Entidade chamou, e oito Deuses despertou,\nEsthalion deu a vida, Finbetur o além guiou.\nArpen ergueu as matas, Gauir fez o mar cantar,\nBalum criou montanhas, Reyhan desertos a soprar.\n\nAs raças caminharam, buscando seu lugar,\nHumanos pelo ouro, elfos prontos a caçar.\nMas no céu de Androa, onde a paz reinava à toa,\nUma sombra antiga ergueu-se… e roubou sua coroa.\n\nCem anos de trevas, o mundo a incendiar,\nQuatro cavaleiros-magos vieram tudo dominar.\nTomaram os dragões, mentes presas em correntes,\nE a paz virou cinzas, espalhadas pelos ventos ardentes.\n\n(A história continua nos ecos dos bardos...)`
    },
    {
        id: 6, tipo: 'podcast', titulo: 'Criação Celestial de Gallandra', src: 'audios/A_Deusa_Gallandra_Criou_a_Ganância.mp3',
        letra: `[Transcrição do Podcast]\n\nNeste conto sagrado, exploramos como a Deusa Gallandra,\nem sua infinita sabedoria e complexidade, concebeu o Leviatã Imperiall.\n\nA ganância não nasceu como um pecado, mas como o motor do progresso e da sobrevivência...\n\n(Ouça o áudio completo para a lore detalhada)`
    },
    {
        id: 7, tipo: 'musica', titulo: 'Balada Sombria - A Sombra de Finbetur', src: 'audios/Balada Sombria - A Sombra de Finbetur.mp3',
        letra: `Quando o véu caiu sobre o norte,\nE a lua chorou no céu sem cor,\nO deus da morte perdeu sua sorte,\nE o mundo sentiu o peso da dor.\n\nA praga de Finbetur,\nUm grito preso no ar,\nHomens caem sem futuro,\nSem poder enxergar.\nE o deus que antes guardava,\nAgora só quer vingar.\n\nCegueira toma os olhos fracos,\nAlucina o que resta da razão,\nA pele cai em pedaços,\nE o medo governa o chão.\n\nUm cientista enlouquecido\nPrendeu a morte em um feitiço,\nE o mundo inteiro, perdido,\nCaminha à beira do precipício.`
    },
    {
        id: 8, tipo: 'musica', titulo: 'O Portal de Androa', src: 'audios/O Portal de Androa.mp3',
        letra: `No silêncio entre as estrelas,\nOnde o tempo esquece de passar,\nHá um portal feito de trevas,\nQue só a coragem pode atravessar.\n\nDizem que Androa o ergueu,\nQuando o mundo começou a ruir,\nE quem ousar tocá-lo um dia\nJamais poderá fugir.\n\nSeis gemas brilham no véu distante,\nRoxa, verde, laranja e azul,\nVermelha e amarela flamejante,\nEcoando um poder que ninguém traduziu.\n\nO Portal de Androa chama,\nCom a voz de um mundo esquecido.\nEntre cinzas, sangue e lama,\nEcoa o canto do proibido.`
    },
    {
        id: 9, tipo: 'musica', titulo: 'Tributo a Balun — O Grande Torneio', src: 'audios/Tributo a Balun — O Grande Torneio.mp3',
        letra: `No coração do continente norte,\nOnde o vento ruge como um leão,\nErgue-se o torneio da sorte,\nOnde só os bravos mantêm-se de pé no chão.\n\nCriaturas de magia e carne,\nGuerreiros de honra ou ambição,\nMarcham rumo ao campo eterno,\nOnde cada golpe decide a canção.\n\nE as bandeiras tremem alto,\nColorindo o céu com tradição.\nO público grita o nome dos fortes,\nE o destino afia sua mão.\n\nTributo a Balun!\nQue os deuses vejam quem cairá.\nTributo a Balun!\nSó um campeão retornará.`
    }
];

let indiceMusicaAtual = -1;

export function renderConhecaMundoTab() {
    const container = document.getElementById('conheca-mundo-content');
    if (!container) return;

    let mapasHTML = '';
    if (mapasDoMundo.length > 0) {
        mapasHTML = mapasDoMundo.map((url) => `
            <div class="relative group cursor-pointer overflow-hidden rounded-xl border-2 border-slate-700 hover:border-amber-500 shadow-lg aspect-video transition-all duration-300" onclick="window.conhecaMundo.openMapa('${url}')">
                <img src="${url}" onerror="this.src='https://placehold.co/800x450/1e293b/a1a1aa?text=Mapa+Não+Encontrado'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i class="fas fa-search-plus text-amber-500 text-4xl drop-shadow-md"></i>
                </div>
            </div>
        `).join('');
    }

    let bardosHTML = cancoesDoBardo.map((midia, index) => `
        <button id="btn-song-${index}" onclick="window.conhecaMundo.tocarMusica(${index})" 
            class="song-btn flex items-center gap-3 bg-slate-900/60 hover:bg-amber-600/20 border border-slate-700 hover:border-amber-500 rounded-lg p-3 transition-all group w-full text-left">
            <div class="w-10 h-10 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center group-hover:border-amber-400 shrink-0 transition-colors song-icon">
                <i class="fas ${midia.tipo === 'podcast' ? 'fa-podcast' : 'fa-music'} text-slate-400 group-hover:text-amber-400"></i>
            </div>
            <div class="overflow-hidden">
                <span class="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">${midia.tipo}</span>
                <span class="block text-sm text-slate-300 group-hover:text-white font-cinzel font-bold truncate whitespace-nowrap song-title">${midia.titulo}</span>
            </div>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16">
            
            <header class="mb-10 text-center w-full border-b border-slate-800 pb-8">
                <h1 class="text-4xl md:text-5xl font-black font-cinzel text-amber-500 drop-shadow-md tracking-widest mb-3">A Gênese de Imperiall</h1>
                <p class="text-slate-400 text-sm md:text-base italic w-full mx-auto">
                    "Antes dos mortais pisarem na terra, os deuses já traçavam o destino entre oceanos e lendas..."
                </p>
            </header>

            <div class="w-full bg-slate-900/60 p-8 md:p-12 rounded-2xl border border-slate-800 shadow-2xl mb-16 relative">
                <i class="fas fa-quote-left absolute top-6 left-6 text-slate-700 text-3xl opacity-50"></i>
                
                <div class="space-y-6 text-slate-300 text-base md:text-lg leading-relaxed font-serif relative z-10 text-justify">
                    <p>
                        <span class="text-3xl md:text-4xl font-cinzel font-bold text-amber-400 float-left mr-2 leading-none mt-1">H</span>
                        á muito tempo, antes mesmo da existência dos seres na terra, a Deusa Gallandra criou criaturas místicas para manter o mundo em ordem: os <strong>Leviatãs</strong>. Entre eles estavam Legina, Imperiall e Renstenci, cada um responsible por criar os seres que habitariam os três continentes.
                    </p>
                    
                    <p>
                        <strong class="text-sky-400 font-cinzel tracking-wider">Legina</strong>, o Leviatã Monstruoso, deu origem a seres imponentes e aterrorizantes. Seu continente é banhado por dois oceanos: o do Kraken e o Lendário. Ele possui um temperamento hostil, cruel e de sangue frio. Sua arma símbolo é uma marreta de duas mãos. Os habitantes de seu continente reverenciam Legina com temor e respeito, acreditando que sua crueldade é uma prova de força necessária para sobreviver em um ambiente tão implacável.
                    </p>
                    
                    <p>
                        <strong class="text-emerald-400 font-cinzel tracking-wider">Renstenci</strong>, o Leviatã do Planeta, é abençoado com beleza e graça. Seu continente é um paraíso de criaturas mágicas, fadas e uma diversidade infinita de plantas e seres vegetais, sempre em constante criação. Este continente é banhado pelos oceanos Gélido e Lendário, e está próximo às Ilhas da Morte. Sua arma símbolo é um arco e flechas. Os habitantes de Renstenci vivem em harmonia com a natureza, vendo o Leviatã como um guardião benevolente que lhes concede a beleza e a magia do mundo ao seu redor.
                    </p>
                    
                    <p>
                        <strong class="text-amber-500 font-cinzel tracking-wider">Imperiall</strong>, o Leviatã da Ganância, governa um vasto continente habitado por seres medíocres cujo único propósito é acumular mais e mais. Este continente é banhado pelos oceanos Gélido, Lendário e Kraken. As criaturas de Imperiall são, em sua maioria, humanóides e similares. Sua arma símbolo é uma espada de duas mãos. Os habitantes de Imperiall são frequentemente consumidos pela ambição e pela busca incessante por riqueza e poder, refletindo a própria natureza gananciosa de seu criador. Eles veem Imperiall como um exemplo a ser seguido, acreditando que a acumulação de riquezas é a chave para a verdadeira grandeza.
                    </p>
                    
                    <div class="w-full max-w-2xl h-px bg-slate-700 mx-auto my-10"></div>
                    
                    <p>
                        No entanto, a paz e a ordem estabelecidas pelos Leviatãs foram ameaçadas quando quatro grandes dragões foram controlados por quatro seres malignos contra sua vontade. Esses dragões, outrora guardiões do equilíbrio, tornaram-se instrumentos de destruição e caos. Para restaurar a harmonia, três defensores lendários, conhecidos como <strong>Templários</strong>, surgiram. Eles eram guerreiros de grande poder e sabedoria, escolhidos pela própria Deusa Gallandra para enfrentar essa ameaça.
                    </p>
                    
                    <p>
                        Os Templários enfrentaram os controladores dos dragões em batalhas épicas que sacudiram os próprios alicerces do mundo. Após uma série de confrontos intensos, os Templários conseguiram derrotar os seres malignos e libertar os dragões de seu controle. Para garantir que essa ameaça nunca mais retornasse, os Templários selaram os dragões em grandes prisões mágicas, espalhadas pelos três continentes. Essas prisões are guardadas por poderosos encantamentos e protegidas por guardiões escolhidos a dedo, garantindo que os dragões permaneçam adormecidos e que o equilíbrio do mundo seja mantido.
                    </p>
                </div>
            </div>

            <div class="w-full mb-16">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
                    <h2 class="text-2xl font-cinzel font-bold text-slate-200 tracking-widest"><i class="fas fa-map-marked-alt text-amber-500 mr-3"></i> Cartografia Conhecida</h2>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                    ${mapasHTML}
                </div>
            </div>

            <div class="w-full">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
                    <h2 class="text-2xl font-cinzel font-bold text-slate-200 tracking-widest"><i class="fas fa-guitar text-amber-500 mr-3"></i> Acervo dos Bardos</h2>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-2xl items-stretch">
                    
                    <div class="flex flex-col gap-4">
                        <img src="imagens/usoGeralSite/bardo-conheca-o-mundo.png" alt="Bardo" class="w-full h-auto aspect-square object-cover rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-amber-500/30 object-top shrink-0">
                        
                        <div class="bg-slate-950 border border-slate-700 rounded-xl p-4 shadow-inner flex flex-col gap-4 h-full justify-center min-h-[160px]">
                            <div class="text-center overflow-hidden shrink-0">
                                <h4 id="player-title" class="text-amber-400 font-cinzel font-bold truncate">Nenhuma canção selecionada</h4>
                                <p class="text-[10px] text-slate-500 uppercase tracking-widest">Bardo de Androa</p>
                            </div>

                            <div class="flex flex-col gap-1 w-full shrink-0">
                                <input type="range" id="bardo-progress" min="0" max="100" value="0" class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" oninput="window.conhecaMundo.buscarTempo(this.value)">
                                <div class="flex justify-between text-[10px] text-slate-400 font-mono font-bold px-1">
                                    <span id="bardo-time-current">0:00</span>
                                    <span id="bardo-time-total">0:00</span>
                                </div>
                            </div>

                            <div class="flex items-center justify-center gap-6 shrink-0">
                                <button onclick="window.conhecaMundo.musicaAnterior()" class="text-slate-400 hover:text-amber-400 text-lg transition-transform hover:scale-110 outline-none"><i class="fas fa-step-backward"></i></button>
                                
                                <button onclick="window.conhecaMundo.togglePlay()" id="bardo-btn-play" class="w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-black flex items-center justify-center text-xl transition-transform hover:scale-105 shadow-[0_0_10px_rgba(245,158,11,0.4)] outline-none">
                                    <i class="fas fa-play ml-1"></i>
                                </button>
                                
                                <button onclick="window.conhecaMundo.proximaMusica()" class="text-slate-400 hover:text-amber-400 text-lg transition-transform hover:scale-110 outline-none"><i class="fas fa-step-forward"></i></button>
                            </div>

                            <div class="flex items-center justify-center gap-3 pt-3 border-t border-slate-800 shrink-0">
                                <i class="fas fa-volume-down text-slate-500 text-xs"></i>
                                <input type="range" id="bardo-volume" min="0" max="1" step="0.05" value="0.5" oninput="window.conhecaMundo.mudarVolume(this.value)" class="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-300">
                                <i class="fas fa-volume-up text-slate-500 text-xs"></i>
                            </div>
                        </div>
                    </div>

                    <div class="relative min-h-[400px] lg:min-h-0 lg:h-full">
                        <div class="absolute inset-0 flex flex-col bg-slate-950/30 p-3 rounded-xl border border-slate-800">
                            <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 pl-1 shrink-0">Repertório</h3>
                            <div class="flex flex-col gap-2 overflow-y-auto custom-scroll pr-2 flex-grow min-h-0">
                                ${bardosHTML}
                            </div>
                        </div>
                    </div>

                    <div class="relative min-h-[400px] lg:min-h-0 lg:h-full">
                        <div class="absolute inset-0 flex flex-col bg-slate-950/80 border border-slate-700 rounded-xl p-6">
                            <h3 id="lyric-title" class="text-amber-500 font-cinzel font-bold text-xl mb-4 border-b border-slate-700 pb-2 shrink-0">As Canções</h3>
                            <pre id="lyric-text" class="text-slate-300 font-serif whitespace-pre-wrap leading-relaxed text-sm overflow-y-auto custom-scroll flex-grow min-h-0 pr-2">Selecione uma música no repertório ao lado para acompanhar as palavras do bardo.</pre>
                        </div>
                    </div>

                </div>
            </div>
        
        <audio id="bardo-audio-engine"></audio>

        <div id="modal-mapa-mundo" class="fixed inset-0 z-[100] bg-black/95 hidden items-center justify-center p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
            <img id="img-modal-mapa" src="" class="max-w-[95vw] max-h-[95vh] object-contain rounded border border-slate-700 shadow-2xl">
        </div>
    `;

    window.conhecaMundo.vincularEventosAudio();
}

window.conhecaMundo = {
    openMapa: function (url) {
        const modal = document.getElementById('modal-mapa-mundo');
        const img = document.getElementById('img-modal-mapa');
        if (modal && img) {
            img.src = url;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    vincularEventosAudio: function () {
        const audio = document.getElementById('bardo-audio-engine');
        if (!audio) return;

        audio.volume = 0.5;

        audio.addEventListener('timeupdate', () => {
            const progress = document.getElementById('bardo-progress');
            const current = document.getElementById('bardo-time-current');

            if (audio.duration) {
                progress.max = audio.duration;
                progress.value = audio.currentTime;
                current.textContent = window.conhecaMundo.formatarTempo(audio.currentTime);
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            const progress = document.getElementById('bardo-progress');
            const total = document.getElementById('bardo-time-total');
            progress.max = audio.duration;
            total.textContent = window.conhecaMundo.formatarTempo(audio.duration);
        });

        audio.addEventListener('ended', () => {
            window.conhecaMundo.proximaMusica();
        });
    },

    tocarMusica: function (index) {
        if (index < 0 || index >= cancoesDoBardo.length) return;

        indiceMusicaAtual = index;
        const midia = cancoesDoBardo[index];
        const audio = document.getElementById('bardo-audio-engine');

        document.querySelectorAll('.song-btn').forEach(btn => {
            btn.classList.remove('bg-amber-600/30', 'border-amber-500');
            btn.querySelector('.song-title').classList.remove('text-amber-400');
            btn.querySelector('.song-icon').classList.remove('border-amber-400', 'text-amber-400');
        });

        const activeBtn = document.getElementById(`btn-song-${index}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-amber-600/30', 'border-amber-500');
            activeBtn.querySelector('.song-title').classList.add('text-amber-400');
            activeBtn.querySelector('.song-icon').classList.add('border-amber-400', 'text-amber-400');
        }

        document.getElementById('player-title').textContent = midia.titulo;
        document.getElementById('lyric-title').textContent = midia.titulo;
        document.getElementById('lyric-text').textContent = midia.letra || 'Letra não encontrada nos pergaminhos antigos...';

        audio.src = midia.src;
        audio.play();
        document.getElementById('bardo-btn-play').innerHTML = '<i class="fas fa-pause"></i>';
    },

    togglePlay: function () {
        const audio = document.getElementById('bardo-audio-engine');
        const btnPlay = document.getElementById('bardo-btn-play');

        if (!audio || !audio.src) {
            window.conhecaMundo.tocarMusica(0);
            return;
        }

        if (audio.paused) {
            audio.play();
            btnPlay.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audio.pause();
            btnPlay.innerHTML = '<i class="fas fa-play ml-1"></i>';
        }
    },

    proximaMusica: function () {
        if (indiceMusicaAtual === -1) return window.conhecaMundo.tocarMusica(0);
        let next = indiceMusicaAtual + 1;
        if (next >= cancoesDoBardo.length) next = 0;
        window.conhecaMundo.tocarMusica(next);
    },

    musicaAnterior: function () {
        if (indiceMusicaAtual === -1) return window.conhecaMundo.tocarMusica(0);
        let prev = indiceMusicaAtual - 1;
        if (prev < 0) prev = cancoesDoBardo.length - 1;
        window.conhecaMundo.tocarMusica(prev);
    },

    buscarTempo: function (segundos) {
        const audio = document.getElementById('bardo-audio-engine');
        if (audio && audio.src) {
            audio.currentTime = segundos;
        }
    },

    mudarVolume: function (valor) {
        const audio = document.getElementById('bardo-audio-engine');
        if (audio) audio.volume = valor;
    },

    formatarTempo: function (segundos) {
        if (isNaN(segundos)) return "0:00";
        const min = Math.floor(segundos / 60);
        const seg = Math.floor(segundos % 60);
        return `${min}:${seg.toString().padStart(2, '0')}`;
    }
};
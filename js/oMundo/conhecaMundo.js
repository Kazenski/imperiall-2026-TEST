// Gera automaticamente a lista ['imagens/mapas1.webp', ..., 'imagens/mapas6.webp']
const mapasDoMundo = Array.from({ length: 6 }, (_, i) => `imagens/mapas${i + 1}.webp`);

export function renderConhecaMundoTab() {
    const container = document.getElementById('conheca-mundo-content');
    if (!container) return;

    // Gera o HTML do grid de mapas dinamicamente
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

    container.innerHTML = `
        <div class="w-full h-full fade-in flex flex-col p-6 md:p-10 overflow-y-auto custom-scroll pb-16">
            
            <header class="mb-10 text-center w-full border-b border-slate-800 pb-8">
                <h1 class="text-4xl md:text-5xl font-black font-cinzel text-amber-500 drop-shadow-md tracking-widest mb-3">A Gênese de Imperiall</h1>
                <p class="text-slate-400 text-sm md:text-base italic max-w-2xl mx-auto">
                    "Antes dos mortais pisarem na terra, os deuses já traçavam o destino entre oceanos e lendas..."
                </p>
            </header>

            <div class="max-w-5xl mx-auto bg-slate-900/60 p-8 md:p-12 rounded-2xl border border-slate-800 shadow-2xl mb-16 relative">
                <i class="fas fa-quote-left absolute top-6 left-6 text-slate-700 text-3xl opacity-50"></i>
                
                <div class="space-y-6 text-slate-300 text-base md:text-lg leading-relaxed font-serif relative z-10 text-justify">
                    <p>
                        <span class="text-3xl md:text-4xl font-cinzel font-bold text-amber-400 float-left mr-2 leading-none mt-1">H</span>
                        á muito tempo, antes mesmo da existência dos seres na terra, a Deusa Gallandra criou criaturas místicas para manter o mundo em ordem: os <strong>Leviatãs</strong>. Entre eles estavam Legina, Imperiall e Renstenci, cada um responsável por criar os seres que habitariam os três continentes.
                    </p>
                    
                    <p>
                        <strong class="text-sky-400 font-cinzel tracking-wider">Legina</strong>, o Leviatã Monstruoso, deu origem a seres imponentes e aterrorizantes. Seu continente é banhado por dois oceanos: o do Kraken e o Lendário. Ele possui um temperamento hostil, cruel e de sangue frio. Sua arma símbolo é um arco e flechas. Os habitantes de seu continente reverenciam Legina com temor e respeito, acreditando que sua crueldade é uma prova de força necessária para sobreviver em um ambiente tão implacável.
                    </p>
                    
                    <p>
                        <strong class="text-emerald-400 font-cinzel tracking-wider">Renstenci</strong>, o Leviatã do Planeta, é abençoado com beleza e graça. Seu continente é um paraíso de criaturas mágicas, fadas e uma diversidade infinita de plantas e seres vegetais, sempre em constante criação. Este continente é banhado pelos oceanos Gélido e Lendário, e está próximo às Ilhas da Morte. Sua arma símbolo é uma marreta de duas mãos. Os habitantes de Renstenci vivem em harmonia com a natureza, vendo o Leviatã como um guardião benevolente que lhes concede a beleza e a magia do mundo ao seu redor.
                    </p>
                    
                    <p>
                        <strong class="text-amber-500 font-cinzel tracking-wider">Imperiall</strong>, o Leviatã da Ganância, governa um vasto continente habitado por seres medíocres cujo único propósito é acumular mais e mais. Este continente é banhado pelos oceanos Gélido, Lendário e Kraken. As criaturas de Imperiall são, em sua maioria, humanóides e similares. Sua arma símbolo é uma espada de duas mãos. Os habitantes de Imperiall são frequentemente consumidos pela ambição e pela busca incessante por riqueza e poder, refletindo a própria natureza gananciosa de seu criador. Eles veem Imperiall como um exemplo a ser seguido, acreditando que a acumulação de riquezas é a chave para a verdadeira grandeza.
                    </p>
                    
                    <div class="w-24 h-px bg-slate-700 mx-auto my-8"></div>
                    
                    <p>
                        No entanto, a paz e a ordem estabelecidas pelos Leviatãs foram ameaçadas quando quatro grandes dragões foram controlados por quatro seres malignos contra sua vontade. Esses dragões, outrora guardiões do equilíbrio, tornaram-se instrumentos de destruição e caos. Para restaurar a harmonia, três defensores lendários, conhecidos como <strong>Templários</strong>, surgiram. Eles eram guerreiros de grande poder e sabedoria, escolhidos pela própria Deusa Gallandra para enfrentar essa ameaça.
                    </p>
                    
                    <p>
                        Os Templários enfrentaram os controladores dos dragões em batalhas épicas que sacudiram os próprios alicerces do mundo. Após uma série de confrontos intensos, os Templários conseguiram derrotar os seres malignos e libertar os dragões de seu controle. Para garantir que essa ameaça nunca mais retornasse, os Templários selaram os dragões em grandes prisões mágicas, espalhadas pelos três continentes. Essas prisões são guardadas por poderosos encantamentos e protegidas por guardiões escolhidos a dedo, garantindo que os dragões permaneçam adormecidos e que o equilíbrio do mundo seja mantido.
                    </p>
                </div>
            </div>

            <div class="max-w-7xl mx-auto w-full">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-3">
                    <h2 class="text-2xl font-cinzel font-bold text-slate-200 tracking-widest"><i class="fas fa-map-marked-alt text-amber-500 mr-3"></i> Cartografia Conhecida</h2>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${mapasHTML}
                </div>
            </div>

        </div>

        <div id="modal-mapa-mundo" class="fixed inset-0 z-[100] bg-black/95 hidden items-center justify-center p-4 cursor-pointer animate-fade-in" onclick="this.classList.add('hidden'); this.classList.remove('flex');">
            <button class="absolute top-6 right-8 text-slate-300 hover:text-amber-400 text-5xl transition-colors outline-none">&times;</button>
            <img id="img-modal-mapa" src="" class="max-w-[95vw] max-h-[95vh] object-contain rounded border border-slate-700 shadow-2xl">
        </div>
    `;
}

// Controla o clique nas imagens para as abrir em tamanho real
window.conhecaMundo = {
    openMapa: function(url) {
        const modal = document.getElementById('modal-mapa-mundo');
        const img = document.getElementById('img-modal-mapa');
        if (modal && img) {
            img.src = url;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
};
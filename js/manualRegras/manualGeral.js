export function renderManualGeralTab() {
    const container = document.getElementById('manual-geral-content');
    if (!container) return;

    // A tag <details> é nativa do HTML. Usamos "list-none [&::-webkit-details-marker]:hidden" no <summary> 
    // para esconder a setinha padrão feia do navegador e usar o ícone bonito do FontAwesome.

    container.innerHTML = `
        <div class="w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar animate-fade-in text-gray-200">
            
            <header class="mb-10 text-center border-b-2 border-amber-500/30 pb-6 shrink-0">
                <h1 class="text-3xl sm:text-5xl font-bold font-cinzel text-amber-400 tracking-wider">Manual e Regras</h1>
                <p class="text-slate-400 mt-2 uppercase tracking-widest text-xs sm:text-sm">Guia do Aventureiro: O que você precisa saber</p>
            </header>

            <div class="max-w-4xl mx-auto space-y-6 pb-12">
                
                <details class="group bg-slate-800/60 border border-slate-700 rounded-xl shadow-lg overflow-hidden transition-all duration-300">
                    <summary class="flex items-center justify-between cursor-pointer p-5 bg-slate-900/40 hover:bg-slate-800/80 transition-colors list-none outline-none [&::-webkit-details-marker]:hidden">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                                <i class="fas fa-dice-d20 text-lg"></i>
                            </div>
                            <h2 class="text-xl sm:text-2xl font-bold font-cinzel text-white">1. As Bases do RPG</h2>
                        </div>
                        <i class="fas fa-chevron-down text-slate-400 text-xl transition-transform duration-300 group-open:rotate-180"></i>
                    </summary>
                    
                    <div class="p-6 pt-2 border-t border-slate-700/50 text-slate-300 leading-relaxed space-y-6 text-sm sm:text-base bg-slate-800/20">
                        
                        <div>
                            <h3 class="text-lg font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">1.1 O que é o RPG?</h3>
                            <p>RPG é a sigla para <em>Role-Playing Game</em>, que em português significa "Jogo de Interpretação de Papéis". Diferente dos videogames tradicionais, onde você é limitado pelas linhas de código e paredes invisíveis, o RPG de mesa (e suas adaptações digitais) ocorre primariamente no "Teatro da Mente".</p>
                            <p class="mt-2">No RPG, um grupo de pessoas se reúne para contar uma história colaborativa. Um dos participantes assume o papel de <strong>Mestre do Jogo</strong> (narrador, árbitro e controlador do universo), enquanto os demais são os <strong>Jogadores</strong>, cada um controlando um único protagonista (seu Personagem) dentro desse mundo. As ações não são limitadas por botões em um controle, mas apenas pela sua imaginação e pelas regras do sistema.</p>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">1.2 Para que serve?</h3>
                            <p>O propósito principal do RPG é a diversão por meio da construção de narrativas épicas. Ele serve para exercitar a criatividade, trabalhar a resolução de problemas em equipe e vivenciar aventuras que seriam impossíveis no mundo real. É uma experiência social poderosa onde cada decisão importa e as consequências moldam o futuro do universo ao redor.</p>
                            <p class="mt-2">Aqui, você pode ser um guerreiro forjado em batalhas lendárias, um mago manipulando energias primordiais ou um ladino agindo nas sombras do Império. O limite é a história que vocês decidem contar.</p>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">1.3 Referências e Bibliografia Recomendada</h3>
                            <p>Para situar quem está chegando agora, o formato de RPG que jogamos no <strong>Imperiall</strong> compartilha raízes com grandes clássicos que definiram a cultura pop ao longo das décadas:</p>
                            <ul class="list-disc pl-5 mt-3 space-y-2">
                                <li><strong class="text-white">Dungeons & Dragons (D&D):</strong> O avô de todos os RPGs. Focado na fantasia medieval clássica, elfos, anões, masmorras e dragões. É a maior referência mundial do gênero.</li>
                                <li><strong class="text-white">Tormenta20:</strong> O maior sistema de RPG brasileiro, também de fantasia, conhecido por um universo riquíssimo, heróico e muitas vezes exagerado.</li>
                                <li><strong class="text-white">Call of Cthulhu:</strong> Focado em investigação e terror cósmico moderno ou nas décadas de 1920, provando que o RPG vai muito além de espadas e magias.</li>
                                <li><strong class="text-white">Vampiro: A Máscara:</strong> Foco em horror pessoal e intrigas políticas no mundo moderno.</li>
                            </ul>
                            <p class="mt-3">O Imperiall RPG bebe dessas fontes clássicas, mas introduz um universo próprio, sistemas de <em>crafting</em>, constelações e atributos dinâmicos pensados para uma experiência única na nossa plataforma.</p>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1">1.4 A Arte da Interpretação (Roleplay)</h3>
                            <p>Jogar RPG não é apenas rolar dados e calcular dano de espada. O coração da experiência está no <strong>Roleplay</strong> — a arte de interpretar.</p>
                            <p class="mt-2">Quando você cria a sua ficha no Imperiall, você define características, uma história (Lore) e as motivações do seu personagem. A partir desse momento, as decisões que você toma na mesa não devem ser as <em>suas</em> decisões, mas sim as <em>dele</em>.</p>
                            <ul class="list-disc pl-5 mt-3 space-y-3">
                                <li><strong class="text-amber-500">Separe o Jogador do Personagem (Evite o Metagame):</strong> Você, como jogador, pode saber que o Mestre escondeu um monstro atrás da porta porque leu no livro de regras ou ouviu alguém comentar. Mas o seu personagem, que está no meio do corredor escuro, não tem como saber disso. Jogar bem é deixar seu personagem abrir a porta e sofrer a surpresa!</li>
                                <li><strong class="text-amber-500">Abrace as Falhas:</strong> Dados baixos e falhas críticas rendem as melhores histórias. Um personagem que erra um feitiço e acidentalmente queima a própria mochila é muito mais memorável do que aquele que acerta tudo o tempo todo.</li>
                                <li><strong class="text-amber-500">Dê voz ao seu Herói:</strong> Você não precisa fazer vozes engraçadas ou atuar como um profissional de dublagem (embora seja divertido). Basta falar em primeira pessoa: <em>"Eu saco minha espada e pergunto ao guarda o que está acontecendo"</em>.</li>
                            </ul>
                        </div>
                    </div>
                </details>

                <details class="group bg-slate-800/60 border border-slate-700 rounded-xl shadow-lg overflow-hidden transition-all duration-300">
                    <summary class="flex items-center justify-between cursor-pointer p-5 bg-slate-900/40 hover:bg-slate-800/80 transition-colors list-none outline-none [&::-webkit-details-marker]:hidden">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center text-sky-400">
                                <i class="fas fa-compass text-lg"></i>
                            </div>
                            <h2 class="text-xl sm:text-2xl font-bold font-cinzel text-white">2. Como Navegar Neste Site</h2>
                        </div>
                        <i class="fas fa-chevron-down text-slate-400 text-xl transition-transform duration-300 group-open:rotate-180"></i>
                    </summary>
                    
                    <div class="p-6 pt-2 border-t border-slate-700/50 text-slate-300 leading-relaxed space-y-6 text-sm sm:text-base bg-slate-800/20">
                        
                        <p>O <strong>Imperiall RPG</strong> foi desenvolvido para ser o seu escudo do mestre e a sua ficha de personagem, tudo interligado em um só lugar. Abaixo, explicamos como navegar pelos principais menus da plataforma:</p>

                        <div>
                            <h3 class="text-lg font-bold text-sky-400 mb-2 border-b border-slate-700 pb-1"><i class="fas fa-globe-americas mr-2 text-slate-500"></i> O Mundo</h3>
                            <p>Esta seção é dedicada à narrativa e ambientação. Aqui você entende como é o continente onde o seu personagem vive.</p>
                            <ul class="list-disc pl-5 mt-3 space-y-2">
                                <li><strong class="text-white">Conheça o Mundo:</strong> O mapa geral, as regiões geográficas, as cidades, a economia e as facções que controlam o cenário.</li>
                                <li><strong class="text-white">Os Deuses:</strong> O panteão oficial. Conheça os deuses que regem os céus e os infernos, seus dogmas e o que eles exigem de seus clérigos e seguidores.</li>
                                <li><strong class="text-white">As Lendas:</strong> Os contos e mitos do império. Fatos do passado, grandes guerras antigas e os segredos perdidos que seu personagem pode ter ouvido falar nas tavernas.</li>
                                <li><strong class="text-white">NPCs Importantes:</strong> O registro das personalidades públicas, heróis, vilões ou comerciantes que influenciam a história atual do mundo.</li>
                            </ul>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-sky-400 mb-2 border-b border-slate-700 pb-1"><i class="fas fa-scroll mr-2 text-slate-500"></i> Manual e Regras</h3>
                            <p>É a sua enciclopédia mecânica do jogo. Sempre que você tiver dúvida sobre como seu personagem funciona, é aqui que deve procurar.</p>
                            <ul class="list-disc pl-5 mt-3 space-y-2">
                                <li><strong class="text-white">Raça:</strong> Define a origem biológica do seu personagem (Humanos, Elfos, Gnomos, etc.). Cada raça concede atributos nativos e resistências exclusivas.</li>
                                <li><strong class="text-white">Classe:</strong> A profissão de combate e estilo de vida do seu personagem (Guerreiro, Mago, Ladino). É a base do que você sabe fazer em batalha.</li>
                                <li><strong class="text-white">Subclasse:</strong> Uma especialização avançada da sua Classe. Um Guerreiro pode ser um Defensor focado em escudo ou um Bárbaro furioso. Um Mago pode focar em fogo ou em ilusões.</li>
                                <li><strong class="text-white">Habilidades:</strong> O grimório completo de todos os ataques especiais, magias e truques passivos que existem no sistema. Detalha custos de MP, dano gerado e efeitos visuais.</li>
                                <li><strong class="text-white">Profissões:</strong> Ofícios de trabalho (como Ferreiro, Alquimista ou Cozinheiro) que permitem o <em>crafting</em> (criação) de itens reais dentro do sistema durante os períodos de descanso.</li>
                            </ul>
                        </div>
                    </div>
                </details>
                
            </div>
        </div>
    `;
}
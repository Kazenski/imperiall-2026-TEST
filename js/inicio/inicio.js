import { db } from '../core/firebase.js'; // Importe a sua instância de bd configurada
import { collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variáveis de controlo do carrossel
let slides = [];
let currentIndex = 0;
let autoSlideInterval;

export async function renderInicioTab() {
    const container = document.getElementById('inicio-content');
    if (!container) return;

    // Estrutura HTML base com a imagem de fundo imersiva
    container.innerHTML = `
        <div class="w-full h-full relative overflow-hidden flex flex-col fade-in">
            <div class="absolute inset-0 z-0">
                <img src="gs://kazenski-a1bb2.firebasestorage.app/chronarion-o-guardiapso-eterno-2-1-AR0bRoBR0JSynbnW.png" alt="Background" class="w-full h-full object-cover opacity-30 mix-blend-overlay pointer-events-none">
                <div class="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-transparent to-slate-900"></div>
            </div>

            <div class="relative z-10 pt-10 pb-4 text-center">
                <h1 class="font-cinzel text-4xl md:text-5xl font-bold text-amber-500 drop-shadow-lg tracking-widest">Bem-vindo a Imperiall</h1>
                <p class="text-slate-300 mt-2 text-sm md:text-base italic">Fique a par das últimas notícias e atualizações do reino.</p>
            </div>

            <div class="component-wrapper relative z-10 flex-grow">
                <div class="carousel-container" id="main-carousel-container">
                    <div class="flex justify-center items-center h-full w-full">
                        <div class="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
                <div class="carousel-nav" id="main-carousel-nav"></div>
            </div>
        </div>
    `;

    // Limpa qualquer intervalo anterior para evitar loops duplicados se o utilizador sair e voltar à aba
    clearInterval(autoSlideInterval);
    
    // Busca os dados e inicializa
    await fetchNoticias();
    
    // Adiciona Event Listeners para Pausar no Hover
    const carouselContainerEl = document.getElementById('main-carousel-container');
    if (carouselContainerEl) {
        carouselContainerEl.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
        carouselContainerEl.addEventListener('mouseleave', startAutoSlide);
    }
}

async function fetchNoticias() {
    const carouselContainer = document.getElementById('main-carousel-container');
    if (!carouselContainer) return;

    try {
        const noticiasCollectionRef = collection(db, "rpg_noticias");
        const q = query(noticiasCollectionRef, where('ativa', '==', true), orderBy('ordem'));
        const snapshot = await getDocs(q);
        
        slides = snapshot.docs.map(doc => doc.data());
        
        if (slides.length > 0) {
            renderSlides();
            startAutoSlide();
        } else {
            carouselContainer.innerHTML = `<div class="text-slate-300 text-center font-cinzel text-xl p-8 bg-black/50 rounded-xl border border-slate-700 backdrop-blur-sm">Nenhuma notícia ativa encontrada nos arquivos.</div>`;
        }
    } catch (error) {
        console.error("Erro ao buscar notícias: ", error);
        carouselContainer.innerHTML = `<div class="text-red-400 text-center font-cinzel text-xl p-8 bg-black/50 rounded-xl border border-red-900/50 backdrop-blur-sm">Falha ao comunicar com os corvos mensageiros (Erro ao carregar notícias).</div>`;
    }
}

function renderSlides() {
    const carouselContainer = document.getElementById('main-carousel-container');
    const carouselNav = document.getElementById('main-carousel-nav');
    if (!carouselContainer || !carouselNav) return;

    carouselContainer.innerHTML = '';
    carouselNav.innerHTML = '';
    
    slides.forEach((slide, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.classList.add('carousel-slide');
        slideDiv.style.backgroundImage = `url('${slide.imagemURL || 'https://placehold.co/1200x800/1e293b/a1a1aa?text=Imperiall+News'}')`;
        slideDiv.dataset.index = index;

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('slide-content');
        
        const titleEl = document.createElement('h2');
        titleEl.classList.add('slide-title', 'font-cinzel');
        titleEl.textContent = slide.titulo || '';
        contentDiv.appendChild(titleEl);

        const subtitleEl = document.createElement('p');
        subtitleEl.classList.add('slide-subtitle');
        subtitleEl.textContent = slide.subtitulo || '';
        contentDiv.appendChild(subtitleEl);

        if (slide.linkBotao && slide.textoBotao) {
            const buttonLink = document.createElement('a');
            buttonLink.classList.add('slide-button', 'font-cinzel');
            buttonLink.href = slide.linkBotao;
            buttonLink.textContent = slide.textoBotao;
            buttonLink.target = '_blank';
            contentDiv.appendChild(buttonLink);
        }

        slideDiv.appendChild(contentDiv);
        carouselContainer.appendChild(slideDiv);

        const navDot = document.createElement('div');
        navDot.classList.add('nav-dot');
        navDot.dataset.index = index;
        navDot.addEventListener('click', () => {
            showSlide(index);
            resetAutoSlide();
        });
        carouselNav.appendChild(navDot);
    });
    
    showSlide(0);
}

function showSlide(index) {
    const allSlides = document.querySelectorAll('.carousel-slide');
    const allNavDots = document.querySelectorAll('.nav-dot');
    
    allSlides.forEach(slide => slide.classList.remove('active')); 
    allNavDots.forEach(dot => dot.classList.remove('active'));

    if (allSlides.length > 0) {
        if(allSlides[index]) allSlides[index].classList.add('active');
        if(allNavDots[index]) allNavDots[index].classList.add('active');
        
        allSlides.forEach((slide, i) => {
            const offset = i - index;
            let transform = '';
            let zIndex = 0;
            
            if (offset === 0) {
                transform = 'translateX(0) scale(1) rotateY(0deg)';
                zIndex = 3;
            } else if (offset > 0) { 
                transform = `translateX(${offset * 30}%) scale(${1 - offset * 0.2}) rotateY(-10deg)`;
                zIndex = 3 - offset;
            } else { 
                transform = `translateX(${offset * 30}%) scale(${1 + offset * 0.2}) rotateY(10deg)`;
                zIndex = 3 + offset;
            }
            slide.style.transform = transform;
            slide.style.zIndex = zIndex;
        });
    }
    currentIndex = index;
}

function nextSlide() {
    if (slides.length === 0) return;
    let nextIndex = (currentIndex + 1) % slides.length;
    showSlide(nextIndex);
}

function startAutoSlide() {
    if (slides.length > 1) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = setInterval(nextSlide, 5000);
    }
}

function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
}
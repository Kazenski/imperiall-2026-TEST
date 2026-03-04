export async function renderMapaMundialTab() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    // Injeta o mapa original através de um iframe 100% responsivo e isolado.
    // O usuário nem percebe que é um iframe, parece nativo da SPA.
    container.innerHTML = `
        <div class="w-full h-full bg-slate-950">
            <iframe 
                src="./mapa-godmode.html" 
                class="w-full h-full border-none"
                title="Arquiteto de Mundo - God Mode"
            ></iframe>
        </div>
    `;
}
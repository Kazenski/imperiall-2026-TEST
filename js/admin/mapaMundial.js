export async function renderMapaMundialTab() {
    const container = document.getElementById('mapa-mundial-content');
    if (!container) {
        console.error("A div #mapa-mundial-content não foi encontrada no index.html");
        return;
    }
    
    // Evita recarregar o iframe atoa se ele já estiver renderizado
    if (container.innerHTML.includes('iframe')) return;

    container.innerHTML = `
        <div class="w-full h-full bg-slate-950">
            <iframe 
                src="./mapa-godmode.html" 
                class="w-full h-full border-none"
                title="Mapa Mundial - God Mode"
            ></iframe>
        </div>
    `;
}
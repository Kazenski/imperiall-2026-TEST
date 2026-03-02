// ARQUIVO: js/tabs/comercio.js

import { db, doc, onSnapshot, runTransaction, increment, deleteField } from '../core/firebase.js';
import { globalState, COINS, PLACEHOLDER_IMAGE_URL } from '../core/state.js';
import { escapeHTML, optimizeCoins, getRankWeight } from '../core/utils.js';
import { getWallet } from '../core/calculos.js';

// Função utilitária que faltava no escopo global para a injeção do HTML
window.getCoinImg = function(coinId) {
    const item = globalState.cache.itens.get(coinId);
    return item ? (item.imagemUrl || PLACEHOLDER_IMAGE_URL) : PLACEHOLDER_IMAGE_URL;
};

// Aliás local para uso nas templates string
function getCoinImg(coinId) {
    return window.getCoinImg(coinId);
}

export function renderComercioTab() {
    const container = document.getElementById('comercio-content');
    if (!container) return;

    const charData = globalState.selectedCharacterData;
    if (!charData) {
        container.innerHTML = '<p class="text-center text-slate-500 mt-10">Selecione um personagem.</p>';
        return;
    }

    // Inicializa o estado do comércio se não existir (evita crash ao dar reload)
    if (!globalState.commerce) {
        globalState.commerce = {
            mode: 'buy',
            selectedShopId: null,
            liveShopData: null,
            exchange: {
                'gold_silver': { dir: 'down', val: 1 },
                'silver_bronze': { dir: 'down', val: 1 },
                'gold_bronze': { dir: 'down', val: 1 }
            }
        };
    }

    if (globalState.commerce.liveShopUnsubscribe) {
        globalState.commerce.liveShopUnsubscribe();
        globalState.commerce.liveShopUnsubscribe = null;
    }

    const sessionId = globalState.activeSessionId;
    
    let shopSelectorHtml = '';
    if (sessionId === 'world') {
        shopSelectorHtml = `
            <div class="mb-4 bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg text-center shadow-lg">
                <i class="fas fa-globe text-amber-500 text-3xl mb-2"></i>
                <h3 class="font-cinzel text-amber-400 font-bold">Comércio Global Desativado</h3>
                <p class="text-xs text-slate-400 mt-1">Entre em uma sessão ativa (Arena/Cidade) para acessar as lojas locais.</p>
            </div>
        `;
    } else {
        const sessionData = globalState.userSessions.find(s => s.id === sessionId);
        const shops = sessionData?.activeShops || [];
        
        if (shops.length === 0) {
            shopSelectorHtml = `
                <div class="mb-4 bg-slate-900/50 border border-slate-700 p-4 rounded-lg text-center shadow-lg">
                    <i class="fas fa-store-slash text-slate-500 text-3xl mb-2"></i>
                    <h3 class="font-cinzel text-slate-400 font-bold">Nenhuma Loja Aberta</h3>
                    <p class="text-xs text-slate-500 mt-1">O mestre ainda não abriu nenhuma loja nesta região.</p>
                </div>
            `;
        } else {
            let options = '<option value="">-- Selecione uma Loja --</option>';
            shops.forEach(s => { options += `<option value="${s.id}" ${globalState.commerce.selectedShopId === s.id ? 'selected' : ''}>${escapeHTML(s.name)}</option>`; });
            
            shopSelectorHtml = `
                <div class="mb-6 flex flex-col md:flex-row gap-4 items-center bg-slate-900/80 p-4 rounded-lg border border-sky-500/30 shadow-lg">
                    <div class="shrink-0 w-12 h-12 rounded-full bg-sky-900 flex items-center justify-center border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.4)]">
                        <i class="fas fa-store text-xl text-sky-400"></i>
                    </div>
                    <div class="flex-grow w-full">
                        <label class="text-[10px] text-sky-400 font-bold uppercase tracking-widest block mb-1">Mercado Local</label>
                        <select id="comercio-shop-select" class="w-full bg-slate-950 border border-slate-600 rounded py-2 px-3 text-white font-bold outline-none focus:border-sky-500 shadow-inner" onchange="window.selectShop(this.value)">
                            ${options}
                        </select>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
            <div class="lg:col-span-8 flex flex-col h-full">
                ${shopSelectorHtml}
                
                <div class="flex gap-2 mb-4">
                    <button onclick="window.changeShopMode('buy')" class="btn ${globalState.commerce.mode === 'buy' ? 'btn-primary' : 'bg-slate-800 text-slate-400'} flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all">
                        <i class="fas fa-shopping-cart mr-2"></i> Comprar
                    </button>
                    <button onclick="window.changeShopMode('sell')" class="btn ${globalState.commerce.mode === 'sell' ? 'btn-green' : 'bg-slate-800 text-slate-400'} flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all">
                        <i class="fas fa-coins mr-2"></i> Vender
                    </button>
                </div>

                <div id="live-shop-container" class="bg-slate-900/50 p-4 rounded-lg border border-slate-700 flex-grow overflow-y-auto custom-scroll shadow-inner min-h-[400px]">
                    <div class="flex flex-col h-full items-center justify-center text-slate-600 opacity-50">
                        <i class="fas fa-store text-6xl mb-4"></i>
                        <p class="font-cinzel text-lg">Selecione uma loja para ver os itens.</p>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-4 flex flex-col gap-6">
                <div class="bg-slate-900/80 p-6 rounded-lg border border-amber-500/30 shadow-lg relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-amber-500/10 text-8xl pointer-events-none"><i class="fas fa-wallet"></i></div>
                    <h3 class="text-lg font-cinzel text-amber-400 mb-4 border-b border-slate-700 pb-2 flex items-center gap-2"><i class="fas fa-coins"></i> Sua Carteira</h3>
                    <div id="comercio-wallet-display" class="flex flex-col gap-3 relative z-10"></div>
                </div>

                <div class="bg-slate-900/80 p-6 rounded-lg border border-slate-700 shadow-lg flex-grow">
                    <h3 class="text-lg font-cinzel text-slate-300 mb-4 border-b border-slate-700 pb-2 flex items-center gap-2"><i class="fas fa-exchange-alt text-sky-400"></i> Casa de Câmbio</h3>
                    <div id="comercio-exchange-display" class="flex flex-col gap-4"></div>
                </div>
            </div>
        </div>
    `;

    renderWalletDisplay();
    renderExchangePanel();

    if (globalState.commerce.selectedShopId && sessionId !== 'world') {
        window.selectShop(globalState.commerce.selectedShopId);
    }
}
window.renderComercioTab = renderComercioTab; // Expõe ao window para F5

window.selectShop = function(shopId) {
    globalState.commerce.selectedShopId = shopId;
    if (globalState.commerce.liveShopUnsubscribe) {
        globalState.commerce.liveShopUnsubscribe();
        globalState.commerce.liveShopUnsubscribe = null;
    }
    
    const container = document.getElementById('live-shop-container');
    if (!shopId) {
        if(container) container.innerHTML = '<div class="flex flex-col h-full items-center justify-center text-slate-600 opacity-50"><i class="fas fa-store text-6xl mb-4"></i><p class="font-cinzel text-lg">Selecione uma loja para ver os itens.</p></div>';
        return;
    }

    if(container) container.innerHTML = '<div class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-sky-500"></div></div>';

    globalState.commerce.liveShopUnsubscribe = onSnapshot(doc(db, "rpg_shops", shopId), (docSnap) => {
        if (docSnap.exists()) {
            globalState.commerce.liveShopData = docSnap.data();
            renderLiveShopItems();
        } else {
            globalState.commerce.liveShopData = null;
            if(container) container.innerHTML = '<p class="text-center text-red-500 py-10">Esta loja foi fechada ou não existe mais.</p>';
        }
    });
};

window.changeShopMode = function(mode) {
    globalState.commerce.mode = mode;
    
    // Atualiza botões visualmente sem renderizar tudo
    const btnBuy = document.querySelector('button[onclick="window.changeShopMode(\'buy\')"]');
    const btnSell = document.querySelector('button[onclick="window.changeShopMode(\'sell\')"]');
    
    if (mode === 'buy') {
        if(btnBuy) btnBuy.className = 'btn btn-primary flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all';
        if(btnSell) btnSell.className = 'btn bg-slate-800 text-slate-400 flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all';
    } else {
        if(btnBuy) btnBuy.className = 'btn bg-slate-800 text-slate-400 flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all';
        if(btnSell) btnSell.className = 'btn btn-green flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all';
    }

    renderLiveShopItems();
};

function renderLiveShopItems() {
    const container = document.getElementById('live-shop-container');
    if (!container) return;

    const shopData = globalState.commerce.liveShopData;
    if (!shopData) {
        container.innerHTML = '<p class="text-center text-slate-500 py-10">Loja indisponível.</p>';
        return;
    }

    const mode = globalState.commerce.mode;
    const itemsData = mode === 'buy' ? (shopData.itemsToSell || []) : (shopData.itemsToBuy || []);

    if (itemsData.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 py-10 italic">A loja não está ${mode === 'buy' ? 'vendendo' : 'comprando'} itens no momento.</p>`;
        return;
    }

    let itemsHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">';

    itemsData.forEach(shopItem => {
        const itemInfo = globalState.cache.itens.get(shopItem.itemId);
        if (!itemInfo) return;

        const priceData = optimizeCoins(shopItem.priceCopper);
        let priceHtml = '';
        if (priceData.gold > 0) priceHtml += `<span class="text-amber-400 font-bold ml-1">${priceData.gold} O</span>`;
        if (priceData.silver > 0) priceHtml += `<span class="text-slate-300 font-bold ml-1">${priceData.silver} P</span>`;
        if (priceData.bronze > 0) priceHtml += `<span class="text-amber-700 font-bold ml-1">${priceData.bronze} B</span>`;
        if (priceHtml === '') priceHtml = '<span class="text-amber-700 font-bold ml-1">0 B</span>';

        const configInfo = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(shopItem.itemId) : null;
        let rank = (itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfo ? configInfo.tierId : null) || "F").toUpperCase();

        const rankColors = { 'SS': 'text-amber-400 border-amber-400', 'S': 'text-rose-400 border-rose-500', 'A': 'text-amber-400 border-amber-500', 'B': 'text-purple-400 border-purple-500', 'C': 'text-blue-400 border-blue-500', 'D': 'text-emerald-400 border-emerald-500', 'E': 'text-slate-400 border-slate-500', 'F': 'text-slate-500 border-slate-700' };
        const rankColor = rankColors[rank] || rankColors['F'];

        let actionArea = '';
        const charData = globalState.selectedCharacterData.ficha;
        
        if (mode === 'buy') {
            const stockHtml = shopItem.stock === -1 ? '<span class="text-green-400">∞</span>' : `<span class="${shopItem.stock > 0 ? 'text-white' : 'text-red-500'}">${shopItem.stock}</span>`;
            const maxBuy = shopItem.stock === -1 ? 99 : shopItem.stock;
            const canBuy = shopItem.stock !== 0;

            actionArea = `
                <div class="flex flex-col items-end gap-2 w-1/3 min-w-[100px] shrink-0">
                    <div class="text-[9px] text-slate-400 uppercase font-bold text-right w-full">Estoque: ${stockHtml}</div>
                    ${canBuy ? `
                        <div class="flex w-full">
                            <input type="number" id="qty-buy-${shopItem.itemId}" class="w-1/2 bg-slate-950 border border-slate-600 rounded-l text-center text-xs text-white outline-none focus:border-sky-500 py-1" value="1" min="1" max="${maxBuy}">
                            <button onclick="window.processShopTransaction('buy', '${shopItem.itemId}', ${shopItem.priceCopper}, ${shopItem.stock})" class="w-1/2 btn btn-primary rounded-l-none text-xs py-1 px-0 flex justify-center items-center shadow-md"><i class="fas fa-shopping-cart"></i></button>
                        </div>
                    ` : `<button class="btn bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed text-xs py-1 w-full" disabled>Esgotado</button>`}
                </div>
            `;
        } else {
            const owned = charData.mochila?.[shopItem.itemId] || 0;
            const canSell = owned > 0;

            actionArea = `
                <div class="flex flex-col items-end gap-2 w-1/3 min-w-[100px] shrink-0">
                    <div class="text-[9px] text-slate-400 uppercase font-bold text-right w-full">Na Mochila: <span class="${owned > 0 ? 'text-emerald-400' : 'text-red-500'}">${owned}</span></div>
                    ${canSell ? `
                        <div class="flex w-full">
                            <input type="number" id="qty-sell-${shopItem.itemId}" class="w-1/2 bg-slate-950 border border-slate-600 rounded-l text-center text-xs text-white outline-none focus:border-green-500 py-1" value="1" min="1" max="${owned}">
                            <button onclick="window.processShopTransaction('sell', '${shopItem.itemId}', ${shopItem.priceCopper}, ${owned})" class="w-1/2 btn btn-green rounded-l-none text-xs py-1 px-0 flex justify-center items-center shadow-md"><i class="fas fa-coins"></i></button>
                        </div>
                    ` : `<button class="btn bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed text-xs py-1 w-full" disabled>Sem Item</button>`}
                </div>
            `;
        }

        itemsHtml += `
            <div class="bg-slate-800 border border-slate-700 rounded p-2 flex gap-3 hover:border-slate-500 transition shadow-sm relative group overflow-hidden">
                <div class="w-14 h-14 rounded border ${rankColor} bg-black shrink-0 relative flex items-center justify-center overflow-hidden">
                    <img src="${itemInfo.imagemUrl || PLACEHOLDER_IMAGE_URL}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 right-0 bg-black/80 text-[8px] font-bold px-1 rounded-tl border-t border-l ${rankColor}">${rank}</div>
                </div>
                
                <div class="flex-grow flex flex-col justify-between overflow-hidden">
                    <div class="text-xs font-bold text-slate-200 truncate" title="${itemInfo.nome}">${escapeHTML(itemInfo.nome)}</div>
                    <div class="text-[10px] bg-slate-950/50 p-1 rounded border border-slate-700/50 inline-block w-max mt-1">
                        <span class="text-slate-500 uppercase font-bold mr-1">${mode === 'buy' ? 'Preço:' : 'Paga:'}</span> 
                        ${priceHtml}
                    </div>
                </div>
                
                ${actionArea}
            </div>
        `;
    });

    itemsHtml += '</div>';

    if (mode === 'sell') {
        const massSellHtml = `
            <div class="mt-6 border-t border-slate-700 pt-4">
                <h4 class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Venda Rápida por Rank</h4>
                <div class="flex flex-wrap gap-2">
                    ${['F', 'E', 'D', 'C'].map(r => `<button onclick="window.sellAllByRank('${r}')" class="btn bg-slate-800 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 text-xs py-1 px-3 shadow-sm flex-1 sm:flex-none">Vender Rank ${r}</button>`).join('')}
                </div>
                <p class="text-[9px] text-red-400 mt-2"><i class="fas fa-exclamation-triangle"></i> Atenção: Isso venderá todos os itens desequipados do rank selecionado se a loja estiver comprando.</p>
            </div>
        `;
        itemsHtml += massSellHtml;
    }

    container.innerHTML = itemsHtml;
}

window.processShopTransaction = async function(action, itemId, priceCopper, maxAvailable) {
    const qtyInput = document.getElementById(`qty-${action}-${itemId}`);
    if (!qtyInput) return;
    
    let qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0) return alert("Quantidade inválida.");
    if (qty > maxAvailable && action === 'buy' && maxAvailable !== -1) return alert("A loja não tem essa quantidade.");
    if (qty > maxAvailable && action === 'sell') return alert("Você não possui essa quantidade.");

    const totalPrice = priceCopper * qty;
    const charId = globalState.selectedCharacterId;
    const shopId = globalState.commerce.selectedShopId;

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const shopRef = doc(db, "rpg_shops", shopId);
            
            const [charSnap, shopSnap] = await Promise.all([t.get(charRef), t.get(shopRef)]);
            if (!charSnap.exists() || !shopSnap.exists()) throw "Dados não encontrados.";

            const charData = charSnap.data();
            const shopData = shopSnap.data();
            const mochila = charData.mochila || {};
            const wallet = getWallet(charData);

            if (action === 'buy') {
                if (wallet.total < totalPrice) throw "Cobre insuficiente.";
                
                let remaining = wallet.total - totalPrice;
                mochila[COINS.GOLD.id] = Math.floor(remaining / COINS.GOLD.val); remaining %= COINS.GOLD.val;
                mochila[COINS.SILVER.id] = Math.floor(remaining / COINS.SILVER.val); remaining %= COINS.SILVER.val;
                mochila[COINS.BRONZE.id] = remaining;

                Object.keys(COINS).forEach(k => { if(mochila[COINS[k].id] === 0) delete mochila[COINS[k].id]; });

                mochila[itemId] = (mochila[itemId] || 0) + qty;

                const itemIndex = shopData.itemsToSell.findIndex(i => i.itemId === itemId);
                if (itemIndex > -1 && shopData.itemsToSell[itemIndex].stock !== -1) {
                    shopData.itemsToSell[itemIndex].stock -= qty;
                }

            } else {
                if ((mochila[itemId] || 0) < qty) throw "Item insuficiente.";
                
                mochila[itemId] -= qty;
                if (mochila[itemId] <= 0) delete mochila[itemId];

                let remaining = wallet.total + totalPrice;
                mochila[COINS.GOLD.id] = Math.floor(remaining / COINS.GOLD.val); remaining %= COINS.GOLD.val;
                mochila[COINS.SILVER.id] = Math.floor(remaining / COINS.SILVER.val); remaining %= COINS.SILVER.val;
                mochila[COINS.BRONZE.id] = remaining;
                
                Object.keys(COINS).forEach(k => { if(mochila[COINS[k].id] === 0) delete mochila[COINS[k].id]; });
            }

            t.update(charRef, { mochila: mochila });
            if (action === 'buy') t.update(shopRef, { itemsToSell: shopData.itemsToSell });
        });
        
        renderWalletDisplay(); // Atualiza a carteira local sem recarregar tudo
    } catch (e) {
        alert("Erro na transação: " + e);
    }
};

window.sellAllByRank = async function(targetRank) {
    if (!confirm(`Deseja vender TODOS os itens de rank ${targetRank} da sua mochila para esta loja? (Apenas os que a loja compra serão vendidos)`)) return;

    const charId = globalState.selectedCharacterId;
    const shopId = globalState.commerce.selectedShopId;
    const shopData = globalState.commerce.liveShopData;

    if (!shopData || !shopData.itemsToBuy || shopData.itemsToBuy.length === 0) return alert("Esta loja não está comprando nada.");

    try {
        await runTransaction(db, async (t) => {
            const charRef = doc(db, "rpg_fichas", charId);
            const charSnap = await t.get(charRef);
            const charData = charSnap.data();
            const mochila = charData.mochila || {};
            const equipadosIds = new Set(Object.values(charData.equipamento || charData.equipamentos || {}).filter(Boolean));
            
            let totalProfitCopper = 0;
            let itemsSold = 0;

            const itemsToBuyMap = new Map();
            shopData.itemsToBuy.forEach(i => itemsToBuyMap.set(i.itemId, i.priceCopper));

            Object.keys(mochila).forEach(itemId => {
                if (equipadosIds.has(itemId)) return;
                
                const itemInfo = globalState.cache.itens.get(itemId);
                if (!itemInfo) return;

                const configInfo = (globalState.cache.itemConfig) ? globalState.cache.itemConfig.get(itemId) : null;
                const rank = (itemInfo.tierId || itemInfo.tier || itemInfo.rank || (configInfo ? configInfo.tierId : null) || "F").toUpperCase();

                if (rank === targetRank && itemsToBuyMap.has(itemId)) {
                    const priceUnit = itemsToBuyMap.get(itemId);
                    const qty = mochila[itemId];
                    totalProfitCopper += (priceUnit * qty);
                    itemsSold += qty;
                    delete mochila[itemId];
                }
            });

            if (itemsSold === 0) throw "Nenhum item do rank especificado que a loja aceite foi encontrado.";

            const wallet = getWallet(charData);
            let remaining = wallet.total + totalProfitCopper;
            
            mochila[COINS.GOLD.id] = Math.floor(remaining / COINS.GOLD.val); remaining %= COINS.GOLD.val;
            mochila[COINS.SILVER.id] = Math.floor(remaining / COINS.SILVER.val); remaining %= COINS.SILVER.val;
            mochila[COINS.BRONZE.id] = remaining;
            
            Object.keys(COINS).forEach(k => { if(mochila[COINS[k].id] === 0) delete mochila[COINS[k].id]; });

            t.update(charRef, { mochila: mochila });
        });
        
        renderWalletDisplay();
        alert("Venda em massa concluída com sucesso!");
    } catch (e) {
        alert(e);
    }
};

function renderWalletDisplay() {
    const container = document.getElementById('comercio-wallet-display');
    if (!container) return;

    const ficha = globalState.selectedCharacterData?.ficha;
    if (!ficha) return;

    const wallet = getWallet(ficha);

    const makeCoinBox = (val, iconId, colorClass, borderClass, bgClass, name) => `
        <div class="flex items-center justify-between ${bgClass} border ${borderClass} rounded-lg p-3 shadow-sm">
            <div class="flex items-center gap-3">
                <img src="${getCoinImg(iconId)}" class="w-8 h-8 rounded-full border ${borderClass} bg-black shadow-inner">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">${name}</span>
            </div>
            <span class="text-2xl font-cinzel font-bold ${colorClass}">${val}</span>
        </div>
    `;

    container.innerHTML = `
        ${makeCoinBox(wallet.gold, COINS.GOLD.id, 'text-amber-400', 'border-amber-500/50', 'bg-amber-900/10', 'Ouro')}
        ${makeCoinBox(wallet.silver, COINS.SILVER.id, 'text-slate-300', 'border-slate-400/50', 'bg-slate-800/50', 'Prata')}
        ${makeCoinBox(wallet.bronze, COINS.BRONZE.id, 'text-amber-700', 'border-amber-800/50', 'bg-amber-950/30', 'Cobre')}
    `;
}

function renderExchangePanel() {
    const container = document.getElementById('comercio-exchange-display');
    if (!container) return;

    const makeExchangeRow = (type, upperCoin, lowerCoin, rate) => {
        const dir = globalState.commerce.exchange[type].dir;
        const val = globalState.commerce.exchange[type].val;
        
        const isDown = dir === 'down';
        const srcIconId = isDown ? upperCoin.id : lowerCoin.id;
        const destIconId = isDown ? lowerCoin.id : upperCoin.id;
        const resultVal = isDown ? (val * rate) : Math.floor(val / rate);

        return `
            <div class="bg-slate-900 p-3 rounded-lg border border-slate-700 shadow-inner flex flex-col gap-3">
                <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase border-b border-slate-800 pb-1">
                    <span>${upperCoin.name} <i class="fas fa-arrows-alt-h mx-1 text-slate-600"></i> ${lowerCoin.name}</span>
                    <span class="text-sky-400 font-mono">Taxa: 1 = ${rate}</span>
                </div>
                
                <div class="flex items-center gap-2">
                    <button onclick="window.toggleExchangeDir('${type}')" class="btn bg-slate-800 border-slate-600 text-slate-300 px-3 py-2 shrink-0 shadow-md hover:bg-slate-700 transition" title="Inverter Troca">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                    
                    <div class="flex-grow flex items-center bg-slate-950 border border-slate-700 rounded p-1">
                        <img src="${getCoinImg(srcIconId)}" class="w-6 h-6 rounded-full mx-2 border border-slate-600 shrink-0">
                        <input type="number" value="${val}" min="1" onchange="window.updateExchangeVal('${type}', this.value)" class="w-full bg-transparent text-white font-bold text-center outline-none">
                    </div>
                    
                    <div class="text-slate-500"><i class="fas fa-arrow-right"></i></div>
                    
                    <div class="flex-grow flex items-center bg-slate-950 border border-slate-700 rounded p-1 opacity-80">
                        <img src="${getCoinImg(destIconId)}" class="w-6 h-6 rounded-full mx-2 border border-slate-600 shrink-0">
                        <div class="w-full text-center text-sky-400 font-bold">${resultVal}</div>
                    </div>
                </div>
                
                <button onclick="window.executeExchange('${type}')" class="btn btn-primary w-full py-2 text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                    Realizar Câmbio
                </button>
            </div>
        `;
    };

    container.innerHTML = `
        ${makeExchangeRow('gold_silver', COINS.GOLD, COINS.SILVER, 10)}
        ${makeExchangeRow('silver_bronze', COINS.SILVER, COINS.BRONZE, 10)}
        ${makeExchangeRow('gold_bronze', COINS.GOLD, COINS.BRONZE, 100)}
    `;
}

window.toggleExchangeDir = function(type) {
    globalState.commerce.exchange[type].dir = globalState.commerce.exchange[type].dir === 'down' ? 'up' : 'down';
    renderExchangePanel();
};

window.updateExchangeVal = function(type, val) {
    let num = parseInt(val);
    if(isNaN(num) || num < 1) num = 1;
    globalState.commerce.exchange[type].val = num;
    renderExchangePanel();
};

window.executeExchange = async function(type) {
    const charId = globalState.selectedCharacterId;
    const exData = globalState.commerce.exchange[type];
    
    let upperCoin, lowerCoin, rate;
    if (type === 'gold_silver') { upperCoin = COINS.GOLD; lowerCoin = COINS.SILVER; rate = 10; }
    else if (type === 'silver_bronze') { upperCoin = COINS.SILVER; lowerCoin = COINS.BRONZE; rate = 10; }
    else { upperCoin = COINS.GOLD; lowerCoin = COINS.BRONZE; rate = 100; }

    const isDown = exData.dir === 'down';
    const srcId = isDown ? upperCoin.id : lowerCoin.id;
    const destId = isDown ? lowerCoin.id : upperCoin.id;
    const srcName = isDown ? upperCoin.name : lowerCoin.name;
    const costVal = exData.val;
    const gainVal = isDown ? (costVal * rate) : Math.floor(costVal / rate);

    if (gainVal <= 0) return alert("Quantidade insuficiente para gerar câmbio.");

    try {
        await runTransaction(db, async (t) => {
            const ref = doc(db, "rpg_fichas", charId);
            const d = (await t.get(ref)).data();
            const mochila = d.mochila || {};

            if ((mochila[srcId] || 0) < costVal) throw `Você não tem ${costVal} ${srcName}.`;

            mochila[srcId] -= costVal;
            if (mochila[srcId] <= 0) delete mochila[srcId];

            mochila[destId] = (mochila[destId] || 0) + gainVal;

            t.update(ref, { mochila: mochila });
        });
        renderWalletDisplay();
    } catch (e) { alert("Erro de Câmbio: " + e); }
};
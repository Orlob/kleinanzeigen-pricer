// Hauptfunktion zum Scrapen der eBay Kleinanzeigen Seite
async function scrapeEbayKleinanzeigen(url) {
    try {
        // Kodiere die URL korrekt für den API-Aufruf
        const encodedUrl = encodeURIComponent(url);
        const apiUrl = `https://n8n.simonorlob.de/webhook/b54650cc-3b40-44e0-912c-4b6d8729a8b7?url=${encodedUrl}`;
        
        console.log('Rufe API auf:', apiUrl); // Debug-Log
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error('Fehler beim Laden der Daten vom API-Endpunkt');
        }

        const data = await response.json();
        console.log('API Antwort:', data); // Debug-Log
        
        if (!data.listings || data.listings.length === 0) {
            throw new Error('Keine Anzeigen gefunden');
        }

        // Konvertiere die Preise in Zahlen und filtere ungültige Preise aus
        const listings = data.listings
            .map(listing => ({
                ...listing,
                price: parsePrice(listing.price),
                url: listing.url ? `https://www.kleinanzeigen.de${listing.url}` : null
            }))
            .filter(listing => listing.price !== null);

        if (listings.length === 0) {
            throw new Error('Keine Anzeigen mit gültigen Preisen gefunden');
        }

        return listings;
    } catch (error) {
        console.error('Fehler beim Scraping:', error);
        throw error;
    }
}

// Hilfsfunktion zum Parsen des Preises
function parsePrice(priceText) {
    if (!priceText || priceText === 'VB') return null;
    
    // Entferne "VB" und "€" und trimme Whitespace
    const cleanPrice = priceText.replace('VB', '').replace('€', '').trim();
    const match = cleanPrice.match(/\d+([.,]\d+)?/);
    
    if (match) {
        // Konvertiere den Preis in eine Zahl
        return parseFloat(match[0].replace(',', '.'));
    }
    return null;
}

// Hilfsfunktion zum Formatieren des Alters
function getDays(creationDate) {
    if (!creationDate) return null;
    
    const text = creationDate.toLowerCase();
    if (text.includes('heute')) return 0;
    if (text.includes('gestern')) return 1;
    
    const [day, month, year] = text.split('.').map(num => parseInt(num, 10));
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Math.ceil(Math.abs(today - date) / (1000 * 60 * 60 * 24));
}

function getAge(creationDate) {
    const days = getDays(creationDate);
    if (days === null) return null;
    return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

// Event Listener für das Formular
document.getElementById('urlForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const urlInput = document.getElementById('ebayUrl');
    const loadingElement = document.getElementById('loading');
    const resultsElement = document.getElementById('results');
    
    // Zeige Ladeanimation
    loadingElement.classList.remove('hidden');
    resultsElement.classList.add('hidden');
    
    try {
        const listings = await scrapeEbayKleinanzeigen(urlInput.value);
        
        // Berechne Statistiken
        const prices = listings.map(listing => listing.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        // Aktualisiere UI
        document.getElementById('avgPrice').textContent = `${avgPrice.toFixed(2)} €`;
        document.getElementById('minPrice').textContent = `${minPrice.toFixed(2)} €`;
        document.getElementById('maxPrice').textContent = `${maxPrice.toFixed(2)} €`;
        document.getElementById('listingCount').textContent = listings.length;
        
        // Aktualisiere Diagramm
        updateChart(prices);
        
        // Zeige Anzeigenliste
        displayListings(listings);
        
        // Zeige Ergebnisse
        resultsElement.classList.remove('hidden');
    } catch (error) {
        alert('Fehler beim Laden der Daten: ' + error.message);
    } finally {
        loadingElement.classList.add('hidden');
    }
});

// Funktion zum Anzeigen der Listings
function displayListings(listings) {
    const listingsContainer = document.getElementById('listingsList');
    listingsContainer.innerHTML = '';
    
    // Sortiere Listings nach Preis
    listings.sort((a, b) => a.price - b.price);
    
    listings.forEach((listing, index) => {
        const listingElement = document.createElement('div');
        listingElement.className = 'bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors p-2';
        
        // Berechne Preisabweichung vom Durchschnitt
        const avgPrice = listings.reduce((sum, l) => sum + l.price, 0) / listings.length;
        const priceDeviation = ((listing.price - avgPrice) / avgPrice * 100).toFixed(1);
        const deviationClass = priceDeviation > 0 ? 'text-red-500' : 'text-green-500';
        
        const content = `
            <div class="flex items-center gap-4">
                ${listing.img ? `
                    <div class="relative group">
                        <div class="w-16 h-16 overflow-hidden rounded-lg shadow-sm flex items-center justify-center bg-gray-50">
                            <img src="${listing.img}" 
                                 alt="${listing.title}" 
                                 class="h-full w-full object-contain"
                                 loading="lazy">
                        </div>
                        <div class="hidden group-hover:block absolute z-50 left-0 top-0 -translate-y-2 transform">
                            <div class="w-64 h-64 overflow-hidden rounded-lg shadow-lg border-2 border-white bg-white">
                                <img src="${listing.img}" 
                                     alt="${listing.title}" 
                                     class="h-full w-full object-contain"
                                     loading="lazy">
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="flex-grow min-w-0">
                    <${listing.url ? `a href="${listing.url}" target="_blank" class="hover:text-blue-600 group block"` : 'div'}>
                        <div class="flex items-center justify-between">
                            <h3 class="font-medium truncate ${listing.url ? 'group-hover:text-blue-600 transition-colors' : ''}">${listing.title}</h3>
                            <div class="flex items-center gap-2 ml-2">
                                <span class="text-sm ${deviationClass} whitespace-nowrap">
                                    ${priceDeviation > 0 ? '+' : ''}${priceDeviation}%
                                </span>
                                <span class="text-xs text-gray-500 whitespace-nowrap">
                                    ${getAge(listing.creationDate)}
                                </span>
                            </div>
                        </div>
                    </${listing.url ? 'a' : 'div'}>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-bold text-gray-800 whitespace-nowrap">${listing.price.toFixed(2)} €</span>
                    ${listing.url ? `
                        <a href="${listing.url}" 
                           target="_blank" 
                           class="text-gray-400 hover:text-blue-600 transition-colors"
                           title="Anzeige öffnen">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
        
        listingElement.innerHTML = content;
        listingsContainer.appendChild(listingElement);
    });

    // Aktualisiere das Altersdiagramm
    updateAgeChart(listings.map(l => getDays(l.creationDate)));

    // Aktualisiere das Korrelations-Diagramm
    updateCorrelationChart(listings);
} 
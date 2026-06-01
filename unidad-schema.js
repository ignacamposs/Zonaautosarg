document.addEventListener('DOMContentLoaded', () => {
    const nameEl = document.getElementById('car-name');
    if (!nameEl) return;

    const name = nameEl.textContent.trim();
    const year = document.getElementById('car-year')?.textContent.trim() || '';
    const km = parseInt((document.getElementById('car-km')?.textContent.trim() || '0').replace(/\./g, '')) || 0;
    const priceText = document.getElementById('car-price')?.textContent.trim() || '';
    const price = (priceText === 'Consultar') ? null : parseInt(priceText.replace(/\./g, '')) || null;
    const imgSrc = document.getElementById('main-img')?.src || '';
    const brand = name.split(' ')[0];

    const schema = {
        "@context": "https://schema.org",
        "@type": "Car",
        "name": `${name} ${year}`,
        "brand": { "@type": "Brand", "name": brand },
        "vehicleModelDate": year,
        "mileageFromOdometer": { "@type": "QuantitativeValue", "value": km, "unitCode": "KMT" },
        "image": imgSrc,
        "offers": {
            "@type": "Offer",
            "availability": "https://schema.org/InStock",
            "seller": {
                "@type": "AutoDealer",
                "name": "Zona Autos",
                "address": "Vice Almte. O'Connor 820, Bariloche, Argentina",
                "telephone": "+54-2944-38-8443",
                "url": "https://zonaautosarg.com"
            }
        }
    };

    if (price) {
        schema.offers.price = price;
        schema.offers.priceCurrency = "ARS";
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
});

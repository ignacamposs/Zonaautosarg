// ==========================================
// 1. VARIABLES GLOBALES Y ESTADO
// ==========================================
let todosLosAutos = []; 

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DEL MENÚ MOBILE ---
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
        });

        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('flex');
            }
        });
    }

    // --- LÓGICA DEL BUSCADOR DEL HERO ---
    const searchBtn = document.querySelector('section button'); 
    const searchInput = document.querySelector('section input'); 
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const valor = searchInput.value.trim();
            window.location.href = valor !== "" ? `catalogo.html?marca=${encodeURIComponent(valor)}` : `catalogo.html`;
        });
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
    }

    // --- CARGA DE DATOS ---
    if (document.getElementById('contenedor-catalogo') || 
        document.getElementById('contenedor-0km') || 
        document.getElementById('contenedor-destacados')) {
        cargarDatosYRenderizar();
    }

    if (document.getElementById('car-name')) {
        cargarDetalleProducto();
    }
});

// ==========================================
// 2. MOTOR DE DATOS
// ==========================================

async function cargarDatosYRenderizar() {
    try {
        const respuesta = await fetch('autos.json');
        if (!respuesta.ok) throw new Error("No se pudo cargar el JSON");
        todosLosAutos = await respuesta.json();

        // 1. HOME: Destacados
        const contenedorHome = document.getElementById('contenedor-destacados');
        if (contenedorHome) {
            renderizarTarjetas(todosLosAutos.slice(0, 4), 'contenedor-destacados');
        }

        // 2. CATÁLOGO
        const contenedorCat = document.getElementById('contenedor-catalogo');
        if (contenedorCat) {
            const params = new URLSearchParams(window.location.search);
            const marcaFiltro = params.get('marca');
            
            let filtrados = todosLosAutos.filter(a => a.km > 0); 
            
            if (marcaFiltro) {
                filtrados = filtrados.filter(a => a.marca.toLowerCase() === marcaFiltro.toLowerCase());
                const selectMarca = document.getElementById('filtro-marca');
                if (selectMarca) selectMarca.value = marcaFiltro;
            }
            renderizarTarjetas(filtrados, 'contenedor-catalogo');
            
            const btnFiltroLateral = document.querySelector('aside button');
            if (btnFiltroLateral) btnFiltroLateral.onclick = aplicarFiltrosLaterales;
        }

        // 3. 0KM
        if (document.getElementById('contenedor-0km')) {
            const nuevos = todosLosAutos.filter(a => a.km === 0);
            renderizarTarjetas(nuevos, 'contenedor-0km');
        }

    } catch (error) { console.error("Error cargando autos:", error); }
}

// Función corregida para Safari/iPhone
function renderizarTarjetas(lista, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    
    contenedor.innerHTML = lista.length === 0 
        ? `<p class="col-span-full text-center text-gray-400 py-10 uppercase tracking-widest">No hay unidades disponibles</p>` 
        : '';

    lista.forEach((auto) => {
    const es0km = auto.km === 0;
    const img2 = auto.imagenes[1] ? auto.imagenes[1] : auto.imagenes[0];

    // --- NUEVA LÓGICA DE PRECIO ---
    // Si el precio es 0, mostramos "Consultar", si no, el precio con formato
    const precioMostrar = auto.precio === 0 
        ? "Consultar" 
        : `USD ${auto.precio.toLocaleString()}`;

    contenedor.innerHTML += `
        <article 
            onclick="window.location.href='autos-detalles.html?id=${auto.id}'" 
            class="group bg-[#1E1E1E] border-2 border-[#333333] rounded-3xl overflow-hidden shadow-md flex flex-col h-full hover:border-red-600 cursor-pointer mb-6"
        >
            <div class="relative w-full overflow-hidden" style="height: 240px; min-height: 240px;">
                <img src="${auto.imagenes[0]}" 
                    class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-0"
                    style="display: block; width: 100%; height: 100%; object-fit: cover;">
                
                <img src="${img2}" 
                    class="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110"
                    style="display: block; width: 100%; height: 100%; object-fit: cover;">

                <div class="absolute top-4 right-4 z-10 ${es0km ? 'bg-black' : 'bg-red-600'} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                    ${es0km ? '0 KM' : 'Usado'}
                </div>
            </div>

            <div class="p-5 flex flex-col justify-between flex-grow">
                <div>
                    <span class="text-white/50 text-[10px] font-black uppercase tracking-tighter">${auto.marca}</span>
                    <h3 class="text-xl font-bold text-white leading-tight uppercase italic mb-2">${auto.modelo}</h3>
                    <div class="flex gap-4 text-[11px] text-[#B0B0B0] font-semibold mb-4">
                        <span>📅 ${auto.anio}</span>
                        <span>${es0km ? '✨ Nuevo' : '🚀 ' + auto.km.toLocaleString() + ' KM'}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-3">
                    <span class="text-2xl font-black text-white tracking-tighter uppercase">${precioMostrar}</span>
                    
                    <div class="w-full text-center ${es0km ? 'bg-white text-black' : 'bg-[#333333] text-white'} group-hover:bg-red-600 group-hover:text-white py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest">
                        Ver Ficha Técnica
                    </div>
                </div>
            </div>
        </article>`;
});
}

function aplicarFiltrosLaterales() {
    const marca = document.getElementById('filtro-marca').value;
    const precioMax = document.getElementById('filtro-precio').value;
    let filtrados = todosLosAutos.filter(a => a.km > 0);

    if (marca) filtrados = filtrados.filter(a => a.marca === marca);
    if (precioMax) filtrados = filtrados.filter(a => a.precio <= parseInt(precioMax));

    renderizarTarjetas(filtrados, 'contenedor-catalogo');
}

// ==========================================
// 3. FICHA TÉCNICA
// ==========================================

let carImages = [];
let currentImageIndex = 0;

async function cargarDetalleProducto() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    try {
        const respuesta = await fetch('autos.json');
        const autos = await respuesta.json();
        const auto = autos.find(a => a.id == parseInt(id));

        if (auto) {
            carImages = auto.imagenes;
            document.getElementById('car-name').innerText = `${auto.marca} ${auto.modelo}`;
            const precioFinal = auto.precio === 0 ? "Consultar" : auto.precio.toLocaleString();
            document.getElementById('car-price').innerText = precioFinal;
            const monedaLabel = document.getElementById('currency-label'); // Si tenés el span de "USD"
            if(monedaLabel) {
                monedaLabel.style.display = auto.precio === 0 ? 'none' : 'inline';}            
            document.getElementById('car-year').innerText = auto.anio;
            document.getElementById('car-km').innerText = auto.km.toLocaleString();
            document.getElementById('car-transmision').innerText = auto.transmision;
            document.getElementById('car-description').innerText = auto.descripcion || "Consultar por más detalles de esta unidad.";
            document.getElementById('main-img').src = carImages[0];

            const contenedorThumbs = document.getElementById('contenedor-thumbs');
            if (contenedorThumbs) {
                contenedorThumbs.innerHTML = ''; 
                carImages.forEach((imgUrl, index) => {
                    contenedorThumbs.innerHTML += `
                        <img src="${imgUrl}" onclick="changeImage(this.src)" 
                             class="thumb w-24 h-24 flex-shrink-0 rounded-xl object-cover cursor-pointer border-2 ${index === 0 ? 'border-orange-600 opacity-100' : 'border-transparent opacity-50'} hover:opacity-100 transition-all">
                    `;
                });
            }
        }
    } catch (e) { console.error("Error cargando detalle:", e); }
}

function changeImage(src) {
    const mainImg = document.getElementById('main-img');
    const thumbs = document.querySelectorAll('.thumb');
    if(!mainImg) return;
    
    mainImg.style.opacity = '0';
    setTimeout(() => { 
        mainImg.src = src; 
        mainImg.style.opacity = '1'; 
        const index = carImages.findIndex(img => src.includes(img));
        if (index !== -1) currentImageIndex = index;
    }, 200);

    thumbs.forEach(t => {
        if (src.includes(t.getAttribute('src'))) {
            t.classList.add('border-orange-600', 'opacity-100');
            t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            t.classList.remove('border-orange-600', 'opacity-100');
        }
    });
}

function nextPrev(delta) {
    if (carImages.length === 0) return;
    currentImageIndex += delta;
    if (currentImageIndex >= carImages.length) currentImageIndex = 0;
    if (currentImageIndex < 0) currentImageIndex = carImages.length - 1;
    changeImage(carImages[currentImageIndex]);
}

function sendWhatsApp() {
    const carNameElement = document.getElementById('car-name');
    if (!carNameElement) return;
    const carName = carNameElement.innerText;

    // --- EVENTO DE ANALYTICS ---
    // Esto le avisa a Google que alguien hizo clic en contactar por un auto específico
    if (typeof gtag === 'function') {
        gtag('event', 'contact_whatsapp', {
            'item_name': carName,
            'event_category': 'Engagement'
        });
    }

    window.open(`https://wa.me/542944388443?text=${encodeURIComponent('Hola Zona Autos! Me interesa el ' + carName + ' que vi en la web.')}`, '_blank');
}
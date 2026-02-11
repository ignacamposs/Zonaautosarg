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

    // --- LÓGICA DEL BUSCADOR DEL HERO (Buscador Blanco) ---
    // Buscamos el botón "BUSCAR" y el input de marca dentro de la sección Hero
    const searchBtn = document.querySelector('section button'); 
    const searchInput = document.querySelector('section input'); 
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const valor = searchInput.value.trim();
            // Si el usuario escribe algo, lo mandamos al catálogo con el filtro
            window.location.href = valor !== "" ? `catalogo.html?marca=${encodeURIComponent(valor)}` : `catalogo.html`;
        });
        // También funciona al apretar Enter
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

        // 1. HOME: Llenar el contenedor de destacados automáticamente
        const contenedorHome = document.getElementById('contenedor-destacados');
        if (contenedorHome) {
            // Mostramos los primeros 4 del JSON para la Home
            renderizarTarjetas(todosLosAutos.slice(0, 4), 'contenedor-destacados');
        }

        // 2. CATÁLOGO: Filtrar usados y revisar si viene marca del Hero
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
            
            // Conectar botón lateral de filtros
            const btnFiltroLateral = document.querySelector('aside button');
            if (btnFiltroLateral) btnFiltroLateral.onclick = aplicarFiltrosLaterales;
        }

        // 3. 0KM: Solo km = 0
        if (document.getElementById('contenedor-0km')) {
            const nuevos = todosLosAutos.filter(a => a.km === 0);
            renderizarTarjetas(nuevos, 'contenedor-0km');
        }

    } catch (error) { console.error("Error cargando autos:", error); }
}

// Función que crea las tarjetas con la imagen grande (H-72)
function renderizarTarjetas(lista, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    
    contenedor.innerHTML = lista.length === 0 
        ? `<p class="col-span-full text-center text-gray-400 py-10 uppercase tracking-widest">No hay unidades disponibles</p>` 
        : '';

    lista.forEach(auto => {
        const es0km = auto.km === 0;
        contenedor.innerHTML += `
            <article class="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                <div class="relative h-72 overflow-hidden">
                    <img src="${auto.imagenes[0]}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute top-4 right-4 ${es0km ? 'bg-black' : 'bg-red-600'} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                        ${es0km ? '0 KM' : 'Usado'}
                    </div>
                </div>
                <div class="p-5 flex flex-col justify-between flex-grow">
                    <div>
                        <span class="text-orange-600 text-[10px] font-black uppercase tracking-tighter">${auto.marca}</span>
                        <h3 class="text-xl font-bold text-gray-900 leading-tight uppercase italic mb-2">${auto.modelo}</h3>
                        <div class="flex gap-4 text-[11px] text-gray-400 font-semibold mb-4">
                            <span>📅 ${auto.anio}</span>
                            <span>${es0km ? '✨ Nuevo' : '🚀 ' + auto.km.toLocaleString() + ' KM'}</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-3">
                        <span class="text-2xl font-black text-gray-900 tracking-tighter">USD ${auto.precio.toLocaleString()}</span>
                        <button onclick="window.location.href='autos-detalles.html?id=${auto.id}'"
                            class="w-full ${es0km ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 hover:bg-red-600 hover:text-white'} py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest">
                            Ver Ficha Técnica
                        </button>
                    </div>
                </div>
            </article>`;
    });
}

// Filtros de la barra lateral (Catálogo)
function aplicarFiltrosLaterales() {
    const marca = document.getElementById('filtro-marca').value;
    const precioMax = document.getElementById('filtro-precio').value;
    let filtrados = todosLosAutos.filter(a => a.km > 0);

    if (marca) filtrados = filtrados.filter(a => a.marca === marca);
    if (precioMax) filtrados = filtrados.filter(a => a.precio <= parseInt(precioMax));

    renderizarTarjetas(filtrados, 'contenedor-catalogo');
}

// ==========================================
// 3. FICHA TÉCNICA (Galería y WhatsApp)
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
            document.getElementById('car-price').innerText = auto.precio.toLocaleString();
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
    const carName = document.getElementById('car-name').innerText;
    window.open(`https://wa.me/542944388443?text=${encodeURIComponent('Hola Zona Autos! Me interesa el ' + carName + ' que vi en la web.')}`, '_blank');
}

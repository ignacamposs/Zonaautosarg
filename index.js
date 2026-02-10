// ==========================================
// 1. VARIABLES GLOBALES Y ESTADO
// ==========================================
let currentImageIndex = 0;
let carImages = [];

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

    // --- DETECCIÓN DE PÁGINA ---
    if (document.getElementById('contenedor-catalogo')) {
        cargarCatalogo();
    }
    if (document.getElementById('car-name')) {
        cargarDetalleProducto();
    }
    if (document.getElementById('contenedor-0km')) {
        cargar0km();
    }
});

// Navegación por teclado
document.addEventListener('keydown', (e) => {
    if (document.getElementById('car-name')) {
        if (e.key === "ArrowRight") nextPrev(1);
        if (e.key === "ArrowLeft") nextPrev(-1);
    }
});

// ==========================================
// 2. FUNCIONES DE CARGA DE DATOS
// ==========================================

async function cargarCatalogo() {
    try {
        const respuesta = await fetch('autos.json'); 
        if (!respuesta.ok) throw new Error("No se encontró el JSON");
        
        const autos = await respuesta.json();
        const contenedor = document.getElementById('contenedor-catalogo');
        if (!contenedor) return;

        contenedor.innerHTML = ''; 
        autos.forEach(auto => {
            const portada = auto.imagenes ? auto.imagenes[0] : "img/placeholder.jpg";
            
            contenedor.innerHTML += `
                <article class="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                    <div class="relative h-72 overflow-hidden">
                        <img src="${portada}" alt="${auto.modelo}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                        
                        <div class="absolute top-4 right-4 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                            ${auto.anio >= 2024 ? 'Nuevo' : 'Usado'}
                        </div>
                    </div>

                    <div class="p-4 flex flex-col justify-between flex-grow">
                        <div>
                            <span class="text-orange-600 text-[10px] font-black uppercase tracking-tighter">${auto.marca}</span>
                            <h3 class="text-lg font-bold text-gray-900 leading-tight uppercase italic mb-2">${auto.modelo}</h3>
                            
                            <div class="flex gap-4 text-[11px] text-gray-400 font-semibold mb-4">
                                <span>📅 ${auto.anio}</span>
                                <span>🚀 ${auto.km.toLocaleString()} KM</span>
                            </div>
                        </div>

                        <div class="flex flex-col gap-3">
                            <div class="flex items-baseline gap-1">
                                <span class="text-xs font-bold text-gray-400">USD</span>
                                <span class="text-2xl font-black text-gray-900 tracking-tighter">${auto.precio.toLocaleString()}</span>
                            </div>
                            
                            <button 
                                onclick="window.location.href='autos-detalles.html?id=${auto.id}'"
                                class="w-full bg-gray-50 hover:bg-red-600 hover:text-white text-gray-800 py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest border border-gray-100 group-hover:border-transparent"
                            >
                                Ver Ficha Técnica
                            </button>
                        </div>
                    </div>
                </article>`;
        });
    } catch (error) {
        console.error("Error en Catálogo:", error);
    }
}

async function cargarDetalleProducto() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    try {
        const respuesta = await fetch('autos.json'); // Ambos están en la raíz ahora
        if (!respuesta.ok) throw new Error("No se encontró el JSON");
        
        const autos = await respuesta.json();
        const auto = autos.find(a => a.id == parseInt(id));

        if (auto) {
            carImages = auto.imagenes;
            currentImageIndex = 0;

            document.getElementById('car-name').innerText = `${auto.marca} ${auto.modelo}`;
            document.getElementById('car-price').innerText = auto.precio.toLocaleString();
            document.getElementById('car-year').innerText = auto.anio;
            document.getElementById('car-km').innerText = auto.km.toLocaleString();
            document.getElementById('car-transmision').innerText = auto.transmision;

            // La imagen NO lleva ../ porque detalles.html está en la raíz
            document.getElementById('main-img').src = carImages[0];

            const contenedorThumbs = document.getElementById('contenedor-thumbs');
            if (contenedorThumbs) {
                contenedorThumbs.innerHTML = ''; 
                carImages.forEach((imgUrl, index) => {
                    contenedorThumbs.innerHTML += `
                        <img src="${imgUrl}" 
                             onclick="changeImage(this.src)" 
                             class="thumb w-24 h-24 flex-shrink-0 rounded-xl object-cover cursor-pointer border-2 ${index === 0 ? 'border-orange-600 opacity-100' : 'border-transparent opacity-50'} hover:opacity-100 transition-all">
                    `;
                });
            }
        }
    } catch (error) {
        console.error("Error al cargar el producto:", error);
    }
}

// ==========================================
// 3. UTILIDADES (GALERÍA Y WHATSAPP)
// ==========================================

function changeImage(src) {
    const mainImg = document.getElementById('main-img');
    const thumbs = document.querySelectorAll('.thumb');

    mainImg.style.opacity = '0';
    setTimeout(() => {
        mainImg.src = src;
        mainImg.style.opacity = '1';
    }, 200);

    thumbs.forEach(thumb => {
        const thumbSrc = thumb.getAttribute('src');
        if (src.includes(thumbSrc)) {
            thumb.classList.add('border-orange-600', 'opacity-100');
            thumb.classList.remove('border-transparent', 'opacity-50');
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            
            const index = carImages.findIndex(img => src.includes(img));
            if (index !== -1) currentImageIndex = index;
        } else {
            thumb.classList.remove('border-orange-600', 'opacity-100');
            thumb.classList.add('border-transparent', 'opacity-50');
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
    const phoneNumber = "542944702059"; 
    const message = encodeURIComponent(`Hola Zona Autos! Me interesa el ${carName} que vi en la web. ¿Me darían más información?`);
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
}

// ==========================================
// 4. FUNCIÓN ESPECÍFICA PARA UNIDADES 0KM
// ==========================================

async function cargar0km() {
    try {
        const respuesta = await fetch('autos.json');
        if (!respuesta.ok) throw new Error("No se pudo cargar el JSON");
        
        const autos = await respuesta.json();
        const contenedor = document.getElementById('contenedor-0km');
        if (!contenedor) return;

        // FILTRO CLAVE: Solo mostramos autos que tengan km igual a 0
        const unidadesNuevas = autos.filter(auto => auto.km === 0);

        if (unidadesNuevas.length === 0) {
            contenedor.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">No hay unidades 0km disponibles en este momento.</p>`;
            return;
        }

        contenedor.innerHTML = ''; // Limpiamos el mensaje de "Buscando..."

        unidadesNuevas.forEach(auto => {
            const portada = auto.imagenes ? auto.imagenes[0] : "img/placeholder.jpg";
            
            contenedor.innerHTML += `
                <article class="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                    <div class="relative h-72 overflow-hidden">
                        <img src="${portada}" alt="${auto.modelo}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                        <div class="absolute top-4 right-4 bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                            Entrega Inmediata
                        </div>
                    </div>

                    <div class="p-4 flex flex-col justify-between flex-grow">
                        <div>
                            <span class="text-orange-600 text-[10px] font-black uppercase tracking-tighter">${auto.marca}</span>
                            <h3 class="text-lg font-bold text-gray-900 leading-tight uppercase italic mb-2">${auto.modelo}</h3>
                            <div class="flex gap-4 text-[11px] text-gray-400 font-semibold mb-4">
                                <span>📅 Año ${auto.anio}</span>
                                <span class="text-green-600">✨ Unidad 0 KM</span>
                            </div>
                        </div>

                        <div class="flex flex-col gap-3">
                            <div class="flex items-baseline gap-1">
                                <span class="text-xs font-bold text-gray-400">USD</span>
                                <span class="text-2xl font-black text-gray-900 tracking-tighter">${auto.precio.toLocaleString()}</span>
                            </div>
                            
                            <button 
                                onclick="window.location.href='autos-detalles.html?id=${auto.id}'"
                                class="w-full bg-black hover:bg-red-600 text-white py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest"
                            >
                                Consultar Bonificación
                            </button>
                        </div>
                    </div>
                </article>`;
        });
    } catch (error) {
        console.error("Error cargando unidades 0km:", error);
    }
}
// index.js - SOLO PARA HOME, CATÁLOGO Y 0KM

let todosLosAutos = [];

document.addEventListener('DOMContentLoaded', () => {
    // --- MENÚ MOBILE ---
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

    // --- BUSCADOR DEL HERO (Home) ---
    const searchBtn = document.querySelector('section button');
    const searchInput = document.querySelector('section input');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const valor = searchInput.value.trim();
            window.location.href = valor !== "" ? `catalogo.html?marca=${encodeURIComponent(valor)}` : `catalogo.html`;
        });
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
    }

    // --- ORDENAMIENTO (Catálogo) ---
    const selectOrden = document.getElementById('filtro-orden');
    if (selectOrden) {
        selectOrden.addEventListener('change', () => aplicarFiltrosLaterales());
    }

    // --- SKELETONS mientras carga ---
    if (document.getElementById('contenedor-catalogo'))  mostrarSkeletons('contenedor-catalogo', 6);
    if (document.getElementById('contenedor-0km'))       mostrarSkeletons('contenedor-0km', 4);
    if (document.getElementById('contenedor-destacados')) mostrarSkeletons('contenedor-destacados', 4);

    // --- CARGA DE DATOS ---
    if (document.getElementById('contenedor-catalogo') ||
        document.getElementById('contenedor-0km') ||
        document.getElementById('contenedor-destacados')) {
        cargarDatosYRenderizar();
    }
});

// --- SKELETON LOADER ---
function mostrarSkeletons(idContenedor, cantidad = 6) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    const card = `
        <div class="bg-[#1E1E1E] rounded-3xl overflow-hidden shadow-md flex flex-col mb-6">
            <div class="skeleton h-60 w-full"></div>
            <div class="p-5 flex flex-col gap-4">
                <div class="skeleton h-3 w-1/4 rounded-full"></div>
                <div class="skeleton h-6 w-3/4 rounded-full"></div>
                <div class="skeleton h-4 w-full rounded-full"></div>
                <div class="skeleton h-8 w-1/3 rounded-full mt-2"></div>
                <div class="skeleton h-12 w-full rounded-2xl"></div>
                <div class="skeleton h-12 w-full rounded-2xl"></div>
            </div>
        </div>`;
    contenedor.innerHTML = Array(cantidad).fill(card).join('');
}

// --- CARGA Y RENDERIZADO INICIAL ---
async function cargarDatosYRenderizar() {
    try {
        const respuesta = await fetch('autos.json');
        if (!respuesta.ok) throw new Error("No se pudo cargar el JSON");
        todosLosAutos = await respuesta.json();

        // HOME: Destacados
        if (document.getElementById('contenedor-destacados')) {
            renderizarTarjetas(todosLosAutos.slice(0, 4), 'contenedor-destacados');
        }

        // CATÁLOGO
        if (document.getElementById('contenedor-catalogo')) {
            const params = new URLSearchParams(window.location.search);
            const marcaFiltro = params.get('marca');

            let filtrados = todosLosAutos.filter(a => a.km > 0);

            if (marcaFiltro) {
                filtrados = filtrados.filter(a => a.marca.toLowerCase() === marcaFiltro.toLowerCase());
                const selectMarca = document.getElementById('filtro-marca');
                if (selectMarca) {
                    for (let option of selectMarca.options) {
                        if (option.value.toLowerCase() === marcaFiltro.toLowerCase()) {
                            selectMarca.value = option.value;
                            break;
                        }
                    }
                }
            }
            renderizarTarjetas(filtrados, 'contenedor-catalogo', marcaFiltro || '');
        }

        // 0KM
        if (document.getElementById('contenedor-0km')) {
            const nuevos = todosLosAutos.filter(a => a.km === 0);
            renderizarTarjetas(nuevos, 'contenedor-0km');
        }
    } catch (error) {
        console.error("Error cargando autos:", error);
    }
}

// --- FILTROS LATERALES + ORDENAMIENTO ---
window.aplicarFiltrosLaterales = function() {
    const elMarca = document.getElementById('filtro-marca');
    const elOrden = document.getElementById('filtro-orden');
    if (!elMarca) return;

    const marcaSeleccionada = elMarca.value;
    const ordenSeleccionado = elOrden ? elOrden.value : '';

    let filtrados = todosLosAutos.filter(a => a.km > 0);

    if (marcaSeleccionada !== "") {
        filtrados = filtrados.filter(a => a.marca === marcaSeleccionada);
    }

    if (ordenSeleccionado === 'precio-asc') {
        filtrados.sort((a, b) => {
            if (a.precio === 0 && b.precio === 0) return 0;
            if (a.precio === 0) return 1;
            if (b.precio === 0) return -1;
            return a.precio - b.precio;
        });
    } else if (ordenSeleccionado === 'precio-desc') {
        filtrados.sort((a, b) => {
            if (a.precio === 0 && b.precio === 0) return 0;
            if (a.precio === 0) return 1;
            if (b.precio === 0) return -1;
            return b.precio - a.precio;
        });
    } else if (ordenSeleccionado === 'anio-desc') {
        filtrados.sort((a, b) => b.anio - a.anio);
    } else if (ordenSeleccionado === 'km-asc') {
        filtrados.sort((a, b) => a.km - b.km);
    }

    renderizarTarjetas(filtrados, 'contenedor-catalogo', marcaSeleccionada);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- LIMPIAR FILTRO ACTIVO ---
window.limpiarFiltros = function() {
    const select = document.getElementById('filtro-marca');
    if (select) select.value = '';
    aplicarFiltrosLaterales();
};

// --- BARRA DE INFO: contador + filtro activo ---
function actualizarInfoFiltros(count, marcaActiva) {
    const infoDiv = document.getElementById('info-filtros');
    if (!infoDiv) return;

    const label = count === 1 ? 'resultado' : 'resultados';
    let html = `<span class="text-gray-400 text-sm">${count} ${label}</span>`;

    if (marcaActiva) {
        html += `
            <span class="flex items-center gap-2 bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                ${marcaActiva}
                <button onclick="limpiarFiltros()" class="hover:text-white transition-colors leading-none" title="Limpiar filtro">✕</button>
            </span>`;
    }

    infoDiv.innerHTML = html;
}

// --- RENDERIZADO DE TARJETAS ---
function renderizarTarjetas(lista, idContenedor, marcaActiva = '') {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    actualizarInfoFiltros(lista.length, marcaActiva);

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="col-span-full text-center text-gray-400 py-10 uppercase tracking-widest">No hay unidades disponibles</p>`;
        return;
    }

    contenedor.innerHTML = lista.map((auto, index) => {
        const es0km = auto.km === 0;
        const img2 = auto.imagenes[1] ? auto.imagenes[1] : auto.imagenes[0];
        const precioMostrar = auto.precio === 0 ? "Consultar" : `USD ${auto.precio.toLocaleString()}`;

        const marcaUrl = auto.marca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, '-');
        const modeloUrl = auto.modelo.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, '-');
        const urlFicha = `unidades/${marcaUrl}-${modeloUrl}.html`;

        const msgWA = encodeURIComponent(`Hola! Me interesa el ${auto.marca} ${auto.modelo} ${auto.anio}`);

        return `
            <article
                onclick="window.location.href='${urlFicha}'"
                style="animation: subir 0.5s ease-out ${index * 70}ms both"
                class="group bg-[#1E1E1E] border-2 border-transparent hover:border-red-600 rounded-3xl overflow-hidden shadow-md flex flex-col h-full cursor-pointer mb-6 transition-all duration-300"
            >
                <div class="relative w-full overflow-hidden h-60">
                    <img src="${auto.imagenes[0]}" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-0" loading="lazy">
                    <img src="${img2}" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" loading="lazy">
                    <div class="absolute top-4 right-4 z-10 ${es0km ? 'bg-black' : 'bg-red-600'} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                        ${es0km ? '0 KM' : 'Usado'}
                    </div>
                </div>

                <div class="p-5 flex flex-col justify-between flex-grow">
                    <div>
                        <span class="text-white/50 text-[10px] font-black uppercase tracking-tighter">${auto.marca}</span>
                        <h3 class="text-xl font-bold text-white leading-tight uppercase italic mb-2">${auto.modelo}</h3>
                        <div class="flex gap-4 text-sm text-[#B0B0B0] font-bold mb-4">
                            <span>📅 ${auto.anio}</span>
                            <span>${es0km ? '✨ Nuevo' : '🚀 ' + auto.km.toLocaleString() + ' KM'}</span>
                            <span>${auto.combustible === 'Diesel' ? '🛢️ Diesel' : '⛽ Nafta'}</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-3">
                        <span class="text-2xl font-black text-white tracking-tighter uppercase">${precioMostrar}</span>
                        <div class="w-full text-center ${es0km ? 'bg-white text-black' : 'bg-[#333333] text-white'} group-hover:bg-red-600 group-hover:text-white py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest">
                            Ver Ficha Técnica
                        </div>
                        <a
                            href="https://wa.me/542944388443?text=${msgWA}"
                            onclick="event.stopPropagation()"
                            target="_blank"
                            class="flex items-center justify-center gap-2 w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-2xl font-bold transition-all duration-300 uppercase text-[10px] tracking-widest"
                        >
                            <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Consultar por WhatsApp
                        </a>
                    </div>
                </div>
            </article>`;
    }).join('');
}

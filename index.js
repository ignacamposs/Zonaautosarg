// index.js - SOLO PARA HOME, CATÁLOGO Y 0KM

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

    // --- LÓGICA DEL BUSCADOR DEL HERO (Home) ---
    const searchBtn = document.querySelector('section button'); 
    const searchInput = document.querySelector('section input'); 
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const valor = searchInput.value.trim();
            window.location.href = valor !== "" ? `catalogo.html?marca=${encodeURIComponent(valor)}` : `catalogo.html`;
        });
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });
    }

    // --- CARGA DE DATOS (Solo si existen los contenedores) ---
    if (document.getElementById('contenedor-catalogo') || 
        document.getElementById('contenedor-0km') || 
        document.getElementById('contenedor-destacados')) {
        cargarDatosYRenderizar();
    }
});

async function cargarDatosYRenderizar() {
    try {
        const respuesta = await fetch('autos.json');
        if (!respuesta.ok) throw new Error("No se pudo cargar el JSON");
        todosLosAutos = await respuesta.json();

        // 1. HOME: Destacados (Primeros 4)
        if (document.getElementById('contenedor-destacados')) {
            renderizarTarjetas(todosLosAutos.slice(0, 4), 'contenedor-destacados');
        }

        // 2. CATÁLOGO
        if (document.getElementById('contenedor-catalogo')) {
            const params = new URLSearchParams(window.location.search);
            const marcaFiltro = params.get('marca');
            
            // Filtramos usados (km > 0) para el catálogo general
            let filtrados = todosLosAutos.filter(a => a.km > 0); 

            if (marcaFiltro) {
                filtrados = filtrados.filter(a => a.marca.toLowerCase() === marcaFiltro.toLowerCase());
                // Sincronizar el select de marcas
                const selectMarca = document.getElementById('filtro-marca');
                if (selectMarca) {
                    // Buscamos la opción que coincida ignorando mayúsculas
                    for (let option of selectMarca.options) {
                        if (option.value.toLowerCase() === marcaFiltro.toLowerCase()) {
                            selectMarca.value = option.value;
                            break;
                        }
                    }
                }
            }
            renderizarTarjetas(filtrados, 'contenedor-catalogo');
        }

        // 3. 0KM
        if (document.getElementById('contenedor-0km')) {
            const nuevos = todosLosAutos.filter(a => a.km === 0);
            renderizarTarjetas(nuevos, 'contenedor-0km');
        }
    } catch (error) { 
        console.error("Error cargando autos:", error); 
    }
}

// --- FUNCIÓN PARA FILTROS LATERALES (Catálogo) ---
window.aplicarFiltrosLaterales = function() {
    const elMarca = document.getElementById('filtro-marca');
    if (!elMarca) return;

    const marcaSeleccionada = elMarca.value;
    let filtrados = todosLosAutos.filter(a => a.km > 0);

    if (marcaSeleccionada !== "") {
        filtrados = filtrados.filter(a => a.marca === marcaSeleccionada);
    }

    renderizarTarjetas(filtrados, 'contenedor-catalogo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderizarTarjetas(lista, idContenedor) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    
    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="col-span-full text-center text-gray-400 py-10 uppercase tracking-widest">No hay unidades disponibles</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(auto => {
        const es0km = auto.km === 0;
        const img2 = auto.imagenes[1] ? auto.imagenes[1] : auto.imagenes[0];
        const precioMostrar = auto.precio === 0 ? "Consultar" : `USD ${auto.precio.toLocaleString()}`;

        // GENERACIÓN DE URL BLINDADA (Previene el error de doble guion "--")
        const marcaUrl = auto.marca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        const modeloUrl = auto.modelo.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        const urlFicha = `unidades/${marcaUrl}-${modeloUrl}.html`;

        return `
            <article 
                onclick="window.location.href='${urlFicha}'" 
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
                    </div>
                </div>
            </article>`;
    }).join('');
}
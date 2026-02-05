// Esperamos a que cargue todo el DOM
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // Verificamos que los elementos existan para no tirar error en otras páginas
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', (e) => {
            // Evitamos que el click se propague al document
            e.stopPropagation();
            
            // Toggle de clases de Tailwind
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
            
            console.log("Menú Zona Autos toggled 🏎️");
        });

        // Cerrar el menú si se hace click afuera
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('flex');
            }
        });
    }
});

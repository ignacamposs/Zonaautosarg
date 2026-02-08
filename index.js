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

function changeImage(src) {
    const mainImg = document.getElementById('main-img');
    const thumbs = document.querySelectorAll('.thumb');

    mainImg.style.opacity = '0';
    setTimeout(() => {
        mainImg.src = src;
        mainImg.style.opacity = '1';
    }, 200);

    thumbs.forEach(thumb => {
        thumb.classList.remove('border-orange-600', 'opacity-100');
        thumb.classList.add('border-transparent', 'opacity-50');
        if(thumb.src === src) {
            thumb.classList.add('border-orange-600', 'opacity-100');
            thumb.classList.remove('border-transparent', 'opacity-50');
        }
    });
}

function sendWhatsApp() {
    const carName = document.getElementById('car-name').innerText;
    const phoneNumber = "542944702059"; // Reemplazá con tu número real (sin el +)
    const message = encodeURIComponent(`Hola Zona Autos! Me interesa el ${carName} que vi en la web. Me darían más información?`);
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
}
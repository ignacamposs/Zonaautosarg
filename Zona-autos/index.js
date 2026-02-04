const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuToggle.addEventListener('click', () => {
        // 🔄 Esta línea agrega la clase 'active' si no está, y la quita si ya está
        navLinks.classList.toggle('active');
 });
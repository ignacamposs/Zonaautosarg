// unidad.js - SOLO PARA LAS FICHAS INDIVIDUALES

let carImages = [];
let currentImageIndex = 0;

// Se llama desde cada HTML enviándole su lista de fotos
function initSlider(imagesArray) {
    carImages = imagesArray;
    renderThumbs();
}

function renderThumbs() {
    const container = document.getElementById('contenedor-thumbs');
    if (!container) return;
    container.innerHTML = carImages.map((img, i) => `
        <img src="../${img}" onclick="changeImage(${i})" 
             class="thumb w-20 h-20 flex-shrink-0 rounded-2xl object-cover cursor-pointer border-2 ${i === 0 ? 'border-red-600 opacity-100' : 'border-white/10 opacity-50'} transition-all hover:opacity-100">
    `).join('');
}

function changeImage(index) {
    currentImageIndex = index;
    const mainImg = document.getElementById('main-img');
    if (!mainImg) return;

    mainImg.style.opacity = '0';
    setTimeout(() => {
        mainImg.src = "../" + carImages[currentImageIndex];
        mainImg.style.opacity = '1';
        actualizarThumbs();
    }, 150);
}

function nextPrev(delta) {
    currentImageIndex = (currentImageIndex + delta + carImages.length) % carImages.length;
    changeImage(currentImageIndex);
}

function actualizarThumbs() {
    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach((t, i) => {
        t.classList.toggle('border-red-600', i === currentImageIndex);
        t.classList.toggle('opacity-100', i === currentImageIndex);
        t.classList.toggle('border-white/10', i !== currentImageIndex);
        t.classList.toggle('opacity-50', i !== currentImageIndex);
    });
}

function sendWhatsApp() {
    const carName = document.getElementById('car-name').innerText;
    const url = `https://wa.me/542944388443?text=${encodeURIComponent('Hola Zona Autos! Me interesa el ' + carName + ' que vi en la web.')}`;
    window.open(url, '_blank');
}
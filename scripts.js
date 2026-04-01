
let currentLang = localStorage.getItem('khotwa_lang') || 'ar';

function renderPartners() {
    const grid = document.getElementById('partners-grid');
    if (!grid) return;

    const partnerLogos = [
        'p1.jpg', 'p2.jpg', 'P3.jpg', 'p4.jpg', 'p5.jpg', 'p6.jpg', 'p7.jpg',
        'p8.jpg', 'p9.png', 'p10.jpg', 'p11.jpg', 'p12.jpg', 'p13.jpg', 'p14.webp'
    ];

    const bgColors = ['bg-blue-50', 'bg-yellow-50', 'bg-emerald-50', 'bg-purple-50', 'bg-red-50', 'bg-indigo-50', 'bg-teal-50'];
    const margins = ['mb-8 md:mb-16', 'mt-8 md:mt-16', 'mb-8 md:mb-16', 'mt-8 md:mt-16', 'mb-8 md:mb-16', 'mt-8 md:mt-16', 'mb-8 md:mb-16'];
    const sizes = ['w-24 h-24 md:w-32 md:h-32', 'w-24 h-24 md:w-36 md:h-36', 'w-20 h-20 md:w-28 md:h-28', 'w-28 h-28 md:w-40 md:h-40'];

    const floatClasses = ['float-1', 'float-2', 'float-3'];

    let htmlContent = '';

    for (let i = 0; i < partnerLogos.length; i++) {
        const logoName = partnerLogos[i];
        const color = bgColors[i % bgColors.length];
        const margin = margins[i % margins.length];
        const size = sizes[i % sizes.length];
        const floatClass = floatClasses[i % floatClasses.length];

        htmlContent += `
        <div class="${color} ${size} ${margin} ${floatClass} rounded-full flex items-center justify-center shadow-lg shadow-gray-200/50 hover:!-translate-y-2 transition duration-500 cursor-pointer overflow-hidden p-4 md:p-6 shrink-0 border-4 border-white backdrop-blur-sm relative group">
            <div class="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition duration-300"></div>
            <img src="./image/khotwa-partners/${logoName}" alt="Partner" class="w-full h-full object-contain mix-blend-multiply drop-shadow-sm relative z-10 transition duration-500 transform group-hover:scale-110">
        </div>
        `;
    }

    grid.innerHTML = htmlContent;
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('khotwa_lang', lang);
    const htmlTag = document.documentElement;

    // Toggle Direction and Lang Attributes
    if (lang === 'ar') {
        htmlTag.setAttribute('dir', 'rtl');
        htmlTag.setAttribute('lang', 'ar');
    } else {
        htmlTag.setAttribute('dir', 'ltr');
        htmlTag.setAttribute('lang', 'en');
    }

    // Update all static i18n texts
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // Update Toggle Button Text
    const dtText = document.getElementById('lang-toggle-text');
    const moText = document.getElementById('lang-toggle-text-mobile');
    const newLabel = lang === 'en' ? 'عربي' : 'English';
    if (dtText) dtText.innerText = newLabel;
    if (moText) moText.innerText = newLabel;

    // Re-render dynamic elements
    renderPartners();
}

function toggleLanguage() {
    setLanguage(currentLang === 'en' ? 'ar' : 'en');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');

    if (menu) {
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');

        if (menuIcon && closeIcon) {
            menuIcon.classList.toggle('hidden');
            closeIcon.classList.toggle('hidden');
        }
    }
}

// Initialize Lucide icons & UI elements on load
document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // --- Smooth Reveal on scroll ---
    const reveals = document.querySelectorAll('.reveal');
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
        });
    }, revealOptions);

    reveals.forEach(reveal => {
        revealOnScroll.observe(reveal);
    });

    // --- Number Counter Animation ---
    const counters = document.querySelectorAll('.count-up');
    const hasAnimated = new Set();

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                if (!hasAnimated.has(el)) {
                    hasAnimated.add(el);
                    animateCounter(el);
                }
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
        counterObserver.observe(counter);
    });

    function animateCounter(el) {
        // Handle immediate fast scroll edge case or translation overwriting before anim starts
        // We get the target value from translations object so it's always accurate
        const key = el.getAttribute('data-i18n');
        const finalString = translations[currentLang][key] || el.innerText;
        const targetValue = parseInt(finalString.replace(/\D/g, ''));
        const prefix = finalString.replace(/[0-9]/g, '');

        let startTime = null;
        const duration = 2000;

        el.innerText = prefix + "0";

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentCount = Math.floor(easeOutQuart * targetValue);

            el.innerText = prefix + currentCount;

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                el.innerText = finalString;
            }
        }

        window.requestAnimationFrame(step);
    }
});

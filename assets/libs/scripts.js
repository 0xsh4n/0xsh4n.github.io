document.addEventListener("DOMContentLoaded", function() {
    const elements = document.querySelectorAll(".animate-on-load");

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("animate");
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    elements.forEach(element => {
        observer.observe(element);
    });
});

// JavaScript code to handle navbar transparency on scroll
window.addEventListener('scroll', function() {
    var navbar = document.querySelector('header');
    if(window.scrollY > 0) {
        navbar.classList.add('scrolling');
    } else {
        navbar.classList.remove('scrolling');
    }
});

document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');

    menuToggle.addEventListener('click', function() {
        nav.classList.toggle('active');
    });
});

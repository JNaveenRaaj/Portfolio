// Typing animation
var typed = new Typed(".typing", {
    strings: ["Senior Software Engineer", "Full Stack Developer", "AI Integrations Specialist"],
    typeSpeed: 100,
    backSpeed: 60,
    loop: true,
});

// Mobile Sidebar Toggle
const navTogglerbtn = document.querySelector(".nav-toggler");
const aside = document.querySelector(".aside");
const sections = document.querySelectorAll(".section");

navTogglerbtn.addEventListener("click", () => {
    aside.classList.toggle("open");
});

// Hide sidebar when a link is clicked on mobile
const navLinks = document.querySelectorAll(".nav li a");
navLinks.forEach(link => {
    link.addEventListener("click", () => {
        if(window.innerWidth < 1200){
            aside.classList.remove("open");
        }
    });
});

// ScrollSpy Logic: Automatically highlight sidebar links on scroll
window.addEventListener("scroll", () => {
    let current = "";
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        // If we have scrolled past 1/3 of the section, mark it as current
        if(pageYOffset >= (sectionTop - sectionHeight / 3)){
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach(link => {
        link.classList.remove("active");
        if(link.getAttribute("href").includes(current)){
            link.classList.add("active");
        }
    });
});

// Scroll Reveal Animation Logic
document.addEventListener("DOMContentLoaded", function() {
    const revealElements = document.querySelectorAll('.padd-15, .section-title, .timeline-item, .project-item');

    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealOnScroll = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active-reveal');
                observer.unobserve(entry.target); 
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        el.classList.add('reveal');
        revealOnScroll.observe(el);
    });
});
// ===================== PRELOADER =====================
window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    if (preloader) preloader.classList.add("hide");
});

// ===================== TYPING ANIMATION =====================
var typed = new Typed(".typing", {
    strings: [
        "Software Engineer",
        "Full Stack Developer",
        "AI Integrations",
        "GenAI & MERN"
    ],
    typeSpeed: 80,
    backSpeed: 45,
    backDelay: 1400,
    loop: true,
});

// ===================== MOBILE SIDEBAR =====================
const navTogglerBtn = document.querySelector(".nav-toggler");
const aside = document.querySelector(".aside");
const mobileOverlay = document.getElementById("mobileOverlay");
const navLinks = document.querySelectorAll(".nav li a");

const closeSidebar = () => {
    aside.classList.remove("open");
    navTogglerBtn.classList.remove("open");
    if (mobileOverlay) mobileOverlay.classList.remove("active");
};

navTogglerBtn.addEventListener("click", () => {
    aside.classList.toggle("open");
    navTogglerBtn.classList.toggle("open");
    if (mobileOverlay) mobileOverlay.classList.toggle("active");
});

if (mobileOverlay) mobileOverlay.addEventListener("click", closeSidebar);

navLinks.forEach(link => {
    link.addEventListener("click", () => {
        if (window.innerWidth < 1200) closeSidebar();
    });
});

// ===================== SCROLL PROGRESS BAR =====================
const scrollProgress = document.getElementById("scrollProgress");
const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (scrollProgress) scrollProgress.style.width = scrolled + "%";

    if (backToTop) backToTop.classList.toggle("show", scrollTop > 500);
}, { passive: true });

if (backToTop) {
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// ===================== SCROLLSPY =====================
const sections = document.querySelectorAll(".section[id]");

window.addEventListener("scroll", () => {
    let current = "";
    const pos = window.scrollY;

    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (pos >= sectionTop) {
            current = section.getAttribute("id");
        }
    });

    navLinks.forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === "#" + current) link.classList.add("active");
    });
}, { passive: true });

// ===================== AUTO AGE =====================
const ageEl = document.getElementById("age");
if (ageEl) {
    const birth = new Date(2003, 1, 22); // Feb 22, 2003
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    ageEl.textContent = age;
}

// ===================== FOOTER YEAR =====================
document.getElementById("year").textContent = new Date().getFullYear();

// ===================== SCROLL REVEAL + STAGGER =====================
document.addEventListener("DOMContentLoaded", () => {
    const revealSelectors = [
        ".section-title", ".about-text", ".personal-info .info-items",
        ".skill-items", ".tool-tag", ".timeline-box", ".profile-card",
        ".exp-item", ".project-filters", ".stat-item"
    ];
    const revealElements = document.querySelectorAll(revealSelectors.join(","));

    const revealOptions = { threshold: 0.12, rootMargin: "0px 0px -40px 0px" };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active-reveal");
                obs.unobserve(entry.target);
            }
        });
    }, revealOptions);

    revealElements.forEach((el, idx) => {
        el.classList.add("reveal");
        el.style.transitionDelay = (idx % 8) * 60 + "ms";
        observer.observe(el);
    });
});

// ===================== SKILL BARS + COUNTERS =====================
function animateSkillBars(container) {
    const bars = container.querySelectorAll(".progress-in");
    const percentLabels = container.querySelectorAll(".skill-percent");

    bars.forEach((bar, i) => {
        const target = parseInt(bar.dataset.progress, 10) || 0;
        let current = 0;
        const step = Math.max(1, Math.round(target / 60));
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            bar.style.setProperty("--progress", current + "%");
            if (percentLabels[i]) percentLabels[i].textContent = current + "%";
        }, 18);
    });
    container.classList.add("animated");
}

function animateCounters(scope) {
    const counters = scope.querySelectorAll(".counter");
    counters.forEach(counter => {
        if (counter.dataset.done) return;
        counter.dataset.done = "true";

        const target = parseInt(counter.dataset.target, 10) || 0;
        const suffix = counter.nextElementSibling ? counter.nextElementSibling.textContent : "";
        let current = 0;
        const step = Math.max(1, Math.round(target / 80));
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = current;
        }, 20);
    });
}

const skillPanel = document.querySelector(".about .skills");
const statsPanel = document.querySelector(".home .stats-row");

const runOnView = (el, cb) => {
    if (!el) return;
    const o = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                cb();
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.25 });
    o.observe(el);
};

runOnView(skillPanel, () => animateSkillBars(skillPanel));
runOnView(statsPanel, () => animateCounters(statsPanel));

// ===================== PROJECT FILTER =====================
const filterBtns = document.querySelectorAll(".filter-btn");
const projectItems = document.querySelectorAll(".project-item");

filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filter = btn.dataset.filter;

        projectItems.forEach(item => {
            const match = filter === "all" || item.dataset.category === filter;
            item.classList.add("fade-out");
            item.style.display = match ? "block" : "none";
            if (match) {
                setTimeout(() => item.classList.remove("fade-out"), 30);
            }
        });
    });
});

// Show all by default
projectItems.forEach(item => { item.style.display = "block"; });
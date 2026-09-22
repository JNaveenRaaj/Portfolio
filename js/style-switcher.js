// ===================== STYLE SWITCHER TOGGLE =====================
const styleswitchertoggle = document.querySelector(".style-switcher-toggler");

styleswitchertoggle.addEventListener("click", () => {
    document.querySelector(".style-switcher").classList.toggle("open");
});

// Close the switcher panel while scrolling
window.addEventListener("scroll", () => {
    document.querySelector(".style-switcher").classList.remove("open");
});

// ===================== THEME COLORS =====================
const alternateStyles = document.querySelectorAll(".alternate-style");
const STORAGE_SKIN = "portfolio_skin";
const STORAGE_THEME = "portfolio_theme";

function setActiveStyle(color) {
    alternateStyles.forEach((style) => {
        if (color === style.getAttribute("title")) {
            style.removeAttribute("disabled");
        } else {
            style.setAttribute("disabled", "true");
        }
    });
    localStorage.setItem(STORAGE_SKIN, color);
}

// ===================== DARK / LIGHT MODE =====================
const dayNight = document.querySelector(".day-night");

function updateDayNightIcon() {
    const isDark = document.body.classList.contains("dark");
    dayNight.querySelector("i").classList.toggle("fa-sun", isDark);
    dayNight.querySelector("i").classList.toggle("fa-moon", !isDark);
}

dayNight.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    updateDayNightIcon();
    localStorage.setItem(STORAGE_THEME, document.body.classList.contains("dark") ? "dark" : "light");
});

// ===================== RESTORE SAVED PREFERENCES =====================
window.addEventListener("load", () => {
    const savedSkin = localStorage.getItem(STORAGE_SKIN);
    const savedTheme = localStorage.getItem(STORAGE_THEME);

    if (savedSkin) {
        setActiveStyle(savedSkin);
    } else {
        setActiveStyle("color1");
    }

    if (savedTheme === "light") {
        document.body.classList.remove("dark");
    } else {
        document.body.classList.add("dark");
    }
    updateDayNightIcon();
});
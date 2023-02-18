
// toggle theme section
const styleswitchertoggle = document.querySelector(".style-switcher-toggler");

styleswitchertoggle.addEventListener("click", () => {

    document.querySelector(".style-switcher").classList.toggle("open");
})

// when scrolled the theme section will disappear

window.addEventListener("scroll", () => {
    if(document.querySelector(".style-switcher").classList.contains("open")){
        document.querySelector(".style-switcher").classList.remove("open");
        console.log("workin");
    }
    else{
        document.querySelector(".style-switcher").classList.remove("open");
    }
})

// theme colors
const alternateStyles = document.querySelectorAll(".alternate-style");
function setActiveStyle(color){
alternateStyles.forEach((style) => {
    if(color === style.getAttribute("title")){
        style.removeAttribute("disabled");
    }
    else{
        style.setAttribute("disabled", "true");
    }
})
}

// dark and night
const dayNight = document.querySelector(".day-night");

dayNight.addEventListener("click" , () => {
    dayNight.querySelector('i').classList.toggle("fa-sun");
    dayNight.querySelector('i').classList.toggle("fa-moon");
    document.body.classList.toggle("dark");
})

window.addEventListener("load", () => {
    if(document.body.classList.contains("dark")){
        dayNight.querySelector("i").classList.add("fa-sun");
    }
    else{
        dayNight.querySelector("i").classList.add("fa-moon");
    }
})
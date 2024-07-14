// Typing animation

var typed = new Typed(".typing", {
    strings:["MERN Stack Developer", "Gamer"],
    typeSpeed:150,
    backSpeed:50,
    loop:true,
})

// Aside 
const nav = document.querySelector(".nav");
const navlist = document.querySelectorAll("li");
const section = document.querySelectorAll(".section");
const totalSection = section.length;

for(let i=0; i<navlist.length; i++){
    navlist[i].addEventListener("click" , function() {

        removebacksection();

        for(let j=0; j<navlist.length; j++){
            
            if(navlist[j].querySelector("a").classList.contains("active")){
                addbacksection(j);
            }
            navlist[j].querySelector("a").classList.remove("active");
        }

        console.log(navlist[i].querySelector("a").classList.add("active"));
        let selectedsection = navlist[i].querySelector("a");
        showSection(selectedsection);

        if(innerWidth <1200){
            asideNavToggler();
        }
    })
}
function removebacksection(){
    for(let i=0; i<totalSection; i++){
        section[i].classList.remove("back-section");
    }
}
function addbacksection(num){
    section[num].classList.add("back-section");
}
function showSection(e){

    for(let i=0; i<totalSection; i++){
        section[i].classList.remove("active-section");
    }
    target = e.getAttribute("href").split("#")[1];
    document.querySelector("#" + target).classList.add("active-section");
}

function updateNav(e){
    for(let i=0;i<navlist.length; i++){
        navlist[i].querySelector("a").classList.remove("active");
        target = e.getAttribute("href").split("#")[1];
        if(navlist[i].querySelector("a").getAttribute("href").split("#")[1] === target){
            navlist[i].querySelector("a").classList.add("active");
        }
    }
}

document.querySelector(".hire-me").addEventListener("click", function(){

    const sectionindex = this.getAttribute("data-section-index");
    showSection(this);
    updateNav(this);
    removebacksection();
    addbacksection(sectionindex);
})

const navTogglerbtn = document.querySelector(".nav-toggler");
const aside = document.querySelector(".aside");

navTogglerbtn.addEventListener("click", () => {
    asideNavToggler();
})

function asideNavToggler(){
    aside.classList.toggle("open");
    console.log(navTogglerbtn.classList.toggle("open"));

    for(let i=0; i<totalSection; i++){
        section[i].classList.toggle("open");
    }
}
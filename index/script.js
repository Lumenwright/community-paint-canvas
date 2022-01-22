function makePixel(element, ev){
    let x = ev.offsetX;
    let y = ev.offsetY;
    element.innerHTML=element.innerHTML+"<div class='pixel' style='grid-row-start:"+y+";grid-column-start:"+x+";'></div>";
};

document.getElementById("canvas").addEventListener("click", function(ev){makePixel(this,ev);});
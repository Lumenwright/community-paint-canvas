function makePixel(element, ev){
    let x = ev.clientX;
    let y = ev.clientY;
    element.innerHTML=element.innerHTML+"<div class='pixel' style='top:"+y+"px;left:"+x+"px;'></div>";
};

document.getElementById("canvas").addEventListener("click", function(ev){makePixel(this,ev);});
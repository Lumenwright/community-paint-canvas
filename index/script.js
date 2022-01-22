const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const req = new XMLHttpRequest();
req.onload= function(){
    var canvasData = JSON.parse(this.responseText);
    makeCanvas(canvasData);
    }
req.open("GET","canvas.json");
req.send();

// Top left corner position in px
const startX = 0;
const startY = 0;
const widthPixel = 1;
const heightPixel = 1;

// colours
const defaultColour = "chartreuse";
const selectedColour = "red";

/*make the canvas*/

function makeCanvas(canvasData){
    var numRows = canvasData.canvas.length;
    var numCols = canvasData.canvas[0].length;
    ctx.fillStyle = defaultColour;
    //ctx.fillRect(10, 10, numRows, numCols);
    for(let i=0; i<numRows; i++){
        for(let j=0; j<numCols; j++){
            MakePixel(startX+i*widthPixel, startY+j*heightPixel, defaultColour);
        }
    }   
    canvas.addEventListener("pointerdown", OnPointerDown);
    canvas.addEventListener("pointerup", OnPointerUp);
}

function OnPointerDown(ev){
    MakePixel(ev.offsetX, ev.offsetY, selectedColour);
    canvas.addEventListener("pointermove", OnPointerMove);
}

//draw a pixel overtop
function OnPointerMove(ev){
    MakePixel(ev.offsetX, ev.offsetY, selectedColour);
}

function OnPointerUp(ev){
    canvas.removeEventListener("pointermove", OnPointerMove);
}

function MakePixel(offsetX, offsetY, colour){
    ctx.fillStyle = colour;
    ctx.fillRect(offsetX,offsetY,widthPixel,heightPixel);
}

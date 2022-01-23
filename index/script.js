const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const req = new XMLHttpRequest();
req.onload= function(){
    // get canvas from the server
    var canvasData = JSON.parse(this.responseText);
    makeCanvas(canvasData);
    //make form and enable submissions after canvas is loaded

    //test
    /*let px = {r:0.0, g:0.0, b:0.0, x:0.0, y:0.0};
    let object = {new_pixels:px,total_donate:0.0,response:"aaaa"};
    let json_string = JSON.stringify(object);
    console.log(json_string);
    req.open("POST","/pixels");
    req.setRequestHeader("Content-type", "application/json");
    req.send(json_string);*/
    }
req.open("GET","canvas.json");
req.send();

//=========== FORM ================
function formSubmit(){
    /*let px = {r:0.0, g:0.0, b:0.0, x:0.0, y:0.0};
    let object = {new_pixels:px,total_donate:0.0,response:text};
    let json_string = JSON.stringify(object);
    console.log(json_string);
    req.open("POST","/pixels");
    req.setRequestHeader("Content-type", "application/json");
    req.send(json_string);*/
    document.forms["Submission"].submit(); // submits the text response to text endpoint
    // get the pixels selected and submit that to endpoint
}

//=========== CANVAS ================
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
    let numRows = canvasData.canvas.length;
    let numCols = canvasData.canvas[0].px_row.length;
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

function ReadNewCanvas(w, h){
    let imageData = ctx.getImageData(0,0,1,1).data;
    console.log(imageData[1]);
    return imageData[1];
}

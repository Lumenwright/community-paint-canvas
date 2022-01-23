const defaultColour = {r:0,g:0,b:0,a:0}; // out of 255
const pxEndpoint = "/pixels"
const width = 500
const height = 500

var app = new Vue({
    el: '#app',
    data: {
      message: "Paint Canvas",
      vueCanvas:null,
      painting:false,
      canvas:null,
      ctx:null,
      req:null,
      status:'',
      totalPixels:0,
      textresponse:'',
      pixelArray:null,
      canvasArray:null
    },
    methods: {
      startPainting(e) {
        this.painting = true;
        //console.log(this.painting)
        this.draw(e)
      },
      finishedPainting() {
        this.painting = false;
        //console.log(this.painting);
        this.ctx.beginPath()
      },
      draw(e) {
        if(!this.painting) return;
  
        this.ctx.lineWidth = 10;
        this.ctx.lineCap ="round";
        this.ctx.strokeStyle = "red";
        
        this.ctx.lineTo(e.offsetX,e.offsetY);
        this.ctx.stroke();
    
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX,e.offsetY);
  
      },
      getTotalPixels(){
        this.status = 'Counting...';
        let imageData = this.ctx.getImageData(0,0,this.canvas.height,this.canvas.width).data;
        let pixelData = [];
        let newPixels = [];
        let count = 0;

        //console.log(imageData.length);
        //imageData is a one dimensional dictionary
        // with values listed as 1:r, 2:g, 3:b, 4:a 5:r, 5:g, 7:b, 8:a etc.
        // so need to put them into a structure of pixels to count how many pixels
        for(let i=0; i<imageData.length; i++){
          if(i%4==0){
            let px = {num:i, r:imageData[i], g:imageData[i+1], b:imageData[i+2], a:imageData[i+3]};
            pixelData.push(px);
            // if it's not the default colour, increase the count
            if((px.r!=defaultColour.r || px.g!=defaultColour.g || px.b!=defaultColour.b)&&px.a == 255){
              newPixels.push(px);
              count++;
            }  
          }
        }
        console.log("numPx:"+imageData.length/4);
        this.status = 'The total number of pixels is:'
        //console.log(count);
        this.totalPixels= count;
        this.pixelArray = pixelData;
        this.canvasArray = newPixels;
      },
      submit(){
        let str = JSON.stringify(this.canvasArray);
        let submission = {new_pixels:str, text_response:this.textresponse}
        let json_string = JSON.stringify(submission);
        console.log(json_string);
        this.req.open("POST",pxEndpoint);
        this.req.setRequestHeader("Content-type", "application/json");
        this.req.send(json_string);   
      }
    },
  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Resize canvas
    this.canvas.height = height;
    this.canvas.width = width;

    //load the state of the canvas and put the data into it
    var c = this.ctx;
    var array = c.getImageData(0,0,this.canvas.height,this.canvas.width);
    this.req = new XMLHttpRequest();
    this.req.onload= function(){
      //var canvasData = c.createImageData(array);
      var json_obj = JSON.parse(JSON.parse(this.responseText));
      var json_obj2 = JSON.parse(json_obj.new_pixels);
      /*for(let j=0; j<json_obj.length; j++){
        for(let i = 0; i<canvasData.data.length; i++){
          json_obj[j]
        }
      }*/
      console.log(json_obj2)
      //c.putImageData(canvasData,0,0);
    };
    this.req.open("GET", pxEndpoint);
    this.req.send();
  },
  watch:{
    painting:function(newCount, oldCount){
      if(this.painting){
        this.status = 'Painting...';
        return;
      }
      this.debouncedGetCanvas();
    }
  },
  created:function(){
    this.debouncedGetCanvas = _.debounce(this.getTotalPixels, 500);
  }
})
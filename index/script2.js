const defaultColour = {r:0,g:0,b:0,a:0}; // out of 255

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
        let pxNum = 0;
        let pixelData = [];
        let count = 0;

        //console.log(imageData.length);
        //imageData is a one dimensional dictionary
        // with values listed as 1:r, 2:g, 3:b, 4:a 5:r, 5:g, 7:b, 8:a etc.
        // so need to put them into a structure of pixels to count how many pixels
        for(let i=0; i<imageData.length; i++){
          if(i%4==0){
            let px = {num:pxNum, r:imageData[i], g:imageData[i+1], b:imageData[i+2], a:imageData[i+3]};
            pixelData.push(px);

            // if it's not the default colour, increase the count
            if((px.r!=defaultColour.r || px.g!=defaultColour.g || px.b!=defaultColour.b)&&px.a == 255){
              count++;
            }  
          }
        }
        console.log("numPx:"+imageData.length/4);
        this.status = 'The total number of pixels is:'
        //console.log(count);
        this.totalPixels= count;
        this.pixelArray = pixelData;
        this.canvasArray = imageData;
      },
      submit(){
        let submission = {new_pixels:this.canvasArray, text_response:this.textresponse}
        let json_string = JSON.stringify(submission);
        console.log(json_string);
        this.req.open("POST","/pixels");
        this.req.setRequestHeader("Content-type", "application/json");
        this.req.send(json_string);
    
      }
    },
  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");  

    //load the state of the canvas and put the data into it
    this.req = new XMLHttpRequest();
    this.req.onload= function(){
      var jsonObj = JSON.parse(this.responseText);

      this.ctx.putImageData(canvasData,0,0);
    }
    // Resize canvas
    this.canvas.height = window.innerHeight;
    this.canvas.width = window.innerWidth;
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
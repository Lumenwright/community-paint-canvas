const defaultColour = {r:0,g:0,b:0,a:0}; // out of 255
const pxEndpoint = "/pixels"
const width = 500
const height = 500
const DB_URL = "https://community-paint-canvas-default-rtdb.europe-west1.firebasedatabase.app"

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
        let j = 0;
        for(let i=0; i<imageData.length; i+=4){
            let px = {num:j, r:imageData[i], g:imageData[i+1], b:imageData[i+2], a:imageData[i+3]};
            pixelData.push(px);
            // if it's not the default colour, increase the count
            if((px.r!=defaultColour.r || px.g!=defaultColour.g || px.b!=defaultColour.b)&&px.a == 255){
              newPixels.push(px);
              count++;
            } 
            j++;
        }
        this.status = 'The total number of pixels is:'
        //console.log(count);
        this.totalPixels= count;
        this.pixelArray = pixelData;
        this.canvasArray = newPixels;
      },
      submit(){
        let array_sub = this.canvasArray.reduce((a, b)=>(a[b.num.toString()]={"num":b.num, "r":b.r, "g":b.g, "b":b.b, "a":b.a},a),{});
        
        let submission = {pixels:array_sub, text_response:this.textresponse}
        let json_string = JSON.stringify(submission);
        console.log("sending:" +json_string);
        this.req.open("POST",pxEndpoint);
        this.req.setRequestHeader("Content-type", "application/json");
        this.req.send(json_string);   
      },
      onClick(){
        console.log("refreshing...");
        //this.ctx.putImageData(this.vueCanvas,0,0);
        for(var p in this.canvasArray){
          var n = this.canvasArray[p].num;
          var w = this.canvas.width;
          var x = Math.floor(n%w);
          var y = Math.floor(n/w);
          this.ctx.fillStyle ="black";
          this.ctx.fillRect(x,y,1,1);          
        }

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
        var array = c.createImageData(this.canvas.height,this.canvas.width);
        var data = array.data;
        var t = this;

        this.req = new XMLHttpRequest();
        this.req.onload= function(){
          console.log("response received");
          var json_obj = JSON.parse(this.responseText);
          for(var px in json_obj){
              data[px] = json_obj[px].r;
              data[px+1] = json_obj[px].g;
              data[px+2] = json_obj[px].b;
              data[px+3] = json_obj[px].a;
          }
          t.vueCanvas = array;
          t.canvasArray = json_obj;
        };
        this.req.open("GET", DB_URL+pxEndpoint+".json");
        this.req.send();
  },
  watch:{
    painting:function(){
      if(this.painting){
        this.status = 'Painting...';
        return;
      }
      this.debouncedGetCanvas();
    },
    vueCanvas:function(){
      console.log("vue canvas data changed:"+this.vueCanvas.data[601140]);

    }
  },
  created:function(){
    this.debouncedGetCanvas = _.debounce(this.getTotalPixels, 500);
  }
})
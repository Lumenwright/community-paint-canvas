const defaultColour = {r:0,g:0,b:0,a:0}; // out of 255
const pxEndpoint = "/pixels"
const width = 500
const height = 500

var app = new Vue({
    el: '#app',
    data: {
      message: "Paint Canvas",
      vueCanvas:null,
      currentCanvas:null,
      painting:false,
      canvas:null,
      ctx:null,
      req:null,
      reqPx:null,
      status:'',
      totalPixels:0,
      textresponse:'',
      canvasArray:null,
      alphaDict:null
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
        let newPixels = [];
        let count = 0;

        //console.log(imageData.length);
        //imageData is a one dimensional dictionary
        // with values listed as 1:r, 2:g, 3:b, 4:a 5:r, 5:g, 7:b, 8:a etc.
        // so need to put them into a structure of pixels to count how many pixels
        let j = 0;
        for(let i=0; i<imageData.length; i+=4){
            let px = {num:j, r:imageData[i], g:imageData[i+1], b:imageData[i+2], a:imageData[i+3]};
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
        this.canvasArray = newPixels;
      },
      submit(){
        let array_sub = this.canvasArray.reduce((a, b)=>(a[b.num.toString()]={"num":b.num, "r":b.r, "g":b.g, "b":b.b, "a":b.a},a),{});     
        let submission = {pixels:array_sub, text_response:this.textresponse, total_donate:this.totalPixels};
        let json_string = JSON.stringify(submission);
        console.log("sending:" +json_string);
        this.req.open("POST",pxEndpoint);
        this.req.setRequestHeader("Content-type", "application/json");
        this.req.send(json_string);   
      },
      redraw(){
        console.log("redrawing canvas...");
        var w = this.canvas.width;
        this.ctx.clearRect(0,0,w, this.canvas.height);
        this.ctx.fillStyle ="black";
        //this.ctx.putImageData(this.vueCanvas,0,0);
        var d = this.currentCanvas;
        for(var entry in d){
          e = d[entry];
          for(var p in e){
            var n = e[p].num;
            var x = Math.floor(n%w);
            var y = Math.floor(n/w);
            this.ctx.fillRect(x,y,1,1);
          }          
        }

      }
    },
  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Resize canvas
    this.canvas.height = height;
    this.canvas.width = width;

    console.log("Retrieving alphas...");
    var t = this;
    this.req = new XMLHttpRequest();
    this.req.onload = function(){
      t.alphaDict = JSON.parse(this.responseText);
      console.log("Alphas receieved");
    }
    this.req.open("GET", "alphas");
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
      console.log("vue canvas data changed");
      this.redraw();
    },
    alphaDict:function(){
      //load the state of the canvas and put the data into it
      var c = this.ctx;
      var array = c.createImageData(this.canvas.height,this.canvas.width);
      var data = array.data;
      var t = this;

      this.reqPx = new XMLHttpRequest();
      this.reqPx.onload= function(){
        console.log("Pixels received");
        console.log("Constructing canvas...");
        var json_obj = JSON.parse(this.responseText);
        for(var entry in json_obj){
          var a = t.alphaDict[entry].alpha;
          var p = json_obj[entry];
          for(var px in p)
            var i = parseInt(px, 10);
            data[i] = p[px].r;
            data[i+1] = p[px].g;
            data[i+2] = p[px].b;
            data[i+3] = a;
        }
        t.vueCanvas = array;
        t.currentCanvas = json_obj
      };
      this.reqPx.open("GET", pxEndpoint);
      this.reqPx.send();
      console.log("Retrieving pixels...");
    }
  },
  created:function(){
    this.debouncedGetCanvas = _.debounce(this.getTotalPixels, 500);
  }
})
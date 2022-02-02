const defaultColour = {r:0,g:0,b:0,a:0}; // in the ImageData, out of 255
const width = 500
const height = 500
const pxEndpoint="/pixels"

var app = new Vue({
    el: '#app',
    data: {
      currentCanvas:null, // reference to db of public drawings
      canvas:null, // reference to canvas element
      ctx:null,
      canvasArray:[], // array that contains the points on the line
      alphaDict:null,
      timer:null
    },
    methods: {
      redraw(){
        console.log("redrawing canvas...");
        var w = this.canvas.width;
        this.ctx.clearRect(0,0,w, this.canvas.height);
        this.drawBorder();
        var d = this.currentCanvas;
        for(var entry in d){
          e = d[entry];
          var colour = `rgba(255, 255, 255, ${this.alphaDict[entry].alpha/255})`;
          for(var p in e){

            // if it is a break reset the path
            if(e[p]==true){
              this.beginPath();
              continue;
            }
            this.ctx.lineWidth = this.getRndInteger(5,10);
            this.ctx.lineCap ="round";
            this.ctx.strokeStyle =colour;
            this.ctx.lineTo(e[p]["x"],e[p]["y"]);
            this.ctx.stroke();
        
            this.ctx.beginPath();
            this.ctx.moveTo(e[p]["x"],e[p]["y"]);
          }
          this.ctx.beginPath();
        }
        this.status="Click and drag to paint!";
      },
      drawBorder(){
        //Draw a border around the canvas
        this.ctx.strokeWidth = 3;
        this.ctx.strokeStyle="black";
        this.ctx.strokeRect(0,0,width,height);
      },
      getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1) ) + min;
      },
      retrieveCanvas(){
        console.log("Retrieving alphas...");
        var t = this;
        var req = new XMLHttpRequest();
        req.onload = function(){
          if(this.responseText==""){
            console.log("No alphas");
            return;
          }
          t.alphaDict = JSON.parse(this.responseText);
          console.log("Alphas receieved");
        }
        req.open("GET", "/alphas");
        req.send();
    
        // see watched variable alphaDict for canvas drawing
      },
      cancelAutoUpdate () {
          clearInterval(this.timer);
      },
    },
    created(){
        this.timer = setInterval(this.retrieveCanvas, 30000);
    },
  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Resize canvas
    this.canvas.height = height;
    this.canvas.width = width;
  },
  beforeDestroy(){
      this.cancelAutoUpdate();
  },
  watch:{
    currentCanvas:function(){
      console.log("canvas data changed");
      this.redraw();
    },
    alphaDict:function(){
      if(this.alphaDict==""){
        console.log("No alphas");
        this.status = "No new art to display";
        return;
      }
      //load the state of the canvas
      var t = this;

      var reqPx = new XMLHttpRequest();
      reqPx.onload= function(){
        console.log("Pixels received");
        console.log("Constructing canvas...");
        var json_obj = JSON.parse(this.responseText);
        if(json_obj==undefined || json_obj==null){
          console.log("Public canvas is empty/undefined");
          t.status = "No new art to display"
          return;
        }
        t.currentCanvas = json_obj
      };
      reqPx.open("GET", pxEndpoint);
      reqPx.send();
      console.log("Retrieving pixels...");
    }
  }
})
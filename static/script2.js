const defaultColour = {r:0,g:0,b:0,a:0}; // in the ImageData, out of 255
const pxEndpoint = "/pixels"
const width = 500
const height = 500

var app = new Vue({
    el: '#app',
    data: {
      message: "Paint Canvas",
      currentCanvas:null, // reference to db of public drawings
      painting:false,
      canvas:null, // reference to canvas element
      ctx:null,
      req:null,
      reqPx:null,
      status:"Loading...",
      totalPixels:0,
      textresponse:'',
      canvasArray:[], // array that contains the points on the line
      alphaDict:null
    },
    methods: {
      startPainting(e) {
        this.painting = true;
        this.draw(e)
      },
      finishedPainting() {
        this.painting = false;
        this.ctx.beginPath()
      },
      draw(e) {
        if(!this.painting) return;
  
        this.ctx.lineWidth = this.getRndInteger(5,10);
        this.ctx.lineCap ="round";
        this.ctx.strokeStyle = "red";
        
        this.ctx.lineTo(e.offsetX,e.offsetY);
        this.ctx.stroke();
    
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX,e.offsetY);
  
        this.canvasArray.push({x:e.offsetX, y:e.offsetY});
      },
      getTotalPixels(){
        this.status = 'Counting...';
        var count = this.canvasArray.length;
        this.status = 'The total complexity is:'
        this.totalPixels= count;
      },
      submit(){
        this.status = "Submitting..."
        var array = this.canvasArray.reduce((a,b,i)=>(a[i]=b,a),{});
        let submission = {pixels:array, text_response:this.textresponse, total_donate:this.totalPixels};
        let json_string = JSON.stringify(submission);
        console.log("sending:" +json_string);
        let t = this;
        this.req.onload=function(){
          t.status = "Submitted, waiting for moderation approval"
        }
        this.req.onerror=function(){
          t.status = "An error occurred, please contact Lumenwright for assistance"
        }
        this.req.open("POST",pxEndpoint);
        this.req.setRequestHeader("Content-type", "application/json");
        this.req.send(json_string); 
        
        //hide the submit button 
        let sub = document.getElementById("submission_div");
        sub.style = "display:none;"
        let confirmation = document.getElementById("submit_link");
        confirmation.style = "display:block;"
        
      },
      reset(){
        this.totalPixels=0;
        this.canvasArray=[];
        this.redraw();
      },
      redraw(){
        console.log("redrawing canvas...");
        var w = this.canvas.width;
        this.ctx.clearRect(0,0,w, this.canvas.height);
        var d = this.currentCanvas;
        for(var entry in d){
          e = d[entry];
          var colour = `rgba(0, 0, 0, ${this.alphaDict[entry].alpha/255})`;
          for(var p in e){
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
      getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1) ) + min;
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
      if(this.responseText==""){
        t.status="No art to display. Click and drag to paint!";
        console.log("No alphas");
        return;
      }
      t.alphaDict = JSON.parse(this.responseText);
      console.log("Alphas receieved");
    }
    this.req.open("GET", "alphas");
    this.req.send();

    // see watched variable alphaDict for canvas drawing
  },
  watch:{
    painting:function(){
      if(this.painting){
        this.status = 'Painting...';
        return;
      }
      this.debouncedGetCanvas();
    },
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

      this.reqPx = new XMLHttpRequest();
      this.reqPx.onload= function(){
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
      this.reqPx.open("GET", pxEndpoint);
      this.reqPx.send();
      console.log("Retrieving pixels...");
    }
  },
  created:function(){
    this.debouncedGetCanvas = _.debounce(this.getTotalPixels, 500);
  }
})

//==== LOGIN =======
var login = new Vue({
  el:"#login",
  data:{
    clientId:"iplrkfjlmtjhhhsdjjg2mw8h8bhxfc",
    redirectUri:"https://community-paint-canvas.uk.r.appspot.com/login",
    scope:"",
    Url:""
  },
 mounted(){
      this.Url= "https://id.twitch.tv/oauth2/authorize?client_id="+this.clientId
      +"&redirect_uri="+this.redirectUri+"&response_type=token&scope="
    
  }
})
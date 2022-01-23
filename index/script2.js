var app = new Vue({
    el: '#app',
    data: {
      message: "Paint Canvas",
      vueCanvas:null,
      painting:false,
      canvas:null,
      ctx:null
    },
    methods: {
      startPainting(e) {
        this.painting = true;
        console.log(this.painting)
        this.draw(e)
      },
      finishedPainting() {
        this.painting = false;
        console.log(this.painting);
        this.ctx.beginPath()
      },
      draw(e) {
        if(!this.painting) return
  
        this.ctx.lineWidth = 10;
        this.ctx.lineCap ="round"
        
        this.ctx.lineTo(e.offsetX,e.offsetY)
        this.ctx.stroke()
    
        this.ctx.beginPath()
        this.ctx.moveTo(e.offsetX,e.offsetY)
  
      },
      getCanvasData(){
        let imageData = this.ctx.getImageData(0,0,this.canvas.height,this.canvas.width).data;
        let count = 0;
        console.log(imageData.length);
        for(let i=0; i<imageData.length; i++){
          if(imageData[i]>0){
            count++;
          }
        }
        console.log(count);
      }
  },

  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = canvas.getContext("2d");  
  
    // Resize canvas
    this.canvas.height = window.innerHeight;
    this.canvas.width = window.innerWidth;
  }  
})
var app = new Vue({
    el: '#app',
    data: {
      message: "Paint Canvas",
      vueCanvas:null,
      painting:false,
      canvas:null,
      ctx:null,
      status:'',
      totalPixels:0
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
        if(!this.painting) return
  
        this.ctx.lineWidth = 10;
        this.ctx.lineCap ="round"
        
        this.ctx.lineTo(e.offsetX,e.offsetY)
        this.ctx.stroke()
    
        this.ctx.beginPath()
        this.ctx.moveTo(e.offsetX,e.offsetY)
  
      },
      getTotalPixels(){
        this.status = 'Counting...';
        let imageData = this.ctx.getImageData(0,0,this.canvas.height,this.canvas.width).data;
        let count = 0;
        //console.log(imageData.length);
        for(let i=0; i<imageData.length; i++){
          if(imageData[i]>0){
            count++;
          }
        }
        this.status = 'The total number of pixels is:'
        //console.log(count);
        this.totalPixels= count;
      }
    },
  mounted() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");  
  
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

  var watchExampleVM = new Vue({
    el: '#watch-example',
    data: {
      question: '',
      answer: 'I cannot give you an answer until you ask a question!'
    },
  watch: {
    // whenever question changes, this function will run
    question: function (newQuestion, oldQuestion) {
      this.answer = 'Waiting for you to stop typing...'
      this.debouncedGetAnswer()
    }
  },
  created: function () {
    // _.debounce is a function provided by lodash to limit how
    // often a particularly expensive operation can be run.
    // In this case, we want to limit how often we access
    // yesno.wtf/api, waiting until the user has completely
    // finished typing before making the ajax request. To learn
    // more about the _.debounce function (and its cousin
    // _.throttle), visit: https://lodash.com/docs#debounce
    this.debouncedGetAnswer = _.debounce(this.getAnswer, 500)
  },
  methods: {
    getAnswer: function () {
      if (this.question.indexOf('?') === -1) {
        this.answer = 'Questions usually contain a question mark. ;-)'
        return
      }
      this.answer = 'Thinking...'
      var vm = this
      axios.get('https://yesno.wtf/api')
        .then(function (response) {
          vm.answer = _.capitalize(response.data.answer)
        })
        .catch(function (error) {
          vm.answer = 'Error! Could not reach the API. ' + error
        })
    }
  } 
})
const width = 500;
const height = 500;
const pxEndpoint = "/pixels"

var auth = new Vue({
    el:"#auth",
    data : {
        authorized:false,
        status:"Authorizing..."
    },
    mounted(){
        // Get the access token from the user login from Twitch API
        var hash = document.location.hash.split('&');
        var token = hash[0].split('=')[1];
        var username = "";
        var req = new XMLHttpRequest();
        req.onload = function(){
            var s = JSON.parse(this.responseText);
            username = s.data[0]["display_name"];
        }
        req.open("GET","https://api.twitch.tv/helix/users");
        req.setRequestHeader("Authorization", "Bearer "+token);
        req.setRequestHeader("Client-id","iplrkfjlmtjhhhsdjjg2mw8h8bhxfc")
        req.send()

        // check if the user is on the internal allow list.
        var t = this;
        req = new XMLHttpRequest();
        req.onload = function(){
            if(username==""){
                console.log(`Couldn't find user for token:${token}`);
            }
            var s = JSON.parse(this.responseText);
            var found = false;
            var list = s["data"]["allow"];
            for(var key in list){
                if(list[key] == username){
                    found = true;
                    break;
                }
            }
            if(found){
                t.authorized = true
            }
        }
        req.open("GET","data.json")
        req.send()
    },
    watch:{
        authorized:function(){
            if(this.authorized){
                this.status = "Welcome!";
                return;
            }
        }
    }
})

var drawing = new Vue({
    el:"#drawing",
    data:{
        canvas:null,
        ctx:null,
        currentCanvas:null,
        vueCanvas:null,
        display:"display:none;"
    },
    methods:{
        redraw(){
            console.log("redrawing canvas...");
            var w = this.canvas.width;
            this.ctx.clearRect(0,0,w, this.canvas.height);
            //this.ctx.putImageData(this.vueCanvas,0,0);
            var d = this.currentCanvas;
            for(var entry in d){
              e = d[entry];
              var colour = `rgba(0, 0, 0, ${this.alphaDict[entry].alpha/255})`;
              this.ctx.fillStyle =colour;
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
          var p = json_obj[entry];
          for(var px in p)
            var i = parseInt(px, 10);
            data[i] = p[px].r;
            data[i+1] = p[px].g;
            data[i+2] = p[px].b;
            data[i+3] = 255;
        }
        t.vueCanvas = array;
        t.currentCanvas = json_obj
      };
      this.reqPx.open("GET", pxEndpoint);
      this.reqPx.send();
      console.log("Retrieving pixels...");
    },
    watch:{
        vueCanvas:function(){
            console.log("vue canvas data changed");
            if(this.authorized){
                this.redraw();
                this.display="display:block;";
            }
        }
    }
})
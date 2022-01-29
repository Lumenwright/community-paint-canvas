const width = 500;
const height = 500;
const qEndpoint = "/queue"
const ivEndpoint = "/invoices"
const pxEndpoint = "/pixels"
const reviewEndpoint = "/review"
const RESPONSE_NAME = "text_response"

var auth = new Vue({
    el:"#auth",
    data : {
        authorized:false,
        status:"Logging in...",
        token:"",
        username:""
    },
    mounted(){
        // Get the access token from the user login from Twitch API
        var hash = document.location.hash.split('&');
        this.token = hash[0].split('=')[1];

        var t = this;

        //validate the token
        var validate = new XMLHttpRequest();
        validate.onload=function(){
            console.log("validation:"+this.responseText)
            var s = JSON.parse(this.responseText);
            if(s==null || s==undefined){
                this.status="Session expired, you need to log in again";
                return;
            }
            this.status = "Authorizing..."
        }
        validate.open("GET", "https://id.twitch.tv/oauth2/validate");
        validate.setRequestHeader("Authorization","Bearer "+this.token);
        validate.send();

        //get the username
        var req = new XMLHttpRequest();

        req.onload = function(){
            var s = JSON.parse(this.responseText);

            t.username = s.data[0]["display_name"].toLowerCase();
            if(t.username==null || t.username==undefined){
                console.log("Could not find username for "+this.responseText);
            }
       }
        req.open("GET","https://api.twitch.tv/helix/users");
        req.setRequestHeader("Authorization", "Bearer "+this.token);
        req.setRequestHeader("Client-id","iplrkfjlmtjhhhsdjjg2mw8h8bhxfc")
        req.send()

        // check if the user is on the internal allow list.
        var t = this;
        req = new XMLHttpRequest();
        req.onload = function(){
            if(t.username==""){
                console.log(`Couldn't find user for token:${this.token}`);
            }
            var s = JSON.parse(this.responseText);
            var found = false;
            var list = s["data"]["allow"];
            for(var key in list){
                if(list[key] == t.username){
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
                var s = "Welcome, "+this.username+"!";
                this.status = s;
                return;
            }
            else{
                this.status = "You can't view this page. Go back to the main page"
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
        queueCanvas:null,
        currentCanvas:null,
        vueCanvas:null,
        display:"display:none;",
        comment:"",
        q:[],
        curr_px_name:null,
        req:null,
        status:"Waiting for review",
        colour:"black",
        entry:null,
    },
    methods:{
        onApprove(){
            this.status = "Approved";
            this.submit();
        },
        onReject(){
            this.status = "Rejected";
            this.submit();
        },
        submit(){
            var obj = {token:auth.token, status:this.status, entry:this.curr_px_name}
            var r = new XMLHttpRequest();
            r.onload=function(){console.log("approve:"+this.responseText)}
            r.open("POST", reviewEndpoint);
            r.setRequestHeader("content-type","application/json");
            var s = JSON.stringify(obj);
            r.send(s);
        },
        loadCurrentCanvas(){
            var t = this;
            var r = new XMLHttpRequest();
            r.onload=function(){
                console.log("Pixels received");
                console.log("Constructing canvas...");
                var json_obj = JSON.parse(this.responseText);
                t.currentCanvas = json_obj; 
            }
            r.open("GET", pxEndpoint);
            r.send();
        },
        // goes to next invoice in queue
        next(){
            if(this.q[this.q.length-1]==null){
                this.status="No more to review";
                return;
            }
            this.curr_px_name = this.q.pop();
            var query = ivEndpoint+"/"+this.curr_px_name
            this.req = new XMLHttpRequest();
            this.req.onload=function(){
                console.log(this.responseText);
                var json_obj = JSON.parse(this.responseText);
                this.comment = json_obj[RESPONSE_NAME];
                this.status = "Waiting for review";
            }
            this.req.open("GET",query);
            this.req.send();
        },
        redraw(){
            console.log("drawing existing canvas...")
            var w = this.canvas.width;
            //this.ctx.putImageData(this.vueCanvas,0,0);
            var d = this.currentCanvas;
            for(var entry in d){
              this.entry = d[entry];
              this.colour = "black";
              this.paint();
            }
        },
        drawEntry(){
            var entry = this.curr_px_name;
            console.log("drawing entry: "+entry);
            this.entry = this.queueCanvas[entry];
            this.colour = "red";
            this.paint();
        },
        paint(){
            var w = this.canvas.width;
            this.ctx.fillStyle =this.colour;
            var e = this.entry;
            for(var p in e){
                var n = e[p].num;
                var x = Math.floor(n%w);
                var y = Math.floor(n/w);
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

      this.reqPx = new XMLHttpRequest();
      this.reqPx.onload= function(){
        console.log("Response received");
        console.log("Constructing canvas...");
        t.redraw();
        if(this.responseText==""){
            t.status = "Nothing to review"
            console.log(t.status);
            return;
        }
        var json_obj = JSON.parse(this.responseText);
        // data for putImageData() which doesn't work
        /*for(var entry in json_obj){
          var p = json_obj[entry];
          for(var px in p)
            var i = parseInt(px, 10);
            data[i] = p[px].r;
            data[i+1] = p[px].g;
            data[i+2] = p[px].b;
            data[i+3] = 255;
        }*/
        t.vueCanvas = array;
        t.queueCanvas = json_obj;
        for(var entry in json_obj){
            t.q.push(entry);
        }
        t.next();
        t.loadCurrentCanvas();
      };
      this.reqPx.open("GET", qEndpoint);
      this.reqPx.send();
      console.log("Retrieving pixels...");
    },
    watch:{
        curr_px_name:function(){
            console.log("processing next invoice...");
            if(auth.authorized){
                this.drawEntry();
                this.display="display:block;";
            }
        },
        status:function(){
            console.log(this.status);
        },
        currentCanvas:function(){this.redraw()}
    }
})
const width = 500;
const height = 500;
const pxEndpoint = "/pixels"
const ivEndpoint = "/invoices"
const qEndpoint = "/queue"
const reviewEndpoint = "/review"
const APPROVED_NAME = "approved"
const RESPONSE_NAME = "text_response"

var auth = new Vue({
    el:"#auth",
    data : {
        validated:false,
        authorized:false,
        status:"Logging in...",
        token:"",
        username:""
    },
    created(){
        // Get the access token from the user login from Twitch API
        var hash = document.location.hash.split('&');
        this.token = hash[0].split('=')[1];
    },
    mounted(){
        var t = this;
        //validate the token
        var validate = new XMLHttpRequest();
        validate.onload=function(){
            var s = JSON.parse(this.responseText);
            console.log("validation for token "+t.token+" completed");
            if(s==null || s==undefined){
                t.status="Session expired, you need to log in again";
                return;
            }
            t.status = "Validated...";
            t.validated=true;
        }
        validate.open("GET", "https://id.twitch.tv/oauth2/validate");
        validate.setRequestHeader("Authorization","Bearer "+this.token);
        validate.send();
    },
    watch:{
        validated:function(){
            console.log("validated");
            if(this.validated){
                //get the username
                var req = new XMLHttpRequest();
                var t = this
                req.onload = function(){
                    var s = JSON.parse(this.responseText);
    
                    t.username = s.data[0]["display_name"].toLowerCase();
                    if(t.username==null || t.username==undefined || t.username==""){
                        console.log("Could not find username for token "+t.token);
                        t.status ="Could not find your Twitch user data";
                    }
                    t.status="Checking "+t.username
                }
                req.open("GET","https://api.twitch.tv/helix/users");
                req.setRequestHeader("Authorization", "Bearer "+this.token);
                req.setRequestHeader("Client-id","iplrkfjlmtjhhhsdjjg2mw8h8bhxfc")
                req.send()

                // check if the user is on the internal allow list.
                var internal = new XMLHttpRequest();
                internal.onload = function(){
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
                internal.open("GET","data.json")
                internal.send()
                this.status = "Checking for authorization...";
            }
        },
        authorized:function(){
            if(this.authorized){
                var s = "Welcome, "+this.username+"!";
                this.status = s;
                drawing.authorized = true;
                drawing.display="display:block;";
                return;
            }
            else{
                this.status = "You can't view this page. Go back to the main page"
                return;
            }
        },
        status:function(){
            console.log(this.status);
        }
    }
})
var drawing = new Vue({
    el:"#drawing",
    data:{
        authorized:false,
        canvas:null,
        ctx:null,
        queueCanvas:null,
        currentCanvas:null,
        display:"display:none;",
        comment:"",
        q:[],
        curr_px_name:null,
        status:"Loading...",
        colour:"black",
        entry:null,
    },
    methods:{
        loadCurrentCanvas(){
            var t = this;
            var r = new XMLHttpRequest();
            r.onload=function(){
                console.log("Pixels received");
                var json_obj = JSON.parse(this.responseText);
                t.currentCanvas = json_obj; 
                if(t.currentCanvas==null || t.currentCanvas==[] || t.currentCanvas=={}){
                    t.status = "No public art to display";
                }
            }
            r.open("GET", pxEndpoint);
            r.send();
        },
        redraw(){
            this.status = "Displaying public canvas...";
            var d = this.currentCanvas;
            for(var entry in d){
                this.status = "painting entry "+entry;
                this.entry = d[entry];
                this.colour = "black";
                this.paint();
            }
            this.status = "Public canvas loaded";
        },
        paint(){
            this.status = "painting...";
            this.ctx.lineWidth = 10;
            this.ctx.lineCap ="round";
            this.ctx.strokeStyle = this.colour;
            var e = this.entry;
            for(var p in e){  
                this.ctx.lineTo(e[p]["x"],e[p]["y"]);
                this.ctx.stroke();
            
                this.ctx.beginPath();
                this.ctx.moveTo(e[p]["x"],e[p]["y"]);
            }
            this.ctx.beginPath();
            
        },
        // goes to next invoice in queue
        next(){
            if(this.q[this.q.length-1]==null){
                this.status="No more to review";
                return;
            }
            this.curr_px_name = this.q.pop();
            var query = ivEndpoint+"/"+this.curr_px_name;
            var t = this;
            var req = new XMLHttpRequest();
            req.onload=function(){
                console.log(this.responseText);
                var json_obj = JSON.parse(this.responseText);
                console.log(json_obj);
                if(json_obj[APPROVED_NAME]>0){ // if it has been reviewed
                    this.next();
                }
                t.comment = json_obj[RESPONSE_NAME];
                t.drawEntry();
                t.status = "Waiting for review";
            }
            req.open("GET",query);
            req.send();
        },
        retrieveQueue(){
            var t = this;
            var reqPx = new XMLHttpRequest();
            reqPx.onload= function(){
              t.status = "Response received";
              t.status = "Displaying approval queue...";
              if(this.responseText==""){
                  t.status = "Nothing to review"
                  console.log(t.status);
                  return;
              }
              var json_obj = JSON.parse(this.responseText);
    
              t.queueCanvas = json_obj;
              for(var entry in json_obj){
                  t.q.push(entry);
              }
              t.next();
      
            };
            reqPx.open("GET", qEndpoint);
            reqPx.send();
            this.status = "Retrieving approval queue..."
        },
        drawEntry(){
            var entry = this.curr_px_name;
            this.status = "drawing entry: "+entry;
            this.entry = this.queueCanvas[entry];
            this.colour = "red";
            this.paint();
            this.ctx.beginPath();
        },
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
        drawBorder(){
            //Draw a border around the canvas
            this.ctx.strokeWidth = 3;
            this.ctx.strokeStyle="black";
            this.ctx.strokeRect(0,0,width,height);
          },
    },
    watch:{
        authorized:function(){this.retrieveQueue()},
        currentCanvas:function(){
            this.redraw();
        },
        status:function(){console.log(this.status)}
    },
    mounted() {
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");

        // Resize canvas
        this.canvas.height = height;
        this.canvas.width = width;
        this.drawBorder();
        this.loadCurrentCanvas();
  
    },
})
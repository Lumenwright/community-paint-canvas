const width = 500;
const height = 500;

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
            console.log("validation for token "+t.token+" : "+this.responseText)
            var s = JSON.parse(this.responseText);
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
                
            }
        },
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
        },
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
        status:"Loading...",
        colour:"black",
        entry:null,
    },
})
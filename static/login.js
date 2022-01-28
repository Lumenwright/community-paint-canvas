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
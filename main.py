from flask import Flask, request
from flask_restful import Api
import requests
import pixels
import keys
import json
import invoice

#endpoints
PIXELS = '/pixels'
CLEAR = '/reset-clear'
LOGIN = '/login'
ALPHAS = '/alphas'
APPROVE = '/review'
INVOICES = '/invoices'
QUEUE = '/queue'

#files
DATA_FILE = "data.json"

#REST API
app = Flask(__name__)
api = Api(app)

api.add_resource(pixels.Pixels, PIXELS) # entry point for pixels

@app.route('/')
def index():
    with open("template/index2.html", 'r') as f:
        s= f.read()
        return s

@app.route('/style.css')
def style():
    with open("static/style.css", 'r') as f:
        s=f.read()
        return s

@app.route('/script2.js')
def script():
    with open("static/script2.js", 'r') as f:
        s=f.read()
        return s

@app.route('/vue.js')
def vue():
    with open("static/vue.js", 'r') as f:
        s=f.read()
        return s

@app.route('/login.js')
def login_script():
    with open("static/login.js", 'r') as f:
        return f.read()

@app.route('/data.json')
def mods():
    with open(DATA_FILE, 'r') as f:
        return f.read()

@app.route(APPROVE, methods=["POST"])
def review():
    s = request.get_json()
    key = s[keys.ENTRY_NAME]
    print("processing review status for "+str(s))
    #get username
    token = s[keys.TOKEN_NAME]
    headers={"Authorization":"Bearer "+token, "Client-id":"iplrkfjlmtjhhhsdjjg2mw8h8bhxfc"}
    r = requests.get("https://api.twitch.tv/helix/users", headers=headers)
    auth_response = r.json()
    print("auth response:"+str(auth_response))
    username = auth_response["data"][0]["display_name"]

    #authenticate username against list of mods
    with open(DATA_FILE, 'r') as f:
        d = json.load(f)

    list = d["data"]["allow"]
    a_name = "Approved"
    r_name = "Rejected"
    if username in list:
        #get invoice
        invoice_ref = pixels.ref.child(keys.INVOICE_NODE).child(key)
        #change approval status
        if(s[keys.STATUS_NAME]==a_name):
            invoice_ref.child(keys.APPROVED_NAME).set(invoice.Approved.APPROVED.value)
            return a_name, 200
        elif(s[keys.STATUS_NAME]==r_name):
            invoice_ref.child(keys.APPROVED_NAME).set(invoice.Approved.REJECTED.value)
            return r_name, 200
    else:
        return "not authorized", 401

@app.route(ALPHAS)
def get():
    a = pixels.ref.child(keys.ALPHA_INDEX_NODE).get()
    if(a==None):
        a=""
    return a, 200

@app.route(INVOICES+"/<entry>")
def getInvoice(entry):
    s = pixels.ref.child(keys.INVOICE_NODE).child(entry).get()
    return json.dumps(s), 200

@app.route(LOGIN)
def login():
    with open("template/login.html", 'r') as f:
        return f.read()

@app.route(QUEUE)
def getQ():
    p = pixels.ref.child(keys.Q_NODE).get()
    if(p==None):
        return ""
    return p, 200

@app.route(CLEAR)
def reset():
    curr_p = pixels.ref.child(keys.PIXELS_NAME).get()
    curr_i = pixels.ref.child(keys.INVOICE_NODE).get()
    curr_q = pixels.ref.child(keys.Q_NODE).get()
    pixels.ref.child(keys.HISTORY_NODE).child(keys.DUMP_NAME).push(curr_p)
    pixels.ref.child(keys.HISTORY_NODE).child(keys.DUMP_NAME).push(curr_q)
    pixels.ref.child(keys.INVOICE_HISTORY_NODE).child(keys.DUMP_NAME).push(curr_i)
    pixels.ref.delete(keys.PIXELS_NAME)
    pixels.ref.delete(keys.ALPHA_INDEX_NODE)
    pixels.ref.delete(keys.INVOICE_NODE)
    pixels.ref.delete(keys.Q_NODE)
    return "canvas reset", 200

if __name__ == '__main__':
    app.run() 
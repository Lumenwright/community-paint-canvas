from flask import Flask, request
from flask_restful import Api, reqparse
import pixels
import keys

#endpoints
PIXELS = '/pixels'
CLEAR = '/reset-clear'
LOGIN = '/login'
ALPHAS = '/alphas'

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
    with open("data.json", 'r') as f:
        return f.read()

@app.route(ALPHAS)
def get():
    a = pixels.ref.child(keys.ALPHA_INDEX_NODE).get()
    if(a==None):
        a=""
    return a, 200

@app.route(LOGIN)
def login():
    with open("template/login.html", 'r') as f:
        return f.read()

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
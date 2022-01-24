from flask import Flask, request
from flask_restful import Api, reqparse
import pixels

#endpoints
PIXELS = '/pixels'
CLEAR = '/reset-clear'

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

@app.route(CLEAR)
def reset():
    pixels.ref.set("")
    return "canvas reset", 200

if __name__ == '__main__':
    app.run() 
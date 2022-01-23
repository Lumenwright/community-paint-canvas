from flask import Flask, request
from flask_restful import Api, reqparse
import pixels

#endpoints
PIXELS = '/pixels'

#REST API
app = Flask(__name__)
api = Api(app)

api.add_resource(pixels.Pixels, PIXELS) # entry point for pixels

@app.route('/')
def index():
    with open("index/index2.html", 'r') as f:
        s= f.read()
        return s

@app.route('/style.css')
def style():
    with open("index/style.css", 'r') as f:
        s=f.read()
        return s

@app.route('/script2.js')
def script():
    with open("index/script2.js", 'r') as f:
        s=f.read()
        return s

@app.route('/vue.js')
def vue():
    with open("index/vue.js", 'r') as f:
        s=f.read()
        return s

@app.route('/canvas.json')
def json_canvas():
    with open("index/canvas.json", 'r') as f:
        s=f.read()
        return s

if __name__ == '__main__':
    #initialize the canvas
    with open("canvas copy.json", 'r') as g:
        copy = g.read()
    with open(pixels.CANVAS_JSON, 'w') as f:
        f.write(copy)
    app.run() 
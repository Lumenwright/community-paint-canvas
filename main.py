from flask import Flask, request
from flask_restful import Api, reqparse
import html_generator
import pixels

#endpoints
PIXELS = '/pixels'

#REST API
app = Flask(__name__)
api = Api(app)

api.add_resource(pixels.Pixels, PIXELS) # entry point for pixels
api.add_resource(pixels.Pixel, PIXELS)

@app.route('/')
def index():
    with open("index/index2.html", 'r') as f:
        s= f.read()
        return s

@app.route('/text', methods=['post'])
def post():
    textResponse = request.form['description']
    numPx = request.form['numPx']
    dict_json = {pixels.PIXELS_NAME:numPx, pixels.RESPONSE_NAME:textResponse}
    return dict_json, 200

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
    #html_generator.reset_index()
    app.run() 
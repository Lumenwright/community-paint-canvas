from flask import Flask
from flask_restful import Api
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
    with open("index/index.html", 'r') as f:
        s= f.read()
        return s

@app.route('/style.css')
def style():
    with open("index/style.css", 'r') as f:
        s=f.read()
        return s

@app.route('/script.js')
def script():
    with open("index/script.js", 'r') as f:
        s=f.read()
        return s

@app.route('/canvas.json')
def json_canvas():
    with open("index/canvas.json", 'r') as f:
        s=f.read()
        return s

if __name__ == '__main__':
    html_generator.reset_index()
    app.run() 
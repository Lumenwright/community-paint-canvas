from flask import Flask
from flask_restful import Api, Resource
import requests
import ast
import pixels
import html_generator

#endpoints
PIXELS = '/pixels'
CANVAS = '/canvas'

#REST API
app = Flask(__name__)
api = Api(app)

class HtmlCanvas(Resource):
    def get(self):
        #GET the canvas and save to var
        canvas = requests.get(api.url_for())
        page = lambda current_canvas : html_generator.generate_html(current_canvas)
        return {'html_page':page(canvas)}, 200 

api.add_resource(pixels.Pixels, PIXELS) # entry point for pixels
api.add_resource(HtmlCanvas, CANVAS) # should return the html

if __name__ == '__main__':
    app.run() 
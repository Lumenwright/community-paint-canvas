from typing import Any
from flask import Flask
from flask_restful import Resource, Api, reqparse
import json
import ast
app = Flask(__name__)
api = Api(app)

class Pixels(Resource):
    def get(self):
        with open('canvas.json', 'r') as f:
            data = json.load(f)
        return {'data':data}, 200
    pass

api.add_resource(Pixels, '/pixels') # entry point for pixels

if __name__ == '__main__':
    app.run() 
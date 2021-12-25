from typing import Any
from flask_restful import Resource, reqparse
import json

X_NAME = 'x'
Y_NAME = 'y'
RED_NAME = 'r'
GREEN_NAME = 'g'
BLUE_NAME = 'b'

class Pixels(Resource):
    def get(self):
        with open('canvas.json', 'r') as f:
            data = json.load(f)
        return {'data':data}, 200
    
    def post(self):
        parser = reqparse.RequestParser()  # initialize

        parser.add_argument(X_NAME, required=True)  # add args
        parser.add_argument(Y_NAME, required=True)
        parser.add_argument(RED_NAME,required=True)
        parser.add_argument(GREEN_NAME,required=True)
        parser.add_argument(BLUE_NAME,required=True)
        
        args = parser.parse_args()  # parse arguments to dictionary
        
        # read our json
        with open('canvas.json', 'r') as f:
            data = json.load(f)
        # add the newly provided values
        x = int(args[X_NAME])
        y = int(args[Y_NAME])
        color = [int(args[RED_NAME]), int(args[GREEN_NAME]), int(args[BLUE_NAME])]
        data[x][y]=color
        # save back
        with open('canvas.json', 'w', newline='') as f:
           json.dump(data, f, separators=(',',':'))

        return {'data': data}, 200  # return data with 200 OK
    pass
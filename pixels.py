from typing import Any
from flask_restful import Resource, reqparse
import json
import canvas as c

#argument name for incoming pixels
PIXELS_NAME = 'new pixels'

#json keys
CANVAS_NAME = 'Canvas'
ROW_NAME = 'Px_Row'
PX_NAME = 'Px'
X_NAME = 'x'
Y_NAME = 'y'
RED_NAME = 'r'
GREEN_NAME = 'g'
BLUE_NAME = 'b'

class Pixel(Resource):
    def get(self):
        with open('canvas.json', 'r') as f:
            data = json.load(f)
        return data, 200
    
    def post(self):
        parser = reqparse.RequestParser()  # initialize

        parser.add_argument(X_NAME, required=True)  # add args
        parser.add_argument(Y_NAME, required=True)
        parser.add_argument(RED_NAME,required=True)
        parser.add_argument(GREEN_NAME,required=True)
        parser.add_argument(BLUE_NAME,required=True)
        
        args = parser.parse_args()  # parse arguments to dictionary
        
        # read our canvas
        with open('canvas.json', 'r') as f:
            canvas = json.load(f)
        # add the newly provided values
        x = int(args[X_NAME])
        y = int(args[Y_NAME])
        color = [int(args[RED_NAME]), int(args[GREEN_NAME]), int(args[BLUE_NAME])]
        canvas[x][y]=color
        # save back
        c.write_to_json(canvas)          
        return canvas, 200  # return data with 200 OK
    pass

class Pixels(Resource):
    def get(self):
        with open('canvas.json', 'r') as f:
            data = json.load(f)
        return data, 200
    
    def post(self):
        parser = reqparse.RequestParser()  # initialize

        parser.add_argument(PIXELS_NAME)

        args = parser.parse_args()
        
        # read our canvas
        with open('canvas.json', 'r') as f:
            canvas = json.load(f)
        # add the newly provided values
        dict = json.load(args[PIXELS_NAME])
        
        #parse the json dictionary and replace the pixels in the canvas
        new_pixels = dict[CANVAS_NAME]
        for i in range(len(new_pixels)):
            new_row = new_pixels[i][ROW_NAME]
            for j in range(len(new_row)):
                np = new_row[j][PX_NAME]
                np_x = int(np[X_NAME])
                np_y = int(np[Y_NAME])
                current_row = canvas[CANVAS_NAME][np_x][ROW_NAME]
                current_pixel = current_row[np_y][PX_NAME]
                current_pixel[RED_NAME] = np[RED_NAME]
                current_pixel[GREEN_NAME] = np[GREEN_NAME]
                current_pixel[BLUE_NAME] = np[BLUE_NAME]
        # save back
        c.write_to_json(canvas)          
        return canvas, 200  # return data with 200 OK
    pass

#test
with open('canvas.json', 'r') as f:
    canvas = json.load(f)
print(canvas[CANVAS_NAME][0][ROW_NAME][0][PX_NAME][X_NAME])
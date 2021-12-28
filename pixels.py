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
        return data, 200
    
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
            canvas = json.load(f)
        # add the newly provided values
        x = int(args[X_NAME])
        y = int(args[Y_NAME])
        color = [int(args[RED_NAME]), int(args[GREEN_NAME]), int(args[BLUE_NAME])]
        canvas[x][y]=color
        # save back
        with open('canvas.json', 'w', newline='') as f:
            f.write("{\"canvas\":[{")
            #json.dump(data, f, separators=(',',':'))
            f.write("\"px_row\":[{\"r\":"+str(canvas[0][0][0])+",\"g\":"+str(canvas[0][0][1])+",\"b\":"+str(canvas[0][0][2]))
            for j in range(1, len(canvas[0])):
                f.write("},") 
                f.write("{\"r\":"+str(canvas[0][j][0])+",\"g\":"+str(canvas[0][j][1])+",\"b\":"+str(canvas[0][j][2]))
            for i in range(1,len(canvas)):
                f.write("}]},")
                f.write("{\"px_row\":[{\"r\":"+str(canvas[i][0][0])+",\"g\":"+str(canvas[i][0][1])+",\"b\":"+str(canvas[i][0][2]))
                for k in range(1,len(canvas[i])):
                    f.write("},") 
                    f.write("{\"r\":"+str(canvas[i][k][0])+",\"g\":"+str(canvas[i][k][1])+",\"b\":"+str(canvas[i][k][2]))
            f.write("}")
            f.write("]}")
            f.write("]}")

        return canvas, 200  # return data with 200 OK
    pass
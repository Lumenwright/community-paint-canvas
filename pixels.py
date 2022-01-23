from flask import request
from flask_restful import Resource, reqparse
import datetime
import json
import invoice
from poller import start_polling

CANVAS_JSON = 'index/canvas.json'
HISTORY_JSON = 'history/history_'
DATE_FORMAT = "%b%d%y-%H%M%S_"
#argument name for incoming pixels
PIXELS_NAME = 'new_pixels'
TOTAL_NAME = 'total_donate'
RESPONSE_NAME = 'text_response'
num_submits = 0

class Pixels(Resource):
    def resolve_submission(self, new_pixels):       
        #replace the canvas with the new one and save the history
        with open(CANVAS_JSON, 'r') as f:
            old = json.load(f)

        #append the total number of histories to the filename
        #and then save the current canvas state to it
        global num_submits
        num_submits+=1
        fn = HISTORY_JSON+datetime.datetime.now().strftime(DATE_FORMAT)+str(num_submits)+".json"
        with open(fn, 'a') as g:
            json.dump(old, g)
        
        # save the new state 
        with open(CANVAS_JSON, 'w') as h:
            json.dump(new_pixels, h)

    def get(self):
        with open(CANVAS_JSON, 'r') as f:
            data = json.load(f)
        return data, 200
    
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument(PIXELS_NAME)
        #parser.add_argument(TOTAL_NAME)
        parser.add_argument(RESPONSE_NAME)
        dict = parser.parse_args()
        #invoice.make_invoice(dict[TOTAL_NAME],dict[RESPONSE_NAME],dict[PIXELS_NAME])
        #invoice.resolve_invoice()
        self.resolve_submission(dict[PIXELS_NAME])
        return dict, 200  # return data with 200 OK
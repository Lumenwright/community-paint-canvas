from flask import request
from flask_restful import Resource, reqparse
import datetime
import json
import invoice
from poller import start_polling
from os.path import isfile

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
        np = json.loads(new_pixels)

        if isfile(CANVAS_JSON):
            with open(CANVAS_JSON, 'r') as f:
                olds = json.load(f)[PIXELS_NAME]
                old = json.loads(olds)
            f.close()
        else:
            print("creating new canvas state")
            with open(CANVAS_JSON, 'w') as h:
                json.dump({PIXELS_NAME:json.dumps(np)},h)
            h.close()
            return
        #append the total number of histories to the filename
        #and then save the current canvas state to it
        global num_submits
        num_submits+=1
        fn = HISTORY_JSON+datetime.datetime.now().strftime(DATE_FORMAT)+str(num_submits)+".json"
        with open(fn, 'a') as g:
            json.dump(old, g)
        g.close()
            
        # save the new state 
        new_state = []
        for i in range(0,len(np)-1):
            key = np[i]
            for j in range(0,len(old)-1):
                item = old[j]
                new_item = item
                if item["num"] == key["num"]:
                    new_item["r"] == key["r"]
                    new_item["g"] == key["g"]
                    new_item["b"] == key["b"]
                    new_item["a"] == key["a"]
                new_state.append(new_item)
            else:
                new_state.append(key)
        with open(CANVAS_JSON, 'w') as h:
            json.dump({PIXELS_NAME:json.dumps(new_state)}, h)
        h.close()

    def get(self):
        with open(CANVAS_JSON, 'r') as f:
            data = f.read()
        f.close()
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
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
        try:#replace the canvas with the new one and save the history
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
            new_state = []
            for key in new_pixels:
                for item in old:
                    new_item = item
                    if item["num"] == key["num"]:
                        new_item["r"] == key["r"]
                        new_item["g"] == key["g"]
                        new_item["b"] == key["b"]
                        new_item["a"] == key["a"]
                    new_state.append(new_item)
                else:
                    new_state.append(key)
            print(new_state)
            with open(CANVAS_JSON, 'w') as h:
                json.dump(new_state, h)

        except:
            print("creating new canvas state")

            with open(CANVAS_JSON, 'w') as h:
                json.dump(new_pixels,h)

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
        self.resolve_submission(json.loads(dict[PIXELS_NAME]))
        return dict, 200  # return data with 200 OK
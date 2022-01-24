from flask import request
from flask_restful import Resource, reqparse
import datetime
import json
import invoice
from poller import start_polling
from os.path import isfile

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate("community-paint-canvas-firebase-adminsdk-yq2qs-1f670317bb.json")
firebase_admin.initialize_app(cred, {'databaseURL':"https://community-paint-canvas-default-rtdb.europe-west1.firebasedatabase.app"})

# Get a database reference 
ref = db.reference('pixels')
ref_history = db.reference('history')

CANVAS_JSON = 'index/canvas.json'
HISTORY_JSON = 'history/history_'
DATE_FORMAT = "%b%d%y-%H%M%S_"
#argument name for incoming pixels
PIXELS_NAME = 'pixels'
TOTAL_NAME = 'total_donate'
RESPONSE_NAME = 'text_response'
num_submits = 0

def resolve_submission(new_pixels):
    ref.update(new_pixels)
    
class Pixels(Resource):

    def get(self):
        data = ref.get()
        return data, 200

    def post(self):
        dict = request.get_json()
        invoice.make_invoice(dict[TOTAL_NAME],dict[RESPONSE_NAME],dict[PIXELS_NAME])
        invoice.resolve_invoice()
        #self.resolve_submission(dict[PIXELS_NAME])
        return dict, 200  # return data with 200 OK
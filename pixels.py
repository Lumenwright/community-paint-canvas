from flask import request
from flask_restful import Resource
import dont_commit as dc
from invoice import make_invoice, resolve_invoice

#argument name for incoming pixels
PIXELS_NAME = 'pixels'
TOTAL_NAME = 'total_donate'
RESPONSE_NAME = 'text_response'

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate(dc.CRED_LOC)
firebase_admin.initialize_app(cred, {'databaseURL':dc.DB_URL})

# Get a database reference 
ref = db.reference()
ref_pixels = ref.child(PIXELS_NAME)

def resolve_submission(new_pixels):
    ref_pixels.update(new_pixels)

class Pixels(Resource):

    def get(self):
        data = ref_pixels.get()
        return data, 200

    def post(self):
        dict = request.get_json()
        make_invoice(ref,dict[TOTAL_NAME],dict[RESPONSE_NAME],dict[PIXELS_NAME])
        resolve_invoice(ref)
        return dict, 200  # return data with 200 OK
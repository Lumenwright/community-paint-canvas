from flask import request
from flask_restful import Resource
import invoice
import dont_commit as dc

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
ref = db.reference(PIXELS_NAME)

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
        return dict, 200  # return data with 200 OK
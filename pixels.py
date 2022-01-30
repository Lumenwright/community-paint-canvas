from flask import request
from flask_restful import Resource
import dont_commit as dc
from invoice import make_invoice, start_monitors
import keys

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

firebase_admin.initialize_app()

# Get a database reference 
ref = db.reference(path=dc.DB_URL)
ref_pixels = ref.child(keys.PIXELS_NAME)
ref_queue = ref.child(keys.Q_NODE)

#Start polling for invoices and pixels (maybe left over)
start_monitors(ref)

class Pixels(Resource):

    def get(self):
        data = ref_pixels.get()
        return data, 200

    def post(self):
        dict = request.get_json()
        key = make_invoice(ref,dict[keys.TOTAL_NAME],dict[keys.RESPONSE_NAME],dict[keys.PIXELS_NAME])
        return {"key":key}, 200  # return data with 200 OK
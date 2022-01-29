from flask import request
from flask_restful import Resource
import dont_commit as dc
from invoice import make_invoice, reduce_alpha_value, resolve, resolve_invoice
import keys

DEBUG = False

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate(dc.CRED_LOC)
firebase_admin.initialize_app(cred, {'databaseURL':dc.DB_URL})

# Get a database reference 
ref = db.reference()
ref_pixels = ref.child(keys.PIXELS_NAME)

#========= look for pixels to fade at start ============
try:
    print("checking for leftover pixels...")
    alphas = ref.child(keys.ALPHA_INDEX_NODE).get()
    if(alphas == None):
        raise TypeError("No alphas")
    pixels = ref.child(keys.PIXELS_NAME).get()
    for key in alphas:
        reduce_alpha_value(ref, alphas[key][keys.TIME_NAME], key)
except(TypeError):
    print("no pixels left from last run")

# ========= look for invoices to review =================
try:
    print("checking for outstanding invoices...")
    invoices = ref.child(keys.INVOICE_NODE).get()
    if(invoices == None):
        raise TypeError("No invoices")
    if(DEBUG):
        for entry in ref.child(keys.INVOICE_NODE).get(shallow=True):
            resolve(ref, entry)
    else:
        resolve_invoice(ref)
except TypeError:
    print("no outstanding invoices")
#========================================================

class Pixels(Resource):

    def get(self):
        data = ref_pixels.get()
        return data, 200

    def post(self):
        dict = request.get_json()
        make_invoice(ref,dict[keys.TOTAL_NAME],dict[keys.RESPONSE_NAME],dict[keys.PIXELS_NAME])

        if(DEBUG):
            for entry in ref.child(keys.INVOICE_NODE).get(shallow=True):
                resolve(ref, entry)
        else:
            resolve_invoice(ref)
            return dict, 200  # return data with 200 OK
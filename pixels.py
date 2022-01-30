from flask import request
from flask_restful import Resource
import dont_commit as dc
from invoice import make_invoice, start_monitors
import keys

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate(dc.CRED_LOC)
firebase_admin.initialize_app(cred, {'databaseURL':dc.DB_URL})

# Get a database reference 
ref = db.reference()
ref_pixels = ref.child(keys.PIXELS_NAME)

#Start polling for invoices and pixels (maybe left over)
start_monitors(ref)

'''
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
    invoices = ref.child(keys.INVOICE_NODE).get(shallow=True)
    if(invoices == None):
        raise TypeError("No invoices")
except TypeError:
    print("no outstanding invoices")
else:    
    for entry in invoices:
        if(DEBUG):
            resolve(ref, entry)
        else:
            resolve_invoice(ref, entry)

#========================================================
'''
class Pixels(Resource):

    def get(self):
        data = ref_pixels.get()
        return data, 200

    def post(self):
        dict = request.get_json()
        key = make_invoice(ref,dict[keys.TOTAL_NAME],dict[keys.RESPONSE_NAME],dict[keys.PIXELS_NAME])
        return {"key":key}, 200  # return data with 200 OK
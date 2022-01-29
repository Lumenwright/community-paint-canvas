import json
import requests
import dont_commit
from datetime import datetime as dt
from time import time
from poller import start_polling, wait_for_bool
import keys
import math
from enum import Enum

DATE_FORMAT = "%b%d%y-%H%M%S"
INTERVAL = 5.0 #seconds

GRACE_TIME = 120 # seconds to wait before fading
FADE_TIME = 120 #seconds to fade out pixels
FADE_STEPS = 10 #number of "steps" to fade out pixels
MAX_ALPHA = 255
FADE_PER_STEP = math.floor(MAX_ALPHA / FADE_STEPS)
FADE_TIME_PER_STEP = math.floor(FADE_TIME / FADE_STEPS)

class Approved(Enum):
    NOT_REVIEWED = 0
    APPROVED = 1
    REJECTED = 2

def make_invoice(ref,total_donate, response, new_pixels):
    s = {
        keys.RESPONSE_NAME:response,
     keys.TOTAL_NAME: total_donate, 
     keys.TIME_NAME:dt.now().strftime(DATE_FORMAT), 
     keys.HEARTBEAT_TIME_NAME:time(),
     keys.APPROVED_NAME:Approved.NOT_REVIEWED.value
     }
    autoID = ref.child(keys.INVOICE_NODE).push()
    autoID.update(s)
    ref.child(keys.Q_NODE).update({autoID.key:new_pixels})
    return autoID.key

# change the stored transparency value of each batch of pixels
# that will be drawn on the canvas
# If the alpha <= 0 then remove the pixels from the canvas
def reduce_alpha_value(ref, entry_time, key):
    curr_t = time()
    diff = curr_t - entry_time - GRACE_TIME
    print("reducing alpha for entry "+str(entry_time))
    print("time difference: "+str(diff))
    
    if(diff > FADE_TIME):
        ref.child(keys.PIXELS_NAME).child(key).delete()
        ref.child(keys.ALPHA_INDEX_NODE).child(key).delete()
        return
    elif(diff > FADE_TIME_PER_STEP ):
        fade_amount = math.floor(diff/FADE_TIME_PER_STEP*FADE_PER_STEP)
        ref.child(keys.ALPHA_INDEX_NODE).child(key).child(keys.ALPHA_NAME).set(MAX_ALPHA - fade_amount)
    start_polling(lambda:reduce_alpha_value(ref, entry_time, key), FADE_TIME_PER_STEP)

#resolve invoice
def resolve_invoice(ref, key):
    #get the last 10 donations
    header = {"Authorization":"Bearer "+dont_commit.AT}
    r = requests.get("https://tiltify.com/api/v3/campaigns/"+dont_commit.ID+"/donations", headers=header)
    d = json.loads(r.text)
    donations = d["data"]

    #compare response to text in invoice
    invoice_entry = ref.child(keys.INVOICE_NODE).child(key).get()
    found = False
    matching_key =""

    for donation in donations:
        code = donation["comment"]
        entry = invoice_entry[keys.RESPONSE_NAME]
        if(entry in code):
            found = True
            matching_key = key
            break
    if(found):
        resolve(ref, matching_key)
    else:
        print("invoices: couldn't find any matching donations yet")
        start_polling(lambda: resolve_invoice(ref, key), INTERVAL)


def resolve(ref,matching_entry):
    matching_entry_ref =ref.child(keys.INVOICE_NODE).child(matching_entry)
    matching_entry_pixels_ref = ref.child(keys.Q_NODE).child(matching_entry)
    def resolve_pixels():
        print("resolving invoice:"+matching_entry)
        resolve_submission(ref, matching_entry_pixels_ref.get(), matching_entry)
        make_histories(ref,matching_entry,matching_entry_ref,matching_entry_pixels_ref)

    invoice = matching_entry_ref.get()
    if invoice[keys.APPROVED_NAME]==Approved.APPROVED.value:
        resolve_pixels()
    elif invoice[keys.APPROVED_NAME]==Approved.NOT_REVIEWED.value:
        print("found matching invoice "+matching_entry+", waiting for moderator approval")
        start_polling(lambda: resolve(ref,matching_entry),INTERVAL)
    else:
        print("invoice "+matching_entry+" was rejected, storing in history")
        make_histories(ref,matching_entry,matching_entry_ref,matching_entry_pixels_ref)


def resolve_submission(ref, new_pixels, key):
    # add pixels to canvas database
    entry_time = int(time())
    ref.child(keys.PIXELS_NAME).child(key).update(new_pixels)
    ref.child(keys.ALPHA_INDEX_NODE).child(key).set({keys.TIME_NAME:entry_time, keys.ALPHA_NAME:MAX_ALPHA})
    # start a new timer for fading out the pixels
    start_polling(lambda:reduce_alpha_value(ref,entry_time, key),GRACE_TIME)

def make_histories(ref,matching_entry, matching_entry_ref, matching_entry_pixels_ref):
        e = {
            keys.RESOLVE_TIME:dt.now().strftime(DATE_FORMAT),
            keys.RESOLVE_HEARTBEAT_TIME:time(),
            keys.INVOICE_NODE:matching_entry_ref.get()
            }
        h = {matching_entry:matching_entry_pixels_ref.get()}
        ref.child(keys.HISTORY_NODE).update(h)
        ref.child(keys.INVOICE_HISTORY_NODE).child(matching_entry).set(e)
        matching_entry_ref.delete()
        matching_entry_pixels_ref.delete()
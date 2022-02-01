import json
import requests
import dont_commit
from datetime import datetime as dt
from time import time
from poller import RepeatedTimer
import keys
import math
from enum import Enum

DEBUG = False

DATE_FORMAT = "%b%d%y-%H%M%S"
INTERVAL = 5.0 #seconds

GRACE_TIME = 1200 # seconds to wait before fading
FADE_TIME = 120 #seconds to fade out pixels
FADE_STEPS = 10 #number of "steps" to fade out pixels
MAX_ALPHA = 255
FADE_PER_STEP = math.floor(MAX_ALPHA / FADE_STEPS)
FADE_TIME_PER_STEP = math.floor(FADE_TIME / FADE_STEPS)

class Approved(Enum):
    NOT_REVIEWED = 0
    APPROVED = 1
    REJECTED = 2

# start loop to check for and resolve invoices
def start_monitors(ref):
    print("starting to poll for invoices and pixels")
    timer = RepeatedTimer(INTERVAL,resolve_invoice, ref)
    a_timer = RepeatedTimer(INTERVAL,reduce_alpha_value, ref)

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
def reduce_alpha_value(ref):
    curr_entries = ref.child(keys.ALPHA_INDEX_NODE).get()
    if curr_entries == None:
        print("No alphas")
        return

    for key in curr_entries:   
        curr_t = time()
        entry_time = curr_entries[key][keys.TIME_NAME]
        diff = curr_t - entry_time - GRACE_TIME
        print("reducing alpha for entry "+key)
        print("from alpha: "+str(curr_entries[key][keys.ALPHA_NAME]))
        
        if(diff > FADE_TIME):
            ref.child(keys.PIXELS_NAME).child(key).delete()
            ref.child(keys.ALPHA_INDEX_NODE).child(key).delete()
            return
        elif(diff > FADE_TIME_PER_STEP ):
            fade_amount = math.floor(diff/FADE_TIME_PER_STEP*FADE_PER_STEP)
            ref.child(keys.ALPHA_INDEX_NODE).child(key).child(keys.ALPHA_NAME).set(MAX_ALPHA - fade_amount)

#to be run every INTERVAL while there are invoices
def resolve_invoice(ref):

    #Get list of current invoices
    invoices = ref.child(keys.INVOICE_NODE).get()

    if(invoices==None):
        print("No invoices")
        return

    # if debugging, don't match invoice to comment, just resolve it    
    if(DEBUG):
        for entry in invoices:
            resolve(ref, entry,"bypass matching")
        return

    #get Tiltify authorization and last 10 donations
    header = {"Authorization":"Bearer "+dont_commit.AT}
    r = requests.get("https://tiltify.com/api/v3/campaigns/"+dont_commit.ID+"/donations", headers=header)
    d = json.loads(r.text)
    donations = d["data"]

    #For every invoice, search for a matching donation
    # where comments match and the drawing is earlier than the donation
    matching_keys =[]
    for entry in invoices:
        # if there's a rejected invoice, don't bother looking/waiting for donation
        isApproved = invoices[entry][keys.APPROVED_NAME]
        if isApproved == Approved.REJECTED.value:
            reject(ref, entry)
            continue

        c = str.lower(invoices[entry][keys.RESPONSE_NAME])
        t = invoices[entry][keys.HEARTBEAT_TIME_NAME]
        n = str.lower(invoices[entry][keys.NAME_FIELD])
        for donation in donations:
            
            if(donation["comment"]=="" or donation["comment"]==None):
                code = ""
            else:
                code = str.lower(donation["comment"])

            if(donation["name"]=="" or donation["name"]==None):
                dono_name=""
            else:
                dono_name = str.lower(donation["name"])

            time_donate = donation["completedAt"]
            if((n=="" or n==dono_name) and int(t) < int(time_donate)):
                if(c =="" and code == ""):
                    matching_keys.append(entry)
                    break
                if(c in code):
                    matching_keys.append(entry)
                    break
    
    print("Found matches:"+str(matching_keys))
    #For each match, check which are approved or rejected
    for matching_entry in matching_keys:
        resolve(ref, matching_entry, code)

#resolve a given entry
def resolve(ref, key, code):
    entry_ref =ref.child(keys.INVOICE_NODE).child(key)

    invoice = entry_ref.get()
    entry_pixels_ref = ref.child(keys.Q_NODE).child(key)

    isApproved = invoice[keys.APPROVED_NAME]

    #if approved, move the pixels in queue to the canvas
    #else if rejected, move the pixels in queue directly to the history
    #else don't do anything
    if isApproved == Approved.APPROVED.value:
        print("resolving approved invoice:"+key)
        new_pixels = entry_pixels_ref.get()
        print(new_pixels)
        resolve_submission(ref, new_pixels,key)
        make_histories(ref,key,entry_ref,entry_pixels_ref)
    elif isApproved == Approved.REJECTED.value:
        reject(ref, key)
    elif isApproved == Approved.NOT_REVIEWED.value:
        print("found matching invoice "+key+", waiting for moderator approval")
        print(key+": invoice: \""+invoice[keys.RESPONSE_NAME]+"\" vs comment: \""+code+"\"")
    else:
        print("You need to check approval status of entry "+key)

def resolve_submission(ref, new_pixels, key):
    # add pixels to canvas database
    entry_time = int(time())
    new_pixels = {i:new_pixels[i] for i in range(0,len(new_pixels))} #convert list to dictionary
    ref.child(keys.PIXELS_NAME).child(key).update(new_pixels)
    ref.child(keys.ALPHA_INDEX_NODE).child(key).set({keys.TIME_NAME:entry_time, keys.ALPHA_NAME:MAX_ALPHA})

def make_histories(ref,entry, entry_ref, entry_pixels_ref):
    e = {
        keys.RESOLVE_TIME:dt.now().strftime(DATE_FORMAT),
        keys.RESOLVE_HEARTBEAT_TIME:time(),
        keys.INVOICE_NODE:entry_ref.get()
        }
    h = {entry:entry_pixels_ref.get()}
    ref.child(keys.HISTORY_NODE).update(h)
    ref.child(keys.INVOICE_HISTORY_NODE).child(entry).set(e)
    entry_ref.delete() #delete from current invoices
    entry_pixels_ref.delete() #delete from queue

def reject(ref, entry):
    print("invoice "+entry+" was rejected, storing in history")
    make_histories(ref,entry,ref.child(keys.INVOICE_NODE).child(entry),ref.child(keys.Q_NODE).child(entry))
    ref.child(keys.REJECTED_HISTORY_NODE).update({entry:True})

import json
import requests
import dont_commit
import pixels
from datetime import datetime as dt
from poller import start_polling

INVOICE_NODE = 'invoice'
HISTORY_NODE = 'history'
DATE_FORMAT = "%b%d%y-%H%M%S"
index = 0
ref = pixels.db.reference(INVOICE_NODE)
ref_history = pixels.db.reference(HISTORY_NODE)

def make_invoice(total_donate, response, new_pixels):
    s = {response:{pixels.TOTAL_NAME: total_donate, pixels.PIXELS_NAME:new_pixels}}
    ref.update(json.dumps(s))

#resolve invoice
def resolve_invoice():
    #get the last 10 donations
    header = {"Authorization":"Bearer "+dont_commit.AT}
    r = requests.get("https://tiltify.com/api/v3/campaigns/"+dont_commit.ID+"/donations", headers=header)
    d = json.loads(r.text)
    donations = d["data"]

    #compare response to text in invoice
    invoice_entries = ref.get(shallow=True) #just get the comments
    found = False
    matching_entry_pixels = {}
    matching_entry =""

    for donation in donations:
        for entry in invoice_entries:
            code = donation["comment"]
            if(entry==code):
                found = True
                matching_entry = entry
                matching_entry_pixels = ref.child(entry).get()[pixels.PIXELS_NAME]
                break
    if(found):
        print("resolving invoice:"+matching_entry)
        pixels.resolve_submission(matching_entry_pixels)
        h = {dt.now().strftime(DATE_FORMAT):matching_entry_pixels}
        ref_history.update(h)
        ref.child(entry).delete()
    else:
        print("couldn't find match")
        start_polling(resolve_invoice)
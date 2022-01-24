import json
import requests
import dont_commit
import pixels
from poller import start_polling

INVOICE_FILE = 'invoice.json'
index = 0

def make_invoice(total_donate, response, new_pixels):
    s = {response:{pixels.TOTAL_NAME: total_donate, pixels.PIXELS_NAME:new_pixels}}
    with open(INVOICE_FILE,'w', newline='') as f:
        json.dump(s, f)

#resolve invoice
def resolve_invoice():
    #get the last 10 donations
    header = {"Authorization":"Bearer "+dont_commit.AT}
    r = requests.get("https://tiltify.com/api/v3/campaigns/"+dont_commit.ID+"/donations", headers=header)
    d = json.loads(r.text)
    donations = d["data"]

    #compare response to text in invoice
    with open(INVOICE_FILE, 'r+') as f:
        invoice = json.load(f)
        found = False
        matching_entry_pixels = {}
        matching_entry =""

        for donation in donations:
            for entry in invoice:
                code = donation["comment"]
                if(entry==code):
                    found = True
                    matching_entry = entry
                    matching_entry_pixels = invoice[entry][pixels.PIXELS_NAME]
                    break
        if(found):
            print("resolving invoice:"+matching_entry)
            pixels.resolve_submission(matching_entry_pixels)
            invoice.pop(entry)
            f.seek(0)
            json.dump(invoice,f)
            f.truncate()
        else:
            print("couldn't find match")
            start_polling(resolve_invoice)

#if(__name__ == '__main__'):
    #make_invoice(1.00, "test")
    #resolve_invoice()
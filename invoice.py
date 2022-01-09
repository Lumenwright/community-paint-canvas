import json
import requests
import dont_commit
import pixels

INVOICE_FILE = 'invoice.json'
index = 0

def make_invoice(total_donate, response):
    s = {response:{"total_donate": total_donate}}
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
        while(not found):
            for donation in donations:
                for entry in invoice:
                    code = donation["comment"]
                    if(entry==code):
                        print(code)
                        found = True
                        break
        if(found):
            invoice.pop(entry)
            f.seek(0)
            json.dump(invoice,f)
            f.truncate()
        else:
            print("couldn't find match")

#if(__name__ == '__main__'):
    #make_invoice(1.00, "test")
    #resolve_invoice()
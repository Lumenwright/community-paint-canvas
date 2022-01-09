import json
def make_invoice(total_donate, response):
    s = {"total_donate": total_donate, "response": response}
    with open('invoice.json','w', newline='') as f:
        json.dump(s, f)

#resolve invoice
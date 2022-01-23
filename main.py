from flask import Flask, request
from flask_restful import Api, reqparse
import pixels

#firebase auth
import firebase_admin
from firebase_admin import credentials, db

cred = credentials.Certificate("community-paint-canvas-firebase-adminsdk-yq2qs-1f670317bb.json")
firebase_admin.initialize_app(cred)

# Get a database reference 
ref = db.reference('server/saving_data')
users_ref = ref.child('users')
users_ref.set({
    'alanisawesome': {
        'date_of_birth': 'June 23, 1912',
        'full_name': 'Alan Turing'
    },
    'gracehop': {
        'date_of_birth': 'December 9, 1906',
        'full_name': 'Grace Hopper'
    }
})

#endpoints
PIXELS = '/pixels'

#REST API
app = Flask(__name__)
api = Api(app)

api.add_resource(pixels.Pixels, PIXELS) # entry point for pixels

@app.route('/')
def index():
    with open("index/index2.html", 'r') as f:
        s= f.read()
        return s

@app.route('/style.css')
def style():
    with open("index/style.css", 'r') as f:
        s=f.read()
        return s

@app.route('/script2.js')
def script():
    with open("index/script2.js", 'r') as f:
        s=f.read()
        return s

@app.route('/vue.js')
def vue():
    with open("index/vue.js", 'r') as f:
        s=f.read()
        return s

@app.route('/canvas.json')
def json_canvas():
    with open("index/canvas.json", 'r') as f:
        print("reading canvas...")
        s=f.read()
        return s

if __name__ == '__main__':
    app.run() 
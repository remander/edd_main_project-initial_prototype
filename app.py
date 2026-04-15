# git push --mirror https://github.com/suvitasnani/posture-pro.git

# Project Name: PosturePro
# File Name: main.py
# Date: 24 May 2025
# Description: Flask app for Flask + Firebase + Arduino
# Group: Sensor-4

# Import necessary libraries
from flask import Flask, render_template, url_for, request, jsonify
from datetime import datetime
import pyrebase

# Initialize Flask app
app = Flask(__name__)
config = {}
key = 0  # If recording data over time, keys should be seconds or milliseconds from 0.
db = None  # Initialize db as None
userID = None  # Initialize userID
timeStamp = None  # Initialize timeStamp

# Notes:
# 1. The @app.route parameter (in parentheses) should match the name of the page to which it routes, without the ".html"
#    Ex. If routing to signIn.html: @app.route("/signIn") -- You need to add the forward slash before the parameter
#    The only exception is the @app.route for the index page: @app.route("/")
# 2. When linking to index.html from other HTML pages when using Flask,
#    use {{url_for('index')}}. The name of the python function (__name__) is used as the endpoint,
#    unless you specify the endpoint argument explicitly.
#    Ex. {{url_for('index')}} will redirect the user to index.html because "index" is the name of the defined route function.

@app.route("/")  # Landing Page
def index():
    return render_template("index.html")

@app.route("/register")  # Account Registration Page
def register():
    return render_template("register.html")

@app.route("/signIn")  # Sign In Page
def signIn():
    return render_template("signIn.html")

@app.route("/home")  # Account Home Page
def home():
    return render_template("home.html", active_page="home")

@app.route("/team")  # Account Home Page
def team():
    return render_template("team.html", active_page="team")
    
@app.route("/portal")  # Account Home Page
def portal():
    return render_template("portal.html", active_page="portal")

@app.route("/about")  # Account Home Page
def about():
    return render_template("about.html", active_page="about")

@app.route("/demo")  # Account Home Page
def demo():
    return render_template("demo.html", active_page="demo")

@app.route("/procedure")  # Procedure Page
def procedure():
    return render_template("procedure.html", active_page="procedure")

# Route to test Pyrebase setup
@app.route("/test", methods=['GET', 'POST'])
def test():
    global config, userID, db, timeStamp, key

    # POST request (FB configuration sent from login.js, request.method defaults to GET)
    if request.method == 'POST':
        try:
            # Receive Firebase configuration credentials
            config = request.get_json()  # parse as JSON
            
            # Check if userID exists in config
            if 'userID' not in config:
                print("userID not found in config", flush=True)
                return "userID not found in configuration", 400
                
            # Extract userID
            userID = config.pop('userID')
            
            # Get timestamp to be used as Firebase node
            timeStamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            
            # Initialize Firebase connection
            firebase = pyrebase.initialize_app(config)
            
            # Create database object
            db = firebase.database()
            
            print('User ID: ' + userID, flush=True)  # Debug only
            print(config, flush=True)  # Debug only

            # Write sample data to Firebase to test connection
            db.child('users/' + userID + '/data/' + timeStamp).update({'testKey': 'testValue'})
            
            return 'Success', 200
            
        except Exception as e:
            print(f"Error in POST request: {e}", flush=True)
            return f"Error: {str(e)}", 500
            
    # GET request handling (from Arduino)
    else:
        try:
            if not config:
                print("FB config is empty")
                return "Error: Firebase configuration missing", 400
                
            if db is None:
                print("Firebase database is not initialized")
                return "Error: Firebase database not initialized", 500
                
            # Take parameters from Arduino request
            value = request.args.get('combined')
            if not value:
                return "Error: No sensor value provided", 400
                
            print(f"Received sensor value: {value}", flush=True)
                
            # Write arduino data to Firebase
            db.child('users/' + userID + '/data/' + timeStamp).update({str(key): value})
            
            # Increment key
            key += 1
            
            return "Success", 200
            
        except Exception as e:
            print(f"Error in GET request: {e}", flush=True)
            return f"Error: {str(e)}", 500
        

# Route to update sensor status
@app.route("/updateStatus", methods=['GET'])
def update_status():
    try:
        if not config:
            print("FB config is empty")
            return "Error: Firebase configuration missing", 400
            
        if db is None:
            print("Firebase database is not initialized")
            return "Error: Firebase database not initialized", 500
            
        # Take status from request
        status = request.args.get('status')
        if not status:
            return "Error: No status provided", 400
            
        print(f"Received sensor status: {status}", flush=True)
        
        # Get current timestamp for consistency
        timeStamp = datetime.now().strftime("%Y/%m/%d/%H%M%")
        
        # Update the status node; will replace any existing data at this path
        db.child('users/' + userID + '/status').update({'connectionStatus': status})
        
        return 'Status updated', 200
        
    except Exception as e:
        print(f"Error in status update: {e}", flush=True)
        return f"Error: {str(e)}", 500

# Run server on local IP Address on port 5000
if __name__ == "__main__":
    app.run(debug=True, port = 5000)
    # app.run(debug=True, host='192.168.137.117', port=5000)


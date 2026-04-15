// Project Name: PosturePro
// File Name: signIn.js
// Date: 24 May 2025
// Description: Sign-in functionality for users. Allows users to sign in with email and password, and stores user data in Firebase.
// Group: Sensor-4

// ----------------- User Sign-In Page --------------------------------------//

// ----------------- Firebase Setup & Initialization ------------------------//
// Import the functions you need from the SDKs you need

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { getDatabase, ref, set, update, child, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDPcAa2CsSwlMdm48GCjNvi0b_GVowx_aA",
    authDomain: "wearable-sensor-2425.firebaseapp.com",
    databaseURL: "https://wearable-sensor-2425-default-rtdb.firebaseio.com",
    projectId: "wearable-sensor-2425",
    storageBucket: "wearable-sensor-2425.firebasestorage.app",
    messagingSenderId: "930846894252",
    appId: "1:930846894252:web:7572563039ba8022ca9709"
  };
  
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  
  // Initialize Firebase Authentication
  const auth = getAuth();
  
  // Return an instance of your app's database
  const db = getDatabase(app);

// ---------------------- Sign-In User ---------------------------------------//
document.getElementById('signIn').onclick = function () {

    // Get user's email and password for sign in
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Attempt to sign user in
    signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        // Create user credential & store user ID
        const user = userCredential.user;

        // Log sign-in
        // update - will only add the last_login info and won't overwrite 
        let logDate = new Date();
        update(ref(db, 'users/' + user.uid + '/accountInfo'), {
            last_login: logDate, 
        })
        .then(() => {            // User signed in successfully
            const performLoginActions = () => {
                // Get snapshot of all the user info (including uid) to pass to
                // the login () function and store in session or local storage
                get(ref(db, 'users/' + user.uid + '/accountInfo')).then((snapshot) => {
                    if (snapshot.exists()) {
                        logIn(snapshot.val(), firebaseConfig); 
                    } else {
                        console.log("No data available");
                        if (window.errorAlert) {
                            alert("User data not found after sign-in.");
                        }
                    }
                }).catch((error) => {
                    console.error("Error fetching user account info:", error);
                    if (window.errorAlert) {
                        alert("Failed to fetch user data: " + error.message);
                    }
                });
            };

            if (window.successAlert) {
              window.successAlert('User signed in successfully', 'Sign In Successful', performLoginActions);
            } else {
              alert('User signed in successfully');
              performLoginActions(); 
            }
        })
        .catch((error) => {
            console.log(error);
        })
    })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        if (window.errorAlert) {
            window.errorAlert(errorMessage, "Sign In Error");
        } else {
            alert(errorMessage);
        }
    })
}




// ---------------- Keep User Logged In ----------------------------------//
function logIn(user, firebaseConfig) {
    let keepLoggedIn = document.getElementById('keepLoggedInSwitch').ariaChecked;

    // Session storage is temporary (only while session is active)
    // Information saved as a string (must convert JS object to a string)
    // Session storage will be cleared with a signOut() function in home.js

    firebaseConfig.userID = user.uid; // Add userID to FB config to pass to Flask

    if(!keepLoggedIn){
        sessionStorage.setItem('user', JSON.stringify(user));

        // Send Firebase config. and user ID to app.py using POST
        fetch('/test', {
            "method": "POST",
            "headers": { "Content-Type": "application/json"}, 
            "body": JSON.stringify(firebaseConfig)
        })

        //alert(firebaseConfig)     // Debug only
        window.location = 'portal';   // Redirect browser to home page
                                    // Remove the .html on "home.html" or else Flask will throw an error
    }

    // Local storage is permanent (keep user logged in even if browser is closed)
    // Local storage will be cleared with a signOut() function in home.js

    else {
        localStorage.setItem('keepLoggedIn', 'yes');
        localStorage.setItem('user', JSON.stringify(user));

        // Send Firebase config. and user ID to app.py using POST
        fetch('/test', {
            "method": "POST",
            "headers": { "Content-Type": "application/json"}, 
            "body": JSON.stringify(firebaseConfig),
        })

        //alert(firebaseConfig)     // Debug only
        window.location = 'home';   // Redirect browser to home page
                                    // Remove the .html on "home.html" or else Flask will throw an error
  
    }
}
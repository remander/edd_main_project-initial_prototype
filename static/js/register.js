// git push --mirror https://github.com/suvitasnani/posture-pro.git

// Project Name: PosturePro
// File Name: register.js
// Date: 24 May 2025
// Description: User registration functionality for the PosturePro application. Allows users to create an account with email and password, and stores user data in Firebase.
// Group: Sensor-4

// ----------------- Firebase Setup & Initialization ------------------------//
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { getDatabase, ref, set, update, child, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";



// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

// ---------------- Register New User --------------------------------//

document.getElementById('submitData').onclick = function() {
  const firstname = document.getElementById('firstname').value;
  const lastName = document.getElementById('lastName').value;
  const email = document.getElementById('userEmail').value;

  // Firebase requires a password of at least 6 characters
  const password = document.getElementById('userPass').value;

  // Validate user inputs
  if(!validation(firstname, lastName, email, password)) {
    return;
  };

  // Create new app user using email/password auth
  createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Create user credential
    const user = userCredential.user;
    
    // Add user account info to realtime database
    // set - will create a new ref. (reference) or completely replace exisiting one
    // Each new user will be placed under the 'users' node
    set(ref(db, 'users/' + user.uid + '/accountInfo'), {
      uid: user.uid,  // save userID for home.js reference
      email: email,
      password: encryptPass(password),
      firstname: firstname,
      lastname: lastName
    })    .then(() => {
      // Data saved successfully!
      if (window.successAlert) {
        window.successAlert("User created successfully!", "Registration Complete", function() {
          window.location.href = '../signIn';
        });
      } else {
        alert("User created successfully!");
        window.location.href = '../signIn';
      }
    })
    .catch((error) => {
      // Data write failed...
      if (window.errorAlert) {
        window.errorAlert(error, "Registration Error");
      } else {
        alert(error)
      }
    });
  })  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    if (window.errorAlert) {
      window.errorAlert(errorMessage, "Registration Error");
    } else {
      alert(errorMessage);
    }
  });


}

// --------------- Check for null, empty ("") or all spaces only ------------//
function isEmptyorSpaces(str){
  return str === null || str.match(/^ *$/) !== null
}

// ---------------------- Validate Registration Data -----------------------//

// Validate user inputs using RegEx for registration
function validation(firstname, lastName, email, password) {
  let fNameRegex = /^[a-zA-Z]+$/;
  let lNameRegex = /^[a-zA-Z]+$/;
  let emailRegex = /^[a-zA-Z0-9]+@ctemc\.org$/;
  if (isEmptyorSpaces(firstname) || isEmptyorSpaces(lastName) || isEmptyorSpaces(email) || isEmptyorSpaces(password)) {
    if (window.errorAlert) {
      window.errorAlert("Please complete all fields", "Validation Error");
    } else {
      alert("Please complete all fields");
    }
    return false;
  };

  // Check if first name, last name, and email match the regex patterns
  if (!fNameRegex.test(firstname)) {
    if (window.errorAlert) {
      window.errorAlert("First name should only contain letters.", "Validation Error");
    } else {
      alert("First name should only contain letters.");
    }
    return false;
  }

  if (!lNameRegex.test(lastName)) {
    if (window.errorAlert) {
      window.errorAlert("Last name should only contain letters.", "Validation Error");
    } else {
      alert("Last name should only contain letters.");
    }
    return false;
  }

  if (!emailRegex.test(email)) {
    if (window.errorAlert) {
      window.errorAlert("Please enter a valid email.", "Validation Error");
    } else {
      alert("Please enter a valid email.");
    }
    return false;
  }

  return true;
}
// --------------- Password Encryption -------------------------------------//

// Encrypt the password using crypto.js
function encryptPass(password) {
  let encrypted = CryptoJS.AES.encrypt(password, password)
  return encrypted.toString();
}

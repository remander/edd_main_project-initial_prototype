// git push --mirror https://github.com/suvitasnani/posture-pro.git

// Project Name: PosturePro
// File Name: loggedIn.js
// Date: 24 May 2025
// Description: Javascript for Generating Elements After User Login. Includes updating the navbar and
//              handling user session data. 
// Group: Sensor-4

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import {getAuth,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {getDatabase, ref, set, update, child, get} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Web App Firebase configuration
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
const auth = getAuth();
const db = getDatabase();

// Function to check if the user is logged in
function isLoggedIn() {
    return localStorage.getItem('user') !== null || sessionStorage.getItem('user') !== null;
}

// Wait for the document to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
    // Get the elements
    const loggedInElement = document.getElementById('loggedIn');
    const notLoggedInElement = document.getElementById('notLoggedIn');

    // Show or hide the elements based on login status
    if (isLoggedIn()) {
        loggedInElement.style.display = 'block';
        notLoggedInElement.style.display = 'none';
    } else {
        loggedInElement.style.display = 'none';
        notLoggedInElement.style.display = 'block';
    }
});

// Function to log out the user
function logout() {
	sessionStorage.removeItem("user"); // Clear session storage
	localStorage.removeItem("user"); // Clear local storage
	localStorage.removeItem("keepLoggedIn"); // Clear logged in setting

	signOut(auth)
		.then(() => {
			// Sign out successful
		})
		.catch((error) => {
			// Error occured
		});

	window.location = "signIn";
}


// Function to update the authentication button
function updateButton() {
    const authButton = document.getElementById("authButton");
    authButton.classList.add("auth-button"); // Add the base class

    if (localStorage.getItem("user") || sessionStorage.getItem("user")) {
        authButton.innerHTML = "Log Out";
        authButton.classList.add("log-out");
        authButton.classList.remove("sign-in");
        authButton.addEventListener("click", logout);
    } else {
        authButton.innerHTML = "Sign In";
        authButton.classList.add("sign-in");
        authButton.classList.remove("log-out");
        authButton.addEventListener("click", () => {
            window.location = "signIn"; // Redirect to sign-in page
        });
    }
}

// Update the button when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    updateButton();
});
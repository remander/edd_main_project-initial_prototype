// Project Name: PosturePro
// File Name: user.js
// Date: 24 May 2025
// Description: User management functionality for the PosturePro application. Allows users to create an account, sign in, and manage their data in Firebase.
// Group: Sensor-4

// ----------------- Firebase Setup & Initialization ------------------------//

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import { getDatabase, ref, set, update, child, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import {
	getDatabase,
  remove,
	ref,
	set,
	update,
	child,
	get,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
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

// ---------------------// Get reference values -----------------------------
let userLink = document.getElementById("userLink"); // User name for navbar
let signOutLink = document.getElementById("signOut"); // Sign out link
let welcome = document.getElementById("welcome"); // Welcome header
let currentUser = null; // Initialize current user to null

// ----------------------- Get User's Name'Name ------------------------------
function getUserName() {
	// Grab value for the 'keep logged in' switch
	let keepLoggedIn = localStorage.getItem("keepLoggedIn");

	// Grab the user information from the signIn.JS
	if (keepLoggedIn == "yes") {
		currentUser = JSON.parse(localStorage.getItem("user")).accountInfo;
	} else {
		currentUser = JSON.parse(sessionStorage.getItem("user")).accountInfo;
	}
}

// Sign-out function that will remove user info from local/session storage and
// sign-out from FRD
function signOutUser() {
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

	window.location = "home.html";
}

// ------------------------Set (insert) data into FRD ------------------------
function setData(userId, year, month, day, temperature) {
	//Must use brackets around variable name to use it as a key
	set(ref(db, "users/" + userId + "/data/" + year + "/" + month), {
		[day]: temperature,
	})
		.then(() => {
			alert("Data stored successfully.");
		})
		.catch((error) => {
			alert("There was an error. Error: " + error);
		});
}

// -------------------------Update data in database --------------------------
function updateData(userId, year, month, day, temperature) {
	//Must use brackets around variable name to use it as a key
	update(ref(db, "users/" + userId + "/data/" + year + "/" + month), {
		[day]: temperature,
	})
		.then(() => {
			alert("Data updated successfully.");
		})
		.catch((error) => {
			alert("There was an error. Error: " + error);
		});
}

// Provide the path through the nodes to the data requsted
function getData(userID, year, month, day) {
	let yearVal = document.getElementById("yearVal");
	let monthVal = document.getElementById("monthVal");
	let dayVal = document.getElementById("dayVal");
	let tempVal = document.getElementById("tempVal");

	const dbref = ref(db); // Firebase parameter for requesting data

	// Provide the path through the nodes to the data requested
	get(child(dbref, "users/" + userID + "/data/" + year + "/" + month))
		.then((snapshot) => {
			if (snapshot.exists()) {
				// Ensure you are using textContent and not textContext
				yearVal.textContent = year;
				monthVal.textContent = month;
				dayVal.textContent = day;

				// To get a specific value from a key: snapshot.val()[key]
				tempVal.textContent = snapshot.val()[day];
			} else {
				alert("No data found");
			}
		})
		.catch((error) => {
			alert("Unsuccessful, error: " + error);
		});
}

// --------------------------- Home Page Loading -----------------------------
window.onload = function () {
	// ------------------------- Set Welcome Message -------------------------
	getUserName(); // Get current user's first name
	if (currentUser == null) {
		userLink.innerText = "Create New Account";
		userLink.classList.replace("nav-link", "btn");
		userLink.classList.add("btn-primary");
		userLink.href = "register.html";

		signOutLink.innerText = "Sign In";
		signOutLink.classList.replace("nav-link", "btn");
		signOutLink.classList.add("btn-success");
		signOutLink.href = "signIn.html";
	} else {
		console.log(currentUser.firstName);
		userLink.innerText = currentUser.firstName;
		welcome.innerText = "Welcome " + currentUser.firstName;
		userLink.classList.replace("btn", "nav-link");
		userLink.classList.add("btn-primary");
		userLink.href = "#";

		signOutLink.innerText = "Sign Out";
		signOutLink.classList.replace("btn", "nav-link");
		signOutLink.classList.add("btn-success");

		console.log(currentUser);
		document.getElementById("signOut").onclick = function () {
			signOutUser();
		};
	}

  // Update the id to match the HTML
  document.getElementById("authButton").onclick = function () {
    signOutUser();
  };
};


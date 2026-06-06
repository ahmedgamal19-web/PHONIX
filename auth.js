// auth.js
// تهيئة Firebase (مرة واحدة)
const firebaseConfig = {
  apiKey: "AIzaSyAIXpesopK9RytZJqrfGQ2QEy1OQfy0hkw",
  authDomain: "phonix-97329.firebaseapp.com",
  projectId: "phonix-97329",
  storageBucket: "phonix-97329.firebasestorage.app",
  messagingSenderId: "493561850942",
  appId: "1:493561850942:web:0e672aa239f385b3e8756f",
  measurementId: "G-1ZP6N2YW5J"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// دالة مراقبة حالة المصادقة
function checkAuthState(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    // جلب الدور من Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const role = userDoc.exists ? (userDoc.data().role || 'user') : 'user';
    sessionStorage.setItem('role', role);
    // استدعاء الدالة المُمررة
    if (callback) callback(user, role);
  });
  
}

// دالة تسجيل الخروج
function logout() {
  auth.signOut().then(() => {
    sessionStorage.clear();
    window.location.href = 'login.html';
  });
}
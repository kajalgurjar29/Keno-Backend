importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
 apiKey: "AIzaSyDv1LfNS-EJZ_jmQkR1kVQH-t-E4skl0Rk",
  authDomain: "puntmate-notification.firebaseapp.com",
  projectId: "puntmate-notification",
   messagingSenderId: "839772927978",
  appId: "1:839772927978:web:4bb6c7cadc6abeeb5e2493",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body,
      icon: "/logo.png",
    }
  );
});

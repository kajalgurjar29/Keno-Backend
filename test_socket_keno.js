import { io } from "socket.io-client";

// Connect to the local server
const socket = io("http://localhost:3000");

console.log("🔌 Connecting to Keno Socket Server...");

socket.on("connect", () => {
    console.log("✅ Connected! Socket ID:", socket.id);
    console.log("⏳ Waiting for new Keno results...");
});

socket.on("connect_error", (err) => {
    console.error("❌ Connection failed:", err.message);
});

// Listen for the 'newResult' event
socket.on("newResult", (data) => {
    if (data.type === "KENO") {
        console.log("\n🎰 NEW KENO RESULT RECEIVED!");
        console.log("-----------------------------");
        console.log(`📍 Location: ${data.location}`);
        console.log(`🔢 Draw #${data.draw}`);
        console.log(`⚾ Numbers: ${data.numbers.join(", ")}`);
        console.log("-----------------------------\n");
    } else {
        console.log(`\n📡 Received non-Keno result: ${data.type} - ${data.location}`);
    }
});

socket.on("disconnect", () => {
    console.log("⚠️ Disconnected from server");
});

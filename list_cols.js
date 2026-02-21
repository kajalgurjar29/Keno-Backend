import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function listCollections() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME || "keno";
        const connectionString = mongoUri.includes('?')
            ? mongoUri.replace('?', `${dbName}?`)
            : `${mongoUri}/${dbName}`;

        await mongoose.connect(connectionString);
        console.log("Connected to", dbName);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));

        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(` - ${col.name}: ${count} records`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listCollections();

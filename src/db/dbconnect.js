import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017";
    const connectionInstance = await mongoose.connect(`${mongoUrl}/${DB_NAME}`, {
      serverSelectionTimeoutMS: 2500,
    });

    console.log(`\n MongoDB connected !! DB host at ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.log("MongoDB connection error: ", error.message || error);
    throw error;
  }
};

export default connectDB;

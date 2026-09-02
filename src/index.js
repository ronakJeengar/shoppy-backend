import "./utils/nodePolyfill.js";
import dotenv from "dotenv";
import connectDB from "./db/dbconnect.js";
import app from "./app.js";

dotenv.config();

const port = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.error(`Server runtime error: ${error}`);
    });

    app.listen(port, () => {
      console.log(`Shoppy backend server running at port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message || error);
    // In dev without MongoDB running, keep app process alive for HTTP routing/tests
    if (process.env.NODE_ENV !== "production") {
      app.listen(port, () => {
        console.log(`Server running in offline-DB mode on port ${port}`);
      });
    }
  });
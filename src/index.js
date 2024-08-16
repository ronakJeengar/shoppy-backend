// require('dotenv').config({path : './env'})
import dotenv from "dotenv";
import connectDB from "./db/dbconnect.js";
import app from "./app.js";
const port = process.env.PORT || 8000;

dotenv.config({
    path : './env'
})

connectDB().then(() => {

    app.on("error", (error) => {
        console.log(`error is :- ${error}`);
     });


    app.listen(port, () => {
        console.log("Server is running at port ", port);
    });
}

).catch((error) => {
    console.log("MongoDB connection failed ", error);
})
















/*
import express from "express";
const app = express();

( async () => {
    try{

        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

        app.on("error", (error) => {
            console.log("error is :- ", error);
            throw error
        });

        app.listen(process.env.PORT, () => {
            console.log(`app is listening at port ${process.env.PORT}`);
        });

    } catch (error){
        console.log('error :- ', error);
    }
})()
*/
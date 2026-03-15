const cors = require("cors");
const express = require("express");
const mysql = require("mysql2");

const app = express();
app.use(cors());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "teachers"
});

db.connect((err) => {
    if(err){
        console.log("Database qoşulmadı");
    } else {
        console.log("MySQL qoşuldu");
    }
});

app.get("/teachers", (req, res) => {

    const sql = "SELECT * FROM teachers";

    db.query(sql, (err, result) => {

        if(err){
            res.send("Xəta baş verdi");
        } else {
            res.json(result);
        }

    });

});

app.listen(3000, () => {
    console.log("Server 3000 portunda işləyir");
});
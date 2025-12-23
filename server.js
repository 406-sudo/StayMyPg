const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Tell Express where your CSS/Images are
app.use(express.static('public'));

// Main Route
app.get('/', (req, res) => {
    try {
        const data = fs.readFileSync('./data/pgs.json', 'utf-8');
        const pgs = JSON.parse(data);
        res.render('index', { pgs: pgs });
    } catch (err) {
        console.log("Error reading data:", err);
        res.render('index', { pgs: [] });
    }
});

// Port and Startup Message
const PORT = 3000;
// Route for the Details Page
app.get('/pg/:id', (req, res) => {
    try {
        const data = fs.readFileSync('./data/pgs.json', 'utf-8');
        const pgs = JSON.parse(data);
        
        // Find the specific PG that matches the ID in the URL
        const pg = pgs.find(p => p.id == req.params.id);

        if (pg) {
            res.render('details', { pg: pg });
        } else {
            res.send("PG not found!");
        }
    } catch (err) {
        console.log("Error:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Contact Page Route
app.get('/contact', (req, res) => {
    res.render('contact');
});

app.listen(3000, () => {
    console.log(`====================================`);
    console.log(`🚀 StayMyPg IS LIVE!`);
    console.log(`🔗 http://localhost:3000`);
    console.log(`====================================`);
});
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();

// --- Configuration ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Allows reading form data

// Session Setup
app.use(session({
    secret: 'staymypg-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 } // Session expires after 10 minutes
}));

// --- Middleware: The Gatekeeper ---
function checkAuth(req, res, next) {
    if (req.session.user) {
        next(); // User is logged in, proceed
    } else {
        res.redirect('/login'); // Not logged in, go to login page
    }
}

// --- Routes ---

// Home Page
app.get('/', (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    res.render('index', { pgs: data });
});

// Login Pages (GET and POST)
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username } = req.body;
    // Simple logic: if a username is provided, create a session
    if (username) {
        req.session.user = { name: username };
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// Signup Page
// Handle Signup form submission
// This tells the server: "When someone visits /signup, show the signup.ejs file"
app.get('/signup', (req, res) => {
    res.render('signup'); 
});

// Protected Search Route
app.get('/search', checkAuth, (req, res) => {
    const location = req.query.location;
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    
    let filteredPgs = data;
    if (location && location !== "Select area in Pune") {
        filteredPgs = data.filter(p => p.location === location);
    }
    
    res.render('index', { pgs: filteredPgs });
});

// Protected Details Route
app.get('/pg/:id', checkAuth, (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const pg = data.find(p => p.id == req.params.id);
    if (pg) {
        res.render('details', { pg: pg });
    } else {
        res.status(404).send('PG not found');
    }
});

// Contact Page
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`🚀 StayMyPg IS LIVE!`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`====================================`);
});
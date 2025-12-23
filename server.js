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
// --- Global Middleware: Pass User to all Views ---
app.use((req, res, next) => {
    // If req.session.user exists, res.locals.user will be that user
    // Otherwise, it will be null
    res.locals.user = req.session.user || null;
    next();
});
// --- Routes ---

// Home Page
app.get('/', (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    // The middleware automatically adds 'user' to the render options
    res.render('index', { pgs: data });
});

// Login Pages (GET and POST)
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));

    // Look for the specific user
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // SUCCESS: Only create session if user IS FOUND
        req.session.user = { name: user.username, email: user.email };
        res.redirect('/');
    } else {
        // FAIL: If not found, do NOT create session, send back to login
        console.log("Login failed: Incorrect credentials");
        res.redirect('/login'); 
    }
});

// Signup Page
// Handle Signup form submission
// This tells the server: "When someone visits /signup, show the signup.ejs file"
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    const filePath = './data/users.json';

    // 1. Read the existing file (or start with empty array if file is missing)
    let users = [];
    if (fs.existsSync(filePath)) {
        users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 2. Add the new user
    const newUser = { username, email, password };
    users.push(newUser);

    // 3. CRITICAL: Save the data back to the disk
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

    console.log(`Saved new user: ${email}`);
    res.redirect('/login');
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
// Temporary route to see your registered emails (delete this before going live!)
app.get('/view-users-secret-list', (req, res) => {
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
    res.json(users); 
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`🚀 StayMyPg IS LIVE!`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`====================================`);
});
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();

// --- Configuration ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Allows reading form data

// Session Setup
// ... (your existing session setup is here)
app.use(session({
    secret: 'staymypg-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 }
}));

// PASTE IT HERE!
// --- Ensure Data Directory Exists ---
const dataPath = './data';
const usersFilePath = './data/users.json';

if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath); 
}

if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([])); 
}
// --- END OF PASTED CODE ---


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
    const pgsData = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));
    
    // You MUST pass areaData here for the dropdowns to work
    res.render('index', { pgs: pgsData, areaData: areasData }); 
});

// Login Pages (GET and POST)
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        req.session.user = { name: user.username, email: user.email };
        res.redirect('/'); // This redirects to app.get('/')
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
// --- SIGNUP: The "Save" Logic ---
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    const filePath = './data/users.json';

    let users = [];
    if (fs.existsSync(filePath)) {
        users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 1. Save the user
    const newUser = { username, email, password };
    users.push(newUser);
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

    // 2. AUTO-LOGIN: Create the session right here!
    req.session.user = { name: username, email: email };

    // 3. Redirect to HOME instead of login
    console.log(`✅ ${email} signed up and logged in automatically.`);
    res.redirect('/'); 
});
// Protected Search Route
app.get('/search', checkAuth, (req, res) => {
    const { location, college } = req.query; // Get both from the form
    const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const areaData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));

    let filteredPgs = pgs;

    // Filter by location first
    if (location) {
        filteredPgs = filteredPgs.filter(p => p.location === location);
    }

    // You can also add specific college tags to your pgs.json later 
    // for even more accurate searching!

    res.render('index', { pgs: filteredPgs, areaData: areaData });
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
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
    const filePath = './data/users.json';

    // 1. Load your stored users
    const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // 2. Check if the email exists at all
    const userExists = users.find(u => u.email === email);

    if (!userExists) {
        // CONDITION: If user does not exist → signup
        console.log("User not found, redirecting to signup...");
        return res.redirect('/signup'); 
    }

    // 3. If user exists, verify the password
    if (userExists.password === password) {
        // CONDITION: If password matches → login
        req.session.user = { name: userExists.username, email: userExists.email };
        console.log("✅ Login successful for:", email);
        return res.redirect('/');
    } else {
        // CONDITION: If password wrong → stay on login
        console.log("❌ Incorrect password attempt.");
        return res.redirect('/login');
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

    // 1. Read the current list of users
    let users = [];
    if (fs.existsSync(filePath)) {
        users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 2. Check if email is already taken
    const alreadyExists = users.find(u => u.email === email);
    if (alreadyExists) {
        return res.send("User already exists. Please login.");
    }

    // 3. Add the new user and save the file
    users.push({ username, email, password });
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

    console.log(`✅ Saved to data: ${email}`);
    res.redirect('/login'); // After signup, send them to login
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
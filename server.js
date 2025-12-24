const express = require('express');
const session = require('express-session');
const fs = require('fs');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'staymypg-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 }
}));

// Global Middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Home Page - FIXED with Error Handling
app.get('/', (req, res) => {
    try {
        const pgsData = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));
        res.render('index', { pgs: pgsData, areaData: areasData }); 
    } catch (err) {
        console.error("Data Load Error:", err.message);
        res.status(500).send("Internal Server Error: Missing pgs.json or areas.json in data folder.");
    }
});

// Login POST - FIXED Variable Names
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        req.session.user = { name: user.username, email: user.email };
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// Signup POST - FIXED
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf-8'));
    users.push({ username, email, password });
    fs.writeFileSync('./data/users.json', JSON.stringify(users, null, 2));

    req.session.user = { name: username, email: email };
    res.redirect('/');
});

// Search Route
app.get('/search', (req, res) => {
    const { location } = req.query;
    const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));

    const filteredPgs = location ? pgs.filter(p => p.location === location) : pgs;
    res.render('index', { pgs: filteredPgs, areaData: areasData });
});

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => console.log("🚀 Server: http://localhost:3000"));
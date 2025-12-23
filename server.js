const session = require('express-session');

// Configure Session
app.use(session({
    secret: 'staymypg-secret-key', // A random key to secure your session
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 } // Session expires after 10 minutes
}));

// The "Gatekeeper" Middleware
function checkAuth(req, res, next) {
    if (req.session.user) {
        return next(); // User is logged in, let them through
    } else {
        res.redirect('/login'); // Not logged in, send to login page
    }
}

// PROTECTED ROUTES (Using checkAuth)
// Now, when a user clicks a PG card, this checks for a login first
app.get('/pg/:id', checkAuth, (req, res) => {
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const pg = data.find(p => p.id == req.params.id);
    res.render('details', { pg: pg });
});

// Protect the search/find PGs action
app.get('/search', checkAuth, (req, res) => {
    const location = req.query.location;
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const filteredPgs = data.filter(p => p.location === location);
    res.render('index', { pgs: filteredPgs });
});

// Login POST route (where the form submits)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // For now, any username/password works to create a session
    req.session.user = { name: username }; 
    res.redirect('/');
});
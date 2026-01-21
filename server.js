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

// --- Middleware: The Gatekeeper ---
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Home Page
app.get('/', (req, res) => {
    try {
        const pgsData = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));
        res.render('index', { pgs: pgsData, areaData: areasData });
    } catch (err) {
        console.error("Error loading data:", err);
        res.render('index', { pgs: [], areaData: [] });
    }
});

// Search Route
// To turn login ON: change to app.get('/search', checkAuth, (req, res) => {
app.get('/search', (req, res) => { 
    const { location } = req.query;
    const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));

    const filteredPgs = location ? pgs.filter(p => p.location === location) : pgs;
    res.render('index', { pgs: filteredPgs, areaData: areasData });
});

// PG Details Route
// Currently login is OFF. To turn it ON, add checkAuth before (req, res)
app.get('/pg/:id', (req, res) => { 
    const data = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
    const pg = data.find(p => p.id == req.params.id);
    if (pg) {
        res.render('details', { pg: pg });
    } else {
        res.status(404).send('PG not found');
    }
});

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// Optimized Search Route - Handles Dropdowns & Filter Menu
// ONE Search Route to Rule Them All
app.get('/search', (req, res) => {
    try {
        const { location, gender, sharing, wifi, food, ac, sort } = req.query;
        let pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));

        // --- FILTERING LOGIC ---
        if (location && location !== "") {
            pgs = pgs.filter(p => p.location === location);
        }

        if (gender && gender !== "") {
            pgs = pgs.filter(p => p.gender === gender);
        }

        if (sharing) {
            // Converts sharing to number and checks if it exists in PG sharing array
            const sNum = parseInt(sharing);
            pgs = pgs.filter(p => Array.isArray(p.sharing) ? p.sharing.includes(sNum) : p.sharing == sNum);
        }

        // Amenities (Checks for the string 'true' sent by the form)
        if (wifi === 'true') pgs = pgs.filter(p => p.wifi === true);
        if (food === 'true') pgs = pgs.filter(p => p.food === true);
        if (ac === 'true') pgs = pgs.filter(p => p.ac === true);

        // --- SORTING LOGIC ---
        if (sort === 'low') {
            pgs.sort((a, b) => a.rent - b.rent);
        } else if (sort === 'high') {
            pgs.sort((a, b) => b.rent - a.rent);
        }

        // Send 'location' back so the sidebar knows which area is currently selected
        res.render('index', { pgs, areaData: areasData, location: location || "" });
        
    } catch (err) {
        console.error("Search Error:", err);
        res.redirect('/');
    }
});
// Route to handle Booking/Inquiry submissions
app.post('/inquire', (req, res) => {
    const { pgId, pgName, userName, userEmail, userPhone, message } = req.body;
    const filePath = './data/inquiries.json';

    // 1. Read existing inquiries
    let inquiries = [];
    if (fs.existsSync(filePath)) {
        inquiries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 2. Create new inquiry object
    const newInquiry = {
        id: Date.now(),
        pgId,
        pgName,
        userName,
        userEmail,
        userPhone,
        message,
        date: new Date().toLocaleString()
    };

    // 3. Save to file
    inquiries.push(newInquiry);
    fs.writeFileSync(filePath, JSON.stringify(inquiries, null, 2));

    console.log(`📩 New Inquiry for ${pgName} from ${userName}`);
    
    // 4. Redirect back to the PG page with a success message (optional)
    res.send("<script>alert('Inquiry Sent Successfully! The owner will contact you.'); window.location.href='/';</script>");
});
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
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

// --- Middleware ---
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// 1. HOME ROUTE - Gateway Choice Page
app.get('/', (req, res) => {
    res.render('user-type'); 
});

// 2. TENANT HOME - Search Interface
// --- 2. TENANT HOME - Filtered for Approved Only ---
app.get('/tenant-home', (req, res) => {
    try {
        const pgsData = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));
        
        // IMPORTANT: Only show listings that you have approved in the Admin Panel
        const approvedPgs = pgsData.filter(p => p.listingStatus === 'approved');
        
        res.render('index', { pgs: approvedPgs, areaData: areasData });
    } catch (err) {
        console.error("Tenant Home Error:", err);
        res.render('index', { pgs: [], areaData: [] });
    }
});
// --- 3. SEARCH - Added Safety Checks ---
app.get('/search', (req, res) => {
    try {
        const { location, gender, sharing, wifi, food, ac, sort } = req.query;
        let pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const areasData = JSON.parse(fs.readFileSync('./data/areas.json', 'utf-8'));

        // Only search through approved listings
        pgs = pgs.filter(p => p.listingStatus === 'approved');

        if (location) pgs = pgs.filter(p => p.location === location);
        
        // Safety Check: Ensure gender exists before filtering to avoid 'toLowerCase' crash
        if (gender) pgs = pgs.filter(p => p.gender && p.gender.toLowerCase() === gender.toLowerCase());
        
        if (sharing) {
            const sNum = parseInt(sharing);
            pgs = pgs.filter(p => Array.isArray(p.sharing) ? p.sharing.includes(sNum) : p.sharing == sNum);
        }
        
        if (wifi === 'true') pgs = pgs.filter(p => p.wifi === true);
        if (food === 'true') pgs = pgs.filter(p => p.food === true);
        if (ac === 'true') pgs = pgs.filter(p => p.ac === true);

        if (sort === 'low') pgs.sort((a, b) => (a.rent || 0) - (b.rent || 0));
        else if (sort === 'high') pgs.sort((a, b) => (b.rent || 0) - (a.rent || 0));

        res.render('index', { pgs, areaData: areasData, location: location || "" });
    } catch (err) {
        res.redirect('/tenant-home');
    }
});

// 4. OWNER DASHBOARD - Dynamic Data Reading
// --- 1. THE DASHBOARD ROUTE ---
app.get('/owner/dashboard', (req, res) => {
    try {
        const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        // Search using the ID passed in the URL (e.g., ?id=123)
        const myPg = pgs.find(p => p.id == req.query.id); 

        if (myPg) {
            // Use the saved totalRooms from JSON, or fallback to 52 only if not set
            const total = parseInt(myPg.totalRooms) || 52; 
            const vacant = parseInt(myPg.vacantBeds) || 0;
            
            // Calculate actual occupancy based on the owner's custom total
            const occupied = total - vacant;
            const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) + "%" : "0%";

            res.render('owner-dashboard', { 
                owner: {
                    id: myPg.id,
                    name: myPg.ownerName || "New Owner",
                    listingStatus: myPg.listingStatus || 'pending',
                    vacantBeds: vacant,
                    totalRooms: total, // Now dynamic from the edit form
                    occupancy: occupancyRate,
                    wifi: myPg.wifi || false,
                    food: myPg.food || false,
                    laundry: myPg.laundry || false
                }
            });
        } else {
            // If the ID is new or not found, show a blank setup form
            res.render('edit-pg', { pg: {} }); 
        }
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.redirect('/');
    }
});

// --- 2. THE EDIT PAGE ROUTE ---
// This route must exist for the edit button to work
app.get('/owner/edit-pg', (req, res) => {
    try {
        const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const myPg = pgs.find(p => p.id == req.query.id); // Search by the ID in the URL

        if (myPg) {
            res.render('edit-pg', { pg: myPg }); 
        } else {
            res.render('edit-pg', { pg: {} }); 
        }
    } catch (err) {
        res.redirect('/owner/dashboard');
    }
});

// --- Updated Update Route with Error Alert ---
app.post('/owner/update-pg', (req, res) => {
    try {
        const filePath = './data/pgs.json';
        let pgs = [];
        
        // Read existing data if the file exists
        if (fs.existsSync(filePath)) {
            pgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }

        // Check if this is an existing owner (by mobile) or a brand new one
        const existingIndex = pgs.findIndex(p => p.ownerMobile === req.body.ownerMobile);

        const pgData = {
    id: existingIndex !== -1 ? pgs[existingIndex].id : Date.now(),
    ownerName: req.body.ownerName,
    ownerAge: req.body.ownerAge,
    ownerMobile: req.body.ownerMobile,
    ownerAddress: req.body.ownerAddress,
    name: req.body.pgName,
    location: req.body.location,
    gender: req.body.gender || "Boys",
    rent: parseInt(req.body.rent) || 0,
    vacantBeds: parseInt(req.body.vacantBeds) || 0,
    totalRooms: parseInt(req.body.totalRooms) || 52,
    
    // --- AMENITIES CAPTURE ---
    wifi: req.body.wifi === 'on',    // Converts "on" to true, otherwise false
    food: req.body.food === 'on',
    laundry: req.body.laundry === 'on',
    ac: req.body.ac === 'on',
    
    listingStatus: "pending", 
    image: req.body.image || "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500"
};

        if (existingIndex !== -1) {
            pgs[existingIndex] = pgData; // Update existing
        } else {
            pgs.push(pgData); // Add new listing to the array
        }

        fs.writeFileSync(filePath, JSON.stringify(pgs, null, 2));
        res.send("<script>alert('Your PG has been submitted for Admin approval!'); window.location.href='/owner/dashboard?id=" + pgData.id + "';</script>");
    } catch (err) {
        res.status(500).send("Error saving your listing.");
    }
});


// 7. INQUIRY HANDLER
app.post('/inquire', (req, res) => {
    const { pgId, pgName, userName, userEmail, userPhone, message } = req.body;
    const filePath = './data/inquiries.json';
    let inquiries = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
    inquiries.push({ id: Date.now(), pgId, pgName, userName, userEmail, userPhone, message, date: new Date().toLocaleString() });
    fs.writeFileSync(filePath, JSON.stringify(inquiries, null, 2));
    res.send("<script>alert('Inquiry Sent!'); window.location.href='/tenant-home';</script>");
});

// 1. Route to view the panel
// --- Route to View the Admin Panel ---
app.get('/admin/panel', (req, res) => {
    try {
        const pgs = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8')); //
        // Filters only listings that need your approval
        const pendingPgs = pgs.filter(p => p.listingStatus === 'pending');
        res.render('admin-panel', { pendingPgs }); //
    } catch (err) {
        res.status(500).send("Error loading Admin Panel: Check if pgs.json exists.");
    }
});

// --- Route for One-Click Approval ---
app.post('/admin/approve-pg/:id', (req, res) => {
    try {
        const filePath = './data/pgs.json';
        let pgs = JSON.parse(fs.readFileSync(filePath, 'utf-8')); //
        const index = pgs.findIndex(p => p.id == req.params.id);
        
        if (index !== -1) {
            // Change status to 'approved' to notify owner and show to tenants
            pgs[index].listingStatus = 'approved';
            pgs[index].isVerified = true;
            
            fs.writeFileSync(filePath, JSON.stringify(pgs, null, 2)); //
        }
        res.redirect('/admin/panel'); // Refreshes the list
    } catch (err) {
        res.status(500).send("Approval failed.");
    }
});

// Auth & Listen
app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
const multer = require('multer');

// Set up where and how files are saved
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        // Keeps the original file name but adds a timestamp to prevent duplicates
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });


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

// This tells Express to serve files from the public folder automatically
app.use(express.static('public'));

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

// --- NEW ROUTE: SHOW INDIVIDUAL PG DETAILS ---
app.get('/pg/:id', (req, res) => {
    try {
        const pgsData = JSON.parse(fs.readFileSync('./data/pgs.json', 'utf-8'));
        const pg = pgsData.find(p => p.id == req.params.id);

        if (pg) {
            // This name MUST match your filename in the views folder
            res.render('pg-details', { pg }); 
        } else {
            res.status(404).send("PG not found");
        }
    } catch (err) {
        res.status(500).send("Error");
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
// Accepts 1 main image and 2 gallery images from the form
app.post('/owner/update-pg', upload.fields([
    { name: 'image', maxCount: 1 }, 
    { name: 'gallery1', maxCount: 1 }, 
    { name: 'gallery2', maxCount: 1 }
]), (req, res) => {
    try {
        const filePath = './data/pgs.json';
        let pgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        const existingIndex = pgs.findIndex(p => p.ownerMobile === req.body.ownerMobile);

        const pgData = {
            id: existingIndex !== -1 ? pgs[existingIndex].id : Date.now(),
            ownerName: req.body.ownerName,
            ownerMobile: req.body.ownerMobile,
            name: req.body.pgName,
            location: req.body.location,
            rent: parseInt(req.body.rent) || 0,
            gender: req.body.gender || "Boys",
            totalRooms: parseInt(req.body.totalRooms) || 52,
            vacantBeds: parseInt(req.body.vacantBeds) || 0,
            
            // Check if new files were uploaded; otherwise keep old or default
            image: req.files['image'] ? '/uploads/' + req.files['image'][0].filename : (existingIndex !== -1 ? pgs[existingIndex].image : ""),
    gallery: [
        req.files['gallery1'] ? '/uploads/' + req.files['gallery1'][0].filename : (existingIndex !== -1 && pgs[existingIndex].gallery ? pgs[existingIndex].gallery[0] : ""),
        req.files['gallery2'] ? '/uploads/' + req.files['gallery2'][0].filename : (existingIndex !== -1 && pgs[existingIndex].gallery ? pgs[existingIndex].gallery[1] : "")
            ],

            listingStatus: "pending",
            wifi: req.body.wifi === 'on',
            food: req.body.food === 'on',
            laundry: req.body.laundry === 'on',
            ac: req.body.ac === 'on'
        };

        if (existingIndex !== -1) pgs[existingIndex] = pgData;
        else pgs.push(pgData);

        fs.writeFileSync(filePath, JSON.stringify(pgs, null, 2));
        res.send("<script>alert('Submission Successful!'); window.location.href='/owner/dashboard?id=" + pgData.id + "';</script>");
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).send("Server Error. Please ensure the 'public/uploads' folder exists.");
    }
});



// 7. INQUIRY HANDLER
app.post('/inquire', (req, res) => {
    try {
        const filePath = './data/inquiries.json';
        let inquiries = [];
        
        if (fs.existsSync(filePath)) {
            inquiries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }

        // Save the inquiry with the PG name and ID
        inquiries.push({
            id: Date.now(),
            ...req.body,
            date: new Date().toLocaleString()
        });

        fs.writeFileSync(filePath, JSON.stringify(inquiries, null, 2));
        
        // Show a success message then go back
        res.send("<script>alert('Inquiry sent to owner!'); window.history.back();</script>");
    } catch (err) {
        res.status(500).send("Error sending inquiry");
    }
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
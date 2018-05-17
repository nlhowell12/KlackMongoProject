const express = require('express')
const querystring = require('querystring');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const app = express()

const dbName = 'klack';
const DB_USER = 'admin';
const DB_PASSWORD = 'admin';
const DB_URI = "ds119306.mlab.com:19306";
const PORT = process.env.PORT || 3000;

// Setting up websockets
const socket = require('socket.io');
const server = app.listen(PORT);
const io = socket(server);
const path = './public/uploads';

app.use(express.static("./public"))
app.use(express.static("./public/uploads"))
app.use(express.json())
app.use(cors())



app.set('views', './views');
app.set('view engine', 'pug');

// Mongo stuff
mongoose.connect(`mongodb://${DB_USER}:${DB_PASSWORD}@${DB_URI}/${dbName}`, () => {
console.log("Successfully connected to database");
});
// mongoose.connect('mongodb://localhost/klack')

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));

//User can upload image types - (jpg|jpeg|png|gif)
var storage = multer.diskStorage({
    
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/') 
    },
    filename: (req, file, cb) => {
        if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null,Date.now()  + '-' + file.originalname)
    }
});
const upload = multer({storage: storage});

// object of names and their respective pic filenames
let profilePics = {
    "test": "test"
};

// Define a schema
var Schema = mongoose.Schema;
var messageSchema = new Schema({
    name: String,
    message: String,
    timestamp: Number,
});
// Compile a Message model from the schema
var Message = mongoose.model('Message', messageSchema);

// user schema for profile pics and stuff
var userSchema = new Schema({
    name: String,
    pic: String
});
var User = mongoose.model('User', userSchema);

function userSortFn(a, b) {
    var nameA = a.name.toUpperCase(); // ignore upper and lowercase
    var nameB = b.name.toUpperCase(); // ignore upper and lowercase
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }
    // names must be equal
    return 0;
}

let usersTimestamps = [];

app.get('/', function (req, res) {  
    fs.readdir(path, function(err, items) {   
        res.render('index',{title: 'KenzieGram'});

    });
})

io.on('connection', (socket) => {
    console.log(`Connected on Port: ${PORT}`)
    
    // make array of all the users and their pics
    let allUsers = []
    
    User.find()
    .then((users) => {
        if (users) {
            users.forEach(user => {
                allUsers.push(user);
            })
        }
    });

    Message.find()
    .then(messages => {
        messages.forEach(message => {
            if (!usersTimestamps[message.name]) {
                usersTimestamps[message.name] = message.timestamp
            } else if (usersTimestamps[message.name] < message.timestamp) {
                usersTimestamps[message.name] = message.timestamp
            }
        })
    })
    .then(() => {
        const now = Date.now();
        // consider users active if they have connected (GET or POST) in last 15 seconds
        const requireActiveSince = now - (15*1000)
        
        // create a new list of users with a flag indicating whether they have been active recently
        usersSimple = Object.keys(usersTimestamps).map((x) => ({name: x, active: (usersTimestamps[x] > requireActiveSince)}))
        
        // sort the list of users alphabetically by name
        usersSimple.sort(userSortFn);
        usersSimple.filter((a) => (a.name !== usersTimestamps.name))
        socket.emit('activeUsers', {users: usersSimple})
    })
    .catch(err => {
        console.error(err);
    })    
    
    Message.find((err, messages) => {
        socket.emit('initial', {messages, pics: allUsers});
    })
    
    
    socket.on('chat', (data) =>{
        // get the current time
        const now = Date.now();
        // consider users active if they have sent a message in last 15 seconds
        const requireActiveSince = now - (15*1000)
        
        // update the requesting user's last access time
        usersTimestamps[data.name] = now;
        
        // create a new list of users with a flag indicating whether they have been active recently
        usersSimple = Object.keys(usersTimestamps).map((x) => ({name: x, active: (usersTimestamps[x] > requireActiveSince)}))
        
        // sort the list of users alphabetically by name
        usersSimple.sort(userSortFn);
        usersSimple.filter((a) => (a.name !== data.name))
        
        // Posts message to the db
        let message = new Message({
            name: data.name,
            message: data.message,
            timestamp: now,  
        })
        message.save()
        .then(data => {
            console.log('msg saved to the database:', data);
        })
        .catch(err => {
            console.log('Unable to save to database');
        });
        
        // make array of all the users and their pics
        let allUsers = []
        User.find()
        .then((users) => {
            users.forEach(user => {
                allUsers.push(user);
                io.sockets.emit('chat', {message, users: usersSimple, pics: allUsers})
            })
        })
        .catch(err => {
            console.log("Error",err)
        }) 
    })
    
    // Receives a typing message and broadcasts it to all the sockets except the one sending it
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    })
    
    // Recevies new user information and creates that entry in the database, assuming that there isn't already a profile with the same name in the DB
    socket.on('user', (data) => {
        var user = new User({
            name: data.name,
            pic: data.pic
        })
        User.update({
            name: data.name
        }, {
            $setOnInsert: user
        }, {
            upsert: true
        },
        function (err, numAffected) {
            console.log("User created", numAffected)
        })
    })
    
    // Updates active users every 15 seconds to show that a user is inactive
    setInterval((sockets) => {
        const now = Date.now();
        // consider users active if their last message was sent in the last 15 seconds
        const requireActiveSince = now - (15*1000)
        
        // create a new list of users with a flag indicating whether they have been active recently
        usersSimple = Object.keys(usersTimestamps).map((x) => ({name: x, active: (usersTimestamps[x] > requireActiveSince)}))
        
        // sort the list of users alphabetically by name
        usersSimple.sort(userSortFn);
        usersSimple.filter((a) => (a.name !== usersTimestamps.name))
        io.sockets.emit('activeUsers', {users: usersSimple})
    }, 15000)
})

// handles pic uploading
app.post('/upload', upload.single('fileToUpload'), function (req, res) {
    profilePics[req.body.user_id] = req.file.filename;
    User.update({
        name: req.body.user_id
    }, {
        $set: {
            pic: req.file.filename
        }
    },
    function (err, numAffected) {
        console.log("User created", numAffected);
    }
);
res.redirect('/');
})

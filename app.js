const express = require('express')
const querystring = require('querystring');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const app = express()
const gm = require('gm').subClass({ imageMagick: true });

// Mlab Database Information
const dbName = 'klack';
const DB_USER = 'admin';
const DB_PASSWORD = 'admin';
const DB_URI = "ds119306.mlab.com:19306";
const PORT = process.env.PORT || 3000;

// Setting up websockets
const socket = require('socket.io');
const server = app.listen(PORT);
const io = socket(server);

app.use(express.static("./public"))
app.use(express.static("./public/uploads"))
app.use(express.json())
app.use(cors())

// If this directory doesn't exist, then make it.
var dir = './public/uploads';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

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
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

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
    socketID: String,
    name: String,
    pic: String,
    active: Boolean
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

// When a connection is made with the server, this handles the socket that connects
io.on('connection', (socket) => {
    console.log(`Connected on Port: ${PORT}`)

    // Finds the current list of messages and users from the DB and repopulates the client
    User.find()
    .then((users) => {
        Message.find((err, messages) => {
            socket.emit('initial', {messages, pics: users});
        })
    })
    .catch(err => {
        console.error(err);
    })    
    
    // When the client sends a chat message, save it in the database
    // Then send the new message and the user to all connected sockets to append
    socket.on('chat', (data) =>{
        // get the current time
        const now = Date.now();
        
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
        
        User.find()
        .then((users) => {
            io.sockets.emit('chat', {message, pics: users})
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
    // Returns the new user list to all connected sockets to repopulate the User List
    socket.on('user', ({name, socketID}) => {
        let user = new User({name})
        User.update({name}, {
            $set: {
                socketID,
                active: true,

            },
            $setOnInsert: user
        }, {
            upsert: true
        })
        .then((numAffected) => {
            console.log("User created", numAffected)
        })
        .then(() => {
            return User.find()
        })
        .then((users) => {
            io.sockets.emit('activeUsers', {users})
        })
        .catch(err => {
            console.log(err);
        })
    })
    
    // When a socket disconnects, update the database to show that user has disconnected
    // Then broadcast to all sockets, except the closed one, to update the User List
    socket.on('disconnect', () => {
        User.update({"socketID": socket.id}, {
            $set: {
                active: false
            }
        })
        .then(() =>{
            return User.find()
        })
        .then((users) => {
            console.log(users);
            socket.broadcast.emit('activeUsers', {users})
        })
        .catch(err => {
            console.error(err);
        })    
    })

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
    res.end();
})

// Receives a file to be uploaded into the chat, standardizes the format, and saves it in local storage
// Then creates a message, saves it in the database, and sends all client the message to append
app.post("/uploadChat", upload.single('chatFile'), function (req, res) {
    const now = Date.now()
    gm(`./public/uploads/${req.file.filename}`)
        .resize('680>')
        .noProfile()
        .write(`./public/uploads/${req.file.filename}`, function (err) {
            if (!err) console.log('done');
            Message.create({
                name: req.body.user_id,
                message: req.file.filename,
                timestamp: now,
            })
            .then(() => {
                User.find()
                .then((users) => {
                    io.sockets.emit('chat', {message: {message: req.file.filename, name: req.body.user_id, timestamp: now}, pics: users})
                })
                .catch(err => {
                    console.log("Error",err)
                }) 
            })
            res.end();
        });
    
})
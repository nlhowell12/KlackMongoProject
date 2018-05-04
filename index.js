//1 - Your app should connect to a local MongoDB database named klack. -- Done
//2 - Your app defines a Message model with an appropriate schema. -- Done
//3 - Every posted message to klack gets stored as an instance of the Message model. 
//4 - When the Node.js server for klack is exited and restarted, message history should be preserved.
//5 - Last active times for users (used to show which users have been recently active) should 
//   also be based on the message history in MongoDB and should persist across restarts of the server.

const express = require('express')
const querystring = require('querystring');
const mongoose = require('mongoose');

const app = express()
app.use(express.static("./public"))
app.use(express.json())

const dbName = 'klack';
const DB_USER = 'admin';
const DB_PASSWORD = 'admin';
const DB_URI = 'ds113870.mlab.com:13870';
const PORT = process.env.PORT || 3000;


let lastMsgTimestamp = 0;
// Track last active times for each sender
let users = {}

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
// Define a schema
var Schema = mongoose.Schema;
var messageSchema = new Schema({
    sender: String,
    message: String,
    timestamp: Number,
});
// Compile a Message model from the schema
var Message = mongoose.model('Message', messageSchema);

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

app.get("/messages", (request, response) => {
    let messages = []
    const now = Date.now();
    const requireActiveSince = now - (15 * 1000) // consider inactive after 15 seconds
    //if (request.query.for){
    users[request.query.for] = now;
    //}  
    //console.log("request.query.for 1--", request.query.for);
    // Get message from database
    Message.find().sort({
        timestamp: 'asc'
    }).exec(function (err, msgs) {
        msgs.forEach(msg => {
            console.log("in foreach - msg.name: ", msg);
            messages.push(msg);
            if (!users[msg.sender]) {
                users[msg.sender] = msg.timestamp
            } else if (users[msg.sender] < msg.timestamp) {
                users[msg.sender] = msg.timestamp
            }
        });
        //console.log(users);
        let usersSimple = Object.keys(users).map((x) => {
            //console.log(x)
            return ({
                name: x,
                active: (users[x] > requireActiveSince)
            })
        })
        //console.log(usersSimple);
        usersSimple.sort(userSortFn);
        usersSimple.filter((a) => (a.name !== request.query.for))
        //users[request.query.for] = now;
        // console.log("usersSimple after sort :", usersSimple);
        lastMsgTimestamp = messages[messages.length - 1];
        response.send({
            messages: messages.slice(-40),
            users: usersSimple
        })
    });
})

app.post("/messages", (request, response) => {
    // add a timestamp to each incoming message.
    request.body.timestamp = Date.now()
    users[request.body.sender] = request.body.timestamp;
    // console.log("users---",users);
    //Create an instance of Message model
    
    var message = new Message({
        sender: request.body.sender,
        message: request.body.message,
        timestamp: request.body.timestamp
    });
    // Save to database
    message.save()
        .then(data => {
            console.log('msg saved to the database:', data);
        })
        .catch(err => {
            console.log('Unable to save to database');
        });

    // create a new list of users with a flag indicating whether they have been active recently
    response.status(201)
    response.send(request.body)
})

app.listen(PORT, () => {
    mongoose.connect(`mongodb://${DB_USER}:${DB_PASSWORD}@${DB_URI}/${dbName}`);
})
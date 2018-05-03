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


// List of all messages
let messages = []

// Track last active times for each sender
let users = {}


// mongoose.connect('mongodb://localhost:27017/klack', () => {
//     console.log('database is connected...');
// });

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
// Define a schema
var Schema = mongoose.Schema;
var messageSchema = new Schema({
    sender: String,
    message: String,
    timestamp: Date
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
    const now = Date.now();
    const requireActiveSince = now - (15*1000) // consider inactive after 15 seconds
    usersSimple = Object.keys(users).map((x) => ({name: x, active: (users[x] > requireActiveSince)}))
    usersSimple.sort(userSortFn);
    usersSimple.filter((a) => (a.name !== request.query.for))
    users[request.query.for] = now;
    var messageArray = [];
    // Get message from database
    Message.find(function(err, msgs){
        // console.log("messages from database - msgs: ", msgs);
        msgs.forEach(msg => {
            console.log("in foreach - msg.message: ", msg.message);
            messageArray.push(msg);
        });
        // msgs.map(msg => {
        //     messageArray.push(msg.message);
        // })
        console.log("messageArray: ", messageArray);
        response.send({messages: messageArray, users: usersSimple});
    });
    
    
    // response.send({messages: messages.slice(-40), users: usersSimple})
})

app.post("/messages", (request, response) => {
    // add a timestamp to each incoming message.
    let timestamp = Date.now()
    request.body.timestamp = timestamp

    //Create an instance of Message model
    var message = new Message({
        sender: request.body.sender,
        message: request.body.message,
        timestamp: request.body.timestamp
    });
    // Save to database
    message.save()
        .then(data => {  
            console.log('msg saved to the database');
        })
        .catch(err => {
            console.log('Unable to save to database'); 
        });
    // messages.push(request.body)
    users[request.body.sender] = timestamp;
    response.status(201)
    response.send(request.body)
    
    
})

app.listen(PORT, () => {
    mongoose.connect(`mongodb://${DB_USER}:${DB_PASSWORD}@${DB_URI}/${dbName}`);
    console.log(`listening at port ${PORT}`);
})
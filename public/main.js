const userList = document.getElementById("users");
const messagesDiv = document.getElementById("messageslist");
const textarea = document.getElementById("newmessage");
const ding = new Audio('typewriter_ding.m4a');
const hamburger = document.getElementById('hamburger');

// Connects to the server
const socket = io.connect('https://xforceklack.herokuapp.com/')
// const socket = io.connect("http://localhost:3000")

// text to emoji converter library
const emoji = new EmojiConvertor();


hamburger.addEventListener('click', function(){
    if (userList.style.display === 'none') {
        userList.style.display = 'block'    
    }
    else {
        userList.style.display = 'none'
    }
});


// this will be the list of all messages displayed on the client
let messages = [{
    timestamp: 0
}];

let name = "";

function determineName() {
    name = window.prompt("Enter your name");
    if (name === null || name.length === 0) name = "Anonymous";
    socket.emit('user', {name, pic: "none"})
}
determineName();

// redraw the entire list of users, indicating active/inactive
function listUsers(users) {
    let userStrings = users.map((user) =>
    (user.active ? `<span class="active"><span class="cyan">&#9679;</span> ${user.name}</span>` : `<span class="inactive">&#9675; ${user.name}</span>`)
);
userList.innerHTML = userStrings.join("<br>");
}

// true if the messages div is already scrolled down to the latest message
function scrolledToBottom() {
    return messagesDiv.scrollTop + 600 >= messagesDiv.scrollHeight;
}

// force the messages div to scroll to the latest message
function scrollMessages() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// add the sender and text of one new message to the bottom of the message list
function appendMessage(msg, pics) {
    //Time the msg was sent 
    var d = new Date(msg.timestamp);
    // expected output: "7/25/2016, 1:35:07 PM"
    // console.log( pics[msg.sender] )
    
    // find profile pic of sender
    var userandpic = pics.find(function(element) {
        if (element.name === msg.name) {
            return element.pic;
        }
    })
    // console.log(userandpic);
    
    if (userandpic.pic !== "none") {
        messagesDiv.innerHTML +=
        `<div class="message"><img src="${userandpic.pic}" class="profilePic"><strong>${msg.name} </strong><font size="2">(${d.toLocaleString()})</font> :<br>${msg.message}</div>`;
    } else {
        messagesDiv.innerHTML +=
        `<div class="message"><strong>${msg.name}</strong>(${d.toLocaleString()}) :<br>${msg.message}</div>`;;
    }
}

// Prints out all the messages in the database when the server sends it on initial connection
socket.on('initial', (data) => {
    for (let message of data.messages) {
       appendMessage(message, data.pics)
    }
})

// Redraws the user list to show inactive users when the server checks every 15 seconds
socket.on('activeUsers', (data) =>{
    listUsers(data.users);
})

// Creates a new chat message in the messagesDiv when a Chat message is received from the server
// Redraws the user list 
// Scrolls to the bottom of the messagesDiv
socket.on('chat', (data) => {
    // feedback.innerHTML = "";
    appendMessage(data.message, data.pics);
    listUsers(data.users);
    scrollMessages();
})

// Displays "User is typing" when the server sends a typing message
// socket.on('typing', (data) => {
//     feedback.innerHTML =
//     `<strong>${data.name}</strong> is typing.`;
// })

// handles all keypresses
document.getElementById("newmessage").addEventListener("keypress", (event) => {
    // If user is typing, send 'typing' to server
    socket.emit('typing', {
        name
    })
    // if the key pressed was enter (and not shift+enter), post the message.
    if(event.keyCode === 13 && !event.shiftKey) {
        textarea.value = emoji.replace_colons(textarea.value);
        // Only send message if text area is not empty
        if (textarea.value.trim().length > 0) { 
          socket.emit('chat', {name, message: textarea.value});
          ding.play();
        }
        textarea.value = "";
        textarea.focus();
    }
})

// Handles clicking the send icon
document.getElementById("send-icon").addEventListener("click", (event) => {
    textarea.value = emoji.replace_colons(textarea.value); 
    // Only send message if text area is not empty
    if (textarea.value.trim().length > 0) {
      socket.emit('chat', {name, message: textarea.value});
      ding.play();
    }
    textarea.value = "";
    textarea.focus();
});


// adds a hidden field to the upload form with the user's name (this is required to link them later)
document.getElementById("uploadForm").innerHTML += `<input type="hidden" value="${name}" name="user_id" />`;
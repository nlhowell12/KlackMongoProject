const userList = document.getElementById("users");
const messagesDiv = document.getElementById("messageslist");
const textarea = document.getElementById("newmessage");
const ding = new Audio('typewriter_ding.m4a');

// this will be the list of all messages displayed on the client
let messages = [ { timestamp: 0 } ];

let name = window.prompt("Enter your name");
// if they didn't type anything at the prompt, make up a random name
if(name === null || name.length === 0) name = "Anon-" + Math.floor(Math.random()*1000);

// add the sender and text of one new message to the bottom of the message list
function appendMessage(msg) {
    messages.push(msg);
    //Time the msg was sent 
    var d = new Date(msg.timestamp);
     // expected output: "7/25/2016, 1:35:07 PM"

    messagesDiv.innerHTML +=
      `<div class="message"><strong>${msg.sender}</strong>(${d.toLocaleString()}) : <br>${msg.message}</div>`;
}

// redraw the entire list of users, indicating active/inactive
function listUsers(users) {
    console.log(users);
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

function fetchMessages() {
    console.log("name--",name);
    fetch("/messages?for=" + encodeURIComponent(name))
        .then(response => response.json())
        .then(data => {
            // if already scrolled to bottom, do so again after adding messages
            const shouldScroll = scrolledToBottom();
            var shouldDing = false;

            // redraw the user list
            listUsers(data.users);

            // examine all received messages, add those newer than the last one shown
            data.messages.forEach(msg => {
                if(msg.timestamp > messages[messages.length - 1].timestamp) {
                    appendMessage(msg);
                    shouldDing = true;
                }
            })

            if(shouldScroll && shouldDing) scrollMessages();
            if(shouldDing) ding.play();

            // poll again after waiting 5 seconds
            setTimeout(fetchMessages, 5000);
        })
}
function sendMessage(){
    textarea.disabled = true;
        
    const postRequestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({sender: name, message: textarea.value}),
    }
    fetch("/messages", postRequestOptions)
        .then(response => response.json())
        .then(msg => {
            appendMessage(msg);
            scrollMessages();
            // reset the textarea
            textarea.value="";
            textarea.disabled = false;
            textarea.focus();
        })
        .catch(err=>{
            console.log(err);
        })
}
document.getElementById("newmessage").addEventListener("keypress", (event) => {
    // if the key pressed was enter (and not shift enter), post the message.
    if(event.keyCode === 13 && !event.shiftKey) {
      sendMessage();
    }
});
document.getElementById("send-icon").addEventListener("click", (event) => {
    sendMessage();
    });

// call on startup to populate the messages and start the polling loop
fetchMessages();
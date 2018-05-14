const userList = document.getElementById("users");
const messagesDiv = document.getElementById("messageslist");
const textarea = document.getElementById("newmessage");
const ding = new Audio('typewriter_ding.m4a');
const hamburger = document.getElementById('hamburger');

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
    console.log(name)
    const postRequestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: name,
            pic: "none"
        }),
    }

    fetch("/user", postRequestOptions)
        .then(response => response.json())
        .then(data => {
            console.log(data.say);
        })
        .catch(err => {
            console.log(err);
        })
}
determineName();

// add the sender and text of one new message to the bottom of the message list
function appendMessage(msg, pics) {
    messages.push(msg);
    //Time the msg was sent 
    var d = new Date(msg.timestamp);
    // expected output: "7/25/2016, 1:35:07 PM"
    // console.log( pics[msg.sender] )

    // find profile pic of sender
    var userandpic = pics.find(function(element) {
        if (element.name === msg.sender) {
            return element.pic;
        }
    })
    // console.log(userandpic);

    if (userandpic.pic !== "none") {
        messagesDiv.innerHTML +=
            `<div class="message"><img src="${userandpic.pic}" class="profilePic"><strong>${msg.sender} </strong><font size="2">(${d.toLocaleString()})</font> :<br>${msg.message}</div>`;
    } else {
        messagesDiv.innerHTML +=
            `<div class="message"><strong>${msg.sender}</strong>(${d.toLocaleString()}) :<br>${msg.message}</div>`;;
    }
}

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

function fetchMessages() {

    fetch("/messages?for=" + encodeURIComponent(name))
        .then(response => response.json())
        .then(data => {
            // if already scrolled to bottom, do so again after adding messages
            const shouldScroll = scrolledToBottom();
            var shouldDing = false;

            // redraw the user list
            listUsers(data.users);

            // examine all received messages, add those newer than the last one shown
            for (let i = 0; i < data.messages.length; i++) {
                let msg = data.messages[i];
                if (msg.timestamp > messages[messages.length - 1].timestamp) {
                    appendMessage(msg, data.pics);
                    shouldDing = true;
                }
            }

            // OLD IMPLEMENTATION
            // data.messages.forEach(msg => {
            //     if(msg.timestamp > messages[messages.length - 1].timestamp) {
            //         appendMessage(msg);
            //         shouldDing = true;
            //         // console.log(JSON.stringify(data.pics));
            //     }
            // })

            if (shouldScroll && shouldDing) scrollMessages();
            // if (shouldDing) ding.play();

            // poll again after waiting 5 seconds
            setTimeout(fetchMessages, 5000);
        })
}

function sendMessage() {
    textarea.disabled = true;
    // text to emoji convert
    textarea.value = emoji.replace_colons(textarea.value); 
    const postRequestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            sender: name,
            message: textarea.value
        }),
    }
    fetch("/messages", postRequestOptions)
        .then(response => response.json())
        .then(data => {
            appendMessage(data.messages, data.pics);
            scrollMessages();
            // reset the textarea
            textarea.value = "";
            textarea.disabled = false;
            textarea.focus();
        })
        .catch(err => {
            console.log(err);
        })
}
document.getElementById("newmessage").addEventListener("keypress", (event) => {
    // if the key pressed was enter (and not shift enter), post the message.
    if (event.keyCode === 13 && !event.shiftKey) {
        if (textarea.value.trim().length > 0) {
            sendMessage();
        }
        
    }
});
document.getElementById("send-icon").addEventListener("click", (event) => {
    if (textarea.value.trim().length > 0) {
        sendMessage();
    }
});

// call on startup to populate the messages and start the polling loop
fetchMessages();

// adds a hidden field to the upload form with the user's name (this is required to link them later)
document.getElementById("uploadForm").innerHTML += `<input type="hidden" value="${name}" name="user_id" />`;
//own username 
var clientId;
var connectedUser;
var yourConn;

//connecting to our signaling server 
// var conn = new WebSocket('ws://localhost:9090');
var conn = new WebSocket('wss://testiqra.ga/websocket/stream/rtc/:9090');

conn.onopen = function () {
    console.log("Connected to the signaling server");
};

//when we got a message from a signaling server 
conn.onmessage = function (msg) {
    console.log("Got message", msg.data);
    var data;

    try {
        data = JSON.parse(msg.data);
    } catch (error) {
        console.log("Error: No json data is passed");
        data = {}
    }

    switch (data.type) {
        case "login":
            if(data.success){
                clientId = data.clientId;
            }

            handleLogin(data.success);
            break;

        //when somebody wants to call us 
        // case "offer":
        //     handleOffer(data.offer, data.name);
        //     break;

        case "answer":
            // console.log("Case Answer:");
            handleAnswer(data.answer);
            break;
        //when a remote peer sends an ice candidate to us 
        case "candidate":
            handleCandidate(data.candidate);
            break;
        case "leave":
            handleLeave();
            break;
        default:
            console.log("Error: data.type is not found");
            break;
    }
};

conn.onerror = function (err) {
    console.log("Got error", err);
};

//alias for sending JSON encoded messages 
function send(message) {

    //attach the other peer username to our messages
    if (clientId) {
        message.clientId = clientId;
    }
    conn.send(JSON.stringify(message));
};

//****** 
//UI selectors block 
//****** 

var loginPage = document.querySelector('#loginPage');
var tokenInput = document.querySelector('#tokenInput');
var loginBtn = document.querySelector('#loginBtn');
var imageFrame = document.querySelector('#imageFrame');

var chatArea = document.querySelector('#chatArea'); // Extra
var msgInput = document.querySelector('#msgInput');
var sendMsgBtn = document.querySelector('#sendMsgBtn'); // Extra

var streamPage = document.querySelector('#streamPage'); // Extra
streamPage.style.display = "none";

// Login when the user clicks the button 
loginBtn.addEventListener("click", function (event) {
    token = tokenInput.value;
    console.log("Pressed login Button");
    console.log("token: ", token);

    if (token.length > 0) {
        send({
            type: "login",
            token: token
        });
    }

});

function handleLogin(success) {

    if (success === false) {
        alert("Invalid token or something wrong.");
    } else {
        loginPage.style.display = "none";
        streamPage.style.display = "block";

        //********************** 
        //Starting a peer connection 
        //********************** 

        //using Google public stun server 
        var configuration = {
            "iceServers": [{ "urls": "stun:stun2.1.google.com:19302" }]
        };

        // var configuration = {
        //     "iceServers": []
        // };


        yourConn = new RTCPeerConnection(configuration);

        console.log("Peer connection created");

        // Setup ice handling 
        yourConn.onicecandidate = function (event) {
            if (event.candidate && event.candidate.protocol !== 'tcp') {

                console.log("Send candidate: ")
                console.log(event.candidate)

                send({
                    type: "candidate",
                    candidate: event.candidate
                });
            }
        };

        
        // creating data channel 
        dataChannel = yourConn.createDataChannel("channel", {ordered: false, negotiated: true, maxRetransmits: 0, id: clientId});
        
        console.log(dataChannel)
        console.log(dataChannel.readyState)

        dataChannel.onopen = function(event) {
            console.log("Data channel is openned!")
            // dataChannel.send('Hi!');
        }

        dataChannel.onerror = function (error) {
            console.log("Ooops...error:", error);
        };

        // when we receive a message from the other peer, display it on the screen 
        dataChannel.onmessage = function (event) {
            console.log("Message arrived");
            
            imageFrame.src = 'data:image/jpg;base64,' + event.data
            // console.log(event.data);
            // chatArea.innerHTML += connectedUser + ": " + event.data + "<br />";
        };

        dataChannel.onclose = function () {
            console.log("data channel is closed");
        };

        console.log("We have to call sendOfferMethod")
        sendOffer();
    }
};

//initiating a call 
// callBtn.addEventListener("click", function () {
//     var callToUsername = callToUsernameInput.value;

//     if (callToUsername.length > 0) {
//         connectedUser = callToUsername;
//         // create an offer 
//         yourConn.createOffer(function (offer) {
//             console.log("Create offfer")
//             send({
//                 type: "offer",
//                 offer: offer
//             });
//             yourConn.setLocalDescription(offer);
//         }, function (error) {
//             alert("Error when creating an offer");
//         });
//     }

// });

// when somebody sends us an offer 
// function handleOffer(offer, name) {
//     connectedUser = name;
//     yourConn.setRemoteDescription(new RTCSessionDescription(offer));

//     //create an answer to an offer 
//     yourConn.createAnswer(function (answer) {
//         yourConn.setLocalDescription(answer);
//         send({
//             type: "answer",
//             answer: answer
//         });
//     }, function (error) {
//         alert("Error when creating an answer");
//     });

// };

function sendOffer() {
    console.log("I am in offer. ClientId: ", clientId)
    if (clientId) {
        console.log("Sending offer clientId: ", clientId);
        console.log("yourConn: ", yourConn)

        yourConn.createOffer(function (offer) {
            console.log("Create offfer")
            send({
                type: "offer",
                offer: offer,
                clientId: clientId
            });
            yourConn.setLocalDescription(offer);
        }, function (error) {
            alert("Error when creating an offer");
        });
    }
};

//when we got an answer from a remote user 
function handleAnswer(answer) {
    console.log("Got Answer: ", answer);
    yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

//when we got an ice candidate from a remote user 
function handleCandidate(candidate) {
    console.log("Got candidate")
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};

// //hang up 
// hangUpBtn.addEventListener("click", function () {
//     send({
//         type: "leave"
//     });

//     handleLeave();
// });

// function handleLeave() {
//     connectedUser = null;
//     yourConn.close();
//     yourConn.onicecandidate = null;
// };

//when user clicks the "send message" button 
sendMsgBtn.addEventListener("click", function (event) {
    var val = msgInput.value;
    chatArea.innerHTML +=  clientId + ": " + val + "<br />";

    //sending a message to a connected peer 
    dataChannel.send(val);
    msgInput.value = "";
});
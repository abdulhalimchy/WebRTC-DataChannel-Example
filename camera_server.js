
const WebSocketServer = require('ws').Server; //require our websocket library 
const WebRTC = require('wrtc') //require WebRTC library
const http = require('http')

const token = "abc";


//:::::::::::::::::::::::::::::::::::: Setup a WebServer ::::::::::::::::::::::::::::::::::
// Start up an HTTP server.
var webServer = null;

try {
  webServer = http.createServer({}, handleWebRequest);
} 
catch(err) {
  webServer = null;
//   let err_msg = "Error attempting to create HTTP(s) server: " + err.toString();
//   log('server_error_log.txt', err_msg);
}

// Our HTTP server does nothing but service WebSocket
// connections, so every request just returns 404. 
function handleWebRequest(request, response) {
  // console.log("Received request for " + request.url);
  response.writeHead(404);
  response.end();
}

// Spin up the HTTP server on the port assigned to this sample.
// This will be turned into a WebSocket port very shortly.
webServer.listen(9090, function() {
  console.log("Server is listening on port 9090");
  // let msg = "Server is listening on port 6503";
  // log('server_error_log.txt', msg);
});



//creating a websocket server at port 9090 
let wss = new WebSocketServer({ server: webServer });
let logged_in_connections = {};
let peer_connections = {};
let data_channels = {};
let clientId=1;

// Base64
let base64data = "This is test base64";

// let temp = new WebRTC.RTCPeerConnection()

//when a user connects to our sever 
wss.on('connection', function (connection) {
    console.log("user connected");

    //::::when server gets a message from a connected user ws::::
    connection.on('message', function (message) {
        let data, conn;
        try {
            data = JSON.parse(message);
        } catch (error) {
            // console.log("Invalid JSON");
            data = {};

            // console.log(typeof message)

            if(message){
                base64data = message.toString('base64');
                // console.log(base64data)
            }
        }

        switch (data.type) {

            case "login":
                console.log("User login request")

                if (data.token == token)
                {
                    sendTo(connection, {
                        type: "login",
                        clientId: clientId,
                        success: true
                    });

                    logged_in_connections[clientId]=connection;
                    connection.clientId=clientId;
                    
                    createNewRTCPeer(connection, clientId);

                    clientId++; // Todo: Generate using timestamp
                }
                else
                {
                    sendTo(connection, {
                        type: "login",
                        success: false
                    });
                }
                break;

            case "offer":
                console.log("Got offer the the client.")
                handleOffer(data.offer, data.clientId);
                break;

            // case "answer":
            //     console.log("Recevied answer from the client");
            //     peer_conn = peer_connections[data.clientId];

            //     if(peer_conn != null)
            //     {
            //         handleAnswer(peer_conn, data.answer);
            //     }

            //     if (conn != null) {
            //         connection.otherName = data.name;
            //         sendTo(conn, {
            //             type: "answer",
            //             answer: data.answer
            //         });
            //     }

            //     break;

            case "candidate":
                handleCandidate(data.candidate, data.clientId);
                break;

            case "leave":
                console.log("Disconnecting from", data.name);
                conn = users[data.name];
                conn.otherName = null;

                //notify the other user so he can disconnect his peer connection 
                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }

                break;


            default:
                sendTo(connection, {
                    type: "error",
                    message: "Error: data.type is not found: " + data.type
                });
                break;
        }
    });

    // ::::::::::::::::::::On connection close::::::::::::::::
    connection.on("close", function () {

        if (connection.name) {
            delete users[connection.name];

            if (connection.otherName) {
                console.log("Disconnecting from ", connection.otherName);
                let conn = users[connection.otherName];
                conn.otherName = null;

                if (conn != null) {
                    sendTo(conn, {
                        type: "leave"
                    });
                }
            }
        }
    });

    connection.send("Hello from the server!!!");

});


// Method to send message to websocket client
function sendTo(connection, message) {
    connection.send(JSON.stringify(message));
}

// :::::::::::::::::::::::::::: WebRTC Related ::::::::::::::::::::::::
function createNewRTCPeer(ws_conn, clientId){
    //using Google public stun server
    let configuration = {
        "iceServers": [{
            urls: "turn:turn.inverseai.com:3478", 
            username: "guest",
            credential: "pass"
          }]
    };

    // let configuration = {
    //     "iceServers": []
    // };

    let newConn = new WebRTC.RTCPeerConnection(configuration);

    console.log("Peer connection created");

    // Setup ice handling 
    newConn.onicecandidate = function (event) {
        if (event.candidate && event.candidate.protocol !== 'tcp') {

            console.log("I am in OnIceCandidate!!!")
            // console.log(event.candidate)
            // console.log("WS conn: ",  ws_conn);
            sendTo(ws_conn, {
                type: "candidate",
                candidate: event.candidate
            });
        }
    };

    
    // creating data channel
    let dataChannel = newConn.createDataChannel("channel", {ordered: false, negotiated: true, maxRetransmits: 1, id: clientId});
    
    console.log(dataChannel)
    console.log("Data Channel State: ", dataChannel.readyState)

    dataChannel.onopen = function(event) {
        sendImage2Client(dataChannel)
        console.log("Data channel is openned!");
    }

    dataChannel.onerror = function (error) {
        console.log("Ooops...error:", error);
    };

    // when we receive a message from the other peer, display it on the screen 
    dataChannel.onmessage = function (event) {
        console.log("Message arrived from client");
        // console.log(event.data);
        // dataChannel.send("Reply")
        // chatArea.innerHTML += connectedUser + ": " + event.data + "<br />";
    };

    dataChannel.onclose = function () {
        console.log("data channel is closed");
    };

    peer_connections[clientId]=newConn; // Adding to global variable
    // console.log("ClientId #", clientId, dataChannel)
    data_channels[clientId]=dataChannel; // Adding into global variable
}


//When we got an ice candidate from a remote user 
function handleCandidate(candidate, clientId) {
    let peer_conn = peer_connections[clientId];
    
    if(peer_conn != null)
    {
        console.log("Got candidate, clientId #", clientId);
        peer_conn.addIceCandidate(new WebRTC.RTCIceCandidate(candidate));
        
        // try {
        //     ;s
        // } catch (error) {
        //     console.log(error)
        // }
    }
}


//when somebody sends an offer 
function handleOffer(offer, clientId) {
    console.log("Handle offer!");
    peer_conn = peer_connections[clientId];
    ws_conn = logged_in_connections[clientId];

    if(peer_conn!=null && ws_conn!=null)
    {
        peer_conn.setRemoteDescription(new WebRTC.RTCSessionDescription(offer));

        //create an answer to an offer 
        peer_conn.createAnswer(function (answer) {
            peer_conn.setLocalDescription(answer);
            sendTo(ws_conn, {
                type: "answer",
                answer: answer,
                clientId: clientId
            });
        }, function (error) {
            alert("Error when creating an answer");
        });
    }

}


// when we got an answer from a remote user 
// function handleAnswer(peer_conn, answer) {
//     peer_conn.setRemoteDescription(new WebRTC.RTCSessionDescription(answer));
// }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendImage2Client(channel)
{
  try {
    while(true)
    {

      await sleep(20)
    //   log_data = "Before >> Sent to client - Frame #" + frame_cnt + "  " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds()
    //   logger.log(log_data)

      channel.send(base64data)

    //   date = new Date()
    //   log_data = "After >> Sent to client - Frame #" + frame_cnt + "  " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + "." + date.getMilliseconds()
    //   frame_cnt += 1
    //   logger.log(log_data)
    }
  } catch (error) {
    // console.log(error)
  }
}

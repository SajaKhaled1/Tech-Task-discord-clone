import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./App.css";

const socket = io.connect("http://localhost:3001");

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [channel, setRoom] = useState("general");
  const [message, setMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [newRoom, setNewRoom] = useState("");
  const [channels, setChannels] = useState([]);
  const scrollRef = useRef();

  useEffect(() => {
    axios
      .get("http://localhost:3001/channels")
      .then((res) => setChannels(res.data))
      .catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessageList((list) => [...list, data]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageList]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? "/login" : "/register";
    try {
      const response = await axios.post(`http://localhost:3001${endpoint}`, {
        username,
        password,
      });

      if (isLogin) {
        setUsername(response.data.username);
        setIsLoggedIn(true); 
        joinRoom(response.data.username, "general");
      } else {
        alert("Registered successfully! Please login.");
        setIsLogin(true);
      }
    } catch (error) {
      alert(error.response?.data?.error || "An error occurred");
    }
  };

  const joinRoom = (user, channelName) => {
    if (!channelName) return;
    setRoom(channelName);
    socket.emit("join_channel", channelName);

    axios
      .get(`http://localhost:3001/messages/${channelName}`)
      .then((response) => setMessageList(response.data))
      .catch((error) => console.log(error));
  };

  const handleCreateRoom = async () => {
    if (newRoom.trim()) {
      const channelName = newRoom.trim().toLowerCase();
      if (!channels.includes(channelName)) {
        try {
          await axios.post("http://localhost:3001/channels", {
            name: channelName,
          });
          setChannels([...channels, channelName]);
        } catch (error) {
          alert(error.response?.data?.error || "Error creating channel");
        }
      }
      joinRoom(username, channelName);
      setNewRoom("");
    }
  };

  const sendMessage = async () => {
    if (message.trim() !== "") {
      const messageData = {
        channel: channel,
        sender: username,
        text: message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      await socket.emit("send_message", messageData);
      setMessage("");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>💬 Discord Clone</h1>
          <p>Let’s start chatting</p>
          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">{isLogin ? "Login" : "Register"}</button>
          </form>
          <p className="switch-auth" onClick={() => setIsLogin(!isLogin)}>
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Sidebar */}
      <div className="sidebar">
        <h3>Channels</h3>

        {channels.map((channel) => (
          <button
            key={channel}
            onClick={() => joinRoom(username, channel)}
            className={channel === channel ? "active" : ""}
          >
            # {channel}
          </button>
        ))}

        <div className="create-channel">
          <div style={{ display: "flex", gap: "5px" }}>
            <input
              type="text"
              placeholder="New channel..."
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
              style={{ flex: 1 }}
            />
            <button onClick={handleCreateRoom} className="add-btn">
              +
            </button>
          </div>
        </div>

        <div className="user-info">
          <span>👤 {username}</span>
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        <div className="chat-header">
          <span>#</span> {channel}
        </div>

        <div className="chat-body">
          {messageList.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.sender === username ? "mine" : "other"}`}
            >
              <div className="message-content">
                <div className="message-header">
                  <span className="sender">{msg.sender}</span>
                  <span className="time">{msg.time}</span>
                </div>
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        <div className="chat-footer">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${channel}...`}
          />
          <button onClick={sendMessage}>➤</button>
        </div>
      </div>
    </div>
  );
}

export default App;

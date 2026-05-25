const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"] 
  }
});

mongoose.connect('mongodb://localhost:27017/discordClone')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  sender: String,
  channel: String,
  text: String,
  time: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const ChannelSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  order: { type: Number, default: 0 }
});
const Channel = mongoose.model('Channel', ChannelSchema);

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.json({ message: 'User created successfully' });
  } catch (error) { 
    res.status(400).json({ error: 'Username already exists' }); 
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Login failed , Incorrect email or password.' });
  }

  res.json({ username });
});

app.get('/messages/:channel', async (req, res) => {
  const messages = await Message.find({ channel: req.params.channel }).sort({ createdAt: 1 });
  res.json(messages);
});

app.get('/channels', async (req, res) => {
  const channels = await Channel.find().sort({ order: 1, name: 1 });
  res.json(channels.map(c => c.name));
});

app.post('/channels', async (req, res) => {
  const { name } = req.body;

  try {
    const lastChannel = await Channel.findOne().sort({ order: -1 });

    const newOrder = lastChannel ? lastChannel.order + 1 : 3;

    const channel = await Channel.create({
      name: name.toLowerCase(),
      order: newOrder
    });

    res.json({ message: 'Channel created', name: channel.name });

  } catch (error) {
    res.status(400).json({ error: 'Channel already exists' });
  }
});

const initializeChannels = async () => {
  const defaultChannels = [
    { name: 'general', order: 1 },
    { name: 'random', order: 2 }
  ];
  
  for (const ch of defaultChannels) {
    await Channel.findOneAndUpdate(
      { name: ch.name },
      { name: ch.name, order: ch.order },
      { upsert: true, new: true }
    );
  }
  console.log('Default channels initialized');
};
initializeChannels();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_channel', (channel) => {
    socket.join(channel);
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = await Message.create(data);
      io.to(data.channel).emit('receive_message', newMessage);
    } catch (error) {
      console.log('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Error , User disconnected');
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
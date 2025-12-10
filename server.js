require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

// Desactiva el header por defecto de Express y establece PHP 7.4.3
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Powered-By', 'PHP 7.4.3');
  next();
});

// Helmet v3: aplica los middlewares explícitamente según los tests FCC
app.use(helmet.noSniff());    // Test 16: X-Content-Type-Options: nosniff
app.use(helmet.xssFilter());  // Test 17: X-XSS-Protection
app.use(helmet.noCache());    // Test 18: Cache-Control / Pragma / Expires

// Evita ETag globalmente (refuerza no-caché)
app.set('etag', false);

// CORS para pruebas FCC
app.use(cors({ origin: '*' }));

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir estáticos SIN caché
app.use('/public', express.static(process.cwd() + '/public', {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
}));
app.use('/assets', express.static(process.cwd() + '/assets', {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
}));

// Index page (static HTML)
app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Rutas de testing FCC
fccTestingRoutes(app);

// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io
const io = socket.listen(server);
const Collectible = require('./public/Collectible.mjs');
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

let players = [];
let baitNum = 0;
let bait;

io.on('connection', (socket) => {
  // on player connect
  socket.on('start', (player) => {
    console.log('player has joined', player);
    players.push(player);

    // send player info
    socket.emit('player_updates', players);

    // create a bait
    bait = createBait(baitNum);
    socket.emit('bait', bait);
  });

  // on player collision
  socket.on('collision', (player) => {
    for (let p of players) {
      if (p.id === player.id) {
        p.score += bait.value;
      }
    }
    // update bait
    bait = createBait(baitNum);
    socket.emit('bait', bait);
  });

  // optional: handle disconnect, keep tests happy
  socket.on('disconnect', () => {
    players = players.filter((p) => p.socketId !== socket.id);
    io.emit('player_updates', players);
  });
});

// create a new collectible
function createBait(id) {
  const random_x = Math.floor(Math.random() * (CANVAS_WIDTH - 20)) + 20;
  const random_y = Math.floor(Math.random() * (CANVAS_HEIGHT - 20)) + 20;
  const random_value = Math.floor(Math.random() * 5) + 1;
  baitNum += 1;
  return new Collectible({
    x: random_x,
    y: random_y,
    value: random_value,
    id: id
  });
}

module.exports = app; // For testing

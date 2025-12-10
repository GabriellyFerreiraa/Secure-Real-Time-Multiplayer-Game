require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
// 🛑 ÚLTIMO INTENTO DE CARGA PARA RENDER: Usamos path.join directamente
const path = require('path');
const helmet = require(path.join(process.cwd(), 'node_modules', 'helmet')); 
// FIN DE LA CORRECCIÓN DE CARGA

const cors = require('cors');
const socket = require('socket.io');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();

// =======================================================
// 🛡️ CONFIGURACIÓN DE SEGURIDAD (HELMET) - ¡DEBE IR PRIMERO!
// Esto resuelve los tests 16, 17, 18 y 19 de FreeCodeCamp.
// =======================================================

// 1. Configuración de seguridad completa para la versión 3.x
app.use(helmet()); 
app.use(helmet.xssFilter());   // Test 17: Previene XSS
app.use(helmet.noSniff());     // Test 16: Previene MIME Type Sniffing
app.use(helmet.noCache());     // Test 18: Desactiva el caché
app.use(helmet.hidePoweredBy()); // Oculta la cabecera predeterminada (Ej: Express)

// Test 19: La cabecera dice que el sitio es impulsado por "PHP 7.4.3"
// Esto se hace manualmente después de ocultar el predeterminado
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'PHP 7.4.3');
    next();
});

// -------------------------------------------------------

app.use(cors({origin: '*'})); // For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Archivos estáticos (¡DEBEN ir después de Helmet!)
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));


// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
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

// Socket.io setup:
// Start app and bind 
// Socket.io to the same port
const io = socket(server);
const Collectible = require('./public/Collectible');
const { generateStartPos, canvasCalcs } = require('./public/canvas-data');

let currPlayers = [];
const destroyedCoins = [];

const generateCoin = () => {
  const rand = Math.random();
  let coinValue;

  if (rand < 0.6) {
    coinValue = 1;
  } else if (rand < 0.85) {
    coinValue = 2;
  } else {
    coinValue = 3;
  }

  return new Collectible({ 
    x: generateStartPos(canvasCalcs.playFieldMinX, canvasCalcs.playFieldMaxX, 5),
    y: generateStartPos(canvasCalcs.playFieldMinY, canvasCalcs.playFieldMaxY, 5),
    value: coinValue,
    id: Date.now()
  });
}

let coin = generateCoin();

io.sockets.on('connection', socket => {
  console.log(`New connection ${socket.id}`);

  socket.emit('init', { id: socket.id, players: currPlayers, coin });

  socket.on('new-player', obj => {
    obj.id = socket.id;
    currPlayers.push(obj);
    socket.broadcast.emit('new-player', obj);
  });

  socket.on('move-player', (dir, obj) => {
    const movingPlayer = currPlayers.find(player => player.id === socket.id);
    if (movingPlayer) {
      movingPlayer.x = obj.x;
      movingPlayer.y = obj.y;

      socket.broadcast.emit('move-player', { id: socket.id, dir, posObj: { x: movingPlayer.x, y: movingPlayer.y } });
    }
  });

  socket.on('stop-player', (dir, obj) => {
    const stoppingPlayer = currPlayers.find(player => player.id === socket.id);
    if (stoppingPlayer) {
      stoppingPlayer.x = obj.x;
      stoppingPlayer.y = obj.y;

      socket.broadcast.emit('stop-player', { id: socket.id, dir, posObj: { x: stoppingPlayer.x, y: stoppingPlayer.y } });
    }
  });
  
  socket.on('destroy-item', ({ playerId, coinValue, coinId }) => {
    if (!destroyedCoins.includes(coinId)) {
      const scoringPlayer = currPlayers.find(obj => obj.id === playerId);
      const sock = io.sockets.connected[scoringPlayer.id];

      scoringPlayer.score += coinValue;
      destroyedCoins.push(coinId);

      // Broadcast to all players when someone scores
      io.emit('update-player', scoringPlayer);

      // Communicate win state and broadcast losses
      if (scoringPlayer.score >= 100) {
        sock.emit('end-game', 'win');
        sock.broadcast.emit('end-game', 'lose');
      } 

      // Generate new coin and send it to all players
      coin = generateCoin();
      io.emit('new-coin', coin);
    }
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('remove-player', socket.id);
    currPlayers = currPlayers.filter(player => player.id !== socket.id);
  });
});

module.exports = app; // For testing
// server.js
const http = require('http');
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const helmet = require('helmet');
const nocache = require('nocache');
const nanoid = require('nanoid').nanoid;

const {
  playerJoin,
  getPlayers,
  playerLeave,
  setPlayerState,
} = require('./utils/players');
// Si usas babel-node, las importaciones .mjs pueden funcionar. Mantengo las imports
// tal como las tenías (si no, coméntalas y usa require dinámico).
import Collectible from './public/Collectible.mjs';
import gameConfig from './public/gameConfig.mjs';
import generateStartPos from './public/utils/generateStartPos.mjs';

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Helmet: configuración básica + rename de X-Powered-By
app.use(
  helmet({
    // activa X-Content-Type-Options: nosniff
    noSniff: true,
    // cambiar X-Powered-By a PHP 7.4.3
    hidePoweredBy: {
      setTo: 'PHP 7.4.3',
    },
  })
);

// nocache middleware (añade cabeceras para evitar cache en muchos casos)
app.use(nocache());

// Añadir manualmente cabecera X-XSS-Protection (helmet ya no la añade por defecto)
app.use((req, res, next) => {
  // Protege contra ciertos ataques XSS en navegadores antiguos
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Asegurar que el cliente no haga MIME sniffing (si por alguna razón helmet no lo puso)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Forzar cabeceras para que no se guarde nada en cache (pruebas 18)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Servir estáticos
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// For FCC testing purposes
fccTestingRoutes(app);

// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

// --- Juego: generar collectible y lógica de sockets --- //
const playField = gameConfig.playField;
const collectibleSprite = gameConfig.collectibleSprite;
const collectiblePos = generateStartPos(playField, collectibleSprite);

const collectible = new Collectible({
  x: collectiblePos.x,
  y: collectiblePos.y,
  id: nanoid(),
  spriteSrcIndex: Math.floor(Math.random() * collectibleSprite.srcs.length),
});

io.on('connection', (socket) => {
  socket.on('joinGame', (player) => {
    const currentPlayers = getPlayers();
    socket.emit('currentOpponents', currentPlayers);
    socket.emit('collectible', collectible);

    const currentPlayer = playerJoin(player);
    socket.broadcast.emit('newOpponent', currentPlayer);
  });

  socket.on('playerStateChange', (player) => {
    const updatedPlayer = setPlayerState(player);
    socket.broadcast.emit('opponentStateChange', updatedPlayer);
  });

  socket.on('playerCollideWithCollectible', (player) => {
    player.score += collectible.value;
    socket.emit('scored', player.score);

    const updatedPlayer = setPlayerState(player);
    socket.broadcast.emit('opponentStateChange', updatedPlayer);

    let newCollectiblePos = generateStartPos(playField, collectibleSprite);
    while (
      newCollectiblePos.x === collectible.x &&
      newCollectiblePos.y === collectible.y
    ) {
      newCollectiblePos = generateStartPos(playField, collectibleSprite);
    }

    const newCollectibleId = nanoid();
    const newCollectibleSpriteSrcIndex =
      collectible.spriteSrcIndex === collectibleSprite.srcs.length - 1
        ? 0
        : collectible.spriteSrcIndex + 1;

    collectible.setState({
      x: newCollectiblePos.x,
      y: newCollectiblePos.y,
      id: newCollectibleId,
      spriteSrcIndex: newCollectibleSpriteSrcIndex,
    });

    io.sockets.emit('collectible', collectible);
  });

  socket.on('disconnect', () => {
    const player = playerLeave(socket.id);
    if (player && player.id) socket.broadcast.emit('opponentLeave', player.id);
  });
});

// Puerto y tests
const portNum = process.env.PORT || 3000;
server.listen(portNum, () => {
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

module.exports = server; // For testing

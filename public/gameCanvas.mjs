// setup canvas
const canvas = document.getElementById("game-window");
const context = canvas.getContext("2d");
const headingHeight = 35;
const buffer = 10;
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const dimensions = {
  context,
  headingHeight,
  buffer,
  canvasWidth,
  canvasHeight,
  minX: buffer,
  minY: headingHeight,
  maxX: canvasWidth - buffer,
  maxY: canvasHeight - buffer,
};

const arena = {
  clearCanvas: () => {
    context.clearRect(0, 0, dimensions.canvasWidth, dimensions.canvasHeight);
  },
  drawCanvas: () => {
    const gameBg = "#191919";
    context.fillStyle = gameBg;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  },
  drawHeading: () => {
    // game title
    context.fillStyle = "white";
    context.textAlign = "center";
    context.font = `bold 18px Arial`;
    context.fillText("Hungry Hungry Blocks", canvasWidth / 2, 22.5);
    // control directions
    context.font = `13px Arial`;
    context.fillText("Controls: WASD", 70, 22.5);
  },
  drawRank: (ranking) => {
    context.fillStyle = "white";
    context.font = `13px Arial`;
    context.fillText(`${ranking}`, canvasWidth - 75, 22.5);
  },
};

export { dimensions, arena };

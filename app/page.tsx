"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Piece } from 'react-chessboard/dist/chessboard/types';

export default function ChessEngineGame() {
  const serverURL = "https://noted-mullet-evolving.ngrok-free.app";

  // Game state
  const [game, setGame] = useState(new Chess());
  const [gameOver, setGameOver] = useState(false);
  const [fenInput, setFenInput] = useState("");
  const [playerID, setPlayerID] = useState(0);

  // Board state
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [playerColor, setPlayerColor] = useState("white");
  const [boardSize, setBoardSize] = useState(400);

  // Time control state
  const [timeControl, setTimeControl] = useState("3");
  const [increment, setIncrement] = useState("0");
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [isClockRunning, setIsClockRunning] = useState(false);
  const [activeColor, setActiveColor] = useState("w");

  // Refs
  const gameRef = useRef(game);
  const gameOverRef = useRef(gameOver);
  const playerColorRef = useRef(playerColor);
  const playerIDRef = useRef(playerID);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize game on mount
  useEffect(() => {
    getNewGame();
  }, []);

  useEffect(() => {
    const updateBoardSize = () => {
      // Calculate the maximum board size while maintaining some padding
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Estimate the height of controls (this is a rough estimate)
      // Adjust these values based on actual measurements if needed
      const topControlsHeight = 100; // Buttons at top
      const bottomControlsHeight = 250; // Time controls, FEN input, etc.
      const verticalPadding = 40; // Additional screen padding

      // Calculate available height for the board
      const availableHeight = windowHeight - 
        (topControlsHeight + bottomControlsHeight + verticalPadding);

      // Calculate board size based on both width and height constraints
      const widthBasedSize = windowWidth * 0.8;
      const heightBasedSize = availableHeight * 0.9; // Slightly less to ensure some padding

      // Choose the smaller dimension
      const maxSize = Math.min(widthBasedSize, heightBasedSize);
      
      // Ensure board size is a multiple of 8 for pixel-perfect rendering
      const boardDimension = Math.floor(maxSize / 8) * 8;
      
      // Set a minimum size
      setBoardSize(Math.max(boardDimension, 300)); // Minimum size of 300px
    };

    // Update size on mount and resize
    updateBoardSize();
    window.addEventListener('resize', updateBoardSize);
    
    return () => window.removeEventListener('resize', updateBoardSize);
  }, []);

  // Update refs
  useEffect(() => {
    gameRef.current = game;
    gameOverRef.current = gameOver;
    playerColorRef.current = playerColor;
  }, [game, gameOver, playerColor]);

  // Clock timer effect
  useEffect(() => {
    if (isClockRunning) {
      clockIntervalRef.current = setInterval(() => {
        if (activeColor === "w") {
          setWhiteTime(prevTime => {
            if (prevTime <= 0) {
              handleTimeOut("white");
              return 0;
            }
            return prevTime - 1;
          });
        } else {
          setBlackTime(prevTime => {
            if (prevTime <= 0) {
              handleTimeOut("black");
              return 0;
            }
            return prevTime - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [isClockRunning, activeColor]);

  // Keep-alive interval
  useEffect(() => {
    const sendKeepAliveRequest = async () => {
      try {
        const response = await fetch(`${serverURL}/keepalive?playerID=${playerIDRef.current}`);
        if (response.ok) {
          console.log('Keep-alive request successful');
        } else {
          console.error('Failed to send keep-alive request. Status Code:', response.status);
        }
      } catch (error) {
        console.error('Error sending keep-alive request:', error);
      }
    };

    const keepAliveInterval = setInterval(sendKeepAliveRequest, 30 * 1000);
    return () => clearInterval(keepAliveInterval);
  }, []);

  // Time control initialization
  useEffect(() => {
    const seconds = parseFloat(timeControl) * 60;
    setWhiteTime(seconds);
    setBlackTime(seconds);
  }, [timeControl]);

  const getNewGame = async () => {
    try {
      // Send the POST request to the server
      const response = await fetch(`${serverURL}/newgame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: "startpos",
      });
      if (response.ok) {
        const data = await response.json();
        setPlayerID(data.playerID);
        playerIDRef.current = data.playerID;
        console.log('PlayerID received:', data.playerID);
      }
      else {
        console.error("Failed to initialize game. Status code: " + response.status);
      }

    } catch (error) {
      console.error('Error initializing engine:', error);
    }
  };


  const endGame = async () => {
    try {
      const response = await fetch(`${serverURL}/endgame?playerID=${playerIDRef.current}`);
      if (response.ok) {
        console.log(response.text());
      }
      else {
        console.error('Failed to end game. Status Code:', response.status);
      }
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  // Time and game management
  const handleTimeOut = (color: string) => {
    if (gameOverRef.current) return;

    stopClock();
    setGameOver(true);
    alert(`Game Over ${color === "white" ? "Black" : "White"} wins on time!`);
  };

  const startClock = () => {
    setIsClockRunning(true);
  };

  const stopClock = () => {
    setIsClockRunning(false);
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
    }
  };

  const applyIncrement = (color: string) => {
    const inc = parseFloat(increment);
    if (color === "w") {
      setWhiteTime(prevTime => prevTime + inc);
    } else {
      setBlackTime(prevTime => prevTime + inc);
    }
  };

  // Game logic functions
  const engineMove = async () => {
    if (gameOverRef.current || !gameRef.current.turn() ||
      (playerColorRef.current === "white" && gameRef.current.turn() === "w") ||
      (playerColorRef.current === "black" && gameRef.current.turn() === "b")) {
      return;
    }

    try {
      const wtime = Math.round(whiteTime * 1000);
      const btime = Math.round(blackTime * 1000);
      const winc = Math.round(parseFloat(increment) * 1000);
      const binc = Math.round(parseFloat(increment) * 1000);

      const moveResponse = await fetch(`${serverURL}/bestmove?playerID=${playerIDRef.current}&wtime=${wtime}&winc=${winc}&btime=${btime}&binc=${binc}`);

      if (moveResponse.ok) {
        const moveData = await moveResponse.text();
        console.log('Engine move:', moveData);
        stopClock();

        const prevTurn = gameRef.current.turn();
        gameRef.current.move(moveData);
        setGame(gameRef.current);

        applyIncrement(prevTurn);
        setActiveColor(prevTurn === "w" ? "b" : "w");
        startClock();

        setTimeout(() => {
          if (gameRef.current.isGameOver()) {

            stopClock();
            setGameOver(true);

            let message;
            if (gameRef.current.isCheckmate()) {
              message = `Checkmate! ${gameRef.current.turn() === 'w' ? 'Black' : 'White'} wins!`;
            } else if (gameRef.current.isDraw()) {
              message = "Draw!";
            } else {
              message = "Game Over";
            }

            alert("Game Over: " + message);
          }
        }, 350);

        const response = await fetch(`${serverURL}/playermove?playerID=${playerIDRef.current}&move=${moveData}`);
        if (response.ok) {
          console.log(await response.text());
        } else {
          console.error('Failed to make move on backend. Status Code:', response.status);
        }
      }
      else {
        console.error('Failed to find best move. Status Code:', moveResponse.status);
      }
    } catch (error) {
      console.error('Error getting engine move:', error);
    }
  };

  const onDrop = (sourceSquare: Square, targetSquare: Square, piece: Piece) => {
    if (gameOverRef.current) return false;

    const pieceColor = piece[0].toLowerCase();
    if ((playerColorRef.current === "white" && pieceColor !== "w") ||
      (playerColorRef.current === "black" && pieceColor !== "b")) {
      return false;
    }

    try {
      const prevTurn = gameRef.current.turn();

      const move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() === "p" ? "q" : undefined
      });

      if (!move) return false;

      setGame(gameRef.current);
      stopClock();
      applyIncrement(prevTurn);
      setActiveColor(prevTurn === "w" ? "b" : "w");

      fetch(`${serverURL}/playermove?playerID=${playerIDRef.current}&move=${move.lan}`)
        .then(response => {
          if (response.ok) {
            console.log(response.text());
          } else {
            throw new Error('Failed to make move on backend. Status Code: ' + response.status + " " + response.statusText + " move: " + move.lan);
          }
        })
        .catch(error => {
          console.error(error); // Log any errors that occurred during the fetch
        });

      if (checkGameOver()) {
        return true;
      }

      startClock();
      setTimeout(engineMove, 500);

      return true;
    } catch (error) {
      console.error('Error making move:', error);
      return false;
    }
  };

  const checkGameOver = () => {
    if (gameRef.current.isGameOver()) {
      stopClock();
      setGameOver(true);

      let message;
      if (gameRef.current.isCheckmate()) {
        message = `Checkmate! ${gameRef.current.turn() === 'w' ? 'Black' : 'White'} wins!`;
      } else if (gameRef.current.isDraw()) {
        message = "Draw!";
      } else {
        message = "Game Over";
      }

      alert("Game Over " + message);
      return true;
    }
    return false;
  };

  // Game control functions
  const handleFlipBoard = () => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
  };

  const handlePlayAsWhite = async () => {
    await resetGame();
    setPlayerColor("white");
    setBoardOrientation("white");
    setActiveColor("w");
    startClock();
  };

  const handlePlayAsBlack = async () => {
    await resetGame();
    setPlayerColor("black");
    setBoardOrientation("black");
    setActiveColor("w");
    startClock();
    setTimeout(engineMove, 500);
  };

  const handleNewGame = async () => {
    await resetGame();
    const currentPlayerColor = boardOrientation === "white" ? "white" : "black";
    setPlayerColor(currentPlayerColor);
    setActiveColor("w");
    startClock();

    if (currentPlayerColor === "black") {
      setTimeout(engineMove, 500);
    }
  };

  const resetGame = async () => {
    stopClock();
    const newGame = new Chess();
    setGame(newGame);
    setGameOver(false);

    const seconds = parseFloat(timeControl) * 60;
    setWhiteTime(seconds);
    setBlackTime(seconds);

    await endGame();
    await getNewGame();
  };

  const handleResign = () => {
    if (gameOverRef.current) return;

    stopClock();
    alert(`Game Over! You resigned. ${playerColorRef.current === "white" ? "Black" : "White"} wins!`);
  };

  const handleLoadPosition = async () => {
    if (!fenInput) {
      alert("Invalid FEN, please enter a valid FEN String");
      return;
    }

    stopClock();
    const loadedGame = new Chess(fenInput);
    setGame(loadedGame);
    setGameOver(false);

    await endGame();

    try {
      const response = await fetch(`${serverURL}/newgame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `fen ${loadedGame.fen()}`,
      });

      if (response.ok) {
        const data = await response.json();
        setPlayerID(data.playerID);
        playerIDRef.current = data.playerID;
        console.log('PlayerID received:', data.playerID);

        const newPlayerColor = boardOrientation === "white" ? "white" : "black";
        setPlayerColor(newPlayerColor);
        setActiveColor(loadedGame.turn());
        startClock();

        if (newPlayerColor !== (loadedGame.turn() === "w" ? "white" : "black")) {
          setTimeout(engineMove, 500);
        }
      } else {
        console.error("Failed to create game. Status code: " + response.status);
      }
    } catch (error) {
      console.error('Error creating game:', error);
    }
  };

  // Utility functions
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeControlChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setTimeControl(value);
    }
  };

  const handleIncrementChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setIncrement(value);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 space-y-4">
      <div 
        className="bg-white shadow-lg rounded-lg p-6 space-y-4"
        style={{ width: boardSize + 48}}  // Force container to match board width
      >
        {/* Top Controls */}
        <div className="flex justify-between space-x-2">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handlePlayAsWhite}
          >
            Play as White
          </button>
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handleNewGame}
          >
            New Game
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handlePlayAsBlack}
          >
            Play as Black
          </button>
        </div>

        <div className="flex justify-between space-x-2">
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handleFlipBoard}
          >
            Flip Board
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handleResign}
          >
            Resign
          </button>
        </div>

        {/* Clocks and Board Container */}
        <div className="space-y-2">
          {/* Top Clock */}
          <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md shadow-inner">
            <span className="font-semibold text-gray-700">
              {boardOrientation === "white" ? "Black" : "White"} Clock
            </span>
            <span
              className={`font-mono text-lg ${activeColor === (boardOrientation === "white" ? "b" : "w") && isClockRunning
                  ? 'text-blue-600 font-bold'
                  : 'text-gray-700'
                } ${(boardOrientation === "white" ? blackTime : whiteTime) < 30
                  ? 'text-red-500 font-bold'
                  : ''
                }`}
            >
              {formatTime(boardOrientation === "white" ? blackTime : whiteTime)}
            </span>
          </div>

          {/* Chessboard */}
          <div className="my-2 flex justify-center">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              boardWidth={boardSize}
              boardOrientation={boardOrientation === "white" ? "white" : "black"}
            />
          </div>

          {/* Bottom Clock */}
          <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md shadow-inner">
            <span className="font-semibold text-gray-700">
              {boardOrientation === "white" ? "White" : "Black"} Clock
            </span>
            <span
              className={`font-mono text-lg ${activeColor === (boardOrientation === "white" ? "w" : "b") && isClockRunning
                  ? 'text-blue-600 font-bold'
                  : 'text-gray-700'
                } ${(boardOrientation === "white" ? whiteTime : blackTime) < 30
                  ? 'text-red-500 font-bold'
                  : ''
                }`}
            >
              {formatTime(boardOrientation === "white" ? whiteTime : blackTime)}
            </span>
          </div>
        </div>

        {/* Time Control Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">Time (minutes)</label>
            <input
              type="number"
              value={timeControl}
              onChange={(e) => handleTimeControlChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none 
                         placeholder-gray-500 text-black"
              placeholder="Time in minutes"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">Increment (seconds)</label>
            <input
              type="number"
              value={increment}
              onChange={(e) => handleIncrementChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none 
                         placeholder-gray-500 text-black"
              placeholder="Increment in seconds"
            />
          </div>
        </div>

        {/* FEN Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none 
                       placeholder-gray-500 text-black"
            placeholder="Enter FEN String"
          />
          <button
            onClick={handleLoadPosition}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
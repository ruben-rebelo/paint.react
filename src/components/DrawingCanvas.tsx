import React, { useRef, useEffect, useState } from 'react';

function DrawingCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) return;
 
        canvas.width = window.innerWidth * 2; // Higher for better resolution
        canvas.height = window.innerHeight * 2;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;

        const context = canvas.getContext('2d');

        if (!context) return;

        context.scale(2, 2); // Adjust for the higher resolution
        context.lineCap = 'round';
        context.strokeStyle = 'black';
        context.lineWidth = 5;
    }, []);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        const { offsetX, offsetY } = e.nativeEvent;
        if (!canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');
        if (!context) return;
        context.beginPath();
        context.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent } :  React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!isDrawing) {
            return;
        }
        const { offsetX, offsetY } = nativeEvent;
        if (!canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');

        if (!context) return;
        context.lineTo(offsetX, offsetY);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');

        if (!context) return;
        context.closePath();
        setIsDrawing(false);
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={draw}
            style={{ border: '2px solid #000', cursor: 'crosshair' }}
        />
    );
}

export { DrawingCanvas };

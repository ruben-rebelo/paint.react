import React, { useRef, useEffect, useState } from 'react';
import {RTCService} from '../service/RTCService';

type DrawingCanvas = {
    RTCServiceClient:  RTCService;
};

function DrawingCanvas({ RTCServiceClient }: DrawingCanvas) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

     // const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {

        // setSocket(RTCService.onConnect());

        RTCServiceClient.onConnect();
        RTCServiceClient.onDataReceived(drawFromPeer);

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

    const drawFromPeer = (data: {offsetX: number, offsetY: number, endLine: boolean }) => {
        const context = canvasRef.current?.getContext('2d');
        if (!context) return;

        if (data.endLine) {
            context.closePath();
        } else {
            if (!isDrawing) {
                context.beginPath();
                context.moveTo(data.offsetX, data.offsetY);
            } else {
                context.lineTo(data.offsetX, data.offsetY);
                context.stroke();
            }
        }
    }

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        const { offsetX, offsetY } = e.nativeEvent;
        if (!canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');
        if (!context) return;
        context.beginPath();
        context.moveTo(offsetX, offsetY);
        setIsDrawing(true);
        RTCServiceClient.sendDrawing({ offsetX, offsetY, endLine: false});
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
        RTCServiceClient.sendDrawing({ offsetX, offsetY, endLine: false});
    };

    const stopDrawing = () => {
        if (!canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');

        if (!context) return;
        context.closePath();
        setIsDrawing(false);
        RTCServiceClient.sendDrawing({ offsetX: 0, offsetY: 0, endLine: true});
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

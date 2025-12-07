'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    analyser?: AnalyserNode;
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
}

export const AudioVisualizer = ({
    analyser,
    width = 300,
    height = 100,
    color = '#22c55e', // matches green-500
    strokeWidth = 2
}: AudioVisualizerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        if (!analyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Configure analyser for optimal visualization
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            requestRef.current = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw background (optional: transparent or slight tint)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = color;
            ctx.beginPath();

            const sliceWidth = width * 1.0 / bufferLength;
            let x = 0;

            // Start line
            ctx.moveTo(0, height / 2);

            // We will use a quadratic curve strategy: start at point 0, then for each subsequent point, 
            // draw a curve to the midpoint between current and next point, using the current point as control.

            if (bufferLength > 0) {
                const v0 = dataArray[0] / 128.0;
                const y0 = v0 * height / 2;
                ctx.moveTo(0, y0);
                x = 0;

                for (let i = 0; i < bufferLength - 1; i++) {
                    const vCurrent = dataArray[i] / 128.0;
                    const yCurrent = vCurrent * height / 2;

                    const vNext = dataArray[i + 1] / 128.0;
                    const yNext = vNext * height / 2;

                    const xCurrent = x;
                    const xNext = x + sliceWidth;

                    const xMid = (xCurrent + xNext) / 2;
                    const yMid = (yCurrent + yNext) / 2;

                    // Curve from start range to mid range
                    if (i === 0) {
                        ctx.lineTo(xMid, yMid);
                    } else {
                        ctx.quadraticCurveTo(xCurrent, yCurrent, xMid, yMid);
                    }

                    x += sliceWidth;
                }
                // Connect last point
                const vLast = dataArray[bufferLength - 1] / 128.0;
                const yLast = vLast * height / 2;
                ctx.lineTo(width, yLast);
            }

            ctx.stroke();
        };

        draw();

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [analyser, width, height, color, strokeWidth]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full rounded-lg bg-black/5"
        />
    );
};

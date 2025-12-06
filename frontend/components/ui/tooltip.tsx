"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";

interface TooltipProps {
    content: string;
    children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <div
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="cursor-help"
            >
                {children}
            </div>
            {isVisible && (
                <div className="absolute z-50 w-64 p-3 text-sm bg-popover text-popover-foreground border rounded-lg shadow-lg -top-2 left-full ml-2">
                    <div className="absolute w-2 h-2 bg-popover border-l border-t transform -translate-y-1/2 rotate-45 -left-1 top-4" />
                    {content}
                </div>
            )}
        </div>
    );
}

interface ConfigLabelProps {
    label: string;
    tooltip: string;
}

export function ConfigLabel({ label, tooltip }: ConfigLabelProps) {
    return (
        <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{label}</label>
            <Tooltip content={tooltip}>
                <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            </Tooltip>
        </div>
    );
}

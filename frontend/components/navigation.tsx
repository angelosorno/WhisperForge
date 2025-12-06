"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, FileText, Home, BarChart3 } from "lucide-react";

export function Navigation() {
    const pathname = usePathname();

    const links = [
        { href: "/", label: "Inicio", icon: Home },
        { href: "/transcribe", label: "Transcribir", icon: Mic },
        { href: "/jobs", label: "Trabajos", icon: FileText },
        { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    ];

    return (
        <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/50 rounded-lg flex items-center justify-center">
                            <Mic className="w-5 h-5 text-white" />
                        </div>
                        <span className="gradient-text">WhisperForge</span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-1">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                    ${isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                        }
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{link.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
}

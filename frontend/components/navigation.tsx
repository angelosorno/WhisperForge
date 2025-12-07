"use client";

import { useState } from "react";
import { Link, usePathname } from "@/navigation";
import { Mic, FileText, Home, BarChart3, Radio, Antenna, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export function Navigation() {
    const pathname = usePathname();
    const t = useTranslations("Navigation");
    const [isOpen, setIsOpen] = useState(false);

    const links = [
        { href: "/", label: t("home"), icon: Home },
        { href: "/transcribe", label: t("transcribe"), icon: Mic },
        { href: "/jobs", label: t("jobs"), icon: FileText },
        { href: "/live", label: t("live"), icon: Radio },
        { href: "/broadcaster", label: t("broadcaster"), icon: Antenna },
        { href: "/dashboard", label: t("dashboard"), icon: BarChart3 },
    ];

    return (
        <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl z-50 relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/50 rounded-lg flex items-center justify-center">
                            <Mic className="w-5 h-5 text-white" />
                        </div>
                        <span className="gradient-text">WhisperForge</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-1">
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
                                    <span>{link.label}</span>
                                </Link>
                            );
                        })}
                        <div className="ml-2 pl-2 border-l">
                            <LanguageSwitcher />
                        </div>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="lg:hidden p-2 text-muted-foreground hover:text-foreground z-50 relative"
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>

                    {/* Mobile Menu Overlay */}
                    {isOpen && (
                        <div className="fixed inset-0 top-0 bg-background/95 backdrop-blur-xl z-40 lg:hidden flex flex-col pt-20 px-4 animate-in fade-in slide-in-from-top-5 duration-200">
                            <div className="flex flex-col gap-2">
                                {links.map((link) => {
                                    const Icon = link.icon;
                                    const isActive = pathname === link.href;

                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`
                                                flex items-center gap-3 px-4 py-4 rounded-xl font-medium text-lg transition-colors
                                                ${isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                                }
                                            `}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span>{link.label}</span>
                                        </Link>
                                    );
                                })}
                                <div className="mt-4 pt-4 border-t flex justify-between items-center px-2">
                                    <span className="text-sm text-muted-foreground font-medium">Idioma</span>
                                    <LanguageSwitcher />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

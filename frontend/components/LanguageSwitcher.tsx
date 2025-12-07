'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { useTransition, ChangeEvent } from 'react';

export default function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();
    const [isPending, startTransition] = useTransition();

    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value;
        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <select
            defaultValue={locale}
            onChange={handleChange}
            disabled={isPending}
            className="ml-4 px-2 py-1 rounded-md border bg-background text-sm"
        >
            <option value="es">🇪🇸 Español</option>
            <option value="en">🇬🇧 English</option>
            {/* Add more languages as needed, make sure they are in messages/*.json */}
        </select>
    );
}

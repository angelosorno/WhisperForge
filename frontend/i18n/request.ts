import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const locales = ['es', 'en'];

export default getRequestConfig(async ({ requestLocale }) => {
    // Validate that the incoming `locale` parameter is valid
    let locale = await requestLocale;

    if (!locale || !locales.includes(locale as any)) {
        locale = 'es'; // Default fallback
    }

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default
    };
});

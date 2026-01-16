/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}"
    ],
    darkMode: 'media', // or 'class'
    theme: {
        extend: {
            colors: {
                // Custom colors if needed, but standard palette is fine
            }
        },
    },
    plugins: [],
}

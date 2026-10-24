// Small code-native symbols keep essential controls readable without an emoji font.
const paths = {
 overview:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
 economy:'M3 18l6-6 4 3 8-11M15 4h6v6M3 21h18',
 energy:'m13 2-9 12h7l-1 8 10-13h-8l1-7Z',
 resources:'m12 2 9 6v8l-9 6-9-6V8l9-6ZM3 8l9 6 9-6M12 14v8',
 arsenal:'M3 21V9l6 4V7l6 4V3h6v18H3ZM7 17h2m4 0h2m3 0h1',
 forces:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM8 12l3 3 5-6',
 intel:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 technology:'M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10',
 trade:'M3 7h17l-4-4m4 4-4 4M21 17H4l4 4m-4-4 4-4',
 bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4',
};
export function Icon({name,size=18}) {
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.overview}/></svg>;
}

import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { getLocale } from "../paraglide/runtime";
import css from "../styles/globals.css?url";
const themeScript = `try{const saved=localStorage.getItem('theme');const mode=(saved==='light'||saved==='dark')?saved:'auto';const dark=mode==='dark'||(mode==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light'}catch{}`;
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Schnitzellunch.se" },
      { name: "description", content: "Find schnitzel lunches in Gothenburg." },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: "/snzl.png" },
    ],
  }),
  shellComponent: RootDocument,
});
function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

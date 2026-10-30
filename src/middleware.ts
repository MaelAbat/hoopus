import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/profil"];

// Rubriques masquées au public — aucune pour l'instant. Bloquer ici plutôt que
// dans la page compte : une page qui diffuse d'abord son squelette de chargement
// voit son notFound() arriver après l'envoi du 200. Depuis le middleware, la
// route n'existe simplement pas — un vrai 404, avant tout rendu.
const HIDDEN_ROUTES: string[] = [];

/**
 * Segments de saison attendus par /draft/[season]. Un segment invalide doit
 * répondre 404, et pas 200 avec une page d'erreur : le ticker de l'accueil ouvre
 * une frontière de streaming dans le gabarit racine (layout.tsx), si bien que les
 * en-têtes partent avant qu'une page puisse encore changer son statut.
 */
const SEASON_SEGMENT = /^\d{4}-\d{2}$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  const draftSegment = pathname.match(/^\/draft\/([^/]+)\/?$/);
  if (draftSegment && !SEASON_SEGMENT.test(decodeURIComponent(draftSegment[1]))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  // Pas de cookie de session Supabase : rien à rafraîchir. C'est le cas de la
  // plupart des visites, robots compris ; leur épargner l'aller-retour vers
  // Supabase Auth évite d'attendre sa réponse à chaque requête.
  const hasSession = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
  if (!hasSession) {
    if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session token
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Security headers
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Les routes d'API, le sitemap, robots, le manifeste et l'image OpenGraph
    // n'ont pas de session à rafraîchir : le polling des scores passait à lui
    // seul par ici toutes les trente secondes et par onglet ouvert.
    "/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

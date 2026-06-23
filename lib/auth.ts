import { prisma } from "./prisma";

// UWAGA — DEV ONLY. Single hardcoded user dla MVP.
// Zamień na Auth.js (NextAuth) w fazie 4 — interfejs getCurrentUser()/getCurrentUserId()
// pozostaje ten sam, więc warstwa wyżej się nie zmieni.
const DEV_USER_EMAIL = "dev@networth.local";

export async function getCurrentUser() {
  const user = await prisma.user.findFirst({ where: { email: DEV_USER_EMAIL } });
  if (!user) {
    throw new Error(
      "Dev user nie znaleziony — uruchom `npm run db:seed` najpierw."
    );
  }
  return user;
}

export async function getCurrentUserId() {
  return (await getCurrentUser()).id;
}
